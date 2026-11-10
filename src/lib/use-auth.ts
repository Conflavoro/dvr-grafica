'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDataSource } from './use-data-source';
import type { User } from './data-source';

/**
 * Hook reactive che ritorna l'utente corrente dal DataSource attivo.
 *
 * Comportamento:
 * - Mock mode: legge da localStorage (sync sotto-traccia, simulato async)
 *   e si aggiorna su evento "auth-changed" (login/logout fra tab).
 * - API mode: chiama `GET /api/auth/me` con JWT da localStorage.
 *   Si aggiorna anche su "auth-changed" per coerenza con il mock.
 */
export function useAuth(): { user: User | null; loading: boolean } {
  const ds = useDataSource();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchMe(): Promise<void> {
      setLoading(true);
      try {
        const me = await ds.auth.me();
        if (!cancelled) {
          setUser(me);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    void fetchMe();

    const handler = (): void => {
      void fetchMe();
    };
    window.addEventListener('auth-changed', handler);
    window.addEventListener('storage', handler);

    return () => {
      cancelled = true;
      window.removeEventListener('auth-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, [ds]);

  return { user, loading };
}

/**
 * Hook che redireziona a "/" se non autenticato. Usalo nei layout protetti.
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  return { user, loading };
}
