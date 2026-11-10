import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgenteMarkdown, markdownInTestoSemplice, parseBlocchi } from './AgenteMarkdown';

describe('markdown leggero dell\'agente', () => {
  test('riconosce titoli, elenchi, tabelle e paragrafi', () => {
    const b = parseBlocchi(
      '## Rumore\n\nIl limite e\' **87 dB(A)**.\n- primo\n- secondo\n\n1. uno\n2. due\n---\n| A | B |\n|---|---|\n| 1 | 2 |'
    );
    expect(b.map((x) => x.k)).toEqual(['titolo', 'p', 'ul', 'ol', 'tabella']);
    expect(b[4]).toEqual({ k: 'tabella', righe: [['A', 'B'], ['1', '2']] });
  });

  test('il testo per la voce non contiene simboli markdown', () => {
    const t = markdownInTestoSemplice('# Esito\n**Attenzione**: vedi [art. 190](https://x.it)\n- `LEX` alto');
    expect(t).toBe('Esito.\nAttenzione: vedi art. 190\nLEX alto');
  });

  test('le lineette diventano virgole o intervalli', () => {
    const b = parseBlocchi('Rumore \u2014 valori 80\u201385 dB(A)');
    expect(b).toEqual([{ k: 'p', righe: ['Rumore, valori 80 a 85 dB(A)'] }]);
  });

  test('l\'HTML resta testo (nessuna interpretazione)', () => {
    const b = parseBlocchi('<script>alert(1)</script>');
    expect(b).toEqual([{ k: 'p', righe: ['<script>alert(1)</script>'] }]);
  });

  test('i link web diventano cliccabili, gli altri schemi restano testo', () => {
    const h = renderToStaticMarkup(
      createElement(AgenteMarkdown, { testo: 'Link personale: https://dvr.conflavoro.it/lavoratore/?t=lav_abc. Poi [la guida](https://x.it/g) e [x](javascript:alert(1))' })
    );
    expect(h).toContain('href="https://dvr.conflavoro.it/lavoratore/?t=lav_abc"');
    expect(h).toContain('>https://dvr.conflavoro.it/lavoratore/?t=lav_abc</a>.');
    expect(h).toContain('href="https://x.it/g"');
    expect(h).toContain('rel="noopener noreferrer"');
    expect(h).not.toContain('javascript:');
  });

  test('la voce non legge gli indirizzi web', () => {
    expect(markdownInTestoSemplice('Link personale: https://dvr.conflavoro.it/lavoratore/?t=lav_abc')).toBe('Link personale: il link qui sotto');
  });
});
