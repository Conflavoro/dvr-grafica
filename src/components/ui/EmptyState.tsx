import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'card-luxury flex flex-col items-center justify-center py-16 px-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100/80 text-brand-600">
          {icon}
        </div>
      )}
      <h3 className="section-title text-[17px] text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-[14px] text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
