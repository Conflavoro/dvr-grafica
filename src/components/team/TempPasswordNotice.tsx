'use client';

import { useCallback, useId, useState } from 'react';
import { KeyRound, Copy, Check, X, ShieldAlert } from 'lucide-react';

export interface TempPasswordNoticeProps {
  nome: string;
  email: string;
  password: string;
  onClose: () => void;
}

/**
 * Avviso post-creazione: mostra UNA SOLA VOLTA la password temporanea generata
 * dal backend, copiabile, da comunicare al consulente. Volutamente modale (blocca
 * il flusso) perché la password non è più recuperabile dopo la chiusura.
 */
export function TempPasswordNotice({ nome, email, password, onClose }: TempPasswordNoticeProps) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard non disponibile (es. contesto non sicuro): selezione manuale.
      setCopied(false);
    }
  }, [password]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-ok animate-fade-up sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-ok bg-ok/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-ok-mark" />
            <h2 id={titleId} className="section-title text-[16px] text-ok-ink">
              Consulente creato
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[13px] text-ink-soft">
            Comunica questa password a <strong className="text-ink">{nome || email}</strong>. Non sarà più
            visibile dopo la chiusura.
          </p>

          <div className="mt-4">
            <p className="label-upper">Email</p>
            <p className="mt-0.5 text-[13px] font-mono text-ink break-all">{email}</p>
          </div>

          <div className="mt-4">
            <p className="label-upper">Password temporanea</p>
            <div className="mt-1.5 flex items-stretch gap-2">
              <code className="flex-1 select-all break-all rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5 text-[14px] font-mono text-ink">
                {password}
              </code>
              <button
                type="button"
                onClick={copy}
                className="btn-ghost shrink-0"
                aria-label="Copia la password"
              >
                {copied ? <Check size={16} className="text-ok-mark" /> : <Copy size={16} />}
                {copied ? 'Copiata' : 'Copia'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warn bg-warn/60 px-3 py-2.5 text-[12px] text-warn-ink">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span>Invita il consulente a cambiarla al primo accesso. Non condividerla via canali non sicuri.</span>
          </div>
        </div>

        <div className="border-t border-brand-100 bg-brand-50/30 px-6 py-4 text-right">
          <button type="button" onClick={onClose} className="btn-primary">
            Ho comunicato la password
          </button>
        </div>
      </div>
    </div>
  );
}
