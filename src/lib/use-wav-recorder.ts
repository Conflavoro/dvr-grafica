'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TARGET_RATE, downsample, encodeWav, getUserMediaErrorMessage } from '@/components/ui/AudioRecorder';

/**
 * Registrazione vocale senza interfaccia propria (per il compositore dell'agente).
 *
 * Stessa tecnica di AudioRecorder: Web Audio API -> WAV PCM 16 kHz mono, perche'
 * il webm/opus di MediaRecorder non e' accettato dai modelli di trascrizione.
 * Gestisce le particolarita' Safari/iOS (resume nel gesto, webkitAudioContext,
 * grafo collegato all'uscita con guadagno zero).
 */
export function useWavRecorder() {
  const [registrando, setRegistrando] = useState(false);
  const [secondi, setSecondi] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodiRef = useRef<AudioNode[]>([]);
  const chunksRef = useRef<Float32Array[]>([]);
  const rateRef = useRef(44100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulisci = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    nodiRef.current.forEach((n) => n.disconnect());
    nodiRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== 'closed') void ctxRef.current.close();
    ctxRef.current = null;
  }, []);

  useEffect(() => () => pulisci(), [pulisci]);

  /**
   * Avvia la registrazione. Con onSilenzio la dettatura si chiude da sola: dopo che l'utente ha
   * parlato, `silenzioMs` di silenzio chiamano onSilenzio (una volta). Tetto di 90 secondi.
   */
  const avvia = useCallback(async (opz: { onSilenzio?: () => void; silenzioMs?: number } = {}): Promise<boolean> => {
    setErrore(null);
    chunksRef.current = [];
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrore('Registrazione non supportata su questo browser o connessione non sicura (serve HTTPS).');
      return false;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErrore(getUserMediaErrorMessage(e));
      return false;
    }
    streamRef.current = stream;

    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) {
      pulisci();
      setErrore('Registrazione audio non supportata su questo browser.');
      return false;
    }
    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      pulisci();
      setErrore('Impossibile avviare il microfono. Riprova.');
      return false;
    }
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        pulisci();
        setErrore('Audio bloccato dal browser. Tocca di nuovo il microfono.');
        return false;
      }
    }
    rateRef.current = ctx.sampleRate;

    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const blocco = 4096 / ctx.sampleRate;
    const silenzioS = (opz.silenzioMs ?? 1500) / 1000;
    let tempo = 0;
    let fondo = 0;
    let campioniFondo = 0;
    let parlato = false;
    let zitto = 0;
    let chiuso = false;
    proc.onaudioprocess = (e) => {
      const dati = e.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(dati));
      if (!opz.onSilenzio || chiuso) return;
      tempo += blocco;
      let q = 0;
      for (let i = 0; i < dati.length; i++) q += dati[i] * dati[i];
      const rms = Math.sqrt(q / dati.length);
      // Primo terzo di secondo: rumore di fondo della stanza.
      if (tempo < 0.35) {
        fondo = (fondo * campioniFondo + rms) / (campioniFondo + 1);
        campioniFondo++;
        return;
      }
      const soglia = Math.max(0.012, fondo * 2.5);
      if (rms > soglia) {
        parlato = true;
        zitto = 0;
      } else if (parlato) {
        zitto += blocco;
      }
      if ((parlato && zitto >= silenzioS) || tempo >= 90) {
        chiuso = true;
        setTimeout(() => opz.onSilenzio?.(), 0);
      }
    };
    const muto = ctx.createGain();
    muto.gain.value = 0;
    src.connect(proc);
    proc.connect(muto);
    muto.connect(ctx.destination);
    nodiRef.current = [src, proc, muto];

    setRegistrando(true);
    setSecondi(0);
    timerRef.current = setInterval(() => setSecondi((s) => s + 1), 1000);
    return true;
  }, [pulisci]);

  /** Ferma e restituisce il file WAV, o null se non e' stato acquisito audio. */
  const ferma = useCallback((): File | null => {
    const chunks = chunksRef.current;
    const fromRate = rateRef.current;
    pulisci();
    setRegistrando(false);
    setSecondi(0);
    const totale = chunks.reduce((n, c) => n + c.length, 0);
    if (totale === 0) {
      setErrore('Nessun audio acquisito: il microfono potrebbe essere stato bloccato. Riprova.');
      return null;
    }
    const unito = new Float32Array(totale);
    let off = 0;
    for (const c of chunks) {
      unito.set(c, off);
      off += c.length;
    }
    const wav = encodeWav(downsample(unito, fromRate), TARGET_RATE);
    return new File([wav], `dettatura_${Date.now()}.wav`, { type: 'audio/wav' });
  }, [pulisci]);

  /** Interrompe senza produrre file. */
  const annulla = useCallback(() => {
    pulisci();
    setRegistrando(false);
    setSecondi(0);
  }, [pulisci]);

  return { registrando, secondi, errore, setErrore, avvia, ferma, annulla };
}
