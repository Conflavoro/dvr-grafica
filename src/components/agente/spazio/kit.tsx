'use client';

import type { ReactNode } from 'react';
import { Loader2 } from '@/components/icone';
import { clsx } from '@/lib/clsx';

/** Stili condivisi dello spazio di lavoro (campi, righe, sezioni). */
export const CAMPO =
  'block h-11 w-full rounded-[0.875rem] border border-[#e2e2e5] bg-perla-carta px-3 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none sm:text-[13.5px]';
export const AREA =
  'block min-h-[88px] w-full rounded-[0.875rem] border border-[#e2e2e5] bg-perla-carta px-3 py-2 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none sm:text-[13.5px]';
export const LINK = 'premi inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-brand-700 hover:bg-perla-velo hover:text-brand-900 disabled:opacity-50';

export function Sezione({ titolo, nota, azione, children }: { titolo: string; nota?: string | null; azione?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-2">
      <header className="mb-2.5 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-medium leading-tight tracking-[-0.015em] text-brand-900">{titolo}</h3>
          {nota && <p className="mt-0.5 text-[12px] text-ink-muted">{nota}</p>}
        </div>
        {azione}
      </header>
      {children}
    </section>
  );
}

export function Etichetta({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-ink-muted">
      {children}
    </label>
  );
}

export function Caricamento({ testo = 'Carico i dati' }: { testo?: string }) {
  return (
    <p className="flex items-center gap-2 py-3 text-[13px] text-ink-muted" role="status">
      <Loader2 size={14} aria-hidden className="animate-spin text-brand-500 motion-reduce:animate-none" />
      {testo}
    </p>
  );
}

export function Errore({ testo, onRiprova }: { testo: string; onRiprova?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-warn bg-warn px-3 py-2 text-[13px] text-warn-ink">
      <span className="min-w-0 flex-1">{testo}</span>
      {onRiprova && (
        <button type="button" onClick={onRiprova} className="-my-1 min-h-[32px] shrink-0 rounded px-2 font-semibold underline-offset-2 hover:underline">
          Riprova
        </button>
      )}
    </div>
  );
}

export function Vuota({ children }: { children: ReactNode }) {
  return <p className="py-1 text-[13px] leading-relaxed text-ink-muted">{children}</p>;
}

/** Elenco con filetti sottili tra le righe (niente schede annidate). */
export function Elenco({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={clsx('superficie divide-y divide-perla-linea overflow-hidden rounded-[0.875rem] px-3', className)}>{children}</ul>;
}

/** Due lame parallele dorate: il segno grafico preso dal marchio. */
export function Lame({ className }: { className?: string }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className={clsx('shrink-0', className)} fill="none">
      <path d="M2 12 L8 2" stroke="#677f02" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 12 L12 2" stroke="#677f02" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
    </svg>
  );
}

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
/** Nome senza il punto finale (S.n.c., S.r.l.): evita il doppio punto a fine frase. */
export function senzaPunto(nome: string): string {
  return nome.replace(/\.+$/, '');
}

export function data(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d);
}

export function errTesto(e: unknown, riserva: string): string {
  return e instanceof Error && e.message ? e.message : riserva;
}
