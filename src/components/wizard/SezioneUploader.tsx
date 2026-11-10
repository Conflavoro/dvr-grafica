'use client';

import { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, X, FileText } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';
import {
  extractDvrFromFile,
  extractedToWizardPatch,
  filterPatchToSection,
  countPatchFields,
  type WizardDraftPatch,
  type WizardSection,
} from '@/lib/import/dvr-extractor';

interface SezioneUploaderProps {
  /** Sezione corrente del wizard (A,B,C,D,E,F,H). */
  section: WizardSection;
  /** Etichetta umana sezione (es. "Sezione H · Rumore/MMC/Vibrazioni"). */
  sectionLabel: string;
  /** Esempi di documenti accettati per questa sezione. */
  acceptedDocs: string;
  /** Callback per applicare il patch limitato alla sezione. */
  onApply: (patch: WizardDraftPatch) => void;
}

export function SezioneUploader({ section, sectionLabel, acceptedDocs, onApply }: SezioneUploaderProps) {
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<{ filename: string; fields: number; warnings: string[] }[] | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setFiles(list);
    setExtracting(true);
    setReport(null);
    try {
      const results = await Promise.all(list.map((f) => extractDvrFromFile(f)));
      const reports: typeof report = [];
      let mergedFields = 0;
      const merged: WizardDraftPatch = {};
      for (const r of results) {
        const fullPatch = extractedToWizardPatch(r);
        const sectionPatch = filterPatchToSection(fullPatch, section);
        const fields = countPatchFields(sectionPatch);
        Object.assign(merged, sectionPatch);
        mergedFields += fields;
        reports!.push({ filename: r.source_filename, fields, warnings: r.warnings });
      }
      setReport(reports);
      if (mergedFields > 0) onApply(merged);
    } catch (err) {
      alert('Errore estrazione: ' + (err as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setReport(null);
  };

  return (
    <section className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <IconaAi size={15} className="text-brand-600" />
          <span className="text-[12px] font-bold uppercase tracking-wider2 text-brand-700">
            Allega documenti per {sectionLabel}
          </span>
        </span>
        <span className="text-[11px] text-ink-muted">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-ink-muted">
            Documenti tipici per questa sezione: <em>{acceptedDocs}</em>. L&apos;AI estrae <strong>solo</strong> i campi pertinenti
            a questa sezione (gli altri campi del wizard non vengono toccati).
          </p>

          {!report && (
            <label className="block cursor-pointer rounded-xl border border-brand-200 bg-white px-4 py-3 text-center transition-colors hover:border-brand-400">
              <Upload size={18} className="mx-auto text-brand-600 mb-1" />
              <p className="text-[12px] font-semibold text-ink">Carica file</p>
              <p className="text-[10px] text-ink-muted">PDF · PDF firmato (.p7m) · DOCX · XLSX · TXT · multi-file ok</p>
              <input
                type="file"
                multiple
                accept=".pdf,.p7m,.docx,.xlsx,.xls,.csv,.txt"
                onChange={handleSelect}
                className="hidden"
                disabled={extracting}
              />
            </label>
          )}

          {extracting && (
            <p className="text-[12px] text-brand-700 flex items-center gap-1">
              <IconaAi size={12} className="animate-pulse" /> Estrazione in corso…
            </p>
          )}

          {report && (
            <div className="space-y-1.5">
              {report.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px]">
                  <FileText size={14} className="text-brand-500 shrink-0" />
                  <span className="truncate flex-1 text-ink">{r.filename}</span>
                  {r.fields > 0 ? (
                    <span className="inline-flex items-center gap-1 text-ok-ink">
                      <CheckCircle2 size={12} /> {r.fields} {r.fields === 1 ? 'campo' : 'campi'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warn-ink">
                      <AlertTriangle size={12} /> nessun dato pertinente
                    </span>
                  )}
                </div>
              ))}
              <button onClick={reset} className="btn-ghost h-7 px-2 text-[11px]">
                <X size={11} /> reset · carica altri
              </button>
            </div>
          )}

          {files.length > 0 && !extracting && !report && (
            <p className="text-[11px] text-ink-muted">{files.length} file selezionati, estrazione…</p>
          )}
        </div>
      )}
    </section>
  );
}
