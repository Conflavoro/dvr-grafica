// API client per backend Laravel (deploy su cPanel).
//
// Vincoli:
// - Niente Server Actions / Route Handlers (rompono `output: 'export'`)
// - JWT in localStorage (no cookie httpOnly: cPanel + SPA puro)
// - Mitigazione XSS via CSP rigorosa (vedi ADR-002 .htaccess)

import { DEMO, DEMO_LIVE, PREFISSO_ARCHIVIO } from './demo/attivo';
import { installaArchivioDemo } from './demo/archivio';
import { installaDemo } from './demo/intercetta';
import { percorso, senzaBase } from './percorso';
import { isNativa, TokenNativo } from './app/nativa';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

// Versione dimostrativa: le richieste /api/* rispondono dalle registrazioni (mai in rete).
if (DEMO && typeof window !== 'undefined') installaDemo();
// Demo dal vivo sullo stesso dominio della produzione: chiavi del browser separate.
if (PREFISSO_ARCHIVIO && typeof window !== 'undefined') installaArchivioDemo(PREFISSO_ARCHIVIO);

/** Costruisce l'URL assoluto verso il backend per un path relativo (es. download file). */
export function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

const TOKEN_KEY = 'crm_dvr_jwt';
const REFRESH_FLAG = 'crm_dvr_refreshing';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Nell'app (Capacitor) il token sta in Preferences, non in localStorage.
const tokenNativo: TokenNativo | null =
  typeof window !== 'undefined' && isNativa() ? new TokenNativo(TOKEN_KEY) : null;

/** Attende che il token salvato nell'app sia in memoria (sul web e' immediato). */
export function attendiToken(): Promise<void> {
  return tokenNativo ? tokenNativo.carica() : Promise.resolve();
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (tokenNativo) return tokenNativo.leggi();
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (tokenNativo) {
    tokenNativo.scrivi(token);
  } else if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
  // Cambio utente/sessione: svuota la cache GET per non mostrare dati altrui.
  clearApiCache();
}

// ============================================================
// CACHE GET (stale-while-navigate)
// ------------------------------------------------------------
// Le liste/letture GET vengono memorizzate per pochi secondi: tornare indietro a
// una sezione gia' vista e' ISTANTANEO (niente nuovo round-trip sul tunnel). Ogni
// scrittura (POST/PUT/PATCH/DELETE) invalida la cache cosi' i dati restano freschi.
// ============================================================
const getCache = new Map<string, { ts: number; data: unknown }>();
const GET_TTL_MS = 30_000;

const svuotamenti = new Set<() => void>();

/** Altre cache di lettura (portale) da svuotare insieme a questa. */
export function quandoSvuoti(f: () => void): () => void {
  svuotamenti.add(f);
  return () => svuotamenti.delete(f);
}

export function clearApiCache(): void {
  getCache.clear();
  svuotamenti.forEach((f) => f());
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Se true, non aggiunge Authorization header (utile per /auth/login) */
  anonymous?: boolean;
  /**
   * Tempo massimo della richiesta (default 3 minuti): allo scadere ApiError 408,
   * mai un'attesa infinita. L'agente passa un tempo piu' lungo.
   */
  timeoutMs?: number;
}

/** Tempo massimo di default di una richiesta JSON. */
export const TIMEOUT_RICHIESTA_MS = 180_000;
/** Tempo massimo di un caricamento (24 MB anche su rete lenta). */
export const TIMEOUT_CARICAMENTO_MS = 6 * 60_000;

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, anonymous, headers, timeoutMs, ...rest } = options;
  await attendiToken();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((headers as Record<string, string> | undefined) ?? {}),
  };

  if (!anonymous) {
    const token = getToken();
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  // Nessuna attesa infinita: allo scadere la richiesta si interrompe con 408.
  const ctrl = !rest.signal && typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs ?? TIMEOUT_RICHIESTA_MS) : null;
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Rete assente o richiesta interrotta: errore con stato, mai il "Failed to fetch" del browser.
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError(408, null, 'Tempo scaduto');
    throw new ApiError(0, null, e instanceof Error && e.message ? e.message : 'Rete non disponibile');
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Auto-refresh JWT su 401, una sola volta per evitare loop
  if (response.status === 401 && !anonymous && !sessionStorage.getItem(REFRESH_FLAG)) {
    sessionStorage.setItem(REFRESH_FLAG, '1');
    try {
      const refresh = await apiRequest<{ access_token: string }>('/auth/refresh', {
        method: 'POST',
      });
      setToken(refresh.access_token);
      sessionStorage.removeItem(REFRESH_FLAG);
      return apiRequest<T>(path, options);
    } catch {
      sessionStorage.removeItem(REFRESH_FLAG);
      setToken(null);
      // La pagina di login e' nella root '/': mai '/login' (404). Evita anche
      // il loop di reindirizzamento se siamo gia' sulla login.
      if (typeof window !== 'undefined' && senzaBase(window.location.pathname) !== '/') {
        window.location.href = percorso('/');
      }
      throw new ApiError(401, null, 'Session expired');
    }
  }

  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = (responseBody as { message?: string })?.message ?? response.statusText;
    throw new ApiError(response.status, responseBody, msg);
  }

  // Ogni scrittura (anche quella fatta dal Falco) rende vecchie le letture tenute in memoria.
  if ((rest.method ?? 'GET').toUpperCase() !== 'GET') clearApiCache();

  return responseBody as T;
}

/**
 * Upload multipart con avanzamento. Usa XHR perche' fetch non espone l'upload
 * progress in modo affidabile. Aggiunge il JWT come gli altri request.
 */
export function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  if (DEMO) {
    // Dimostrazione: il caricamento passa dal finto server delle registrazioni.
    return fetch(url, { method: 'POST', body: formData }).then(async (r) => {
      const body: unknown = await r.json().catch(() => null);
      if (!r.ok) throw new ApiError(r.status, body, (body as { message?: string })?.message ?? 'Caricamento non riuscito');
      onProgress?.(100);
      clearApiCache();
      return body as T;
    });
  }

  // Un singolo tentativo di upload con il token corrente.
  const attempt = (): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const token = getToken();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }

      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          /* non-JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          clearApiCache();
          resolve(body as T);
        } else {
          const msg = (body as { message?: string })?.message ?? `Upload fallito (${xhr.status})`;
          reject(new ApiError(xhr.status, body, msg));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, null, 'Errore di rete durante l\'upload'));
      xhr.timeout = TIMEOUT_CARICAMENTO_MS;
      xhr.ontimeout = () => reject(new ApiError(408, null, 'Tempo scaduto durante il caricamento'));
      xhr.send(formData);
    });

  // Su 401 (token scaduto) prova un refresh UNA volta e ritenta l'upload, cosi'
  // un caricamento dopo i 60 min di TTL non fallisce ne' forza il logout.
  return attempt().catch(async (e) => {
    if (e instanceof ApiError && e.status === 401) {
      try {
        const r = await apiRequest<{ access_token: string }>('/auth/refresh', { method: 'POST' });
        setToken(r.access_token);
        return attempt();
      } catch {
        setToken(null);
        throw new ApiError(401, null, 'Session expired');
      }
    }
    throw e;
  });
}

export const api = {
  get: async <T>(path: string, opts?: RequestOptions): Promise<T> => {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.ts < GET_TTL_MS) {
      return hit.data as T;
    }
    const data = await apiRequest<T>(path, { ...opts, method: 'GET' });
    getCache.set(path, { ts: Date.now(), data });
    return data;
  },
  post: async <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> => {
    const r = await apiRequest<T>(path, { ...opts, method: 'POST', body });
    clearApiCache();
    return r;
  },
  put: async <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> => {
    const r = await apiRequest<T>(path, { ...opts, method: 'PUT', body });
    clearApiCache();
    return r;
  },
  patch: async <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> => {
    const r = await apiRequest<T>(path, { ...opts, method: 'PATCH', body });
    clearApiCache();
    return r;
  },
  delete: async <T>(path: string, opts?: RequestOptions): Promise<T> => {
    const r = await apiRequest<T>(path, { ...opts, method: 'DELETE' });
    clearApiCache();
    return r;
  },
};

export interface User {
  id: number;
  name: string;
  email: string;
  // 4 ruoli (admin_super rimosso: la piattaforma e' di Conflavoro PMI).
  // null finche' l'onboarding non assegna il ruolo (utente Google appena creato).
  role: 'admin_conflavoro' | 'titolare_studio' | 'consulente' | 'datore_lavoro' | 'utente_azienda' | null;
  tenant_id: number | null;
  mfa_enabled: boolean;
  needs_onboarding?: boolean;
  avatar_url?: string;
  /** Slug del tenant = "codice studio" condivisibile dal titolare col consulente. */
  studio_code?: string | null;
  tenant_name?: string | null;
  tenant_vat?: string | null;
  tenant_ateco?: string | null;
  /** App di ingresso: gestionale (studio) o azienda (cliente). */
  app?: 'gestionale' | 'azienda' | null;
  /** Aziende su cui l'utente ha un ruolo, con le azioni consentite. */
  aziende?: Array<{ id: number; ragione_sociale?: string | null; ruoli?: unknown[]; permessi?: unknown[] }> | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

/**
 * Risposta del login Google: token + flag onboarding (primo accesso).
 * Il backend (UserResource) include anche l'utente gia' mappato.
 */
export interface GoogleLoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  needs_onboarding: boolean;
  is_new?: boolean;
  user: User;
}

/**
 * Payload onboarding inviato a PATCH /api/onboarding.
 *
 * I nomi dei campi corrispondono ESATTAMENTE a OnboardingRequest del backend
 * Laravel (App\Http\Requests\Auth\OnboardingRequest):
 *   - access_code   (gating admin_conflavoro)
 *   - studio_name   + studio_vat   (titolare_studio crea lo studio)
 *   - studio_code   (consulente si associa allo slug del tenant studio)
 *   - azienda_invite_code (datore_lavoro si lega alla company del codice, sola lettura)
 */
export interface OnboardingRequest {
  role: string;
  access_code?: string;
  studio_name?: string;
  studio_vat?: string;
  studio_code?: string;
  azienda_invite_code?: string;
}

/** Risposta di PATCH /api/onboarding: token rigenerato + utente aggiornato. */
export interface OnboardingResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  needs_onboarding: boolean;
  user: User;
}

export const auth = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, { anonymous: true }),
  /**
   * Invia l'ID token Google ("credential") al backend Laravel. Il backend
   * verifica il token con Google (firma/exp/iss/aud), crea/recupera l'utente
   * e ritorna il JWT applicativo + il flag needs_onboarding + l'utente.
   */
  google: (credential: string) =>
    api.post<GoogleLoginResponse>('/auth/google', { credential }, { anonymous: true }),
  me: () => api.get<User>('/auth/me'),
  refresh: () => api.post<LoginResponse>('/auth/refresh'),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  /** Completa l'onboarding (scelta ruolo + profilo). Ritorna token + utente aggiornato. */
  onboarding: (payload: OnboardingRequest) => api.patch<OnboardingResponse>('/onboarding', payload),
};
