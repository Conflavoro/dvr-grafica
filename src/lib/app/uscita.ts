/**
 * Uscita dall'account su questo dispositivo: via i file recenti (con la chiave),
 * via lo sblocco con il volto o l'impronta, fermo il tempo reale. Il prossimo che
 * entra dallo stesso telefono non trova nulla di chi c'era prima.
 */

import { fermaTempoReale } from '@/lib/tempo-reale';
import { impostaUtenteFileRecenti, svuotaFileRecenti } from './file-recenti';
import { spegniSblocco } from './sblocco';

export async function pulisciAllUscita(): Promise<void> {
  fermaTempoReale();
  impostaUtenteFileRecenti(null);
  await Promise.all([svuotaFileRecenti().catch(() => undefined), spegniSblocco().catch(() => undefined)]);
}
