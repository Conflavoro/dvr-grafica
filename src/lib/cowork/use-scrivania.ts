'use client';

/**
 * Stato della Scrivania del DVR: documento, sezione aperta, controlli, azioni e
 * aggiornamento in tempo reale. I componenti grafici leggono solo da qui e si
 * possono sostituire senza toccare chiamate e regole.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { CoworkErrore, type Aperto } from './api';
import { avviaAggiornamento, type Modo } from './aggiornamento';
import { daRicaricare, prossimaAperta, sezioneIniziale } from './logica';
import type { Controlli, Controllo, Documento, Paragrafo, Sezione } from './tipi';

export interface Messaggio {
  testo: string;
  tono: 'ok' | 'warn' | 'danger';
  aperti?: Aperto[];
}

export interface Scrivania {
  documento: Documento | null;
  sezione: Sezione | null;
  controlli: Controlli | null;
  chiave: string | null;
  caricamento: boolean;
  caricaSezione: boolean;
  errore: CoworkErrore | null;
  messaggio: Messaggio | null;
  chiudiMessaggio: () => void;
  avvisa: (testo: string, tono?: Messaggio['tono']) => void;
  /** Azione in corso: "<paragrafo>:<azione>", "sezione", "controllo:<id>", "approva". */
  lavoro: string | null;
  modo: Modo;
  apriSezione: (k: string) => void;
  ricarica: () => void;
  accetta: (p: Paragrafo) => Promise<boolean>;
  modifica: (p: Paragrafo, testo: string) => Promise<boolean>;
  nonApplicabile: (p: Paragrafo, motivo: string) => Promise<boolean>;
  riscrivi: (p: Paragrafo, istruzione: string) => Promise<boolean>;
  rigenera: (p: Paragrafo) => Promise<boolean>;
  accettaSezione: () => Promise<boolean>;
  eseguiControllo: (c: Controllo) => Promise<boolean>;
  accettaControllo: (c: Controllo, motivo: string) => Promise<boolean>;
  approva: () => Promise<boolean>;
}

const comeErrore = (e: unknown) => (e instanceof CoworkErrore ? e : api.inErrore(e));

export function useScrivania(tipo: string, id: number, opz: { sezione?: string | null; suSezione?: (k: string) => void } = {}): Scrivania {
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [sezione, setSezione] = useState<Sezione | null>(null);
  const [controlli, setControlli] = useState<Controlli | null>(null);
  const [chiave, setChiave] = useState<string | null>(opz.sezione ?? null);
  const [caricamento, setCaricamento] = useState(true);
  const [caricaSez, setCaricaSez] = useState(false);
  const [errore, setErrore] = useState<CoworkErrore | null>(null);
  const [messaggio, setMessaggio] = useState<Messaggio | null>(null);
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('flusso');

  // Riferimenti per il polling, che vive fuori dal ciclo di React.
  const chiaveRef = useRef<string | null>(chiave);
  chiaveRef.current = chiave;
  const giroSezione = useRef(0);
  const suSezione = useRef(opz.suSezione);
  suSezione.current = opz.suSezione;

  const leggiDocumento = useCallback(async () => {
    const d = await api.documento(tipo, id);
    setDocumento(d);
    return d;
  }, [tipo, id]);

  const leggiControlli = useCallback(async () => {
    try {
      setControlli(await api.controlli(tipo, id));
    } catch {
      /* i controlli non fermano la pagina: restano gli ultimi letti */
    }
  }, [tipo, id]);

  const leggiSezione = useCallback(
    async (k: string, mostraAttesa = false) => {
      const n = ++giroSezione.current;
      if (mostraAttesa) setCaricaSez(true);
      try {
        const s = await api.sezione(tipo, id, k);
        if (n === giroSezione.current) setSezione(s);
      } catch (e) {
        if (n === giroSezione.current) setMessaggio({ testo: comeErrore(e).message, tono: 'danger' });
      } finally {
        if (n === giroSezione.current) setCaricaSez(false);
      }
    },
    [tipo, id],
  );

  // Primo caricamento.
  useEffect(() => {
    let vivo = true;
    setCaricamento(true);
    setErrore(null);
    (async () => {
      try {
        const d = await leggiDocumento();
        if (!vivo) return;
        const k = sezioneIniziale(d.indice, chiaveRef.current);
        setChiave(k);
        await Promise.all([k ? leggiSezione(k, true) : Promise.resolve(), leggiControlli()]);
      } catch (e) {
        if (vivo) setErrore(comeErrore(e));
      } finally {
        if (vivo) setCaricamento(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [leggiDocumento, leggiSezione, leggiControlli]);

  const aziendaId = documento?.testata.aziendaId ?? null;
  const cursore = documento?.cursore ?? null;
  const pronto = documento !== null;

  // Tempo reale: flusso a cursore, o ricarica ogni 10 secondi se il flusso non c'e'.
  useEffect(() => {
    if (!pronto) return;
    const visibile = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const a = avviaAggiornamento({
      cursoreIniziale: cursore,
      visibile,
      leggiFlusso: (c) => (aziendaId ? api.flusso(aziendaId, c) : Promise.resolve({ esito: 'assente' as const })),
      suEventi: async (voci) => {
        const r = daRicaricare(voci, { tipo, id, sezione: chiaveRef.current });
        const lavori: Array<Promise<unknown>> = [];
        if (r.documento) lavori.push(leggiDocumento().catch(() => null));
        if (r.sezione && chiaveRef.current) lavori.push(leggiSezione(chiaveRef.current));
        if (r.controlli) lavori.push(leggiControlli());
        await Promise.all(lavori);
      },
      suRiserva: async () => {
        await Promise.all([leggiDocumento().catch(() => null), chiaveRef.current ? leggiSezione(chiaveRef.current) : null, leggiControlli()]);
      },
      suModo: setModo,
    });
    const torna = () => visibile() && a.subito();
    document.addEventListener('visibilitychange', torna);
    return () => {
      a.ferma();
      document.removeEventListener('visibilitychange', torna);
    };
    // Il cursore iniziale serve solo all'avvio: non si riavvia il polling quando cambia.
  }, [pronto, aziendaId, tipo, id, leggiDocumento, leggiSezione, leggiControlli]); // eslint-disable-line react-hooks/exhaustive-deps

  const apriSezione = useCallback(
    (k: string) => {
      setChiave(k);
      chiaveRef.current = k;
      setSezione((s) => (s?.chiave === k ? s : null));
      suSezione.current?.(k);
      void leggiSezione(k, true);
    },
    [leggiSezione],
  );

  const ricarica = useCallback(() => {
    void leggiDocumento().catch((e) => setErrore(comeErrore(e)));
    if (chiaveRef.current) void leggiSezione(chiaveRef.current);
    void leggiControlli();
  }, [leggiDocumento, leggiSezione, leggiControlli]);

  /** Mette il paragrafo aggiornato nella sezione aperta senza aspettare la rilettura. */
  const sostituisci = (p: Paragrafo) => setSezione((s) => (s && s.chiave === p.sezione ? { ...s, elenco: s.elenco.map((x) => (x.id === p.id ? p : x)) } : s));

  const dopoErrore = useCallback(
    (e: unknown) => {
      const err = comeErrore(e);
      if (err.status === 409) {
        if (err.paragrafo) sostituisci(err.paragrafo);
        if (chiaveRef.current) void leggiSezione(chiaveRef.current);
        void leggiDocumento().catch(() => null);
        setMessaggio({ testo: err.message, tono: 'warn' });
      } else if (err.status === 422) {
        void leggiControlli();
        setMessaggio({ testo: err.message, tono: 'warn', aperti: err.aperti });
      } else {
        setMessaggio({ testo: err.message, tono: 'danger' });
      }
    },
    [leggiSezione, leggiDocumento, leggiControlli],
  );

  const esegui = useCallback(
    async (nome: string, fn: () => Promise<string | null>): Promise<boolean> => {
      setLavoro(nome);
      setMessaggio(null);
      try {
        const ok = await fn();
        if (ok) setMessaggio({ testo: ok, tono: 'ok' });
        return true;
      } catch (e) {
        dopoErrore(e);
        return false;
      } finally {
        setLavoro(null);
      }
    },
    [dopoErrore],
  );

  const suParagrafo = useCallback(
    (p: Paragrafo, azione: string, chiamata: () => Promise<{ paragrafo: Paragrafo }>, ok: string) =>
      esegui(`${p.id}:${azione}`, async () => {
        const r = await chiamata();
        sostituisci(r.paragrafo);
        await Promise.all([leggiDocumento().catch(() => null), leggiControlli(), chiaveRef.current ? leggiSezione(chiaveRef.current) : null]);
        return ok;
      }),
    [esegui, leggiDocumento, leggiControlli],
  );

  return {
    documento,
    sezione,
    controlli,
    chiave,
    caricamento,
    caricaSezione: caricaSez,
    errore,
    messaggio,
    chiudiMessaggio: () => setMessaggio(null),
    avvisa: (testo, tono = 'danger') => setMessaggio({ testo, tono }),
    lavoro,
    modo,
    apriSezione,
    ricarica,
    accetta: (p) => suParagrafo(p, 'accetta', () => api.accetta(p), 'Paragrafo accettato.'),
    modifica: (p, t) => suParagrafo(p, 'modifica', () => api.modifica(p, t), 'Testo salvato e accettato come tuo.'),
    nonApplicabile: (p, m) => suParagrafo(p, 'non_applicabile', () => api.nonApplicabile(p, m), 'Paragrafo segnato come non applicabile.'),
    riscrivi: (p, i) => suParagrafo(p, 'riscrivi', () => api.riscrivi(p, i), "L'assistente ha scritto una nuova proposta: confrontala con il testo e scegli."),
    rigenera: (p) => suParagrafo(p, 'rigenera', () => api.rigenera(p), "Proposta rigenerata dai dati attuali."),
    accettaSezione: () =>
      esegui('sezione', async () => {
        const k = chiaveRef.current;
        if (!k) return null;
        const n = await api.accettaTuttaSezione(tipo, id, k);
        const d = await leggiDocumento();
        await Promise.all([leggiSezione(k), leggiControlli()]);
        const dopo = prossimaAperta(d.indice, k);
        const base = n === 1 ? 'Accettato 1 paragrafo.' : `Accettati ${n} paragrafi.`;
        return dopo ? `${base} La prossima sezione da chiudere è la ${dopo}.` : `${base} Tutte le sezioni sono chiuse.`;
      }),
    eseguiControllo: (c) =>
      esegui(`controllo:${c.id}`, async () => {
        const nota = await api.eseguiControllo(c.id);
        await leggiControlli();
        return nota ?? `${c.azione?.etichetta ?? 'Azione'}: fatto.`;
      }),
    accettaControllo: (c, m) =>
      esegui(`controllo:${c.id}`, async () => {
        await api.accettaControllo(c.id, m);
        await Promise.all([leggiControlli(), leggiDocumento().catch(() => null)]);
        return 'Avviso accettato con il tuo motivo: resta nel registro del documento.';
      }),
    approva: () =>
      esegui('approva', async () => {
        await api.approva(id);
        await Promise.all([leggiDocumento(), leggiControlli()]);
        return 'DVR approvato. I testi accettati sono diventati la revisione ufficiale.';
      }),
  };
}
