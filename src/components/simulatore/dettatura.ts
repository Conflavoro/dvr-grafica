'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dettatura della pagina pubblica: riconoscimento vocale del browser (niente
 * server, niente accesso). Dove il browser non lo offre il microfono non compare.
 */

interface Riconoscimento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function costruttore(): (new () => Riconoscimento) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Riconoscimento; webkitSpeechRecognition?: new () => Riconoscimento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function usaDettatura(onTesto: (t: string) => void) {
  const [disponibile, setDisponibile] = useState(false);
  const [ascolta, setAscolta] = useState(false);
  const [parziale, setParziale] = useState('');
  const rec = useRef<Riconoscimento | null>(null);
  const finale = useRef('');
  const cb = useRef(onTesto);
  cb.current = onTesto;

  useEffect(() => setDisponibile(costruttore() !== null), []);

  const avvia = useCallback(() => {
    const C = costruttore();
    if (!C) return;
    const r = new C();
    r.lang = 'it-IT';
    r.interimResults = true;
    r.continuous = false;
    finale.current = '';
    r.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      finale.current = t;
      setParziale(t);
    };
    r.onend = () => {
      setAscolta(false);
      const t = finale.current.trim();
      setParziale('');
      if (t) cb.current(t);
    };
    r.onerror = () => setAscolta(false);
    rec.current = r;
    setAscolta(true);
    try {
      r.start();
    } catch {
      setAscolta(false);
    }
  }, []);

  const ferma = useCallback(() => rec.current?.stop(), []);

  return { disponibile, ascolta, parziale, avvia, ferma };
}
