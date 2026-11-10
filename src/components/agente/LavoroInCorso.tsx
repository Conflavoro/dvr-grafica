'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2 } from '@/components/icone';
import type { AgenteEvento, AgenteProgresso } from '@/lib/data-source';
import { PianoLavoro } from './PianoLavoro';

const FRASI_RISERVA = ["Leggo l'archivio", 'Controllo la normativa', 'Scrivo la risposta'];

type PassoVivo = { strumento: string; titolo: string; stato: 'in_corso' | 'ok' | 'errore' };

/** Riduce gli eventi a un elenco di passi: l'esito aggiorna il passo in corso dello stesso strumento. */
export function passiDaEventi(eventi: AgenteEvento[]): PassoVivo[] {
  const out: PassoVivo[] = [];
  for (const e of eventi) {
    if (e.t !== 'passo') continue;
    const aperto = e.stato === 'in_corso' ? -1 : out.map((p) => p.strumento === e.strumento && p.stato === 'in_corso').lastIndexOf(true);
    if (aperto >= 0) out[aperto] = { ...out[aperto], stato: e.stato };
    else out.push({ strumento: e.strumento, titolo: e.titolo, stato: e.stato });
  }
  return out;
}

/**
 * Blocco "al lavoro" sotto l'ultimo messaggio mentre l'agente risponde: fase
 * corrente, piano con spunte, strumenti in corso con il loro esito.
 */
export function LavoroInCorso({ progresso, dettaglio }: { progresso: AgenteProgresso | null; dettaglio?: string | null }) {
  const [sec, setSec] = useState(0);
  const [riserva, setRiserva] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const eventi = progresso?.eventi ?? [];
  const fase = [...eventi].reverse().find((e): e is Extract<AgenteEvento, { t: 'fase' }> => e.t === 'fase')?.testo;
  const passi = passiDaEventi(eventi);
  const conDati = !!fase || passi.length > 0 || !!progresso?.piano;
  useEffect(() => {
    if (conDati || dettaglio) return;
    const t = setInterval(() => setRiserva((x) => Math.min(x + 1, FRASI_RISERVA.length - 1)), 4000);
    return () => clearInterval(t);
  }, [conDati, dettaglio]);

  const titolo = dettaglio ?? fase ?? FRASI_RISERVA[riserva];

  return (
    <div className="superficie rounded-[1.25rem] px-4 py-3 text-[13px] sm:ml-12" role="status" aria-live="polite">
      <p className="flex items-center gap-2 font-medium text-ink">
        <Loader2 size={16} aria-hidden className="shrink-0 animate-spin text-oro-600 motion-reduce:animate-none" />
        <span className="min-w-0 flex-1">{titolo}</span>
        {sec >= 3 && <span className="cifre shrink-0 text-[11.5px] font-normal text-ink-subtle">{sec} s</span>}
      </p>
      {progresso?.piano && (
        <div className="mt-2.5 border-t border-perla-linea pt-2.5">
          <PianoLavoro passi={progresso.piano} />
        </div>
      )}
      {passi.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-perla-linea pt-2.5" aria-label="Strumenti">
          {passi.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              {p.stato === 'in_corso' ? (
                <Loader2 size={13} aria-hidden className="shrink-0 animate-spin text-brand-500 motion-reduce:animate-none" />
              ) : p.stato === 'ok' ? (
                <Check size={13} aria-hidden className="shrink-0 text-ok-mark" strokeWidth={3} />
              ) : (
                <AlertCircle size={13} aria-hidden className="shrink-0 text-warn-mark" />
              )}
              <span className="min-w-0 flex-1 truncate text-ink-soft">{p.titolo}</span>
              <span className={p.stato === 'errore' ? 'shrink-0 text-[12px] text-warn-ink' : 'shrink-0 text-[12px] text-ink-muted'}>
                {p.stato === 'in_corso' ? 'in corso' : p.stato === 'ok' ? 'fatto' : 'errore'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
