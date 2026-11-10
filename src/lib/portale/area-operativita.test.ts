import { giorniMese, giornoScelto, testoChip } from './area-logica';
import { erroriPromemoria, hrefArea, mappaHome, mappaPromemoria, mappaValutazione, mappaVoceDaFare } from './area-operativita';

describe('operativita delle persone', () => {
  it('mappa le voci di Da fare e scarta quelle senza testo', () => {
    expect(mappaVoceDaFare({ testo: '' })).toBeNull();
    const v = mappaVoceDaFare({ chiave: 'visita:3', categoria: 'visite', testo: 'Prenota la prima visita di Pia Nuova', pulsante: 'Prenota', urg: 2, azione: { tipo: 'prenota', lavoratore_id: 3 } })!;
    expect(v.azione).toEqual({ tipo: 'prenota', lavoratore_id: 3 });
    expect(v.urg).toBe(2);
    expect(mappaVoceDaFare({ testo: 'x' })!.pulsante).toBe('Apri');
  });
  it('porta le rotte della specifica nelle pagine dell area azienda', () => {
    expect(hrefArea('persone/elenco/12')).toBe('/azienda/persone/?vista=elenco%2F12');
    expect(hrefArea('scadenze')).toBe('/azienda/scadenze/');
    expect(hrefArea(null)).toBe('/azienda/dashboard/');
  });
  it('mappa la home in modo tollerante', () => {
    const h = mappaHome({ data: { da_fare: [{ testo: 'a' }, null], indicatori: { visite: { ok: 1, totale: 2 } }, azioni_rapide: [{ k: 'assumi', testo: 'Comunica un nuovo assunto' }, { k: 'altro' }] } });
    expect(h.daFare).toHaveLength(1);
    expect(h.indicatori.visite).toEqual({ ok: 1, totale: 2, inCalendario: 0 });
    expect(h.azioniRapide.map((x) => x.k)).toEqual(['assumi']);
    expect(h.referente).toBeNull();
  });
  it('controlla il foglio dei promemoria come il server', () => {
    expect(erroriPromemoria({ canali: [], destinatari: ['titolare'] })).toEqual({ canali: 'Scegli almeno un canale, altrimenti non ricevi nessun avviso.' });
    expect(erroriPromemoria({ canali: ['email'], destinatari: [] })).toEqual({ destinatari: 'Scegli almeno una persona che riceve i promemoria.' });
    expect(mappaPromemoria({ anticipi: [90, 45, '30'], allarme: 1 }).anticipi).toEqual([90, 30]);
  });
  it('mappa rischio, visita e domande del nuovo assunto', () => {
    const v = mappaValutazione({ data: { rischio: 'basso', visita: false, domande: [{ chiave: 'vdt', testo: 'Usa il computer più di 20 ore a settimana?', risposta: false }], quota: 49 } });
    expect(v.domande[0].chiave).toBe('vdt');
    expect(v.quota).toBe(49);
  });
  it('calendario da lunedi e giorno scelto', () => {
    // Ottobre 2026 inizia di giovedi': tre celle vuote.
    const g = giorniMese(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g.filter(Boolean)).toHaveLength(31);
    expect(giornoScelto(['2026-10-01', '2026-10-20'], null, '2026-10-14')).toBe('2026-10-20');
    expect(giornoScelto(['2026-10-01'], null, '2026-10-14')).toBe('2026-10-01');
    expect(giornoScelto(['2026-10-01', '2026-10-20'], '2026-10-01', '2026-10-14')).toBe('2026-10-01');
  });
  it('la visita fissata e il contratto hanno il chip della specifica', () => {
    expect(testoChip({ fase: 'prenotata', data: '2026-10-20', categoria: 'visite' })).toBe('Prenotata');
    expect(testoChip({ fase: 'da_prenotare', data: '2026-10-31', categoria: 'contratto' })).toBe('Da rinnovare');
  });
});
