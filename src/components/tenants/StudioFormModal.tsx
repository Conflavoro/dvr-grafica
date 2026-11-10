'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Studio } from '@/lib/data-source';

export interface StudioFormResult {
  ragione_sociale: string;
  plan?: string;
}

export interface StudioFormModalProps {
  open: boolean;
  /** Record in modifica; assente = creazione. */
  record?: Studio | null;
  onClose: () => void;
  /** Persistenza: deve rilanciare l'eventuale errore (mostrato nel footer). */
  onSubmit: (result: StudioFormResult) => Promise<void>;
}

const PLANS: { value: string; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

/**
 * Modale per creare/modificare uno studio affiliato (gate admin Conflavoro).
 * Contratto backend minimale: {nome, plan?}. I campi anagrafici estesi restano
 * fuori finché il backend non li espone.
 */
export function StudioFormModal({ open, record, onClose, onSubmit }: StudioFormModalProps) {
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const isEdit = !!record;

  const [nome, setNome] = useState('');
  const [plan, setPlan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(record?.ragione_sociale ?? '');
    setPlan(record?.plan ?? '');
    setError(null);
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

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (saving) return;
      setSubmitError(null);
      if (!nome.trim()) {
        setError('La ragione sociale è obbligatoria.');
        return;
      }
      setSaving(true);
      try {
        await onSubmit({ ragione_sociale: nome.trim(), plan: plan || undefined });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
        setSaving(false);
      }
    },
    [saving, nome, plan, onSubmit]
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
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-brand-200 animate-fade-up sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <h2 id={titleId} className="section-title text-[16px] text-brand-800">
            {isEdit ? 'Modifica studio' : 'Nuovo studio'}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} className="btn-icon" aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            <div>
              <label
                htmlFor="studio-nome"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider2 text-ink-muted"
              >
                Ragione sociale<span className="ml-1 text-danger-mark">*</span>
              </label>
              <input
                id="studio-nome"
                ref={firstRef}
                className="input-field"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error ? true : undefined}
                placeholder="Es. Studio Sicurezza Rossi"
              />
              {error && <p className="mt-1 text-[12px] text-danger-mark">{error}</p>}
            </div>

            <div>
              <label
                htmlFor="studio-plan"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider2 text-ink-muted"
              >
                Piano
              </label>
              <select id="studio-plan" className="input-field" value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="">Predefinito</option>
                {PLANS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
                {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea studio'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
