import { deveBloccare, GRAZIA_MS, nomeSblocco } from './sblocco';

describe('sblocco con volto o impronta', () => {
  it('blocca solo se acceso: all avvio sempre, al ritorno dopo la grazia', () => {
    expect(deveBloccare({ acceso: false, avvio: true, inBackgroundDa: null, ora: 0 })).toBe(false);
    expect(deveBloccare({ acceso: true, avvio: true, inBackgroundDa: null, ora: 0 })).toBe(true);
    expect(deveBloccare({ acceso: true, avvio: false, inBackgroundDa: 1000, ora: 1000 + GRAZIA_MS - 1 })).toBe(false);
    expect(deveBloccare({ acceso: true, avvio: false, inBackgroundDa: 1000, ora: 1000 + GRAZIA_MS })).toBe(true);
    expect(deveBloccare({ acceso: true, avvio: false, inBackgroundDa: null, ora: 99_999_999 })).toBe(false);
  });

  it('nomi in italiano per i tipi del plugin', () => {
    expect(nomeSblocco(2)).toBe('Face ID');
    expect(nomeSblocco(1)).toBe('Touch ID');
    expect(nomeSblocco(3)).toBe('impronta');
    expect(nomeSblocco(6)).toBe('impronta');
  });
});
