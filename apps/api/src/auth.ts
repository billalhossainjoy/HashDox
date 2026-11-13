import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { createDb } from './db/client';
import * as schema from './db/schema';
import type { AppBindings } from './env';

export function createAuth(env: AppBindings) {
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || !env.BETTER_AUTH_URL || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET ||
      !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('Missing required authentication configuration');
  }
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env), { provider: 'sqlite', schema }),
    trustedOrigins: ['http://localhost:5173', env.FRONTEND_ORIGIN].filter((v): v is string => Boolean(v)),
    emailAndPassword: { enabled: false },
    socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
    databaseHooks: {
      user: {
        create: {
          before: async (candidate) => {
            if (candidate.email.trim().toLowerCase() !== ownerEmail) {
              throw new APIError('FORBIDDEN', { message: 'Account is not authorized' });
            }
            return { data: candidate };
          },
        },
      },
    },
  });
}
