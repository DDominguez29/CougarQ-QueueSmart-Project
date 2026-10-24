import { useCallback, useEffect, useState } from 'react';
import { requestApi, requestError, type ApiRequestError } from '../api/client';

export function useApiResource<T>(path: string, pollInterval = 0) {
  const [state, setState] = useState<{ key: string; data: T | null; error: ApiRequestError | null }>({
    key: '', data: null, error: null,
  });
  const [revision, setRevision] = useState(0);
  const key = `${path}\0${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    requestApi<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ key, data: null, error: requestError(error) });
      },
    );
    return () => controller.abort();
  }, [path, key]);

  useEffect(() => {
    if (pollInterval <= 0) return;
    const timer = setInterval(() => setRevision((current) => current + 1), pollInterval);
    return () => clearInterval(timer);
  }, [path, pollInterval]);

  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  const update = useCallback((change: (data: T) => T) => {
    setState((current) => current.key !== key || current.data === null ? current : { ...current, data: change(current.data) });
  }, [key]);

  return { data: state.data, error: state.key === key ? state.error : null, loading: state.key !== key, refresh, update };
}
