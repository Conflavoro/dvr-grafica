import { TokenNativo, type ArchivioChiavi } from './nativa';

function archivioFinto(iniziale: Record<string, string> = {}) {
  const dati = { ...iniziale };
  const a: ArchivioChiavi = {
    get: async (k) => dati[k] ?? null,
    set: async (k, v) => {
      dati[k] = v;
    },
    remove: async (k) => {
      delete dati[k];
    },
  };
  return { dati, fabbrica: async () => a };
}

describe('TokenNativo', () => {
  test('carica il token salvato nell archivio', async () => {
    const { fabbrica } = archivioFinto({ t: 'abc' });
    const tok = new TokenNativo('t', fabbrica);
    expect(tok.leggi()).toBeNull();
    await tok.carica();
    expect(tok.leggi()).toBe('abc');
  });

  test('scrive e cancella nell archivio', async () => {
    const { dati, fabbrica } = archivioFinto();
    const tok = new TokenNativo('t', fabbrica);
    tok.scrivi('nuovo');
    await new Promise((r) => setTimeout(r, 0));
    expect(dati.t).toBe('nuovo');
    tok.scrivi(null);
    await new Promise((r) => setTimeout(r, 0));
    expect('t' in dati).toBe(false);
    expect(tok.leggi()).toBeNull();
  });

  test('un logout durante il caricamento non fa tornare il token vecchio', async () => {
    const { fabbrica } = archivioFinto({ t: 'vecchio' });
    const tok = new TokenNativo('t', fabbrica);
    const attesa = tok.carica();
    tok.scrivi(null);
    await attesa;
    expect(tok.leggi()).toBeNull();
  });

  test('archivio rotto: nessuna sessione, nessun errore', async () => {
    const tok = new TokenNativo('t', async () => {
      throw new Error('niente plugin');
    });
    await tok.carica();
    expect(tok.leggi()).toBeNull();
  });
});
