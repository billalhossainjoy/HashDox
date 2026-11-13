import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { environments, projects } from '../db/schema';
import type { AppBindings } from '../env';
import { environmentSlug, validateEnvironmentName } from './validation';

export const environmentRoutes = new Hono<{ Bindings: AppBindings }>();

async function projectExists(env: AppBindings, projectId: string) {
  const [project] = await createDb(env).select({ id: projects.id })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  return Boolean(project);
}

environmentRoutes.get('/', async (c) => {
  const projectId = c.req.param('projectId');
  if (!await projectExists(c.env, projectId)) return c.json({ error: 'Project not found' }, 404);
  const rows = await createDb(c.env).select().from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(asc(environments.createdAt), asc(environments.slug));
  return c.json({ data: rows });
});

environmentRoutes.post('/', async (c) => {
  const projectId = c.req.param('projectId');
  if (!await projectExists(c.env, projectId)) return c.json({ error: 'Project not found' }, 404);
  const name = validateEnvironmentName(await c.req.json().catch(() => null));
  const slug = name === null ? null : environmentSlug(name);
  if (!name || !slug) return c.json({ error: 'Use an alphanumeric environment name (1–60 characters); spaces allowed' }, 400);
  const db = createDb(c.env);
  const [existing] = await db.select({ id: environments.id }).from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.slug, slug))).limit(1);
  if (existing) return c.json({ error: 'Environment already exists' }, 409);
  const now = new Date();
  const item = { id: crypto.randomUUID(), projectId, name, slug, createdAt: now, updatedAt: now };
  try {
    await db.insert(environments).values(item);
    return c.json(item, 201);
  } catch {
    // The unique (projectId, slug) index handles simultaneous creations.
    return c.json({ error: 'Unable to create environment (possibly duplicate)' }, 409);
  }
});

environmentRoutes.patch('/:environmentId', async (c) => {
  const projectId = c.req.param('projectId');
  if (!await projectExists(c.env, projectId)) return c.json({ error: 'Project not found' }, 404);
  const name = validateEnvironmentName(await c.req.json().catch(() => null));
  if (!name || !environmentSlug(name)) return c.json({ error: 'Use an alphanumeric environment name (1–60 characters); spaces allowed' }, 400);
  const db = createDb(c.env);
  const [updated] = await db.update(environments).set({ name, updatedAt: new Date() })
    .where(and(eq(environments.projectId, projectId), eq(environments.id, c.req.param('environmentId'))))
    .returning();
  return updated ? c.json(updated) : c.json({ error: 'Environment not found' }, 404);
});

environmentRoutes.delete('/:environmentId', async (c) => {
  const projectId = c.req.param('projectId');
  if (!await projectExists(c.env, projectId)) return c.json({ error: 'Project not found' }, 404);
  const [deleted] = await createDb(c.env).delete(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.id, c.req.param('environmentId'))))
    .returning({ id: environments.id });
  return deleted ? c.body(null, 204) : c.json({ error: 'Environment not found' }, 404);
});
