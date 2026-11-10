'use client';

import { setToken } from '@/lib/api';
import { percorso } from '@/lib/percorso';
import { useEffect } from 'react';
import { RefreshCw, LogIn, AlertTriangle } from 'lucide-react';

/**
 * Error boundary del segmento autenticato.
 *
 * Garantisce che un'eccezione client-side (es. dato mancante, errore di rete,
 * sessione scaduta) NON produca mai lo schermo bianco "Application error" di
 * Next.js, ma una schermata di recupero comprensibile.
 *
 * Se l'errore e' riconducibile a una sessione scaduta/non autorizzata, pulisce
 * il token e reindirizza al login (root '/').
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message ?? '';
  const isAuth =
    /session expired|unauthenticated|unauthorized|401/i.test(message);

  useEffect(() => {
    if (isAuth && typeof window !== 'undefined') {
      try {
        setToken(null);
      } catch {
        /* storage non disponibile */
      }
      const t = setTimeout(() => {
        window.location.href = percorso('/');
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [isAuth]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="card-luxury max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warn text-warn-mark">
          <AlertTriangle size={24} />
        </div>
        {isAuth ? (
          <>
            <h1 className="section-title text-[17px] text-ink">Sessione scaduta</h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              Per sicurezza ti riportiamo alla pagina di accesso. Effettua di nuovo il login.
            </p>
            <a href={percorso('/')} className="btn-primary mt-5 inline-flex">
              <LogIn size={15} /> Vai al login
            </a>
          </>
        ) : (
          <>
            <h1 className="section-title text-[17px] text-ink">Qualcosa è andato storto</h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              Si è verificato un errore imprevisto nel caricare questa pagina. Puoi riprovare:
              di solito si risolve al secondo tentativo.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className="btn-primary">
                <RefreshCw size={15} /> Riprova
              </button>
              <a href={percorso('/dashboard')} className="btn-ghost">Torna alla dashboard</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
