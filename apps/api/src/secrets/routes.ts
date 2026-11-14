import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { createDb } from '../db/client';
import { environments, secrets, secretFolders } from '../db/schema';
import type { AppBindings } from '../env';
import { encryptSecret, decryptSecret } from '../crypto/envelope';
import { getProjectDataKey } from '../crypto/project-keys';
import { requireOwner } from '../security/require-owner';
import { validateSecretInput } from './validation';
import { validateFolderTarget } from '../folders/validation';

export const secretRoutes = new Hono<{ Bindings: AppBindings }>();

// Defense in depth: nested routes must not rely on caller mount order.
secretRoutes.use('*', requireOwner);
secretRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');
  c.header('X-Content-Type-Options', 'nosniff');
  await next();
});

async function scopedEnvironment(env: AppBindings, projectId: string, environmentId: string) {
  const [row] = await createDb(env).select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)))
    .limit(1);
  return Boolean(row);
}

function metadata(row: typeof secrets.$inferSelect) {
  return { id: row.id, key: row.key, projectId: row.projectId, environmentId: row.environmentId,
    folderId: row.folderId, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

secretRoutes.get('/', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  if (!projectId || !environmentId || !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  // Filter by folder. Missing folderId means root; nested folders are separate.
  const folderId = c.req.query('folderId');
  if (folderId !== undefined) {
    if (!folderId) return c.json({ error: 'Invalid folder ID' }, 400);
    const [folder] = await createDb(c.env).select({ id: secretFolders.id }).from(secretFolders)
      .where(and(eq(secretFolders.id, folderId), eq(secretFolders.projectId, projectId),
        eq(secretFolders.environmentId, environmentId))).limit(1);
    if (!folder) return c.json({ error: 'Folder not found' }, 404);
  }
  // Intentionally no secret ciphertext or plaintext in list responses.
  const rows = await createDb(c.env).select().from(secrets)
    .where(and(eq(secrets.projectId, projectId), eq(secrets.environmentId, environmentId),
      folderId === undefined ? isNull(secrets.folderId) : eq(secrets.folderId, folderId)))
    .orderBy(asc(secrets.key))
    .limit(500);
  return c.json({ data: rows.map(metadata) });
});

secretRoutes.post('/', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  if (!projectId || !environmentId || !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  const body = await c.req.json().catch(() => null);
  const input = validateSecretInput(body);
  if (!input) return c.json({ error: 'Invalid secret key or value' }, 400);
  const db = createDb(c.env);
  const [duplicate] = await db.select({ id: secrets.id }).from(secrets)
    .where(and(eq(secrets.environmentId, environmentId), eq(secrets.key, input.key))).limit(1);
  if (duplicate) return c.json({ error: 'Secret key already exists' }, 409);

  const id = crypto.randomUUID();
  const dek = await getProjectDataKey(c.env, projectId);
  let sealed;
  try {
    sealed = await encryptSecret(dek, { projectId, environmentId, secretId: id }, input.value);
  } finally {
    dek.fill(0);
  }
  const now = new Date();
  const row = { id, projectId, environmentId, key: input.key, encryptedValue: sealed.ciphertext,
    nonce: sealed.nonce, createdAt: now, updatedAt: now };
  try {
    await db.insert(secrets).values(row);
  } catch {
    // Unique index also protects concurrent inserts, without logging plaintext.
    return c.json({ error: 'Unable to create secret, key may already exist' }, 409);
  }
  return c.json(metadata(row), 201);
});

secretRoutes.patch('/:secretId', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  const secretId = c.req.param('secretId');
  if (!projectId || !environmentId || !secretId ||
      !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  const body = await c.req.json().catch(() => null);
  const input = validateSecretInput(body);
  if (!input) return c.json({ error: 'Invalid secret key or value' }, 400);
  const db = createDb(c.env);
  const condition = and(eq(secrets.id, secretId), eq(secrets.projectId, projectId),
    eq(secrets.environmentId, environmentId));
  const [existing] = await db.select({ id: secrets.id }).from(secrets).where(condition).limit(1);
  if (!existing) return c.json({ error: 'Secret not found' }, 404);

  const dek = await getProjectDataKey(c.env, projectId);
  let sealed;
  try {
    sealed = await encryptSecret(dek, { projectId, environmentId, secretId }, input.value);
  } finally {
    dek.fill(0);
  }
  try {
    const [updated] = await db.update(secrets).set({
      key: input.key, encryptedValue: sealed.ciphertext, nonce: sealed.nonce, updatedAt: new Date(),
    }).where(condition).returning();
    return updated ? c.json(metadata(updated)) : c.json({ error: 'Secret not found' }, 404);
  } catch {
    return c.json({ error: 'Unable to update secret; key may already exist' }, 409);
  }
});

secretRoutes.post('/:secretId/reveal', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  const secretId = c.req.param('secretId');
  if (!projectId || !environmentId || !secretId ||
      !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  const [row] = await createDb(c.env).select().from(secrets).where(and(
    eq(secrets.id, secretId), eq(secrets.projectId, projectId),
    eq(secrets.environmentId, environmentId),
  )).limit(1);
  if (!row) return c.json({ error: 'Secret not found' }, 404);
  const dek = await getProjectDataKey(c.env, projectId);
  try {
    const value = await decryptSecret(dek, { projectId, environmentId, secretId }, {
      ciphertext: row.encryptedValue, nonce: row.nonce,
    });
    // Explicit request only. Never cache in the browser query client.
    return c.json({ value });
  } finally {
    dek.fill(0);
  }
});

secretRoutes.delete('/:secretId', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  const secretId = c.req.param('secretId');
  if (!projectId || !environmentId || !secretId ||
      !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  const [deleted] = await createDb(c.env).delete(secrets).where(and(
    eq(secrets.id, secretId), eq(secrets.projectId, projectId),
    eq(secrets.environmentId, environmentId),
  )).returning({ id: secrets.id });
  return deleted ? c.body(null, 204) : c.json({ error: 'Secret not found' }, 404);
});

/** Move ciphertext without decrypting or changing its authenticated identity. */
secretRoutes.patch('/:secretId/folder', async (c) => {
  const projectId = c.req.param('projectId');
  const environmentId = c.req.param('environmentId');
  const secretId = c.req.param('secretId');
  if (!projectId || !environmentId || !secretId ||
      !await scopedEnvironment(c.env, projectId, environmentId))
    return c.json({ error: 'Environment not found' }, 404);
  const target = validateFolderTarget(await c.req.json().catch(() => null));
  if (target === undefined) return c.json({ error: 'Invalid folder target' }, 400);
  const db = createDb(c.env);
  if (target !== null) {
    const [folder] = await db.select({ id: secretFolders.id }).from(secretFolders)
      .where(and(eq(secretFolders.id, target), eq(secretFolders.projectId, projectId),
        eq(secretFolders.environmentId, environmentId))).limit(1);
    if (!folder) return c.json({ error: 'Folder not found' }, 404);
  }
  const [updated] = await db.update(secrets).set({ folderId: target, updatedAt: new Date() })
    .where(and(eq(secrets.id, secretId), eq(secrets.projectId, projectId),
      eq(secrets.environmentId, environmentId))).returning();
  return updated ? c.json(metadata(updated)) : c.json({ error: 'Secret not found' }, 404);
});
