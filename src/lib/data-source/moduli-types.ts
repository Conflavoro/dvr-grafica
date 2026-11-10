// Tipi dei moduli arrivati dopo la Control Room: valutazioni specifiche,
// documenti HSE (DUVRI, PiMUS, HACCP, emergenza, verbali, nomine, procedure,
// radon), qualita' dei documenti, modello Nube 81 e Portale HSE (scheda di
// avvio, coda di lavoro, cruscotto, nuovo assunto, promemoria, condivisioni).
//
// La forma grezza sta in apps/backend-laravel/app/Services/Agent/Pannelli.php
// e nei metodi pannello() dei file *Strumenti.php; qui c'e' la forma gia'
// normalizzata da moduli-mappers.ts, sempre completa.

/** Colore di un esito: valutazioni (verde, giallo, arancio, rosso, viola) e controlli. */
export type ColoreEsito = 'verde' | 'giallo' | 'arancio' | 'rosso' | 'viola' | 'grigio';

/** Esito di un controllo dei documenti: blocca (rosso), corregge (giallo), avvisa (grigio). */
export interface SegnalazioneDocumento {
  chiave: string;
  esito: 'blocca' | 'corregge' | 'avvisa';
  messaggio: string;
  riferimento: string;
  accettabile: boolean;
  accettata: boolean;
}

export interface ConteggiControllo {
  blocca: number;
  corregge: number;
  avvisa: number;
}

/** Riga di risultato di una valutazione: per mansione, gruppo o impianto. */
export interface RigaValutazione {
  voce: string;
  valore: string;
  esito: string;
  colore: ColoreEsito;
}

export interface EsitoValutazione {
  testo: string;
  colore: ColoreEsito;
  livello: number | null;
}

/** Tipi dei documenti HSE gestiti dal framework di app/Services/Documenti. */
export type TipoDocumentoHse = 'duvri' | 'pimus' | 'haccp' | 'emergenza' | 'sopralluogo' | 'riunione' | 'nomina' | 'procedura' | 'radon';

export interface DocumentoHseVoce {
  documento_id: number;
  tipo: string;
  titolo: string | null;
  azienda: string | null;
  stato: string | null;
  revisione: number | null;
  puo_emettere: boolean | null;
  conteggi: ConteggiControllo | null;
}

export interface ValutazioneVoce {
  valutazione_id: number;
  azienda_id: number | null;
  azienda: string | null;
  tipo: string;
  nome: string;
  stato: string | null;
  revisione: number | null;
  esito: string | null;
  colore: ColoreEsito | null;
  puo_emettere: boolean | null;
}

export interface QualitaComponente {
  chiave: string;
  nome: string;
  punti: number | null;
  max: number;
  dettaglio: string;
}

export interface RiferimentoSuperato {
  titolo: string;
  trovato: string;
  sostituito_da: string;
  messaggio: string;
  esito: string;
}

export interface DocumentoDaAggiornare {
  tipo: string;
  documento_id: number;
  revisione: number | null;
  azienda: string | null;
  emesso_il: string | null;
  motivi: string[];
}

export interface NominaVoce {
  documento_id: number | null;
  atto: string;
  nome: string;
  attiva: boolean;
  stato: string | null;
  revisione: number | null;
}

// ---------------------------------------------------------------- Portale HSE

export type StatoPasso = 'fatto' | 'in_corso' | 'da_fare' | 'in_attesa';

export interface PassoAvvio {
  numero: number;
  nome: string;
  stato: StatoPasso;
  /** Righe di dettaglio gia' in italiano (documenti letti, dati da confermare, mancanti, utenti). */
  dettagli: string[];
  nota: string | null;
  /** Dati letti dai documenti da confermare (proposte della coda). */
  da_confermare: Array<{ proposta_id: number; titolo: string }>;
}

export type StatoProposta = 'in_attesa' | 'approvata' | 'respinta' | 'errore';
export type TipoProposta = 'dati_azienda' | 'scadenza' | 'lavoratore' | 'servizio' | 'attivita';

export interface PropostaAgenteVoce {
  id: number;
  azienda_id: number | null;
  tipo: TipoProposta | string;
  titolo: string;
  motivo: string | null;
  origine: string;
  stato: StatoProposta;
  creata_il: string | null;
  /** Dettaglio leggibile del contenuto (campi, importo, data...). */
  dettaglio: string[];
  errore: string | null;
}

export interface AllarmeCoda {
  chiave: string;
  testo: string;
  numero: number;
  livello: 'rosso' | 'ambra';
}

export interface IndicatoreCruscotto {
  codice: string;
  nome: string;
  valore: number | null;
  unita: string;
  base: number | null;
  obiettivo: number | null;
  soglia: number | null;
  stato: 'verde' | 'ambra' | 'rosso' | 'n_d';
  come: string;
}

export interface PassoPromemoria {
  passo: string;
  nome: string;
  previsto_il: string | null;
  esito: string;
  canale: string | null;
  errore: string | null;
  testo: string | null;
}

export interface CondivisioneVoce {
  id: number;
  destinatario: string;
  motivo: string | null;
  cartelle: string[];
  scade_il: string | null;
  valida: boolean;
  revocata: boolean;
  accessi: number;
}

export interface VoceDaFare {
  tipo: string;
  id: number;
  testo: string;
  azione: string | null;
  quando: string | null;
  importo: string | null;
}

/** Pannelli dei moduli nuovi (unione inclusa in Pannello). */
export type PannelloModuli =
  | {
      tipo: 'valutazione';
      chiave: string;
      valutazione_id: number;
      azienda_id: number | null;
      tipo_valutazione: string;
      nome: string;
      stato: string | null;
      revisione: number | null;
      esito: EsitoValutazione | null;
      righe: RigaValutazione[];
      puo_emettere: boolean | null;
      conteggi: ConteggiControllo | null;
      segnalazioni: SegnalazioneDocumento[];
    }
  | { tipo: 'valutazioni'; chiave: string; azienda_id: number | null; valutazioni: ValutazioneVoce[] }
  | {
      tipo: 'documento_hse';
      chiave: string;
      documento_id: number;
      tipo_documento: string;
      titolo: string | null;
      stato: string | null;
      revisione: number | null;
      puo_emettere: boolean | null;
      conteggi: ConteggiControllo | null;
      segnalazioni: SegnalazioneDocumento[];
    }
  | { tipo: 'documenti_hse'; chiave: string; documenti: DocumentoHseVoce[] }
  | {
      tipo: 'qualita';
      chiave: string;
      documento_id: number | null;
      tipo_documento: string | null;
      titolo: string | null;
      punteggio: number | null;
      livello: string | null;
      pronto_per_revisione: boolean | null;
      colore: 'verde' | 'giallo' | 'rosso';
      componenti: QualitaComponente[];
      riferimenti_superati: RiferimentoSuperato[];
      miglioramenti: Array<{ azione: string; guadagno: number | null }>;
    }
  | { tipo: 'riferimenti'; chiave: string; riferimenti: RiferimentoSuperato[] }
  | { tipo: 'aggiornamenti'; chiave: string; azienda_id: number | null; documenti: DocumentoDaAggiornare[] }
  | {
      tipo: 'nube81';
      chiave: string;
      azienda_id: number | null;
      modello: string | null;
      compilati: number;
      mancanti: string[];
      da_aggiungere_a_nube: string[];
      riferimenti_superati: number;
      link: string | null;
      avvisi: string[];
    }
  | { tipo: 'nomine'; chiave: string; azienda_id: number | null; nomine: NominaVoce[]; mancanti: string[] }
  | {
      tipo: 'radon_calcolo';
      chiave: string;
      media: number | null;
      incertezza: number | null;
      /** true se la media supera il livello di riferimento di 300 Bq/m3. */
      sopra: boolean | null;
      giorni: number | null;
      scadenze: Array<{ voce: string; data: string }>;
    }
  | {
      tipo: 'scheda_avvio';
      chiave: string;
      azienda_id: number | null;
      passi: PassoAvvio[];
      in_ritardo: boolean;
      note: string[];
    }
  | {
      tipo: 'coda_lavoro';
      chiave: string;
      azienda_id: number | null;
      proposte: PropostaAgenteVoce[];
      fatto_oggi: { approvate: number; respinte: number } | null;
      allarmi: AllarmeCoda[];
    }
  | {
      tipo: 'cruscotto';
      chiave: string;
      indicatori: IndicatoreCruscotto[];
      agenti: { proposte_oggi: number | null; in_attesa: number | null; approvate_su_decise: number | null; costo_ai_mese_eur: number | null } | null;
    }
  | {
      tipo: 'nuovo_assunto';
      chiave: string;
      azienda_id: number | null;
      lavoratore: { nome: string; mansione: string; data_assunzione: string | null; rischio: string | null; sorveglianza: boolean } | null;
      quota: { importo: string | null; stato: string | null; descrizione: string | null } | null;
      scadenze: Array<{ id: number; descrizione: string; stato_prenotazione: string | null }>;
    }
  | {
      tipo: 'promemoria';
      chiave: string;
      azienda_id: number | null;
      visita: { descrizione: string; appuntamento_il: string | null; luogo: string | null; confermata: boolean } | null;
      passi: PassoPromemoria[];
    }
  | { tipo: 'condivisioni'; chiave: string; azienda_id: number | null; condivisioni: CondivisioneVoce[] }
  | {
      tipo: 'da_fare';
      chiave: string;
      azienda_id: number | null;
      conteggi: Record<string, number>;
      totale_da_pagare: string | null;
      voci: VoceDaFare[];
    }
  | {
      tipo: 'cartelle';
      chiave: string;
      azienda_id: number | null;
      cartelle: Array<{ chiave: string; nome: string; documenti: number }>;
      da_classificare: number;
    };

// ---------------------------------------------------------------- Tavolo: documenti dell'azienda

/** Da dove viene un documento dell'elenco unico: decide come si scarica. */
export type OrigineDocumento = 'dvr' | 'pos' | 'valutazione' | 'hse';

export interface DocumentoAzienda {
  /** Chiave unica nell'elenco (origine:id). */
  chiave: string;
  origine: OrigineDocumento;
  id: number;
  /** dvr, pos, rumore, vibrazioni..., duvri, pimus, haccp, emergenza... */
  tipo: string;
  titolo: string;
  /** Stato del backend (draft, bozza, pronto, pronta, emesso, emessa, approved...). */
  stato: string | null;
  revisione: number | null;
  aggiornato: string | null;
  puo_emettere: boolean | null;
  conteggi: ConteggiControllo | null;
  /** Solo valutazioni: esito complessivo. */
  esito: EsitoValutazione | null;
}

export interface ElencoDocumentiAzienda {
  documenti: DocumentoAzienda[];
  /** Fonti non lette (es. un elenco non disponibile): l'elenco resta utilizzabile. */
  avvisi: string[];
}

export interface DocumentiHseDataSource {
  /** Tutti i documenti dell'azienda: DVR, POS, valutazioni specifiche e documenti HSE. */
  elenco(companyId: number): Promise<ElencoDocumentiAzienda>;
  /** Scarica l'ultima revisione (o la bozza se non c'e' revisione emessa). */
  scarica(origine: OrigineDocumento, id: number, formato: 'pdf' | 'docx'): Promise<void>;
}

export interface CodaDataSource {
  /** Approva o respinge una proposta della coda di lavoro. */
  decidi(id: number, decisione: 'approva' | 'respingi', nota?: string): Promise<PropostaAgenteVoce>;
}
