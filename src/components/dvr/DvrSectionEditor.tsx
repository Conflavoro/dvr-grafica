'use client';

import { useEffect, useId, useRef } from 'react';

export interface SectionDraft {
  title: string;
  body: string;
}

interface Props {
  sectionKey: string;
  draft: SectionDraft;
  original: SectionDraft;
  onChange: (draft: SectionDraft) => void;
  onDiscard: () => void;
  onClose: () => void;
  disabled?: boolean;
}

/** Limiti allineati alla validazione del backend (StoreDvrRevisionRequest). */
export const MAX_TITLE = 300;
export const MAX_BODY = 200_000;

const fmt = new Intl.NumberFormat('it-IT');

/**
 * Editor di una sezione del DVR: titolo e testo. Le modifiche restano in bozza
 * finche l'utente non salva la revisione dal pannello.
 */
export function DvrSectionEditor({ sectionKey, draft, original, onChange, onDiscard, onClose, disabled }: Props) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;
  const countId = `${baseId}-count`;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.focus({ preventScroll: true });
  }, []);

  const changed = draft.title !== original.title || draft.body !== original.body;
  const titleEmpty = draft.title.trim().length === 0;
  const tooLong = draft.body.length > MAX_BODY;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50/30 p-3 sm:p-4">
      <div>
        <label htmlFor={titleId} className="label-upper">
          Titolo della sezione {sectionKey}
        </label>
        <input
          id={titleId}
          type="text"
          className="input-field mt-1.5"
          value={draft.title}
          maxLength={MAX_TITLE}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
        {titleEmpty && (
          <p className="mt-1 text-[12px] text-warn-ink">Se lasci il titolo vuoto resta quello attuale.</p>
        )}
      </div>

      <div>
        <label htmlFor={bodyId} className="label-upper">
          Testo
        </label>
        <textarea
          ref={bodyRef}
          id={bodyId}
          value={draft.body}
          disabled={disabled}
          aria-describedby={countId}
          aria-invalid={tooLong || undefined}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
          rows={16}
          spellCheck
          lang="it"
          className="mt-1.5 block min-h-[50vh] w-full resize-y rounded-xl border border-brand-200 bg-white px-3 py-3 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:min-h-[360px] sm:text-[14px]"
        />
        <p
          id={countId}
          className={`mt-1 text-right text-[12px] ${tooLong ? 'font-semibold text-danger-ink' : 'text-ink-muted'}`}
          aria-live="polite"
        >
          {fmt.format(draft.body.length)} caratteri{tooLong ? `, il massimo è ${fmt.format(MAX_BODY)}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {changed && (
          <button type="button" className="btn-ghost" onClick={onDiscard} disabled={disabled}>
            Annulla le modifiche
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onClose} disabled={disabled}>
          {changed ? 'Chiudi editor' : 'Chiudi'}
        </button>
      </div>
      {changed && (
        <p className="text-[12px] text-ink-muted">
          La modifica resta in bozza: per renderla effettiva usa Salva revisione in fondo al testo.
        </p>
      )}
    </div>
  );
}
