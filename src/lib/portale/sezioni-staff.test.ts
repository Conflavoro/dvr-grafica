import { sezioniVisibili } from './sezioni';

describe('menu del gestionale per ruolo dello staff', () => {
  it('il tecnico non vede le voci che il server gli chiude', () => {
    const tecnico = ['home', 'aziende', 'avvii', 'dvr', 'sopralluoghi', 'cantieri', 'ispezioni', 'ore'];
    const chiavi = sezioniVisibili('gestionale', { ruolo: 'consulente', sezioniStaff: tecnico }).map((s) => s.chiave);
    for (const k of ['coda', 'aziende', 'dvr', 'sopralluoghi', 'pos', 'ispezioni', 'ore']) expect(chiavi).toContain(k);
    for (const k of ['giornata', 'laboratorio', 'prenotazioni', 'classi', 'promemoria', 'preventivi', 'medico']) expect(chiavi).not.toContain(k);
  });

  it('senza i permessi dello staff resta il filtro di prima', () => {
    const chiavi = sezioniVisibili('gestionale', { ruolo: 'consulente' }).map((s) => s.chiave);
    expect(chiavi).toContain('giornata');
    expect(chiavi).not.toContain('cruscotto');
  });
});
