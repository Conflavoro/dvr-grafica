'use client';

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileText, FileSpreadsheet, FileImage, X } from 'lucide-react';
import { clsx } from '@/lib/clsx';
import { detectKind } from '@/lib/import/parsers';

interface ImportDropzoneProps {
  /** Estensioni ammesse (es. ['.xlsx', '.csv']). Default: tutti i parser supportati. */
  accept?: string[];
  /** Multi-file. Default true. */
  multiple?: boolean;
  /** Callback con i file selezionati. */
  onFiles: (files: File[]) => void;
  /** Title visualizzato. */
  title?: string;
  /** Descrizione sotto il title. */
  description?: string;
}

const DEFAULT_ACCEPT = ['.xlsx', '.xls', '.xlsm', '.csv', '.tsv', '.docx', '.pdf', '.txt'];

const ICON_BY_KIND = {
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
  docx: FileText,
  pdf: FileText,
  text: FileText,
  unknown: FileImage,
};

export function ImportDropzone({
  accept = DEFAULT_ACCEPT,
  multiple = true,
  onFiles,
  title = 'Carica documenti',
  description = 'Trascina file qui o clicca per selezionare. Supportati: Excel, CSV, Word, PDF, testo.',
}: ImportDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
  };

  const addFiles = (newFiles: File[]) => {
    const next = multiple ? [...files, ...newFiles] : newFiles.slice(0, 1);
    setFiles(next);
    onFiles(next);
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    onFiles(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'card-luxury cursor-pointer p-8 text-center transition-all',
          dragOver ? 'border-brand-500 bg-brand-50/60 shadow-luxury-md' : 'hover:border-brand-300'
        )}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white">
          <Upload size={26} />
        </div>
        <h3 className="mt-3 section-title text-[17px] text-ink">{title}</h3>
        <p className="mt-2 text-[13px] text-ink-muted max-w-md mx-auto">{description}</p>
        <p className="mt-3 text-[11px] uppercase tracking-wider2 text-brand-600">
          {accept.join(' · ')}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept.join(',')}
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="card-luxury divide-y divide-brand-100 p-2">
          {files.map((f, i) => {
            const kind = detectKind(f);
            const Icon = ICON_BY_KIND[kind];
            return (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Icon size={18} className="shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{f.name}</p>
                  <p className="text-[11px] text-ink-muted">
                    {(f.size / 1024).toFixed(1)} KB · {kind === 'unknown' ? 'tipo non supportato' : kind.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  aria-label="Rimuovi"
                  className="btn-icon"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
