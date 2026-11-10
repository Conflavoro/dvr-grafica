'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, History, Loader2, RotateCcw, GitCompare, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getDataSource, isApiMode } from '@/lib/data-source';
import type { Dvr, DvrRevisionChange, DvrRevisionDetail, DvrRevisionList, DvrRevisionSummary } from '@/lib/data-source';
import { apiUrl, getToken } from '@/lib/api';
import { downloadRevisionFile, type RevisionFormat } from '@/lib/dvr-revisions';
import { DvrDocumentText } from './DvrDocumentText';
import { DvrRevisionCompare } from './DvrRevisionCompare';

interface Props {
  dvr: Dvr;
  /** Consulente, titolare studio o admin Conflavoro. Il datore vede e scarica soltanto. */
  canEdit: boolean;
  /** Cambia quando il DVR viene rigenerato: forza il ricaricamento dello storico. */
  reloadToken?: number;
  /** Chiamata dopo un salvataggio o un ripristino (lo stato del DVR puo cambiare). */
  onDvrChanged?: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Data non disponibile';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Data non disponibile';
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * Testo del documento (revisione corrente, modificabile) e storico revisioni
 * con download, ripristino e confronto.
 */
export function DvrRevisionsPanel({ dvr, canEdit, reloadToken, onDvrChanged }: Props) {
  const [list, setList] = useState<DvrRevisionList | null>(null);
  const [current, setCurrent] = useState<DvrRevisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<DvrRevisionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [compareNumero, setCompareNumero] = useState<number | null>(null);
  const [compareDetail, setCompareDetail] = useState<DvrRevisionDetail | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ numero: number; message: string } | null>(null);

  const cache = useRef(new Map<number, DvrRevisionDetail>());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ds = getDataSource();
      const l = await ds.dvr.revisions(dvr.id);
      setList(l);
      if (l.corrente !== null) {
        const detail = await ds.dvr.revision(dvr.id, l.corrente);
        cache.current.set(detail.numero, detail);
        setCurrent(detail);
      } else {
        setCurrent(null);
      }
    } catch (e) {
      setError(errMsg(e, 'Non è stato possibile caricare il testo del documento.'));
    } finally {
      setLoading(false);
    }
  }, [dvr.id]);

  useEffect(() => {
    cache.current.clear();
    setCompareNumero(null);
    setCompareDetail(null);
    void load();
  }, [load, reloadToken]);

  const handleSave = async (modifiche: DvrRevisionChange[], motivo: string) => {
    const rev = await getDataSource().dvr.createRevision(dvr.id, { modifiche, motivo: motivo || undefined });
    setNotice(`Revisione ${rev.numero} salvata.${dvr.status === 'approved' ? ' Il DVR è tornato in revisione.' : ''}`);
    cache.current.clear();
    setCompareNumero(null);
    setCompareDetail(null);
    await load();
    onDvrChanged?.();
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const rev = await getDataSource().dvr.restoreRevision(dvr.id, restoreTarget.numero);
      setNotice(`Ripristinato il testo della revisione ${restoreTarget.numero}: ora è la revisione ${rev.numero}.`);
      setRestoreTarget(null);
      cache.current.clear();
      setCompareNumero(null);
      setCompareDetail(null);
      await load();
      onDvrChanged?.();
    } catch (e) {
      setRestoreError(errMsg(e, 'Ripristino non riuscito.'));
    } finally {
      setRestoring(false);
    }
  };

  const toggleCompare = (numero: number) => {
    if (compareNumero === numero) {
      setCompareNumero(null);
      return;
    }
    void loadCompare(numero);
  };

  const loadCompare = async (numero: number) => {
    setCompareNumero(numero);
    setCompareError(null);
    const cached = cache.current.get(numero);
    if (cached) {
      setCompareDetail(cached);
      return;
    }
    setCompareDetail(null);
    setCompareLoading(true);
    try {
      const d = await getDataSource().dvr.revision(dvr.id, numero);
      cache.current.set(numero, d);
      setCompareDetail(d);
    } catch (e) {
      setCompareError(errMsg(e, 'Non è stato possibile caricare la revisione.'));
    } finally {
      setCompareLoading(false);
    }
  };

  const handleDownload = async (numero: number, format: RevisionFormat) => {
    setDownloading(`${numero}-${format}`);
    setDownloadError(null);
    try {
      await downloadRevisionFile(
        dvr,
        numero,
        format,
        apiUrl(`/dvr/${dvr.id}/revisions/${numero}/download/${format}`),
        getToken(),
      );
    } catch (e) {
      setDownloadError({ numero, message: errMsg(e, 'Download non riuscito.') });
    } finally {
      setDownloading(null);
    }
  };

  if (loading && !list) {
    return (
      <section className="card-luxury p-6" aria-busy="true">
        <p className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Caricamento del testo e dello storico revisioni
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card-luxury p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn bg-warn/70 px-4 py-3">
          <p className="inline-flex items-start gap-2 text-[13px] text-warn-ink">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" /> Riprova
          </button>
        </div>
      </section>
    );
  }

  const revisions = list?.data ?? [];
  const corrente = list?.corrente ?? null;
  const demo = !isApiMode();

  return (
    <>
      {notice && (
        <p role="status" className="rounded-xl border border-ok bg-ok/70 px-4 py-2.5 text-[13px] text-ok-ink">
          {notice}
        </p>
      )}

      {current ? (
        <DvrDocumentText current={current} canEdit={canEdit} dvrStatus={dvr.status} onSave={handleSave} />
      ) : (
        <section className="card-luxury p-6">
          <h3 className="section-title text-[17px]">Testo del documento</h3>
          <p className="mt-2 text-[13px] text-ink-muted">
            Il testo comparirà qui dopo la prima generazione con l’AI. Da quel momento potrai rileggerlo e correggerlo sezione per sezione.
          </p>
        </section>
      )}

      <section className="card-luxury p-4 sm:p-6" aria-labelledby="dvr-storico-title">
        <header className="mb-4 flex items-center gap-2">
          <History size={18} className="text-brand-500" aria-hidden="true" />
          <h3 id="dvr-storico-title" className="section-title text-[17px]">Storico revisioni</h3>
          {loading && <Loader2 size={14} className="animate-spin text-ink-muted" aria-label="Aggiornamento" />}
        </header>

        {revisions.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nessuna revisione registrata per questo DVR.</p>
        ) : (
          <ol className="space-y-3">
            {revisions.map((r) => {
              const isCurrent = r.numero === corrente;
              const comparing = compareNumero === r.numero;
              return (
                <li key={r.numero} className="rounded-xl border border-brand-100 bg-white/60 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-ink">Rev. {r.numero}</span>
                        {isCurrent && <Badge variant="brand">Corrente</Badge>}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">{formatDateTime(r.created_at)}</p>
                    </div>
                    <p className="text-[13px] text-ink-soft">
                      {r.origine === 'ai' ? 'Scritta con AI' : r.autore ? `Modificata da ${r.autore}` : 'Modificata da RSPP'}
                    </p>
                  </div>

                  {r.motivo && <p className="mt-2 text-[13px] text-ink">{r.motivo}</p>}

                  {r.sezioni_modificate.length > 0 && (
                    <p className="mt-2 text-[12px] text-ink-muted">
                      {r.sezioni_modificate.length === 1 ? 'Sezione modificata: ' : 'Sezioni modificate: '}
                      <span className="text-ink-soft">{r.sezioni_modificate.map((k) => k.toUpperCase()).join(', ')}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.ha_file ? (
                      (['docx', 'pdf'] as const).map((f) => {
                        const busy = downloading === `${r.numero}-${f}`;
                        return (
                          <button
                            key={f}
                            type="button"
                            className="btn-ghost"
                            onClick={() => void handleDownload(r.numero, f)}
                            disabled={downloading !== null}
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                            {f === 'docx' ? 'Scarica Word' : 'Scarica PDF'}
                          </button>
                        );
                      })
                    ) : (
                      <span className="self-center text-[12px] text-ink-muted">
                        {demo
                          ? 'In modalità demo i file delle singole revisioni non sono disponibili.'
                          : 'File Word e PDF non disponibili per questa revisione.'}
                      </span>
                    )}
                    {!isCurrent && current && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => toggleCompare(r.numero)}
                        aria-expanded={comparing}
                      >
                        <GitCompare size={14} aria-hidden="true" /> {comparing ? 'Chiudi confronto' : 'Confronta con la corrente'}
                      </button>
                    )}
                    {!isCurrent && canEdit && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setRestoreError(null);
                          setRestoreTarget(r);
                        }}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Ripristina questo testo
                      </button>
                    )}
                  </div>

                  {downloadError?.numero === r.numero && (
                    <p role="alert" className="mt-2 text-[12px] text-danger-ink">{downloadError.message}</p>
                  )}

                  {comparing && (
                    <div className="mt-4 border-t border-brand-100 pt-4">
                      {compareLoading ? (
                        <p className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Caricamento del confronto
                        </p>
                      ) : compareError ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-[13px] text-warn-ink">{compareError}</p>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => void loadCompare(r.numero)}
                          >
                            <RefreshCw size={14} aria-hidden="true" /> Riprova
                          </button>
                        </div>
                      ) : compareDetail && current ? (
                        <DvrRevisionCompare older={compareDetail} current={current} />
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={restoreTarget !== null}
        title={restoreTarget ? `Ripristinare la revisione ${restoreTarget.numero}?` : 'Ripristinare la revisione?'}
        message={
          (restoreTarget
            ? `Il testo della revisione ${restoreTarget.numero} diventa di nuovo quello in vigore. Viene creata una nuova revisione, quindi lo storico resta completo e potrai sempre tornare indietro.`
            : '') +
          (dvr.status === 'approved'
            ? ' Il DVR è approvato: dopo il ripristino torna in revisione e serve una nuova approvazione del titolare dello studio.'
            : '')
        }
        confirmLabel="Ripristina"
        busy={restoring}
        error={restoreError}
        onConfirm={() => void handleRestore()}
        onCancel={() => setRestoreTarget(null)}
      />
    </>
  );
}
