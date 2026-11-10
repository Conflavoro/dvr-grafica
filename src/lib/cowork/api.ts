/**
 * Chiamate del contratto cowork.v1 (docs/integrazioni/COWORK_API.md).
 * Ogni errore diventa un CoworkErrore con il codice HTTP, cosi' la pagina sa
 * distinguere il conflitto di versione (409), i bloccanti (422), il motore spento (404).
 */

import { ApiError, apiRequest, apiUrl, getToken } from '@/lib/api';
import { fetchConTempo } from '@/lib/attesa';
import { isApiMode } from '@/lib/data-source';
import { mappaControlli, mappaDocumentiAzienda, mappaDocumento, mappaFlusso, mappaParagrafo, mappaSezione } from './mappa';
import type { Controlli, Documento, DocumentoAzienda, EventoFlusso, Paragrafo, Sezione } from './tipi';

export const BASE = '/cowork/v1';

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export interface Aperto {
  tipo: 'paragrafo' | 'controllo';
  id: number;
  sezione: string | null;
  testo: string;
}

export class CoworkErrore extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** 409: il paragrafo com'e' adesso, se il backend lo rimanda. */
    public readonly paragrafo: Paragrafo | null = null,
    /** 422 dell'approvazione: paragrafi e controlli ancora aperti. */
    public readonly aperti: Aperto[] = [],
  ) {
    super(message);
    this.name = 'CoworkErrore';
  }
}

function messaggioPer(status: number, corpo: Record<string, unknown>): string {
  const errori = rec(corpo.errors);
  const primo = Object.values(errori).map((x) => (Array.isArray(x) ? x[0] : null)).find((x) => typeof x === 'string') as string | undefined;
  const msg = primo ?? (typeof corpo.message === 'string' && corpo.message.trim() ? corpo.message : null);
  switch (status) {
    case 0:
      return 'Connessione assente. Controlla la rete e riprova.';
    case 401:
      return 'La sessione è scaduta: rientra per continuare.';
    case 403:
      return 'Con il tuo ruolo questa azione non è disponibile. Le bozze dell’assistente sono lavoro dello studio.';
    case 404:
      return 'Documento non trovato o non più disponibile.';
    case 408:
      return 'Il server ci mette troppo. Riprova tra poco.';
    case 409:
      return 'Qualcuno ha cambiato questo paragrafo nel frattempo. Ho ricaricato il testo attuale: controllalo e riprova.';
    case 422:
      return msg ?? 'Azione non ammessa in questo momento.';
    case 429:
      return 'Troppe richieste in poco tempo. Riprova tra un minuto.';
    case 503:
      return 'La stesura non è riuscita. Puoi riprovare.';
    default:
      return status >= 500 ? 'Il server ha avuto un problema. Riprova tra qualche minuto.' : (msg ?? 'Operazione non riuscita. Riprova.');
  }
}

/** Converte un errore della rete o del backend in CoworkErrore (esportata per le prove). */
export function inErrore(e: unknown): CoworkErrore {
  if (e instanceof CoworkErrore) return e;
  if (e instanceof ApiError) {
    const corpo = rec(e.body);
    const par = corpo.paragrafo ? mappaParagrafo(corpo.paragrafo) : null;
    const aperti: Aperto[] = [
      ...(Array.isArray(corpo.paragrafi_aperti) ? corpo.paragrafi_aperti : []).map((x): Aperto | null => {
        const r = rec(x);
        return typeof r.id === 'number' ? { tipo: 'paragrafo', id: r.id, sezione: r.sezione != null ? String(r.sezione) : null, testo: typeof r.stato === 'string' ? r.stato : '' } : null;
      }),
      ...(Array.isArray(corpo.controlli_aperti) ? corpo.controlli_aperti : []).map((x): Aperto | null => {
        const r = rec(x);
        return typeof r.id === 'number' ? { tipo: 'controllo', id: r.id, sezione: r.sezione != null ? String(r.sezione) : null, testo: typeof r.messaggio === 'string' ? r.messaggio : '' } : null;
      }),
    ].filter((x): x is Aperto => x !== null);
    return new CoworkErrore(e.status, messaggioPer(e.status, corpo), par, aperti);
  }
  return new CoworkErrore(0, e instanceof Error && e.message ? e.message : 'Operazione non riuscita.');
}

async function leggi(path: string): Promise<unknown> {
  try {
    return await apiRequest(path, { method: 'GET', cache: 'no-store' });
  } catch (e) {
    throw inErrore(e);
  }
}

async function scrivi(path: string, corpo?: Record<string, unknown>): Promise<unknown> {
  try {
    return await apiRequest(path, { method: 'POST', body: corpo ?? {} });
  } catch (e) {
    throw inErrore(e);
  }
}

const SENZA_API = () => new CoworkErrore(-1, 'La Scrivania lavora sui dati veri dello studio: si apre con il backend collegato.');

// ---------------------------------------------------------------- letture

export async function documentiAzienda(aziendaId: number): Promise<DocumentoAzienda[]> {
  if (!isApiMode()) return [];
  return mappaDocumentiAzienda(await leggi(`${BASE}/aziende/${aziendaId}/documenti`));
}

export async function documento(tipo: string, id: number): Promise<Documento> {
  if (!isApiMode()) throw SENZA_API();
  const d = mappaDocumento(await leggi(`${BASE}/documenti/${tipo}/${id}`));
  if (!d) throw new CoworkErrore(500, 'Risposta del server non leggibile.');
  return d;
}

export async function sezione(tipo: string, id: number, chiave: string): Promise<Sezione> {
  if (!isApiMode()) throw SENZA_API();
  const s = mappaSezione(await leggi(`${BASE}/documenti/${tipo}/${id}/sezioni/${encodeURIComponent(chiave)}`));
  if (!s) throw new CoworkErrore(500, 'Risposta del server non leggibile.');
  return s;
}

export async function controlli(tipo: string, id: number): Promise<Controlli> {
  if (!isApiMode()) throw SENZA_API();
  return mappaControlli(await leggi(`${BASE}/documenti/${tipo}/${id}/controlli`));
}

export type EsitoFlusso = { esito: 'eventi'; voci: EventoFlusso[]; cursore: string | null } | { esito: 'niente'; cursore: string | null } | { esito: 'assente' };

/**
 * Flusso dei cambiamenti (fase 7). 'assente' quando l'endpoint non c'e' ancora
 * (404 o 405): la pagina passa alla ricarica periodica dello stato.
 */
export async function flusso(aziendaId: number, cursore: string | null): Promise<EsitoFlusso> {
  const q = cursore ? `?dal=${encodeURIComponent(cursore)}` : '';
  let r: unknown;
  try {
    r = await apiRequest(`${BASE}/aziende/${aziendaId}/flusso${q}`, { method: 'GET', cache: 'no-store' });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) return { esito: 'assente' };
    throw inErrore(e);
  }
  // 204: apiRequest restituisce null.
  if (r === null || r === undefined) return { esito: 'niente', cursore };
  const f = mappaFlusso(r);
  return f.voci.length === 0 ? { esito: 'niente', cursore: f.cursore ?? cursore } : { esito: 'eventi', voci: f.voci, cursore: f.cursore ?? cursore };
}

// ---------------------------------------------------------------- azioni sui paragrafi

interface EsitoParagrafo {
  paragrafo: Paragrafo;
  statoDocumento: string | null;
}

const esitoParagrafo = (r: unknown): EsitoParagrafo => {
  const x = rec(r);
  const p = mappaParagrafo(x.paragrafo);
  if (!p) throw new CoworkErrore(500, 'Risposta del server non leggibile.');
  const d = rec(x.documento);
  return { paragrafo: p, statoDocumento: typeof d.stato === 'string' ? d.stato : null };
};

export const accetta = async (p: Paragrafo) => esitoParagrafo(await scrivi(`${BASE}/paragrafi/${p.id}/accetta`, { versione_base: p.versioneBase }));
export const modifica = async (p: Paragrafo, testo: string) => esitoParagrafo(await scrivi(`${BASE}/paragrafi/${p.id}/modifica`, { versione_base: p.versioneBase, testo }));
export const nonApplicabile = async (p: Paragrafo, motivo: string) => esitoParagrafo(await scrivi(`${BASE}/paragrafi/${p.id}/non-applicabile`, { versione_base: p.versioneBase, motivo: motivo.trim() }));
export const riscrivi = async (p: Paragrafo, istruzione: string) => esitoParagrafo(await scrivi(`${BASE}/paragrafi/${p.id}/riscrivi`, { versione_base: p.versioneBase, istruzione: istruzione.trim() }));
export const rigenera = async (p: Paragrafo) => esitoParagrafo(await scrivi(`${BASE}/paragrafi/${p.id}/rigenera`, { versione_base: p.versioneBase }));

export async function accettaTuttaSezione(tipo: string, id: number, chiave: string): Promise<number> {
  const r = rec(await scrivi(`${BASE}/documenti/${tipo}/${id}/sezioni/${encodeURIComponent(chiave)}/accetta`));
  return typeof r.accettati === 'number' ? r.accettati : 0;
}

// ---------------------------------------------------------------- controlli

export async function eseguiControllo(id: number): Promise<string | null> {
  const r = rec(await scrivi(`${BASE}/controlli/${id}/azione`));
  const nota = rec(r.esito).nota;
  return typeof nota === 'string' ? nota : null;
}

export async function accettaControllo(id: number, motivo: string): Promise<void> {
  await scrivi(`${BASE}/controlli/${id}/accetta`, { motivo: motivo.trim() });
}

// ---------------------------------------------------------------- approvazione e anteprima

/** Approvazione del titolare: con il motore acceso risponde 422 con l'elenco di cosa e' aperto. */
export async function approva(dvrId: number): Promise<void> {
  await scrivi(`/dvr/${dvrId}/approve`);
}

export async function anteprima(tipo: string, id: number, formato: 'pdf' | 'docx', nome: string): Promise<void> {
  const token = getToken();
  const res = await fetchConTempo(apiUrl(`${BASE}/documenti/${tipo}/${id}/anteprima.${formato}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new CoworkErrore(res.status, res.status === 429 ? 'Troppe anteprime in poco tempo. Riprova tra un minuto.' : 'Anteprima non disponibile. Riprova.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const attivi = new Map<number, Promise<boolean>>();

/**
 * Il motore cowork e' acceso per l'azienda? (con COWORK_ATTIVO=false tutte le rotte
 * rispondono 404). Una lettura per azienda e per sessione: serve a mostrare i collegamenti.
 */
export function coworkAttivo(aziendaId: number): Promise<boolean> {
  if (!isApiMode()) return Promise.resolve(false);
  let p = attivi.get(aziendaId);
  if (!p) {
    p = leggi(`${BASE}/aziende/${aziendaId}/documenti`).then(
      () => true,
      (e: CoworkErrore) => {
        // Rete o limite: non si sa, si riprova alla prossima occasione.
        if (e.status !== 404 && e.status !== 403) attivi.delete(aziendaId);
        return false;
      },
    );
    attivi.set(aziendaId, p);
  }
  return p;
}

/** Percorso della Scrivania per un DVR (il guscio legge ?azienda= e sceglie il cliente). */
export function percorsoScrivania(dvrId: number, aziendaId: number | null, sezioneChiave?: string | null): string {
  const q = new URLSearchParams();
  if (aziendaId) q.set('azienda', String(aziendaId));
  q.set('cowork', String(dvrId));
  if (sezioneChiave) q.set('sezione', sezioneChiave);
  return `/gestionale/dvr/?${q.toString()}`;
}
