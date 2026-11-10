'use client';

import { useCallback, useState } from 'react';
import { getDataSource, type Company } from '@/lib/data-source';
import { extractKeyframes } from '@/lib/video-frames';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { AudioRecorder } from '@/components/ui/AudioRecorder';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { VideoCapture } from '@/components/ui/VideoCapture';
import { Camera, Film, PencilLine, Loader2, CheckCircle2, Save } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

interface Captured {
  kind: 'foto' | 'vocale' | 'video' | 'manuale';
  testo: string;
}

/**
 * Pannello SOPRALLUOGO mobile-first: il consulente in azienda scatta foto, registra
 * audio o scrive note rapide; l'AI descrive/trascrive e tutto confluisce nella KB
 * dell'azienda (settings.kb_notes), pronto ad alimentare la generazione del DVR.
 * Pulsanti grandi touch-friendly. Permission-gated (datore read-only).
 */
export function TabSopralluoghi({ company, onSaved }: { company: Company; onSaved?: () => void }) {
  const { user } = useAuth();
  const editable = can(user?.role, 'companies', 'update');

  const [busy, setBusy] = useState<null | 'foto' | 'vocale' | 'video'>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoStep, setVideoStep] = useState<string | null>(null);
  const [sessione, setSessione] = useState<Captured[]>([]);
  const [nota, setNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // working = una qualsiasi scrittura in corso: blocca tutte le altre azioni.
  const working = busy !== null || savingNota;

  // Cattura sul campo -> ARCHIVIO UNICO dell'azienda (company_documents): il file
  // viene conservato e analizzato dal backend (trascrizione/descrizione), e confluisce
  // nella conoscenza che alimenta il DVR. Niente piu' store separato.
  const handleMedia = async (file: File | undefined, kind: 'foto' | 'vocale') => {
    if (!file || !editable || working) return;
    setBusy(kind);
    setError(null);
    try {
      const ds = getDataSource();
      const tipo = kind === 'foto' ? 'foto' : 'audio';
      const origine = kind === 'foto' ? 'foto' : 'registrazione';
      const doc = await ds.companyDocuments.addFile(company.id, tipo, file, { origine });
      const testo = (doc.testo_analisi ?? '').trim();
      onSaved?.();
      // L'analisi di foto/audio e' asincrona (job server): al salvataggio il
      // testo non c'e' ancora QUASI MAI. Messaggio onesto, non un finto "manca
      // il backend" (era attivo eccome).
      setSessione((s) => [{ kind, testo: testo || 'Salvato: analisi in corso sul server, la trovi tra poco nell\'Archivio.' }, ...s]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Elaborazione non riuscita.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Flusso video sopralluogo:
   * 1. Carica il file video nell'archivio azienda.
   * 2. Estrae keyframe nel browser.
   * 3. Descrive con AI (POST /ai/describe-video).
   * 4. PATCH testo_analisi.
   * 5. Aggiunge alla lista sessione.
   */
  const handleVideo = async (file: File | undefined) => {
    if (!file || !editable || working) return;
    setBusy('video');
    setVideoStep('Caricamento…');
    setError(null);
    try {
      const ds = getDataSource();
      const doc = await ds.companyDocuments.addFile(company.id, 'video', file, { origine: 'video' });

      setVideoStep('Fotogrammi…');
      const frames = await extractKeyframes(file, 8, 1024);
      let testo = '';

      if (frames.length > 0) {
        setVideoStep('Analisi AI…');
        const res = await ds.ai.describeVideo({ companyId: company.id, frames });
        testo = res.testo ?? '';
        if (testo) {
          await ds.companyDocuments.update(doc.id, { testo_analisi: testo });
        }
      }

      onSaved?.();
      // Messaggio ONESTO: se l'analisi immediata non c'e', il server la sta
      // completando in background (video intero al modello). Il vecchio testo
      // "disponibile col backend attivo" mentiva: il backend ERA attivo.
      setSessione((s) => [
        { kind: 'video', testo: testo || 'Video salvato: analisi in corso sul server, la trovi tra poco nell\'Archivio.' },
        ...s,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Elaborazione video non riuscita.');
    } finally {
      setBusy(null);
      setVideoStep(null);
    }
  };

  const salvaNota = async () => {
    const testo = nota.trim();
    if (!testo || !editable || working) return;
    setSavingNota(true);
    setError(null);
    try {
      await getDataSource().companyDocuments.addNote(company.id, testo, undefined, 'manuale');
      onSaved?.();
      setSessione((s) => [{ kind: 'manuale', testo }, ...s]);
      setNota('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingNota(false);
    }
  };

  if (!editable) {
    return (
      <div className="card-luxury p-8 text-center text-ink-muted">
        Il sopralluogo e&apos; a cura del consulente RSPP. Le rilevazioni confluiscono nella knowledge base dell&apos;azienda.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {cameraOpen && (
        <CameraCapture onCaptured={(file) => handleMedia(file, 'foto')} onClose={() => setCameraOpen(false)} />
      )}
      {videoOpen && (
        <VideoCapture onCaptured={(file) => handleVideo(file)} onClose={() => setVideoOpen(false)} />
      )}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
        <p className="flex items-center gap-2 text-[12px] text-ink-muted">
          <IconaAi size={14} className="text-brand-600" />
          Modalità campo: scatta foto, registra o scrivi. L&apos;AI descrive/trascrive e salva tutto nella knowledge base di {company.ragione_sociale}, pronto per il DVR.
        </p>
      </div>

      {/* Pulsanti cattura grandi (touch-friendly >=96px, fotocamera/microfono del device) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Foto: fotocamera IN-APP (anteprima + scatto), non upload */}
        <button
          type="button"
          disabled={working}
          onClick={() => setCameraOpen(true)}
          className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : ''}`}
        >
          {busy === 'foto' ? <Loader2 size={26} className="animate-spin" /> : <Camera size={26} />}
          <span className="text-[13px] font-semibold">{busy === 'foto' ? 'Analisi…' : 'Scatta foto'}</span>
        </button>
        {/* Video: registratore IN-APP con analisi keyframe */}
        <button
          type="button"
          disabled={working}
          onClick={() => setVideoOpen(true)}
          className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brand-50 ${working ? 'pointer-events-none opacity-50' : ''}`}
        >
          {busy === 'video' ? (
            <>
              <Loader2 size={26} className="animate-spin" />
              {videoStep && <span className="px-1 text-center text-[10px] leading-tight text-ink-muted">{videoStep}</span>}
            </>
          ) : (
            <>
              <Film size={26} />
              <span className="text-[13px] font-semibold">Registra video</span>
            </>
          )}
        </button>
        {/* Registratore audio REALE in-piattaforma (MediaRecorder, non upload). */}
        <AudioRecorder disabled={working} onRecorded={(file) => handleMedia(file, 'vocale')} />
      </div>

      {/* Nota rapida: sempre a tutta larghezza su mobile per testo agevole */}
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-brand-200 bg-white p-3">
        <div className="flex items-center gap-2 text-brand-700">
          <PencilLine size={18} />
          <span className="text-[13px] font-semibold">Nota rapida</span>
        </div>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Osservazione veloce…"
          className="input-luxury resize-none py-2 text-base sm:text-[13px]"
          rows={3}
        />
        <button type="button" className="btn-primary h-11 text-[13px]" onClick={salvaNota} disabled={working || nota.trim() === ''}>
          {savingNota ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva
        </button>
      </div>

      {error && <p className="text-[12px] text-danger-mark">{error}</p>}

      {/* Rilevazioni di questa sessione */}
      {sessione.length > 0 && (
        <div>
          <p className="label-upper mb-2">Rilevato in questa sessione</p>
          <ul className="space-y-2">
            {sessione.map((c, i) => (
              <li key={i} className="card-luxury flex items-start gap-3 p-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok-mark" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider2 text-brand-600">{c.kind}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-ink">{c.testo}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-muted">
            Tutte le rilevazioni sono salvate nella knowledge base dell&apos;azienda (tab Knowledge base).
          </p>
        </div>
      )}
    </div>
  );
}
