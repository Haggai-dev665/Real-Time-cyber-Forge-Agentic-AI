/**
 * Generic data-fetching hook with loading / error / refresh state. Keeps the
 * "real data or an honest empty/idle state" contract: callers distinguish
 * loading, error, and empty themselves.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
    rateLimited: false,
  });

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null, rateLimited: false });
    } catch (e) {
      const apiErr = e instanceof ApiError ? e : null;
      setState({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Request failed',
        rateLimited: !!apiErr?.rateLimited,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refresh: run };
}
