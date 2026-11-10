'use client';

/**
 * Movimento della console con GSAP (SplitText e Flip), caricato a richiesta:
 * il primo caricamento della pagina non lo include. Con prefers-reduced-motion
 * non parte nulla e i contenuti restano fermi e visibili.
 */
type Motore = {
  gsap: typeof import('gsap').gsap;
  SplitText: typeof import('gsap/SplitText').SplitText;
  Flip: typeof import('gsap/Flip').Flip;
};

let promessa: Promise<Motore> | null = null;
let pronto: Motore | null = null;

export function caricaMovimento(): Promise<Motore> {
  if (!promessa) {
    promessa = Promise.all([import('gsap'), import('gsap/SplitText'), import('gsap/Flip')]).then(([g, s, f]) => {
      g.gsap.registerPlugin(s.SplitText, f.Flip);
      pronto = { gsap: g.gsap, SplitText: s.SplitText, Flip: f.Flip };
      return pronto;
    });
    promessa.catch(() => {
      promessa = null;
    });
  }
  return promessa;
}

/** Motore gia' caricato (o null): per le transizioni che devono partire subito. */
export function movimentoPronto(): Motore | null {
  return pronto;
}

export function movimentoRidotto(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Curve usate ovunque: uscita esponenziale, niente rimbalzi. */
export const CURVA = 'expo.out';
export const CURVA_MORBIDA = 'power3.out';
