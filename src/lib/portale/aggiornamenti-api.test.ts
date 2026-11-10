import { etichettaDifferenza, inRitardo, mappaElenco, mappaImpatto, mappaImportazione, perAzienda, sintesiConteggi } from './aggiornamenti-api';
import { SEZIONI_AZIENDA, SEZIONI_GESTIONALE, gruppi, sezioniVisibili } from './sezioni';

describe('aggiornamenti: mappatori tolleranti', () => {
  it('mappa un impatto e scarta quelli senza id', () => {
    const i = mappaImpatto({ id: 3, azienda_id: 1, titolo: 'DVR da aggiornare', priorita: 'alta', stato: 'aperto', entro: '2026-11-19', documento: 'dvr', motivi: [{ etichetta: 'Nuovo lavoratore', testo: 'x' }] });
    expect(i?.priorita).toBe('alta');
    expect(i?.motivi[0].etichetta).toBe('Nuovo lavoratore');
    expect(mappaImpatto({ titolo: 'senza id' })).toBeNull();
    expect(mappaImpatto({ id: 1, azienda_id: 2, priorita: 'strana', stato: 'boh' })).toMatchObject({ priorita: 'media', stato: 'aperto', titolo: 'Aggiornamento' });
  });

  it('elenco con conteggi e cambiamenti', () => {
    const e = mappaElenco({ impatti: [{ id: 1, azienda_id: 1 }, null], cambiamenti: [{ id: 9, tipo: 'lavoratore_aggiunto', etichetta: 'Nuovo lavoratore', impatti: 4 }], conteggi: { aperti: 1, in_ritardo: 2 }, puo_decidere: true });
    expect(e.impatti).toHaveLength(1);
    expect(e.cambiamenti[0].impatti).toBe(4);
    expect(e.conteggi).toEqual({ aperti: 1, alta: 0, inRitardo: 2, cambiamenti: 0 });
    expect(e.puoDecidere).toBe(true);
    expect(mappaElenco(null).impatti).toEqual([]);
  });

  it('oltre il termine solo se attivo e con termine passato', () => {
    const oggi = new Date('2026-10-20T10:00:00');
    const base = mappaImpatto({ id: 1, azienda_id: 1, entro: '2026-10-19' })!;
    expect(inRitardo(base, oggi)).toBe(true);
    expect(inRitardo({ ...base, entro: '2026-10-20' }, oggi)).toBe(false);
    expect(inRitardo({ ...base, stato: 'chiuso' }, oggi)).toBe(false);
    expect(inRitardo({ ...base, entro: null }, oggi)).toBe(false);
  });

  it('raggruppa per azienda mantenendo l ordine', () => {
    const g = perAzienda([
      mappaImpatto({ id: 1, azienda_id: 2, ragione_sociale: 'B' })!,
      mappaImpatto({ id: 2, azienda_id: 1, ragione_sociale: 'A' })!,
      mappaImpatto({ id: 3, azienda_id: 2, ragione_sociale: 'B' })!,
    ]);
    expect(g.map((x) => [x.ragioneSociale, x.voci.map((v) => v.id)])).toEqual([['B', [1, 3]], ['A', [2]]]);
  });

  it('importazione: differenze, scartate e sintesi senza gli invariati', () => {
    const i = mappaImportazione({ id: 5, entita: 'presenze', stato: 'proposta', righe_totali: 4, differenze: [{ indice: 0, tipo: 'non_dichiarato', nome: 'F. Elenco', applica: true }], scartate: [{ riga: 3, motivo: 'Servono nome' }], conteggi: { presenze: 1, invariati: 7, assenze: 0 } });
    expect(i?.entita).toBe('presenze');
    expect(i?.differenze[0]).toMatchObject({ tipo: 'non_dichiarato', applica: true });
    expect(sintesiConteggi(i!.conteggi)).toBe('1 presenza');
    expect(sintesiConteggi({ nuovi: 2, cambi_mansione: 1 })).toBe('2 nuovi lavoratori, 1 cambio di mansione');
    expect(sintesiConteggi({ invariati: 3 })).toBe('nessuna differenza');
    expect(etichettaDifferenza('cambio_mansione')).toBe('Cambio di mansione');
    expect(etichettaDifferenza('altro_tipo')).toBe('altro tipo');
  });
});

describe('sezioni nuove', () => {
  it('Aggiornamenti sta nel gruppo Clienti del gestionale senza spezzare il gruppo', () => {
    const g = gruppi(SEZIONI_GESTIONALE).find((x) => x.titolo === 'Clienti');
    expect(g?.voci.map((v) => v.chiave)).toContain('aggiornamenti');
    expect(gruppi(SEZIONI_GESTIONALE).filter((x) => x.titolo === 'Clienti')).toHaveLength(1);
  });

  it('Importa dati: fuori dall app del cliente, resta nel gestionale', () => {
    expect(SEZIONI_AZIENDA.some((s) => s.chiave === 'importa')).toBe(false);
    expect(sezioniVisibili('azienda', { permessi: ['dipendenti_modifica'] }).map((s) => s.chiave)).not.toContain('importa');
    expect(SEZIONI_GESTIONALE.find((s) => s.chiave === 'importa')?.gruppo).toBe('Clienti');
  });
});
