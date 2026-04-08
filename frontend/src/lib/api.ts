const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://treasure-hunt-api.oliveri-john001.workers.dev';

export function getToken(): string | null {
  return localStorage.getItem('th_token');
}

export function setToken(token: string): void {
  localStorage.setItem('th_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('th_token');
}

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<T & { ok: boolean; error?: string; httpStatus?: number; blob?: Blob }> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (response.status === 401) {
    clearToken();
    const pathname = window.location.pathname;
    if (pathname !== '/login' && pathname !== '/' && !pathname.startsWith('/play/')) {
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/csv')) {
    return { ok: response.ok, blob: await response.blob(), httpStatus: response.status } as never;
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    Object.defineProperty(data, 'ok', { value: response.ok, enumerable: false });
    return data as never;
  }

  return { ok: response.ok, httpStatus: response.status, ...data };
}
