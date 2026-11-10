'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { coworkAttivo, percorsoScrivania } from '@/lib/cowork/api';
import { vedeBozze } from '@/lib/cowork/logica';
import type { Role } from '@/lib/data-source';

export const EVENTO_APRI = 'cowork:apri';

function apriQui(dvrId: number): boolean {
  try {
    if (!/\/gestionale\/dvr\/?$/.test(window.location.pathname)) return false;
    window.history.replaceState(null, '', `${window.location.pathname}?cowork=${dvrId}`);
    window.dispatchEvent(new CustomEvent(EVENTO_APRI, { detail: { id: dvrId } }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Collegamento alla Scrivania per paragrafi di un DVR. Compare solo allo studio
 * e solo se il motore cowork e' acceso (altrimenti porterebbe a una pagina spenta).
 */
export function LinkScrivania({
  dvrId,
  aziendaId,
  ruolo,
  testo = 'Apri la Scrivania per paragrafi',
  className,
}: {
  dvrId: number;
  aziendaId: number | null;
  ruolo: Role | null | undefined;
  testo?: string;
  className?: string;
}) {
  const [attivo, setAttivo] = useState(false);
  const studio = vedeBozze(ruolo);
  useEffect(() => {
    if (!studio || !aziendaId) return;
    let vivo = true;
    void coworkAttivo(aziendaId).then((a) => vivo && setAttivo(a));
    return () => {
      vivo = false;
    };
  }, [studio, aziendaId]);
  if (!studio || !attivo) return null;
  return (
    <Link
      href={percorsoScrivania(dvrId, aziendaId)}
      className={clsx('btn-ghost', className)}
      onClick={(e) => {
        // Gia' nella Scrivania dei documenti: si apre senza cambiare pagina.
        if (apriQui(dvrId)) e.preventDefault();
      }}
    >
      {testo}
    </Link>
  );
}
