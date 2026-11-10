import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestoParagrafo } from './parti';

const html = (testo: string) => renderToStaticMarkup(createElement(TestoParagrafo, { testo }));

describe('testo del paragrafo nella Scrivania', () => {
  test('il Markdown diventa formattazione, non simboli a schermo', () => {
    const h = html('## Mansioni\n\nIl preposto e\' **Gentili**.\n\n- primo\n- secondo\n\n| Mansione | Rischio |\n|---|---|\n| Operaio | Caduta |');
    expect(h).toContain('<strong');
    expect(h).toContain('Gentili</strong>');
    expect(h).toContain('<ul');
    expect(h).toContain('<li>primo</li>');
    expect(h).toContain('<table');
    expect(h).toContain('Caduta');
    expect(h).not.toContain('**');
    expect(h).not.toContain('##');
    expect(h).not.toContain('|---');
  });

  test('l\'HTML nel testo resta testo', () => {
    const h = html('<img src=x onerror=alert(1)> e [x](javascript:alert(1))');
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img');
    expect(h).not.toContain('javascript:');
  });

  test('i segnaposto restano leggibili', () => {
    expect(html('Preposto: [DA COMPLETARE: nominativo del preposto]')).toContain('[DA COMPLETARE: nominativo del preposto]');
  });

  test('testo vuoto', () => {
    expect(html('  \n\n ')).toContain('Testo vuoto.');
  });
});
