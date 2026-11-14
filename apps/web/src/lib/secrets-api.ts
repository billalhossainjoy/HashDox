export type SecretMetadata = {
  id: string;
  key: string;
  projectId: string;
  environmentId: string;
  createdAt: string | number;
  updatedAt: string | number;
};

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request<T>(
  projectId: string, environmentId: string, suffix: string, init?: RequestInit,
): Promise<T> {
  const prefix = `${base}/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(environmentId)}/secrets`;
  const response = await fetch(prefix + suffix, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { error?: string } | null;
    if (response.status === 401) throw new Error('Sign in again to access secrets.');
    if (response.status === 403) throw new Error('You do not have permission to access these secrets.');
    throw new Error(details?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const secretsApi = {
  list: (projectId: string, environmentId: string) =>
    request<{ data: SecretMetadata[] }>(projectId, environmentId, ''),
  create: (projectId: string, environmentId: string, key: string, value: string) =>
    request<SecretMetadata>(projectId, environmentId, '', {
      method: 'POST', body: JSON.stringify({ key, value }),
    }),
  save: (projectId: string, environmentId: string, id: string, key: string, value: string) =>
    request<SecretMetadata>(projectId, environmentId, `/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ key, value }),
    }),
  reveal: (projectId: string, environmentId: string, id: string): Promise<{ value: string }> =>
    request(projectId, environmentId, `/${encodeURIComponent(id)}/reveal`, { method: 'POST' }),
  remove: (projectId: string, environmentId: string, id: string) =>
    request<void>(projectId, environmentId, `/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
