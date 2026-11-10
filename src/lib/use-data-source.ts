'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDataSource } from './data-source';
import type { DataSource, HealthStatus } from './data-source';

/**
 * Hook base: ritorna l'istanza DataSource attiva.
 *
 * E' un riferimento stabile (singleton), quindi puo' essere messo in
 * dependency array senza causare loop.
 */
export function useDataSource(): DataSource {
  // useRef per evitare ricreare il singleton e per essere SSR-safe
  // (durante prerender Next.js chiamera' getDataSource() ma le useEffect
  // dei consumer non vengono eseguite).
  const ref = useRef<DataSource | null>(null);
  if (ref.current === null) {
    ref.current = getDataSource();
  }
  return ref.current;
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Helper: carica un valore async dal DataSource e gestisce loading+error.
 *
 * Esempio:
 *   const { data: aziende, loading } = useDataSourceQuery((ds) => ds.companies.list());
 *
 * Note:
 * - La fetcher deve essere stabile (definirla con `useCallback` o passarla
 *   come funzione module-level). Se cambi reference ad ogni render, la
 *   query si ri-esegue.
 * - Il flag `loading` parte `true` per evitare flash di "vuoto" alla mount.
 * - In caso di errore di rete (ApiDataSource), `data` resta a null e
 *   `error` ha il messaggio.
 */
export function useDataSourceQuery<T>(
  fetcher: (ds: DataSource) => Promise<T>
): AsyncState<T> {
  const ds = useDataSource();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher(ds)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ds, fetcher, tick]);

  return { data, loading, error, refetch };
}

/**
 * Helper specifico per healthcheck: utile per banner debug "Connesso al
 * backend Laravel" / "Modalita' demo (mock)".
 */
export function useHealth(): AsyncState<HealthStatus> {
  const fetcher = useCallback((ds: DataSource) => ds.health(), []);
  return useDataSourceQuery<HealthStatus>(fetcher);
}
