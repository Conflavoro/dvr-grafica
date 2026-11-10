'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconaComponente } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { GESTI, parteOrizzontale, rigaResta } from './gesti';
import { Mano } from './icone';

/**
 * Riga di elenco con azioni a scorrimento (M.riga, 02): trascinando verso sinistra compaiono
 * pulsanti larghi 78 px. Il trascinamento parte oltre 8 px e solo se è più orizzontale che
 * verticale; rilasciata oltre metà delle azioni resta aperta; una sola riga aperta per volta;
 * toccare altrove la chiude; un trascinamento non diventa un clic.
 */

export interface AzioneRiga {
  etichetta: string;
  icona: IconaComponente;
  /** Classi del fondo e del testo dell'azione (token: bg-acid-400 text-acid-950, bg-grafite-900 text-white...). */
  tono: string;
  onAzione: () => void;
}

let chiudiAperta: (() => void) | null = null;

export function RigaTrascinabile({
  inizio,
  titolo,
  sotto,
  stato,
  fine,
  azioni = [],
  onClick,
}: {
  inizio?: ReactNode;
  titolo: ReactNode;
  sotto?: ReactNode;
  /** Chip di stato: sul telefono va sotto il titolo, così il nome non si taglia. */
  stato?: ReactNode;
  fine?: ReactNode;
  azioni?: AzioneRiga[];
  onClick?: () => void;
}) {
  const fronte = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [trascina, setTrascina] = useState(false);
  const g = useRef<{ x0: number; y0: number; base: number; dir: boolean | null; mosso: boolean } | null>(null);
  const massimo = azioni.length * GESTI.rigaAzione;

  useEffect(() => {
    if (x === 0) return;
    const chiudi = () => setX(0);
    if (chiudiAperta && chiudiAperta !== chiudi) chiudiAperta();
    chiudiAperta = chiudi;
    const fuori = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setX(0);
    document.addEventListener('pointerdown', fuori);
    return () => {
      document.removeEventListener('pointerdown', fuori);
      if (chiudiAperta === chiudi) chiudiAperta = null;
    };
  }, [x]);

  const corpo = (
    <>
      {inizio}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-snug text-fg">{titolo}</span>
        {sotto && <span className="mt-0.5 block text-small text-fg-muted">{sotto}</span>}
        {stato && <span className="mt-1.5 flex flex-wrap gap-1.5">{stato}</span>}
      </span>
      {fine}
    </>
  );

  return (
    <div
      ref={box}
      className={clsx('swipe group/riga', trascina && 'trascina')}
      onPointerDown={(e) => {
        if (!azioni.length || e.pointerType === 'mouse') return;
        g.current = { x0: e.clientX, y0: e.clientY, base: x, dir: null, mosso: false };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s) return;
        const dx = e.clientX - s.x0;
        const dy = e.clientY - s.y0;
        if (s.dir === null) {
          if (parteOrizzontale(dx, dy)) {
            s.dir = true;
            setTrascina(true);
          } else if (Math.abs(dy) > GESTI.rigaSoglia) {
            g.current = null;
            return;
          } else return;
        }
        s.mosso = true;
        setX(Math.min(0, Math.max(-massimo, s.base + dx)));
      }}
      onPointerUp={() => {
        const s = g.current;
        g.current = null;
        setTrascina(false);
        if (s?.mosso) setX((v) => (rigaResta(v, azioni.length) ? -massimo : 0));
      }}
      onPointerCancel={() => {
        g.current = null;
        setTrascina(false);
        setX(0);
      }}
      onClickCapture={(e) => {
        // Un trascinamento non diventa un clic; con la riga aperta il tocco la chiude.
        if (x !== 0 && !(e.target as HTMLElement).closest('.swipe-azioni')) {
          e.stopPropagation();
          e.preventDefault();
          setX(0);
        }
      }}
    >
      {azioni.length > 0 && (
        <div className="swipe-azioni" aria-hidden={x === 0} style={x === 0 && !trascina ? { visibility: 'hidden' } : undefined}>
          {azioni.map((a) => (
            <button
              key={a.etichetta}
              type="button"
              tabIndex={x === 0 ? -1 : 0}
              className={a.tono}
              onClick={() => {
                setX(0);
                a.onAzione();
              }}
            >
              <a.icona size={20} aria-hidden />
              {a.etichetta}
            </button>
          ))}
        </div>
      )}
      <div ref={fronte} className="swipe-fronte border-b border-line group-last/riga:border-b-0" style={{ transform: x ? `translateX(${x}px)` : undefined }}>
        {onClick ? (
          <button type="button" onClick={onClick} className="tocco flex min-h-[60px] w-full items-center gap-3 px-4 py-3.5 text-left">
            {corpo}
          </button>
        ) : (
          <div className="flex min-h-[60px] items-center gap-3 px-4 py-3.5">{corpo}</div>
        )}
      </div>
    </div>
  );
}

/** Suggerimento del gesto sopra l'elenco, la prima volta (M.suggerimento). */
export function SuggerimentoGesto({ chiave, children }: { chiave: string; children: ReactNode }) {
  const [vista, setVista] = useState(true);
  useEffect(() => {
    try {
      const k = `portale_gesto_${chiave}`;
      if (window.localStorage.getItem(k)) setVista(false);
      else window.localStorage.setItem(k, '1');
    } catch {
      /* comodità del browser */
    }
  }, [chiave]);
  if (!vista) return null;
  return (
    <p className="mb-2 flex items-center gap-2 text-small text-fg-muted">
      <Mano size={18} aria-hidden />
      {children}
    </p>
  );
}
