/** Cloudflare runtime bindings. Keep secret values out of Wrangler config. */
export type AppBindings = {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OWNER_EMAIL: string;
};
