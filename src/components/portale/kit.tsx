'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Chiudi, Rotore } from '@/components/icone';
import type { IconaComponente } from '@/components/icone';
import { PASTIGLIA, TESTATA, type Categoria } from '@/lib/portale/sezioni';
import { clsx } from '@/lib/clsx';
import { apriFoglio } from '@/lib/portale/fogli';
import { useManiglia } from './telefono/gesti';

/**
 * Componenti ricorrenti del Portale HSE (design system del prototipo): testata di
 * sezione colorata, tessere, chip di stato, fogli laterali o dal basso, sotto
 * schede a pillola, riquadri numerici, stato vuoto, blocco per permesso.
 */

// ---------------------------------------------------------------- stati

export type StatoChip = 'ok' | 'warn' | 'danger' | 'todo' | 'info' | 'run' | 'sign' | 'pay' | 'approve' | 'neutral' | 'blocked';

const CHIP: Record<StatoChip, { cls: string; punto: string; testo: string }> = {
  ok: { cls: 'bg-stato-ok text-stato-ok-ink', punto: 'bg-stato-ok-segno', testo: 'In regola' },
  warn: { cls: 'bg-stato-warn text-stato-warn-ink', punto: 'bg-stato-warn-segno', testo: 'In scadenza' },
  danger: { cls: 'bg-stato-danger text-stato-danger-ink', punto: 'bg-stato-danger-segno', testo: 'Scaduto' },
  todo: { cls: 'bg-perla-velo text-ink-muted shadow-[inset_0_0_0_1px_#e2e2e5]', punto: 'bg-grafite-400', testo: 'Da prenotare' },
  info: { cls: 'bg-stato-info text-stato-info-ink', punto: 'bg-stato-info-segno', testo: 'Prenotata' },
  run: { cls: 'bg-stato-info text-stato-info-ink', punto: 'bg-stato-info-segno', testo: 'In corso' },
  sign: { cls: 'bg-oro-500 text-acido-950', punto: 'bg-acido-950', testo: 'Da firmare' },
  pay: { cls: 'bg-oro-500 text-acido-950', punto: 'bg-acido-950', testo: 'Da pagare' },
  approve: { cls: 'bg-oro-500 text-acido-950', punto: 'bg-acido-950', testo: 'Da approvare' },
  neutral: { cls: 'bg-perla-velo text-ink-muted', punto: 'bg-grafite-400', testo: '' },
  blocked: { cls: 'bg-stato-danger text-stato-danger-ink', punto: 'bg-stato-danger-segno', testo: 'Bloccato' },
};

export function Chip({ stato, children, className }: { stato: StatoChip; children?: ReactNode; className?: string }) {
  const c = CHIP[stato];
  return (
    <span className={clsx('chip shrink-0', c.cls, className)}>
      <span aria-hidden className={clsx('h-2 w-2 rounded-full', c.punto)} />
      {children ?? c.testo}
    </span>
  );
}

/** Stato di una data come nel prototipo: scaduta (danger), entro 30 giorni (warn), oltre (ok). */
export function statoData(iso: string | null | undefined, oggi: Date = new Date()): 'ok' | 'warn' | 'danger' | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const giorni = Math.floor((d.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 86400000);
  return giorni < 0 ? 'danger' : giorni <= 30 ? 'warn' : 'ok';
}

const fmtData = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtBreve = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
export function dataIt(iso: string | null | undefined, breve = false): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : (breve ? fmtBreve : fmtData).format(d);
}

export function traGiorni(iso: string | null | undefined, oggi: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const g = Math.round((d.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 86400000);
  if (g < 0) return g === -1 ? 'scaduta da 1 giorno' : `scaduta da ${-g} giorni`;
  if (g === 0) return 'scade oggi';
  return g === 1 ? 'tra 1 giorno' : `tra ${g} giorni`;
}

// ---------------------------------------------------------------- testata e tessere

export function Pastiglia({ categoria, icona: Icona, grande = false }: { categoria: Categoria; icona: IconaComponente; grande?: boolean }) {
  return (
    <span aria-hidden className={clsx('grid shrink-0 place-items-center rounded-full', PASTIGLIA[categoria], grande ? 'h-12 w-12' : 'h-9 w-9')}>
      <Icona size={grande ? 22 : 17} />
    </span>
  );
}

/** Testata della sezione: l'unico punto in cui il colore di categoria fa da fondo. */
/** Cerchio dell'icona sulle testate scure: sul nero il bianco col testo bianco spariva (Pronto Ispezioni). */
const CERCHIO_TESTATA: Partial<Record<Categoria, string>> = {
  ispezioni: 'bg-cat-ispezioni-ink text-cat-ispezioni',
};

export function Testata({
  categoria,
  icona,
  sopra,
  titolo,
  sotto,
  azioni,
  colorata = true,
}: {
  categoria: Categoria;
  icona: IconaComponente;
  sopra?: string;
  titolo: string;
  sotto?: ReactNode;
  azioni?: ReactNode;
  colorata?: boolean;
}) {
  return (
    <header
      data-falco="testata"
      className={clsx(
        // Telefono: raggio 1.75rem, padding 1.25rem; computer (.testata): raggio xl, padding 6 unità.
        'rounded-[1.75rem] p-5 lg:rounded-hse-xl lg:p-6',
        colorata ? TESTATA[categoria] : 'bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]',
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full lg:h-12 lg:w-12', colorata ? CERCHIO_TESTATA[categoria] ?? 'bg-white/80 lg:bg-white' : PASTIGLIA[categoria])}>
          {(() => {
            const I = icona;
            return <I size={22} />;
          })()}
        </span>
        <div className="min-w-0 flex-1">
          {sopra && <p className="text-small opacity-75">{sopra}</p>}
          <h1 className="text-h2 lg:text-h1">{titolo}</h1>
          {sotto && <div className="mt-1 text-small opacity-70 lg:text-body lg:opacity-75">{sotto}</div>}
        </div>
        {azioni && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{azioni}</div>}
      </div>
    </header>
  );
}

export function Scheda({ titolo, sotto, azioni, children, className }: { titolo?: string; sotto?: ReactNode; azioni?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]', className)}>
      {(titolo || azioni) && (
        <header className="flex flex-wrap items-start gap-3 px-4 pb-2 pt-4 sm:px-5">
          <div className="min-w-0 flex-1">
            {titolo && <h2 className="text-[18px] font-medium tracking-[-0.01em] text-ink">{titolo}</h2>}
            {sotto && <p className="mt-0.5 text-[13px] text-ink-muted">{sotto}</p>}
          </div>
          {azioni}
        </header>
      )}
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Riquadro numerico (Avanzamento, Conformi, Scadenze entro 30 giorni...). */
export function Riquadro({
  etichetta,
  valore,
  unita,
  nero = false,
  tono,
  sotto,
  punto,
  onClick,
}: {
  etichetta: string;
  valore: number | string | null;
  unita?: string;
  nero?: boolean;
  tono?: 'danger' | 'warn' | 'ok';
  sotto?: string;
  punto?: string;
  onClick?: () => void;
}) {
  const Corpo = (
    <>
      <p className={clsx('flex items-center gap-2 text-[13px]', nero ? 'text-grafite-300' : 'text-ink-soft')}>
        {punto && <span aria-hidden className={clsx('h-2 w-2 rounded-full', punto)} />}
        {etichetta}
      </p>
      <div>
        <p className={clsx('cifre leading-none', nero ? 'text-white' : tono === 'danger' ? 'text-[#d63d3e]' : tono === 'warn' ? 'text-[#a86800]' : 'text-ink')}>
          <span className="text-[30px] font-light tracking-[-0.03em]">{valore ?? 'n.d.'}</span>
          {valore !== null && unita && <span className={clsx('ml-0.5 text-[18px]', nero ? 'text-grafite-300' : 'text-ink-muted')}>{unita}</span>}
        </p>
        {sotto && <p className={clsx('mt-1.5 text-[12.5px]', nero ? 'text-grafite-400' : 'text-ink-muted')}>{sotto}</p>}
      </div>
    </>
  );
  const cls = clsx('flex min-h-[5.75rem] flex-col justify-between gap-2 rounded-[1.25rem] px-4 py-3 text-left', nero ? 'bg-black' : 'bg-white shadow-[inset_0_0_0_1px_#e2e2e5]');
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(cls, 'premi hover:shadow-[inset_0_0_0_1.5px_#18181b]')}>
      {Corpo}
    </button>
  ) : (
    <div className={cls}>{Corpo}</div>
  );
}

// ---------------------------------------------------------------- sotto schede

export function Schede<K extends string>({ voci, attiva, onCambia, etichetta }: { voci: Array<{ k: K; t: string; n?: number; /** Punto del Falco principale (data-falco): la scheda si puo' mostrare e aprire. */ falco?: string }>; attiva: K; onCambia: (k: K) => void; etichetta: string }) {
  return (
    <div role="tablist" aria-label={etichetta} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <div className="inline-flex shrink-0 gap-1 rounded-full bg-perla-velo p-1">
        {voci.map((v) => (
          <button
            key={v.k}
            role="tab"
            type="button"
            aria-selected={v.k === attiva}
            data-falco={v.falco}
            data-falco-tocca={v.falco ? '' : undefined}
            onClick={() => onCambia(v.k)}
            className={clsx(
              'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors lg:h-9',
              v.k === attiva ? 'bg-white text-ink shadow-[0_1px_2px_rgba(14,14,16,0.06),0_8px_24px_-12px_rgba(14,14,16,0.18)]' : 'text-ink-muted hover:text-ink'
            )}
          >
            {v.t}
            {v.n != null && v.n > 0 && <span className="cifre text-[12px] text-ink-subtle">{v.n}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- foglio

/**
 * Foglio per le azioni brevi (UI.foglio, 02): dal basso sul telefono, con la maniglia che lo
 * chiude trascinandolo giù oltre 110 px; pannello a destra da 32rem (46rem largo) sul computer.
 * Dialogo modale con titolo associato; all'apertura il fuoco va al primo campo dopo 350 ms
 * e la pagina sotto non scorre.
 */
export function Foglio({
  aperto,
  titolo,
  onChiudi,
  children,
  piede,
  largo = false,
  sopra,
  categoria,
  icona,
}: {
  aperto: boolean;
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
  piede?: ReactNode;
  largo?: boolean;
  /** Riga piccola sopra il titolo. */
  sopra?: string;
  /** Pastiglia della sezione nell'intestazione. */
  categoria?: Categoria;
  icona?: IconaComponente;
}) {
  const id = useId();
  const foglio = useRef<HTMLDivElement>(null);
  const maniglia = useManiglia(foglio, onChiudi);
  // Con il foglio aperto la striscia del Falco scende in fondo e il foglio le lascia spazio (--falco-riserva).
  useEffect(() => (aperto ? apriFoglio() : undefined), [aperto]);
  useEffect(() => {
    if (!aperto) return;
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onChiudi();
    document.addEventListener('keydown', esc);
    const prima = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const campo = foglio.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, [data-primo]')
        ?? foglio.current?.querySelector<HTMLElement>('button, a[href]');
      campo?.focus();
    }, 350);
    const corpo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = corpo;
      prima?.focus?.();
    };
  }, [aperto, onChiudi]);
  return (
    <>
      <div aria-hidden className={clsx('sheet-backdrop', aperto && 'open')} onClick={onChiudi} />
      <div
        ref={foglio}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titolo`}
        aria-hidden={!aperto}
        className={clsx('sheet', largo && 'sheet-wide', aperto && 'open')}
        style={{ paddingBottom: 'var(--falco-riserva, 0px)' }}
      >
        <div className="sheet-maniglia" aria-hidden {...maniglia}>
          <i />
        </div>
        <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4 lg:pt-5">
          {categoria && icona && <Pastiglia categoria={categoria} icona={icona} />}
          <div className="min-w-0 flex-1">
            {sopra && <p className="text-small text-fg-muted">{sopra}</p>}
            <h2 id={`${id}-titolo`} className="text-h3 text-fg">
              {titolo}
            </h2>
          </div>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="go text-fg">
            <Chiudi size={18} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {piede && (
          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            {piede}
          </footer>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- stati della pagina

export function Vuoto({ titolo, children, azione }: { titolo: string; children?: ReactNode; azione?: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] bg-perla-velo px-5 py-8 text-center">
      <p className="text-[16px] font-medium text-ink">{titolo}</p>
      {children && <p className="mx-auto mt-1 max-w-[46ch] text-[14px] leading-relaxed text-ink-muted">{children}</p>}
      {azione && <div className="mt-4 flex justify-center">{azione}</div>}
    </div>
  );
}

export function Caricamento({ testo = 'Carico i dati' }: { testo?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-[14px] text-ink-muted" role="status">
      <Rotore size={16} aria-hidden className="animate-spin text-acido-700 motion-reduce:animate-none" /> {testo}
    </p>
  );
}

export function Errore({ testo, onRiprova }: { testo: string; onRiprova?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-stato-danger px-4 py-3 text-[14px] text-stato-danger-ink">
      <span className="min-w-0 flex-1">{testo}</span>
      {onRiprova && (
        <button type="button" onClick={onRiprova} className="btn-ghost min-h-[44px] lg:min-h-[40px]">
          Riprova
        </button>
      )}
    </div>
  );
}

/** Azione non consentita al ruolo: pillola grigia con il motivo. */
export function Blocco({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-h-[36px] items-center rounded-full bg-perla-velo px-3.5 text-[13px] text-ink-muted shadow-[inset_0_0_0_1px_#e2e2e5]">{children}</span>;
}

/** Riga di un elenco con pastiglia, testi e azione a destra. */
export function Riga({
  inizio,
  titolo,
  sotto,
  fine,
  onClick,
}: {
  inizio?: ReactNode;
  titolo: ReactNode;
  sotto?: ReactNode;
  fine?: ReactNode;
  onClick?: () => void;
}) {
  const corpo = (
    <>
      {inizio}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium leading-snug text-ink">{titolo}</span>
        {sotto && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{sotto}</span>}
      </span>
      {fine}
    </>
  );
  const cls = 'flex min-h-[60px] w-full items-center gap-3 border-b border-perla-linea py-2.5 text-left last:border-b-0';
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(cls, 'hover:bg-perla-velo/60')}>
      {corpo}
    </button>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}
