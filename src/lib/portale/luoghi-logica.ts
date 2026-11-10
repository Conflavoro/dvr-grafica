/**
 * Regole del client per le sezioni della squadra S5 (stessi testi del server, cosi'
 * l'errore compare subito nel foglio senza attendere la risposta).
 */

import type { ProdottoCassetta, RispostaVerifica } from './luoghi-api';

/** "1 cosa da fare" / "3 cose da fare". */
export const coseDaFare = (n: number): string => (n === 1 ? '1 cosa da fare' : `${n} cose da fare`);

/** Data ISO di oggi + n mesi (proposta della nuova scadenza: 24 mesi). */
export function traMesi(n: number, oggi: Date = new Date()): string {
  const d = new Date(Date.UTC(oggi.getFullYear(), oggi.getMonth() + n, oggi.getDate()));
  return d.toISOString().slice(0, 10);
}

/** "Segna tutti sì": tutti tranne scaduti e mancanti. */
export function tuttiSi(prodotti: ProdottoCassetta[], attuali: Record<string, RispostaVerifica>): Record<string, RispostaVerifica> {
  const out = { ...attuali };
  for (const p of prodotti) if (p.stato !== 'scaduto' && p.stato !== 'manca') out[p.codice] = { esito: 'si' };
  return out;
}

/** Errori della verifica del mese (regole 17.3), con i codici delle righe sbagliate. */
export function erroriVerifica(prodotti: ProdottoCassetta[], risposte: Record<string, RispostaVerifica>): { testo: string; righe: string[] } | null {
  const mancano = prodotti.filter((p) => !risposte[p.codice]);
  if (mancano.length > 0) {
    return { testo: mancano.length === 1 ? 'Rispondi per tutti i prodotti: ne manca 1.' : `Rispondi per tutti i prodotti: ne mancano ${mancano.length}.`, righe: mancano.map((p) => p.codice) };
  }
  const scadutiSi = prodotti.filter((p) => p.stato === 'scaduto' && risposte[p.codice]?.esito === 'si');
  if (scadutiSi.length > 0) {
    return {
      testo: `${scadutiSi.map((p) => p.breve).join(', ')}: ${scadutiSi.length === 1 ? 'è scaduto' : 'sono scaduti'}. Segna “Sostituito” o “Manca o rovinato”.`,
      righe: scadutiSi.map((p) => p.codice),
    };
  }
  return null;
}

/** Barrette del gruppo (C, B, A): accese fino al gruppo dell'azienda. */
export function barretteGruppo(g: 'A' | 'B' | 'C'): boolean[] {
  const livello = { C: 1, B: 2, A: 3 }[g];
  return [1, 2, 3].map((n) => n <= livello);
}
