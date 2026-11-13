/** Keep request validation independent of persistence for unit testing. */
export function validateProjectInput(value: unknown): { name: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'name') return null;
  const name = (value as { name?: unknown }).name;
  if (typeof name !== 'string') return null;
  const normalized = name.trim();
  if (normalized.length < 1 || normalized.length > 100) return null;
  return { name: normalized };
}

export function parseProjectPage(value: string | undefined): number | null {
  if (value === undefined) return 1;
  if (!/^[1-9]\d{0,5}$/.test(value)) return null;
  const page = Number(value);
  return page <= 10000 ? page : null;
}

export const PROJECT_PAGE_SIZE = 20;
