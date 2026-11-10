/**
 * "Carica il PSC" (SPEC_GESTIONALE 11): link a scadenza che il tecnico manda al
 * committente o al coordinatore. La pagina pubblica (/psc/?t=psc_...) mostra
 * solo cantiere e impresa e riceve il file una volta sola, senza account.
 */

import { ApiError, apiRequest, apiUpload } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';

export const TOKEN_PSC = /^psc_[A-Za-z0-9]{44}$/;
export const FORMATI_PSC = ['pdf', 'doc', 'docx'] as const;
export const MB_MASSIMI_PSC = 20;

export interface PscPubblico {
  impresa: string | null;
  cantiere: string | null;
  indirizzo: string | null;
  destinatario: string | null;
  scadeIl: string | null;
  aperta: boolean;
  caricatoIl: string | null;
  avviso: string | null;
  /** PSC del committente per un ordine dell'azienda (regole 11.5): pagina del coordinatore, Stato A e Stato B. */
  ordine: PscOrdinePubblico | null;
}

export interface PscOrdinePubblico {
  stato: 'attesa' | 'caricato';
  azienda: string | null;
  piva: string | null;
  richiedente: string | null;
  servizio: string | null;
  indirizzo: string | null;
  committente: string | null;
  inizio: string | null;
  fine: string | null;
  scadeIl: string | null;
  file: string | null;
  caricatoIl: string | null;
  caricatoDaAzienda: boolean;
}

export const FORMATI_PSC_ORDINE = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp'] as const;
export const MB_PSC_ORDINE = 50;

/** PDF o immagine, fino a 50 MB. */
export function controllaFilePscOrdine(nome: string, byte: number): string | null {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (!(FORMATI_PSC_ORDINE as readonly string[]).includes(ext)) return 'Carica il PSC in PDF o come immagine.';
  if (byte > MB_PSC_ORDINE * 1024 * 1024) return `Il file supera ${MB_PSC_ORDINE} MB.`;
  if (byte === 0) return 'Il file è vuoto.';
  return null;
}

export type StatoRichiestaPsc = 'in_attesa' | 'caricato' | 'revocato' | 'scaduto';

export interface RichiestaPsc {
  id: number;
  destinatario: string;
  scadeIl: string | null;
  stato: StatoRichiestaPsc;
  caricatoIl: string | null;
  caricatoDa: string | null;
}

const NON_VALIDO = 'Link non valido o revocato. Chiedi un nuovo link al tecnico che segue il cantiere.';

export function mappaPscPubblico(raw: unknown): PscPubblico {
  const r = rec(raw);
  return {
    impresa: testo(r.impresa),
    cantiere: testo(r.cantiere),
    indirizzo: testo(r.indirizzo),
    destinatario: testo(r.destinatario),
    scadeIl: testo(r.scade_il),
    aperta: r.aperta === true,
    caricatoIl: testo(r.caricato_il),
    avviso: testo(r.avviso),
    ordine: r.tipo === 'ordine' ? mappaOrdinePubblico(r) : null,
  };
}

function mappaOrdinePubblico(r: Record<string, unknown>): PscOrdinePubblico {
  const c = rec(r.cantiere);
  return {
    stato: r.stato === 'caricato' ? 'caricato' : 'attesa',
    azienda: testo(r.azienda),
    piva: testo(r.piva),
    richiedente: testo(r.richiedente),
    servizio: testo(r.servizio),
    indirizzo: testo(c.indirizzo),
    committente: testo(c.committente),
    inizio: testo(c.inizio),
    fine: testo(c.fine),
    scadeIl: testo(r.scade_il),
    file: testo(r.file),
    caricatoIl: testo(r.caricato_il),
    caricatoDaAzienda: r.caricato_da_tipo === 'azienda',
  };
}

const STATI: StatoRichiestaPsc[] = ['in_attesa', 'caricato', 'revocato', 'scaduto'];

export function mappaRichiestaPsc(raw: unknown): RichiestaPsc | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  return {
    id,
    destinatario: testo(r.destinatario) ?? '',
    scadeIl: testo(r.scade_il),
    stato: STATI.includes(r.stato as StatoRichiestaPsc) ? (r.stato as StatoRichiestaPsc) : 'in_attesa',
    caricatoIl: testo(r.caricato_il),
    caricatoDa: testo(r.caricato_da),
  };
}

/** Controllo prima dell'invio: formato e dimensione, con un messaggio chiaro. */
export function controllaFilePsc(nome: string, byte: number): string | null {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (!(FORMATI_PSC as readonly string[]).includes(ext)) return 'Carica il PSC in PDF o Word (.pdf, .doc, .docx).';
  if (byte > MB_MASSIMI_PSC * 1024 * 1024) return `Il file supera ${MB_MASSIMI_PSC} MB: comprimilo o dividilo.`;
  if (byte === 0) return 'Il file è vuoto.';
  return null;
}

function errorePubblico(e: unknown): Error {
  if (e instanceof ApiError) {
    const b = rec(e.body);
    if (e.status === 404) return new Error(NON_VALIDO);
    if (e.status === 429) return new Error('Troppi tentativi in poco tempo. Riprova tra un minuto.');
    const errs = Object.values(rec(b.errors)).map((x) => lista(x)[0]).find((x) => typeof x === 'string') as string | undefined;
    return new Error(errs ?? testo(b.message) ?? 'Caricamento non riuscito. Riprova.');
  }
  return e instanceof Error ? e : new Error('Caricamento non riuscito. Riprova.');
}

export async function apriLinkPsc(token: string): Promise<PscPubblico> {
  if (!TOKEN_PSC.test(token)) throw new Error(NON_VALIDO);
  try {
    const r = await apiRequest<{ data: unknown }>(`/psc/${token}`, { method: 'GET', anonymous: true, cache: 'no-store' });
    return mappaPscPubblico(r.data);
  } catch (e) {
    throw errorePubblico(e);
  }
}

export async function caricaPsc(token: string, file: File, nome: string, onProgresso?: (p: number) => void): Promise<void> {
  if (!TOKEN_PSC.test(token)) throw new Error(NON_VALIDO);
  const fd = new FormData();
  fd.append('file', file);
  if (nome.trim()) fd.append('nome', nome.trim());
  try {
    await apiUpload(`/psc/${token}`, fd, onProgresso);
  } catch (e) {
    throw errorePubblico(e);
  }
}

/** Il coordinatore carica (anche di nuovo) il PSC di un ordine, con una nota facoltativa per l'impresa. */
export async function caricaPscOrdinePubblico(token: string, file: File, nota: string, onProgresso?: (p: number) => void): Promise<void> {
  if (!TOKEN_PSC.test(token)) throw new Error(NON_VALIDO);
  const fd = new FormData();
  fd.append('file', file);
  if (nota.trim()) fd.append('nota', nota.trim());
  try {
    await apiUpload(`/psc/${token}`, fd, onProgresso);
  } catch (e) {
    throw errorePubblico(e);
  }
}

// ---------------------------------------------------------------- lato studio

export async function richiestePsc(cantiereId: number): Promise<RichiestaPsc[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/cantieri/${cantiereId}/richieste-psc`)).data)
    .map(mappaRichiestaPsc)
    .filter((x): x is RichiestaPsc => x !== null);
}

export async function creaLinkPsc(cantiereId: number, destinatario: string, giorni: number): Promise<{ richiesta: RichiestaPsc | null; link: string }> {
  if (!isApiMode()) throw new Error('Disponibile solo con il collegamento al server.');
  const d = rec(rec(await manda(`/cantieri/${cantiereId}/richieste-psc`, { destinatario, giorni })).data);
  return { richiesta: mappaRichiestaPsc(d.richiesta), link: testo(d.link) ?? '' };
}

export async function revocaLinkPsc(id: number): Promise<void> {
  if (!isApiMode()) throw new Error('Disponibile solo con il collegamento al server.');
  await manda(`/richieste-psc/${id}`, undefined, 'DELETE');
}
