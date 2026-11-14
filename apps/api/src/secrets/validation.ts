/** Minimal secret input policy; values are never logged. */
export type SecretInput = { key: string; value: string };

export function validateSecretInput(payload: unknown): SecretInput | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length !== 2 || !keys.includes('key') || !keys.includes('value')) return null;
  if (typeof data.key !== 'string' || typeof data.value !== 'string') return null;
  const key = data.key.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/.test(key)) return null;
  // Limit UTF-8 bytes, not JS code units, to cap D1 and crypto payload sizes.
  if (new TextEncoder().encode(data.value).byteLength > 16_384) return null;
  return { key, value: data.value };
}
