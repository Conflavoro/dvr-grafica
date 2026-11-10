'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from '@/lib/clsx';
import { Avviso as IconaAvviso, CerchioSpunta } from '@/components/icone';
import { BottoneScansione } from '@/components/app/BottoneScansione';

/**
 * Pezzi comuni delle viste dell'area azienda (documenti, utenti, avvio,
 * ispezioni, messaggi): campi dei fogli, scelte a riquadri, avvisi, caricamento
 * dei dati con ricarica quando il Falco cambia qualcosa.
 */

/** Carica dati asincroni e li ricarica quando cambiano le dipendenze. */
export function useDati<T>(carica: () => Promise<T>, dip: unknown[]): { dati: T | null; errore: string | null; carico: boolean; ricarica: () => void } {
  const [dati, setDati] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [carico, setCarico] = useState(true);
  const [giro, setGiro] = useState(0);
  const ultimo = useRef(0);
  useEffect(() => {
    const n = ++ultimo.current;
    setCarico(true);
    carica()
      .then((d) => {
        if (n !== ultimo.current) return;
        setDati(d);
        setErrore(null);
      })
      .catch((e: unknown) => n === ultimo.current && setErrore(e instanceof Error ? e.message : 'Dati non disponibili.'))
      .finally(() => n === ultimo.current && setCarico(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dip, giro]);
  const ricarica = useCallback(() => setGiro((g) => g + 1), []);
  return { dati, errore, carico, ricarica };
}

export function Campo({ etichetta, aiuto, children, errore }: { etichetta: string; aiuto?: ReactNode; children: ReactNode; errore?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-medium text-ink">{etichetta}</span>
      {children}
      {aiuto && !errore && <span className="mt-1 block text-[12.5px] text-ink-muted">{aiuto}</span>}
      {errore && <span className="mt-1 block text-[12.5px] text-[#d63d3e]">{errore}</span>}
    </label>
  );
}

/** Scelta a riquadri (slot): selezionato = nero con testo bianco. */
export function Riquadri<K extends string>({
  voci,
  scelti,
  onCambia,
  multipla = false,
  etichetta,
}: {
  voci: Array<{ k: K; t: string; sotto?: string }>;
  scelti: K[];
  onCambia: (k: K[]) => void;
  multipla?: boolean;
  etichetta: string;
}) {
  return (
    <div role="group" aria-label={etichetta} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {voci.map((v) => {
        const on = scelti.includes(v.k);
        return (
          <button
            key={v.k}
            type="button"
            aria-pressed={on}
            onClick={() => onCambia(multipla ? (on ? scelti.filter((x) => x !== v.k) : [...scelti, v.k]) : [v.k])}
            className={clsx(
              'flex min-h-[56px] flex-col justify-center rounded-[1rem] px-3.5 py-2 text-left text-[14px] transition-colors',
              on ? 'bg-grafite-900 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]'
            )}
          >
            <span className="font-medium">{v.t}</span>
            {v.sotto && <span className={clsx('text-[12px]', on ? 'text-grafite-300' : 'text-ink-muted')}>{v.sotto}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Avviso({ tono = 'info', titolo, children }: { tono?: 'info' | 'warn' | 'danger' | 'ok'; titolo?: string; children?: ReactNode }) {
  const cls = {
    info: 'bg-stato-info text-stato-info-ink',
    warn: 'bg-stato-warn text-stato-warn-ink',
    danger: 'bg-stato-danger text-stato-danger-ink',
    ok: 'bg-stato-ok text-stato-ok-ink',
  }[tono];
  const I = tono === 'ok' ? CerchioSpunta : IconaAvviso;
  return (
    <div className={clsx('flex gap-3 rounded-[1rem] px-4 py-3 text-[13.5px] leading-relaxed', cls)} role={tono === 'danger' ? 'alert' : undefined}>
      <I size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {titolo && <p className="font-medium">{titolo}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

/** Conferma finale di un foglio: cerchio acido con spunta, titolo e testo. */
export function Fatto({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-oro-500 text-acido-950">
        <CerchioSpunta size={30} />
      </span>
      <p className="mt-4 text-[20px] font-medium text-ink">{titolo}</p>
      {children && <div className="mt-1.5 max-w-[40ch] text-[14px] leading-relaxed text-ink-muted">{children}</div>}
    </div>
  );
}

/** Scelta del file, a tutta larghezza (tocco comodo sul telefono). */
export function SceltaFile({ file, onFile, accetta, testo = 'Scegli il file' }: { file: File | null; onFile: (f: File | null) => void; accetta?: string; testo?: string }) {
  const rif = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={rif} type="file" accept={accetta} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => rif.current?.click()}
        className="flex min-h-[64px] w-full flex-col items-start justify-center gap-0.5 rounded-[1rem] bg-perla-velo px-4 py-3 text-left text-[14px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <span className="min-w-0 max-w-full truncate font-medium">{file ? file.name : testo}</span>
        <span className="shrink-0 text-[12.5px] text-ink-muted">{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'PDF, Word, Excel o foto, fino a 20 MB'}</span>
      </button>
      {/* App: scansione con la fotocamera (bordi raddrizzati), il risultato e' un PDF. */}
      <BottoneScansione onFile={(f) => onFile(f)} />
    </div>
  );
}

export function oggiIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Riga di "Informazioni": etichetta a sinistra, valore a destra. */
export function Info({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-perla-linea py-2.5 text-[14px] last:border-b-0">
      <span className="text-ink-muted">{etichetta}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}
