'use client';

// File recenti senza rete: pagina che non chiama il server (si apre anche offline).
// L'utente dell'archivio e' quello salvato con i file; il blocco con il volto o
// l'impronta, se acceso, copre questa pagina come le altre.

import Link from 'next/link';
import { FileRecenti } from '@/components/app/FileRecenti';
import { Indietro } from '@/components/icone';

export default function PaginaFileRecenti() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl bg-white px-4 pb-10" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}>
      <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 text-[14px] text-ink-muted">
        <Indietro size={16} aria-hidden /> Torna all’app
      </Link>
      <h1 className="mb-1 mt-2 text-[28px] font-medium tracking-[-0.03em] text-ink">File recenti</h1>
      <p className="mb-5 text-[14px] leading-relaxed text-ink-muted">Consultabili anche senza rete. Restano sul telefono, cifrati, per 30 giorni.</p>
      <FileRecenti />
    </main>
  );
}
