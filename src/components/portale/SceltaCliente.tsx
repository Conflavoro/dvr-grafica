'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Azienda, Cerca, Chiudi, Giu, Segnalibro, Spunta } from '@/components/icone';
import { conPreferita, leggiPreferenze, salvaPreferenze, type AziendaIndice, type PreferenzeAziende } from '@/lib/agente-aziende';
import { elencoSelettore } from '@/lib/portale/scelta-azienda';
import { clsx } from '@/lib/clsx';

/**
 * Scelta del cliente nel gestionale: il selettore in cima al menu (popup sul computer,
 * foglio dal basso sul telefono) e la stessa lista al centro delle schermate per
 * azienda quando nessun cliente e' scelto. Preferite e recenti in alto, ricerca
 * tollerante; la stella si mette e si toglie anche da qui.
 */

const PUNTO: Record<AziendaIndice['stato'], string> = {
  scaduto: 'bg-stato-danger-segno',
  aggiornare: 'bg-stato-warn-segno',
  ok: 'bg-stato-ok-segno',
};

export function iniziali(nome: string): string {
  return (
    nome
      .replace(/\b(s\.?r\.?l\.?s?|s\.?n\.?c\.?|s\.?a\.?s\.?|s\.?p\.?a\.?)\b/gi, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'A'
  );
}

export function ElencoClienti({
  userId,
  clienti,
  sceltaId,
  onScegli,
  autoFocus = false,
  conTutte = false,
  compatto = false,
}: {
  userId: number;
  clienti: AziendaIndice[] | null;
  sceltaId: number | null;
  onScegli: (id: number | null) => void;
  autoFocus?: boolean;
  /** Voce "Tutte le aziende" (toglie la scelta). */
  conTutte?: boolean;
  compatto?: boolean;
}) {
  const [testo, setTesto] = useState('');
  const [pref, setPref] = useState<PreferenzeAziende>({ preferite: [], recenti: [] });
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => setPref(leggiPreferenze(userId)), [userId]);
  useEffect(() => {
    if (autoFocus) campo.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const elenco = useMemo(() => elencoSelettore(clienti ?? [], pref, testo), [clienti, pref, testo]);

  const stella = (id: number) => {
    const p = conPreferita(pref, id);
    setPref(p);
    salvaPreferenze(userId, p);
  };

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Cerca un cliente</span>
        <Cerca size={17} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-grafite-400" />
        <input
          ref={campo}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Nome, partita IVA, comune o ATECO"
          className="h-12 w-full rounded-full bg-perla-velo pl-11 pr-4 text-base text-ink outline-none placeholder:text-ink-muted focus:bg-white focus:shadow-[inset_0_0_0_2px_#111113] sm:text-[14.5px]"
        />
      </label>
      {clienti === null ? (
        <p className="py-6 text-[14px] text-ink-muted" role="status">
          Carico i clienti
        </p>
      ) : (
        <div className={clsx('mt-3', compatto && 'max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain')}>
          {conTutte && !testo.trim() && (
            <button
              type="button"
              onClick={() => onScegli(null)}
              aria-current={sceltaId === null ? 'true' : undefined}
              className={clsx('flex min-h-[48px] w-full items-center gap-3 rounded-[0.875rem] px-2.5 text-left text-[14.5px]', sceltaId === null ? 'bg-perla-velo font-medium text-ink' : 'text-ink-soft hover:bg-perla-velo/70')}
            >
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.75rem] bg-grafite-900 text-white">
                <Azienda size={16} />
              </span>
              <span className="min-w-0 flex-1">Tutte le aziende</span>
              {sceltaId === null && <Spunta size={16} aria-hidden />}
            </button>
          )}
          {elenco.gruppi.length === 0 && <p className="py-5 text-[14px] text-ink-muted">{clienti.length === 0 ? 'Nessuna azienda cliente ancora.' : 'Nessun cliente trovato. Prova con un’altra parola.'}</p>}
          {elenco.gruppi.map((g, i) => (
            <section key={`${g.titolo ?? 'tutte'}-${i}`} className={i > 0 || conTutte ? 'mt-2' : ''}>
              {g.titolo && <h3 className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">{g.titolo}</h3>}
              <ul>
                {g.voci.map((a) => {
                  const scelta = a.id === sceltaId;
                  const pref1 = pref.preferite.includes(a.id);
                  return (
                    <li key={a.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onScegli(a.id)}
                        aria-current={scelta ? 'true' : undefined}
                        className={clsx('flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[0.875rem] px-2.5 py-1.5 text-left', scelta ? 'bg-perla-velo' : 'hover:bg-perla-velo/70')}
                      >
                        <span aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.75rem] bg-grafite-100 text-[12px] font-medium text-ink">
                          {iniziali(a.ragione_sociale)}
                          <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_#fff]', PUNTO[a.stato])} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={clsx('block truncate text-[14.5px] leading-snug text-ink', scelta && 'font-medium')}>{a.ragione_sociale}</span>
                          <span className="block truncate text-[12.5px] text-ink-muted">{[a.comune, a.motivo].filter(Boolean).join(' · ')}</span>
                        </span>
                        {scelta && <Spunta size={16} aria-hidden className="shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => stella(a.id)}
                        aria-pressed={pref1}
                        aria-label={pref1 ? `Togli ${a.ragione_sociale} dalle preferite` : `Aggiungi ${a.ragione_sociale} alle preferite`}
                        className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-perla-velo', pref1 ? 'text-ink' : 'text-grafite-300')}
                      >
                        <Segnalibro size={17} aria-hidden fill={pref1 ? 'currentColor' : 'none'} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pulsante in cima al menu nero: azienda scelta con il suo stato, oppure "Tutte le aziende". */
export function SelettoreCliente({
  userId,
  clienti,
  scelta,
  onScegli,
  largo,
}: {
  userId: number;
  clienti: AziendaIndice[] | null;
  scelta: AziendaIndice | null;
  onScegli: (id: number | null) => void;
  largo: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAperto(false);
    const fuori = (e: MouseEvent) => largo && box.current && !box.current.contains(e.target as Node) && setAperto(false);
    document.addEventListener('keydown', esc);
    document.addEventListener('mousedown', fuori);
    return () => {
      document.removeEventListener('keydown', esc);
      document.removeEventListener('mousedown', fuori);
    };
  }, [aperto, largo]);

  // Apertura chiesta da una schermata (es. "Cambia cliente").
  useEffect(() => {
    const f = () => setAperto(true);
    document.addEventListener('portale-scegli-cliente', f);
    return () => document.removeEventListener('portale-scegli-cliente', f);
  }, []);

  const scegli = (id: number | null) => {
    setAperto(false);
    onScegli(id);
  };

  const elenco = <ElencoClienti userId={userId} clienti={clienti} sceltaId={scelta?.id ?? null} onScegli={scegli} autoFocus={largo} conTutte compatto={largo} />;

  return (
    <div ref={box} className="relative">
      {largo ? (
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          aria-expanded={aperto}
          aria-haspopup="dialog"
          className="flex min-h-[56px] w-full items-center gap-3 rounded-[1rem] px-2 py-2 text-left hover:bg-grafite-800"
        >
          <span aria-hidden className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[0.75rem] bg-grafite-800 text-[13px] font-medium">
            {scelta ? iniziali(scelta.ragione_sociale) : <Azienda size={17} />}
            {scelta && <span className={clsx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full shadow-[0_0_0_2px_#000]', PUNTO[scelta.stato])} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium tracking-[0.08em] text-grafite-500">CLIENTE</span>
            <span className="block truncate text-[14.5px] font-medium">{scelta?.ragione_sociale ?? 'Tutte le aziende'}</span>
            <span className="block truncate text-[12px] text-grafite-400">{scelta ? scelta.motivo || 'In regola' : 'Scegli un cliente'}</span>
          </span>
          <Giu size={16} aria-hidden className="shrink-0 text-grafite-400" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAperto(true)}
          aria-haspopup="dialog"
          aria-label={scelta ? `Cliente: ${scelta.ragione_sociale}. Cambia cliente` : 'Scegli il cliente'}
          className="flex h-11 min-w-0 max-w-[11rem] items-center gap-2 rounded-full bg-grafite-900 py-1 pl-1 pr-3 text-white"
        >
          <span aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grafite-800 text-[12px] font-medium">
            {scelta ? iniziali(scelta.ragione_sociale) : <Azienda size={15} />}
            {scelta && <span className={clsx('absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_#0e0e10]', PUNTO[scelta.stato])} />}
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium">{scelta?.ragione_sociale ?? 'Cliente'}</span>
        </button>
      )}

      {largo && aperto && (
        <div role="dialog" aria-label="Scegli il cliente" className="absolute left-0 top-full z-40 mt-1 w-[24rem] rounded-[1.5rem] bg-white p-3 text-ink shadow-[0_24px_48px_-18px_rgba(14,14,16,0.45)]">
          {elenco}
        </div>
      )}
      {!largo && (
        <>
          <div aria-hidden className={clsx('fixed inset-0 z-[60] bg-black/45 transition-opacity', aperto ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setAperto(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Scegli il cliente"
            aria-hidden={!aperto}
            className={clsx(
              'fixed inset-x-0 bottom-0 z-[61] flex max-h-[88dvh] flex-col rounded-t-[2.25rem] bg-white text-ink transition-transform duration-[380ms]',
              aperto ? 'translate-y-0' : 'pointer-events-none translate-y-[105%]'
            )}
          >
            <header className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-5">
              <h2 className="min-w-0 flex-1 text-[20px] font-medium tracking-[-0.015em]">Scegli il cliente</h2>
              <button type="button" onClick={() => setAperto(false)} aria-label="Chiudi" className="btn-icon">
                <Chiudi size={18} aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
              {aperto && elenco}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Al centro delle schermate per azienda quando nessun cliente e' scelto: un tocco e si entra. */
export function ScegliIlCliente({
  userId,
  clienti,
  onScegli,
  titoloSezione,
  extra,
}: {
  userId: number;
  clienti: AziendaIndice[] | null;
  onScegli: (id: number) => void;
  titoloSezione: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[14px] text-ink-muted">{titoloSezione}</p>
        <h1 className="mt-1 text-[28px] font-medium leading-tight tracking-[-0.03em] text-ink sm:text-[34px]">Scegli il cliente</h1>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted">Questa schermata lavora su un’azienda alla volta. La scelta resta anche nelle altre sezioni finché non la cambi dal menu.</p>
      </div>
      {extra}
      <div className="rounded-[1.75rem] bg-white p-3 shadow-[inset_0_0_0_1px_#e2e2e5] sm:p-4">
        <ElencoClienti userId={userId} clienti={clienti} sceltaId={null} onScegli={(id) => id && onScegli(id)} />
      </div>
    </div>
  );
}

/** Filtro attivo nelle schermate di studio: "Solo <azienda>", con il tasto per toglierlo. */
export function FiltroSoloCliente({ nome, attivo, onCambia }: { nome: string; attivo: boolean; onCambia: (v: boolean) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] bg-perla-velo px-4 py-2.5 text-[14px]">
      {attivo ? (
        <>
          <span className="min-w-0 flex-1 text-ink">
            Solo <span className="font-medium">{nome}</span>
          </span>
          <button type="button" onClick={() => onCambia(false)} className="btn-ghost min-h-[44px] px-4 text-[13.5px]">
            Mostra tutto lo studio
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-ink-muted">Tutto lo studio</span>
          <button type="button" onClick={() => onCambia(true)} className="btn-ghost min-h-[44px] px-4 text-[13.5px]">
            Solo {nome}
          </button>
        </>
      )}
    </div>
  );
}

/** Chiede al selettore del menu di aprirsi (es. dal tasto "Cambia cliente" di una schermata). */
export function apriSceltaCliente(): void {
  try {
    document.dispatchEvent(new Event('portale-scegli-cliente'));
  } catch {
    /* nessun selettore montato */
  }
}
