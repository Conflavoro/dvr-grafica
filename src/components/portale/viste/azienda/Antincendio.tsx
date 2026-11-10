'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Scheda, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Fiamma, Piu, Scarica } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { anti, antincendio, richiestaStudio, scarica, type Addetto, type Antincendio as DatiAnti, type Presidio } from '@/lib/portale/area-api';
import { nomeMese } from '@/lib/portale/area-logica';
import { Avviso, Campo, Fatto, FoglioPrenota, Voce, useCarica } from './comuni';
import { FoglioScheda } from './AntincendioScheda';
import { antincendioExtra } from '@/lib/portale/luoghi-api';

type SchedaA = 'panoramica' | 'presidi' | 'registro' | 'addetti' | 'emergenza';
type FoglioA = null | 'presidio' | 'sorveglianza' | 'semestrale' | 'prova' | 'manutentore' | 'designa' | { segnala: Presidio };

const TESTO_PRESIDIO: Record<string, string> = { ok: 'In regola', warn: 'Controllo vicino', danger: 'Da sistemare', todo: 'Senza verifica' };

/** Antincendio (spec 7): presidi, registro dei controlli, addetti, prove di evacuazione, piano di emergenza. */
export default function Antincendio() {
  const { azienda, versione, chiedi } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCarica(() => antincendio(aid), [aid, versione]);
  const [scheda, setScheda] = useState<SchedaA>('panoramica');
  const [foglio, setFoglio] = useState<FoglioA>(null);
  const [corso, setCorso] = useState<number[] | null>(null);
  const [errAzione, setErrAzione] = useState<string | null>(null);
  // Scheda del manutentore (9.9): undefined = chiuso, altrimenti la sede della voce.
  const [schedaSede, setSchedaSede] = useState<string | null | undefined>(undefined);
  const { dati: extra } = useCarica(() => antincendioExtra(aid), [aid, versione]);
  if (!azienda) return null;
  const d = dati;
  const c = d?.contatori;
  const puoR = d?.permessi.registra ?? false;

  const azioneTestata: Record<SchedaA, { t: string; f: FoglioA } | null> = {
    panoramica: puoR ? { t: 'Fai la sorveglianza del mese', f: 'sorveglianza' } : null,
    presidi: puoR ? { t: 'Aggiungi un presidio', f: 'presidio' } : null,
    registro: null,
    addetti: { t: 'Chiedi la designazione', f: 'designa' },
    emergenza: puoR ? { t: 'Registra una prova', f: 'prova' } : null,
  };
  const az = azioneTestata[scheda];
  const daFareAzione = (x: DatiAnti['daFare'][number]) => {
    if (x.azione === 'sorveglianza') setFoglio('sorveglianza');
    else if (x.azione === 'prova') setFoglio('prova');
    else if (x.azione === 'addetto') setFoglio('designa');
    else if (x.azione === 'corso') setCorso(x.lavoratoreId ? [x.lavoratoreId] : []);
    else if (x.azione === 'manutentore') setScheda(d?.manutentore ? 'presidi' : 'panoramica');
    else if (x.azione === 'scheda') setSchedaSede(extra?.schede.find((v) => v.testo === x.testo)?.sede ?? null);
  };
  const riparato = async (p: Presidio) => {
    setErrAzione(null);
    try {
      await anti.riparato(p.id);
      carica();
    } catch (e) {
      setErrAzione(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };

  return (
    <div className="space-y-5">
      <Testata
        categoria="antincendio"
        icona={Fiamma}
        sopra={azienda.ragione_sociale}
        titolo="Antincendio"
        sotto={d ? `${d.livello ? `Rischio incendio livello ${d.livello.numero}` : 'Livello di rischio da indicare dal tecnico'} · ${c!.presidiOk} presidi su ${c!.presidi} in regola · ${c!.daFare} cose da fare` : undefined}
        azioni={
          scheda === 'registro' && puoR ? (
            <button type="button" className="btn-acido" onClick={() => setSchedaSede(null)}>
              Carica la scheda del manutentore
            </button>
          ) : az ? (
            <button type="button" className="btn-acido" onClick={() => setFoglio(az.f)}>
              {az.t}
            </button>
          ) : undefined
        }
      />
      <Schede<SchedaA>
        etichetta="Antincendio"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'panoramica', t: 'Panoramica', n: c?.daFare },
          { k: 'presidi', t: 'Presidi', n: c?.daRiparare },
          { k: 'registro', t: 'Registro' },
          { k: 'addetti', t: 'Addetti', n: c && c.addettiAntincendio < c.addettiMinimi ? 1 : undefined },
          { k: 'emergenza', t: 'Emergenza' },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {errAzione && <Errore testo={errAzione} />}
      {caricando && !d && <Caricamento />}

      {d && scheda === 'panoramica' && (
        <>
          <section className="rounded-[1.75rem] bg-oro-500 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <h2 className="text-[20px] font-medium tracking-[-0.015em] text-acido-950">Da fare per l’antincendio</h2>
              <span className="cifre grid h-7 min-w-7 place-items-center rounded-full bg-black px-2 text-[13px] text-white">{d.daFare.length}</span>
            </div>
            {d.daFare.length === 0 ? (
              <p className="rounded-[1.25rem] bg-white px-4 py-4 text-[14px] text-ink">Niente da fare: presidi, addetti e prove di evacuazione sono in regola.</p>
            ) : (
              <ul className="space-y-2">
                {d.daFare.map((x, i) => (
                  <li key={i} className="flex min-h-[64px] items-center gap-3 rounded-[1.25rem] bg-white px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium leading-snug text-ink">{x.testo}</span>
                      <span className="block text-[12.5px] text-ink-muted">{x.extra}</span>
                    </span>
                    {(puoR || x.azione === 'addetto' || x.azione === 'corso') && x.azione !== 'manutentore' && (
                      <button type="button" className="btn-primary min-h-[44px] lg:min-h-[40px] px-4" onClick={() => daFareAzione(x)}>
                        {{ sorveglianza: 'Fai', prova: 'Organizza', addetto: 'Chiedi', corso: 'Chiedi', scheda: 'Carica la scheda' }[x.azione] ?? 'Apri'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Riquadro etichetta="Presidi in regola" valore={`${c!.presidiOk}/${c!.presidi}`} sotto={c!.daRiparare > 0 ? `${c!.daRiparare} da riparare` : 'Nessuno da riparare'} onClick={() => setScheda('presidi')} />
            <Riquadro etichetta="Prossimo controllo" valore={d.prossimoSemestrale ? dataIt(d.prossimoSemestrale, true) : 'n.d.'} sotto={d.prossimoSemestrale ? `${d.prossimoSemestrale.slice(0, 4)}, ${traGiorni(d.prossimoSemestrale)} · ${d.manutentore?.ditta ?? 'manutentore da incaricare'}` : 'Registra l’ultima verifica'} onClick={() => setScheda('registro')} />
            <Riquadro etichetta="Addetti antincendio" valore={`${c!.addettiAntincendio}/${c!.addettiMinimi}`} tono={c!.addettiAntincendio < c!.addettiMinimi ? 'danger' : undefined} sotto={c!.addettiAntincendio < c!.addettiMinimi ? 'Sotto il minimo' : 'Numero minimo raggiunto'} onClick={() => setScheda('addetti')} />
            <Riquadro etichetta="Prossima prova" valore={extra && !extra.pianoObbligatorio ? 'n.d.' : d.prove.prossimaEntro ? dataIt(d.prove.prossimaEntro, true) : 'Da fare'} tono={d.prove.stato === 'danger' ? 'danger' : undefined} sotto={extra && !extra.pianoObbligatorio ? 'Non obbligatoria per la tua azienda' : d.prove.numero === 0 ? 'Mai fatta: organizzala' : `${d.prove.prossimaEntro?.slice(0, 4) ?? ''} · almeno una volta l’anno`} onClick={() => setScheda('emergenza')} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Scheda titolo="Rischio incendio">
              {d.livello ? (
                <div className="space-y-2 py-1">
                  <div className="flex items-end gap-1.5" aria-hidden>
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={clsx('w-4 rounded-full', n <= d.livello!.numero ? 'bg-cat-antincendio-segno' : 'bg-perla-velo')} style={{ height: `${10 + n * 8}px` }} />
                    ))}
                  </div>
                  <p className="text-[16px] font-medium text-ink">{d.livello.nome}</p>
                  <p className="text-[13.5px] text-ink-muted">Per {d.livello.uso}.</p>
                  <ul className="list-disc space-y-1 pl-5 pt-1 text-[13.5px] text-ink-soft">
                    <li>Corso addetti di {d.livello.ore} ore, aggiornamento di {d.livello.aggiornamento} ore ogni 5 anni (DM 02/09/2021).</li>
                    <li>Sorveglianza mensile annotata nel registro e controllo del manutentore ogni 6 mesi (DM 01/09/2021).</li>
                    <li>Piano di emergenza e prova di evacuazione almeno una volta l’anno (DM 02/09/2021).</li>
                  </ul>
                </div>
              ) : (
                <p className="py-1 text-[14px] text-ink-muted">Il livello lo indica il tecnico dello studio con il piano di emergenza: dipende dall’attività e dai locali (DM 03/09/2021 e DM 02/09/2021).</p>
              )}
            </Scheda>
            <Manutentore d={d} onCambia={() => setFoglio('manutentore')} />
          </div>
        </>
      )}

      {d && scheda === 'presidi' && (
        <>
          {!d.manutentore && d.presidi.length > 0 && <Avviso tono="warn" titolo="Manca il manutentore">Il controllo semestrale lo fa un tecnico qualificato (DM 01/09/2021): incaricalo dalla panoramica.</Avviso>}
          <ElencoPresidi d={d} puo={puoR} onSegnala={(p) => setFoglio({ segnala: p })} onRiparato={riparato} onAggiungi={() => setFoglio('presidio')} />
          <p className="text-[12.5px] text-ink-muted">La verifica semestrale la fa il manutentore qualificato; la sorveglianza mensile la fate voi, dal registro dei controlli.</p>
        </>
      )}

      {d && scheda === 'registro' && <Registro d={d} puo={puoR} onSorveglianza={() => setFoglio('sorveglianza')} />}
      {d && scheda === 'addetti' && <Addetti d={d} onCorso={(ids) => setCorso(ids)} onDesigna={() => setFoglio('designa')} />}
      {d && scheda === 'emergenza' && extra && !extra.pianoObbligatorio && (
        <Avviso titolo={`Hai ${extra.lavoratori} lavoratori.`}>
          Sotto i 10 lavoratori bastano le misure di emergenza generali: vie di uscita libere, addetti formati e i numeri di emergenza a portata di mano. Puoi comunque registrare una prova, se la fate.
        </Avviso>
      )}
      {d && scheda === 'emergenza' && <Emergenza d={d} puo={puoR} onProva={() => setFoglio('prova')} onChiedi={() => chiedi('Cosa deve contenere il piano di emergenza della mia azienda e chi lo prepara?')} />}

      {d && foglio === 'presidio' && <FoglioPresidio d={d} aid={aid} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio === 'sorveglianza' && <FoglioSorveglianza d={d} aid={aid} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && schedaSede !== undefined && (
        <FoglioScheda aid={aid} sede={schedaSede} sedi={Array.from(new Set(d.presidi.map((p) => p.sede ?? '').filter(Boolean)))} onChiudi={() => setSchedaSede(undefined)} onFatto={carica} />
      )}
      {d && foglio === 'semestrale' && <FoglioSemestrale d={d} aid={aid} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio === 'prova' && <FoglioProva aid={aid} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio === 'manutentore' && <FoglioManutentore d={d} aid={aid} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio === 'designa' && <FoglioDesigna aid={aid} livello={d.livello?.numero ?? null} onChiudi={() => setFoglio(null)} />}
      {d && foglio && typeof foglio === 'object' && <FoglioSegnala d={d} aid={aid} p={foglio.segnala} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {corso && <FoglioPrenota aperto onChiudi={() => setCorso(null)} aziendaId={aid} tipo="corso" corso="antincendio" corsi={[{ codice: 'antincendio', nome: 'Addetto antincendio e gestione emergenze' }, { codice: 'primo_soccorso', nome: 'Addetto al primo soccorso' }]} persone={[...d!.addetti.antincendio, ...d!.addetti.primoSoccorso].filter((a) => a.lavoratoreId).filter((a, i, all) => all.findIndex((b) => b.lavoratoreId === a.lavoratoreId) === i).map((a) => ({ id: a.lavoratoreId!, nome: a.nome, nota: a.mansione ?? undefined }))} preselezione={corso} onFatto={carica} />}
    </div>
  );
}

function Manutentore({ d, onCambia }: { d: DatiAnti; onCambia: () => void }) {
  return (
    <Scheda titolo="Manutentore">
      {d.manutentore ? (
        <div className="space-y-2 py-1">
          <p className="text-[16px] font-medium text-ink">{d.manutentore.ditta}</p>
          <p className="text-[13.5px] text-ink-muted">{d.manutentore.contratto}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-primary" href={`tel:${d.manutentore.telefono}`}>
              Chiama {d.manutentore.telefono}
            </a>
            {d.permessi.manutentore && (
              <button type="button" className="btn-ghost" onClick={onCambia}>
                Cambia
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-1">
          <p className="text-[14px] text-ink-muted">Nessun manutentore incaricato per i controlli semestrali dei presidi.</p>
          {d.permessi.manutentore ? (
            <button type="button" className="btn-primary" onClick={onCambia}>
              Incarica un manutentore
            </button>
          ) : (
            <Blocco>Solo il titolare può incaricare il manutentore</Blocco>
          )}
        </div>
      )}
    </Scheda>
  );
}

function ElencoPresidi({ d, puo, onSegnala, onRiparato, onAggiungi }: { d: DatiAnti; puo: boolean; onSegnala: (p: Presidio) => void; onRiparato: (p: Presidio) => void; onAggiungi: () => void }) {
  const gruppi = useMemo(() => {
    const m = new Map<string, Presidio[]>();
    d.presidi.forEach((p) => m.set(p.tipoNome, [...(m.get(p.tipoNome) ?? []), p]));
    return Array.from(m.entries());
  }, [d]);
  if (gruppi.length === 0)
    return (
      <Vuoto
        titolo="Nessun presidio registrato"
        azione={
          puo ? (
            <button type="button" className="btn-primary" onClick={onAggiungi}>
              <Piu size={16} aria-hidden /> Aggiungi il primo presidio
            </button>
          ) : undefined
        }
      >
        Aggiungi estintori, idranti, porte tagliafuoco, uscite e luci di emergenza: poi li controlli ogni mese dal registro.
      </Vuoto>
    );
  return (
    <div className="space-y-3">
      {gruppi.map(([tipo, ps]) => (
        <Scheda key={tipo} titolo={tipo} sotto={`${ps.length} ${ps.length === 1 ? 'presidio' : 'presidi'}${ps[0].norma ? ` · ${ps[0].norma}` : ''}`}>
          <ul>
            {ps.map((p) => (
              <li key={p.id} className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-perla-linea py-2.5 last:border-b-0">
                <span className="min-w-[13rem] flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{p.descrizione}</span>
                  <span className="block text-[12.5px] text-ink-muted">{[p.posizione, p.sede, p.prossima ? `prossima verifica ${dataIt(p.prossima)}` : p.ultima ? `ultima verifica ${dataIt(p.ultima)}` : null].filter(Boolean).join(' · ')}</span>
                  {p.stato === 'da_riparare' && p.nota && <span className="block text-[12.5px] text-[#d63d3e]">{p.nota}</span>}
                </span>
                <Chip stato={p.chip}>{p.stato === 'da_riparare' ? 'Da riparare' : TESTO_PRESIDIO[p.chip] ?? ''}</Chip>
                {puo &&
                  (p.stato === 'da_riparare' ? (
                    <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3" onClick={() => onRiparato(p)}>
                      Riparato
                    </button>
                  ) : (
                    <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3" onClick={() => onSegnala(p)}>
                      Segnala
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </Scheda>
      ))}
    </div>
  );
}

function Registro({ d, puo, onSorveglianza }: { d: DatiAnti; puo: boolean; onSorveglianza: () => void }) {
  const fatta = d.sorveglianzaMese?.fatta ?? false;
  return (
    <div className="space-y-4">
      <section className="rounded-[1.75rem] bg-grafite-900 p-5 text-white">
        <p className="text-[13px] text-grafite-300">Sorveglianza mensile · DM 01/09/2021</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-[30px] font-medium capitalize tracking-[-0.02em]">{nomeMese()}</p>
          <span className={clsx('rounded-full px-2.5 py-1 text-[12px] font-medium', fatta ? 'bg-stato-ok text-stato-ok-ink' : 'bg-oro-500 text-acido-950')}>{fatta ? 'Fatta' : 'Da fare'}</span>
        </div>
        <p className="mt-2 max-w-[60ch] text-[14px] text-grafite-300">
          {d.presidi.length === 0
            ? 'Prima aggiungi i presidi: poi ogni mese giri l’azienda e per ogni presidio rispondi sì o no.'
            : fatta
              ? `Fatta il ${dataIt(d.sorveglianzaMese?.ultima)}. La prossima il mese prossimo.`
              : `${d.presidi.length} presidi da controllare. Giri l’azienda e per ogni presidio rispondi sì o no.`}
        </p>
        {puo && d.presidi.length > 0 && (
          <button type="button" className="btn-acido mt-4" onClick={onSorveglianza}>
            {fatta ? 'Rifai la sorveglianza' : 'Fai la sorveglianza del mese'}
          </button>
        )}
      </section>
      <Scheda titolo="Controlli registrati" sotto="Il registro va tenuto aggiornato e mostrato in caso di controllo. Le righe non si modificano.">
        {d.registro.length === 0 ? (
          <p className="py-2 text-[14px] text-ink-muted">Ancora nessun controllo registrato.</p>
        ) : (
          <ul>
            {d.registro.map((g) => (
              <li key={g.id} className="flex min-h-[60px] items-start gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                <span className="cifre w-20 shrink-0 pt-0.5 text-[13px] text-ink-muted">{dataIt(g.data)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink">{g.tipoTesto}</span>
                  <span className="block text-[12.5px] text-ink-muted">{[g.chi, g.sede, g.note].filter(Boolean).join(' · ')}</span>
                </span>
                <Chip stato={g.esito === 'ok' ? 'ok' : 'warn'}>{g.esito === 'ok' ? 'In regola' : 'Con note'}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Scheda>
    </div>
  );
}

function ListaAddetti({ titolo, voci, vuoto, onCorso }: { titolo: string; voci: Addetto[]; vuoto: string; onCorso: (ids: number[]) => void }) {
  const testo: Record<string, string> = { ok: 'Corso valido', warn: 'Corso in scadenza', danger: 'Corso scaduto', todo: 'Corso da fare', info: 'Iscritto al corso' };
  return (
    <Scheda titolo={titolo}>
      {voci.length === 0 ? (
        <p className="py-2 text-[14px] text-ink-muted">{vuoto}</p>
      ) : (
        <ul>
          {voci.map((a) => (
            <li key={a.nome} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-perla-linea py-2.5 last:border-b-0">
              <span className="min-w-[13rem] flex-1">
                <span className="block text-[14.5px] font-medium text-ink">{a.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">{[a.mansione, a.corso.scadeIl ? `valido fino al ${dataIt(a.corso.scadeIl)}` : a.corso.conseguitoIl ? `fatto il ${dataIt(a.corso.conseguitoIl)}` : 'mai fatto'].filter(Boolean).join(' · ')}</span>
              </span>
              <Chip stato={a.corso.stato}>{testo[a.corso.stato] ?? ''}</Chip>
              {a.lavoratoreId && ['todo', 'danger', 'warn'].includes(a.corso.stato) && (
                <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3" onClick={() => onCorso([a.lavoratoreId!])}>
                  Chiedi il corso
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Scheda>
  );
}

function Addetti({ d, onCorso, onDesigna }: { d: DatiAnti; onCorso: (ids: number[]) => void; onDesigna: () => void }) {
  return (
    <div className="space-y-4">
      <Scheda titolo={d.livello ? `Corso per gli addetti: ${d.livello.ore} ore` : 'Corso per gli addetti'} sotto="DM 02/09/2021">
        <p className="py-1 text-[14px] leading-relaxed text-ink-soft">
          {d.livello ? `Per il livello ${d.livello.numero} il corso dura ${d.livello.ore} ore e si aggiorna ogni 5 anni con ${d.livello.aggiornamento} ore.` : 'Le ore del corso dipendono dal livello di rischio incendio, che indica il tecnico (4, 8 o 16 ore).'} Gli addetti
          li designa il datore di lavoro (art. 18 e 43 D.Lgs. 81/08): la lettera la prepara lo studio.
        </p>
      </Scheda>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListaAddetti titolo={`Addetti antincendio · ${d.addetti.antincendio.length} su ${d.contatori.addettiMinimi} richiesti`} voci={d.addetti.antincendio} vuoto={`Nessun addetto antincendio. Servono almeno ${d.contatori.addettiMinimi} addetti con il corso.`} onCorso={onCorso} />
        <ListaAddetti titolo={`Addetti al primo soccorso · ${d.addetti.primoSoccorso.length}`} voci={d.addetti.primoSoccorso} vuoto="Nessun addetto al primo soccorso indicato (DM 388/2003)." onCorso={onCorso} />
      </div>
      <button type="button" className="btn-ghost" onClick={onDesigna}>
        Chiedi allo studio una nuova designazione
      </button>
    </div>
  );
}

function Emergenza({ d, puo, onProva, onChiedi }: { d: DatiAnti; puo: boolean; onProva: () => void; onChiedi: () => void }) {
  const [errore, setErrore] = useState<string | null>(null);
  const ultima = d.prove.ultima;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Scheda titolo="Piano e prove">
        <Voce etichetta="Piano di emergenza">
          {d.piano ? (
            <button type="button" className="inline-flex items-center gap-1.5 font-medium text-ink underline underline-offset-2" onClick={() => scarica(d.piano!.download.replace(/^\/api/, ''), 'Piano_di_emergenza.pdf').catch((e: Error) => setErrore(e.message))}>
              <Scarica size={15} aria-hidden /> {d.piano.emessoIl ? `Emesso il ${dataIt(d.piano.emessoIl)}` : 'Scarica'}
            </button>
          ) : (
            'Non è ancora nel fascicolo'
          )}
        </Voce>
        <Voce etichetta="Ultima prova">{ultima ? `${dataIt(String(ultima.data))}${ultima.presenti ? `, ${ultima.presenti} partecipanti` : ''}${ultima.tempo_minuti ? `, ${ultima.tempo_minuti} minuti` : ''}` : 'Mai fatta'}</Voce>
        <Voce etichetta="Prossima prova">
          <span className="inline-flex items-center gap-2">
            {d.prove.prossimaEntro ? `entro il ${dataIt(d.prove.prossimaEntro)}` : 'Da organizzare'}
            <Chip stato={d.prove.stato}>{d.prove.stato === 'danger' ? 'Scaduta' : d.prove.stato === 'todo' ? 'Da fare' : d.prove.stato === 'warn' ? 'Vicina' : 'In regola'}</Chip>
          </span>
        </Voce>
        {errore && <p className="pt-2 text-[13px] text-[#d63d3e]">{errore}</p>}
        <div className="flex flex-wrap gap-2 pt-3">
          {puo && (
            <button type="button" className="btn-primary" onClick={onProva}>
              Registra una prova
            </button>
          )}
          {!d.piano && (
            <button type="button" className="btn-ghost" onClick={onChiedi}>
              Chiedi al Falco del piano
            </button>
          )}
        </div>
      </Scheda>
      <div className="space-y-4">
        <section className="rounded-[1.75rem] bg-black p-5 text-white">
          <p className="text-[13px] text-grafite-300">Numero unico di emergenza</p>
          <a href="tel:112" className="cifre mt-1 block text-[56px] font-light leading-none text-oro-500">
            112
          </a>
        </section>
        <Avviso titolo="Almeno una prova l’anno">La prova di evacuazione si fa almeno una volta l’anno per sede e si annota nel registro (DM 02/09/2021).</Avviso>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- fogli

function useInvio() {
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const esegui = async (fn: () => Promise<string>) => {
    setInvio(true);
    setErrore(null);
    try {
      setFatto(await fn());
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return { invio, errore, fatto, esegui, setErrore };
}

function Piede({ fatto, invio, testo, onChiudi, onVai, rosso = false }: { fatto: string | null; invio: boolean; testo: string; onChiudi: () => void; onVai: () => void; rosso?: boolean }) {
  return fatto ? (
    <button type="button" className="btn-primary" onClick={onChiudi}>
      Fatto
    </button>
  ) : (
    <>
      <button type="button" className="btn-ghost" onClick={onChiudi}>
        Annulla
      </button>
      <button type="button" className={clsx('btn-primary', rosso && 'bg-[#d63d3e]')} disabled={invio} onClick={onVai}>
        {invio ? 'Salvo' : testo}
      </button>
    </>
  );
}

function FoglioPresidio({ d, aid, onChiudi, onFatto }: { d: DatiAnti; aid: number; onChiudi: () => void; onFatto: () => void }) {
  const [tipo, setTipo] = useState('estintore');
  const [descr, setDescr] = useState('');
  const [pos, setPos] = useState('');
  const [ultima, setUltima] = useState('');
  const s = useInvio();
  return (
    <Foglio
      aperto
      titolo="Aggiungi un presidio"
      onChiudi={onChiudi}
      piede={<Piede {...s} testo="Aggiungi" onChiudi={onChiudi} onVai={() => s.esegui(async () => (await anti.presidio(aid, { tipo, descrizione: descr || undefined, posizione: pos || undefined, ultima_verifica: ultima || undefined }), onFatto(), 'Presidio aggiunto.'))} />}
    >
      {s.fatto ? (
        <Fatto titolo="Presidio aggiunto">Lo trovi nei presidi e nella sorveglianza del mese.</Fatto>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="Tipo">
            <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {d.tipiPresidio.map((t) => (
                <option key={t.codice} value={t.codice}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Descrizione" aiuto="Per esempio: estintore a polvere 6 kg n. 3.">
            <input className="input-field" value={descr} onChange={(e) => setDescr(e.target.value)} />
          </Campo>
          <Campo etichetta="Dove si trova">
            <input className="input-field" value={pos} onChange={(e) => setPos(e.target.value)} />
          </Campo>
          <Campo etichetta="Ultima verifica del manutentore" aiuto="La prossima si calcola da sola: dopo 6 mesi.">
            <input className="input-field" type="date" value={ultima} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setUltima(e.target.value)} />
          </Campo>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioSorveglianza({ d, aid, onChiudi, onFatto }: { d: DatiAnti; aid: number; onChiudi: () => void; onFatto: () => void }) {
  const sedi = useMemo(() => Array.from(new Set(d.presidi.map((p) => p.sede ?? ''))), [d]);
  const [sede, setSede] = useState(sedi[0] ?? '');
  const presidi = d.presidi.filter((p) => (p.sede ?? '') === sede);
  const [ris, setRis] = useState<Record<number, { ok: boolean | null; nota: string }>>({});
  const s = useInvio();
  useEffect(() => setRis({}), [sede]);
  const vai = () => {
    const mancano = presidi.filter((p) => ris[p.id]?.ok == null).length;
    if (mancano > 0) return s.setErrore(`Rispondi per tutti i presidi: ne mancano ${mancano}.`);
    if (presidi.some((p) => ris[p.id]?.ok === false && !ris[p.id]?.nota.trim())) return s.setErrore('Per ogni "No" scrivi cosa non va.');
    void s.esegui(async () => {
      const n = await anti.sorveglianza(aid, { sede: sede || null, risposte: presidi.map((p) => ({ presidio_id: p.id, ok: ris[p.id]!.ok === true, nota: ris[p.id]!.nota || undefined })) });
      onFatto();
      return n;
    });
  };
  return (
    <Foglio aperto largo titolo="Sorveglianza del mese" onChiudi={onChiudi} piede={<Piede {...s} testo="Registra la sorveglianza" onChiudi={onChiudi} onVai={vai} />}>
      {s.fatto ? (
        <Fatto titolo="Sorveglianza registrata">{s.fatto}</Fatto>
      ) : (
        <div className="space-y-4">
          {sedi.length > 1 && (
            <Campo etichetta="Sede">
              <select className="input-field" value={sede} onChange={(e) => setSede(e.target.value)}>
                {sedi.map((x) => (
                  <option key={x} value={x}>
                    {x || 'Sede principale'}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] text-ink-soft">{presidi.length} presidi. Per ognuno guarda le voci e rispondi sì o no.</p>
            <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px]" onClick={() => setRis(Object.fromEntries(presidi.map((p) => [p.id, { ok: true, nota: '' }])))}>
              Segna tutti sì
            </button>
          </div>
          <ul className="space-y-2">
            {presidi.map((p) => {
              const r = ris[p.id] ?? { ok: null, nota: '' };
              return (
                <li key={p.id} className={clsx('rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]', s.errore && r.ok == null && 'shadow-[inset_0_0_0_1.5px_#d63d3e]')}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{p.descrizione}</span>
                      <span className="block text-[12.5px] text-ink-muted">{p.posizione ?? p.tipoNome}</span>
                      {p.stato === 'da_riparare' && <span className="block text-[12.5px] text-[#d63d3e]">Già da riparare: {p.nota}</span>}
                    </span>
                    <div className="flex gap-1.5">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          aria-pressed={r.ok === v}
                          onClick={() => setRis((x) => ({ ...x, [p.id]: { ...r, ok: v } }))}
                          className={clsx('h-11 min-w-[56px] rounded-full px-4 text-[14px] font-medium', r.ok === v ? (v ? 'bg-grafite-900 text-white' : 'bg-[#d63d3e] text-white') : 'bg-perla-velo text-ink')}
                        >
                          {v ? 'Sì' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(d.voci[p.tipo] ?? []).length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-[12.5px] text-ink-muted">
                      {d.voci[p.tipo].map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  )}
                  {r.ok === false && <input className="input-field mt-3" placeholder="Cosa non va" value={r.nota} onChange={(e) => setRis((x) => ({ ...x, [p.id]: { ...r, nota: e.target.value } }))} />}
                </li>
              );
            })}
          </ul>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioSegnala({ d, aid, p, onChiudi, onFatto }: { d: DatiAnti; aid: number; p: Presidio; onChiudi: () => void; onFatto: () => void }) {
  const [motivo, setMotivo] = useState(d.motivi[0]?.k ?? 'altro');
  const [dettagli, setDettagli] = useState('');
  const s = useInvio();
  return (
    <Foglio
      aperto
      titolo="Segnala un problema"
      onChiudi={onChiudi}
      piede={<Piede {...s} rosso testo="Segnala" onChiudi={onChiudi} onVai={() => (motivo === 'altro' && !dettagli.trim() ? s.setErrore('Scrivi cosa non va.') : void s.esegui(async () => { const n = await anti.segnala(aid, { presidio_id: p.id, motivo, dettagli: dettagli || undefined }); onFatto(); return n; }))} />}
    >
      {s.fatto ? (
        <Fatto titolo="Segnalato">{s.fatto}</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[14.5px] text-ink">{p.descrizione}</p>
          <Campo etichetta="Cosa non va">
            <select className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {d.motivi.map((m) => (
                <option key={m.k} value={m.k}>
                  {m.t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta={motivo === 'altro' ? 'Dettagli' : 'Dettagli (facoltativi)'}>
            <input className="input-field" value={dettagli} onChange={(e) => setDettagli(e.target.value)} />
          </Campo>
          <Avviso tono="warn">Il presidio resta da riparare finché non segni che è stato riparato.</Avviso>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioSemestrale({ d, aid, onChiudi, onFatto }: { d: DatiAnti; aid: number; onChiudi: () => void; onFatto: () => void }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [chi, setChi] = useState(d.manutentore?.ditta ?? '');
  const s = useInvio();
  return (
    <Foglio aperto titolo="Controllo del manutentore" onChiudi={onChiudi} piede={<Piede {...s} testo="Registra il controllo" onChiudi={onChiudi} onVai={() => s.esegui(async () => (await anti.semestrale(aid, { data, chi }), onFatto(), 'Controllo registrato: la prossima verifica è tra 6 mesi.'))} />}>
      {s.fatto ? (
        <Fatto titolo="Controllo registrato">{s.fatto}</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-soft">Registra la verifica periodica fatta dal manutentore su tutti i presidi con controllo semestrale.</p>
          <Campo etichetta="Data del controllo">
            <input className="input-field" type="date" value={data} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Ditta che lo ha fatto">
            <input className="input-field" value={chi} onChange={(e) => setChi(e.target.value)} />
          </Campo>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioProva({ aid, onChiudi, onFatto }: { aid: number; onChiudi: () => void; onFatto: () => void }) {
  const [v, setV] = useState({ data: new Date().toISOString().slice(0, 10), durata: '', partecipanti: '', punto_raccolta: '', bene: '', male: '' });
  const s = useInvio();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const vai = () => {
    if (!(Number(v.durata) > 0) || !(Number(v.partecipanti) > 0)) return s.setErrore('Indica la durata in minuti e il numero dei partecipanti.');
    void s.esegui(async () => {
      const n = await anti.prova(aid, { ...v, durata: Number(v.durata), partecipanti: Number(v.partecipanti) });
      onFatto();
      return n;
    });
  };
  return (
    <Foglio aperto titolo="Registra una prova di evacuazione" onChiudi={onChiudi} piede={<Piede {...s} testo="Registra la prova" onChiudi={onChiudi} onVai={vai} />}>
      {s.fatto ? (
        <Fatto titolo="Prova registrata">{s.fatto}</Fatto>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etichetta="Quando">
            <input className="input-field" type="date" value={v.data} max={new Date().toISOString().slice(0, 10)} onChange={set('data')} />
          </Campo>
          <Campo etichetta="Punto di raccolta">
            <input className="input-field" value={v.punto_raccolta} onChange={set('punto_raccolta')} />
          </Campo>
          <Campo etichetta="Durata in minuti" aiuto="Dall’allarme al punto di raccolta.">
            <input className="input-field" inputMode="decimal" value={v.durata} onChange={set('durata')} />
          </Campo>
          <Campo etichetta="Partecipanti">
            <input className="input-field" inputMode="numeric" value={v.partecipanti} onChange={set('partecipanti')} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo etichetta="Cosa è andato bene">
              <input className="input-field" value={v.bene} onChange={set('bene')} />
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo etichetta="Cosa è andato male o va migliorato">
              <input className="input-field" value={v.male} onChange={set('male')} />
            </Campo>
          </div>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e] sm:col-span-2">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioManutentore({ d, aid, onChiudi, onFatto }: { d: DatiAnti; aid: number; onChiudi: () => void; onFatto: () => void }) {
  const [ditta, setDitta] = useState(d.manutentore?.ditta ?? '');
  const [tel, setTel] = useState(d.manutentore?.telefono ?? '');
  const [contratto, setContratto] = useState(d.manutentore?.contratto ?? 'Controlli semestrali dei presidi');
  const s = useInvio();
  return (
    <Foglio
      aperto
      titolo={d.manutentore ? 'Cambia manutentore' : 'Incarica un manutentore'}
      onChiudi={onChiudi}
      piede={<Piede {...s} testo="Salva" onChiudi={onChiudi} onVai={() => (ditta.trim() === '' || tel.replace(/\D/g, '').length < 6 ? s.setErrore('Servono la ditta e un telefono valido (almeno 6 cifre).') : void s.esegui(async () => (await anti.manutentore(aid, { ditta, telefono: tel, contratto }), onFatto(), 'Manutentore salvato.')))} />}
    >
      {s.fatto ? (
        <Fatto titolo="Manutentore salvato">Lo trovi nella panoramica, con il numero da chiamare.</Fatto>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="Ditta">
            <input className="input-field" value={ditta} onChange={(e) => setDitta(e.target.value)} />
          </Campo>
          <Campo etichetta="Telefono">
            <input className="input-field" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
          </Campo>
          <Campo etichetta="Contratto">
            <input className="input-field" value={contratto} onChange={(e) => setContratto(e.target.value)} />
          </Campo>
          <Avviso tono="warn" titolo="Serve un tecnico qualificato">I controlli periodici dei presidi li fa un tecnico manutentore qualificato (DM 01/09/2021).</Avviso>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

function FoglioDesigna({ aid, livello, onChiudi }: { aid: number; livello: number | null; onChiudi: () => void }) {
  const [chi, setChi] = useState('');
  const [ruolo, setRuolo] = useState<'antincendio' | 'primo soccorso'>('antincendio');
  const s = useInvio();
  return (
    <Foglio
      aperto
      titolo="Chiedi una designazione"
      onChiudi={onChiudi}
      piede={
        <Piede
          {...s}
          testo="Invia allo studio"
          onChiudi={onChiudi}
          onVai={() =>
            chi.trim().length < 3
              ? s.setErrore('Scrivi chi vuoi designare.')
              : void s.esegui(() => richiestaStudio(aid, `Designazione addetto ${ruolo}: ${chi.trim()}`, `Vorrei designare ${chi.trim()} come addetto ${ruolo}${livello && ruolo === 'antincendio' ? ` (livello ${livello})` : ''}. Preparate la lettera di designazione e iscrivetelo al corso.`))
          }
        />
      }
    >
      {s.fatto ? (
        <Fatto titolo="Richiesta inviata">{s.fatto}</Fatto>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="Ruolo">
            <select className="input-field" value={ruolo} onChange={(e) => setRuolo(e.target.value as 'antincendio')}>
              <option value="antincendio">Addetto antincendio</option>
              <option value="primo soccorso">Addetto al primo soccorso</option>
            </select>
          </Campo>
          <Campo etichetta="Chi vuoi designare" aiuto="Un lavoratore presente in sede durante l’orario di lavoro.">
            <input className="input-field" value={chi} onChange={(e) => setChi(e.target.value)} />
          </Campo>
          <Avviso>La lettera di designazione la prepara lo studio e la firma il datore di lavoro; poi il lavoratore fa il corso.</Avviso>
          {s.errore && <p className="text-[13.5px] text-[#d63d3e]">{s.errore}</p>}
        </div>
      )}
    </Foglio>
  );
}
