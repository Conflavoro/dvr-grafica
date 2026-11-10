import { mappaEsamiLaboratorio, mappaEsamiMedico, mappaRichiestaEsami } from './medico-api';

describe('Richieste di esami', () => {
  it('mappa una richiesta in modo tollerante e senza valori del referto', () => {
    const r = mappaRichiestaEsami({ id: 3, codice: 'L-003', lavoratore: 'Mario Rossi', esami: ['Emocromo', 4, ''], stato: 'strano', referto: true });
    expect(r?.esami).toEqual(['Emocromo']);
    expect(r?.stato).toBe('richiesto');
    expect(r?.referto).toBe(true);
    expect(mappaRichiestaEsami({ codice: 'senza id' })).toBeNull();
  });

  it('vista del medico e del laboratorio con valori mancanti', () => {
    const m = mappaEsamiMedico({ lavoratori: [{ id: 1, nome: 'Mario Rossi · Officina' }, { id: 0, nome: 'x' }], laboratori: ['Pera', ''], esami: ['Emocromo'] });
    expect(m.lavoratori).toHaveLength(1);
    expect(m.laboratori).toEqual(['Pera']);
    const l = mappaEsamiLaboratorio({ numeri: { da_accettare: 2 }, anteprima: true });
    expect(l.numeri.daAccettare).toBe(2);
    expect(l.numeri.aperte).toBe(0);
    expect(l.anteprima).toBe(true);
  });
});
