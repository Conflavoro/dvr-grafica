/**
 * Tipi della Scrivania del DVR, letti dal contratto cowork.v1
 * (docs/integrazioni/COWORK_API.md, ADR-011 D7).
 *
 * I valori enumerati restano stringhe: il contratto dice che possono arrivarne di
 * nuovi e che l'interfaccia non deve rompersi. I componenti traducono i valori noti
 * e mostrano come neutro quelli sconosciuti.
 */

export const CONTRATTO = 'cowork.v1';

/** in_preparazione, bozza, in_revisione, pronto_da_firmare, emesso, da_aggiornare. */
export type StatoLavoro = string;
/** in_preparazione, proposto, accettato, da_rivedere, non_applicabile. */
export type StatoParagrafo = string;
/** completo, bozza_assistente, da_rivedere, in_preparazione, non_applicabile. */
export type StatoSezione = string;

export type AzioneParagrafo = 'accetta' | 'modifica' | 'riscrivi' | 'rigenera' | 'non_applicabile';

export interface Fonte {
  tipo: string;
  id: number | null;
  etichetta: string;
  estratto: string | null;
}

export interface Tecnico {
  id: number;
  nome: string;
}

export interface Testata {
  tipo: string;
  id: number;
  aziendaId: number | null;
  titolo: string;
  versione: number | null;
  stato: StatoLavoro;
  statoDocumento: string;
  revisione: number | null;
  tecnico: Tecnico | null;
  oreSulDocumento: number | null;
  livello: number | null;
  aggiornatoIl: string | null;
}

export interface Banner {
  paragrafiAssistente: number;
  paragrafiUmani: number;
  rischiValutati: number | null;
  citazioni: number | null;
  generatoIl: string | null;
  fonti: Fonte[];
}

export interface Conteggio {
  totali: number;
  chiusi: number;
}

export interface VoceIndice {
  chiave: string;
  titolo: string;
  ordine: number;
  stato: StatoSezione;
  paragrafi: Conteggio;
  motivo: string | null;
}

export interface ContaControlli {
  bloccanti: number;
  avvisi: number;
  info: number;
}

export interface Lavoro {
  sezione: string | null;
  fase: string;
  da: string | null;
}

export interface LavoroInAttesa {
  sezione: string | null;
  stato: string;
  priorita: string | null;
  prontoDal: string | null;
  eventi: number;
}

export interface Documento {
  testata: Testata;
  banner: Banner;
  indice: VoceIndice[];
  controlli: ContaControlli;
  lavoriInCorso: Lavoro[];
  lavoriInAttesa: LavoroInAttesa[];
  /** Cursore del flusso, se il backend lo manda gia' con il documento (ADR-011 sez. 6). */
  cursore: string | null;
}

export interface Versione {
  id: number;
  versione: number;
  testo: string;
  origine: 'ai' | 'umano' | string;
  istruzione: string | null;
  autoreId: number | null;
  revisione: number | null;
  fonti: Fonte[];
  creataIl: string | null;
}

export interface RigaConfronto {
  op: '=' | '-' | '+';
  testo: string;
}

export interface Paragrafo {
  id: number;
  chiave: string;
  sezione: string;
  ordine: number;
  tipo: string;
  stato: StatoParagrafo;
  motivo: string | null;
  versioneBase: number;
  accettata: Versione | null;
  proposta: Versione | null;
  confronto: RigaConfronto[] | null;
  azioni: AzioneParagrafo[];
}

export interface Colonna {
  chiave: string;
  etichetta: string;
}

export type Cella = string | number | boolean | null | Array<string | number>;

export interface Tabella {
  chiave: string;
  titolo: string;
  origine: string;
  colonne: Colonna[];
  righe: Array<Record<string, Cella>>;
}

export interface Sezione {
  chiave: string;
  titolo: string;
  stato: StatoSezione;
  paragrafi: Conteggio;
  elenco: Paragrafo[];
  tabelle: Tabella[];
}

export interface AzioneSuggerita {
  strumento: string;
  etichetta: string;
  argomenti: Record<string, unknown>;
}

export interface Controllo {
  id: number;
  regola: string;
  livello: 'bloccante' | 'avviso' | 'info' | string;
  stato: 'aperto' | 'accettato' | string;
  messaggio: string;
  riferimento: string | null;
  sezione: string | null;
  paragrafoId: number | null;
  azione: AzioneSuggerita | null;
  motivo: string | null;
  fonte: string | null;
  accettatoIl: string | null;
  azioni: Array<'esegui' | 'accetta' | string>;
}

export interface Controlli {
  bloccanti: Controllo[];
  avvisi: Controllo[];
  info: Controllo[];
}

/** Voce del flusso dei cambiamenti (fase 7): forma tollerante, si usano solo i riferimenti. */
export interface EventoFlusso {
  tipo: string;
  documentoTipo: string | null;
  documentoId: number | null;
  sezione: string | null;
  paragrafoId: number | null;
}

export interface DocumentoAzienda {
  tipo: string;
  id: number;
  titolo: string;
  versione: number | null;
  stato: StatoLavoro;
  statoDocumento: string;
  revisione: number | null;
  paragrafi: { totali: number; proposti: number; accettati: number; daRivedere: number; inPreparazione: number; nonApplicabili: number };
  controlli: ContaControlli;
  aggiornatoIl: string | null;
}
