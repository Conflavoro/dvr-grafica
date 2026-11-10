// Modalita' dimostrativa dei moduli nuovi: pannelli nella stessa forma grezza
// del backend (passano dal mapper vero) e documenti di esempio per il tavolo.
// Dati interamente fittizi: nessun riferimento a clienti reali.

import { mapProposta } from './moduli-mappers';
import type { CodaDataSource, DocumentiHseDataSource, DocumentoAzienda, PropostaAgenteVoce } from './moduli-types';

type Raw = Record<string, unknown>;

const oggi = () => new Date().toISOString().slice(0, 10);
const traGiorni = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function demoValutazioneRumore(aziendaId: number): Raw {
  return {
    tipo: 'valutazione',
    chiave: 'valutazione:9001',
    valutazione_id: 9001,
    azienda_id: aziendaId,
    tipo_valutazione: 'rumore',
    nome: 'Rumore',
    stato: 'pronta',
    revisione: 0,
    esito: { livello: 2, colore: 'arancio', testo: 'Valore superiore di azione superato in un gruppo' },
    righe: [
      { voce: 'Addetto alla piegatura lamiera', valore: 'LEX,8h 86,4 dB(A) ± 1,6, ppeak 131,2 dB(C)', esito: 'Oltre il valore superiore di azione', colore: 'arancio' },
      { voce: 'Saldatore', valore: 'LEX,8h 82,1 dB(A) ± 1,8, ppeak 124,0 dB(C)', esito: 'Oltre il valore inferiore di azione', colore: 'giallo' },
      { voce: 'Impiegato amministrativo', valore: 'LEX,8h 61,0 dB(A)', esito: 'Sotto i valori di azione', colore: 'verde' },
    ],
    puo_emettere: true,
    conteggi: { blocca: 0, corregge: 1, avvisa: 1 },
    segnalazioni: [
      { chiave: 'dpi_snr', esito: 'corregge', messaggio: 'Per la piegatura manca il valore SNR degli otoprotettori consegnati: aggiungilo per verificare l’attenuazione.', riferimento: 'art. 193 D.Lgs. 81/08', accettabile: true, accettata: false, colore: 'giallo' },
      { chiave: 'misure_data', esito: 'avvisa', messaggio: 'Le misure risalgono a oltre un anno fa: verifica che le lavorazioni non siano cambiate.', riferimento: 'art. 190 c.1', accettabile: true, accettata: false, colore: 'grigio' },
    ],
  };
}

export function demoDuvri(): Raw {
  return {
    tipo: 'documento_hse',
    chiave: 'documento_hse:9101',
    documento_id: 9101,
    tipo_documento: 'duvri',
    titolo: 'DUVRI manutenzione impianti di climatizzazione',
    stato: 'bozza',
    revisione: 0,
    puo_emettere: false,
    conteggi: { blocca: 1, corregge: 1, avvisa: 1 },
    segnalazioni: [
      { chiave: 'costi', esito: 'blocca', messaggio: 'Mancano i costi della sicurezza non soggetti a ribasso: il DUVRI non può essere emesso senza.', riferimento: 'art. 26 c.5 D.Lgs. 81/08', accettabile: false, accettata: null, colore: 'rosso' },
      { chiave: 'idoneita', esito: 'corregge', messaggio: 'Verifica dell’idoneità tecnico professionale dell’appaltatore senza data: indicala.', riferimento: 'art. 26 c.1 lett. a)', accettabile: false, accettata: null, colore: 'giallo' },
      { chiave: 'riunione', esito: 'avvisa', messaggio: 'Nessun verbale della riunione di coordinamento allegato.', riferimento: 'art. 26 c.2', accettabile: true, accettata: null, colore: 'grigio' },
    ],
  };
}

export function demoQualita(): Raw {
  return {
    tipo: 'qualita',
    chiave: 'qualita:9101',
    documento_id: 9101,
    tipo_documento: 'duvri',
    titolo: 'DUVRI manutenzione impianti di climatizzazione',
    punteggio: 78.5,
    livello: 'buono',
    pronto_per_revisione: true,
    colore: 'verde',
    componenti: [
      { chiave: 'completezza', nome: 'Completezza delle sezioni', punti: 22, max: 25, dettaglio: '11 sezioni su 12' },
      { chiave: 'dati', nome: 'Dati veri dell’azienda', punti: 18, max: 20, dettaglio: '2 dati da completare' },
      { chiave: 'normativa', nome: 'Normativa aggiornata', punti: 20, max: 20, dettaglio: 'Nessun riferimento superato' },
      { chiave: 'specificita', nome: 'Specificità delle misure', punti: 12.5, max: 20, dettaglio: 'Misure generiche in 3 interferenze' },
      { chiave: 'chiarezza', nome: 'Chiarezza', punti: 6, max: 15, dettaglio: 'Frasi lunghe nelle procedure' },
    ],
    riferimenti_superati: [],
    miglioramenti: [
      { componente: 'specificita', guadagno: 7.5, azione: 'Indica per ogni interferenza chi fa cosa e con quali attrezzature.' },
      { componente: 'chiarezza', guadagno: 9, azione: 'Spezza le procedure in passi brevi numerati.' },
    ],
  };
}

export function demoCoda(aziendaId: number): Raw {
  return {
    tipo: 'coda_lavoro',
    chiave: 'coda_lavoro:0',
    azienda_id: 0,
    proposte: [
      { id: 9301, azienda_id: aziendaId, tipo: 'dati_azienda', titolo: 'Aggiornare i dati: pec, ateco', payload: { campi: { pec: 'amministrazione@esempio-pec.it', ateco: '25.62.00' }, fonte: 'Visura camerale caricata il 12/10' }, motivo: 'Letti dalla visura caricata nell’archivio.', origine: 'agente', stato: 'in_attesa', creata_il: new Date().toISOString() },
      { id: 9302, azienda_id: aziendaId, tipo: 'scadenza', titolo: 'Nuova scadenza: verifica periodica impianto di messa a terra', payload: { descrizione: 'Verifica periodica impianto di messa a terra', data_prevista: traGiorni(40), priorita: 'alta' }, motivo: 'Ultimo verbale DPR 462/01 di quattro anni e dieci mesi fa.', origine: 'agente', stato: 'in_attesa', creata_il: new Date().toISOString() },
      { id: 9303, azienda_id: aziendaId, tipo: 'servizio', titolo: 'Richiesta di Corso preposti', payload: { servizio: 'corso_preposti', nome: 'Corso preposti', quantita: 2, importo: '360,00 €' }, motivo: null, origine: 'utente', stato: 'in_attesa', creata_il: new Date().toISOString() },
    ],
    fatto_oggi: { approvate: 4, respinte: 1 },
    allarmi: [{ chiave: 'quote_ferme', testo: 'Quote d’ingresso da pagare da più di 7 giorni (corsi e visite fermi)', numero: 2, livello: 'ambra' }],
  };
}

export function demoCruscotto(): Raw {
  const i = (codice: string, nome: string, valore: number | null, unita: string, obiettivo: number, soglia: number, stato: string, come: string) => ({ codice, nome, valore, unita, base: null, obiettivo, soglia, stato, come });
  return {
    tipo: 'cruscotto',
    chiave: 'cruscotto:0',
    azienda_id: 0,
    indicatori: [
      i('avvio_48_ore', 'Fascicoli aperti entro 48 ore dal pagamento', 96, '%', 95, 80, 'verde', 'Schede di avvio validate entro 48 ore dal pagamento registrato.'),
      i('richiamata_15_minuti', 'Pronto Ispezioni richiamate entro 15 minuti', 88, '%', 95, 85, 'ambra', 'Richieste di assistenza con richiamata entro i minuti obiettivo.'),
      i('pos_24_ore', 'POS emessi entro 24 ore lavorative', 92, '%', 90, 75, 'verde', 'Dalla creazione all’emissione, solo giorni lavorativi.'),
      i('visite_confermate', 'Visite confermate dal lavoratore', 81, '%', 95, 80, 'ambra', 'Appuntamenti confermati dal link del lavoratore.'),
      i('copertura_formativa', 'Lavoratori con formazione in regola', 86, '%', 100, 90, 'rosso', 'Almeno un attestato e nessuno scaduto.'),
      i('visite_in_regola', 'Lavoratori in sorveglianza con visita valida', 97, '%', 100, 90, 'ambra', 'Scadenza della visita futura.'),
      i('scadenze_scadute', 'Scadenze aperte già scadute', 3, 'n', 0, 10, 'ambra', 'Scadenze aperte con data passata.'),
      i('quote_ferme', 'Quote d’ingresso non pagate da oltre 7 giorni', 2, 'n', 0, 5, 'ambra', 'Bloccano corso e visita del nuovo assunto.'),
      i('proposte_ferme', 'Proposte degli agenti ferme oltre 48 ore', 0, 'n', 0, 5, 'verde', 'Coda di lavoro.'),
      i('dvr_approvati', 'Aziende con DVR approvato', 92, '%', 100, 90, 'ambra', 'Aziende con almeno un DVR approvato.'),
      i('fascicolo_completo', 'Completezza media del fascicolo', null, '%', 90, 70, 'n_d', 'Documenti essenziali presenti e aggiornati.'),
    ],
    agenti: { proposte_oggi: 14, in_attesa: 3, approvate_su_decise: 87.5, costo_ai_mese_eur: 41.2 },
  };
}

export function demoNuovoAssunto(aziendaId: number): Raw {
  return {
    tipo: 'nuovo_assunto',
    chiave: `nuovo_assunto:${aziendaId}`,
    azienda_id: aziendaId,
    lavoratore: { id: 77, nome: 'Marco B.', mansione: 'Operatore di magazzino', data_assunzione: oggi(), rischio: 'medio', sorveglianza: true, lingua: 'it' },
    quota: { id: 5, tipo: 'ingresso', importo: '95,00 €', stato: 'da_pagare', descrizione: 'Quota d’ingresso, rischio medio con visita' },
    scadenze: [
      { id: 801, tipo: 'formazione', descrizione: 'Formazione generale e specifica rischio medio (12 ore)', stato_prenotazione: 'da_prenotare' },
      { id: 802, tipo: 'visita_medica', descrizione: 'Visita preventiva del medico competente', stato_prenotazione: 'da_prenotare' },
    ],
  };
}

export function demoSchedaAvvio(aziendaId: number): Raw {
  return {
    tipo: 'scheda_avvio',
    chiave: `scheda_avvio:${aziendaId}`,
    azienda_id: aziendaId,
    in_ritardo: false,
    note: [],
    passi: [
      { numero: 1, nome: 'Carica i documenti', stato: 'fatto', documenti: 9, letti: 9, in_lettura: 0, sanitari_bloccati: 1, nota: 'Visure, nomine, attestati, vecchio DVR, elenco del personale.' },
      { numero: 2, nome: 'Conferma i dati letti', stato: 'da_fare', da_confermare: [{ proposta_id: 9301, titolo: 'Aggiornare i dati: pec, ateco', campi: {} }], confermati: 3 },
      { numero: 3, nome: 'Completa quello che manca', stato: 'da_fare', mancanti: [{ voce: 'Medico competente', campo: 'medico_competente' }, { voce: 'Addetti antincendio', campo: 'addetti_antincendio' }] },
      { numero: 4, nome: 'Invita gli utenti', stato: 'da_fare', utenti: [] },
    ],
  };
}

/** Pannelli dimostrativi in base alle parole del messaggio (nessun motore AI). */
export function pannelliDemo(testo: string, aziendaId: number | null): Raw[] {
  const t = testo.toLowerCase();
  const az = aziendaId ?? 1;
  if (/rumore|valutazion/.test(t)) return [demoValutazioneRumore(az)];
  if (/duvri|interferenz/.test(t)) return [demoDuvri(), demoQualita()];
  if (/qualit/.test(t)) return [demoQualita()];
  if (/coda|propost|approva/.test(t)) return [demoCoda(az)];
  if (/cruscotto|indicator/.test(t)) return [demoCruscotto()];
  if (/assunt|assunzion/.test(t)) return [demoNuovoAssunto(az)];
  if (/avvio|onboarding/.test(t)) return [demoSchedaAvvio(az)];
  return [];
}

// ---------------------------------------------------------------- tavolo e coda in modalita' dimostrativa

const DEMO_SCARICA = 'In modalità dimostrativa i documenti non si scaricano: collega il backend per avere Word e PDF.';

export function creaDocumentiHseDemo(dvrDi: (companyId: number) => Promise<DocumentoAzienda[]>): DocumentiHseDataSource {
  return {
    elenco: async (companyId: number) => {
      const dvr = await dvrDi(companyId).catch(() => [] as DocumentoAzienda[]);
      const ora = new Date().toISOString();
      const doc = (d: Partial<DocumentoAzienda> & Pick<DocumentoAzienda, 'origine' | 'id' | 'tipo' | 'titolo'>): DocumentoAzienda => ({
        chiave: `${d.origine}:${d.id}`,
        stato: null,
        revisione: null,
        aggiornato: ora,
        puo_emettere: null,
        conteggi: null,
        esito: null,
        ...d,
      });
      return {
        documenti: [
          ...dvr,
          doc({ origine: 'valutazione', id: 9001, tipo: 'rumore', titolo: 'Valutazione del rischio rumore', stato: 'pronta', revisione: 0, puo_emettere: true, esito: { testo: 'Valore superiore di azione superato in un gruppo', colore: 'arancio', livello: 2 } }),
          doc({ origine: 'valutazione', id: 9002, tipo: 'mmc', titolo: 'Valutazione movimentazione manuale dei carichi', stato: 'emessa', revisione: 1, esito: { testo: 'Rischio accettabile', colore: 'verde', livello: 0 } }),
          doc({ origine: 'hse', id: 9101, tipo: 'duvri', titolo: 'DUVRI manutenzione impianti di climatizzazione', stato: 'bozza', revisione: 0, puo_emettere: false, conteggi: { blocca: 1, corregge: 1, avvisa: 1 } }),
          doc({ origine: 'hse', id: 9102, tipo: 'emergenza', titolo: 'Piano di emergenza ed evacuazione', stato: 'emesso', revisione: 2 }),
          doc({ origine: 'hse', id: 9103, tipo: 'nomina', titolo: 'Designazione addetti antincendio', stato: 'emesso', revisione: 1 }),
          doc({ origine: 'hse', id: 9104, tipo: 'sopralluogo', titolo: 'Verbale di sopralluogo del 7 ottobre', stato: 'bozza', revisione: 0, puo_emettere: true, conteggi: { blocca: 0, corregge: 0, avvisa: 2 } }),
        ],
        avvisi: [],
      };
    },
    scarica: async () => {
      throw new Error(DEMO_SCARICA);
    },
  };
}

export function creaCodaDemo(): CodaDataSource {
  return {
    decidi: async (id: number, decisione: 'approva' | 'respingi'): Promise<PropostaAgenteVoce> => {
      await new Promise((r) => setTimeout(r, 300));
      const base = (demoCoda(1).proposte as Raw[]).find((p) => p.id === id) ?? { id, titolo: 'Proposta', tipo: 'attivita' };
      const p = mapProposta({ ...base, stato: decisione === 'approva' ? 'approvata' : 'respinta' });
      if (!p) throw new Error('Proposta non trovata.');
      return p;
    },
  };
}
