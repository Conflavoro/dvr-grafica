import { passiDaEventi } from './LavoroInCorso';

test('l\'esito aggiorna il passo in corso dello stesso strumento', () => {
  expect(
    passiDaEventi([
      { t: 'fase', testo: 'Leggo' },
      { t: 'passo', strumento: 'a', titolo: 'A', stato: 'in_corso' },
      { t: 'passo', strumento: 'b', titolo: 'B', stato: 'in_corso' },
      { t: 'passo', strumento: 'a', titolo: 'A', stato: 'ok' },
      { t: 'passo', strumento: 'b', titolo: 'B', stato: 'errore' },
      { t: 'passo', strumento: 'a', titolo: 'A', stato: 'in_corso' },
    ])
  ).toEqual([
    { strumento: 'a', titolo: 'A', stato: 'ok' },
    { strumento: 'b', titolo: 'B', stato: 'errore' },
    { strumento: 'a', titolo: 'A', stato: 'in_corso' },
  ]);
});
