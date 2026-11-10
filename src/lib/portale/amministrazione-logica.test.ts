import {
  chip,
  durata,
  esitoPresenza,
  euro,
  euroSegno,
  importoDaTesto,
  lunedi,
  minutiDaModulo,
  modalitaAmmesse,
  orarioPosto,
  quoteWallet,
  statoClasse,
  STATI_ORDINE,
} from './amministrazione-logica';
import { mappaClasse, mappaOrdine, mappaSaldo, mappaVoceDaPrenotare } from './amministrazione-api';

describe('importi e durate', () => {
  it('formatta gli euro con la virgola e il segno dei movimenti', () => {
    expect(euro(1234.5)).toBe('1.234,50 €');
    expect(euro(null)).toBe('n.d.');
    expect(euroSegno(50)).toBe('+ 50,00 €');
    expect(euroSegno(-12)).toBe('− 12,00 €');
  });

  it('legge gli importi scritti a mano', () => {
    expect(importoDaTesto('12,50')).toBe(12.5);
    expect(importoDaTesto('1.250,00 €')).toBe(1250);
    expect(importoDaTesto('abc')).toBeNull();
    expect(importoDaTesto('3,456')).toBeNull();
  });

  it('durate e modulo delle ore', () => {
    expect(durata(90)).toBe('1 h 30 min');
    expect(durata(45)).toBe('45 min');
    expect(durata(120)).toBe('2 h');
    expect(minutiDaModulo(0, 0).errore).toBe('Indica una durata');
    expect(minutiDaModulo(12, 5).errore).toBe('Massimo 12 ore per voce');
    expect(minutiDaModulo(1, 30)).toEqual({ minuti: 90, errore: null });
  });
});

describe('giornate e settimane', () => {
  it('orario del posto a passo', () => {
    expect(orarioPosto('08:30', 0, 20)).toBe('08:30');
    expect(orarioPosto('08:30', 2, 20)).toBe('09:10');
    expect(orarioPosto('11:50', 1, 15)).toBe('12:05');
  });

  it('lunedi della settimana', () => {
    expect(lunedi('2026-10-14')).toBe('2026-10-12');
    expect(lunedi('2026-10-12')).toBe('2026-10-12');
    expect(lunedi('2026-10-18')).toBe('2026-10-12');
  });
});

describe('stati e regole', () => {
  it('chip con ripiego leggibile', () => {
    expect(chip(STATI_ORDINE, 'da_approvare')).toEqual(['approve', 'Da approvare']);
    expect(chip(STATI_ORDINE, 'strano_stato')).toEqual(['neutral', 'strano stato']);
    expect(statoClasse('programmata', true)[1]).toBe('Oggi in aula');
    expect(statoClasse('programmata', false)[1]).toBe('Convocazioni inviate');
  });

  it('modalita ammesse dal catalogo e soglia del 90%', () => {
    const corsi = [{ tipo: 'antincendio_1', modalita: ['aula'] }, { tipo: 'generale', modalita: ['elearning', 'aula', 'videoconferenza'] }];
    expect(modalitaAmmesse(corsi, 'antincendio_1')).toEqual(['aula']);
    expect(modalitaAmmesse(corsi, 'generale')).toEqual(['aula', 'videoconferenza', 'elearning']);
    expect(modalitaAmmesse(corsi, 'sconosciuto')).toEqual([]);
    expect(esitoPresenza(89, 'superata')).toBe('non_ammesso');
    expect(esitoPresenza(90, 'superata')).toBe('superata');
  });

  it('quote della barra del wallet', () => {
    expect(quoteWallet(75, 25)).toEqual({ fondi: 75, omaggio: 25 });
    expect(quoteWallet(0, 0)).toEqual({ fondi: 0, omaggio: 0 });
    expect(quoteWallet(-10, 5)).toEqual({ fondi: 0, omaggio: 100 });
  });
});

describe('mappatori tolleranti', () => {
  it('una risposta con campi mancanti non rompe la pagina', () => {
    expect(mappaVoceDaPrenotare({})).toBeNull();
    expect(mappaVoceDaPrenotare({ scadenza_id: '7', tipo: 'formazione' })?.tipo).toBe('formazione');
    const c = mappaClasse({ id: 3, iscritti: [{ iscritto_id: 1, attestato: { codice: 'ATT-1', documento_id: 9 } }, null] });
    expect(c.iscritti[0].attestato?.documento_id).toBe(9);
    expect(c.iscritti[1].attestato).toBeNull();
    expect(mappaOrdine({ importo: 'x' }).importo).toBeNull();
    expect(mappaSaldo({ fondi: 10, lotti: [{ id: 1, ambiti: ['servizi'] }] }).lotti[0].ambiti).toEqual(['servizi']);
  });
});
