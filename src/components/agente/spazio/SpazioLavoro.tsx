'use client';

import { useEffect, useRef, useState } from 'react';
import { CURVA, caricaMovimento, movimentoRidotto } from '@/lib/movimento';
import { Building2, CalendarClock, ChevronDown, FileText, HardHat, Search, StickyNote, Users, X, type LucideIcon } from '@/components/icone';
import type { AgenteMessaggio, Company, Role } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import type { SchedaSpazio } from '@/lib/agente-temi';
import { clsx } from '@/lib/clsx';
import type { AziendaBreve } from '../AziendaSelettore';
import { PannelloVista, titoloPannello } from '../pannelli/Pannelli';
import { puoScrivere } from '../pannelli/contesto';
import { Caricamento, Errore, Lame, Vuota, errTesto } from './kit';
import { SCHEDE_CONTROL_ROOM } from '../controlroom';
import { SchedaAzienda, SchedaCantieri, SchedaDocumenti, SchedaFormazione, SchedaPersone, type SchedaProps } from './Schede';
import { SchedaDocumentiHse } from './SchedaDocumentiHse';

const CR = (k: SchedaSpazio) => {
  const x = SCHEDE_CONTROL_ROOM.find((c) => c.chiave === k)!;
  return { id: k, titolo: x.breve, icona: x.icona };
};

/** Prima la regia della sicurezza (score, scadenze), poi i dati e i documenti. */
const SCHEDE: Array<{ id: SchedaSpazio; titolo: string; icona: LucideIcon }> = [
  CR('control_room'),
  CR('scadenzario'),
  { id: 'documenti_hse', titolo: 'Documenti', icona: FileText },
  { id: 'azienda', titolo: 'Azienda', icona: Building2 },
  { id: 'persone', titolo: 'Persone', icona: Users },
  { id: 'formazione', titolo: 'Formazione', icona: CalendarClock },
  CR('fascicolo'),
  { id: 'documenti', titolo: 'Archivio', icona: StickyNote },
  { id: 'cantieri', titolo: 'Cantieri', icona: HardHat },
  CR('report'),
  CR('passaporto'),
  CR('pronto_controllo'),
];

/**
 * Spazio di lavoro laterale: il gestionale tradotto dall'agente. In testa i
 * pannelli dell'ultima risposta ("Appena preparato"), sotto le schede fisse
 * dell'azienda della conversazione, lette dalle API e modificabili a mano.
 */
export function SpazioLavoro({
  azienda,
  fissata,
  onScegliAzienda,
  scheda,
  onScheda,
  conPannelli,
  mostrato,
  onMostra,
  versione,
  ruolo,
  occupato,
  chiedi,
  nomeAgente,
  onChiudi,
}: {
  azienda: AziendaBreve | null;
  fissata: boolean;
  onScegliAzienda: (a: AziendaBreve) => void;
  scheda: SchedaSpazio;
  onScheda: (s: SchedaSpazio) => void;
  conPannelli: AgenteMessaggio[];
  mostrato: AgenteMessaggio | null;
  onMostra: (id: number | null) => void;
  versione: number;
  ruolo: Role | null;
  occupato: boolean;
  chiedi: (t: string) => void;
  nomeAgente: string;
  /** Solo su mobile: chiude il foglio. */
  onChiudi?: () => void;
}) {
  const [preparatoAperto, setPreparatoAperto] = useState(true);
  const ultimoId = conPannelli[conPannelli.length - 1]?.id ?? null;
  const preparato = useRef<HTMLDivElement>(null);
  // I pannelli nuovi entrano con una fisica morbida: salgono, si posano, uno dopo l'altro.
  useEffect(() => {
    const el = preparato.current;
    if (!el || !mostrato || movimentoRidotto()) return;
    let vivo = true;
    void caricaMovimento()
      .then(({ gsap }) => {
        const pannelli = el.querySelectorAll('[data-pannello]');
        if (!vivo || pannelli.length === 0) return;
        gsap.fromTo(
          pannelli,
          { opacity: 0, y: 28, scale: 0.97, rotateX: -6, transformOrigin: '50% 0%' },
          { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.9, stagger: 0.08, ease: CURVA, clearProps: 'transform' }
        );
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [mostrato?.id, preparatoAperto]); // eslint-disable-line react-hooks/exhaustive-deps
  // La scheda scelta resta in vista nella fila delle schede, anche su telefono.
  useEffect(() => {
    if (!azienda) return;
    document.getElementById(`tab-${scheda}`)?.scrollIntoView({ block: 'nearest', inline: 'start' });
  }, [scheda, azienda]);
  // Una risposta nuova con pannelli riapre il blocco in testa.
  useEffect(() => {
    if (ultimoId != null) setPreparatoAperto(true);
  }, [ultimoId]);

  const props: SchedaProps | null = azienda
    ? { aziendaId: azienda.id, versione, scrivibile: puoScrivere(ruolo), chiedi, occupato, nomeAzienda: azienda.ragione_sociale }
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start gap-2 px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-ink-subtle">Il tavolo</p>
          <h2 className="mt-0.5 truncate text-[22px] font-medium leading-tight tracking-[-0.025em] text-brand-900">
            {azienda ? azienda.ragione_sociale : 'Nessuna azienda aperta'}
          </h2>
        </div>
        {onChiudi && (
          <button type="button" onClick={onChiudi} aria-label="Chiudi il tavolo" className="btn-icon -mr-2 h-11 w-11 shrink-0">
            <X size={18} aria-hidden />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* Appena preparato */}
        {mostrato && (
          <section aria-labelledby="sp-preparato" className="mx-3 mb-3 rounded-[1.25rem] bg-perla-carta shadow-[0_0_0_1px_rgba(103,127,2,0.35),0_18px_40px_-24px_rgba(103,127,2,0.45)]">
            <div className="flex items-center gap-2 px-3">
              <button
                type="button"
                onClick={() => setPreparatoAperto((v) => !v)}
                aria-expanded={preparatoAperto}
                className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <Lame />
                <span id="sp-preparato" className="shrink-0 whitespace-nowrap text-[13.5px] font-semibold text-brand-900">
                  {mostrato.id === ultimoId ? 'Appena preparato' : 'Preparato prima'}
                </span>
                <span className="min-w-0 truncate text-[12px] text-ink-muted">{mostrato.pannelli.map(titoloPannello).join(', ')}</span>
                <ChevronDown size={15} aria-hidden className={clsx('ml-auto shrink-0 text-ink-muted transition-transform motion-reduce:transition-none', preparatoAperto && 'rotate-180')} />
              </button>
            </div>
            {preparatoAperto && (
              <div ref={preparato} className="border-t border-oro-100 px-3 pb-3 pt-3 [perspective:900px]">
                {conPannelli.length > 1 && (
                  <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Pannelli delle risposte precedenti">
                    {conPannelli.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onMostra(m.id === ultimoId ? null : m.id)}
                        aria-pressed={mostrato.id === m.id}
                        className={clsx(
                          'premi min-h-[44px] shrink-0 rounded-full px-2.5 text-[12px] sm:min-h-[36px]',
                          mostrato.id === m.id ? 'comando font-semibold' : 'bg-perla-superficie text-ink-muted shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)] hover:text-ink'
                        )}
                      >
                        {i + 1}. {titoloPannello(m.pannelli[0])}
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  {mostrato.pannelli.map((p, i) => (
                    <PannelloVista key={`${mostrato.id}-${p.chiave}-${i}`} p={p} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {azienda && props ? (
          <>
            {/* Schede fisse */}
            <div className="vetro sticky top-0 z-10 px-3 pb-2 pt-1">
              <div role="tablist" aria-label="Schede dell'azienda" className="flex snap-x gap-1 overflow-x-auto rounded-[0.875rem] bg-[rgba(14,14,16,0.05)] p-1 [scrollbar-width:none]">
                {SCHEDE.map((s) => {
                  const on = s.id === scheda;
                  const Icona = s.icona;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      id={`tab-${s.id}`}
                      aria-selected={on}
                      aria-controls="sp-scheda"
                      onClick={() => onScheda(s.id)}
                      className={clsx(
                        'premi relative flex min-h-[44px] shrink-0 lg:min-h-[40px] snap-start items-center gap-1.5 rounded-full px-3 text-[13px] [--icona-lame:#677f02] [--icona-lame-opacita:1]',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                        on ? 'bg-perla-carta font-semibold text-brand-900 shadow-[0_1px_2px_rgba(14,14,16,0.1),0_0_0_1px_rgba(14,14,16,0.06)]' : 'text-ink-muted hover:text-ink'
                      )}
                    >
                      <Icona size={15} aria-hidden />
                      {s.titolo}
                    </button>
                  );
                })}
              </div>
            </div>
            <div id="sp-scheda" role="tabpanel" aria-labelledby={`tab-${scheda}`} className="px-5 pb-8">
              {scheda === 'azienda' && <SchedaAzienda key={`a-${azienda.id}`} {...props} />}
              {scheda === 'persone' && <SchedaPersone key={`p-${azienda.id}`} {...props} />}
              {scheda === 'formazione' && <SchedaFormazione key={`f-${azienda.id}`} {...props} />}
              {scheda === 'documenti' && <SchedaDocumenti key={`d-${azienda.id}`} {...props} />}
              {scheda === 'documenti_hse' && <SchedaDocumentiHse key={`h-${azienda.id}`} {...props} />}
              {scheda === 'cantieri' && <SchedaCantieri key={`c-${azienda.id}`} {...props} />}
              {SCHEDE_CONTROL_ROOM.filter((c) => c.chiave === scheda).map((c) => (
                <c.Componente key={`${c.chiave}-${azienda.id}`} aziendaId={azienda.id} ruolo={ruolo} versione={versione} chiedi={chiedi} occupato={occupato} nomeAgente={nomeAgente} />
              ))}
            </div>
          </>
        ) : (
          <SceltaAzienda fissata={fissata} onScegli={onScegliAzienda} nomeAgente={nomeAgente} />
        )}
      </div>
    </div>
  );
}

function SceltaAzienda({ fissata, onScegli, nomeAgente }: { fissata: boolean; onScegli: (a: AziendaBreve) => void; nomeAgente: string }) {
  const ds = useDataSource();
  const [aziende, setAziende] = useState<Company[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErrore(null);
    ds.companies
      .list()
      .then((l) => vivo && setAziende(l))
      .catch((e: unknown) => vivo && setErrore(errTesto(e, 'Elenco aziende non disponibile.')));
    return () => {
      vivo = false;
    };
  }, [ds, giro]);

  const f = q.trim().toLowerCase();
  const visibili = (aziende ?? []).filter((a) => !f || a.ragione_sociale.toLowerCase().includes(f) || (a.ateco ?? '').includes(f));

  return (
    <div className="px-5 pb-8">
      <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-ink-muted">
        {fissata
          ? `Questa conversazione non riguarda un'azienda. Sceglierne una apre una nuova conversazione con ${nomeAgente}.`
          : `Scegli l'azienda: qui trovi i suoi dati, le persone, le scadenze e i documenti, e ${nomeAgente} lavora su quella.`}
      </p>
      {(aziende?.length ?? 0) > 5 && (
        <label className="mt-4 flex h-11 items-center gap-2 rounded-md border border-[#e2e2e5] bg-perla-carta px-3">
          <Search size={15} aria-hidden className="text-ink-subtle" />
          <span className="sr-only">Cerca azienda</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome o ATECO" className="h-full w-full bg-transparent text-base outline-none sm:text-[13.5px]" />
        </label>
      )}
      <div className="mt-3">
        {errore ? (
          <Errore testo={errore} onRiprova={() => setGiro((g) => g + 1)} />
        ) : !aziende ? (
          <Caricamento testo="Carico le aziende" />
        ) : aziende.length === 0 ? (
          <Vuota>Non ci sono ancora aziende. Chiedi a {nomeAgente} di aggiungerne una partendo da una visura.</Vuota>
        ) : (
          <ul className="divide-y divide-perla-linea border-y border-perla-linea">
            {visibili.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onScegli({ id: a.id, ragione_sociale: a.ragione_sociale })}
                  className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left hover:bg-perla-velo/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-perla-velo text-[12px] font-medium text-ink">
                    {a.ragione_sociale.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{a.ragione_sociale}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">
                      {[a.ateco && `ATECO ${a.ateco}`, `${a.lavoratori} lavoratori`].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
