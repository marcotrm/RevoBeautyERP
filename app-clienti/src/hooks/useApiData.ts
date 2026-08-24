/**
 * Hook generico per caricare dati autenticati dal gestionale,
 * con stati loading/error e refresh (usato dal pull-to-refresh).
 */
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/api';
import { useAuth } from '@/hooks/useAuth';

interface ApiDataState<T> {
  data: T | null;
  /** true solo al primo caricamento */
  isLoading: boolean;
  /** true durante il pull-to-refresh */
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useApiData<T>(fetcher: (token: string) => Promise<T>): ApiDataState<T> {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Contatore per forzare il ricaricamento (refresh manuale)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const result = await fetcher(token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Si è verificato un errore. Riprova.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // `fetcher` è volutamente escluso: le schermate passano funzioni inline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reloadKey]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setReloadKey((k) => k + 1);
  }, []);

  return { data, isLoading, isRefreshing, error, refresh };
}
