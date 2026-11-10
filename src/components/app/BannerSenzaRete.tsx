'use client';

// App senza rete: una riga in alto porta ai file recenti, consultabili offline.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isNativa } from '@/lib/app/nativa';

export function BannerSenzaRete() {
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (!isNativa()) return;
    const leggi = () => setOffline(!navigator.onLine);
    leggi();
    window.addEventListener('online', leggi);
    window.addEventListener('offline', leggi);
    return () => {
      window.removeEventListener('online', leggi);
      window.removeEventListener('offline', leggi);
    };
  }, []);
  if (!offline || pathname?.startsWith('/file-recenti')) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[150] flex items-center gap-3 bg-grafite-950 px-4 pb-2 text-[13.5px] text-white" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }} role="status">
      <span className="min-w-0 flex-1">Sei senza rete.</span>
      <Link href="/file-recenti/" className="rounded-lg bg-white px-3 py-1.5 font-medium text-ink">
        File recenti
      </Link>
    </div>
  );
}
