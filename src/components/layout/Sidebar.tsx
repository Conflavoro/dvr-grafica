'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/auth/Logo';
import { Icon } from '@/components/ui/Icon';
import { ROLES } from '@/lib/mock-auth';
import { useDataSource } from '@/lib/use-data-source';
import type { User } from '@/lib/data-source';
import { LogOut, X } from 'lucide-react';
import { clsx } from '@/lib/clsx';

interface SidebarProps {
  user: User;
  /** Callback per chiudere drawer su mobile */
  onClose?: () => void;
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const ds = useDataSource();
  const cfg = ROLES[user.role];

  const handleLogout = async (): Promise<void> => {
    await ds.auth.logout();
    router.push('/');
  };

  return (
    <aside
      className={clsx(
        'flex h-screen w-72 flex-col border-r border-brand-100/80 bg-white/80 backdrop-blur-xl',
        'shadow-luxury-sm'
      )}
      style={{ paddingLeft: 'env(safe-area-inset-left, 0px)' }}
    >
      {/* Header logo */}
      <div className="flex items-center justify-between border-b border-brand-100 px-5 py-5">
        <Logo variant="icon-ai" size={56} className="animate-logo-pulse" />
        <div className="ml-3 min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider3 text-brand-600">
            Piattaforma
          </p>
          <p className="text-[15px] font-bold text-ink leading-tight">DVR</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi menu"
            className="btn-icon h-11 w-11 lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tenant + role pill */}
      <div className="border-b border-brand-100 px-5 py-4">
        <p className="label-upper">{cfg.label}</p>
        <p className="mt-1 truncate text-[13px] font-semibold text-ink">{user.tenant_name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {cfg.nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-active={active}
                  className="sidebar-link"
                  onClick={onClose}
                >
                  <Icon name={item.icon} size={17} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user + logout */}
      <div className="border-t border-brand-100 px-3 py-4">
        <div className="rounded-xl bg-brand-50/60 px-3 py-2.5">
          <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          className="mt-2 flex w-full items-center gap-2 min-h-[44px] rounded-xl px-3 py-2 text-[12px] font-semibold uppercase tracking-wider2 text-ink-muted transition-colors hover:bg-danger hover:text-danger-mark"
        >
          <LogOut size={15} />
          Esci
        </button>
      </div>
    </aside>
  );
}
