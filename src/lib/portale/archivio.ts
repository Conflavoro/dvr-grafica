import type { CompanyDocument, CompanyDocumentTipo } from '@/lib/data-source';

/** Da dove arriva un elemento dell'archivio, detto a parole. */
export const ETICHETTE_ORIGINE: Record<string, string> = {
  sopralluogo: 'Dal sopralluogo',
  caricato: 'Caricato',
  upload: 'Caricato',
  manuale: 'Scritto a mano',
  utente: 'Caricato',
  agente: 'Dal Falco',
  falco: 'Dal Falco',
  ricerca: 'Trovato dal Falco',
  dettato: 'Dettato',
};

/** Tipo dell'archivio dal file scelto. */
export function tipoDaFile(f: { type: string; name: string }): CompanyDocumentTipo {
  const t = f.type.toLowerCase();
  const est = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (t.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(est)) return 'foto';
  if (t.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v'].includes(est)) return 'video';
  if (t.startsWith('audio/') || ['m4a', 'mp3', 'wav', 'ogg', 'aac'].includes(est)) return 'audio';
  return 'documento';
}

/** Letto dall'AI, in lettura, o non letto (con il motivo in analisi_errore). */
export function statoAnalisi(d: CompanyDocument): 'letto' | 'in_lettura' | 'non_letto' {
  if (d.analisi_errore) return 'non_letto';
  if ((d.testo_analisi ?? '').trim() !== '') return 'letto';
  return d.filename ? 'in_lettura' : 'letto';
}
