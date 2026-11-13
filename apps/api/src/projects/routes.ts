import { Hono } from 'hono';
import { count, desc, eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projects } from '../db/schema';
import type { AppBindings } from '../env';
import { requireOwner } from '../security/require-owner';
import { parseProjectPage, PROJECT_PAGE_SIZE, validateProjectInput } from './validation';

export const projectRoutes = new Hono<{ Bindings: AppBindings }>();

// All operations require a verified owner session, including reads.
projectRoutes.use('*', requireOwner);

projectRoutes.get('/', async (c) => {
  const page = parseProjectPage(c.req.query('page'));
  if (page === null) return c.json({ error: 'Invalid page parameter' }, 400);
  const db = createDb(c.env);
  const [rows, totals] = await Promise.all([
    db.select().from(projects)
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(PROJECT_PAGE_SIZE).offset((page - 1) * PROJECT_PAGE_SIZE),
    db.select({ total: count() }).from(projects),
  ]);
  return c.json({ data: rows, page, pageSize: PROJECT_PAGE_SIZE, total: totals[0]?.total ?? 0 });
});

projectRoutes.get('/:id', async (c) => {
  const db = createDb(c.env);
  const [project] = await db.select().from(projects).where(eq(projects.id, c.req.param('id'))).limit(1);
  return project ? c.json(project) : c.json({ error: 'Project not found' }, 404);
});

projectRoutes.post('/', async (c) => {
  const payload = await c.req.json().catch(() => null);
  const input = validateProjectInput(payload);
  if (!input) return c.json({ error: 'Expected a project name (1–100 characters)' }, 400);

  const now = new Date();
  const project = { id: crypto.randomUUID(), name: input.name, createdAt: now, updatedAt: now };
  await createDb(c.env).insert(projects).values(project);
  return c.json(project, 201);
});

projectRoutes.patch('/:id', async (c) => {
  const payload = await c.req.json().catch(() => null);
  const input = validateProjectInput(payload);
  if (!input) return c.json({ error: 'Expected a project name (1–100 characters)' }, 400);

  const db = createDb(c.env);
  const [updated] = await db.update(projects)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(projects.id, c.req.param('id')))
    .returning();
  return updated ? c.json(updated) : c.json({ error: 'Project not found' }, 404);
});

projectRoutes.delete('/:id', async (c) => {
  const [deleted] = await createDb(c.env).delete(projects)
    .where(eq(projects.id, c.req.param('id'))).returning({ id: projects.id });
  return deleted ? c.body(null, 204) : c.json({ error: 'Project not found' }, 404);
});
