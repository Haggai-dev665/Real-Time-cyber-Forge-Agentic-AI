/**
 * Generic data-fetching hook with loading / error / refresh state. Keeps the
 * "real data or an honest empty/idle state" contract: callers distinguish
 * loading, error, and empty themselves.
 *
 * With `cacheKey`, the last data loaded for the signed-in account is shown at
 * once and kept when a refresh fails (offline, backend asleep): `stale` is then
 * true and `cachedAt` says when that data was loaded, so a screen can say so.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { readJson, writeJson, cacheName, type Cached } from '../api/userStore';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  /** The data shown is from the cache, not from this session's request. */
  stale: boolean;
  cachedAt: number | null;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = [], options: { cacheKey?: string } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cacheKey = options.cacheKey;
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
    rateLimited: false,
    stale: false,
    cachedAt: null,
  });
  const dataRef = useRef<T | null>(null);
  const loadedAt = useRef<number | null>(null);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      dataRef.current = data;
      loadedAt.current = Date.now();
      setState({ data, loading: false, error: null, rateLimited: false, stale: false, cachedAt: null });
      if (cacheKey) void writeJson(userId, cacheName(cacheKey), { at: Date.now(), data } satisfies Cached<T>);
    } catch (e) {
      const apiErr = e instanceof ApiError ? e : null;
      const message = e instanceof Error ? e.message : 'Request failed';
      // keep what is on screen (cached or earlier) rather than blanking it
      setState((s) => ({
        data: s.data,
        loading: false,
        error: message,
        rateLimited: !!apiErr?.rateLimited,
        stale: s.data != null,
        cachedAt: s.data != null ? s.cachedAt ?? loadedAt.current : null,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, cacheKey, userId]);

  // the cached copy first, then the request
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cacheKey && userId) {
        const cached = await readJson<Cached<T>>(userId, cacheName(cacheKey));
        if (!cancelled && cached && dataRef.current == null) {
          setState((s) => (s.data == null ? { ...s, data: cached.data, stale: true, cachedAt: cached.at } : s));
        }
      }
      if (!cancelled) await run();
    })();
    return () => {
      cancelled = true;
    };
  }, [run, cacheKey, userId]);

  return { ...state, refresh: run };
}
