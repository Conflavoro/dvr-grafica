'use client';

import { useRef, useState } from 'react';
import { Foglio } from '../../kit';
import { Fiamma, Fotocamera } from '@/components/icone';
import { FalcoTondo } from '@/components/portale/telefono/FalcoTondo';
import { clsx } from '@/lib/clsx';
import { scheda, type PropostaScheda } from '@/lib/portale/luoghi-api';
import { Avviso, Campo, Fatto } from './comuni';

const TIPI: Array<[PropostaScheda['tipo'], string]> = [['semestrale', 'Controllo semestrale'], ['annuale', 'Controllo annuale'], ['revisione', 'Revisione'], ['collaudo', 'Collaudo']];

/** Foglio "Carica la scheda del manutentore" (regole 9.9): si apre sulla sede della voce. */
export function FoglioScheda({ aid, sede, sedi, onChiudi, onFatto }: { aid: number; sede: string | null; sedi: string[]; onChiudi: () => void; onFatto: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [sedeScelta, setSedeScelta] = useState<string | null>(sede ?? (sedi.length === 1 ? sedi[0] : null));
  const [leggendo, setLeggendo] = useState<string | null>(null);
  const [letta, setLetta] = useState<{ file: string; nome: string } | null>(null);
  const [p, setP] = useState<PropostaScheda | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const leggi = async (f: File | undefined) => {
    if (!f) return;
    setErrore(null);
    setLeggendo(f.name);
    try {
      const r = await scheda.leggi(aid, f, sedeScelta);
      setLetta({ file: r.file, nome: r.nome });
      setP(r.proposta);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    } finally {
      setLeggendo(null);
    }
  };
  const salva = async () => {
    if (!p || !letta) return;
    if (!p.data) return setErrore('Indica la data del controllo.');
    if (p.data > new Date().toISOString().slice(0, 10)) return setErrore('La data non può essere nel futuro.');
    if (!p.ditta?.trim()) return setErrore('Scrivi la ditta che ha fatto il controllo.');
    if (!p.presidi.some((x) => x.controllato)) return setErrore('Spunta almeno un presidio controllato');
    if (p.presidi.some((x) => x.controllato && x.esito === 'anomalia' && !x.nota?.trim())) return setErrore('Scrivi cosa ha trovato il tecnico.');
    try {
      setEsito(await scheda.salva(aid, letta.file, letta.nome, p));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto categoria="antincendio" icona={Fiamma} sopra="Registro dei controlli" titolo="Carica la scheda del manutentore" onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button>
        : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>{p && <button type="button" className="btn btn-primary" onClick={salva}>Salva nel registro</button>}</>}>
      {esito ? <Fatto titolo={esito.titolo ?? ''}>{esito.testo}</Fatto> : (
        <>
          {sedi.length > 1 && (
            <Campo etichetta="Sede del controllo">
              <select className="input" value={sedeScelta ?? ''} disabled={!!letta} onChange={(e) => setSedeScelta(e.target.value || null)}>
                {sedi.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>
          )}
          {errore && <p role="alert" className="rounded-hse-lg bg-danger px-4 py-3 text-small text-danger-ink">{errore}</p>}
          {!letta && !leggendo && (
            <div className="rounded-hse-lg border-2 border-dashed border-line p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-acid-400 text-acid-950"><Fotocamera size={20} aria-hidden /></span>
              <p className="mt-2 text-small font-medium">Fotografa o scansiona il foglio di lavoro</p>
              <p className="text-small text-fg-muted">Quello che il tecnico ti lascia dopo il controllo. Foto o PDF.</p>
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => file.current?.click()}>Scegli il file</button>
            </div>
          )}
          <input ref={file} type="file" accept="application/pdf,image/*" hidden onChange={(e) => leggi(e.target.files?.[0])} />
          {(leggendo || letta) && (
            <div className="flex items-center gap-3 rounded-2xl bg-sunken px-4 py-3">
              <span className={leggendo ? 'animate-pulse motion-reduce:animate-none' : ''}><FalcoTondo size={32} /></span>
              {leggendo
                ? <span><span className="block text-small font-medium">Sto leggendo la scheda…</span><span className="block text-small text-fg-muted">{leggendo} · data, ditta, presidi controllati e anomalie</span></span>
                : <span className="text-small">Letta da {letta?.nome}. Controlla i dati e correggi quello che non torna, poi salva.</span>}
            </div>
          )}
          {p && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Campo etichetta="Data del controllo"><input type="date" className="input" value={p.data ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setP({ ...p, data: e.target.value })} /></Campo>
                <Campo etichetta="Tipo di controllo">
                  <select className="input" value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value as PropostaScheda['tipo'] })}>{TIPI.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                </Campo>
              </div>
              <Campo etichetta="Ditta manutentrice"><input className="input" value={p.ditta ?? ''} onChange={(e) => setP({ ...p, ditta: e.target.value })} /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etichetta="Tecnico"><input className="input" value={p.tecnico ?? ''} onChange={(e) => setP({ ...p, tecnico: e.target.value })} /></Campo>
                <Campo etichetta="Numero del verbale"><input className="input" value={p.verbale ?? ''} onChange={(e) => setP({ ...p, verbale: e.target.value })} /></Campo>
              </div>
              <ul className="divide-y divide-line rounded-hse-lg shadow-[inset_0_0_0_1px_var(--hse-line)]">
                {p.presidi.map((x, i) => {
                  const cambia = (v: Partial<typeof x>) => setP({ ...p, presidi: p.presidi.map((y, j) => (j === i ? { ...y, ...v } : y)) });
                  return (
                    <li key={x.id} className="px-4 py-3">
                      <label className="flex items-center gap-3 text-small">
                        <input type="checkbox" checked={x.controllato} onChange={(e) => cambia({ controllato: e.target.checked })} />
                        <span className="min-w-0 flex-1"><span className="font-medium">{x.descrizione}</span>{x.posizione && <span className="text-fg-muted"> · {x.posizione}</span>}</span>
                      </label>
                      {x.controllato && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                          {(['ok', 'anomalia'] as const).map((v) => (
                            <button key={v} type="button" aria-pressed={x.esito === v} onClick={() => cambia({ esito: v })}
                              className={clsx('h-10 rounded-full px-3.5 text-small shadow-[inset_0_0_0_1px_var(--hse-line)]', x.esito === v && (v === 'ok' ? 'bg-grafite-900 text-white' : 'bg-danger-mark text-white'))}>
                              {v === 'ok' ? 'In regola' : 'Anomalia'}
                            </button>
                          ))}
                          {x.esito === 'anomalia' && <input className="input mt-1 w-full" placeholder="Cosa ha trovato il tecnico" value={x.nota ?? ''} onChange={(e) => cambia({ nota: e.target.value })} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Avviso>Nasce la voce nel registro dei controlli con la scheda allegata. I presidi controllati prendono la nuova data di verifica; quelli con un’anomalia diventano “da riparare”.</Avviso>
            </div>
          )}
        </>
      )}
    </Foglio>
  );
}
