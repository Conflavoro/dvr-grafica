import { mappaFattureCentro, mappaFattureLaboratorio, mappaGiornataCalendario } from './gestionale-api';

describe('Calendario e fatture dei partner', () => {
  it('giornata del calendario: fase, visibilità e motivo', () => {
    const g = mappaGiornataCalendario({ id: 2, data: '2026-11-05', fase: 'futura', visibile: false, motivo: 'in_preparazione', disponibile_dal: '2026-11-03' });
    expect(g?.fase).toBe('futura');
    expect(g?.motivo).toBe('in_preparazione');
    expect(mappaGiornataCalendario({ id: 1, fase: 'strana' })).toBeNull();
    expect(mappaGiornataCalendario({ id: 1, data: '2026-10-01', fase: 'strana', motivo: 'x' })?.fase).toBe('passata');
  });

  it('fatture: centesimi in euro, righe vuote scartate, stato tollerante', () => {
    const c = mappaFattureCentro({
      partner: true,
      da_fatturare: [{ giornata_id: 4, data: '2026-10-14', righe: [{ prestazione: 'visita', numero: 2, tariffa_centesimi: 3500, totale_centesimi: 7000 }, { prestazione: 'x', numero: 0 }], totale_centesimi: 7000 }],
      inviate: [{ id: 1, numero: 'CML 2026/001', importo_centesimi: 48600, stato: 'boh' }],
    });
    expect(c.daFatturare[0].righe).toHaveLength(1);
    expect(c.daFatturare[0].totale).toBe(70);
    expect(c.inviate[0].importo).toBe(486);
    expect(c.inviate[0].stato).toBe('inviata');
    expect(mappaFattureLaboratorio(null).righe).toEqual([]);
  });
});
