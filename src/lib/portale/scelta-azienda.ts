/**
 * Cliente scelto nel gestionale (richiesta di Rocco del 19/10): lo staff dello studio
 * sceglie l'azienda una volta, in cima al menu, e ogni schermata dedicata ai clienti
 * lavora solo su quella. Qui solo logica pura (senza React), provata con Jest:
 * memoria della scelta per utente, lettura dal link, classificazione delle sezioni,
 * elenco del selettore e filtri dello storico del Falco.
 */

import { filtraAziende, FILTRO_AZIENDE_INIZIALE, type AziendaIndice, type PreferenzeAziende } from '@/lib/agente-aziende';
import type { AgenteConversazione } from '@/lib/data-source';
import { trovaSezione, type AppPortale } from './sezioni';

// ---------------------------------------------------------------- memoria della scelta

/** Ruoli dello studio che scelgono il cliente (il medico esterno no: ha il suo portale). */
export const RUOLI_STAFF = ['consulente', 'titolare_studio', 'admin_conflavoro'] as const;

export function sceglieCliente(ruolo: string | null | undefined): boolean {
  return !!ruolo && (RUOLI_STAFF as readonly string[]).includes(ruolo);
}

export const chiaveScelta = (userId: number) => `crm_dvr_portale_cliente:u${userId}`;

/** Azienda scelta l'ultima volta da questo utente in questo browser (null se nessuna o storage non disponibile). */
export function leggiScelta(userId: number): number | null {
  try {
    const v = Number(window.localStorage.getItem(chiaveScelta(userId)));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function scriviScelta(userId: number, id: number | null): void {
  try {
    if (id) window.localStorage.setItem(chiaveScelta(userId), String(id));
    else window.localStorage.removeItem(chiaveScelta(userId));
  } catch {
    /* solo comodita': senza storage la scelta vale per la sessione */
  }
}

/** ?azienda=12 nel link porta gia' sull'azienda. */
export function aziendaDaUrl(search: string): number | null {
  try {
    const v = Number(new URLSearchParams(search).get('azienda'));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Il link senza ?azienda= (la scelta passa nella memoria, il link non deve riportarla indietro). */
export function senzaAziendaUrl(search: string): string {
  const q = new URLSearchParams(search);
  q.delete('azienda');
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------- sezioni

/**
 * Schermate dello studio intero: con un cliente scelto mostrano il filtro "Solo <azienda>".
 * Pronto Ispezioni e' la scrivania del tecnico di turno: un controllo arriva da qualunque cliente.
 * Giornata delle visite, laboratorio e portale del medico sono il lavoro dei partner esterni
 * (centro, laboratorio, medico) su piu' clienti: non chiedono di scegliere il cliente, altrimenti
 * il partner, che non ha il selettore, non entra.
 */
export const SEZIONI_DI_STUDIO = ['coda', 'aziende', 'cruscotto', 'aggiornamenti', 'ispezioni', 'giornata', 'laboratorio', 'medico'] as const;

export type TipoSezione = 'azienda' | 'studio' | 'libera';

/**
 * Nel gestionale ogni sezione di lavoro sul cliente e' "azienda": senza scelta mostra
 * "Scegli il cliente". Le schermate di studio restano di tutto lo studio. "tutto" e le
 * sezioni sconosciute sono libere. Nell'area azienda l'azienda e' gia' quella dell'utente.
 */
export function tipoSezione(app: AppPortale, chiave: string): TipoSezione {
  if (app !== 'gestionale' || chiave === 'tutto' || !trovaSezione(app, chiave)) return 'libera';
  return (SEZIONI_DI_STUDIO as readonly string[]).includes(chiave) ? 'studio' : 'azienda';
}

// ---------------------------------------------------------------- elenco del selettore

export interface ElencoSelettore {
  /** Con una ricerca: un solo gruppo ordinato per nome. */
  gruppi: Array<{ titolo: string | null; voci: AziendaIndice[] }>;
  totale: number;
}

/**
 * Preferite e recenti in alto, poi tutte le altre per nome; con una ricerca tollerante
 * (senza accenti e maiuscole, anche P.IVA, comune e ATECO) un solo elenco.
 */
export function elencoSelettore(aziende: AziendaIndice[], pref: PreferenzeAziende, testo: string): ElencoSelettore {
  if (testo.trim()) {
    const v = filtraAziende(aziende, { ...FILTRO_AZIENDE_INIZIALE, testo }, pref.preferite);
    return { gruppi: v.length ? [{ titolo: null, voci: v }] : [], totale: v.length };
  }
  const perId = new Map(aziende.map((a) => [a.id, a]));
  const preferite = pref.preferite.map((id) => perId.get(id)).filter((a): a is AziendaIndice => !!a);
  const giaViste = new Set(preferite.map((a) => a.id));
  const recenti = pref.recenti.filter((id) => !giaViste.has(id)).map((id) => perId.get(id)).filter((a): a is AziendaIndice => !!a);
  for (const a of recenti) giaViste.add(a.id);
  const altre = filtraAziende(aziende, FILTRO_AZIENDE_INIZIALE).filter((a) => !giaViste.has(a.id));
  const gruppi = [
    { titolo: 'Preferite', voci: preferite },
    { titolo: 'Recenti', voci: recenti },
    { titolo: preferite.length || recenti.length ? 'Tutte le aziende' : null, voci: altre },
  ].filter((g) => g.voci.length > 0);
  return { gruppi, totale: aziende.length };
}

// ---------------------------------------------------------------- storico del Falco

export interface FiltroStorico {
  /** Azienda di riferimento: nel gestionale il cliente scelto, nell'area azienda quella dell'utente. */
  aziendaId: number | null;
  /** Interruttore "tutte le mie" (solo gestionale). */
  tutte: boolean;
}

/** Conversazioni da mostrare: quelle dell'azienda, oppure tutte le proprie; le piu' recenti prima. */
export function filtraStorico(conv: AgenteConversazione[], f: FiltroStorico): AgenteConversazione[] {
  const voci = f.tutte || !f.aziendaId ? conv : conv.filter((c) => c.azienda?.id === f.aziendaId);
  return [...voci].sort((a, b) => (b.aggiornata ?? '').localeCompare(a.aggiornata ?? ''));
}

/** "gestionale.dvr" -> "Scrivania del DVR"; sezioni sconosciute o assenti: "Falco". */
export function titoloSezioneFalco(sezione: string | null | undefined): string {
  if (!sezione) return 'Falco';
  const [app, chiave] = sezione.split('.');
  if (app !== 'gestionale' && app !== 'azienda') return 'Falco';
  return trovaSezione(app, chiave)?.titolo ?? 'Falco';
}

/** Data breve dello storico: oggi l'ora, quest'anno giorno e mese, prima anche l'anno. */
export function quandoStorico(iso: string | null, adesso: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = { timeZone: 'Europe/Rome' } as const;
  const giorno = (x: Date) => x.toLocaleDateString('it-IT', { ...tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  if (giorno(d) === giorno(adesso)) return `oggi, ${d.toLocaleTimeString('it-IT', { ...tz, hour: '2-digit', minute: '2-digit' })}`;
  const stessoAnno = d.toLocaleDateString('it-IT', { ...tz, year: 'numeric' }) === adesso.toLocaleDateString('it-IT', { ...tz, year: 'numeric' });
  return d.toLocaleDateString('it-IT', { ...tz, day: 'numeric', month: 'short', ...(stessoAnno ? {} : { year: 'numeric' }) });
}

// ---------------------------------------------------------------- cosa ha fatto il Falco

export interface PassoLeggibile {
  testo: string;
  ok: boolean;
}

/** Strumenti usati in un messaggio, senza doppioni e nell'ordine: "cosa e' stato fatto". */
export function cosaHaFatto(passi: Array<{ tipo: string; titolo?: string; strumento?: string; ok?: boolean }>): PassoLeggibile[] {
  const visti = new Set<string>();
  const out: PassoLeggibile[] = [];
  for (const p of passi) {
    if (p.tipo !== 'strumento') continue;
    const testo = (p.titolo || p.strumento || '').trim();
    if (!testo || visti.has(testo)) continue;
    visti.add(testo);
    out.push({ testo, ok: p.ok !== false });
  }
  return out;
}
