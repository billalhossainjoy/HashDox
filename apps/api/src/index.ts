import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './auth';
import type { AppBindings } from './env';
import { requireOwner } from './security/require-owner';
import { projectRoutes } from './projects/routes';

const app = new Hono<{ Bindings: AppBindings }>();

app.use('/api/*', cors({
  origin: (origin, c) => {
    const origins = ['http://localhost:5173', c.env.FRONTEND_ORIGIN].filter(Boolean);
    return origins.includes(origin) ? origin : '';
  },
  credentials: true,
}));

// Better Auth manages its own endpoints.
app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'hashdox-api' }));

// Resource routes must mount their own authorization middleware. This
// owner-only route provides the baseline for upcoming projects and secrets.
app.get('/api/me', requireOwner, async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ id: session.user.id, name: session.user.name, email: session.user.email });
});

app.route('/api/projects', projectRoutes);

export default app;
