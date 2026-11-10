'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Chip } from '../../kit';
import type { TonoChip } from '@/lib/portale/gestionale-logica';
import { iniziali } from '@/lib/portale/gestionale-logica';
import { clsx } from '@/lib/clsx';

/** Pezzi comuni delle viste del gestionale (coda, aziende, avvio, cruscotto). */

export function useLargo(min = 1024): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia(`(min-width: ${min}px)`);
      setV(mq.matches);
      const f = (e: MediaQueryListEvent) => setV(e.matches);
      mq.addEventListener?.('change', f);
      return () => mq.removeEventListener?.('change', f);
    } catch {
      return undefined;
    }
  }, [min]);
  return v;
}

export function ChipTono({ tono, children }: { tono: TonoChip; children: ReactNode }) {
  return <Chip stato={tono}>{children}</Chip>;
}

/** Pagina della sezione del gestionale a cui porta un elemento (con l'azienda se c'e'). */
export function linkSezione(sezione: string | null, aziendaId?: number | null): string | null {
  if (!sezione || !sezione.startsWith('gestionale.')) return null;
  const k = sezione.slice('gestionale.'.length);
  if (k === 'coda') return null;
  // La scheda dell'azienda si apre con ?id=; le altre sezioni con ?azienda=, che diventa il cliente scelto.
  return `/gestionale/${k}/${aziendaId ? (k === 'aziende' ? `?id=${aziendaId}` : `?azienda=${aziendaId}`) : ''}`;
}

export const NOMI_SEZIONI: Record<string, string> = {
  'gestionale.aziende': 'Scheda azienda',
  'gestionale.avvio': 'Avvio del cliente',
  'gestionale.dvr': 'Scrivania del DVR',
  'gestionale.prenotazioni': 'Prenotazioni',
  'gestionale.ispezioni': 'Pronto Ispezioni',
  'gestionale.sopralluoghi': 'Sopralluoghi',
  'gestionale.pos': 'POS e PiMUS',
};

export function Pallino({ nome, scuro = false }: { nome: string; scuro?: boolean }) {
  return (
    <span
      aria-hidden
      title={nome}
      className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11.5px] font-medium', scuro ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink-soft shadow-[inset_0_0_0_1px_#e2e2e5]')}
    >
      {iniziali(nome)}
    </span>
  );
}

export function Campo({ etichetta, aiuto, children }: { etichetta: string; aiuto?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{etichetta}</span>
      {children}
      {aiuto && <span className="mt-1 block text-[12.5px] text-ink-muted">{aiuto}</span>}
    </label>
  );
}

/** Voce di un'informazione: etichetta piccola sopra, valore sotto. */
export function Fatto({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-ink-muted">{etichetta}</p>
      <div className="mt-0.5 break-words text-[14.5px] text-ink">{children}</div>
    </div>
  );
}

/** Barra di avanzamento sobria (grafite, ambra o rosso secondo il tono). */
export function Barra({ pct, tono = 'neutral' }: { pct: number; tono?: TonoChip }) {
  return (
    <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-perla-velo">
      <span
        className={clsx('block h-full rounded-full', tono === 'danger' ? 'bg-[#d63d3e]' : tono === 'warn' ? 'bg-[#eab308]' : tono === 'ok' ? 'bg-[#16884a]' : 'bg-grafite-900')}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}
