'use client';

import { parolePezzo } from '@/lib/agente-voce';

/**
 * Risposta del Falco mentre parla: tutte le parole compaiono sbiadite e si scuriscono
 * una alla volta, a tempo con la voce. Finita la voce torna il testo normale.
 */
export function TestoAVoce({ pezzi, pezzo, parola, className }: { pezzi: string[]; pezzo: number; parola: number; className?: string }) {
  return (
    <div className={className} aria-live="off">
      {pezzi.map((p, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {parolePezzo(p).map((w, j) => {
            const detta = i < pezzo || (i === pezzo && j <= parola);
            return (
              <span key={j} className="transition-opacity duration-200 ease-out" style={{ opacity: detta ? 1 : 0.28 }}>
                {w}{' '}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
