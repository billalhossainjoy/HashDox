import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { environments, secretFolders, secrets } from '../db/schema';
import type { AppBindings } from '../env';
import { requireOwner } from '../security/require-owner';
import { validateFolderName, validateFolderTarget } from './validation';
import { reparentFolderAtomically } from './atomic-move';

export const folderRoutes = new Hono<{ Bindings: AppBindings }>();
folderRoutes.use('*', requireOwner);

async function isValidEnvironment(env: AppBindings, projectId: string, environmentId: string) {
  const [row] = await createDb(env).select({ id: environments.id }).from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, environmentId))).limit(1);
  return Boolean(row);
}

function scope(projectId: string, environmentId: string) {
  return and(eq(secretFolders.projectId, projectId), eq(secretFolders.environmentId, environmentId));
}

folderRoutes.use('*', async (c, next) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  if (!projectId || !environmentId || !await isValidEnvironment(c.env, projectId, environmentId)) {
    return c.json({ error: 'Environment not found' }, 404);
  }
  c.header('Cache-Control', 'no-store');
  await next();
});

folderRoutes.get('/', async (c) => {
  const projectId = c.req.param('projectId')!;
  const environmentId = c.req.param('environmentId')!;
  const rows = await createDb(c.env).select().from(secretFolders)
    .where(scope(projectId, environmentId))
    .orderBy(asc(secretFolders.name)).limit(1000);
  return c.json({ data: rows });
});

folderRoutes.post('/', async (c) => {
  const projectId = c.req.param('projectId')!;
  const environmentId = c.req.param('environmentId')!;
  const payload: unknown = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return c.json({ error: 'Invalid folder' }, 400);
  const values = payload as Record<string, unknown>;
  if (Object.keys(values).some(k => k !== 'name' && k !== 'parentId')) return c.json({ error: 'Invalid folder' }, 400);
  const name = validateFolderName({ name: values.name });
  if (!name) return c.json({ error: 'Invalid folder name' }, 400);
  const parentId = values.parentId === undefined || values.parentId === null ? null : values.parentId;
  if (parentId !== null && (typeof parentId !== 'string' || !parentId || parentId.length > 100)) {
    return c.json({ error: 'Invalid parent folder' }, 400);
  }
  const db = createDb(c.env);
  if (parentId) {
    const [parent] = await db.select({ id: secretFolders.id }).from(secretFolders)
      .where(and(scope(projectId, environmentId), eq(secretFolders.id, parentId))).limit(1);
    if (!parent) return c.json({ error: 'Parent folder not found' }, 404);
  }
  const now = new Date();
  const entry = {
    id: crypto.randomUUID(), projectId, environmentId,
    parentId, parentKey: parentId ?? '', name, createdAt: now, updatedAt: now,
  };
  try {
    await db.insert(secretFolders).values(entry);
    return c.json(entry, 201);
  } catch {
    return c.json({ error: 'Folder already exists or parent is invalid' }, 409);
  }
});

folderRoutes.patch('/:folderId', async (c) => {
  const projectId = c.req.param('projectId')!;
  const environmentId = c.req.param('environmentId')!;
  const name = validateFolderName(await c.req.json().catch(() => null));
  if (!name) return c.json({ error: 'Invalid folder name' }, 400);
  const db = createDb(c.env);
  try {
    const [updated] = await db.update(secretFolders).set({ name, updatedAt: new Date() })
      .where(and(scope(projectId, environmentId), eq(secretFolders.id, c.req.param('folderId')))).returning();
    return updated ? c.json(updated) : c.json({ error: 'Folder not found' }, 404);
  } catch {
    return c.json({ error: 'A folder with this name already exists' }, 409);
  }
});

folderRoutes.delete('/:folderId', async (c) => {
  const projectId = c.req.param('projectId')!;
  const environmentId = c.req.param('environmentId')!;
  const folderId = c.req.param('folderId');
  const db = createDb(c.env);
  const [folder] = await db.select({ id: secretFolders.id }).from(secretFolders)
    .where(and(scope(projectId, environmentId), eq(secretFolders.id, folderId))).limit(1);
  if (!folder) return c.json({ error: 'Folder not found' }, 404);
  const [child] = await db.select({ id: secretFolders.id }).from(secretFolders)
    .where(and(scope(projectId, environmentId), eq(secretFolders.parentId, folderId))).limit(1);
  const [secret] = await db.select({ id: secrets.id }).from(secrets)
    .where(and(eq(secrets.projectId, projectId), eq(secrets.environmentId, environmentId),
      eq(secrets.folderId, folderId))).limit(1);
  if (child || secret) return c.json({ error: 'Move or delete contents before deleting this folder' }, 409);
  try {
    const [deleted] = await db.delete(secretFolders)
      .where(and(scope(projectId, environmentId), eq(secretFolders.id, folderId)))
      .returning({ id: secretFolders.id });
    return deleted ? c.body(null, 204) : c.json({ error: 'Folder not found' }, 404);
  } catch {
    // FK RESTRICT also protects concurrent insertions.
    return c.json({ error: 'Folder is not empty' }, 409);
  }
});


/**
 * Reparent a folder within the same project/environment. Refuses self and
 * descendant targets, duplicate sibling names and invalid foreign parents.
 */
folderRoutes.patch('/:folderId/parent', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  const folderId = c.req.param('folderId');
  if (!projectId || !environmentId || !folderId) {
    return c.json({ error: 'Missing folder scope' }, 400);
  }
  const parentId = validateFolderTarget(await c.req.json().catch(() => null));
  if (parentId === undefined) return c.json({ error: 'Invalid parent folder' }, 400);

  const db = createDb(c.env);
  const [current] = await db.select().from(secretFolders)
    .where(and(scope(projectId, environmentId), eq(secretFolders.id, folderId))).limit(1);
  if (!current) return c.json({ error: 'Folder not found' }, 404);

  try {
    const moved = await reparentFolderAtomically(
      c.env.DB, projectId, environmentId, folderId, parentId,
    );
    if (!moved) return c.json({
      error: 'Invalid destination: folder missing, different environment, or circular hierarchy',
    }, 409);
    return c.json({ ...current, parentId: moved.parentId, parentKey: moved.parentKey,
      updatedAt: new Date() });
  } catch {
    return c.json({ error: 'Folder move conflicts with a sibling name or database constraint' }, 409);
  }
});
