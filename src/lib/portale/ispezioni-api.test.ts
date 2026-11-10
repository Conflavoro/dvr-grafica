import { cifre, mappaIspezione, mmss, nomiEnti, secondiRimasti } from './ispezioni-api';

describe('Pronto Ispezioni', () => {
  it('più enti con i nomi completi: A, B e C', () => {
    expect(nomiEnti(['ASL'])).toBe('ASL Toscana Nord Ovest');
    expect(nomiEnti(['ASL', 'ITL', 'VVF'])).toBe('ASL Toscana Nord Ovest, Ispettorato territoriale del lavoro e Vigili del fuoco');
  });

  it('conto alla rovescia da 15:00 a 00:00', () => {
    const inizio = '2026-10-14T08:00:00Z';
    const t0 = new Date(inizio).getTime();
    expect(mmss(secondiRimasti(inizio, 15, t0))).toBe('15:00');
    expect(mmss(secondiRimasti(inizio, 15, t0 + 61_000))).toBe('13:59');
    expect(secondiRimasti(inizio, 15, t0 + 20 * 60_000)).toBe(0);
  });

  it('numero per la richiamata: si contano solo le cifre', () => {
    expect(cifre('335 612 0481')).toBe(10);
    expect(cifre('335 61')).toBe(5);
  });

  it('storico: esito sconosciuto diventa in attesa, prescrizioni aperte contate', () => {
    const i = mappaIspezione({ id: 3, esito: 'boh', da_sistemare: 2, verbale: true, enti: ['ASL'] });
    expect(i.esito).toBe('in_attesa');
    expect(i.daSistemare).toBe(2);
  });
});
