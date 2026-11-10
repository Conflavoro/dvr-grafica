// Field mapper: dato una lista di headers (di Excel/CSV), suggerisce il
// mapping verso i field del Company / DvrPayload usando alias normalizzati
// (case-insensitive, accent-insensitive, fuzzy match Levenshtein).

import type {
  Attrezzatura,
  Company,
  CompanyDimensione,
  CompanySede,
  Corso,
  Dpi,
  DpiCategoria,
  Lavoratore,
  Scadenza,
  ScadenzaPriorita,
  ScadenzaStato,
  ScadenzaTipo,
  Studio,
  UtenteStudio,
} from '../data-source';

// ============================================================
// SCHEMI MAPPING
// ============================================================

export interface FieldDef<T> {
  /** Nome del field in destinazione (es. 'ragione_sociale'). */
  key: keyof T | string;
  /** Etichetta umana per l'UI. */
  label: string;
  /** Lista di alias (case/accent-insensitive) per auto-mapping. */
  aliases: string[];
  /** Required per validazione. */
  required?: boolean;
  /** Tipo dato per parsing: stringa di default. */
  type?: 'string' | 'number' | 'enum' | 'date';
  /** Per enum: valori ammessi. */
  enumValues?: string[];
  /** Validator regex (per stringhe). */
  pattern?: RegExp;
  /** Coercion da stringa a valore tipizzato. */
  coerce?: (raw: string) => unknown;
}

export const COMPANY_FIELDS: FieldDef<Company>[] = [
  {
    key: 'ragione_sociale',
    label: 'Ragione sociale',
    aliases: ['ragione sociale', 'denominazione', 'nome azienda', 'company name', 'nome', 'cliente'],
    required: true,
  },
  {
    key: 'partita_iva',
    label: 'P. IVA',
    aliases: ['partita iva', 'p iva', 'piva', 'p.iva', 'vat', 'vat number', 'tax id'],
    required: true,
    pattern: /^[A-Z]{0,2}\d{11}$/,
    coerce: (raw) => raw.replace(/\s/g, '').toUpperCase(),
  },
  {
    key: 'codice_fiscale',
    label: 'Codice Fiscale',
    aliases: ['codice fiscale', 'cf', 'c.f.', 'fiscal code'],
    coerce: (raw) => raw.replace(/\s/g, '').toUpperCase(),
  },
  {
    key: 'ateco',
    label: 'ATECO',
    aliases: ['ateco', 'codice ateco', 'classificazione', 'naics', 'cod. ateco'],
    required: true,
    pattern: /^\d{2}(\.\d{1,2})?$/,
  },
  {
    key: 'ateco_label',
    label: 'Descrizione ATECO',
    aliases: ['descrizione ateco', 'descrizione attivita', 'attivita', 'settore', 'descrizione'],
  },
  {
    key: 'dimensione',
    label: 'Dimensione',
    aliases: ['dimensione', 'classe', 'fascia dimensionale', 'dimensione azienda', 'size'],
    type: 'enum',
    enumValues: ['micro', 'piccola', 'media', 'grande'],
    coerce: (raw) => normalizeDimensione(raw),
  },
  {
    key: 'lavoratori',
    label: 'N° lavoratori',
    aliases: ['lavoratori', 'numero lavoratori', 'dipendenti', 'n. lavoratori', 'employees', 'addetti'],
    required: true,
    type: 'number',
    coerce: (raw) => Number(raw.replace(/\D/g, '')) || 0,
  },
  // Sede legale (path complesso → primo elemento dell'array sedi)
  {
    key: 'sede_indirizzo',
    label: 'Indirizzo sede',
    aliases: ['indirizzo', 'via', 'sede legale', 'address', 'sede'],
    required: true,
  },
  { key: 'sede_comune', label: 'Comune', aliases: ['comune', 'citta', 'city', 'localita'], required: true },
  { key: 'sede_provincia', label: 'Provincia', aliases: ['provincia', 'prov', 'pr', 'province'], required: true },
  { key: 'sede_cap', label: 'CAP', aliases: ['cap', 'codice postale', 'postal code', 'zip'], required: true, pattern: /^\d{5}$/ },
];

function normalizeDimensione(raw: string): CompanyDimensione {
  const v = raw.toLowerCase().trim();
  if (v.includes('micro') || v === 'xs') return 'micro';
  if (v.includes('picc') || v === 'sm' || v === 's') return 'piccola';
  if (v.includes('media') || v === 'md' || v === 'm') return 'media';
  if (v.includes('grand') || v === 'lg' || v === 'l' || v === 'xl') return 'grande';
  // numeric → derive
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    if (n < 10) return 'micro';
    if (n < 50) return 'piccola';
    if (n < 250) return 'media';
    return 'grande';
  }
  return 'piccola';
}

// ============================================================
// FUZZY MATCH UTILITIES
// ============================================================

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritici
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const aN = normalize(a);
  const bN = normalize(b);
  if (aN === bN) return 1;
  if (aN.includes(bN) || bN.includes(aN)) return 0.85;
  const dist = levenshtein(aN, bN);
  const maxLen = Math.max(aN.length, bN.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

// ============================================================
// AUTO-MAPPING
// ============================================================

export interface MappingResult {
  /** Header del file → field key del target. */
  mappings: Record<string, string | null>;
  /** Confidence per ogni mapping (0..1). */
  confidence: Record<string, number>;
  /** Headers che non hanno match accettabile. */
  unmapped: string[];
  /** Field richiesti che NON hanno trovato un header. */
  missingRequired: string[];
}

export function autoMapHeaders<T>(headers: string[], fields: FieldDef<T>[]): MappingResult {
  const mappings: Record<string, string | null> = {};
  const confidence: Record<string, number> = {};
  const usedFields = new Set<string>();
  const unmapped: string[] = [];

  for (const header of headers) {
    let bestField: string | null = null;
    let bestSim = 0;
    for (const field of fields) {
      if (usedFields.has(String(field.key))) continue;
      // Test contro key + label + aliases
      const candidates = [String(field.key), field.label, ...field.aliases];
      const sim = Math.max(...candidates.map((c) => similarity(header, c)));
      if (sim > bestSim) {
        bestSim = sim;
        bestField = String(field.key);
      }
    }
    if (bestField && bestSim >= 0.7) {
      mappings[header] = bestField;
      confidence[header] = bestSim;
      usedFields.add(bestField);
    } else {
      mappings[header] = null;
      confidence[header] = bestSim;
      unmapped.push(header);
    }
  }

  const missingRequired: string[] = [];
  for (const field of fields) {
    if (field.required && !usedFields.has(String(field.key))) {
      missingRequired.push(field.label);
    }
  }

  return { mappings, confidence, unmapped, missingRequired };
}

// ============================================================
// COMPANY ROW BUILDER
// ============================================================

export interface CompanyImportResult {
  ok: boolean;
  row: number;
  data?: Omit<Company, 'id' | 'created_at' | 'created_by'>;
  errors?: string[];
}

export function buildCompanyFromRow(
  row: Record<string, string>,
  mappings: Record<string, string | null>,
  rowNumber: number
): CompanyImportResult {
  const errors: string[] = [];
  const sede: Partial<CompanySede> = { tipo: 'legale' };
  const out: Partial<Omit<Company, 'id' | 'created_at' | 'created_by'>> = {};

  for (const [header, value] of Object.entries(row)) {
    const target = mappings[header];
    if (!target) continue;
    const field = COMPANY_FIELDS.find((f) => String(f.key) === target);
    if (!field) continue;
    const trimmed = value.trim();
    if (!trimmed && field.required) {
      errors.push(`${field.label}: vuoto`);
      continue;
    }
    if (!trimmed) continue;
    const coerced = field.coerce ? field.coerce(trimmed) : trimmed;
    if (field.pattern && typeof coerced === 'string' && !field.pattern.test(coerced)) {
      errors.push(`${field.label}: formato non valido (${trimmed})`);
    }
    // Map a Company o sede
    switch (target) {
      case 'sede_indirizzo': sede.indirizzo = String(coerced); break;
      case 'sede_comune': sede.comune = String(coerced); break;
      case 'sede_provincia': sede.provincia = String(coerced).toUpperCase().slice(0, 2); break;
      case 'sede_cap': sede.cap = String(coerced); break;
      case 'lavoratori': out.lavoratori = Number(coerced); break;
      case 'dimensione': out.dimensione = coerced as CompanyDimensione; break;
      case 'partita_iva': out.partita_iva = String(coerced); break;
      case 'codice_fiscale': out.codice_fiscale = String(coerced); break;
      case 'ragione_sociale': out.ragione_sociale = String(coerced); break;
      case 'ateco': out.ateco = String(coerced); break;
      case 'ateco_label': out.ateco_label = String(coerced); break;
    }
  }

  // Default dimensione
  if (!out.dimensione && out.lavoratori !== undefined) {
    out.dimensione = out.lavoratori < 10 ? 'micro' : out.lavoratori < 50 ? 'piccola' : out.lavoratori < 250 ? 'media' : 'grande';
  }
  if (!out.dimensione) out.dimensione = 'piccola';

  // Required check
  if (!out.ragione_sociale) errors.push('Ragione sociale: mancante');
  if (!out.partita_iva) errors.push('P. IVA: mancante');
  if (!out.ateco) errors.push('ATECO: mancante');
  if (!out.lavoratori && out.lavoratori !== 0) errors.push('N° lavoratori: mancante');
  if (!sede.indirizzo) errors.push('Indirizzo sede: mancante');
  if (!sede.comune) errors.push('Comune: mancante');
  if (!sede.provincia) errors.push('Provincia: mancante');
  if (!sede.cap) errors.push('CAP: mancante');

  if (errors.length > 0) return { ok: false, row: rowNumber, errors };

  return {
    ok: true,
    row: rowNumber,
    data: {
      ragione_sociale: out.ragione_sociale!,
      partita_iva: out.partita_iva!,
      codice_fiscale: out.codice_fiscale,
      ateco: out.ateco!,
      ateco_label: out.ateco_label ?? '',
      dimensione: out.dimensione!,
      lavoratori: out.lavoratori!,
      sedi: [sede as CompanySede],
    },
  };
}

// ============================================================
// SCHEMI ENTITÀ ESTESE
// ============================================================

const RX_CF = /^[A-Z0-9]{16}$/;
const RX_DATE = /^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;

function toIsoDate(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return t;
}

function splitCsv(raw: string): string[] {
  return raw.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
}

export const LAVORATORE_FIELDS: FieldDef<Lavoratore>[] = [
  { key: 'nome', label: 'Nome', aliases: ['nome', 'name', 'first name'], required: true },
  { key: 'cognome', label: 'Cognome', aliases: ['cognome', 'last name', 'surname'], required: true },
  { key: 'codice_fiscale', label: 'Codice Fiscale', aliases: ['codice fiscale', 'cf', 'c.f.'], pattern: RX_CF, coerce: (r) => r.replace(/\s/g, '').toUpperCase() },
  { key: 'mansione', label: 'Mansione', aliases: ['mansione', 'ruolo', 'job', 'qualifica', 'posizione'], required: true },
  { key: 'data_assunzione', label: 'Data assunzione', aliases: ['data assunzione', 'assunzione', 'hire date', 'inizio rapporto'], pattern: RX_DATE, coerce: toIsoDate },
  { key: 'idoneita_sanitaria_data', label: 'Idoneità sanitaria', aliases: ['idoneita sanitaria', 'visita medica', 'data visita', 'idoneita', 'sorveglianza sanitaria'], pattern: RX_DATE, coerce: toIsoDate },
  { key: 'formazione_svolta', label: 'Formazione svolta', aliases: ['formazione', 'corsi', 'corsi svolti', 'training'], coerce: splitCsv },
  { key: 'dpi_assegnati', label: 'DPI assegnati', aliases: ['dpi', 'dpi assegnati', 'protezione individuale'], coerce: splitCsv },
];

export const DPI_FIELDS: FieldDef<Dpi>[] = [
  { key: 'tipo', label: 'Tipo DPI', aliases: ['tipo', 'tipo dpi', 'dispositivo', 'descrizione'], required: true },
  { key: 'norma_en', label: 'Norma EN', aliases: ['norma', 'norma en', 'standard', 'en'], coerce: (r) => r.toUpperCase() },
  { key: 'categoria', label: 'Categoria', aliases: ['categoria', 'cat', 'class', 'classe'], type: 'enum', enumValues: ['I', 'II', 'III'], coerce: (r) => normalizeDpiCategoria(r) },
  { key: 'marca', label: 'Marca', aliases: ['marca', 'brand', 'produttore'] },
  { key: 'modello', label: 'Modello', aliases: ['modello', 'model'] },
  { key: 'fornitore', label: 'Fornitore', aliases: ['fornitore', 'supplier', 'rivenditore'] },
  { key: 'data_consegna', label: 'Data consegna', aliases: ['data consegna', 'consegna', 'data assegnazione'], pattern: RX_DATE, coerce: toIsoDate },
  { key: 'scadenza', label: 'Scadenza', aliases: ['scadenza', 'expiry', 'data scadenza'], pattern: RX_DATE, coerce: toIsoDate },
];

function normalizeDpiCategoria(raw: string): DpiCategoria {
  const v = raw.trim().toUpperCase();
  if (v === 'I' || v === '1' || v.includes('PRIMA')) return 'I';
  if (v === 'II' || v === '2' || v.includes('SECON')) return 'II';
  if (v === 'III' || v === '3' || v.includes('TERZA')) return 'III';
  return 'II';
}

export const ATTREZZATURA_FIELDS: FieldDef<Attrezzatura>[] = [
  { key: 'codice_interno', label: 'Codice interno', aliases: ['codice', 'codice interno', 'cod', 'matricola', 'asset id', 'id interno'], required: true },
  { key: 'marca', label: 'Marca', aliases: ['marca', 'brand', 'produttore'] },
  { key: 'modello', label: 'Modello', aliases: ['modello', 'model'] },
  { key: 'marcatura_ce', label: 'Marcatura CE', aliases: ['marcatura ce', 'ce', 'marcatura', 'ce marking'], coerce: (r) => /si|sì|yes|true|1|x/i.test(r.trim()) },
  { key: 'anno_installazione', label: 'Anno installazione', aliases: ['anno', 'anno installazione', 'year', 'anno acquisto'], type: 'number', coerce: (r) => Number(r.replace(/\D/g, '')) || 0 },
  { key: 'prossima_manutenzione', label: 'Prossima manutenzione', aliases: ['manutenzione', 'prossima manutenzione', 'next maintenance', 'verifica'], pattern: RX_DATE, coerce: toIsoDate },
];

export const CORSO_FIELDS: FieldDef<Corso>[] = [
  { key: 'titolo', label: 'Titolo corso', aliases: ['corso', 'titolo', 'titolo corso', 'nome corso', 'training'], required: true },
  { key: 'durata_ore', label: 'Durata (ore)', aliases: ['durata', 'durata ore', 'ore', 'hours'], required: true, type: 'number', coerce: (r) => Number(r.replace(/\D/g, '')) || 0 },
  { key: 'data_svolgimento', label: 'Data svolgimento', aliases: ['data', 'data svolgimento', 'svolgimento', 'date'], pattern: RX_DATE, coerce: toIsoDate },
  { key: 'ente_erogatore', label: 'Ente / docente', aliases: ['ente', 'ente erogatore', 'docente', 'erogatore', 'provider'] },
  { key: 'partecipanti', label: 'Partecipanti', aliases: ['partecipanti', 'lavoratori', 'attendees', 'persone'], coerce: splitCsv },
  { key: 'data_scadenza', label: 'Data scadenza', aliases: ['scadenza', 'data scadenza', 'expiry', 'aggiornamento'], pattern: RX_DATE, coerce: toIsoDate },
];

export const SCADENZA_FIELDS: FieldDef<Scadenza>[] = [
  { key: 'tipo', label: 'Tipo', aliases: ['tipo', 'tipologia', 'category'], required: true, coerce: (r) => normalizeScadenzaTipo(r) },
  { key: 'descrizione', label: 'Descrizione', aliases: ['descrizione', 'descrizione attivita', 'note', 'titolo'], required: true },
  { key: 'data_prevista', label: 'Data prevista', aliases: ['data', 'data prevista', 'scadenza', 'due date', 'deadline'], required: true, pattern: RX_DATE, coerce: toIsoDate },
  { key: 'priorita', label: 'Priorità', aliases: ['priorita', 'priority', 'importanza'], coerce: (r) => normalizeScadenzaPriorita(r) },
  { key: 'stato', label: 'Stato', aliases: ['stato', 'status', 'condizione'], coerce: (r) => normalizeScadenzaStato(r) },
  { key: 'responsabile', label: 'Responsabile', aliases: ['responsabile', 'owner', 'incaricato', 'assegnato'] },
];

function normalizeScadenzaTipo(raw: string): ScadenzaTipo {
  const v = raw.toLowerCase().trim();
  if (v.includes('dvr') || v.includes('aggiorn')) return 'aggiornamento_dvr';
  if (v.includes('sopral')) return 'sopralluogo';
  if (v.includes('formaz') || v.includes('cors')) return 'formazione';
  if (v.includes('medic') || v.includes('visita')) return 'visita_medica';
  if (v.includes('impianti') || v.includes('elettr')) return 'verifica_impianti';
  if (v.includes('manuten') || v.includes('attrezz')) return 'manutenzione_attrezzature';
  return 'altro';
}
function normalizeScadenzaPriorita(raw: string): ScadenzaPriorita {
  const v = raw.toLowerCase().trim();
  if (v.includes('crit') || v === '4') return 'critica';
  if (v.includes('alt') || v === '3' || v === 'high') return 'alta';
  if (v.includes('medi') || v === '2' || v === 'med') return 'media';
  return 'bassa';
}
function normalizeScadenzaStato(raw: string): ScadenzaStato {
  const v = raw.toLowerCase().trim();
  if (v.includes('compl') || v.includes('done')) return 'completata';
  if (v.includes('corso') || v.includes('progress')) return 'in_corso';
  if (v.includes('scad') || v.includes('overdue')) return 'scaduta';
  return 'aperta';
}

export const STUDIO_FIELDS: FieldDef<Studio>[] = [
  { key: 'ragione_sociale', label: 'Ragione sociale studio', aliases: ['ragione sociale', 'denominazione', 'nome studio', 'studio'], required: true },
  { key: 'partita_iva', label: 'P. IVA', aliases: ['partita iva', 'p iva', 'piva', 'p.iva', 'vat'], required: true, pattern: /^[A-Z]{0,2}\d{11}$/, coerce: (r) => r.replace(/\s/g, '').toUpperCase() },
  { key: 'codice_studio', label: 'Codice studio', aliases: ['codice studio', 'codice', 'cod studio', 'matricola'] },
  { key: 'email_referente', label: 'Email referente', aliases: ['email', 'email referente', 'mail', 'email titolare'], required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, coerce: (r) => r.trim().toLowerCase() },
  { key: 'telefono', label: 'Telefono', aliases: ['telefono', 'tel', 'phone'] },
  { key: 'indirizzo', label: 'Indirizzo', aliases: ['indirizzo', 'via', 'sede'] },
  { key: 'comune', label: 'Comune', aliases: ['comune', 'citta', 'city'] },
  { key: 'provincia', label: 'Provincia', aliases: ['provincia', 'prov', 'pr'] },
  { key: 'cap', label: 'CAP', aliases: ['cap', 'codice postale', 'zip'], pattern: /^\d{5}$/ },
  { key: 'numero_consulenti', label: 'N° consulenti', aliases: ['numero consulenti', 'consulenti', 'rspp count'], type: 'number', coerce: (r) => Number(r.replace(/\D/g, '')) || 0 },
  { key: 'numero_aziende_clienti', label: 'N° aziende clienti', aliases: ['aziende', 'numero aziende', 'clienti', 'aziende clienti'], type: 'number', coerce: (r) => Number(r.replace(/\D/g, '')) || 0 },
  { key: 'attivo', label: 'Attivo', aliases: ['attivo', 'active', 'stato', 'enabled'], coerce: (r) => /si|sì|yes|true|1|attivo/i.test(r.trim()) },
];

export const UTENTE_FIELDS: FieldDef<UtenteStudio>[] = [
  { key: 'nome', label: 'Nome', aliases: ['nome', 'first name'], required: true },
  { key: 'cognome', label: 'Cognome', aliases: ['cognome', 'last name', 'surname'], required: true },
  { key: 'email', label: 'Email', aliases: ['email', 'mail', 'email aziendale'], required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, coerce: (r) => r.trim().toLowerCase() },
  { key: 'ruolo', label: 'Ruolo', aliases: ['ruolo', 'role', 'qualifica utente'], required: true, type: 'enum', enumValues: ['titolare_studio', 'consulente'], coerce: (r) => normalizeUtenteRuolo(r) },
  { key: 'qualifica', label: 'Qualifica professionale', aliases: ['qualifica', 'titolo', 'professione', 'mansione'] },
  { key: 'iscrizione_albo', label: 'Iscrizione albo', aliases: ['iscrizione albo', 'albo', 'numero albo', 'matricola albo'] },
  { key: 'telefono', label: 'Telefono', aliases: ['telefono', 'tel', 'phone'] },
  { key: 'attivo', label: 'Attivo', aliases: ['attivo', 'active', 'stato'], coerce: (r) => /si|sì|yes|true|1|attivo/i.test(r.trim()) },
];

function normalizeUtenteRuolo(raw: string): UtenteStudio['ruolo'] {
  const v = raw.toLowerCase().trim();
  if (v.includes('titolar') || v.includes('owner') || v.includes('director')) return 'titolare_studio';
  return 'consulente';
}

// ============================================================
// GENERIC ROW BUILDER (per Lavoratore/Dpi/Attrezzatura/Corso/Scadenza)
// ============================================================

export interface GenericImportResult<T> {
  ok: boolean;
  row: number;
  data?: Omit<T, 'id' | 'created_at' | 'created_by'>;
  errors?: string[];
}

export function buildEntityFromRow<T>(
  row: Record<string, string>,
  mappings: Record<string, string | null>,
  fields: FieldDef<T>[],
  rowNumber: number
): GenericImportResult<T> {
  const errors: string[] = [];
  const out: Record<string, unknown> = {};

  for (const [header, value] of Object.entries(row)) {
    const target = mappings[header];
    if (!target) continue;
    const field = fields.find((f) => String(f.key) === target);
    if (!field) continue;
    const trimmed = value.trim();
    if (!trimmed && field.required) {
      errors.push(`${field.label}: vuoto`);
      continue;
    }
    if (!trimmed) continue;
    const coerced = field.coerce ? field.coerce(trimmed) : trimmed;
    if (field.pattern && typeof coerced === 'string' && !field.pattern.test(coerced)) {
      errors.push(`${field.label}: formato non valido (${trimmed})`);
    }
    out[String(field.key)] = coerced;
  }

  for (const f of fields) {
    if (f.required && (out[String(f.key)] === undefined || out[String(f.key)] === '' || out[String(f.key)] === null)) {
      errors.push(`${f.label}: mancante`);
    }
  }

  if (errors.length > 0) return { ok: false, row: rowNumber, errors };
  return { ok: true, row: rowNumber, data: out as Omit<T, 'id' | 'created_at' | 'created_by'> };
}
