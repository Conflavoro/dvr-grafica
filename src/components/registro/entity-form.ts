// Modello dei campi del form CRUD per le entita del registro + logica pura
// (coercion + validazione) separata dalla UI cosi' e' testabile sotto jest
// (ambiente node, senza DOM).

export type EntityFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'
  | 'csv'
  | 'textarea';

export interface EntitySelectOption {
  value: string;
  label: string;
}

export interface EntityFormField<T> {
  /** Chiave del campo sul tipo T (deve combaciare col contratto backend). */
  key: keyof T & string;
  label: string;
  type: EntityFieldType;
  required?: boolean;
  /** Solo per type 'select'. */
  options?: EntitySelectOption[];
  placeholder?: string;
  /** Hint sotto al campo (es. formato atteso). */
  hint?: string;
  /** Per number: limiti opzionali (validazione client-side). */
  min?: number;
  max?: number;
}

/** Valore grezzo del form: tutto stringa o boolean (input HTML). */
export type RawFormValues = Record<string, string | boolean>;

/**
 * Costruisce il valore iniziale del form a partire da un record esistente
 * (edit) o vuoto (create). Date/numeri/array -> stringa per gli input HTML.
 */
export function initialValues<T>(
  fields: EntityFormField<T>[],
  record?: Partial<T> | null
): RawFormValues {
  const out: RawFormValues = {};
  for (const f of fields) {
    const v = record ? (record as Record<string, unknown>)[f.key] : undefined;
    if (f.type === 'boolean') {
      out[f.key] = v === true;
    } else if (f.type === 'csv') {
      out[f.key] = Array.isArray(v) ? (v as unknown[]).join(', ') : '';
    } else if (v === undefined || v === null) {
      out[f.key] = '';
    } else {
      out[f.key] = String(v);
    }
  }
  return out;
}

function splitCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Valida i campi obbligatori e i vincoli numerici client-side.
 * Restituisce una mappa key -> messaggio di errore (vuota se tutto ok).
 */
export function validateValues<T>(
  fields: EntityFormField<T>[],
  values: RawFormValues,
  opts: { needsCompany: boolean; companyRequired: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (opts.needsCompany && opts.companyRequired) {
    const cid = values['company_id'];
    if (!cid || String(cid).trim() === '') {
      errors['company_id'] = 'Seleziona un’azienda.';
    }
  }

  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === 'boolean') continue;
    const str = typeof raw === 'string' ? raw.trim() : '';

    if (f.required && str === '') {
      errors[f.key] = 'Campo obbligatorio.';
      continue;
    }
    if (str !== '' && f.type === 'number') {
      const n = Number(str);
      if (!Number.isFinite(n)) {
        errors[f.key] = 'Inserisci un numero valido.';
      } else if (f.min !== undefined && n < f.min) {
        errors[f.key] = `Valore minimo ${f.min}.`;
      } else if (f.max !== undefined && n > f.max) {
        errors[f.key] = `Valore massimo ${f.max}.`;
      }
    }
  }

  return errors;
}

/**
 * Converte i valori grezzi del form nel payload tipizzato per il data source,
 * rispettando i contratti backend: number per company_id/ore/anno, boolean per
 * marcatura_ce, string[] per i campi csv, date ISO (gia' YYYY-MM-DD dagli input).
 * I campi vuoti opzionali sono omessi (no stringhe vuote -> niente 422).
 */
export function buildPayload<T>(
  fields: EntityFormField<T>[],
  values: RawFormValues,
  opts: { needsCompany: boolean }
): Partial<T> {
  const out: Record<string, unknown> = {};

  if (opts.needsCompany) {
    const cid = values['company_id'];
    if (cid && String(cid).trim() !== '') {
      out['company_id'] = Number(cid);
    }
  }

  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === 'boolean') {
      out[f.key] = raw === true;
      continue;
    }
    const str = typeof raw === 'string' ? raw.trim() : '';
    if (str === '') continue; // ometti opzionali vuoti

    if (f.type === 'number') {
      const n = Number(str);
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (f.type === 'csv') {
      const arr = splitCsv(str);
      if (arr.length > 0) out[f.key] = arr;
    } else {
      out[f.key] = str;
    }
  }

  return out as Partial<T>;
}
