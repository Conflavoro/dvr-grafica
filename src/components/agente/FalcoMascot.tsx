'use client';

import { percorso } from '@/lib/percorso';
import { useEffect, useRef, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { ascoltaBocca, type Apertura } from '@/lib/falco-bocca';

/**
 * Stati del falco. 'attenzione' e 'fatto' sono reazioni brevi: il falco le
 * recita una volta (attenzione, poi fatto se la clip esiste) e poi avvisa con
 * onReazioneFinita, cosi' la pagina torna a riposo.
 */
export type FalcoStato = 'riposo' | 'ascolta' | 'pensa' | 'parla' | 'attenzione' | 'fatto';

export interface FalcoMascotProps {
  stato: FalcoStato;
  /** Lato in pixel (default 64). */
  size?: number;
  className?: string;
  /** Click o tap sul falco (es. avvia la dettatura). Se presente il falco diventa un pulsante. */
  onAttiva?: () => void;
  /** Etichetta accessibile del pulsante (default "Parla con Falco"). */
  etichettaAttiva?: string;
  /** Chiamata quando una reazione (attenzione/fatto) e' terminata. */
  onReazioneFinita?: () => void;
  /**
   * 'cerchio' (default): ritaglio rotondo. 'busto': nessun cerchio, il corpo
   * sfuma verso il basso e si posa sul basamento della scena (FalcoPalco).
   */
  ritaglio?: 'cerchio' | 'busto';
  /** data-flip-id per le transizioni Flip tra le viste (apertura, conversazione, azienda). */
  flipId?: string;
}

/**
 * Avatar video del falco Conflavoro, vivo e autonomo.
 *
 * - Clip in /brand/falco/<nome>.webm (VP9) con ripiego .mp4 (H.264), 720x720,
 *   5 s, prima e ultima immagine uguali.
 * - Riposo mai identico: a fine clip ('ended', loop spento) sceglie a caso la
 *   variante successiva (riposo 50%, le altre tre si dividono il resto, mai due
 *   speciali di fila). Il secondo video e' gia' precaricato, quindi lo stacco e'
 *   invisibile. Ascolta, pensa e parla girano in loop; i cambi di stato usano
 *   una dissolvenza di 300 ms.
 * - Segue leggermente il puntatore (max 6 gradi, con easing) solo con puntatore
 *   fine e senza prefers-reduced-motion. In background i video vanno in pausa.
 * - prefers-reduced-motion o lato < 96 px: solo il poster (sotto i 96 px
 *   ritagliato sulla testa). Clip mancante: poster. Poster mancante: marchio svg.
 */
type Clip = 'riposo' | 'riposo2' | 'riposo3' | 'riposo4' | 'ascolta' | 'pensa' | 'parla' | 'attenzione' | 'fatto';

// Cartella nuova a ogni cambio di aspetto: i browser non ripescano le clip vecchie dalla cache.
const BASE = percorso('/brand/falco-acido');
const POSTER = `${BASE}/avatar.webp`;
const MARCHIO = percorso('/brand/falco-mark.svg');
const SOGLIA_VIDEO = 96;
const DISSOLVENZA_MS = 300;
const INCLINAZIONE_MAX = 6;
/** Riserva per le reazioni se la clip non parte (rete lenta, clip assente). */
const REAZIONE_MAX_MS = 7000;
const REAZIONE_STATICA_MS = 1800;

const VARIANTI_SPECIALI: Clip[] = ['riposo2', 'riposo3', 'riposo4'];
const isRiposo = (c: Clip | null) => c === 'riposo' || (c != null && VARIANTI_SPECIALI.includes(c));

const ETICHETTA: Record<FalcoStato, string> = {
  riposo: 'in attesa',
  ascolta: 'in ascolto',
  pensa: 'sta ragionando',
  parla: 'sta parlando',
  attenzione: 'ha notato qualcosa da controllare',
  fatto: 'ha finito',
};

/** Prossima variante di riposo: dopo una speciale torna sempre al riposo base. */
export function prossimoRiposo(prec: Clip | null, caso: number = Math.random()): Clip {
  if (prec != null && prec !== 'riposo' && isRiposo(prec)) return 'riposo';
  if (caso < 0.5) return 'riposo';
  return VARIANTI_SPECIALI[Math.min(2, Math.floor((caso - 0.5) / (0.5 / 3)))];
}

const MASCHERA = 'radial-gradient(closest-side, #000 78%, rgba(0,0,0,0.6) 90%, transparent 100%)';
/** Busto: il fondo delle clip e' bianco (sparisce col multiply), si sfuma solo il taglio in basso. */
const MASCHERA_BUSTO = 'radial-gradient(ellipse 54% 58% at 50% 43%, #000 74%, rgba(0,0,0,0.55) 88%, transparent 100%)';
/** Il fondo delle clip ha una lieve vignettatura grigia: la riporto al bianco per il multiply. */
const SCHIARITA = 'brightness(1.035) contrast(1.02)';

export function FalcoMascot({
  stato,
  size = 64,
  className,
  onAttiva,
  etichettaAttiva = 'Parla con Falco',
  onReazioneFinita,
  ritaglio = 'cerchio',
  flipId,
}: FalcoMascotProps) {
  const maschera = ritaglio === 'busto' && size >= SOGLIA_VIDEO ? MASCHERA_BUSTO : MASCHERA;
  const [ridotto, setRidotto] = useState(false);
  const [puntatoreFine, setPuntatoreFine] = useState(false);
  const [posterOk, setPosterOk] = useState(true);
  const [videoInVista, setVideoInVista] = useState(false);

  const conVideo = size >= SOGLIA_VIDEO && !ridotto;
  const piccolo = size < SOGLIA_VIDEO;

  const box = useRef<HTMLSpanElement>(null);
  const inclina = useRef<HTMLSpanElement>(null);
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);

  // Motore delle clip: tutto in ref, manipolato direttamente sui <video>.
  const m = useRef({
    attivo: 0 as 0 | 1,
    clip: [null, null] as [Clip | null, Clip | null],
    pronto: [false, false] as [boolean, boolean],
    mancanti: new Set<Clip>(),
    stato: stato as FalcoStato,
    attesa: null as null | { clip: Clip; loop: boolean; dissolvenza: boolean },
    timerPrecarica: 0 as number | ReturnType<typeof setTimeout>,
    timerReazione: 0 as number | ReturnType<typeof setTimeout>,
  });
  const fineReazioneRef = useRef(onReazioneFinita);
  fineReazioneRef.current = onReazioneFinita;

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
      setRidotto(mq.matches);
      setPuntatoreFine(fine.matches);
      const a = (e: MediaQueryListEvent) => setRidotto(e.matches);
      const b = (e: MediaQueryListEvent) => setPuntatoreFine(e.matches);
      mq.addEventListener?.('change', a);
      fine.addEventListener?.('change', b);
      return () => {
        mq.removeEventListener?.('change', a);
        fine.removeEventListener?.('change', b);
      };
    } catch {
      return undefined;
    }
  }, []);

  const video = (i: 0 | 1) => (i === 0 ? refA.current : refB.current);

  const carica = (i: 0 | 1, clip: Clip) => {
    const s = m.current;
    const v = video(i);
    if (!v || s.mancanti.has(clip) || s.clip[i] === clip) return;
    s.clip[i] = clip;
    s.pronto[i] = false;
    v.pause();
    v.removeAttribute('src');
    while (v.firstChild) v.removeChild(v.firstChild);
    for (const [ext, type] of [
      ['webm', 'video/webm'],
      ['mp4', 'video/mp4'],
    ] as const) {
      const src = document.createElement('source');
      src.src = `${BASE}/${clip}.${ext}`;
      src.type = type;
      v.appendChild(src);
    }
    // L'errore dell'ultima <source> = nessun formato disponibile: clip mancante.
    (v.lastChild as HTMLSourceElement).addEventListener('error', () => {
      s.mancanti.add(clip);
      if (s.clip[i] === clip) s.clip[i] = null;
      if (s.attesa?.clip === clip) {
        s.attesa = null;
        clipMancante(clip);
      }
    });
    v.load();
  };

  /** Clip successiva da tenere pronta sul video nascosto. */
  const prossima = (attuale: Clip): Clip => {
    const s = m.current;
    if (isRiposo(attuale)) return prossimoRiposo(attuale);
    if (attuale === 'attenzione') return s.mancanti.has('fatto') ? 'riposo' : 'fatto';
    if (attuale === 'ascolta') return 'pensa';
    if (attuale === 'pensa') return 'parla';
    return 'riposo';
  };

  const mostra = (i: 0 | 1, loop: boolean, dissolvenza: boolean) => {
    const s = m.current;
    const v = video(i);
    const altro = video(i === 0 ? 1 : 0);
    if (!v) return;
    v.loop = loop;
    try {
      v.currentTime = 0;
    } catch {
      /* non ancora posizionabile */
    }
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
    const durata = dissolvenza ? `${DISSOLVENZA_MS}ms` : '0ms';
    v.style.transitionDuration = durata;
    v.style.opacity = '1';
    if (altro) {
      altro.style.transitionDuration = durata;
      altro.style.opacity = '0';
    }
    s.attivo = i;
    setVideoInVista(true);
    clearTimeout(s.timerPrecarica);
    s.timerPrecarica = setTimeout(() => {
      const dietro: 0 | 1 = s.attivo === 0 ? 1 : 0;
      video(dietro)?.pause();
      const c = s.clip[s.attivo];
      if (c) carica(dietro, prossima(c));
    }, (dissolvenza ? DISSOLVENZA_MS : 0) + 60);
  };

  const vaiA = (clip: Clip, loop: boolean, dissolvenza: boolean) => {
    const s = m.current;
    if (s.mancanti.has(clip)) {
      clipMancante(clip);
      return;
    }
    const davanti = s.attivo;
    const dietro: 0 | 1 = davanti === 0 ? 1 : 0;
    // Primo avvio: nessuna clip davanti, uso direttamente il livello attivo.
    const bersaglio: 0 | 1 = s.clip[davanti] === null && !videoInVistaRef.current ? davanti : dietro;
    if (s.clip[bersaglio] === clip && s.pronto[bersaglio]) {
      s.attesa = null;
      mostra(bersaglio, loop, dissolvenza);
      return;
    }
    s.attesa = { clip, loop, dissolvenza };
    carica(bersaglio, clip);
  };

  const finisciReazione = () => {
    const s = m.current;
    clearTimeout(s.timerReazione);
    fineReazioneRef.current?.();
    if (s.stato === 'attenzione' || s.stato === 'fatto') {
      s.stato = 'riposo';
      vaiA('riposo', false, true);
    }
  };

  function clipMancante(clip: Clip) {
    const s = m.current;
    if (clip === 'fatto' || (clip === 'attenzione' && s.stato === 'attenzione')) {
      if (clip === 'attenzione' && !s.mancanti.has('fatto')) {
        vaiA('fatto', false, true);
        return;
      }
      finisciReazione();
      return;
    }
    if (isRiposo(clip) && clip !== 'riposo') {
      vaiA('riposo', false, false);
      return;
    }
    // Clip di stato assente: resta quello che c'e', altrimenti il poster.
    if (s.clip[s.attivo] === null) {
      setVideoInVista(false);
    }
  }

  const videoInVistaRef = useRef(false);
  videoInVistaRef.current = videoInVista;

  const pronto = (i: 0 | 1) => {
    const s = m.current;
    s.pronto[i] = true;
    if (s.attesa && s.clip[i] === s.attesa.clip && (i !== s.attivo || !videoInVistaRef.current)) {
      const { loop, dissolvenza } = s.attesa;
      s.attesa = null;
      mostra(i, loop, dissolvenza && videoInVistaRef.current);
    }
  };

  const finita = (i: 0 | 1) => {
    const s = m.current;
    if (i !== s.attivo) return;
    const c = s.clip[i];
    if (c === 'attenzione') {
      if (s.mancanti.has('fatto')) finisciReazione();
      else {
        s.stato = 'fatto';
        vaiA('fatto', false, true);
      }
      return;
    }
    if (c === 'fatto') {
      finisciReazione();
      return;
    }
    // Riposo: passo alla variante gia' pronta sull'altro video, senza dissolvenza.
    const dietro: 0 | 1 = i === 0 ? 1 : 0;
    const succ = s.clip[dietro];
    if (succ && isRiposo(succ) && s.pronto[dietro]) mostra(dietro, false, false);
    else mostra(i, false, false);
  };

  // Cambio di stato richiesto dalla pagina.
  useEffect(() => {
    const s = m.current;
    const prec = s.stato;
    s.stato = stato;
    clearTimeout(s.timerReazione);
    if (!conVideo) {
      if (stato === 'attenzione' || stato === 'fatto') {
        s.timerReazione = setTimeout(() => fineReazioneRef.current?.(), REAZIONE_STATICA_MS);
      }
      return;
    }
    const attuale = s.clip[s.attivo];
    if (stato === 'riposo') {
      if (!isRiposo(attuale) || !videoInVistaRef.current) vaiA('riposo', false, videoInVistaRef.current);
    } else if (stato === 'attenzione' || stato === 'fatto') {
      vaiA(stato, false, true);
      s.timerReazione = setTimeout(finisciReazione, REAZIONE_MAX_MS);
    } else if (attuale !== stato || prec !== stato || !videoInVistaRef.current) {
      vaiA(stato, true, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato, conVideo]);

  // Pausa quando la pagina va in background.
  useEffect(() => {
    if (!conVideo) return;
    const onVis = () => {
      const v = video(m.current.attivo);
      if (document.hidden) {
        refA.current?.pause();
        refB.current?.pause();
      } else if (v && videoInVistaRef.current) {
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [conVideo]);

  useEffect(
    () => () => {
      clearTimeout(m.current.timerPrecarica);
      clearTimeout(m.current.timerReazione);
    },
    []
  );

  // Il falco segue il puntatore: easing verso l'obiettivo, rAF solo finche' serve.
  useEffect(() => {
    if (ridotto || !puntatoreFine || size < SOGLIA_VIDEO) {
      if (inclina.current) inclina.current.style.transform = '';
      return;
    }
    let obX = 0;
    let obY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const passo = () => {
      x += (obX - x) * 0.12;
      y += (obY - y) * 0.12;
      if (inclina.current) inclina.current.style.transform = `perspective(700px) rotateX(${y.toFixed(2)}deg) rotateY(${x.toFixed(2)}deg)`;
      raf = Math.abs(obX - x) > 0.05 || Math.abs(obY - y) > 0.05 ? requestAnimationFrame(passo) : 0;
    };
    const muovi = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / Math.max(window.innerWidth / 2, 1);
      const dy = (e.clientY - (r.top + r.height / 2)) / Math.max(window.innerHeight / 2, 1);
      obX = Math.max(-1, Math.min(1, dx)) * INCLINAZIONE_MAX;
      obY = Math.max(-1, Math.min(1, -dy)) * INCLINAZIONE_MAX;
      if (!raf) raf = requestAnimationFrame(passo);
    };
    const esci = () => {
      obX = 0;
      obY = 0;
      if (!raf) raf = requestAnimationFrame(passo);
    };
    window.addEventListener('pointermove', muovi, { passive: true });
    document.addEventListener('pointerleave', esci);
    return () => {
      window.removeEventListener('pointermove', muovi);
      document.removeEventListener('pointerleave', esci);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ridotto, puntatoreFine, size]);

  const contenuto = (
    <span ref={inclina} className="absolute inset-0 block will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
      {posterOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={POSTER}
          alt=""
          aria-hidden
          draggable={false}
          width={size}
          height={size}
          onError={() => setPosterOk(false)}
          className={clsx('absolute inset-0 h-full w-full select-none object-cover', piccolo ? 'object-top' : 'object-center')}
          style={{
            WebkitMaskImage: maschera,
            maskImage: maschera,
            filter: ritaglio === 'busto' ? SCHIARITA : undefined,
            transform: piccolo ? 'scale(1.6)' : undefined,
            transformOrigin: '50% 12%',
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={MARCHIO}
          alt=""
          aria-hidden
          draggable={false}
          width={size}
          height={size}
          className={clsx('absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-300', videoInVista && 'opacity-0')}
        />
      )}
      {conVideo &&
        ([0, 1] as const).map((i) => (
          <video
            key={i}
            ref={i === 0 ? refA : refB}
            muted
            playsInline
            preload="auto"
            aria-hidden
            tabIndex={-1}
            disablePictureInPicture
            poster={posterOk ? POSTER : undefined}
            onCanPlay={() => pronto(i)}
            onEnded={() => finita(i)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity ease-out"
            style={{ opacity: 0, transitionDuration: `${DISSOLVENZA_MS}ms`, WebkitMaskImage: maschera, maskImage: maschera, filter: ritaglio === 'busto' ? SCHIARITA : undefined }}
          />
        ))}
      {posterOk && (
        <FalcoBocca
          attiva={stato === 'parla'}
          maschera={maschera}
          filtro={ritaglio === 'busto' ? SCHIARITA : undefined}
          piccolo={piccolo}
          size={size}
          ridotto={ridotto}
        />
      )}
    </span>
  );

  const stile = { width: size, height: size, mixBlendMode: 'multiply' as const };

  if (onAttiva) {
    return (
      <button
        type="button"
        onClick={onAttiva}
        aria-label={etichettaAttiva}
        title={etichettaAttiva}
        data-stato={stato}
        data-falco=""
        data-flip-id={flipId}
        className={clsx(
          'relative inline-flex shrink-0 items-center justify-center',
          ritaglio === 'cerchio' ? 'rounded-full' : 'rounded-[28%]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          className
        )}
        style={stile}
      >
        <span ref={box} className={clsx('absolute inset-0 block overflow-hidden', ritaglio === 'cerchio' && 'rounded-full')}>
          {contenuto}
        </span>
        <span className="sr-only">Falco, {ETICHETTA[stato]}</span>
      </button>
    );
  }

  return (
    <span
      ref={box}
      role="img"
      aria-label={`Falco, ${ETICHETTA[stato]}`}
      data-stato={stato}
      data-falco=""
      data-flip-id={flipId}
      className={clsx('relative inline-flex shrink-0 items-center justify-center overflow-hidden', className)}
      style={stile}
    >
      {contenuto}
    </span>
  );
}

const FOTOGRAMMI = ['chiuso', 'b1', 'b2', 'blink'] as const;

/**
 * Il falco che parla: ritratto fermo con il becco che si apre a tempo con la
 * voce (livello da lib/falco-bocca) e un battito di ciglia ogni tanto. Sta
 * sopra le clip video e compare solo mentre parla.
 */
function FalcoBocca({
  attiva,
  maschera,
  filtro,
  piccolo,
  size,
  ridotto,
}: {
  attiva: boolean;
  maschera: string;
  filtro?: string;
  piccolo: boolean;
  size: number;
  ridotto: boolean;
}) {
  const [apertura, setApertura] = useState<Apertura>(0);
  const [blink, setBlink] = useState(false);
  useEffect(() => ascoltaBocca(setApertura), []);
  useEffect(() => {
    if (!attiva || ridotto) return;
    let t: ReturnType<typeof setTimeout>;
    const giro = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          giro();
        }, 140);
      }, 2600 + Math.random() * 3200);
    };
    giro();
    return () => clearTimeout(t);
  }, [attiva, ridotto]);

  const visibile: (typeof FOTOGRAMMI)[number] = blink && apertura === 0 ? 'blink' : apertura === 2 ? 'b2' : apertura === 1 ? 'b1' : 'chiuso';
  // Il capo accompagna la voce: un movimento minimo, mai continuo.
  const testa = !ridotto && attiva ? `translateY(${apertura * -0.35}%) rotate(${apertura === 2 ? -0.6 : apertura === 1 ? -0.25 : 0}deg)` : undefined;
  return (
    <span
      aria-hidden
      data-bocca={attiva ? visibile : 'spenta'}
      className="pointer-events-none absolute inset-0 block transition-opacity duration-200 ease-out motion-reduce:transition-none"
      style={{ opacity: attiva ? 1 : 0 }}
    >
      <span className="absolute inset-0 block transition-transform duration-100 ease-out" style={{ transform: testa, transformOrigin: '50% 70%' }}>
        {FOTOGRAMMI.map((k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={`${BASE}/bocca/${k}.webp`}
            alt=""
            draggable={false}
            width={size}
            height={size}
            className={clsx('absolute inset-0 h-full w-full select-none object-cover', piccolo ? 'object-top' : 'object-center')}
            style={{
              opacity: k === visibile ? 1 : 0,
              WebkitMaskImage: maschera,
              maskImage: maschera,
              filter: filtro,
              transform: piccolo ? 'scale(1.6)' : undefined,
              transformOrigin: '50% 12%',
            }}
          />
        ))}
      </span>
    </span>
  );
}
