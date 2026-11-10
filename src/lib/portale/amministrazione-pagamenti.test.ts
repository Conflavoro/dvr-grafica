import { controllaCarta, controllaFirma, controllaSepa, erroriServer, euro, mappaAdesioni, mappaEsito } from './amministrazione-pagamenti';

describe('controlli dei fogli di pagamento e firma (stessi messaggi del server)', () => {
  it('carta: tutti gli errori insieme, spazi ignorati nel numero', () => {
    expect(controllaCarta({ numero: '123', scadenza: '1230', cvc: '1' })).toEqual({
      numero: 'Il numero ha 16 cifre.',
      scadenza: 'Scrivi la scadenza come MM/AA.',
      cvc: 'Il CVC ha 3 o 4 cifre.',
    });
    expect(controllaCarta({ numero: '4242 4242 4242 4242', scadenza: '12/30', cvc: '1234' })).toEqual({});
  });

  it('SEPA: intestatario, IBAN italiano di 27 caratteri, mandato', () => {
    expect(controllaSepa({ intestatario: 'Pi', iban: 'IT00', mandato: false })).toEqual({
      intestatario: 'Scrivi l\'intestatario del conto.',
      iban: 'Un IBAN italiano ha 27 caratteri e inizia con IT.',
      mandato: 'Serve la tua autorizzazione per addebitare il canone.',
    });
    expect(controllaSepa({ intestatario: 'Pizzeria', iban: 'it60 x054 2811 1010 0000 0123 456', mandato: true })).toEqual({});
  });

  it('firma: prima la casella, poi il codice di 6 cifre', () => {
    expect(controllaFirma(false, '12')).toBe('Spunta la casella per confermare di aver letto il documento.');
    expect(controllaFirma(true, '12345')).toBe('Il codice ha 6 cifre.');
    expect(controllaFirma(true, '123456')).toBeNull();
  });

  it('errori di campo dal server', () => {
    expect(erroriServer({ body: { message: 'x', errori: { numero: 'Il numero ha 16 cifre.' } } })).toEqual({ numero: 'Il numero ha 16 cifre.' });
    expect(erroriServer(new Error('x'))).toBeNull();
  });

  it('mappa esito e adesioni', () => {
    expect(mappaEsito({ id: 3, stato: 'richiesta_titolare', messaggio: 'Richiesta inviata', importo: 180 }).stato).toBe('richiesta_titolare');
    expect(mappaEsito({ stato: 'boh' }).stato).toBe('fallito');
    const a = mappaAdesioni({ entro: '2027-02-15', aperte: 0, stato: 'conguaglio_da_pagare', voci: [{ ente: 'ebiasp', nome: 'EBIASP', stato: 'non_risulta', etichetta: 'Non risulta', non_risulta: { conguaglio: 180, pagato: false, puo_pagare: true } }] });
    expect(a.stato).toBe('conguaglio_da_pagare');
    expect(a.voci[0].nonRisulta?.conguaglio).toBe(180);
    expect(euro(101.3)).toMatch(/101,30/);
  });
});
