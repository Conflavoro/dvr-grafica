'use client';

import { percorso } from '@/lib/percorso';
import Image from 'next/image';
import { useState } from 'react';
import { clsx } from '@/lib/clsx';

interface LogoProps {
  variant: 'cai' | 'icon-ai';
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Logo brand cliccabile con animazione bounce.
 * - `cai`: logo testuale blu notte (login screen)
 * - `icon-ai`: icona blu notte compatta (sidebar)
 */
export function Logo({ variant, size, className, alt }: LogoProps) {
  const [bouncing, setBouncing] = useState(false);
  const src = percorso(variant === 'cai' ? '/brand/cai-navy.svg' : '/brand/icon-ai-navy.svg');

  // Aspect ratio approx: cai 339x76 ~ 4.47, icon-ai 123x76 ~ 1.62
  const aspect = variant === 'cai' ? 339.81 / 76.15 : 123.28 / 76.15;
  const w = size ?? (variant === 'cai' ? 280 : 56);
  const h = w / aspect;

  // Tap target WCAG 2.5.5: garantiamo min 44x44 anche per logo "icon-ai" piccoli (h~35px).
  // L'immagine resta delle proporzioni native, ma il button cresce con padding implicito
  // tramite min-h/min-w. Per `cai` (login) la dimensione naturale è gia' >>44px, no-op.
  const minSide = 44;

  return (
    <button
      type="button"
      aria-label={alt ?? (variant === 'cai' ? 'Conflavoro AI' : 'AI logo')}
      onClick={() => {
        setBouncing(false);
        // Force re-trigger animation
        requestAnimationFrame(() => setBouncing(true));
        setTimeout(() => setBouncing(false), 650);
      }}
      className={clsx(
        'logo-clickable inline-flex items-center justify-center',
        bouncing && 'animate-logo-bounce',
        className
      )}
      style={{ minWidth: minSide, minHeight: minSide }}
    >
      <Image
        src={src}
        alt={alt ?? 'Conflavoro AI'}
        width={w}
        height={h}
        priority={variant === 'cai'}
        style={{ width: w, height: h }}
        className="block"
      />
    </button>
  );
}
