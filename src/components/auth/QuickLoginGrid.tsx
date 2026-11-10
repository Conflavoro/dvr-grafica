'use client';

import { useRouter } from 'next/navigation';
import { ROLES, type Role } from '@/lib/mock-auth';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';

interface QuickLoginGridProps {
  className?: string;
}

const ROLE_DOTS: Record<Role, string> = {
  admin_conflavoro: 'bg-brand-900',
  titolare_studio: 'bg-brand-500',
  consulente: 'bg-oro-500',
  datore_lavoro: 'bg-ok-mark',
  utente_azienda: 'bg-cat-persone-segno',
};

/**
 * Griglia di 4 bottoni per quick-login demo (admin_conflavoro, titolare_studio,
 * consulente, datore_lavoro). Ogni clic auto-autentica con utente seed e
 * redirect alla home del ruolo.
 *
 * Funziona solo con MockDataSource (la `loginAs` di ApiDataSource lancia
 * errore). Sul deploy reale verso Laravel questa UI andra' nascosta o
 * rimossa: lasciamo il componente come scorciatoia demo.
 */
export function QuickLoginGrid({ className }: QuickLoginGridProps) {
  const router = useRouter();
  const ds = useDataSource();

  const handleClick = (role: Role): void => {
    void (async (): Promise<void> => {
      try {
        await ds.auth.loginAs(role);
        router.push(ROLES[role].homePath);
      } catch (err) {
        // In API mode loginAs lancia errore: log e basta, non rompere UI
        // (il bottone non dovrebbe nemmeno essere visibile in quel caso).
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn('[QuickLoginGrid] loginAs non supportato:', err);
        }
      }
    })();
  };

  // Nascondi del tutto il pannello in API mode: la quick-login non e'
  // utile contro un backend reale e potrebbe confondere gli utenti.
  if (ds.mode === 'api') {
    return null;
  }

  return (
    <div className={clsx('', className)}>
      <p className="mb-2 text-[13px] font-medium text-ink-soft">Accesso rapido alla dimostrazione</p>
      <ul className="divide-y divide-perla-linea border-y border-perla-linea">
        {Object.values(ROLES).map((cfg) => (
          <li key={cfg.role}>
            <button
              type="button"
              onClick={() => handleClick(cfg.role)}
              className="flex min-h-[52px] w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-perla-velo focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <span aria-hidden className={clsx('inline-block h-2 w-2 shrink-0 rounded-full', ROLE_DOTS[cfg.role])} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{cfg.label}</span>
                <span className="block truncate text-[12px] text-ink-muted">{cfg.shortDescription}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
