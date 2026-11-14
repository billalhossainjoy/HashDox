export type ProjectEnvironment = {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  createdAt: string | number;
  updatedAt: string | number;
};

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request<T>(projectId: string, suffix: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}/environments${suffix}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(details?.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const environmentsApi = {
  list: (projectId: string) => request<{ data: ProjectEnvironment[] }>(projectId, ''),
  create: (projectId: string, name: string) => request<ProjectEnvironment>(projectId, '', {
    method: 'POST', body: JSON.stringify({ name }),
  }),
  rename: (projectId: string, environmentId: string, name: string) =>
    request<ProjectEnvironment>(projectId, `/${encodeURIComponent(environmentId)}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    }),
  remove: (projectId: string, environmentId: string) =>
    request<void>(projectId, `/${encodeURIComponent(environmentId)}`, { method: 'DELETE' }),
};
