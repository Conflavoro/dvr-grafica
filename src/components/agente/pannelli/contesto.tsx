'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LucideIcon } from '@/components/icone';
import type { Role } from '@/lib/data-source';
import type { AziendaBreve } from '../AziendaSelettore';

/**
 * Azioni che i pannelli possono chiedere alla console: parlare con l'agente,
 * fissare l'azienda della conversazione, caricare materiale nell'archivio.
 * I pannelli non chiamano mai l'agente da soli: passano sempre da qui.
 */
export interface AzioniPannelli {
  ruolo: Role | null;
  /** true mentre l'agente lavora o c'e' un caricamento: i pulsanti che inviano si disattivano. */
  occupato: boolean;
  invia(testo: string): void;
  /** Imposta l'azienda della conversazione e chiede all'agente di aprirne la scheda. */
  apriAzienda(azienda: AziendaBreve): void;
  /** Apre la fotocamera (o la scelta file) per una foto di sopralluogo dell'azienda. */
  scegliFoto(azienda: AziendaBreve): void;
  /** Carica un file registrato (audio) nell'archivio dell'azienda e lo segnala all'agente. */
  caricaAudio(azienda: AziendaBreve, file: File): Promise<void>;
  /** Nome dell'azienda se noto (per pannelli che hanno solo l'id). */
  nomeAzienda(id: number): string | null;
}

const Ctx = createContext<AzioniPannelli | null>(null);

export function AzioniPannelliProvider({ value, children }: { value: AzioniPannelli; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAzioniPannelli(): AzioniPannelli {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAzioniPannelli fuori da AzioniPannelliProvider');
  return v;
}

/** Chi puo' scrivere (sopralluogo, note, generazione, modifica testo). Il datore legge soltanto. */
export const puoScrivere = (r: Role | null) => r === 'consulente' || r === 'titolare_studio' || r === 'admin_conflavoro';
/** Approvazione: atto del titolare (o admin Conflavoro). */
export const puoApprovare = (r: Role | null) => r === 'titolare_studio' || r === 'admin_conflavoro';

/**
 * Categoria del Portale HSE dal titolo del pannello: il colore va solo nella
 * pastiglia dell'icona, mai sul fondo della scheda.
 */
const CATEGORIE: [RegExp, string][] = [
  [/ispezion|pronto controllo/i, 'bg-grafite-900 text-oro-500'],
  [/scadenz|calendari|promemoria/i, 'bg-cat-scadenze text-cat-scadenze-ink'],
  [/visit|sanitari|medic/i, 'bg-cat-visite text-cat-visite-ink'],
  [/formazion|attestat|cors/i, 'bg-cat-formazione text-cat-formazione-ink'],
  [/lavorator|persone|organigramma|nomin|assunt|mansion/i, 'bg-cat-persone text-cat-persone-ink'],
  [/antincendio|emergenz|rischi|valutazion|rumore|vibrazion|chimic|stress/i, 'bg-cat-antincendio text-cat-antincendio-ink'],
  [/pos|cantier|psc|pimus|duvri|appalt/i, 'bg-cat-contratto text-cat-contratto-ink'],
  [/preventiv|pagament|listino|quota/i, 'bg-cat-pagamenti text-cat-pagamenti-ink'],
  [/fonti|normativ|riferiment|novit/i, 'bg-cat-utenti text-cat-utenti-ink'],
  [/azien|anagraf|safety|passaporto|report|qualit/i, 'bg-cat-servizi text-cat-servizi-ink'],
  [/dvr|document|archivio|sezion|indice|revision|fascicolo|verbal|procedur|haccp/i, 'bg-cat-documenti text-cat-documenti-ink'],
];
export function categoriaPannello(titolo: string): string {
  return CATEGORIE.find(([re]) => re.test(titolo))?.[1] ?? 'bg-perla-velo text-ink';
}

export function CartaPannello({
  icona: Icona,
  titolo,
  sottotitolo,
  azioni,
  children,
}: {
  icona: LucideIcon;
  titolo: string;
  sottotitolo?: string | null;
  azioni?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article data-pannello="" className="flex min-w-0 flex-col rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5] [--icona-lame:currentColor] [--icona-lame-opacita:1]">
      <header className="flex items-start gap-3 border-b border-perla-linea px-4 py-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${categoriaPannello(titolo)}`}>
          <Icona size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-brand-900">{titolo}</h3>
          {sottotitolo && <p className="truncate text-[12px] text-ink-muted">{sottotitolo}</p>}
        </div>
        {azioni}
      </header>
      <div className="min-w-0 px-4 py-3 text-[13px] text-ink-soft">{children}</div>
    </article>
  );
}

export function Vuoto({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-ink-muted">{children}</p>;
}

const fmtData = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
export function dataBreve(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : fmtData.format(d);
}

export const STATO_DVR: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Bozza', cls: 'bg-perla-velo text-ink-muted shadow-[inset_0_0_0_1px_#e2e2e5]' },
  review: { label: 'In revisione', cls: 'bg-stato-warn text-stato-warn-ink' },
  approved: { label: 'Approvato', cls: 'bg-stato-ok text-stato-ok-ink' },
  superseded: { label: 'Superato', cls: 'bg-perla-velo text-ink-subtle' },
};

export function BadgeStato({ stato }: { stato: string | null }) {
  if (!stato) return <span className="inline-flex h-6 items-center rounded-full bg-perla-velo px-2.5 text-[11.5px] text-ink-muted">Nessun DVR</span>;
  const s = STATO_DVR[stato] ?? { label: stato, cls: 'bg-perla-velo text-ink-muted' };
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-medium ${s.cls}`}>{s.label}</span>;
}

/** Pulsante sobrio usato dentro i pannelli (target touch 44 px). */
export const BTN = 'btn-ghost min-h-[44px] px-3 text-[13px] disabled:opacity-50';
