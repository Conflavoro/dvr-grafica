'use client';

// Collegamento ai file recenti sul telefono (solo app nativa).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Storico } from '@/components/icone';
import { isNativa } from '@/lib/app/nativa';

export function LinkFileRecenti() {
  const [nativa, setNativa] = useState(false);
  useEffect(() => setNativa(isNativa()), []);
  if (!nativa) return null;
  return (
    <Link href="/file-recenti/" className="mx-1 mt-3 flex min-h-[48px] items-center gap-2 rounded-[0.875rem] bg-perla-velo px-3 text-[14px] text-ink">
      <Storico size={16} aria-hidden className="text-ink-muted" />
      <span className="min-w-0 flex-1">File recenti sul telefono</span>
      <span className="text-[12.5px] text-ink-muted">anche senza rete</span>
    </Link>
  );
}
