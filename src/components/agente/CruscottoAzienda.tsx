'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarClock, FileSignature, GraduationCap, Stethoscope, Wallet } from '@/components/icone';
import type { LucideIcon } from '@/components/icone';
import { daFareAzienda, isApiMode, type DaFareAzienda, type VoceDaFareAzienda } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';

/**
 * Home dell'azienda come nel Portale HSE: il riquadro acido "Da fare adesso",
 * Pronto Ispezioni sul nero e i quattro riquadri (scadenze, formazione,
 * visite, fascicolo). I numeri vengono dal backend (Portale DaFare), mai dal
 * modello. Ogni pulsante chiede al falco di occuparsene: l'agente rispetta
 * ruoli e conferme, il pulsante non fa nulla da solo.
 */

export const TIPO_DA_FARE: Record<VoceDaFareAzienda['tipo'], { icona: LucideIcon; pastiglia: string; etichetta: string; chiedi: (t: string, nome: string) => string }> = {
  quota_da_pagare: { icona: Wallet, pastiglia: 'bg-cat-pagamenti text-cat-pagamenti-ink', etichetta: 'Come pagare', chiedi: (t) => `${t}: come si paga e cosa sblocca?` },
  firma: { icona: FileSignature, pastiglia: 'bg-cat-documenti text-cat-documenti-ink', etichetta: 'Apri', chiedi: (_t, n) => `Apri il DVR in revisione di ${n}` },
  da_prenotare: { icona: Stethoscope, pastiglia: 'bg-cat-visite text-cat-visite-ink', etichetta: 'Prenota', chiedi: (t) => `Prenota: ${t}` },
  regolarizzazione: { icona: GraduationCap, pastiglia: 'bg-cat-formazione text-cat-formazione-ink', etichetta: 'Regolarizza', chiedi: (t) => `${t}. Cosa serve per regolarizzare?` },
  altro: { icona: CalendarClock, pastiglia: 'bg-cat-scadenze text-cat-scadenze-ink', etichetta: 'Chiedi', chiedi: (t) => t },
};

export const DEMO_DA_FARE: DaFareAzienda = {
  voci: [
    { tipo: 'quota_da_pagare', id: 1, testo: "Quota d'ingresso di Luca P.", azione: 'Paga dal wallet o con carta nel portale', importo: '€ 169,00', quando: null },
    { tipo: 'da_prenotare', id: 2, testo: 'Visita medica preventiva di Luca P.', azione: 'La segreteria prenota dopo il pagamento della quota', importo: null, quando: null },
    { tipo: 'regolarizzazione', id: 3, testo: 'Formazione scaduta di Anna B.: aggiornamento lavoratori', azione: 'Iscrivi al corso di aggiornamento', importo: null, quando: null },
  ],
  totaleDaPagare: '€ 169,00',
  scadenze30: 4,
  coperturaFormativa: 71,
  visiteValide: 83,
  completezzaFascicolo: 64,
};

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
/** "2026-10-20" diventa "20 ott"; gli orari gia' leggibili restano come sono. */
export function quandoLeggibile(q: string | null): string | null {
  if (!q) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  const d = new Date(`${q}T12:00:00`);
  return Number.isNaN(d.getTime()) ? q : fmtGiorno.format(d);
}

function intero(n: number | null): string {
  return n === null ? 'n.d.' : String(Math.round(n));
}

function Riquadro({ punto, titolo, valore, unita, barra }: { punto: string; titolo: string; valore: number | null; unita?: string; barra?: string }) {
  return (
    <div className="flex min-h-[9.5rem] flex-col justify-between rounded-[1.25rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <p className="flex items-center gap-2 text-[13.5px] text-ink-soft">
        <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', punto)} />
        {titolo}
      </p>
      <div>
        <p className="cifre leading-none text-ink">
          <span className="text-[44px] font-light tracking-[-0.04em]">{intero(valore)}</span>
          {valore !== null && unita && <span className="ml-0.5 text-[18px] text-ink-muted">{unita}</span>}
        </p>
        {barra && valore !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-perla-velo" aria-hidden>
            <div className={clsx('h-full rounded-full', barra)} style={{ width: `${Math.max(0, Math.min(100, valore))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function CruscottoAzienda({ aziendaId, nome, disabled, onChiedi }: { aziendaId: number; nome: string; disabled: boolean; onChiedi: (t: string) => void }) {
  const [dati, setDati] = useState<DaFareAzienda | null>(isApiMode() ? null : DEMO_DA_FARE);
  const [errore, setErrore] = useState<string | null>(null);
  // Colonne in base allo spazio reale (la conversazione e' stretta quando il tavolo e' aperto).
  const box = useRef<HTMLElement>(null);
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setLargo(e.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isApiMode()) return;
    let vivo = true;
    setDati(null);
    setErrore(null);
    daFareAzienda(aziendaId)
      .then((d) => vivo && setDati(d))
      .catch((e: unknown) => vivo && setErrore(e instanceof Error ? e.message : 'Dati non disponibili.'));
    return () => {
      vivo = false;
    };
  }, [aziendaId]);

  // Ruolo senza la vista (o servizio fermo): la pagina resta utile senza riquadri.
  if (errore) return null;

  const voci = dati?.voci ?? [];
  return (
    <section ref={box} aria-labelledby="ca-dafare" className="mt-8 space-y-4" aria-busy={dati === null}>
      <div className={clsx('grid gap-4', largo ? 'grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]')}>
        <div className="rounded-[1.75rem] bg-oro-500 p-3 text-acido-950 sm:p-4">
          <div className="flex items-center justify-between px-1.5 pb-3 pt-1">
            <h2 id="ca-dafare" className="text-[21px] font-medium tracking-[-0.015em]">
              Da fare adesso
            </h2>
            {dati && <span className="cifre inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-black px-2 text-[12px] font-medium text-oro-500">{voci.length}</span>}
          </div>
          {dati === null ? (
            <ul className="space-y-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[60px] animate-pulse rounded-[1.25rem] bg-white/70 motion-reduce:animate-none" />
              ))}
            </ul>
          ) : voci.length === 0 ? (
            <p className="rounded-[1.25rem] bg-white px-4 py-4 text-[14px] text-ink">Niente di urgente per {nome}: quote pagate, visite e formazione in regola.</p>
          ) : (
            <ul className="space-y-1.5">
              {voci.slice(0, 6).map((v, i) => {
                const t = TIPO_DA_FARE[v.tipo];
                const Icona = t.icona;
                const extra = [v.importo, quandoLeggibile(v.quando), v.azione].filter(Boolean).join(' · ');
                return (
                  <li key={`${v.tipo}-${v.id}-${i}`} className="flex min-h-[60px] items-center gap-3 rounded-[1.25rem] bg-white py-2 pl-2.5 pr-2 text-ink">
                    <span aria-hidden className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', t.pastiglia)}>
                      <Icona size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-snug">{v.testo}</span>
                      {extra && <span className="block truncate text-[12.5px] text-ink-muted">{extra}</span>}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChiedi(t.chiedi(v.testo, nome))}
                      className="premi inline-flex h-11 shrink-0 items-center rounded-full bg-grafite-900 px-4 lg:h-10 text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {t.etichetta}
                    </button>
                  </li>
                );
              })}
              {voci.length > 6 && (
                <li>
                  <button type="button" disabled={disabled} onClick={() => onChiedi(`Mostrami tutte le cose da fare di ${nome}`)} className="premi min-h-[44px] px-2.5 text-[14px] font-medium disabled:opacity-40">
                    Mostra le altre {voci.length - 6}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Pronto Ispezioni: grafite con l'acido, e' l'emergenza */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChiedi(`Ho un controllo in corso da ${nome}: attiva Pronto Ispezioni`)}
          className={clsx('premi group flex flex-col justify-between rounded-[1.75rem] bg-black p-5 text-left text-white disabled:opacity-60', largo ? 'min-h-[15rem]' : 'min-h-[11rem]')}
        >
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[21px] font-medium tracking-[-0.015em]">Pronto Ispezioni</span>
              <span className="mt-1 block text-[13.5px] text-grafite-400">Hai un controllo in azienda?</span>
            </span>
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_#ffffff] transition-colors group-hover:bg-oro-500 group-hover:text-acido-950 group-hover:shadow-none">
              <ArrowUpRight size={18} />
            </span>
          </span>
          <span>
            <span className="cifre flex items-baseline gap-1 text-oro-500">
              <span className="text-[60px] font-light leading-none tracking-[-0.04em]">15</span>
              <span className="text-[20px]">min</span>
            </span>
            <span className="mt-2 block text-[13.5px] leading-relaxed text-grafite-300">Lo studio ti richiama entro 15 minuti e hai i documenti pronti.</span>
          </span>
        </button>
      </div>

      <div className={clsx('grid gap-3', largo ? 'grid-cols-4' : 'grid-cols-2 [&>*]:min-w-0')}>
        <Riquadro punto="bg-cat-scadenze-segno" titolo="Scadenze entro 30 giorni" valore={dati?.scadenze30 ?? null} />
        <Riquadro punto="bg-cat-formazione-segno" titolo="Copertura formativa" valore={dati?.coperturaFormativa ?? null} unita="%" barra="bg-cat-formazione-segno" />
        <Riquadro punto="bg-cat-visite-segno" titolo="Visite valide" valore={dati?.visiteValide ?? null} unita="%" barra="bg-cat-visite-segno" />
        <Riquadro punto="bg-cat-documenti-segno" titolo="Completezza del fascicolo" valore={dati?.completezzaFascicolo ?? null} unita="%" barra="bg-cat-documenti-segno" />
      </div>
    </section>
  );
}
