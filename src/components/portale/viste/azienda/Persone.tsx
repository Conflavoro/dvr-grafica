'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Scheda, Testata, Vuoto, dataIt, traGiorni, type StatoChip } from '../../kit';
import { Copia, Indietro, Persone as IconaPersone, Piu } from '@/components/icone';
import { cessa, inviaLink, modificaMansione, nuovoAssunto, persone, schedaPersona, type EsitoMansione, type RigaPersona, type SchedaPersona } from '@/lib/portale/area-api';
import { CONTRATTI, CORSI_COMUNI, LINGUE, NOMI_RISCHIO, NOMI_TIPO_VISITA, dataOra, filtraPersone, pulisciCellulare, validaAssunto, type FiltroStatoPersona } from '@/lib/portale/area-logica';
import { Avviso, Campo, Fatto, FoglioPrenota, Pillole, Voce, useCarica, useQuery } from './comuni';
import { FoglioPrenotaVisita } from './FogliOperativita';
import { CalcoloAssunto, FoglioElenco, FoglioRegolarizza, SchedaNuovi, SchedaOrganico } from './PersoneSchede';
import type { Valutazione } from '@/lib/portale/area-operativita';

/**
 * Dipendenti (spec 4): elenco con lo stato, nuovi assunti e regolarizzazioni, organico su tre fonti,
 * scheda della persona con ?id=, nuovo assunto (rischio e visita calcolati), carica un elenco, mansione,
 * cessazione, link.
 */
export default function Persone() {
  const [id, setId] = useQuery('id');
  const n = id ? Number(id) : NaN;
  return Number.isFinite(n) && n > 0 ? <SchedaLavoratore id={n} onIndietro={() => setId(null)} /> : <Elenco onApri={(x) => setId(String(x))} />;
}

const STATI_FILTRO: Array<{ k: FiltroStatoPersona; t: string }> = [
  { k: 'tutti', t: 'Tutti' },
  { k: 'danger', t: 'Scadenze superate' },
  { k: 'todo', t: 'Da completare' },
  { k: 'warn', t: 'In scadenza' },
  { k: 'info', t: 'Prenotato' },
  { k: 'pay', t: 'Quota da pagare' },
  { k: 'ok', t: 'In regola' },
];

function iniziali(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function Elenco({ onApri }: { onApri: (id: number) => void }) {
  const { azienda, versione, puo, chiedi, sede } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCarica(() => persone(aid, sede), [aid, versione, sede]);
  const [scheda, setScheda] = useState<'elenco' | 'nuovi' | 'organico' | 'cessati'>('elenco');
  const [elenco, setElenco] = useState(false);
  const [regola, setRegola] = useState<NonNullable<typeof dati>['regolarizzazioni'][number] | null>(null);
  const [q, setQ] = useState('');
  const [stato, setStato] = useState<FiltroStatoPersona>('tutti');
  const [rischio, setRischio] = useState('');
  const [assunto, setAssunto] = useState(false);
  const righe = useMemo(() => (dati ? filtraPersone(dati.lavoratori, { testo: q, stato, rischio }) : []), [dati, q, stato, rischio]);
  if (!azienda) return null;
  const c = dati?.contatori;
  const filtri = q !== '' || stato !== 'tutti' || rischio !== '';

  return (
    <div className="space-y-5">
      <Testata
        categoria="persone"
        icona={IconaPersone}
        sopra={azienda.ragione_sociale}
        titolo="Dipendenti"
        sotto={c ? `${c.lavoratori} lavoratori${c.conVisita !== null ? ` · ${c.conVisita} con sorveglianza sanitaria` : ''}` : undefined}
        azioni={
          puo('nuovo_assunto') ? (
            <>
              <button type="button" className="btn-ghost" data-falco="carica_elenco" onClick={() => setElenco(true)}>
                Carica un elenco
              </button>
              <button type="button" className="btn-acido" data-falco="nuovo_assunto" data-falco-tocca="" onClick={() => setAssunto(true)}>
                <Piu size={16} aria-hidden /> Comunica un nuovo assunto
              </button>
            </>
          ) : undefined
        }
      />
      <Schede<'elenco' | 'nuovi' | 'organico' | 'cessati'>
        etichetta="Dipendenti"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'elenco', t: 'Elenco', n: c?.daSistemare },
          { k: 'nuovi', t: 'Nuovi assunti e regolarizzazioni', n: dati ? dati.nuovi.length + dati.regolarizzazioni.filter((x) => !x.regolarizzatoIl).length : undefined },
          { k: 'cessati', t: 'Cessati', n: dati?.cessati.length },
          ...(dati?.organico ? [{ k: 'organico' as const, t: 'Organico su tre fonti' }] : []),
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !dati && <Caricamento />}

      {dati && scheda === 'elenco' && (
        <>
          {dati.regolarizzazioni
            .filter((x) => !x.regolarizzatoIl)
            .map((x) => (
              <Avviso key={x.id} tono="danger" titolo={`${x.nome}: nelle denunce EBIASP ma non dichiarato`}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>Per il canone vale il numero più alto tra le tre fonti. Regolarizza ora per evitare la maggiorazione al rinnovo.</span>
                  {dati.permessi.modifica && (
                    <button type="button" className="btn-primary min-h-[40px] px-3" onClick={() => setRegola(x)}>
                      Regolarizza
                    </button>
                  )}
                </span>
              </Avviso>
            ))}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Riquadro etichetta="Lavoratori" valore={c!.lavoratori} sotto={c!.nuovi > 0 ? `${c!.nuovi} ${c!.nuovi === 1 ? 'assunto' : 'assunti'} negli ultimi 60 giorni` : 'In forza oggi'} />
            <Riquadro etichetta="Da sistemare" valore={c!.daSistemare} tono={c!.daSistemare > 0 ? 'danger' : undefined} sotto="Corsi, visite o quote" onClick={() => setStato('danger')} />
            {c!.copertura !== null && <Riquadro etichetta="Copertura formativa" valore={c!.copertura} unita="%" sotto="Con tutti i corsi validi" />}
            {c!.canoneMese !== null ? (
              <Riquadro etichetta="Canone attuale" valore={typeof c!.canoneMese === 'number' ? c!.canoneMese.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : c!.canoneMese} unita="€" sotto="Al mese, IVA esclusa" />
            ) : (
              <Riquadro etichetta="Nuovi assunti" valore={c!.nuovi} sotto="Negli ultimi 60 giorni" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input-field sm:max-w-sm" type="search" placeholder="Cerca per nome, mansione o reparto" data-falco-campo="cerca_dipendente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca" />
              <select className="input-field sm:w-48" value={rischio} onChange={(e) => setRischio(e.target.value)} aria-label="Rischio">
                <option value="">Ogni rischio</option>
                <option value="basso">Rischio basso</option>
                <option value="medio">Rischio medio</option>
                <option value="alto">Rischio alto</option>
              </select>
            </div>
            <Pillole<FiltroStatoPersona> etichetta="Stato" voci={STATI_FILTRO.map((s) => ({ ...s, n: s.k === 'tutti' ? undefined : dati.lavoratori.filter((r) => r.stato === s.k).length }))} scelte={[stato]} onCambia={setStato} />
          </div>

          {righe.length === 0 ? (
            <Vuoto
              titolo={dati.lavoratori.length === 0 ? 'Nessun dipendente ancora' : 'Nessun dipendente corrisponde ai filtri'}
              azione={
                dati.lavoratori.length === 0 && puo('nuovo_assunto') ? (
                  <button type="button" className="btn-primary" onClick={() => setAssunto(true)}>
                    Comunica il primo assunto
                  </button>
                ) : filtri ? (
                  <button type="button" className="btn-ghost" onClick={() => (setQ(''), setStato('tutti'), setRischio(''))}>
                    Togli i filtri
                  </button>
                ) : undefined
              }
            >
              {dati.lavoratori.length === 0 ? 'Quando comunichi un’assunzione, qui trovi corsi, visita e DPI di ogni persona, passo per passo.' : undefined}
            </Vuoto>
          ) : (
            <Scheda titolo={filtri ? `${righe.length} su ${dati.lavoratori.length}` : 'Tutti i dipendenti'} sotto="In alto chi ha qualcosa da sistemare.">
              <ul>
                {righe.map((r) => (
                  <li key={r.id}>
                    <RigaLavoratore r={r} onClick={() => onApri(r.id)} />
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
          {dati.nota && <p className="text-[12.5px] text-ink-muted">{dati.nota}</p>}
          <button type="button" className="btn-ghost" onClick={() => chiedi('Quali dipendenti hanno corsi, visite o DPI da sistemare? Dimmi da chi partire.')}>
            Chiedi al Falco da chi partire
          </button>
        </>
      )}

      {dati && scheda === 'nuovi' && <SchedaNuovi dati={dati} aziendaId={aid} onApri={onApri} onAssumi={() => setAssunto(true)} onFatto={carica} />}
      {dati && scheda === 'organico' && dati.organico && <SchedaOrganico o={dati.organico} nonDichiarati={dati.regolarizzazioni} onApri={onApri} />}

      {dati && scheda === 'cessati' && (
        <>
          <Avviso titolo="Il lavoratore cessato esce dal conteggio al prossimo rinnovo">Attestati e storico restano nel fascicolo per i controlli.</Avviso>
          {dati.cessati.length === 0 ? (
            <Vuoto titolo="Nessun lavoratore cessato">Quando comunichi una cessazione la trovi qui con la data e il motivo.</Vuoto>
          ) : (
            <Scheda titolo="Cessati">
              <ul>
                {dati.cessati.map((x) => (
                  <li key={x.id} className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-perla-velo text-[12px] font-medium text-ink-muted">{iniziali(x.nome)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{x.nome}</span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {x.mansione}
                        {x.motivo ? ` · ${x.motivo}` : ''}
                      </span>
                    </span>
                    <span className="text-[13px] text-ink-muted">{dataIt(x.cessatoIl)}</span>
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
        </>
      )}

      <FoglioAssunto aperto={assunto} onChiudi={() => setAssunto(false)} aziendaId={aid} reparti={dati?.reparti ?? []} mansioni={dati?.mansioni ?? []} onFatto={carica} onApri={onApri} />
      {regola && <FoglioRegolarizza aziendaId={aid} r={regola} onChiudi={() => setRegola(null)} onFatto={carica} />}
      {elenco && <FoglioElenco aziendaId={aid} onChiudi={() => setElenco(false)} onFatto={carica} onNuovi={() => setScheda('nuovi')} />}
    </div>
  );
}

function RigaLavoratore({ r, onClick }: { r: RigaPersona; onClick: () => void }) {
  const visita = r.sorveglianzaDaDefinire ? 'Sorveglianza da definire' : r.sorveglianza === false ? 'Visita: non serve' : r.visita ? (r.visita.finoAl ? `Visita fino al ${dataIt(r.visita.finoAl)}` : 'Prima visita da fare') : null;
  return (
    <button type="button" onClick={onClick} className="flex min-h-[68px] w-full items-center gap-3 border-b border-perla-linea py-2.5 text-left last:border-b-0 hover:bg-perla-velo/60">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cat-persone text-[13px] font-medium text-cat-persone-ink">{iniziali(r.nome)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-medium text-ink">{r.nome}</span>
          {r.nuovo && <span className="shrink-0 rounded-full bg-oro-500 px-2 py-0.5 text-[11px] font-medium text-acido-950">Nuovo</span>}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
          {[r.mansione, r.reparto, r.rischio ? `rischio ${r.rischio}` : null].filter(Boolean).join(' · ')}
        </span>
        <span className="mt-0.5 hidden truncate text-[12.5px] text-ink-muted sm:block">
          {[r.corsiRichiesti > 0 ? `Formazione ${r.corsiValidi} su ${r.corsiRichiesti} validi` : null, visita].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Chip stato={r.stato}>{r.statoTesto}</Chip>
    </button>
  );
}

// ---------------------------------------------------------------- nuovo assunto

function FoglioAssunto({
  aperto,
  onChiudi,
  aziendaId,
  reparti,
  mansioni,
  onFatto,
  onApri,
}: {
  aperto: boolean;
  onChiudi: () => void;
  aziendaId: number;
  reparti: string[];
  mansioni: string[];
  onFatto: () => void;
  onApri: (id: number) => void;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const vuoto = { nome: '', cognome: '', mansione: '', reparto: '', data: oggi, contratto: 'indeterminato', cellulare: '', lingua: 'it', unilav: '' };
  const [d, setD] = useState(vuoto);
  const [err, setErr] = useState<Record<string, string>>({});
  const [invio, setInvio] = useState(false);
  const [esito, setEsito] = useState<{ id: number; nome: string; quota: string | number | null } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [risposte, setRisposte] = useState<Record<string, boolean>>({});
  const [val, setVal] = useState<Valutazione | null>(null);
  useEffect(() => {
    if (aperto) {
      setD(vuoto);
      setRisposte({});
      setVal(null);
      setErr({});
      setEsito(null);
      setErrore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);
  const set = (k: keyof typeof vuoto) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const invia = async () => {
    const e = validaAssunto({ nome: d.nome, cognome: d.cognome, mansione: d.mansione, data: d.data, cellulare: d.cellulare, unilav: d.unilav });
    setErr(e as Record<string, string>);
    if (Object.keys(e).length > 0) return;
    setInvio(true);
    setErrore(null);
    try {
      const r = await nuovoAssunto(aziendaId, {
        nome: d.nome.trim(),
        cognome: d.cognome.trim(),
        mansione: d.mansione.trim(),
        reparto: d.reparto.trim() || undefined,
        data_assunzione: d.data,
        contratto: d.contratto,
        cellulare: pulisciCellulare(d.cellulare),
        lingua: d.lingua,
        unilav_riferimento: d.unilav.trim(),
        risposte,
        ...(val ? { rischio: val.rischio, ...(val.daCalcolare ? {} : { visita: val.visita }) } : {}),
      });
      setEsito(r);
      onFatto();
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Comunicazione non riuscita.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      largo
      titolo="Comunica un nuovo assunto"
      onChiudi={onChiudi}
      piede={
        esito ? (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Fatto
            </button>
            <button type="button" className="btn-primary" onClick={() => (onChiudi(), onApri(esito.id))}>
              Apri la scheda
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={invia}>
              {invio ? 'Invio' : 'Comunica l’assunzione'}
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo={`${esito.nome} è nell’elenco`}>
          Corso e visita preventiva sono da prenotare: li organizza la segreteria dello studio.
          {esito.quota !== null && ` Quota d’ingresso: ${typeof esito.quota === 'number' ? `€ ${esito.quota.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : esito.quota}, una volta sola; nessun canone fino al rinnovo.`}
        </Fatto>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etichetta="Nome" errore={err.nome}>
            <input className="input-field" data-falco-campo="assunto_nome" value={d.nome} onChange={set('nome')} autoComplete="off" />
          </Campo>
          <Campo etichetta="Cognome" errore={err.cognome}>
            <input className="input-field" data-falco-campo="assunto_cognome" value={d.cognome} onChange={set('cognome')} autoComplete="off" />
          </Campo>
          <Campo etichetta="Mansione" errore={err.mansione}>
            <input className="input-field" list="assunto-mansioni" data-falco-campo="assunto_mansione" value={d.mansione} onChange={set('mansione')} />
            <datalist id="assunto-mansioni">
              {mansioni.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
          <Campo etichetta="Reparto">
            {reparti.length > 0 ? (
              <select className="input-field" data-falco-campo="assunto_reparto" value={d.reparto} onChange={set('reparto')}>
                <option value="">Scegli il reparto</option>
                {reparti.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input-field" data-falco-campo="assunto_reparto" value={d.reparto} onChange={set('reparto')} />
            )}
          </Campo>
          <Campo etichetta="Data di assunzione" errore={err.data}>
            <input className="input-field" type="date" data-falco-campo="assunto_data" value={d.data} onChange={set('data')} />
          </Campo>
          <Campo etichetta="Tipo di contratto">
            <select className="input-field" value={d.contratto} onChange={set('contratto')}>
              {CONTRATTI.map((x) => (
                <option key={x.k} value={x.k}>
                  {x.t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Cellulare WhatsApp" errore={err.cellulare}>
            <input className="input-field" inputMode="tel" value={d.cellulare} onChange={set('cellulare')} placeholder="333 123 4567" />
          </Campo>
          <Campo etichetta="Lingua dei messaggi">
            <select className="input-field" value={d.lingua} onChange={set('lingua')}>
              {LINGUE.map((x) => (
                <option key={x.k} value={x.k}>
                  {x.t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Riferimento UniLav" errore={err.unilav} aiuto="Il numero della comunicazione obbligatoria di assunzione.">
            <input className="input-field" value={d.unilav} onChange={set('unilav')} />
          </Campo>
          <CalcoloAssunto aziendaId={aziendaId} mansione={d.mansione} reparto={d.reparto} risposte={risposte} onRisposte={setRisposte} onValutazione={setVal} />
          <div className="sm:col-span-2">
            <Avviso titolo="Cosa succede dopo">
              Calcoliamo la quota d’ingresso, segniamo da prenotare la formazione e, se serve, la visita preventiva; il lavoratore riceve il suo link personale. Lo studio verifica se il DVR va aggiornato.
            </Avviso>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
              I dati servono agli obblighi di sicurezza sul lavoro (D.Lgs. 81/08) e sono trattati secondo il GDPR. Non inserire qui dati sanitari: restano al medico competente.
            </p>
          </div>
          {errore && <p className="text-[13.5px] text-[#d63d3e] sm:col-span-2">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- scheda del lavoratore

function SchedaLavoratore({ id, onIndietro }: { id: number; onIndietro: () => void }) {
  const { azienda, versione, chiedi, apri } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: s, errore, carica, caricando } = useCarica(() => schedaPersona(aid, id), [aid, id, versione]);
  const [foglio, setFoglio] = useState<null | 'mansione' | 'cessazione' | 'visita' | 'corso' | 'link'>(null);
  const [corso, setCorso] = useState<string | null>(null);
  useEffect(() => {
    apri({ tipo: 'lavoratore', id }, aid);
    return () => apri(null);
  }, [id, aid, apri]);
  if (!azienda) return null;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onIndietro} className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-ink-muted hover:text-ink">
        <Indietro size={16} aria-hidden /> Tutti i dipendenti
      </button>
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !s && <Caricamento />}
      {s && (
        <>
          <Testata
            categoria="persone"
            icona={IconaPersone}
            sopra="Dipendente"
            titolo={s.nome}
            sotto={
              <span className="flex flex-wrap items-center gap-2">
                {[s.anagrafica.mansione, s.anagrafica.reparto, s.rischio ? `rischio ${s.rischio}` : null].filter(Boolean).join(' · ')}
                <Chip stato={s.stato.stato}>{s.stato.testo}</Chip>
              </span>
            }
            azioni={
              <>
                <button type="button" className="btn-ghost bg-white/80" onClick={() => chiedi(`Spiegami cosa manca per ${s.nome} (lavoratore ${s.id}).`)}>
                  Chiedi al Falco
                </button>
                {s.permessi.modifica && !s.anagrafica.cessato_il && (
                  <button type="button" className="btn-ghost bg-white/80" onClick={() => setFoglio('mansione')}>
                    Modifica mansione
                  </button>
                )}
              </>
            }
          />

          {s.quota && (
            <Avviso tono="warn" titolo={`Quota d’ingresso da pagare: ${typeof s.quota.importo === 'number' ? `€ ${s.quota.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : s.quota.importo}`}>
              Corso e visita restano in attesa finché la quota non è pagata. Si paga dal wallet o con carta nel portale.
            </Avviso>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Scheda titolo="Dati e contratto">
              <Voce etichetta="Assunto il">{dataIt(s.anagrafica.assunto_il) || 'Non indicato'}</Voce>
              <Voce etichetta="Contratto">{CONTRATTI.find((x) => x.k === s.anagrafica.contratto)?.t ?? s.anagrafica.contratto ?? 'Non indicato'}</Voce>
              <Voce etichetta="Cellulare WhatsApp">{s.anagrafica.cellulare ?? 'Non indicato'}</Voce>
              <Voce etichetta="Lingua dei messaggi">{LINGUE.find((x) => x.k === s.anagrafica.lingua)?.t ?? 'Italiano'}</Voce>
              <Voce etichetta="UniLav">{s.anagrafica.unilav ?? 'Nel fascicolo'}</Voce>
              {s.anagrafica.cessato_il && <Voce etichetta="Cessato il">{`${dataIt(s.anagrafica.cessato_il)}${s.anagrafica.motivo_cessazione ? ` · ${s.anagrafica.motivo_cessazione}` : ''}`}</Voce>}
            </Scheda>

            <Scheda titolo="Visita medica">
              {s.visiteBloccate ? (
                <p className="py-2 text-[14px] text-ink-muted">Le visite e i dati sanitari li vedono solo titolare, referente e medico competente.</p>
              ) : s.sorveglianzaDaDefinire ? (
                <p className="py-2 text-[14px] text-ink-muted">Sorveglianza sanitaria da definire: la indica il medico competente con il protocollo sanitario della mansione. Chiedi allo studio di verificarla.</p>
              ) : s.sorveglianza === false || s.visita === null ? (
                <p className="py-2 text-[14px] text-ink-muted">Non serve: la mansione non prevede la sorveglianza sanitaria.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[13px] text-ink-muted">{s.visita.finoAl ? 'Visita valida fino al' : 'Prima visita'}</p>
                      <p className="cifre text-[30px] font-light leading-tight tracking-[-0.03em] text-ink">{s.visita.finoAl ? dataIt(s.visita.finoAl) : 'Da fare'}</p>
                      {s.visita.finoAl && <p className="text-[12.5px] text-ink-muted">{traGiorni(s.visita.finoAl)}</p>}
                    </div>
                    <Chip stato={s.visita.stato}>{testoVisita(s.visita.stato, s.visita.statoPrenotazione)}</Chip>
                  </div>
                  {s.visita.esito && <Voce etichetta="Esito del giudizio">{s.visita.esito.testo}</Voce>}
                  {s.visita.appuntamento && (
                    <Voce etichetta="Appuntamento">
                      {dataOra(s.visita.appuntamento)}
                      {s.visita.luogo ? `, ${s.visita.luogo}` : ''}
                    </Voce>
                  )}
                  {s.visita.tipoVisita && <Voce etichetta="Tipo">{NOMI_TIPO_VISITA[s.visita.tipoVisita] ?? s.visita.tipoVisita}</Voce>}
                  {s.permessi.prenota && !s.visita.appuntamento && s.visita.stato !== 'ok' && (
                    <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setFoglio('visita')}>
                      Chiedi la visita allo studio
                    </button>
                  )}
                  <p className="text-[12.5px] text-ink-muted">Il portale conserva solo date ed esito sintetico. Diagnosi ed esami restano al medico competente.</p>
                </div>
              )}
            </Scheda>

            <Scheda titolo="Formazione" sotto={s.corsi ? `${s.corsi.filter((c) => c.stato === 'ok' || c.stato === 'warn').length} su ${s.corsi.length} corsi validi` : undefined}>
              {s.corsi === null ? (
                <p className="py-2 text-[14px] text-ink-muted">La formazione la seguono titolare e referente.</p>
              ) : (
                <ul>
                  {s.corsi.map((c) => (
                    <li key={c.codice} className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink">{c.nome}</span>
                        <span className="block text-[12.5px] text-ink-muted">
                          {[c.ore ? `${c.ore} ore` : null, c.scadeIl ? `valido fino al ${dataIt(c.scadeIl)}` : c.conseguitoIl ? 'senza scadenza' : 'mai fatto'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Chip stato={c.stato}>{testoCorso(c.stato)}</Chip>
                      {s.permessi.prenota && ['todo', 'danger', 'warn'].includes(c.stato) && (
                        <button type="button" className="btn-ghost hidden min-h-[44px] lg:min-h-[40px] px-3 sm:inline-flex" onClick={() => (setCorso(c.codice), setFoglio('corso'))}>
                          Chiedi
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {s.corsi && s.permessi.prenota && s.corsi.some((c) => ['todo', 'danger', 'warn'].includes(c.stato)) && (
                <button type="button" className="btn-ghost mt-3 w-full sm:hidden" onClick={() => (setCorso(s.corsi!.find((c) => ['todo', 'danger', 'warn'].includes(c.stato))!.codice), setFoglio('corso'))}>
                  Chiedi il corso allo studio
                </button>
              )}
            </Scheda>

            <Scheda titolo="DPI consegnati">
              {s.dpi.length === 0 ? (
                <p className="py-2 text-[14px] text-ink-muted">Nessuna consegna registrata. Le registra il tecnico con il verbale di consegna firmato.</p>
              ) : (
                <ul>
                  {s.dpi.map((x) => (
                    <li key={x.id} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] text-ink">{x.descrizione}</span>
                        <span className="block text-[12.5px] text-ink-muted">{[x.norma, x.consegnatoIl ? `consegnato il ${dataIt(x.consegnatoIl)}` : null].filter(Boolean).join(' · ')}</span>
                      </span>
                      {x.scadeIl && <Chip stato={x.stato}>{`Fino al ${dataIt(x.scadeIl, true)}`}</Chip>}
                    </li>
                  ))}
                </ul>
              )}
            </Scheda>

            <Scheda titolo="Link personale del lavoratore" className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-soft">
                  {s.nome.split(' ')[0]} riceve un link personale: vede le sue convocazioni e scarica i suoi attestati. Non serve password.
                </p>
                <Chip stato={s.link.attivo ? 'ok' : 'todo'}>{s.link.attivo ? 'Link attivo' : 'Da inviare'}</Chip>
                {s.permessi.modifica && !s.anagrafica.cessato_il && (
                  <button type="button" className="btn-ghost" onClick={() => setFoglio('link')}>
                    {s.link.attivo ? 'Nuovo link' : 'Crea il link'}
                  </button>
                )}
                {s.permessi.cessa && !s.anagrafica.cessato_il && (
                  <button type="button" className="btn-ghost text-[#d63d3e]" onClick={() => setFoglio('cessazione')}>
                    Comunica la cessazione
                  </button>
                )}
              </div>
            </Scheda>
          </div>

          <FoglioMansione aperto={foglio === 'mansione'} onChiudi={() => setFoglio(null)} aziendaId={aid} s={s} onFatto={carica} />
          <FoglioCessazione aperto={foglio === 'cessazione'} onChiudi={() => setFoglio(null)} aziendaId={aid} s={s} onFatto={carica} />
          <FoglioLink aperto={foglio === 'link'} onChiudi={() => setFoglio(null)} aziendaId={aid} s={s} onFatto={carica} />
          {foglio === 'visita' && <FoglioPrenotaVisita aziendaId={aid} lavoratore={{ id: s.id, nome: s.nome, mansione: s.anagrafica.mansione ?? '' }} persone={[{ id: s.id, nome: s.nome, mansione: s.anagrafica.mansione ?? '' }]} cambio={!!s.visita?.appuntamento} onChiudi={() => setFoglio(null)} onFatto={carica} />}
          <FoglioPrenota aperto={foglio === 'corso'} onChiudi={() => setFoglio(null)} aziendaId={aid} tipo="corso" persone={[{ id: s.id, nome: s.nome }]} preselezione={[s.id]} corso={corso} corsi={CORSI_COMUNI} onFatto={carica} />
        </>
      )}
    </div>
  );
}

function testoVisita(st: StatoChip, pren: string | null): string {
  if (st === 'info') return pren === 'in_calendario' ? 'In calendario' : 'Prenotata';
  return { ok: 'Valida', warn: 'In scadenza', danger: 'Scaduta', todo: 'Da fare' }[st as 'ok'] ?? '';
}

function testoCorso(st: StatoChip): string {
  return { ok: 'Valido', warn: 'In scadenza', danger: 'Scaduto', todo: 'Da fare', info: 'Prenotato' }[st as 'ok'] ?? '';
}

function FoglioMansione({ aperto, onChiudi, aziendaId, s, onFatto }: { aperto: boolean; onChiudi: () => void; aziendaId: number; s: SchedaPersona; onFatto: () => void }) {
  const [m, setM] = useState('');
  const [reparto, setReparto] = useState('');
  const [rischio, setRischio] = useState('');
  const [sorv, setSorv] = useState<'' | 'si' | 'no'>('');
  const [ant, setAnt] = useState<EsitoMansione | null>(null);
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  useEffect(() => {
    if (!aperto) return;
    setM(s.anagrafica.mansione ?? '');
    setReparto(s.anagrafica.reparto ?? '');
    setRischio(s.rischio ?? '');
    setSorv(s.sorveglianza === null ? '' : s.sorveglianza ? 'si' : 'no');
    setAnt(null);
    setFatto(false);
    setErrore(null);
  }, [aperto, s]);
  const corpo = () => ({ mansione: m.trim(), reparto: reparto.trim() || null, rischio: rischio || null, ...(sorv ? { sorveglianza: sorv === 'si' } : {}) });
  const vai = async (conferma: boolean) => {
    if (m.trim().length < 3) {
      setErrore('Scrivi la mansione (almeno 3 caratteri).');
      return;
    }
    setInvio(true);
    setErrore(null);
    try {
      const r = await modificaMansione(aziendaId, s.id, { ...corpo(), conferma });
      if (conferma) {
        setFatto(true);
        onFatto();
      } else setAnt(r);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Modifica non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto={aperto}
      titolo="Modifica mansione e rischio"
      onChiudi={onChiudi}
      piede={
        fatto ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Fatto
          </button>
        ) : ant ? (
          <>
            <button type="button" className="btn-ghost" onClick={() => setAnt(null)}>
              Torna ai dati
            </button>
            <button type="button" className="btn-primary" disabled={invio || !ant.cambiato} onClick={() => vai(true)}>
              {invio ? 'Salvo' : 'Conferma e salva'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={() => vai(false)}>
              {invio ? 'Calcolo' : 'Vedi cosa cambia'}
            </button>
          </>
        )
      }
    >
      {fatto ? (
        <Fatto titolo="Modifiche salvate">Lo studio riceve la novità e verifica DVR e mansionario.</Fatto>
      ) : ant ? (
        <div className="space-y-3">
          {!ant.cambiato ? (
            <Avviso>Non hai cambiato nulla.</Avviso>
          ) : (
            <>
              <p className="text-[14px] text-ink-soft">Con la nuova mansione succede questo:</p>
              <ul className="space-y-2">
                {ant.effetti.map((e) => (
                  <li key={e} className="rounded-[1rem] bg-perla-velo px-4 py-3 text-[14px] leading-relaxed text-ink">
                    {e}
                  </li>
                ))}
              </ul>
            </>
          )}
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="Mansione">
            <input className="input-field" value={m} onChange={(e) => setM(e.target.value)} />
          </Campo>
          <Campo etichetta="Reparto">
            <input className="input-field" value={reparto} onChange={(e) => setReparto(e.target.value)} />
          </Campo>
          <Campo etichetta="Rischio">
            <select className="input-field" value={rischio} onChange={(e) => setRischio(e.target.value)}>
              <option value="">Non indicato</option>
              {Object.entries(NOMI_RISCHIO).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          {s.sorveglianza !== null && (
            <Campo etichetta="Sorveglianza sanitaria">
              <select className="input-field" value={sorv} onChange={(e) => setSorv(e.target.value as 'si' | 'no')}>
                <option value="si">Sì, serve la visita</option>
                <option value="no">No</option>
              </select>
            </Campo>
          )}
          <Avviso tono="warn">Il cambio di mansione può chiedere formazione e visita in più, e il tecnico deve verificare il DVR. Prima ti mostriamo cosa cambia.</Avviso>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioCessazione({ aperto, onChiudi, aziendaId, s, onFatto }: { aperto: boolean; onChiudi: () => void; aziendaId: number; s: SchedaPersona; onFatto: () => void }) {
  const { dati } = useCarica(() => (aperto ? persone(aziendaId) : Promise.resolve(null)), [aperto, aziendaId]);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  useEffect(() => {
    if (aperto) {
      setNota(null);
      setErrore(null);
      setMotivo('');
    }
  }, [aperto]);
  const invia = async () => {
    if (!motivo) {
      setErrore('Scegli il motivo.');
      return;
    }
    setInvio(true);
    setErrore(null);
    try {
      setNota((await cessa(aziendaId, s.id, data, motivo)) ?? 'Cessazione registrata.');
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Cessazione non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto={aperto}
      titolo="Comunica una cessazione"
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
            <button type="button" className="btn-primary bg-[#d63d3e]" disabled={invio} onClick={invia}>
              {invio ? 'Invio' : 'Comunica la cessazione'}
            </button>
          </>
        )
      }
    >
      {nota ? (
        <Fatto titolo={`${s.nome} è tra i cessati`}>{nota}</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[14.5px] text-ink">{s.nome}</p>
          <Campo etichetta="Ultimo giorno di lavoro">
            <input className="input-field" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Motivo">
            <select className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Scegli</option>
              {(dati?.motivi ?? []).map((x) => (
                <option key={x.k} value={x.k}>
                  {x.t}
                </option>
              ))}
            </select>
          </Campo>
          <Avviso tono="warn" titolo="Cosa succede">
            Corsi e visite ancora aperti si chiudono e il link personale si spegne. Il lavoratore esce dal conteggio al rinnovo.
          </Avviso>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioLink({ aperto, onChiudi, aziendaId, s, onFatto }: { aperto: boolean; onChiudi: () => void; aziendaId: number; s: SchedaPersona; onFatto: () => void }) {
  const [r, setR] = useState<{ link: string; nota: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [copiato, setCopiato] = useState(false);
  useEffect(() => {
    if (aperto) {
      setR(null);
      setErrore(null);
      setCopiato(false);
    }
  }, [aperto]);
  const crea = async () => {
    setInvio(true);
    setErrore(null);
    try {
      setR(await inviaLink(aziendaId, s.id));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Link non creato.');
    } finally {
      setInvio(false);
    }
  };
  const wa = r && s.anagrafica.cellulare ? `https://wa.me/${s.anagrafica.cellulare.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Ciao ${s.nome.split(' ')[0]}, questo è il tuo link personale per visite e corsi: ${r.link}`)}` : null;
  return (
    <Foglio
      aperto={aperto}
      titolo="Link personale"
      onChiudi={onChiudi}
      piede={
        r ? (
          <>
            {wa && (
              <a className="btn-primary" href={wa} target="_blank" rel="noreferrer">
                Manda su WhatsApp
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Chiudi
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={crea}>
              {invio ? 'Creo' : 'Crea il link'}
            </button>
          </>
        )
      }
    >
      {r ? (
        <div className="space-y-3">
          <p className="text-[14px] leading-relaxed text-ink-soft">{r.nota}</p>
          <div className="flex items-center gap-2 rounded-[1rem] bg-perla-velo px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{r.link}</code>
            <button
              type="button"
              className="btn-icon"
              aria-label="Copia il link"
              onClick={() => {
                void navigator.clipboard?.writeText(r.link);
                setCopiato(true);
              }}
            >
              <Copia size={16} aria-hidden />
            </button>
          </div>
          {copiato && <p className="text-[12.5px] text-ink-muted">Copiato.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Creiamo un link nuovo per {s.nome}. {s.link.attivo ? 'Il link di prima smette di funzionare.' : ''}
          </p>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

