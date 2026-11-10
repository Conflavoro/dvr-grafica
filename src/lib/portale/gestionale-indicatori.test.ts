import { mappaIndicatori, rispettoAlMesePrima, valoreIndicatore } from './gestionale-api';

describe('Indicatori del cruscotto', () => {
  it('mappa gli indicatori e scarta quelli senza nome o con mesi non validi', () => {
    const l = mappaIndicatori([
      { id: 'k7', nome: 'Richiamata', valore: 11, unita: 'min', obiettivo: 15, soglia: 15, meglio: 'basso', stato: 'ok', serie: [{ mese: '2026-10', valore: 11 }, { mese: 'x' }] },
      { id: 'k9' },
    ]);
    expect(l).toHaveLength(1);
    expect(l[0].meglio).toBe('basso');
    expect(l[0].serie).toHaveLength(1);
    expect(mappaIndicatori([{ id: 'k1', nome: 'A', stato: 'strano' }])[0].stato).toBe('neutral');
  });

  it('valori con unità e differenza sul mese prima', () => {
    expect(valoreIndicatore(94, '%')).toBe('94%');
    expect(valoreIndicatore(2.4, 'h')).toBe('2,4 h');
    expect(valoreIndicatore(16, '')).toBe('16');
    expect(valoreIndicatore(null, '%')).toBe('n.d.');
    const s = [{ mese: '2026-09', valore: 10 }, { mese: '2026-10', valore: 12.5 }, { mese: '2026-11', valore: null }];
    expect(rispettoAlMesePrima(s, 1)).toBe('+2,5');
    expect(rispettoAlMesePrima(s, 2)).toBeNull();
    expect(rispettoAlMesePrima(s, 0)).toBeNull();
  });
});
