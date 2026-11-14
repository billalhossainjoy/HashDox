/**
 * HashDox envelope encryption v1 using the Workers Web Crypto API.
 * All keys and secret values must remain server-side.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export type Ciphertext = { nonce: string; ciphertext: string };
export type SecretContext = { projectId: string; environmentId: string; secretId: string };

function encode64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

function decode64(value: string): Uint8Array<ArrayBuffer> {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid base64-encoded value');
  }
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export function importMasterKey(secretBase64: string): Uint8Array<ArrayBuffer> {
  const key = decode64(secretBase64);
  if (key.length !== 32) throw new Error('Master key must contain exactly 32 random bytes');
  return key;
}

export function generateDataKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

async function aesKey(key: Uint8Array): Promise<CryptoKey> {
  if (key.length !== 32) throw new Error('AES-256 key must contain 32 bytes');
  return crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function seal(key: Uint8Array, data: Uint8Array, aad: string): Promise<Ciphertext> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(aad), tagLength: 128 },
    await aesKey(key),
    data,
  );
  return { nonce: encode64(nonce), ciphertext: encode64(new Uint8Array(ciphertext)) };
}

async function open(key: Uint8Array, payload: Ciphertext, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const nonce = decode64(payload.nonce);
  const ciphertext = decode64(payload.ciphertext);
  if (nonce.length !== 12 || ciphertext.length < 16) throw new Error('Malformed encrypted payload');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(aad), tagLength: 128 },
    await aesKey(key),
    ciphertext,
  );
  return new Uint8Array(plain);
}

function keyContext(projectId: string, version: number): string {
  if (!projectId || (version !== 1 && version !== 2)) throw new Error('Unsupported key context');
  return `hashdox:dek:v1:${projectId}:kek:${version}`;
}

function secretContext(ctx: SecretContext): string {
  if (!ctx.projectId || !ctx.environmentId || !ctx.secretId) throw new Error('Missing secret context');
  // Distinct fields are length-delimited to avoid accidental AAD collisions.
  return `hashdox:secret:v1:${JSON.stringify([ctx.projectId, ctx.environmentId, ctx.secretId])}`;
}

export async function wrapDataKey(
  masterKey: Uint8Array, projectId: string, dataKey: Uint8Array, version: 1 | 2 = 1,
): Promise<Ciphertext> {
  if (dataKey.length !== 32) throw new Error('Invalid project data key');
  return seal(masterKey, dataKey, keyContext(projectId, version));
}

export async function unwrapDataKey(
  masterKey: Uint8Array, projectId: string, wrapped: Ciphertext, version: 1 | 2 = 1,
): Promise<Uint8Array<ArrayBuffer>> {
  const result = await open(masterKey, wrapped, keyContext(projectId, version));
  if (result.length !== 32) throw new Error('Invalid unwrapped project key');
  return result;
}

export async function encryptSecret(
  dataKey: Uint8Array, ctx: SecretContext, plaintext: string,
): Promise<Ciphertext> {
  return seal(dataKey, encoder.encode(plaintext), secretContext(ctx));
}

export async function decryptSecret(
  dataKey: Uint8Array, ctx: SecretContext, payload: Ciphertext,
): Promise<string> {
  return decoder.decode(await open(dataKey, payload, secretContext(ctx)));
}
