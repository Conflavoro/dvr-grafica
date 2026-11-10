/**
 * Regole del foglio d'ordine dei servizi lato interfaccia (regole 11.4): gli
 * stessi testi d'errore del server, per avvisare subito al passo giusto.
 * Il server ricontrolla tutto.
 */
import type { LavoratoreOrdine, StatoOrdine } from './servizi-api';
import type { StatoChip } from '@/components/portale/kit';

export const STATI_ORDINE: Record<string, { chip: StatoChip; testo: string; breve: string }> = {
  da_approvare: { chip: 'approve', testo: 'Da approvare', breve: 'Da approvare' },
  in_corso: { chip: 'run', testo: 'In corso', breve: 'In corso' },
  attesa_bonifico: { chip: 'warn', testo: 'In attesa del bonifico', breve: 'Attesa bonifico' },
  consegnato: { chip: 'ok', testo: 'Consegnato', breve: 'Consegnato' },
  preventivo_richiesto: { chip: 'todo', testo: 'Preventivo richiesto', breve: 'Preventivo richiesto' },
  rifiutato: { chip: 'neutral', testo: 'Rifiutato', breve: 'Rifiutato' },
  attesa_pagamento: { chip: 'pay', testo: 'Da pagare', breve: 'Da pagare' },
};

export const statoOrdine = (s: StatoOrdine, breve = false): { chip: StatoChip; testo: string } => {
  const x = STATI_ORDINE[s] ?? { chip: 'neutral' as StatoChip, testo: s, breve: s };
  return { chip: x.chip, testo: breve ? x.breve : x.testo };
};

export const PASSI_CANTIERE = ['Cantiere', 'Lavoratori', 'Documenti', 'Riepilogo'] as const;
export const DOMANDE_CANTIERE = ['Dov\'è il cantiere?', 'Chi lavora nel cantiere?', 'Documenti del cantiere', 'Riepilogo'] as const;

export interface DatiCantiere {
  indirizzo: string;
  committente: string;
  inizio: string;
  fine: string;
  attivita: string;
  lavoratori: number[];
  procedi: boolean;
  pscModo: 'link' | 'io';
  pscFile: File | null;
  pscRichiestaId: number | null;
  ponteggio: string;
  libretto: File | null;
}

export const cantiereVuoto = (): DatiCantiere => ({
  indirizzo: '', committente: '', inizio: '', fine: '', attivita: '', lavoratori: [], procedi: false,
  pscModo: 'link', pscFile: null, pscRichiestaId: null, ponteggio: '', libretto: null,
});

/** Errori del passo (0..3); "Indietro" non controlla. */
export function erroriPasso(passo: number, d: DatiCantiere, conPimus: boolean, lavoratori: LavoratoreOrdine[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (passo === 0) {
    if (!d.indirizzo.trim()) e.indirizzo = 'Scrivi l\'indirizzo del cantiere.';
    if (!d.committente.trim()) e.committente = 'Scrivi chi è il committente.';
    if (!d.inizio) e.inizio = 'Indica quando iniziano i lavori.';
    if (!d.fine) e.fine = 'Indica quando finiscono, anche indicativamente.';
    else if (d.inizio && d.fine < d.inizio) e.fine = 'La fine dei lavori è prima dell\'inizio.';
    if (!d.attivita.trim()) e.attivita = 'Descrivi in breve cosa fate in cantiere.';
  }
  if (passo === 1) {
    if (d.lavoratori.length === 0) e.lavoratori = 'Scegli almeno un lavoratore.';
    else if (bloccati(lavoratori, d.lavoratori).length > 0 && !d.procedi) e.lavoratori = 'Togli i lavoratori non in regola oppure conferma che vuoi procedere.';
  }
  if (passo === 2) {
    if (d.pscModo === 'io' && !d.pscFile) e.psc = 'Carica il PSC, oppure scegli «Lo carica il coordinatore».';
    if (conPimus && !d.ponteggio.trim()) e.ponteggio = 'Indica marca e modello del ponteggio.';
    if (conPimus && !d.libretto) e.libretto = 'Carica il libretto del ponteggio.';
  }
  return e;
}

export const bloccati = (tutti: LavoratoreOrdine[], scelti: number[]): LavoratoreOrdine[] => tutti.filter((l) => scelti.includes(l.id) && l.esito === 'blocco');
export const conAvvisi = (tutti: LavoratoreOrdine[], scelti: number[]): LavoratoreOrdine[] => tutti.filter((l) => scelti.includes(l.id) && l.esito === 'avviso');

/** "1 lavoratore non può entrare in cantiere" / "N lavoratori non possono entrare in cantiere". */
export const titoloBloccati = (n: number): string => (n === 1 ? '1 lavoratore non può entrare in cantiere' : `${n} lavoratori non possono entrare in cantiere`);

export const prefissoCantiere = (servizio: string): string => (servizio === 'pimus' ? 'PiMUS' : servizio === 'pos_pimus' ? 'POS e PiMUS' : 'POS');

export const euroIt = (v: number): string => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export const conPimus = (servizio: string): boolean => servizio === 'pimus' || servizio === 'pos_pimus';

/** Persone o test: "1 persona", "2 persone". */
export const quante = (n: number, uno: string, molti: string): string => `${n} ${n === 1 ? uno : molti}`;
