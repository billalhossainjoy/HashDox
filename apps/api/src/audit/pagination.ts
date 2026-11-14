/**
 * Stable audit cursor: descending timestamp + event UUID.
 * RFC4648 base64url is intentionally opaque to clients.
 */
export type AuditCursor = { time: number; id: string };
const MAX_MS = 8640000000000000;
export const AUDIT_PAGE_SIZE = 50;

export function encodeAuditCursor(cursor: AuditCursor): string {
  return btoa(JSON.stringify([cursor.time, cursor.id]))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeAuditCursor(token: string | undefined): AuditCursor | null | undefined {
  if (token === undefined) return null;
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(token)) return undefined;
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const value: unknown = JSON.parse(atob(padded));
    if (!Array.isArray(value) || value.length !== 2) return undefined;
    const [time, id] = value;
    if (typeof time !== 'number' || !Number.isSafeInteger(time) || time < 0 || time > MAX_MS ||
      typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return undefined;
    return { time, id };
  } catch {
    return undefined;
  }
}
