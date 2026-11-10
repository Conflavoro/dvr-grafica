'use client';

import { useSyncExternalStore } from 'react';

/**
 * Stato condiviso del guscio senza contesto React: contatori delle voci (barra del telefono e
 * menu del computer) e messaggi brevi (toast). Le viste li scrivono, il guscio li mostra.
 */

// ---------------------------------------------------------------- contatori

let contatori: Record<string, number> = {};
const suContatori = new Set<() => void>();

/**
 * Imposta i contatori per chiave di sezione (es. { documenti: 2, messaggi: 1 }). La somma per
 * la voce Tutto la fa il guscio (contatoriBarra). Un valore 0 o assente non mostra il pallino.
 */
export function impostaContatori(valori: Record<string, number | null | undefined>): void {
  const nuovi = { ...contatori };
  for (const [k, v] of Object.entries(valori)) {
    if (v == null || !(v > 0)) delete nuovi[k];
    else nuovi[k] = Math.floor(v);
  }
  contatori = nuovi;
  suContatori.forEach((f) => f());
}

/** Si svuotano al cambio di azienda. */
export function azzeraContatori(): void {
  contatori = {};
  suContatori.forEach((f) => f());
}

export function leggiContatori(): Record<string, number> {
  return contatori;
}

const VUOTI: Record<string, number> = {};

export function useContatori(): Record<string, number> {
  return useSyncExternalStore(
    (f) => {
      suContatori.add(f);
      return () => {
        suContatori.delete(f);
      };
    },
    () => contatori,
    () => VUOTI,
  );
}

// ---------------------------------------------------------------- toast

export interface Toast {
  id: number;
  testo: string;
  /** Chiave dell'icona nel cerchio acido: spunta (predefinita), avviso, info. */
  icona: 'spunta' | 'avviso' | 'info';
  uscita: boolean;
}

/** Durata di un toast (02: resta 3,2 secondi, poi sfuma). */
export const DURATA_TOAST = 3200;

let toasts: Toast[] = [];
let prossimo = 1;
const suToast = new Set<() => void>();
const avvisaToast = () => suToast.forEach((f) => f());

/** Mostra un messaggio breve in basso al centro (sopra la barra sul telefono). */
export function toast(testo: string, icona: Toast['icona'] = 'spunta'): void {
  const id = prossimo++;
  toasts = [...toasts, { id, testo, icona, uscita: false }].slice(-3);
  avvisaToast();
  setTimeout(() => {
    toasts = toasts.map((t) => (t.id === id ? { ...t, uscita: true } : t));
    avvisaToast();
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      avvisaToast();
    }, 300);
  }, DURATA_TOAST);
}

const NESSUNO: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (f) => {
      suToast.add(f);
      return () => {
        suToast.delete(f);
      };
    },
    () => toasts,
    () => NESSUNO,
  );
}

// ---------------------------------------------------------------- numeri delle tessere di Tutto

/** Numero della tessera di una sezione nella pagina Tutto del telefono (04-schermate/telefono). */
export interface Riassunto {
  numero: string | number;
  /** Unità accanto al numero (es. "%", "€"). */
  unita?: string;
  /** Etichetta sotto il numero (es. "entro 30 giorni", "in regola"). */
  etichetta: string;
}

let riassunti: Record<string, Riassunto> = {};
const suRiassunti = new Set<() => void>();

/** Ogni squadra scrive il numero della sua tessera (chiave = sezione); null lo toglie. */
export function impostaRiassunti(valori: Record<string, Riassunto | null>): void {
  const nuovi = { ...riassunti };
  for (const [k, v] of Object.entries(valori)) {
    if (v) nuovi[k] = v;
    else delete nuovi[k];
  }
  riassunti = nuovi;
  suRiassunti.forEach((f) => f());
}

const NESSUN_RIASSUNTO: Record<string, Riassunto> = {};

export function useRiassunti(): Record<string, Riassunto> {
  return useSyncExternalStore(
    (f) => {
      suRiassunti.add(f);
      return () => {
        suRiassunti.delete(f);
      };
    },
    () => riassunti,
    () => NESSUN_RIASSUNTO,
  );
}
