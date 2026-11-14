export function validateFolderName(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'name') return null;
  const name = (input as { name?: unknown }).name;
  if (typeof name !== 'string') return null;
  if (/[\\/\u0000-\u001f\u007f]/.test(name)) return null;
  const cleaned = name.trim();
  return cleaned.length >= 1 && cleaned.length <= 60 && !/[\\/\u0000-\u001f\u007f]/.test(cleaned)
    ? cleaned : null;
}
export function validateFolderTarget(input: unknown): string | null | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  if (Object.keys(input).length !== 1 || !Object.hasOwn(input, 'folderId')) return undefined;
  const value = (input as { folderId?: unknown }).folderId;
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 100)
    ? value : undefined;
}
