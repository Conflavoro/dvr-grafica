import { avvisoPassaporto } from './passaporto-testo';

const SERVER = "Accesso registrato. I documenti sono quelli caricati dall'azienda e dal suo consulente; i link scadono dopo 15 minuti.";

test('con l’orario la durata non si ripete', () => {
  expect(avvisoPassaporto(SERVER, '21:57')).toBe(
    "Accesso registrato. I documenti sono quelli caricati dall'azienda e dal suo consulente. I link restano validi fino alle 21:57."
  );
});

test('senza orario resta l’avviso del server', () => {
  expect(avvisoPassaporto(SERVER, null)).toBe(SERVER);
});
