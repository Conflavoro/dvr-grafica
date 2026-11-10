'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, ChevronLeft } from 'lucide-react';
import type { User } from '@/lib/data-source';

interface TopbarProps {
  user: User;
  onOpenSidebar: () => void;
  pageTitle: string;
}

/**
 * Rotta "genitore" di una sotto-pagina: torna SEMPRE alla pagina principale della
 * sezione (es. /aziende/scheda -> /aziende, /dvr/nuovo -> /dvr, /lavoratori/importa
 * -> /lavoratori). Le pagine di primo livello (in sidebar) non hanno "indietro".
 */
function parentRoute(pathname: string): string | null {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  return `/${segs[0]}`;
}

export function Topbar({ user, onOpenSidebar, pageTitle }: TopbarProps) {
  const pathname = usePathname();
  const back = parentRoute(pathname ?? '');

  return (
    <header
      className="sticky top-0 z-20 border-b border-brand-100/60 bg-white/70 backdrop-blur-md"
      style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Apri menu"
          className="btn-icon h-11 w-11 shrink-0 lg:hidden"
        >
          <Menu size={18} />
        </button>

        {back && (
          <Link
            href={back}
            aria-label="Torna indietro"
            className="btn-icon shrink-0"
            title="Torna indietro"
          >
            <ChevronLeft size={20} />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] font-medium text-ink-muted">Conflavoro Agente HSE</p>
          <h1 className="truncate text-[19px] font-bold tracking-[-0.03em] leading-tight text-brand-900 sm:text-[22px]">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2 border-l border-brand-100 pl-2 sm:gap-3 sm:pl-3">
          <div className="hidden text-right sm:block">
            <p className="truncate text-[12px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[10px] uppercase tracking-wider2 text-ink-muted">
              {user.tenant_name}
            </p>
          </div>
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white text-[13px] font-bold uppercase"
          >
            {user.name
              .split(' ')
              .slice(0, 2)
              .map((s) => s[0])
              .join('')}
          </div>
        </div>
      </div>
    </header>
  );
}
