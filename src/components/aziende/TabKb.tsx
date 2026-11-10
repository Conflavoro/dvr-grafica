'use client';

import { useCallback, useMemo, useState } from 'react';
import { AiAssistField } from '@/components/ai/AiAssistField';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { getDataSource, type Company } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { AudioRecorder } from '@/components/ui/AudioRecorder';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { BookOpen, Save, Trash2, Loader2, Camera } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

interface KbNote {
  testo: string;
  origine?: string;
  created_at?: string;
}

/**
 * Knowledge base PER-AZIENDA: il consulente raccoglie note di sopralluogo
 * (scritte o dettate) che diventano conoscenza specifica dell'azienda. Queste
 * note alimentano l'AI in fase di generazione DVR (companyContext lato backend).
 * Persistite in Company.settings.kb_notes. Permission-gated (datore read-only).
 */
export function TabKb({ company, onSaved }: { company: Company; onSaved?: () => void }) {
  const { user } = useAuth();
  const editable = can(user?.role, 'companies', 'update');

  const notes = useMemo<KbNote[]>(() => {
    const raw = company.settings?.kb_notes;
    return Array.isArray(raw) ? (raw as KbNote[]) : [];
  }, [company.settings]);

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const [media, setMedia] = useState<{ kind: 'foto' | 'vocale'; msg: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Lock unico: qualsiasi scrittura in corso disabilita TUTTE le azioni di scrittura,
  // cosi' due salvataggi non corrono in parallelo sullo stesso array kb_notes.
  const [working, setWorking] = useState(false);

  // Read-modify-write ATOMICO: rilegge i settings FRESCHI dal data source prima di
  // scrivere, cosi' due note ravvicinate non si sovrascrivono (no lost update).
  const persist = useCallback(
    async (mutate: (current: KbNote[]) => KbNote[]) => {
      const ds = getDataSource();
      const fresh = await ds.companies.get(company.id);
      const baseSettings = fresh?.settings ?? company.settings ?? {};
      const current = Array.isArray(baseSettings.kb_notes) ? (baseSettings.kb_notes as KbNote[]) : [];
      const settings = { ...baseSettings, kb_notes: mutate(current) };
      await ds.companies.update(company.id, { settings });
      onSaved?.();
    },
    [company.id, company.settings, onSaved]
  );

  const addNote = async () => {
    const testo = draft.trim();
    if (!testo || !editable || working) return;
    setSaving(true);
    setWorking(true);
    setError(null);
    try {
      const note: KbNote = { testo, origine: 'manuale', created_at: new Date().toISOString() };
      await persist((cur) => [...cur, note]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
      setWorking(false);
    }
  };

  // Foto/audio di sopralluogo: l'AI descrive (foto) o trascrive (audio), il testo
  // diventa subito una nota KB. Mobile-first (camera/microfono del dispositivo).
  const handleMedia = async (file: File | undefined, kind: 'foto' | 'vocale') => {
    if (!file || !editable || working) return;
    setWorking(true);
    setMedia({ kind, msg: kind === 'foto' ? 'Analisi foto in corso…' : 'Trascrizione in corso…' });
    setError(null);
    try {
      const ds = getDataSource();
      const res =
        kind === 'foto'
          ? await ds.ai.describeImage(file, { companyId: company.id })
          : await ds.ai.transcribe(file, { companyId: company.id });
      const testo = res.testo.trim();
      if (!testo) {
        const motivo = res.errore
          ? `${res.errore.charAt(0).toUpperCase()}${res.errore.slice(1)}.`
          : kind === 'foto'
            ? 'Descrizione foto non disponibile.'
            : 'Trascrizione non disponibile.';
        setMedia({ kind, msg: motivo });
        return;
      }
      const note: KbNote = { testo, origine: kind, created_at: new Date().toISOString() };
      await persist((cur) => [...cur, note]);
      setMedia({ kind, msg: kind === 'foto' ? 'Foto descritta e salvata nella KB.' : 'Audio trascritto e salvato nella KB.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Elaborazione media non riuscita.');
      setMedia(null);
    } finally {
      setWorking(false);
    }
  };

  const removeNote = async (note: KbNote, idx: number) => {
    if (working || !editable) return;
    if (!window.confirm('Eliminare questa nota dalla knowledge base?')) return;
    setDeletingIdx(idx);
    setWorking(true);
    try {
      // Elimina per identita' (testo + timestamp), robusto a riordino/refetch concorrenti.
      await persist((cur) => cur.filter((n) => !(n.testo === note.testo && n.created_at === note.created_at)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.');
    } finally {
      setDeletingIdx(null);
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      {cameraOpen && (
        <CameraCapture onCaptured={(file) => handleMedia(file, 'foto')} onClose={() => setCameraOpen(false)} />
      )}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4">
        <p className="flex items-center gap-2 text-[12px] text-ink-muted">
          <IconaAi size={14} className="text-brand-600" />
          Le note qui raccolte alimentano l&apos;AI quando genera il DVR di questa azienda: scrivi o detta osservazioni, esiti del sopralluogo, peculiarità del ciclo lavorativo.
        </p>
      </div>

      {/* Compositore nota (scrivi/detta + assistenza AI) */}
      {editable && (
        <div className="card-luxury p-5 space-y-3">
          <AiAssistField
            value={draft}
            onChange={setDraft}
            sezione="azienda.kb"
            companyId={company.id}
            label="Nuova nota di knowledge base"
            placeholder="Es. Il reparto stiratura usa mangani industriali a vapore; tre addette a turno; rilevata assenza di schermatura sul mangano 2…"
            rows={4}
            defaultIstruzione="Riformula in modo tecnico e sintetico questa osservazione di sopralluogo"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Foto: fotocamera IN-APP (anteprima + scatto), non upload */}
              <button type="button" disabled={working} onClick={() => setCameraOpen(true)} className={`btn-ghost ${working ? 'pointer-events-none opacity-50' : ''}`}>
                <Camera size={16} /> Foto
              </button>
              {/* Registrazione audio REALE in-piattaforma (MediaRecorder). */}
              <AudioRecorder size="sm" disabled={working} onRecorded={(file) => handleMedia(file, 'vocale')} />
              {media && (
                <span className="inline-flex items-center gap-1 text-[12px] text-brand-700">
                  {media.msg.endsWith('…') && <Loader2 size={13} className="animate-spin" />}
                  {media.msg}
                </span>
              )}
            </div>
            {error && <span className="text-[12px] text-danger-mark">{error}</span>}
            <button type="button" className="btn-primary" onClick={addNote} disabled={working || draft.trim() === ''}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva nella KB
            </button>
          </div>
        </div>
      )}

      {/* Lista note */}
      {notes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Knowledge base vuota"
          description={
            editable
              ? `Aggiungi la prima nota su ${company.ragione_sociale}: osservazioni di sopralluogo, foto descritte, peculiarità del ciclo. L'AI le userà per un DVR più aderente.`
              : `Le note di knowledge base di ${company.ragione_sociale} appariranno qui quando il consulente le avrà caricate.`
          }
        />
      ) : (
        <ul className="space-y-3">
          {notes
            .map((n, i) => ({ n, i }))
            .reverse()
            .map(({ n, i }) => (
              <li key={i} className="card-luxury p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{n.testo}</p>
                  {editable && (
                    <button
                      type="button"
                      className="btn-icon shrink-0 hover:text-danger-mark"
                      aria-label="Elimina nota"
                      disabled={working}
                      onClick={() => removeNote(n, i)}
                    >
                      {deletingIdx === i ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="neutral">{n.origine ?? 'manuale'}</Badge>
                  {n.created_at && (
                    <span className="text-[11px] text-ink-muted">{new Date(n.created_at).toLocaleDateString('it-IT')}</span>
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
