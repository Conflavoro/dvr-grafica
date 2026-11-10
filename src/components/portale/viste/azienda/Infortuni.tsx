'use client';

import { useEffect, useRef, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Riquadro, Testata, Vuoto, dataIt } from '../../kit';
import { Cerotto } from '@/components/portale/telefono/icone';
import { FalcoTondo } from '@/components/portale/telefono/FalcoTondo';
import { impostaContatori, toast } from '@/components/portale/telefono/stato';
import { Documento, Fotocamera, Piu, Scarica } from '@/components/icone';
import { scarica } from '@/lib/portale/area-api';
import { inf, type CampiInfortunio, type ElencoInfortuni, type Infortunio } from '@/lib/portale/luoghi-api';
import { Avviso, Campo, Fatto, useCarica } from './comuni';
import { useLargo } from '../gestionale/comune';
import { RigaTrascinabile } from '@/components/portale/telefono/RigaTrascinabile';
import { ElencoTel, FisarmonicaTel, FisarmonicheTel, GrandeTel, TestataTel } from './luoghiTelefono';
import { Avviso as Avviso2 } from '@/components/icone';

type FoglioInf = null | 'denuncia' | { dettaglio: number } | { correggi: Infortunio };

const vuoti: CampiInfortunio = { data: '', ora: '', lavoratore_id: null, sede_id: null, reparto: '', come: '', parte_corpo: '', lesione: '', prognosi_giorni: '' };

/** Infortuni (regole di business 19): copia della denuncia letta dall'assistente, proposta di aggiornamento del DVR al tecnico. */
export default function Infortuni() {
  return useLargo() ? <InfortuniComputer /> : <InfortuniTel />;
}

function InfortuniComputer() {
  const { azienda, versione, sede } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: d, errore, carica, caricando } = useCarica(() => inf.elenco(aid, sede), [aid, versione, sede]);
  const [foglio, setFoglio] = useState<FoglioInf>(null);
  useEffect(() => {
    if (d) impostaContatori({ infortuni: d.da_fare.length });
  }, [d]);
  if (!azienda) return null;
  const denuncia = d?.permessi.denuncia ?? false;

  return (
    <div className="space-y-5">
      <Testata categoria="infortuni" icona={Cerotto} titolo="Infortuni" sotto="Gli infortuni in azienda e l’aggiornamento del DVR"
        azioni={denuncia ? <button type="button" className="btn btn-primary" onClick={() => setFoglio('denuncia')}>Denuncia un infortunio</button> : undefined} />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !d && <Caricamento />}
      {d && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Riquadro etichetta={`Infortuni nel ${d.anno}`} valore={d.indicatori.anno} />
            <Riquadro etichetta={`Giorni di prognosi nel ${d.anno}`} valore={d.indicatori.giorni_prognosi} unita=" giorni" />
            <Riquadro etichetta="Dall’ultimo infortunio" valore={d.indicatori.dall_ultimo ?? 'n.d.'} unita={d.indicatori.dall_ultimo !== null ? ' giorni' : undefined} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <section>
              {d.infortuni.length === 0 ? (
                <Vuoto titolo="Nessun infortunio registrato" azione={denuncia ? <button type="button" className="btn btn-primary" onClick={() => setFoglio('denuncia')}>Denuncia un infortunio</button> : undefined}>
                  Bene così. Se succede, carica qui la copia della denuncia.
                </Vuoto>
              ) : (
                <div className="overflow-x-auto rounded-hse-xl bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]">
                  <table className="w-full min-w-[36rem] text-small">
                    <thead>
                      <tr className="text-left text-fg-muted">
                        <th className="px-4 py-3 font-medium">Data</th><th className="font-medium">Lavoratore</th>{d.piu_sedi && <th className="font-medium">Sede</th>}
                        <th className="font-medium">Prognosi</th><th className="pr-4 font-medium">Aggiornamento del DVR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.infortuni.map((x) => (
                        <tr key={x.id} className="border-t border-line align-top">
                          <td className="px-4 py-3">{dataIt(x.data)}{x.ora && <span className="block text-fg-muted">ore {x.ora}</span>}</td>
                          <td className="py-3">
                            <button type="button" className="font-medium hover:underline" onClick={() => setFoglio({ dettaglio: x.id })}>{x.lavoratore}</button>
                            <span className="block text-fg-muted">{x.lesione ? `${x.lesione}${x.parte_corpo ? ` · ${x.parte_corpo.toLowerCase()}` : ''}` : 'n.d.'}</span>
                            {x.mancano.length > 0 && <span className="block text-caption text-warn-ink">Dati da completare</span>}
                          </td>
                          {d.piu_sedi && <td className="py-3">{x.sede ?? 'n.d.'}</td>}
                          <td className="py-3">{x.prognosi_giorni !== null ? `${x.prognosi_giorni} giorni` : 'n.d.'}</td>
                          <td className="py-3 pr-4"><Chip stato={x.dvr.chip}>{x.dvr.etichetta}</Chip></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="space-y-4">
              <div className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
                <p className="text-title">Come funziona</p>
                {[
                  ['Carichi la copia della denuncia', 'Foto o PDF della denuncia o della comunicazione INAIL.'],
                  ['L’assistente la legge', 'Propone data, lavoratore, dinamica, lesione e prognosi. Tu controlli e confermi.'],
                  ['Il DVR si aggiorna', 'L’assistente propone le misure da aggiungere; il tecnico ISFOR le approva.'],
                ].map(([t, s], i) => (
                  <div key={t} className="mt-3 flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-small">{i + 1}</span>
                    <span><span className="block text-small font-medium">{t}</span><span className="block text-small text-fg-muted">{s}</span></span>
                  </div>
                ))}
              </div>
              <Avviso titolo="La denuncia all’INAIL resta com’è">La fai tu o il consulente del lavoro, entro 2 giorni dal certificato medico. Qui carichi solo la copia.</Avviso>
            </section>
          </div>
        </>
      )}
      {d && foglio === 'denuncia' && <FoglioDenuncia aid={aid} d={d} onChiudi={() => setFoglio(null)} onApri={(id) => setFoglio({ dettaglio: id })} onFatto={carica} />}
      {d && foglio !== null && typeof foglio === 'object' && 'dettaglio' in foglio && (
        <FoglioDettaglio aid={aid} id={foglio.dettaglio} d={d} onChiudi={() => setFoglio(null)} onCorreggi={(x) => setFoglio({ correggi: x })} />
      )}
      {d && foglio !== null && typeof foglio === 'object' && 'correggi' in foglio && (
        <FoglioCorreggi aid={aid} x={foglio.correggi} d={d} onChiudi={() => setFoglio(null)} onFatto={(id) => { carica(); setFoglio({ dettaglio: id }); }} />
      )}
    </div>
  );
}

function Modulo({ d, c, setC, errData }: { d: ElencoInfortuni; c: CampiInfortunio; setC: (c: CampiInfortunio) => void; errData?: string }) {
  const l = d.lavoratori.find((x) => x.id === c.lavoratore_id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Data" errore={errData}><input type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={c.data} onChange={(e) => setC({ ...c, data: e.target.value })} /></Campo>
        <Campo etichetta="Ora"><input type="time" className="input" value={c.ora} onChange={(e) => setC({ ...c, ora: e.target.value })} /></Campo>
      </div>
      <Campo etichetta="Lavoratore" aiuto={l ? `Abbinato all’elenco dei dipendenti: ${l.nome}` : undefined}>
        <select className="input" value={c.lavoratore_id ?? ''} onChange={(e) => {
          const nl = d.lavoratori.find((x) => x.id === Number(e.target.value));
          setC({ ...c, lavoratore_id: nl?.id ?? null, reparto: nl?.reparto ?? c.reparto, sede_id: nl?.sede_id ?? c.sede_id });
        }}>
          <option value="">Scegli</option>
          {d.lavoratori.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.mansione ? `, ${x.mansione}` : ''}</option>)}
        </select>
      </Campo>
      <Campo etichetta="Reparto"><input className="input" placeholder="Es. Magazzino" value={c.reparto} onChange={(e) => setC({ ...c, reparto: e.target.value })} /></Campo>
      <Campo etichetta="Come è successo"><textarea className="input min-h-[5.5rem] py-2" rows={3} value={c.come} onChange={(e) => setC({ ...c, come: e.target.value })} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Parte del corpo"><input className="input" placeholder="Es. mano sinistra" value={c.parte_corpo} onChange={(e) => setC({ ...c, parte_corpo: e.target.value })} /></Campo>
        <Campo etichetta="Tipo di lesione"><input className="input" placeholder="Es. ferita da taglio" value={c.lesione} onChange={(e) => setC({ ...c, lesione: e.target.value })} /></Campo>
      </div>
      <Campo etichetta="Giorni di prognosi" aiuto="Come scritto nel certificato medico.">
        <input type="number" min={0} className="input" value={c.prognosi_giorni} onChange={(e) => setC({ ...c, prognosi_giorni: e.target.value })} />
      </Campo>
    </div>
  );
}

function RiquadroDvr({ x }: { x: Infortunio }) {
  return (
    <div className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--hse-line)]">
      <div className="flex flex-wrap items-center gap-2">
        <FalcoTondo size={24} />
        <p className="min-w-0 flex-1 text-small font-medium">Aggiornamento del DVR proposto</p>
        <Chip stato={x.dvr.chip}>{x.dvr.etichetta}</Chip>
      </div>
      {x.dvr.testo && <p className="mt-2 text-small">{x.dvr.testo}</p>}
      <ul className="mt-2 list-inside list-disc space-y-1 text-small">{(x.dvr.misure ?? []).map((m) => <li key={m}>{m}</li>)}</ul>
      {x.dvr.capitoli && <p className="mt-2 text-small text-fg-muted">Capitoli del DVR: {x.dvr.capitoli.join(' · ')}</p>}
      <p className="mt-2 text-caption text-fg-muted">
        {x.dvr.stato === 'aggiornato'
          ? `Approvato da ${x.dvr.approvato_da ?? 'il tecnico'} il ${dataIt(x.dvr.approvato_il)}${x.dvr.versione ? ` · DVR versione ${x.dvr.versione}` : ''}.`
          : 'Proposta scritta dall’assistente. Il tecnico ISFOR la controlla e aggiorna il DVR: poi trovi la nuova versione in Documenti.'}
      </p>
    </div>
  );
}

function FoglioDenuncia({ aid, d, onChiudi, onApri, onFatto }: { aid: number; d: ElencoInfortuni; onChiudi: () => void; onApri: (id: number) => void; onFatto: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [letto, setLetto] = useState<{ file: string; nome: string } | null>(null);
  const [leggendo, setLeggendo] = useState<string | null>(null);
  const [c, setC] = useState<CampiInfortunio>(vuoti);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ testo: string; x: Infortunio } | null>(null);
  const scegli = async (f: File | undefined) => {
    if (!f) return;
    setErrore(null);
    setLeggendo(f.name);
    try {
      const r = await inf.leggi(aid, f);
      const p = r.proposta;
      setC({ ...vuoti, data: String(p.data ?? ''), ora: String(p.ora ?? ''), lavoratore_id: (p.lavoratore_id as number | null) ?? null, sede_id: (p.sede_id as number | null) ?? null,
        reparto: String(p.reparto ?? ''), come: String(p.come ?? ''), parte_corpo: String(p.parte_corpo ?? ''), lesione: String(p.lesione ?? ''), prognosi_giorni: p.prognosi_giorni != null ? String(p.prognosi_giorni) : '' });
      setLetto({ file: r.file, nome: r.nome });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    } finally {
      setLeggendo(null);
    }
  };
  const registra = async () => {
    if (leggendo) return setErrore('Aspetta un attimo: l’assistente sta leggendo la denuncia.');
    if (!letto) return setErrore('Carica prima la copia della denuncia.');
    if (!c.data || c.data > new Date().toISOString().slice(0, 10)) return setErrore('Scrivi la data dell’infortunio, non dopo oggi.');
    try {
      const r = await inf.registra(aid, letto.file, letto.nome, c);
      setEsito({ testo: r.testo, x: r.infortunio });
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto categoria="infortuni" icona={Cerotto} sopra="Infortuni" titolo="Denuncia un infortunio" onChiudi={onChiudi}
      piede={esito
        ? <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Fatto</button><button type="button" className="btn btn-primary" onClick={() => onApri(esito.x.id)}>Apri l’infortunio</button></>
        : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-lg btn-primary" onClick={registra}>Conferma e registra</button></>}>
      {esito ? (
        <div className="space-y-4">
          <Fatto titolo="Infortunio registrato">{esito.testo}</Fatto>
          {esito.x.mancano.length > 0 && <Avviso tono="warn" titolo="Mancano alcuni dati">Completa appena puoi: {esito.x.mancano.join(', ')}.</Avviso>}
          <RiquadroDvr x={esito.x} />
        </div>
      ) : (
        <>
          <p className="text-small text-fg-muted">La denuncia all’INAIL la fai tu o il consulente del lavoro, come sempre. Qui carichi la copia: l’assistente la legge, registra l’infortunio e propone l’aggiornamento del DVR.</p>
          {errore && <p role="alert" className="rounded-hse-lg bg-danger px-4 py-3 text-small text-danger-ink">{errore}</p>}
          <div>
            <p className="mb-1.5 text-small font-medium">Denuncia</p>
            <div className="rounded-hse-lg border-2 border-dashed border-line p-6 text-center">
              {letto || leggendo ? (
                <p className="flex items-center justify-center gap-2 text-small font-medium"><Documento size={18} aria-hidden /> {letto?.nome ?? leggendo}</p>
              ) : (
                <>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-acid-400 text-acid-950"><Fotocamera size={20} aria-hidden /></span>
                  <p className="mt-2 text-small font-medium">Foto o PDF della denuncia o della comunicazione INAIL</p>
                  <p className="text-small text-fg-muted">La legge l’assistente e compila i dati.</p>
                  <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => file.current?.click()}>Scegli il file</button>
                </>
              )}
              <input ref={file} type="file" accept="application/pdf,image/*" hidden onChange={(e) => scegli(e.target.files?.[0])} />
            </div>
          </div>
          {(leggendo || letto) && (
            <div className="flex items-center gap-3 rounded-2xl bg-sunken px-4 py-3">
              <span className={leggendo ? 'animate-pulse motion-reduce:animate-none' : ''}><FalcoTondo size={32} /></span>
              {leggendo ? (
                <span><span className="block text-small font-medium">Sto leggendo la denuncia…</span><span className="block text-small text-fg-muted">Data e ora, lavoratore, come è successo, lesione e prognosi</span></span>
              ) : (
                <span className="text-small">Ho letto la denuncia e compilato i dati qui sotto. <strong>Controlla</strong> e correggi se qualcosa non torna.</span>
              )}
            </div>
          )}
          {letto && <Modulo d={d} c={c} setC={setC} />}
        </>
      )}
    </Foglio>
  );
}

function FoglioDettaglio({ aid, id, d, onChiudi, onCorreggi }: { aid: number; id: number; d: ElencoInfortuni; onChiudi: () => void; onCorreggi: (x: Infortunio) => void }) {
  const [x, setX] = useState<Infortunio | null>(null);
  useEffect(() => {
    inf.dettaglio(aid, id).then(setX).catch(() => toast('Infortunio non trovato', 'info'));
  }, [aid, id]);
  const righe: Array<[string, string]> = x ? [
    ['Lavoratore', `${x.lavoratore}${x.mansione ? ` · ${x.mansione}` : ''}`],
    ...(d.piu_sedi ? [['Sede', x.sede ?? 'n.d.'] as [string, string]] : []),
    ['Reparto', x.reparto ?? 'n.d.'], ['Parte del corpo', x.parte_corpo ?? 'n.d.'], ['Lesione', x.lesione ?? 'n.d.'],
    ['Prognosi', x.prognosi_giorni !== null ? `${x.prognosi_giorni} giorni · rientro previsto il ${dataIt(x.rientro)}` : 'n.d.'],
  ] : [];
  return (
    <Foglio aperto largo categoria="infortuni" icona={Cerotto} sopra={x ? `${dataIt(x.data)}${x.ora ? ` · ore ${x.ora}` : ''}` : undefined} titolo={x ? `Infortunio di ${x.lavoratore}` : 'Infortunio'} onChiudi={onChiudi}
      piede={x ? (
        <>
          <button type="button" className="btn btn-ghost" onClick={onChiudi}>Chiudi</button>
          <button type="button" className="btn btn-ghost" onClick={() => scarica(inf.denuncia(aid, x.id), x.file.nome ?? 'denuncia').catch((e: Error) => toast(e.message, 'info'))}><Scarica size={16} aria-hidden /> Denuncia</button>
          {d.permessi.denuncia && x.mancano.length === 0 && <button type="button" className="btn btn-ghost" onClick={() => onCorreggi(x)}>Correggi</button>}
        </>
      ) : undefined}>
      {!x ? <Caricamento /> : (
        <>
          {x.mancano.length > 0 && (
            <Avviso tono="warn" titolo="Dati da completare">
              Manca: {x.mancano.join(', ')}.{' '}
              {d.permessi.denuncia && <button type="button" className="btn btn-secondary btn-sm ml-2" onClick={() => onCorreggi(x)}>Completa</button>}
            </Avviso>
          )}
          <dl className="divide-y divide-line">
            {righe.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5 text-small"><dt className="text-fg-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
          </dl>
          <div><p className="text-small text-fg-muted">Come è successo</p><p className="text-small">{x.come ?? 'n.d.'}</p></div>
          <div className="flex items-center gap-3 rounded-2xl bg-sunken px-4 py-3 text-small">
            <Documento size={18} aria-hidden />
            <span><span className="block font-medium">{x.file.nome}</span><span className="block text-fg-muted">Copia della denuncia caricata da {x.file.caricato_da ?? 'n.d.'} il {dataIt(x.file.caricato_il)}</span></span>
          </div>
          <RiquadroDvr x={x} />
        </>
      )}
    </Foglio>
  );
}

function FoglioCorreggi({ aid, x, d, onChiudi, onFatto }: { aid: number; x: Infortunio; d: ElencoInfortuni; onChiudi: () => void; onFatto: (id: number) => void }) {
  const [c, setC] = useState<CampiInfortunio>({ data: x.data, ora: x.ora ?? '', lavoratore_id: x.lavoratore_id, sede_id: x.sede_id, reparto: x.reparto ?? '', come: x.come ?? '',
    parte_corpo: x.parte_corpo ?? '', lesione: x.lesione ?? '', prognosi_giorni: x.prognosi_giorni !== null ? String(x.prognosi_giorni) : '' });
  const [errore, setErrore] = useState<string | null>(null);
  const salva = async () => {
    try {
      const r = await inf.correggi(aid, x.id, c);
      toast(r.testo);
      onFatto(x.id);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra={x.mancano.length > 0 ? 'Completa i dati' : 'Correggi i dati'} titolo={`Infortunio di ${x.lavoratore}`} onChiudi={onChiudi}
      piede={<><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-primary" onClick={salva}>Salva</button></>}>
      {x.mancano.length > 0 && <Avviso tono="warn" titolo="Mancano alcuni dati">Completa: {x.mancano.join(', ')}.</Avviso>}
      {errore && <p role="alert" className="text-small text-danger-mark">{errore}</p>}
      <Modulo d={d} c={c} setC={setC} />
    </Foglio>
  );
}

/** Infortuni sul telefono (mobile/viste/infortuni.js): testata con il numero dell'anno, elenco, fisarmoniche. Fogli condivisi. */
function InfortuniTel() {
  const { azienda, versione, sede } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: d, errore, carica, caricando } = useCarica(() => inf.elenco(aid, sede), [aid, versione, sede]);
  const [foglio, setFoglio] = useState<FoglioInf>(null);
  useEffect(() => {
    if (d) impostaContatori({ infortuni: d.da_fare.length });
  }, [d]);
  if (!azienda) return null;
  if (!d) return <div className="space-y-4">{errore && <Errore testo={errore} onRiprova={carica} />}{caricando && <Caricamento />}</div>;
  return (
    <div className="space-y-5">
      <TestataTel categoria="infortuni" icona={Cerotto} titolo="Infortuni" sotto="Infortuni e aggiornamento del DVR" numero={d.indicatori.anno}
        etichetta={d.indicatori.anno === 1 ? `infortunio nel ${d.anno}` : `infortuni nel ${d.anno}`} />
      {d.permessi.denuncia && <GrandeTel onClick={() => setFoglio('denuncia')}><span className="inline-flex items-center gap-2"><Piu size={18} aria-hidden /> Denuncia un infortunio</span></GrandeTel>}
      {d.infortuni.length === 0 ? (
        <Vuoto titolo="Nessun infortunio registrato">Se succede, carica qui la copia della denuncia.</Vuoto>
      ) : (
        <ElencoTel titolo="Registrati">
          {d.infortuni.map((x) => (
            <RigaTrascinabile key={x.id} onClick={() => setFoglio({ dettaglio: x.id })}
              inizio={<span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-small font-medium">{x.lavoratore.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>}
              titolo={x.lavoratore}
              sotto={`${dataIt(x.data)} · ${x.prognosi_giorni !== null ? `${x.prognosi_giorni} giorni di prognosi` : 'prognosi da completare'}${d.piu_sedi && x.sede ? ` · ${x.sede}` : ''}`}
              stato={x.mancano.length > 0 ? <Chip stato="warn">Dati da completare</Chip> : <Chip stato={x.dvr.chip}>{x.dvr.etichetta}</Chip>} />
          ))}
        </ElencoTel>
      )}
      <FisarmonicheTel>
      <FisarmonicaTel titolo="Come funziona" sotto="3 passi" icona={Avviso2}>
        {[['Carichi la copia della denuncia', 'Foto o PDF della denuncia o della comunicazione INAIL.'], ['L’assistente la legge', 'Propone i dati: tu controlli e confermi.'], ['Il DVR si aggiorna', 'Le misure proposte le approva il tecnico ISFOR.']].map(([t, s], i) => (
          <div key={t} className="mt-3 flex gap-3 first:mt-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken">{i + 1}</span>
            <span><span className="block font-medium">{t}</span><span className="block text-fg-muted">{s}</span></span>
          </div>
        ))}
      </FisarmonicaTel>
      <FisarmonicaTel titolo="La denuncia all’INAIL" sotto="La fai come sempre" icona={Documento}>La fai tu o il consulente del lavoro, entro 2 giorni dal certificato medico. Qui carichi solo la copia.</FisarmonicaTel>
      </FisarmonicheTel>
      {foglio === 'denuncia' && <FoglioDenuncia aid={aid} d={d} onChiudi={() => setFoglio(null)} onApri={(id) => setFoglio({ dettaglio: id })} onFatto={carica} />}
      {foglio !== null && typeof foglio === 'object' && 'dettaglio' in foglio && (
        <FoglioDettaglio aid={aid} id={foglio.dettaglio} d={d} onChiudi={() => setFoglio(null)} onCorreggi={(x) => setFoglio({ correggi: x })} />
      )}
      {foglio !== null && typeof foglio === 'object' && 'correggi' in foglio && (
        <FoglioCorreggi aid={aid} x={foglio.correggi} d={d} onChiudi={() => setFoglio(null)} onFatto={(id) => { carica(); setFoglio({ dettaglio: id }); }} />
      )}
    </div>
  );
}
