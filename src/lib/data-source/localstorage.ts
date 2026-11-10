// Implementazione DataSource basata su localStorage del browser.
// CRUD persistente, scoped per utente loggato (chiavi `crm_dvr:u{userId}:...`).
// Ogni utente parte da 0 (niente seed). Switch a backend Laravel reale =
// solo cambio del factory binding.

'use client';

import { creaLoghiLocale } from './loghi-api';
import { creaCodaDemo, creaDocumentiHseDemo, pannelliDemo } from './moduli-demo';
import {
  loginAs as mockLoginAs,
  loginCustom,
  loginWithGoogleMock,
  applyOnboardingMock,
  getCurrentUser,
  logout as mockLogout,
  ROLES,
  type Role,
} from '../mock-auth';
import {
  type AgenteConversazione,
  type AgenteConversazioneDettaglio,
  type AgenteEvento,
  type AgenteProgresso,
  type AgenteInvioInput,
  type AgenteInvioRisultato,
  type AgenteMessaggio,
  type AgenteProfilo,
  type AgenteProfiloUpdate,
  type AgenteStrumento,
  AI_ASSIST_DISCLAIMER,
  AI_DISCLAIMER,
  AI_EXTRACTION_DISCLAIMER,
  calcolaLivelloRischio,
  type AiAssistInput,
  type AiAssistResult,
  type AiRisksInput,
  type AiRisksResult,
  type AiTranscribeOptions,
  type AiTranscribeResult,
  type AiVideoInput,
  type AiVideoResult,
  type Attrezzatura,
  type CompanyDocument,
  type CompanyDocumentTipo,
  type AuditLogEntry,
  type Company,
  type CompanyExtractionResult,
  type Corso,
  type DataSource,
  type Dpi,
  type Dvr,
  type DvrGenerationResult,
  type DvrGenerationStatus,
  type DvrGenerateOptions,
  type DvrRevisionCreateInput,
  type DvrRevisionDetail,
  type DvrRevisionList,
  type DvrRevisionSection,
  type DvrRevisionSummary,
  type DvrPayload,
  type DvrUpload,
  type GoogleLoginResult,
  type HealthStatus,
  type Lavoratore,
  type OnboardingProfile,
  type RischioLivello,
  type Scadenza,
  type Studio,
  type UploadKind,
  type UploadProgress,
  type User,
  type UtenteStudio,
} from './types';
import type { Cantiere, CantiereNuovo, PosDocumento } from './types';
import { mapAgenteDettaglio, mapCantiere, mapPannello, mapPos } from './agente-mappers';
import { creaControlRoomLocale, type PassDemo } from './control-room-locale';

const ROOT_PREFIX = 'crm_dvr';

/** Passaporti demo di tutti gli utenti del browser (la pagina pubblica non ha login). */
function passaportiDelBrowser(): Array<{ chiave: string; voci: PassDemo[] }> {
  if (typeof localStorage === 'undefined' || typeof localStorage.key !== 'function') return [];
  const out: Array<{ chiave: string; voci: PassDemo[] }> = [];
  for (let i = 0; i < (localStorage.length ?? 0); i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${ROOT_PREFIX}:u`) && k.endsWith(':cr_passaporti')) out.push({ chiave: k, voci: readArray<PassDemo>(k) });
  }
  return out;
}

/**
 * Decodifica (SENZA verificare) il payload di un ID token Google per leggere
 * nome/email/foto, solo per la demo: l'utente vede la propria identita' reale.
 * In produzione il token e' verificato lato server (firma/aud/exp).
 */
function decodeGoogleIdToken(idToken: string): {
  name?: string;
  email?: string;
  avatar_url?: string;
} {
  try {
    const part = idToken.split('.')[1];
    if (!part) return {};
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(b64)))) as {
      name?: string;
      email?: string;
      picture?: string;
    };
    return { name: json.name, email: json.email, avatar_url: json.picture };
  } catch {
    return {};
  }
}

function nsForUser(userId: number, suffix: string): string {
  return `${ROOT_PREFIX}:u${userId}:${suffix}`;
}

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function nextId<T extends { id: number }>(arr: T[]): number {
  return arr.reduce((max, x) => (x.id > max ? x.id : max), 0) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function sha256(content: string): Promise<string> {
  if (typeof window === 'undefined' || !crypto.subtle) {
    return Math.random().toString(16).slice(2).padEnd(64, '0');
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function adaptUser(u: ReturnType<typeof getCurrentUser>): User | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    tenant_id: u.tenant_id,
    tenant_name: u.tenant_name,
    mfa_enabled: u.mfa_enabled,
    needs_onboarding: u.needs_onboarding,
    avatar_url: u.avatar_url,
  };
}

// ----- Revisioni demo -----

function toRevisionSummary(r: DvrRevisionDetail): DvrRevisionSummary {
  const { sezioni, ...rest } = r;
  return {
    ...rest,
    sezioni_umane: sezioni.filter((x) => x.origine === 'umano').map((x) => x.key),
    totale_sezioni: sezioni.length,
  };
}

function buildMockRevision(
  existing: DvrRevisionDetail[],
  origine: 'ai' | 'umano',
  autore: string | null,
  motivo: string | null,
  sezioni: DvrRevisionSection[],
  prev: DvrRevisionDetail | undefined,
): DvrRevisionDetail {
  const numero = existing.reduce((m, r) => Math.max(m, r.numero), 0) + 1;
  const modificate = sezioni
    .filter((sec) => {
      const old = prev?.sezioni.find((x) => x.key === sec.key);
      return !old || old.body !== sec.body || old.title !== sec.title;
    })
    .map((x) => x.key);
  return {
    numero,
    origine,
    autore,
    motivo,
    sezioni_modificate: prev ? modificate : [],
    sezioni_umane: sezioni.filter((x) => x.origine === 'umano').map((x) => x.key),
    totale_sezioni: sezioni.length,
    canonical_27: null,
    // In demo i file sono prodotti al volo dal generatore client side.
    ha_file: false,
    created_at: nowIso(),
    sezioni,
  };
}

/** Testo demo delle sezioni A..I ricavato dal payload strutturato. */
function mockSectionsFromPayload(p: DvrPayload | undefined): DvrRevisionSection[] {
  const pl = (p ?? {}) as Partial<DvrPayload>;
  const list = (items: string[] | undefined) => (items ?? []).filter(Boolean).join('\n');
  const a = pl.sezione_a;
  const b = pl.sezione_b;
  const c = pl.sezione_c;
  const f = pl.sezione_f;
  const rows: Array<[string, string, string]> = [
    ['A', 'Dati identificativi dell\'azienda', a ? `${a.ragione_sociale}\nP. IVA ${a.partita_iva}, ATECO ${a.ateco}.\nSede legale: ${a.sede_legale}.\nLavoratori: ${a.lavoratori_totali}.` : ''],
    ['B', 'Organigramma della sicurezza', b ? `Datore di lavoro: ${b.datore_lavoro}.\nRSPP: ${b.rspp}.` : ''],
    ['C', 'Descrizione dell\'attività', [c?.descrizione_attivita ?? '', list(c?.fasi_lavorative)].filter(Boolean).join('\n\n')],
    ['D', 'Pericoli identificati', list(pl.sezione_d?.pericoli_identificati)],
    ['E', 'Valutazione dei rischi', (pl.sezione_e?.matrice_rischi ?? []).map((r) => `${r.pericolo}: P ${r.probabilita}, G ${r.gravita}, R ${r.probabilita * r.gravita}.`).join('\n')],
    ['F', 'Misure di prevenzione e protezione', f ? [f.misure_tecniche, f.misure_organizzative, f.dpi_assegnati, f.formazione].filter(Boolean).join('\n\n') : ''],
    ['G', 'Programma di miglioramento', (pl.sezione_g?.interventi_pianificati ?? []).map((i) => `${i.intervento}, responsabile ${i.responsabile}, entro ${i.scadenza}.`).join('\n')],
  ];
  return rows.map(([key, title, body]) => ({
    key,
    title,
    body: body.trim() || 'Contenuto da completare.',
    origine: 'ai' as const,
  }));
}

function requireUser(): User {
  const u = adaptUser(getCurrentUser());
  if (!u) throw new Error('Utente non autenticato');
  return u;
}

function calcolaRischioMax(p: DvrPayload): RischioLivello {
  let max: RischioLivello = 'basso';
  const order: RischioLivello[] = ['basso', 'medio', 'alto', 'molto_alto'];
  for (const r of p.sezione_e?.matrice_rischi ?? []) {
    if (order.indexOf(r.livello) > order.indexOf(max)) max = r.livello;
  }
  return max;
}


// ----- Super Agente (demo) -----
// In demo non c'e' nessun modello: la risposta e' un avviso onesto. Le
// conversazioni restano nel browser per provare l'interfaccia.
const AGENTE_DEMO_PANNELLI =
  'Modalità dimostrativa: ti mostro sul tavolo come preparo questo lavoro, con dati di prova. Collega il backend per lavorare sui dati veri dello studio.';
const AGENTE_DEMO_RISPOSTA =
  "Modalità dimostrativa: in questa versione non sono collegato al motore AI, quindi non posso leggere l'archivio né consultare la normativa. Collega il backend per parlare con l'agente.";

const AGENTE_DEMO_STRUMENTI: AgenteStrumento[] = [
  { nome: 'aziende_elenco', titolo: 'Elenco aziende', scrive: false },
  { nome: 'azienda_scheda', titolo: 'Scheda azienda', scrive: false },
  { nome: 'archivio_elenco', titolo: 'Archivio di sopralluogo', scrive: false },
  { nome: 'archivio_aggiungi_nota', titolo: 'Aggiungi rilievo', scrive: true },
  { nome: 'normativa_cerca', titolo: 'Cerca nella normativa', scrive: false },
  { nome: 'dvr_elenco', titolo: 'Elenco DVR', scrive: false },
  { nome: 'dvr_genera', titolo: 'Genera DVR', scrive: true },
];

type AgenteConvDemo = AgenteConversazioneDettaglio;

/** Durata della risposta finta e avanzamento simulato (3 eventi) per la demo. */
const AGENTE_DEMO_MS = 2400;
const avvioDemo = new Map<string, number>();
const EVENTI_DEMO: Array<{ dopo: number; e: AgenteEvento }> = [
  { dopo: 200, e: { t: 'fase', testo: 'Leggo la richiesta' } },
  { dopo: 700, e: { t: 'passo', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', stato: 'in_corso' } },
  { dopo: 1500, e: { t: 'passo', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', stato: 'ok' } },
  { dopo: 1900, e: { t: 'fase', testo: 'Scrivo la risposta' } },
];

function agenteVista(c: AgenteConvDemo): AgenteConversazione {
  return { id: c.id, titolo: c.titolo, azienda: c.azienda, aggiornata: c.aggiornata };
}

export class LocalStorageDataSource implements DataSource {
  readonly mode = 'local' as const;

  // ----- Auth -----
  auth = {
    login: async (email: string, password: string): Promise<User> => {
      await new Promise((r) => setTimeout(r, 250));
      const u = loginCustom(email, password);
      if (!u) throw new Error('Credenziali non valide');
      return adaptUser(u)!;
    },
    loginAs: async (role: Role): Promise<User> => {
      const u = mockLoginAs(role);
      // Marker: ROLES referenced
      void ROLES;
      return adaptUser(u)!;
    },
    googleLogin: async (idToken: string): Promise<GoogleLoginResult> => {
      // In demo l'ID token non viene verificato lato server, ma lo DECODIFICHIAMO
      // lato client (solo per leggere nome/email/foto) cosi' l'utente vede la
      // propria identita' Google reale. La verifica vera avviene col backend live.
      await new Promise((r) => setTimeout(r, 200));
      const profile = decodeGoogleIdToken(idToken);
      const u = loginWithGoogleMock(profile);
      const user = adaptUser(u)!;
      return { user, needs_onboarding: user.needs_onboarding ?? true };
    },
    completeOnboarding: async (profile: OnboardingProfile): Promise<User> => {
      const tenantName =
        profile.studio_nome ||
        profile.azienda_ragione_sociale ||
        profile.studio_appartenenza ||
        undefined;
      const u = applyOnboardingMock({ role: profile.role, tenant_name: tenantName });
      return adaptUser(u)!;
    },
    me: async (): Promise<User | null> => adaptUser(getCurrentUser()),
    logout: async (): Promise<void> => {
      mockLogout();
    },
  };

  // ----- Companies -----
  companies = {
    list: async (): Promise<Company[]> => {
      const u = requireUser();
      return readArray<Company>(nsForUser(u.id, 'companies'));
    },
    get: async (id: number): Promise<Company | null> => {
      const u = requireUser();
      return readArray<Company>(nsForUser(u.id, 'companies')).find((c) => c.id === id) ?? null;
    },
    create: async (data: Omit<Company, 'id' | 'created_at' | 'created_by'>): Promise<Company> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'companies');
      const arr = readArray<Company>(key);
      // Dedup hard at data layer: P.IVA univoca (case-insensitive, no spaces)
      const newPiva = (data.partita_iva ?? '').replace(/\s/g, '').toUpperCase();
      if (newPiva) {
        const existing = arr.find((c) => (c.partita_iva ?? '').replace(/\s/g, '').toUpperCase() === newPiva);
        if (existing) {
          const err = new Error(`Azienda con P.IVA ${newPiva} già presente: "${existing.ragione_sociale}". Apri la scheda esistente o usa una P.IVA diversa.`) as Error & { code?: string; existingId?: number };
          err.code = 'DUPLICATE_PIVA';
          err.existingId = existing.id;
          throw err;
        }
      }
      const company: Company = {
        ...data,
        id: nextId(arr),
        created_by: u.id,
        created_at: nowIso(),
      };
      arr.push(company);
      writeArray(key, arr);
      return company;
    },
    update: async (id: number, patch: Partial<Company>): Promise<Company> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'companies');
      const arr = readArray<Company>(key);
      const idx = arr.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`Azienda ${id} non trovata`);
      // Difesa in profondita': se il patch tocca settings, fai il MERGE col settings
      // esistente (non sostituirlo) per non perdere organigramma/kb_notes/visura.
      const mergedSettings =
        patch.settings !== undefined
          ? { ...(arr[idx].settings ?? {}), ...patch.settings }
          : arr[idx].settings;
      // Stampa updated_at a ogni modifica: serve a rilevare i DVR da aggiornare.
      arr[idx] = { ...arr[idx], ...patch, settings: mergedSettings, id, updated_at: nowIso() };
      writeArray(key, arr);
      return arr[idx];
    },
    delete: async (id: number): Promise<void> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'companies');
      writeArray(key, readArray<Company>(key).filter((c) => c.id !== id));
      // Cascade: delete relativi DVR
      const dvrKey = nsForUser(u.id, 'dvrs');
      writeArray(dvrKey, readArray<Dvr>(dvrKey).filter((d) => d.company_id !== id));
    },
    extractFromDocument: async (
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<CompanyExtractionResult> => {
      // Demo senza backend: parser + euristiche client-side (regex italiani per
      // P.IVA, ATECO, ragione sociale, lavoratori). Degrada con grazia: se non
      // riconosce nulla ritorna { data: {}, disclaimer } SENZA mai lanciare.
      onProgress?.(10);
      try {
        // Import dinamico: tiene pdfjs/xlsx/mammoth fuori dal bundle iniziale.
        const { extractDvrFromFile } = await import('../import/dvr-extractor');
        onProgress?.(35);
        const ex = await extractDvrFromFile(file);
        onProgress?.(85);
        const a = ex.partial.sezione_a;
        const data: Partial<Company> = {};
        if (a?.ragione_sociale) data.ragione_sociale = a.ragione_sociale;
        if (a?.partita_iva) data.partita_iva = a.partita_iva.toUpperCase();
        if (a?.ateco) data.ateco = a.ateco;
        if (a?.lavoratori_totali && a.lavoratori_totali > 0) data.lavoratori = a.lavoratori_totali;
        if (a?.dimensione) data.dimensione = a.dimensione;
        onProgress?.(100);
        return { data, disclaimer: AI_EXTRACTION_DISCLAIMER };
      } catch {
        // Documento illeggibile / tipo non supportato: nessun crash, form a mano.
        onProgress?.(100);
        return { data: {}, disclaimer: AI_EXTRACTION_DISCLAIMER };
      }
    },
    datoreInvite: async (companyId: number): Promise<{ code: string; company_id: number }> => {
      // Demo: genera un codice finto leggibile (6 char alfanumerico uppercase + company).
      // In produzione (API reale) e' il backend a generare e persistere il codice monouso.
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I per chiarezza
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return { code: `DVR-${code}`, company_id: companyId };
    },
  };

  // ----- DVR -----
  dvr = {
    list: async (): Promise<Dvr[]> => {
      const u = requireUser();
      return readArray<Dvr>(nsForUser(u.id, 'dvrs'));
    },
    get: async (id: number): Promise<Dvr | null> => {
      const u = requireUser();
      return readArray<Dvr>(nsForUser(u.id, 'dvrs')).find((d) => d.id === id) ?? null;
    },
    create: async (data: Omit<Dvr, 'id' | 'versione' | 'data_creazione' | 'created_by' | 'ai_disclaimer_text'>): Promise<Dvr> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'dvrs');
      const arr = readArray<Dvr>(key);
      const versionePiuAlta = arr
        .filter((d) => d.company_id === data.company_id)
        .reduce((max, d) => (d.versione > max ? d.versione : max), 0);

      const rischio_max = calcolaRischioMax(data.payload);
      const contentHash = await sha256(JSON.stringify(data.payload));

      const dvr: Dvr = {
        ...data,
        id: nextId(arr),
        versione: versionePiuAlta + 1,
        data_creazione: nowIso(),
        created_by: u.id,
        ai_disclaimer_text: AI_DISCLAIMER,
        rischio_max,
        content_hash: contentHash,
      };
      arr.push(dvr);
      writeArray(key, arr);
      await this._addAudit(u.id, dvr.id, 'created', { versione: dvr.versione });
      return dvr;
    },
    update: async (id: number, patch: Partial<Dvr>): Promise<Dvr> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'dvrs');
      const arr = readArray<Dvr>(key);
      const idx = arr.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error(`DVR ${id} non trovato`);
      const updated: Dvr = { ...arr[idx], ...patch, id };
      if (patch.payload) {
        updated.rischio_max = calcolaRischioMax(updated.payload);
        updated.content_hash = await sha256(JSON.stringify(updated.payload));
      }
      arr[idx] = updated;
      writeArray(key, arr);
      await this._addAudit(u.id, id, 'updated', { changes: Object.keys(patch) });
      return updated;
    },
    approve: async (id: number): Promise<Dvr> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'dvrs');
      const arr = readArray<Dvr>(key);
      const idx = arr.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error(`DVR ${id} non trovato`);
      arr[idx] = {
        ...arr[idx],
        status: 'approved',
        data_approvazione: nowIso(),
        approved_by: u.id,
      };
      writeArray(key, arr);
      await this._addAudit(u.id, id, 'approved', { approver_id: u.id });
      return arr[idx];
    },
    delete: async (id: number): Promise<void> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'dvrs');
      writeArray(key, readArray<Dvr>(key).filter((d) => d.id !== id));
    },
    audit: async (dvrId: number): Promise<AuditLogEntry[]> => {
      const u = requireUser();
      return readArray<AuditLogEntry>(nsForUser(u.id, 'audit')).filter((a) => a.dvr_id === dvrId);
    },
    // Generazione DVR con AI (mock). In demo non c'e' il DVR Authoring Crew: il
    // documento viene prodotto client-side (dvr-generator) al download. Qui
    // simuliamo un esito sincrono "completato" + un breve ritardo, così la UI
    // mostra lo stesso flusso (avvio -> esito) del backend reale, senza crashare.
    generate: async (dvrId: number, opts?: DvrGenerateOptions): Promise<DvrGenerationResult> => {
      const u = requireUser();
      const found = readArray<Dvr>(nsForUser(u.id, 'dvrs')).find((d) => d.id === dvrId);
      if (!found) throw new Error(`DVR ${dvrId} non trovato`);
      await new Promise((r) => setTimeout(r, 400));
      // Nuova revisione AI dal payload. Come il backend, se non richiesto
      // diversamente conserva le sezioni corrette a mano nella revisione corrente.
      const revKey = nsForUser(u.id, `dvr_revisions_${dvrId}`);
      const revs = readArray<DvrRevisionDetail>(revKey);
      const prev = revs[revs.length - 1];
      const keep = opts?.riscriviModificheUmane !== true;
      const sezioni = mockSectionsFromPayload(found.payload).map((sec) => {
        const old = prev?.sezioni.find((x) => x.key === sec.key);
        return keep && old?.origine === 'umano' ? old : sec;
      });
      revs.push(buildMockRevision(revs, 'ai', null, null, sezioni, prev));
      writeArray(revKey, revs);
      await this._addAudit(u.id, dvrId, 'generated', { mode: 'demo' });
      return { mode: 'sync', status: 'completed' };
    },
    generationStatus: async (dvrId: number): Promise<DvrGenerationStatus> => {
      const u = requireUser();
      const found = readArray<Dvr>(nsForUser(u.id, 'dvrs')).find((d) => d.id === dvrId);
      return {
        dvr_id: dvrId,
        dvr_status: found?.status ?? 'draft',
        generation: { status: 'completed', demo: true },
      };
    },
    revisions: async (dvrId: number): Promise<DvrRevisionList> => {
      const revs = this._revisionsFor(dvrId);
      const data = revs.map(toRevisionSummary).reverse();
      return { dvr_id: dvrId, corrente: data[0]?.numero ?? null, data };
    },
    revision: async (dvrId: number, numero: number): Promise<DvrRevisionDetail> => {
      const rev = this._revisionsFor(dvrId).find((r) => r.numero === numero);
      if (!rev) throw new Error('Risorsa non trovata.');
      return rev;
    },
    createRevision: async (dvrId: number, input: DvrRevisionCreateInput): Promise<DvrRevisionDetail> => {
      const u = requireUser();
      const revs = this._revisionsFor(dvrId);
      const prev = revs[revs.length - 1];
      if (!prev) throw new Error('Il DVR non ha ancora un testo generato da rivedere.');
      const at = nowIso();
      let changed = false;
      const sezioni = prev.sezioni.map((sec) => {
        const m = input.modifiche.find((x) => x.key === sec.key);
        if (!m) return sec;
        const title = m.title ?? sec.title;
        const body = m.body ?? sec.body;
        if (title === sec.title && body === sec.body) return sec;
        changed = true;
        return { ...sec, title, body, origine: 'umano' as const, modificata_da: u.name, modificata_at: at };
      });
      if (!changed) throw new Error('Nessuna modifica rispetto alla revisione corrente.');
      const rev = buildMockRevision(revs, 'umano', u.name, input.motivo?.trim() || null, sezioni, prev);
      revs.push(rev);
      writeArray(nsForUser(u.id, `dvr_revisions_${dvrId}`), revs);
      await this._reopenIfApproved(u.id, dvrId);
      await this._addAudit(u.id, dvrId, 'updated', { revisione: rev.numero });
      return rev;
    },
    restoreRevision: async (dvrId: number, numero: number): Promise<DvrRevisionSummary> => {
      const u = requireUser();
      const revs = this._revisionsFor(dvrId);
      const src = revs.find((r) => r.numero === numero);
      if (!src) throw new Error('Risorsa non trovata.');
      const rev = buildMockRevision(
        revs, 'umano', u.name, `Ripristino della revisione ${numero}`,
        src.sezioni.map((x) => ({ ...x })), revs[revs.length - 1],
      );
      revs.push(rev);
      writeArray(nsForUser(u.id, `dvr_revisions_${dvrId}`), revs);
      await this._reopenIfApproved(u.id, dvrId);
      await this._addAudit(u.id, dvrId, 'updated', { ripristino: numero });
      return toRevisionSummary(rev);
    },
  };

  /** Revisioni demo di un DVR; se manca ancora la prima, la ricava dal payload. */
  private _revisionsFor(dvrId: number): DvrRevisionDetail[] {
    const u = requireUser();
    const key = nsForUser(u.id, `dvr_revisions_${dvrId}`);
    const revs = readArray<DvrRevisionDetail>(key);
    if (revs.length > 0) return revs;
    const found = readArray<Dvr>(nsForUser(u.id, 'dvrs')).find((d) => d.id === dvrId);
    if (!found) throw new Error('Risorsa non trovata.');
    const first = buildMockRevision([], 'ai', null, null, mockSectionsFromPayload(found.payload), undefined);
    writeArray(key, [first]);
    return [first];
  }

  /** Come il backend: un DVR approvato modificato torna in revisione. */
  private async _reopenIfApproved(userId: number, dvrId: number): Promise<void> {
    const key = nsForUser(userId, 'dvrs');
    const arr = readArray<Dvr>(key);
    const idx = arr.findIndex((d) => d.id === dvrId);
    if (idx >= 0 && arr[idx].status === 'approved') {
      arr[idx] = { ...arr[idx], status: 'review', data_approvazione: null };
      writeArray(key, arr);
    }
  }

  // ----- Generic resource builder -----
  private _resource<T extends { id: number; company_id?: number; azienda?: string; created_by: number; created_at: string }>(
    suffix: string,
    enrich?: (item: T) => T,
    dedup?: { keyOf: (item: Partial<T>) => string | null; label: string }
  ) {
    const list = async (params?: { companyId?: number }): Promise<T[]> => {
      const u = requireUser();
      let arr = readArray<T>(nsForUser(u.id, suffix));
      if (params?.companyId != null) {
        arr = arr.filter((x) => x.company_id == null || x.company_id === params.companyId);
      }
      return enrich ? arr.map(enrich) : arr;
    };
    return {
      list,
      get: async (id: number): Promise<T | null> => {
        const u = requireUser();
        const found = readArray<T>(nsForUser(u.id, suffix)).find((x) => x.id === id) ?? null;
        return found && enrich ? enrich(found) : found;
      },
      create: async (data: Omit<T, 'id' | 'created_at' | 'created_by'>): Promise<T> => {
        const u = requireUser();
        const key = nsForUser(u.id, suffix);
        const arr = readArray<T>(key);
        // Dedup hard a livello dati (chiave normalizzata definita dal resource)
        if (dedup) {
          const newKey = dedup.keyOf(data as Partial<T>);
          if (newKey) {
            const existing = arr.find((x) => {
              const k = dedup.keyOf(x as Partial<T>);
              return k !== null && k.toLowerCase() === newKey.toLowerCase();
            });
            if (existing) {
              const err = new Error(`${suffix} già presente con ${dedup.label} "${newKey}". Aggiorna l'esistente (id ${existing.id}) o cambia chiave.`) as Error & { code?: string; existingId?: number };
              err.code = 'DUPLICATE_KEY';
              err.existingId = existing.id;
              throw err;
            }
          }
        }
        const item = { ...(data as object), id: nextId(arr), created_by: u.id, created_at: nowIso() } as T;
        arr.push(item);
        writeArray(key, arr);
        return enrich ? enrich(item) : item;
      },
      update: async (id: number, patch: Partial<T>): Promise<T> => {
        const u = requireUser();
        const key = nsForUser(u.id, suffix);
        const arr = readArray<T>(key);
        const idx = arr.findIndex((x) => x.id === id);
        if (idx < 0) throw new Error(`${suffix} ${id} non trovato`);
        arr[idx] = { ...arr[idx], ...patch, id } as T;
        writeArray(key, arr);
        return enrich ? enrich(arr[idx]) : arr[idx];
      },
      delete: async (id: number): Promise<void> => {
        const u = requireUser();
        const key = nsForUser(u.id, suffix);
        writeArray(
          key,
          readArray<T>(key).filter((x) => x.id !== id)
        );
      },
    };
  }

  private _enrichWithAzienda<T extends { company_id?: number; azienda?: string }>(item: T): T {
    if (typeof window === 'undefined' || !item.company_id) return item;
    try {
      const u = adaptUser(getCurrentUser());
      if (!u) return item;
      const companies = readArray<Company>(nsForUser(u.id, 'companies'));
      const c = companies.find((x) => x.id === item.company_id);
      if (c) return { ...item, azienda: c.ragione_sociale };
    } catch {
      /* noop */
    }
    return item;
  }

  // ----- Lavoratori -----
  lavoratori = this._resource<Lavoratore>(
    'lavoratori',
    (i) => this._enrichWithAzienda(i),
    {
      keyOf: (d) => {
        if (d.codice_fiscale) return `cf:${d.codice_fiscale.toUpperCase().trim()}`;
        if (d.nome && d.cognome && d.company_id) {
          return `nm:${d.nome.toLowerCase().trim()}_${d.cognome.toLowerCase().trim()}_${d.company_id}`;
        }
        return null;
      },
      label: 'codice fiscale (o nome+cognome+azienda)',
    }
  );

  // ----- DPI -----
  dpi = this._resource<Dpi>('dpi', undefined, {
    keyOf: (d) => {
      if (!d.tipo) return null;
      return `${d.tipo.toLowerCase().trim()}|${(d.norma_en ?? '').toLowerCase().trim()}|${(d.marca ?? '').toLowerCase().trim()}|${(d.modello ?? '').toLowerCase().trim()}`;
    },
    label: 'tipo+norma EN+marca+modello',
  });

  // ----- Attrezzature -----
  attrezzature = this._resource<Attrezzatura>(
    'attrezzature',
    (i) => this._enrichWithAzienda(i),
    {
      keyOf: (d) => (d.codice_interno && d.company_id ? `${d.codice_interno.toLowerCase().trim()}|${d.company_id}` : null),
      label: 'codice interno+azienda',
    }
  );

  // ----- Corsi formazione -----
  corsi = this._resource<Corso>('corsi', undefined, {
    keyOf: (d) => (d.titolo ? `${d.titolo.toLowerCase().trim()}|${d.data_svolgimento ?? ''}` : null),
    label: 'titolo+data svolgimento',
  });

  // ----- Scadenze -----
  scadenze = this._resource<Scadenza>(
    'scadenze',
    (i) => this._enrichWithAzienda(i),
    {
      keyOf: (d) => (d.tipo && d.data_prevista ? `${d.tipo}|${d.data_prevista}|${d.company_id ?? ''}` : null),
      label: 'tipo+data+azienda',
    }
  );

  // ----- Studi consulenza -----
  studi = this._resource<Studio>('studi', undefined, {
    keyOf: (d) => (d.partita_iva ? `piva:${d.partita_iva.replace(/\s/g, '').toUpperCase()}` : null),
    label: 'P.IVA',
  });

  // ----- Utenti studio (consulenti / titolari) -----
  utenti = this._resource<UtenteStudio>(
    'utenti',
    (i) => {
      if (typeof window === 'undefined' || !i.studio_id) return i;
      try {
        const u = adaptUser(getCurrentUser());
        if (!u) return i;
        const studi = readArray<Studio>(nsForUser(u.id, 'studi'));
        const s = studi.find((x) => x.id === i.studio_id);
        if (s) return { ...i, studio_nome: s.ragione_sociale };
      } catch { /* noop */ }
      return i;
    },
    {
      keyOf: (d) => (d.email ? `email:${d.email.toLowerCase().trim()}` : null),
      label: 'email',
    }
  );

  // ----- Media / documenti DVR (mock) -----
  // In demo non c'e' uno storage reale: salviamo i METADATI in localStorage e
  // simuliamo l'avanzamento upload. L'elaborazione AI (classificazione/OCR/
  // vision/estrazione) resta a carico del backend; qui marchiamo 'caricato'.
  media = {
    uploadDocument: async (dvrId: number, file: File, onProgress?: UploadProgress): Promise<DvrUpload> =>
      this._mockUpload(dvrId, file, 'document', onProgress),
    uploadMedia: async (dvrId: number, file: File, onProgress?: UploadProgress): Promise<DvrUpload> =>
      this._mockUpload(dvrId, file, 'media', onProgress),
    listUploads: async (dvrId: number): Promise<DvrUpload[]> => {
      const u = requireUser();
      return readArray<DvrUpload>(nsForUser(u.id, 'uploads')).filter((x) => x.dvr_id === dvrId);
    },
    deleteUpload: async (dvrId: number, kind: UploadKind, uploadId: number): Promise<void> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'uploads');
      writeArray(
        key,
        readArray<DvrUpload>(key).filter(
          (x) => !(x.dvr_id === dvrId && x.kind === kind && x.id === uploadId)
        )
      );
    },
  };

  private async _mockUpload(
    dvrId: number,
    file: File,
    kind: UploadKind,
    onProgress?: UploadProgress
  ): Promise<DvrUpload> {
    const u = requireUser();
    // Avanzamento simulato per dare feedback reale in demo.
    if (onProgress) {
      for (const p of [15, 45, 75, 100]) {
        await new Promise((r) => setTimeout(r, 120));
        onProgress(p);
      }
    }
    const key = nsForUser(u.id, 'uploads');
    const arr = readArray<DvrUpload>(key);
    const upload: DvrUpload = {
      id: nextId(arr),
      dvr_id: dvrId,
      kind,
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size_bytes: file.size,
      status: 'caricato',
      note:
        kind === 'media'
          ? 'Demo: in produzione la foto viene pseudonimizzata (face-blur + EXIF strip) e analizzata via Vision.'
          : 'Demo: in produzione il documento viene classificato e i dati estratti dal backend.',
      created_by: u.id,
      created_at: nowIso(),
    };
    arr.push(upload);
    writeArray(key, arr);
    return upload;
  }

  // ----- AI assist (demo) -----
  // Senza backend: assist ritorna un placeholder coerente per non rompere la demo,
  // transcribe ritorna stringa vuota (nessun motore di trascrizione lato browser).
  ai = {
    assist: async (_input: AiAssistInput): Promise<AiAssistResult> => {
      // Piccola latenza simulata per dare feedback "in elaborazione" realistico.
      await new Promise((r) => setTimeout(r, 400));
      // Demo: nessun motore AI. NON iniettiamo prosa fittizia nel campo (degraderebbe
      // i dati salvati): ritorniamo testo vuoto -> la UI mostra un avviso non distruttivo
      // e il testo dell'utente resta intatto. Con il backend attivo qui arriva prosa vera.
      return { testo: '', disclaimer: AI_ASSIST_DISCLAIMER };
    },
    transcribe: async (_file: File, _options?: AiTranscribeOptions): Promise<AiTranscribeResult> => {
      await new Promise((r) => setTimeout(r, 300));
      // Demo: nessuna trascrizione reale. La UI mostra un avviso e non appende nulla.
      return { testo: '' };
    },
    describeImage: async (_file: File, _options?: AiTranscribeOptions): Promise<AiTranscribeResult> => {
      await new Promise((r) => setTimeout(r, 300));
      // Demo: nessuna descrizione reale (serve backend vision).
      return { testo: '' };
    },
    risks: async (_input: AiRisksInput): Promise<AiRisksResult> => {
      await new Promise((r) => setTimeout(r, 400));
      // Demo: nessun motore AI. La UI mostra un avviso e mantiene la compilazione manuale.
      return {
        rischi: [],
        disclaimer: AI_ASSIST_DISCLAIMER,
        errore: 'Generazione rischi AI disponibile solo con backend attivo (demo).',
      };
    },
    describeVideo: async (_input: AiVideoInput): Promise<AiVideoResult> => {
      await new Promise((r) => setTimeout(r, 500));
      // Demo: analisi video disponibile solo col backend attivo. La UI lo comunica all'utente.
      return {
        testo: '',
        disclaimer: AI_ASSIST_DISCLAIMER,
        errore: 'Analisi video disponibile col backend attivo (demo).',
      };
    },
  };

  // ----- Archivio documentale per-azienda (demo) -----
  // ----- Cantieri e POS (demo: dati nel browser, niente emissione) -----
  cantieri = {
    list: async (params?: { companyId?: number }): Promise<Cantiere[]> => {
      const u = requireUser();
      return readArray<unknown>(nsForUser(u.id, 'cantieri'))
        .map(mapCantiere)
        .filter((c): c is Cantiere => c !== null && (params?.companyId == null || c.company_id === params.companyId));
    },
    create: async (data: CantiereNuovo): Promise<Cantiere> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'cantieri');
      const arr = readArray<{ id: number }>(key);
      const c = mapCantiere({ ...data, id: nextId(arr) })!;
      writeArray(key, [...arr, c]);
      return c;
    },
  };

  pos = {
    list: async (params?: { cantiereId?: number; companyId?: number }): Promise<PosDocumento[]> => {
      const u = requireUser();
      return readArray<unknown>(nsForUser(u.id, 'pos'))
        .map(mapPos)
        .filter(
          (p): p is PosDocumento =>
            p !== null && (params?.cantiereId == null || p.cantiere_id === params.cantiereId) && (params?.companyId == null || p.company_id === params.companyId)
        );
    },
    download: async (_id: number, _formato: 'pdf' | 'docx'): Promise<void> => {
      void _id;
      void _formato;
      throw new Error('In modalità dimostrativa i POS non si scaricano: servono il backend e una revisione emessa.');
    },
  };

  // ----- Safety Control Room (demo: calcolata dai dati del browser) -----
  controlRoom = creaControlRoomLocale({
    ds: () => this,
    utente: requireUser,
    leggi: <T,>(k: string) => readArray<T>(nsForUser(requireUser().id, k)),
    scrivi: <T,>(k: string, v: T[]) => writeArray(nsForUser(requireUser().id, k), v),
    tuttiIPassaporti: passaportiDelBrowser,
  });

  // ----- Loghi nei documenti (demo: data URL nel browser) -----
  loghi = creaLoghiLocale(() => nsForUser(requireUser().id, 'loghi'));

  // ----- Documenti dell'azienda e coda di lavoro (demo) -----
  documentiHse = creaDocumentiHseDemo(async (companyId) =>
    (await this.dvr.list())
      .filter((d) => d.company_id === companyId)
      .map((d) => ({
        chiave: `dvr:${d.id}`,
        origine: 'dvr' as const,
        id: d.id,
        tipo: 'dvr',
        titolo: `DVR versione ${d.versione}`,
        stato: d.status,
        revisione: null,
        aggiornato: d.data_creazione,
        puo_emettere: null,
        conteggi: null,
        esito: null,
      }))
  );
  coda = creaCodaDemo();

  // ----- Super Agente HSE (demo) -----
  agente = {
    invia: async (input: AgenteInvioInput): Promise<AgenteInvioRisultato> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'agente_conversazioni');
      const arr = readArray<AgenteConvDemo>(key);
      if (input.richiestaId) avvioDemo.set(input.richiestaId, Date.now());
      await new Promise((r) => setTimeout(r, AGENTE_DEMO_MS));
      if (input.richiestaId) avvioDemo.delete(input.richiestaId);
      let conv = input.conversazioneId != null ? arr.find((c) => c.id === input.conversazioneId) : undefined;
      if (!conv) {
        let azienda: AgenteConversazione['azienda'] = null;
        if (input.aziendaId != null) {
          const c = await this.companies.get(input.aziendaId).catch(() => null);
          azienda = { id: input.aziendaId, ragione_sociale: c?.ragione_sociale ?? `Azienda ${input.aziendaId}` };
        }
        conv = {
          id: nextId(arr),
          titolo: input.testo.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Nuova conversazione',
          azienda,
          aggiornata: nowIso(),
          messaggi: [],
        };
        arr.push(conv);
      }
      const baseId = conv.messaggi.reduce((m, x) => Math.max(m, x.id), 0);
      const mUtente: AgenteMessaggio = {
        id: baseId + 1, ruolo: 'utente', testo: input.testo, passi: [], azioni: [], pannelli: [], creato: nowIso(),
      };
      // Pannelli di esempio dei moduli (valutazioni, documenti, portale) passati dal mapper vero.
      const pannelli = pannelliDemo(input.testo, conv.azienda?.id ?? null)
        .map(mapPannello)
        .filter((p): p is NonNullable<typeof p> => p !== null);
      const risposta: AgenteMessaggio = {
        id: baseId + 2,
        ruolo: 'agente',
        testo: pannelli.length ? AGENTE_DEMO_PANNELLI : AGENTE_DEMO_RISPOSTA,
        passi: [],
        azioni: [],
        pannelli,
        creato: nowIso(),
      };
      conv.messaggi.push(mUtente, risposta);
      conv.aggiornata = nowIso();
      writeArray(key, arr);
      return { conversazione: agenteVista(conv), messaggio_utente: mUtente, risposta };
    },
    conversazioni: async (): Promise<AgenteConversazione[]> => {
      const u = requireUser();
      return readArray<AgenteConvDemo>(nsForUser(u.id, 'agente_conversazioni'))
        .map(agenteVista)
        .sort((a, b) => String(b.aggiornata).localeCompare(String(a.aggiornata)));
    },
    conversazione: async (id: number): Promise<AgenteConversazioneDettaglio> => {
      const u = requireUser();
      const c = readArray<AgenteConvDemo>(nsForUser(u.id, 'agente_conversazioni')).find((x) => x.id === id);
      if (!c) {
        const err = new Error('Risorsa non trovata.') as Error & { code?: string };
        err.code = 'NOT_FOUND';
        throw err;
      }
      // Stesso mapping difensivo dell'API: i dati salvati nel browser possono essere vecchi o parziali.
      return mapAgenteDettaglio(c);
    },
    eliminaConversazione: async (id: number): Promise<void> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'agente_conversazioni');
      writeArray(key, readArray<AgenteConvDemo>(key).filter((c) => c.id !== id));
    },
    profilo: async (): Promise<AgenteProfilo> => {
      const u = requireUser();
      const saved = readArray<AgenteProfiloUpdate>(nsForUser(u.id, 'agente_profilo'))[0] ?? {};
      return {
        nome: saved.nome?.trim() || 'Falco',
        tono: saved.tono === 'semplice' ? 'semplice' : 'autorevole',
        istruzioni_studio: saved.istruzioni_studio ?? '',
        strumenti_disattivati: saved.strumenti_disattivati ?? [],
        strumenti: AGENTE_DEMO_STRUMENTI,
        modificabile: u.role === 'titolare_studio' || u.role === 'admin_conflavoro',
        voce: false,
      };
    },
    aggiornaProfilo: async (input: AgenteProfiloUpdate): Promise<AgenteProfilo> => {
      const u = requireUser();
      if (u.role !== 'titolare_studio' && u.role !== 'admin_conflavoro') {
        const err = new Error('Operazione non consentita per il tuo ruolo.') as Error & { code?: string };
        err.code = 'FORBIDDEN';
        throw err;
      }
      const key = nsForUser(u.id, 'agente_profilo');
      const prev = readArray<AgenteProfiloUpdate>(key)[0] ?? {};
      writeArray(key, [{ ...prev, ...input }]);
      return this.agente.profilo();
    },
    voce: async (_testo: string): Promise<Blob> => {
      void _testo;
      throw new Error('In modalità dimostrativa la voce dell’agente non è disponibile.');
    },
    progresso: async (richiestaId: string): Promise<AgenteProgresso> => {
      const t0 = avvioDemo.get(richiestaId);
      if (t0 == null) return { eventi: [], piano: null, fine: true };
      const trascorso = Date.now() - t0;
      return { eventi: EVENTI_DEMO.filter((x) => x.dopo <= trascorso).map((x) => x.e), piano: null, fine: false };
    },
  };

  companyDocuments = {
    list: async (companyId: number): Promise<CompanyDocument[]> => {
      const u = requireUser();
      return readArray<CompanyDocument>(nsForUser(u.id, 'company_documents')).filter((d) => d.company_id === companyId);
    },
    addNote: async (companyId: number, testo: string, titolo?: string, origine?: string, tipo?: CompanyDocumentTipo): Promise<CompanyDocument> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'company_documents');
      const arr = readArray<CompanyDocument>(key);
      const doc: CompanyDocument = {
        id: nextId(arr), company_id: companyId, tipo: tipo ?? 'nota', titolo: titolo ?? null,
        testo_analisi: testo, origine: origine ?? 'manuale', created_at: nowIso(),
      };
      arr.push(doc); writeArray(key, arr);
      return doc;
    },
    addFile: async (
      companyId: number,
      tipo: CompanyDocumentTipo,
      file: File,
      options?: { titolo?: string; origine?: string }
    ): Promise<CompanyDocument> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'company_documents');
      const arr = readArray<CompanyDocument>(key);
      // Demo: conserva i metadati; l'analisi reale (vision/trascrizione/estrazione)
      // avviene solo col backend attivo.
      const doc: CompanyDocument = {
        id: nextId(arr), company_id: companyId, tipo, titolo: options?.titolo ?? null,
        filename: file.name, mime: file.type || null, size_bytes: file.size,
        testo_analisi: null, origine: options?.origine ?? 'upload', created_at: nowIso(),
      };
      arr.push(doc); writeArray(key, arr);
      return doc;
    },
    update: async (id: number, fields: { titolo?: string | null; testo_analisi?: string | null }): Promise<CompanyDocument> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'company_documents');
      const arr = readArray<CompanyDocument>(key);
      const i = arr.findIndex((d) => d.id === id);
      if (i < 0) throw new Error('Documento non trovato.');
      if (Object.prototype.hasOwnProperty.call(fields, 'titolo')) arr[i].titolo = fields.titolo ?? null;
      if (Object.prototype.hasOwnProperty.call(fields, 'testo_analisi')) arr[i].testo_analisi = fields.testo_analisi ?? null;
      writeArray(key, arr);
      return arr[i];
    },
    reanalyze: async (_id: number): Promise<CompanyDocument> => {
      // Demo: la ri-analisi AI richiede il backend attivo.
      throw new Error('Ri-analisi disponibile col backend attivo (demo).');
    },
    download: async (_id: number, _filename?: string): Promise<void> => {
      // Demo: il file originale e' conservato solo col backend attivo.
      throw new Error('Download disponibile col backend attivo (demo).');
    },
    previewUrl: async (_id: number): Promise<string> => {
      throw new Error('Anteprima disponibile col backend attivo (demo).');
    },
    delete: async (id: number): Promise<void> => {
      const u = requireUser();
      const key = nsForUser(u.id, 'company_documents');
      writeArray(key, readArray<CompanyDocument>(key).filter((d) => d.id !== id));
    },
  };

  // ----- Health -----
  async health(): Promise<HealthStatus> {
    return {
      mode: 'local',
      ok: typeof window !== 'undefined' && typeof localStorage !== 'undefined',
      latency_ms: 0,
      version: 'localStorage',
    };
  }

  // ----- Internals -----
  private async _addAudit(
    userId: number,
    dvrId: number,
    action: AuditLogEntry['action'],
    payload?: Record<string, unknown>
  ): Promise<void> {
    const key = nsForUser(userId, 'audit');
    const arr = readArray<AuditLogEntry>(key);
    const prev = arr
      .filter((a) => a.dvr_id === dvrId)
      .sort((a, b) => b.id - a.id)[0];
    const entry: AuditLogEntry = {
      id: nextId(arr),
      dvr_id: dvrId,
      action,
      actor_id: userId,
      payload,
      prev_hash: prev?.current_hash,
      current_hash: await sha256(JSON.stringify({ prev: prev?.current_hash, action, payload })),
      created_at: nowIso(),
    };
    arr.push(entry);
    writeArray(key, arr);
  }
}
