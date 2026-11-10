/**
 * App del lavoratore (link personale /lavoratore/?t=): dati propri, near miss,
 * Falco del lavoratore. Chiamate PUBBLICHE con il token del link, senza account.
 * I codici ricevuta delle segnalazioni anonime restano solo su questo telefono.
 */

import { apiUrl } from '@/lib/api';
import { lista, numero, rec, testo } from './api';

export const TOKEN_LAVORATORE = /^lav_[A-Za-z0-9]{40}$/;

export interface ScadenzaMia {
  tipo: 'corso' | 'visita' | 'dpi';
  cosa: string;
  data: string;
}

export interface InformativaMansione {
  dvrVersione: number;
  approvatoIl: string | null;
  mansione: string;
  descrizione: string;
  rischi: Array<{
    categoria: string;
    descrizione: string;
    livello: string;
    misure: string[];
  }>;
  dpi: string[];
}

export interface MioNearMiss {
  id: number;
  codice: string;
  descrizione: string;
  dove: string | null;
  stato: string;
  ricevutaIl: string | null;
  chiusaIl: string | null;
  anonima: boolean;
  ricevuta?: string;
}

export interface AppLavoratore {
  scadenze: ScadenzaMia[];
  corsi: Array<{
    corso: string;
    ente: string | null;
    ore: number | null;
    conseguitoIl: string | null;
    scadeIl: string | null;
  }>;
  dpi: Array<{
    descrizione: string;
    norma: string | null;
    quantita: number | null;
    consegnatoIl: string | null;
    scadeIl: string | null;
  }>;
  visita: {
    prossima: {
      scadenzaId: number;
      quando: string;
      luogo: string | null;
      mapsUrl: string | null;
    } | null;
    ultima: string | null;
    validaFinoAl: string | null;
    esito: string | null;
    prescrizioni: string | null;
    giudizioId: number | null;
  };
  informativa: InformativaMansione | null;
  documenti: Array<{
    id: number;
    tipo: string;
    titolo: string;
    revisione: number;
  }>;
  nearMiss: MioNearMiss[];
  domandeFalco: string[];
  sedi: string[];
}

const strs = (v: unknown): string[] =>
  lista(v)
    .map((x) => testo(x))
    .filter((x): x is string => x !== null);

function mioNm(x: unknown): MioNearMiss | null {
  const r = rec(x);
  const id = numero(r.id);
  if (id === null) return null;
  return {
    id,
    codice: testo(r.codice) ?? '',
    descrizione: testo(r.descrizione) ?? '',
    dove: testo(r.dove),
    stato: testo(r.stato) ?? 'ricevuta',
    ricevutaIl: testo(r.ricevuta_il),
    chiusaIl: testo(r.chiusa_il),
    anonima: r.anonima === true,
    ricevuta: testo(r.ricevuta) ?? undefined,
  };
}

/** Le parti nuove della risposta di GET /lavoratore/{token}, con riserve tolleranti. */
export function mappaAppLavoratore(raw: unknown): AppLavoratore {
  const r = rec(raw);
  const v = rec(r.visita);
  const p = v.prossima ? rec(v.prossima) : null;
  const inf = r.informativa_mansione ? rec(r.informativa_mansione) : null;
  return {
    scadenze: lista(r.scadenze)
      .map((x) => {
        const s = rec(x);
        const tipo = s.tipo === 'corso' || s.tipo === 'visita' || s.tipo === 'dpi' ? s.tipo : null;
        const data = testo(s.data);
        return tipo && data ? { tipo, cosa: testo(s.cosa) ?? '', data } : null;
      })
      .filter((x): x is ScadenzaMia => x !== null),
    corsi: lista(r.corsi).map((x) => {
      const c = rec(x);
      return {
        corso: testo(c.corso) ?? 'Corso',
        ente: testo(c.ente),
        ore: numero(c.ore),
        conseguitoIl: testo(c.conseguito_il),
        scadeIl: testo(c.scade_il),
      };
    }),
    dpi: lista(r.dpi).map((x) => {
      const d = rec(x);
      return {
        descrizione: testo(d.descrizione) ?? 'DPI',
        norma: testo(d.norma),
        quantita: numero(d.quantita),
        consegnatoIl: testo(d.consegnato_il),
        scadeIl: testo(d.scade_il),
      };
    }),
    visita: {
      prossima:
        p && testo(p.quando)
          ? {
              scadenzaId: numero(p.scadenza_id) ?? 0,
              quando: testo(p.quando)!,
              luogo: testo(p.luogo),
              mapsUrl: testo(p.maps_url),
            }
          : null,
      ultima: testo(v.ultima),
      validaFinoAl: testo(v.valida_fino_al),
      esito: testo(v.esito),
      prescrizioni: testo(v.prescrizioni),
      giudizioId: numero(v.giudizio_id),
    },
    informativa: inf
      ? {
          dvrVersione: numero(inf.dvr_versione) ?? 0,
          approvatoIl: testo(inf.approvato_il),
          mansione: testo(inf.mansione) ?? '',
          descrizione: testo(inf.descrizione) ?? '',
          rischi: lista(inf.rischi).map((x) => {
            const q = rec(x);
            return {
              categoria: testo(q.categoria) ?? 'Rischio',
              descrizione: testo(q.descrizione) ?? '',
              livello: testo(q.livello) ?? '',
              misure: strs(q.misure),
            };
          }),
          dpi: strs(inf.dpi),
        }
      : null,
    documenti: lista(r.documenti)
      .map((x) => {
        const d = rec(x);
        const id = numero(d.id);
        return id === null
          ? null
          : {
              id,
              tipo: testo(d.tipo) ?? '',
              titolo: testo(d.titolo) ?? 'Documento',
              revisione: numero(d.revisione) ?? 1,
            };
      })
      .filter(
        (
          x,
        ): x is {
          id: number;
          tipo: string;
          titolo: string;
          revisione: number;
        } => x !== null,
      ),
    nearMiss: lista(r.near_miss)
      .map(mioNm)
      .filter((x): x is MioNearMiss => x !== null),
    domandeFalco: strs(rec(r.falco).domande),
    sedi: strs(r.sedi),
  };
}

/** Scadenze divise: gia' passate, entro 30 giorni, piu' avanti. */
export function dividiScadenze(s: ScadenzaMia[], oggi: Date = new Date()): { scadute: ScadenzaMia[]; vicine: ScadenzaMia[]; lontane: ScadenzaMia[] } {
  const base = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const giorni = (iso: string) => Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - base) / 86400000);
  const ord = [...s].sort((a, b) => a.data.localeCompare(b.data));
  return {
    scadute: ord.filter((x) => giorni(x.data) < 0),
    vicine: ord.filter((x) => giorni(x.data) >= 0 && giorni(x.data) <= 30),
    lontane: ord.filter((x) => giorni(x.data) > 30),
  };
}

// ---------------------------------------------------------------- codici ricevuta (solo su questo telefono)

const RICEVUTE_KEY = 'hse_lavoratore_ricevute';

export function leggiRicevute(token: string): string[] {
  try {
    const tutte = JSON.parse(window.localStorage.getItem(RICEVUTE_KEY) ?? '{}') as Record<string, unknown>;
    const mie = tutte[token.slice(-12)];
    return Array.isArray(mie) ? mie.filter((x): x is string => typeof x === 'string' && /^nmr_[A-Za-z0-9]{24}$/.test(x)).slice(-20) : [];
  } catch {
    return [];
  }
}

export function salvaRicevuta(token: string, codice: string): void {
  try {
    const tutte = JSON.parse(window.localStorage.getItem(RICEVUTE_KEY) ?? '{}') as Record<string, string[]>;
    const k = token.slice(-12);
    tutte[k] = [...(Array.isArray(tutte[k]) ? tutte[k] : []), codice].slice(-20);
    window.localStorage.setItem(RICEVUTE_KEY, JSON.stringify(tutte));
  } catch {
    /* comodita' del telefono: senza memoria il codice si perde, la segnalazione resta */
  }
}

// ---------------------------------------------------------------- chiamate

async function pubblica<T>(path: string, init: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Nessuna connessione. Riprova quando hai campo.');
  }
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* risposta vuota */
  }
  if (!r.ok) {
    const b = rec(body);
    const primo = Object.values(rec(b.errors))
      .map((x) => lista(x)[0])
      .find((x) => typeof x === 'string') as string | undefined;
    if (r.status === 404) throw new Error(testo(b.message) ?? 'Link non valido o non più attivo. Chiedi un nuovo link alla tua azienda.');
    if (r.status === 429) throw new Error(testo(b.message) ?? 'Troppe richieste in poco tempo. Riprova tra un minuto.');
    throw new Error(primo ?? testo(b.message) ?? 'Operazione non riuscita. Riprova.');
  }
  return rec(body).data as T;
}

export interface NuovaSegnalazione {
  descrizione: string;
  dove: string;
  sede: string;
  quando: string;
  gravita: string;
  anonima: boolean;
  consensoStudio: boolean;
  foto: File[];
  audio: File | null;
}

export async function segnalaNearMiss(
  token: string,
  d: NuovaSegnalazione,
): Promise<{
  segnalazione: MioNearMiss | null;
  ricevuta: string | null;
  messaggio: string;
}> {
  if (!TOKEN_LAVORATORE.test(token)) throw new Error('Link non valido.');
  const fd = new FormData();
  if (d.descrizione.trim()) fd.append('descrizione', d.descrizione.trim());
  if (d.dove.trim()) fd.append('dove', d.dove.trim());
  if (d.sede.trim()) fd.append('sede', d.sede.trim());
  if (d.quando) fd.append('quando', d.quando);
  fd.append('gravita', d.gravita);
  fd.append('anonima', d.anonima ? '1' : '0');
  fd.append('consenso_studio', d.anonima && d.consensoStudio ? '1' : '0');
  d.foto.slice(0, 3).forEach((f) => fd.append('foto[]', f));
  if (d.audio) fd.append('audio', d.audio);
  const r = rec(
    await pubblica(`/lavoratore/${token}/near-miss`, {
      method: 'POST',
      body: fd,
    }),
  );
  const ricevuta = testo(r.ricevuta);
  if (ricevuta) salvaRicevuta(token, ricevuta);
  return {
    segnalazione: mioNm(r.segnalazione),
    ricevuta,
    messaggio: testo(r.messaggio) ?? 'Segnalazione inviata.',
  };
}

export async function statoRicevute(token: string): Promise<MioNearMiss[]> {
  const ricevute = leggiRicevute(token);
  if (ricevute.length === 0) return [];
  const r = await pubblica<unknown>(`/lavoratore/${token}/near-miss/stato`, {
    method: 'POST',
    body: JSON.stringify({ ricevute }),
  });
  return lista(r)
    .map(mioNm)
    .filter((x): x is MioNearMiss => x !== null);
}

export interface MessaggioFalco {
  ruolo: 'lavoratore' | 'falco';
  testo: string;
}

export async function chiediFalcoLavoratore(token: string, domanda: string, storico: MessaggioFalco[]): Promise<{ testo: string; disclaimer: string }> {
  const r = rec(
    await pubblica(`/lavoratore/${token}/falco`, {
      method: 'POST',
      body: JSON.stringify({ domanda, storico: storico.slice(-6) }),
    }),
  );
  return { testo: testo(r.testo) ?? '', disclaimer: testo(r.disclaimer) ?? '' };
}

/** Dettatura al Falco dal link personale. */
export async function dettaturaLavoratore(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const r = rec(await pubblica(`/lavoratore/${token}/dettatura`, { method: 'POST', body: fd }));
  return testo(r.testo) ?? '';
}

/** Voce del Falco (mp3) con l'inizio di ogni parola, come per lo studio. */
export async function voceLavoratore(token: string, t: string): Promise<Blob> {
  const res = await fetch(apiUrl(`/lavoratore/${token}/voce`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ testo: t }),
  });
  if (!res.ok) throw new Error('Voce non disponibile.');
  const blob = (await res.blob()) as Blob & { parole?: number[] };
  const h = res.headers?.get?.('X-Voce-Parole');
  if (h) blob.parole = h.split(',').map(Number).filter((n) => Number.isFinite(n));
  return blob;
}

export const urlDocumentoLavoratore = (token: string, id: number) => apiUrl(`/lavoratore/${token}/documenti/${id}`);
export const urlGiudizioLavoratore = (token: string, id: number) => apiUrl(`/lavoratore/${token}/giudizio/${id}`);
