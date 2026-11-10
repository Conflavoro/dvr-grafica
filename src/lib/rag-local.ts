// RAG client-side che funziona SEMPRE (anche senza backend).
// Cerca su corpus KB locale: schede rischio, normativa, schema formazione,
// pericoli D.Lgs. 81/08. Quando arriverà il backend Laravel, questo modulo
// resterà come fallback e si aggiungerà la chiamata a Supabase pgvector
// per il RAG su corpus normativo completo.

import { SCHEDE_RISCHIO, ALLEGATO_NORMATIVO, SCHEMA_FORMAZIONE } from './dvr-knowledge';
import { RISCHI_TIPICI, PERICOLI_DLGS_81 } from './dvr-rischi-standard';

export type RagSourceType = 'scheda_rischio' | 'normativa' | 'formazione' | 'pericolo' | 'rischio_tipico';

export interface RagResult {
  id: string;
  type: RagSourceType;
  title: string;
  snippet: string;
  full: string;
  source: string;
  score: number;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreMatch(text: string, queryTerms: string[]): number {
  const n = normalize(text);
  let score = 0;
  for (const t of queryTerms) {
    if (!t) continue;
    const occurrences = n.split(t).length - 1;
    score += occurrences * (t.length >= 5 ? 2 : 1);
  }
  return score;
}

function snippet(text: string, queryTerms: string[], len = 220): string {
  const n = normalize(text);
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const t of queryTerms) {
    const i = n.indexOf(t);
    if (i >= 0 && (bestIdx < 0 || i < bestIdx)) bestIdx = i;
  }
  if (bestIdx < 0) return text.slice(0, len) + (text.length > len ? '...' : '');
  const realIdx = lower.indexOf(queryTerms[0]) >= 0 ? lower.indexOf(queryTerms[0]) : bestIdx;
  const start = Math.max(0, realIdx - 40);
  const end = Math.min(text.length, realIdx + len);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

/**
 * Cerca in tutto il corpus locale. Restituisce top N risultati ordinati per score.
 */
export function ragSearch(query: string, limit = 12): RagResult[] {
  const q = normalize(query);
  if (!q || q.length < 2) return [];
  const terms = q.split(' ').filter((t) => t.length >= 2);
  const all: RagResult[] = [];

  // 1) Schede rischio
  for (const [key, scheda] of Object.entries(SCHEDE_RISCHIO)) {
    const fullText = [
      scheda.descrizione_rischio,
      scheda.effetti_salute,
      scheda.misure_eliminazione.join(' '),
      scheda.misure_sostituzione.join(' '),
      scheda.misure_collettive.join(' '),
      scheda.dpi.map((d) => `${d.tipo} ${d.norma_en}`).join(' '),
      scheda.formazione,
      scheda.sorveglianza_sanitaria,
      scheda.riferimento_normativo,
      scheda.estratto_norma,
    ].join(' ');
    const score = scoreMatch(fullText + ' ' + key, terms);
    if (score > 0) {
      all.push({
        id: `scheda:${key}`,
        type: 'scheda_rischio',
        title: `Scheda rischio: ${key.charAt(0).toUpperCase() + key.slice(1)}`,
        snippet: snippet(scheda.descrizione_rischio, terms),
        full: fullText,
        source: scheda.riferimento_normativo,
        score,
      });
    }
  }

  // 2) Normativa (ALLEGATO_NORMATIVO)
  for (let i = 0; i < ALLEGATO_NORMATIVO.length; i++) {
    const n = ALLEGATO_NORMATIVO[i] as { norma: string; titolo: string };
    const fullText = `${n.norma} ${n.titolo}`;
    const score = scoreMatch(fullText, terms);
    if (score > 0) {
      all.push({
        id: `norma:${i}`,
        type: 'normativa',
        title: n.norma,
        snippet: snippet(n.titolo, terms),
        full: fullText,
        source: n.norma,
        score,
      });
    }
  }

  // 3) Schema formazione
  for (let i = 0; i < SCHEMA_FORMAZIONE.length; i++) {
    const c = SCHEMA_FORMAZIONE[i] as { corso: string; durata: string; destinatari: string; aggiornamento: string };
    const fullText = `${c.corso} ${c.durata} ${c.destinatari} ${c.aggiornamento}`;
    const score = scoreMatch(fullText, terms);
    if (score > 0) {
      all.push({
        id: `corso:${i}`,
        type: 'formazione',
        title: c.corso,
        snippet: `Durata: ${c.durata}. Destinatari: ${c.destinatari}. Aggiornamento: ${c.aggiornamento}.`,
        full: fullText,
        source: 'Accordo Stato-Regioni 21/12/2011',
        score,
      });
    }
  }

  // 4) Pericoli D.Lgs. 81/08
  for (let i = 0; i < PERICOLI_DLGS_81.length; i++) {
    const p = PERICOLI_DLGS_81[i] as string;
    const score = scoreMatch(p, terms);
    if (score > 0) {
      all.push({
        id: `pericolo:${i}`,
        type: 'pericolo',
        title: p,
        snippet: p,
        full: p,
        source: 'D.Lgs. 81/08',
        score,
      });
    }
  }

  // 5) Rischi tipici (con P/G default)
  for (const r of RISCHI_TIPICI) {
    const fullText = `${r.categoria} ${r.fonte_norma ?? ''} ${r.id}`;
    const score = scoreMatch(fullText, terms);
    if (score > 0) {
      all.push({
        id: `rischio:${r.id}`,
        type: 'rischio_tipico',
        title: r.categoria,
        snippet: `P default: ${r.p_default} · G default: ${r.g_default}. ${r.fonte_norma ?? ''}`,
        full: fullText,
        source: r.fonte_norma ?? 'D.Lgs. 81/08',
        score,
      });
    }
  }

  return all.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Suggerimenti per il search empty state: termini comuni nella KB.
 */
export const RAG_SUGGESTIONS = [
  'rumore', 'caduta dall\'alto', 'movimentazione carichi',
  'elettrico', 'incendio', 'chimico', 'vibrazioni',
  'videoterminali', 'stress', 'DPI',
  'formazione antincendio', 'primo soccorso', 'art. 28',
];

/**
 * Cardinalità totale del corpus locale (per UI badge).
 */
export function ragCorpusSize(): { schede: number; normative: number; formazione: number; pericoli: number; rischi: number; total: number } {
  return {
    schede: Object.keys(SCHEDE_RISCHIO).length,
    normative: ALLEGATO_NORMATIVO.length,
    formazione: SCHEMA_FORMAZIONE.length,
    pericoli: PERICOLI_DLGS_81.length,
    rischi: RISCHI_TIPICI.length,
    total: Object.keys(SCHEDE_RISCHIO).length + ALLEGATO_NORMATIVO.length + SCHEMA_FORMAZIONE.length + PERICOLI_DLGS_81.length + RISCHI_TIPICI.length,
  };
}
