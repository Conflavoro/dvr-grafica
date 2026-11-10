'use client';

import type { ReactNode } from 'react';
import { Giu, type IconaComponente } from '@/components/icone';
import { Carosello } from '@/components/portale/telefono/Carosello';
import { PASTIGLIA, TESTATA, type Categoria } from '@/lib/portale/sezioni';
import { clsx } from '@/lib/clsx';

/**
 * Pezzi del telefono per le sezioni della squadra S5 (M.testata, M.carosello delle cose da
 * fare, M.numero, M.elenco, M.grande, M.fisarmonica del prototipo), costruiti sui token.
 */

/** Testata del telefono con il numero grande (lettera del gruppo, infortuni dell'anno). */
export function TestataTel({ categoria, icona: Icona, titolo, sotto, numero, etichetta }: {
  categoria: Categoria; icona: IconaComponente; titolo: string; sotto?: string; numero?: ReactNode; etichetta?: string;
}) {
  return (
    <header data-falco="testata" className={clsx('rounded-[1.75rem] p-5', TESTATA[categoria])}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80"><Icona size={20} /></span>
        <div className="min-w-0">
          <h1 className="text-h2">{titolo}</h1>
          {sotto && <p className="text-small opacity-75">{sotto}</p>}
        </div>
      </div>
      {numero !== undefined && <p className="mt-4 text-display">{numero}</p>}
      {etichetta && <p className="mt-1 text-small opacity-75">{etichetta}</p>}
    </header>
  );
}

/** Segmenti del telefono (M.segmenti) con il contatore. */
export function Segmenti<K extends string>({ voci, attiva, onCambia, etichetta }: { voci: Array<{ k: K; t: string; n?: number }>; attiva: K; onCambia: (k: K) => void; etichetta: string }) {
  return (
    <div role="tablist" aria-label={etichetta} className="flex gap-1 overflow-x-auto rounded-full bg-sunken p-1">
      {voci.map((v) => (
        <button key={v.k} type="button" role="tab" aria-selected={attiva === v.k} onClick={() => onCambia(v.k)}
          className={clsx('flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-small', attiva === v.k ? 'bg-surface font-medium shadow-sm' : 'text-fg-muted')}>
          {v.t}
          {!!v.n && <span className="cifre grid h-5 min-w-5 place-items-center rounded-full bg-grafite-900 px-1 text-caption text-white">{v.n}</span>}
        </button>
      ))}
    </div>
  );
}

export interface SchedaCosa {
  testo: string;
  extra?: string | null;
  pulsante: string;
  onClick: () => void;
}

/** Carosello delle cose da fare: la prima acida, le altre grafite. Vuoto: riquadro acido. */
export function DaFareTel({ categoria, icona: Icona, voci, vuotoTitolo, vuotoTesto }: {
  categoria: Categoria; icona: IconaComponente; voci: SchedaCosa[]; vuotoTitolo: string; vuotoTesto: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h3">Da fare</h2>
        {voci.length > 0 && <span className="text-small text-fg-muted">{voci.length === 1 ? '1 cosa' : `${voci.length} cose`}</span>}
      </div>
      {voci.length === 0 ? (
        <div className="rounded-[1.75rem] bg-acid-400 p-5 text-acid-950">
          <p className="text-h3">{vuotoTitolo}</p>
          <p className="mt-1 text-small">{vuotoTesto}</p>
        </div>
      ) : (
        <div>
          <Carosello etichetta="Da fare">
            {voci.map((v, i) => (
              <article key={i} className={clsx('flex min-h-[200px] flex-col rounded-[1.75rem] p-5', i === 0 ? 'bg-acid-400 text-acid-950' : 'bg-grafite-900 text-white')}>
                <div className="flex items-center justify-between">
                  <span aria-hidden className={clsx('grid h-10 w-10 place-items-center rounded-full', PASTIGLIA[categoria])}><Icona size={18} /></span>
                  <span className="text-small opacity-70">{i + 1} di {voci.length}</span>
                </div>
                <p className="mt-4 text-h3">{v.testo}</p>
                {v.extra && <p className="mt-1 text-small opacity-75">{v.extra}</p>}
                <button type="button" onClick={v.onClick}
                  className={clsx('mt-auto h-12 w-full rounded-full text-body font-medium', i === 0 ? 'bg-grafite-900 text-white' : 'bg-acid-400 text-acid-950')}>
                  {v.pulsante}
                </button>
              </article>
            ))}
          </Carosello>
        </div>
      )}
    </section>
  );
}

/** Carosello dei numeri (M.numero, 46 %). */
export function NumeriTel({ punto, voci }: { punto: string; voci: Array<{ etichetta: string; valore: ReactNode; unita?: string; nota?: string; onClick?: () => void }> }) {
  return (
    <section className="space-y-3">
      <h2 className="text-h3">Come stai andando</h2>
      <div>
        <Carosello etichetta="Come stai andando" larghezza="46%">
          {voci.map((v) => (
            <button key={v.etichetta} type="button" onClick={v.onClick} className="flex h-[176px] w-full flex-col justify-between rounded-[1.75rem] bg-surface p-4 text-left shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <span className="flex items-center gap-2 text-small text-fg-muted"><span aria-hidden className={clsx('h-2 w-2 rounded-full', punto)} />{v.etichetta}</span>
              <span>
                <span className="cifre text-h1 font-light">{v.valore}</span>{v.unita && <span className="text-title text-fg-muted">{v.unita}</span>}
                {v.nota && <span className="mt-1 block text-small text-fg-muted">{v.nota}</span>}
              </span>
            </button>
          ))}
        </Carosello>
      </div>
    </section>
  );
}

/** Elenco con titolo (M.elenco). */
export function ElencoTel({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-caption uppercase text-fg-muted">{titolo}</h2>
      <div className="overflow-hidden rounded-[1.75rem] bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]">{children}</div>
    </section>
  );
}

/** Fisarmonica del telefono (M.fisarmonica): dentro un gruppo, con icona in un cerchio grigio e la freccia. */
export function FisarmonicaTel({ titolo, sotto, icona: Icona, children, aperta = false }: { titolo: string; sotto?: string; icona?: IconaComponente; children: ReactNode; aperta?: boolean }) {
  return (
    <details open={aperta} className="group border-b border-line px-4 py-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        {Icona && <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken"><Icona size={18} /></span>}
        <span className="min-w-0 flex-1">
          <span className="block text-title">{titolo}</span>
          {sotto && <span className="block truncate text-small text-fg-muted">{sotto}</span>}
        </span>
        <Giu size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 text-small">{children}</div>
    </details>
  );
}

/** Gruppo di fisarmoniche in una card. */
export function FisarmonicheTel({ children }: { children: ReactNode }) {
  return <div className="rounded-[1.75rem] bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]">{children}</div>;
}

/** Pulsante grande a tutta larghezza (M.grande). */
export function GrandeTel({ children, onClick, tono = 'primario' }: { children: ReactNode; onClick: () => void; tono?: 'primario' | 'accento' | 'secondario' }) {
  const cls = { primario: 'bg-grafite-900 text-white', accento: 'bg-acid-400 text-acid-950', secondario: 'bg-surface text-fg shadow-[inset_0_0_0_1.5px_var(--hse-line)]' }[tono];
  return <button type="button" onClick={onClick} className={clsx('h-14 w-full rounded-full text-body font-medium', cls)}>{children}</button>;
}
