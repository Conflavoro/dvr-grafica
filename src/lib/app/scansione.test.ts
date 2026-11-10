import { inPagina, nomeScansione } from './scansione';

describe('scansione in PDF', () => {
  it('la pagina sta nell A4 con le proporzioni giuste e centrata', () => {
    const r = inPagina(1240, 1754); // foglio A4 fotografato
    expect(r.w <= 194.01).toBe(true);
    expect(r.h <= 281.01).toBe(true);
    expect(Math.abs(r.w / r.h - 1240 / 1754) < 0.001).toBe(true);
    expect(Math.abs(r.x + r.w / 2 - 105) < 0.001).toBe(true);
    const larga = inPagina(3000, 1000);
    expect(Math.abs(larga.w - 194) < 0.01).toBe(true);
    expect(larga.y > 100).toBe(true);
  });

  it('nome del file con data e ora, senza trattini come punteggiatura nel testo', () => {
    expect(nomeScansione(new Date(2026, 9, 30, 9, 5))).toBe('Scansione 2026-10-30 09.05.pdf');
  });
});
