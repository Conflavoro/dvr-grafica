'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chip, type StatoChip } from '../kit';
import { usePortale } from '../PortaleShell';
import { Spunta as IconaSpunta } from '@/components/icone';
import { aziendePortale, type AziendaPortale } from '@/lib/portale/api';
import { clsx } from '@/lib/clsx';

/**
 * Pezzi comuni delle viste di formazione, visite e amministrazione: carico dei
 * dati legato alla versione del Falco, campi del modulo, avvisi, barra delle
 * azioni sul telefono, selettore dell'azienda per il gestionale.
 */

/** Carica i dati e li ricarica quando cambia una dipendenza (versione del Falco, filtro). */
export function useCarico<T>(fn: () => Promise<T>, deps: unknown[]): { dati: T | null; errore: string | null; carica: () => void; inCorso: boolean } {
  const [dati, setDati] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(true);
  const giro = useRef(0);
  const carica = useCallback(() => {
    const n = ++giro.current;
    setInCorso(true);
    fn()
      .then((d) => {
        if (n === giro.current) {
          setDati(d);
          setErrore(null);
        }
      })
      .catch((e: unknown) => n === giro.current && setErrore(e instanceof Error ? e.message : 'Non riesco a caricare i dati.'))
      .finally(() => n === giro.current && setInCorso(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => carica(), [carica]);
  return { dati, errore, carica, inCorso };
}

/**
 * Aziende visibili dallo studio, per i selettori del gestionale. Con un cliente
 * scelto in cima al menu resta solo quello: i moduli lavorano sull'azienda scelta.
 */
export function useAziendeStudio(): AziendaPortale[] {
  const { aziendaScelta } = usePortale();
  const [l, setL] = useState<AziendaPortale[]>([]);
  useEffect(() => {
    aziendePortale()
      .then(setL)
      .catch(() => setL([]));
  }, []);
  return aziendaScelta ? l.filter((a) => a.id === aziendaScelta.id) : l;
}

export function ChipStato({ c }: { c: [StatoChip, string] }) {
  return <Chip stato={c[0]}>{c[1]}</Chip>;
}

export function Campo({ etichetta, aiuto, errore, children }: { etichetta: string; aiuto?: string; errore?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{etichetta}</span>
      {children}
      {aiuto && !errore && <span className="mt-1 block text-[12.5px] text-ink-muted">{aiuto}</span>}
      {errore && <span className="mt-1 block text-[12.5px] text-[#d63d3e]">{errore}</span>}
    </label>
  );
}

export function Avviso({ tono = 'info', children }: { tono?: 'info' | 'warn' | 'ok' | 'danger'; children: ReactNode }) {
  const cls = { info: 'bg-stato-info text-stato-info-ink', warn: 'bg-stato-warn text-stato-warn-ink', ok: 'bg-stato-ok text-stato-ok-ink', danger: 'bg-stato-danger text-stato-danger-ink' }[tono];
  return <div className={clsx('rounded-[1rem] px-4 py-3 text-[13.5px] leading-relaxed', cls)}>{children}</div>;
}

/** Messaggio dopo un'azione: sparisce da solo. */
export function useMessaggio(): [ReactNode, (testo: string, tono?: 'ok' | 'danger') => void] {
  const [m, setM] = useState<{ t: string; tono: 'ok' | 'danger' } | null>(null);
  useEffect(() => {
    if (!m) return;
    const id = setTimeout(() => setM(null), m.tono === 'ok' ? 3500 : 7000);
    return () => clearTimeout(id);
  }, [m]);
  const nodo = m ? (
    <div role="status" className="fixed inset-x-4 bottom-[6.5rem] z-[70] mx-auto max-w-[28rem] lg:bottom-6">
      <Avviso tono={m.tono}>{m.t}</Avviso>
    </div>
  ) : null;
  return [nodo, (t, tono = 'ok') => setM({ t, tono })];
}

/** Barra fissa in basso per la selezione multipla (sopra il menu del telefono). */
export function BarraSelezione({ testo, children }: { testo: string; children: ReactNode }) {
  return (
    <div className="fixed inset-x-3 bottom-[6.25rem] z-[55] mx-auto flex max-w-[40rem] flex-wrap items-center gap-2 rounded-[1.5rem] bg-grafite-900 px-4 py-3 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] lg:bottom-6">
      <span className="min-w-0 flex-1 text-[14px]">{testo}</span>
      {children}
    </div>
  );
}

export function Spunta({ attiva, onCambia, etichetta }: { attiva: boolean; onCambia: (v: boolean) => void; etichetta: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={attiva}
      aria-label={etichetta}
      onClick={(e) => {
        e.stopPropagation();
        onCambia(!attiva);
      }}
      className="grid h-11 w-11 shrink-0 place-items-center"
    >
      <span className={clsx('grid h-6 w-6 place-items-center rounded-[0.5rem]', attiva ? 'bg-grafite-900 text-acido-400' : 'bg-white shadow-[inset_0_0_0_1.5px_#c4c4c9]')}>
        {attiva && <IconaSpunta size={14} aria-hidden />}
      </span>
    </button>
  );
}

/** Scelte a pillola (filtri, stati brevi). */
export function Pillole<K extends string | number>({ voci, attiva, onCambia, etichetta }: { voci: Array<{ k: K; t: string }>; attiva: K; onCambia: (k: K) => void; etichetta: string }) {
  return (
    <div role="radiogroup" aria-label={etichetta} className="flex flex-wrap gap-1.5">
      {voci.map((v) => (
        <button
          key={String(v.k)}
          type="button"
          role="radio"
          aria-checked={v.k === attiva}
          onClick={() => onCambia(v.k)}
          className={clsx('h-10 rounded-full px-4 text-[13.5px] font-medium', v.k === attiva ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink-muted hover:text-ink')}
        >
          {v.t}
        </button>
      ))}
    </div>
  );
}

/** Coppia etichetta e valore nelle schede di dettaglio. */
export function Voce({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
      <span className="w-[42%] shrink-0 text-[13px] text-ink-muted">{k}</span>
      <span className="min-w-0 flex-1 text-[14px] text-ink">{v}</span>
    </div>
  );
}

/** Esegue un'azione con stato di attesa ed errore leggibile. */
export function useAzione(): { occupato: boolean; esegui: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; messaggio: ReactNode } {
  const [occupato, setOccupato] = useState(false);
  const [messaggio, mostra] = useMessaggio();
  const esegui = useCallback(
    async (fn: () => Promise<unknown>, ok?: string) => {
      setOccupato(true);
      try {
        await fn();
        if (ok) mostra(ok, 'ok');
        return true;
      } catch (e) {
        mostra(e instanceof Error ? e.message : 'Operazione non riuscita.', 'danger');
        return false;
      } finally {
        setOccupato(false);
      }
    },
    [mostra]
  );
  return { occupato, esegui, messaggio };
}
