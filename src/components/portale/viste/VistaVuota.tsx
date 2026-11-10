'use client';

import { usePortale } from '../PortaleShell';
import { Testata, Vuoto } from '../kit';
import { trovaSezione } from '@/lib/portale/sezioni';

/**
 * Sezione nuova ancora senza schermata (Primo soccorso, HACCP, Infortuni): testata della
 * sezione e stato vuoto. La squadra della sezione sostituisce la riga del registro con la sua vista.
 */
export function VistaVuota({ chiave }: { chiave: string }) {
  const { app, azienda } = usePortale();
  const s = trovaSezione(app, chiave);
  if (!s) return null;
  return (
    <div className="space-y-5">
      <Testata categoria={s.categoria} icona={s.icona} sopra={azienda?.ragione_sociale} titolo={s.titolo} />
      <Vuoto titolo="Sezione in preparazione" />
    </div>
  );
}
