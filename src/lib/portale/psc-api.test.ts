import { apriLinkPsc, controllaFilePsc, mappaPscPubblico, mappaRichiestaPsc, richiestePsc, TOKEN_PSC } from './psc-api';
import { mappaCantiere } from './documenti-api';

describe('carica il PSC', () => {
  it('riconosce solo i token del backend e rifiuta il resto senza chiamare il server', async () => {
    expect(TOKEN_PSC.test('psc_' + 'aB3'.repeat(14) + 'xy')).toBe(true);
    expect(TOKEN_PSC.test('cond_' + 'a'.repeat(44))).toBe(false);
    await expect(apriLinkPsc('psc_corto')).rejects.toThrow(/non valido/);
  });

  it('controlla formato e dimensione prima di inviare', () => {
    expect(controllaFilePsc('psc.pdf', 1000)).toBeNull();
    expect(controllaFilePsc('PSC.DOCX', 1000)).toBeNull();
    expect(controllaFilePsc('psc.exe', 1000)).toMatch(/PDF o Word/);
    expect(controllaFilePsc('psc.pdf', 21 * 1024 * 1024)).toMatch(/20 MB/);
    expect(controllaFilePsc('psc.pdf', 0)).toMatch(/vuoto/);
  });

  it('mappa la vista pubblica e le richieste in modo tollerante', () => {
    expect(mappaPscPubblico({ cantiere: 'Scuola', aperta: true }).aperta).toBe(true);
    expect(mappaPscPubblico(null).aperta).toBe(false);
    expect(mappaRichiestaPsc({ id: 3, destinatario: 'CSP', stato: 'caricato' })?.stato).toBe('caricato');
    expect(mappaRichiestaPsc({ id: 3, stato: 'strano' })?.stato).toBe('in_attesa');
    expect(mappaRichiestaPsc({})).toBeNull();
  });

  it('il cantiere sa se ha già il PSC', () => {
    expect(mappaCantiere({ id: 1, psc_document_id: 9 })?.haPsc).toBe(true);
    expect(mappaCantiere({ id: 1, psc_document_id: null })?.haPsc).toBe(false);
  });

  it('fuori dalla modalità API nessuna richiesta', async () => {
    expect(await richiestePsc(1)).toEqual([]);
  });
});
