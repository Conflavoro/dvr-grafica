'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImportDropzone } from './ImportDropzone';
import { Badge } from '@/components/ui/Badge';
import { parseFile, type ParsedFile, type ParsedSheet } from '@/lib/import/parsers';
import { autoMapHeaders, type FieldDef, type MappingResult } from '@/lib/import/field-mapper';
import { ArrowLeft, CheckCircle2, AlertTriangle, Save, RefreshCw, Plus } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

export interface RowOutcome<T> {
  ok: boolean;
  row: number;
  data?: T;
  errors?: string[];
}

export type DedupeStrategy = 'skip' | 'update' | 'create_anyway';

export interface DedupeAdapter<T> {
  /** Calcola chiave univoca (case-insensitive consigliato). Null se la riga non è dedupable. */
  uniqueKey: (data: Partial<T> & { id?: number }) => string | null;
  /** Recupera record esistenti dal data source. */
  list: () => Promise<(T & { id: number })[]>;
  /** Aggiorna un record esistente con merge intelligente. */
  update: (id: number, patch: Partial<T>) => Promise<unknown>;
  /** Etichetta umana per il match (es. "P.IVA"). */
  matchLabel: string;
}

export interface BulkImportPanelProps<T, FT> {
  fields: FieldDef<FT>[];
  buildRow: (row: Record<string, string>, mappings: Record<string, string | null>, rowNumber: number) => RowOutcome<T>;
  saveOne: (data: T) => Promise<void>;
  previewColumns: { key: string; label: string }[];

  title: string;
  hint: string;
  successMessageTitle: string;
  /** Link "torna a" mostrato a fine import. Opzionale per l'uso inline (dentro un tab). */
  returnUrl?: string;
  returnLabel?: string;
  saveButtonLabel?: string;
  acceptExt?: string[];
  blocked?: { reason: string };
  /** Callback dopo un batch salvato con successo (per refresh inline). */
  onImported?: (report: { created: number; updated: number; skipped: number }) => void;
  /** Se passato, abilita rilevamento duplicati intelligente (per P.IVA, CF, codice…). */
  dedupe?: DedupeAdapter<T>;
}

interface AnnotatedRow<T> {
  ok: boolean;
  row: number;
  data?: T;
  errors?: string[];
  /** Stato dedup. */
  state: 'new' | 'duplicate' | 'error';
  existingId?: number;
  existingSnapshot?: T;
  /** Campi che cambierebbero in caso di update. */
  changes?: string[];
  /** Strategia scelta per questa riga. */
  strategy?: DedupeStrategy;
}

function smartMerge<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>): { merged: T; changes: string[] } {
  const merged = { ...existing };
  const changes: string[] = [];
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const newVal = incoming[key];
    const oldVal = existing[key];
    if (newVal === undefined || newVal === null || newVal === '') continue;
    if (Array.isArray(newVal) && newVal.length === 0) continue;
    // Solo se diverso, considera change
    const same = JSON.stringify(newVal) === JSON.stringify(oldVal);
    if (!same) {
      merged[key] = newVal as T[keyof T];
      changes.push(String(key));
    }
  }
  return { merged, changes };
}

export function BulkImportPanel<T extends { id?: number }, FT>({
  fields,
  buildRow,
  saveOne,
  previewColumns,
  title,
  hint,
  successMessageTitle,
  returnUrl,
  returnLabel,
  saveButtonLabel,
  acceptExt = ['.xlsx', '.xls', '.xlsm', '.csv', '.tsv'],
  blocked,
  onImported,
  dedupe,
}: BulkImportPanelProps<T, FT>) {
  const router = useRouter();
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [results, setResults] = useState<AnnotatedRow<T>[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedReport, setSavedReport] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [existingItems, setExistingItems] = useState<(T & { id: number })[]>([]);
  const [filter, setFilter] = useState<'all' | 'new' | 'duplicate' | 'error'>('all');

  useEffect(() => {
    if (dedupe) {
      // Caricamento "best effort" degli esistenti per il dedup: un errore qui
      // (es. rete/sessione) non deve mai far crashare la pagina di import.
      void dedupe
        .list()
        .then((items) => setExistingItems(items as (T & { id: number })[]))
        .catch(() => setExistingItems([]));
    }
  }, [dedupe]);

  const annotateRow = (built: RowOutcome<T>): AnnotatedRow<T> => {
    if (!built.ok || !built.data) {
      return { ...built, state: 'error' };
    }
    if (!dedupe) {
      return { ...built, state: 'new', strategy: undefined };
    }
    const key = dedupe.uniqueKey(built.data);
    if (!key) return { ...built, state: 'new' };
    const existing = existingItems.find((e) => {
      const eKey = dedupe.uniqueKey(e);
      return eKey && eKey.toLowerCase() === key.toLowerCase();
    });
    if (!existing) return { ...built, state: 'new' };
    const { changes } = smartMerge(existing as Record<string, unknown>, built.data as Record<string, unknown>);
    return {
      ...built,
      state: 'duplicate',
      existingId: existing.id,
      existingSnapshot: existing,
      changes,
      strategy: changes.length > 0 ? 'update' : 'skip',
    };
  };

  const runValidation = (sheet: ParsedSheet, m: MappingResult) => {
    const out = sheet.rows.map((row, i) => annotateRow(buildRow(row, m.mappings, i + 2)));
    setResults(out);
  };

  // Re-annota se existingItems arriva dopo
  useEffect(() => {
    if (!results || !dedupe) return;
    const reannotated = results.map((r) => {
      if (r.state === 'error' || !r.data) return r;
      const key = dedupe.uniqueKey(r.data);
      if (!key) return { ...r, state: 'new' as const };
      const existing = existingItems.find((e) => {
        const eKey = dedupe.uniqueKey(e);
        return eKey && eKey.toLowerCase() === key.toLowerCase();
      });
      if (!existing) return { ...r, state: 'new' as const, existingId: undefined, changes: undefined, strategy: undefined };
      const { changes } = smartMerge(existing as Record<string, unknown>, r.data as Record<string, unknown>);
      return {
        ...r,
        state: 'duplicate' as const,
        existingId: existing.id,
        existingSnapshot: existing,
        changes,
        strategy: r.strategy ?? (changes.length > 0 ? ('update' as DedupeStrategy) : ('skip' as DedupeStrategy)),
      };
    });
    setResults(reannotated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingItems.length]);

  // Early return DOPO tutti gli hook (Rules of Hooks): se mostrato prima, quando
  // `blocked` passa da true (user non ancora caricato) a false cambia il numero
  // di hook eseguiti -> React error #310 (crash intermittente in import).
  if (blocked) {
    return (
      <div className="space-y-4 animate-fade-up">
        {returnUrl && (
          <Link href={returnUrl} className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700">
            <ArrowLeft size={14} /> {returnLabel}
          </Link>
        )}
        <div role="alert" className="rounded-2xl border-2 border-warn bg-warn p-6">
          <h3 className="section-title text-[17px] text-warn-ink mb-2">Import non disponibile</h3>
          <p className="text-[13px] text-warn-ink">{blocked.reason}</p>
        </div>
      </div>
    );
  }

  const handleFiles = async (files: File[]) => {
    setParseError(null);
    if (files.length === 0) {
      setParsedFiles([]); setMapping(null); setResults(null);
      return;
    }
    setParsing(true);
    try {
      const parsed = await Promise.all(files.map(parseFile));
      setParsedFiles(parsed);
      setSelectedFileIdx(0);
      setSelectedSheetIdx(0);
      const first = parsed[0];
      if (first.kind === 'tabular' && first.sheets[0]) {
        const m = autoMapHeaders(first.sheets[0].headers, fields);
        setMapping(m);
        runValidation(first.sheets[0], m);
      } else {
        setParseError(`Per questo import sono richiesti file tabellari (Excel/CSV). "${first.filename}" non è tabellare.`);
      }
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const updateMapping = (header: string, target: string | null) => {
    if (!mapping) return;
    const newMappings = { ...mapping.mappings, [header]: target };
    const usedTargets = new Set(Object.values(newMappings).filter(Boolean) as string[]);
    const missingRequired = fields.filter((f) => f.required && !usedTargets.has(String(f.key))).map((f) => f.label);
    const unmapped = Object.entries(newMappings).filter(([, v]) => v === null).map(([h]) => h);
    const next = { mappings: newMappings, confidence: mapping.confidence, unmapped, missingRequired };
    setMapping(next);
    const file = parsedFiles[selectedFileIdx];
    if (file?.kind === 'tabular') runValidation(file.sheets[selectedSheetIdx], next);
  };

  const setRowStrategy = (rowIdx: number, strategy: DedupeStrategy) => {
    if (!results) return;
    const next = [...results];
    next[rowIdx] = { ...next[rowIdx], strategy };
    setResults(next);
  };

  const setBulkStrategy = (strategy: DedupeStrategy) => {
    if (!results) return;
    setResults(results.map((r) => (r.state === 'duplicate' ? { ...r, strategy } : r)));
  };

  const handleSave = async () => {
    if (!results) return;
    let created = 0, updated = 0, skipped = 0;
    setSaving(true);
    for (const r of results) {
      if (!r.ok || !r.data) continue;
      if (r.state === 'new') {
        try {
          await saveOne(r.data);
          created++;
        } catch (e) {
          // Defense-in-depth: data layer rejected as duplicate (probabile chiave intra-file).
          const err = e as Error & { code?: string };
          if (err?.code === 'DUPLICATE_PIVA' || err?.code === 'DUPLICATE_KEY') {
            skipped++;
          } else {
            throw e;
          }
        }
      } else if (r.state === 'duplicate') {
        const strat = r.strategy ?? 'skip';
        if (strat === 'skip') {
          skipped++;
        } else if (strat === 'update' && r.existingId !== undefined && dedupe) {
          // Merge intelligente
          const { merged } = smartMerge(r.existingSnapshot as Record<string, unknown>, r.data as Record<string, unknown>);
          await dedupe.update(r.existingId, merged as Partial<T>);
          updated++;
        } else if (strat === 'create_anyway') {
          try {
            await saveOne(r.data);
            created++;
          } catch (e) {
            const err = e as Error & { code?: string };
            if (err?.code === 'DUPLICATE_PIVA' || err?.code === 'DUPLICATE_KEY') {
              skipped++;
            } else {
              throw e;
            }
          }
        }
      }
    }
    setSavedReport({ created, updated, skipped });
    setSaving(false);
    if (created > 0 || updated > 0) onImported?.({ created, updated, skipped });
  };

  const currentFile = parsedFiles[selectedFileIdx];
  const currentSheet = currentFile?.kind === 'tabular' ? currentFile.sheets[selectedSheetIdx] : null;

  const counts = {
    new: results?.filter((r) => r.state === 'new').length ?? 0,
    duplicate: results?.filter((r) => r.state === 'duplicate').length ?? 0,
    error: results?.filter((r) => r.state === 'error').length ?? 0,
  };
  const filtered = results?.filter((r) => filter === 'all' || r.state === filter) ?? [];
  const willCreate = (results ?? []).filter((r) => r.state === 'new' || (r.state === 'duplicate' && r.strategy === 'create_anyway')).length;
  const willUpdate = (results ?? []).filter((r) => r.state === 'duplicate' && r.strategy === 'update').length;

  return (
    <div className="space-y-5 animate-fade-up">
      {returnUrl && (
        <Link href={returnUrl} className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700">
          <ArrowLeft size={14} /> {returnLabel}
        </Link>
      )}

      <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 text-[13px] text-ink-soft">
        <div className="flex items-center gap-2 mb-2">
          <IconaAi size={16} className="text-brand-600" />
          <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Caricamento massivo</strong>
        </div>
        <p>{hint}</p>
        {dedupe && (
          <p className="mt-2 text-[12px] text-ink-muted">
            <strong>Rilevamento duplicati attivo.</strong> I record già presenti vengono riconosciuti per <em>{dedupe.matchLabel}</em>. Puoi decidere se aggiornarli unendo i nuovi campi, oppure saltarli.
          </p>
        )}
      </div>

      {savedReport === null ? (
        <ImportDropzone accept={acceptExt} multiple onFiles={handleFiles} title={title} description="Excel con più fogli oppure CSV. Una riga del file corrisponde a un record." />
      ) : null}

      {parsing && <div className="card-luxury p-5 text-center text-ink-muted">Lettura del file in corso.</div>}
      {parseError && (<div role="alert" className="rounded-xl border border-danger bg-danger px-4 py-3 text-[13px] text-danger-ink">{parseError}</div>)}

      {parsedFiles.length > 1 && (
        <div className="card-luxury p-4">
          <p className="label-upper mb-2">File</p>
          <div className="flex flex-wrap gap-2">
            {parsedFiles.map((f, i) => (
              <button key={i} onClick={() => { setSelectedFileIdx(i); setSelectedSheetIdx(0); }} className={`btn-ghost ${i === selectedFileIdx ? 'border-brand-500 text-brand-700' : ''}`}>{f.filename}</button>
            ))}
          </div>
        </div>
      )}
      {currentFile?.kind === 'tabular' && currentFile.sheets.length > 1 && (
        <div className="card-luxury p-4">
          <p className="label-upper mb-2">Sheet</p>
          <div className="flex flex-wrap gap-2">
            {currentFile.sheets.map((s, i) => (
              <button key={i} onClick={() => { setSelectedSheetIdx(i); const m = autoMapHeaders(s.headers, fields); setMapping(m); runValidation(s, m); }} className={`btn-ghost ${i === selectedSheetIdx ? 'border-brand-500 text-brand-700' : ''}`}>{s.name}</button>
            ))}
          </div>
        </div>
      )}

      {currentSheet && mapping && savedReport === null && (
        <section className="card-luxury p-5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="section-title text-[17px]">Mappatura colonne ({currentSheet.headers.length})</h3>
            <Badge variant={mapping.missingRequired.length === 0 ? 'success' : 'warning'}>
              {mapping.missingRequired.length === 0 ? 'OK' : `${mapping.missingRequired.length} richiesti mancanti`}
            </Badge>
          </header>
          {mapping.missingRequired.length > 0 && (
            <div className="mb-4 rounded-xl border border-warn bg-warn px-4 py-2 text-[12px] text-warn-ink">
              Campi obbligatori non riconosciuti: {mapping.missingRequired.join(', ')}. Mappa manualmente i campi qui sotto scegliendoli dall&apos;elenco.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[560px]">
              <thead>
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Colonna nel file</th>
                  <th className="py-2 pr-3 font-semibold">Mappata sul campo</th>
                  <th className="py-2 font-semibold w-24">Affidabilità</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {currentSheet.headers.map((h) => (
                  <tr key={h}>
                    <td className="py-2 pr-3 font-mono text-[12px] text-ink">{h}</td>
                    <td className="py-2 pr-3">
                      <select className="input-luxury h-9 px-3 max-w-xs" value={mapping.mappings[h] ?? ''} onChange={(e) => updateMapping(h, e.target.value || null)}>
                        <option value="">(ignora questa colonna)</option>
                        {fields.map((f) => (<option key={String(f.key)} value={String(f.key)}>{f.label}{f.required ? ' *' : ''}</option>))}
                      </select>
                    </td>
                    <td className="py-2 text-ink-muted">{mapping.confidence[h] ? `${Math.round(mapping.confidence[h] * 100)}%` : 'n/d'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results && currentSheet && savedReport === null && (
        <section className="card-luxury p-5">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="section-title text-[17px]">Anteprima {results.length} righe</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFilter('all')} className={`btn-ghost ${filter === 'all' ? 'border-brand-500 text-brand-700' : ''}`}>Tutti ({results.length})</button>
              <button onClick={() => setFilter('new')} className={`btn-ghost ${filter === 'new' ? 'border-brand-500 text-brand-700' : ''}`}><Plus size={12} /> Nuovi ({counts.new})</button>
              {dedupe && <button onClick={() => setFilter('duplicate')} className={`btn-ghost ${filter === 'duplicate' ? 'border-brand-500 text-brand-700' : ''}`}><RefreshCw size={12} /> Duplicati ({counts.duplicate})</button>}
              {counts.error > 0 && <button onClick={() => setFilter('error')} className={`btn-ghost ${filter === 'error' ? 'border-danger-mark text-danger-ink' : ''}`}><AlertTriangle size={12} /> Errori ({counts.error})</button>}
            </div>
          </header>

          {dedupe && counts.duplicate > 0 && (
            <div className="mb-4 rounded-xl border border-warn bg-warn px-4 py-3 text-[12px] text-warn-ink">
              <strong>{counts.duplicate} righe già presenti</strong> nel registro (riconosciute per <em>{dedupe.matchLabel}</em>). Cosa fare con tutte:
              <span className="ml-2 inline-flex gap-1">
                <button type="button" onClick={() => setBulkStrategy('skip')} className="btn-ghost h-7 px-2 text-[11px]">Salta tutte</button>
                <button type="button" onClick={() => setBulkStrategy('update')} className="btn-ghost h-7 px-2 text-[11px]">Aggiorna tutte</button>
                <button type="button" onClick={() => setBulkStrategy('create_anyway')} className="btn-ghost h-7 px-2 text-[11px]">Crea comunque</button>
              </span>
            </div>
          )}

          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-[12px] min-w-[720px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="py-2 pr-3 w-12 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Stato</th>
                  {previewColumns.map((c) => (<th key={c.key} className="py-2 pr-3 font-semibold">{c.label}</th>))}
                  {dedupe && <th className="py-2 pr-3 font-semibold">Strategia</th>}
                  <th className="py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtered.map((r) => {
                  const idx = results.indexOf(r);
                  return (
                    <tr key={r.row}>
                      <td className="py-2 pr-3 text-ink-muted">{r.row}</td>
                      <td className="py-2 pr-3">
                        {r.state === 'error' && <Badge variant="danger"><AlertTriangle size={11} /> errore</Badge>}
                        {r.state === 'new' && <Badge variant="success"><Plus size={11} /> nuovo</Badge>}
                        {r.state === 'duplicate' && <Badge variant="warning"><RefreshCw size={11} /> già presente</Badge>}
                      </td>
                      {previewColumns.map((c) => (
                        <td key={c.key} className="py-2 pr-3 text-ink">
                          {r.data ? renderCell(r.data, c.key) : 'n.d.'}
                        </td>
                      ))}
                      {dedupe && (
                        <td className="py-2 pr-3">
                          {r.state === 'duplicate' ? (
                            <select value={r.strategy ?? 'skip'} onChange={(e) => setRowStrategy(idx, e.target.value as DedupeStrategy)} className="input-luxury h-8 px-2 text-[11px]">
                              <option value="skip">Salta</option>
                              <option value="update">Aggiorna {r.changes && r.changes.length > 0 ? `(${r.changes.length} campi)` : '(nessun cambiamento)'}</option>
                              <option value="create_anyway">Crea comunque</option>
                            </select>
                          ) : <span className="text-ink-muted">n/d</span>}
                        </td>
                      )}
                      <td className="py-2 text-[11px] text-ink-muted">
                        {r.state === 'error' ? <span className="text-danger-ink">{r.errors?.join(', ')}</span> : null}
                        {r.state === 'duplicate' && r.changes?.length ? <span className="text-warn-ink">cambieranno: {r.changes.slice(0, 4).join(', ')}{r.changes.length > 4 ? '...' : ''}</span> : null}
                        {r.state === 'duplicate' && (!r.changes || r.changes.length === 0) ? <span>identico, nulla da aggiornare</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-5">
            <p className="text-[12px] text-ink-muted">
              Verranno create {willCreate} righe nuove{dedupe ? `, aggiornate ${willUpdate} esistenti` : ''}. Le righe in errore non vengono salvate.
            </p>
            <button type="button" onClick={handleSave} disabled={saving || (willCreate === 0 && willUpdate === 0)} className="btn-primary">
              <Save size={14} /> {saving ? 'Salvataggio in corso' : (saveButtonLabel ?? `Conferma e salva (${willCreate + willUpdate})`)}
            </button>
          </div>
        </section>
      )}

      {savedReport !== null && (
        <div className="rounded-2xl border-2 border-ok bg-ok p-6 text-center">
          <CheckCircle2 size={36} className="mx-auto text-ok-mark mb-3" />
          <h3 className="section-title text-[17px] text-ok-ink">Importazione completata</h3>
          <p className="mt-3 text-[13px] text-ok-ink">
            <strong>{savedReport.created}</strong> {successMessageTitle} create
            {dedupe ? <> · <strong>{savedReport.updated}</strong> aggiornate · <strong>{savedReport.skipped}</strong> saltate</> : null}.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {returnUrl && (
              <button type="button" onClick={() => router.push(returnUrl)} className="btn-primary">Torna a {returnLabel}</button>
            )}
            <button type="button" onClick={() => { setParsedFiles([]); setMapping(null); setResults(null); setSavedReport(null); }} className="btn-ghost">Importa altri file</button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderCell<T>(data: T, key: string): string {
  const parts = key.split('.');
  let cur: unknown = data;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return 'n.d.';
  }
  if (cur === undefined || cur === null || cur === '') return 'n.d.';
  if (Array.isArray(cur)) return cur.length ? `${cur.slice(0, 3).join(', ')}${cur.length > 3 ? '…' : ''}` : 'n.d.';
  if (typeof cur === 'boolean') return cur ? 'sì' : 'no';
  return String(cur);
}
