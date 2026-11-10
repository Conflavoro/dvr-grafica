'use client';

import { Avviso, Spunta } from '@/components/icone';
import { useToasts } from './stato';

/** Messaggi brevi del guscio: in basso al centro, sopra la barra sul telefono (02, toast). */
export function Toasts({ sopraBarra }: { sopraBarra: boolean }) {
  const voci = useToasts();
  if (!voci.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={{ bottom: sopraBarra ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '1.5rem' }}
    >
      {voci.map((t) => (
        <p key={t.id} className="toast" data-uscita={t.uscita ? '1' : undefined}>
          <span className="toast-ico" aria-hidden>
            {t.icona === 'spunta' ? <Spunta size={16} /> : <Avviso size={16} />}
          </span>
          {t.testo}
        </p>
      ))}
    </div>
  );
}
