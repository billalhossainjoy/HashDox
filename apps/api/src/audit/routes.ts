import { Hono } from 'hono';
import { and, desc, eq, lt } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projects, secretAuditEvents } from '../db/schema';
import type { AppBindings } from '../env';
import { requireOwner } from '../security/require-owner';

/** Read-only owner audit feed with bounded cursor pagination. */
export const auditRoutes = new Hono<{ Bindings: AppBindings }>();
auditRoutes.use('*', requireOwner);
auditRoutes.get('/', async c => {
  c.header('Cache-Control', 'no-store');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Project ID required' }, 400);

  const db = createDb(c.env);
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(eq(projects.id, projectId)).limit(1);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const before = c.req.query('before');
  if (before !== undefined && (!/^\d{1,15}$/.test(before) || !Number.isSafeInteger(Number(before)))) {
    return c.json({ error: 'Invalid cursor' }, 400);
  }

  const entries = await db.select().from(secretAuditEvents)
    .where(and(eq(secretAuditEvents.projectId, projectId),
      before === undefined ? undefined : lt(secretAuditEvents.createdAt, new Date(Number(before)))))
    .orderBy(desc(secretAuditEvents.createdAt), desc(secretAuditEvents.id)).limit(100);
  return c.json({ data: entries });
});
