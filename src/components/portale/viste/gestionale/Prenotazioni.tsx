'use client';

import { regoleCaso, usePermessiStaff } from '@/lib/portale/gestionale-permessi';
import { caricaNuoviAssunti, type CasoNuovoAssunto } from '@/lib/portale/gestionale-api';
import { Chip } from '../../kit';
import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Avviso, BarraSelezione, Pillole, Spunta, useAzione, useCarico } from '../amministrazione-kit';
import { classi, giornate, iscriviClasse, prenotaInGiornata, prenotazioniDaFare, type VoceDaPrenotare } from '@/lib/portale/amministrazione-api';
import { MODALITA } from '@/lib/portale/amministrazione-logica';
import { numero } from '@/lib/portale/api';
import { Calendario } from '@/components/icone';
import { clsx } from '@/lib/clsx';

type Scheda = 'nuovi' | 'visite' | 'corsi' | 'richieste';

/** Prenotazione con controllo (SPEC_GESTIONALE 13): corsi e visite da prenotare, smistati in giornate e classi. */
export default function Prenotazioni() {
  const { versione, ricarica, aziendaScelta } = usePortale();
  // 9: prenotano coordinatore, segreteria e pianificazione; ai corsi iscrive anche la formazione.
  const { puo } = usePermessiStaff();
  const prenotaV = puo('prenotaVisite');
  const iscrive = prenotaV || puo('gestisciClassi');
  const azId = aziendaScelta?.id ?? null;
  const nuovi = useCarico(() => caricaNuoviAssunti(azId), [versione, azId]);
  const [scheda, setScheda] = useState<Scheda>('nuovi');
  const [giorni, setGiorni] = useState(90);
  const [scelti, setScelti] = useState<number[]>([]);
  const [smista, setSmista] = useState<'giornata' | 'classe' | null>(null);
  const { dati, errore, carica } = useCarico(() => prenotazioniDaFare(giorni, azId), [giorni, versione, azId]);
  const c = dati?.conteggi ?? {};
  const voci = (dati?.voci ?? []).filter((v) => (scheda === 'richieste' ? v.richiesta_azienda_il !== null : v.tipo === (scheda === 'visite' ? 'visita_medica' : 'formazione')));
  const cambia = (k: Scheda) => {
    setScheda(k);
    setScelti([]);
  };
  const tipoScelti = (dati?.voci ?? []).filter((v) => scelti.includes(v.scadenza_id));
  const soloVisite = tipoScelti.every((v) => v.tipo === 'visita_medica');
  const soloCorsi = tipoScelti.every((v) => v.tipo === 'formazione');

  return (
    <div className="space-y-5">
      <Testata
        categoria="visite"
        icona={Calendario}
        sopra={aziendaScelta?.ragione_sociale ?? 'Formazione e visite'}
        titolo="Prenotazioni"
        sotto={dati ? `${numero(c.visite) ?? 0} visite e ${numero(c.corsi) ?? 0} corsi da prenotare entro ${giorni} giorni · ${numero(c.richieste_aziende) ?? 0} richieste dalle aziende` : 'Corsi e visite da prenotare'}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro etichetta="Richieste delle aziende" valore={numero(c.richieste_aziende) ?? 0} onClick={() => cambia('richieste')} />
        <Riquadro etichetta="Già scadute" valore={numero(c.scadute) ?? 0} tono={(numero(c.scadute) ?? 0) > 0 ? 'danger' : undefined} />
        <Riquadro etichetta="Visite da prenotare" valore={numero(c.visite) ?? 0} onClick={() => cambia('visite')} />
        <Riquadro etichetta="Tenute, quota da pagare" valore={numero(c.tenute) ?? 0} sotto="Niente promemoria finché non è pagata" />
      </div>
      <Schede<Scheda>
        etichetta="Prenotazioni"
        attiva={scheda}
        onCambia={cambia}
        voci={[
          { k: 'nuovi', t: 'Nuovi assunti', n: nuovi.dati?.conteggi.daGestire ?? 0 },
          { k: 'visite', t: 'Visite da prenotare', n: numero(c.visite) ?? 0 },
          { k: 'corsi', t: 'Iscrizioni ai corsi', n: numero(c.corsi) ?? 0 },
          { k: 'richieste', t: 'Richieste delle aziende', n: numero(c.richieste_aziende) ?? 0 },
        ]}
      />
      {scheda === 'nuovi' && (nuovi.errore ? <Errore testo={nuovi.errore} onRiprova={nuovi.carica} /> : nuovi.dati ? <NuoviAssunti casi={nuovi.dati.casi} conteggi={nuovi.dati.conteggi} /> : <Caricamento />)}
      {scheda !== 'nuovi' && <Pillole etichetta="Entro" attiva={giorni} onCambia={setGiorni} voci={[{ k: 30, t: 'Entro 30 giorni' }, { k: 60, t: 'Entro 60' }, { k: 90, t: 'Entro 90' }]} />}
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}
      {scheda !== 'nuovi' && dati && (
        <Scheda
          titolo={scheda === 'visite' ? 'Visite da prenotare' : scheda === 'corsi' ? 'Corsi da prenotare' : 'Chiesti dalle aziende'}
          sotto={scheda === 'visite' ? 'Metti nella stessa giornata i lavoratori della stessa azienda, in orari vicini.' : scheda === 'corsi' ? 'Unisci aziende diverse con lo stesso corso.' : 'Le aziende hanno chiesto allo studio di prenotare.'}
        >
          {voci.length === 0 ? (
            <Vuoto titolo="Niente da prenotare">Quando un corso o una visita è da fissare, compare qui con la sua scadenza.</Vuoto>
          ) : (
            voci.map((v) => <RigaVoce key={v.scadenza_id} v={v} scelto={scelti.includes(v.scadenza_id)} onScegli={(on) => setScelti((s) => (on ? [...s, v.scadenza_id] : s.filter((x) => x !== v.scadenza_id)))} />)
          )}
        </Scheda>
      )}
      {dati?.nota && <p className="text-[12.5px] text-ink-muted">{dati.nota}</p>}
      {scelti.length > 0 && !(soloVisite ? prenotaV : iscrive) && (
        <Blocco>{soloVisite ? 'Prenotano segreteria e pianificazione' : 'Iscrivono la segreteria e il coordinatore della formazione'}</Blocco>
      )}
      {scelti.length > 0 && (soloVisite ? prenotaV : iscrive) && (
        <BarraSelezione testo={`${scelti.length} scelti · ${new Set(tipoScelti.map((v) => v.azienda_id)).size} aziende`}>
          <button type="button" className="btn-ghost" onClick={() => setScelti([])}>
            Togli
          </button>
          {soloVisite && (
            <button type="button" className="btn-acido" onClick={() => setSmista('giornata')}>
              Metti in una giornata
            </button>
          )}
          {soloCorsi && (
            <button type="button" className="btn-acido" onClick={() => setSmista('classe')}>
              Metti in una classe
            </button>
          )}
        </BarraSelezione>
      )}
      <FoglioSmista
        modo={smista}
        scelti={scelti}
        onChiudi={() => setSmista(null)}
        onFatto={() => {
          setSmista(null);
          setScelti([]);
          carica();
          ricarica();
        }}
      />
    </div>
  );
}

function RigaVoce({ v, scelto, onScegli }: { v: VoceDaPrenotare; scelto: boolean; onScegli: (on: boolean) => void }) {
  return (
    <Riga
      onClick={() => onScegli(!scelto)}
      inizio={<Spunta attiva={scelto} etichetta={`Scegli ${v.lavoratore}`} onCambia={onScegli} />}
      titolo={
        <>
          {v.lavoratore} <span className="font-normal text-ink-muted">· {v.mansione ?? 'mansione da indicare'}</span>
        </>
      }
      sotto={`${v.azienda}${v.comune ? `, ${v.comune}` : ''} · ${v.descrizione}${v.richiesta_nota ? ` · nota: ${v.richiesta_nota}` : ''}`}
      fine={
        <span className="flex flex-col items-end gap-1 text-right">
          <span className={clsx('text-[12.5px]', v.scaduta ? 'text-[#d63d3e]' : 'text-ink-muted')}>{v.entro ? traGiorni(v.entro) : ''}</span>
          {v.quota_da_pagare && <span className="text-[12px] text-ink-muted">quota da pagare</span>}
        </span>
      }
    />
  );
}

function FoglioSmista({ modo, scelti, onChiudi, onFatto }: { modo: 'giornata' | 'classe' | null; scelti: number[]; onChiudi: () => void; onFatto: () => void }) {
  const [scelta, setScelta] = useState<number | null>(null);
  const g = useCarico(() => (modo === 'giornata' ? giornate() : Promise.resolve(null)), [modo]);
  const k = useCarico(() => (modo === 'classe' ? classi() : Promise.resolve(null)), [modo]);
  const az = useAzione();
  const opzioni =
    modo === 'giornata'
      ? (g.dati?.giornate ?? []).map((x) => ({ id: x.id, titolo: `${dataIt(x.data)} · ${x.centro}`, sotto: `dalle ${x.ora_inizio}, uno ogni ${x.passo_minuti} minuti`, liberi: x.liberi }))
      : (k.dati?.classi ?? []).filter((x) => ['bozza', 'programmata'].includes(x.stato)).map((x) => ({ id: x.id, titolo: x.titolo, sotto: `${dataIt(x.data_inizio)} · ${MODALITA[x.modalita] ?? x.modalita}`, liberi: x.posti - x.iscritti_n }));
  return (
    <Foglio
      aperto={modo !== null}
      titolo={modo === 'giornata' ? `${scelti.length} visite nella stessa giornata` : `${scelti.length} lavoratori in una classe`}
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          disabled={az.occupato || scelta === null}
          onClick={() =>
            scelta !== null &&
            az.esegui(() => (modo === 'giornata' ? prenotaInGiornata(scelta, scelti) : iscriviClasse(scelta, { scadenze: scelti })), modo === 'giornata' ? 'Visite prenotate: partono i promemoria.' : 'Iscritti alla classe.').then((ok) => ok && onFatto())
          }
        >
          {modo === 'giornata' ? 'Prenota' : 'Iscrivi'}
        </button>
      }
    >
      {(modo === 'giornata' ? g.inCorso : k.inCorso) && <Caricamento />}
      {opzioni.length === 0 && !(modo === 'giornata' ? g.inCorso : k.inCorso) && (
        <Vuoto titolo={modo === 'giornata' ? 'Nessuna giornata aperta' : 'Nessuna classe aperta'}>{modo === 'giornata' ? 'Crea una giornata in Giornata delle visite.' : 'Crea una classe in Classi di formazione.'}</Vuoto>
      )}
      <ul className="space-y-2" role="radiogroup">
        {opzioni.map((o) => {
          const poco = o.liberi < scelti.length;
          return (
            <li key={o.id}>
              <button
                type="button"
                role="radio"
                aria-checked={scelta === o.id}
                disabled={poco}
                onClick={() => setScelta(o.id)}
                className={clsx('flex min-h-[60px] w-full items-center gap-3 rounded-[1rem] px-4 text-left', scelta === o.id ? 'shadow-[inset_0_0_0_2px_#18181b]' : 'shadow-[inset_0_0_0_1px_#e2e2e5]', poco && 'opacity-50')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{o.titolo}</span>
                  <span className="block text-[12.5px] text-ink-muted">{o.sotto}</span>
                </span>
                <span className="text-[13px] text-ink-muted">{o.liberi} liberi</span>
              </button>
            </li>
          );
        })}
      </ul>
      {modo === 'giornata' && <div className="mt-4"><Avviso>Ogni lavoratore ha il suo orario. I promemoria WhatsApp partono subito, mai tra le 20 e le 8.</Avviso></div>}
      {az.messaggio}
    </Foglio>
  );
}

const TONO_CASO: Record<string, 'sign' | 'warn' | 'neutral' | 'ok'> = { conguaglio: 'sign', da_prenotare: 'neutral', tenute: 'warn', a_meta: 'neutral', confermato: 'ok' };
const LINGUE: Record<string, string> = { it: 'italiano', en: 'inglese', fr: 'francese', es: 'spagnolo', de: 'tedesco', ro: 'rumeno', sq: 'albanese', ar: 'arabo', uk: 'ucraino', ru: 'russo', pl: 'polacco', zh: 'cinese', hi: 'hindi', ur: 'urdu', bn: 'bengalese', pa: 'punjabi', tl: 'tagalog', pt: 'portoghese', wo: 'wolof' };

/** Nuovi assunti (9.1): casi dal portale cliente e dal controllo dell'organico. */
function NuoviAssunti({ casi, conteggi }: { casi: CasoNuovoAssunto[]; conteggi: { daGestire: number; totale: number; quoteDaIncassare: number; quoteNumero: number; tenute: number; conguagli: number } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro nero etichetta="Casi da gestire" valore={`${conteggi.daGestire} su ${conteggi.totale}`} sotto="Arrivati dal portale cliente e dal controllo dell’organico" />
        <Riquadro etichetta="Quote d’ingresso da incassare" valore={`${conteggi.quoteDaIncassare.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`} sotto={`${conteggi.quoteNumero} quote · si pagano dal wallet o con carta`} />
        <Riquadro etichetta="Prenotazioni tenute" valore={conteggi.tenute} sotto="Diventano confermate al pagamento della quota" />
        <Riquadro etichetta="Conguagli aperti" valore={conteggi.conguagli} sotto="Lavoratori in forza non dichiarati" />
      </div>
      {casi.length === 0 ? (
        <Vuoto titolo="Nessun nuovo assunto da gestire">Quando un’azienda comunica un nuovo assunto dal portale, il caso compare qui con la quota già calcolata.</Vuoto>
      ) : (
        casi.map((c) => {
          const regole = regoleCaso({ rischio: c.rischio, conVisita: c.conVisita, nonDichiarato: c.nonDichiarato, quotaImporto: c.quota.importo, quotaPagata: c.quota.stato === 'pagata', unilav: c.unilav, dal: c.dal, cellulare: c.cellulare, lingua: c.lingua, nomeLingua: LINGUE[c.lingua] }, (d) => dataIt(d));
          const corso = c.prenotazioni.find((p) => p.tipo === 'formazione');
          const visita = c.prenotazioni.find((p) => p.tipo === 'visita_medica');
          const riga = (titolo: string, p: typeof corso, vuoto: string) => (
            <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <span className="text-ink-muted">{titolo}</span>
              {p && p.stato && p.stato !== 'da_prenotare' ? (
                <>
                  <span className="text-ink">{[p.quando && dataIt(p.quando), p.luogo].filter(Boolean).join(' · ')}</span>
                  <Chip stato={p.tenuta ? 'warn' : 'ok'}>{p.tenuta ? 'Tenuta' : 'Confermata'}</Chip>
                </>
              ) : (
                <span className="text-ink">{vuoto}</span>
              )}
            </p>
          );
          return (
            <Scheda key={c.quotaId} titolo={c.lavoratore} azioni={<Chip stato={TONO_CASO[c.stato] ?? 'neutral'}>{c.statoTesto}</Chip>}>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1.5 text-[13.5px]">
                  <p className="text-ink-muted">{[c.azienda, c.comune, c.mansione].filter(Boolean).join(' · ')}</p>
                  <p>Rischio dell’azienda: <span className="text-ink">{c.rischio ?? 'da indicare'}</span></p>
                  <p>Visita preventiva: <span className="text-ink">{c.conVisita ? 'Sì, mansione con sorveglianza' : 'No, mansione senza sorveglianza'}</span></p>
                  <p>
                    Comunicazione di assunzione (UniLav): {c.unilav ? <span className="text-ink">Ricevuta{c.dal ? ` · dal ${dataIt(c.dal)}` : ''}</span> : <span className="text-stato-danger-segno">Non ricevuta</span>}
                  </p>
                  <p>
                    WhatsApp e lingua: {c.cellulare ? <span className="text-ink">Cellulare</span> : <span className="text-stato-danger-segno">Cellulare mancante</span>} · {LINGUE[c.lingua] ?? c.lingua}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {c.nonDichiarato ? (
                    <>
                      <p className="text-[12.5px] text-ink-muted">Conguaglio</p>
                      <p className="cifre text-[22px] font-light text-ink">{(c.conVisita ? 118.8 : 70.8).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</p>
                      <p className="text-[12.5px] text-ink-muted">Tariffa annua {c.conVisita ? '9,90' : '5,90'} € × 12 mesi</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-ink-muted">Quota d’ingresso</p>
                      <p className="cifre text-[22px] font-light text-ink">{c.quota.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</p>
                      <p className="text-[12.5px] text-ink-muted">Rischio {c.rischio ?? ''} · {c.conVisita ? 'con visita' : 'senza visita'}</p>
                      <Chip stato={c.quota.stato === 'pagata' ? 'ok' : 'sign'}>{c.quota.stato === 'pagata' ? 'Pagata' : 'Link inviato, da pagare'}</Chip>
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[12.5px] text-ink-muted">Regole applicate</p>
                  <ul className="space-y-1">
                    {regole.map((x) => (
                      <li key={x.testo} className="flex items-start justify-between gap-3 text-[13px] text-ink">
                        <span>{x.testo}</span>
                        <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">{x.codice}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 space-y-1 border-t border-perla-linea pt-3">
                {riga('Formazione iniziale', corso, 'Classe da scegliere')}
                {c.conVisita && riga('Visita preventiva', visita, 'Slot da scegliere')}
              </div>
            </Scheda>
          );
        })
      )}
      <p className="text-[12.5px] text-ink-muted">Delle visite il gestionale conserva solo date, orario e tipo. Esiti e giudizi restano al medico competente.</p>
    </div>
  );
}
