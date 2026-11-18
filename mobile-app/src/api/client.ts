/**
 * Thin fetch wrapper for the CyberForge backend.
 *
 * - Injects the bearer token + mobile User-Agent on every request.
 * - Treats the backend's `/api/*` rate limit (100 req / 15 min, returns a
 *   non-JSON 429 body) gracefully so callers can back off.
 * - Normalises the backend's `{ success, data }` / `{ success, ... }` envelopes.
 */
import { API_BASE_URL, USER_AGENT } from './config';
import { getItem, TOKEN_KEY } from './storage';

export class ApiError extends Error {
  status: number;
  rateLimited: boolean;
  /** The backend's error code, when it sent one (for example DEVICE_REVOKED). */
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.rateLimited = status === 429;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** The exact body text to send, for requests signed over their bytes (device requests). */
  rawBody?: string;
  /** Extra headers, such as a device request's signature headers. */
  headers?: Record<string, string>;
  /** Skip attaching the bearer token (for public/auth endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody, anonymous = false, signal } = opts;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    ...(opts.headers ?? {}),
  };
  const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const token = await getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: payload,
      signal,
    });
  } catch (e) {
    throw new ApiError(
      e instanceof Error ? `Network error: ${e.message}` : 'Network error',
      0
    );
  }

  // The rate limiter replies with a plain-text body, not JSON.
  if (res.status === 429) {
    throw new ApiError('Rate limited — too many requests. Backing off.', 429);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON body (e.g. proxy error page). Surface a clean error.
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: string } | null)?.message ||
      (json as { error?: string } | null)?.error ||
      `HTTP ${res.status}`;
    const code = (json as { code?: unknown } | null)?.code;
    throw new ApiError(msg, res.status, typeof code === 'string' ? code : null);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
