import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDataKey, importMasterKey, wrapDataKey, unwrapDataKey,
  encryptSecret, decryptSecret,
} from '../src/crypto/envelope.ts';

const ctx = { projectId: 'project-a', environmentId: 'staging', secretId: 'secret-1' };

test('32-byte master key and project DEK roundtrip', async () => {
  const master = generateDataKey();
  const imported = importMasterKey(Buffer.from(master).toString('base64'));
  assert.deepEqual(imported, master);
  assert.throws(() => importMasterKey('invalid'));
  assert.throws(() => importMasterKey(Buffer.alloc(16).toString('base64')));
  const dek = generateDataKey();
  const wrapped = await wrapDataKey(master, ctx.projectId, dek);
  assert.notEqual(wrapped.ciphertext, Buffer.from(dek).toString('base64'));
  assert.deepEqual(await unwrapDataKey(master, ctx.projectId, wrapped), dek);
  await assert.rejects(() => unwrapDataKey(master, 'other-project', wrapped));
  await assert.rejects(() => unwrapDataKey(generateDataKey(), ctx.projectId, wrapped));
});

test('secrets use random nonces and are bound to their context', async () => {
  const dek = generateDataKey();
  const a = await encryptSecret(dek, ctx, 'token=🤫 secret');
  const b = await encryptSecret(dek, ctx, 'token=🤫 secret');
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.equal(await decryptSecret(dek, ctx, a), 'token=🤫 secret');
  await assert.rejects(() => decryptSecret(dek, { ...ctx, environmentId: 'production' }, a));
  await assert.rejects(() => decryptSecret(dek, { ...ctx, secretId: 'secret-2' }, a));
  await assert.rejects(() => decryptSecret(generateDataKey(), ctx, a));
});

test('altered ciphertext or nonce fails authentication', async () => {
  const dek = generateDataKey();
  const value = await encryptSecret(dek, ctx, 'must remain private');
  const altered = Buffer.from(value.ciphertext, 'base64');
  altered[0] ^= 1;
  await assert.rejects(() => decryptSecret(dek, ctx, {
    ...value, ciphertext: altered.toString('base64'),
  }));
  await assert.rejects(() => decryptSecret(dek, ctx, { ...value, nonce: 'invalid' }));
});
