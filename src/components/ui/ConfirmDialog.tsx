'use client';

import { useEffect, useId } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Stile distruttivo (rosso) per azioni irreversibili (es. rimozione). */
  destructive?: boolean;
  /** Operazione in corso: disabilita i bottoni e mostra lo spinner. */
  busy?: boolean;
  /** Errore della conferma, mostrato inline senza chiudere il dialog. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog di conferma riusabile (navy/luxury, accessibile). Usato per azioni
 * irreversibili come la rimozione di un consulente o l'eliminazione di uno studio.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-brand-200 animate-fade-up sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <div className="flex items-center gap-2">
            {destructive && <AlertTriangle size={18} className="text-danger-mark" />}
            <h2 id={titleId} className="section-title text-[16px] text-brand-800">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-icon" aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[13px] text-ink-soft">{message}</p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-danger bg-danger px-4 py-2.5 text-[13px] text-danger-ink">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-brand-100 bg-brand-50/30 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost">
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={
                destructive
                  ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-danger-mark px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-danger-mark active:bg-danger-ink disabled:opacity-50'
                  : 'btn-primary'
              }
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Attendere…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
