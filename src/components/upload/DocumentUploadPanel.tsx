'use client';

import { useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { getDataSource, type DvrUpload, type UploadKind } from '@/lib/data-source';

interface UploadRow {
  filename: string;
  kind: UploadKind;
  percent: number;
  status: 'in_corso' | 'ok' | 'errore';
  note?: string;
  error?: string;
}

const IMAGE_RE = /\.(jpe?g|png|heic|heif|webp|gif|bmp)$/i;
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|webm|amr)$/i;

// Estensioni documento accettate. Un documento immagine/scansione (jpg/png) va
// caricato come DOCUMENTO: verra' OCR-izzato lato backend. Le FOTO di sopralluogo
// e gli AUDIO di sopralluogo (note vocali) passano dal canale media tramite isMedia().
const ACCEPT_DOCUMENTS =
  '.pdf,.p7m,.doc,.docx,.txt,.xlsx,.xls,.csv,.jpg,.jpeg,.png,image/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*';

// Guardie dimensione gentili (non bloccano i tipi, solo i file enormi).
const MAX_DOC_BYTES = 20 * 1024 * 1024; // ~20MB documenti
const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // ~25MB foto/audio

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_RE.test(file.name);
}

function isAudio(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_RE.test(file.name);
}

// Media = foto di sopralluogo o nota vocale: entrambe passano dal canale media.
function isMedia(file: File): boolean {
  return isImage(file) || isAudio(file);
}

/**
 * Pannello di caricamento documenti/immagini verso un DVR. Mostra avanzamento
 * per file. Instrada documenti -> media.uploadDocument, immagini ->
 * media.uploadMedia (firme definite nel DataSource adapter).
 *
 * In demo (LocalStorage) l'upload e' simulato; con backend reale fa la POST
 * multipart con progress. La classificazione/estrazione AI resta lato backend.
 */
export function DocumentUploadPanel({
  dvrId,
  onUploaded,
}: {
  dvrId: number;
  onUploaded?: (uploads: DvrUpload[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null): Promise<void> {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    const ds = getDataSource();
    setBusy(true);

    const startIndex = rows.length;
    setRows((prev) => [
      ...prev,
      ...list.map<UploadRow>((f) => ({
        filename: f.name,
        kind: isMedia(f) ? 'media' : 'document',
        percent: 0,
        status: 'in_corso',
      })),
    ]);

    const done: DvrUpload[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const rowIdx = startIndex + i;
      const update = (patch: Partial<UploadRow>): void =>
        setRows((prev) => prev.map((r, idx) => (idx === rowIdx ? { ...r, ...patch } : r)));
      const media = isMedia(file);
      const limit = media ? MAX_MEDIA_BYTES : MAX_DOC_BYTES;
      if (file.size > limit) {
        update({
          status: 'errore',
          error: media
            ? 'File multimediale troppo grande (oltre 25 MB). Riduci la risoluzione/durata e riprova.'
            : 'Documento troppo grande (oltre 20 MB). Carica una versione più leggera.',
        });
        continue;
      }
      try {
        const onProgress = (p: number): void => update({ percent: p });
        const res = media
          ? await ds.media.uploadMedia(dvrId, file, onProgress)
          : await ds.media.uploadDocument(dvrId, file, onProgress);
        done.push(res);
        update({ percent: 100, status: 'ok', note: res.note });
      } catch (err) {
        update({
          status: 'errore',
          error: err instanceof Error ? err.message : 'Upload non riuscito',
        });
      }
    }

    setBusy(false);
    if (done.length > 0) onUploaded?.(done);
  }

  return (
    <section className="card-luxury p-5">
      <h3 className="section-title">Carica documenti e foto</h3>
      <p className="mt-1 text-[12px] text-ink-muted">
        Qualsiasi documento aziendale: vecchi DVR, visure, nomine, manuali, registri Excel, SDS,
        planimetrie, foto di documenti o di sopralluogo. I documenti scansionati e le immagini di
        documenti vengono letti con OCR; le foto di sopralluogo sono analizzate dalla AI di visione.
      </p>

      <label
        className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/30 px-4 py-6 text-center transition-colors hover:border-brand-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload size={20} className="mx-auto mb-1 text-brand-600" />
        <p className="text-[13px] font-semibold text-ink">Trascina qui i file o clicca per sceglierli</p>
        <p className="text-[11px] text-ink-muted">PDF · PDF firmato (.p7m) · Word · Excel · CSV · testo · immagini · audio (note vocali) · multi-file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_DOCUMENTS}
          className="hidden"
          disabled={busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="rounded-xl border border-brand-100 bg-white/70 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[12px]">
                {r.kind === 'media' ? (
                  <ImageIcon size={14} className="shrink-0 text-brand-500" />
                ) : (
                  <FileText size={14} className="shrink-0 text-brand-500" />
                )}
                <span className="min-w-0 flex-1 truncate text-ink">{r.filename}</span>
                {r.status === 'ok' && (
                  <span className="inline-flex items-center gap-1 text-ok-ink">
                    <CheckCircle2 size={13} /> caricato
                  </span>
                )}
                {r.status === 'errore' && (
                  <span className="inline-flex items-center gap-1 text-danger-mark">
                    <AlertTriangle size={13} /> errore
                  </span>
                )}
                {r.status === 'in_corso' && <span className="text-ink-muted">{r.percent}%</span>}
              </div>
              {r.status === 'in_corso' && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all duration-200"
                    style={{ width: `${r.percent}%` }}
                  />
                </div>
              )}
              {r.note && r.status === 'ok' && (
                <p className="mt-1 text-[11px] text-ink-subtle">{r.note}</p>
              )}
              {r.error && <p className="mt-1 text-[11px] text-danger-mark">{r.error}</p>}
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setRows([])}
              className="btn-ghost h-7 px-2 text-[11px]"
            >
              <X size={11} /> pulisci elenco
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
