import { compareRevisions, diffParagraphs, splitParagraphs } from './dvr-revisions';
import type { DvrRevisionDetail } from './data-source';

function rev(numero: number, sezioni: Array<[string, string, string]>): DvrRevisionDetail {
  return {
    numero, origine: 'ai', autore: null, motivo: null, sezioni_modificate: [], sezioni_umane: [],
    totale_sezioni: sezioni.length, canonical_27: null, ha_file: false, created_at: null,
    sezioni: sezioni.map(([key, title, body]) => ({ key, title, body, origine: 'ai' })),
  };
}

describe('diffParagraphs', () => {
  test('ignora righe vuote e spazi', () => {
    expect(splitParagraphs('a\r\n\n  b  \n')).toEqual(['a', 'b']);
  });

  test('marca paragrafi tolti e aggiunti', () => {
    const ops = diffParagraphs('uno\ndue\ntre', 'uno\nDUE\ntre\nquattro');
    expect(ops).toEqual([
      { type: 'same', text: 'uno' },
      { type: 'removed', text: 'due' },
      { type: 'added', text: 'DUE' },
      { type: 'same', text: 'tre' },
      { type: 'added', text: 'quattro' },
    ]);
  });
});

describe('compareRevisions', () => {
  test('riporta solo le sezioni diverse, con chiavi senza distinzione di maiuscole', () => {
    const older = rev(1, [['A', 'Dati', 'x'], ['b', 'Figure', 'vecchio'], ['C', 'Tolta', 'z']]);
    const current = rev(2, [['A', 'Dati', 'x'], ['B', 'Figure', 'nuovo'], ['D', 'Nuova', 'w']]);
    const res = compareRevisions(older, current);
    expect(res.map((r) => [r.key, r.stato])).toEqual([
      ['B', 'modificata'],
      ['D', 'aggiunta'],
      ['C', 'rimossa'],
    ]);
  });
});
