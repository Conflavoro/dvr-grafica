import { apriCondivisione, giorniAllaScadenza, mappaCondivisione, totaleDocumenti, TOKEN_CONDIVISIONE } from './condivisione-api';

describe('condivisione pubblica del fascicolo', () => {
  it('riconosce solo i token nel formato del backend', () => {
    expect(TOKEN_CONDIVISIONE.test('cond_' + 'A1'.repeat(22))).toBe(true);
    expect(TOKEN_CONDIVISIONE.test('cond_corto')).toBe(false);
    expect(TOKEN_CONDIVISIONE.test('lav_' + 'a'.repeat(44))).toBe(false);
  });

  it('rifiuta un link sbagliato senza chiamare il server', async () => {
    await expect(apriCondivisione('cond_x')).rejects.toThrow(/non valido/);
  });

  it('mappa la risposta in modo tollerante', () => {
    const c = mappaCondivisione({
      azienda: 'Trattoria Prova',
      destinatario: 'ASL',
      scade_il: '2026-11-15T10:00:00+01:00',
      link_validi_minuti: 15,
      cartelle: [
        { chiave: 'valutazione_rischi', nome: 'Valutazione dei rischi', documenti: [{ titolo: 'DVR', versione: 3, link: 'https://x/y' }, { nessuno: true }] },
        { nome: 'senza chiave' },
        null,
      ],
    });
    expect(c.cartelle).toHaveLength(1);
    expect(c.cartelle[0].documenti).toEqual([{ titolo: 'DVR', data: null, versione: '3', stato: null, link: 'https://x/y' }]);
    expect(totaleDocumenti(c)).toBe(1);
    expect(mappaCondivisione(null).azienda).toBe('Azienda');
  });

  it('conta i giorni che mancano alla scadenza', () => {
    const oggi = new Date(2026, 10, 10, 18, 0);
    expect(giorniAllaScadenza('2026-11-15T09:00:00', oggi)).toBe(5);
    expect(giorniAllaScadenza('2026-11-10T08:00:00', oggi)).toBe(0);
    expect(giorniAllaScadenza(null, oggi)).toBeNull();
    expect(giorniAllaScadenza('boh', oggi)).toBeNull();
  });
});
