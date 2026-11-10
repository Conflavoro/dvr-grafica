// Utilita per lo storico revisioni del DVR: download dei file di una revisione
// (fetch con JWT, come downloadDvrFromUrl) e confronto del testo a livello di
// paragrafo. Nessuna dipendenza pesante: resta fuori dal bundle del generatore.

import { saveAs } from 'file-saver';
import type { Dvr, DvrRevisionDetail, DvrRevisionSection } from './data-source';
import { fetchConTempo } from '@/lib/attesa';

export type RevisionFormat = 'docx' | 'pdf';

/** Chiave di confronto: il backend normalizza le chiavi in minuscolo. */
export function sectionKey(key: string): string {
  return key.trim().toLowerCase();
}

function revisionFilename(dvr: Dvr, numero: number, format: RevisionFormat): string {
  const slug = dvr.azienda.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dvr';
  return `dvr-${slug}-v${dvr.versione}-rev${numero}.${format}`;
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // continua con il nome semplice
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/**
 * Scarica il file Word o PDF di una revisione da un URL protetto da JWT.
 * Lancia con un messaggio leggibile se il file non e disponibile.
 */
export async function downloadRevisionFile(
  dvr: Dvr,
  numero: number,
  format: RevisionFormat,
  url: string,
  token: string | null,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetchConTempo(url, { headers });
  if (res.status === 404) {
    throw new Error('Il file di questa revisione non è disponibile.');
  }
  if (!res.ok) {
    throw new Error(`Download non riuscito (${res.status}).`);
  }
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get('Content-Disposition')) ?? revisionFilename(dvr, numero, format);
  saveAs(blob, name);
}

// ------------------------------------------------------------------
// Confronto testo
// ------------------------------------------------------------------

export type ParagraphOp = { type: 'same' | 'removed' | 'added'; text: string };

/** Divide un testo in paragrafi non vuoti (una riga = un paragrafo). */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Oltre questa soglia (righe x righe) il confronto puntuale diventa troppo costoso. */
const MAX_LCS_CELLS = 400_000;

/**
 * Diff a livello di paragrafo basato sulla sottosequenza comune piu lunga.
 * `before` e il testo della revisione scelta, `after` quello della corrente.
 */
export function diffParagraphs(before: string, after: string): ParagraphOp[] {
  const a = splitParagraphs(before);
  const b = splitParagraphs(after);
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_LCS_CELLS) {
    return [
      ...a.map((text) => ({ type: 'removed' as const, text })),
      ...b.map((text) => ({ type: 'added' as const, text })),
    ];
  }

  // lcs[i][j] = lunghezza LCS di a[i..] e b[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: ParagraphOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      out.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'removed', text: a[i++] });
  while (j < m) out.push({ type: 'added', text: b[j++] });
  return out;
}

export interface SectionComparison {
  key: string;
  /** Titolo da mostrare (quello della corrente se c'e). */
  title: string;
  stato: 'modificata' | 'aggiunta' | 'rimossa';
  titoloCambiato: boolean;
  before: DvrRevisionSection | null;
  after: DvrRevisionSection | null;
  ops: ParagraphOp[];
}

/** Sezioni che differiscono tra una revisione e la corrente, nell'ordine della corrente. */
export function compareRevisions(older: DvrRevisionDetail, current: DvrRevisionDetail): SectionComparison[] {
  const oldMap = new Map(older.sezioni.map((s) => [sectionKey(s.key), s]));
  const curMap = new Map(current.sezioni.map((s) => [sectionKey(s.key), s]));
  const keys: string[] = [];
  for (const s of current.sezioni) keys.push(sectionKey(s.key));
  for (const s of older.sezioni) if (!curMap.has(sectionKey(s.key))) keys.push(sectionKey(s.key));

  const out: SectionComparison[] = [];
  for (const k of keys) {
    const before = oldMap.get(k) ?? null;
    const after = curMap.get(k) ?? null;
    if (before && after && before.body === after.body && before.title === after.title) continue;
    out.push({
      key: after?.key ?? before?.key ?? k,
      title: after?.title || before?.title || '',
      stato: before && after ? 'modificata' : after ? 'aggiunta' : 'rimossa',
      titoloCambiato: Boolean(before && after && before.title !== after.title),
      before,
      after,
      ops: diffParagraphs(before?.body ?? '', after?.body ?? ''),
    });
  }
  return out;
}
