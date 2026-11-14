export type SecretFolder = {
  id: string;
  projectId: string;
  environmentId: string;
  parentId: string | null;
  name: string;
  createdAt: string | number;
  updatedAt: string | number;
};
const api = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request<T>(projectId: string, environmentId: string, path: string, init?: RequestInit): Promise<T> {
  const root = `${api}/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(environmentId)}/folders`;
  const response = await fetch(root + path, {
    ...init, credentials: 'include', cache: 'no-store',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(error?.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const foldersApi = {
  list: (projectId: string, environmentId: string) =>
    request<{ data: SecretFolder[] }>(projectId, environmentId, ''),
  create: (projectId: string, environmentId: string, name: string, parentId: string | null) =>
    request<SecretFolder>(projectId, environmentId, '', {
      method: 'POST', body: JSON.stringify({ name, parentId }),
    }),
  rename: (projectId: string, environmentId: string, id: string, name: string) =>
    request<SecretFolder>(projectId, environmentId, `/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    }),
  move: (projectId: string, environmentId: string, id: string, parentId: string | null) =>
    request<SecretFolder>(projectId, environmentId, `/${encodeURIComponent(id)}/parent`, {
      method: 'PATCH', body: JSON.stringify({ folderId: parentId }),
    }),
  remove: (projectId: string, environmentId: string, id: string) =>
    request<void>(projectId, environmentId, `/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
