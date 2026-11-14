import { and, eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projectDataKeys } from '../db/schema';
import type { AppBindings } from '../env';
import { generateDataKey, importMasterKey, unwrapDataKey, wrapDataKey } from './envelope';

type KeyVersion = 1 | 2;

function activeKeyVersion(env: AppBindings): KeyVersion {
  const version = env.HASHDOX_ACTIVE_KEK_VERSION ?? '1';
  if (version !== '1' && version !== '2') throw new Error('Invalid active KEK version');
  return Number(version) as KeyVersion;
}

function masterKey(env: AppBindings, version: KeyVersion): Uint8Array<ArrayBuffer> {
  const encoded = version === 1 ? env.HASHDOX_MASTER_KEY_B64 : env.HASHDOX_MASTER_KEY_V2_B64;
  if (!encoded) throw new Error(`Master key version ${version} is not configured`);
  return importMasterKey(encoded);
}

/**
 * Only call after verifying an authorized project/environment.
 * A staged KEK rotation can read old and new wrapped DEKs while both
 * encrypted master-key bindings remain available to the Worker.
 */
export async function getProjectDataKey(env: AppBindings, projectId: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!projectId) throw new Error('Project identifier required');
  const db = createDb(env);
  const lookup = () => db.select().from(projectDataKeys)
    .where(eq(projectDataKeys.projectId, projectId)).limit(1);

  let [stored] = await lookup();
  if (!stored) {
    const version = activeKeyVersion(env);
    const kek = masterKey(env, version);
    const dataKey = generateDataKey();
    try {
      const wrapped = await wrapDataKey(kek, projectId, dataKey, version);
      await db.insert(projectDataKeys).values({
        projectId, keyVersion: version, wrappedNonce: wrapped.nonce,
        wrappedCiphertext: wrapped.ciphertext, createdAt: new Date(),
      }).onConflictDoNothing({ target: projectDataKeys.projectId });
    } finally {
      kek.fill(0);
      dataKey.fill(0);
    }
    [stored] = await lookup();
  }
  if (!stored || (stored.keyVersion !== 1 && stored.keyVersion !== 2)) {
    throw new Error('Unsupported project key version');
  }
  const kek = masterKey(env, stored.keyVersion);
  try {
    return await unwrapDataKey(kek, projectId, {
      nonce: stored.wrappedNonce, ciphertext: stored.wrappedCiphertext,
    }, stored.keyVersion);
  } finally {
    kek.fill(0);
  }
}

/**
 * Internal-only staged rewrap: does NOT decrypt/re-encrypt secret values.
 * Never expose this as an authenticated HTTP endpoint. A compare-and-swap
 * rejects stale writes, and the original KEK remains required until every
 * project is verified as v2 and a recovery backup has been tested.
 */
export async function rewrapProjectDataKey(
  env: AppBindings, projectId: string,
): Promise<'rotated' | 'already-rotated'> {
  if (!projectId) throw new Error('Project identifier required');
  const db = createDb(env);
  const [stored] = await db.select().from(projectDataKeys)
    .where(eq(projectDataKeys.projectId, projectId)).limit(1);
  if (!stored) throw new Error('Project data key does not exist');
  if (stored.keyVersion === 2) {
    // Fail closed if v2 is misconfigured; don't report false success.
    const dek = await getProjectDataKey(env, projectId);
    dek.fill(0);
    return 'already-rotated';
  }
  if (stored.keyVersion !== 1) throw new Error('Unsupported project key version');

  const oldKek = masterKey(env, 1);
  const newKek = masterKey(env, 2);
  let dek: Uint8Array<ArrayBuffer> | undefined;
  try {
    dek = await unwrapDataKey(oldKek, projectId, {
      nonce: stored.wrappedNonce, ciphertext: stored.wrappedCiphertext,
    }, 1);
    const wrapped = await wrapDataKey(newKek, projectId, dek, 2);
    // Verify the new ciphertext before any D1 mutation.
    const verified = await unwrapDataKey(newKek, projectId, wrapped, 2);
    try {
      if (verified.some((byte, index) => byte !== dek![index])) throw new Error('Rewrap verification failed');
    } finally {
      verified.fill(0);
    }

    const [changed] = await db.update(projectDataKeys).set({
      keyVersion: 2, wrappedNonce: wrapped.nonce, wrappedCiphertext: wrapped.ciphertext,
    }).where(and(
      eq(projectDataKeys.projectId, projectId),
      eq(projectDataKeys.keyVersion, 1),
      eq(projectDataKeys.wrappedNonce, stored.wrappedNonce),
      eq(projectDataKeys.wrappedCiphertext, stored.wrappedCiphertext),
    )).returning({ projectId: projectDataKeys.projectId });

    if (!changed) throw new Error('Concurrent key modification detected; no rewrap applied');
    return 'rotated';
  } finally {
    dek?.fill(0);
    oldKek.fill(0);
    newKek.fill(0);
  }
}
