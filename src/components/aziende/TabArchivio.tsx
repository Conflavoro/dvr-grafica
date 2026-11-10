'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AudioRecorder } from '@/components/ui/AudioRecorder';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { VideoCapture } from '@/components/ui/VideoCapture';
import { AiAssistField } from '@/components/ai/AiAssistField';
import { getDataSource, type Company, type CompanyDocument, type CompanyDocumentTipo } from '@/lib/data-source';
import { extractKeyframes } from '@/lib/video-frames';
import { ACCEPT_ARCHIVIO, audioComeWav, controlloCaricamento, tipoDaFile, videoDaAnalizzareNelBrowser } from '@/lib/ingresso-file';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { FileText, Film, Image as ImageIcon, Mic, StickyNote, Upload, Camera, Trash2, Loader2, Save, Search, Download, Pencil, X, RefreshCw, Check, Eye } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

/**
 * Archivio documentale PER-AZIENDA: il consulente raccoglie foto, audio (registrati),
 * documenti e note. Ogni elemento viene CONSERVATO e ANALIZZATO dall'AI; l'analisi
 * alimenta la generazione del DVR di questa azienda. Permission-gated (datore read-only).
 */
export function TabArchivio({ company }: { company: Company }) {
  const { user } = useAuth();
  const editable = can(user?.role, 'companies', 'update');

  const [items, setItems] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoStep, setVideoStep] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<'tutti' | CompanyDocumentTipo>('tutti');
  // Elementi in ANALISI ASINCRONA (file appena caricati): il backend analizza in
  // background (Vision ~45s), qui facciamo polling finche' compare l'analisi.
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());
  // Timer di polling attivi + flag "montato": evitano setState su componente
  // smontato e memory leak quando si cambia azienda/tab durante un'analisi.
  const pollTimersRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());
  const mountedRef = useRef(true);

  const stopAnalyzing = useCallback((id: number) => {
    if (!mountedRef.current) return;
    setAnalyzingIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }, []);

  // Ferma TUTTI i poll (unmount o cambio azienda).
  const clearAllPolls = useCallback(() => {
    pollTimersRef.current.forEach((t) => clearInterval(t));
    pollTimersRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllPolls();
    };
  }, [clearAllPolls]);

  // Cambio azienda: azzera i poll della precedente (evita di scrivere dati di
  // un'altra azienda nella lista corrente).
  useEffect(() => {
    return () => clearAllPolls();
  }, [company.id, clearAllPolls]);

  // Polling non bloccante: ogni 5s ricarica la lista finche' l'elemento ha
  // testo_analisi (job completato) o si esaurisce il tempo (~90s).
  const pollAnalysis = useCallback((docId: number) => {
    setAnalyzingIds((s) => new Set(s).add(docId));
    let tries = 0;
    const cid = company.id;
    const timer = setInterval(async () => {
      tries += 1;
      const stop = () => {
        clearInterval(timer);
        pollTimersRef.current.delete(timer);
        stopAnalyzing(docId);
      };
      try {
        const list = await getDataSource().companyDocuments.list(cid);
        // Se nel frattempo si e' smontato o cambiata azienda, non scrivere nulla.
        if (!mountedRef.current || cid !== company.id) {
          stop();
          return;
        }
        setItems(list);
        const d = list.find((x) => x.id === docId);
        if ((d && d.testo_analisi) || tries >= 18) stop();
      } catch {
        if (tries >= 18) stop();
      }
    }, 5000);
    pollTimersRef.current.add(timer);
  }, [company.id, stopAnalyzing]);

  // Sostituisce un singolo elemento nello stato (dopo edit/reanalyze) senza ricaricare tutto.
  const patchItem = useCallback((doc: CompanyDocument) => {
    setItems((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
  }, []);

  const refresh = useCallback(() => {
    return getDataSource()
      .companyDocuments.list(company.id)
      .then(setItems)
      .catch(() => {});
  }, [company.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDataSource()
      .companyDocuments.list(company.id)
      .then((d) => {
        if (!cancelled) setItems(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const addFile = async (file: File | undefined, tipoScelto: CompanyDocumentTipo, origine: string) => {
    if (!file || !editable || working) return;
    // Il tipo vero lo dice il file (una foto scelta da "Documento" resta una foto).
    const tipo = tipoScelto === 'documento' ? tipoDaFile(file) : tipoScelto;
    const blocco = controlloCaricamento(file);
    if (blocco) {
      setError(blocco);
      return;
    }
    if (tipo === 'video') {
      await addVideo(file);
      return;
    }
    setWorking(tipo);
    setError(null);
    try {
      const doc = await getDataSource().companyDocuments.addFile(company.id, tipo, file, { origine });
      await refresh();
      // File caricato: il backend analizza in ASINCRONO -> avvia il polling.
      if (tipo !== 'nota' && !doc.testo_analisi) {
        pollAnalysis(doc.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setWorking(null);
    }
  };

  /**
   * Flusso video completo:
   * 1. Carica il file come tipo 'video' nell'archivio (conservato).
   * 2. Estrae keyframe nel browser (canvas, nessuna elaborazione server-side).
   * 3. Chiama /ai/describe-video con i frame.
   * 4. PATCH testo_analisi sull'elemento appena creato.
   * 5. Refresh lista.
   */
  const addVideo = async (file: File | undefined) => {
    if (!file || !editable || working) return;
    setWorking('video' as CompanyDocumentTipo);
    setVideoStep('Caricamento video…');
    setError(null);
    try {
      const ds = getDataSource();
      if (videoDaAnalizzareNelBrowser(file)) {
        // Oltre il limite di caricamento: fotogrammi e audio dal browser, il file resta sul dispositivo.
        setVideoStep('Estrazione fotogrammi…');
        const fotogrammi = await extractKeyframes(file, 8, 1024, 60000);
        setVideoStep('Estrazione audio…');
        const wav = await audioComeWav(file);
        if (wav && wav.size > 4096) {
          await ds.companyDocuments.addFile(company.id, 'audio', new File([wav], `${file.name.replace(/\.[^.]+$/, '')}_audio.wav`, { type: 'audio/wav' }), { origine: 'audio del video', titolo: `Audio del video ${file.name}` });
        }
        if (fotogrammi.length === 0) {
          setError('Questo browser non riesce a leggere i fotogrammi del video: salvalo in MP4 o caricalo da un altro dispositivo.');
        } else {
          setVideoStep('Analisi AI in corso…');
          const res = await ds.ai.describeVideo({ companyId: company.id, frames: fotogrammi });
          if (res.testo) {
            await ds.companyDocuments.addNote(company.id, res.testo, `Video ${file.name} (fotogrammi)`, 'video', 'video');
          } else {
            setError(`Analisi del video non riuscita${res.errore ? ` (${res.errore})` : ''}.`);
          }
        }
        setVideoStep(null);
        await refresh();
        return;
      }
      // Step 1: carica il file (conservato sul backend, testo_analisi null per ora).
      const doc = await ds.companyDocuments.addFile(company.id, 'video', file, { origine: 'video' });

      // Step 2: estrai keyframe nel browser (5 frame, max 1024px).
      setVideoStep('Estrazione fotogrammi…');
      const frames = await extractKeyframes(file, 8, 1024);

      if (frames.length > 0) {
        // Step 3: analisi AI immediata (corsia veloce). Se fallisce NON e' un
        // vicolo cieco: il server ri-analizza comunque il video intero in
        // background (job) e l'esito comparira' al refresh.
        setVideoStep('Analisi AI in corso…');
        const res = await ds.ai.describeVideo({ companyId: company.id, frames });

        if (res.testo) {
          // Step 4: aggiorna l'analisi sull'elemento creato.
          setVideoStep('Salvataggio analisi…');
          await ds.companyDocuments.update(doc.id, { testo_analisi: res.testo });
        } else {
          setError(
            res.errore
              ? `Analisi immediata non riuscita (${res.errore}). Il server la completa in background: ricontrolla tra un minuto.`
              : 'Analisi immediata non riuscita. Il server la completa in background: ricontrolla tra un minuto.'
          );
        }
      } else {
        // Zero fotogrammi (codec non decodificabile da questo browser): il
        // server analizza comunque il video intero in background.
        setError('Questo browser non riesce a leggere il video: l\'analisi prosegue sul server, ricontrolla tra un minuto.');
      }

      // Step 5: refresh.
      setVideoStep(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento video non riuscito.');
    } finally {
      setWorking(null);
      setVideoStep(null);
    }
  };

  const addNota = async () => {
    const testo = nota.trim();
    if (!testo || !editable || working) return;
    setWorking('nota');
    setError(null);
    try {
      await getDataSource().companyDocuments.addNote(company.id, testo, undefined, 'manuale');
      setNota('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setWorking(null);
    }
  };

  const removeDoc = async (d: CompanyDocument) => {
    if (deletingId !== null || !editable) return;
    if (!window.confirm('Eliminare questo elemento dall\'archivio dell\'azienda?')) return;
    setDeletingId(d.id);
    try {
      await getDataSource().companyDocuments.delete(d.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.');
    } finally {
      setDeletingId(null);
    }
  };

  // Note "precedenti" salvate in settings (prima dell'archivio unico): mostrate in
  // sola lettura cosi' nulla va perso. id negativo = legacy (no download/elimina).
  const legacy = useMemo<CompanyDocument[]>(() => {
    const raw = company.settings?.kb_notes;
    if (!Array.isArray(raw)) return [];
    return (raw as Array<{ testo?: string; origine?: string; created_at?: string }>).map((n, i) => ({
      id: -(i + 1),
      company_id: company.id,
      tipo: 'nota' as const,
      titolo: 'Nota precedente',
      testo_analisi: n.testo ?? '',
      origine: n.origine ?? 'kb',
      created_at: n.created_at ?? new Date().toISOString(),
    }));
  }, [company.settings, company.id]);

  const allItems = useMemo(() => [...items, ...legacy], [items, legacy]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutti: allItems.length, foto: 0, audio: 0, documento: 0, nota: 0, video: 0 };
    for (const d of allItems) c[d.tipo] = (c[d.tipo] ?? 0) + 1;
    return c;
  }, [allItems]);

  const filtered = useMemo(
    () =>
      allItems.filter(
        (d) =>
          (tipoFilter === 'tutti' || d.tipo === tipoFilter) &&
          (!q ||
            `${d.titolo ?? ''} ${d.filename ?? ''} ${d.testo_analisi ?? ''} ${d.tipo}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [allItems, q, tipoFilter]
  );

  const downloadFile = async (d: CompanyDocument) => {
    try {
      await getDataSource().companyDocuments.download(d.id, d.filename ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download non riuscito.');
    }
  };

  const iconFor = (tipo: string) =>
    tipo === 'foto' ? <ImageIcon size={15} /> :
    tipo === 'audio' ? <Mic size={15} /> :
    tipo === 'nota' ? <StickyNote size={15} /> :
    tipo === 'video' ? <Film size={15} /> :
    <FileText size={15} />;

  return (
    <div className="space-y-5">
      {cameraOpen && (
        <CameraCapture
          onCaptured={(file) => addFile(file, 'foto', 'foto')}
          onClose={() => setCameraOpen(false)}
        />
      )}
      {videoOpen && (
        <VideoCapture
          onCaptured={(file) => addVideo(file)}
          onClose={() => setVideoOpen(false)}
        />
      )}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4">
        <p className="flex items-center gap-2 text-[12px] text-ink-muted">
          <IconaAi size={14} className="text-brand-600" />
          Tutto ciò che carichi qui (foto, audio, documenti, note) viene <strong>conservato e analizzato dall&apos;AI</strong>: l&apos;analisi alimenta la generazione del DVR di {company.ragione_sociale}.
        </p>
      </div>

      {/* Azioni di acquisizione */}
      {editable && (
        <div className="card-luxury p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* Documento */}
            <label className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
              {working === 'documento' ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
              <span className="text-[12px] font-semibold">Documento</span>
              <input type="file" accept={ACCEPT_ARCHIVIO} className="hidden" disabled={!!working}
                onChange={(e) => { void addFile(e.target.files?.[0], 'documento', 'upload'); e.target.value = ''; }} />
            </label>
            {/* Foto: fotocamera IN-APP (anteprima live + scatto), non upload */}
            <button
              type="button"
              disabled={!!working}
              onClick={() => setCameraOpen(true)}
              className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : ''}`}
            >
              {working === 'foto' ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              <span className="text-[12px] font-semibold">Scatta foto</span>
            </button>
            {/* Video: registratore IN-APP con analisi keyframe */}
            <button
              type="button"
              disabled={!!working}
              onClick={() => setVideoOpen(true)}
              className={`relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : ''}`}
            >
              {working === ('video' as CompanyDocumentTipo) ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  {videoStep && <span className="px-1 text-center text-[10px] leading-tight text-ink-muted">{videoStep}</span>}
                </>
              ) : (
                <>
                  <Film size={22} />
                  <span className="text-[12px] font-semibold">Registra video</span>
                </>
              )}
            </button>
            {/* Audio: registratore reale — si espande a tutta larghezza su mobile */}
            <div className="col-span-2 sm:col-span-1">
              <AudioRecorder disabled={!!working} onRecorded={(file) => addFile(file, 'audio', 'registrazione')} />
            </div>
            {/* Carica audio esistente */}
            <label className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
              <Mic size={22} />
              <span className="text-[12px] font-semibold">Carica audio</span>
              <input type="file" accept="audio/*" className="hidden" disabled={!!working}
                onChange={(e) => { void addFile(e.target.files?.[0], 'audio', 'upload'); e.target.value = ''; }} />
            </label>
          </div>

          {/* Nota (scrivi/detta con AI) */}
          <AiAssistField
            value={nota}
            onChange={setNota}
            sezione="azienda.archivio"
            companyId={company.id}
            label="Nota / appunto (scrivi o detta)"
            placeholder="Es. Nel reparto verniciatura manca l'estrazione localizzata; tre addetti senza maschera FFP2…"
            rows={3}
            defaultIstruzione="Riformula in modo tecnico e sintetico questo appunto di sopralluogo"
          />
          <div className="flex items-center justify-between gap-3">
            {error && <span className="text-[12px] text-danger-mark">{error}</span>}
            <button type="button" className="btn-primary ml-auto" onClick={addNota} disabled={!!working || nota.trim() === ''}>
              {working === 'nota' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva nota
            </button>
          </div>
        </div>
      )}

      {/* Lista conoscenza azienda */}
      {!loading && allItems.length > 0 && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input type="search" placeholder="Cerca nella conoscenza (testo, file, tipo)…" value={q} onChange={(e) => setQ(e.target.value)} className="input-luxury pl-11" />
          </div>
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 px-1">
            {([
              ['tutti', 'Tutti'],
              ['foto', 'Foto'],
              ['audio', 'Audio'],
              ['video', 'Video'],
              ['documento', 'Documenti'],
              ['nota', 'Note'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTipoFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  tipoFilter === key ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-brand-100 bg-white text-ink-muted hover:bg-brand-50/40'
                }`}
              >
                {key !== 'tutti' && iconFor(key)} {label}
                <span className="rounded-full bg-brand-100/70 px-1.5 text-[10px] text-brand-700">{counts[key] ?? 0}</span>
              </button>
            ))}
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="card-luxury p-8 text-center text-ink-muted">Caricamento…</div>
      ) : allItems.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} />}
          title="Conoscenza azienda vuota"
          description={editable ? `Aggiungi foto, audio, documenti o note di sopralluogo per ${company.ragione_sociale}: l'AI li analizza e li usa per il DVR.` : 'La conoscenza documentale di questa azienda apparirà qui.'}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <ArchiveCard
              key={d.id}
              doc={d}
              editable={editable}
              icon={iconFor(d.tipo)}
              deleting={deletingId === d.id}
              analyzing={analyzingIds.has(d.id)}
              onDelete={() => removeDoc(d)}
              onDownload={() => downloadFile(d)}
              onPatched={patchItem}
              onReanalyzeStarted={pollAnalysis}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Card di un elemento dell'archivio: anteprima inline (foto/audio), modifica
 * dell'analisi a mano, ri-analisi AI, download, elimina. I legacy (id<0) sono
 * in sola lettura.
 */
function ArchiveCard({
  doc,
  editable,
  icon,
  deleting,
  analyzing,
  onDelete,
  onDownload,
  onPatched,
  onReanalyzeStarted,
  onError,
}: {
  doc: CompanyDocument;
  editable: boolean;
  icon: ReactNode;
  deleting: boolean;
  analyzing: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onPatched: (d: CompanyDocument) => void;
  onReanalyzeStarted: (id: number) => void;
  onError: (m: string | null) => void;
}) {
  const isLegacy = doc.id < 0;
  const hasFile = !isLegacy && Boolean(doc.filename);
  const isFoto = doc.tipo === 'foto';
  const isAudio = doc.tipo === 'audio';
  const isVideo = doc.tipo === 'video';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.testo_analisi ?? '');
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Carica l'anteprima (object URL) on-demand e la revoca allo smontaggio.
  // 'alive': se il componente si smonta PRIMA che la Promise risolva, non
  // chiamiamo setPreview e revochiamo comunque l'URL (niente leak di blob).
  useEffect(() => {
    if (!showPreview || preview || isLegacy) return;
    let alive = true;
    let url: string | null = null;
    getDataSource()
      .companyDocuments.previewUrl(doc.id)
      .then((u) => {
        url = u;
        if (alive) {
          setPreview(u);
        } else {
          URL.revokeObjectURL(u); // smontato durante il fetch -> revoca subito
        }
      })
      .catch((e) => {
        if (alive) onError(e instanceof Error ? e.message : 'Anteprima non disponibile.');
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [showPreview, preview, doc.id, isLegacy, onError]);

  const save = async () => {
    setSaving(true);
    onError(null);
    try {
      const updated = await getDataSource().companyDocuments.update(doc.id, { testo_analisi: draft.trim() });
      onPatched(updated);
      setEditing(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const reanalyze = async () => {
    setReanalyzing(true);
    onError(null);
    try {
      // La ri-analisi ora e' ASINCRONA (job): l'esito arriva via polling.
      await getDataSource().companyDocuments.reanalyze(doc.id);
      onReanalyzeStarted(doc.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Ri-analisi non riuscita.');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <li className="card-luxury p-4">
      {/* Header: icona + titolo + badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{doc.titolo || doc.filename || doc.tipo}</span>
        <Badge variant="neutral">{doc.origine}</Badge>
        <p className="w-full text-[11px] text-ink-muted sm:w-auto">{new Date(doc.created_at).toLocaleDateString('it-IT')}</p>
      </div>

      {/* Analisi: vista o modifica */}
      {editing ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="input-luxury text-[12px] leading-relaxed"
            placeholder="Analisi / trascrizione / descrizione…"
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn-primary h-10 px-3 text-[12px]" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva
            </button>
            <button type="button" className="btn-ghost h-10 px-3 text-[12px]" onClick={() => { setEditing(false); setDraft(doc.testo_analisi ?? ''); }} disabled={saving}>
              <X size={14} /> Annulla
            </button>
          </div>
        </div>
      ) : analyzing ? (
        <p className="mt-2 flex items-center gap-2 text-[12px] font-medium text-brand-700">
          <Loader2 size={14} className="animate-spin" /> Analisi AI in corso… (può richiedere fino a un minuto)
        </p>
      ) : doc.testo_analisi ? (
        <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft">{doc.testo_analisi}</p>
      ) : (
        <p className="mt-2 text-[12px] italic text-ink-muted">
          {doc.analisi_errore
            ? `Analisi non riuscita: ${doc.analisi_errore}.`
            : 'Analisi in corso sul server (in genere entro un minuto)…'}
          {hasFile ? ' Puoi usare "Ri-analizza" o scriverla a mano.' : ''}
        </p>
      )}

      {/* Anteprima inline */}
      {showPreview && (isFoto || isAudio || isVideo) && (
        <div className="mt-3">
          {!preview ? (
            <span className="inline-flex items-center gap-2 text-[12px] text-ink-muted"><Loader2 size={14} className="animate-spin" /> Caricamento anteprima…</span>
          ) : isFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={doc.titolo || 'foto'} className="max-h-72 w-full rounded-xl border border-brand-100 object-contain" />
          ) : isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={preview} controls className="max-h-72 w-full rounded-xl border border-brand-100" />
          ) : (
            <audio src={preview} controls className="w-full" />
          )}
        </div>
      )}

      {/* Azioni: riga orizzontale scrollabile su mobile (thumb-friendly) */}
      <div className="mt-3 flex items-center gap-1 overflow-x-auto">
        {hasFile && (isFoto || isAudio || isVideo) && (
          <button type="button" className="btn-icon shrink-0" aria-label="Anteprima" title="Anteprima" onClick={() => setShowPreview((v) => !v)}>
            <Eye size={15} />
          </button>
        )}
        {editable && !isLegacy && (
          <button type="button" className="btn-icon shrink-0" aria-label="Modifica analisi" title="Modifica analisi" onClick={() => setEditing((v) => !v)}>
            <Pencil size={15} />
          </button>
        )}
        {editable && hasFile && (
          <button type="button" className="btn-icon shrink-0" aria-label="Ri-analizza" title="Ri-analizza con AI" disabled={reanalyzing} onClick={reanalyze}>
            {reanalyzing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        )}
        {hasFile && (
          <button type="button" className="btn-icon shrink-0" aria-label="Scarica file" title="Scarica il file originale" onClick={onDownload}>
            <Download size={15} />
          </button>
        )}
        {editable && !isLegacy && (
          <button type="button" className="btn-icon shrink-0 hover:text-danger-mark" aria-label="Elimina" disabled={deleting} onClick={onDelete}>
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        )}
      </div>
    </li>
  );
}
