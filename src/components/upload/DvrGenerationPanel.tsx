'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ListChecks, Trash2, Loader2 } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';
import { DocumentUploadPanel } from '@/components/upload/DocumentUploadPanel';
import { RewriteHumanEditsToggle } from '@/components/dvr/RewriteHumanEditsToggle';
import { getDataSource, isApiMode } from '@/lib/data-source';
import type { DvrUpload } from '@/lib/data-source';

const POLL_INTERVAL_MS = 5000;
// Il Crew reale può impiegare diversi minuti (molte chiamate LLM); diamo una
// finestra ampia. Oltre la deadline lo stato resta interrogabile ricaricando.
const POLL_MAX_MS = 10 * 60 * 1000; // ~10 minuti

type GenState = 'idle' | 'running' | 'done' | 'error';

/**
 * Pannello "Documenti e generazione con AI": carica documenti/foto, avvia il DVR
 * Authoring Crew lato backend, segue lo stato (polling in modalità async) e a fine
 * generazione invita a ricaricare il DVR per scaricare il documento REALE.
 *
 * Robustezza: ogni chiamata è try/catch, il polling ha timeout e cleanup su unmount,
 * nessuna promise non gestita. In demo (localStorage) il flusso è simulato sync.
 */
export function DvrGenerationPanel({
  dvrId,
  onGenerated,
}: {
  dvrId: number;
  /** Invocato a generazione completata: la pagina rifà il fetch del DVR. */
  onGenerated?: () => void;
}) {
  const [uploads, setUploads] = useState<DvrUpload[]>([]);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  // Chiave kind-id dell'upload in fase di eliminazione (per lo stato di loading sul bottone).
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [genState, setGenState] = useState<GenState>('idle');
  const [genMessage, setGenMessage] = useState<string | null>(null);
  // Spenta di default: l'AI conserva le sezioni corrette a mano dall'RSPP.
  const [rewriteHuman, setRewriteHuman] = useState(false);

  // Refs per il polling: timer attivo + flag di montaggio (cleanup sicuro).
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadUploads = useCallback(async () => {
    try {
      const list = await getDataSource().media.listUploads(dvrId);
      if (mountedRef.current) {
        setUploads(list);
        setUploadsError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setUploadsError(e instanceof Error ? e.message : 'Impossibile caricare gli upload.');
      }
    }
  }, [dvrId]);

  const handleDeleteUpload = useCallback(
    async (u: DvrUpload) => {
      const key = `${u.kind}-${u.id}`;
      const label = u.kind === 'media' ? 'la foto' : 'il documento';
      if (typeof window !== 'undefined' && !window.confirm(`Eliminare ${label} "${u.filename}"?`)) {
        return;
      }
      setDeletingKey(key);
      setUploadsError(null);
      try {
        await getDataSource().media.deleteUpload(dvrId, u.kind, u.id);
        await loadUploads();
      } catch (e) {
        if (mountedRef.current) {
          setUploadsError(
            e instanceof Error ? e.message : 'Eliminazione non riuscita. Riprova.'
          );
        }
      } finally {
        if (mountedRef.current) setDeletingKey(null);
      }
    },
    [dvrId, loadUploads]
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadUploads();
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [loadUploads, clearTimer]);

  // Determina se lo stato del backend indica completamento.
  const isCompleted = (status: string | undefined, gen: Record<string, unknown>): boolean => {
    const s = (status ?? (gen.status as string | undefined) ?? '').toLowerCase();
    return ['completed', 'done', 'completata', 'completato', 'ready', 'generated'].includes(s);
  };
  const isFailed = (gen: Record<string, unknown>): boolean => {
    const s = String(gen.status ?? '').toLowerCase();
    return ['failed', 'error', 'errore', 'fallita', 'fallito'].includes(s);
  };

  const finishOk = useCallback(() => {
    if (!mountedRef.current) return;
    clearTimer();
    setGenState('done');
    setGenMessage('Generazione completata. Aggiorno il documento…');
    onGenerated?.();
  }, [clearTimer, onGenerated]);

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    if (Date.now() > pollDeadlineRef.current) {
      clearTimer();
      setGenState('error');
      setGenMessage(
        'La generazione sta richiedendo più del previsto. Riprova ad aggiornare la pagina tra poco: il backend può ancora completare in autonomia.'
      );
      return;
    }
    try {
      const st = await getDataSource().dvr.generationStatus(dvrId);
      if (!mountedRef.current) return;
      if (isFailed(st.generation)) {
        clearTimer();
        setGenState('error');
        setGenMessage('La generazione è fallita lato backend. Verifica i documenti caricati e riprova.');
        return;
      }
      if (isCompleted(undefined, st.generation)) {
        finishOk();
        return;
      }
      // Ancora in corso: ripianifica.
      timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    } catch (e) {
      if (!mountedRef.current) return;
      // Un errore transitorio non deve interrompere il polling finché c'è tempo.
      if (Date.now() <= pollDeadlineRef.current) {
        timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } else {
        clearTimer();
        setGenState('error');
        setGenMessage(e instanceof Error ? e.message : 'Errore durante il controllo dello stato.');
      }
    }
  }, [dvrId, clearTimer, finishOk]);

  const handleGenerate = useCallback(async () => {
    setGenState('running');
    setGenMessage('Avvio della generazione… gli agenti AI stanno redigendo il documento.');
    clearTimer();
    try {
      const res = await getDataSource().dvr.generate(dvrId, { riscriviModificheUmane: rewriteHuman });
      if (!mountedRef.current) return;
      const done =
        res.mode === 'sync' &&
        ['completed', 'done', 'completata', 'completato', undefined, ''].includes(res.status?.toLowerCase());
      if (res.mode === 'sync' && (done || res.result !== undefined)) {
        finishOk();
        return;
      }
      // Async: avvia il polling con deadline.
      pollDeadlineRef.current = Date.now() + POLL_MAX_MS;
      timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    } catch (e) {
      if (!mountedRef.current) return;
      clearTimer();
      setGenState('error');
      setGenMessage(e instanceof Error ? e.message : 'Avvio generazione non riuscito.');
    }
  }, [dvrId, clearTimer, finishOk, poll, rewriteHuman]);

  const running = genState === 'running';

  return (
    <section className="card-luxury p-6 space-y-5">
      <div>
        <h3 className="section-title text-[17px]">Documenti e generazione con AI</h3>
        <p className="mt-1 text-[13px] text-ink-muted">
          Carica i documenti (DVR pregressi, nomine, manuali, SDS) e le foto di sopralluogo, poi avvia
          la redazione assistita. Il documento finale viene prodotto dal motore AI a partire da questi
          materiali.
        </p>
      </div>

      <DocumentUploadPanel dvrId={dvrId} onUploaded={() => void loadUploads()} />

      {/* Elenco upload collegati al DVR */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label-upper inline-flex items-center gap-1.5">
            <ListChecks size={13} /> Materiali caricati
          </p>
          <button
            type="button"
            onClick={() => void loadUploads()}
            className="btn-ghost h-7 px-2 text-[11px]"
            disabled={running}
          >
            <RefreshCw size={11} /> aggiorna
          </button>
        </div>
        {uploadsError ? (
          <p className="text-[12px] text-warn-ink">{uploadsError}</p>
        ) : uploads.length === 0 ? (
          <p className="text-[12px] text-ink-muted">Nessun documento o foto ancora caricato per questo DVR.</p>
        ) : (
          <ul className="divide-y divide-brand-100 rounded-xl border border-brand-100 bg-white/60">
            {uploads.map((u) => {
              const key = `${u.kind}-${u.id}`;
              const isDeleting = deletingKey === key;
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{u.filename}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider2 text-ink-muted">
                    {u.kind === 'media' ? 'foto' : 'documento'}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-ok-ink">
                    <CheckCircle2 size={12} /> {u.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteUpload(u)}
                    disabled={isDeleting || running || deletingKey !== null}
                    aria-label={`Elimina ${u.kind === 'media' ? 'foto' : 'documento'} ${u.filename}`}
                    title="Elimina"
                    className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-danger hover:text-danger-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Avvio generazione + stato */}
      <div className="border-t border-brand-100 pt-5">
        <RewriteHumanEditsToggle
          checked={rewriteHuman}
          onChange={setRewriteHuman}
          disabled={running}
          className="mb-3"
        />
        <button onClick={() => void handleGenerate()} disabled={running} className="btn-primary">
          <IconaAi size={14} /> {running ? 'Generazione in corso…' : 'Genera DVR con l’AI'}
        </button>

        {genState === 'running' && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5 text-[12px] text-ink-soft">
            <RefreshCw size={14} className="mt-0.5 shrink-0 animate-spin text-brand-600" />
            <span>{genMessage}</span>
          </div>
        )}
        {genState === 'done' && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-ok bg-ok/60 px-3 py-2.5 text-[12px] text-ok-ink">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{genMessage ?? 'Generazione completata. Il documento è pronto per il download.'}</span>
          </div>
        )}
        {genState === 'error' && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn bg-warn/60 px-3 py-2.5 text-[12px] text-warn-ink">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{genMessage}</span>
          </div>
        )}
      </div>

      {/* Disclaimer AI Act sempre visibile */}
      <p className="rounded-xl border border-brand-100 bg-brand-50/30 px-3 py-2.5 text-[11px] italic text-ink-soft">
        Documento generato con assistenza AI &mdash; la validità è subordinata alla verifica e
        sottoscrizione di un RSPP qualificato.
      </p>

      {!isApiMode() && (
        <p className="text-[11px] text-ink-subtle">
          Modalità demo: la generazione è simulata. Con il backend reale il documento viene prodotto
          dal DVR Authoring Crew a partire dai materiali caricati.
        </p>
      )}
    </section>
  );
}
