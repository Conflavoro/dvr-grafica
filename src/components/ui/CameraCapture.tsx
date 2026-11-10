'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, Loader2, Upload } from 'lucide-react';

/**
 * Fotocamera IN-PIATTAFORMA (getUserMedia): anteprima live a tutto schermo, scatto
 * con otturatore, cambio fotocamera (posteriore/anteriore su mobile). Allo scatto
 * produce un File JPEG -> onCaptured. Mobile-first. Fallback all'upload se la
 * fotocamera non e' disponibile o il permesso e' negato.
 *
 * SAFARI/WEBKIT — note implementative:
 * - navigator.mediaDevices puo' essere undefined su HTTP o browser molto vecchi:
 *   guard esplicito prima della chiamata, fallback immediato a upload.
 * - NotAllowedError / NotFoundError: messaggi specifici invece di catch generico.
 * - video.play() puo' essere rifiutato da Safari (policy autoplay); catturiamo
 *   l'errore separatamente per distinguerlo da errori di stream.
 * - playsInline: attributo obbligatorio su iOS per evitare che il video vada
 *   a schermo intero automaticamente (gia' presente nel JSX).
 */

/** Messaggio d'errore specifico per i casi getUserMedia piu' comuni su Safari. */
function getVideoErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Permesso fotocamera negato. Vai in Impostazioni > Privacy > Fotocamera e consenti l\'accesso al browser.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'Nessuna fotocamera trovata su questo dispositivo.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'La fotocamera e\' in uso da un\'altra applicazione. Chiudila e riprova.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'La fotocamera selezionata non e\' disponibile. Prova a cambiare fotocamera.';
    }
  }
  return 'Fotocamera non accessibile. Controlla i permessi del browser oppure carica una foto.';
}

export function CameraCapture({
  onCaptured,
  onClose,
}: {
  onCaptured: (file: File) => void | Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    setReady(false);

    // Guard: navigator.mediaDevices assente su HTTP o browser non supportati.
    // In questo caso mostriamo subito il fallback upload invece di crashare.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Accesso alla fotocamera non supportato su questo browser o connessione non sicura (HTTPS richiesto). Carica una foto dal dispositivo.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
    } catch (err) {
      setError(getVideoErrorMessage(err));
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        // Safari puo' rifiutare play() se la policy autoplay e' restrittiva.
        // Catturiamo l'errore separatamente: lo stream e' valido, ma serve
        // un ulteriore gesto utente per avviare la riproduzione.
        await videoRef.current.play();
        setReady(true);
      } catch {
        // Se play() fallisce lo stream e' comunque attivo; riproviamo al click
        // dell'utente (che costituisce un gesto esplicito). Per ora segnaliamo.
        setError('Anteprima fotocamera bloccata. Tocca il pulsante "Scatta" per scattare direttamente, oppure carica una foto.');
      }
    }
  }, [facing, stop]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || busy) return;

    // Se la preview non e' ready (es. play() fallito su Safari), proviamo comunque
    // a leggere il frame; videoWidth/videoHeight potrebbero essere 0 -> usiamo
    // dimensioni di fallback ragionevoli.
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas non disponibile su questo browser.');
        setBusy(false);
        return;
      }
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
      if (!blob) {
        setError('Impossibile catturare l\'immagine. Riprova o carica una foto.');
        setBusy(false);
        return;
      }
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stop();
      await onCaptured(file);
      onClose();
    } catch {
      setError('Errore durante la cattura della foto. Riprova o carica un file.');
    } finally {
      setBusy(false);
    }
  };

  const onFallbackFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onCaptured(file);
      onClose();
    } catch {
      setError('Caricamento non riuscito. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div
        className="flex items-center justify-between px-4 text-white"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))', paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))', paddingBottom: '0.75rem' }}
      >
        <button type="button" onClick={() => { stop(); onClose(); }} aria-label="Chiudi" className="flex h-11 w-11 items-center justify-center rounded-full transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10">
          <X size={22} />
        </button>
        <span className="text-[13px] font-semibold uppercase tracking-wider2">Scatta foto</span>
        {!error ? (
          <button type="button" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Cambia fotocamera" className="flex h-11 w-11 items-center justify-center rounded-full transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/10">
            <RefreshCw size={20} />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
            <Camera size={40} className="opacity-70" />
            <p className="max-w-xs text-[14px]">{error}</p>
            <label className="btn-primary cursor-pointer">
              <Upload size={16} /> Carica una foto
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { void onFallbackFile(e.target.files?.[0]); }} />
            </label>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 size={28} className="animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {!error && (
        <div
          className="flex items-center justify-center py-6"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={shoot}
            disabled={busy}
            aria-label="Scatta"
            className="flex items-center justify-center rounded-full border-4 border-white bg-white/20 p-1 disabled:opacity-50 active:scale-95 transition-transform"
            style={{ height: 72, width: 72 }}
          >
            {busy ? <Loader2 size={28} className="animate-spin text-white" /> : <span className="h-14 w-14 rounded-full bg-white" />}
          </button>
        </div>
      )}
    </div>
  );
}
