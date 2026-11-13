/** Cloudflare Worker bindings. Add new bindings here as features are introduced. */
export type AppBindings = {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
};
