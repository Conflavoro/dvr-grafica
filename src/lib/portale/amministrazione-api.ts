/**
 * Chiamate delle sezioni di formazione, visite e amministrazione (V6, V7):
 * prenotazioni, classi, promemoria, giornate delle visite, laboratorio,
 * preventivi, ordini, wallet, contratto e fatture, registro ore.
 * Fuori dalla modalita' API ogni lettura torna vuota e le scritture si fermano.
 */

import { apiUpload } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { scaricaFile } from '@/lib/data-source/moduli-api';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

type R = Record<string, unknown>;

const dati = (r: unknown): R => rec(rec(r).data);
const datiLista = (r: unknown): R[] => lista(rec(r).data).map(rec);

function soloApi(): void {
  if (!isApiMode()) throw new Error('Disponibile solo con il collegamento al server.');
}

// ---------------------------------------------------------------- prenotazioni e promemoria

export interface VoceDaPrenotare {
  scadenza_id: number;
  tipo: 'visita_medica' | 'formazione';
  tipo_visita: string | null;
  descrizione: string;
  entro: string | null;
  scaduta: boolean;
  lavoratore_id: number;
  lavoratore: string;
  mansione: string | null;
  azienda_id: number;
  azienda: string;
  comune: string | null;
  quota_da_pagare: boolean;
  richiesta_azienda_il: string | null;
  richiesta_nota: string | null;
}

export function mappaVoceDaPrenotare(x: unknown): VoceDaPrenotare | null {
  const r = rec(x);
  const id = numero(r.scadenza_id);
  if (id === null) return null;
  return {
    scadenza_id: id,
    tipo: r.tipo === 'formazione' ? 'formazione' : 'visita_medica',
    tipo_visita: testo(r.tipo_visita),
    descrizione: testo(r.descrizione) ?? '',
    entro: testo(r.entro),
    scaduta: r.scaduta === true,
    lavoratore_id: numero(r.lavoratore_id) ?? 0,
    lavoratore: testo(r.lavoratore) ?? '',
    mansione: testo(r.mansione),
    azienda_id: numero(r.azienda_id) ?? 0,
    azienda: testo(r.azienda) ?? '',
    comune: testo(r.comune),
    quota_da_pagare: r.quota_da_pagare === true,
    richiesta_azienda_il: testo(r.richiesta_azienda_il),
    richiesta_nota: testo(r.richiesta_nota),
  };
}

/** Filtro facoltativo sul cliente scelto nel gestionale (il server restringe, non allarga mai). */
const az = (aziendaId?: number | null, primo = false) => (aziendaId ? `${primo ? '?' : '&'}azienda_id=${aziendaId}` : '');

export async function prenotazioniDaFare(giorni = 90, aziendaId?: number | null): Promise<{ voci: VoceDaPrenotare[]; conteggi: R; nota: string | null }> {
  if (!isApiMode()) return { voci: [], conteggi: {}, nota: null };
  const d = dati(await prendi(`/portale/gestionale/prenotazioni?giorni=${giorni}${az(aziendaId)}`));
  return { voci: lista(d.voci).map(mappaVoceDaPrenotare).filter((v): v is VoceDaPrenotare => v !== null), conteggi: rec(d.conteggi), nota: testo(d.nota) };
}

export async function promemoriaPresenze(giorni = 14, aziendaId?: number | null): Promise<R> {
  if (!isApiMode()) return {};
  return dati(await prendi(`/portale/gestionale/promemoria?giorni=${giorni}${az(aziendaId)}`));
}

// ---------------------------------------------------------------- classi

export interface Corso {
  tipo: string;
  titolo: string;
  ore: number | null;
  modalita: string[];
  aggiornamento_anni: number | null;
  riferimento: string;
}

export interface Classe {
  id: number;
  tipo: string;
  titolo: string;
  ore: number;
  modalita: string;
  data_inizio: string;
  data_fine: string | null;
  ora_inizio: string | null;
  sede: string | null;
  docente: string | null;
  posti: number;
  iscritti_n: number;
  aziende_n: number;
  stato: string;
  oggi: boolean;
  riferimento: string;
  iscritti: Iscritto[];
  requisiti: string[];
}

export interface Iscritto {
  iscritto_id: number;
  lavoratore_id: number;
  lavoratore: string;
  mansione: string | null;
  azienda_id: number;
  azienda: string;
  convocazione: string;
  presenza: number | null;
  esito: string | null;
  attestato: { codice: string; documento_id: number } | null;
  generale_fatta: boolean;
}

export function mappaClasse(x: unknown): Classe {
  const r = rec(x);
  return {
    id: numero(r.id) ?? 0,
    tipo: testo(r.tipo) ?? '',
    titolo: testo(r.titolo) ?? '',
    ore: numero(r.ore) ?? 0,
    modalita: testo(r.modalita) ?? 'aula',
    data_inizio: testo(r.data_inizio) ?? '',
    data_fine: testo(r.data_fine),
    ora_inizio: testo(r.ora_inizio),
    sede: testo(r.sede),
    docente: testo(r.docente),
    posti: numero(r.posti) ?? 0,
    iscritti_n: numero(r.iscritti_n) ?? 0,
    aziende_n: numero(r.aziende_n) ?? 0,
    stato: testo(r.stato) ?? 'bozza',
    oggi: r.oggi === true,
    riferimento: testo(r.riferimento) ?? '',
    iscritti: lista(r.iscritti).map((i) => {
      const x2 = rec(i);
      const a = rec(x2.attestato);
      return {
        iscritto_id: numero(x2.iscritto_id) ?? 0,
        lavoratore_id: numero(x2.lavoratore_id) ?? 0,
        lavoratore: testo(x2.lavoratore) ?? '',
        mansione: testo(x2.mansione),
        azienda_id: numero(x2.azienda_id) ?? 0,
        azienda: testo(x2.azienda) ?? '',
        convocazione: testo(x2.convocazione) ?? 'da_inviare',
        presenza: numero(x2.presenza),
        esito: testo(x2.esito),
        attestato: numero(a.documento_id) !== null ? { codice: testo(a.codice) ?? '', documento_id: numero(a.documento_id)! } : null,
        generale_fatta: x2.generale_fatta === true,
      };
    }),
    requisiti: lista(r.requisiti).map(String),
  };
}

export async function classi(aziendaId?: number | null): Promise<{ classi: Classe[]; conteggi: R; corsi: Corso[] }> {
  if (!isApiMode()) return { classi: [], conteggi: {}, corsi: [] };
  const d = dati(await prendi(`/portale/gestionale/classi${az(aziendaId, true)}`));
  return {
    classi: lista(d.classi).map(mappaClasse),
    conteggi: rec(d.conteggi),
    corsi: lista(d.corsi).map((c) => {
      const x = rec(c);
      return { tipo: testo(x.tipo) ?? '', titolo: testo(x.titolo) ?? '', ore: numero(x.ore), modalita: lista(x.modalita).map(String), aggiornamento_anni: numero(x.aggiornamento_anni), riferimento: testo(x.riferimento) ?? '' };
    }),
  };
}

export async function classe(id: number): Promise<Classe> {
  soloApi();
  return mappaClasse(dati(await prendi(`/portale/gestionale/classi/${id}`)));
}

export async function fabbisogno(): Promise<{ voci: R[]; nota: string | null }> {
  if (!isApiMode()) return { voci: [], nota: null };
  const d = dati(await prendi('/portale/gestionale/fabbisogno'));
  return { voci: lista(d.voci).map(rec), nota: testo(d.nota) };
}

export async function creaClasse(body: R): Promise<Classe> {
  soloApi();
  return mappaClasse(dati(await manda('/portale/gestionale/classi', body)));
}

export async function iscriviClasse(id: number, body: { lavoratori?: number[]; scadenze?: number[] }): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/classi/${id}/iscritti`, body);
}

export async function togliIscritto(id: number, iscritto: number): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/classi/${id}/iscritti/${iscritto}`, undefined, 'DELETE');
}

export async function azioneClasse(id: number, azione: 'conferma' | 'annulla'): Promise<Classe> {
  soloApi();
  return mappaClasse(dati(await manda(`/portale/gestionale/classi/${id}/${azione}`)));
}

export async function chiudiRegistro(id: number, registro: Array<{ iscritto_id: number; presenza: number; esito: string }>): Promise<Classe> {
  soloApi();
  return mappaClasse(dati(await manda(`/portale/gestionale/classi/${id}/registro`, { registro })));
}

export async function emettiAttestati(id: number): Promise<{ emessi: number }> {
  soloApi();
  const d = dati(await manda(`/portale/gestionale/classi/${id}/attestati`, { verbale_controllato: true }));
  return { emessi: numero(d.emessi) ?? 0 };
}

export function scaricaAttestato(iscrittoId: number, nome: string): Promise<void> {
  soloApi();
  return scaricaFile(`/portale/attestati-classe/${iscrittoId}/download`, `${nome}.pdf`, 'L\'attestato non è disponibile.');
}

export async function corsiAzienda(aziendaId: number): Promise<R[]> {
  if (!isApiMode()) return [];
  return datiLista(await prendi(`/portale/aziende/${aziendaId}/corsi`));
}

export async function richiediPrenotazione(aziendaId: number, scadenzaId: number, nota?: string): Promise<void> {
  soloApi();
  await manda(`/portale/aziende/${aziendaId}/richiesta-prenotazione`, { scadenza_id: scadenzaId, nota });
}

// ---------------------------------------------------------------- giornate delle visite

export interface Giornata {
  id: number;
  data: string;
  centro: string;
  indirizzo: string | null;
  ora_inizio: string;
  passo_minuti: number;
  posti: number;
  prenotati: number;
  liberi: number;
  arrivati: number;
  visitati: number;
  assenti: number;
  posti_prenotati: R[];
}

export function mappaGiornata(x: unknown): Giornata {
  const r = rec(x);
  return {
    id: numero(r.id) ?? 0,
    data: testo(r.data) ?? '',
    centro: testo(r.centro) ?? '',
    indirizzo: testo(r.indirizzo),
    ora_inizio: testo(r.ora_inizio) ?? '',
    passo_minuti: numero(r.passo_minuti) ?? 20,
    posti: numero(r.posti) ?? 0,
    prenotati: numero(r.prenotati) ?? 0,
    liberi: numero(r.liberi) ?? 0,
    arrivati: numero(r.arrivati) ?? 0,
    visitati: numero(r.visitati) ?? 0,
    assenti: numero(r.assenti) ?? 0,
    posti_prenotati: lista(r.posti_prenotati).map(rec),
  };
}

export async function giornate(aziendaId?: number | null): Promise<{ giornate: Giornata[]; prestazioni: string[]; nota: string | null }> {
  if (!isApiMode()) return { giornate: [], prestazioni: [], nota: null };
  const d = dati(await prendi(`/portale/gestionale/giornate${az(aziendaId, true)}`));
  return { giornate: lista(d.giornate).map(mappaGiornata), prestazioni: lista(d.prestazioni).map(String), nota: testo(d.nota) };
}

export async function giornata(id: number): Promise<Giornata> {
  soloApi();
  return mappaGiornata(dati(await prendi(`/portale/gestionale/giornate/${id}`)));
}

export async function creaGiornata(body: R): Promise<Giornata> {
  soloApi();
  return mappaGiornata(dati(await manda('/portale/gestionale/giornate', body)));
}

export async function prenotaInGiornata(id: number, scadenze: number[]): Promise<number> {
  soloApi();
  return numero(dati(await manda(`/portale/gestionale/giornate/${id}/prenota`, { scadenze })).prenotate) ?? 0;
}

export async function segnaPosto(id: number, body: { stato: string; prestazioni?: string[]; prossima_visita?: string }): Promise<Giornata> {
  soloApi();
  return mappaGiornata(dati(await manda(`/portale/gestionale/posti/${id}`, body)));
}

export async function assenze(): Promise<R[]> {
  if (!isApiMode()) return [];
  return datiLista(await prendi('/portale/gestionale/assenze'));
}

export async function annullaAddebito(id: number, motivo: string): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/assenze/${id}/annulla`, { motivo });
}

// ---------------------------------------------------------------- laboratorio

export async function campionamenti(aziendaId?: number | null): Promise<{ voci: R[]; conteggi: R; tipi: Record<string, string> }> {
  if (!isApiMode()) return { voci: [], conteggi: {}, tipi: {} };
  const d = dati(await prendi(`/portale/gestionale/campionamenti${az(aziendaId, true)}`));
  return { voci: lista(d.voci).map(rec), conteggi: rec(d.conteggi), tipi: rec(d.tipi) as Record<string, string> };
}

export async function creaCampionamento(aziendaId: number, body: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/aziende/${aziendaId}/campionamenti`, body);
}

export async function statoCampionamento(id: number, body: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/campionamenti/${id}/stato`, body);
}

export async function caricaReferto(id: number, file: File, refertoIl: string, valori: R | null): Promise<void> {
  soloApi();
  const f = new FormData();
  f.append('file', file);
  f.append('referto_il', refertoIl);
  if (valori) f.append('valori', JSON.stringify(valori));
  try {
    await apiUpload(`/portale/gestionale/campionamenti/${id}/referto`, f);
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

export async function azioneCampionamento(id: number, azione: 'applica' | 'scarta'): Promise<R> {
  soloApi();
  return dati(await manda(`/portale/gestionale/campionamenti/${id}/${azione}`));
}

// ---------------------------------------------------------------- preventivi e ordini

export interface Preventivo {
  id: number;
  numero: string;
  azienda_id: number | null;
  ragione_sociale: string;
  referente: string | null;
  comune: string | null;
  fonte: string;
  stato: string;
  dipendenti_con_sorveglianza: number;
  dipendenti_senza_sorveglianza: number;
  sedi_alimentari: number;
  canone_mensile: number;
  canone_annuo: number;
  una_tantum: number;
  creato: string | null;
  inviato_il: string | null;
  accettato_il: string | null;
  motivo_perso: string | null;
  giorni_nello_stato: number;
  calcolo: R;
}

export function mappaPreventivo(x: unknown): Preventivo {
  const r = rec(x);
  return {
    id: numero(r.id) ?? 0,
    numero: testo(r.numero) ?? '',
    azienda_id: numero(r.azienda_id),
    ragione_sociale: testo(r.ragione_sociale) ?? '',
    referente: testo(r.referente),
    comune: testo(r.comune),
    fonte: testo(r.fonte) ?? 'diretta',
    stato: testo(r.stato) ?? 'bozza',
    dipendenti_con_sorveglianza: numero(r.dipendenti_con_sorveglianza) ?? 0,
    dipendenti_senza_sorveglianza: numero(r.dipendenti_senza_sorveglianza) ?? 0,
    sedi_alimentari: numero(r.sedi_alimentari) ?? 0,
    canone_mensile: numero(r.canone_mensile) ?? 0,
    canone_annuo: numero(r.canone_annuo) ?? 0,
    una_tantum: numero(r.una_tantum) ?? 0,
    creato: testo(r.creato),
    inviato_il: testo(r.inviato_il),
    accettato_il: testo(r.accettato_il),
    motivo_perso: testo(r.motivo_perso),
    giorni_nello_stato: numero(r.giorni_nello_stato) ?? 0,
    calcolo: rec(r.calcolo),
  };
}

export async function preventivi(aziendaId?: number | null): Promise<{ voci: Preventivo[]; kpi: R }> {
  if (!isApiMode()) return { voci: [], kpi: {} };
  const d = dati(await prendi(`/portale/gestionale/preventivi${az(aziendaId, true)}`));
  return { voci: lista(d.voci).map(mappaPreventivo), kpi: rec(d.kpi) };
}

export async function calcolaPreventivo(body: R): Promise<R> {
  if (!isApiMode()) return {};
  return dati(await manda('/portale/gestionale/preventivi/calcola', body));
}

export async function creaPreventivo(body: R): Promise<Preventivo> {
  soloApi();
  return mappaPreventivo(dati(await manda('/portale/gestionale/preventivi', body)));
}

export async function azionePreventivo(id: number, azione: 'invia' | 'incasso' | 'perso' | 'riapri', body?: R): Promise<Preventivo> {
  soloApi();
  return mappaPreventivo(dati(await manda(`/portale/gestionale/preventivi/${id}/${azione}`, body)));
}

export async function accettaPreventivo(id: number): Promise<void> {
  soloApi();
  await manda(`/portale/preventivi/${id}/accetta`);
}

export function scaricaPreventivo(id: number, numeroPrev: string): Promise<void> {
  soloApi();
  return scaricaFile(`/portale/preventivi/${id}/pdf`, `Preventivo_${numeroPrev}.pdf`, 'Il preventivo non è disponibile.');
}

export interface Ordine {
  id: number;
  numero: string;
  azienda_id: number;
  azienda: string;
  servizio: string;
  titolo: string;
  stato: string;
  importo: number | null;
  tempi: string | null;
  richiesto_da: string | null;
  motivo_rifiuto: string | null;
  cronologia: Array<{ data: string; testo: string }>;
  creato: string | null;
}

export function mappaOrdine(x: unknown): Ordine {
  const r = rec(x);
  return {
    id: numero(r.id) ?? 0,
    numero: testo(r.numero) ?? '',
    azienda_id: numero(r.azienda_id) ?? 0,
    azienda: testo(r.azienda) ?? '',
    servizio: testo(r.servizio) ?? '',
    titolo: testo(r.titolo) ?? '',
    stato: testo(r.stato) ?? '',
    importo: numero(r.importo),
    tempi: testo(r.tempi),
    richiesto_da: testo(r.richiesto_da),
    motivo_rifiuto: testo(r.motivo_rifiuto),
    cronologia: lista(r.cronologia).map((c) => ({ data: testo(rec(c).data) ?? '', testo: testo(rec(c).testo) ?? '' })),
    creato: testo(r.creato),
  };
}

export async function ordiniStudio(aziendaId?: number | null): Promise<{ ordini: Ordine[]; conteggi: R }> {
  if (!isApiMode()) return { ordini: [], conteggi: {} };
  const d = dati(await prendi(`/portale/gestionale/ordini${az(aziendaId, true)}`));
  return { ordini: lista(d.ordini).map(mappaOrdine), conteggi: rec(d.conteggi) };
}

export async function azioneOrdineStudio(id: number, azione: 'prezzo' | 'pagamento' | 'consegna', body: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/ordini/${id}/${azione}`, body);
}

export interface ServizioCatalogo {
  servizio: string;
  nome: string;
  tipo: 'fisso' | 'preventivo';
  prezzo: number | null;
  tempi: string;
  descrizione: string;
  gruppo: string;
  unita: string | null;
}

export async function serviziAzienda(aziendaId: number): Promise<{ ordini: Ordine[]; catalogo: ServizioCatalogo[]; preventivi: Preventivo[]; puoApprovare: boolean; daApprovare: number }> {
  if (!isApiMode()) return { ordini: [], catalogo: [], preventivi: [], puoApprovare: false, daApprovare: 0 };
  const d = dati(await prendi(`/portale/aziende/${aziendaId}/servizi`));
  return {
    ordini: lista(d.ordini).map(mappaOrdine),
    catalogo: lista(d.catalogo).map((x) => {
      const r = rec(x);
      return {
        servizio: testo(r.servizio) ?? '',
        nome: testo(r.nome) ?? '',
        tipo: r.tipo === 'preventivo' ? 'preventivo' : 'fisso',
        prezzo: numero(r.prezzo),
        tempi: testo(r.tempi) ?? '',
        descrizione: testo(r.descrizione) ?? '',
        gruppo: testo(r.gruppo) ?? '',
        unita: testo(r.unita),
      };
    }),
    preventivi: lista(d.preventivi).map(mappaPreventivo),
    puoApprovare: d.puo_approvare === true,
    daApprovare: numero(d.da_approvare) ?? 0,
  };
}

export async function richiediServizio(aziendaId: number, body: R): Promise<Ordine> {
  soloApi();
  return mappaOrdine(dati(await manda(`/portale/aziende/${aziendaId}/ordini`, body)));
}

export async function azioneOrdine(id: number, azione: 'approva' | 'rifiuta' | 'paga', body?: R): Promise<Ordine> {
  soloApi();
  return mappaOrdine(dati(await manda(`/portale/ordini/${id}/${azione}`, body)));
}

// ---------------------------------------------------------------- wallet, contratto, fatture

export interface Saldo {
  fondi: number;
  omaggio: number;
  totale: number;
  in_scadenza_30: number;
  lotti: Array<{ id: number; causale: string; importo: number; residuo: number; scade_il: string | null; stato: string; ambiti: string[] }>;
}

export interface Movimento {
  id: number;
  tipo: string;
  saldo: string;
  importo: number;
  causale: string;
  riferimento: string | null;
  creato: string | null;
  ragione_sociale?: string;
}

export function mappaSaldo(x: unknown): Saldo {
  const r = rec(x);
  return {
    fondi: numero(r.fondi) ?? 0,
    omaggio: numero(r.omaggio) ?? 0,
    totale: numero(r.totale) ?? 0,
    in_scadenza_30: numero(r.in_scadenza_30) ?? 0,
    lotti: lista(r.lotti).map((l) => {
      const x2 = rec(l);
      return { id: numero(x2.id) ?? 0, causale: testo(x2.causale) ?? '', importo: numero(x2.importo) ?? 0, residuo: numero(x2.residuo) ?? 0, scade_il: testo(x2.scade_il), stato: testo(x2.stato) ?? '', ambiti: lista(x2.ambiti).map(String) };
    }),
  };
}

export function mappaMovimento(x: unknown): Movimento {
  const r = rec(x);
  return {
    id: numero(r.id) ?? 0,
    tipo: testo(r.tipo) ?? '',
    saldo: testo(r.saldo) ?? 'fondi',
    importo: numero(r.importo) ?? 0,
    causale: testo(r.causale) ?? '',
    riferimento: testo(r.riferimento),
    creato: testo(r.creato),
    ragione_sociale: testo(r.ragione_sociale) ?? undefined,
  };
}

export async function walletAzienda(aziendaId: number): Promise<{ saldo: Saldo; movimenti: Movimento[]; dettaglio: boolean; regole: string[] }> {
  if (!isApiMode()) return { saldo: mappaSaldo({}), movimenti: [], dettaglio: false, regole: [] };
  const d = dati(await prendi(`/portale/aziende/${aziendaId}/wallet`));
  return { saldo: mappaSaldo(d.saldo), movimenti: lista(d.movimenti).map(mappaMovimento), dettaglio: d.dettaglio === true, regole: lista(d.regole).map(String) };
}

export async function quadroWallet(): Promise<{ fondi: number; omaggio: number; aziende: R[]; recenti: Movimento[]; nota: string | null }> {
  if (!isApiMode()) return { fondi: 0, omaggio: 0, aziende: [], recenti: [], nota: null };
  const d = dati(await prendi('/portale/gestionale/wallet'));
  return { fondi: numero(d.fondi_clienti) ?? 0, omaggio: numero(d.omaggio_attivi) ?? 0, aziende: lista(d.aziende).map(rec), recenti: lista(d.recenti).map(mappaMovimento), nota: testo(d.nota) };
}

export async function movimentoWallet(aziendaId: number, tipo: 'ricarica' | 'omaggio' | 'rettifica' | 'rimborso', body: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/aziende/${aziendaId}/wallet/${tipo}`, body);
}

export async function contrattoAzienda(aziendaId: number): Promise<R> {
  if (!isApiMode()) return {};
  return dati(await prendi(`/portale/aziende/${aziendaId}/contratto`));
}

export async function salvaContratto(aziendaId: number, body: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/aziende/${aziendaId}/contratto`, body, 'PUT');
}

export async function caricaFattura(aziendaId: number, file: File, campi: Record<string, string>): Promise<void> {
  soloApi();
  const f = new FormData();
  f.append('file', file);
  for (const [k, v] of Object.entries(campi)) f.append(k, v);
  try {
    await apiUpload(`/portale/gestionale/aziende/${aziendaId}/fatture`, f);
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

export async function pagaFattura(id: number): Promise<void> {
  soloApi();
  await manda(`/portale/fatture/${id}/paga`);
}

export function scaricaFattura(id: number, numeroFatt: string): Promise<void> {
  soloApi();
  return scaricaFile(`/portale/fatture/${id}/download`, `Fattura_${numeroFatt.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, 'Il PDF della fattura non è disponibile.');
}

// ---------------------------------------------------------------- registro ore

export async function mieOre(settimana?: string): Promise<R> {
  if (!isApiMode()) return {};
  return dati(await prendi(`/portale/gestionale/ore/mie${settimana ? `?settimana=${settimana}` : ''}`));
}

export async function aggiungiOre(body: R): Promise<void> {
  soloApi();
  await manda('/portale/gestionale/ore', body);
}

export async function confermaOre(id: number, body?: R): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/ore/${id}/conferma`, body ?? {});
}

export async function eliminaOre(id: number): Promise<void> {
  soloApi();
  await manda(`/portale/gestionale/ore/${id}`, undefined, 'DELETE');
}

export async function orePerAzienda(mesi = 12): Promise<R> {
  if (!isApiMode()) return {};
  return dati(await prendi(`/portale/gestionale/ore/aziende?mesi=${mesi}`));
}
