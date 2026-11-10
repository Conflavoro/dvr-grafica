import { TempoScaduto, conTempoMassimo, fetchConTempo } from './attesa';

test('conTempoMassimo: rifiuta con il messaggio dato quando la promessa non arriva', async () => {
  const mai = new Promise<number>(() => undefined);
  await expect(conTempoMassimo(mai, 10, 'Non è arrivato in tempo.')).rejects.toThrow('Non è arrivato in tempo.');
  await expect(conTempoMassimo(Promise.resolve(3), 1000, 'x')).resolves.toBe(3);
});

test('fetchConTempo: interrompe la richiesta allo scadere e traduce gli errori di rete', async () => {
  const originale = global.fetch;
  try {
    global.fetch = ((_u: unknown, init?: RequestInit) =>
      new Promise((_, rifiuta) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          rifiuta(e);
        });
      })) as typeof fetch;
    let errore: unknown = null;
    try {
      await fetchConTempo('https://esempio.invalid/file', {}, 10);
    } catch (e) {
      errore = e;
    }
    expect(errore instanceof TempoScaduto).toBe(true);
    global.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    await expect(fetchConTempo('https://esempio.invalid/file')).rejects.toThrow('Connessione assente o interrotta. Controlla la rete e riprova.');
  } finally {
    global.fetch = originale;
  }
});
