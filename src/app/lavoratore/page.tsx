'use client';

/**
 * App del lavoratore (Portale HSE, ADR-009), pagina pubblica del link personale.
 *
 * Il messaggio WhatsApp apre /lavoratore/?t=<token>: il lavoratore vede le sue
 * scadenze, i suoi corsi, la sua visita (data, luogo ed esito senza dati
 * clinici), i rischi della sua mansione dal DVR approvato, segnala i near miss
 * e chiede al suo Falco. Nessun account. Solo query string (export statico).
 * Pensata per il telefono, larghezza 390 px.
 */

import { percorso } from '@/lib/percorso';
import { useCallback, useEffect, useState } from 'react';
import { apriLinkLavoratore, type LinkLavoratore } from '@/lib/data-source';
import { AppLavoratore } from '@/components/lavoratore/AppLavoratore';
import { Caricamento } from '@/components/portale/kit';

type Stato = { fase: 'carico' } | { fase: 'errore'; testo: string } | { fase: 'pronto'; v: LinkLavoratore };

export default function LavoratorePage() {
  const [token, setToken] = useState<string | null>(null);
  const [stato, setStato] = useState<Stato>({ fase: 'carico' });

  const carica = useCallback((t: string, silenzioso = false) => {
    if (!silenzioso) setStato({ fase: 'carico' });
    return apriLinkLavoratore(t)
      .then((v) => setStato({ fase: 'pronto', v }))
      .catch((e: unknown) =>
        setStato({
          fase: 'errore',
          testo: e instanceof Error && e.message ? e.message : 'Link non disponibile.',
        }),
      );
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
    setToken(t);
    if (!t) {
      setStato({
        fase: 'errore',
        testo: 'Il link è incompleto: aprilo di nuovo dal messaggio che hai ricevuto.',
      });
      return;
    }
    void carica(t);
  }, [carica]);

  if (stato.fase === 'pronto' && token) {
    return <AppLavoratore token={token} v={stato.v} onAggiornato={(v) => setStato({ fase: 'pronto', v })} onRicarica={() => void carica(token, true)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <div className="mx-auto w-full max-w-[640px] px-4 pt-4">
        <header className="flex items-center justify-between gap-3 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro" className="h-7 w-auto" />
          <span className="text-[12.5px] font-medium text-ink-muted">Sicurezza sul lavoro</span>
        </header>
        {stato.fase === 'carico' && <Caricamento testo="Apro la tua pagina" />}
        {stato.fase === 'errore' && (
          <main>
            <h1 className="text-[28px] font-medium leading-tight tracking-[-0.03em] text-ink">Link non disponibile</h1>
            <p role="alert" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {stato.testo}
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
