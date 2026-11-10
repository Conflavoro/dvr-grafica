'use client';

import { usePathname } from 'next/navigation';
import { DEMO, DEMO_LIVE, PREFISSO_ARCHIVIO } from '@/lib/demo/attivo';
import { installaArchivioDemo } from '@/lib/demo/archivio';

// Demo dal vivo: chiavi del browser separate dalla produzione prima di ogni lettura.
if (PREFISSO_ARCHIVIO && typeof window !== 'undefined') installaArchivioDemo(PREFISSO_ARCHIVIO);

/**
 * Striscia discreta in alto nelle versioni dimostrative. Nella pagina d'ingresso è una riga
 * a tutta larghezza che spinge giù il contenuto; dentro l'app resta sul computer, al centro
 * della barra in alto (vuota). Sul telefono dentro l'app non c'è: coprirebbe titolo e logo.
 */
export function StrisciaDemo() {
  const percorso = usePathname() ?? '/';
  if (!DEMO && !DEMO_LIVE) return null;
  const ingresso = percorso === '/' || percorso === '';
  if (ingresso) {
    return (
      <div role="note" className="bg-oro-500 px-4 py-1 text-center text-[11.5px] font-medium leading-[1.3] text-[#232E00]">
        {DEMO_LIVE ? 'Versione dimostrativa con dati di esempio, si ripristina ogni notte' : 'Versione dimostrativa con dati di esempio'}
      </div>
    );
  }
  return (
    <div role="note" className="pointer-events-none fixed inset-x-0 top-0 z-[100] hidden justify-center lg:flex">
      <span className="rounded-b-[0.625rem] bg-oro-500 px-2.5 py-[2px] text-[10.5px] font-medium leading-[1.2] text-[#232E00] shadow-sm sm:px-3 sm:text-[11.5px]">
        {DEMO_LIVE ? (
          <>
            <span className="sm:hidden">Demo con dati di esempio, si ripristina ogni notte</span>
            <span className="hidden sm:inline">Versione dimostrativa con dati di esempio, si ripristina ogni notte</span>
          </>
        ) : (
          <>
            <span className="sm:hidden">Dimostrazione con dati di esempio</span>
            <span className="hidden sm:inline">Versione dimostrativa con dati di esempio</span>
          </>
        )}
      </span>
    </div>
  );
}
