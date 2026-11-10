import { mappaRigaRegistro, perGiorno, registroAttivita } from './registro-attivita-api';

describe('registro attività dell azienda', () => {
  it('mappa le righe in modo tollerante', () => {
    expect(mappaRigaRegistro({ id: 1, quando: '2026-10-14T08:00:00Z', azione: 'creato', cosa: 'Dipendente: Mario Rossi', chi: 'Luca' })).toMatchObject({ azioneTesto: 'Aggiunta', ruolo: null });
    expect(mappaRigaRegistro({ id: 2, quando: '2026-10-14T08:00:00Z', azione: 'strano', cosa: 'x' })?.azione).toBe('modificato');
    expect(mappaRigaRegistro({ id: 3, cosa: 'senza data' })).toBeNull();
  });

  it('raggruppa per giorno mantenendo l ordine', () => {
    const r = (id: number, quando: string) => mappaRigaRegistro({ id, quando, azione: 'creato', cosa: 'x' })!;
    const g = perGiorno([r(3, '2026-10-15T09:00:00'), r(2, '2026-10-15T08:00:00'), r(1, '2026-10-14T08:00:00')]);
    expect(g.map((x) => x.righe.length)).toEqual([2, 1]);
    expect(g[0].giorno).toBe('2026-10-15');
  });

  it('fuori dalla modalità API il registro è vuoto', async () => {
    expect(await registroAttivita(1)).toEqual({ righe: [], altre: false });
  });
});
