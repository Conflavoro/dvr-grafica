import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

type Variant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'risk-low'
  | 'risk-medium'
  | 'risk-high'
  | 'risk-critical';

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

const STYLES: Record<Variant, string> = {
  neutral: 'bg-grafite-100 text-grafite-700 border-grafite-200',
  brand: 'bg-brand-100 text-brand-700 border-brand-200',
  success: 'bg-ok text-ok-ink border-ok',
  warning: 'bg-warn text-warn-ink border-warn',
  danger: 'bg-danger text-danger-ink border-danger',
  info: 'bg-brand-50 text-brand-700 border-brand-200',
  'risk-low': 'bg-ok text-ok-ink border-ok',
  'risk-medium': 'bg-warn text-warn-ink border-warn',
  'risk-high': 'bg-danger text-danger-ink border-danger',
  'risk-critical': 'bg-danger text-danger-ink border-danger-mark',
};

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider2',
        STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
