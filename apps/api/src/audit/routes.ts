import { Hono } from 'hono';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projects, secretAuditEvents } from '../db/schema';
import type { AppBindings } from '../env';
import { requireOwner } from '../security/require-owner';
import { AUDIT_PAGE_SIZE, decodeAuditCursor, encodeAuditCursor } from './pagination';

/** Read-only owner audit feed with deterministic, bounded cursor pagination. */
export const auditRoutes = new Hono<{ Bindings: AppBindings }>();
auditRoutes.use('*', requireOwner);
auditRoutes.get('/', async c => {
  c.header('Cache-Control', 'no-store');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Project ID required' }, 400);

  const cursor = decodeAuditCursor(c.req.query('cursor'));
  if (cursor === undefined) return c.json({ error: 'Invalid cursor' }, 400);
  // Earlier timestamp-only cursors dropped events sharing a millisecond.
  // Callers must use the opaque nextCursor from the previous page.
  if (c.req.query('before') !== undefined) {
    return c.json({ error: 'Use cursor instead of before' }, 400);
  }

  const db = createDb(c.env);
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(eq(projects.id, projectId)).limit(1);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const condition = cursor === null ? undefined : or(
    lt(secretAuditEvents.createdAt, new Date(cursor.time)),
    and(eq(secretAuditEvents.createdAt, new Date(cursor.time)), lt(secretAuditEvents.id, cursor.id)),
  );
  const rows = await db.select().from(secretAuditEvents)
    .where(and(eq(secretAuditEvents.projectId, projectId), condition))
    .orderBy(desc(secretAuditEvents.createdAt), desc(secretAuditEvents.id))
    .limit(AUDIT_PAGE_SIZE + 1);
  const more = rows.length > AUDIT_PAGE_SIZE;
  const data = more ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  const last = data.at(-1);
  return c.json({
    data,
    nextCursor: more && last
      ? encodeAuditCursor({ time: last.createdAt.getTime(), id: last.id })
      : null,
  });
});
