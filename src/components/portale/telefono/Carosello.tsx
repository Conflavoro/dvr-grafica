'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Carosello a scatto con puntini (M.carosello, 02): schede orizzontali, gap 12 px, margine
 * 20 px; larghezza della scheda indicata (86 % per "Da fare adesso", 46 % per i numeri).
 * I puntini si aggiornano scorrendo.
 */
export function Carosello({ larghezza = '86%', etichetta, children }: { larghezza?: string; etichetta: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const voci = Children.toArray(children);
  const [attivo, setAttivo] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => {
      const figli = Array.from(el.children) as HTMLElement[];
      if (!figli.length) return;
      const sinistra = el.scrollLeft;
      let migliore = 0;
      let distanza = Infinity;
      figli.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - el.offsetLeft - 20 - sinistra);
        if (d < distanza) {
          distanza = d;
          migliore = i;
        }
      });
      // In fondo l'ultima scheda può non arrivare al bordo: vale l'ultima.
      if (sinistra + el.clientWidth >= el.scrollWidth - 2) migliore = figli.length - 1;
      setAttivo(migliore);
    };
    el.addEventListener('scroll', f, { passive: true });
    return () => el.removeEventListener('scroll', f);
  }, []);

  return (
    <div>
      <div ref={box} className="carosello" role="region" aria-label={etichetta}>
        {voci.map((v, i) => (
          <div key={i} style={{ width: larghezza }}>
            {v}
          </div>
        ))}
      </div>
      {voci.length > 1 && (
        <div className="puntini" aria-hidden>
          {voci.map((_, i) => (
            <i key={i} data-on={i === attivo ? '' : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
