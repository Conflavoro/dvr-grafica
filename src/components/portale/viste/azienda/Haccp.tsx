'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Posate } from '@/components/portale/telefono/icone';
import { Cartella, Corso, Libro, Provetta, Spunta, type IconaComponente } from '@/components/icone';
import { impostaContatori } from '@/components/portale/telefono/stato';
import { clsx } from '@/lib/clsx';
import { haccp, type Haccp as Dati, type SedeHaccp, type VoceDaFare } from '@/lib/portale/luoghi-api';
import { coseDaFare } from '@/lib/portale/luoghi-logica';
import { Fatto, useCarica } from './comuni';

type SchedaH = 'panoramica' | 'sedi' | 'campionamenti' | 'addetti';
type FoglioH = null | { fissa: SedeHaccp } | 'addetti';

const PASSI = ['Sopralluogo', 'Manuale in preparazione', 'Manuale nella cartella'];
const INDICE: Record<SedeHaccp['stato'], number> = { da_fissare: 0, fissato: 0, preparazione: 1, consegnato: 3 };

/** HACCP (regole di business 18), solo computer: sedi alimentari e manuale, campionamenti, addetti. */
export default function Haccp() {
  const { azienda, versione, sede, chiedi } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: d, errore, carica, caricando } = useCarica(() => haccp.vista(aid, sede), [aid, versione, sede]);
  const [scheda, setScheda] = useState<SchedaH>('panoramica');
  const [foglio, setFoglio] = useState<FoglioH>(null);
  useEffect(() => {
    if (d) impostaContatori({ haccp: d.da_fare.length });
  }, [d]);
  if (!azienda) return null;
  const voce = (x: VoceDaFare) => {
    const s = d?.sedi.find((r) => r.id === x.id);
    if (x.azione === 'fissa' && s) setFoglio({ fissa: s });
    else if (x.azione === 'iscrivi') chiedi(`Iscrivi al corso Alimentarista HACCP: ${x.testo.replace(/^Iscrivi | al corso.*$/g, '')}`);
    else if (x.scheda) setScheda(x.scheda as SchedaH);
  };
  const ind = d?.indicatori;
  const n = d?.sedi.length ?? 0;
  const k = ind?.consegnati ?? 0;

  return (
    <div className="space-y-5">
      <Testata categoria="haccp" icona={Posate} titolo="HACCP"
        sotto={d ? `${n === 1 ? '1 sede alimentare' : `${n} sedi alimentari`} · ${k === 1 ? '1 manuale consegnato' : `${k} manuali consegnati`}${d.da_fare.length > 0 ? ` · ${coseDaFare(d.da_fare.length)}` : ''}` : undefined}
        azioni={scheda === 'addetti' && d?.permessi.modifica
          ? <button type="button" className="btn btn-primary" onClick={() => setFoglio('addetti')}>Indica chi lavora con gli alimenti</button>
          : <Link className="btn btn-secondary" href="/azienda/documenti/?cartella=haccp">Cartella HACCP</Link>} />
      <Schede<SchedaH> etichetta="HACCP" attiva={scheda} onCambia={setScheda} voci={[
        { k: 'panoramica', t: 'Panoramica', n: d?.da_fare.length },
        { k: 'sedi', t: 'Sedi e manuale', n: ind?.sedi_da_fissare },
        { k: 'campionamenti', t: 'Campionamenti', n: ind?.in_ritardo },
        { k: 'addetti', t: 'Addetti', n: ind?.da_formare },
      ]} />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !d && <Caricamento />}

      {d && scheda === 'panoramica' && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <p className="text-caption uppercase text-fg-muted">{k === 0 ? 'Si parte dal sopralluogo' : 'Il tuo HACCP'}</p>
              <p className="mt-1"><span className="text-display">{n}</span> <span className="text-h3 text-fg-muted">{n === 1 ? 'sede alimentare' : 'sedi alimentari'}</span></p>
              {(d.tecnico || d.laboratorio) && (
                <p className="mt-1 text-small text-fg-muted">{[d.tecnico && `Tecnico di riferimento: ${d.tecnico}`, d.laboratorio && `analisi con ${d.laboratorio}`].filter(Boolean).join(' · ')}</p>
              )}
              <p className="mt-5 text-title">Cosa comprende</p>
              <ul className="mt-2 space-y-2">
                {([[Libro, 'Manuale di autocontrollo per ogni sede, preparato dal tecnico dopo il sopralluogo'],
                  [Provetta, 'Analisi di laboratorio secondo il piano del manuale: acqua, tamponi sulle superfici, alimenti'],
                  [Corso, 'Formazione degli addetti che preparano, servono o vendono alimenti'],
                  [Cartella, 'Cartella HACCP nei Documenti, una sottocartella per sede, pronta per i controlli']] as Array<[IconaComponente, string]>).map(([I, t]) => (
                  <li key={t} className="flex gap-3 text-small"><I size={20} aria-hidden className="shrink-0 text-cat-haccp-mark" />{t}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-hse-xl bg-acid-400 p-5 text-acid-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3">Da fare per l’HACCP</h2>
                <span className="cifre grid h-7 min-w-7 place-items-center rounded-full bg-black px-2 text-[13px] text-acid-400">{d.da_fare.length}</span>
              </div>
              {d.da_fare.length === 0 ? (
                <p className="mt-3 rounded-hse-lg bg-white px-4 py-4 text-small text-fg">Niente da fare: manuali, analisi e attestati sono in regola.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {d.da_fare.map((x, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-hse-lg bg-white px-3 py-2.5">
                      <span aria-hidden className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full', x.azione === 'iscrivi' ? 'bg-cat-formazione text-cat-formazione-ink' : 'bg-cat-haccp text-cat-haccp-ink')}><Posate size={15} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-small font-medium text-fg">{x.testo}</span>{x.extra && <span className="block text-caption text-grafite-500">{x.extra}</span>}</span>
                      {(x.azione !== 'fissa' || d.permessi.richiedi) && <button type="button" className="btn btn-sm bg-grafite-900 text-white" onClick={() => voce(x)}>{x.pulsante}</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Riquadro punto="bg-cat-haccp-mark" etichetta="Manuali consegnati" valore={k} unita={`/${n}`} sotto={k === n ? 'Tutte le sedi coperte' : `${n - k} in corso`} onClick={() => setScheda('sedi')} />
            <Riquadro punto="bg-cat-haccp-mark" etichetta="Prossimo prelievo" valore={ind!.prossimo_prelievo ? dataIt(ind!.prossimo_prelievo.previsto_il, true) : 'n.d.'}
              unita={ind!.prossimo_prelievo ? `/${ind!.prossimo_prelievo.previsto_il.slice(0, 4)}` : undefined}
              sotto={ind!.prossimo_prelievo ? `${ind!.prossimo_prelievo.analisi} · ${traGiorni(ind!.prossimo_prelievo.previsto_il)}` : 'Il piano arriva con il manuale'} onClick={() => setScheda('campionamenti')} />
            <Riquadro punto="bg-cat-haccp-mark" etichetta="Addetti con attestato" valore={ind!.addetti_formati} unita={`/${ind!.addetti}`}
              sotto={ind!.addetti === 0 ? 'Indica chi lavora con gli alimenti' : ind!.da_formare > 0 ? `${ind!.da_formare} da formare` : 'Tutti formati'} onClick={() => setScheda('addetti')} />
            <Riquadro punto="bg-cat-haccp-mark" etichetta="Rapporti di prova" valore={ind!.rapporti} sotto={ind!.rapporti > 0 ? 'Nella cartella HACCP' : 'Ancora nessuno'} onClick={() => setScheda('campionamenti')} />
          </div>
        </>
      )}

      {d && scheda === 'sedi' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {d.sedi.map((s) => {
              const at = INDICE[s.stato];
              const nota = { da_fissare: 'Il tecnico viene in sede, guarda locali, attrezzature e lavorazioni, poi scrive il manuale.',
                fissato: `${d.tecnico ?? 'Il tecnico'} ti scrive il giorno prima per conferma.`,
                preparazione: 'Il manuale arriva nella cartella HACCP: te lo segnaliamo quando è pronto.',
                consegnato: s.revisione_entro ? `Revisione entro il ${dataIt(s.revisione_entro)}` : `Versione ${s.versione ?? '1'} del ${dataIt(s.manuale?.data)}` }[s.stato];
              return (
                <section key={s.id} className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1"><p className="text-title">{s.nome}</p>{s.indirizzo && <p className="text-small text-fg-muted">{s.indirizzo}</p>}</div>
                    <Chip stato={s.chip}>{s.etichetta}</Chip>
                  </div>
                  <ol className="mt-4 space-y-2">
                    {PASSI.map((t, i) => (
                      <li key={t} className="flex items-center gap-3 text-small">
                        <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-caption', i < at ? 'bg-grafite-900 text-white' : i === at ? 'bg-cat-haccp ring-2 ring-grafite-900' : 'bg-sunken text-fg-faint')}>{i < at ? <Spunta size={14} aria-hidden /> : i + 1}</span>
                        {t}{i === 0 && s.sopralluogo_il ? ` · ${dataIt(s.sopralluogo_il.slice(0, 10))} alle ${s.sopralluogo_il.slice(11, 16)}` : ''}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-small text-fg-muted">{nota}</p>
                  <div className="mt-4">
                    {s.stato === 'da_fissare' && (d.permessi.richiedi
                      ? <button type="button" className="btn btn-primary" onClick={() => setFoglio({ fissa: s })}>Fissa il sopralluogo</button>
                      : <Blocco>Il titolare o il referente fissano il sopralluogo</Blocco>)}
                    {s.stato === 'fissato' && d.permessi.richiedi && <button type="button" className="btn btn-secondary" onClick={() => setFoglio({ fissa: s })}>Cambia data</button>}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="text-caption text-fg-muted">Per aggiungere o togliere una sede alimentare vai in Servizi, supplemento HACCP.</p>
        </>
      )}

      {d && scheda === 'campionamenti' && (
        <>
          {d.campionamenti.length === 0 ? (
            <Vuoto titolo="Il piano dei campionamenti arriva con il manuale">
              Dopo il sopralluogo il tecnico decide quali analisi servono per ogni sede e ogni quanto. Il laboratorio poi ti propone le date dei prelievi.
            </Vuoto>
          ) : (
            <table className="w-full text-small">
              <thead><tr className="text-left text-fg-muted"><th className="py-2 font-medium">Analisi</th>{d.piu_sedi && <th className="font-medium">Sede</th>}<th className="font-medium">Prelievo</th><th className="font-medium">Laboratorio</th><th className="font-medium">Stato</th></tr></thead>
              <tbody>
                {d.campionamenti.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2.5"><span className="font-medium">{c.analisi}</span>{c.punti.length > 0 && <span className="block text-fg-muted">{c.punti.join(', ')}</span>}</td>
                    {d.piu_sedi && <td>{c.sede ?? 'n.d.'}</td>}
                    <td className={clsx(c.ritardo && 'text-danger-mark')}>{c.referto_il ? `rapporto del ${dataIt(c.referto_il)}` : c.previsto_il ? `${dataIt(c.previsto_il)} · ${traGiorni(c.previsto_il)}` : 'n.d.'}</td>
                    <td>{c.laboratorio ?? 'n.d.'}</td>
                    <td><Chip stato={c.chip}>{c.etichetta}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-caption text-fg-muted">Il laboratorio vede la sede solo durante l’incarico e per 30 giorni dopo. Il rapporto di prova entra da solo nella cartella HACCP.</p>
        </>
      )}

      {d && scheda === 'addetti' && (
        <>
          {d.addetti.length === 0 ? (
            <Vuoto titolo="Nessun addetto indicato" azione={d.permessi.modifica ? <button type="button" className="btn btn-primary" onClick={() => setFoglio('addetti')}>Indica gli addetti</button> : undefined}>
              Indica chi prepara, serve o vende alimenti: ti diciamo chi ha già l’attestato e chi va formato.
            </Vuoto>
          ) : (
            <table className="w-full text-small">
              <thead><tr className="text-left text-fg-muted"><th className="py-2 font-medium">Addetto</th>{d.piu_sedi && <th className="font-medium">Sede</th>}<th className="font-medium">Attestato fino al</th><th className="font-medium">Stato</th><th /></tr></thead>
              <tbody>
                {d.addetti.map((a) => (
                  <tr key={a.lavoratore_id} className="border-t border-line">
                    <td className="py-2.5"><span className="font-medium">{a.nome}</span>{a.mansione && <span className="block text-fg-muted">{a.mansione}</span>}</td>
                    {d.piu_sedi && <td>{a.sede ?? 'n.d.'}</td>}
                    <td>{a.corso.scade_il ? `${dataIt(a.corso.scade_il)} · ${traGiorni(a.corso.scade_il)}` : 'n.d.'}</td>
                    <td><Chip stato={a.corso.stato}>{a.corso.etichetta}</Chip></td>
                    <td className="text-right">{d.permessi.iscrivi && ['todo', 'danger', 'warn'].includes(a.corso.stato) && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => chiedi(`Iscrivi ${a.nome} al corso Alimentarista HACCP`)}>Iscrivi</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-caption text-fg-muted">Corso Alimentarista HACCP, 4 ore. Ogni quanto rinnovarlo dipende dalla regione: lo imposta il tuo referente.</p>
        </>
      )}

      {d && foglio !== null && typeof foglio === 'object' && <FoglioFissa aid={aid} d={d} s={foglio.fissa} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio === 'addetti' && <FoglioAddetti aid={aid} d={d} onChiudi={() => setFoglio(null)} onFatto={carica} />}
    </div>
  );
}

function FoglioFissa({ aid, d, s, onChiudi, onFatto }: { aid: number; d: Dati; s: SedeHaccp; onChiudi: () => void; onFatto: () => void }) {
  const gia = s.sopralluogo_il;
  const opzioni = gia && !d.date.some((x) => x.quando === gia) ? [{ quando: gia, testo: `${dataIt(gia.slice(0, 10))}, ${gia.slice(11, 16)}` }, ...d.date] : d.date;
  const [scelta, setScelta] = useState(gia ?? opzioni[0]?.quando ?? '');
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const conferma = async () => {
    try {
      setEsito(await haccp.fissa(aid, s.id, scelta));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra={`${s.nome}${s.indirizzo ? ` · ${s.indirizzo}` : ''}`} titolo="Fissa il sopralluogo HACCP" onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button> : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-lg btn-accent" onClick={conferma}>Conferma la data</button></>}>
      {esito ? <Fatto titolo={esito.titolo ?? ''}>{esito.testo}</Fatto> : (
        <>
          <p className="text-small text-fg-muted">Scegli quando può passare {d.tecnico ?? 'il tecnico'}. Serve circa un’ora, meglio con la cucina in funzione.</p>
          <div className="space-y-2" role="radiogroup">
            {opzioni.map((o) => (
              <label key={o.quando} className={clsx('flex cursor-pointer items-center gap-3 rounded-hse-lg px-4 py-3 text-small', scelta === o.quando ? 'shadow-[inset_0_0_0_2px_#18181b]' : 'shadow-[inset_0_0_0_1px_var(--hse-line)]')}>
                <input type="radio" name="hc-data" checked={scelta === o.quando} onChange={() => setScelta(o.quando)} />{o.testo}
              </label>
            ))}
          </div>
          {errore && <p role="alert" className="text-small text-danger-mark">{errore}</p>}
        </>
      )}
    </Foglio>
  );
}

function FoglioAddetti({ aid, d, onChiudi, onFatto }: { aid: number; d: Dati; onChiudi: () => void; onFatto: () => void }) {
  const [scelti, setScelti] = useState<number[]>([]);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const salva = async () => {
    const r = await haccp.addetti(aid, scelti);
    setEsito(r);
    onFatto();
  };
  return (
    <Foglio aperto sopra="Chi prepara, serve o vende alimenti ha bisogno dell’attestato HACCP" titolo="Chi lavora con gli alimenti" onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button> : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-accent" onClick={salva}>Salva</button></>}>
      {esito ? <Fatto titolo={esito.titolo ?? ''}>{esito.testo}</Fatto> : d.lavoratori.length === 0 ? (
        <p className="text-small">Tutti i lavoratori sono già tra gli addetti.</p>
      ) : (
        <div className="space-y-2">
          {d.lavoratori.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-hse-lg px-4 py-3 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <input type="checkbox" checked={scelti.includes(l.id)} onChange={(e) => setScelti(e.target.checked ? [...scelti, l.id] : scelti.filter((x) => x !== l.id))} />
              <span><span className="block text-small font-medium">{l.nome}</span><span className="block text-caption text-fg-muted">{[l.mansione, l.sede].filter(Boolean).join(' · ')}</span></span>
            </label>
          ))}
        </div>
      )}
    </Foglio>
  );
}
