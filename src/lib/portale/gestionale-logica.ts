/**
 * Logica pura del gestionale (coda, aziende, avvio): testi dei termini, conto
 * delle 48 ore, livelli degli assistenti, correzione dei dati proposti. Niente
 * DOM e niente chiamate: si prova con Jest.
 */

import type { AziendaIndice } from '@/lib/agente-aziende';
import type { FiltroCoda, RigaAzienda } from './gestionale-api';

export type TonoChip = 'ok' | 'warn' | 'danger' | 'neutral' | 'info' | 'sign';

/** Durata leggibile (spec 5.4): minuti sotto un'ora, ore sotto 48, poi giorni. */
export function durata(ms: number): string {
  const min = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (min < 60) return min === 1 ? '1 minuto' : `${min} minuti`;
  const ore = Math.round(min / 60);
  if (ore < 48) return ore === 1 ? '1 ora' : `${ore} ore`;
  const g = Math.round(ore / 24);
  return g === 1 ? '1 giorno' : `${g} giorni`;
}

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

/** Chip del termine: scaduta, entro 8 ore, oppure la data. */
export function chipTermine(iso: string | null, adesso: Date = new Date()): { tono: TonoChip; testo: string } | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const diff = t.getTime() - adesso.getTime();
  if (diff < 0) return { tono: 'danger', testo: `Scaduta da ${durata(diff)}` };
  if (diff < 8 * 3600000) return { tono: 'warn', testo: `Scade tra ${durata(diff)}` };
  return { tono: 'neutral', testo: `Entro il ${fmtGiorno.format(t)}` };
}

/** "termine 14/10 alle 18:00" per le righe. */
export function quando(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? '' : `${fmtGiorno.format(t)} alle ${fmtOra.format(t)}`;
}

/** Conto delle 48 ore dal pagamento (spec 8.3). */
export function contoOre(ore: number | null, obiettivo = 48): { tono: TonoChip; testo: string; pct: number } {
  if (ore === null) return { tono: 'neutral', testo: 'Parte all’incasso', pct: 0 };
  const h = Math.max(0, Math.round(ore));
  const pct = Math.min(100, Math.round((ore / obiettivo) * 100));
  if (ore > obiettivo) return { tono: 'danger', testo: `${h} h, ${Math.round(ore - obiettivo)} oltre l’obiettivo`, pct: 100 };
  return { tono: ore < 24 ? 'ok' : 'warn', testo: `${h} h, ne restano ${Math.max(0, Math.round(obiettivo - ore))}`, pct };
}

/** Livello di autonomia dell'assistente (spec 4.1). */
export function livello(l: number | null): { tono: TonoChip; testo: string; spiega: string } | null {
  if (l === 1) return { tono: 'neutral', testo: 'Livello 1 · esegue', spiega: 'L’assistente fa da solo, una persona rivede un campione.' };
  if (l === 2) return { tono: 'info', testo: 'Livello 2 · approva', spiega: 'L’assistente prepara, una persona approva.' };
  if (l === 3) return { tono: 'sign', testo: 'Livello 3 · firma', spiega: 'La persona decide e firma, l’assistente aiuta.' };
  return null;
}

export const ETICHETTE_FILTRI: Record<FiltroCoda, string> = {
  tutto: 'Tutto',
  mie: 'Mie',
  oggi: 'Oggi',
  in_ritardo: 'In ritardo',
  fatto_oggi: 'Fatto oggi',
  proposte: 'Proposte',
  allarmi: 'Allarmi',
  compiti: 'Compiti',
};

const ETICHETTE_CAMPI: Record<string, string> = {
  ateco: 'Codice ATECO',
  lavoratori_totali: 'Lavoratori',
  indirizzo: 'Indirizzo',
  comune: 'Comune',
  provincia: 'Provincia',
  cap: 'CAP',
  email: 'Email',
  pec: 'PEC',
  telefono: 'Telefono',
  numero_rea: 'Numero REA',
  camera_commercio: 'Camera di commercio',
  natura_giuridica: 'Natura giuridica',
  nome: 'Nome',
  cognome: 'Cognome',
  mansione: 'Mansione',
  data_assunzione: 'Data di assunzione',
  descrizione: 'Descrizione',
  data_prevista: 'Data prevista',
  priorita: 'Priorità',
  tipo: 'Tipo',
  servizio: 'Servizio',
  quantita: 'Quantità',
};

export function etichettaCampo(k: string): string {
  return ETICHETTE_CAMPI[k] ?? k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export interface CampoProposto {
  campo: string;
  etichetta: string;
  valore: string;
}

/**
 * Campi modificabili di una proposta: per i dati dell'azienda quelli dentro
 * "campi", per gli altri tipi i valori semplici del payload (non la fonte e
 * non gli importi calcolati dal codice).
 */
export function campiProposti(sottotipo: string | null, payload: Record<string, unknown> | null): CampoProposto[] {
  if (!payload) return [];
  const sorgente = sottotipo === 'dati_azienda' ? (payload.campi && typeof payload.campi === 'object' ? (payload.campi as Record<string, unknown>) : {}) : payload;
  const esclusi = new Set(['fonte', 'importo_centesimi', 'importo', 'nome_servizio']);
  return Object.entries(sorgente)
    .filter(([k, v]) => !esclusi.has(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => ({ campo: k, etichetta: etichettaCampo(k), valore: String(v) }));
}

/**
 * Payload della "correzione e approvazione": i campi tolti non entrano, quelli
 * cambiati prendono il valore della persona. Per i dati dell'azienda resta la forma {campi, fonte}.
 */
export function payloadCorretto(
  sottotipo: string | null,
  payload: Record<string, unknown> | null,
  valori: Record<string, string>,
  tolti: string[] = []
): Record<string, unknown> {
  const base = payload ?? {};
  const campi = campiProposti(sottotipo, base);
  const nuovi: Record<string, unknown> = {};
  for (const c of campi) {
    if (tolti.includes(c.campo)) continue;
    const v = (valori[c.campo] ?? c.valore).trim();
    if (v !== '') nuovi[c.campo] = v;
  }
  if (sottotipo === 'dati_azienda') return { campi: nuovi, ...(typeof base.fonte === 'string' ? { fonte: base.fonte } : {}) };
  return { ...base, ...nuovi };
}

/** La persona ha cambiato qualcosa rispetto alla proposta? */
export function cambiato(sottotipo: string | null, payload: Record<string, unknown> | null, valori: Record<string, string>, tolti: string[]): boolean {
  if (tolti.length > 0) return true;
  return campiProposti(sottotipo, payload).some((c) => valori[c.campo] !== undefined && valori[c.campo].trim() !== c.valore);
}

/** Righe del gestionale nella forma dell'indice aziende, per riusare filtraAziende. */
export function indiceDaRighe(righe: RigaAzienda[]): AziendaIndice[] {
  return righe.map((r) => ({
    id: r.id,
    ragione_sociale: r.ragione_sociale,
    partita_iva: r.partita_iva,
    ateco: r.ateco,
    ateco_label: r.ateco_label,
    comune: r.comune,
    lavoratori: r.lavoratori,
    stato: r.stato,
    motivo: r.motivo,
  }));
}

/** Saluto della testata della coda. */
export function saluto(d: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('it-IT', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Rome' }).format(d));
  return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

/** Quante cose aspettano la persona: proposte e allarmi aperti, piu' i suoi compiti di oggi o in ritardo. */
export function cosaAspetta(conteggi: Record<FiltroCoda, number>, compitiOggi: { totale: number; fatti: number }): number {
  return conteggi.proposte + conteggi.allarmi + Math.max(0, compitiOggi.totale - compitiOggi.fatti);
}

/** Iniziali di una persona per i pallini degli assegnatari. */
export function iniziali(nome: string): string {
  return (
    nome
      .replace(/^(dott\.?ssa|dott\.|ing\.|geom\.|avv\.|arch\.)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** Tono del Safety Score (come la Control Room): 80 e piu' ok, 60 e piu' warn, sotto danger. */
export function tonoScore(v: number | null): TonoChip {
  if (v === null) return 'neutral';
  return v >= 80 ? 'ok' : v >= 60 ? 'warn' : 'danger';
}
