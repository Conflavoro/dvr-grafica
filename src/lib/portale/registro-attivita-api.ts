/**
 * Registro attività dell'azienda (Utenti e permessi): chi ha fatto cosa e
 * quando sui dati dell'azienda. Lo leggono il titolare e lo studio. Fuori
 * dalla modalità API l'elenco è vuoto.
 */

import { isApiMode } from '@/lib/data-source';
import { lista, numero, prendi, rec, testo } from './api';

export type AzioneRegistro = 'creato' | 'modificato' | 'eliminato';

export interface RigaRegistro {
  id: number;
  quando: string;
  azione: AzioneRegistro;
  azioneTesto: string;
  cosa: string;
  chi: string;
  ruolo: string | null;
}

export interface PaginaRegistro {
  righe: RigaRegistro[];
  altre: boolean;
}

const AZIONI: AzioneRegistro[] = ['creato', 'modificato', 'eliminato'];
const TESTI: Record<AzioneRegistro, string> = { creato: 'Aggiunta', modificato: 'Modifica', eliminato: 'Eliminazione' };

export function mappaRigaRegistro(raw: unknown): RigaRegistro | null {
  const r = rec(raw);
  const id = numero(r.id);
  const quando = testo(r.quando);
  const cosa = testo(r.cosa);
  if (id === null || !quando || !cosa) return null;
  const azione = AZIONI.includes(r.azione as AzioneRegistro) ? (r.azione as AzioneRegistro) : 'modificato';
  return { id, quando, azione, azioneTesto: testo(r.azione_testo) ?? TESTI[azione], cosa, chi: testo(r.chi) ?? 'Senza autore', ruolo: testo(r.ruolo) };
}

/** Righe raggruppate per giorno (ora italiana), nell'ordine ricevuto. */
export function perGiorno(righe: RigaRegistro[]): Array<{ giorno: string; righe: RigaRegistro[] }> {
  const out: Array<{ giorno: string; righe: RigaRegistro[] }> = [];
  for (const r of righe) {
    const d = new Date(r.quando);
    const g = Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.giorno === g) ultimo.righe.push(r);
    else out.push({ giorno: g, righe: [r] });
  }
  return out;
}

export async function registroAttivita(aziendaId: number, prima?: number): Promise<PaginaRegistro> {
  if (!isApiMode() || !aziendaId) return { righe: [], altre: false };
  const d = rec(rec(await prendi(`/portale/aziende/${aziendaId}/registro?limite=100${prima ? `&prima=${prima}` : ''}`)).data);
  return {
    righe: lista(d.righe).map(mappaRigaRegistro).filter((x): x is RigaRegistro => x !== null),
    altre: d.altre === true,
  };
}
