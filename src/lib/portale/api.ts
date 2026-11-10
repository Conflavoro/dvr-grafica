/**
 * Chiamate comuni delle tre app (ADR-009): novita' in app, suggerimenti del Falco
 * di sezione, aziende dell'utente. Ogni risposta passa da un mappatore tollerante:
 * un campo mancante o strano non rompe la pagina.
 * Le sezioni aggiungono le loro chiamate in file propri (lib/portale/<area>.ts).
 */

import { ApiError, apiRequest, clearApiCache, quandoSvuoti } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';

// ---------------------------------------------------------------- utilita'

export const testo = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
export const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
export const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Errore leggibile per le persone, dal codice HTTP e dal messaggio del backend. */
export function erroreLeggibile(e: unknown, riserva = 'Operazione non riuscita. Riprova.'): Error {
  if (e instanceof ApiError) {
    const b = rec(e.body);
    const errs = rec(b.errors);
    const primo = Object.values(errs).map((x) => lista(x)[0]).find((x) => typeof x === 'string') as string | undefined;
    const msg = primo ?? testo(b.message);
    if (e.status === 403) return new Error(msg && !/forbidden|unauthorized|this action/i.test(msg) ? msg : 'Con il tuo ruolo questa azione non è disponibile.');
    if (e.status === 404) return new Error('Non trovato o non più disponibile.');
    // Demo dal vivo: tetto giornaliero raggiunto, il messaggio del backend dice già cosa fare.
    if (e.status === 429 && b.codice === 'tetto_demo' && msg) return new Error(msg);
    if (e.status === 429) return new Error('Troppe richieste in poco tempo. Riprova tra un minuto.');
    if (e.status >= 500) return new Error('Il server ha avuto un problema. Riprova tra qualche minuto.');
    return new Error(msg ?? riserva);
  }
  return e instanceof Error ? e : new Error(riserva);
}

/**
 * Letture del portale tenute per pochi secondi (Rocco 10/11: "continua a caricarsi la pagina
 * quando passo da una sezione all'altra"): tornando su una sezione appena vista i dati
 * compaiono subito. Ogni scrittura, ogni evento del tempo reale e il cambio utente svuotano
 * tutto, quindi non si vede mai un dato vecchio dopo una modifica.
 */
const LETTURE_MS = 20_000;
const letture = new Map<string, { ts: number; dato: Promise<unknown> }>();
quandoSvuoti(() => letture.clear());

export function svuotaLetture(): void {
  letture.clear();
}

export async function prendi<T = unknown>(path: string): Promise<T> {
  const c = letture.get(path);
  if (c && Date.now() - c.ts < LETTURE_MS) return c.dato as Promise<T>;
  const dato = apiRequest<T>(path, { method: 'GET', cache: 'no-store' }).catch((e) => {
    letture.delete(path);
    throw erroreLeggibile(e);
  });
  letture.set(path, { ts: Date.now(), dato });
  return dato;
}

export async function manda<T = unknown>(path: string, body?: unknown, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST'): Promise<T> {
  try {
    return await apiRequest<T>(path, { method, body: body as Record<string, unknown> | undefined });
  } catch (e) {
    throw erroreLeggibile(e);
  } finally {
    clearApiCache();
  }
}

// ---------------------------------------------------------------- novita' (campanella)

export interface Novita {
  id: number;
  categoria: string;
  evento: string;
  titolo: string;
  testo: string | null;
  priorita: 'normale' | 'alta';
  link: { app: string | null; sezione: string | null; oggetto_tipo: string | null; oggetto_id: number | null; azienda_id: number | null };
  azienda: { id: number; ragione_sociale: string } | null;
  letta: boolean;
  creato: string | null;
}

export function mappaNovita(raw: unknown): Novita | null {
  const r = rec(raw);
  const id = numero(r.id);
  const titolo = testo(r.titolo);
  if (id === null || !titolo) return null;
  const l = rec(r.link);
  const a = rec(r.azienda);
  return {
    id,
    categoria: testo(r.categoria) ?? 'assistenza',
    evento: testo(r.evento) ?? '',
    titolo,
    testo: testo(r.testo),
    priorita: r.priorita === 'alta' ? 'alta' : 'normale',
    link: { app: testo(l.app), sezione: testo(l.sezione), oggetto_tipo: testo(l.oggetto_tipo), oggetto_id: numero(l.oggetto_id), azienda_id: numero(l.azienda_id) },
    azienda: numero(a.id) !== null ? { id: numero(a.id)!, ragione_sociale: testo(a.ragione_sociale) ?? '' } : null,
    letta: r.letto_il != null,
    creato: testo(r.creato),
  };
}

export async function novita(opz: { nonLette?: boolean; pagina?: number } = {}): Promise<{ voci: Novita[]; nonLette: number }> {
  if (!isApiMode()) return { voci: [], nonLette: 0 };
  const q = new URLSearchParams();
  if (opz.nonLette) q.set('non_lette', '1');
  if (opz.pagina) q.set('page', String(opz.pagina));
  const r = rec(await prendi(`/novita${q.toString() ? `?${q}` : ''}`));
  return {
    voci: lista(r.data).map(mappaNovita).filter((x): x is Novita => x !== null),
    nonLette: numero(rec(r.meta).non_lette) ?? 0,
  };
}

export async function segnaLetta(id: number): Promise<number> {
  const r = rec(await manda(`/novita/${id}/letta`));
  return numero(rec(r.meta).non_lette) ?? 0;
}

export async function segnaTutteLette(): Promise<number> {
  const r = rec(await manda('/novita/lette'));
  return numero(rec(r.meta).non_lette) ?? 0;
}

// ---------------------------------------------------------------- Falco di sezione

export interface Suggerimento {
  etichetta: string;
  richiesta: string;
  cambiaDati: boolean;
}

export interface OggettoAperto {
  tipo: string;
  id: number;
}

export function mappaSuggerimenti(raw: unknown): Suggerimento[] {
  const d = rec(rec(raw).data);
  return lista(d.suggerimenti)
    .map((x) => {
      const s = rec(x);
      const etichetta = testo(s.etichetta);
      const richiesta = testo(s.richiesta);
      return etichetta && richiesta ? { etichetta, richiesta, cambiaDati: s.cambia_dati === true } : null;
    })
    .filter((x): x is Suggerimento => x !== null)
    .slice(0, 5);
}

export async function suggerimenti(sezione: string, aziendaId: number | null, oggetto: OggettoAperto | null): Promise<Suggerimento[]> {
  if (!isApiMode()) return [];
  const q = new URLSearchParams({ sezione });
  if (aziendaId) q.set('azienda_id', String(aziendaId));
  if (oggetto) {
    q.set('oggetto_tipo', oggetto.tipo);
    q.set('oggetto_id', String(oggetto.id));
  }
  return mappaSuggerimenti(await prendi(`/agente/suggerimenti?${q}`));
}

// ---------------------------------------------------------------- aziende dell'utente

export interface AziendaPortale {
  id: number;
  ragione_sociale: string;
  ruoli: string[];
  permessi: string[];
  /** Cliente nuovo in attivazione: l'area mostra solo il percorso (o il benvenuto). */
  attivazione?: { stato: string; benvenuto: boolean } | null;
  /** Sezioni del ruolo come le calcola il server (RuoliAzienda::sezioni, 06 §3). */
  sezioni?: string[];
  /** Sedi che l'utente vede: selettore della sede e filtro ?sede delle API. */
  sedi?: Array<{ id: number; nome: string; insegna: string | null; indirizzo: string | null; alimentare: boolean }>;
  /** Numero di sedi alimentari: accende la voce HACCP. */
  sedi_alimentari?: number | null;
  /** Fascicolo validato: "Completa il fascicolo" sparisce. */
  fascicolo_completo?: boolean | null;
}

export async function aziendePortale(): Promise<AziendaPortale[]> {
  if (!isApiMode()) return [];
  const r = rec(await prendi('/portale/aziende'));
  return lista(r.data)
    .map((x): AziendaPortale | null => {
      const a = rec(x);
      const id = numero(a.id);
      const at = a.attivazione ? rec(a.attivazione) : null;
      return id === null
        ? null
        : {
            id,
            ragione_sociale: testo(a.ragione_sociale) ?? '',
            ruoli: lista(a.ruoli).map(String),
            permessi: lista(a.permessi).map(String),
            attivazione: at ? { stato: testo(at.stato) ?? 'in_corso', benvenuto: at.benvenuto === true } : null,
            ...(Array.isArray(a.sezioni) ? { sezioni: lista(a.sezioni).map(String) } : {}),
            sedi: lista(a.sedi)
              .map((x) => rec(x))
              .filter((x) => (numero(x.id) ?? 0) > 0)
              .map((x) => ({ id: numero(x.id)!, nome: testo(x.nome) ?? testo(x.insegna) ?? `Sede ${numero(x.id)}`, insegna: testo(x.insegna), indirizzo: testo(x.indirizzo), alimentare: x.alimentare === true })),
            sedi_alimentari: numero(a.sedi_alimentari),
            fascicolo_completo: typeof a.fascicolo_completo === 'boolean' ? a.fascicolo_completo : null,
          };
    })
    .filter((x): x is AziendaPortale => x !== null);
}
