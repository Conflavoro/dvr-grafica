'use client';

import { usePermessiStaff } from '@/lib/portale/gestionale-permessi';
import { useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Errore, Foglio, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { CalendarioGiornate, FattureDelCentro } from './PartnerFatture';
import { Avviso, Campo, ChipStato, useAzione, useCarico } from '../amministrazione-kit';
import { creaGiornata, giornata as caricaGiornata, giornate, segnaPosto, type Giornata as TGiornata } from '@/lib/portale/amministrazione-api';
import { STATI_ASSENZA, STATI_POSTO, chip } from '@/lib/portale/amministrazione-logica';
import { numero, rec, testo } from '@/lib/portale/api';
import { Piu, Visita } from '@/components/icone';

const PRESTAZIONI: Record<string, string> = {
  visita: 'Visita',
  audiometria: 'Audiometria',
  spirometria: 'Spirometria',
  esami_ematici: 'Esami ematici',
  visiotest: 'Visiotest',
  drug_test: 'Drug test',
  elettrocardiogramma: 'Elettrocardiogramma',
};

/** Giornata delle visite (SPEC_GESTIONALE 19): convocati, arrivi, visite fatte e assenze. Mai esiti o giudizi. */
export default function Giornata() {
  const { versione, ricarica, apri, aziendaScelta } = usePortale();
  // 16: gestisce la giornata chi ha gestisciGiornata (centro, coordinatore, pianificazione).
  const { puo } = usePermessiStaff();
  const azId = aziendaScelta?.id ?? null;
  const [nuova, setNuova] = useState(false);
  const [aperta, setAperta] = useState<number | null>(null);
  const [scheda, setScheda] = useState<'oggi' | 'calendario' | 'fatture'>('oggi');
  const { dati, errore, carica } = useCarico(() => giornate(azId), [versione, azId]);
  const prossima = dati?.giornate[0];

  return (
    <div className="space-y-5">
      <Testata
        categoria="visite"
        icona={Visita}
        sopra={aziendaScelta?.ragione_sociale ?? 'Portali dei partner'}
        titolo="Giornata delle visite"
        sotto={prossima ? `Prossima giornata il ${dataIt(prossima.data)} al ${prossima.centro}, ${prossima.liberi} posti liberi` : 'Giornate del centro medico'}
        azioni={
          puo('gestisciGiornata') || puo('prenotaVisite') ? (
            <button type="button" className="btn-primary" onClick={() => setNuova(true)}>
              <Piu size={16} aria-hidden /> Nuova giornata
            </button>
          ) : undefined
        }
      />
      <Schede<'oggi' | 'calendario' | 'fatture'>
        etichetta="Giornata delle visite"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'oggi', t: 'Oggi e prossime', falco: 'giornata_oggi' },
          { k: 'calendario', t: 'Calendario', falco: 'giornata_calendario' },
          { k: 'fatture', t: 'Fatture al gestionale', falco: 'giornata_fatture' },
        ]}
      />
      {scheda === 'calendario' && <CalendarioGiornate onApri={(id) => { setAperta(id); apri({ tipo: 'giornata', id }); }} />}
      {scheda === 'fatture' && <FattureDelCentro />}
      {scheda === 'oggi' && (
        <>
      <Avviso>Il centro vede nome, azienda, mansione, orario e prestazioni previste. Esiti e giudizi restano nella cartella del medico competente: qui non si registrano.</Avviso>
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}
      {dati && dati.giornate.length === 0 && <Vuoto titolo="Nessuna giornata in calendario">Crea una giornata e mettici le visite da prenotare.</Vuoto>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {dati?.giornate.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => {
                setAperta(g.id);
                apri({ tipo: 'giornata', id: g.id });
              }}
              className="premi flex w-full flex-col gap-2 rounded-[1.25rem] bg-white p-4 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
            >
              <span className="inline-block text-[13px] text-ink-muted first-letter:uppercase">{new Date(`${g.data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="text-[17px] font-medium text-ink">{g.centro}</span>
              <span className="text-[13px] text-ink-muted">
                Dalle {g.ora_inizio}, uno ogni {g.passo_minuti} minuti
              </span>
              <span className="mt-1 h-2 overflow-hidden rounded-full bg-perla-velo" aria-hidden>
                <span className="block h-full bg-cat-visite-segno" style={{ width: `${g.posti ? Math.round((g.prenotati / g.posti) * 100) : 0}%` }} />
              </span>
              <span className="text-[13px] text-ink">
                {g.prenotati} su {g.posti} prenotati · {g.liberi} liberi
              </span>
            </button>
          </li>
        ))}
      </ul>
        </>
      )}
      <FoglioNuova aperto={nuova} onChiudi={() => setNuova(false)} onFatto={() => { setNuova(false); carica(); ricarica(); }} />
      <FoglioGiornata gestisce={puo('gestisciGiornata')} id={aperta} onChiudi={() => setAperta(null)} onFatto={() => { carica(); ricarica(); }} />
    </div>
  );
}

function FoglioNuova({ aperto, onChiudi, onFatto }: { aperto: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [f, setF] = useState({ data: '', centro: '', indirizzo: '', maps_url: '', medico: '', ora_inizio: '08:30', passo_minuti: 20, posti: 12 });
  const az = useAzione();
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Foglio
      aperto={aperto}
      titolo="Nuova giornata delle visite"
      onChiudi={onChiudi}
      piede={
        <button type="button" className="btn-primary" disabled={az.occupato || !f.data || !f.centro} onClick={() => az.esegui(() => creaGiornata({ ...f, maps_url: f.maps_url || undefined }), 'Giornata creata.').then((ok) => ok && onFatto())}>
          Crea la giornata
        </button>
      }
    >
      <div className="space-y-4">
        <Campo etichetta="Data">
          <input className="input-field" type="date" value={f.data} onChange={(e) => set('data', e.target.value)} />
        </Campo>
        <Campo etichetta="Centro medico">
          <input className="input-field" value={f.centro} onChange={(e) => set('centro', e.target.value)} />
        </Campo>
        <Campo etichetta="Indirizzo">
          <input className="input-field" value={f.indirizzo} onChange={(e) => set('indirizzo', e.target.value)} />
        </Campo>
        <Campo etichetta="Link della posizione" aiuto="Va nel promemoria del lavoratore.">
          <input className="input-field" type="url" placeholder="https://" value={f.maps_url} onChange={(e) => set('maps_url', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etichetta="Dalle">
            <input className="input-field" type="time" value={f.ora_inizio} onChange={(e) => set('ora_inizio', e.target.value)} />
          </Campo>
          <Campo etichetta="Passo">
            <select className="input-field" value={f.passo_minuti} onChange={(e) => set('passo_minuti', Number(e.target.value))}>
              {[10, 15, 20, 30].map((p) => (
                <option key={p} value={p}>
                  {p} min
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Posti">
            <input className="input-field" type="number" min={1} max={60} value={f.posti} onChange={(e) => set('posti', Number(e.target.value) || 1)} />
          </Campo>
        </div>
        <Campo etichetta="Medico">
          <input className="input-field" value={f.medico} onChange={(e) => set('medico', e.target.value)} />
        </Campo>
      </div>
      {az.messaggio}
    </Foglio>
  );
}

function FoglioGiornata({ id, gestisce, onChiudi, onFatto }: { id: number | null; gestisce: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [g, setG] = useState<TGiornata | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [visita, setVisita] = useState<Record<string, unknown> | null>(null);
  const [prestazioni, setPrestazioni] = useState<string[]>(['visita']);
  const [prossima, setProssima] = useState('');
  const az = useAzione();
  const carica = () => id !== null && caricaGiornata(id).then(setG).catch((e: Error) => setErrore(e.message));
  useEffect(() => {
    setG(null);
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const segna = (posto: number, body: { stato: string; prestazioni?: string[]; prossima_visita?: string }, ok: string) =>
    az.esegui(async () => { setG(await segnaPosto(posto, body)); onFatto(); }, ok);
  const oggi = g ? new Date(`${g.data}T00:00:00`) <= new Date() : false;
  return (
    <Foglio largo aperto={id !== null} titolo={g ? `${dataIt(g.data)} · ${g.centro}` : 'Giornata'} onChiudi={onChiudi}>
      {errore && <Errore testo={errore} />}
      {!g && !errore && <Caricamento />}
      {g && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Riquadro etichetta="Prenotati" valore={g.prenotati} sotto={`su ${g.posti}`} />
            <Riquadro etichetta="Arrivati" valore={g.arrivati} />
            <Riquadro etichetta="Visitati" valore={g.visitati} />
            <Riquadro etichetta="Assenti" valore={g.assenti} tono={g.assenti > 0 ? 'danger' : undefined} />
          </div>
          {!oggi && <Avviso>Arrivi, visite fatte e assenze si segnano dal giorno della visita.</Avviso>}
          <Scheda titolo="Convocati">
            {g.posti_prenotati.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessuno: metti le visite da Prenotazioni.</p>
            ) : (
              g.posti_prenotati.map((p) => {
                const pid = numero(p.id) ?? 0;
                const stato = testo(p.stato) ?? 'atteso';
                const ass = p.assenza ? rec(p.assenza) : null;
                return (
                  <div key={pid} className="flex flex-wrap items-center gap-2 border-b border-perla-linea py-3 last:border-b-0">
                    <span className="cifre w-14 shrink-0 text-[16px] text-ink">{testo(p.orario)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{testo(p.lavoratore)}</span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {testo(p.azienda)} · {testo(p.mansione) ?? 'mansione da indicare'} · {testo(p.tipo_visita) ?? 'visita'}
                        {(numero(p.assenze_precedenti) ?? 0) > 0 ? ' · ha già un\'assenza, la prossima si paga' : ''}
                      </span>
                    </span>
                    <ChipStato c={chip(STATI_POSTO, stato)} />
                    {ass && <ChipStato c={chip(STATI_ASSENZA, testo(ass.esito))} />}
                    {gestisce && oggi && ['atteso', 'arrivato'].includes(stato) && (
                      <span className="flex w-full flex-wrap gap-2 sm:w-auto">
                        {stato === 'atteso' && (
                          <button type="button" className="btn-ghost" disabled={az.occupato} onClick={() => segna(pid, { stato: 'arrivato' }, 'Arrivo registrato.')}>
                            Registra l&apos;arrivo
                          </button>
                        )}
                        <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => setVisita(p)}>
                          Visita fatta
                        </button>
                        <button type="button" className="btn-ghost" disabled={az.occupato} onClick={() => segna(pid, { stato: 'assente' }, 'Assenza registrata: la visita torna da prenotare.')}>
                          Assente
                        </button>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </Scheda>
        </div>
      )}
      <Foglio
        aperto={visita !== null}
        titolo={visita ? `Visita fatta: ${testo(visita.lavoratore)}` : ''}
        onChiudi={() => setVisita(null)}
        piede={
          <button
            type="button"
            className="btn-primary"
            disabled={az.occupato}
            onClick={() => visita && segna(numero(visita.id) ?? 0, { stato: 'visitato', prestazioni, prossima_visita: prossima || undefined }, 'Visita registrata.').then((ok) => ok && setVisita(null))}
          >
            Registra
          </button>
        }
      >
        <div className="space-y-4">
          <Avviso tono="warn">Qui non si registrano esiti o giudizi: solo le prestazioni eseguite, per la fattura del centro.</Avviso>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-[13px] font-medium text-ink">Prestazioni eseguite</legend>
            {Object.entries(PRESTAZIONI).map(([k, t]) => (
              <label key={k} className="flex min-h-[44px] items-center gap-3 text-[14px]">
                <input type="checkbox" className="h-5 w-5" checked={prestazioni.includes(k)} onChange={(e) => setPrestazioni((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                {t}
              </label>
            ))}
          </fieldset>
          <Campo etichetta="Prossima visita" aiuto="La data la indica il medico competente. Nasce la scadenza da prenotare.">
            <input className="input-field" type="date" value={prossima} onChange={(e) => setProssima(e.target.value)} />
          </Campo>
        </div>
      </Foglio>
      {az.messaggio}
    </Foglio>
  );
}
