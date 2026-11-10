'use client';

import { useState } from 'react';
import type { CrArea, CrConformita, CrCriticita, CrLivello, CrTendenza } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { Caricamento, Errore, Vuota } from '../spazio/kit';
import { AnelloPunteggio, BadgeEsito, BarraArea, LINK_CR, LIVELLO, Titoletto, dataCr, nomeMese, useDato, type SchedaControlRoomProps } from './kit';

const PRIORITA: Record<string, { l: string; cls: string }> = {
  alta: { l: 'Priorità alta', cls: 'text-danger-ink' },
  media: { l: 'Priorità media', cls: 'text-oro-700' },
  bassa: { l: 'Priorità bassa', cls: 'text-ink-muted' },
};

/** Testo preciso che parte verso l'agente per una criticità. */
export function richiestaCriticita(c: CrCriticita, azienda?: string | null): string {
  const dove = azienda ? ` di ${azienda}` : '';
  const pezzi = [
    `Aiutami a risolvere questa criticità della sicurezza${dove}: ${c.titolo}.`,
    c.messaggio && `Situazione: ${c.messaggio}`,
    c.azione && `Azione suggerita dalla Control Room: ${c.azione}`,
    c.riferimento && `Riferimento: ${c.riferimento}.`,
    'Dimmi cosa serve, fai tu quello che puoi con gli strumenti e chiedimi solo i dati che mancano.',
  ];
  return pezzi.filter(Boolean).join(' ');
}

export function testoTendenza(t: CrTendenza): string {
  if (t.direzione === 'nd' || t.delta == null) return 'Prima fotografia: la tendenza compare dal mese prossimo.';
  const mese = nomeMese(t.mese_precedente).split(' ')[0];
  if (t.direzione === 'stabile') return `Stabile rispetto a ${mese}.`;
  const n = Math.abs(t.delta);
  return `${n} ${n === 1 ? 'punto' : 'punti'} ${t.direzione === 'su' ? 'in più' : 'in meno'} rispetto a ${mese}.`;
}

/** Anello e tendenza: la parte che si legge per prima. */
export function RiquadroScore({ totale, livello, tendenza, dimensione = 116, nota }: { totale: number | null; livello: CrLivello; tendenza: CrTendenza; dimensione?: number; nota?: string | null }) {
  const su = tendenza.direzione === 'su';
  const giu = tendenza.direzione === 'giu';
  return (
    <div className="flex items-center gap-4">
      <AnelloPunteggio totale={totale} livello={livello} dimensione={dimensione} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-ink-subtle">Safety Score</p>
        <p className="mt-0.5 text-[15px] font-medium leading-snug tracking-[-0.01em] text-brand-900">
          {totale == null ? 'Servono più dati' : `Livello ${LIVELLO[livello].l.toLowerCase()}`}
        </p>
        <p className={clsx('mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug', su ? 'text-ok-ink' : giu ? 'text-danger-ink' : 'text-ink-muted')}>
          {(su || giu) && (
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className={clsx('mt-[3px] shrink-0', giu && 'rotate-180')}>
              <path d="M6 10V2.5M2.75 5.5 6 2.25 9.25 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{testoTendenza(tendenza)}</span>
        </p>
        {nota && <p className="mt-1 text-[11.5px] text-ink-subtle">{nota}</p>}
      </div>
    </div>
  );
}

export function GrigliaAree({ aree }: { aree: CrArea[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {aree.map((a) => (
        <BarraArea key={a.chiave} nome={a.nome} punteggio={a.stato === 'non_applicabile' ? null : a.punteggio} compatta />
      ))}
    </div>
  );
}

export function CaselleConformita({ c }: { c: CrConformita }) {
  const caselle = [
    { n: c.conformi, l: 'In regola', cls: 'text-ok-ink' },
    { n: c.in_scadenza, l: 'In scadenza', cls: 'text-oro-700' },
    { n: c.non_conformi, l: 'Da sistemare', cls: 'text-danger-ink' },
    { n: c.da_verificare, l: 'Da verificare', cls: 'text-grafite-700' },
  ];
  return (
    <dl className="grid grid-cols-4 gap-1.5" aria-label="Stato dei controlli">
      {caselle.map((x) => (
        <div key={x.l} className="min-w-0 rounded-[0.875rem] bg-perla-superficie px-2 py-2 text-center shadow-[inset_0_0_0_1px_rgba(14,14,16,0.07)]">
          <dd className={clsx('cifre text-[18px] font-semibold leading-none', x.cls)}>{x.n}</dd>
          <dt className="mt-1 text-[11px] leading-tight text-ink-muted">{x.l}</dt>
        </div>
      ))}
    </dl>
  );
}

function VoceCriticita({ c, onChiedi, occupato, nomeAgente }: { c: CrCriticita; onChiedi?: () => void; occupato?: boolean; nomeAgente: string }) {
  const p = PRIORITA[c.priorita] ?? PRIORITA.media;
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2">
        <span aria-hidden className={clsx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', c.priorita === 'alta' ? 'bg-danger-mark' : c.priorita === 'media' ? 'bg-oro-500' : 'bg-brand-300')} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13.5px] font-semibold leading-snug text-ink">{c.titolo}</span>
            <span className={clsx('text-[11.5px] font-medium', p.cls)}>{p.l}</span>
          </p>
          {c.messaggio && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">{c.messaggio}</p>}
          {c.riferimento && <p className="mt-0.5 truncate text-[11.5px] text-ink-subtle" title={c.riferimento}>{c.riferimento}</p>}
        </div>
        {onChiedi && (
          <button type="button" onClick={onChiedi} disabled={occupato} className={clsx(LINK_CR, '-mr-1 -mt-1.5 shrink-0 whitespace-nowrap text-[12.5px]')} aria-label={`Chiedi a ${nomeAgente}: ${c.titolo}`}>
            Chiedi a {nomeAgente}
          </button>
        )}
      </div>
    </li>
  );
}

/** Criticità prioritarie: le prime 3 visibili, le altre a richiesta. */
export function ElencoCriticita({
  criticita,
  totali,
  chiedi,
  occupato,
  azienda,
  nomeAgente = 'Falco',
  visibili = 3,
}: {
  criticita: CrCriticita[];
  totali?: number;
  chiedi?: (t: string) => void;
  occupato?: boolean;
  azienda?: string | null;
  nomeAgente?: string;
  visibili?: number;
}) {
  const [tutte, setTutte] = useState(false);
  if (criticita.length === 0) return <Vuota>Nessuna criticità aperta: tutti i controlli applicabili sono in regola.</Vuota>;
  const mostrate = tutte ? criticita : criticita.slice(0, visibili);
  const altre = Math.max(criticita.length, totali ?? 0) - mostrate.length;
  return (
    <div>
      <ul className="divide-y divide-perla-linea">
        {mostrate.map((c, i) => (
          <VoceCriticita key={`${c.chiave}-${i}`} c={c} occupato={occupato} nomeAgente={nomeAgente} onChiedi={chiedi ? () => chiedi(richiestaCriticita(c, azienda)) : undefined} />
        ))}
      </ul>
      {(altre > 0 || tutte) && criticita.length > visibili && (
        <button type="button" onClick={() => setTutte((v) => !v)} aria-expanded={tutte} className={clsx(LINK_CR, '-ml-2')}>
          {tutte ? 'Mostra solo le prioritarie' : `Vedi tutte (${altre} in più)`}
        </button>
      )}
      {!tutte && altre > 0 && criticita.length <= visibili && <p className="text-[12px] text-ink-muted">Altre {altre} nel Safety Score completo.</p>}
    </div>
  );
}

/**
 * Safety Control Room dell'azienda: punteggio, tendenza, aree, criticità e
 * stato dei controlli. Compatta: a 900 px di altezza si leggono anello, aree
 * e prime criticità senza scorrere.
 */
export function ControlRoom({ aziendaId, versione, chiedi, occupato, nomeAgente = 'Falco' }: SchedaControlRoomProps & { nomeAgente?: string }) {
  const ds = useDataSource();
  const cr = useDato(() => ds.controlRoom.controlRoom(aziendaId), [ds, aziendaId, versione]);
  const [completo, setCompleto] = useState(false);
  const score = useDato(() => (completo ? ds.controlRoom.safetyScore(aziendaId) : Promise.resolve(null)), [ds, aziendaId, versione, completo]);

  if (cr.inCorso && !cr.dato) return <Caricamento testo="Calcolo il Safety Score" />;
  if (cr.errore) return <Errore testo={cr.errore} onRiprova={cr.ricarica} />;
  const d = cr.dato;
  if (!d) return null;

  const criticita = completo && score.dato ? score.dato.criticita : d.criticita;
  return (
    <div className="space-y-4 py-3">
      <RiquadroScore totale={d.totale} livello={d.livello} tendenza={d.tendenza} nota={d.calcolato_il ? `Calcolato il ${dataCr(d.calcolato_il, true)}` : null} />
      <GrigliaAree aree={d.aree} />
      <CaselleConformita c={d.conformita} />
      <section aria-labelledby="cr-criticita">
        <Titoletto
          azione={
            <span className="cifre text-[12px] text-ink-muted">
              {d.criticita_totali} {d.criticita_totali === 1 ? 'aperta' : 'aperte'}
            </span>
          }
        >
          <span id="cr-criticita">Criticità prioritarie</span>
        </Titoletto>
        <ElencoCriticita criticita={criticita} totali={completo ? undefined : d.criticita_totali} chiedi={chiedi} occupato={occupato} azienda={d.ragione_sociale} nomeAgente={nomeAgente} />
      </section>
      <section>
        <button type="button" onClick={() => setCompleto((v) => !v)} aria-expanded={completo} className={clsx(LINK_CR, '-ml-2')}>
          {completo ? 'Nascondi i controlli' : 'Mostra tutti i controlli'}
        </button>
        {completo &&
          (score.inCorso && !score.dato ? (
            <Caricamento testo="Carico i controlli" />
          ) : score.errore ? (
            <Errore testo={score.errore} onRiprova={score.ricarica} />
          ) : score.dato ? (
            <div className="mt-1 space-y-3">
              {score.dato.aree.map((a) => (
                <div key={a.chiave}>
                  <p className="text-[12.5px] font-semibold text-brand-900">{a.nome}</p>
                  <ul className="mt-1 divide-y divide-perla-linea">
                    {a.controlli.map((k) => (
                      <li key={k.chiave} className="flex items-start justify-between gap-2 py-1.5">
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-ink">{k.titolo}</span>
                          {k.messaggio && <span className="block text-[11.5px] text-ink-muted">{k.messaggio}</span>}
                        </span>
                        <BadgeEsito esito={k.esito} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {score.dato.formula && <p className="text-[11.5px] leading-relaxed text-ink-subtle">{score.dato.formula}</p>}
            </div>
          ) : null)}
      </section>
      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        Il punteggio aiuta a decidere le priorità ma non certifica la conformità: la valutazione resta del datore di lavoro, con RSPP e medico competente.
      </p>
    </div>
  );
}
