'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil, Save } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { DvrRevisionChange, DvrRevisionDetail, DvrRevisionSection, DvrStatus } from '@/lib/data-source';
import { sectionKey } from '@/lib/dvr-revisions';
import { DvrSectionEditor, MAX_BODY, type SectionDraft } from './DvrSectionEditor';

interface Props {
  current: DvrRevisionDetail;
  canEdit: boolean;
  dvrStatus: DvrStatus;
  onSave: (modifiche: DvrRevisionChange[], motivo: string) => Promise<void>;
}

const MAX_MOTIVO = 500;

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Testo della revisione corrente, sezione per sezione, con modifica in bozza. */
export function DvrDocumentText({ current, canEdit, dvrStatus, onSave }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, SectionDraft>>({});
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Nuova revisione corrente: le bozze non si riferiscono piu al testo mostrato.
  useEffect(() => {
    setDrafts({});
    setEditing(new Set());
    setMotivo('');
    setSaveError(null);
  }, [current.numero]);

  const changes = useMemo<DvrRevisionChange[]>(() => {
    const out: DvrRevisionChange[] = [];
    for (const s of current.sezioni) {
      const d = drafts[sectionKey(s.key)];
      if (!d) continue;
      const change: DvrRevisionChange = { key: s.key };
      const title = d.title.trim();
      if (title && title !== s.title) change.title = title;
      if (d.body !== s.body) change.body = d.body;
      if (change.title !== undefined || change.body !== undefined) out.push(change);
    }
    return out;
  }, [drafts, current.sezioni]);

  const dirty = changes.length > 0;
  const tooLong = Object.values(drafts).some((d) => d.body.length > MAX_BODY);

  // Avvisa prima di lasciare la pagina con modifiche non salvate.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const toggle = (set: Set<string>, k: string, on?: boolean) => {
    const next = new Set(set);
    const want = on ?? !next.has(k);
    if (want) next.add(k);
    else next.delete(k);
    return next;
  };

  const startEdit = (s: DvrRevisionSection) => {
    const k = sectionKey(s.key);
    setDrafts((prev) => (prev[k] ? prev : { ...prev, [k]: { title: s.title, body: s.body } }));
    setEditing((prev) => toggle(prev, k, true));
    setExpanded((prev) => toggle(prev, k, true));
  };

  const discardAll = () => {
    setDrafts({});
    setEditing(new Set());
    setSaveError(null);
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(changes, motivo.trim());
      setConfirmOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (!dirty || tooLong) return;
    if (dvrStatus === 'approved') {
      setSaveError(null);
      setConfirmOpen(true);
      return;
    }
    void doSave();
  };

  const allOpen = current.sezioni.length > 0 && current.sezioni.every((s) => expanded.has(sectionKey(s.key)));

  return (
    <section className="card-luxury p-4 sm:p-6" aria-labelledby="dvr-testo-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="dvr-testo-title" className="section-title text-[17px]">Testo del documento</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Revisione {current.numero}, {current.sezioni.length} sezioni.
            {canEdit ? ' Puoi correggere una o più sezioni e salvarle insieme come nuova revisione.' : ''}
          </p>
        </div>
        {current.sezioni.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setExpanded(allOpen ? new Set() : new Set(current.sezioni.map((s) => sectionKey(s.key))))
            }
          >
            {allOpen ? 'Comprimi tutto' : 'Espandi tutto'}
          </button>
        )}
      </header>

      {current.sezioni.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Questa revisione non contiene ancora sezioni di testo.</p>
      ) : (
        <ol className="divide-y divide-brand-100 rounded-xl border border-brand-100 bg-white/60">
          {current.sezioni.map((s) => {
            const k = sectionKey(s.key);
            const isOpen = expanded.has(k);
            const isEditing = editing.has(k);
            const draft = drafts[k];
            const changed = Boolean(draft && (draft.body !== s.body || (draft.title.trim() && draft.title.trim() !== s.title)));
            const bodyId = `dvr-sez-${k}`;
            return (
              <li key={k} className="px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => toggle(prev, k))}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    className="flex min-h-[44px] min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    <span className="mt-0.5 inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-lg bg-brand-50 px-1.5 text-[12px] font-bold text-brand-700">
                      {s.key}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink">{s.title || `Sezione ${s.key}`}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        {s.origine === 'umano' ? (
                          <Badge variant="info">Modificata da RSPP</Badge>
                        ) : (
                          <Badge variant="neutral">Scritta con AI</Badge>
                        )}
                        {s.origine === 'umano' && s.modificata_at && (
                          <span className="text-[11px] text-ink-muted">il {formatDate(s.modificata_at)}</span>
                        )}
                        {changed && <Badge variant="warning">Da salvare</Badge>}
                      </span>
                    </span>
                    {isOpen ? (
                      <ChevronUp size={18} className="mt-1 shrink-0 text-ink-muted" aria-hidden="true" />
                    ) : (
                      <ChevronDown size={18} className="mt-1 shrink-0 text-ink-muted" aria-hidden="true" />
                    )}
                    <span className="sr-only">{isOpen ? 'Nascondi testo' : 'Mostra testo'}</span>
                  </button>
                  {canEdit && !isEditing && (
                    <button type="button" className="btn-ghost" onClick={() => startEdit(s)} disabled={saving}>
                      <Pencil size={14} aria-hidden="true" /> Modifica
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div id={bodyId} className="mt-2 sm:pl-10">
                    {isEditing && draft ? (
                      <DvrSectionEditor
                        sectionKey={s.key}
                        draft={draft}
                        original={{ title: s.title, body: s.body }}
                        disabled={saving}
                        onChange={(d) => setDrafts((prev) => ({ ...prev, [k]: d }))}
                        onDiscard={() => setDrafts((prev) => ({ ...prev, [k]: { title: s.title, body: s.body } }))}
                        onClose={() => setEditing((prev) => toggle(prev, k, false))}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-soft">
                        {(draft?.body ?? s.body) || <span className="italic text-ink-muted">Sezione senza testo.</span>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && dirty && (
        <div className="sticky bottom-0 z-10 mt-4 space-y-3 rounded-xl border border-brand-200 bg-white p-3 shadow-lg sm:p-4">
          <p className="text-[13px] font-semibold text-ink">
            {changes.length === 1 ? '1 sezione modificata' : `${changes.length} sezioni modificate`}
          </p>
          {dvrStatus === 'approved' && (
            <p className="rounded-xl border border-warn bg-warn px-3 py-2 text-[12px] text-warn-ink">
              Il DVR è approvato. Salvando le modifiche torna in revisione e servirà una nuova approvazione del titolare dello studio.
            </p>
          )}
          <div>
            <label htmlFor="dvr-motivo" className="label-upper">
              Motivo della revisione (facoltativo)
            </label>
            <input
              id="dvr-motivo"
              type="text"
              className="input-field mt-1.5"
              value={motivo}
              maxLength={MAX_MOTIVO}
              placeholder="Per esempio: aggiornate le misure dopo il sopralluogo di ottobre"
              onChange={(e) => setMotivo(e.target.value)}
              disabled={saving}
            />
          </div>
          {saveError && !confirmOpen && (
            <p role="alert" className="rounded-xl border border-danger bg-danger px-3 py-2 text-[13px] text-danger-ink">
              {saveError}
            </p>
          )}
          {tooLong && (
            <p className="text-[12px] text-danger-ink">Una sezione supera la lunghezza massima consentita: accorciala prima di salvare.</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={discardAll} disabled={saving}>
              Annulla tutto
            </button>
            <button type="button" className="btn-primary" onClick={requestSave} disabled={saving || tooLong}>
              {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving ? 'Salvataggio in corso' : 'Salva revisione'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Il DVR tornerà in revisione"
        message="Questo DVR è già approvato. Se salvi la modifica il documento torna in revisione e il titolare dello studio dovrà approvarlo di nuovo. Vuoi continuare?"
        confirmLabel="Salva revisione"
        busy={saving}
        error={saveError}
        onConfirm={() => void doSave()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
