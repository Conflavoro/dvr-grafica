'use client';

import { percorso } from '@/lib/percorso';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Elenco, FolderOpen, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Star, Trash2, X } from '@/components/icone';
import type { AgenteConversazione, User } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { roleLabel } from '@/lib/permissions';
import { AGENTE_TEMI, senzaTema, type AgenteTema } from '@/lib/agente-temi';
import {
  FILTRO_AZIENDE_INIZIALE,
  contaPerStato,
  filtraAziende,
  filtroVuoto,
  iniziale,
  type AziendaIndice,
  type FiltroAziende,
  type FiltroStatoAziende,
  type OrdineAziende,
  type PreferenzeAziende,
} from '@/lib/agente-aziende';
import { clsx } from '@/lib/clsx';

type Gruppo = { titolo: string; voci: AgenteConversazione[] };

/** Raggruppa le conversazioni per oggi, ultimi 7 giorni, prima. */
export function gruppiRecenti(conv: AgenteConversazione[], ora: Date = new Date()): Gruppo[] {
  const inizioOggi = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate()).getTime();
  const settimana = inizioOggi - 6 * 86400000;
  const oggi: AgenteConversazione[] = [];
  const sett: AgenteConversazione[] = [];
  const prima: AgenteConversazione[] = [];
  for (const c of conv) {
    const t = c.aggiornata ? new Date(c.aggiornata).getTime() : NaN;
    if (!Number.isNaN(t) && t >= inizioOggi) oggi.push(c);
    else if (!Number.isNaN(t) && t >= settimana) sett.push(c);
    else prima.push(c);
  }
  return [
    { titolo: 'Oggi', voci: oggi },
    { titolo: 'Questa settimana', voci: sett },
    { titolo: 'Prima', voci: prima },
  ].filter((g) => g.voci.length > 0);
}

function iniziali(nome: string): string {
  return (
    nome
      .split(' ')
      .filter((p) => !/\.$/.test(p))
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || 'U'
  );
}

const PALLINO: Record<AziendaIndice['stato'], string> = {
  scaduto: 'bg-[#ef4444] shadow-[0_0_0_3px_rgba(239,90,79,0.15)]',
  aggiornare: 'bg-oro-300 shadow-[0_0_0_3px_rgba(212,255,58,0.14)]',
  ok: 'bg-[#5e5e66]',
};

const TEMI_KEY = 'crm_dvr_agente_temi_aperti';

/** Scorciatoia da mostrare: Cmd su Mac, Ctrl altrove. */
export function tastoComando(): string {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';
  } catch {
    return 'Ctrl';
  }
}

function RigaAzienda({
  a,
  attiva,
  preferita,
  onApri,
  onPreferita,
}: {
  a: AziendaIndice;
  attiva: boolean;
  preferita: boolean;
  onApri: () => void;
  onPreferita: () => void;
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onApri}
        aria-current={attiva ? 'true' : undefined}
        title={`${a.ragione_sociale}: ${a.motivo}`}
        className={clsx(
          'flex min-h-[54px] w-full items-center gap-3 rounded-[1rem] py-1.5 pl-2.5 pr-10 text-left transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
          attiva ? 'bg-white text-grafite-950' : 'hover:bg-grafite-800'
        )}
      >
        <span aria-hidden className={clsx('relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium', attiva ? 'bg-grafite-900 text-white' : 'bg-grafite-800 text-grafite-300')}>
          {a.ragione_sociale.slice(0, 2).toUpperCase()}
          <span className={clsx('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2', attiva ? 'ring-white' : 'ring-black', PALLINO[a.stato])} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx('block truncate text-[13.5px] font-medium', attiva ? 'text-grafite-950' : 'text-white')}>{a.ragione_sociale}</span>
          <span className={clsx('block truncate text-[11.5px]', attiva ? 'text-ink-muted' : 'text-grafite-400')}>
            {[a.comune, a.lavoratori > 0 ? `${a.lavoratori} lav.` : null, a.ateco ? `ATECO ${a.ateco}` : null].filter(Boolean).join(' · ') || a.motivo}
          </span>
          <span className={clsx('block truncate text-[11.5px]', a.stato === 'scaduto' ? 'text-[#ffc6ac]' : a.stato === 'aggiornare' ? (attiva ? 'text-acido-700' : 'text-oro-300') : attiva ? 'text-ink-subtle' : 'text-grafite-500')}>{a.motivo}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPreferita}
        aria-pressed={preferita}
        aria-label={preferita ? `Togli ${a.ragione_sociale} dalle preferite` : `Aggiungi ${a.ragione_sociale} alle preferite`}
        title={preferita ? 'Togli dalle preferite' : 'Aggiungi alle preferite'}
        className={clsx(
          'absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 lg:h-10 lg:w-10 items-center justify-center rounded-full hover:bg-white/[0.06] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
          preferita ? (attiva ? 'text-acido-700' : 'text-oro-500') : 'text-[#6b6b73] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100'
        )}
      >
        <Star size={14} aria-hidden className={preferita ? 'fill-current' : undefined} />
      </button>
    </li>
  );
}

const FILTRI: Array<{ k: FiltroStatoAziende; t: string }> = [
  { k: 'tutte', t: 'Tutte' },
  { k: 'scaduto', t: 'Scadute' },
  { k: 'aggiornare', t: 'Da aggiornare' },
  { k: 'ok', t: 'In regola' },
  { k: 'preferite', t: 'Preferite' },
];
const ORDINI: Array<{ k: OrdineAziende; t: string }> = [
  { k: 'nome', t: 'Nome' },
  { k: 'urgenza', t: 'Urgenza' },
  { k: 'lavoratori', t: 'Lavoratori' },
];
const FILTRO_KEY = 'crm_dvr_agente_filtro_aziende';

/** Ricerca e filtri dell'elenco aziende, come i filtri del gestionale del Portale HSE. */
function FiltriAziende({ f, conti, onCambia, trovate }: { f: FiltroAziende; conti: Record<FiltroStatoAziende, number>; onCambia: (f: FiltroAziende) => void; trovate: number }) {
  return (
    <div className="space-y-2 px-1 pb-1 pt-1">
      <label className="flex h-11 items-center gap-2 rounded-full bg-grafite-800 px-3.5 focus-within:shadow-[inset_0_0_0_2px_#d4ff3a]">
        <Search size={15} aria-hidden className="shrink-0 text-grafite-400" />
        <span className="sr-only">Filtra le aziende</span>
        <input
          value={f.testo}
          onChange={(e) => onCambia({ ...f, testo: e.target.value.slice(0, 80) })}
          placeholder="Nome, comune, ATECO, P.IVA"
          className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-grafite-500 focus:outline-none focus-visible:shadow-none sm:text-[13.5px]"
        />
        {f.testo && (
          <button type="button" onClick={() => onCambia({ ...f, testo: '' })} aria-label="Cancella la ricerca" className="-mr-2 grid h-9 w-9 place-items-center rounded-full text-grafite-400 hover:bg-grafite-700 hover:text-white">
            <X size={14} aria-hidden />
          </button>
        )}
      </label>
      <div role="group" aria-label="Filtra per stato" className="flex flex-wrap gap-1.5">
        {FILTRI.map(({ k, t }) => {
          const on = f.stato === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onCambia({ ...f, stato: on && k !== 'tutte' ? 'tutte' : k })}
              className={clsx(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
                on ? 'bg-white text-grafite-950' : 'text-grafite-300 shadow-[inset_0_0_0_1px_#34343a] hover:bg-grafite-800 hover:text-white'
              )}
            >
              {k === 'scaduto' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />}
              {k === 'aggiornare' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-oro-300" />}
              {k === 'ok' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#5e5e66]" />}
              {t}
              <span className={clsx('cifre text-[11px]', on ? 'text-ink-muted' : 'text-grafite-500')}>{conti[k]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 px-1.5 text-[12px] text-grafite-400">
        <span aria-live="polite">{filtroVuoto(f) ? `${conti.tutte} aziende` : trovate === 1 ? '1 azienda trovata' : `${trovate} aziende trovate`}</span>
        <label className="inline-flex items-center gap-1.5">
          <span>Ordina per</span>
          <select
            value={f.ordine}
            onChange={(e) => onCambia({ ...f, ordine: e.target.value as OrdineAziende })}
            className="h-8 rounded-full bg-grafite-800 px-2.5 text-[12px] text-white focus:outline-none"
          >
            {ORDINI.map((o) => (
              <option key={o.k} value={o.k}>
                {o.t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Titoletto({ children }: { children: React.ReactNode }) {
  return <h3 className="px-2.5 pb-1 pt-3 text-[12px] font-semibold text-[#9a9aa2]">{children}</h3>;
}

/**
 * Colonna sinistra della console, come in Claude Cowork: marchio, ricerca,
 * nuova conversazione, aziende (preferite, recenti, tutte dalla A alla Z),
 * conversazioni generali e temi. Su desktop si riduce a una striscia di
 * icone; su mobile e' un cassetto.
 */
export function AgenteRail({
  user,
  conversazioni,
  attivaId,
  caricamento,
  errore,
  temaAttivo,
  ridotta,
  mobile,
  aziende,
  aziendeCarica,
  aziendeErrore,
  preferenze,
  aziendaAttivaId,
  onApriAzienda,
  onPreferita,
  onCerca,
  onRiduci,
  onChiudi,
  onNuova,
  onTema,
  onApri,
  onElimina,
  onRiprova,
}: {
  user: User;
  conversazioni: AgenteConversazione[];
  attivaId: number | null;
  caricamento: boolean;
  errore: string | null;
  temaAttivo: string | null;
  ridotta: boolean;
  mobile: boolean;
  aziende: AziendaIndice[];
  aziendeCarica: boolean;
  aziendeErrore: string | null;
  preferenze: PreferenzeAziende;
  aziendaAttivaId: number | null;
  onApriAzienda: (a: AziendaIndice) => void;
  onPreferita: (id: number) => void;
  onCerca: () => void;
  onRiduci: () => void;
  onChiudi: () => void;
  onNuova: () => void;
  onTema: (t: AgenteTema) => void;
  onApri: (id: number) => void;
  onElimina: (c: AgenteConversazione) => void;
  onRiprova: () => void;
}) {
  const ds = useDataSource();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [temiAperti, setTemiAperti] = useState(false);
  const [tasto, setTasto] = useState('Ctrl');
  const box = useRef<HTMLDivElement>(null);
  const stretta = ridotta && !mobile;
  const [filtro, setFiltro] = useState<FiltroAziende>(FILTRO_AZIENDE_INIZIALE);
  const [tutteConv, setTutteConv] = useState(false);
  // Stato e ordine si ricordano nel browser (comodita' di chi guarda); la ricerca no.
  useEffect(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(FILTRO_KEY) ?? 'null') as Partial<FiltroAziende> | null;
      if (v && FILTRI.some((x) => x.k === v.stato) && ORDINI.some((x) => x.k === v.ordine)) setFiltro((f) => ({ ...f, stato: v.stato!, ordine: v.ordine! }));
    } catch {
      /* preferenza di comodo */
    }
  }, []);
  const cambiaFiltro = (f: FiltroAziende) => {
    setFiltro(f);
    try {
      window.localStorage.setItem(FILTRO_KEY, JSON.stringify({ stato: f.stato, ordine: f.ordine }));
    } catch {
      /* preferenza di comodo */
    }
  };

  useEffect(() => {
    setTasto(tastoComando());
    try {
      setTemiAperti(window.localStorage.getItem(TEMI_KEY) === '1');
    } catch {
      /* preferenza di comodo */
    }
  }, []);
  const cambiaTemi = () => {
    const v = !temiAperti;
    setTemiAperti(v);
    try {
      window.localStorage.setItem(TEMI_KEY, v ? '1' : '0');
    } catch {
      /* preferenza di comodo */
    }
  };

  useEffect(() => {
    if (!menu) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  const esci = async () => {
    try {
      await ds.auth.logout();
    } finally {
      router.push('/');
    }
  };

  const perId = new Map(aziende.map((a) => [a.id, a]));
  const preferite = preferenze.preferite.map((id) => perId.get(id)).filter((a): a is AziendaIndice => !!a);
  const recenti = preferenze.recenti
    .filter((id) => !preferenze.preferite.includes(id))
    .map((id) => perId.get(id))
    .filter((a): a is AziendaIndice => !!a);
  const lettere: Array<{ l: string; voci: AziendaIndice[] }> = [];
  for (const a of aziende) {
    const l = iniziale(a.ragione_sociale);
    const g = lettere[lettere.length - 1];
    if (g && g.l === l) g.voci.push(a);
    else lettere.push({ l, voci: [a] });
  }
  const conti = contaPerStato(aziende, preferenze.preferite);
  const filtrate = filtroVuoto(filtro) ? aziende : filtraAziende(aziende, filtro, preferenze.preferite);
  const generali = conversazioni.filter((c) => !c.azienda);
  // Le conversazioni generali si accorciano: le prime otto, poi "Mostra tutte".
  const MAX_CONV = 8;
  let resto = tutteConv ? Infinity : MAX_CONV;
  const gruppi = gruppiRecenti(generali)
    .map((g) => {
      const voci = g.voci.slice(0, Math.max(0, resto));
      resto -= voci.length;
      return { ...g, voci };
    })
    .filter((g) => g.voci.length > 0);
  const riga = (a: AziendaIndice, k: string) => (
    <RigaAzienda
      key={`${k}-${a.id}`}
      a={a}
      attiva={a.id === aziendaAttivaId}
      preferita={preferenze.preferite.includes(a.id)}
      onApri={() => onApriAzienda(a)}
      onPreferita={() => onPreferita(a.id)}
    />
  );

  return (
    <nav
      aria-label="Aziende, conversazioni e temi"
      className={clsx('comando-profondo flex h-full min-h-0 flex-col [--icona-lame:#d4ff3a] [--icona-lame-opacita:0.9]', stretta ? 'w-[76px] items-center' : 'w-full')}
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Marchio */}
      <div className={clsx('flex shrink-0 items-center gap-2 pb-3', stretta ? 'flex-col px-2' : 'px-4')}>
        <Link
          href="/agente"
          onClick={onNuova}
          aria-label="Conflavoro Agente HSE, nuova conversazione"
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/falco-mark.svg')} alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0" style={{ filter: 'brightness(0) invert(0.94)' }} />
          {!stretta && (
            <span className="min-w-0 leading-none">
              <span className="block text-[13px] font-semibold tracking-[0.14em] text-perla-carta">CONFLAVORO</span>
              <span className="mt-1 block text-[13px] font-medium tracking-[0.02em] text-oro-300">Agente HSE</span>
            </span>
          )}
        </Link>
        {mobile ? (
          <button type="button" onClick={onChiudi} aria-label="Chiudi il menu" className="btn-icon h-11 w-11 !text-[#9a9aa2] hover:!bg-white/[0.07] hover:!text-perla-carta shrink-0">
            <X size={18} aria-hidden />
          </button>
        ) : (
          <button type="button" onClick={onRiduci} aria-label={ridotta ? 'Espandi la colonna' : 'Riduci la colonna'} title={ridotta ? 'Espandi' : 'Riduci'} className="btn-icon h-11 w-11 !text-[#9a9aa2] hover:!bg-white/[0.07] hover:!text-perla-carta shrink-0">
            {ridotta ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
          </button>
        )}
      </div>

      {/* Ricerca e nuova conversazione */}
      <div className={clsx('shrink-0 space-y-2 pb-2', stretta ? 'flex flex-col items-center px-2' : 'px-3')}>
        <button
          type="button"
          onClick={onCerca}
          data-origine-ricerca=""
          aria-label={`Cerca azienda, persona, documento (${tasto} + K)`}
          aria-keyshortcuts="Control+K Meta+K"
          title={stretta ? `Cerca (${tasto} + K)` : undefined}
          className={clsx(
            'premi flex min-h-[44px] items-center gap-2 rounded-full bg-white/[0.06] text-left text-[13px] text-[#9a9aa2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.09] hover:text-[#c4c4c9]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
            stretta ? 'w-11 justify-center' : 'w-full px-3'
          )}
        >
          <Search size={16} aria-hidden className="shrink-0 text-oro-300" />
          {!stretta && (
            <>
              <span className="min-w-0 flex-1 truncate">Cerca azienda, persona, documento</span>
              <kbd className="tasto hidden shrink-0 text-[#c4c4c9] lg:inline-flex">{tasto} K</kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onNuova}
          aria-label="Nuova conversazione"
          aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
          title={`Nuova conversazione (${tasto} + Maiusc + O)`}
          className={clsx('premi inline-flex min-h-[44px] items-center gap-2 rounded-full bg-perla-carta text-[13.5px] font-semibold text-brand-900 shadow-[inset_0_-1px_0_rgba(14,14,16,0.12),0_8px_20px_-10px_rgba(0,0,0,0.6)] hover:bg-white', stretta ? 'w-11 justify-center px-0' : 'w-full px-3.5')}
        >
          <Plus size={17} aria-hidden />
          {!stretta && <span>Nuova conversazione</span>}
        </button>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
        {stretta ? (
          <ul className="flex flex-col items-center gap-1 pt-2">
            {preferite.concat(recenti).slice(0, 8).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onApriAzienda(a)}
                  aria-label={`${a.ragione_sociale}, ${a.motivo}`}
                  title={a.ragione_sociale}
                  className={clsx(
                    'relative flex h-11 w-11 items-center justify-center rounded-md border text-[12px] font-semibold',
                    a.id === aziendaAttivaId ? 'border-oro-300/60 bg-white/[0.1] text-perla-carta' : 'border-white/[0.08] bg-white/[0.04] text-[#c4c4c9] hover:bg-white/[0.08]'
                  )}
                >
                  {a.ragione_sociale.slice(0, 2).toUpperCase()}
                  <span aria-hidden className={clsx('absolute right-1 top-1 h-1.5 w-1.5 rounded-full', PALLINO[a.stato])} />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onCerca} aria-label="Tutte le aziende" title="Tutte le aziende" className="btn-icon h-11 w-11 !text-[#9a9aa2] hover:!bg-white/[0.07] hover:!text-perla-carta">
                <Building2 size={17} aria-hidden />
              </button>
            </li>
          </ul>
        ) : (
          <>
            {/* Aziende */}
            <section aria-labelledby="rail-aziende">
              <h2 id="rail-aziende" className="flex items-baseline gap-2 px-2.5 pb-0.5 pt-2">
                <span className="text-[12.5px] font-semibold text-[#9a9aa2]">Aziende</span>
                {aziende.length > 0 && <span className="cifre text-[11px] text-[#6b6b73]">{aziende.length}</span>}
              </h2>
              {aziendeCarica && aziende.length === 0 && <p className="px-2.5 py-2 text-[13px] text-[#9a9aa2]">Carico le aziende</p>}
              {aziendeErrore && <p className="px-2.5 py-2 text-[12.5px] text-warn-mark">{aziendeErrore}</p>}
              {!aziendeCarica && !aziendeErrore && aziende.length === 0 && (
                <p className="px-2.5 py-2 text-[12.5px] leading-snug text-[#6b6b73]">Nessuna azienda. Chiedi a Falco di aggiungerne una partendo dalla visura.</p>
              )}
              {aziende.length > 0 && <FiltriAziende f={filtro} conti={conti} onCambia={cambiaFiltro} trovate={filtrate.length} />}
              {!filtroVuoto(filtro) ? (
                filtrate.length === 0 ? (
                  <div className="px-2.5 py-3 text-[12.5px] leading-snug text-grafite-400">
                    <p>Nessuna azienda con questi filtri.</p>
                    <button type="button" onClick={() => cambiaFiltro(FILTRO_AZIENDE_INIZIALE)} className="mt-2 inline-flex h-9 items-center rounded-full px-3 font-medium text-white shadow-[inset_0_0_0_1px_#34343a] hover:bg-grafite-800">
                      Mostra tutte
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-0.5 pt-1">{filtrate.map((a) => riga(a, 'f'))}</ul>
                )
              ) : (
              <>
              {preferite.length > 0 && (
                <>
                  <Titoletto>Preferite</Titoletto>
                  <ul className="space-y-0.5">{preferite.map((a) => riga(a, 'p'))}</ul>
                </>
              )}
              {recenti.length > 0 && (
                <>
                  <Titoletto>Aperte di recente</Titoletto>
                  <ul className="space-y-0.5">{recenti.map((a) => riga(a, 'r'))}</ul>
                </>
              )}
              {aziende.length > 0 && (preferite.length > 0 || recenti.length > 0) && <Titoletto>Tutte</Titoletto>}
              {lettere.map((g) => (
                <div key={g.l} className="relative">
                  <p aria-hidden className="cifre px-2.5 pb-0.5 pt-2 text-[10.5px] text-oro-300/80">
                    {g.l}
                  </p>
                  <ul className="space-y-0.5" aria-label={`Aziende con la lettera ${g.l}`}>
                    {g.voci.map((a) => riga(a, 't'))}
                  </ul>
                </div>
              ))}
              </>
              )}
            </section>

            {/* Conversazioni generali */}
            <section aria-labelledby="rail-generali" className="mt-5">
              <h2 id="rail-generali" className="px-2.5 pb-0.5 pt-2">
                <span className="text-[12.5px] font-semibold text-[#9a9aa2]">Generali</span>
              </h2>
              {caricamento && conversazioni.length === 0 && <p className="px-2.5 py-2 text-[13px] text-[#9a9aa2]">Carico le conversazioni</p>}
              {errore && (
                <div className="px-2.5 py-2 text-[13px] text-[#9a9aa2]">
                  <p>{errore}</p>
                  <button type="button" onClick={onRiprova} className="btn-ghost mt-2 min-h-[44px]">
                    Riprova
                  </button>
                </div>
              )}
              {!caricamento && !errore && generali.length === 0 && (
                <p className="px-2.5 py-1.5 text-[12.5px] leading-snug text-[#6b6b73]">Qui le conversazioni che non riguardano un’azienda.</p>
              )}
              {gruppi.map((g) => (
                <div key={g.titolo}>
                  <Titoletto>{g.titolo}</Titoletto>
                  <ul className="space-y-0.5">
                    {g.voci.map((c) => {
                      const on = c.id === attivaId;
                      return (
                        <li key={c.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => onApri(c.id)}
                            aria-current={on ? 'true' : undefined}
                            className={clsx(
                              'flex min-h-[44px] lg:min-h-[40px] w-full items-center rounded-md py-1.5 pl-2.5 pr-11 text-left transition-colors',
                              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
                              on ? 'bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]' : 'hover:bg-white/[0.05]'
                            )}
                          >
                            <span className={clsx('line-clamp-1 text-[13.5px] leading-snug', on ? 'font-semibold text-perla-carta' : 'text-[#c4c4c9]')}>{senzaTema(c.titolo)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onElimina(c)}
                            aria-label={`Elimina la conversazione ${senzaTema(c.titolo)}`}
                            title="Elimina"
                            className="absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 lg:h-10 lg:w-10 items-center justify-center rounded-full text-[#6b6b73] hover:bg-danger-mark/15 hover:text-danger-mark focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {generali.length > MAX_CONV && (
                <button type="button" onClick={() => setTutteConv((v) => !v)} className="mx-1 mt-1 inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-medium text-grafite-300 hover:bg-grafite-800 hover:text-white">
                  {tutteConv ? 'Mostra meno' : `Mostra tutte (${generali.length})`}
                </button>
              )}
            </section>

            {/* Temi */}
            <section className="mt-5">
              <h2>
                <button
                  type="button"
                  onClick={cambiaTemi}
                  aria-expanded={temiAperti}
                  className="flex min-h-[44px] lg:min-h-[40px] w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300"
                >
                  <span className="flex-1 text-[12.5px] font-semibold text-[#9a9aa2]">Temi</span>
                  <ChevronDown size={15} aria-hidden className={clsx('text-[#9a9aa2] transition-transform motion-reduce:transition-none', temiAperti && 'rotate-180')} />
                </button>
              </h2>
              {temiAperti && (
                <ul className="space-y-0.5">
                  {AGENTE_TEMI.map((t) => {
                    const Icona = t.icona;
                    const on = temaAttivo === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => onTema(t)}
                          aria-current={on ? 'true' : undefined}
                          className={clsx(
                            'group flex min-h-[44px] lg:min-h-[40px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
                            on ? 'bg-white/[0.08] font-semibold text-perla-carta shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]' : 'text-[#c4c4c9] hover:bg-white/[0.05] hover:text-perla-carta'
                          )}
                        >
                          <Icona size={16} aria-hidden className={clsx('shrink-0', on ? 'text-oro-300' : 'text-[#9a9aa2]')} />
                          <span className="min-w-0 truncate">{t.titolo}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* Utente e studio */}
      <div ref={box} className="relative w-full shrink-0 border-t border-white/[0.07] px-2 py-2">
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={`Menu di ${user.name}`}
          className={clsx(
            'flex min-h-[52px] w-full items-center gap-2.5 rounded-md text-left hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
            stretta ? 'justify-center' : 'px-2'
          )}
        >
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oro-500 text-[12.5px] font-medium text-acido-950">
            {iniziali(user.name)}
          </span>
          {!stretta && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-perla-carta">{user.name}</span>
              <span className="block truncate text-[11.5px] text-[#9a9aa2]">{user.tenant_name || roleLabel(user.role)}</span>
            </span>
          )}
        </button>
        {menu && (
          <div role="menu" className="absolute bottom-full left-2 z-50 mb-1 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-perla-linea bg-perla-carta p-1.5 shadow-luxury-md">
            <div className="px-3 py-2">
              <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[11.5px] text-ink-muted">{user.email}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">{roleLabel(user.role)}</p>
            </div>
            <div className="my-1 border-t border-perla-linea" />
            <Link role="menuitem" href="/gestionale/coda/" className="flex min-h-[44px] items-center gap-2.5 rounded-md px-3 text-[13px] text-ink-soft hover:bg-perla-velo">
              <Elenco size={16} aria-hidden /> Gestionale
            </Link>
            <Link role="menuitem" href="/dashboard" className="flex min-h-[44px] items-center gap-2.5 rounded-md px-3 text-[13px] text-ink-soft hover:bg-perla-velo">
              <FolderOpen size={16} aria-hidden /> Archivio completo
            </Link>
            <Link role="menuitem" href="/impostazioni" className="flex min-h-[44px] items-center gap-2.5 rounded-md px-3 text-[13px] text-ink-soft hover:bg-perla-velo">
              <Settings size={16} aria-hidden /> Impostazioni
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void esci()}
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] text-ink-soft hover:bg-danger-mark/15 hover:text-danger-mark"
            >
              <LogOut size={16} aria-hidden /> Esci
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
