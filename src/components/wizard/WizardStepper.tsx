'use client';

import { Check } from 'lucide-react';
import { clsx } from '@/lib/clsx';

export interface WizardStepDef {
  key: string;
  label: string;
  description?: string;
}

interface WizardStepperProps {
  steps: WizardStepDef[];
  current: number;
  completed: Set<number>;
  onJump: (index: number) => void;
}

export function WizardStepper({ steps, current, completed, onJump }: WizardStepperProps) {
  return (
    <ol className="grid gap-2 lg:grid-cols-7">
      {steps.map((s, i) => {
        const done = completed.has(i);
        const active = i === current;
        const reachable = done || i <= current;
        return (
          <li key={s.key}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(i)}
              className={clsx(
                'group flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                active
                  ? 'border-brand-500 bg-brand-100/70 shadow-luxury-sm'
                  : done
                    ? 'border-ok bg-ok/60 hover:border-ok-mark'
                    : 'border-brand-100 bg-white/60 hover:border-brand-300',
                !reachable && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                    active && 'bg-brand-500 text-white',
                    done && !active && 'bg-ok-mark text-white',
                    !done && !active && 'bg-brand-100 text-brand-700'
                  )}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider2 text-ink">
                  {s.label}
                </span>
              </div>
              {s.description && (
                <span className="text-[10px] text-ink-muted line-clamp-2">{s.description}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
