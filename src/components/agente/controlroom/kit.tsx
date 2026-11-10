'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { CrContatori, CrEsito, CrLivello, Role } from '@/lib/data-source';
import { clearApiCache } from '@/lib/api';
import { clsx } from '@/lib/clsx';

/** Props comuni delle schede della Control Room (spazio di lavoro e pannelli). */
export interface SchedaControlRoomProps {
  aziendaId: number;
  ruolo: Role | null;
  /** Cresce quando l'agente ha scritto qualcosa: la scheda rilegge i dati. */
  versione: number;
  /** Manda una richiesta all'agente (stesso canale della conversazione). */
  chiedi: (testo: string) => void;
  /** true mentre l'agente lavora: i pulsanti che inviano si disattivano. */
  occupato?: boolean;
}

/** Consulente, titolare o admin: correggono, generano, scrivono osservazioni. */
export const daConsulente = (r: Role | null) => r === 'consulente' || r === 'titolare_studio' || r === 'admin_conflavoro';
/** Creano e revocano il passaporto (non l'admin, non il datore). */
export const gestiscePassaporto = (r: Role | null) => r === 'consulente' || r === 'titolare_studio';
export const puoEliminareIspezioni = (r: Role | null) => r === 'titolare_studio' || r === 'admin_conflavoro';

/** Carica un dato e lo rilegge quando cambiano le chiavi; ricarica svuota la cache GET. */
export function useDato<T>(carica: () => Promise<T>, chiavi: unknown[]) {
  const [dato, setDato] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(true);
  const [giro, setGiro] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useCallback(carica, chiavi);
  useEffect(() => {
    let vivo = true;
    setInCorso(true);
    setErrore(null);
    f()
      .then((d) => vivo && setDato(d))
      .catch((e: unknown) => vivo && setErrore(testoErrore(e, 'Dati non disponibili.')))
      .finally(() => vivo && setInCorso(false));
    return () => {
      vivo = false;
    };
  }, [f, giro]);
  const ricarica = useCallback(() => {
    clearApiCache();
    setGiro((g) => g + 1);
  }, []);
  return { dato, setDato, errore, inCorso, ricarica };
}

export function testoErrore(e: unknown, riserva: string): string {
  return e instanceof Error && e.message ? e.message : riserva;
}

// ------------------------------------------------------------------ esiti e livelli
export const ESITO: Record<CrEsito, { l: string; cls: string; punto: string }> = {
  conforme: { l: 'In regola', cls: 'bg-ok text-ok-ink', punto: 'bg-ok-mark' },
  in_scadenza: { l: 'In scadenza', cls: 'bg-oro-50 text-oro-700', punto: 'bg-oro-500' },
  da_verificare: { l: 'Da verificare', cls: 'bg-grafite-100 text-grafite-700', punto: 'bg-grafite-400' },
  non_conforme: { l: 'Da sistemare', cls: 'bg-danger text-danger-ink', punto: 'bg-danger-mark' },
  non_applicabile: { l: 'Non richiesto', cls: 'bg-perla-velo text-ink-muted', punto: 'bg-brand-200' },
};

export const LIVELLO: Record<CrLivello, { l: string; colore: string; testo: string }> = {
  buono: { l: 'Buono', colore: '#16884a', testo: 'text-ok-ink' },
  discreto: { l: 'Discreto', colore: '#677f02', testo: 'text-oro-700' },
  critico: { l: 'Critico', colore: '#a86800', testo: 'text-warn-ink' },
  grave: { l: 'Grave', colore: '#d63d3e', testo: 'text-danger-ink' },
  nd: { l: 'Senza dati', colore: '#c4c4c9', testo: 'text-ink-muted' },
};

export function BadgeEsito({ esito, className }: { esito: CrEsito | null; className?: string }) {
  if (!esito) return null;
  const e = ESITO[esito];
  return <span className={clsx('inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium', e.cls, className)}>{e.l}</span>;
}

export function Punto({ esito }: { esito: CrEsito }) {
  return <span aria-hidden className={clsx('inline-block h-2 w-2 shrink-0 rounded-full', ESITO[esito].punto)} />;
}

export const PRIORITA_SCAD: Record<string, { l: string; cls: string }> = {
  critica: { l: 'Critica', cls: 'text-danger-ink bg-danger' },
  alta: { l: 'Alta', cls: 'text-warn-ink bg-warn' },
  media: { l: 'Media', cls: 'text-brand-700 bg-brand-50' },
  bassa: { l: 'Bassa', cls: 'text-ink-muted bg-perla-velo' },
};

export function BadgePriorita({ p }: { p: string }) {
  const v = PRIORITA_SCAD[p] ?? PRIORITA_SCAD.media;
  return <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', v.cls)}>{v.l}</span>;
}

// ------------------------------------------------------------------ anello del punteggio
/**
 * Anello del Safety Score in SVG puro. Il valore entra una volta (transizione
 * del tratto), poi resta fermo: nessuna animazione continua.
 */
export function AnelloPunteggio({ totale, livello, dimensione = 132, spessore = 10 }: { totale: number | null; livello: CrLivello; dimensione?: number; spessore?: number }) {
  const r = (dimensione - spessore) / 2;
  const giro = 2 * Math.PI * r;
  const v = totale == null ? 0 : Math.max(0, Math.min(100, totale));
  const [mostrato, setMostrato] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMostrato(v));
    return () => cancelAnimationFrame(t);
  }, [v]);
  const L = LIVELLO[livello];
  return (
    <div className="relative shrink-0" style={{ width: dimensione, height: dimensione }}>
      <svg
        width={dimensione}
        height={dimensione}
        viewBox={`0 0 ${dimensione} ${dimensione}`}
        role="img"
        aria-label={totale == null ? 'Safety Score non calcolabile' : `Safety Score ${totale} su 100, livello ${L.l.toLowerCase()}`}
      >
        <circle cx={dimensione / 2} cy={dimensione / 2} r={r} fill="none" stroke="#e2e2e5" strokeWidth={spessore} />
        {/* Tacche ogni 10 punti: rendono leggibile la scala senza numeri. */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
          const r1 = r - spessore / 2 - 3;
          const r2 = r1 - (i % 5 === 0 ? 5 : 3);
          const c = dimensione / 2;
          return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} stroke="#e2e2e5" strokeWidth={1} />;
        })}
        <circle
          cx={dimensione / 2}
          cy={dimensione / 2}
          r={r}
          fill="none"
          stroke={L.colore}
          strokeWidth={spessore}
          strokeLinecap="round"
          strokeDasharray={`${(mostrato / 100) * giro} ${giro}`}
          transform={`rotate(-90 ${dimensione / 2} ${dimensione / 2})`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          className="transition-[stroke-dasharray] duration-1000 motion-reduce:transition-none"
        />
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="cifre text-[34px] font-semibold leading-none tracking-[-0.04em] text-brand-900" style={{ fontSize: dimensione * 0.26 }}>
          {totale ?? 'nd'}
        </span>
        <span className={clsx('mt-1 text-[11.5px] font-semibold', L.testo)}>{L.l}</span>
      </div>
    </div>
  );
}

/** Barra orizzontale di un'area (0..100), con il valore in cifre. */
export function BarraArea({ nome, punteggio, compatta }: { nome: string; punteggio: number | null; compatta?: boolean }) {
  const colore = LIVELLO[punteggio == null ? 'nd' : punteggio >= 85 ? 'buono' : punteggio >= 65 ? 'discreto' : punteggio >= 40 ? 'critico' : 'grave'].colore;
  return (
    <div className={clsx('min-w-0', compatta ? 'py-1' : 'py-1.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink-soft">{nome}</span>
        <span className="cifre shrink-0 text-[12.5px] font-semibold text-brand-900">{punteggio == null ? 'non richiesta' : punteggio}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-perla-linea"
        role="meter"
        aria-label={nome}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={punteggio ?? undefined}
        aria-valuetext={punteggio == null ? 'Non applicabile' : `${punteggio} su 100`}
      >
        {punteggio != null && <div className="h-full rounded-full" style={{ width: `${Math.max(2, punteggio)}%`, background: colore }} />}
      </div>
    </div>
  );
}

/** Contatore numerico con etichetta; tono amaranto se va guardato. */
export function Contatore({ n, etichetta, allerta, onClick, attivo }: { n: number; etichetta: string; allerta?: boolean; onClick?: () => void; attivo?: boolean }) {
  const corpo = (
    <>
      <span className={clsx('cifre block text-[22px] font-semibold leading-none tracking-[-0.03em]', allerta && n > 0 ? 'text-danger-ink' : 'text-brand-900')}>{n}</span>
      <span className="mt-1 block text-[11.5px] leading-tight text-ink-muted">{etichetta}</span>
    </>
  );
  const cls = clsx(
    'min-w-0 rounded-[0.875rem] px-3 py-2.5 text-left',
    attivo ? 'bg-brand-50 shadow-[inset_0_0_0_1.5px_rgba(14,14,16,0.45)]' : 'bg-perla-superficie shadow-[inset_0_0_0_1px_rgba(14,14,16,0.07)]'
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={attivo} className={clsx(cls, 'premi min-h-[56px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500')}>
      {corpo}
    </button>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

export const CONTATORI: Array<{ k: keyof CrContatori; l: string; allerta?: boolean }> = [
  { k: 'scadute', l: 'Scadute', allerta: true },
  { k: 'entro_30', l: 'Entro 30 giorni' },
  { k: 'visite_da_pianificare', l: 'Visite da pianificare' },
  { k: 'corsi_in_scadenza', l: 'Corsi in scadenza' },
  { k: 'alert_aperti', l: 'Avvisi aperti', allerta: true },
];

/** Gruppo di pulsanti a scelta singola (filtri), con target 44 px su mobile. */
export function Scelta<T extends string>({ valore, opzioni, onScegli, etichetta }: { valore: T; opzioni: Array<{ v: T; l: string }>; onScegli: (v: T) => void; etichetta: string }) {
  return (
    <div role="radiogroup" aria-label={etichetta} className="flex gap-1 rounded-[0.875rem] bg-[rgba(14,14,16,0.05)] p-1">
      {opzioni.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={o.v === valore}
          onClick={() => onScegli(o.v)}
          className={clsx(
            'premi min-h-[44px] flex-1 rounded-full px-2 text-[12.5px] sm:min-h-[34px]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
            o.v === valore ? 'bg-perla-carta font-semibold text-brand-900 shadow-[0_1px_2px_rgba(14,14,16,0.1),0_0_0_1px_rgba(14,14,16,0.06)]' : 'text-ink-muted hover:text-ink'
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Titoletto({ children, azione }: { children: ReactNode; azione?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between gap-2 first:mt-0">
      <h3 className="text-[14px] font-medium tracking-[-0.01em] text-brand-900">{children}</h3>
      {azione}
    </div>
  );
}

/** Pulsante testuale sobrio (stesso stile dei link dello spazio di lavoro). */
export const LINK_CR =
  'premi inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-brand-700 hover:bg-perla-velo hover:text-brand-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export function nomeMese(m: string | null, breve = false): string {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return '';
  const i = Number(m.slice(5, 7)) - 1;
  return breve ? MESI_BREVI[i] : `${MESI[i]} ${m.slice(0, 4)}`;
}
export function meseCorrente(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function dataCr(iso: string | null | undefined, conOra = false): string {
  if (!iso) return '';
  // "AAAA-MM-GG hh:mm:ss" senza fuso arriva dal database in UTC: senza la Z il
  // browser la leggerebbe come ora locale (ore sbagliate rispetto agli altri orari).
  const senzaFuso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso);
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : senzaFuso ? `${iso.replace(' ', 'T')}Z` : iso);
  return Number.isNaN(d.getTime()) ? '' : (conOra ? fmtOra : fmt).format(d);
}

/** Testo leggibile per "fra N giorni". */
export function quando(giorni: number | null): string {
  if (giorni == null) return '';
  if (giorni < -1) return `scaduta da ${-giorni} giorni`;
  if (giorni === -1) return 'scaduta ieri';
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'domani';
  return `fra ${giorni} giorni`;
}

export const DISCLAIMER_AI_CR = 'Testo preparato con assistenza AI: rivedilo prima di usarlo. La responsabilità resta del consulente (D.Lgs. 81/08).';
