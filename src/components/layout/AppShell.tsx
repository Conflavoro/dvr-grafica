'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isApiMode } from '@/lib/data-source';
import { ROLES } from '@/lib/mock-auth';
import { rottaPortale } from '@/lib/portale/rotte-nuove';
import { useRequireAuth } from '@/lib/use-auth';
import { paginaConsentita } from '@/lib/pagine-riservate';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { clsx } from '@/lib/clsx';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
  /**
   * Pagina a tutta altezza senza margini interni (console dell'agente): il
   * contenuto gestisce da solo scorrimento e safe-area.
   */
  fullBleed?: boolean;
  /**
   * 'agente': nessuna sidebar e nessuna topbar della piattaforma. La pagina
   * occupa lo schermo e porta la propria barra (console del Super Agente).
   */
  modalita?: 'piattaforma' | 'agente';
}

/**
 * Shell autenticato: sidebar fissa su desktop, drawer su mobile.
 * Auth guard: redirect a "/" se utente non loggato.
 */
export function AppShell({ children, pageTitle, fullBleed = false, modalita = 'piattaforma' }: AppShellProps) {
  const { user, loading } = useRequireAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  // Le pagine della prima versione hanno la grafica vecchia: con il backend vero si passa
  // sempre alla schermata nuova del portale (Rocco 10/11).
  const nuova = user && isApiMode() ? rottaPortale(pathname, typeof window !== 'undefined' ? window.location.search : '', ROLES[user.role]?.homePath ?? '/gestionale/coda/') : null;
  useEffect(() => {
    if (nuova) router.replace(nuova);
  }, [nuova, router]);

  if (loading || !user || nuova) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[12px] uppercase tracking-wider2 text-ink-muted">Caricamento…</div>
      </div>
    );
  }

  if (modalita === 'agente') {
    // Niente z-index qui: un contesto di impilamento isolerebbe il falco e il suo
    // mix-blend multiply non si fonderebbe piu' con lo sfondo della pagina.
    return (
      <div
        className="relative flex h-[100dvh] flex-col overflow-hidden"
        style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
      >
        {children}
      </div>
    );
  }

  const consentita = paginaConsentita(user.role, pathname);
  const contenuto = consentita ? (
    children
  ) : (
    <div className="mx-auto mt-10 max-w-md rounded-2xl bg-perla-carta px-6 py-8 text-center shadow-[0_0_0_1px_rgba(14,14,16,0.08)]">
      <p className="text-[16px] font-semibold text-brand-900">Pagina non disponibile con il tuo profilo</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">Questa sezione la gestisce il titolare dello studio o lo staff Conflavoro.</p>
      <Link href="/agente" className="btn-primary mt-5 inline-flex min-h-[44px] items-center px-5 text-[14px]">
        Torna all’agente
      </Link>
    </div>
  );

  return (
    <div className={clsx('relative z-10 flex', fullBleed ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar user={user} />
      </div>

      {/* Mobile drawer */}
      <div
        aria-hidden={!drawerOpen}
        className={clsx(
          'fixed inset-0 z-40 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={clsx(
            'absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity',
            drawerOpen ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          onTouchEnd={(e) => { e.preventDefault(); setDrawerOpen(false); }}
        />
        <div
          className={clsx(
            'absolute left-0 top-0 h-full transition-transform duration-300',
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <Sidebar user={user} onClose={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} pageTitle={pageTitle} onOpenSidebar={() => setDrawerOpen(true)} />
        {fullBleed ? (
          <main className="flex min-h-0 flex-1 flex-col">{contenuto}</main>
        ) : (
          <main className="flex-1 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">{contenuto}</main>
        )}
      </div>
    </div>
  );
}
