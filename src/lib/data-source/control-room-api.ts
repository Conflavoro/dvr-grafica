// Namespace `controlRoom` verso il backend Laravel (docs/integrazioni/CONTROL_ROOM_API.md).
//
// Letture con la cache GET condivisa (30 s, svuotata da ogni scrittura); i file
// (PDF del report, QR) passano da fetch con il JWT perche' servono come blob.
// Le due chiamate del passaporto pubblico sono anonime: niente token, niente cache.

import { ApiError, api, apiRequest, apiUrl, getToken } from '@/lib/api';
import {
  mapAccessi,
  mapAssistenza,
  mapConsultazione,
  mapControlRoom,
  mapFascicolo,
  mapFascicoloVoce,
  mapIspezione,
  mapIspezioni,
  mapPassaportoCreato,
  mapPassaportoInfo,
  mapPassaportoStato,
  mapPassaportoVista,
  mapPronto,
  mapReport,
  mapSafetyScore,
  mapScadenzario,
} from './control-room-mappers';
import type { ControlRoomDataSource, FascicoloVoce, Ispezione, PassaportoVista } from './types';
import { fetchConTempo } from '@/lib/attesa';
import { testoErroreHttp } from './moduli-api';

type Errore = Error & { code?: string; status?: number };

const MESE = /^\d{4}-\d{2}$/;
const TOKEN_PASS = /^pass_[A-Za-z0-9]{48}$/;

function mese(m: string): string {
  if (!MESE.test(m)) throw new Error('Mese non valido: usa il formato AAAA-MM.');
  return m;
}

/** Errori leggibili in italiano, con il codice per la UI. */
export function erroreControlRoom(e: unknown, riserva = 'Operazione non riuscita.'): Errore {
  if (!(e instanceof ApiError)) return e instanceof Error ? (e as Errore) : new Error(riserva);
  const body = (e.body ?? {}) as { message?: string; errors?: Record<string, string[]> };
  const primo = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;
  const testi: Record<number, [string, string]> = {
    403: ['FORBIDDEN', 'Operazione non consentita per il tuo ruolo.'],
    404: ['NOT_FOUND', 'Risorsa non trovata.'],
    422: ['VALIDATION', primo ?? body.message ?? 'Dati non validi.'],
    429: ['RATE_LIMIT', 'Troppe richieste in poco tempo. Attendi un minuto e riprova.'],
  };
  // Rete, tempo scaduto, file troppo grande, errore del server: cosa fare, in italiano.
  const tecnico = e.status === 0 || e.status === 408 || e.status === 413 || e.status >= 500;
  const [code, msg] = testi[e.status] ?? ['ERRORE', tecnico ? testoErroreHttp(e.status) : body.message || riserva];
  const err = new Error(msg) as Errore;
  err.code = code;
  err.status = e.status;
  return err;
}

async function leggi<T>(path: string, map: (raw: unknown) => T): Promise<T> {
  try {
    const res = await api.get<{ data?: unknown }>(path);
    return map(res?.data);
  } catch (e) {
    throw erroreControlRoom(e, 'Dati non disponibili.');
  }
}

async function scrivi<T>(metodo: 'post' | 'put' | 'patch', path: string, body: unknown, map: (raw: unknown) => T): Promise<T> {
  try {
    const res = await api[metodo]<{ data?: unknown }>(path, body);
    return map(res?.data);
  } catch (e) {
    throw erroreControlRoom(e);
  }
}

async function blob(path: string, msg404: string): Promise<Blob> {
  const token = getToken();
  const res = await fetchConTempo(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const err = new Error(res.status === 404 ? msg404 : res.status === 403 ? 'Operazione non consentita per il tuo ruolo.' : 'Download non riuscito.') as Errore;
    err.status = res.status;
    err.code = res.status === 404 ? 'NOT_FOUND' : 'ERRORE';
    throw err;
  }
  return res.blob();
}

/** Salva un blob con il nome dato (link temporaneo). */
export function salvaBlob(b: Blob, nome: string): void {
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function query(p: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function creaControlRoomApi(): ControlRoomDataSource {
  return {
    controlRoom: (id) => leggi(`/companies/${id}/control-room`, mapControlRoom),
    safetyScore: (id) => leggi(`/companies/${id}/safety-score`, mapSafetyScore),
    scadenzario: (id, f) =>
      leggi(
        `/companies/${id}/scadenzario${query({ periodo: f?.periodo, priorita: f?.priorita ?? undefined, includi_scadute: f?.includi_scadute })}`,
        mapScadenzario
      ),
    fascicolo: (id, f) => leggi(`/companies/${id}/fascicolo${query({ cerca: f?.cerca?.trim(), categoria: f?.categoria })}`, mapFascicolo),
    fascicoloAggiorna: (docId, campi) =>
      scrivi('patch', `/company-documents/${docId}/fascicolo`, campi, (raw) => {
        const v = mapFascicoloVoce(raw);
        if (!v) throw new Error('Risposta del server non valida.');
        return v as FascicoloVoce;
      }),
    report: async (id, m) => leggi(`/companies/${id}/report/${mese(m)}`, mapReport),
    reportPdf: async (id, m) => scrivi('post', `/companies/${id}/report/${mese(m)}/pdf`, undefined, mapReport),
    scaricaReportPdf: async (id, m) => {
      salvaBlob(await blob(`/companies/${id}/report/${mese(m)}/pdf`, 'Il PDF di questo mese non è ancora stato generato.'), `Report_sicurezza_${m}.pdf`);
    },
    salvaOsservazioni: async (id, m, osservazioni, conAi = false) =>
      scrivi('put', `/companies/${id}/report/${mese(m)}/osservazioni`, { osservazioni, con_ai: conAi }, mapReport),
    passaporto: (id) => leggi(`/companies/${id}/passaporto`, mapPassaportoStato),
    creaPassaporto: (id, input) => scrivi('post', `/companies/${id}/passaporto`, input ?? {}, mapPassaportoCreato),
    revocaPassaporto: async (pid) => {
      try {
        const res = await api.delete<{ data?: unknown }>(`/passaporto/${pid}`);
        const v = mapPassaportoVista(res?.data);
        if (!v) throw new Error('Risposta del server non valida.');
        return v as PassaportoVista;
      } catch (e) {
        throw erroreControlRoom(e);
      }
    },
    passaportoAccessi: (pid) => leggi(`/passaporto/${pid}/accessi`, mapAccessi),
    qrSvgUrl: async (pid) => {
      try {
        return URL.createObjectURL(await blob(`/passaporto/${pid}/qr/svg`, 'QR non disponibile.'));
      } catch (e) {
        if ((e as Errore).status === 404) return null;
        throw e;
      }
    },
    scaricaQrPdf: async (pid) => {
      salvaBlob(await blob(`/passaporto/${pid}/qr/pdf`, 'Foglio non disponibile: il passaporto non è più valido.'), 'Safety_Passport.pdf');
    },
    ispezioni: (id) => leggi(`/companies/${id}/ispezioni`, mapIspezioni),
    creaIspezione: (input) =>
      scrivi('post', '/ispezioni', input, (raw) => {
        const i = mapIspezione(raw);
        if (!i) throw new Error('Risposta del server non valida.');
        return i as Ispezione;
      }),
    aggiornaIspezione: (iid, patch) =>
      scrivi('patch', `/ispezioni/${iid}`, patch, (raw) => {
        const i = mapIspezione(raw);
        if (!i) throw new Error('Risposta del server non valida.');
        return i as Ispezione;
      }),
    eliminaIspezione: async (iid) => {
      try {
        await api.delete<unknown>(`/ispezioni/${iid}`);
      } catch (e) {
        throw erroreControlRoom(e);
      }
    },
    prontoControllo: (id) => leggi(`/companies/${id}/pronto-controllo`, mapPronto),
    richiediAssistenza: (id, input) =>
      scrivi('post', `/companies/${id}/pronto-controllo`, { ente: input?.ente || undefined, messaggio: input?.messaggio?.trim() || undefined }, mapAssistenza),
    passaportoPubblico: async (token) => {
      if (!TOKEN_PASS.test(token)) throw Object.assign(new Error('Link del passaporto non valido.'), { code: 'NOT_FOUND', status: 404 });
      try {
        const res = await apiRequest<{ data?: unknown }>(`/passaporto/${token}`, { method: 'GET', anonymous: true });
        return mapPassaportoInfo(res?.data);
      } catch (e) {
        const err = erroreControlRoom(e);
        if (err.status === 404) err.message = 'Passaporto non trovato o non più valido.';
        throw err;
      }
    },
    apriPassaportoPubblico: async (token, input) => {
      if (!TOKEN_PASS.test(token)) throw Object.assign(new Error('Link del passaporto non valido.'), { code: 'NOT_FOUND', status: 404 });
      try {
        const res = await apiRequest<{ data?: unknown }>(`/passaporto/${token}`, { method: 'POST', anonymous: true, body: input });
        return mapConsultazione(res?.data);
      } catch (e) {
        const err = erroreControlRoom(e);
        if (err.status === 403) err.message = 'PIN non corretto.';
        if (err.status === 429) err.message = 'Troppi tentativi con PIN errato: riprova tra 15 minuti.';
        if (err.status === 404) err.message = 'Passaporto non trovato o non più valido.';
        throw err;
      }
    },
  };
}
