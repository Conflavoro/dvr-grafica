import { paragrafiPerVoce, parolaAlTempo } from './agente-voce';

describe('paragrafiPerVoce', () => {
  test('divide per paragrafi e unisce quelli troppo brevi', () => {
    const t = 'Ciao.\n\nHo letto l’archivio di Officine Bertini e i rilievi del sopralluogo di ieri nel reparto verniciatura.\n\nC’è poi una scadenza superata.';
    const p = paragrafiPerVoce(t);
    expect(p[0].startsWith('Ciao. Ho letto')).toBe(true);
    expect(p).toHaveLength(2);
  });

  test('spezza i paragrafi lunghi sulle frasi senza superare il massimo', () => {
    const frase = 'Questa è una frase di prova per la voce. ';
    const p = paragrafiPerVoce(frase.repeat(60), 300);
    expect(p.length > 5).toBe(true);
    expect(p.every((x) => x.length <= 300)).toBe(true);
    expect(p.join(' ').replace(/\s+/g, ' ')).toBe(frase.repeat(60).trim().replace(/\s+/g, ' '));
  });

  test('testo vuoto: nessun paragrafo', () => {
    expect(paragrafiPerVoce('  \n\n ')).toEqual([]);
  });
});

describe('primo pezzo corto', () => {
  test('il primo pezzo resta entro le prime frasi e il testo non si perde', () => {
    const t = 'Hai due scadenze questo mese alla Trattoria Da Mario. La prima è la formazione di Luca, aiuto cuoco, il 20 ottobre. La seconda è la sua visita medica preventiva, sempre il 20 ottobre. Non ci sono scadenze già superate e il DVR è in bozza.';
    const p = paragrafiPerVoce(t);
    expect(p.length > 1).toBe(true);
    expect(p[0].length <= 220).toBe(true);
    expect(p[0].startsWith('Hai due scadenze')).toBe(true);
    expect(p.join(' ').replace(/\s+/g, ' ')).toBe(t);
  });

  test('una sola frase lunga resta intera', () => {
    const t = 'Questa '.repeat(50).trim() + '.';
    expect(paragrafiPerVoce(t)[0]).toBe(t);
  });
});

describe('parolaAlTempo', () => {
  it('segue i tempi esatti della voce', () => {
    expect(parolaAlTempo('Tre scadenze superate.', 0, 2000, [0, 300, 900])).toBe(0);
    expect(parolaAlTempo('Tre scadenze superate.', 350, 2000, [0, 300, 900])).toBe(1);
    expect(parolaAlTempo('Tre scadenze superate.', 1500, 2000, [0, 300, 900])).toBe(2);
  });
  it('senza tempi stima dalla durata', () => {
    expect(parolaAlTempo('uno due tre quattro', 0, 4000) <= 0).toBe(true);
    expect(parolaAlTempo('uno due tre quattro', 3999, 4000)).toBe(3);
  });
});
