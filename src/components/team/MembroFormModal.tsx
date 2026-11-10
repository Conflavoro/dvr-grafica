'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { UtenteStudio } from '@/lib/data-source';

export type MembroFormResult =
  | {
      mode: 'create';
      nome: string;
      cognome: string;
      email: string;
      ruolo: UtenteStudio['ruolo'];
      /** Vuota = il backend genera una password temporanea. */
      password?: string;
    }
  | {
      mode: 'edit';
      id: number;
      nome: string;
      cognome: string;
      ruolo: UtenteStudio['ruolo'];
      attivo: boolean;
    };

export interface MembroFormModalProps {
  open: boolean;
  /** Record in modifica; assente = creazione. */
  record?: UtenteStudio | null;
  onClose: () => void;
  /** Persistenza: deve rilanciare l'eventuale errore (mostrato nel footer). */
  onSubmit: (result: MembroFormResult) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Modale per creare/modificare un membro del team (consulente o titolare).
 * Coerente con EntityFormModal (stesso linguaggio navy/luxury + accessibilità),
 * ma dedicata: in creazione chiede nome/email/ruolo + password opzionale; in
 * modifica blocca l'email (identità) e aggiunge il toggle attivo/sospeso.
 */
export function MembroFormModal({ open, record, onClose, onSubmit }: MembroFormModalProps) {
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const isEdit = !!record;

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [ruolo, setRuolo] = useState<UtenteStudio['ruolo']>('consulente');
  const [password, setPassword] = useState('');
  const [attivo, setAttivo] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(record?.nome ?? '');
    setCognome(record?.cognome && record.cognome !== 'n.d.' ? record.cognome : '');
    setEmail(record?.email ?? '');
    setRuolo(record?.ruolo ?? 'consulente');
    setAttivo(record?.attivo ?? true);
    setPassword('');
    setErrors({});
    setSubmitError(null);
    setSaving(false);
  }, [open, record]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = 'Il nome è obbligatorio.';
    if (!isEdit) {
      if (!email.trim()) e.email = 'L’email è obbligatoria.';
      else if (!EMAIL_RE.test(email.trim())) e.email = 'Email non valida.';
      if (password && password.length < 8) e.password = 'Minimo 8 caratteri (oppure lascia vuoto).';
    }
    return e;
  }, [nome, email, password, isEdit]);

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (saving) return;
      setSubmitError(null);
      const v = validate();
      if (Object.keys(v).length > 0) {
        setErrors(v);
        return;
      }
      setSaving(true);
      try {
        if (isEdit && record) {
          await onSubmit({
            mode: 'edit',
            id: record.id,
            nome: nome.trim(),
            cognome: cognome.trim(),
            ruolo,
            attivo,
          });
        } else {
          await onSubmit({
            mode: 'create',
            nome: nome.trim(),
            cognome: cognome.trim(),
            email: email.trim().toLowerCase(),
            ruolo,
            password: password.trim() || undefined,
          });
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
        setSaving(false);
      }
    },
    [saving, validate, isEdit, record, nome, cognome, email, ruolo, attivo, password, onSubmit]
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
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-brand-200 animate-fade-up sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <h2 id={titleId} className="section-title text-[16px] text-brand-800">
            {isEdit ? 'Modifica membro' : 'Aggiungi consulente'}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} className="btn-icon" aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <Field label="Nome" required error={errors.nome}>
              <input
                ref={firstRef}
                className="input-field"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-invalid={errors.nome ? true : undefined}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Cognome">
              <input
                className="input-field"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                autoComplete="family-name"
              />
            </Field>

            <Field
              label="Email"
              required={!isEdit}
              error={errors.email}
              hint={isEdit ? 'L’email identifica l’utente e non è modificabile.' : undefined}
              className="sm:col-span-2"
            >
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEdit}
                aria-invalid={errors.email ? true : undefined}
                autoComplete="email"
              />
            </Field>

            <Field label="Ruolo" required>
              <select className="input-field" value={ruolo} onChange={(e) => setRuolo(e.target.value as UtenteStudio['ruolo'])}>
                <option value="consulente">Consulente (RSPP operativo)</option>
                <option value="titolare_studio">Titolare studio</option>
              </select>
            </Field>

            {isEdit ? (
              <Field label="Stato">
                <label className="inline-flex h-[44px] cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={attivo}
                    onChange={(e) => setAttivo(e.target.checked)}
                    className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-400"
                  />
                  <span>{attivo ? 'Attivo' : 'Sospeso'}</span>
                </label>
              </Field>
            ) : (
              <Field
                label="Password"
                error={errors.password}
                hint="Lascia vuoto per generare una password temporanea da comunicare al consulente."
              >
                <input
                  type="text"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Opzionale"
                  aria-invalid={errors.password ? true : undefined}
                  autoComplete="new-password"
                />
              </Field>
            )}
          </div>

          <div className="border-t border-brand-100 bg-brand-50/30 px-6 py-4">
            {submitError && (
              <p role="alert" className="mb-3 rounded-xl border border-danger bg-danger px-4 py-2.5 text-[13px] text-danger-ink">
                {submitError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} disabled={saving} className="btn-ghost">
                Annulla
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea consulente'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider2 text-ink-muted">
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
