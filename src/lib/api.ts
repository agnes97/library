export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://prismify.macovi.space';
export const TOKEN_KEY = 'accessToken';

/** Calls prismify with the stored token, throwing the API's message when it refuses. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await call(path, init)).json().catch(() => ({}));
}

/** Fetches an image from prismify with the stored token, throwing the API's message when it refuses. */
export async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  return (await call(path, init)).blob();
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // a form sets its own multipart boundary
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? `Request failed (${response.status})`);
  }
  return response;
}
