'use client';

import { clearApiCache } from '@/lib/api';

import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, Pillole, useAzione, useCarico } from '../amministrazione-kit';
import {
  NOMI_NOTA,
  PULSANTE_PASSO,
  SEQUENZA,
  TESTO_STATO,
  TONO_STATO,
  aggiungiNota,
  avanzaPasso,
  chiudiRichiesta,
  contoAllaRovescia,
  etichettaMese,
  impostaTurno,
  indiceSequenza,
  turniPronto,
  vistaPronto,
  type PassoPronto,
  type RichiestaPronto,
  type StatoPronto,
  type TipoNota,
} from '@/lib/portale/pronto-api';
import { ScudoAllerta } from '@/components/icone';
import { clsx } from '@/lib/clsx';

type SchedaPronto = 'aperte' | 'storico' | 'turni';

const fmtOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const ora = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmtOra.format(d);
};
const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const giornoIt = (g: string) => {
  const t = fmtGiorno.format(new Date(`${g}T12:00:00`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Ogni 30 secondi la scrivania si aggiorna da sola: un controllo non aspetta un clic. */
const AGGIORNA_MS = 30_000;

const OBIETTIVO_S = 15 * 60;
const SCALA_S = 10 * 60;

/** Traccia della telefonata (04 gestionale 8.1): promemoria del tecnico, spuntati solo su questo schermo. */
const TRACCIA = [
  'Chiedi chi sono gli ispettori e che cosa hanno chiesto di vedere.',
  'Indica al titolare dove trova ogni documento nel fascicolo.',
  'Sui punti deboli spiega cosa dichiarare e cosa è già in corso.',
  'Ricorda di farsi lasciare copia del verbale.',
];

function Sequenza({ stato }: { stato: StatoPronto }) {
  const i = indiceSequenza(stato);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" aria-label={`Stato: ${TESTO_STATO[stato]}`}>
      {SEQUENZA.map((x, k) => (
        <li key={x.stato} className="flex items-center gap-2">
          {k > 0 && <span aria-hidden className="text-white/40">›</span>}
          <span className={clsx('inline-flex items-center gap-1', k < i || stato === 'archiviata' ? 'text-acido-300' : k === i ? 'font-medium text-white' : 'text-white/50')}>
            {(k < i || stato === 'archiviata') && <span aria-hidden>✓</span>}
            {x.testo}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Tempo({ r, adesso, coordinatore }: { r: RichiestaPronto; adesso: Date; coordinatore: string | null }) {
  if (r.richiamataIl) {
    return (
      <div>
        <p className="text-[12.5px] text-white/60">Richiamata</p>
        <p className="cifre text-[34px] font-medium leading-none text-white">{r.minutiAllaRichiamata ?? 0} min</p>
        <p className={clsx('mt-2 text-[13px]', r.entroObiettivo ? 'text-acido-300' : 'text-[#ffc6ac]')}>
          {r.entroObiettivo ? 'Dentro l’obiettivo dei 15 minuti' : 'Oltre l’obiettivo dei 15 minuti'}
        </p>
      </div>
    );
  }
  const inizio = r.richiestaIl ? new Date(r.richiestaIl).getTime() : NaN;
  const passati = Number.isNaN(inizio) ? 0 : Math.max(0, Math.floor((adesso.getTime() - inizio) / 1000));
  const resto = OBIETTIVO_S - passati;
  const rosso = passati >= SCALA_S;
  return (
    <div>
      <p className="text-[12.5px] text-white/60">Tempo per richiamare</p>
      <p className={clsx('cifre text-[34px] font-medium leading-none', rosso ? 'text-[#ffc6ac]' : 'text-white')} aria-live="off">
        {contoAllaRovescia(resto)}
      </p>
      <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <span className={clsx('block h-full rounded-full', rosso ? 'bg-[#d63d3e]' : 'bg-acido-400')} style={{ width: `${Math.min(100, Math.round((100 * passati) / OBIETTIVO_S))}%` }} />
      </span>
      <p className="mt-2 text-[12.5px] text-white/70">
        {passati >= OBIETTIVO_S
          ? 'Oltre l’obiettivo dei 15 minuti'
          : rosso
            ? `Avviso scalato${coordinatore ? ` a ${coordinatore}, coordinatore` : ' al coordinatore'}`
            : 'Dopo 10 minuti l’avviso scala al coordinatore'}
      </p>
    </div>
  );
}

function Dato({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-white/55">{t}</dt>
      <dd className="mt-0.5 truncate text-[14px] text-white">{children}</dd>
    </div>
  );
}

function RiquadroChiamata({ r, adesso, turno, coordinatore, occupato, onPasso }: {
  r: RichiestaPronto;
  adesso: Date;
  turno: string | null;
  coordinatore: string | null;
  occupato: boolean;
  onPasso: (p: PassoPronto) => void;
}) {
  const inAzienda = r.richiestaIl ? Math.max(0, Math.floor((adesso.getTime() - new Date(r.richiestaIl).getTime()) / 60_000)) : null;
  const prossimo = r.prossimoPasso && r.prossimoPasso !== 'fascicolo' ? r.prossimoPasso : null;
  return (
    <section data-falco="pronto_richiesta" className="rounded-[1.5rem] bg-grafite-950 p-5 text-white sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-acido-400 px-3 text-[12px] font-medium text-acido-950">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-acido-950 motion-reduce:animate-none" />
              Ispezione in corso
            </span>
            <Chip stato={TONO_STATO[r.stato]}>{r.statoTesto}</Chip>
          </div>
          <h3 className="mt-3 text-[24px] font-medium leading-tight">{r.azienda}</h3>
          <p className="mt-1 text-[14px] text-white/70">
            {[r.ente, r.presenti.length > 0 ? `${r.presenti.join(', ')} in azienda` : null, inAzienda !== null ? `da ${inAzienda} min` : null, r.messaggio].filter(Boolean).join(' · ')}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Dato t="Ha chiamato">{r.richiestoDa ?? 'Non indicato'}</Dato>
            <Dato t="Numero da richiamare">
              {r.telefono ? (
                <a className="text-acido-300 underline-offset-2 hover:underline" href={`tel:${r.telefono.replace(/\s+/g, '')}`}>
                  {r.telefono}
                </a>
              ) : (
                'In anagrafica manca il telefono'
              )}
            </Dato>
            <Dato t="Dove">{r.azienda}</Dato>
            <Dato t="Tecnico">{r.presaInCaricoDa ?? (turno ? `Di turno: ${turno}, non ancora presa` : 'Non ancora presa')}</Dato>
          </dl>
        </div>
        <div className="w-full shrink-0 lg:w-64">
          <Tempo r={r} adesso={adesso} coordinatore={coordinatore} />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Sequenza stato={r.stato} />
        {prossimo && (
          <button
            type="button"
            data-falco="pronto_passo"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-acido-400 px-5 text-[14px] font-medium text-acido-950 hover:bg-acido-300 disabled:opacity-60 lg:min-h-[40px]"
            disabled={occupato}
            onClick={() => onPasso(prossimo)}
          >
            {PULSANTE_PASSO[prossimo]}
          </button>
        )}
      </div>
    </section>
  );
}

function Lavoro({ r, esiti, occupato, onPasso, onNota, onArchivia }: {
  r: RichiestaPronto;
  esiti: Array<{ chiave: string; testo: string }>;
  occupato: boolean;
  onPasso: (p: PassoPronto) => void;
  onNota: (tipo: TipoNota, testo: string) => Promise<boolean>;
  onArchivia: (esito: string, nota: string) => void;
}) {
  const [fatti, setFatti] = useState<boolean[]>(() => TRACCIA.map(() => false));
  const [tipo, setTipo] = useState<TipoNota>('nota');
  const [nota, setNota] = useState('');
  const [esito, setEsito] = useState('');
  const [finale, setFinale] = useState('');
  const chiusa = r.stato === 'chiusa';
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <Scheda
          titolo="Fascicolo dell’ispezione"
          sotto="Si manda di solito durante la telefonata, così il titolare sa dove trovare ogni documento."
          azioni={
            r.fascicoloInviatoIl ? (
              <Chip stato="ok">Inviato al titolare</Chip>
            ) : (
              <button type="button" className="btn-primary min-h-[44px] lg:min-h-[40px]" disabled={occupato} onClick={() => onPasso('fascicolo')}>
                Invia il fascicolo al titolare
              </button>
            )
          }
        >
          <p className="text-[13.5px] text-ink-muted">
            Con gli ispettori e con il titolare parla solo il tecnico: l’assistente prepara i documenti e non scrive al cliente durante il controllo.
          </p>
        </Scheda>
        <Scheda titolo="Dopo l’ispezione">
          {!chiusa ? (
            <p className="text-[13.5px] text-ink-muted">
              Si apre quando chiudi la telefonata. Il cliente o il tecnico carica il verbale, poi scegli l’esito e archivi: le prescrizioni diventano scadenze dell’azienda.
            </p>
          ) : (
            <div className="space-y-3">
              <Campo etichetta="Esito">
                <select className="input-field h-11" value={esito} onChange={(e) => setEsito(e.target.value)} data-falco-campo="pronto_esito">
                  <option value="">Scegli l’esito</option>
                  {esiti.map((x) => (
                    <option key={x.chiave} value={x.chiave}>
                      {x.testo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etichetta="Nota finale" aiuto="Facoltativa.">
                <textarea className="input-field h-20 py-3" value={finale} onChange={(e) => setFinale(e.target.value)} maxLength={1000} />
              </Campo>
              <button type="button" className="btn-primary min-h-[44px] lg:min-h-[40px]" disabled={occupato || esito === ''} onClick={() => onArchivia(esito, finale)}>
                Archivia l’ispezione
              </button>
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-ink-subtle">
            Restano nel sistema gli orari di chiamata e richiamata per l’indicatore dei 15 minuti, il fascicolo inviato e il verbale. Non promettiamo l’esito del controllo.
          </p>
        </Scheda>
      </div>
      <Scheda titolo="Traccia della telefonata">
        <ul className="space-y-2">
          {TRACCIA.map((t, i) => (
            <li key={t}>
              <label className="flex cursor-pointer items-start gap-2 text-[13.5px]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-grafite-900" checked={fatti[i]} onChange={() => setFatti((f) => f.map((x, k) => (k === i ? !x : x)))} />
                <span className={clsx(fatti[i] ? 'text-ink-subtle line-through' : 'text-ink')}>{t}</span>
              </label>
            </li>
          ))}
        </ul>
        <h4 className="mt-5 text-[13px] font-medium text-ink">Note con orario</h4>
        {r.note.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-muted">Ancora nessuna nota.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {r.note.map((n, i) => (
              <li key={`${n.quando}-${i}`} className={clsx('text-[13px]', n.tipo === 'sistema' ? 'text-ink-muted' : 'text-ink')}>
                <span className="cifre text-ink-muted">{ora(n.quando).replace(':', '.')}</span>{' '}
                {(n.tipo === 'ha_chiesto' || n.tipo === 'mostrato') && <span className="font-medium">{NOMI_NOTA[n.tipo]}: </span>}
                {n.testo}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2">
          <Pillole<TipoNota> etichetta="Tipo di nota" attiva={tipo} onCambia={setTipo} voci={(['nota', 'ha_chiesto', 'mostrato'] as TipoNota[]).map((k) => ({ k, t: NOMI_NOTA[k] }))} />
          <div className="flex gap-2">
            <input className="input-field h-11 flex-1" placeholder="Es. vogliono il registro dei carrelli" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} data-falco-campo="pronto_testo" />
            <button
              type="button"
              data-falco="pronto_nota"
              data-falco-tocca=""
              className="btn-ghost min-h-[44px] lg:min-h-[40px]"
              disabled={occupato || nota.trim().length < 2}
              onClick={() => void onNota(tipo, nota).then((ok) => ok && setNota(''))}
            >
              Aggiungi
            </button>
          </div>
        </div>
      </Scheda>
    </div>
  );
}

function Turni() {
  const [dal, setDal] = useState<string | undefined>(undefined);
  const t = useCarico(() => turniPronto(dal), [dal]);
  const az = useAzione();
  if (t.errore) return <Errore testo={t.errore} onRiprova={t.carica} />;
  if (!t.dati) return <Caricamento />;
  const d = t.dati;
  const sposta = (giorni: number) => {
    const x = new Date(`${d.settimanaDal}T12:00:00`);
    x.setDate(x.getDate() + giorni);
    setDal(x.toISOString().slice(0, 10));
  };
  const scegli = (giorno: string, tit: number | null, sos: number | null) =>
    az.esegui(() => impostaTurno(giorno, tit, sos), 'Turno salvato.').then((ok) => ok && t.carica());
  return (
    <Scheda
      titolo="Turni della settimana"
      sotto="Ogni giorno un titolare e un sostituto diversi. Li decide il coordinatore."
      azioni={
        d.settimanaDal ? (
          <span className="flex gap-2">
            <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px]" onClick={() => sposta(-7)}>
              Settimana prima
            </button>
            <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px]" onClick={() => sposta(7)}>
              Settimana dopo
            </button>
          </span>
        ) : undefined
      }
    >
      {d.giorni.length === 0 ? (
        <Vuoto titolo="Turni disponibili con il collegamento al server" />
      ) : (
        <div className="divide-y divide-perla-linea">
          {d.giorni.map((g) => (
            <div key={g.giorno} className={clsx('flex flex-col gap-2 py-3 sm:flex-row sm:items-center', !g.feriale && 'opacity-60')}>
              <span className="w-32 shrink-0 text-[14px] font-medium text-ink">{giornoIt(g.giorno)}</span>
              {d.puoModificare ? (
                <span className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    aria-label={`Titolare del turno, ${g.giorno}`}
                    className="input-field h-11"
                    value={g.titolare?.id ?? ''}
                    disabled={az.occupato}
                    onChange={(e) => void scegli(g.giorno, e.target.value ? Number(e.target.value) : null, e.target.value ? (g.sostituto?.id ?? null) : null)}
                  >
                    <option value="">Nessun turno</option>
                    {d.tecnici.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Sostituto del turno, ${g.giorno}`}
                    className="input-field h-11"
                    value={g.sostituto?.id ?? ''}
                    disabled={az.occupato || !g.titolare}
                    onChange={(e) => g.titolare && void scegli(g.giorno, g.titolare.id, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Senza sostituto</option>
                    {d.tecnici
                      .filter((x) => x.id !== g.titolare?.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nome}
                        </option>
                      ))}
                  </select>
                </span>
              ) : (
                <span className="flex-1 text-[14px] text-ink">
                  {g.titolare ? `${g.titolare.nome}${g.sostituto ? `, sostituto ${g.sostituto.nome}` : ''}` : <span className="text-ink-muted">Nessun turno</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {!d.puoModificare && d.giorni.length > 0 && (
        <div className="mt-3">
          <Blocco>I turni li cambia il coordinatore</Blocco>
        </div>
      )}
      {az.messaggio}
    </Scheda>
  );
}

/** Pronto Ispezioni lato studio (SPEC_GESTIONALE 12): la scrivania del tecnico di turno. */
export default function Ispezioni() {
  const { versione, aziendaScelta } = usePortale();
  const azId = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<SchedaPronto>('aperte');
  const [adesso, setAdesso] = useState(() => new Date());
  const [chiusuraDi, setChiusuraDi] = useState<RichiestaPronto | null>(null);
  const v = useCarico(() => vistaPronto(), [versione]);
  const az = useAzione();

  // Conto alla rovescia e aggiornamento di riserva.
  const ricaricaVista = v.carica;
  useEffect(() => {
    const t = window.setInterval(() => setAdesso(new Date()), 1_000);
    const a = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      clearApiCache();
      ricaricaVista();
    }, AGGIORNA_MS);
    return () => {
      window.clearInterval(t);
      window.clearInterval(a);
    };
  }, [ricaricaVista]);

  const d = v.dati;
  const aperte = useMemo(() => (d?.aperte ?? []).filter((r) => !azId || r.aziendaId === azId), [d, azId]);
  const storico = useMemo(() => (d?.storico ?? []).filter((r) => !azId || r.aziendaId === azId), [d, azId]);
  const massimoMese = Math.max(1, ...(d?.kpi.perMese ?? []).map((m) => m.richieste));

  const dopo = (fatto: boolean) => {
    if (fatto) v.carica();
    return fatto;
  };
  const toastPasso: Record<PassoPronto, string> = {
    presa: 'Presa in carico: richiama adesso.',
    chiamando: 'Chiamata in uscita registrata.',
    in_chiamata: 'Richiamata registrata.',
    chiusa: 'Telefonata chiusa: in attesa del verbale.',
    fascicolo: 'Fascicolo inviato al titolare.',
  };
  const passo = (r: RichiestaPronto, p: PassoPronto) => {
    // Chiudere senza aver mandato il fascicolo chiede conferma (04 gestionale 8.1).
    if (p === 'chiusa' && !r.fascicoloInviatoIl) {
      setChiusuraDi(r);
      return;
    }
    void az.esegui(() => avanzaPasso(r.id, p), toastPasso[p]).then(dopo);
  };
  const chiudiTelefonata = async (inviaPrima: boolean) => {
    const r = chiusuraDi;
    if (!r) return;
    const ok = await az.esegui(async () => {
      if (inviaPrima) await avanzaPasso(r.id, 'fascicolo');
      return avanzaPasso(r.id, 'chiusa');
    }, toastPasso.chiusa);
    if (ok) setChiusuraDi(null);
    dopo(ok);
  };

  const turno = d?.turnoOggi;
  return (
    <div className="space-y-5">
      <Testata
        categoria="ispezioni"
        icona={ScudoAllerta}
        sopra={aziendaScelta?.ragione_sociale ?? 'Sicurezza'}
        titolo="Pronto Ispezioni"
        sotto={d ? `Richiamata entro ${d.minutiRichiamata} minuti, ${d.finestra}. ${d.inFinestra ? 'Servizio attivo ora.' : 'Ora fuori orario.'}` : 'Richiamata entro 15 minuti dalla richiesta.'}
      />
      {d && (
        <div data-falco="pronto_numeri" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Riquadro etichetta="Richieste aperte" valore={aperte.length} nero={aperte.length > 0} />
          <Riquadro etichetta="In ritardo ora" valore={aperte.filter((r) => r.inRitardo).length} tono={aperte.some((r) => r.inRitardo) ? 'danger' : undefined} />
          <Riquadro etichetta="Tempo medio di richiamata" valore={d.kpi.mediaMinuti} unita="min" sotto="ultimi 30 giorni" />
          <Riquadro etichetta={`Entro ${d.minutiRichiamata} minuti`} valore={d.kpi.entroObiettivoPct} unita="%" sotto={`${d.kpi.richiamate30} richiamate in 30 giorni`} tono={d.kpi.entroObiettivoPct !== null && d.kpi.entroObiettivoPct < 90 ? 'warn' : undefined} />
        </div>
      )}
      {d && (
        <p data-falco="pronto_turno_oggi" className="text-[14px] text-ink">
          {turno?.titolare ? (
            <>
              Di turno oggi: <span className="font-medium">{turno.titolare.nome}</span>
              {turno.sostituto && <>, sostituto {turno.sostituto.nome}</>}. Senza presa in carico dopo {d.minutiAvvisoTitolare} minuti avvisiamo il titolare dello studio.
            </>
          ) : (
            <span className="text-ink-muted">Oggi non c’è un turno impostato: le richieste arrivano a tutto lo studio.</span>
          )}
        </p>
      )}
      <Schede<SchedaPronto>
        etichetta="Pronto Ispezioni"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'aperte', t: 'Adesso', n: aperte.length, falco: 'pronto_aperte' },
          { k: 'storico', t: 'Storico', falco: 'pronto_storico' },
          { k: 'turni', t: 'Turni', falco: 'pronto_turni' },
        ]}
      />
      {v.errore && <Errore testo={v.errore} onRiprova={v.carica} />}
      {!d && !v.errore && <Caricamento />}
      {d && scheda === 'aperte' && (
        <div className="space-y-3">
          {aperte.length === 0 ? (
            <Vuoto titolo="Nessuna ispezione in corso">Quando un cliente preme «Ho un’ispezione in corso» o chiama il numero dedicato, la richiesta compare qui e il tecnico di turno riceve l’avviso.</Vuoto>
          ) : (
            aperte.map((r) => (
              <div key={r.id} className="space-y-4">
                <RiquadroChiamata
                  r={r}
                  adesso={adesso}
                  turno={turno?.titolare?.nome ?? null}
                  coordinatore={null}
                  occupato={az.occupato}
                  onPasso={(p) => passo(r, p)}
                />
                <Lavoro
                  r={r}
                  esiti={d.esiti}
                  occupato={az.occupato}
                  onPasso={(p) => passo(r, p)}
                  onNota={(tipo, t) => az.esegui(() => aggiungiNota(r.id, tipo, t), 'Nota aggiunta.').then(dopo)}
                  onArchivia={(esito, nota) =>
                    void az.esegui(() => chiudiRichiesta(r.id, esito, nota), 'Ispezione archiviata: prescrizioni nello scadenziario.').then((ok) => {
                      if (dopo(ok)) setScheda('storico');
                    })
                  }
                />
              </div>
            ))
          )}
        </div>
      )}
      {d && scheda === 'storico' && (
        <div className="space-y-4">
          {d.kpi.perMese.length > 0 && (
            <Scheda titolo="Richieste per mese" sotto="Ultimi sei mesi, aziende che segui.">
              <ul className="space-y-2">
                {d.kpi.perMese.map((m) => (
                  <li key={m.mese} className="flex items-center gap-3 text-[13.5px]">
                    <span className="inline-block w-20 shrink-0 text-ink-muted first-letter:uppercase">{etichettaMese(m.mese)}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-perla-velo">
                      <span className="block h-full rounded-full bg-grafite-900" style={{ width: `${Math.round((100 * m.richieste) / massimoMese)}%` }} />
                    </span>
                    <span className="cifre w-8 text-right text-ink">{m.richieste}</span>
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
          <Scheda titolo="Controlli chiusi">
            {storico.length === 0 ? (
              <Vuoto titolo="Nessun controllo archiviato" />
            ) : (
              <ul className="divide-y divide-perla-linea">
                {storico.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{r.azienda}</span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {[dataIt(r.richiestaIl), r.ente, r.minutiAllaRichiamata !== null ? `richiamata in ${r.minutiAllaRichiamata} min` : 'senza richiamata'].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    {r.esitoChiusuraTesto && <Chip stato={r.esitoChiusura === 'in_regola' || r.esitoChiusura === 'nessun_controllo' ? 'ok' : r.esitoChiusura === 'rinviata' ? 'neutral' : 'warn'}>{r.esitoChiusuraTesto}</Chip>}
                  </li>
                ))}
              </ul>
            )}
          </Scheda>
        </div>
      )}
      {scheda === 'turni' && <Turni />}

      <Foglio
        aperto={chiusuraDi !== null}
        titolo="Chiudi la telefonata"
        onChiudi={() => setChiusuraDi(null)}
        piede={
          <span className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-[44px]" disabled={az.occupato} onClick={() => void chiudiTelefonata(true)}>
              Invia e chiudi
            </button>
            <button type="button" className="btn-ghost min-h-[44px]" disabled={az.occupato} onClick={() => void chiudiTelefonata(false)}>
              Chiudi senza inviare
            </button>
          </span>
        }
      >
        <Avviso tono="warn">
          Il fascicolo non è stato inviato al titolare. Di solito si manda durante la telefonata, così il titolare sa dove trovare ogni documento.
        </Avviso>
      </Foglio>
      {az.messaggio}
    </div>
  );
}
