import { barretteGruppo, coseDaFare, erroriVerifica, traMesi, tuttiSi } from './luoghi-logica';
import type { ProdottoCassetta } from './luoghi-api';

const p = (codice: string, breve: string, stato: ProdottoCassetta['stato']): ProdottoCassetta => ({
  codice, breve, nome: breve, richiesti: 1, presenti: 1, scadenza: null, dura: true, ricomprare: false, stato, etichetta: '', chip: 'ok',
});

describe('primo soccorso, logica del foglio di verifica', () => {
  const prodotti = [p('guanti', 'Guanti sterili', 'ok'), p('ghiaccio', 'Ghiaccio pronto uso', 'scaduto'), p('cotone', 'Cotone idrofilo', 'manca')];

  it('conta le risposte mancanti con il testo della specifica', () => {
    expect(erroriVerifica(prodotti, {})?.testo).toBe('Rispondi per tutti i prodotti: ne mancano 3.');
    expect(erroriVerifica(prodotti, { guanti: { esito: 'si' }, cotone: { esito: 'manca' } })).toEqual({ testo: 'Rispondi per tutti i prodotti: ne manca 1.', righe: ['ghiaccio'] });
  });

  it('un prodotto scaduto non può essere segnato sì', () => {
    expect(erroriVerifica(prodotti, { guanti: { esito: 'si' }, ghiaccio: { esito: 'si' }, cotone: { esito: 'manca' } })?.testo).toBe(
      'Ghiaccio pronto uso: è scaduto. Segna “Sostituito” o “Manca o rovinato”.',
    );
    expect(erroriVerifica(prodotti, { guanti: { esito: 'si' }, ghiaccio: { esito: 'sostituito', scadenza: '2028-10-01' }, cotone: { esito: 'manca' } })).toBeNull();
  });

  it('segna tutti sì salta scaduti e mancanti', () => {
    expect(Object.keys(tuttiSi(prodotti, {}))).toEqual(['guanti']);
  });

  it('testi e calcoli di supporto', () => {
    expect(coseDaFare(1)).toBe('1 cosa da fare');
    expect(coseDaFare(3)).toBe('3 cose da fare');
    expect(traMesi(24, new Date(2026, 9, 14))).toBe('2028-10-14');
    expect(barretteGruppo('B')).toEqual([true, true, false]);
  });
});
