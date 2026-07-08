import i18n from '../i18n/i18n';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

/** Monotonic counter for cache-busting — avoids clock-resolution issues on old browsers. */
let _requestSeq = 0;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Cache-busting: monotonic counter + random suffix prevents any proxy/CDN caching.
  // Using a counter (not Date.now()) avoids clock-resolution issues on old browsers
  // where multiple requests within the same millisecond can collide.
  const separator = endpoint.includes('?') ? '&' : '?';
  const cacheBuster = `${separator}_t=${++_requestSeq}_${Math.random().toString(36).slice(2, 8)}`;
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const url = `${API_BASE}${endpoint}${cacheBuster}&lang=${lang}`;

  // Inject lang into the request body for POST/PATCH so the backend can
  // read it from the body (the query string is unreliable — some handlers
  // like POST /api/quiz/answer read lang from request.body, not request.query).
  if (options.body && options.method && ['POST', 'PATCH'].includes(options.method.toUpperCase())) {
    try {
      const parsed = JSON.parse(options.body as string);
      if (!parsed.lang) {
        parsed.lang = lang;
        options = { ...options, body: JSON.stringify(parsed) };
      }
    } catch {
      // Body is not JSON — leave as-is (e.g. FormData)
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
    throw new ApiError(i18n.t('errors.common.sessionExpired'), 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};
