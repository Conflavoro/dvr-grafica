// Mapping bidirezionale fra le risposte degli API Resource del backend Laravel
// e i tipi del DataSource frontend (types.ts).
//
// Differenze principali backend -> frontend gestite qui:
//   Company:  vat -> partita_iva, lavoratori_totali -> lavoratori,
//             ateco_label/created_by NON esistono backend (derivati/sintetizzati).
//   Dvr:      version -> versione, generated/approved_at ISO -> data_*,
//             azienda denormalizzato dalla relazione company, rischio_max calcolato
//             da payload.sezione_e (stessa logica della LocalStorageDataSource).
//
// NOTA: l'interfaccia DataSource e la LocalStorageDataSource NON cambiano. Questi
// adattatori isolano ogni divergenza di naming/forma in un unico punto.

import {
  AI_DISCLAIMER,
  type Company,
  type CompanyDimensione,
  type CompanySede,
  type Dvr,
  type DvrPayload,
  type DvrStatus,
  type RischioLivello,
} from './types';

// ============================================================
// Envelope Laravel: { data: ... } su risorsa singola,
// { data: [...], meta, links } su collection paginata.
// ============================================================

/** Estrae il payload da una risposta JsonResource singola (`{ data: ... }`). */
export function unwrap<T>(res: unknown): T {
  if (res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)) {
    return (res as { data: T }).data;
  }
  return res as T;
}

/** Estrae l'array da una risposta collection paginata (`{ data: [...] }`). */
export function unwrapList<T>(res: unknown): T[] {
  if (res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)) {
    const data = (res as { data: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return Array.isArray(res) ? (res as T[]) : [];
}

// ============================================================
// COMPANY
// ============================================================

/** Forma grezza ritornata da CompanyResource. */
export interface ApiCompany {
  id: number;
  tenant_id: number | null;
  ragione_sociale: string;
  vat: string;
  codice_fiscale?: string | null;
  ateco: string;
  dimensione: CompanyDimensione;
  lavoratori_totali: number;
  sedi?: CompanySede[] | null;
  settings?: Record<string, unknown> | null;
  assigned_user_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function mapCompanyFromApi(raw: ApiCompany): Company {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return {
    id: raw.id,
    ragione_sociale: raw.ragione_sociale,
    partita_iva: raw.vat,
    codice_fiscale: raw.codice_fiscale ?? undefined,
    ateco: raw.ateco,
    // ateco_label non esiste come colonna: lo persistiamo in settings per round-trip.
    ateco_label: typeof settings.ateco_label === 'string' ? settings.ateco_label : '',
    dimensione: raw.dimensione,
    lavoratori: raw.lavoratori_totali,
    sedi: raw.sedi ?? [],
    note: typeof settings.note === 'string' ? settings.note : undefined,
    // Tutti i campi visura extra viaggiano in settings (forma giuridica, REA, PEC,
    // amministratori, sede legale, ecc.): li esponiamo per la scheda anagrafica.
    settings,
    // created_by non e' tracciato backend (le company appartengono al tenant).
    created_by: typeof settings.created_by === 'number' ? settings.created_by : 0,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? undefined,
    assigned_user_id: raw.assigned_user_id ?? null,
  };
}

/**
 * Costruisce il body per POST/PATCH /companies dai dati frontend.
 * `ateco_label`/`created_by` (non colonne) viaggiano dentro `settings` per
 * sopravvivere al round-trip.
 */
export function mapCompanyToApi(
  data: Partial<Company> & { created_by?: number }
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.ragione_sociale !== undefined) body.ragione_sociale = data.ragione_sociale;
  if (data.partita_iva !== undefined) {
    body.vat = data.partita_iva.replace(/\s/g, '').toUpperCase();
  }
  if (data.codice_fiscale !== undefined) body.codice_fiscale = data.codice_fiscale;
  if (data.ateco !== undefined) body.ateco = data.ateco;
  if (data.dimensione !== undefined) body.dimensione = data.dimensione;
  if (data.lavoratori !== undefined) body.lavoratori_totali = data.lavoratori;
  if (data.sedi !== undefined) body.sedi = data.sedi;
  // assigned_user_id: passato direttamente, backend filtra su ruolo (consulente -> 403).
  if (data.assigned_user_id !== undefined) body.assigned_user_id = data.assigned_user_id;

  const settings: Record<string, unknown> = {
    // Campi visura extra (forma giuridica, REA, PEC, amministratori, ecc.) passati
    // dal chiamante: vanno preservati nel round-trip.
    ...(data.settings ?? {}),
  };
  if (data.ateco_label !== undefined) settings.ateco_label = data.ateco_label;
  if (data.created_by !== undefined) settings.created_by = data.created_by;
  if (data.note !== undefined) settings.note = data.note;
  if (Object.keys(settings).length > 0) body.settings = settings;

  return body;
}

// ============================================================
// DVR
// ============================================================

/** Forma grezza ritornata da DvrResource. */
export interface ApiDvr {
  id: number;
  tenant_id: number | null;
  company_id: number;
  company?: ApiCompany | null;
  version: number;
  status: DvrStatus;
  payload: DvrPayload;
  docx_url?: string | null;
  pdf_url?: string | null;
  content_hash?: string | null;
  generated_at?: string | null;
  approved_at?: string | null;
  approved_by?: number | null;
  ai_disclaimer_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const RISK_ORDER: RischioLivello[] = ['basso', 'medio', 'alto', 'molto_alto'];

/** Rischio massimo dal payload sezione E (stessa logica della LocalStorage). */
export function rischioMaxFromPayload(payload?: DvrPayload): RischioLivello {
  let max: RischioLivello = 'basso';
  for (const r of payload?.sezione_e?.matrice_rischi ?? []) {
    if (RISK_ORDER.indexOf(r.livello) > RISK_ORDER.indexOf(max)) max = r.livello;
  }
  return max;
}

export function mapDvrFromApi(raw: ApiDvr): Dvr {
  const azienda = raw.company?.ragione_sociale
    ?? raw.payload?.sezione_a?.ragione_sociale
    ?? 'n.d.';
  return {
    id: raw.id,
    company_id: raw.company_id,
    azienda,
    versione: raw.version,
    status: raw.status,
    payload: raw.payload,
    rischio_max: rischioMaxFromPayload(raw.payload),
    data_creazione: raw.created_at ?? raw.generated_at ?? new Date().toISOString(),
    data_approvazione: raw.approved_at ?? null,
    approved_by: raw.approved_by ?? undefined,
    content_hash: raw.content_hash ?? undefined,
    // created_by non e' nel resource DVR: il backend lo deriva dall'attore.
    created_by: 0,
    ai_disclaimer_text: raw.ai_disclaimer_text ?? AI_DISCLAIMER,
    generated_at: raw.generated_at ?? undefined,
    // URL del documento REALE prodotto dal backend AI (quando disponibili).
    docx_url: raw.docx_url ?? undefined,
    pdf_url: raw.pdf_url ?? undefined,
  };
}

/** Body per POST /dvr: il backend gestisce versione/disclaimer/status. */
export function mapDvrCreateToApi(
  data: Pick<Dvr, 'company_id' | 'payload'>
): Record<string, unknown> {
  return {
    company_id: data.company_id,
    payload: data.payload,
  };
}

/** Body per PATCH /dvr/{id}: solo payload e/o status (gli altri sono derivati). */
export function mapDvrUpdateToApi(patch: Partial<Dvr>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.payload !== undefined) body.payload = patch.payload;
  if (patch.status !== undefined) body.status = patch.status;
  return body;
}
