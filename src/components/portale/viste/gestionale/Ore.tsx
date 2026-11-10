'use client';

import { useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, Pillole, useAziendeStudio, useAzione, useCarico } from '../amministrazione-kit';
import { aggiungiOre, confermaOre, eliminaOre, mieOre, orePerAzienda } from '@/lib/portale/amministrazione-api';
import { FASI_ORE, durata, lunedi, minutiDaModulo, spostaGiorni } from '@/lib/portale/amministrazione-logica';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { Cestino, Indietro, Avanti, Orologio, Piu } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { caricaOreFasi } from '@/lib/portale/gestionale-api';
import { caricaOrePersone, riepilogoFasi, usePermessiStaff } from '@/lib/portale/gestionale-permessi';

type Scheda = 'mie' | 'aziende' | 'fasi' | 'persone';

const TIMER_KEY = 'crm_dvr_ore_timer';

/** Registro ore (SPEC_GESTIONALE 17): ognuno le sue; il riepilogo per azienda lo vede l'amministrazione, senza classifiche. */
export default function Ore() {
  const { user, versione, aziendaScelta } = usePortale();
  const azId = aziendaScelta?.id ?? null;
  const diQuesta = (x: Record<string, unknown>) => !azId || numero(x.azienda_id) === azId;
  // 13: tutti i ruoli interni vedono per azienda e per fase; le ore delle singole persone solo la direzione.
  const { puo } = usePermessiStaff();
  const direzione = puo('orePerPersona');
  void user;
  const [scheda, setScheda] = useState<Scheda>('mie');
  const [settimana, setSettimana] = useState(() => lunedi(new Date().toISOString().slice(0, 10)));
  const [aggiungi, setAggiungi] = useState<{ minuti?: number; fonte?: 'timer' } | null>(null);
  const mie = useCarico(() => mieOre(settimana), [settimana, versione]);
  const per = useCarico(() => (scheda === 'aziende' ? orePerAzienda(12) : Promise.resolve(null)), [scheda, versione]);
  const fasi = useCarico(() => (scheda === 'fasi' ? caricaOreFasi(12) : Promise.resolve(null)), [scheda, versione]);
  const persone = useCarico(() => (scheda === 'persone' && direzione ? caricaOrePersone() : Promise.resolve(null)), [scheda, direzione, versione]);
  const az = useAzione();
  const d0 = mie.dati ?? {};
  // Con il cliente scelto: solo le ore su quell'azienda, totali ricalcolati.
  const giorniFiltrati = lista(d0.giorni).map((g) => {
    const x = rec(g);
    const voci = lista(x.voci).map(rec).filter(diQuesta);
    return azId ? { ...x, voci, minuti: voci.reduce((t, v) => t + (numero(v.minuti) ?? 0), 0) } : x;
  });
  const tutteVoci = giorniFiltrati.flatMap((g) => lista(rec(g).voci).map(rec));
  const d: Record<string, unknown> = azId
    ? {
        ...d0,
        giorni: giorniFiltrati,
        totale_minuti: tutteVoci.reduce((t, v) => t + (numero(v.minuti) ?? 0), 0),
        confermati_minuti: tutteVoci.filter((v) => v.stato !== 'da_confermare').reduce((t, v) => t + (numero(v.minuti) ?? 0), 0),
      }
    : d0;
  const proposte = lista(d.proposte).map(rec).filter(diQuesta);
  const righePer = lista(per.dati?.aziende).map(rec).filter(diQuesta);

  return (
    <div className="space-y-5">
      <Testata
        categoria="utenti"
        icona={Orologio}
        sopra={aziendaScelta?.ragione_sociale ?? 'Amministrazione'}
        titolo="Registro ore"
        sotto="Obiettivo del progetto: da 3 a 2 ore di lavoro interno per lavoratore all'anno."
        azioni={
          <button type="button" className="btn-primary" onClick={() => setAggiungi({})}>
            <Piu size={16} aria-hidden /> Aggiungi ore a mano
          </button>
        }
      />
      <Schede<Scheda>
        etichetta="Registro ore"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'mie', t: 'Le mie ore', n: proposte.length },
          { k: 'aziende', t: 'Per azienda' },
          { k: 'fasi', t: 'Per fase' },
          ...(direzione ? [{ k: 'persone' as Scheda, t: 'Per persona' }] : []),
        ]}
      />

      {scheda === 'mie' && (
        <>
          <Timer onFerma={(m) => setAggiungi({ minuti: m, fonte: 'timer' })} />
          {mie.errore && <Errore testo={mie.errore} onRiprova={mie.carica} />}
          {!mie.dati && !mie.errore && <Caricamento />}
          {mie.dati && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Riquadro etichetta="Questa settimana" valore={durata(numero(d.totale_minuti) ?? 0)} />
                <Riquadro etichetta="Confermate" valore={durata(numero(d.confermati_minuti) ?? 0)} />
                <Riquadro etichetta="Da confermare" valore={proposte.length} tono={proposte.length > 0 ? 'warn' : undefined} />
              </div>
              {proposte.length > 0 && (
                <Scheda titolo="Proposte da confermare" sotto="Le ore proposte dalle attività non si confermano da sole.">
                  {proposte.map((p) => {
                    const id = numero(p.id) ?? 0;
                    return (
                      <Riga
                        key={id}
                        titolo={`${durata(numero(p.minuti) ?? 0)} · ${testo(p.fase_nome)}`}
                        sotto={`${testo(p.azienda) ?? 'Attività interna'} · ${testo(p.nota) ?? ''} · ${dataIt(testo(p.data))}`}
                        fine={
                          <span className="flex gap-1">
                            <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px]" disabled={az.occupato} onClick={() => az.esegui(() => confermaOre(id), 'Ore confermate.').then((ok) => ok && mie.carica())}>
                              Conferma
                            </button>
                            <button type="button" className="btn-icon" aria-label="Scarta la proposta" onClick={() => az.esegui(() => eliminaOre(id), 'Proposta scartata.').then((ok) => ok && mie.carica())}>
                              <Cestino size={16} aria-hidden />
                            </button>
                          </span>
                        }
                      />
                    );
                  })}
                </Scheda>
              )}
              <Scheda
                titolo="La settimana"
                sotto={`Dal ${dataIt(settimana)} · totale ${durata(numero(d.totale_minuti) ?? 0)}`}
                azioni={
                  <span className="flex gap-1">
                    <button type="button" className="btn-icon" aria-label="Settimana precedente" onClick={() => setSettimana((s) => spostaGiorni(s, -7))}>
                      <Indietro size={18} aria-hidden />
                    </button>
                    <button type="button" className="btn-icon" aria-label="Settimana successiva" onClick={() => setSettimana((s) => spostaGiorni(s, 7))}>
                      <Avanti size={18} aria-hidden />
                    </button>
                  </span>
                }
              >
                {lista(d.giorni).map((g) => {
                  const x = rec(g);
                  const voci = lista(x.voci).map(rec);
                  return (
                    <div key={testo(x.data) ?? ''} className="border-b border-perla-linea py-2.5 last:border-b-0">
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="text-ink">{giornoSettimana(testo(x.data))}</span>
                        <span className="cifre text-ink-muted">{durata(numero(x.minuti) ?? 0)}</span>
                      </div>
                      {voci.map((v) => (
                        <p key={numero(v.id) ?? 0} className={clsx('mt-1 text-[12.5px]', v.stato === 'da_confermare' ? 'text-[#a86800]' : 'text-ink-muted')}>
                          {durata(numero(v.minuti) ?? 0)} · {testo(v.fase_nome)} · {testo(v.azienda) ?? 'attività interna'}
                          {v.stato === 'da_confermare' ? ' · da confermare' : ''}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </Scheda>
            </>
          )}
        </>
      )}

      {scheda === 'aziende' && (
        <>
          {per.errore && <Errore testo={per.errore} onRiprova={per.carica} />}
          {!per.dati && !per.errore && <Caricamento />}
          {per.dati && (
            <>
              {!azId && (
              <div className="grid grid-cols-3 gap-3">
                <Riquadro etichetta="Ore registrate (12 mesi)" valore={numero(per.dati.totale_ore) ?? 0} unita="h" />
                <Riquadro etichetta="Per lavoratore all'anno" valore={numero(per.dati.per_lavoratore_anno)} unita="h" sotto="Obiettivo 2, allarme oltre 3" />
                <Riquadro etichetta="Aziende sopra budget" valore={numero(per.dati.sopra_budget) ?? 0} />
              </div>
              )}
              <Avviso>Le ore servono a misurare processi e margini, non le persone. Nessuna classifica.</Avviso>
              <Scheda titolo={azId ? 'Ore su questa azienda' : 'Per azienda'}>
                {righePer.length === 0 ? (
                  <Vuoto titolo={azId ? 'Nessuna ora registrata su questa azienda' : 'Nessuna azienda'} />
                ) : (
                  righePer.map((x) => {
                    const r = rec(x);
                    const s = testo(r.stato);
                    return (
                      <Riga
                        key={numero(r.azienda_id) ?? 0}
                        titolo={testo(r.ragione_sociale) ?? ''}
                        sotto={`${numero(r.lavoratori)} lavoratori · ${numero(r.ore_fatte)} h fatte su ${numero(r.budget)} h previste · ${numero(r.per_lavoratore_anno)} h per lavoratore all'anno`}
                        fine={<span className={clsx('text-[13px]', s === 'oltre' ? 'text-[#d63d3e]' : s === 'sopra' ? 'text-[#a86800]' : 'text-ink-muted')}>{s === 'oltre' ? 'Oltre budget' : s === 'sopra' ? 'Sopra budget' : s === 'sotto' ? 'Sotto budget' : 'In linea'}</span>}
                      />
                    );
                  })
                )}
              </Scheda>
            </>
          )}
        </>
      )}
      {scheda === 'fasi' && (
        <>
          {fasi.errore && <Errore testo={fasi.errore} onRiprova={fasi.carica} />}
          {!fasi.dati && !fasi.errore && <Caricamento />}
          {fasi.dati && (
            <Scheda titolo="Per fase" sotto={`Budget: ore per lavoratore × ${fasi.dati.lavoratori} lavoratori seguiti, ultimi 12 mesi.`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-perla-linea text-left text-[12.5px] text-ink-muted">
                      <th className="px-3 py-2 font-medium">Fase</th>
                      <th className="px-3 py-2 text-right font-medium">Ore per lavoratore</th>
                      <th className="px-3 py-2 text-right font-medium">Budget</th>
                      <th className="px-3 py-2 text-right font-medium">Fatto</th>
                      <th className="px-3 py-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fasi.dati.fasi.map((f) => (
                      <tr key={f.fase} className="border-b border-perla-linea last:border-b-0">
                        <td className="px-3 py-2 text-ink">{f.nome}</td>
                        <td className="cifre px-3 py-2 text-right">{f.coefficiente.toLocaleString('it-IT')}</td>
                        <td className="cifre px-3 py-2 text-right">{f.budget.toLocaleString('it-IT')} h</td>
                        <td className="cifre px-3 py-2 text-right">{f.fatte.toLocaleString('it-IT')} h</td>
                        <td className={clsx('px-3 py-2', f.stato === 'oltre' ? 'text-stato-danger-segno' : f.stato === 'sopra' ? 'text-stato-warn-segno' : 'text-ink-muted')}>
                          {f.stato === 'oltre' ? 'Oltre budget' : f.stato === 'sopra' ? 'Sopra budget' : f.stato === 'sotto' ? 'Sotto budget' : 'In linea'}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="px-3 py-2">Totale</td>
                      <td className="cifre px-3 py-2 text-right">{fasi.dati.fasi.reduce((t, f) => t + f.coefficiente, 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</td>
                      <td className="cifre px-3 py-2 text-right">{fasi.dati.fasi.reduce((t, f) => t + f.budget, 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })} h</td>
                      <td className="cifre px-3 py-2 text-right">{fasi.dati.fasi.reduce((t, f) => t + f.fatte, 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })} h</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Scheda>
          )}
        </>
      )}

      {scheda === 'persone' && !direzione && <Vuoto titolo="Non disponibile">Le ore delle singole persone le vede solo la direzione.</Vuoto>}
      {scheda === 'persone' && direzione && (
        <>
          <Avviso>
            <strong className="font-medium">Le ore servono a misurare processi e margini, non le persone</strong>
            <br />
            Nessuna classifica e nessuna decisione sulle persone si prende da questi numeri. L&apos;elenco è in ordine alfabetico.
          </Avviso>
          {persone.errore && <Errore testo={persone.errore} onRiprova={persone.carica} />}
          {!persone.dati && !persone.errore && <Caricamento />}
          {persone.dati && (
            <Scheda titolo="Per persona" sotto={`Settimana dal ${dataIt(persone.dati.dal)} al ${dataIt(persone.dati.al)}. Ogni persona vede solo le proprie ore.`}>
              {persone.dati.persone.map((x) => (
                <Riga
                  key={x.id}
                  titolo={x.nome}
                  sotto={`${x.ruolo ?? ''}${x.ruolo ? ' · ' : ''}${riepilogoFasi(x.fasi, durata)}`}
                  fine={
                    <span className="cifre text-right text-[13px] text-ink-muted">
                      {durata(x.confermate)} confermate · {durata(x.daConfermare)} da confermare
                      <span className="block text-ink">Totale {durata(x.totale)}</span>
                    </span>
                  }
                />
              ))}
            </Scheda>
          )}
        </>
      )}
      <FoglioOre dati={aggiungi} onChiudi={() => setAggiungi(null)} onFatto={() => { setAggiungi(null); mie.carica(); }} />
      {az.messaggio}
    </div>
  );
}

function Timer({ onFerma }: { onFerma: (minuti: number) => void }) {
  const [inizio, setInizio] = useState<number | null>(null);
  const [ora, setOra] = useState(Date.now());
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(TIMER_KEY));
      if (v > 0) setInizio(v);
    } catch {
      /* comodita' del browser */
    }
  }, []);
  useEffect(() => {
    if (!inizio) return;
    const id = setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inizio]);
  const salva = (v: number | null) => {
    setInizio(v);
    try {
      if (v) window.localStorage.setItem(TIMER_KEY, String(v));
      else window.localStorage.removeItem(TIMER_KEY);
    } catch {
      /* comodita' del browser */
    }
  };
  const sec = inizio ? Math.max(0, Math.floor((ora - inizio) / 1000)) : 0;
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-black p-4 text-white">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-grafite-300">Cronometro</span>
        <span className="cifre text-[30px] font-light tracking-[-0.03em]">{inizio ? `${hh}:${mm}:${ss}` : '00:00:00'}</span>
      </span>
      {inizio ? (
        <>
          <button type="button" className="btn-ghost" onClick={() => salva(null)}>
            Annulla
          </button>
          <button
            type="button"
            className="btn-acido"
            onClick={() => {
              onFerma(Math.max(1, Math.round(sec / 60)));
              salva(null);
            }}
          >
            Ferma e registra
          </button>
        </>
      ) : (
        <button type="button" className="btn-acido" onClick={() => salva(Date.now())}>
          Avvia
        </button>
      )}
    </section>
  );
}

function FoglioOre({ dati, onChiudi, onFatto }: { dati: { minuti?: number; fonte?: 'timer' } | null; onChiudi: () => void; onFatto: () => void }) {
  const aziende = useAziendeStudio();
  const { aziendaScelta } = usePortale();
  const [f, setF] = useState({ data: new Date().toISOString().slice(0, 10), azienda: aziendaScelta?.id ?? 0, fase: 'dvr_documenti', ore: 1, minuti: 0, nota: '' });
  const az = useAzione();
  useEffect(() => {
    if (dati?.minuti) setF((x) => ({ ...x, ore: Math.floor(dati.minuti! / 60), minuti: dati.minuti! % 60 }));
  }, [dati]);
  const m = minutiDaModulo(f.ore, f.minuti);
  return (
    <Foglio
      aperto={dati !== null}
      titolo={dati?.fonte === 'timer' ? 'Registra il tempo del cronometro' : 'Aggiungi ore a mano'}
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          disabled={az.occupato || m.errore !== null}
          onClick={() => az.esegui(() => aggiungiOre({ data: f.data, azienda_id: f.azienda || undefined, fase: f.fase, minuti: m.minuti, nota: f.nota || undefined, fonte: dati?.fonte ?? 'manuale' }), 'Ore registrate.').then((ok) => ok && onFatto())}
        >
          Salva
        </button>
      }
    >
      <div className="space-y-4">
        <Campo etichetta="Data">
          <input className="input-field" type="date" max={new Date().toISOString().slice(0, 10)} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </Campo>
        <Campo etichetta="Azienda" aiuto="Lascia vuoto per un'attività interna.">
          <select className="input-field" value={f.azienda} onChange={(e) => setF({ ...f, azienda: Number(e.target.value) })}>
            <option value={0}>Attività interna</option>
            {aziende.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ragione_sociale}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Fase">
          <select className="input-field" value={f.fase} onChange={(e) => setF({ ...f, fase: e.target.value })}>
            {Object.entries(FASI_ORE).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Durata" errore={m.errore}>
          <div className="flex gap-2">
            <select className="input-field" aria-label="Ore" value={f.ore} onChange={(e) => setF({ ...f, ore: Number(e.target.value) })}>
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {i} h
                </option>
              ))}
            </select>
            <select className="input-field" aria-label="Minuti" value={f.minuti} onChange={(e) => setF({ ...f, minuti: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i * 5).map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </select>
          </div>
        </Campo>
        <Pillole etichetta="Durate rapide" attiva={-1} onCambia={(v) => setF({ ...f, ore: Math.floor(v / 60), minuti: v % 60 })} voci={[{ k: 30, t: '30 min' }, { k: 60, t: '1 h' }, { k: 120, t: '2 h' }]} />
        <Campo etichetta="Nota">
          <input className="input-field" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
        </Campo>
      </div>
      {az.messaggio}
    </Foglio>
  );
}

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "2026-10-12" diventa "Lunedì 12 ott", senza dipendere dalla lingua del browser. */
function giornoSettimana(d?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  if (!m) return '';
  const g = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${GIORNI[g]} ${Number(m[3])} ${MESI[Number(m[2]) - 1]}`;
}
