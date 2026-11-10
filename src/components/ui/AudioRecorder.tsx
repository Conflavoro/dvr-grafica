'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

/**
 * Registratore audio IN-PIATTAFORMA che produce WAV (PCM 16-bit mono 16 kHz).
 *
 * PERCHE' WAV e non webm: MediaRecorder nel browser produce webm/opus, che i
 * modelli AI di trascrizione (Gemini via OpenRouter) NON accettano -> la voce non
 * verrebbe capita. Registrando via Web Audio API e codificando in WAV, l'audio e'
 * universalmente trascrivibile. 16 kHz mono = qualita' sufficiente per il parlato,
 * file piccolo. Funziona su desktop e mobile (richiede HTTPS, gia' garantito).
 *
 * SAFARI/WEBKIT — note implementative:
 * - AudioContext({ sampleRate }) puo' essere ignorato o generare eccezione su Safari
 *   <= 16: costruiamo SEMPRE senza opzioni e leggiamo ctx.sampleRate reale, poi
 *   effettuiamo il downsample in JS.
 * - Su iOS il context nasce in stato 'suspended'; bisogna chiamare ctx.resume()
 *   dentro il gestore click (gesto utente) prima di usare il nodo.
 * - webkitAudioContext fallback per Safari < 14.1 (prima che AudioContext fosse
 *   esposto senza prefisso).
 * - ScriptProcessorNode deve essere connesso a ctx.destination perche' alcuni
 *   WebKit non consegnano i dati al callback onaudioprocess se il grafo non
 *   raggiunge l'output. Usiamo un GainNode a volume 0 per evitare feedback.
 * - navigator.mediaDevices puo' essere undefined su contesti non-sicuri (HTTP) o
 *   browser molto vecchi: guard esplicito prima della chiamata.
 */
export const TARGET_RATE = 16000;

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** Downsample lineare da sampleRate sorgente a TARGET_RATE. */
export function downsample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate <= TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const outLen = Math.round(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = Math.floor(i * ratio);
    out[i] = input[idx];
  }
  return out;
}

/** Messaggio d'errore specifico per i casi getUserMedia piu' comuni su Safari. */
export function getUserMediaErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Permesso microfono negato. Vai in Impostazioni > Privacy > Microfono e consenti l\'accesso al browser.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'Nessun microfono trovato. Collega un microfono e riprova.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Il microfono e\' in uso da un\'altra applicazione. Chiudila e riprova.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'Configurazione audio non supportata da questo dispositivo.';
    }
  }
  return 'Microfono non accessibile. Controlla i permessi del browser e che il dispositivo abbia un microfono.';
}

export function AudioRecorder({
  onRecorded,
  disabled,
  size = 'lg',
}: {
  onRecorded: (file: File) => void | Promise<void>;
  disabled?: boolean;
  size?: 'lg' | 'sm';
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const rateRef = useRef<number>(44100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    procRef.current?.disconnect();
    srcRef.current?.disconnect();
    gainRef.current?.disconnect();
    procRef.current = null;
    srcRef.current = null;
    gainRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== 'closed') void ctxRef.current.close();
    ctxRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    if (disabled || state !== 'idle') return;
    setError(null);
    chunksRef.current = [];

    // Guard: navigator.mediaDevices assente su HTTP o browser non supportati.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Registrazione audio non supportata su questo browser o connessione non sicura (HTTPS richiesto).');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(getUserMediaErrorMessage(err));
      return;
    }

    streamRef.current = stream;

    // Safari/WebKit: usa webkitAudioContext se AudioContext non e' disponibile.
    // IMPORTANTE: NON passare sampleRate nel costruttore — Safari puo' ignorarlo
    // o lanciare; leggiamo invece ctx.sampleRate reale dopo la creazione.
    const AC: typeof AudioContext =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;

    if (!AC) {
      cleanup();
      setError('Web Audio API non supportata su questo browser.');
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      cleanup();
      setError('Impossibile inizializzare il contesto audio. Riprova.');
      return;
    }

    ctxRef.current = ctx;

    // iOS/Safari: il context nasce 'suspended'; resume() DEVE essere chiamato
    // all'interno del gestore del gesto utente (siamo gia' dentro il click).
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        cleanup();
        setError('Contesto audio bloccato. Tocca di nuovo il pulsante.');
        return;
      }
    }

    rateRef.current = ctx.sampleRate;

    const src = ctx.createMediaStreamSource(stream);
    srcRef.current = src;

    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;

    proc.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(ch));
    };

    // GainNode a volume 0: collega il grafo all'output affinche' Safari/WebKit
    // consegni i dati al callback onaudioprocess. Senza questa connessione alcuni
    // browser WebKit non invocano mai il callback.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    gainRef.current = silentGain;

    src.connect(proc);
    proc.connect(silentGain);
    silentGain.connect(ctx.destination);

    setState('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = async () => {
    if (state !== 'recording') return;
    const fromRate = rateRef.current;
    const chunks = chunksRef.current;
    cleanup();

    const total = chunks.reduce((n, c) => n + c.length, 0);

    // Blob vuoto: nessun campione acquisito (permesso revocato a meta', microfono
    // staccato, o contesto mai avviato su Safari). Mostra errore invece di caricare
    // un file WAV vuoto che l'AI non potrebbe trascrivere.
    if (total === 0) {
      setState('idle');
      setSeconds(0);
      setError('Nessun audio acquisito. Il microfono potrebbe essere stato bloccato durante la registrazione. Riprova.');
      return;
    }

    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }
    const down = downsample(merged, fromRate);
    const wav = encodeWav(down, TARGET_RATE);
    const file = new File([wav], `registrazione_${Date.now()}.wav`, { type: 'audio/wav' });

    setState('processing');
    try {
      await onRecorded(file);
    } catch {
      setError('Elaborazione audio non riuscita. Riprova.');
    } finally {
      setState('idle');
      setSeconds(0);
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (size === 'sm') {
    return (
      <span className="inline-flex flex-col">
        {state === 'recording' ? (
          <button type="button" onClick={() => void stop()} className="btn-ghost border-danger text-danger-mark">
            <Square size={14} /> Stop {mmss}
          </button>
        ) : state === 'processing' ? (
          <button type="button" disabled className="btn-ghost opacity-60">
            <Loader2 size={14} className="animate-spin" /> Trascrizione…
          </button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={disabled} className="btn-ghost">
            <Mic size={14} /> Registra
          </button>
        )}
        {error && <span className="mt-1 text-[11px] text-danger-mark">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col">
      {state === 'recording' ? (
        <button
          type="button"
          onClick={() => void stop()}
          className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-danger bg-danger text-danger-mark"
        >
          <span className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-mark opacity-60" />
            <Square size={22} className="relative" />
          </span>
          <span className="text-[13px] font-semibold">Stop · {mmss}</span>
        </button>
      ) : state === 'processing' ? (
        <div className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-[13px] font-semibold">Trascrizione…</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={disabled}
          className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-brand-200 bg-white text-brand-700 transition-colors hover:bg-brand-50 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <Mic size={26} />
          <span className="text-[13px] font-semibold">Registra audio</span>
        </button>
      )}
      {error && <span className="mt-2 text-[11px] leading-snug text-danger-mark">{error}</span>}
    </div>
  );
}
