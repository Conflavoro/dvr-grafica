'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * Gesti dell'app per telefono (08 §B): soglie della specifica come costanti, così le prove le
 * controllano. Le funzioni pure decidono; gli hook collegano il dito agli elementi.
 */
export const GESTI = {
  /** Riga trascinabile: il trascinamento parte oltre 8 px in orizzontale (e più che in verticale). */
  rigaSoglia: 8,
  /** Larghezza di ogni azione sotto la riga. */
  rigaAzione: 78,
  /** Indietro dal bordo: si parte nei primi 24 px, la pagina segue il dito al 60 %, oltre 90 px si torna. */
  bordo: 24,
  bordoSegue: 0.6,
  bordoSoglia: 90,
  /** Foglio: trascinando la maniglia giù di oltre 110 px si chiude. */
  foglioSoglia: 110,
} as const;

/** La riga resta aperta se rilasciata oltre metà della larghezza delle azioni. */
export function rigaResta(spostamento: number, nAzioni: number): boolean {
  return -spostamento > (nAzioni * GESTI.rigaAzione) / 2;
}

/** Il trascinamento orizzontale parte solo se supera la soglia ed è più ampio di quello verticale. */
export function parteOrizzontale(dx: number, dy: number): boolean {
  return Math.abs(dx) > GESTI.rigaSoglia && Math.abs(dx) > Math.abs(dy);
}

export function chiudeFoglio(dy: number): boolean {
  return dy > GESTI.foglioSoglia;
}

export function tornaDalBordo(inizioX: number, dx: number): boolean {
  return inizioX <= GESTI.bordo && dx > GESTI.bordoSoglia;
}

const ridotto = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Maniglia di un foglio: trascinandola giù il foglio segue il dito; oltre 110 px si chiude,
 * altrimenti torna su. Restituisce i gestori da mettere sulla maniglia.
 */
export function useManiglia(foglio: RefObject<HTMLElement | null>, onChiudi: () => void) {
  const inizio = useRef<number | null>(null);
  const dy = useRef(0);
  const giu = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    inizio.current = e.clientY;
    dy.current = 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    foglio.current?.classList.add('trascina');
  }, [foglio]);
  const muovi = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (inizio.current === null || !foglio.current) return;
    dy.current = Math.max(0, e.clientY - inizio.current);
    foglio.current.style.transform = `translateY(${dy.current}px)`;
  }, [foglio]);
  const su = useCallback(() => {
    if (inizio.current === null) return;
    inizio.current = null;
    const el = foglio.current;
    if (el) {
      el.classList.remove('trascina');
      el.style.transform = '';
    }
    if (chiudeFoglio(dy.current)) onChiudi();
    dy.current = 0;
  }, [foglio, onChiudi]);
  return { onPointerDown: giu, onPointerMove: muovi, onPointerUp: su, onPointerCancel: su };
}

/**
 * Indietro col gesto: in una pagina interna, trascinando dal bordo sinistro la pagina segue
 * il dito al 60 %; oltre 90 px si torna indietro. Solo tocco (non mouse).
 */
export function useIndietroBordo(pagina: RefObject<HTMLElement | null>, attivo: boolean, onIndietro: () => void) {
  useEffect(() => {
    const el = pagina.current;
    if (!attivo || !el) return;
    let x0: number | null = null;
    let y0 = 0;
    let dx = 0;
    let orizzontale: boolean | null = null;
    const inizio = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || t.clientX > GESTI.bordo) return;
      x0 = t.clientX;
      y0 = t.clientY;
      dx = 0;
      orizzontale = null;
    };
    const muovi = (e: TouchEvent) => {
      const t = e.touches[0];
      if (x0 === null || !t) return;
      dx = t.clientX - x0;
      if (orizzontale === null && (Math.abs(dx) > 6 || Math.abs(t.clientY - y0) > 6)) orizzontale = Math.abs(dx) > Math.abs(t.clientY - y0);
      if (!orizzontale) return;
      if (!ridotto()) {
        el.style.transition = 'none';
        el.style.transform = `translateX(${Math.max(0, dx) * GESTI.bordoSegue}px)`;
      }
    };
    const fine = () => {
      if (x0 === null) return;
      const torna = orizzontale === true && tornaDalBordo(x0, dx);
      x0 = null;
      el.style.transition = 'transform 260ms var(--ease-snap)';
      el.style.transform = '';
      if (torna) onIndietro();
    };
    el.addEventListener('touchstart', inizio, { passive: true });
    el.addEventListener('touchmove', muovi, { passive: true });
    el.addEventListener('touchend', fine);
    el.addEventListener('touchcancel', fine);
    return () => {
      el.removeEventListener('touchstart', inizio);
      el.removeEventListener('touchmove', muovi);
      el.removeEventListener('touchend', fine);
      el.removeEventListener('touchcancel', fine);
    };
  }, [pagina, attivo, onIndietro]);
}
