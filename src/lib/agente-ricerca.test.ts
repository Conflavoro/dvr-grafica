import { cerca, distanza, normalizza, punteggio } from './agente-ricerca';

const aziende = [
  { nome: 'Officine Bertini S.r.l.', piva: '01234567890', ateco: '25.62', comune: 'Prato' },
  { nome: 'Lavanderia Arcobaleno S.n.c.', piva: '09876543210', ateco: '96.01.10', comune: 'Forlì' },
  { nome: 'Edil Costruzioni Toscana S.p.A.', piva: '05555555555', ateco: '41.20', comune: 'Firenze' },
];
const campi = (a: (typeof aziende)[number]) => [a.nome, a.piva, a.ateco, a.comune];

describe('ricerca della console', () => {
  test('normalizza accenti e punteggiatura', () => {
    expect(normalizza('Forlì, S.r.l.')).toBe('forli s r l');
    expect(distanza('bertni', 'bertin')).toBe(2);
  });

  test('trova per nome con errori di battitura', () => {
    expect(cerca('bertni', aziende, campi)[0].nome).toBe('Officine Bertini S.r.l.');
    expect(cerca('lavandria', aziende, campi)[0].nome).toContain('Lavanderia');
  });

  test('trova per partita IVA, ATECO e comune senza accenti', () => {
    expect(cerca('0987654', aziende, campi)[0].nome).toContain('Lavanderia');
    expect(cerca('41.20', aziende, campi)[0].nome).toContain('Edil');
    expect(cerca('forli', aziende, campi)[0].nome).toContain('Lavanderia');
  });

  test('tutte le parole devono corrispondere e il nome pesa di piu', () => {
    expect(cerca('edil prato', aziende, campi)).toHaveLength(0);
    expect(punteggio('edil', ['Edil Costruzioni']) > punteggio('edil', ['Altro', 'note edil'])).toBe(true);
  });

  test('ricerca vuota o troppo diversa: nessun risultato', () => {
    expect(cerca('', aziende, campi)).toHaveLength(0);
    expect(cerca('zzz', aziende, campi)).toHaveLength(0);
  });
});
