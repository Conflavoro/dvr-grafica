// ApiDataSource — implementazione DataSource verso il backend Laravel reale.
//
// Stessa interfaccia (types.ts) e stesso comportamento osservabile della
// LocalStorageDataSource, ma le mutazioni passano per fetch('/api/...') con JWT
// (helper in lib/api.ts: refresh automatico su 401, redirect a '/' a sessione
// scaduta). Divergenze di naming backend<->frontend isolate in api-mappers.ts.
//
// Vincoli cPanel: nessuna Server Action / Route Handler; il backend e' Laravel.
// Demo: resta su LocalStorageDataSource finche' NEXT_PUBLIC_USE_API non e' true.

import { mapPassiInterfaccia, mapRicercaDocumenti } from '@/lib/falco/interfaccia';
import { TEMPI, fetchConTempo } from '@/lib/attesa';
import { creaCodaApi, creaDocumentiHseApi, testoErroreHttp } from './moduli-api';
import { creaLoghiApi } from './loghi-api';
import { ApiError, api, apiRequest, apiUpload, apiUrl, auth as authClient, attendiToken, getToken, setToken, type User as ApiUser } from '@/lib/api';
import {
  mapCompanyFromApi,
  mapCompanyToApi,
  mapDvrCreateToApi,
  mapDvrFromApi,
  mapDvrUpdateToApi,
  unwrap,
  unwrapList,
  type ApiCompany,
  type ApiDvr,
} from './api-mappers';
import {
  mapAgenteConversazione,
  mapAgenteDettaglio,
  mapAgenteMessaggio,
  mapAgenteProfilo,
  mapAgenteProgresso,
  mapCantiere,
  mapPos,
} from './agente-mappers';
import { creaControlRoomApi } from './control-room-api';
import { AI_ASSIST_DISCLAIMER, AI_EXTRACTION_DISCLAIMER } from './types';
import type {
  Cantiere,
  CantiereNuovo,
  PosDocumento,
  AgenteConversazione,
  AgenteConversazioneDettaglio,
  AgenteInvioInput,
  AgenteInvioRisultato,
  AgenteProfilo,
  AgenteProfiloUpdate,
  AgenteProgresso,
  AiAssistInput,
  AiAssistResult,
  AiRischioProposto,
  AiRisksInput,
  AiRisksResult,
  AiTranscribeOptions,
  AiTranscribeResult,
  AiVideoInput,
  AiVideoResult,
  Attrezzatura,
  CompanyDocument,
  CompanyDocumentTipo,
  AuditLogEntry,
  Company,
  CompanyDimensione,
  CompanyExtractionResult,
  CompanySede,
  Corso,
  DataSource,
  Dpi,
  Dvr,
  DvrGenerationResult,
  DvrGenerationStatus,
  DvrGenerateOptions,
  DvrRevisionCreateInput,
  DvrRevisionDetail,
  DvrRevisionList,
  DvrRevisionSummary,
  DvrUpload,
  GoogleLoginResult,
  HealthStatus,
  Lavoratore,
  OnboardingProfile,
  Role,
  Scadenza,
  Studio,
  UploadKind,
  UploadProgress,
  User,
  UtenteCreateInput,
  UtenteStudio,
} from './types';

const VALID_DIMENSIONI: CompanyDimensione[] = ['micro', 'piccola', 'media', 'grande'];

/**
 * Normalizza il blocco `data` ritornato da POST /companies/extract in un
 * Partial<Company> sicuro: scarta i null, valida dimensione, coerce lavoratori a
 * numero e ripulisce le sedi. Mai lancia: input malformato -> oggetto parziale.
 */
function coerceExtractedCompany(raw: unknown): Partial<Company> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Company> = {};

  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  };

  const ragione = str(r.ragione_sociale);
  if (ragione) out.ragione_sociale = ragione;
  const piva = str(r.partita_iva);
  if (piva) out.partita_iva = piva.toUpperCase();
  const cf = str(r.codice_fiscale);
  if (cf) out.codice_fiscale = cf.toUpperCase();
  const ateco = str(r.ateco);
  if (ateco) out.ateco = ateco;
  const atecoLabel = str(r.ateco_label);
  if (atecoLabel) out.ateco_label = atecoLabel;

  if (typeof r.dimensione === 'string' && VALID_DIMENSIONI.includes(r.dimensione as CompanyDimensione)) {
    out.dimensione = r.dimensione as CompanyDimensione;
  }

  if (r.lavoratori != null) {
    const n = Number(r.lavoratori);
    if (Number.isFinite(n) && n >= 0) out.lavoratori = Math.round(n);
  }

  if (Array.isArray(r.sedi)) {
    const sedi: CompanySede[] = [];
    for (const s of r.sedi) {
      if (!s || typeof s !== 'object') continue;
      const sr = s as Record<string, unknown>;
      const tipoRaw = str(sr.tipo);
      const tipo: CompanySede['tipo'] =
        tipoRaw === 'operativa' || tipoRaw === 'deposito' ? tipoRaw : 'legale';
      sedi.push({
        tipo,
        indirizzo: str(sr.indirizzo) ?? '',
        comune: str(sr.comune) ?? '',
        provincia: (str(sr.provincia) ?? '').toUpperCase(),
        cap: str(sr.cap) ?? '',
      });
    }
    if (sedi.length > 0) out.sedi = sedi;
  }

  return out;
}

/** Mappa l'utente Laravel (lib/api) sul tipo User del DataSource. */
function mapApiUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    // Placeholder quando role e' null (utente appena registrato): innocuo perche'
    // un utente con role null ha SEMPRE needs_onboarding=true, quindi viene
    // instradato all'onboarding prima che il ruolo venga effettivamente usato.
    role: (u.role ?? 'consulente') as Role,
    tenant_id: u.tenant_id,
    tenant_name: u.tenant_name ?? undefined,
    mfa_enabled: u.mfa_enabled,
    // Critico: deve riflettere il backend (me() ora lo include) per instradare
    // il nuovo utente all'onboarding e non in dashboard.
    // Ruolo o tenant assenti: l'accesso va ancora configurato, mai una pagina vuota.
    needs_onboarding: (u.needs_onboarding ?? false) || !u.role || u.tenant_id == null,
    avatar_url: u.avatar_url,
    // Codice studio (slug tenant) + anagrafica persistita in onboarding.
    studio_code: u.studio_code ?? undefined,
    tenant_vat: u.tenant_vat ?? undefined,
    tenant_ateco: u.tenant_ateco ?? undefined,
    app: u.app === 'azienda' || u.app === 'gestionale' ? u.app : undefined,
    aziende: Array.isArray(u.aziende)
      ? u.aziende
          .filter((a) => a && typeof a.id === 'number')
          .map((a) => ({
            id: a.id,
            ragione_sociale: String(a.ragione_sociale ?? ''),
            ruoli: Array.isArray(a.ruoli) ? a.ruoli.map(String) : [],
            permessi: Array.isArray(a.permessi) ? a.permessi.map(String) : [],
            attivazione: mappaAttivazioneBreve((a as { attivazione?: unknown }).attivazione),
          }))
      : undefined,
  };
}

/** Riassunto dell'attivazione del cliente nuovo (null se l'azienda è già attiva). */
export function mappaAttivazioneBreve(v: unknown): { stato: string; benvenuto: boolean } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { stato?: unknown; benvenuto?: unknown };
  return { stato: typeof o.stato === 'string' ? o.stato : 'in_corso', benvenuto: o.benvenuto === true };
}

/** Forma grezza ritornata dal backend per un utente dello studio (GET /utenti). */
interface ApiUtente {
  id: number;
  nome?: string | null;
  cognome?: string | null;
  name?: string | null;
  email: string;
  ruolo?: string | null;
  role?: string | null;
  attivo?: boolean | null;
  studio_id?: number | null;
  tenant_id?: number | null;
  studio_nome?: string | null;
  tenant_name?: string | null;
  qualifica?: string | null;
  iscrizione_albo?: string | null;
  telefono?: string | null;
  created_by?: number | null;
  created_at?: string | null;
}

/**
 * Mappa un record utente del backend sul tipo UtenteStudio del DataSource.
 * Il backend espone campi minimali (id, nome, email, ruolo, attivo, created_at):
 * cognome e nome vengono derivati dallo split di `nome`/`name` quando il cognome
 * non e' fornito separatamente; ruolo si normalizza ai due valori dello studio
 * (titolare_studio | consulente), con fallback 'consulente'.
 */
function mapUtenteFromApi(u: ApiUtente): UtenteStudio {
  const full = (u.nome ?? u.name ?? '').trim();
  let nome = full;
  let cognome = (u.cognome ?? '').trim();
  // Se il cognome non e' separato, ricavalo dallo split del nome completo.
  if (!cognome && full.includes(' ')) {
    const parts = full.split(/\s+/);
    nome = parts.slice(0, -1).join(' ');
    cognome = parts[parts.length - 1];
  }
  const ruoloRaw = (u.ruolo ?? u.role ?? '').toString();
  const NOTI: UtenteStudio['ruolo'][] = ['titolare_studio', 'consulente', 'datore_lavoro', 'admin_conflavoro'];
  const ruolo: UtenteStudio['ruolo'] = NOTI.find((r) => r === ruoloRaw) ?? 'consulente';

  return {
    id: u.id,
    studio_id: u.studio_id ?? u.tenant_id ?? 0,
    studio_nome: u.studio_nome ?? u.tenant_name ?? undefined,
    nome: nome || full || u.email,
    cognome: cognome || 'n.d.',
    email: u.email,
    ruolo,
    qualifica: u.qualifica ?? undefined,
    iscrizione_albo: u.iscrizione_albo ?? undefined,
    telefono: u.telefono ?? undefined,
    attivo: u.attivo ?? true,
    created_by: u.created_by ?? 0,
    created_at: u.created_at ?? new Date().toISOString(),
  };
}

/** Forma grezza ritornata dal backend per uno studio/tenant (GET /studi). */
interface ApiStudio {
  id: number;
  nome?: string | null;
  ragione_sociale?: string | null;
  slug?: string | null;
  codice_studio?: string | null;
  plan?: string | null;
  partita_iva?: string | null;
  vat?: string | null;
  email_referente?: string | null;
  email?: string | null;
  telefono?: string | null;
  indirizzo?: string | null;
  comune?: string | null;
  provincia?: string | null;
  cap?: string | null;
  n_utenti?: number | null;
  numero_consulenti?: number | null;
  n_aziende?: number | null;
  numero_aziende_clienti?: number | null;
  attivo?: boolean | null;
  created_by?: number | null;
  created_at?: string | null;
}

/**
 * Mappa un record studio del backend sul tipo Studio del DataSource.
 * Il contratto backend espone {id, nome, slug, plan, n_utenti, n_aziende, created_at}:
 * `nome` -> ragione_sociale, `slug` -> codice_studio, `plan` confluisce in qualifica
 * informativa. I campi anagrafici estesi (P.IVA, sede) restano opzionali: il backend
 * potra' arricchirli in futuro senza rompere il frontend.
 */
function mapStudioFromApi(s: ApiStudio): Studio {
  const ragione = (s.ragione_sociale ?? s.nome ?? '').toString().trim();
  return {
    id: s.id,
    ragione_sociale: ragione || `Studio ${s.id}`,
    partita_iva: (s.partita_iva ?? s.vat ?? '').toString(),
    codice_studio: (s.codice_studio ?? s.slug ?? undefined) || undefined,
    plan: (s.plan ?? undefined) || undefined,
    email_referente: (s.email_referente ?? s.email ?? '').toString(),
    telefono: s.telefono ?? undefined,
    indirizzo: s.indirizzo ?? undefined,
    comune: s.comune ?? undefined,
    provincia: s.provincia ?? undefined,
    cap: s.cap ?? undefined,
    numero_consulenti: s.numero_consulenti ?? s.n_utenti ?? 0,
    numero_aziende_clienti: s.numero_aziende_clienti ?? s.n_aziende ?? 0,
    attivo: s.attivo ?? true,
    created_by: s.created_by ?? 0,
    created_at: s.created_at ?? new Date().toISOString(),
  };
}

/**
 * Normalizza un ApiError del backend in un Error con messaggio italiano leggibile,
 * coerente con come la UI gia' gestisce gli errori del mock.
 *
 * - 422 (validazione) -> messaggio dal primo campo in errore. Su collisione P.IVA
 *   (companies) marca code='DUPLICATE_PIVA' come fa la LocalStorageDataSource.
 * - 403 -> permesso negato.
 * - 404 -> risorsa non trovata.
 */
function normalizeRevisionSummary(raw: unknown): DvrRevisionSummary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    numero: Number(r.numero ?? 0),
    origine: r.origine === 'umano' ? 'umano' : 'ai',
    autore: typeof r.autore === 'string' ? r.autore : null,
    motivo: typeof r.motivo === 'string' && r.motivo.trim() ? r.motivo : null,
    sezioni_modificate: strArr(r.sezioni_modificate),
    sezioni_umane: strArr(r.sezioni_umane),
    totale_sezioni: Number(r.totale_sezioni ?? 0),
    canonical_27: typeof r.canonical_27 === 'boolean' ? r.canonical_27 : null,
    ha_file: r.ha_file === true,
    created_at: typeof r.created_at === 'string' ? r.created_at : null,
  };
}

function normalizeRevisionDetail(raw: unknown): DvrRevisionDetail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sezioni = Array.isArray(r.sezioni) ? r.sezioni : [];
  return {
    ...normalizeRevisionSummary(raw),
    sezioni: sezioni.map((x) => {
      const s = (x ?? {}) as Record<string, unknown>;
      return {
        key: String(s.key ?? ''),
        title: String(s.title ?? ''),
        body: String(s.body ?? ''),
        origine: s.origine === 'umano' ? 'umano' : 'ai',
        modificata_da: typeof s.modificata_da === 'string' ? s.modificata_da : null,
        modificata_at: typeof s.modificata_at === 'string' ? s.modificata_at : null,
      };
    }),
  };
}

function toReadableError(e: unknown, ctx: { entity?: string } = {}): Error {
  if (!(e instanceof ApiError)) {
    return e instanceof Error ? e : new Error(String(e));
  }

  if (e.status === 422) {
    const body = e.body as { message?: string; errors?: Record<string, string[]> } | null;
    const errors = body?.errors ?? {};
    const firstField = Object.keys(errors)[0];
    const firstMsg = firstField ? errors[firstField]?.[0] : undefined;
    const message = firstMsg ?? body?.message ?? 'Dati non validi.';
    const err = new Error(message) as Error & { code?: string; field?: string };
    err.field = firstField;
    // La P.IVA univoca lato backend produce un errore sul campo `vat`.
    if (ctx.entity === 'companies' && firstField === 'vat') {
      err.code = 'DUPLICATE_PIVA';
    } else {
      err.code = 'VALIDATION';
    }
    return err;
  }

  if (e.status === 403) {
    const err = new Error('Operazione non consentita per il tuo ruolo.') as Error & { code?: string };
    err.code = 'FORBIDDEN';
    return err;
  }

  if (e.status === 404) {
    const err = new Error('Risorsa non trovata.') as Error & { code?: string };
    err.code = 'NOT_FOUND';
    return err;
  }

  if (e.status === 409) {
    // Conflitto di stato (es. generazione DVR gia' in corso, email gia' usata):
    // il backend manda un messaggio parlante, non sostituirlo con "errore di rete".
    const body = e.body as { message?: string } | null;
    const err = new Error(body?.message ?? 'Operazione gia in corso.') as Error & { code?: string };
    err.code = 'CONFLICT';
    return err;
  }

  // Demo dal vivo: tetto giornaliero o file oltre il limite, il backend spiega già cosa fare.
  const corpoDemo = e.body as { message?: string; codice?: string } | null;
  if ((corpoDemo?.codice === 'tetto_demo' || corpoDemo?.codice === 'file_troppo_grande') && corpoDemo.message) {
    const err = new Error(corpoDemo.message) as Error & { code?: string; status?: number };
    err.code = e.status === 413 ? 'TOO_LARGE' : 'RATE_LIMIT';
    err.status = e.status;
    return err;
  }

  if (e.status === 429) {
    // Limite di frequenza (es. 20 messaggi al minuto all'agente): il messaggio
    // Laravel di default e' in inglese ("Too Many Attempts.").
    const err = new Error('Troppe richieste in poco tempo. Attendi un minuto e riprova.') as Error & { code?: string };
    err.code = 'RATE_LIMIT';
    return err;
  }

  // Rete assente, tempo scaduto, file troppo grande, errore del server: sempre
  // un messaggio in italiano che dice cosa fare (mai "Failed to fetch" o "Server Error").
  if (e.status === 0 || e.status === 408 || e.status === 413 || e.status >= 500) {
    const err = new Error(testoErroreHttp(e.status)) as Error & { code?: string; status?: number };
    err.code = e.status === 413 ? 'TOO_LARGE' : e.status === 408 ? 'TIMEOUT' : e.status === 0 ? 'NETWORK' : 'SERVER';
    err.status = e.status;
    return err;
  }

  return new Error(e.message || 'Errore di rete.');
}

/**
 * Costruisce un CRUD REST tenant-scoped per le entita' anagrafiche il cui schema
 * frontend coincide 1:1 con l'API Resource (lavoratori, dpi, attrezzature, corsi,
 * scadenze). list/get rispondono envelope `{ data }`; create/update echo dell'item.
 */
function restResource<T extends { id: number }>(path: string, entity: string) {
  const get404asNull = async (id: number): Promise<T | null> => {
    try {
      return unwrap<T>(await api.get<unknown>(`${path}/${id}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw toReadableError(e, { entity });
    }
  };

  return {
    list: async (params?: { companyId?: number }): Promise<T[]> => {
      try {
        // Scope per azienda lato server (il backend filtra + evita il troncamento a 25
        // del filtro client-side su collezioni paginate).
        const url = params?.companyId != null ? `${path}?company_id=${params.companyId}` : path;
        return unwrapList<T>(await api.get<unknown>(url));
      } catch (e) {
        throw toReadableError(e, { entity });
      }
    },
    get: get404asNull,
    create: async (data: Omit<T, 'id' | 'created_at' | 'created_by'>): Promise<T> => {
      try {
        return unwrap<T>(await api.post<unknown>(path, data));
      } catch (e) {
        throw toReadableError(e, { entity });
      }
    },
    update: async (id: number, patch: Partial<T>): Promise<T> => {
      try {
        return unwrap<T>(await api.patch<unknown>(`${path}/${id}`, patch));
      } catch (e) {
        throw toReadableError(e, { entity });
      }
    },
    delete: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`${path}/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity });
      }
    },
  };
}

export class ApiDataSource implements DataSource {
  readonly mode = 'api' as const;

  auth = {
    login: async (email: string, password: string): Promise<User> => {
      const res = await authClient.login(email, password);
      setToken(res.access_token);
      return mapApiUser(await authClient.me());
    },
    loginAs: async (_role: Role): Promise<User> => {
      throw new Error('loginAs non supportato in ApiDataSource: usa email/password o Google.');
    },
    googleLogin: async (credential: string): Promise<GoogleLoginResult> => {
      const res = await authClient.google(credential);
      setToken(res.access_token);
      // Il backend ritorna gia' l'utente (UserResource): evita un /me superfluo.
      const user = mapApiUser(res.user);
      return { user, needs_onboarding: res.needs_onboarding };
    },
    completeOnboarding: async (profile: OnboardingProfile): Promise<User> => {
      // Mappa i campi del wizard frontend sui nomi attesi da OnboardingRequest.
      const res = await authClient.onboarding({
        role: profile.role,
        access_code: profile.admin_invite_code,
        studio_name: profile.studio_nome,
        studio_vat: profile.studio_partita_iva,
        studio_code: profile.studio_codice_invito,
        // datore_lavoro: il codice invito ricevuto dal consulente (il backend lo
        // lega alla company in sola lettura). BUG storico: non veniva inviato.
        azienda_invite_code: profile.azienda_invite_code,
      });
      // Il backend rigenera il JWT con i claim aggiornati (tenant_id + role).
      setToken(res.access_token);
      return mapApiUser(res.user);
    },
    me: async (): Promise<User | null> => {
      // Nessun token -> utente non loggato: ritorna null SENZA chiamare l'API
      // (evita 401 -> refresh -> redirect loop alla root).
      await attendiToken();
      if (!getToken()) return null;
      try {
        return mapApiUser(await authClient.me());
      } catch {
        return null;
      }
    },
    logout: async (): Promise<void> => {
      try {
        await authClient.logout();
      } finally {
        setToken(null);
        // App: file recenti, sblocco e tempo reale non restano al prossimo utente.
        await import('@/lib/app/uscita').then((m) => m.pulisciAllUscita()).catch(() => undefined);
      }
    },
  };

  companies = {
    list: async (): Promise<Company[]> => {
      try {
        return unwrapList<ApiCompany>(await api.get<unknown>('/companies')).map(mapCompanyFromApi);
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    get: async (id: number): Promise<Company | null> => {
      try {
        return mapCompanyFromApi(unwrap<ApiCompany>(await api.get<unknown>(`/companies/${id}`)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    create: async (data: Omit<Company, 'id' | 'created_at' | 'created_by'>): Promise<Company> => {
      try {
        const raw = unwrap<ApiCompany>(await api.post<unknown>('/companies', mapCompanyToApi(data)));
        return mapCompanyFromApi(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    update: async (id: number, patch: Partial<Company>): Promise<Company> => {
      try {
        const raw = unwrap<ApiCompany>(
          await api.patch<unknown>(`/companies/${id}`, mapCompanyToApi(patch))
        );
        return mapCompanyFromApi(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    delete: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`/companies/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    extractFromDocument: async (
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<CompanyExtractionResult> => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        // Il backend risponde gia' coi nomi frontend dentro `data`
        // (ragione_sociale, partita_iva, ..., sedi[]). Coerce minimale lato client.
        const res = await apiUpload<{ data?: unknown; disclaimer?: string }>(
          '/companies/extract',
          fd,
          onProgress
        );
        return {
          data: coerceExtractedCompany(res?.data),
          disclaimer: res?.disclaimer || AI_EXTRACTION_DISCLAIMER,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
    datoreInvite: async (companyId: number): Promise<{ code: string; company_id: number }> => {
      try {
        const res = await api.post<unknown>(`/companies/${companyId}/datore-invite`, {});
        const r = res as Record<string, unknown>;
        return {
          code: String(r.code ?? ''),
          company_id: Number(r.company_id ?? companyId),
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'companies' });
      }
    },
  };

  dvr = {
    list: async (): Promise<Dvr[]> => {
      try {
        return unwrapList<ApiDvr>(await api.get<unknown>('/dvr')).map(mapDvrFromApi);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    get: async (id: number): Promise<Dvr | null> => {
      try {
        return mapDvrFromApi(unwrap<ApiDvr>(await api.get<unknown>(`/dvr/${id}`)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    create: async (
      data: Omit<Dvr, 'id' | 'versione' | 'data_creazione' | 'created_by' | 'ai_disclaimer_text'>
    ): Promise<Dvr> => {
      try {
        const raw = unwrap<ApiDvr>(await api.post<unknown>('/dvr', mapDvrCreateToApi(data)));
        return mapDvrFromApi(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    update: async (id: number, patch: Partial<Dvr>): Promise<Dvr> => {
      try {
        const raw = unwrap<ApiDvr>(await api.patch<unknown>(`/dvr/${id}`, mapDvrUpdateToApi(patch)));
        return mapDvrFromApi(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    approve: async (id: number): Promise<Dvr> => {
      try {
        const raw = unwrap<ApiDvr>(await api.post<unknown>(`/dvr/${id}/approve`));
        return mapDvrFromApi(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    delete: async (id: number): Promise<void> => {
      try {
        // Backend: DELETE /dvr/{id} -> 204.
        await api.delete<unknown>(`/dvr/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    audit: async (_dvrId: number): Promise<AuditLogEntry[]> => {
      // L'audit log non e' (ancora) esposto via API: ritorna lista vuota anziche'
      // rompere la UI che lo mostra in modo opzionale.
      return [];
    },
    // Generazione DVR con AI: esposta dentro `dvr` (interfaccia uniforme col mock).
    generate: (dvrId: number, opts?: DvrGenerateOptions): Promise<DvrGenerationResult> =>
      this._generate(dvrId, opts),
    generationStatus: (dvrId: number): Promise<DvrGenerationStatus> =>
      this._generationStatus(dvrId),
    // Storico revisioni (ADR-007). Lettura anche per il datore; scritture solo
    // consulente/titolare/admin (403 lato backend negli altri casi).
    revisions: async (dvrId: number): Promise<DvrRevisionList> => {
      try {
        const res = await api.get<Partial<DvrRevisionList>>(`/dvr/${dvrId}/revisions`);
        return {
          dvr_id: Number(res?.dvr_id ?? dvrId),
          corrente: typeof res?.corrente === 'number' ? res.corrente : null,
          data: Array.isArray(res?.data) ? res.data.map(normalizeRevisionSummary) : [],
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    revision: async (dvrId: number, numero: number): Promise<DvrRevisionDetail> => {
      try {
        const raw = unwrap<DvrRevisionDetail>(await api.get<unknown>(`/dvr/${dvrId}/revisions/${numero}`));
        return normalizeRevisionDetail(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    createRevision: async (dvrId: number, input: DvrRevisionCreateInput): Promise<DvrRevisionDetail> => {
      try {
        const body: DvrRevisionCreateInput = { modifiche: input.modifiche };
        const motivo = input.motivo?.trim();
        if (motivo) body.motivo = motivo;
        const raw = unwrap<DvrRevisionDetail>(await api.post<unknown>(`/dvr/${dvrId}/revisions`, body));
        return normalizeRevisionDetail(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    restoreRevision: async (dvrId: number, numero: number): Promise<DvrRevisionSummary> => {
      try {
        const raw = unwrap<DvrRevisionSummary>(
          await api.post<unknown>(`/dvr/${dvrId}/revisions/${numero}/restore`)
        );
        return normalizeRevisionSummary(raw);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
  };

  lavoratori = restResource<Lavoratore>('/lavoratori', 'lavoratori');
  dpi = restResource<Dpi>('/dpi', 'dpi');
  attrezzature = restResource<Attrezzatura>('/attrezzature', 'attrezzature');
  corsi = restResource<Corso>('/corsi', 'corsi');
  scadenze = restResource<Scadenza>('/scadenze', 'scadenze');

  // Studi (gate admin_conflavoro lato backend): CRUD su /studi.
  // Contratto backend: GET -> {data:[{id,nome,slug,plan,n_utenti,n_aziende,created_at}]};
  // POST {nome,plan?}; PATCH {nome?,plan?}; DELETE -> 204 (422 se ha collegamenti).
  // Le scritture mappano i campi frontend (ragione_sociale->nome, plan) sul contratto.
  studi = {
    list: async (): Promise<Studio[]> => {
      try {
        return unwrapList<ApiStudio>(await api.get<unknown>('/studi')).map(mapStudioFromApi);
      } catch (e) {
        throw toReadableError(e, { entity: 'studi' });
      }
    },
    get: async (id: number): Promise<Studio | null> => {
      try {
        return mapStudioFromApi(unwrap<ApiStudio>(await api.get<unknown>(`/studi/${id}`)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw toReadableError(e, { entity: 'studi' });
      }
    },
    create: async (data: Omit<Studio, 'id' | 'created_at' | 'created_by'>): Promise<Studio> => {
      try {
        const body: { nome: string; plan?: string } = { nome: data.ragione_sociale };
        if (data.plan) body.plan = data.plan;
        return mapStudioFromApi(unwrap<ApiStudio>(await api.post<unknown>('/studi', body)));
      } catch (e) {
        throw toReadableError(e, { entity: 'studi' });
      }
    },
    update: async (id: number, patch: Partial<Studio>): Promise<Studio> => {
      try {
        const body: { nome?: string; plan?: string } = {};
        if (patch.ragione_sociale !== undefined) body.nome = patch.ragione_sociale;
        if (patch.plan !== undefined) body.plan = patch.plan;
        return mapStudioFromApi(unwrap<ApiStudio>(await api.patch<unknown>(`/studi/${id}`, body)));
      } catch (e) {
        throw toReadableError(e, { entity: 'studi' });
      }
    },
    delete: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`/studi/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'studi' });
      }
    },
  };
  utenti = {
    // GET /utenti — elenco utenti dello studio (tenant-scoped lato backend).
    // Il backend risponde envelope `{ data: [...] }` con record minimali
    // (id, nome, email, ruolo, attivo, created_at). Mappa al tipo UtenteStudio,
    // sintetizzando i campi non esposti dall'API (cognome dallo split del nome,
    // studio_id dal tenant). 403 (ruolo senza visibilita') -> errore leggibile;
    // la pagina Team degrada a lista vuota a monte.
    list: async (): Promise<UtenteStudio[]> => {
      try {
        return unwrapList<ApiUtente>(await api.get<unknown>('/utenti')).map(mapUtenteFromApi);
      } catch (e) {
        throw toReadableError(e, { entity: 'utenti' });
      }
    },
    get: async (id: number): Promise<UtenteStudio | null> => {
      try {
        return mapUtenteFromApi(unwrap<ApiUtente>(await api.get<unknown>(`/utenti/${id}`)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw toReadableError(e, { entity: 'utenti' });
      }
    },
    // POST /utenti (gate titolare): body {nome, email, ruolo?, password?}.
    // Il backend ritorna l'utente creato + eventuale {password_temporanea} se la
    // password non e' stata fornita: la propaghiamo sul valore restituito (campo
    // opzionale di UtenteStudio) cosi' la UI puo' mostrarla una volta al titolare.
    // `nome` sul backend = nome completo: ricompongo nome+cognome.
    create: async (data: UtenteCreateInput): Promise<UtenteStudio> => {
      try {
        const nomeCompleto = [data.nome, data.cognome]
          .map((p) => (p ?? '').trim())
          .filter((p) => p && p !== 'n.d.')
          .join(' ');
        const body: { nome: string; email: string; ruolo?: string; password?: string } = {
          nome: nomeCompleto || data.nome || data.email,
          email: data.email,
          ruolo: data.ruolo,
        };
        if (data.password) body.password = data.password;
        const res = await api.post<unknown>('/utenti', body);
        const raw = unwrap<ApiUtente & { password_temporanea?: string }>(res);
        // La password temporanea puo' arrivare nell'oggetto utente o accanto all'envelope.
        const envelope = res as { password_temporanea?: string } | null;
        const tempPwd = raw?.password_temporanea ?? envelope?.password_temporanea;
        const utente = mapUtenteFromApi(raw);
        if (tempPwd) utente.password_temporanea = tempPwd;
        return utente;
      } catch (e) {
        throw toReadableError(e, { entity: 'utenti' });
      }
    },
    // PATCH /utenti/{id}: body {nome?, ruolo?, attivo?}.
    update: async (id: number, patch: Partial<UtenteStudio>): Promise<UtenteStudio> => {
      try {
        const body: { nome?: string; ruolo?: string; attivo?: boolean } = {};
        if (patch.nome !== undefined || patch.cognome !== undefined) {
          const nomeCompleto = [patch.nome, patch.cognome]
            .map((p) => (p ?? '').trim())
            .filter((p) => p && p !== 'n.d.')
            .join(' ');
          if (nomeCompleto) body.nome = nomeCompleto;
        }
        if (patch.ruolo !== undefined) body.ruolo = patch.ruolo;
        if (patch.attivo !== undefined) body.attivo = patch.attivo;
        return mapUtenteFromApi(unwrap<ApiUtente>(await api.patch<unknown>(`/utenti/${id}`, body)));
      } catch (e) {
        throw toReadableError(e, { entity: 'utenti' });
      }
    },
    // DELETE /utenti/{id} -> 204.
    delete: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`/utenti/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'utenti' });
      }
    },
  };

  // ----- Media / documenti DVR -----
  // Backend: POST /dvr/{id}/documents, POST /dvr/{id}/media (multipart),
  // POST /dvr/{id}/generate, GET /dvr/{id}/generation-status.
  // Il backend NON espone una lista upload ne' la cancellazione: i metadati sono
  // dentro Dvr.payload (uploaded_documents / uploaded_media).
  media = {
    uploadDocument: async (
      dvrId: number,
      file: File,
      onProgress?: UploadProgress
    ): Promise<DvrUpload> => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await apiUpload<{ message?: string; document?: { tipo?: string } }>(
          `/dvr/${dvrId}/documents`,
          fd,
          onProgress
        );
        return this._uploadFromResponse(dvrId, file, 'document', res?.document?.tipo);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    uploadMedia: async (
      dvrId: number,
      file: File,
      onProgress?: UploadProgress
    ): Promise<DvrUpload> => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await apiUpload<{ message?: string; media?: { tipo?: string } }>(
          `/dvr/${dvrId}/media`,
          fd,
          onProgress
        );
        return this._uploadFromResponse(dvrId, file, 'media', res?.media?.tipo);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    listUploads: async (dvrId: number): Promise<DvrUpload[]> => {
      // Ricostruisce la lista upload dai metadati nel payload del DVR.
      try {
        const raw = unwrap<ApiDvr>(await api.get<unknown>(`/dvr/${dvrId}`));
        const payload = (raw.payload ?? {}) as unknown as Record<string, unknown>;
        const docs = (payload.uploaded_documents as Array<{ tipo?: string; path?: string }>) ?? [];
        const medias = (payload.uploaded_media as Array<{ tipo?: string; r2_key?: string; mime?: string }>) ?? [];
        const now = new Date().toISOString();
        const out: DvrUpload[] = [];
        docs.forEach((d, i) => {
          out.push({
            id: i + 1,
            dvr_id: dvrId,
            kind: 'document',
            filename: (d.path ?? '').split('/').pop() ?? `documento-${i + 1}`,
            mime: 'application/octet-stream',
            size_bytes: 0,
            status: 'caricato',
            note: d.tipo,
            created_by: 0,
            created_at: now,
          });
        });
        medias.forEach((m, i) => {
          out.push({
            // Numerazione 1-based PER KIND: index backend = id - 1 per documents e media.
            id: i + 1,
            dvr_id: dvrId,
            kind: 'media',
            filename: (m.r2_key ?? '').split('/').pop() ?? `media-${i + 1}`,
            mime: m.mime ?? 'image/jpeg',
            size_bytes: 0,
            status: 'caricato',
            note: m.tipo,
            created_by: 0,
            created_at: now,
          });
        });
        return out;
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    deleteUpload: async (dvrId: number, kind: UploadKind, uploadId: number): Promise<void> => {
      // uploadId e' 1-based per kind (vedi listUploads); l'index backend e' 0-based.
      const index = uploadId - 1;
      const segment = kind === 'media' ? 'media' : 'documents';
      try {
        // Backend: DELETE /dvr/{id}/documents/{index} | /dvr/{id}/media/{index} -> 204.
        await api.delete<unknown>(`/dvr/${dvrId}/${segment}/${index}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
  };

  // ----- AI assist (scrivi / detta) -----
  // Backend: POST /ai/assist (JSON), POST /ai/transcribe (multipart audio).
  ai = {
    assist: async (input: AiAssistInput): Promise<AiAssistResult> => {
      try {
        const res = await api.post<{ testo?: string; disclaimer?: string; fonti?: string[] }>(
          '/ai/assist',
          {
            sezione: input.sezione,
            istruzione: input.istruzione,
            contesto: input.contesto,
            company_id: input.companyId,
          }
        );
        return {
          testo: typeof res?.testo === 'string' ? res.testo : '',
          disclaimer: res?.disclaimer || AI_ASSIST_DISCLAIMER,
          fonti: Array.isArray(res?.fonti) ? res!.fonti : undefined,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    transcribe: async (file: File, options?: AiTranscribeOptions): Promise<AiTranscribeResult> => {
      const fd = new FormData();
      fd.append('file', file);
      if (options?.companyId != null) fd.append('company_id', String(options.companyId));
      if (options?.contesto) fd.append('contesto', options.contesto);
      try {
        const res = await apiUpload<{ testo?: string; errore?: string }>('/ai/transcribe', fd);
        return {
          testo: typeof res?.testo === 'string' ? res.testo : '',
          errore: typeof res?.errore === 'string' ? res.errore : undefined,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    describeImage: async (file: File, options?: AiTranscribeOptions): Promise<AiTranscribeResult> => {
      const fd = new FormData();
      fd.append('file', file);
      if (options?.companyId != null) fd.append('company_id', String(options.companyId));
      if (options?.contesto) fd.append('contesto', options.contesto);
      try {
        const res = await apiUpload<{ testo?: string; errore?: string }>('/ai/describe-image', fd);
        return {
          testo: typeof res?.testo === 'string' ? res.testo : '',
          errore: typeof res?.errore === 'string' ? res.errore : undefined,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    risks: async (input: AiRisksInput): Promise<AiRisksResult> => {
      try {
        const res = await api.post<{ rischi?: AiRischioProposto[]; disclaimer?: string; errore?: string }>(
          '/ai/risks',
          {
            company_id: input.companyId,
            mansioni: input.mansioni,
            cicli: input.cicli,
            document_ids: input.documentIds,
          }
        );
        return {
          rischi: Array.isArray(res?.rischi) ? res!.rischi : [],
          disclaimer: res?.disclaimer || AI_ASSIST_DISCLAIMER,
          errore: res?.errore,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    describeVideo: async (input: AiVideoInput): Promise<AiVideoResult> => {
      try {
        const res = await api.post<{ testo?: string; disclaimer?: string; errore?: string }>(
          '/ai/describe-video',
          {
            company_id: input.companyId,
            contesto: input.contesto,
            audio_transcript: input.audioTranscript,
            frames: input.frames,
            frame_mime: 'image/jpeg',
          }
        );
        return {
          testo: typeof res?.testo === 'string' ? res.testo : '',
          disclaimer: res?.disclaimer || AI_ASSIST_DISCLAIMER,
          errore: res?.errore,
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
  };

  // ----- Archivio documentale per-azienda -----
  companyDocuments = {
    list: async (companyId: number): Promise<CompanyDocument[]> => {
      try {
        return unwrapList<CompanyDocument>(await api.get<unknown>(`/company-documents?company_id=${companyId}`));
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    addNote: async (companyId: number, testo: string, titolo?: string, origine?: string, tipo?: CompanyDocumentTipo): Promise<CompanyDocument> => {
      try {
        const res = await api.post<{ data?: CompanyDocument }>('/company-documents', {
          company_id: companyId,
          tipo: tipo ?? 'nota',
          testo,
          titolo,
          origine: origine ?? 'manuale',
        });
        return res!.data as CompanyDocument;
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    addFile: async (
      companyId: number,
      tipo: CompanyDocumentTipo,
      file: File,
      options?: { titolo?: string; origine?: string; onProgress?: (p: number) => void }
    ): Promise<CompanyDocument> => {
      const fd = new FormData();
      fd.append('company_id', String(companyId));
      fd.append('tipo', tipo);
      fd.append('file', file);
      if (options?.titolo) fd.append('titolo', options.titolo);
      if (options?.origine) fd.append('origine', options.origine);
      try {
        const res = await apiUpload<{ data?: CompanyDocument }>('/company-documents', fd, options?.onProgress);
        return res!.data as CompanyDocument;
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    update: async (id: number, fields: { titolo?: string | null; testo_analisi?: string | null }): Promise<CompanyDocument> => {
      try {
        const res = await api.patch<{ data?: CompanyDocument }>(`/company-documents/${id}`, fields);
        return res!.data as CompanyDocument;
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    reanalyze: async (id: number): Promise<CompanyDocument> => {
      try {
        const res = await api.post<{ data?: CompanyDocument }>(`/company-documents/${id}/reanalyze`, {});
        return res!.data as CompanyDocument;
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
    download: async (id: number, filename?: string): Promise<void> => {
      const token = getToken();
      const res = await fetchConTempo(apiUrl(`/company-documents/${id}/download`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download non riuscito');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `documento_${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    previewUrl: async (id: number): Promise<string> => {
      const token = getToken();
      const res = await fetchConTempo(apiUrl(`/company-documents/${id}/download`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Anteprima non disponibile');
      return URL.createObjectURL(await res.blob());
    },
    delete: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`/company-documents/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'dvr' });
      }
    },
  };

  // ----- Super Agente HSE -----
  // Backend: POST /agente/messaggi (sincrona, 10-60 s), GET/DELETE /agente/conversazioni,
  // GET/PUT /agente/profilo (PUT solo titolare/admin).
  agente = {
    invia: async (input: AgenteInvioInput): Promise<AgenteInvioRisultato> => {
      const body: Record<string, unknown> = { testo: input.testo };
      if (input.conversazioneId != null) body.conversazione_id = input.conversazioneId;
      if (input.aziendaId != null) body.azienda_id = input.aziendaId;
      if (input.vocale) body.vocale = true;
      if (input.richiestaId) body.richiesta_id = input.richiestaId;
      if (input.sezione) body.sezione = input.sezione;
      if (input.oggetto) body.oggetto = { tipo: input.oggetto.tipo, id: input.oggetto.id };
      try {
        // L'agente puo' lavorare a lungo (documenti interi): tempo massimo ampio, mai infinito.
        const res = await api.post<{ data?: Record<string, unknown> }>('/agente/messaggi', body, { timeoutMs: TEMPI.agente });
        const d = res?.data ?? {};
        return {
          conversazione: mapAgenteConversazione(d.conversazione),
          messaggio_utente: mapAgenteMessaggio(d.messaggio_utente),
          risposta: mapAgenteMessaggio(d.risposta),
          interfaccia: mapPassiInterfaccia((d.risposta as Record<string, unknown> | undefined)?.interfaccia),
          ricerca: mapRicercaDocumenti((d.risposta as Record<string, unknown> | undefined)?.interfaccia),
        };
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    conversazioni: async (filtro?: { sezione?: string | null; aziendaId?: number | null }): Promise<AgenteConversazione[]> => {
      try {
        const q = new URLSearchParams();
        if (filtro?.sezione) q.set('sezione', filtro.sezione);
        if (filtro?.aziendaId) q.set('azienda_id', String(filtro.aziendaId));
        const res = await api.get<{ data?: unknown }>(`/agente/conversazioni${q.toString() ? `?${q}` : ''}`);
        return (Array.isArray(res?.data) ? res.data : []).map(mapAgenteConversazione);
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    conversazione: async (id: number): Promise<AgenteConversazioneDettaglio> => {
      try {
        const res = await api.get<{ data?: unknown }>(`/agente/conversazioni/${id}`);
        return mapAgenteDettaglio(res?.data);
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    eliminaConversazione: async (id: number): Promise<void> => {
      try {
        await api.delete<unknown>(`/agente/conversazioni/${id}`);
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    profilo: async (): Promise<AgenteProfilo> => {
      try {
        const res = await api.get<{ data?: unknown }>('/agente/profilo');
        return mapAgenteProfilo(res?.data);
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    aggiornaProfilo: async (input: AgenteProfiloUpdate): Promise<AgenteProfilo> => {
      try {
        await api.put<unknown>('/agente/profilo', input);
        // Il PUT ritorna solo le impostazioni: rileggo il profilo completo
        // (elenco strumenti + modificabile). La cache GET e' gia' invalidata dal PUT.
        const res = await api.get<{ data?: unknown }>('/agente/profilo');
        return mapAgenteProfilo(res?.data);
      } catch (e) {
        throw toReadableError(e, { entity: 'agente' });
      }
    },
    progresso: async (richiestaId: string): Promise<AgenteProgresso> => {
      // Mai dalla cache GET: serve vedere l'avanzamento cambiare ogni secondo.
      const res = await apiRequest<{ data?: unknown }>(`/agente/progresso/${encodeURIComponent(richiestaId)}`, { method: 'GET' });
      return mapAgenteProgresso(res?.data);
    },
    voce: async (testo: string): Promise<Blob> => {
      // POST diretto (niente cache GET): risposta audio/mpeg.
      const token = getToken();
      const res = await fetchConTempo(apiUrl('/agente/voce'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ testo }),
      });
      if (!res.ok) {
        const err = new Error(res.status === 503 ? 'Voce non configurata.' : 'Voce non disponibile.') as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      // Inizio di ogni parola (ms) quando la voce li dà: il testo si scurisce a tempo.
      const blob = (await res.blob()) as Blob & { parole?: number[] };
      const h = res.headers?.get?.('X-Voce-Parole');
      if (h) blob.parole = h.split(',').map(Number).filter((n) => Number.isFinite(n));
      return blob;
    },
  };

  cantieri = {
    list: async (params?: { companyId?: number }): Promise<Cantiere[]> => {
      try {
        const q = params?.companyId != null ? `?company_id=${params.companyId}&per_page=100` : '?per_page=100';
        return unwrapList<unknown>(await api.get<unknown>(`/cantieri${q}`))
          .map(mapCantiere)
          .filter((c): c is Cantiere => c !== null);
      } catch (e) {
        throw toReadableError(e, { entity: 'cantiere' });
      }
    },
    create: async (data: CantiereNuovo): Promise<Cantiere> => {
      try {
        const c = mapCantiere(unwrap<unknown>(await api.post<unknown>('/cantieri', data)));
        if (!c) throw new Error('Risposta del server non valida.');
        return c;
      } catch (e) {
        throw toReadableError(e, { entity: 'cantiere' });
      }
    },
  };

  /** Safety Control Room: implementazione in control-room-api.ts. */
  controlRoom = creaControlRoomApi();

  /** Documenti dell'azienda (tavolo) e coda di lavoro del Portale: moduli-api.ts. */
  documentiHse = creaDocumentiHseApi();
  coda = creaCodaApi();

  /** Loghi dell'azienda e dello studio nei documenti: loghi-api.ts. */
  loghi = creaLoghiApi();

  pos = {
    list: async (params?: { cantiereId?: number; companyId?: number }): Promise<PosDocumento[]> => {
      try {
        const q = new URLSearchParams({ per_page: '100' });
        if (params?.cantiereId != null) q.set('cantiere_id', String(params.cantiereId));
        if (params?.companyId != null) q.set('company_id', String(params.companyId));
        return unwrapList<unknown>(await api.get<unknown>(`/pos?${q.toString()}`))
          .map(mapPos)
          .filter((p): p is PosDocumento => p !== null);
      } catch (e) {
        throw toReadableError(e, { entity: 'pos' });
      }
    },
    download: async (id: number, formato: 'pdf' | 'docx'): Promise<void> => {
      const token = getToken();
      const res = await fetchConTempo(apiUrl(`/pos/${id}/download/${formato}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(res.status === 404 ? 'Il POS non ha ancora una revisione emessa.' : 'Download non riuscito.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `POS_${id}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  };

  /**
   * Avvia la generazione del DVR (POST /dvr/{id}/generate). Ritorna la risposta
   * grezza del backend (modalita sync o async + stato).
   *
   * Mantenuto anche come metodo di istanza per retrocompatibilita': la via
   * canonica per la UI e' `ds.dvr.generate(id)` (parte dell'interfaccia DataSource).
   */
  generate(dvrId: number, opts?: DvrGenerateOptions): Promise<DvrGenerationResult> {
    return this._generate(dvrId, opts);
  }

  /**
   * Stato corrente della generazione (GET /dvr/{id}/generation-status).
   * Vedi nota su `generate`: via canonica = `ds.dvr.generationStatus(id)`.
   */
  generationStatus(dvrId: number): Promise<DvrGenerationStatus> {
    return this._generationStatus(dvrId);
  }

  private async _generate(dvrId: number, opts?: DvrGenerateOptions): Promise<DvrGenerationResult> {
    try {
      const res = await api.post<{ mode: 'sync' | 'async'; generation_status?: string; result?: unknown }>(
        `/dvr/${dvrId}/generate`,
        { riscrivi_modifiche_umane: opts?.riscriviModificheUmane === true }
      );
      return { mode: res.mode, status: res.generation_status, result: res.result };
    } catch (e) {
      throw toReadableError(e, { entity: 'dvr' });
    }
  }

  private async _generationStatus(dvrId: number): Promise<DvrGenerationStatus> {
    try {
      // Senza la cache GET di 30 s: chi interroga lo stato lo fa per vederlo cambiare.
      return await apiRequest<DvrGenerationStatus>(`/dvr/${dvrId}/generation-status`, { method: 'GET' });
    } catch (e) {
      throw toReadableError(e, { entity: 'dvr' });
    }
  }

  /** Costruisce un DvrUpload sintetico dalla risposta del backend (che non lo ritorna intero). */
  private _uploadFromResponse(
    dvrId: number,
    file: File,
    kind: 'document' | 'media',
    tipo?: string
  ): DvrUpload {
    return {
      id: Date.now(),
      dvr_id: dvrId,
      kind,
      filename: file.name,
      mime: file.type || (kind === 'media' ? 'image/jpeg' : 'application/octet-stream'),
      size_bytes: file.size,
      status: 'caricato',
      note: tipo,
      created_by: 0,
      created_at: new Date().toISOString(),
    };
  }

  async health(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const res = await api.get<{ app: string; laravel: string }>('/health', { anonymous: true });
      return {
        mode: 'api',
        ok: res.app === 'ok',
        latency_ms: Date.now() - start,
        version: `Laravel ${res.laravel}`,
      };
    } catch (e) {
      return {
        mode: 'api',
        ok: false,
        latency_ms: Date.now() - start,
        error: (e as Error).message,
      };
    }
  }
}
