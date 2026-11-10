/**
 * Portale HSE (ADR-008): chiamate PUBBLICHE del link personale del lavoratore.
 * Nessun account: il token sta nel link (/lavoratore/?t=lav_...). Il backend
 * restituisce solo date, orari, luoghi e attestati, mai dati sanitari.
 */

import { ApiError, apiRequest } from '../api';
import type { LinkLavoratore } from './types';

export const TOKEN_LAVORATORE = /^lav_[A-Za-z0-9]{40}$/;

function errore(e: unknown): Error {
  if (e instanceof ApiError) {
    const body = (e.body ?? {}) as { message?: string; codice?: string };
    if (e.status === 404) return new Error('Link non valido o non più attivo. Chiedi un nuovo link alla tua azienda.');
    if (e.status === 429 && body.codice === 'tetto_demo' && body.message) return new Error(body.message);
    if (e.status === 429) return new Error('Troppe richieste in poco tempo. Riprova tra un minuto.');
    return new Error(body.message || 'Operazione non riuscita. Riprova.');
  }
  return e instanceof Error ? e : new Error('Operazione non riuscita. Riprova.');
}

function controlla(token: string): void {
  if (!TOKEN_LAVORATORE.test(token)) throw new Error('Link non valido o non più attivo. Chiedi un nuovo link alla tua azienda.');
}

export async function apriLinkLavoratore(token: string): Promise<LinkLavoratore> {
  controlla(token);
  try {
    const r = await apiRequest<{ data: LinkLavoratore }>(`/lavoratore/${token}`, { method: 'GET', anonymous: true, cache: 'no-store' });
    return r.data;
  } catch (e) {
    throw errore(e);
  }
}

export async function cambioDataLavoratore(token: string, scadenzaId: number, nota: string): Promise<LinkLavoratore> {
  controlla(token);
  try {
    const r = await apiRequest<{ data: LinkLavoratore }>(`/lavoratore/${token}/cambio-data`, { method: 'POST', anonymous: true, body: { scadenza_id: scadenzaId, nota } });
    return r.data;
  } catch (e) {
    throw errore(e);
  }
}

// ------------------------------------------------------------------
// "Da fare adesso" e riquadri della home azienda (come nel Portale HSE)
// ------------------------------------------------------------------

export interface VoceDaFareAzienda {
  tipo: 'quota_da_pagare' | 'firma' | 'da_prenotare' | 'regolarizzazione' | 'altro';
  id: number;
  testo: string;
  azione: string | null;
  importo: string | null;
  quando: string | null;
}

export interface DaFareAzienda {
  voci: VoceDaFareAzienda[];
  totaleDaPagare: string | null;
  /** Riquadri: null quando mancano i dati per calcolarli. */
  scadenze30: number | null;
  coperturaFormativa: number | null;
  visiteValide: number | null;
  completezzaFascicolo: number | null;
}

const TIPI_DA_FARE = ['quota_da_pagare', 'firma', 'da_prenotare', 'regolarizzazione'] as const;

function numero(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function testo(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Normalizza la risposta di GET /portale/aziende/{id}/da-fare (campi mancanti o strani non rompono la vista). */
export function mappaDaFareAzienda(raw: unknown): DaFareAzienda {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (r.cruscotto && typeof r.cruscotto === 'object' ? r.cruscotto : {}) as Record<string, unknown>;
  const k = (r.conteggi && typeof r.conteggi === 'object' ? r.conteggi : {}) as Record<string, unknown>;
  const voci = (Array.isArray(r.voci) ? r.voci : [])
    .map((v): VoceDaFareAzienda | null => {
      if (!v || typeof v !== 'object') return null;
      const o = v as Record<string, unknown>;
      const t = testo(o.testo);
      if (!t) return null;
      const tipo = (TIPI_DA_FARE as readonly string[]).includes(String(o.tipo)) ? (o.tipo as VoceDaFareAzienda['tipo']) : 'altro';
      return { tipo, id: numero(o.id) ?? 0, testo: t, azione: testo(o.azione), importo: testo(o.importo), quando: testo(o.appuntamento_il) ?? testo(o.data) };
    })
    .filter((v): v is VoceDaFareAzienda => v !== null);
  return {
    voci,
    totaleDaPagare: testo(k.totale_da_pagare),
    scadenze30: numero(c.scadenze_30_giorni),
    coperturaFormativa: numero(c.copertura_formativa),
    visiteValide: numero(c.visite_valide),
    completezzaFascicolo: numero(c.completezza_fascicolo),
  };
}

export async function daFareAzienda(aziendaId: number): Promise<DaFareAzienda> {
  try {
    const r = await apiRequest<{ data?: unknown }>(`/portale/aziende/${aziendaId}/da-fare`, { method: 'GET', cache: 'no-store' });
    return mappaDaFareAzienda(r.data);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) throw new Error('Con il tuo ruolo questa vista non è disponibile.');
    throw errore(e);
  }
}
