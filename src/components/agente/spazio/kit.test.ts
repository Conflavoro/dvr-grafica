import { senzaPunto } from './kit';

describe('senzaPunto', () => {
  it('toglie il punto finale delle forme societarie', () => {
    expect(`Nessun DVR per ${senzaPunto('Trattoria Da Mario S.n.c.')}.`).toBe('Nessun DVR per Trattoria Da Mario S.n.c.');
  });
  it('lascia invariati i nomi senza punto', () => {
    expect(senzaPunto('Edil Rossi')).toBe('Edil Rossi');
  });
});
