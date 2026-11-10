import { bloccati, cantiereVuoto, erroriPasso, statoOrdine, titoloBloccati } from './servizi-logica';
import type { LavoratoreOrdine } from './servizi-api';

const lav = (id: number, esito: LavoratoreOrdine['esito']): LavoratoreOrdine => ({ id, nome: `L${id}`, mansione: null, esito, blocchi: [], avvisi: [], gliServe: false });

describe('foglio POS a 4 passi', () => {
  it('passo 1: errori della specifica, fine prima dell inizio', () => {
    const d = { ...cantiereVuoto(), inizio: '2026-10-20', fine: '2026-10-01' };
    expect(erroriPasso(0, d, false, [])).toEqual({
      indirizzo: 'Scrivi l\'indirizzo del cantiere.',
      committente: 'Scrivi chi è il committente.',
      fine: 'La fine dei lavori è prima dell\'inizio.',
      attivita: 'Descrivi in breve cosa fate in cantiere.',
    });
  });

  it('passo 2: almeno un lavoratore, i bloccati si tolgono o si conferma', () => {
    const tutti = [lav(1, 'blocco'), lav(2, 'ok')];
    expect(erroriPasso(1, cantiereVuoto(), false, tutti).lavoratori).toBe('Scegli almeno un lavoratore.');
    const d = { ...cantiereVuoto(), lavoratori: [1, 2] };
    expect(erroriPasso(1, d, false, tutti).lavoratori).toBe('Togli i lavoratori non in regola oppure conferma che vuoi procedere.');
    expect(erroriPasso(1, { ...d, procedi: true }, false, tutti)).toEqual({});
    expect(bloccati(tutti, [2])).toEqual([]);
    expect(titoloBloccati(1)).toBe('1 lavoratore non può entrare in cantiere');
    expect(titoloBloccati(3)).toBe('3 lavoratori non possono entrare in cantiere');
  });

  it('passo 3: PSC caricato da me e ponteggio con il PiMUS', () => {
    const e = erroriPasso(2, { ...cantiereVuoto(), pscModo: 'io' }, true, []);
    expect(e).toEqual({ psc: 'Carica il PSC, oppure scegli «Lo carica il coordinatore».', ponteggio: 'Indica marca e modello del ponteggio.', libretto: 'Carica il libretto del ponteggio.' });
    expect(erroriPasso(2, cantiereVuoto(), false, [])).toEqual({});
  });

  it('stati dell ordine con il testo breve del telefono', () => {
    expect(statoOrdine('attesa_bonifico')).toEqual({ chip: 'warn', testo: 'In attesa del bonifico' });
    expect(statoOrdine('attesa_bonifico', true).testo).toBe('Attesa bonifico');
  });
});
