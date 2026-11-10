'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Scheda, Testata, Vuoto, dataIt, type StatoChip } from '../../kit';
import { Corso, Piu, Scarica } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { caricaAttestato, formazione, scarica, type Formazione as DatiFormazione, type Obbligo } from '@/lib/portale/area-api';
import { Avviso, Campo, Fatto, useCarica, useQuery } from './comuni';
import { FoglioChiediCorso, FoglioIscrivi, giornoLungo } from './FogliOperativita';
import { scaricaExcelFormazione } from '@/lib/portale/area-operativita';

type SchedaF = 'corsi' | 'calendario' | 'lavoratori' | 'attestati';

const TESTO: Record<string, string> = { ok: 'Valido', warn: 'In scadenza', danger: 'Scaduto', todo: 'Da fare', info: 'Iscritto' };
const SEGNO: Record<string, string> = { ok: 'bg-grafite-800', warn: 'bg-stato-warn-segno', info: 'bg-stato-info-segno', danger: 'bg-stato-danger-segno', todo: 'bg-stato-danger-segno' };
const BREVE: Record<string, string> = {
  formazione_generale: 'Generale',
  formazione_specifica: 'Specifica',
  preposto: 'Preposto',
  antincendio: 'Antincendio',
  primo_soccorso: 'Primo socc.',
  rls: 'RLS',
};

/** Formazione (04, 05 par. 20): corsi, calendario delle classi, matrice, attestati; iscrizione diretta, corso fuori catalogo, Excel. */
export default function Formazione() {
  const router = useRouter();
  const { azienda, versione, puo, chiedi, sede } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCarica(() => formazione(aid, sede), [aid, versione, sede]);
  const [qScheda, setQScheda] = useQuery('scheda');
  const [qLav] = useQuery('lavoratore');
  const scheda: SchedaF = qScheda === 'lavoratori' || qScheda === 'attestati' || qScheda === 'calendario' ? qScheda : 'corsi';
  const [obbligo, setObbligo] = useState<Obbligo | null>(null);
  const [prenota, setPrenota] = useState<{ corso: string; ids: number[]; classe?: number } | null>(null);
  const [chiediFoglio, setChiediFoglio] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [carico, setCarico] = useState<{ lavoratore: number | null } | null>(null);

  const puoCaricare = puo('formazione_attestati');
  const daLink = useRef<string | null>(null);
  useEffect(() => {
    if (qLav && puoCaricare && daLink.current !== qLav) {
      daLink.current = qLav;
      setCarico({ lavoratore: Number(qLav) || null });
    }
  }, [qLav, puoCaricare]);

  if (!azienda) return null;
  const c = dati?.contatori;

  return (
    <div className="space-y-5">
      <Testata
        categoria="formazione"
        icona={Corso}
        sopra={azienda.ragione_sociale}
        titolo="Formazione"
        sotto={c && dati ? `${c.copertura ?? 0}% di copertura · ${c.daFare} corsi da fare · ${dati.classi.length} classi in programma` : undefined}
        azioni={
          <>
            <button type="button" className="btn-ghost" onClick={() => scaricaExcelFormazione(aid, azienda.ragione_sociale, sede).then(setAvviso, (e: Error) => setAvviso(e.message))}>
              Scarica in Excel
            </button>
            {dati?.permessi.iscrivi && (
              <button type="button" className="btn-primary" onClick={() => setPrenota({ corso: 'antincendio', ids: [] })}>
                <Piu size={16} aria-hidden /> Iscrivi a un corso
              </button>
            )}
          </>
        }
      />
      <Schede<SchedaF>
        etichetta="Formazione"
        attiva={scheda}
        onCambia={(k) => setQScheda(k === 'corsi' ? null : k)}
        voci={[
          { k: 'corsi', t: 'Corsi', n: c?.daFare },
          { k: 'calendario', t: 'Calendario', n: dati?.classi.length },
          { k: 'lavoratori', t: 'Lavoratori' },
          { k: 'attestati', t: 'Attestati', n: c?.attestati },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {avviso && <Avviso>{avviso}</Avviso>}
      {caricando && !dati && <Caricamento />}

      {dati && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Riquadro nero etichetta="Copertura formativa" valore={c!.copertura} unita="%" sotto={`${c!.inRegola} lavoratori su ${c!.lavoratori} con tutti i corsi validi`} />
            <Riquadro etichetta="Scaduti o mai fatti" valore={c!.daFare} tono={c!.daFare > 0 ? 'danger' : undefined} sotto="Da iscrivere a una classe" />
            <Riquadro etichetta="In scadenza" valore={c!.inScadenza} tono={c!.inScadenza > 0 ? 'warn' : undefined} sotto="Entro 30 giorni" />
            <Riquadro etichetta="Iscritti" valore={c!.prenotati} sotto={`${dati.classi.reduce((n, k) => n + k.iscritti.length, 0)} iscrizioni già fatte`} />
          </div>
          {scheda === 'corsi' && <Corsi dati={dati} onApri={setObbligo} />}
          {scheda === 'corsi' && <AltriCorsi dati={dati} onChiedi={() => setChiediFoglio(true)} />}
          {scheda === 'calendario' && <ClassiProgramma dati={dati} onIscrivi={(k) => setPrenota({ corso: k.corsi[0] ?? 'formazione_generale', ids: [], classe: k.id })} />}
          {scheda === 'lavoratori' && <Matrice dati={dati} />}
          {scheda === 'attestati' && <Attestati dati={dati} onCarica={puo('formazione_attestati') ? () => setCarico({ lavoratore: null }) : null} />}
          {dati.nota && <p className="text-[12.5px] leading-relaxed text-ink-muted">{dati.nota}</p>}
        </>
      )}

      <Foglio
        aperto={obbligo !== null}
        titolo={obbligo?.nome ?? ''}
        onChiudi={() => setObbligo(null)}
        largo
        piede={
          obbligo && (
            <>
              <button type="button" className="btn-ghost" onClick={() => (setObbligo(null), chiedi(`Spiegami il corso "${obbligo.nome}": chi deve farlo, quante ore e ogni quanto si aggiorna.`))}>
                Chiedi al Falco
              </button>
              {dati?.permessi.iscrivi && obbligo.conteggi.danger + obbligo.conteggi.todo + obbligo.conteggi.warn > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => (setPrenota({ corso: obbligo.codice, ids: obbligo.lavoratori.filter((l) => ['danger', 'todo', 'warn'].includes(l.stato)).map((l) => l.id) }), setObbligo(null))}
                >
                  Iscrivi lavoratori
                </button>
              )}
            </>
          )
        }
      >
        {obbligo && (
          <div className="space-y-4">
            <div className="grid gap-2 text-[14px] sm:grid-cols-2">
              <p>
                <span className="text-ink-muted">Durata: </span>
                {obbligo.ore ?? 'Secondo il corso'}
              </p>
              <p>
                <span className="text-ink-muted">Validità: </span>
                {obbligo.anni ? `aggiornamento ogni ${obbligo.anni} anni` : 'senza scadenza'}
              </p>
              <p className="sm:col-span-2">
                <span className="text-ink-muted">Chi deve farlo: </span>
                {obbligo.chi}
              </p>
              {obbligo.rif && <p className="text-[12.5px] text-ink-muted sm:col-span-2">Riferimento: {obbligo.rif}</p>}
            </div>
            <ul>
              {obbligo.lavoratori.map((l) => (
                <li key={l.id} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{l.nome}</span>
                    <span className="block text-[12.5px] text-ink-muted">{[l.mansione, l.scadeIl ? `valido fino al ${dataIt(l.scadeIl)}` : l.conseguitoIl ? 'senza scadenza' : 'mai fatto'].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Chip stato={l.stato}>{TESTO[l.stato]}</Chip>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Foglio>

      {prenota && dati && (
        <FoglioIscrivi
          aziendaId={aid}
          corsi={dati.catalogo.filter((k) => !k.aPagamento)}
          classi={dati.classi}
          persone={dati.persone.map((x) => ({ id: x.id, nome: x.nome, mansione: x.mansione, stati: Object.fromEntries(x.corsi.map((k) => [k.codice, k.stato])) }))}
          corsoIniziale={prenota.corso}
          classeIniziale={prenota.classe ?? null}
          lavoratoriIniziali={prenota.ids}
          onChiudi={() => setPrenota(null)}
          onFatto={carica}
        />
      )}
      {chiediFoglio && (
        <FoglioChiediCorso
          aziendaId={aid}
          puoOrdinare={dati?.permessi.richiedi ?? false}
          onChiudi={() => setChiediFoglio(false)}
          onIscrivi={(codice) => (setChiediFoglio(false), setPrenota({ corso: codice, ids: [] }))}
          onOrdina={() => router.push('/azienda/servizi/?vista=catalogo')}
          onFatto={carica}
        />
      )}
      {carico && dati && <FoglioAttestato aziendaId={aid} dati={dati} lavoratore={carico.lavoratore} onChiudi={() => setCarico(null)} onFatto={carica} />}
    </div>
  );
}

function Barra({ o }: { o: Obbligo }) {
  const tot = Math.max(1, o.richiestoA);
  const pezzi: Array<[string, number]> = [
    ['bg-grafite-800', o.conteggi.ok],
    ['bg-stato-warn-segno', o.conteggi.warn],
    ['bg-stato-info-segno', o.conteggi.info],
    ['bg-stato-danger-segno', o.conteggi.danger + o.conteggi.todo],
  ];
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-perla-velo" aria-hidden>
      {pezzi.map(([cls, n], i) => n > 0 && <span key={i} className={cls} style={{ width: `${(100 * n) / tot}%` }} />)}
    </div>
  );
}

function Corsi({ dati, onApri }: { dati: DatiFormazione; onApri: (o: Obbligo) => void }) {
  if (dati.obblighi.length === 0) return <Vuoto titolo="Nessun lavoratore in forza">Quando ci sono dipendenti, qui vedi i corsi che devono fare per legge.</Vuoto>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {dati.obblighi.map((o) => {
        const mancanti = o.conteggi.danger + o.conteggi.todo;
        return (
          <button key={o.codice} type="button" onClick={() => onApri(o)} className="premi flex flex-col gap-3 rounded-[1.25rem] bg-white p-4 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
            <div>
              <p className="text-[15.5px] font-medium leading-snug text-ink">{o.nome}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">{[o.ore, o.anni ? `aggiornamento ogni ${o.anni} anni` : 'senza scadenza'].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Numero n={o.conteggi.ok} t="validi" />
              <Numero n={o.conteggi.warn} t="in scadenza" />
              <Numero n={mancanti} t="mancanti" rosso={mancanti > 0} />
            </div>
            <Barra o={o} />
            <p className="text-[12.5px] text-ink-muted">
              Richiesto a {o.richiestoA} {o.richiestoA === 1 ? 'lavoratore' : 'lavoratori'}
              {o.conteggi.info > 0 ? ` · ${o.conteggi.info} ${o.conteggi.info === 1 ? 'prenotato' : 'prenotati'}` : ''}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function Numero({ n, t, rosso = false }: { n: number; t: string; rosso?: boolean }) {
  return (
    <div>
      <p className={clsx('cifre text-[26px] font-light leading-none', rosso ? 'text-[#d63d3e]' : 'text-ink')}>{n}</p>
      <p className="mt-1 text-[11.5px] leading-tight text-ink-muted">{t}</p>
    </div>
  );
}

function Matrice({ dati }: { dati: DatiFormazione }) {
  const codici = useMemo(() => (dati.colonne.length > 0 ? dati.colonne.map((x) => x.codice) : dati.obblighi.map((o) => o.codice)), [dati]);
  if (dati.persone.length === 0) return <Vuoto titolo="Nessun lavoratore in forza" />;
  const cella = (p: DatiFormazione['persone'][number], k: string) => p.corsi.find((x) => x.codice === k) ?? null;
  return (
    <>
      <Scheda titolo="Lavoratori e corsi" sotto="Le date sono il mese e l’anno di scadenza." className="lg:hidden">
        <ul>
          {dati.persone.map((p) => (
            <li key={p.id} className="border-b border-perla-linea py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{p.nome}</span>
                  <span className="block text-[12.5px] text-ink-muted">{[p.mansione, p.rischio ? `rischio ${p.rischio}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="cifre text-[13px] text-ink-muted">
                  {p.validi}/{p.richiesti}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.corsi.map((k) => (
                  <span key={k.codice} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-perla-velo px-2.5 text-[12px] text-ink">
                    <span aria-hidden className={clsx('h-1.5 w-1.5 rounded-full', SEGNO[k.stato])} />
                    {BREVE[k.codice] ?? dati.obblighi.find((o) => o.codice === k.codice)?.nome ?? k.codice}
                    <span className="text-ink-muted">{k.scadeIl ? k.scadeIl.slice(5, 7) + '/' + k.scadeIl.slice(2, 4) : TESTO[k.stato]}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Scheda>
      <Scheda titolo="Lavoratori e corsi" sotto="Le date sono il mese e l’anno di scadenza. Il punto indica un corso non richiesto." className="hidden lg:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="py-2 pr-3 font-medium">Lavoratore</th>
              {codici.map((k) => (
                <th key={k} className="px-2 py-2 font-medium">
                  {dati.colonne.find((x) => x.codice === k)?.nome ?? BREVE[k] ?? dati.obblighi.find((o) => o.codice === k)?.nome.split(' ').slice(0, 2).join(' ')}
                </th>
              ))}
              <th className="py-2 pl-2 text-right font-medium">Validi</th>
            </tr>
          </thead>
          <tbody>
            {dati.persone.map((p) => (
              <tr key={p.id} className="border-t border-perla-linea">
                <td className="py-2.5 pr-3">
                  <span className="block font-medium text-ink">{p.nome}</span>
                  <span className="block text-[12px] text-ink-muted">{p.mansione}</span>
                </td>
                {codici.map((k) => {
                  const x = cella(p, k);
                  return (
                    <td key={k} className="px-2 py-2.5">
                      {x ? (
                        <span className={clsx('inline-flex items-center gap-1.5', x.stato === 'danger' && 'text-[#d63d3e]')}>
                          <span aria-hidden className={clsx('h-2 w-2 rounded-full', SEGNO[x.stato])} />
                          {x.scadeIl ? `${x.scadeIl.slice(5, 7)}/${x.scadeIl.slice(2, 4)}` : x.stato === 'ok' ? 'Fatto' : TESTO[x.stato]}
                        </span>
                      ) : (
                        <span className="text-grafite-300">·</span>
                      )}
                    </td>
                  );
                })}
                <td className="cifre py-2.5 pl-2 text-right text-ink">
                  {p.validi}/{p.richiesti}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scheda>
    </>
  );
}

function Attestati({ dati, onCarica }: { dati: DatiFormazione; onCarica: (() => void) | null }) {
  const [errore, setErrore] = useState<string | null>(null);
  const gruppi = useMemo(() => {
    const m = new Map<number, { nome: string; voci: DatiFormazione['attestati'] }>();
    dati.attestati.forEach((a) => {
      const g = m.get(a.lavoratoreId) ?? { nome: a.lavoratore ?? 'Lavoratore', voci: [] };
      g.voci.push(a);
      m.set(a.lavoratoreId, g);
    });
    return Array.from(m.entries());
  }, [dati]);
  if (gruppi.length === 0)
    return (
      <Vuoto
        titolo="Nessun attestato"
        azione={
          onCarica ? (
            <button type="button" className="btn-primary" onClick={onCarica}>
              Carica il primo attestato
            </button>
          ) : undefined
        }
      >
        Gli attestati arrivano qui a fine corso. Se ne hai uno su carta, fotografalo o caricalo in PDF.
      </Vuoto>
    );
  const oggi = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {errore && (
        <div className="lg:col-span-2">
          <Errore testo={errore} />
        </div>
      )}
      {gruppi.map(([id, g]) => (
        <Scheda key={id} titolo={g.nome}>
          <ul>
            {g.voci.map((a) => {
              const st: StatoChip | null = a.scadeIl ? (a.scadeIl < oggi ? 'danger' : a.scadeIl <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) ? 'warn' : null) : null;
              return (
                <li key={a.id} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink">{a.nomeCorso}</span>
                    <span className="block text-[12.5px] text-ink-muted">{[a.conseguitoIl ? `del ${dataIt(a.conseguitoIl)}` : null, a.scadeIl ? `valido fino al ${dataIt(a.scadeIl)}` : 'senza scadenza', a.ente].filter(Boolean).join(' · ')}</span>
                  </span>
                  {st && <Chip stato={st}>{st === 'danger' ? 'Da aggiornare' : 'In scadenza'}</Chip>}
                  {a.file && (
                    <button type="button" className="btn-icon" aria-label={`Scarica l’attestato ${a.nomeCorso}`} onClick={() => scarica(`/portale/area/attestati/${a.id}/file`, `attestato_${a.corso}.pdf`).catch((e: Error) => setErrore(e.message))}>
                      <Scarica size={18} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Scheda>
      ))}
    </div>
  );
}

function FoglioAttestato({ aziendaId, dati, lavoratore, onChiudi, onFatto }: { aziendaId: number; dati: DatiFormazione; lavoratore: number | null; onChiudi: () => void; onFatto: () => void }) {
  const [lav, setLav] = useState<number | ''>(lavoratore ?? '');
  const [corso, setCorso] = useState('formazione_generale');
  const [data, setData] = useState('');
  const [scade, setScade] = useState('');
  const [ente, setEnte] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const anni = dati.catalogo.find((c) => c.codice === corso)?.anni ?? null;
  const invia = async () => {
    if (!lav || !data) {
      setErrore('Scegli il lavoratore e la data dell’attestato.');
      return;
    }
    if (file && file.size > 15 * 1024 * 1024) {
      setErrore('Il file supera 15 MB.');
      return;
    }
    setInvio(true);
    setErrore(null);
    try {
      setNota(await caricaAttestato(aziendaId, { lavoratore_id: Number(lav), corso, data_conseguimento: data, data_scadenza: scade || undefined, ente: ente || undefined }, file));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto
      titolo="Carica un attestato"
      onChiudi={onChiudi}
      piede={
        nota ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={invia}>
              {invio ? 'Carico' : 'Carica'}
            </button>
          </>
        )
      }
    >
      {nota ? (
        <Fatto titolo="Attestato caricato">{nota}</Fatto>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="Lavoratore">
            <select className="input-field" value={lav} onChange={(e) => setLav(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Scegli</option>
              {dati.persone.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Corso">
            <select className="input-field" value={corso} onChange={(e) => setCorso(e.target.value)}>
              {dati.catalogo.map((c) => (
                <option key={c.codice} value={c.codice}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Data dell’attestato">
              <input className="input-field" type="date" value={data} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo etichetta="Valido fino al" aiuto={anni ? `Se lo lasci vuoto: dopo ${anni} anni.` : 'Senza scadenza, se non è indicata.'}>
              <input className="input-field" type="date" value={scade} onChange={(e) => setScade(e.target.value)} />
            </Campo>
          </div>
          <Campo etichetta="Ente che lo ha rilasciato (facoltativo)">
            <input className="input-field" value={ente} onChange={(e) => setEnte(e.target.value)} />
          </Campo>
          <Campo etichetta="File dell’attestato" aiuto="PDF o foto, al massimo 15 MB. Le foto perdono posizione e dati del telefono prima di essere salvate.">
            <input className="block w-full text-[14px] file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-grafite-900 file:px-4 file:text-white" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Campo>
          <Avviso tono="warn">Non caricare certificati di idoneità, referti o altri documenti sanitari: restano al medico competente e il portale li rifiuta.</Avviso>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

/** Corsi per attrezzature e corso non a catalogo (05 par. 20). */
function AltriCorsi({ dati, onChiedi }: { dati: DatiFormazione; onChiedi: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Scheda titolo="Corsi per attrezzature" azioni={<Chip stato="neutral">A pagamento</Chip>} sotto="Abilitazioni all’uso delle attrezzature: fuori dal canone, prezzo a persona. Tutti gli altri corsi sono inclusi nel canone.">
        <ul>
          {dati.attrezzature.map((k) => (
            <li key={k.codice} className="flex min-h-[52px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{k.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">
                  {k.ore} ore · € {k.prezzo} a persona
                </span>
              </span>
              {dati.permessi.richiedi && (
                <Link href="/azienda/servizi/?vista=catalogo" className="btn-ghost min-h-[40px] px-3">
                  Ordina
                </Link>
              )}
            </li>
          ))}
        </ul>
        {dati.permessi.richiedi && !dati.permessi.ordina && <p className="mt-2 text-[12.5px] text-ink-muted">L’ordine va al titolare, che lo approva e lo paga.</p>}
      </Scheda>
      <Scheda titolo="Non trovi il corso che ti serve?" sotto="Scrivilo all’assistente: se è a catalogo te lo propone subito, altrimenti lo passa a ISFOR.">
        {dati.permessi.iscrivi && (
          <button type="button" className="btn-primary" onClick={onChiedi}>
            Chiedi un corso non a catalogo
          </button>
        )}
        {dati.richieste.length > 0 && (
          <div className="mt-4">
            <p className="text-[12px] uppercase tracking-wide text-ink-muted">Richieste di corsi</p>
            <ul>
              {dati.richieste.map((r, i) => (
                <li key={i} className="flex min-h-[52px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{r.testo}</span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {r.chi} · {r.il ? dataIt(r.il) : ''} · risposta entro 2 giorni lavorativi
                    </span>
                  </span>
                  <Chip stato="run">{r.stato}</Chip>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Scheda>
    </div>
  );
}

/** Calendario delle classi in programma (04 Formazione, Calendario). */
function ClassiProgramma({ dati, onIscrivi }: { dati: DatiFormazione; onIscrivi: (k: DatiFormazione['classi'][number]) => void }) {
  if (dati.classi.length === 0)
    return (
      <Vuoto titolo="Nessuna classe in programma" azione={dati.permessi.iscrivi ? <button type="button" className="btn-primary" onClick={() => onIscrivi({ id: 0, titolo: '', corsi: [], data: '', ora: null, modalita: '', luogo: null, posti: 0, liberi: 0, iscritti: [] })}>Richiedi una classe</button> : undefined}>
        Quando la segreteria apre nuove classi le trovi qui.
      </Vuoto>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        {dati.classi.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-4 rounded-[1.25rem] p-4 ring-1 ring-inset ring-perla-linea">
            <span className="grid w-16 shrink-0 place-items-center rounded-[1rem] bg-perla-velo py-2 text-center">
              <span className="cifre text-[20px] leading-none text-ink">{Number(k.data.slice(8, 10))}</span>
              <span className="text-[12px] text-ink-muted">{giornoLungo(k.data).split(' ')[2]?.slice(0, 3)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{k.titolo}</span>
              <span className="block text-[13px] text-ink-muted">{[giornoLungo(k.data), k.ora, k.modalita].filter(Boolean).join(' · ')}</span>
              {k.luogo && <span className="block text-[13px] text-ink-muted">{k.luogo}</span>}
              {k.iscritti.length > 0 && <span className="block text-[13px] text-ink">Iscritti: {k.iscritti.join(', ')}</span>}
            </span>
            <span className="w-40 shrink-0 text-[12.5px] text-ink-muted">
              {k.posti - k.liberi} iscritti su {k.posti} posti
              <span className="my-1 block h-1.5 overflow-hidden rounded-full bg-perla-velo">
                <span className={clsx('block h-full', k.liberi === 0 ? 'bg-stato-danger-segno' : 'bg-grafite-900')} style={{ width: `${k.posti ? Math.round((100 * (k.posti - k.liberi)) / k.posti) : 0}%` }} />
              </span>
              {k.liberi === 0 ? <span className="text-stato-danger-ink">Classe al completo</span> : k.liberi === 1 ? '1 posto libero' : `${k.liberi} posti liberi`}
            </span>
            {dati.permessi.iscrivi && (
              <button type="button" className="btn-primary min-h-[40px] px-3" disabled={k.liberi === 0} onClick={() => onIscrivi(k)}>
                Iscrivi
              </button>
            )}
          </div>
        ))}
      </div>
      <Scheda titolo="Come funziona">
        <ol className="space-y-3">
          {[
            ['Iscrivi', 'Scegli la classe e i lavoratori. Il posto è tenuto subito.'],
            ['Convocazione', 'Il lavoratore la riceve su WhatsApp, con luogo e orario.'],
            ['Parte online', 'Prima serve la verifica del computer: webcam e connessione.'],
            ['Attestato', 'Arriva nel fascicolo entro 5 giorni dalla fine del corso.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="cifre grid h-7 w-7 shrink-0 place-items-center rounded-full bg-perla-velo text-[12.5px] text-ink">{i + 1}</span>
              <span className="text-[14px] text-ink">
                {t}
                <span className="block text-[12.5px] text-ink-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Scheda>
    </div>
  );
}
