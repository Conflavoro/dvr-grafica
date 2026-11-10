/**
 * TypeScript types per il DVR e le entità correlate.
 * Corrispondono ai Pydantic schemas del backend.
 */

export type StatoDVR = 'bozza' | 'in_compilazione' | 'completo' | 'in_generazione' | 'documento_generato' | 'finale' | 'da_revisionare' | 'scaduto'
export type TipoDVR = 'standard' | 'standardizzato'
export type LivelloRischio = 'basso' | 'medio' | 'alto' | 'molto_alto'
export type PrioritaIntervento = 'alta' | 'media' | 'bassa'
export type StatoIntervento = 'da_avviare' | 'in_corso' | 'completato'

export interface Azienda {
  id: string
  ragione_sociale: string
  partita_iva: string
  codice_ateco: string
  codice_ateco_descrizione?: string
  indirizzo_sede_legale: string
  numero_lavoratori_totale: number
  descrizione_attivita?: string
  settore_macrosettore?: string
}

export interface DVR {
  id: string
  azienda_id: string
  tipo: TipoDVR
  stato: StatoDVR
  versione: number
  step_corrente: number
  wizard_completato: boolean
  data_redazione?: string
  documento_word_url?: string
  documento_pdf_url?: string
}

export interface ValutazioneRischio {
  id: string
  categoria: string
  nome_rischio: string
  presente: boolean
  probabilita?: number   // 1-4
  gravita?: number       // 1-4
  rischio_calcolato?: number  // P × G
  livello_rischio?: LivelloRischio
  misure_tecniche: string[]
  misure_organizzative: string[]
  dpi_assegnati: DPIAssegnato[]
  suggerito_da_ai: boolean
}

export interface DPIAssegnato {
  tipo: string
  descrizione: string
  norma_en: string
  frequenza_sostituzione?: string
}

export interface PianoMiglioramento {
  id: string
  descrizione_intervento: string
  rischio_correlato?: string
  priorita: PrioritaIntervento
  responsabile?: string
  scadenza?: string
  stato: StatoIntervento
}
