'use client';

// Scansiona un documento con la fotocamera (solo app nativa): sul web non compare.

import { useEffect, useState } from 'react';
import { Fotocamera } from '@/components/icone';
import { isNativa } from '@/lib/app/nativa';
import { scansionaDocumento } from '@/lib/app/scansione';

export function BottoneScansione({ onFile, testo = 'Scansiona con la fotocamera' }: { onFile: (f: File) => void; testo?: string }) {
  const [nativa, setNativa] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  useEffect(() => setNativa(isNativa()), []);
  if (!nativa) return null;
  return (
    <button
      type="button"
      disabled={lavoro}
      onClick={() => {
        setLavoro(true);
        void scansionaDocumento()
          .then((f) => f && onFile(f))
          .finally(() => setLavoro(false));
      }}
      className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1rem] px-4 text-[14px] font-medium text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] disabled:opacity-60"
    >
      <Fotocamera size={18} aria-hidden /> {lavoro ? 'Preparo il PDF' : testo}
    </button>
  );
}
