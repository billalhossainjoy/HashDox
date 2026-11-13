import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from './auth';
import type { AppBindings } from './env';

const app = new Hono<{ Bindings: AppBindings }>();

app.use('/api/*', cors({
  origin: (origin, c) => {
    const origins = ['http://localhost:5173', c.env.FRONTEND_ORIGIN].filter(Boolean);
    return origins.includes(origin) ? origin : '';
  },
  credentials: true,
}));

app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'hashdox-api' }));

app.get('/api/me', async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.email.toLowerCase() !== c.env.OWNER_EMAIL.toLowerCase()) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({ id: session.user.id, name: session.user.name, email: session.user.email });
});

export default app;
