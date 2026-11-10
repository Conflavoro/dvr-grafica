'use client';

import { useMemo, useState } from 'react';
import type { CrContatori, CrScadenzaPriorita, CrVoceScadenza, ScadenzarioPeriodo } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { Caricamento, Errore, Vuota } from '../spazio/kit';
import { BadgePriorita, CONTATORI, Contatore, LINK_CR, Scelta, dataCr, quando, useDato, type SchedaControlRoomProps } from './kit';

const CATEGORIE: Record<string, string> = {
  formazione: 'Formazione',
  visita_medica: 'Visita medica',
  verifica: 'Verifica',
  cantiere: 'Cantiere',
  dvr: 'DVR',
  dpi: 'DPI',
  documento: 'Documento',
  altro: 'Altro',
};

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function GrigliaContatori({ c, attivo, onScegli }: { c: CrContatori; attivo?: keyof CrContatori | null; onScegli?: (k: keyof CrContatori | null) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-1.5">
      {CONTATORI.map((x) => (
        <Contatore
          key={x.k}
          n={c[x.k]}
          etichetta={x.l}
          allerta={x.allerta}
          attivo={attivo === x.k}
          onClick={onScegli ? () => onScegli(attivo === x.k ? null : x.k) : undefined}
        />
      ))}
    </div>
  );
}

/** Striscia dei prossimi 7 giorni: un pallino nei giorni con scadenze. */
export function StrisciaSettimana({ voci, giorno, onGiorno, oggi = new Date() }: { voci: CrVoceScadenza[]; giorno?: string | null; onGiorno?: (g: string | null) => void; oggi?: Date }) {
  const giorni = Array.from({ length: 7 }, (_, i) => new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + i, 12));
  return (
    <div className="grid grid-cols-7 gap-1" role={onGiorno ? 'group' : undefined} aria-label="Prossimi 7 giorni">
      {giorni.map((d, i) => {
        const k = iso(d);
        const qui = voci.filter((v) => v.data === k);
        const forte = qui.some((v) => v.priorita === 'critica' || v.priorita === 'alta');
        const on = giorno === k;
        const etichetta = `${i === 0 ? 'Oggi' : GIORNI[d.getDay()]} ${d.getDate()}: ${qui.length ? `${qui.length} ${qui.length === 1 ? 'scadenza' : 'scadenze'}` : 'nessuna scadenza'}`;
        const corpo = (
          <>
            <span className={clsx('block text-[11px]', i === 0 ? 'font-semibold text-brand-800' : 'text-ink-muted')}>{i === 0 ? 'oggi' : GIORNI[d.getDay()]}</span>
            <span className="cifre mt-0.5 block text-[15px] font-semibold leading-none text-brand-900">{d.getDate()}</span>
            <span aria-hidden className="mt-1.5 flex h-1.5 justify-center">
              {qui.length > 0 && <span className={clsx('h-1.5 w-1.5 rounded-full', forte ? 'bg-danger-mark' : 'bg-oro-500')} />}
            </span>
          </>
        );
        const cls = clsx(
          'min-h-[58px] rounded-[0.875rem] px-0.5 py-1.5 text-center',
          on ? 'bg-brand-900 [&_span]:!text-perla-carta' : i === 0 ? 'bg-perla-carta shadow-[inset_0_0_0_1px_rgba(103,127,2,0.55)]' : 'bg-perla-superficie shadow-[inset_0_0_0_1px_rgba(14,14,16,0.07)]'
        );
        return onGiorno ? (
          <button key={k} type="button" aria-pressed={on} aria-label={etichetta} onClick={() => onGiorno(on ? null : k)} className={clsx(cls, 'premi focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500')}>
            {corpo}
          </button>
        ) : (
          <div key={k} className={cls} aria-label={etichetta} role="img">
            {corpo}
          </div>
        );
      })}
    </div>
  );
}

export function RigaScadenza({ v }: { v: CrVoceScadenza }) {
  const scaduta = v.stato === 'scaduta';
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={clsx('w-[52px] shrink-0 pt-0.5 text-right', scaduta ? 'text-danger-ink' : 'text-brand-900')}>
        <span className="cifre block text-[12.5px] font-semibold leading-tight">{dataCr(v.data).replace(/ \d{4}$/, '')}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-ink">{v.titolo}</span>
        <span className={clsx('block text-[11.5px]', scaduta ? 'font-medium text-danger-ink' : 'text-ink-muted')}>
          {[quando(v.giorni), CATEGORIE[v.categoria] ?? v.categoria].filter(Boolean).join(', ')}
        </span>
      </span>
      <BadgePriorita p={v.priorita} />
    </li>
  );
}

const PERIODI: Array<{ v: ScadenzarioPeriodo; l: string }> = [
  { v: 'oggi', l: 'Oggi' },
  { v: '7', l: '7 giorni' },
  { v: '30', l: '30 giorni' },
];
const PRIORITA: Array<{ v: 'tutte' | CrScadenzaPriorita; l: string }> = [
  { v: 'tutte', l: 'Tutte' },
  { v: 'media', l: 'Da media' },
  { v: 'alta', l: 'Da alta' },
  { v: 'critica', l: 'Critiche' },
];

/** Scadenzario unificato dell'azienda: contatori, settimana, filtri ed elenco. */
export function Scadenzario({ aziendaId, versione, chiedi, occupato, nomeAgente = 'Falco' }: SchedaControlRoomProps & { nomeAgente?: string }) {
  const ds = useDataSource();
  const [periodo, setPeriodo] = useState<ScadenzarioPeriodo>('30');
  const [priorita, setPriorita] = useState<'tutte' | CrScadenzaPriorita>('tutte');
  const [giorno, setGiorno] = useState<string | null>(null);
  const settimana = useDato(() => ds.controlRoom.scadenzario(aziendaId, { periodo: '7', includi_scadute: false }), [ds, aziendaId, versione]);
  const elenco = useDato(
    () => ds.controlRoom.scadenzario(aziendaId, { periodo, priorita: priorita === 'tutte' ? null : priorita }),
    [ds, aziendaId, versione, periodo, priorita]
  );

  const voci = useMemo(() => {
    const v = elenco.dato?.voci ?? [];
    return giorno ? (settimana.dato?.voci ?? []).filter((x) => x.data === giorno) : v;
  }, [elenco.dato, settimana.dato, giorno]);

  if (elenco.inCorso && !elenco.dato) return <Caricamento testo="Carico le scadenze" />;
  if (elenco.errore) return <Errore testo={elenco.errore} onRiprova={elenco.ricarica} />;
  const d = elenco.dato;
  if (!d) return null;
  const scadute = voci.filter((v) => v.stato === 'scaduta').length;

  return (
    <div className="space-y-3 py-3">
      <GrigliaContatori c={d.contatori} />
      <StrisciaSettimana voci={settimana.dato?.voci ?? []} giorno={giorno} onGiorno={setGiorno} />
      <div className="space-y-1.5">
        <Scelta etichetta="Periodo" valore={periodo} opzioni={PERIODI} onScegli={(v) => { setGiorno(null); setPeriodo(v); }} />
        <Scelta etichetta="Priorità minima" valore={priorita} opzioni={PRIORITA} onScegli={(v) => { setGiorno(null); setPriorita(v); }} />
      </div>
      <div aria-live="polite">
        <p className="text-[12px] text-ink-muted">
          {giorno ? `Scadenze del ${dataCr(giorno)}` : `${voci.length} ${voci.length === 1 ? 'voce' : 'voci'}${scadute ? `, di cui ${scadute} già scadute` : ''}`}
          {elenco.inCorso && ', aggiorno'}
        </p>
        {voci.length === 0 ? (
          <div className="mt-2">
            <Vuota>Niente in scadenza con questi filtri.</Vuota>
          </div>
        ) : (
          <ul className="mt-1 divide-y divide-perla-linea">
            {voci.map((v) => (
              <RigaScadenza key={v.chiave} v={v} />
            ))}
          </ul>
        )}
      </div>
      {scadute > 0 && (
        <button
          type="button"
          disabled={occupato}
          onClick={() => chiedi(`Ho ${scadute} scadenze già superate per questa azienda. Mettile in ordine di urgenza e proponi come recuperarle, con le date da fissare.`)}
          className={clsx(LINK_CR, '-ml-2')}
        >
          Chiedi a {nomeAgente} un piano per le scadute
        </button>
      )}
    </div>
  );
}
