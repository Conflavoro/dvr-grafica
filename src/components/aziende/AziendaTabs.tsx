'use client';

import { useState, type ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

export interface TabDef {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  /** Etichetta di gruppo: tab con lo stesso gruppo restano vicini, separati dagli altri. */
  group?: string;
}

interface AziendaTabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Navigazione a PILLOLE con icone, raggruppate. Un sottile separatore divide i
 * gruppi logici (Azienda · Organico · Sopralluogo & KB · DVR). Scroll orizzontale
 * su mobile, attiva = viola pieno.
 */
export function AziendaTabs({ tabs, active, onChange }: AziendaTabsProps) {
  return (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav className="flex items-center gap-1.5 min-w-max" aria-label="Sezioni azienda">
        {tabs.map((t, i) => {
          const isActive = t.key === active;
          const newGroup = i > 0 && tabs[i - 1].group !== t.group;
          return (
            <div key={t.key} className="flex items-center gap-1.5">
              {newGroup && <span className="mx-1 h-5 w-px bg-brand-100" aria-hidden />}
              <button
                type="button"
                onClick={() => onChange(t.key)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] lg:min-h-0 font-semibold whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-brand-gradient text-white shadow-luxury-sm'
                    : 'text-ink-muted hover:text-ink hover:bg-brand-50'
                )}
              >
                {t.icon && <span className={isActive ? 'text-white' : 'text-brand-500'}>{t.icon}</span>}
                <span>{t.label}</span>
                {typeof t.count === 'number' && (
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      isActive ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function useAziendaTab(defaultTab: string): [string, (key: string) => void] {
  const [active, setActive] = useState(defaultTab);
  return [active, setActive];
}
