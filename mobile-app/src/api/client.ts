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
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.rateLimited = status === 429;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip attaching the bearer token (for public/auth endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = opts;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const token = await getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
    throw new ApiError(msg, res.status);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
};
