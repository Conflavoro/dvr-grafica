'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Scheda, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Visita } from '@/components/icone';
import { disdici, richiestaStudio, visite, type RigaVisita, type Visite as DatiVisite } from '@/lib/portale/area-api';
import { NOMI_TIPO_VISITA, dataOra } from '@/lib/portale/area-logica';
import { Avviso, Campo, Fatto, Voce, useCarica } from './comuni';
import { FoglioPrenotaVisita, type LavoratoreVisita } from './FogliOperativita';

type SchedaV = 'lavoratori' | 'calendario' | 'medico';

const PASSI = [
  ['Alla prenotazione', 'Data, ora, indirizzo, cosa portare'],
  ['7 giorni prima', 'Promemoria con data, ora e indirizzo'],
  ['2 giorni lavorativi prima', 'Ultimo giorno per disdire gratis'],
  ['Il giorno prima, alle 17', 'Orario e posizione in Maps'],
  ['La mattina, 2 ore prima', 'Mai prima delle 8'],
];

function testoStato(r: Pick<RigaVisita, 'stato' | 'statoPrenotazione' | 'finoAl'>): string {
  if (r.stato === 'info') return 'Prenotata';
  if (r.stato === 'todo') return r.finoAl ? 'Da prenotare' : 'Prima visita';
  return { ok: 'Valida', warn: 'In scadenza', danger: 'Scaduta' }[r.stato as 'ok'] ?? '';
}

/** Visite mediche (04): solo date, tipo e scadenza; titolare e referente prenotano, cambiano data e disdicono direttamente. */
export default function Visite() {
  const { azienda, versione, puo, chiedi, apri, sede } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCarica(() => visite(aid, sede), [aid, versione, sede]);
  const [scheda, setScheda] = useState<SchedaV>('lavoratori');
  const [aperta, setAperta] = useState<RigaVisita | null>(null);
  const [prenota, setPrenota] = useState<{ lavoratore: LavoratoreVisita | null; cambio: boolean } | null>(null);
  const [disdetta, setDisdetta] = useState<{ scadenzaId: number; nome: string; quando: string; gratuita: boolean | null } | null>(null);
  if (!azienda) return null;
  const c = dati?.contatori;
  const puoPrenotare = dati?.permessi.prenota ?? puo('visite_prenota');
  const lav = (r: RigaVisita): LavoratoreVisita => ({ id: r.id, nome: r.nome, mansione: r.mansione, tipo: r.tipoVisita, centro: r.luogo });

  const scegli = (r: RigaVisita) => {
    setAperta(r);
    apri({ tipo: 'lavoratore', id: r.id }, aid);
  };

  return (
    <div className="space-y-5">
      <Testata
        categoria="visite"
        icona={Visita}
        sopra={azienda.ragione_sociale}
        titolo="Visite mediche"
        sotto={c ? `${c.daPrenotare} lavoratori da prenotare · ${c.inCalendario} visite in calendario` : undefined}
        azioni={
          puoPrenotare ? (
            <button type="button" className="btn-primary" onClick={() => setPrenota({ lavoratore: null, cambio: false })}>
              Prenota una visita
            </button>
          ) : undefined
        }
      />
      <Schede<SchedaV>
        etichetta="Visite"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'lavoratori', t: 'Lavoratori', n: c ? c.daPrenotare : undefined },
          { k: 'calendario', t: 'Calendario' },
          { k: 'medico', t: 'Medico e centri' },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !dati && <Caricamento />}

      {dati && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Riquadro etichetta="Visite valide" valore={`${c!.valide}/${c!.conSorveglianza}`} sotto="Lavoratori con sorveglianza" />
            <Riquadro etichetta="Scadute, da prenotare subito" valore={c!.scadute} tono={c!.scadute > 0 ? 'danger' : undefined} />
            <Riquadro etichetta="In scadenza o mai fatte" valore={c!.daFare} tono={c!.daFare > 0 ? 'warn' : undefined} />
            <Riquadro etichetta="In calendario" valore={c!.inCalendario} />
          </div>
          {scheda === 'lavoratori' && c!.daDefinire > 0 && (
            <Avviso tono="warn" titolo={c!.daDefinire === 1 ? 'Un lavoratore con la sorveglianza da definire' : `${c!.daDefinire} lavoratori con la sorveglianza da definire`}>
              <span className="block">Per queste mansioni non risulta se serve la visita: lo indica il medico competente con il protocollo sanitario.</span>
              {puo('dashboard') && (
                <button type="button" className="mt-2 font-medium underline underline-offset-2" onClick={() => chiedi('Quali dipendenti hanno la sorveglianza sanitaria da definire? Chiedi allo studio di verificarla con il medico competente.')}>
                  Chiedi al Falco di verificarla con lo studio
                </button>
              )}
            </Avviso>
          )}
          {scheda === 'lavoratori' && <Lavoratori dati={dati} onApri={scegli} onPrenota={puoPrenotare ? (r) => setPrenota({ lavoratore: lav(r), cambio: false }) : undefined} />}
          {scheda === 'calendario' && (
            <Calendario
              dati={dati}
              puo={puoPrenotare}
              onCambia={(x) => setPrenota({ lavoratore: { id: x.lavoratoreId, nome: x.nome, mansione: x.mansione, tipo: x.tipoVisita, centro: x.luogo }, cambio: true })}
              onDisdici={(x) => setDisdetta({ scadenzaId: x.scadenzaId!, nome: x.nome, quando: x.appuntamento, gratuita: x.disdettaGratuita })}
            />
          )}
          {scheda === 'medico' && <Medico dati={dati} aziendaId={aid} puo={puo('dashboard')} />}
          <p className="text-[12.5px] leading-relaxed text-ink-muted">{dati.nota}</p>
        </>
      )}

      <Foglio
        aperto={aperta !== null}
        titolo={aperta?.nome ?? ''}
        onChiudi={() => (setAperta(null), apri(null))}
        piede={
          aperta && (
            <>
              <button type="button" className="btn-ghost" onClick={() => (setAperta(null), chiedi(`Spiegami la situazione della visita di ${aperta.nome} e cosa devo fare.`))}>
                Chiedi al Falco
              </button>
              <Link href={`/azienda/persone/?id=${aperta.id}`} className="btn-ghost">
                Scheda del lavoratore
              </Link>
              {puoPrenotare && aperta.appuntamento && (
                <button type="button" className="btn-ghost" onClick={() => (setPrenota({ lavoratore: lav(aperta), cambio: true }), setAperta(null))}>
                  Cambia data
                </button>
              )}
              {puoPrenotare && !aperta.appuntamento && (
                <button type="button" className={aperta.stato === 'ok' ? 'btn-primary' : 'btn-acido'} onClick={() => (setPrenota({ lavoratore: lav(aperta), cambio: false }), setAperta(null))}>
                  Prenota la visita
                </button>
              )}
            </>
          )
        }
      >
        {aperta && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-ink-muted">{aperta.finoAl ? 'Visita valida fino al' : 'Prima visita'}</p>
                <p className="cifre text-[32px] font-light leading-tight tracking-[-0.03em] text-ink">{aperta.finoAl ? dataIt(aperta.finoAl) : 'Da fare'}</p>
                {aperta.finoAl && <p className="text-[12.5px] text-ink-muted">{traGiorni(aperta.finoAl)}</p>}
              </div>
              <Chip stato={aperta.stato}>{testoStato(aperta)}</Chip>
            </div>
            <div>
              <Voce etichetta="Mansione">{aperta.mansione}</Voce>
              {aperta.esito && <Voce etichetta="Esito del giudizio">{aperta.esito.testo}</Voce>}
              {aperta.appuntamento && <Voce etichetta="Appuntamento">{`${dataOra(aperta.appuntamento)}${aperta.luogo ? `, ${aperta.luogo}` : ''}`}</Voce>}
              {aperta.tipoVisita && <Voce etichetta="Tipo">{NOMI_TIPO_VISITA[aperta.tipoVisita] ?? aperta.tipoVisita}</Voce>}
              {aperta.inAttesaPagamento && <Voce etichetta="Prenotazione">In attesa della quota d’ingresso</Voce>}
            </div>
            {aperta.appuntamento && aperta.scadenzaId && puoPrenotare && (
              <button type="button" className="btn-ghost w-full text-[#d63d3e]" onClick={() => (setDisdetta({ scadenzaId: aperta.scadenzaId!, nome: aperta.nome, quando: aperta.appuntamento!, gratuita: null }), setAperta(null))}>
                Disdici l’appuntamento
              </button>
            )}
            <div>
              <p className="mb-1 text-[13.5px] font-medium text-ink">Storico nel portale</p>
              {aperta.storico.length === 0 ? (
                <p className="text-[13.5px] text-ink-muted">Nessuna visita registrata nel portale.</p>
              ) : (
                <ul className="space-y-1.5">
                  {aperta.storico.map((s, i) => (
                    <li key={i} className="text-[13.5px] text-ink">
                      {dataIt(s.data?.slice(0, 10))}
                      <span className="text-ink-muted"> · {s.tipo ? NOMI_TIPO_VISITA[s.tipo] ?? s.tipo : s.descrizione}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Avviso titolo="Cosa vede il portale">Solo data, tipo e scadenza. Il giudizio lo consegna il medico al lavoratore e al datore di lavoro, fuori dal portale.</Avviso>
          </div>
        )}
      </Foglio>

      {prenota && dati && (
        <FoglioPrenotaVisita
          aziendaId={aid}
          lavoratore={prenota.lavoratore}
          cambio={prenota.cambio}
          persone={dati.lavoratori.filter((l) => !l.appuntamento).map(lav)}
          onChiudi={() => setPrenota(null)}
          onFatto={carica}
        />
      )}
      {disdetta && <FoglioDisdetta d={disdetta} onChiudi={() => setDisdetta(null)} onFatto={carica} />}
    </div>
  );
}

function Lavoratori({ dati, onApri, onPrenota }: { dati: DatiVisite; onApri: (r: RigaVisita) => void; onPrenota?: (r: RigaVisita) => void }) {
  if (dati.lavoratori.length === 0)
    return (
      <Vuoto titolo={dati.sorveglianzaNonPrevista ? 'Sorveglianza sanitaria non prevista' : 'Nessun lavoratore con sorveglianza sanitaria'}>
        {dati.sorveglianzaNonPrevista
          ? 'Per i rischi valutati nel DVR la sorveglianza sanitaria non è prevista (art. 41 D.Lgs. 81/08).'
          : 'Quando una mansione prevede la visita, qui vedi scadenze, appuntamenti ed esito sintetico.'}
      </Vuoto>
    );
  return (
    <Scheda titolo="Lavoratori con sorveglianza" sotto="In alto chi ha la visita scaduta o da fare.">
      <ul>
        {dati.lavoratori.map((r) => (
          <li key={r.id} className="flex items-center gap-3 border-b border-perla-linea last:border-b-0">
            <button type="button" onClick={() => onApri(r)} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left hover:bg-perla-velo/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-ink">{r.nome}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
                  {[r.mansione, r.finoAl ? `valida fino al ${dataIt(r.finoAl)}` : 'prima visita da fare', r.appuntamento ? `appuntamento ${dataOra(r.appuntamento)}` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Chip stato={r.stato}>{testoStato(r)}</Chip>
            </button>
            {onPrenota && !r.appuntamento && r.stato !== 'ok' && (
              <button type="button" className="btn-primary min-h-[40px] px-3" onClick={() => onPrenota(r)}>
                Prenota
              </button>
            )}
          </li>
        ))}
      </ul>
    </Scheda>
  );
}

function Calendario({ dati, puo, onCambia, onDisdici }: { dati: DatiVisite; puo: boolean; onCambia: (x: DatiVisite['calendario'][number]) => void; onDisdici: (x: DatiVisite['calendario'][number]) => void }) {
  const giorni = useMemo(() => {
    const m = new Map<string, DatiVisite['calendario']>();
    dati.calendario.forEach((x) => m.set(x.appuntamento.slice(0, 10), [...(m.get(x.appuntamento.slice(0, 10)) ?? []), x]));
    return Array.from(m.entries());
  }, [dati]);
  if (giorni.length === 0) return <Vuoto titolo="Nessuna visita in calendario">Quando prenoti una visita la trovi qui. Il lavoratore riceve la convocazione su WhatsApp.</Vuoto>;
  return (
    <div className="space-y-3">
      {giorni.map(([g, voci]) => (
        <Scheda key={g} titolo={new Date(`${g}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} sotto={`${traGiorni(g).replace('scade oggi', 'oggi')} · ${voci.length} ${voci.length === 1 ? 'lavoratore' : 'lavoratori'}`}>
          <ul>
            {voci.map((x) => (
              <li key={`${x.lavoratoreId}-${x.appuntamento}`} className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                <span className="cifre w-12 shrink-0 text-[15px] text-ink">{x.appuntamento.slice(11, 16)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{x.nome}</span>
                  <span className="block text-[12.5px] text-ink-muted">{[x.tipoVisita ? NOMI_TIPO_VISITA[x.tipoVisita] ?? x.tipoVisita : null, x.luogo].filter(Boolean).join(' · ')}</span>
                </span>
                <Chip stato="ok">Comunicata al lavoratore</Chip>
                {puo && x.scadenzaId && (
                  <>
                    <button type="button" className="btn-ghost min-h-[44px] px-3 lg:min-h-[40px]" onClick={() => onCambia(x)}>
                      Cambia data
                    </button>
                    <button type="button" className="btn-ghost min-h-[44px] px-3 text-stato-danger-ink lg:min-h-[40px]" onClick={() => onDisdici(x)}>
                      Disdici
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Scheda>
      ))}
      <Avviso tono="warn" titolo="Le assenze si pagano">
        La prima assenza senza preavviso si riprogramma gratis. Dalla seconda l’azienda paga il costo della visita.
      </Avviso>
    </div>
  );
}

function Medico({ dati, aziendaId, puo }: { dati: DatiVisite; aziendaId: number; puo: boolean }) {
  const [nota, setNota] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const chiediMedico = async () => {
    try {
      setNota(await richiestaStudio(aziendaId, 'Medico competente da indicare', 'Nel portale non risulta il medico competente dell’azienda: potete indicarlo o proporre il medico convenzionato della zona?'));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Richiesta non riuscita.');
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Scheda titolo={dati.mediciSede.length > 0 ? 'Medico coordinatore' : 'Medico competente'}>
        {dati.medico ? (
          <div className="space-y-1 py-1">
            <p className="text-[16px] font-medium text-ink">{dati.medico.nome}</p>
            {dati.medico.email && <p className="text-[13.5px] text-ink-muted">{dati.medico.email}</p>}
            {dati.medico.nominaFinoAl && <p className="text-[13.5px] text-ink-muted">Nomina fino al {dataIt(dati.medico.nominaFinoAl)}</p>}
            <p className="pt-2 text-[12.5px] text-ink-muted">{dati.medico.testo ?? 'Il medico vede solo i lavoratori di questa azienda e perde l’accesso alla revoca o alla scadenza della nomina.'}</p>
          </div>
        ) : nota ? (
          <Fatto titolo="Richiesta inviata">{nota}</Fatto>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-[14px] text-ink-muted">Il medico competente non è ancora indicato nel portale.</p>
            {puo && (
              <button type="button" className="btn-primary" onClick={chiediMedico}>
                Chiedi allo studio
              </button>
            )}
            {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
          </div>
        )}
      </Scheda>
      {dati.mediciSede.length > 0 && (
        <Scheda titolo="Medici coordinati, uno per sede" sotto="Ogni medico vede solo i lavoratori della sua sede. Il coordinatore li vede tutti.">
          <ul>
            {dati.mediciSede.map((m) => (
              <li key={m.sedeId} className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-perla-velo text-[13px] font-medium text-ink">
                  {m.medico ? m.medico.replace(/^(dott\.?ssa|dott\.)\s+/i, '').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() : 'n.d.'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] uppercase tracking-wide text-ink-muted">Sede di {m.sede}</span>
                  <span className="block text-[14px] font-medium text-ink">{m.medico ?? 'Da nominare'}</span>
                  <span className="block text-[12.5px] text-ink-muted">{m.testo}</span>
                </span>
                {m.email && (
                  <a href={`mailto:${m.email}`} className="btn-ghost min-h-[40px] px-3">
                    Scrivi
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Scheda>
      )}
      {dati.centri.length > 0 && (
        <Scheda titolo="Centri medici">
          <ul>
            {dati.centri.map((x) => (
              <li key={x.nome} className="flex min-h-[52px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink">{x.nome}</span>
                  {x.indirizzo && <span className="block text-[12.5px] text-ink-muted">{x.indirizzo}</span>}
                </span>
                {x.indirizzo && (
                  <a className="btn-ghost min-h-[40px] px-3" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.nome} ${x.indirizzo}`)}`}>
                    Maps
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Scheda>
      )}
      <Scheda titolo="Promemoria automatici" sotto="Su WhatsApp, mai dalle 20 alle 8 e nei festivi.">
        <ol className="space-y-2.5">
          {PASSI.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="cifre grid h-7 w-7 shrink-0 place-items-center rounded-full bg-perla-velo text-[12.5px] text-ink">{i + 1}</span>
              <span className="text-[14px] leading-snug text-ink">
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

function FoglioDisdetta({ d, onChiudi, onFatto }: { d: { scadenzaId: number; nome: string; quando: string; gratuita: boolean | null }; onChiudi: () => void; onFatto: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const vai = async () => {
    setInvio(true);
    setErrore(null);
    try {
      setEsito((await disdici(d.scadenzaId, motivo)).nota);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Disdetta non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto
      titolo="Disdici la visita"
      onChiudi={onChiudi}
      piede={
        esito ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Tieni la visita
            </button>
            <button type="button" className="btn-primary bg-[#d63d3e]" disabled={invio} onClick={vai}>
              {invio ? 'Disdico' : 'Disdici la visita'}
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo="Visita disdetta">{esito}</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[14.5px] text-ink">
            {d.nome}, {dataOra(d.quando)}
          </p>
          {d.gratuita === true && <Avviso tono="ok" titolo="La disdetta è gratuita">Il posto torna libero e la segreteria propone un’altra data.</Avviso>}
          {d.gratuita === false && <Avviso tono="warn" titolo="Disdetta a pagamento">Mancano meno di 2 giorni lavorativi: la visita può essere addebitata comunque.</Avviso>}
          {d.gratuita === null && <Avviso>È gratuita fino a 2 giorni lavorativi prima dell’appuntamento.</Avviso>}
          <Campo etichetta="Motivo (facoltativo)">
            <input className="input-field" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}
