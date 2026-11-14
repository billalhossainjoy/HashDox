/** Cloudflare runtime bindings. Keep secret values out of Wrangler config. */
export type AppBindings = {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OWNER_EMAIL: string;
  /** Base64 of 32 cryptographically random bytes, stored only in Worker Secrets. */
  HASHDOX_MASTER_KEY_B64?: string;
  /** Test-only alternate entrypoint guard; never set in deployed Workers. */
  TEST_FIXTURE_MODE?: string;
};
