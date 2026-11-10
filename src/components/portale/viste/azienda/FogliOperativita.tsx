'use client';

/**
 * Fogli dell'operativita' delle persone (04, fogli "Prenota la visita",
 * "Iscrivi a un corso", "Chiedi un corso", "Impostazioni dei promemoria"),
 * usati da Home, Scadenziario, Visite, Formazione e Dipendenti. Testi della
 * specifica; i permessi li ricontrolla il server.
 */

import { useEffect, useMemo, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Foglio, dataIt } from '../../kit';
import { Avviso, Campo, Fatto } from './comuni';
import type { ClasseFutura } from '@/lib/portale/area-api';
import {
  chiediCorso,
  disponibilitaVisite,
  erroriPromemoria,
  iscriviCorso,
  prenotaVisita,
  salvaPromemoria,
  type Disponibilita,
  type Promemoria,
  type RispostaCorso,
} from '@/lib/portale/area-operativita';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "Mercoledì 21 ottobre" da AAAA-MM-GG. */
export function giornoLungo(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const t = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Scelta({ attiva, onClick, children, disabilitata }: { attiva: boolean; onClick: () => void; children: React.ReactNode; disabilitata?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={attiva}
      disabled={disabilitata}
      onClick={onClick}
      className={clsx(
        'w-full rounded-[1rem] px-4 py-3 text-left text-[14px] transition-colors disabled:opacity-50',
        attiva ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink hover:bg-perla-linea'
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Prenota la visita / Cambia la data

export interface LavoratoreVisita {
  id: number;
  nome: string;
  mansione: string;
  tipo?: string | null;
  centro?: string | null;
}

export function FoglioPrenotaVisita({
  aziendaId,
  lavoratore,
  persone,
  cambio = false,
  onChiudi,
  onFatto,
}: {
  aziendaId: number;
  lavoratore: LavoratoreVisita | null;
  persone: LavoratoreVisita[];
  cambio?: boolean;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [disp, setDisp] = useState<Disponibilita | null>(null);
  const [chi, setChi] = useState<number | null>(lavoratore?.id ?? null);
  const [tipo, setTipo] = useState<string>(lavoratore?.tipo ?? 'periodica');
  const [centro, setCentro] = useState<string>(lavoratore?.centro ?? '');
  const [quando, setQuando] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ titolo: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    let vivo = true;
    disponibilitaVisite(aziendaId)
      .then((d) => {
        if (!vivo) return;
        setDisp(d);
        setQuando(d.orari[0] ?? null);
        setCentro((c) => c || d.centri[0]?.nome || '');
      })
      .catch((e: Error) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, [aziendaId]);

  const vai = async () => {
    if (!chi || !quando) return;
    setInvio(true);
    setErrore(null);
    try {
      setEsito(await prenotaVisita(aziendaId, { lavoratore_id: chi, quando, centro: centro || null, tipo_visita: cambio ? null : tipo }));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Prenotazione non riuscita.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto
      titolo={cambio ? 'Cambia la data' : 'Prenota la visita'}
      onChiudi={onChiudi}
      piede={
        esito ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Chiudi
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-acido" disabled={invio || !chi || !quando} onClick={vai}>
              {cambio ? 'Conferma la nuova data' : 'Prenota'}
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo={esito.titolo}>{esito.testo}</Fatto>
      ) : (
        <div className="space-y-5">
          {lavoratore ? (
            <div>
              <p className="text-[13px] text-ink-muted">Lavoratore</p>
              <p className="text-[16px] font-medium text-ink">{lavoratore.nome}</p>
              <p className="text-[13.5px] text-ink-muted">{lavoratore.mansione}</p>
            </div>
          ) : (
            <Campo etichetta="Lavoratore">
              <select className="input-field" value={chi ?? ''} onChange={(e) => setChi(Number(e.target.value) || null)}>
                <option value="">Scegli il lavoratore</option>
                {persone.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {p.mansione}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {!cambio && disp && (
            <div role="radiogroup" aria-label="Tipo di visita">
              <p className="mb-1.5 text-[13.5px] font-medium text-ink">Tipo di visita</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(disp.tipi).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={tipo === k}
                    onClick={() => setTipo(k)}
                    className={clsx('h-10 rounded-full px-3.5 text-[13.5px] font-medium', tipo === k ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Campo etichetta="Centro medico">
            {disp && disp.centri.length > 0 ? (
              <select className="input-field" value={centro} onChange={(e) => setCentro(e.target.value)}>
                {disp.centri.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome}
                    {c.indirizzo ? ` · ${c.indirizzo}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input-field" value={centro} maxLength={200} onChange={(e) => setCentro(e.target.value)} />
            )}
          </Campo>
          <div role="radiogroup" aria-label="Scegli quando">
            <p className="mb-1.5 text-[13.5px] font-medium text-ink">Scegli quando</p>
            <div className="grid grid-cols-2 gap-2">
              {(disp?.orari ?? []).map((o) => (
                <Scelta key={o} attiva={quando === o} onClick={() => setQuando(o)}>
                  <span className="block font-medium">{giornoLungo(o)}</span>
                  <span className="block opacity-75">ore {o.slice(11, 16)}</span>
                </Scelta>
              ))}
            </div>
          </div>
          <Avviso titolo="Il lavoratore riceve la convocazione su WhatsApp">
            Con data, ora, posizione e cosa portare. Deve presentarsi: se ha un impedimento avvisa l’azienda, che cambia la data da qui.
          </Avviso>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- Iscrivi a un corso

export interface CorsoIscrivibile {
  codice: string;
  nome: string;
  ore?: string | null;
}

export interface PersonaCorso {
  id: number;
  nome: string;
  mansione: string;
  /** Stato del corso scelto per questa persona (null = non richiesto). */
  stati: Record<string, string | null>;
  quota?: boolean;
}

const TESTO_STATO: Record<string, string> = { ok: 'Valido', warn: 'In scadenza', danger: 'Scaduto', todo: 'Da fare', info: 'Iscritto' };

export function FoglioIscrivi({
  aziendaId,
  corsi,
  classi,
  persone,
  corsoIniziale,
  classeIniziale,
  lavoratoriIniziali = [],
  onChiudi,
  onFatto,
}: {
  aziendaId: number;
  corsi: CorsoIscrivibile[];
  classi: ClasseFutura[];
  persone: PersonaCorso[];
  corsoIniziale?: string | null;
  classeIniziale?: number | null;
  lavoratoriIniziali?: number[];
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [corso, setCorso] = useState<string>(corsoIniziale && corsi.some((c) => c.codice === corsoIniziale) ? corsoIniziale : corsi.find((c) => c.codice === 'antincendio')?.codice ?? corsi[0]?.codice ?? '');
  const classiCorso = useMemo(() => classi.filter((k) => k.corsi.includes(corso)), [classi, corso]);
  const [classe, setClasse] = useState<number | 'nuova'>(classeIniziale ?? 'nuova');
  const [scelti, setScelti] = useState<number[]>(lavoratoriIniziali);
  const [esito, setEsito] = useState<{ titolo: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    // Selezione iniziale: la classe passata, altrimenti la prima libera, altrimenti "nuova".
    setClasse((k) => (k !== 'nuova' && classiCorso.some((x) => x.id === k) ? k : classiCorso.find((x) => x.liberi > 0)?.id ?? 'nuova'));
  }, [classiCorso]);

  const ordinate = useMemo(() => {
    const peso = (s: string | null | undefined) => ({ danger: 0, todo: 1, warn: 2, info: 3, ok: 4 } as Record<string, number>)[s ?? ''] ?? 5;
    return [...persone].sort((a, b) => peso(a.stati[corso]) - peso(b.stati[corso]) || a.nome.localeCompare(b.nome));
  }, [persone, corso]);

  const vai = async () => {
    if (scelti.length === 0) return setErrore('Spunta almeno un lavoratore.');
    setInvio(true);
    setErrore(null);
    try {
      setEsito(await iscriviCorso(aziendaId, { corso, classe_id: classe === 'nuova' ? null : classe, lavoratori: scelti }));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Iscrizione non riuscita.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto
      largo
      titolo="Iscrivi a un corso"
      onChiudi={onChiudi}
      piede={
        esito ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Chiudi
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-acido" disabled={invio} onClick={vai}>
              Conferma
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo={esito.titolo}>{esito.testo}</Fatto>
      ) : (
        <div className="space-y-5">
          <Campo etichetta="Corso" aiuto="Incluso nel canone. I corsi per le attrezzature (carrelli, PLE, gru…) si ordinano a parte.">
            <select className="input-field" value={corso} onChange={(e) => setCorso(e.target.value)}>
              {corsi.map((c) => (
                <option key={c.codice} value={c.codice}>
                  {c.nome}
                  {c.ore ? ` · ${c.ore}` : ''}
                </option>
              ))}
            </select>
          </Campo>
          <div role="radiogroup" aria-label="Classe" className="space-y-2">
            <p className="text-[13.5px] font-medium text-ink">Classe</p>
            {classiCorso.map((k) => (
              <Scelta key={k.id} attiva={classe === k.id} disabilitata={k.liberi === 0} onClick={() => setClasse(k.id)}>
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium">
                      {giornoLungo(k.data)}
                      {k.ora ? ` · ${k.ora}` : ''}
                    </span>
                    <span className="block opacity-75">{[k.modalita, k.luogo].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 opacity-75">{k.liberi === 0 ? 'Al completo' : k.liberi === 1 ? '1 posto libero' : `${k.liberi} posti liberi`}</span>
                </span>
              </Scelta>
            ))}
            <Scelta attiva={classe === 'nuova'} onClick={() => setClasse('nuova')}>
              <span className="block font-medium">Richiedi una nuova classe</span>
              <span className="block opacity-75">
                {classiCorso.length > 0
                  ? 'Se nessuna data va bene: la segreteria ti propone una data entro 5 giorni lavorativi'
                  : 'Non ci sono classi in programma per questo corso: la segreteria ti propone una data entro 5 giorni lavorativi'}
              </span>
            </Scelta>
          </div>
          <div>
            <p className="mb-1.5 text-[13.5px] font-medium text-ink">Lavoratori</p>
            <ul className="max-h-[20rem] overflow-y-auto rounded-[1rem] bg-white ring-1 ring-inset ring-perla-linea">
              {ordinate.map((p) => {
                const st = p.stati[corso];
                return (
                  <li key={p.id}>
                    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2 hover:bg-perla-velo">
                      <input type="checkbox" checked={scelti.includes(p.id)} onChange={() => setScelti((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium text-ink">{p.nome}</span>
                        <span className="block text-[12.5px] text-ink-muted">
                          {p.mansione}
                          {p.quota ? ' · in attesa della quota d’ingresso' : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] text-ink-muted">{st ? TESTO_STATO[st] ?? st : 'Non richiesto'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {errore && <p className="mt-2 text-[13px] text-stato-danger-ink">{errore}</p>}
          </div>
          <Avviso titolo="Il lavoratore riceve la convocazione su WhatsApp">Con data, orario, luogo o link della lezione, nella sua lingua.</Avviso>
          {classiCorso.some((k) => k.modalita.toLowerCase().includes('video') || k.modalita.toLowerCase().includes('online')) && (
            <Avviso tono="warn" titolo="La parte online richiede la verifica del computer">
              Prima della lezione il lavoratore fa una prova di webcam e connessione dal link che riceve.
            </Avviso>
          )}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- Chiedi un corso (non a catalogo)

export function FoglioChiediCorso({ aziendaId, onChiudi, onIscrivi, onOrdina, puoOrdinare, onFatto }: {
  aziendaId: number;
  onChiudi: () => void;
  onIscrivi: (codice: string) => void;
  onOrdina: () => void;
  puoOrdinare: boolean;
  onFatto: () => void;
}) {
  const [testo, setTesto] = useState('');
  const [risposta, setRisposta] = useState<RispostaCorso | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const vai = async () => {
    if (testo.trim().length < 4) return setErrore('Scrivi il corso che ti serve.');
    setInvio(true);
    setErrore(null);
    try {
      const r = await chiediCorso(aziendaId, testo.trim());
      setRisposta(r);
      if (!r.aCatalogo) {
        setTesto('');
        onFatto();
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Richiesta non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto
      titolo="Chiedi un corso"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Chiudi
          </button>
          <button type="button" className="btn-primary" disabled={invio} onClick={vai}>
            Chiedi all’assistente
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo etichetta="Che corso ti serve?" errore={errore ?? undefined} aiuto="Scrivilo con parole tue: attrezzatura, mansione, norma o accordo.">
          <textarea
            className="input-field min-h-[6rem]"
            value={testo}
            maxLength={300}
            placeholder="Es. corso per l’uso della piattaforma con cestello, accordo Stato-Regioni"
            onChange={(e) => setTesto(e.target.value)}
          />
        </Campo>
        {risposta && (
          <div className="rounded-[1rem] bg-grafite-900 p-4 text-[14px] leading-relaxed text-white">
            <p>{risposta.testo}</p>
            {risposta.nota && <p className="mt-1 text-grafite-400">{risposta.nota}</p>}
            {risposta.aCatalogo && !risposta.aPagamento && risposta.codice && (
              <button type="button" className="btn-acido mt-3" onClick={() => onIscrivi(risposta.codice!)}>
                Iscrivi
              </button>
            )}
            {risposta.aCatalogo && risposta.aPagamento && puoOrdinare && (
              <button type="button" className="btn-acido mt-3" onClick={onOrdina}>
                Ordina · € {risposta.prezzo} a persona
              </button>
            )}
          </div>
        )}
      </div>
    </Foglio>
  );
}

// ---------------------------------------------------------------- Impostazioni dei promemoria

export function FoglioPromemoria({ aziendaId, iniziale, onChiudi, onFatto }: { aziendaId: number; iniziale: Promemoria; onChiudi: () => void; onFatto: (p: Promemoria) => void }) {
  const [p, setP] = useState<Promemoria>(iniziale);
  const [tentato, setTentato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const errori = erroriPromemoria(p);
  const cambia = <K extends 'anticipi' | 'canali' | 'destinatari'>(k: K, v: Promemoria[K][number]) =>
    setP((x) => ({ ...x, [k]: (x[k] as Array<typeof v>).includes(v) ? (x[k] as Array<typeof v>).filter((y) => y !== v) : [...(x[k] as Array<typeof v>), v] }));
  const salva = async () => {
    setTentato(true);
    if (errori.canali || errori.destinatari) return;
    setInvio(true);
    setErrore(null);
    try {
      onFatto(await salvaPromemoria(aziendaId, p));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setInvio(false);
    }
  };
  const casella = (on: boolean, onChange: () => void, testo: string, aiuto?: string | null) => (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" className="mt-1" checked={on} onChange={onChange} />
      <span>
        <span className="block text-[14.5px] text-ink">{testo}</span>
        {aiuto && <span className="block text-[12.5px] text-ink-muted">{aiuto}</span>}
      </span>
    </label>
  );
  return (
    <Foglio
      aperto
      titolo="Impostazioni dei promemoria"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" disabled={invio} onClick={salva}>
            Salva
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-1 text-[13.5px] font-medium text-ink">Avvisami prima della scadenza</legend>
          {[90, 60, 30].map((g) => casella(p.anticipi.includes(g), () => cambia('anticipi', g), `${g} giorni prima`))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-[13.5px] font-medium text-ink">Allarme</legend>
          {casella(p.allarme, () => setP((x) => ({ ...x, allarme: !x.allarme })), 'Allarme a 15 giorni se non è ancora prenotata', 'Consigliato: è la regola del servizio (BR-69). Arriva anche alla segreteria ISFOR.')}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-[13.5px] font-medium text-ink">Canali</legend>
          {casella(p.canali.includes('email'), () => cambia('canali', 'email'), 'Email')}
          {casella(p.canali.includes('whatsapp'), () => cambia('canali', 'whatsapp'), 'WhatsApp', 'Mai dalle 20 alle 8 e nei festivi.')}
          {tentato && errori.canali && <p className="text-[13px] text-stato-danger-ink">{errori.canali}</p>}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-[13.5px] font-medium text-ink">Chi li riceve</legend>
          {casella(p.destinatari.includes('titolare'), () => cambia('destinatari', 'titolare'), 'Titolare', p.nomi.titolare)}
          {casella(p.destinatari.includes('referente'), () => cambia('destinatari', 'referente'), 'Referente interno', p.nomi.referente)}
          {tentato && errori.destinatari && <p className="text-[13px] text-stato-danger-ink">{errori.destinatari}</p>}
        </fieldset>
        {errore && <Avviso tono="danger">{errore}</Avviso>}
      </div>
    </Foglio>
  );
}

/** Data breve di un appuntamento (riuso nelle righe). */
export const dataBreve = (iso: string | null) => (iso ? dataIt(iso.slice(0, 10)) : '');
