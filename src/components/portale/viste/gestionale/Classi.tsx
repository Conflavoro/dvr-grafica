'use client';

import { usePermessiStaff } from '@/lib/portale/gestionale-permessi';
import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, BarraSelezione, Campo, ChipStato, Spunta, Voce, useAzione, useCarico } from '../amministrazione-kit';
import {
  azioneClasse,
  chiudiRegistro,
  classe as caricaClasse,
  classi,
  creaClasse,
  emettiAttestati,
  fabbisogno,
  scaricaAttestato,
  togliIscritto,
  type Classe,
  type Corso,
} from '@/lib/portale/amministrazione-api';
import { MODALITA, STATI_CONVOCAZIONE, STATI_ESITO, chip, esitoPresenza, modalitaAmmesse, statoClasse } from '@/lib/portale/amministrazione-logica';
import { numero, testo } from '@/lib/portale/api';
import { Chiudi, Corso as IconaCorso, Piu, Scarica } from '@/components/icone';

type Scheda = 'calendario' | 'fabbisogno' | 'registri';

/** Classi di formazione (SPEC_GESTIONALE 14): il Falco propone, una persona conferma ed emette gli attestati. */
export default function Classi() {
  const { versione, ricarica, apri, aziendaScelta } = usePortale();
  // 10: gestisce le classi chi ha gestisciClassi; la segreteria le vede in sola lettura.
  const { puo } = usePermessiStaff();
  const gestisce = puo('gestisciClassi');
  const azId = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<Scheda>('calendario');
  const [aperta, setAperta] = useState<number | null>(null);
  const [nuova, setNuova] = useState<{ scadenze: number[]; tipo?: string } | null>(null);
  const [scelti, setScelti] = useState<number[]>([]);
  const elenco = useCarico(() => classi(azId), [versione, azId]);
  const fab = useCarico(() => fabbisogno(), [versione]);
  const aggiorna = () => {
    elenco.carica();
    fab.carica();
    ricarica();
  };
  const c = elenco.dati?.conteggi ?? {};
  const corsi = elenco.dati?.corsi ?? [];
  const lista = elenco.dati?.classi ?? [];
  const calendario = lista.filter((k) => ['bozza', 'programmata'].includes(k.stato));
  const registri = lista.filter((k) => ['svolta', 'chiusa'].includes(k.stato));
  const titoloCorso = (t: string) => corsi.find((x) => x.tipo === t)?.titolo ?? t;
  const fabVoci = (fab.dati?.voci ?? []).filter((x) => !azId || numero(x.azienda_id) === azId);
  const gruppi = useMemo(() => {
    const m = new Map<string, Array<Record<string, unknown>>>();
    // Con il cliente scelto: solo i suoi lavoratori senza classe.
    for (const v of (fab.dati?.voci ?? []).filter((x) => !azId || numero(x.azienda_id) === azId)) {
      const k = testo(v.tipo_proposto) ?? 'altro';
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [fab.dati, azId]);

  return (
    <div className="space-y-5">
      <Testata
        categoria="formazione"
        icona={IconaCorso}
        sopra={aziendaScelta?.ragione_sociale ?? 'Formazione e visite'}
        titolo="Classi di formazione"
        sotto={elenco.dati ? `${calendario.length} classi in calendario · ${fabVoci.length} lavoratori senza classe · il Falco propone, tu confermi` : undefined}
        azioni={
          gestisce ? (
            <button type="button" className="btn-primary" onClick={() => setNuova({ scadenze: [] })}>
              <Piu size={16} aria-hidden /> Nuova classe
            </button>
          ) : (
            <Blocco>Crea le classi il coordinatore della formazione</Blocco>
          )
        }
      />
      <Schede<Scheda>
        etichetta="Sezioni delle classi"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'calendario', t: 'Calendario', n: numero(c.bozze) ?? 0 },
          { k: 'fabbisogno', t: 'Fabbisogno', n: fabVoci.length },
          { k: 'registri', t: 'Registri', n: numero(c.da_chiudere) ?? 0 },
        ]}
      />
      {elenco.errore && <Errore testo={elenco.errore} onRiprova={elenco.carica} />}
      {!elenco.dati && !elenco.errore && <Caricamento />}

      {elenco.dati && scheda !== 'fabbisogno' && (
        <Scheda titolo={scheda === 'calendario' ? 'In calendario' : 'Registri'} sotto={scheda === 'registri' ? 'Presenza minima del 90% per la verifica; attestato solo con verifica superata.' : undefined}>
          {(scheda === 'calendario' ? calendario : registri).length === 0 ? (
            <Vuoto titolo={scheda === 'calendario' ? 'Nessuna classe in calendario' : 'Nessun registro'} azione={scheda === 'calendario' ? <button type="button" className="btn-ghost" onClick={() => setScheda('fabbisogno')}>Guarda il fabbisogno</button> : undefined}>
              {scheda === 'calendario' ? 'Unisci lavoratori di aziende diverse con lo stesso corso: massimo 30 partecipanti nelle parti teoriche.' : 'Le classi svolte e chiuse compaiono qui.'}
            </Vuoto>
          ) : (
            (scheda === 'calendario' ? calendario : registri).map((k) => (
              <Riga
                key={k.id}
                onClick={() => {
                  setAperta(k.id);
                  apri({ tipo: 'classe', id: k.id });
                }}
                titolo={k.titolo}
                sotto={`${dataIt(k.data_inizio)}${k.ora_inizio ? ` alle ${k.ora_inizio}` : ''} · ${k.ore} ore · ${MODALITA[k.modalita] ?? k.modalita}${k.sede ? ` · ${k.sede}` : ''} · ${k.iscritti_n} su ${k.posti} da ${k.aziende_n === 1 ? '1 azienda' : `${k.aziende_n} aziende`}`}
                fine={<ChipStato c={statoClasse(k.stato, k.oggi)} />}
              />
            ))
          )}
        </Scheda>
      )}

      {scheda === 'fabbisogno' && (
        <>
          {fab.errore && <Errore testo={fab.errore} onRiprova={fab.carica} />}
          {fab.dati && <Avviso>{fab.dati.nota}</Avviso>}
          {fab.dati && gruppi.length === 0 && <Vuoto titolo="Nessun lavoratore senza classe">Il fabbisogno nasce dalle scadenze di formazione: nuovi assunti, aggiornamenti, nomine.</Vuoto>}
          {gruppi.map(([tipo, voci]) => (
            <Scheda key={tipo} titolo={titoloCorso(tipo)} sotto={plurale(voci.length, new Set(voci.map((v) => v.azienda_id)).size)}
              azioni={gestisce ? <button type="button" className="btn-ghost" onClick={() => setNuova({ tipo, scadenze: voci.map((v) => numero(v.scadenza_id) ?? 0) })}>Crea una classe con questi</button> : undefined}>
              {voci.map((v) => {
                const id = numero(v.scadenza_id) ?? 0;
                return (
                  <Riga
                    key={id}
                    onClick={() => setScelti((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                    inizio={<Spunta attiva={scelti.includes(id)} etichetta={`Scegli ${testo(v.lavoratore)}`} onCambia={(on) => setScelti((s) => (on ? [...s, id] : s.filter((x) => x !== id)))} />}
                    titolo={testo(v.lavoratore) ?? ''}
                    sotto={`${testo(v.azienda)} · ${testo(v.mansione) ?? 'mansione da indicare'} · entro ${dataIt(testo(v.entro))}${v.quota_da_pagare ? ' · quota da pagare' : ''}${v.richiesta_azienda ? ' · chiesto dall\'azienda' : ''}`}
                  />
                );
              })}
            </Scheda>
          ))}
          {gestisce && scelti.length > 0 && (
            <BarraSelezione testo={`${scelti.length} lavoratori scelti`}>
              <button type="button" className="btn-ghost" onClick={() => setScelti([])}>
                Togli
              </button>
              <button type="button" className="btn-acido" onClick={() => setNuova({ scadenze: scelti })}>
                Crea una classe
              </button>
            </BarraSelezione>
          )}
        </>
      )}

      <FoglioNuovaClasse dati={nuova} corsi={corsi} onChiudi={() => setNuova(null)} onFatto={(k) => { setNuova(null); setScelti([]); aggiorna(); setScheda('calendario'); setAperta(k.id); }} />
      <FoglioClasse gestisce={gestisce} id={aperta} onChiudi={() => setAperta(null)} onFatto={aggiorna} />
    </div>
  );
}

function FoglioNuovaClasse({ dati, corsi, onChiudi, onFatto }: { dati: { scadenze: number[]; tipo?: string } | null; corsi: Corso[]; onChiudi: () => void; onFatto: (k: Classe) => void }) {
  const [f, setF] = useState({ tipo: '', modalita: 'aula', data_inizio: '', data_fine: '', ora_inizio: '09:00', sede: '', link_videoconferenza: '', docente: '', posti: 30, ore: '' });
  const az = useAzione();
  useEffect(() => {
    if (dati) setF((x) => ({ ...x, tipo: dati.tipo ?? x.tipo ?? '' }));
  }, [dati]);
  const ammesse = modalitaAmmesse(corsi, f.tipo);
  useEffect(() => {
    if (ammesse.length > 0 && !ammesse.includes(f.modalita)) setF((x) => ({ ...x, modalita: ammesse[0] }));
  }, [ammesse, f.modalita]);
  const corso = corsi.find((c) => c.tipo === f.tipo);
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Foglio
      largo
      aperto={dati !== null}
      titolo="Nuova classe"
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          disabled={az.occupato || !f.tipo || !f.data_inizio}
          onClick={() =>
            az.esegui(async () => {
              const k = await creaClasse({ ...f, ore: f.ore ? Number(f.ore) : undefined, data_fine: f.data_fine || undefined, link_videoconferenza: f.link_videoconferenza || undefined, scadenze: dati?.scadenze ?? [] });
              onFatto(k);
            }, 'Classe creata in bozza.')
          }
        >
          Crea in bozza
        </button>
      }
    >
      <div className="space-y-4">
        {dati && dati.scadenze.length > 0 && <Avviso>{dati.scadenze.length} lavoratori dal fabbisogno saranno iscritti.</Avviso>}
        <Campo etichetta="Corso" aiuto={corso ? `${corso.ore ? `Durata minima ${corso.ore} ore · ` : ''}${corso.riferimento}` : 'Scegli il corso: modalità e durata seguono la norma.'}>
          <select className="input-field" value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
            <option value="">Scegli il corso</option>
            {corsi.map((c) => (
              <option key={c.tipo} value={c.tipo}>
                {c.titolo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Modalità" aiuto="Solo le modalità ammesse per il corso. Per l'e-learning serve un computer o un tablet.">
          <select className="input-field" value={f.modalita} onChange={(e) => set('modalita', e.target.value)} disabled={ammesse.length === 0}>
            {(ammesse.length ? ammesse : ['aula']).map((m) => (
              <option key={m} value={m}>
                {MODALITA[m]}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Primo giorno">
            <input className="input-field" type="date" value={f.data_inizio} onChange={(e) => set('data_inizio', e.target.value)} />
          </Campo>
          <Campo etichetta="Ultimo giorno">
            <input className="input-field" type="date" value={f.data_fine} onChange={(e) => set('data_fine', e.target.value)} />
          </Campo>
          <Campo etichetta="Ora di inizio">
            <input className="input-field" type="time" value={f.ora_inizio} onChange={(e) => set('ora_inizio', e.target.value)} />
          </Campo>
          <Campo etichetta="Posti" aiuto="Al massimo 30.">
            <input className="input-field" type="number" min={1} max={30} value={f.posti} onChange={(e) => set('posti', Number(e.target.value) || 1)} />
          </Campo>
        </div>
        {f.modalita === 'aula' ? (
          <Campo etichetta="Sede o aula">
            <input className="input-field" value={f.sede} onChange={(e) => set('sede', e.target.value)} />
          </Campo>
        ) : (
          <Campo etichetta="Link della videoconferenza o della piattaforma">
            <input className="input-field" type="url" placeholder="https://" value={f.link_videoconferenza} onChange={(e) => set('link_videoconferenza', e.target.value)} />
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Docente" aiuto="Con i requisiti previsti per il corso.">
            <input className="input-field" value={f.docente} onChange={(e) => set('docente', e.target.value)} />
          </Campo>
          <Campo etichetta="Ore" aiuto={corso?.ore ? `Almeno ${corso.ore}` : 'Obbligatorie se il corso non ha una durata fissa'}>
            <input className="input-field" type="number" min={1} placeholder={corso?.ore ? String(corso.ore) : ''} value={f.ore} onChange={(e) => set('ore', e.target.value)} />
          </Campo>
        </div>
      </div>
      {az.messaggio}
    </Foglio>
  );
}

function FoglioClasse({ id, gestisce, onChiudi, onFatto }: { id: number | null; gestisce: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [k, setK] = useState<Classe | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [registro, setRegistro] = useState<Record<number, { presenza: number; esito: 'superata' | 'non_superata' }>>({});
  const [verbale, setVerbale] = useState(false);
  const az = useAzione();
  const carica = () => {
    if (id === null) return;
    caricaClasse(id)
      .then((x) => {
        setK(x);
        setErrore(null);
        setRegistro(Object.fromEntries(x.iscritti.map((i) => [i.iscritto_id, { presenza: i.presenza ?? 100, esito: 'superata' as const }])));
      })
      .catch((e: Error) => setErrore(e.message));
  };
  useEffect(() => {
    setK(null);
    setVerbale(false);
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const dopo = (ok: boolean) => {
    if (ok) {
      carica();
      onFatto();
    }
  };
  const oggiInAvanti = k ? new Date(`${k.data_inizio}T00:00:00`) <= new Date() : false;
  return (
    <Foglio
      largo
      aperto={id !== null}
      titolo={k?.titolo ?? 'Classe'}
      onChiudi={onChiudi}
      piede={
        k && !gestisce ? (
          <Blocco>Sola lettura: la classe la gestisce il coordinatore della formazione</Blocco>
        ) : k && (
          <>
            {['bozza', 'programmata'].includes(k.stato) && (
              <button type="button" className="btn-ghost" onClick={() => az.esegui(() => azioneClasse(k.id, 'annulla'), 'Classe annullata: gli iscritti tornano nel fabbisogno.').then(dopo)}>
                Annulla la classe
              </button>
            )}
            {k.stato === 'bozza' && (
              <button type="button" className="btn-acido" disabled={az.occupato} onClick={() => az.esegui(() => azioneClasse(k.id, 'conferma'), 'Classe confermata: convocazioni inviate alle aziende.').then(dopo)}>
                Conferma e convoca
              </button>
            )}
            {k.stato === 'programmata' && oggiInAvanti && (
              <button
                type="button"
                className="btn-primary"
                disabled={az.occupato}
                onClick={() => az.esegui(() => chiudiRegistro(k.id, k.iscritti.map((i) => ({ iscritto_id: i.iscritto_id, presenza: registro[i.iscritto_id]?.presenza ?? 0, esito: registro[i.iscritto_id]?.esito ?? 'superata' }))), 'Registro chiuso.').then(dopo)}
              >
                Chiudi il registro
              </button>
            )}
            {k.stato === 'svolta' && (
              <button type="button" className="btn-acido" disabled={az.occupato || !verbale} onClick={() => az.esegui(() => emettiAttestati(k.id).then((r) => r), 'Attestati emessi: sono nel fascicolo di ogni azienda.').then(dopo)}>
                Emetti gli attestati
              </button>
            )}
          </>
        )
      }
    >
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!k && !errore && <Caricamento />}
      {k && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipStato c={statoClasse(k.stato, k.oggi)} />
            <span className="text-[13px] text-ink-muted">{k.riferimento}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Riquadro etichetta="Iscritti" valore={k.iscritti_n} sotto={`su ${k.posti}`} />
            <Riquadro etichetta="Aziende" valore={k.aziende_n} />
            <Riquadro etichetta="Durata" valore={k.ore} unita="h" />
          </div>
          <div>
            <Voce k="Quando" v={`${dataIt(k.data_inizio)}${k.data_fine && k.data_fine !== k.data_inizio ? ` al ${dataIt(k.data_fine)}` : ''}${k.ora_inizio ? `, alle ${k.ora_inizio}` : ''}`} />
            <Voce k="Modalità" v={`${MODALITA[k.modalita] ?? k.modalita}${k.sede ? `, ${k.sede}` : ''}`} />
            <Voce k="Docente" v={k.docente ?? 'da indicare'} />
          </div>
          {k.stato === 'programmata' && oggiInAvanti && <Avviso>Registro di oggi: segna la presenza in percentuale ed esito della verifica. Sotto il 90% non si accede alla verifica.</Avviso>}
          {k.stato === 'svolta' && (
            <label className="flex min-h-[44px] items-start gap-3 rounded-[1rem] bg-perla-velo p-3 text-[14px]">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={verbale} onChange={(e) => setVerbale(e.target.checked)} />
              Ho controllato il verbale della verifica firmato dal docente.
            </label>
          )}
          <Scheda titolo="Iscritti">
            {k.iscritti.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessun iscritto: aggiungili dal fabbisogno.</p>
            ) : (
              k.iscritti.map((i) => {
                const r = registro[i.iscritto_id] ?? { presenza: 100, esito: 'superata' as const };
                return (
                  <div key={i.iscritto_id} className="border-b border-perla-linea py-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium text-ink">{i.lavoratore}</span>
                        <span className="block text-[12.5px] text-ink-muted">
                          {i.azienda} · {i.mansione ?? 'mansione da indicare'} · {i.generale_fatta ? 'generale fatta' : 'manca la generale'}
                        </span>
                      </span>
                      {k.stato === 'bozza' || k.stato === 'programmata' ? <ChipStato c={chip(STATI_CONVOCAZIONE, i.convocazione)} /> : <ChipStato c={chip(STATI_ESITO, i.esito)} />}
                      {i.attestato && (
                        <button type="button" className="btn-ghost" onClick={() => az.esegui(() => scaricaAttestato(i.iscritto_id, `Attestato_${i.attestato?.codice}`))}>
                          <Scarica size={16} aria-hidden /> Attestato
                        </button>
                      )}
                      {['bozza', 'programmata'].includes(k.stato) && !oggiInAvanti && (
                        <button type="button" className="btn-icon" aria-label={`Togli ${i.lavoratore}`} onClick={() => az.esegui(() => togliIscritto(k.id, i.iscritto_id)).then(dopo)}>
                          <Chiudi size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                    {k.stato === 'programmata' && oggiInAvanti && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
                          Presenza
                          <input className="input-field h-11 w-20" type="number" min={0} max={100} value={r.presenza} onChange={(e) => setRegistro((x) => ({ ...x, [i.iscritto_id]: { ...r, presenza: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } }))} />%
                        </label>
                        <select className="input-field h-11 w-auto" value={r.esito} onChange={(e) => setRegistro((x) => ({ ...x, [i.iscritto_id]: { ...r, esito: e.target.value as 'superata' | 'non_superata' } }))}>
                          <option value="superata">Verifica superata</option>
                          <option value="non_superata">Non superata</option>
                        </select>
                        <ChipStato c={chip(STATI_ESITO, esitoPresenza(r.presenza, r.esito))} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Scheda>
          <Scheda titolo="Requisiti">
            <ul className="space-y-1.5 text-[13.5px] text-ink">
              {k.requisiti.map((q) => (
                <li key={q} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cat-formazione-segno" />
                  {q}
                </li>
              ))}
            </ul>
          </Scheda>
        </div>
      )}
      {az.messaggio}
    </Foglio>
  );
}

function plurale(lavoratori: number, aziende: number): string {
  return `${lavoratori === 1 ? '1 lavoratore' : `${lavoratori} lavoratori`} da ${aziende === 1 ? '1 azienda' : `${aziende} aziende`}`;
}
