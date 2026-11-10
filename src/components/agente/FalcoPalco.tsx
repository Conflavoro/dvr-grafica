'use client';

import { useId } from 'react';
import { clsx } from '@/lib/clsx';
import { FalcoMascot, type FalcoMascotProps, type FalcoStato } from './FalcoMascot';

/**
 * Il falco in scena come un prodotto: luce dall'alto, un'orbita sottile con
 * un arco d'oro, un basamento a disco con il bordo dorato e un'ombra morbida.
 * L'alone dorato pulsa solo quando parla.
 *
 * Il falco ha fondo bianco e si fonde col perla in multiply: nessun antenato
 * crea un contesto di impilamento (niente transform, filter, opacity o z-index
 * sul contenitore). Le animazioni GSAP toccano solo [data-falco] e i pezzi
 * della scena, mai il contenitore.
 */
const ALONE: Record<FalcoStato, number> = {
  riposo: 0,
  ascolta: 0.35,
  pensa: 0.22,
  parla: 1,
  attenzione: 0.18,
  fatto: 0.5,
};

export function FalcoPalco({
  stato,
  size,
  compatto = false,
  className,
  flipId = 'falco',
  scuro = false,
  ...resto
}: Omit<FalcoMascotProps, 'ritaglio'> & { size: number; compatto?: boolean; scuro?: boolean }) {
  const w = Math.round(size * (compatto ? 1.1 : 1.5));
  const cx = w / 2;
  const cy = size * 0.52;
  const r = size * (compatto ? 0.5 : 0.6);
  const disco = size * 0.95;
  const h = Math.round(compatto ? size * 1.04 : size * 1.13);
  const discoY = size * 0.93;
  // Arco d'oro sull'orbita: da 200 a 262 gradi (in alto a sinistra), si accende quando parla o ha finito.
  const a0 = (200 * Math.PI) / 180;
  const a1 = (262 * Math.PI) / 180;
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const idLuce = `disco${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const acceso = stato === 'parla' || stato === 'fatto' || stato === 'ascolta';
  if (scuro) return <PalcoScuro stato={stato} size={size} className={className} flipId={flipId} {...resto} />;

  return (
    <div className={clsx('relative shrink-0', className)} style={{ width: w, height: h }} data-stato={stato} data-palco="">
      {/* Luce dall'alto */}
      <span
        aria-hidden
        data-scena="luce"
        className="pointer-events-none absolute rounded-full"
        style={{ left: cx - size * 0.75, top: -size * 0.12, width: size * 1.5, height: size * 1.2, background: 'radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0) 100%)' }}
      />
      <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <circle data-scena="orbita" cx={cx} cy={cy} r={r} stroke="#18181b" strokeOpacity={compatto ? 0.1 : 0.12} strokeWidth={1} />
        {!compatto && <circle data-scena="orbita" cx={cx} cy={cy} r={r * 1.13} stroke="#18181b" strokeOpacity={0.06} strokeWidth={1} strokeDasharray="1 5" />}
        <path
          data-scena="arco"
          d={`M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`}
          stroke="#677f02"
          strokeOpacity={acceso ? 1 : 0.65}
          strokeWidth={compatto ? 1.5 : 2}
          strokeLinecap="round"
          style={{ transition: 'stroke-opacity 400ms ease-out' }}
        />
        <circle data-scena="arco" cx={p1[0]} cy={p1[1]} r={compatto ? 2 : 2.75} fill="#677f02" />
        {!compatto && (
          <>
            {/* Basamento: disco chiaro con spessore e bordo dorato davanti. */}
            <ellipse data-scena="disco" cx={cx} cy={discoY + 6} rx={disco / 2} ry={size * 0.085} fill="#e2e2e5" />
            <ellipse data-scena="disco" cx={cx} cy={discoY} rx={disco / 2} ry={size * 0.085} fill={`url(#${idLuce})`} stroke="rgba(14,14,16,0.10)" />
            <path data-scena="disco" d={`M ${cx - disco / 2 + 6} ${discoY + 3} A ${disco / 2} ${size * 0.085} 0 0 0 ${cx + disco / 2 - 6} ${discoY + 3}`} stroke="#677f02" strokeWidth={1.25} strokeOpacity={0.9} />
            <defs>
              <linearGradient id={idLuce} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#f4f4f5" />
              </linearGradient>
            </defs>
          </>
        )}
      </svg>

      {/* Ombra morbida sotto il busto */}
      <span
        aria-hidden
        data-scena="ombra"
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          left: cx - size * 0.36,
          top: (compatto ? size * 0.9 : discoY) - size * 0.05,
          width: size * 0.72,
          height: size * 0.1,
          background: 'radial-gradient(closest-side, rgba(14,14,16,0.24), rgba(14,14,16,0) 100%)',
        }}
      />

      {/* Alone dorato: tenue negli stati attivi, pulsa solo mentre parla. */}
      <span aria-hidden className="pointer-events-none absolute" style={{ left: cx - size * 0.5, top: size * 0.06, width: size, height: size }}>
        <span
          className={clsx('block h-full w-full rounded-full transition-opacity duration-500 ease-out', stato === 'parla' && 'animate-alone')}
          style={{ opacity: ALONE[stato], background: 'radial-gradient(closest-side, rgba(212,255,58,0.6), rgba(212,255,58,0.16) 55%, rgba(212,255,58,0) 100%)' }}
        />
      </span>

      {/* Posizione in pixel, niente transform: il multiply deve vedere il perla e l'alone. */}
      <span className="absolute top-0 block" style={{ left: (w - size) / 2, width: size, height: size }}>
        <FalcoMascot stato={stato} size={size} ritaglio="busto" flipId={flipId} {...resto} />
      </span>
    </div>
  );
}

/**
 * Il falco sul nero del Portale HSE: un disco bianco (il fondo delle clip si
 * fonde col bianco), un'orbita sottile e un arco acido che si accende quando
 * ascolta, parla o ha finito; un alone acido pulsa solo mentre parla.
 */
function PalcoScuro({ stato, size, className, flipId, ...resto }: Omit<FalcoMascotProps, 'ritaglio'> & { size: number }) {
  const pad = Math.round(size * 0.14);
  const w = size + pad * 2;
  const c = w / 2;
  const r = size / 2 + pad * 0.55;
  const a0 = (200 * Math.PI) / 180;
  const a1 = (275 * Math.PI) / 180;
  const p0 = [c + r * Math.cos(a0), c + r * Math.sin(a0)];
  const p1 = [c + r * Math.cos(a1), c + r * Math.sin(a1)];
  const acceso = stato === 'parla' || stato === 'fatto' || stato === 'ascolta';
  return (
    <div className={clsx('relative shrink-0', className)} style={{ width: w, height: w }} data-stato={stato} data-palco="">
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className={clsx('block h-full w-full rounded-full transition-opacity duration-500 ease-out', stato === 'parla' && 'animate-alone')}
          style={{ opacity: ALONE[stato], background: 'radial-gradient(closest-side, rgba(212,255,58,0.55), rgba(212,255,58,0.12) 70%, rgba(212,255,58,0) 100%)' }}
        />
      </span>
      <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={w} viewBox={`0 0 ${w} ${w}`} fill="none">
        <circle data-scena="orbita" cx={c} cy={c} r={r} stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1} />
        <path
          data-scena="arco"
          d={`M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`}
          stroke="#d4ff3a"
          strokeOpacity={acceso ? 1 : 0.55}
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transition: 'stroke-opacity 400ms ease-out' }}
        />
        <circle data-scena="arco" cx={p1[0]} cy={p1[1]} r={3.25} fill="#d4ff3a" />
      </svg>
      {/* Disco bianco e falco nello stesso contesto: il multiply vede il bianco. */}
      <span aria-hidden className="absolute block rounded-full bg-white" style={{ left: pad, top: pad, width: size, height: size }} />
      <span className="absolute block" style={{ left: pad, top: pad, width: size, height: size }}>
        <FalcoMascot stato={stato} size={size} ritaglio="cerchio" flipId={flipId} {...resto} />
      </span>
    </div>
  );
}
