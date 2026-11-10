'use client';

import { useEffect, useState } from 'react';
import { urlFoto } from '@/lib/portale/sopralluoghi-api';
import { Immagine } from '@/components/icone';
import { clsx } from '@/lib/clsx';

/** Miniatura di una foto dell'archivio, caricata con il token (niente link pubblici). */
export function FotoMini({ documentoId, piccola = false }: { documentoId: number; piccola?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [aperta, setAperta] = useState(false);
  useEffect(() => {
    let vivo = true;
    let creato: string | null = null;
    urlFoto(documentoId)
      .then((u) => {
        creato = u;
        if (vivo) setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      if (creato) URL.revokeObjectURL(creato);
    };
  }, [documentoId]);
  const lato = piccola ? 'h-12 w-12' : 'h-16 w-16';
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); if (url) setAperta(true); }} className={clsx('grid shrink-0 place-items-center overflow-hidden rounded-[0.75rem] bg-perla-velo', lato)} aria-label="Apri la foto">
        {url ? <img src={url} alt="Foto del sopralluogo" className="h-full w-full object-cover" /> : <Immagine size={18} aria-hidden className="text-ink-subtle" />}
      </button>
      {aperta && url && (
        <div role="dialog" aria-modal="true" aria-label="Foto" className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4" onClick={(e) => { e.stopPropagation(); setAperta(false); }}>
          <img src={url} alt="Foto del sopralluogo" className="max-h-[85dvh] max-w-full rounded-[1rem] object-contain" />
        </div>
      )}
    </>
  );
}
