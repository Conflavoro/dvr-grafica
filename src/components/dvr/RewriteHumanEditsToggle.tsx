'use client';

import { useId } from 'react';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Casella per decidere se la rigenerazione AI deve riscrivere anche le sezioni
 * che l'RSPP ha corretto a mano. Spenta di default: il backend le conserva.
 */
export function RewriteHumanEditsToggle({ checked, onChange, disabled, className }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-brand-100 bg-white/60 px-3 py-2.5 ${className ?? ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hintId}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-brand-300 text-brand-600 focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[13px] font-semibold text-ink">
          Riscrivi anche le sezioni corrette a mano
        </label>
        <p id={hintId} className="mt-0.5 text-[12px] text-ink-muted">
          {checked
            ? 'L’AI riscriverà tutto il documento, comprese le sezioni che hai modificato. Le tue correzioni restano comunque nello storico revisioni.'
            : 'Lasciala spenta per conservare le sezioni che hai già corretto: l’AI aggiorna solo il resto del documento.'}
        </p>
      </div>
    </div>
  );
}
