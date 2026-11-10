/**
 * Logica di presentazione della Scrivania del DVR, senza React: stati, avanzamento,
 * regole sui pulsanti, livelli di rischio, cosa ricaricare dopo un evento.
 * I componenti leggono da qui, cosi' la grafica si puo' cambiare senza toccare le regole.
 */

import type { Role } from '@/lib/data-source';
import type { Cella, Controlli, Controllo, Documento, EventoFlusso, Paragrafo, Sezione, VoceIndice } from './tipi';

// ---------------------------------------------------------------- toni e stati

/** Toni allineati alle chip del kit del portale. */
export type Tono = 'ok' | 'warn' | 'danger' | 'info' | 'run' | 'sign' | 'todo' | 'neutral';

interface Etichetta {
  testo: string;
  tono: Tono;
}

/** Un valore sconosciuto diventa leggibile e neutro (regola del contratto). */
const leggibile = (v: string) => {
  const t = v.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Stato sconosciuto';
};

const STATO_LAVORO: Record<string, Etichetta> = {
  in_preparazione: { testo: "L'assistente sta preparando", tono: 'run' },
  bozza: { testo: 'Bozza', tono: 'todo' },
  in_revisione: { testo: 'In revisione', tono: 'info' },
  pronto_da_firmare: { testo: 'Pronto da firmare', tono: 'sign' },
  emesso: { testo: 'Emesso', tono: 'ok' },
  da_aggiornare: { testo: 'Da aggiornare', tono: 'warn' },
};

const STATO_SEZIONE: Record<string, Etichetta> = {
  completo: { testo: 'Chiusa', tono: 'ok' },
  bozza_assistente: { testo: 'Da accettare', tono: 'todo' },
  da_rivedere: { testo: 'Da rivedere', tono: 'warn' },
  in_preparazione: { testo: 'In preparazione', tono: 'run' },
  non_applicabile: { testo: 'Non applicabile', tono: 'neutral' },
};

const STATO_PARAGRAFO: Record<string, Etichetta> = {
  in_preparazione: { testo: 'In preparazione', tono: 'run' },
  proposto: { testo: "Proposto dall'assistente", tono: 'todo' },
  accettato: { testo: 'Accettato', tono: 'ok' },
  da_rivedere: { testo: 'Nuova proposta da rivedere', tono: 'warn' },
  non_applicabile: { testo: 'Non applicabile', tono: 'neutral' },
};

const etichetta = (mappa: Record<string, Etichetta>, v: string): Etichetta => mappa[v] ?? { testo: leggibile(v), tono: 'neutral' };

export const statoLavoro = (v: string) => etichetta(STATO_LAVORO, v);
export const statoSezione = (v: string) => etichetta(STATO_SEZIONE, v);
export const statoParagrafo = (v: string) => etichetta(STATO_PARAGRAFO, v);

export const sezioneChiusa = (v: VoceIndice | { stato: string }) => v.stato === 'completo' || v.stato === 'non_applicabile';

// ---------------------------------------------------------------- indice e avanzamento

export const eAllegato = (chiave: string) => /^allegato/i.test(chiave);

export function divisioneIndice(indice: VoceIndice[]): { capitoli: VoceIndice[]; allegati: VoceIndice[] } {
  return { capitoli: indice.filter((v) => !eAllegato(v.chiave)), allegati: indice.filter((v) => eAllegato(v.chiave)) };
}

export function avanzamento(indice: VoceIndice[]): { chiusi: number; totale: number; percento: number } {
  const totale = indice.length;
  const chiusi = indice.filter(sezioneChiusa).length;
  return { chiusi, totale, percento: totale === 0 ? 0 : Math.round((chiusi / totale) * 100) };
}

export const testoAvanzamento = (a: { chiusi: number; totale: number }) => `${a.chiusi} di ${a.totale} chiusi`;

/** Prima sezione ancora da chiudere dopo quella indicata (poi dall'inizio); null se tutto chiuso. */
export function prossimaAperta(indice: VoceIndice[], dopo: string | null): string | null {
  const i = dopo ? indice.findIndex((v) => v.chiave === dopo) : -1;
  const giro = [...indice.slice(i + 1), ...indice.slice(0, i + 1)];
  return giro.find((v) => !sezioneChiusa(v) && v.chiave !== dopo)?.chiave ?? null;
}

/** Sezione da aprire all'arrivo: quella chiesta se esiste, altrimenti la prima da lavorare. */
export function sezioneIniziale(indice: VoceIndice[], chiesta: string | null): string | null {
  if (chiesta && indice.some((v) => v.chiave === chiesta)) return chiesta;
  return indice.find((v) => !sezioneChiusa(v))?.chiave ?? indice[0]?.chiave ?? null;
}

// ---------------------------------------------------------------- banner

const intero = new Intl.NumberFormat('it-IT');

/** Frase del banner scuro: cosa ha preparato l'assistente, in italiano normale. */
export function fraseBanner(d: Documento): string {
  const b = d.banner;
  const totali = b.paragrafiAssistente + b.paragrafiUmani;
  const parti: string[] = [];
  if (totali === 0) return "L'assistente non ha ancora scritto paragrafi per questo documento.";
  parti.push(
    b.paragrafiAssistente === 1
      ? "L'assistente ha preparato 1 paragrafo"
      : `L'assistente ha preparato ${intero.format(b.paragrafiAssistente)} paragrafi`,
  );
  const extra: string[] = [];
  if (b.rischiValutati) extra.push(b.rischiValutati === 1 ? '1 rischio valutato' : `${intero.format(b.rischiValutati)} rischi valutati`);
  if (b.citazioni) extra.push(b.citazioni === 1 ? '1 citazione di legge' : `${intero.format(b.citazioni)} citazioni di legge`);
  let frase = parti[0];
  if (extra.length) frase += `, con ${extra.join(' e ')}`;
  frase += '.';
  if (b.paragrafiUmani > 0) frase += b.paragrafiUmani === 1 ? ' Un paragrafo è già scritto da una persona.' : ` ${intero.format(b.paragrafiUmani)} paragrafi sono già scritti da una persona.`;
  return frase;
}

const FASI: Record<string, string> = {
  generazione_completa: 'sta scrivendo la prima bozza',
  redazione: 'sta riscrivendo',
};

/** Riga dei lavori in corso: "L'assistente sta riscrivendo la sezione 22". */
export function fraseLavori(d: Documento): string | null {
  if (d.lavoriInCorso.length > 0) {
    const l = d.lavoriInCorso[0];
    const cosa = FASI[l.fase] ?? 'sta lavorando';
    const titolo = l.sezione ? d.indice.find((v) => v.chiave === l.sezione)?.titolo : null;
    return `L'assistente ${cosa}${l.sezione ? ` la sezione ${l.sezione}${titolo ? `, ${titolo}` : ''}` : ''}.`;
  }
  const budget = d.lavoriInAttesa.filter((l) => l.stato === 'in_attesa_budget').length;
  if (budget > 0) return budget === 1 ? 'Un aggiornamento è fermo per il tetto di spesa dello studio.' : `${budget} aggiornamenti sono fermi per il tetto di spesa dello studio.`;
  const attesa = d.lavoriInAttesa.length;
  if (attesa > 0) return attesa === 1 ? 'Un aggiornamento è in coda e partirà a breve.' : `${attesa} aggiornamenti sono in coda e partiranno a breve.`;
  return null;
}

// ---------------------------------------------------------------- ruoli

const STUDIO: Role[] = ['consulente', 'titolare_studio', 'admin_conflavoro'];
const APPROVA: Role[] = ['titolare_studio', 'admin_conflavoro'];

/** Le bozze dell'assistente sono lavoro dello studio: il lato azienda non le vede (OQ-4). */
export const vedeBozze = (r: Role | null | undefined) => !!r && STUDIO.includes(r);
/** Accettare non è approvare: approva solo il titolare (OQ-8). */
export const puoApprovare = (r: Role | null | undefined) => !!r && APPROVA.includes(r);

// ---------------------------------------------------------------- paragrafi e sezione

export const puo = (p: Paragrafo, a: Paragrafo['azioni'][number]) => p.azioni.includes(a);

/** Testo e proposta affiancati: c'e' un testo in vigore e accanto una proposta nuova. */
export const affiancati = (p: Paragrafo) => p.accettata !== null && p.proposta !== null;

/** Testo da mostrare come principale: la proposta se c'e', altrimenti il testo in vigore. */
export const testoPrincipale = (p: Paragrafo) => p.proposta ?? p.accettata;

export const bloccantiAperti = (c: Controlli | null, sezione?: string | null): Controllo[] =>
  (c?.bloccanti ?? []).filter((x) => x.stato === 'aperto' && (sezione === undefined || x.sezione === sezione));

export function accettaSezione(s: Sezione | null, c: Controlli | null): { visibile: boolean; attivo: boolean; motivo: string | null } {
  if (!s) return { visibile: false, attivo: false, motivo: null };
  const daAccettare = s.elenco.filter((p) => puo(p, 'accetta')).length;
  const visibile = s.elenco.some((p) => p.azioni.length > 0);
  if (!visibile) return { visibile, attivo: false, motivo: null };
  const b = bloccantiAperti(c, s.chiave).length;
  if (b > 0) return { visibile, attivo: false, motivo: b === 1 ? 'C’è un controllo bloccante aperto su questa sezione: va risolto prima.' : `Ci sono ${b} controlli bloccanti aperti su questa sezione: vanno risolti prima.` };
  if (daAccettare === 0) return { visibile, attivo: false, motivo: 'Non ci sono proposte da accettare in questa sezione.' };
  return { visibile, attivo: true, motivo: null };
}

export const MIN_MOTIVO = 5;
export const motivoValido = (m: string) => m.trim().length >= MIN_MOTIVO;
export const istruzioneValida = (m: string) => m.trim().length >= 3;

export function etichettaOrigine(o: string): string {
  return o === 'umano' ? 'Scritto da una persona' : o === 'ai' ? "Proposto dall'assistente" : leggibile(o);
}

// ---------------------------------------------------------------- tabelle

export type LivelloRischio = 'basso' | 'medio' | 'alto' | 'molto_alto';

/** Livello dal testo del backend o, in mancanza, dal valore R (classificazione unica del DVR). */
export function livelloRischio(livello: Cella, r?: Cella): LivelloRischio | null {
  if (typeof livello === 'string') {
    const l = livello.toLowerCase().replace(/[\s-]+/g, '_');
    if (l === 'molto_alto' || l === 'altissimo' || l === 'critico') return 'molto_alto';
    if (l === 'alto' || l === 'basso' || l === 'medio') return l;
    if (l === 'trascurabile' || l === 'accettabile') return 'basso';
  }
  const v = typeof r === 'number' ? r : null;
  if (v === null || v <= 0) return null;
  if (v <= 2) return 'basso';
  if (v <= 4) return 'medio';
  if (v <= 8) return 'alto';
  return 'molto_alto';
}

export const TESTO_LIVELLO: Record<LivelloRischio, string> = { basso: 'Basso', medio: 'Medio', alto: 'Alto', molto_alto: 'Molto alto' };

export function testoCella(c: Cella): string {
  if (c === null || c === undefined) return '';
  if (Array.isArray(c)) return c.join(', ');
  if (typeof c === 'boolean') return c ? 'Sì' : 'No';
  return typeof c === 'number' ? intero.format(c) : c;
}

/** Colonne corte e numeriche (P, D, R) che vanno sulla stessa riga del livello. */
export function colonneNumeriche(t: { colonne: Array<{ chiave: string; etichetta: string }>; righe: Array<Record<string, Cella>> }): string[] {
  return t.colonne
    .filter((c) => c.chiave !== 'livello' && t.righe.length > 0 && t.righe.every((r) => r[c.chiave] === null || typeof r[c.chiave] === 'number'))
    .map((c) => c.chiave);
}

// ---------------------------------------------------------------- flusso

export interface Ricarica {
  documento: boolean;
  sezione: boolean;
  controlli: boolean;
}

/**
 * Cosa ricaricare dopo un giro del flusso. Eventi di altri documenti si ignorano;
 * eventi senza riferimento al documento valgono per tutti (meglio una lettura in piu').
 */
export function daRicaricare(eventi: EventoFlusso[], ctx: { tipo: string; id: number; sezione: string | null }): Ricarica {
  const nostri = eventi.filter((e) => e.documentoId === null || (e.documentoId === ctx.id && (e.documentoTipo === null || e.documentoTipo === ctx.tipo)));
  if (nostri.length === 0) return { documento: false, sezione: false, controlli: false };
  const sezione = nostri.some((e) => e.sezione === null || e.sezione === ctx.sezione);
  const controlli = nostri.some((e) => /controll/i.test(e.tipo) || e.sezione === null || e.sezione === ctx.sezione);
  return { documento: true, sezione, controlli };
}
