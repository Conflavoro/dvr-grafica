'use client';

import type { ReactNode } from 'react';
import { Chip, type StatoChip } from '@/components/portale/kit';
import { Rotore } from '@/components/icone';
import { AgenteMarkdown } from '@/components/agente/AgenteMarkdown';
import { clsx } from '@/lib/clsx';
import { TESTO_LIVELLO, type LivelloRischio, type Tono } from '@/lib/cowork/logica';
import type { Fonte } from '@/lib/cowork/tipi';

/** Pezzi piccoli della Scrivania, riusati dai componenti grandi. */

const CHIP_DI: Record<Tono, StatoChip> = { ok: 'ok', warn: 'warn', danger: 'danger', info: 'info', run: 'run', sign: 'sign', todo: 'todo', neutral: 'neutral' };

export function Stato({ e, className }: { e: { testo: string; tono: Tono }; className?: string }) {
  return (
    <Chip stato={CHIP_DI[e.tono]} className={className}>
      {e.testo}
    </Chip>
  );
}

const LIVELLO: Record<LivelloRischio, string> = {
  basso: 'bg-stato-ok text-stato-ok-ink',
  medio: 'bg-[#ffe6a8] text-[#432b00]',
  alto: 'bg-[#fedab2] text-[#432b00]',
  molto_alto: 'bg-stato-danger text-stato-danger-ink',
};

const PUNTO: Record<LivelloRischio, string> = {
  basso: 'bg-stato-ok-segno',
  medio: 'bg-[#a86800]',
  alto: 'bg-[#f97316]',
  molto_alto: 'bg-stato-danger-segno',
};

/** Livello di rischio: colore sempre accompagnato dal testo. */
export function Livello({ l }: { l: LivelloRischio }) {
  return (
    <span className={clsx('inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12px] font-medium', LIVELLO[l])}>
      <span aria-hidden className={clsx('h-1.5 w-1.5 rounded-full', PUNTO[l])} />
      {TESTO_LIVELLO[l]}
    </span>
  );
}

const TIPO_FONTE: Record<string, string> = {
  revisione_dvr: 'Revisione',
  materiale: 'Materiale',
  memoria: 'Memoria',
  normativa: 'Norma',
  dato: 'Dato',
  valutazione: 'Valutazione',
  modello: 'Modello',
  persona: 'Persona',
};

export function Fonti({ fonti, scuro = false }: { fonti: Fonte[]; scuro?: boolean }) {
  if (fonti.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Fonti">
      {fonti.map((f, i) => (
        <li
          key={`${f.tipo}-${f.id ?? i}`}
          title={f.estratto ?? undefined}
          className={clsx('inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px]', scuro ? 'bg-white/10 text-grafite-200' : 'bg-perla-velo text-ink-soft')}
        >
          <span className={scuro ? 'text-grafite-400' : 'text-ink-muted'}>{TIPO_FONTE[f.tipo] ?? 'Fonte'}</span>
          <span className="max-w-[22ch] truncate">{f.etichetta}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pulsante con il suo stato di lavoro (il rotore sostituisce l'icona mentre lavora). */
export function Pulsante({
  classe = 'btn-ghost',
  lavora,
  disabilitato,
  onClick,
  children,
  titolo,
}: {
  classe?: string;
  lavora?: boolean;
  disabilitato?: boolean;
  onClick: () => void;
  children: ReactNode;
  titolo?: string;
}) {
  return (
    <button type="button" className={clsx(classe, 'min-h-[44px]')} disabled={disabilitato || lavora} aria-busy={lavora || undefined} title={titolo} onClick={onClick}>
      {lavora && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}

/**
 * Testo di un paragrafo. Le stesure arrivano in Markdown (titoli, grassetti,
 * elenchi, tabelle): il renderer leggero produce solo elementi React, quindi
 * qualunque HTML nel testo resta testo.
 */
export function TestoParagrafo({ testo, className }: { testo: string; className?: string }) {
  if (testo.trim() === '') return <p className={clsx('text-[14.5px] italic text-ink-muted', className)}>Testo vuoto.</p>;
  return <AgenteMarkdown testo={testo} className={clsx('space-y-3 break-words text-[15px] leading-[1.65] text-ink', className)} />;
}

/** Campo di testo breve per motivi e istruzioni, con conferma e annullo. */
export function Modulo({
  etichetta,
  aiuto,
  valore,
  onCambia,
  onConferma,
  onAnnulla,
  conferma,
  valido,
  lavora,
  righe = 3,
}: {
  etichetta: string;
  aiuto?: string;
  valore: string;
  onCambia: (v: string) => void;
  onConferma: () => void;
  onAnnulla: () => void;
  conferma: string;
  valido: boolean;
  lavora: boolean;
  righe?: number;
}) {
  return (
    <div className="mt-3 rounded-[1rem] bg-perla-velo p-3">
      <label className="block">
        <span className="text-[13.5px] font-medium text-ink">{etichetta}</span>
        {aiuto && <span className="mt-0.5 block text-[12.5px] text-ink-muted">{aiuto}</span>}
        <textarea
          rows={righe}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onAnnulla();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && valido && !lavora) onConferma();
          }}
          className="mt-2 w-full resize-y rounded-[0.875rem] bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] outline-none focus:shadow-[inset_0_0_0_1.5px_#18181b]"
        />
      </label>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost min-h-[44px]" onClick={onAnnulla} disabled={lavora}>
          Annulla
        </button>
        <Pulsante classe="btn-primary" lavora={lavora} disabilitato={!valido} onClick={onConferma}>
          {conferma}
        </Pulsante>
      </div>
    </div>
  );
}
