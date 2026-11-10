'use client';

import { Check, Circle, Loader2 } from '@/components/icone';
import type { AgentePianoVoce } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';

/** Piano di lavoro dell'agente come lista di attivita' con spunte. */
export function PianoLavoro({ passi, compatto = false }: { passi: AgentePianoVoce[]; compatto?: boolean }) {
  const fatti = passi.filter((p) => p.stato === 'fatto').length;
  return (
    <div>
      <p className={clsx('font-medium text-ink-soft', compatto ? 'text-[12px]' : 'text-[12.5px]')}>
        Piano di lavoro <span className="font-normal text-ink-muted">{fatti} di {passi.length} completati</span>
      </p>
      <ol className="mt-1 space-y-1">
        {passi.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              {p.stato === 'fatto' ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-mark text-white">
                  <Check size={11} strokeWidth={3} />
                </span>
              ) : p.stato === 'in_corso' ? (
                <Loader2 size={14} className="animate-spin text-brand-500 motion-reduce:animate-none" />
              ) : (
                <Circle size={13} className="text-ink-subtle" />
              )}
            </span>
            <span className={clsx('min-w-0', p.stato === 'fatto' ? 'text-ink-muted' : p.stato === 'in_corso' ? 'font-medium text-ink' : 'text-ink-soft')}>
              {p.testo}
              <span className="sr-only">
                {p.stato === 'fatto' ? ', fatto' : p.stato === 'in_corso' ? ', in corso' : ', da fare'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
