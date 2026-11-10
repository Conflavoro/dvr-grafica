'use client';

import { useEffect } from 'react';
import { BASE_PATH } from '@/lib/percorso';

/**
 * Rete di sicurezza ultima: cattura errori che avvengono nel layout root
 * (dove l'error boundary di segmento non arriva). Deve renderizzare <html>/<body>.
 * Niente import di componenti app per non rischiare ulteriori errori a cascata.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Dopo un aggiornamento dell'app la pagina aperta puo' chiedere pezzi che non ci sono piu':
  // si ricarica da sola una volta, cosi' chi sta provando non vede l'errore.
  useEffect(() => {
    try {
      const k = 'crm_dvr_ricarica_errore';
      const ultima = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - ultima > 60_000) {
        sessionStorage.setItem(k, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* senza sessionStorage resta il pulsante Riprova */
    }
  }, [error]);
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f6f6f7',
          color: '#122947',
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Errore imprevisto</h1>
          <p style={{ fontSize: 14, color: '#5e5e66', marginTop: 8 }}>
            Ricarica la pagina per continuare. Se il problema persiste, torna al login.
          </p>
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#4a4a52',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Riprova
            </button>
            <a
              href={`${BASE_PATH}/`}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                background: '#deeef6',
                color: '#122947',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Vai al login
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
