/**
 * Condivisione del fascicolo, pagina PUBBLICA (/condivisione/?t=cond_...).
 * L'azienda crea il link dall'area Documenti; chi lo riceve (ispettore,
 * consulente, committente) vede le cartelle scelte in sola lettura fino alla
 * scadenza. Ogni apertura è registrata dal backend. Mai le visite mediche.
 */

import { ApiError, apiRequest } from '@/lib/api';
import { lista, numero, rec, testo } from './api';

export const TOKEN_CONDIVISIONE = /^cond_[A-Za-z0-9]{44}$/;

export interface DocumentoCondiviso {
  titolo: string;
  data: string | null;
  versione: string | null;
  stato: string | null;
  /** Link firmato e breve (alcuni minuti); null se il documento non ha un file. */
  link: string | null;
}

export interface CartellaCondivisa {
  chiave: string;
  nome: string;
  documenti: DocumentoCondiviso[];
}

export interface Condivisione {
  azienda: string;
  destinatario: string | null;
  scadeIl: string | null;
  linkValidiMinuti: number;
  cartelle: CartellaCondivisa[];
  avviso: string | null;
}

const NON_VALIDO = 'Link non valido, revocato o scaduto. Chiedi un nuovo link all’azienda.';

export function mappaCondivisione(raw: unknown): Condivisione {
  const r = rec(raw);
  const cartelle: CartellaCondivisa[] = [];
  for (const c of lista(r.cartelle)) {
    const x = rec(c);
    const chiave = testo(x.chiave);
    if (!chiave) continue;
    const documenti: DocumentoCondiviso[] = [];
    for (const d of lista(x.documenti)) {
      const y = rec(d);
      const titolo = testo(y.titolo);
      if (!titolo) continue;
      const v = y.versione;
      documenti.push({
        titolo,
        data: testo(y.data),
        versione: typeof v === 'number' ? String(v) : testo(v),
        stato: testo(y.stato),
        link: testo(y.link),
      });
    }
    cartelle.push({ chiave, nome: testo(x.nome) ?? chiave, documenti });
  }
  return {
    azienda: testo(r.azienda) ?? 'Azienda',
    destinatario: testo(r.destinatario),
    scadeIl: testo(r.scade_il),
    linkValidiMinuti: numero(r.link_validi_minuti) ?? 15,
    cartelle,
    avviso: testo(r.avviso),
  };
}

/** Giorni interi che mancano alla scadenza (0 = scade oggi); null senza data. */
export function giorniAllaScadenza(scadeIl: string | null, oggi: Date = new Date()): number | null {
  if (!scadeIl) return null;
  const d = new Date(scadeIl);
  if (Number.isNaN(d.getTime())) return null;
  const inizio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((inizio(d) - inizio(oggi)) / 86_400_000));
}

export function totaleDocumenti(c: Condivisione): number {
  return c.cartelle.reduce((n, x) => n + x.documenti.length, 0);
}

export async function apriCondivisione(token: string): Promise<Condivisione> {
  if (!TOKEN_CONDIVISIONE.test(token)) throw new Error(NON_VALIDO);
  try {
    const r = await apiRequest<{ data: unknown }>(`/condivisione/${token}`, { method: 'GET', anonymous: true, cache: 'no-store' });
    return mappaCondivisione(r.data);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) throw new Error(NON_VALIDO);
      if (e.status === 429) throw new Error('Troppe aperture in poco tempo. Riprova tra un minuto.');
      throw new Error('Il servizio non risponde. Riprova tra qualche minuto.');
    }
    throw e instanceof Error ? e : new Error(NON_VALIDO);
  }
}
