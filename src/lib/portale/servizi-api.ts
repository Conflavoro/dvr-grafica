/**
 * Servizi e ordini dell'area azienda (regole di business 11): catalogo a
 * gruppi, fogli d'ordine, dettaglio con PSC e lavoratori, approvazione con
 * pagamento. I permessi li decide il server; qui solo mappe e chiamate.
 */
import { ApiError, apiRequest, apiUpload } from '@/lib/api';
import { erroreLeggibile, lista, numero, rec, testo } from './api';
import type { MetodoFoglio, EsitoPagamento } from './amministrazione-pagamenti';
import { mappaEsito } from './amministrazione-pagamenti';

type R = Record<string, unknown>;

export type Flusso = 'cantiere' | 'revisione' | 'drug' | 'haccp' | 'corso' | 'preventivo' | 'avvisa';
export type StatoOrdine = 'da_approvare' | 'in_corso' | 'attesa_bonifico' | 'consegnato' | 'preventivo_richiesto' | 'rifiutato' | 'attesa_pagamento' | 'da_pagare' | 'annullato';

export interface Servizio {
  id: string;
  nome: string;
  tipo: 'fisso' | 'preventivo' | 'in_arrivo';
  flusso: Flusso;
  gruppo: string;
  prezzo: number | null;
  unita: string | null;
  tempi: string | null;
  descrizione: string;
  icona: string;
}

export interface Passo {
  testo: string;
  data: string | null;
  futuro: boolean;
}

export interface LavoratoreOrdine {
  id: number;
  nome: string;
  mansione: string | null;
  esito: 'blocco' | 'avviso' | 'ok' | null;
  blocchi: string[];
  avvisi: string[];
  gliServe: boolean;
}

export interface PscOrdine {
  stato: 'attesa' | 'caricato';
  link: string | null;
  attivo: boolean;
  file: string | null;
  caricatoIl: string | null;
  caricatoDa: string | null;
  nota: string | null;
}

export interface OrdineServizio {
  id: number;
  numero: string;
  servizio: string;
  titolo: string;
  stato: StatoOrdine;
  importo: number | null;
  quantita: number;
  tempi: string | null;
  richiestoDa: string | null;
  approvatoDa: string | null;
  motivo: string | null;
  creato: string | null;
  cronologia: Passo[];
  dati: R;
  lavoratori: LavoratoreOrdine[];
  psc: PscOrdine | null;
  consegnati: Array<{ id: number; nome: string }>;
}

export interface SezioneServizi {
  catalogo: Servizio[];
  gruppi: Array<{ nome: string; nota: string | null }>;
  ordini: OrdineServizio[];
  daApprovare: number;
  puoApprovare: boolean;
  puoOrdinare: boolean;
  titolare: string | null;
  omaggi: { importo: number; scadeIl: string | null } | null;
  avvisi: string[];
  haccpSedi: number;
  sediAlimentari: number;
  posEsistenti: string[];
  sede: string | null;
}

export class ErroreCampi extends Error {
  constructor(
    messaggio: string,
    public readonly campi: Record<string, string>,
  ) {
    super(messaggio);
  }
}

const str = (v: unknown): string => testo(v) ?? '';

export function mappaServizio(raw: unknown): Servizio {
  const s = rec(raw);
  return {
    id: str(s.servizio),
    nome: str(s.nome),
    tipo: (['fisso', 'preventivo', 'in_arrivo'].includes(str(s.tipo)) ? str(s.tipo) : 'fisso') as Servizio['tipo'],
    flusso: (str(s.flusso) || 'preventivo') as Flusso,
    gruppo: str(s.gruppo),
    prezzo: numero(s.prezzo),
    unita: testo(s.unita),
    tempi: testo(s.tempi),
    descrizione: str(s.descrizione),
    icona: str(s.icona),
  };
}

function mappaLavoratore(raw: unknown): LavoratoreOrdine {
  const l = rec(raw);
  const esito = testo(l.esito);
  return {
    id: numero(l.id) ?? 0,
    nome: str(l.nome),
    mansione: testo(l.mansione),
    esito: esito === 'blocco' || esito === 'avviso' || esito === 'ok' ? esito : null,
    blocchi: lista(l.blocchi).map(str).filter(Boolean),
    avvisi: lista(l.avvisi).map(str).filter(Boolean),
    gliServe: l.gli_serve === true,
  };
}

export function mappaOrdine(raw: unknown): OrdineServizio {
  const o = rec(raw);
  const p = o.psc ? rec(o.psc) : null;
  return {
    id: numero(o.id) ?? 0,
    numero: str(o.numero),
    servizio: str(o.servizio),
    titolo: str(o.titolo),
    stato: (str(o.stato) || 'in_corso') as StatoOrdine,
    importo: numero(o.importo),
    quantita: numero(o.quantita) ?? 1,
    tempi: testo(o.tempi),
    richiestoDa: testo(o.richiesto_da),
    approvatoDa: testo(o.approvato_da),
    motivo: testo(o.motivo_rifiuto),
    creato: testo(o.creato),
    cronologia: lista(o.cronologia).map((x) => {
      const c = rec(x);
      return { testo: str(c.testo), data: testo(c.data), futuro: c.futuro === true };
    }),
    dati: rec(o.dati),
    lavoratori: lista(o.lavoratori).map(mappaLavoratore),
    psc: p
      ? {
          stato: testo(p.stato) === 'caricato' ? 'caricato' : 'attesa',
          link: testo(p.link),
          attivo: p.attivo === true,
          file: testo(p.file),
          caricatoIl: testo(p.caricato_il),
          caricatoDa: testo(p.caricato_da),
          nota: testo(p.nota),
        }
      : null,
    consegnati: lista(o.consegnati).map((x) => ({ id: numero(rec(x).id) ?? 0, nome: str(rec(x).nome) })),
  };
}

export function mappaSezione(raw: unknown): SezioneServizi {
  const d = rec(raw);
  const om = d.omaggi ? rec(d.omaggi) : null;
  return {
    catalogo: lista(d.catalogo).map(mappaServizio),
    gruppi: lista(d.gruppi).map((g) => ({ nome: str(rec(g).nome), nota: testo(rec(g).nota) })),
    ordini: lista(d.ordini).map(mappaOrdine),
    daApprovare: numero(d.da_approvare) ?? 0,
    puoApprovare: d.puo_approvare === true,
    puoOrdinare: d.puo_ordinare === true,
    titolare: testo(d.titolare),
    omaggi: om ? { importo: numero(om.importo) ?? 0, scadeIl: testo(om.scade_il) } : null,
    avvisi: lista(d.avvisi).map(str),
    haccpSedi: numero(d.haccp_sedi) ?? 0,
    sediAlimentari: numero(d.sedi_alimentari) ?? 0,
    posEsistenti: lista(d.pos_esistenti).map(str).filter(Boolean),
    sede: testo(d.sede),
  };
}

/** Errori con i campi del server ("errori": campo => testo). */
function errore(e: unknown): Error {
  if (e instanceof ApiError) {
    const campi = rec(rec(e.body).errori);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(campi)) if (typeof v === 'string') out[k] = v;
    if (Object.keys(out).length) return new ErroreCampi(Object.values(out)[0], out);
  }
  return erroreLeggibile(e);
}

async function chiama<T>(path: string, method: 'GET' | 'POST', body?: R): Promise<T> {
  try {
    const r = await apiRequest<{ data: unknown }>(path, { method, body, cache: method === 'GET' ? 'no-store' : undefined });
    return r.data as T;
  } catch (e) {
    throw errore(e);
  }
}

export const sezioneServizi = async (aziendaId: number): Promise<SezioneServizi> => mappaSezione(await chiama(`/portale/aziende/${aziendaId}/servizi`, 'GET'));

export const dettaglioOrdine = async (id: number): Promise<OrdineServizio> => mappaOrdine(await chiama(`/portale/ordini/${id}`, 'GET'));

export async function lavoratoriPer(aziendaId: number, servizio: string, fine?: string | null): Promise<LavoratoreOrdine[]> {
  const q = new URLSearchParams({ servizio });
  if (fine) q.set('fine', fine);
  const d = rec(await chiama(`/portale/aziende/${aziendaId}/servizi/lavoratori?${q.toString()}`, 'GET'));
  return lista(d.lavoratori).map(mappaLavoratore);
}

export async function creaLinkPscOrdine(aziendaId: number): Promise<{ id: number; link: string }> {
  const d = rec(await chiama(`/portale/aziende/${aziendaId}/servizi/link-psc`, 'POST'));
  return { id: numero(d.id) ?? 0, link: str(d.link) };
}

export interface EsitoOrdine {
  ordine: OrdineServizio;
  pagamento: EsitoPagamento | null;
  messaggio: string | null;
}

function esitoOrdine(raw: unknown): EsitoOrdine {
  const d = rec(raw);
  return { ordine: mappaOrdine(d), pagamento: d.pagamento ? mappaEsito(d.pagamento) : null, messaggio: testo(d.messaggio) };
}

/** Foglio d'ordine: i file (PSC, libretto) vanno in multipart, il resto in "dati". */
export async function ordina(aziendaId: number, servizio: string, dati: R, metodo: MetodoFoglio | null, file: { psc?: File | null; libretto?: File | null } = {}): Promise<EsitoOrdine> {
  const path = `/portale/aziende/${aziendaId}/servizi/ordina`;
  try {
    if (file.psc || file.libretto) {
      const fd = new FormData();
      fd.append('servizio', servizio);
      if (metodo) fd.append('metodo', metodo);
      for (const [k, v] of Object.entries(dati)) {
        if (Array.isArray(v)) v.forEach((x) => fd.append(`dati[${k}][]`, String(x)));
        else if (typeof v === 'boolean') fd.append(`dati[${k}]`, v ? '1' : '0');
        else if (v !== null && v !== undefined) fd.append(`dati[${k}]`, String(v));
      }
      if (file.psc) fd.append('psc', file.psc);
      if (file.libretto) fd.append('libretto', file.libretto);
      const r = await apiUpload<{ data: unknown }>(path, fd);
      return esitoOrdine(rec(r).data);
    }
    const r = await apiRequest<{ data: unknown }>(path, { method: 'POST', body: { servizio, dati, ...(metodo ? { metodo } : {}) } });
    return esitoOrdine(r.data);
  } catch (e) {
    throw errore(e);
  }
}

export async function approvaEPaga(id: number, metodo: MetodoFoglio | null): Promise<EsitoOrdine> {
  return esitoOrdine(await chiama(`/portale/ordini/${id}/approva-paga`, 'POST', metodo ? { metodo } : {}));
}

export async function rifiutaOrdine(id: number, motivo: string): Promise<void> {
  await chiama(`/portale/ordini/${id}/rifiuta`, 'POST', { motivo });
}

export async function sollecita(id: number): Promise<string> {
  return str(rec(await chiama(`/portale/ordini/${id}/sollecita`, 'POST')).messaggio);
}

export async function avvisami(aziendaId: number, servizio: string): Promise<string> {
  return str(rec(await chiama(`/portale/aziende/${aziendaId}/servizi/avvisami`, 'POST', { servizio })).messaggio);
}

export async function caricaPscOrdine(id: number, file: File): Promise<void> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    await apiUpload(`/portale/ordini/${id}/psc`, fd);
  } catch (e) {
    throw errore(e);
  }
}
