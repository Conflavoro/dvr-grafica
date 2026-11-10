'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiRequest, clearApiCache, setToken } from '@/lib/api';

interface ProfiloLive {
  chiave: string;
  nome: string;
  ruolo: string;
  descrizione: string;
  app: 'gestionale' | 'azienda' | 'lavoratore';
}

interface Entrata {
  access_token?: string;
  destinazione?: string;
  app?: string;
}

const GRUPPI: Array<{ app: ProfiloLive['app']; titolo: string; sotto: string }> = [
  { app: 'gestionale', titolo: 'Studio', sotto: 'Il gestionale dei tecnici HSE' },
  { app: 'azienda', titolo: 'Azienda cliente', sotto: 'L’area dell’azienda, per ruolo' },
  { app: 'lavoratore', titolo: 'Lavoratore', sotto: 'Il link personale, senza account' },
];

/**
 * Accesso della demo dal vivo: i profili arrivano dal backend della demo e si entra
 * con un clic, senza password. Da lì in poi è la piattaforma vera, con il Falco vero.
 */
export function DemoLiveAccesso() {
  const router = useRouter();
  const [profili, setProfili] = useState<ProfiloLive[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ data?: ProfiloLive[] }>('/demo/profili', { anonymous: true })
      .then((r) => setProfili(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setErrore('Non riesco a caricare i profili della demo. Ricarica la pagina tra qualche secondo.'));
  }, []);

  const entra = async (p: ProfiloLive) => {
    setErrore(null);
    setEntrando(p.chiave);
    try {
      const r = await apiRequest<Entrata>('/demo/entra', { method: 'POST', body: { profilo: p.chiave }, anonymous: true });
      if (r.destinazione) {
        router.replace(r.destinazione);
        return;
      }
      if (!r.access_token) throw new Error('Risposta non valida.');
      clearApiCache();
      setToken(r.access_token);
      // La pagina di accesso porta alla home del ruolo appena legge l'utente.
      window.dispatchEvent(new Event('auth-changed'));
    } catch (e) {
      setEntrando(null);
      setErrore(e instanceof ApiError && e.message ? e.message : 'Accesso non riuscito. Riprova.');
    }
  };

  return (
    <div>
      <h2 className="text-[40px] font-medium leading-tight tracking-[-0.03em] text-ink">Entra come</h2>
      <p className="mb-6 mt-1.5 text-[14px] text-ink-muted">
        Scegli un profilo: è la piattaforma vera, con il Falco vero, su uno studio di esempio. Nessuna password.
      </p>
      {errore && (
        <p role="alert" className="mb-4 rounded-[1rem] bg-danger px-4 py-3 text-[14px] text-danger-ink">
          {errore}
        </p>
      )}
      {!profili && !errore && <p className="text-[14px] text-ink-muted">Carico i profili…</p>}
      {profili &&
        GRUPPI.map((g) => {
          const del = profili.filter((p) => p.app === g.app);
          if (del.length === 0) return null;
          return (
            <section key={g.app} className="mb-6">
              <p className="text-[12px] font-medium tracking-[0.06em] text-ink-subtle">{g.titolo.toUpperCase()}</p>
              <p className="mb-2 text-[13px] text-ink-muted">{g.sotto}</p>
              <ul className="overflow-hidden rounded-[1.25rem] border border-perla-linea">
                {del.map((p) => (
                  <li key={p.chiave} className="border-b border-perla-linea last:border-b-0">
                    <button
                      type="button"
                      disabled={entrando !== null}
                      onClick={() => void entra(p)}
                      className="flex min-h-[60px] w-full flex-col items-start justify-center px-4 py-3 text-left hover:bg-perla-velo/60 focus-visible:bg-perla-velo/60 disabled:opacity-60"
                    >
                      <span className="text-[15px] font-medium text-ink">
                        {p.nome}
                        {entrando === p.chiave && <span className="ml-2 text-[13px] font-normal text-ink-muted">entro…</span>}
                      </span>
                      <span className="text-[13px] text-ink-muted">
                        {p.ruolo} · {p.descrizione}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      <p className="text-[12.5px] leading-relaxed text-ink-subtle">
        I dati sono di fantasia e la demo torna allo stato iniziale ogni notte. Per non abusarne ci sono dei limiti giornalieri (per esempio 3 DVR al giorno).
      </p>
    </div>
  );
}
