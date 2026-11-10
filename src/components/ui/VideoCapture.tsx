'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Video, Square, Loader2, Upload, RefreshCw } from 'lucide-react';

/**
 * Acquisizione video IN-PIATTAFORMA tramite MediaRecorder (getUserMedia video+audio).
 * Mostra l'anteprima live durante la registrazione; al termine produce un File WebM/MP4
 * e chiama onCaptured. Fallback a upload file se getUserMedia non e' disponibile.
 *
 * Mobile-first: su mobile usa il pulsante capture="camcorder" dell'input come
 * via alternativa rapida. Stile coerente con CameraCapture.tsx.
 *
 * SAFARI/WEBKIT — note implementative:
 * - navigator.mediaDevices puo' essere undefined su HTTP o browser non supportati:
 *   guard esplicito prima della chiamata, fallback immediato a upload.
 * - NotAllowedError / NotFoundError / NotReadableError: messaggi specifici.
 * - video.play() su iOS puo' essere rifiutato da policy autoplay; catturiamo
 *   l'errore separatamente per non bloccare il flusso.
 * - playsInline: obbligatorio su iOS (gia' presente nel JSX).
 * - MediaRecorder: assente su Safari iOS < 17.4; guard typeof gia' presente.
 *   MediaRecorder.isTypeSupported: chiamata solo dopo il guard typeof, quindi sicura.
 *   Su Safari 14.1+ il formato supportato e' 'video/mp4' (non webm): la logica
 *   di selezione mimeType gestisce questo caso con fallback a stringa vuota.
 */

/** Messaggio d'errore specifico per i casi getUserMedia piu' comuni su Safari. */
function getVideoErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Permesso fotocamera/microfono negato. Vai in Impostazioni > Privacy e consenti l\'accesso al browser.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'Nessuna fotocamera o microfono trovato su questo dispositivo.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'La fotocamera o il microfono sono in uso da un\'altra applicazione. Chiudila e riprova.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'La fotocamera selezionata non e\' disponibile. Prova a cambiare fotocamera.';
    }
  }
  return 'Fotocamera/microfono non accessibili. Controlla i permessi del browser oppure carica un video.';
}

export function VideoCapture({
  onCaptured,
  onClose,
}: {
  onCaptured: (file: File) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<'idle' | 'preview' | 'recording' | 'processing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecorder = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPreview = useCallback(async () => {
    stopStream();
    stopRecorder();
    clearTimer();
    setError(null);
    setSeconds(0);
    chunksRef.current = [];

    // Guard: navigator.mediaDevices assente su HTTP o browser non supportati.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Accesso alla fotocamera non supportato su questo browser o connessione non sicura (HTTPS richiesto).');
      setState('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
    } catch (err) {
      setError(getVideoErrorMessage(err));
      setState('error');
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        // Safari puo' rifiutare play() per policy autoplay; catturiamo separatamente.
        await videoRef.current.play();
      } catch {
        // Lo stream e' attivo ma la riproduzione visiva e' bloccata. Su iOS il video
        // parte comunque al primo gesto utente; andiamo avanti in stato preview.
        // L'utente potra' comunque avviare la registrazione.
      }
    }
    setState('preview');
  }, [facing, stopStream, stopRecorder, clearTimer]);

  useEffect(() => {
    void startPreview();
    return () => {
      stopStream();
      stopRecorder();
      clearTimer();
    };
  }, [startPreview, stopStream, stopRecorder, clearTimer]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || state !== 'preview') return;

    // Safari iOS < 17.4 / vecchi browser: MediaRecorder assente -> non crashare,
    // proponi l'upload di un file video (che apre la videocamera nativa su mobile).
    if (typeof MediaRecorder === 'undefined') {
      stopStream();
      setError('La registrazione in-app non e\' supportata su questo browser. Usa "Carica un video" (si apre la videocamera).');
      setState('error');
      return;
    }

    // Selezione mimeType: webm su Chrome/Firefox, mp4 su Safari 14.1+.
    // isTypeSupported e' definita solo se MediaRecorder lo e' (guard sopra garantisce
    // che siamo nel ramo sicuro). Gestiamo il caso in cui il metodo stesso mancasse
    // (browser molto vecchi con MediaRecorder parziale) con un fallback a stringa vuota.
    let mimeType = '';
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        // Safari 14.1+: supporta mp4 via MediaRecorder.
        mimeType = 'video/mp4';
      }
      // Se nessuno e' supportato, lasciamo mimeType = '' e il browser scegliera'
      // il proprio formato di default.
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      // Il mimeType selezionato non e' accettato: ritenta senza vincoli.
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        setError('Impossibile avviare la registrazione su questo browser. Prova a caricare un file video.');
        setState('error');
        return;
      }
    }

    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setState('processing');
      clearTimer();
      stopStream();

      // Determina il tipo effettivo del blob dai chunk: se il recorder ha usato un
      // formato diverso da quello richiesto (puo' succedere su Safari), lo rileva.
      const effectiveMime = chunksRef.current[0]?.type || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: effectiveMime });
      const ext = effectiveMime.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `video_sopralluogo_${Date.now()}.${ext}`, {
        type: effectiveMime,
      });
      try {
        await onCaptured(file);
        onClose();
      } catch {
        setState('error');
        setError('Elaborazione video non riuscita. Riprova o carica un file.');
      }
    };

    recorder.onerror = () => {
      clearTimer();
      setState('error');
      setError('Registrazione interrotta con errore. Riprova o carica un file video.');
    };

    recorder.start(250); // chunk ogni 250ms
    recorderRef.current = recorder;
    setState('recording');

    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    clearTimer();
    stopRecorder();
    // onstop gestira' il resto
  };

  const onFallbackFile = async (file: File | undefined) => {
    if (!file) return;
    setState('processing');
    try {
      await onCaptured(file);
      onClose();
    } catch {
      setState('error');
      setError('Caricamento non riuscito. Riprova.');
    }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isError = state === 'error';
  const isPreview = state === 'preview';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 text-white"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))', paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))', paddingBottom: '0.75rem' }}
      >
        <button
          type="button"
          onClick={() => { stopStream(); stopRecorder(); clearTimer(); onClose(); }}
          aria-label="Chiudi"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
          disabled={isProcessing}
        >
          <X size={22} />
        </button>

        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-mark">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger-mark" />
              {formatTime(seconds)}
            </span>
          )}
          {!isRecording && !isError && (
            <span className="text-[13px] font-semibold uppercase tracking-wider2">
              {isProcessing ? 'Elaborazione…' : 'Registra video'}
            </span>
          )}
          {isError && (
            <span className="text-[13px] font-semibold text-danger-mark uppercase tracking-wider2">Errore</span>
          )}
        </div>

        {/* Cambio fotocamera (solo anteprima) */}
        {isPreview ? (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            aria-label="Cambia fotocamera"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10"
          >
            <RefreshCw size={20} />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>

      {/* Corpo */}
      <div className="relative flex-1 overflow-hidden">
        {isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
            <Video size={40} className="opacity-70" />
            <p className="max-w-xs text-[14px]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn-primary"
                onClick={() => { void startPreview(); }}
              >
                <RefreshCw size={16} /> Riprova fotocamera
              </button>
              <label className="btn-ghost cursor-pointer text-white border-white/30 hover:bg-white/10">
                <Upload size={16} /> Carica un video
                {/* capture="environment" apre direttamente la camera video su mobile */}
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { void onFallbackFile(e.target.files?.[0]); }}
                />
              </label>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <Loader2 size={40} className="animate-spin" />
            <p className="text-[14px]">Elaborazione video…</p>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {state === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 size={28} className="animate-spin" />
              </div>
            )}
            {/* Overlay REC */}
            {isRecording && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[12px] text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger-mark" />
                REC {formatTime(seconds)}
              </div>
            )}
            {/* Avviso GDPR persistente: il video di sopralluogo non deve contenere PII.
                L'analisi avviene su fotogrammi ed e' comunque da verificare dall'RSPP. */}
            {(isPreview || isRecording) && (
              <div className="absolute bottom-4 left-1/2 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-black/55 px-4 py-2.5 text-center text-[11.5px] leading-snug text-white/90">
                Riprendi ambienti, macchine e postazioni. <strong>Non inquadrare volti, nomi, badge o targhe</strong> (GDPR). I fotogrammi sono analizzati dall&apos;AI: l&apos;esito va verificato dall&apos;RSPP.
              </div>
            )}
          </>
        )}
      </div>

      {/* Controlli */}
      {!isError && !isProcessing && (
        <div
          className="flex flex-col items-center gap-3 py-6"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {isPreview && (
            <button
              type="button"
              onClick={startRecording}
              disabled={!isPreview}
              aria-label="Inizia registrazione"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-danger-mark bg-danger-mark/20 transition active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-danger-mark/30 disabled:opacity-50"
            >
              <Video size={28} className="text-danger-mark" />
            </button>
          )}
          {isRecording && (
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Ferma registrazione"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-danger-mark bg-danger-mark/60 transition active:scale-95 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-danger-mark/70"
            >
              <Square size={24} className="fill-white text-white" />
            </button>
          )}
          <p className="text-[12px] text-white/60">
            {isPreview ? 'Premi per iniziare la registrazione' : 'Premi per fermare'}
          </p>
          {/* Alternativa: upload rapido file video */}
          {isPreview && (
            <label className="cursor-pointer py-2 px-4 text-[12px] text-white/50 underline underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white/80">
              oppure carica un file video
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { void onFallbackFile(e.target.files?.[0]); }}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
