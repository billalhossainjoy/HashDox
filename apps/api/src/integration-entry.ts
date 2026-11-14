/**
 * TEST-ONLY Wrangler entrypoint. Production wrangler.jsonc always uses index.ts.
 * This fixture makes real Better Auth sessions via local password signup
 * while production still permits Google OAuth only.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import app from './index';
import { createDb } from './db/client';
import * as schema from './db/schema';
import type { AppBindings } from './env';

const TEST_MODE = 'hashdox-ci-auth-fixture';

app.post('/__test__/signup', async (c) => {
  if (c.env.TEST_FIXTURE_MODE !== TEST_MODE) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json().catch(() => null) as { email?: unknown } | null;
  if (!body || (body.email !== 'owner@example.test' && body.email !== 'outsider@example.test')) {
    return c.json({ error: 'Invalid fixture identity' }, 400);
  }
  const auth = betterAuth({
    baseURL: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(c.env), { provider: 'sqlite', schema }),
    trustedOrigins: ['http://127.0.0.1:8787'],
    emailAndPassword: { enabled: true },
  });
  return auth.api.signUpEmail({
    body: { email: body.email, name: 'Integration fixture', password: 'local-test-password-only-1234' },
    headers: new Headers({ origin: 'http://127.0.0.1:8787' }),
    asResponse: true,
  });
});

export default app;
