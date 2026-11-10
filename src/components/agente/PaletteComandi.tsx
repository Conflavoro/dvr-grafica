'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CURVA, movimentoPronto, movimentoRidotto } from '@/lib/movimento';
import { Building2, CalendarClock, FileText, MessagesSquare, Plus, Search, UserRound, type LucideIcon } from '@/components/icone';
import type { AgenteConversazione } from '@/lib/data-source';
import { cerca } from '@/lib/agente-ricerca';
import { AGENTE_TEMI, senzaTema, type AgenteTema } from '@/lib/agente-temi';
import type { AziendaIndice } from '@/lib/agente-aziende';
import { clsx } from '@/lib/clsx';

export interface PersonaIndice {
  id: number;
  nome: string;
  mansione: string;
  aziendaId: number;
}
export interface DocumentoIndice {
  chiave: string;
  titolo: string;
  tipo: string;
  aziendaId: number;
}

type Voce = {
  id: string;
  gruppo: string;
  icona: LucideIcon;
  titolo: string;
  sotto?: string;
  stato?: AziendaIndice['stato'];
  esegui: () => void;
};

const PALLINO: Record<AziendaIndice['stato'], string> = { scaduto: 'bg-danger-mark', aggiornare: 'bg-oro-500', ok: 'bg-brand-200' };

/**
 * Palette dei comandi (Ctrl o Cmd + K): cerca mentre scrivi tra aziende,
 * persone, documenti e conversazioni, piu' le azioni rapide. Frecce per
 * muoversi, Invio per aprire, Esc per chiudere.
 */
export function PaletteComandi({
  aperta,
  onChiudi,
  aziende,
  preferite,
  recenti,
  persone,
  documenti,
  conversazioni,
  isDatore,
  onApriAzienda,
  onApriConversazione,
  onNuovaConversazione,
  onNuovaAzienda,
  onScadenzeSettimana,
  onTema,
}: {
  aperta: boolean;
  onChiudi: () => void;
  aziende: AziendaIndice[];
  preferite: number[];
  recenti: number[];
  persone: PersonaIndice[] | null;
  documenti: DocumentoIndice[] | null;
  conversazioni: AgenteConversazione[];
  isDatore: boolean;
  onApriAzienda: (a: AziendaIndice, scheda?: 'persone' | 'documenti') => void;
  onApriConversazione: (id: number) => void;
  onNuovaConversazione: () => void;
  onNuovaAzienda: () => void;
  onScadenzeSettimana: () => void;
  onTema: (t: AgenteTema) => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const finestra = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);

  // La palette esplode dal campo di ricerca (o dal centro se aperta con la tastiera).
  useLayoutEffect(() => {
    if (!aperta) return;
    const m = movimentoPronto();
    const el = finestra.current;
    if (!m || !el || movimentoRidotto()) return;
    const att = document.activeElement as HTMLElement | null;
    const da = att?.closest('[data-origine-ricerca]') ?? document.querySelector('[data-origine-ricerca]');
    const r = el.getBoundingClientRect();
    const o = da && (da as HTMLElement).offsetParent !== null ? da.getBoundingClientRect() : null;
    const { gsap } = m;
    if (velo.current) gsap.fromTo(velo.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    if (o && r.width > 0) {
      gsap.fromTo(
        el,
        { x: o.left - r.left, y: o.top - r.top, scaleX: o.width / r.width, scaleY: o.height / r.height, transformOrigin: '0 0', opacity: 0.6 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.55, ease: CURVA, clearProps: 'transform' }
      );
    } else {
      gsap.fromTo(el, { scale: 0.96, y: -8, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: CURVA, clearProps: 'transform' });
    }
    const righe = el.querySelectorAll('[role="option"]');
    gsap.fromTo(righe, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.02, delay: 0.12, ease: CURVA, clearProps: 'transform' });
  }, [aperta]);
  const idBase = useId();

  useEffect(() => {
    if (aperta) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [aperta]);

  const perId = useMemo(() => new Map(aziende.map((a) => [a.id, a])), [aziende]);

  const voci: Voce[] = useMemo(() => {
    const azienda = (a: AziendaIndice): Voce => ({
      id: `a${a.id}`,
      gruppo: 'Aziende',
      icona: Building2,
      titolo: a.ragione_sociale,
      sotto: [a.ateco && `ATECO ${a.ateco}`, a.comune, `${a.lavoratori} lavoratori`, a.motivo].filter(Boolean).join(', '),
      stato: a.stato,
      esegui: () => onApriAzienda(a),
    });
    const azioni: Voce[] = [
      { id: 'x-nuova', gruppo: 'Azioni', icona: Plus, titolo: 'Nuova conversazione', esegui: onNuovaConversazione },
      ...(isDatore ? [] : [{ id: 'x-azienda', gruppo: 'Azioni', icona: Building2, titolo: 'Nuova azienda', sotto: 'Falco ti chiede i dati o parte dalla visura', esegui: onNuovaAzienda }]),
      { id: 'x-scad', gruppo: 'Azioni', icona: CalendarClock, titolo: 'Scadenze della settimana', esegui: onScadenzeSettimana },
    ];
    const temi: Voce[] = AGENTE_TEMI.map((t) => ({ id: `t-${t.id}`, gruppo: 'Temi', icona: t.icona, titolo: `Apri tema ${t.titolo}`, sotto: t.descrizione, esegui: () => onTema(t) }));

    const s = q.trim();
    if (!s) {
      const vicine = [...preferite, ...recenti.filter((id) => !preferite.includes(id))]
        .map((id) => perId.get(id))
        .filter((a): a is AziendaIndice => !!a)
        .slice(0, 6)
        .map((a) => ({ ...azienda(a), gruppo: 'Preferite e recenti' }));
      const prime = vicine.length ? [] : aziende.slice(0, 6).map(azienda);
      return [...vicine, ...prime, ...azioni];
    }
    const az = cerca(s, aziende, (a) => [a.ragione_sociale, a.partita_iva, a.ateco, a.comune, a.ateco_label], 8).map(azienda);
    const pe = cerca(s, persone ?? [], (p) => [p.nome, p.mansione], 6).map(
      (p): Voce => ({
        id: `p${p.id}`,
        gruppo: 'Persone',
        icona: UserRound,
        titolo: p.nome,
        sotto: [p.mansione, perId.get(p.aziendaId)?.ragione_sociale].filter(Boolean).join(', '),
        esegui: () => {
          const a = perId.get(p.aziendaId);
          if (a) onApriAzienda(a, 'persone');
        },
      })
    );
    const doc = cerca(s, documenti ?? [], (d) => [d.titolo, d.tipo], 6).map(
      (d): Voce => ({
        id: `d${d.chiave}`,
        gruppo: 'Documenti',
        icona: FileText,
        titolo: d.titolo,
        sotto: [d.tipo, perId.get(d.aziendaId)?.ragione_sociale].filter(Boolean).join(', '),
        esegui: () => {
          const a = perId.get(d.aziendaId);
          if (a) onApriAzienda(a, 'documenti');
        },
      })
    );
    const conv = cerca(s, conversazioni, (c) => [senzaTema(c.titolo), c.azienda?.ragione_sociale], 5).map(
      (c): Voce => ({
        id: `c${c.id}`,
        gruppo: 'Conversazioni',
        icona: MessagesSquare,
        titolo: senzaTema(c.titolo),
        sotto: c.azienda?.ragione_sociale ?? 'Generale',
        esegui: () => onApriConversazione(c.id),
      })
    );
    const az2 = cerca(s, [...azioni, ...temi], (v) => [v.titolo, v.sotto], 4);
    return [...az, ...pe, ...doc, ...conv, ...az2];
  }, [q, aziende, persone, documenti, conversazioni, preferite, recenti, perId, isDatore, onApriAzienda, onApriConversazione, onNuovaConversazione, onNuovaAzienda, onScadenzeSettimana, onTema]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!aperta) return null;

  const esegui = (v: Voce | undefined) => {
    if (!v) return;
    onChiudi();
    v.esegui();
  };

  const onTasto = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((x) => Math.min(voci.length - 1, x + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((x) => Math.max(0, x - 1));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      esegui(voci[sel]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onChiudi();
    } else if (e.key === 'Home' && e.ctrlKey) {
      setSel(0);
    }
  };

  // Raggruppo mantenendo l'ordine (e quindi l'indice per la tastiera).
  const gruppi: Array<{ nome: string; voci: Array<{ v: Voce; i: number }> }> = [];
  voci.forEach((v, i) => {
    const g = gruppi[gruppi.length - 1];
    if (g && g.nome === v.gruppo) g.voci.push({ v, i });
    else gruppi.push({ nome: v.gruppo, voci: [{ v, i }] });
  });
  const attiva = voci[sel];
  const vuoto: ReactNode =
    q.trim() && voci.length === 0 ? (
      <p className="px-4 py-6 text-center text-[13.5px] text-ink-muted">
        Nessun risultato per <span className="font-semibold text-ink">{q.trim()}</span>. Prova con la partita IVA, il comune o il nome di un lavoratore.
      </p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-start sm:px-3 sm:pt-[12vh]">
      <div ref={velo} className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]" onClick={onChiudi} aria-hidden />
      <div
        ref={finestra}
        role="dialog"
        aria-modal="true"
        aria-label="Cerca e comandi"
        className="relative flex h-full w-full flex-col overflow-hidden bg-perla-carta sm:h-auto sm:max-h-[min(38rem,80dvh)] sm:max-w-[42rem] sm:rounded-[1.25rem] sm:shadow-[0_0_0_1px_rgba(14,14,16,0.08),0_40px_100px_-30px_rgba(14,14,16,0.55)] [--icona-lame:#677f02] [--icona-lame-opacita:1]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center gap-3 border-b border-perla-linea px-4 sm:px-5">
          <Search size={18} aria-hidden className="shrink-0 text-brand-700" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onTasto}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${idBase}-lista`}
            aria-activedescendant={attiva ? `${idBase}-${sel}` : undefined}
            aria-autocomplete="list"
            aria-label="Cerca azienda, persona, documento o comando"
            placeholder="Cerca azienda, persona, documento"
            className="h-[60px] min-w-0 flex-1 bg-transparent text-[17px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-subtle focus-visible:shadow-none"
          />
          <button type="button" onClick={onChiudi} className="tasto tasto-chiaro min-h-[44px] min-w-[44px] shrink-0 hover:text-ink sm:min-h-[28px] sm:min-w-0">
            <span className="sm:hidden">Chiudi</span>
            <span className="hidden sm:inline">Esc</span>
          </button>
        </div>
        <div ref={lista} id={`${idBase}-lista`} role="listbox" aria-label="Risultati" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
          {vuoto}
          {gruppi.map((g) => (
            <div key={g.nome} role="group" aria-label={g.nome} className="pb-1">
              <p className="px-5 pb-1 pt-2.5 text-[11.5px] font-semibold tracking-[0.01em] text-ink-subtle">{g.nome}</p>
              {g.voci.map(({ v, i }) => {
                const Icona = v.icona;
                const on = i === sel;
                return (
                  <div
                    key={v.id}
                    id={`${idBase}-${i}`}
                    role="option"
                    aria-selected={on}
                    data-indice={i}
                    onMouseMove={() => setSel(i)}
                    onClick={() => esegui(v)}
                    className={clsx('mx-2 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 py-1.5 transition-colors duration-150', on ? 'comando' : '')}
                  >
                    <span aria-hidden className={clsx('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.875rem]', on ? 'bg-white/[0.1] text-oro-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'bg-gradient-to-b from-perla-carta to-perla-velo text-brand-800 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]')}>
                      <Icona size={15} />
                      {v.stato && <span className={clsx('absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-perla-carta', PALLINO[v.stato])} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block truncate text-[14.5px] font-semibold', on ? 'text-white' : 'text-ink')}>{v.titolo}</span>
                      {v.sotto && <span className={clsx('block truncate text-[12px]', on ? 'text-[#c4c4c9]' : 'text-ink-muted')}>{v.sotto}</span>}
                    </span>
                    {on && <span className="tasto hidden shrink-0 text-[#e2e2e5] sm:inline-flex">Invio</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {persone === null && q.trim() && <p className="px-4 pb-2 text-[12px] text-ink-subtle">Carico persone e documenti</p>}
        </div>
        <p className="hidden items-center gap-3 border-t border-perla-linea px-5 py-2.5 text-[11.5px] text-ink-subtle sm:flex">
          <span className="tasto tasto-chiaro">Su</span>
          <span className="tasto tasto-chiaro">Giu</span> per muoverti
          <span className="tasto tasto-chiaro">Invio</span> per aprire
          <span className="tasto tasto-chiaro">Esc</span> per chiudere
        </p>
      </div>
    </div>
  );
}
