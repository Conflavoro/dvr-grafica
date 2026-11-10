/**
 * Logica pura delle sezioni di formazione, visite e amministrazione: importi,
 * durate, etichette e chip degli stati, orari delle giornate. Nessuna chiamata
 * al server: si prova con Jest.
 */

import type { StatoChip } from '@/components/portale/kit';

/** Importo in euro con la virgola e il punto delle migliaia: 1.234,50 €. */
export function euro(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'n.d.';
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
}

/** Importo con il segno per i movimenti: + 50,00 € oppure − 12,00 €. */
export function euroSegno(v: number): string {
  if (v === 0) return euro(0);
  return `${v > 0 ? '+' : '−'} ${euro(Math.abs(v))}`;
}

/** Minuti in ore e minuti: 90 diventa "1 h 30 min", 45 "45 min", 120 "2 h". */
export function durata(minuti: number): string {
  const m = Math.max(0, Math.round(minuti));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Ore e minuti dal modulo (ore 0..12, minuti a passi di 5) ai minuti, con gli errori del prototipo. */
export function minutiDaModulo(ore: number, minuti: number): { minuti: number; errore: string | null } {
  const t = Math.round((Number.isFinite(ore) ? ore : 0) * 60 + (Number.isFinite(minuti) ? minuti : 0));
  if (t <= 0) return { minuti: 0, errore: 'Indica una durata' };
  if (t > 720) return { minuti: t, errore: 'Massimo 12 ore per voce' };
  return { minuti: t, errore: null };
}

/** Orario di un posto nella giornata: inizio + posizione per passo (posizione da 0). */
export function orarioPosto(inizio: string, posizione: number, passo: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(inizio);
  if (!m) return inizio;
  const tot = Number(m[1]) * 60 + Number(m[2]) + posizione * passo;
  const h = Math.floor(tot / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

/** Lunedi' della settimana di una data, AAAA-MM-GG. */
export function lunedi(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const g = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - g);
  return d.toISOString().slice(0, 10);
}

export function spostaGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- stati e chip

type Mappa = Record<string, [StatoChip, string]>;

export const STATI_CLASSE: Mappa = {
  bozza: ['approve', 'Da confermare'],
  programmata: ['info', 'Convocazioni inviate'],
  oggi: ['run', 'Oggi in aula'],
  svolta: ['warn', 'Da chiudere'],
  chiusa: ['ok', 'Chiusa'],
  annullata: ['neutral', 'Annullata'],
};

export const STATI_CONVOCAZIONE: Mappa = {
  da_inviare: ['todo', 'Da inviare'],
  inviata: ['neutral', 'Inviata'],
  confermata: ['ok', 'Confermata'],
  tenuto: ['pay', 'Posto tenuto'],
};

export const STATI_ESITO: Mappa = {
  superata: ['ok', 'Superata'],
  non_superata: ['danger', 'Non superata'],
  non_ammesso: ['danger', 'Non ammesso, sotto il 90%'],
};

export const STATI_PREVENTIVO: Mappa = {
  bozza: ['neutral', 'Bozza'],
  inviato: ['info', 'Inviato'],
  accettato: ['warn', 'Accettato, attesa incasso'],
  pagato: ['ok', 'Pagato, avvio aperto'],
  perso: ['neutral', 'Perso'],
};

export const STATI_ORDINE: Mappa = {
  da_approvare: ['approve', 'Da approvare'],
  attesa_pagamento: ['pay', 'Da pagare'],
  in_corso: ['run', 'In corso'],
  consegnato: ['ok', 'Consegnato'],
  preventivo_richiesto: ['todo', 'Preventivo richiesto'],
  rifiutato: ['neutral', 'Rifiutato'],
  annullato: ['neutral', 'Annullato'],
};

export const STATI_POSTO: Mappa = {
  atteso: ['todo', 'Atteso'],
  arrivato: ['info', 'Arrivato'],
  visitato: ['ok', 'Visitato'],
  assente: ['danger', 'Assente'],
  annullato: ['neutral', 'Annullato'],
};

export const STATI_CONFERMA: Mappa = {
  confermato: ['ok', 'Confermato'],
  da_confermare: ['warn', 'Da confermare'],
  non_risponde: ['danger', 'Non risponde'],
  tenuta: ['pay', 'Tenuta, quota da pagare'],
};

export const STATI_CAMPIONAMENTO: Mappa = {
  richiesto: ['todo', 'Richiesto'],
  programmato: ['info', 'Programmato'],
  prelievo_fatto: ['warn', 'Prelievo fatto'],
  referto_caricato: ['approve', 'Rapporto da applicare'],
  applicato: ['ok', 'Applicato alla valutazione'],
  chiuso: ['neutral', 'Chiuso'],
};

export const STATI_FATTURA: Mappa = {
  da_pagare: ['pay', 'Da pagare'],
  in_attesa: ['warn', 'Bonifico in arrivo'],
  pagata: ['ok', 'Pagata'],
};

export const STATI_ASSENZA: Mappa = {
  da_riprogrammare: ['todo', 'Da riprogrammare gratis'],
  riprogrammata: ['ok', 'Riprogrammata gratis'],
  addebitata: ['pay', 'Addebitata'],
  annullata: ['neutral', 'Addebito annullato'],
};

export const TIPI_MOVIMENTO: Record<string, string> = {
  ricarica: 'Ricarica',
  pagamento: 'Spesa',
  omaggio: 'Crediti omaggio',
  scadenza: 'Scadenza crediti',
  rimborso: 'Rimborso',
  rettifica: 'Rettifica',
};

export const MODALITA: Record<string, string> = { aula: 'Aula', videoconferenza: 'Videoconferenza sincrona', elearning: 'E-learning' };

export const FASI_ORE: Record<string, string> = {
  avvio: 'Avvio',
  dvr_documenti: 'DVR e documenti',
  sopralluogo: 'Sopralluogo',
  formazione: 'Formazione',
  visite: 'Visite',
  scadenze: 'Scadenze e promemoria',
  assistenza: 'Assistenza al cliente',
  pronto_ispezioni: 'Pronto Ispezioni',
  amministrazione: 'Amministrazione',
};

/** Chip di uno stato da una mappa, con un ripiego neutro leggibile. */
export function chip(mappa: Mappa, stato: string | null | undefined): [StatoChip, string] {
  if (!stato) return ['neutral', 'n.d.'];
  return mappa[stato] ?? ['neutral', stato.replace(/_/g, ' ')];
}

/** Stato della classe con "oggi in aula" calcolato. */
export function statoClasse(stato: string, oggi: boolean): [StatoChip, string] {
  return stato === 'programmata' && oggi ? STATI_CLASSE.oggi : chip(STATI_CLASSE, stato);
}

/** Modalita' ammesse per un corso del catalogo, nell'ordine aula, video, e-learning. */
export function modalitaAmmesse(corsi: Array<{ tipo: string; modalita: string[] }>, tipo: string): string[] {
  const c = corsi.find((x) => x.tipo === tipo);
  if (!c) return [];
  return ['aula', 'videoconferenza', 'elearning'].filter((m) => c.modalita.includes(m));
}

/** Esito che il registro dara' a una presenza: sotto il 90% non si accede alla verifica. */
export function esitoPresenza(presenza: number, esito: 'superata' | 'non_superata'): 'superata' | 'non_superata' | 'non_ammesso' {
  return presenza < 90 ? 'non_ammesso' : esito;
}

/** Barra a due colori del wallet: quota dei fondi e dei crediti sul totale (percentuali intere). */
export function quoteWallet(fondi: number, omaggio: number): { fondi: number; omaggio: number } {
  const f = Math.max(0, fondi);
  const o = Math.max(0, omaggio);
  const t = f + o;
  if (t <= 0) return { fondi: 0, omaggio: 0 };
  const pf = Math.round((f / t) * 100);
  return { fondi: pf, omaggio: 100 - pf };
}

/** Importo dal campo di testo (accetta la virgola): 12,50 diventa 12.5. */
export function importoDaTesto(v: string): number | null {
  const t = v.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (t === '' || !/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}
