import { prossimoRiposo } from './FalcoMascot';

describe('varianti di riposo del falco', () => {
  test('dopo una variante speciale torna sempre al riposo base', () => {
    for (const v of ['riposo2', 'riposo3', 'riposo4'] as const) {
      expect(prossimoRiposo(v, 0.99)).toBe('riposo');
    }
  });

  test('pesi: meta riposo base, il resto diviso tra le tre varianti', () => {
    expect(prossimoRiposo('riposo', 0.1)).toBe('riposo');
    expect(prossimoRiposo('riposo', 0.49)).toBe('riposo');
    expect(prossimoRiposo('riposo', 0.55)).toBe('riposo2');
    expect(prossimoRiposo('riposo', 0.75)).toBe('riposo3');
    expect(prossimoRiposo('riposo', 0.999)).toBe('riposo4');
  });

  test('mai due varianti speciali di fila su molte estrazioni', () => {
    let prec: ReturnType<typeof prossimoRiposo> = 'riposo';
    let speciali = 0;
    for (let i = 0; i < 2000; i++) {
      const c = prossimoRiposo(prec);
      expect(prec !== 'riposo' && c !== 'riposo').toBe(false);
      if (c !== 'riposo') speciali++;
      prec = c;
    }
    expect(speciali > 300).toBe(true);
  });
});
