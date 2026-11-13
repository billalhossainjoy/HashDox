import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppBindings } from './env';

const app = new Hono<{ Bindings: AppBindings }>();

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowedOrigins = ['http://localhost:5173', c.env.FRONTEND_ORIGIN].filter(Boolean);
      return allowedOrigins.includes(origin) ? origin : '';
    },
  }),
);

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'hashdox-api' }));

export default app;
