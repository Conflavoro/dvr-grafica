'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Mic, Square, X } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';
import { getDataSource } from '@/lib/data-source';

/**
 * Campo di testo con assistenza AI integrata: l'utente può scrivere a mano,
 * farsi assistere dall'AI ("Assisti con AI") oppure dettare a voce ("Detta").
 *
 * Riusabile su QUALSIASI campo lungo della piattaforma (note azienda, sezioni
 * DVR, descrizioni misure, ...). Mobile-first: i bottoni azione sono touch
 * friendly e la barra va a capo su schermi stretti.
 *
 * I dati passano sempre dal DataSource (`ds.ai.assist` / `ds.ai.transcribe`),
 * che in demo (localStorage) degrada con grazia e in produzione chiama il
 * backend Laravel (POST /ai/assist, POST /ai/transcribe).
 */
export interface AiAssistFieldProps {
  /** Valore corrente (controlled). */
  value: string;
  /** Notifica il nuovo valore al parent. */
  onChange: (value: string) => void;
  /**
   * Sezione/contesto logico inviato al backend per orientare il prompt
   * (es. 'azienda.note', 'dvr.sezione_c'). Stringa stabile e descrittiva.
   */
  sezione: string;
  /** Azienda di riferimento, per arricchire il contesto AI (RAG tenant-scoped). */
  companyId?: number;
  /** Etichetta sopra la textarea. */
  label?: string;
  placeholder?: string;
  rows?: number;
  /**
   * Istruzione predefinita usata quando l'utente clicca "Assisti con AI"
   * senza scrivere una richiesta. Se assente, viene chiesta una richiesta.
   */
  defaultIstruzione?: string;
  /** Disabilita l'intero campo (es. durante un submit). */
  disabled?: boolean;
  id?: string;
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export function AiAssistField({
  value,
  onChange,
  sezione,
  companyId,
  label,
  placeholder,
  rows = 5,
  defaultIstruzione,
  disabled,
  id,
}: AiAssistFieldProps) {
  const [assisting, setAssisting] = useState(false);
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [askingPrompt, setAskingPrompt] = useState(false);
  const [promptText, setPromptText] = useState('');

  // Disponibilità MediaRecorder: nasconde "Detta" dove non supportato (SSR-safe).
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => {
    setCanRecord(
      typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof window.MediaRecorder !== 'undefined'
    );
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Rilascia il microfono se il componente viene smontato durante una registrazione.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runAssist = useCallback(
    async (istruzione: string) => {
      setAssisting(true);
      setError(null);
      try {
        const res = await getDataSource().ai.assist({
          sezione,
          istruzione,
          contesto: value,
          companyId,
        });
        if (res.testo) {
          onChange(res.testo);
          setDisclaimer(res.disclaimer);
        } else {
          setError('L\'AI non ha prodotto testo. Riprova con una richiesta più specifica.');
        }
      } catch (e) {
        setError((e as Error)?.message || 'Assistenza AI non riuscita. Puoi scrivere a mano.');
      } finally {
        setAssisting(false);
      }
    },
    [sezione, value, companyId, onChange]
  );

  const handleAssistClick = () => {
    if (disabled || assisting) return;
    if (defaultIstruzione) {
      void runAssist(defaultIstruzione);
    } else {
      setPromptText('');
      setAskingPrompt(true);
    }
  };

  const submitPrompt = () => {
    const istruzione = promptText.trim();
    if (!istruzione) return;
    setAskingPrompt(false);
    void runAssist(istruzione);
  };

  const startRecording = async () => {
    if (disabled || recState !== 'idle') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size === 0) {
          setRecState('idle');
          return;
        }
        setRecState('transcribing');
        try {
          const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
          const file = new File([blob], `dettatura.${ext}`, { type: blob.type });
          const res = await getDataSource().ai.transcribe(file, {
            companyId,
            contesto: sezione,
          });
          if (res.testo) {
            const sep = value.trim().length > 0 ? `${value.trim()}\n\n` : '';
            onChange(`${sep}${res.testo}`);
          } else {
            // Il backend distingue "audio senza parlato" da "servizio giu'":
            // riportiamo il suo motivo, non un generico "non disponibile".
            setError(
              res.errore
                ? `${res.errore.charAt(0).toUpperCase()}${res.errore.slice(1)}. Riprova parlando piu' vicino al microfono, oppure scrivi a mano.`
                : 'Trascrizione non disponibile. Con il backend attivo, il parlato diventa testo.'
            );
          }
        } catch (e) {
          setError((e as Error)?.message || 'Trascrizione non riuscita. Riprova o scrivi a mano.');
        } finally {
          setRecState('idle');
        }
      };
      recorder.start();
      setRecState('recording');
    } catch {
      // Permesso negato o nessun microfono: messaggio gentile, niente crash.
      setError(
        'Non riesco ad accedere al microfono. Controlla i permessi del browser, oppure scrivi/usa "Assisti con AI".'
      );
      setRecState('idle');
    }
  };

  const stopRecording = () => {
    if (recState === 'recording' && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const busy = assisting || recState === 'transcribing';
  const textareaId = id ?? `ai-field-${sezione.replace(/[^a-z0-9]+/gi, '-')}`;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={textareaId} className="label-upper flex items-center gap-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled || busy}
          className="input-luxury min-h-[120px] resize-y rounded-2xl py-3 leading-relaxed"
          aria-busy={busy || undefined}
        />
        {recState === 'recording' && (
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider2 text-danger-mark">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger-mark" /> Registrazione
          </span>
        )}
      </div>

      {/* Barra azioni AI: bottoni grandi, touch-friendly, a capo su mobile. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAssistClick}
          disabled={disabled || busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
        >
          {assisting ? <Loader2 size={16} className="animate-spin" /> : <IconaAi size={16} />}
          {assisting ? 'Scrivo…' : 'Assisti con AI'}
        </button>

        {canRecord &&
          (recState === 'recording' ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-danger bg-danger px-4 py-2.5 text-[13px] font-semibold text-danger-ink transition active:scale-[0.98]"
            >
              <Square size={15} /> Ferma e trascrivi
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled || busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50"
            >
              {recState === 'transcribing' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Mic size={16} />
              )}
              {recState === 'transcribing' ? 'Trascrivo…' : 'Detta'}
            </button>
          ))}
      </div>

      {/* Mini-prompt inline: "cosa vuoi che scriva?" */}
      {askingPrompt && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider2 text-brand-800">
              Cosa vuoi che scriva?
            </span>
            <button
              type="button"
              onClick={() => setAskingPrompt(false)}
              className="text-brand-500 hover:text-brand-700"
              aria-label="Chiudi"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            autoFocus
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitPrompt();
            }}
            rows={2}
            placeholder="Es. Descrivi il ciclo lavorativo di un'officina meccanica con 8 addetti."
            className="input-luxury rounded-2xl py-3 text-[13px]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitPrompt}
              disabled={!promptText.trim()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-gradient px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              <IconaAi size={14} /> Genera testo
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-warn bg-warn/80 px-3.5 py-2.5 text-[12px] text-warn-ink"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {disclaimer && (
        <p className="flex items-start gap-1.5 text-[11px] text-ink-muted">
          <IconaAi size={13} className="mt-0.5 shrink-0 text-brand-500" />
          {disclaimer}
        </p>
      )}
    </div>
  );
}
