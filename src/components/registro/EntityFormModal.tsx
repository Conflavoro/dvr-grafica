'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Company } from '@/lib/data-source';
import {
  buildPayload,
  initialValues,
  validateValues,
  type EntityFormField,
  type RawFormValues,
} from './entity-form';

export interface EntityFormModalProps<T> {
  open: boolean;
  /** Titolo della modale (es. "Nuovo lavoratore"). */
  title: string;
  fields: EntityFormField<T>[];
  /** Record da modificare; assente = creazione. */
  record?: Partial<T> | null;
  /** L'entita richiede l'azienda (select company). */
  needsCompany: boolean;
  /** company_id e' obbligatorio (lavoratori/attrezzature) o opzionale. */
  companyRequired: boolean;
  /** Elenco aziende per il select (best-effort, puo' essere vuoto). */
  companies: Company[];
  onClose: () => void;
  /** Persistenza: deve rilanciare l'eventuale errore di rete. */
  onSubmit: (payload: Partial<T>) => Promise<void>;
}

export function EntityFormModal<T>({
  open,
  title,
  fields,
  record,
  needsCompany,
  companyRequired,
  companies,
  onClose,
  onSubmit,
}: EntityFormModalProps<T>) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);

  const [values, setValues] = useState<RawFormValues>(() =>
    initialValues(fields, record)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinizializza i valori ogni volta che si (ri)apre o cambia il record.
  useEffect(() => {
    if (open) {
      setValues(initialValues(fields, record));
      setErrors({});
      setSubmitError(null);
      setSaving(false);
    }
  }, [open, record, fields]);

  // Focus iniziale + chiusura con ESC.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  const noCompanies = needsCompany && companies.length === 0;

  const setField = useCallback((key: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSubmitError(null);

      const validation = validateValues(fields, values, {
        needsCompany,
        companyRequired,
      });
      if (Object.keys(validation).length > 0) {
        setErrors(validation);
        return;
      }

      const payload = buildPayload(fields, values, { needsCompany });
      setSaving(true);
      try {
        await onSubmit(payload);
        // La chiusura/refresh e' responsabilita del chiamante (onSubmit risolve).
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : 'Salvataggio non riuscito. Riprova.'
        );
        setSaving(false);
      }
    },
    [saving, fields, values, needsCompany, companyRequired, onSubmit]
  );

  const companyOptions = useMemo(
    () =>
      [...companies]
        .sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale))
        .map((c) => ({ value: String(c.id), label: c.ragione_sociale })),
    [companies]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-brand-200 animate-fade-up sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <h2
            id={titleId}
            className="section-title text-[16px] text-brand-800"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-icon"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {noCompanies ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-ink">
              Crea prima un’azienda
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">
              Questa anagrafica deve essere collegata a un’azienda. Aggiungi
              almeno un’azienda per procedere.
            </p>
            <button type="button" onClick={onClose} className="btn-ghost mt-6">
              Ho capito
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              {needsCompany && (
                <Field
                  label="Azienda"
                  required={companyRequired}
                  error={errors['company_id']}
                  className="sm:col-span-2"
                >
                  <select
                    ref={(el) => {
                      firstFieldRef.current = el;
                    }}
                    className="input-field"
                    value={String(values['company_id'] ?? '')}
                    onChange={(e) => setField('company_id', e.target.value)}
                    aria-invalid={errors['company_id'] ? true : undefined}
                  >
                    <option value="">Seleziona azienda</option>
                    {companyOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {fields.map((f, idx) => {
                const wide =
                  f.type === 'textarea' || f.type === 'csv' ? 'sm:col-span-2' : '';
                const isFirst = !needsCompany && idx === 0;
                const fieldId = `ef-${String(f.key)}`;
                const raw = values[f.key];
                const strVal = typeof raw === 'string' ? raw : '';

                return (
                  <Field
                    key={String(f.key)}
                    label={f.label}
                    required={f.required}
                    error={errors[f.key]}
                    hint={f.hint}
                    htmlFor={f.type === 'boolean' ? undefined : fieldId}
                    className={wide}
                  >
                    {f.type === 'boolean' ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                        <input
                          ref={
                            isFirst
                              ? (el) => {
                                  firstFieldRef.current = el;
                                }
                              : undefined
                          }
                          type="checkbox"
                          checked={raw === true}
                          onChange={(e) => setField(f.key, e.target.checked)}
                          className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-400"
                        />
                        <span>{f.placeholder ?? 'Sì'}</span>
                      </label>
                    ) : f.type === 'select' ? (
                      <select
                        id={fieldId}
                        ref={
                          isFirst
                            ? (el) => {
                                firstFieldRef.current = el;
                              }
                            : undefined
                        }
                        className="input-field"
                        value={strVal}
                        onChange={(e) => setField(f.key, e.target.value)}
                        aria-invalid={errors[f.key] ? true : undefined}
                      >
                        <option value="">
                          {f.placeholder ?? 'Seleziona'}
                        </option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        id={fieldId}
                        ref={
                          isFirst
                            ? (el) => {
                                firstFieldRef.current = el;
                              }
                            : undefined
                        }
                        className="input-field h-auto min-h-[80px] resize-y py-2.5"
                        placeholder={f.placeholder ?? ''}
                        value={strVal}
                        onChange={(e) => setField(f.key, e.target.value)}
                        aria-invalid={errors[f.key] ? true : undefined}
                      />
                    ) : (
                      <input
                        id={fieldId}
                        ref={
                          isFirst
                            ? (el) => {
                                firstFieldRef.current = el;
                              }
                            : undefined
                        }
                        type={
                          f.type === 'date'
                            ? 'date'
                            : f.type === 'number'
                              ? 'number'
                              : 'text'
                        }
                        inputMode={f.type === 'number' ? 'numeric' : undefined}
                        min={f.type === 'number' ? f.min : undefined}
                        max={f.type === 'number' ? f.max : undefined}
                        className="input-field"
                        placeholder={f.placeholder ?? ''}
                        value={strVal}
                        onChange={(e) => setField(f.key, e.target.value)}
                        aria-invalid={errors[f.key] ? true : undefined}
                      />
                    )}
                  </Field>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-brand-100 bg-brand-50/30 px-6 py-4">
              {submitError && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl border border-danger bg-danger px-4 py-2.5 text-[13px] text-danger-ink"
                >
                  {submitError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="btn-ghost"
                >
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Salvataggio…' : 'Salva'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider2 text-ink-muted"
      >
        {label}
        {required && <span className="ml-1 text-danger-mark">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[12px] text-danger-mark">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
