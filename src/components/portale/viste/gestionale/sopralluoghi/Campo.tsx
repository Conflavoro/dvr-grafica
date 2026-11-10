import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

/** Campo di modulo con etichetta e aiuto, per i fogli dei sopralluoghi. */
export function Campo({ etichetta, aiuto, children, className }: { etichetta: string; aiuto?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-soft">{etichetta}</span>
      {children}
      {aiuto && <span className="mt-1 block text-[12.5px] text-ink-muted">{aiuto}</span>}
    </label>
  );
}
