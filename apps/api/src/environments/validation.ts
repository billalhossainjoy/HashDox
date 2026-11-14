export const DEFAULT_ENVIRONMENTS = [
  { name: 'Development', slug: 'development' },
  { name: 'Staging', slug: 'staging' },
  { name: 'Production', slug: 'production' },
] as const;

export function validateEnvironmentName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'name') return null;
  const name = (value as { name?: unknown }).name;
  if (typeof name !== 'string') return null;
  const result = name.trim();
  return result.length >= 1 && result.length <= 60 ? result : null;
}

// Stable identifier intended for future secret and folder scoping.
export function environmentSlug(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60 ? slug : null;
}
