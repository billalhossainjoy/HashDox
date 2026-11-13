import { createMiddleware } from 'hono/factory';
import { createAuth } from '../auth';
import type { AppBindings } from '../env';
import { isOwnerEmail } from './owner';

/**
 * Owner-only access boundary for application API routes.
 * A Google login alone does not authorize access to HashDox resources.
 */
export const requireOwner = createMiddleware<{ Bindings: AppBindings }>(async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (!isOwnerEmail(session.user.email, c.env.OWNER_EMAIL)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});
