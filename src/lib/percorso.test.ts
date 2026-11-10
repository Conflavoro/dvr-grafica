import { percorso, senzaBase } from './percorso';

describe('percorso base', () => {
  it('senza base lascia tutto com’è', () => {
    expect(percorso('/brand/falco-mark.svg', '')).toBe('/brand/falco-mark.svg');
    expect(senzaBase('/azienda/', '')).toBe('/azienda/');
  });

  it('con /demo prefissa i percorsi del sito una volta sola', () => {
    expect(percorso('/brand/falco-mark.svg', '/demo')).toBe('/demo/brand/falco-mark.svg');
    expect(percorso('/', '/demo')).toBe('/demo/');
    expect(percorso('/demo/brand/x.svg', '/demo')).toBe('/demo/brand/x.svg');
    expect(percorso('/demonstrazione', '/demo')).toBe('/demo/demonstrazione');
  });

  it('non tocca indirizzi esterni o relativi', () => {
    expect(percorso('https://dvr.conflavoro.it/x', '/demo')).toBe('https://dvr.conflavoro.it/x');
    expect(percorso('//cdn.example/x', '/demo')).toBe('//cdn.example/x');
    expect(percorso('blob:abc', '/demo')).toBe('blob:abc');
  });

  it('toglie la base dal pathname del browser', () => {
    expect(senzaBase('/demo', '/demo')).toBe('/');
    expect(senzaBase('/demo/', '/demo')).toBe('/');
    expect(senzaBase('/demo/azienda/', '/demo')).toBe('/azienda/');
    expect(senzaBase('/altro/', '/demo')).toBe('/altro/');
  });
});
