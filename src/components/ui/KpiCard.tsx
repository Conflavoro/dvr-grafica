import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean } | null;
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ label, value, delta, icon, className }: KpiCardProps) {
  return (
    <div className={clsx('card-luxury p-4', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-ink-muted">{label}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-[26px] font-bold leading-none tracking-tight text-ink">{value}</p>
            {delta && (
              <span className={clsx('text-[12px] font-semibold', delta.positive ? 'text-ok-mark' : 'text-danger-mark')}>
                {delta.positive ? '↑' : '↓'} {delta.value}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
