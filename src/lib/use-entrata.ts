'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { CURVA, caricaMovimento, movimentoRidotto } from './movimento';

/**
 * Coreografia d'ingresso di una vista, una sola volta per `chiave`:
 * - [data-titolo]: il testo si compone, righe in maschera e lettere che salgono (SplitText);
 * - [data-falco] e [data-scena]: il falco appare, l'orbita si disegna, la luce si accende;
 * - [data-entra]: blocchi che entrano a cascata.
 * Con prefers-reduced-motion, o se GSAP non arriva, tutto resta fermo e visibile.
 */
export function useEntrata(ref: RefObject<HTMLElement>, chiave: string | number, ritardo = 0): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || movimentoRidotto()) return;
    el.classList.add('js-gsap');
    let annullato = false;
    let pulisci: (() => void) | null = null;
    const riserva = window.setTimeout(() => el.classList.remove('js-gsap'), 1800);

    caricaMovimento()
      .then(async ({ gsap, SplitText }) => {
        try {
          await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
        } catch {
          /* font gia' pronti o non supportati */
        }
        if (annullato) return;
        window.clearTimeout(riserva);
        const ctx = gsap.context(() => {
          const tl = gsap.timeline({ delay: ritardo, defaults: { ease: CURVA } });
          const titoli = gsap.utils.toArray<HTMLElement>('[data-titolo]');
          titoli.forEach((t, i) => {
            const split = SplitText.create(t, { type: 'lines,words,chars', mask: 'lines' });
            // A fine corsa tolgo la divisione: niente maschere che tagliano le discendenti.
            tl.from(split.chars, { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.012, onComplete: () => split.revert() }, i === 0 ? 0.15 : '<0.12');
          });
          const falco = el.querySelector('[data-falco]');
          if (falco) tl.from(falco, { opacity: 0, y: 22, scale: 0.94, duration: 1.2, transformOrigin: '50% 90%' }, 0.05);
          el.querySelectorAll<SVGGeometryElement>('[data-scena="orbita"]').forEach((c) => {
            const len = typeof c.getTotalLength === 'function' ? c.getTotalLength() : 0;
            if (len > 0 && !c.getAttribute('stroke-dasharray')) {
              gsap.set(c, { strokeDasharray: len, strokeDashoffset: len });
              tl.to(c, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', onComplete: () => {
                gsap.set(c, { clearProps: 'strokeDasharray,strokeDashoffset' });
              } }, 0.1);
            } else tl.from(c, { opacity: 0, duration: 0.8 }, 0.3);
          });
          // Solo gli elementi presenti: un elenco vuoto fa scrivere a GSAP un avviso in console.
          const daAnimare = (sel: string, vars: Record<string, unknown>, pos: number) => {
            const n = el.querySelectorAll(sel);
            if (n.length) tl.from(n, vars, pos);
          };
          daAnimare('[data-scena="arco"]', { opacity: 0, duration: 0.6 }, 0.9);
          daAnimare('[data-scena="luce"], [data-scena="ombra"]', { opacity: 0, duration: 1 }, 0.1);
          daAnimare('[data-scena="disco"]', { opacity: 0, scaleX: 0.7, transformOrigin: '50% 50%', duration: 0.9 }, 0.2);
          const blocchi = gsap.utils.toArray<HTMLElement>('[data-entra]');
          if (blocchi.length) {
            tl.fromTo(blocchi, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.85, stagger: 0.05, clearProps: 'transform' }, titoli.length ? 0.45 : 0.1);
          }
          tl.add(() => el.classList.remove('js-gsap'), 0);
        }, el);
        pulisci = () => ctx.revert();
      })
      .catch(() => el.classList.remove('js-gsap'));

    return () => {
      annullato = true;
      window.clearTimeout(riserva);
      pulisci?.();
      el.classList.remove('js-gsap');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);
}
