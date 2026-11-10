/**
 * Aggiornamento in tempo reale della Scrivania (ADR-011 D7): polling a cursore sul
 * flusso dell'azienda ogni pochi secondi, solo a pagina visibile. Se l'endpoint del
 * flusso non c'e' ancora, si ricarica lo stato ogni 10 secondi.
 * Niente React qui: tempi e chiamate sono iniettati, cosi' si prova senza browser.
 */

import type { EsitoFlusso } from './api';
import type { EventoFlusso } from './tipi';

export const OGNI_MS = 4000;
export const RISERVA_MS = 10000;
const MASSIMO_MS = 60000;

export type Modo = 'flusso' | 'riserva';

export interface OpzioniAggiornamento {
  leggiFlusso: (cursore: string | null) => Promise<EsitoFlusso>;
  /** Eventi nuovi dal flusso (mai al primo giro senza cursore: quello serve solo a prendere il cursore). */
  suEventi: (voci: EventoFlusso[]) => void | Promise<void>;
  /** Ricarica completa dello stato quando il flusso non esiste. */
  suRiserva: () => void | Promise<void>;
  cursoreIniziale?: string | null;
  visibile?: () => boolean;
  ogniMs?: number;
  riservaMs?: number;
  pianifica?: (fn: () => void, ms: number) => unknown;
  annulla?: (h: unknown) => void;
  suModo?: (m: Modo) => void;
}

export interface Aggiornamento {
  ferma: () => void;
  /** Chiede un giro subito (per esempio quando la pagina torna visibile). */
  subito: () => void;
  modo: () => Modo;
}

export function avviaAggiornamento(o: OpzioniAggiornamento): Aggiornamento {
  const ogni = o.ogniMs ?? OGNI_MS;
  const riserva = o.riservaMs ?? RISERVA_MS;
  const pianifica = o.pianifica ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const annulla = o.annulla ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const visibile = o.visibile ?? (() => true);

  let cursore: string | null = o.cursoreIniziale ?? null;
  let primo = cursore === null;
  let modo: Modo = 'flusso';
  let errori = 0;
  let fermo = false;
  let inCorso = false;
  let timer: unknown = null;

  const prossimo = (ms: number) => {
    if (fermo) return;
    if (timer !== null) annulla(timer);
    timer = pianifica(() => {
      timer = null;
      void giro();
    }, ms);
  };

  const attesaErrore = (base: number) => Math.min(base * 2 ** Math.min(errori, 4), MASSIMO_MS);

  async function giro(): Promise<void> {
    if (fermo || inCorso) return;
    if (!visibile()) {
      prossimo(modo === 'flusso' ? ogni : riserva);
      return;
    }
    inCorso = true;
    try {
      if (modo === 'riserva') {
        await o.suRiserva();
        errori = 0;
        prossimo(riserva);
        return;
      }
      const r = await o.leggiFlusso(cursore);
      if (r.esito === 'assente') {
        modo = 'riserva';
        o.suModo?.('riserva');
        prossimo(riserva);
        return;
      }
      errori = 0;
      cursore = r.cursore ?? cursore;
      if (r.esito === 'eventi' && !primo) await o.suEventi(r.voci);
      primo = false;
      prossimo(ogni);
    } catch {
      errori += 1;
      prossimo(attesaErrore(modo === 'flusso' ? ogni : riserva));
    } finally {
      inCorso = false;
    }
  }

  prossimo(0);

  return {
    ferma: () => {
      fermo = true;
      if (timer !== null) annulla(timer);
      timer = null;
    },
    subito: () => prossimo(0),
    modo: () => modo,
  };
}
