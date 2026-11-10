'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Lame as IconaLame } from '@/components/icone';
import { AGENTE_TEMI, temaPerRuolo, type AgenteTema } from '@/lib/agente-temi';
import type { AziendaIndice } from '@/lib/agente-aziende';
import { useEntrata } from '@/lib/use-entrata';
import { clsx } from '@/lib/clsx';
import { FalcoPalco } from './FalcoPalco';
import type { FalcoMascotProps, FalcoStato } from './FalcoMascot';
import { Lame } from './spazio/kit';

type PropsFalco = Pick<FalcoMascotProps, 'onAttiva' | 'etichettaAttiva' | 'onReazioneFinita'>;

/** Il datore di lavoro vede tutti i temi, con domande informative (consulta soltanto). */
export function temiPerRuolo(isDatore: boolean): AgenteTema[] {
  return AGENTE_TEMI.map((t) => temaPerRuolo(t, isDatore));
}

function saluto(ora: number): string {
  if (ora < 5) return 'Buonasera';
  if (ora < 13) return 'Buongiorno';
  if (ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Larghezza del contenitore (per scegliere quante colonne ha il bento). */
function useLarghezzaDi(ref: React.RefObject<HTMLElement>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Domanda({ testo, onClick, disabled, scuro = false, grande = false }: { testo: string; onClick: () => void; disabled: boolean; scuro?: boolean; grande?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'premi group/d flex w-full items-center gap-2.5 rounded-full text-left disabled:opacity-50',
        'focus-visible:outline focus-visible:outline-2',
        scuro ? 'text-[#e2e2e5] hover:bg-white/[0.07] hover:text-white focus-visible:outline-oro-300' : 'text-ink-soft hover:bg-perla-velo hover:text-brand-900 focus-visible:outline-brand-500',
        grande ? 'min-h-[56px] px-3.5 text-[15.5px]' : 'min-h-[44px] px-2.5 text-[13.5px] leading-snug'
      )}
    >
      <Lame className={clsx('transition-transform duration-300 group-hover/d:translate-x-0.5', scuro && 'opacity-90')} />
      <span className="min-w-0 flex-1">{testo}</span>
    </button>
  );
}

/** Posto di ogni tema nel bento (colonne occupate) secondo quante colonne ci sono. */
function campata(id: string, colonne: number): string {
  if (colonne >= 3) return id === 'dvr' || id === 'aziende' ? 'col-span-2' : '';
  if (colonne === 2) return id === 'dvr' || id === 'aziende' ? 'col-span-2' : '';
  return '';
}

function Tessera({ t, colonne, onTema, onDomanda, disabled }: { t: AgenteTema; colonne: number; onTema: (t: AgenteTema) => void; onDomanda: (q: string) => void; disabled: boolean }) {
  const Icona = t.icona;
  const scuro = t.id === 'dvr';
  const larga = campata(t.id, colonne) !== '';
  return (
    <article
      data-entra=""
      className={clsx(
        'group relative overflow-hidden rounded-[1.25rem] p-1.5 transition-shadow duration-300',
        scuro ? 'comando [--icona-lame:#d4ff3a] [--icona-lame-opacita:1]' : 'superficie [--icona-lame:#677f02] [--icona-lame-opacita:0.9] hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(14,14,16,0.05),0_18px_40px_-18px_rgba(14,14,16,0.28)]',
        campata(t.id, colonne)
      )}
    >
      {scuro && (
        <Icona aria-hidden size={180} strokeWidth={0.6} className="pointer-events-none absolute -bottom-10 -right-6 text-white/[0.06]" />
      )}
      <button
        type="button"
        onClick={() => onTema(t)}
        disabled={disabled}
        aria-label={`Apri il tema ${t.titolo}`}
        className={clsx(
          'relative flex w-full items-start gap-3 rounded-[0.875rem] px-3 pb-2 pt-3 text-left disabled:opacity-60',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2',
          scuro ? 'focus-visible:outline-oro-300' : 'focus-visible:outline-brand-500'
        )}
      >
        <span
          aria-hidden
          className={clsx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.875rem]',
            scuro ? 'bg-white/[0.08] text-oro-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'bg-gradient-to-b from-perla-carta to-perla-velo text-brand-800 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08),0_1px_2px_rgba(14,14,16,0.06)]'
          )}
        >
          <Icona size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx('block font-medium tracking-[-0.015em]', scuro ? 'text-[21px] text-white' : 'text-[16.5px] text-brand-900')}>{t.titolo}</span>
          <span className={clsx('mt-0.5 block text-[12.5px] leading-snug', scuro ? 'text-[#c4c4c9]' : 'text-ink-muted')}>{t.descrizione}</span>
        </span>
        <span aria-hidden className={clsx('mt-1 shrink-0 text-[11.5px] font-semibold opacity-0 transition-opacity duration-300 group-hover:opacity-100', scuro ? 'text-oro-200' : 'text-oro-700')}>
          Apri
        </span>
      </button>
      <ul className={clsx('relative px-1 pb-1', larga && colonne >= 2 && 'sm:grid sm:grid-cols-3 sm:gap-x-1')}>
        {t.domande.map((q) => (
          <li key={q}>
            <Domanda testo={q} onClick={() => onDomanda(q)} disabled={disabled} scuro={scuro} />
          </li>
        ))}
      </ul>
    </article>
  );
}

const PALLINO: Record<AziendaIndice['stato'], string> = { scaduto: 'bg-[#d63d3e]', aggiornare: 'bg-oro-500', ok: 'bg-brand-300' };

/** Conversazione vuota: il falco in scena, il saluto, le aziende da seguire e i temi. */
export function ScenaApertura({
  nomeUtente,
  nomeAgente,
  stato,
  propsFalco,
  desktop,
  isDatore,
  disabled,
  aprendo,
  attenzione,
  onApriAzienda,
  onTema,
  onDomanda,
}: {
  nomeUtente: string;
  nomeAgente: string;
  stato: FalcoStato;
  propsFalco: PropsFalco;
  desktop: boolean;
  isDatore: boolean;
  disabled: boolean;
  aprendo: boolean;
  attenzione: AziendaIndice[];
  onApriAzienda: (a: AziendaIndice) => void;
  onTema: (t: AgenteTema) => void;
  onDomanda: (q: string) => void;
}) {
  const temi = temiPerRuolo(isDatore);
  const box = useRef<HTMLDivElement>(null);
  const w = useLarghezzaDi(box);
  const colonne = w >= 900 ? 3 : w >= 560 ? 2 : 1;
  useEntrata(box, 'apertura');

  return (
    <div ref={box} className="mx-auto w-full max-w-[68rem] px-4 pb-12 pt-4 sm:px-8 sm:pt-8">
      <header className="flex flex-col items-center text-center">
        <FalcoPalco stato={stato} size={desktop ? 236 : 168} {...propsFalco} />
        <h1 className="mt-3 max-w-[18ch] text-balance text-[36px] font-medium leading-[1.02] tracking-[-0.035em] text-brand-900 sm:mt-4 sm:max-w-none sm:text-[56px]">
          <span data-titolo="" className="block">
            {saluto(new Date().getHours())}
            {nomeUtente ? `, ${nomeUtente}.` : '.'}
          </span>
          <span data-titolo="" className="block font-medium text-brand-500">
            Cosa mettiamo in sicurezza oggi?
          </span>
        </h1>
        <p data-entra="" className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-ink-muted">
          Sono {nomeAgente}. Preparo DVR, POS e DUVRI, seguo formazione e scadenze, leggo la normativa ogni giorno e tengo in ordine le tue aziende. Parlami o scrivimi.
        </p>
        {aprendo && <p className="mt-3 text-[13px] text-ink-muted">Apro la conversazione</p>}
      </header>

      {attenzione.length > 0 && (
        <section data-entra="" aria-labelledby="da-seguire" className="mt-9">
          <div className="mb-2.5 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 id="da-seguire" className="text-[15px] font-medium tracking-[-0.01em] text-brand-900">
              Da seguire
            </h2>
            <p className="text-[12.5px] text-ink-muted">Aziende con scadenze superate o DVR da aggiornare</p>
          </div>
          <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {attenzione.map((a) => (
              <li key={a.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onApriAzienda(a)}
                  className="premi premi-su superficie flex min-h-[52px] max-w-[19rem] items-center gap-3 rounded-full px-3.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <span aria-hidden className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', PALLINO[a.stato])} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{a.ragione_sociale}</span>
                    <span className={clsx('block truncate text-[12px]', a.stato === 'scaduto' ? 'text-danger-ink' : 'text-oro-700')}>{a.motivo}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="temi-titolo" className="mt-9">
        <div data-entra="" className="mb-3 flex items-center gap-3">
          <h2 id="temi-titolo" className="shrink-0 text-[15px] font-medium tracking-[-0.01em] text-brand-900">
            Da dove partiamo
          </h2>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-brand-900/15 to-transparent" />
          <IconaLame aria-hidden size={18} className="text-oro-500" />
        </div>
        <div className={clsx('grid gap-3', colonne === 3 ? 'grid-cols-3' : colonne === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
          {temi.map((t) => (
            <Tessera key={t.id} t={t} colonne={colonne} onTema={onTema} onDomanda={onDomanda} disabled={disabled} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Tema aperto, conversazione ancora vuota: il falco ascolta e propone le domande. */
export function TemaAperto({
  tema,
  stato,
  propsFalco,
  desktop,
  disabled,
  onIndietro,
  onDomanda,
  onAvvio,
}: {
  tema: AgenteTema;
  stato: FalcoStato;
  propsFalco: PropsFalco;
  desktop: boolean;
  disabled: boolean;
  onIndietro: () => void;
  onDomanda: (q: string) => void;
  onAvvio: () => void;
}) {
  const Icona = tema.icona;
  const box = useRef<HTMLDivElement>(null);
  useEntrata(box, `tema-${tema.id}`);
  return (
    <div ref={box} className="mx-auto w-full max-w-3xl px-4 pb-10 pt-3 sm:px-8 sm:pt-8">
      <button type="button" onClick={onIndietro} className="premi -ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[13px] font-medium text-ink-muted hover:text-brand-900">
        <ChevronLeft size={16} aria-hidden /> Tutti i temi
      </button>
      <div className="mt-2 flex items-end gap-4 sm:gap-6">
        <FalcoPalco stato={stato} size={desktop ? 136 : 104} compatto {...propsFalco} />
        <div className="min-w-0 pb-2">
          <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-perla-carta to-perla-velo text-brand-800 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)] [--icona-lame:#677f02] [--icona-lame-opacita:1]">
            <Icona size={19} />
          </span>
          <h1 data-titolo="" className="mt-2 text-[32px] font-medium leading-[1.02] tracking-[-0.035em] text-brand-900 sm:text-[44px]">
            {tema.titolo}
          </h1>
          <p data-entra="" className="mt-1.5 text-[14.5px] text-ink-muted">
            {tema.descrizione}
          </p>
        </div>
      </div>

      <p data-entra="" className="mt-8 text-[14px] font-medium text-ink-soft">
        Scegli da dove partire, oppure parlami qui sotto.
      </p>
      <ul className="superficie mt-2.5 overflow-hidden rounded-[1.25rem] p-1.5 [--icona-lame:#677f02] [--icona-lame-opacita:1]">
        {tema.domande.map((q) => (
          <li key={q} data-entra="">
            <Domanda testo={q} onClick={() => onDomanda(q)} disabled={disabled} grande />
          </li>
        ))}
      </ul>
      <button data-entra="" type="button" onClick={onAvvio} disabled={disabled} className="btn-ghost premi mt-4 min-h-[44px]">
        Fammi tu le domande giuste
      </button>
    </div>
  );
}
