import { drizzle } from 'drizzle-orm/d1';
import type { AppBindings } from '../env';

/** Creates a Drizzle client for the D1 binding in the current Worker request. */
export function createDb(env: AppBindings) {
  return drizzle(env.DB);
}

export type Database = ReturnType<typeof createDb>;
