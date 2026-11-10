/**
 * Pronto Ispezioni dell'area azienda (regole 12): richiesta con più enti,
 * fasi della richiamata, appunti della chiamata, verbale letto
 * dall'assistente, storico e prescrizioni.
 */
import { ApiError, apiRequest, apiUpload } from '@/lib/api';
import { erroreLeggibile, lista, numero, rec, testo } from './api';
import { ErroreCampi } from './servizi-api';

export const ENTI = [
  { k: 'ASL', t: 'ASL', sotto: 'Azienda sanitaria' },
  { k: 'ITL', t: 'Ispettorato', sotto: 'Ispettorato del lavoro' },
  { k: 'VVF', t: 'Vigili del fuoco', sotto: 'Prevenzione incendi' },
  { k: 'NIL', t: 'Carabinieri NIL', sotto: 'Nucleo ispettorato' },
  { k: 'altro', t: 'Altro ente', sotto: 'Lo dici al tecnico' },
] as const;

export const ESITI = [
  { k: 'nessuna', t: 'Nessuna prescrizione', chip: 'ok' },
  { k: 'prescrizioni', t: 'Prescrizioni da sanare', chip: 'warn' },
  { k: 'sanzione', t: 'Sanzione', chip: 'danger' },
  { k: 'in_attesa', t: 'In attesa del verbale', chip: 'neutral' },
] as const;
export type Esito = (typeof ESITI)[number]['k'];

export const FASI = ['Richiesta ricevuta', 'Tecnico assegnato', 'In chiamata con te'];

export const TIPI_APPUNTO: Record<string, string> = { chiesto: 'Ha chiesto', mostrato: 'Hai mostrato', fare: 'Da fare', consiglio: 'Consiglio del tecnico' };

export interface Appunti {
  tecnico: string;
  ora: string;
  durata: number;
  enti: string;
  punti: Array<{ tipo: string; testo: string }>;
}

export interface Attiva {
  id: number;
  enti: string[];
  entiNomi: string;
  ispettore: string | null;
  telefono: string | null;
  nota: string | null;
  inizio: string | null;
  fase: number;
  tecnico: string | null;
  finita: boolean;
  durata: number | null;
  appunti: Appunti | null;
}

export interface Prescrizione {
  testo: string;
  ente: string;
  norma: string | null;
  entro: string | null;
  fatto: boolean;
  fattoIl: string | null;
}

export interface Lettura {
  numero: string | null;
  data: string | null;
  ore: string | null;
  enti: string[];
  ispettori: string[];
  guardato: string[];
  rilievi: Prescrizione[];
  testo: string[];
  esito: Esito;
  firmatoDa: string | null;
}

export interface IspezioneStorico {
  id: number;
  data: string | null;
  enti: string[];
  ente: string;
  esito: Esito;
  esitoTesto: string;
  verbale: boolean;
  nota: string | null;
  daSistemare: number;
  trascrizione: Lettura | null;
  appunti: Appunti | null;
  puoSistemare: boolean;
}

export interface DocumentoMostra {
  voce: string;
  esito: string;
  messaggio: string | null;
}

export interface SezioneIspezioni {
  minuti: number;
  attiva: Attiva | null;
  ultimoTelefono: string | null;
  documenti: { voci: DocumentoMostra[]; pronti: number; totale: number };
  storico: IspezioneStorico[];
  puoAttivare: boolean;
}

const str = (v: unknown): string => testo(v) ?? '';
const nomi = (v: unknown): string[] => lista(v).map(str).filter(Boolean);
const NOMI_ENTI: Record<string, string> = { ASL: 'ASL Toscana Nord Ovest', ITL: 'Ispettorato territoriale del lavoro', VVF: 'Vigili del fuoco', NIL: 'Carabinieri NIL', altro: 'Altro ente' };

/** "A, B e C" con i nomi completi degli enti. */
export function nomiEnti(codici: string[]): string {
  const n = codici.map((k) => NOMI_ENTI[k] ?? k);
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`;
}

export const nomeEnte = (k: string): string => NOMI_ENTI[k] ?? k;

function appunti(v: unknown): Appunti | null {
  if (!v || typeof v !== 'object') return null;
  const a = rec(v);
  return { tecnico: str(a.tecnico), ora: str(a.ora), durata: numero(a.durata) ?? 0, enti: str(a.enti), punti: lista(a.punti).map((p) => ({ tipo: str(rec(p).tipo), testo: str(rec(p).testo) })) };
}

function prescrizione(v: unknown): Prescrizione {
  const p = rec(v);
  return { testo: str(p.testo), ente: str(p.ente), norma: testo(p.norma), entro: testo(p.entro), fatto: p.fatto === true, fattoIl: testo(p.fatto_il) };
}

export function mappaLettura(v: unknown): Lettura | null {
  if (!v || typeof v !== 'object') return null;
  const l = rec(v);
  const e = str(l.esito) as Esito;
  return {
    numero: testo(l.numero), data: testo(l.data), ore: testo(l.ore), enti: nomi(l.enti), ispettori: nomi(l.ispettori), guardato: nomi(l.guardato),
    rilievi: lista(l.rilievi).map(prescrizione), testo: nomi(l.testo), esito: ESITI.some((x) => x.k === e) ? e : 'nessuna', firmatoDa: testo(l.firmato_da),
  };
}

export function mappaIspezione(v: unknown): IspezioneStorico {
  const i = rec(v);
  const e = str(i.esito) as Esito;
  return {
    id: numero(i.id) ?? 0, data: testo(i.data), enti: nomi(i.enti), ente: str(i.ente), esito: ESITI.some((x) => x.k === e) ? e : 'in_attesa', esitoTesto: str(i.esito_testo),
    verbale: i.verbale === true, nota: testo(i.nota), daSistemare: numero(i.da_sistemare) ?? 0, trascrizione: mappaLettura(i.trascrizione), appunti: appunti(i.appunti),
    puoSistemare: i.puo_sistemare === true,
  };
}

export function mappaSezioneIspezioni(raw: unknown): SezioneIspezioni {
  const d = rec(raw);
  const a = d.attiva ? rec(d.attiva) : null;
  const doc = rec(d.documenti);
  return {
    minuti: numero(d.minuti_richiamata) ?? 15,
    attiva: a
      ? { id: numero(a.id) ?? 0, enti: nomi(a.enti), entiNomi: str(a.enti_nomi), ispettore: testo(a.ispettore), telefono: testo(a.telefono), nota: testo(a.nota), inizio: testo(a.inizio),
          fase: numero(a.fase) ?? 0, tecnico: testo(a.tecnico), finita: a.finita === true, durata: numero(a.durata), appunti: appunti(a.appunti) }
      : null,
    ultimoTelefono: testo(d.ultimo_telefono),
    documenti: { voci: lista(doc.voci).map((x) => ({ voce: str(rec(x).voce), esito: str(rec(x).esito), messaggio: testo(rec(x).messaggio) })), pronti: numero(doc.pronti) ?? 0, totale: numero(doc.totale) ?? 0 },
    storico: lista(d.storico).map(mappaIspezione),
    puoAttivare: d.puo_attivare === true,
  };
}

/** Secondi rimasti alla richiamata (da 15:00 a 00:00). */
export function secondiRimasti(inizio: string | null, minuti: number, ora: number = Date.now()): number {
  if (!inizio) return minuti * 60;
  const t = new Date(inizio).getTime();
  return Math.max(0, Math.round((t + minuti * 60_000 - ora) / 1000));
}

export const mmss = (s: number): string => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const cifre = (t: string): number => t.replace(/\D+/g, '').length;

function errore(e: unknown): Error {
  if (e instanceof ApiError) {
    const campi = rec(rec(e.body).errori);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(campi)) if (typeof v === 'string') out[k] = v;
    if (Object.keys(out).length) return new ErroreCampi(Object.values(out)[0], out);
  }
  return erroreLeggibile(e);
}

async function chiama<T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<T> {
  try {
    return (await apiRequest<{ data: unknown }>(path, { method, body, cache: method === 'GET' ? 'no-store' : undefined })).data as T;
  } catch (e) {
    throw errore(e);
  }
}

export const sezioneIspezioni = async (aziendaId: number): Promise<SezioneIspezioni> => mappaSezioneIspezioni(await chiama(`/portale/aziende/${aziendaId}/ispezioni`, 'GET'));

export async function chiediRichiamata(aziendaId: number, d: { enti: string[]; telefono: string; ispettore: string; nota: string }): Promise<{ sezione: SezioneIspezioni; messaggio: string }> {
  const r = await chiama(`/portale/aziende/${aziendaId}/ispezioni/richiesta`, 'POST', d);
  return { sezione: mappaSezioneIspezioni(r), messaggio: str(rec(r).messaggio) };
}

export async function leggiVerbale(aziendaId: number, file: File, enti: string[]): Promise<{ bozza: string; file: string; lettura: Lettura | null }> {
  const fd = new FormData();
  fd.append('file', file);
  enti.forEach((e) => fd.append('enti[]', e));
  try {
    const r = rec(rec(await apiUpload(`/portale/aziende/${aziendaId}/ispezioni/leggi-verbale`, fd)).data);
    return { bozza: str(r.bozza), file: str(r.file), lettura: mappaLettura(r.lettura) };
  } catch (e) {
    throw errore(e);
  }
}

export async function salvaVerbale(aziendaId: number, d: { enti: string[]; esito: Esito; data: string; nota: string; bozza: string | null }): Promise<{ titolo: string; messaggio: string }> {
  const r = rec(await chiama(`/portale/aziende/${aziendaId}/ispezioni/verbale`, 'POST', d));
  return { titolo: str(r.titolo), messaggio: str(r.messaggio) };
}

export const dettaglioVerbale = async (id: number): Promise<IspezioneStorico> => mappaIspezione(await chiama(`/portale/ispezioni/${id}/dettaglio`, 'GET'));

export async function segnaSistemata(id: number, indice: number): Promise<{ ispezione: IspezioneStorico; messaggio: string }> {
  const r = await chiama(`/portale/ispezioni/${id}/prescrizioni/${indice}/sistemata`, 'POST');
  return { ispezione: mappaIspezione(r), messaggio: str(rec(r).messaggio) };
}

export const percorsoFileVerbale = (id: number): string => `/portale/ispezioni/${id}/file`;
