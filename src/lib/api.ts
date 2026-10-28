export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://prismify.macovi.space';
export const TOKEN_KEY = 'accessToken';

/** Calls prismify with the stored token, throwing the API's message when it refuses. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data;
}
