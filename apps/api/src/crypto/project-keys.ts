import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projectDataKeys } from '../db/schema';
import type { AppBindings } from '../env';
import { generateDataKey, importMasterKey, unwrapDataKey, wrapDataKey } from './envelope';

/**
 * Get or provision the project's wrapped DEK. Call only after authorization
 * and verifying that the referenced project exists.
 *
 * No key is ever returned to a client. A unique project_id index resolves
 * concurrent first-time creation; the losing request discards its new DEK.
 */
export async function getProjectDataKey(env: AppBindings, projectId: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!projectId) throw new Error('Project identifier required');
  const master = importMasterKey(env.HASHDOX_MASTER_KEY_B64 ?? '');
  const db = createDb(env);
  const lookup = () => db.select().from(projectDataKeys)
    .where(eq(projectDataKeys.projectId, projectId)).limit(1);

  let [stored] = await lookup();
  if (!stored) {
    const dataKey = generateDataKey();
    try {
      const wrapped = await wrapDataKey(master, projectId, dataKey);
      await db.insert(projectDataKeys).values({
        projectId,
        keyVersion: 1,
        wrappedNonce: wrapped.nonce,
        wrappedCiphertext: wrapped.ciphertext,
        createdAt: new Date(),
      }).onConflictDoNothing({ target: projectDataKeys.projectId });
    } finally {
      dataKey.fill(0);
    }
    [stored] = await lookup();
  }
  if (!stored || stored.keyVersion !== 1) throw new Error('Unsupported project key version');
  return unwrapDataKey(master, projectId, {
    nonce: stored.wrappedNonce,
    ciphertext: stored.wrappedCiphertext,
  });
}
