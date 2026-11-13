export type Project = {
  id: string;
  name: string;
  createdAt: string | number;
  updatedAt: string | number;
};

export type ProjectPage = {
  data: Project[];
  page: number;
  pageSize: number;
  total: number;
};

const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/api/projects${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (response.status === 403) throw new Error('Your account is not authorized to manage projects.');
    const error = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(error?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const projectsApi = {
  list: (page: number) => request<ProjectPage>(`?page=${page}`),
  create: (name: string) => request<Project>('', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: string, name: string) => request<Project>(`/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ name }),
  }),
  remove: (id: string) => request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
