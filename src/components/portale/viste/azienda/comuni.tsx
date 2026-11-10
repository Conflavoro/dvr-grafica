'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Foglio } from '../../kit';
import { Spunta } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { richiediPrenotazione } from '@/lib/portale/area-api';
import { NOMI_TIPO_VISITA } from '@/lib/portale/area-logica';

/**
 * Pezzi comuni delle viste dell'area azienda, operativita': caricamento con
 * ricarica quando il Falco cambia i dati, id nella query string (export
 * statico), campi dei fogli, conferma finale e foglio di richiesta di
 * prenotazione allo studio.
 */

/** Carica i dati della vista e li ricarica quando cambiano le dipendenze. */
export function useCarica<T>(fn: () => Promise<T>, deps: unknown[]): { dati: T | null; errore: string | null; carica: () => void; caricando: boolean } {
  const [dati, setDati] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);
  const giro = useRef(0);
  const carica = useCallback(() => {
    const n = ++giro.current;
    setCaricando(true);
    setErrore(null);
    fn()
      .then((d) => n === giro.current && setDati(d))
      .catch((e: unknown) => n === giro.current && setErrore(e instanceof Error ? e.message : 'Non riesco a caricare i dati.'))
      .finally(() => n === giro.current && setCaricando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => carica(), [carica]);
  return { dati, errore, carica, caricando };
}

/** Parametro della query string (?id=, ?scheda=) letto e scritto senza ricaricare la pagina. */
export function useQuery(nome: string): [string | null, (v: string | null) => void] {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    const leggi = () => setV(new URLSearchParams(window.location.search).get(nome));
    leggi();
    window.addEventListener('popstate', leggi);
    return () => window.removeEventListener('popstate', leggi);
  }, [nome]);
  const imposta = useCallback(
    (nuovo: string | null) => {
      const u = new URL(window.location.href);
      if (nuovo === null) u.searchParams.delete(nome);
      else u.searchParams.set(nome, nuovo);
      window.history.pushState(null, '', u.pathname + u.search);
      setV(nuovo);
    },
    [nome]
  );
  return [v, imposta];
}

export function Campo({ etichetta, errore, aiuto, children }: { etichetta: string; errore?: string; aiuto?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-medium text-ink">{etichetta}</span>
      {children}
      {aiuto && !errore && <span className="mt-1 block text-[12.5px] text-ink-muted">{aiuto}</span>}
      {errore && <span className="mt-1 block text-[12.5px] text-[#d63d3e]">{errore}</span>}
    </label>
  );
}

export function Avviso({ tono = 'info', titolo, children }: { tono?: 'info' | 'warn' | 'ok' | 'danger'; titolo?: string; children?: ReactNode }) {
  const cls = { info: 'bg-stato-info text-stato-info-ink', warn: 'bg-stato-warn text-stato-warn-ink', ok: 'bg-stato-ok text-stato-ok-ink', danger: 'bg-stato-danger text-stato-danger-ink' }[tono];
  return (
    <div className={clsx('rounded-[1rem] px-4 py-3 text-[13.5px] leading-relaxed', cls)}>
      {titolo && <p className="font-medium">{titolo}</p>}
      {children && <div className={titolo ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
    </div>
  );
}

/** Conferma finale di un foglio: cerchio acido con la spunta, titolo e testo. */
export function Fatto({ titolo, children }: { titolo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-oro-500 text-acido-950">
        <Spunta size={28} aria-hidden />
      </span>
      <p className="mt-4 text-[20px] font-medium tracking-[-0.015em] text-ink">{titolo}</p>
      {children && <div className="mt-1.5 max-w-[40ch] text-[14px] leading-relaxed text-ink-muted">{children}</div>}
    </div>
  );
}

/** Pillole di filtro, a scelta singola o multipla, con conteggio. */
export function Pillole<K extends string>({ voci, scelte, onCambia, etichetta }: { voci: Array<{ k: K; t: string; n?: number; segno?: string }>; scelte: K[]; onCambia: (k: K) => void; etichetta: string }) {
  return (
    <div role="group" aria-label={etichetta} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {voci.map((v) => {
        const on = scelte.includes(v.k);
        return (
          <button
            key={v.k}
            type="button"
            aria-pressed={on}
            onClick={() => onCambia(v.k)}
            className={clsx(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors lg:h-10',
              on ? 'bg-grafite-900 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]'
            )}
          >
            {v.segno && <span aria-hidden className={clsx('h-2 w-2 rounded-full', v.segno)} />}
            {v.t}
            {v.n != null && <span className={clsx('cifre text-[12px]', on ? 'text-grafite-300' : 'text-ink-subtle')}>{v.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface PersonaScelta {
  id: number;
  nome: string;
  nota?: string;
}

/**
 * Richiesta allo studio di prenotare una visita o un corso: la data la fissa
 * la segreteria, il lavoratore riceve la convocazione sul suo link.
 */
export function FoglioPrenota({
  aperto,
  onChiudi,
  aziendaId,
  tipo,
  persone,
  preselezione = [],
  corso,
  corsi = [],
  tipiVisita = ['periodica', 'preventiva', 'cambio_mansione', 'rientro', 'su_richiesta'],
  onFatto,
}: {
  aperto: boolean;
  onChiudi: () => void;
  aziendaId: number;
  tipo: 'visita' | 'corso';
  persone: PersonaScelta[];
  preselezione?: number[];
  corso?: string | null;
  corsi?: Array<{ codice: string; nome: string }>;
  tipiVisita?: string[];
  onFatto?: () => void;
}) {
  const [scelti, setScelti] = useState<number[]>(preselezione);
  const [codice, setCodice] = useState(corso ?? corsi[0]?.codice ?? 'formazione_generale');
  const [tv, setTv] = useState(tipiVisita[0] ?? 'periodica');
  const [preferenza, setPreferenza] = useState('');
  const [note, setNote] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);
  const chiave = preselezione.join(',');

  useEffect(() => {
    if (!aperto) return;
    setScelti(preselezione);
    setCodice(corso ?? corsi[0]?.codice ?? 'formazione_generale');
    setEsito(null);
    setErrore(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, chiave, corso]);

  const invia = async () => {
    if (scelti.length === 0) {
      setErrore('Scegli almeno un lavoratore.');
      return;
    }
    setInvio(true);
    setErrore(null);
    try {
      const nota = await richiediPrenotazione(aziendaId, {
        tipo,
        lavoratori: scelti,
        ...(tipo === 'corso' ? { corso: codice } : { tipo_visita: tv }),
        preferenza: preferenza || undefined,
        note: note || undefined,
      });
      setEsito(nota);
      onFatto?.();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Richiesta non riuscita.');
    } finally {
      setInvio(false);
    }
  };

  const titolo = tipo === 'visita' ? 'Chiedi di prenotare la visita' : 'Chiedi di iscrivere a un corso';
  return (
    <Foglio
      aperto={aperto}
      titolo={titolo}
      onChiudi={onChiudi}
      piede={
        esito ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={invia}>
              {invio ? 'Invio' : 'Invia la richiesta'}
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo="Richiesta inviata">{esito}</Fatto>
      ) : (
        <div className="space-y-4">
          {tipo === 'corso' ? (
            <Campo etichetta="Corso">
              <select className="input-field" value={codice} onChange={(e) => setCodice(e.target.value)}>
                {corsi.map((c) => (
                  <option key={c.codice} value={c.codice}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
            <Campo etichetta="Tipo di visita">
              <div className="flex flex-wrap gap-1.5">
                {tipiVisita.map((t) => (
                  <button key={t} type="button" aria-pressed={tv === t} onClick={() => setTv(t)} className={clsx('h-11 rounded-full px-3.5 text-[13.5px] font-medium lg:h-10', tv === t ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink')}>
                    {NOMI_TIPO_VISITA[t] ?? t}
                  </button>
                ))}
              </div>
            </Campo>
          )}
          <fieldset>
            <legend className="mb-1.5 text-[13.5px] font-medium text-ink">Lavoratori</legend>
            {persone.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">Nessun lavoratore da scegliere.</p>
            ) : (
              <ul className="max-h-[16rem] overflow-y-auto rounded-[1rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
                {persone.map((p) => (
                  <li key={p.id} className="border-b border-perla-linea last:border-b-0">
                    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3.5">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-grafite-900"
                        checked={scelti.includes(p.id)}
                        onChange={(e) => setScelti((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] text-ink">{p.nome}</span>
                        {p.nota && <span className="block text-[12.5px] text-ink-muted">{p.nota}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <Campo etichetta="Preferenza (facoltativa)" aiuto="Per esempio: di mattina, non il venerdì.">
            <input className="input-field" value={preferenza} maxLength={200} onChange={(e) => setPreferenza(e.target.value)} />
          </Campo>
          <Campo etichetta="Note per la segreteria (facoltative)">
            <input className="input-field" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </Campo>
          <Avviso titolo="La data la fissa la segreteria dello studio">
            Il lavoratore riceve la convocazione sul suo link personale e può confermare o chiedere un’altra data. Ti avvisiamo quando è in calendario.
          </Avviso>
          {errore && <p className="text-[13.5px] text-[#d63d3e]">{errore}</p>}
        </div>
      )}
    </Foglio>
  );
}

/** Riga etichetta e valore delle schede di dettaglio. */
export function Voce({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-perla-linea py-2.5 last:border-b-0">
      <span className="text-[13.5px] text-ink-muted">{etichetta}</span>
      <span className="min-w-0 text-right text-[14px] text-ink">{children}</span>
    </div>
  );
}
