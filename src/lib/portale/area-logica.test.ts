import { bloccoData, dataOra, filtraPersone, filtraVoci, giorniTesto, perMese, pulisciCellulare, testoChip, validaAssunto } from './area-logica';
import { mappaAntincendio, mappaScadenziario, mappaSchedaPersona, mappaVoce, type RigaPersona, type VoceScadenza } from './area-api';

const voce = (p: Partial<VoceScadenza>): VoceScadenza => ({
  chiave: p.titolo ?? 'x', categoria: 'visite', titolo: 'x', sotto: '', data: null, giorni: null, fase: 'da_prenotare', stato: 'todo', allarme: false,
  lavoratoreId: null, scadenzaId: null, appuntamento: null, inAttesaPagamento: false, corso: null, azione: 'vedi', link: null, ...p,
});

describe('scadenziario', () => {
  it('raggruppa per mese con le voci senza data in testa', () => {
    const g = perMese([voce({ titolo: 'b', data: '2026-11-03' }), voce({ titolo: 'a', data: '2026-10-20', fase: 'scaduta' }), voce({ titolo: 'c' })]);
    expect(g.map((x) => x.titolo)).toEqual(['Mai fatte, senza data', 'ottobre 2026', 'novembre 2026']);
    expect(g[1].scadute).toBe(1);
  });
  it('filtra per categoria e fase', () => {
    const v = [voce({ categoria: 'visite' }), voce({ categoria: 'formazione', fase: 'scaduta' }), voce({ categoria: 'antincendio' })];
    expect(filtraVoci(v, ['formazione', 'antincendio'], null)).toHaveLength(2);
    expect(filtraVoci(v, [], 'scaduta')).toHaveLength(1);
  });
  it('dà il testo del chip come il prototipo', () => {
    expect(testoChip({ fase: 'da_prenotare', data: null, categoria: 'visite' })).toBe('Mai fatta');
    expect(testoChip({ fase: 'da_prenotare', data: '2026-10-20', categoria: 'documenti' })).toBe('Da aggiornare');
    expect(testoChip({ fase: 'prenotata', data: '2026-10-20', categoria: 'visite' })).toBe('Prenotata');
    expect(giorniTesto(-3)).toBe('scaduta da 3 giorni');
    expect(giorniTesto(1)).toBe('tra 1 giorno');
    expect(bloccoData('2026-10-22')).toEqual({ giorno: '22', mese: 'ott' });
    expect(dataOra('2026-10-26 09:30')).toBe('26/10/2026 alle 09:30');
  });
  it('mappa le risposte in modo tollerante', () => {
    expect(mappaVoce({ titolo: '' })).toBeNull();
    const v = mappaVoce({ titolo: 'Prima visita', categoria: 'strana', fase: 'boh', stato: 'xx', allarme: 1 })!;
    expect(v.categoria).toBe('altro');
    expect(v.fase).toBe('da_prenotare');
    expect(v.stato).toBe('todo');
    expect(v.allarme).toBe(true);
    const s = mappaScadenziario({ data: { contatori: { scadute: '2' }, categorie: { visite: 'Visite' }, voci: [{ titolo: 'a' }, null] } });
    expect(s.contatori.scadute).toBe(2);
    expect(s.categorie).toEqual([{ k: 'visite', t: 'Visite' }]);
    expect(s.voci).toHaveLength(1);
  });
});

describe('dipendenti', () => {
  it('controlla il nuovo assunto', () => {
    const oggi = new Date(2026, 9, 14);
    const ok = { nome: 'Marco', cognome: 'Nuovo', mansione: 'Aiuto cuoco', data: '2026-10-20', cellulare: '+39 333 123.4567', unilav: 'U-2026-1' };
    expect(validaAssunto(ok, oggi)).toEqual({});
    expect(pulisciCellulare('+39 333-123 4567')).toBe('3331234567');
    const e = validaAssunto({ ...ok, mansione: 'ab', data: '2027-01-30', cellulare: '0583123456', unilav: '' }, oggi);
    expect(Object.keys(e).sort()).toEqual(['cellulare', 'data', 'mansione', 'unilav']);
    expect(validaAssunto({ ...ok, data: '2025-01-01' }, oggi).data).toContain('segreteria');
  });
  it('filtra per testo, stato e rischio', () => {
    const r = (p: Partial<RigaPersona>): RigaPersona => ({ id: 1, nome: 'Luca Prova', mansione: 'Cuoco', reparto: 'Cucina', rischio: 'medio', assuntoIl: null, nuovo: false, sorveglianza: true, sorveglianzaDaDefinire: false, visita: null, corsiValidi: 0, corsiRichiesti: 2, stato: 'danger', statoTesto: '', quotaDaPagare: false, ...p });
    const righe = [r({}), r({ id: 2, nome: 'Anna', mansione: 'Cameriera', reparto: 'Sala', rischio: 'basso', stato: 'ok' })];
    expect(filtraPersone(righe, { testo: 'cucina', stato: 'tutti', rischio: '' }).map((x) => x.id)).toEqual([1]);
    expect(filtraPersone(righe, { testo: '', stato: 'ok', rischio: '' }).map((x) => x.id)).toEqual([2]);
    expect(filtraPersone(righe, { testo: '', stato: 'tutti', rischio: 'basso' }).map((x) => x.id)).toEqual([2]);
  });
  it('la scheda senza permesso sanitario non ha visita', () => {
    const s = mappaSchedaPersona({ data: { id: 3, nome: 'Luca', visita: null, visite_bloccate: true, corsi: null, stato: { stato: 'ok', testo: 'In regola' } } });
    expect(s.visita).toBeNull();
    expect(s.visiteBloccate).toBe(true);
    expect(s.corsi).toBeNull();
  });
});

describe('antincendio', () => {
  it('mappa presidi, livello e permessi', () => {
    const a = mappaAntincendio({ data: { livello: { numero: 2, nome: 'Livello 2', ore: 8 }, presidi: [{ id: 1, stato: 'da_riparare', chip: 'danger', descrizione: 'E1' }], permessi: { registra: true } } });
    expect(a.livello?.ore).toBe(8);
    expect(a.presidi[0].stato).toBe('da_riparare');
    expect(a.permessi).toEqual({ registra: true, manutentore: false, prenota: false });
    expect(mappaAntincendio({}).livello).toBeNull();
  });
});
