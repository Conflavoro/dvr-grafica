import {
  FILTRO_TABELLA,
  filtraTabella,
  filtriAttivi,
  tonoFascicolo,
  ultimoContatto,
  regoleCaso,
  chipRinnovo,
  colonnaDi,
  differenzaRinnovo,
  etaNelloStato,
  linkVediComeCliente,
  mappaPermessi,
  mappaRinnovo,
  puoStaff,
  riepilogoFasi,
  statoVediComeCliente,
} from './gestionale-permessi';

const tecnico = mappaPermessi({ ruolo: 'tecnico', etichetta: 'Tecnico', esterno: false, sezioni: ['home', 'aziende'], permessi: ['approvaProposte', 'vediComeCliente', 'firmaDvr'] });
const vendite = mappaPermessi({ ruolo: 'vendite', etichetta: 'Vendite', sezioni: ['home'], permessi: ['creaPreventivo', 'vediContratti'] });

describe('permessi dello staff', () => {
  it('legge la risposta del server e risponde per permesso', () => {
    expect(tecnico.ruolo).toBe('tecnico');
    expect(puoStaff(tecnico, 'firmaDvr')).toBe(true);
    expect(puoStaff(tecnico, 'assegnaTecnico')).toBe(false);
    expect(puoStaff(vendite, 'approvaProposte')).toBe(false);
    expect(mappaPermessi(null).permessi).toEqual([]);
  });

  it('vedi come il cliente: solo con il permesso e con un\'area cliente', () => {
    expect(statoVediComeCliente(vendite, true)).toEqual({ attivo: false, motivo: 'Il tuo ruolo non può aprire l’area del cliente' });
    expect(statoVediComeCliente(tecnico, true)).toEqual({ attivo: true, motivo: null });
    expect(statoVediComeCliente(tecnico, false).attivo).toBe(false);
    expect(linkVediComeCliente(7, '/gestionale/aziende/?id=7')).toBe('/azienda/dashboard/?come=isfor&az=7&da=%2Fgestionale%2Faziende%2F%3Fid%3D7');
  });
});

describe('avanzamento dei preventivi', () => {
  it('accettato dal server va tra i firmati, perso fuori dalle colonne', () => {
    expect(colonnaDi('accettato')).toBe('firmato');
    expect(colonnaDi('bozza')).toBe('bozza');
    expect(colonnaDi('perso')).toBeNull();
  });
  it('età nello stato, rossa oltre 5 giorni da inviato e 3 da firmato', () => {
    expect(etaNelloStato('bozza', 0)).toEqual({ testo: 'Da oggi', rosso: false });
    expect(etaNelloStato('inviato', 1)).toEqual({ testo: 'Da 1 giorno', rosso: false });
    expect(etaNelloStato('inviato', 6).rosso).toBe(true);
    expect(etaNelloStato('inviato', 5).rosso).toBe(false);
    expect(etaNelloStato('firmato', 4)).toEqual({ testo: 'Da 4 giorni', rosso: true });
    expect(etaNelloStato('bozza', 40).rosso).toBe(false);
  });
});

describe('rinnovi a 90 giorni', () => {
  it('chip dei giorni: ambra entro 30', () => {
    expect(chipRinnovo(37)).toEqual({ testo: 'tra 37 giorni', tono: 'neutral' });
    expect(chipRinnovo(30).tono).toBe('warn');
  });
  it('differenza del canone al rinnovo', () => {
    expect(differenzaRinnovo(19.8, 29.7)).toEqual({ testo: '+9,90 €', aumenta: true });
    expect(differenzaRinnovo(19.8, 19.8)).toEqual({ testo: 'invariato', aumenta: false });
    expect(differenzaRinnovo(undefined, 10)).toBeNull();
  });
  it('mappa la riga e tiene i canoni solo se il server li manda', () => {
    const r = mappaRinnovo({ azienda: { id: 3, nome: 'Officina', comune: 'Lucca' }, rinnovo_il: '2026-11-20', giorni: 37, disdetta_entro: '2026-09-21', disdetta_passata: true, elenco: 3 });
    expect(r?.disdettaPassata).toBe(true);
    expect(r && 'canoneOra' in r).toBe(false);
    expect(mappaRinnovo({ azienda: { id: 3 } })).toBeNull();
  });
});

describe('ore per persona', () => {
  it('riepilogo delle fasi', () => {
    const d = (m: number) => `${m} min`;
    expect(riepilogoFasi([], d)).toBe('Nessuna ora registrata');
    expect(riepilogoFasi([{ fase: 'sopralluogo', nome: 'Sopralluogo', minuti: 90 }, { fase: 'avvio', nome: 'Avvio', minuti: 30 }], d)).toBe('Sopralluogo 90 min · Avvio 30 min');
  });
});

describe('nuovi assunti: regole applicate', () => {
  const d = (x: string | null) => (x ? x.split('-').reverse().join('/') : '');
  it('nuovo assunto con quota da pagare e lingua straniera', () => {
    const r = regoleCaso({ rischio: 'medio', conVisita: true, nonDichiarato: false, quotaImporto: 149, quotaPagata: false, unilav: true, dal: '2026-10-20', cellulare: true, lingua: 'ar', nomeLingua: 'arabo' }, d);
    expect(r[0]).toEqual({ testo: 'Quota d’ingresso: rischio medio con visita preventiva, 149,00 € (formazione iniziale di 12 ore)', codice: 'BR-21, BR-22' });
    expect(r.map((x) => x.codice)).toEqual(['BR-21, BR-22', 'BR-24, TR-11', 'BR-25', 'BR-108, TR-07']);
    expect(r[2].testo).toBe('Comunicazione di assunzione ricevuta: in servizio dal 20/10/2026, dopo la data di ingresso');
  });
  it('non dichiarato: conguaglio 118,80 €', () => {
    const r = regoleCaso({ rischio: 'alto', conVisita: true, nonDichiarato: true, quotaImporto: 0, quotaPagata: false, unilav: false, dal: null, cellulare: false, lingua: 'it' }, d);
    expect(r[0].testo).toBe('Lavoratore già in forza non dichiarato: conguaglio pari alla tariffa annua 118,80 €');
  });
});

describe('elenco aziende a tabella', () => {
  const base = { partita_iva: '', comune: 'Lucca', ateco_label: 'Metalmeccanica', tecnico: null, entro30: 0 };
  const righe = [
    { ...base, id: 1, ragione_sociale: 'Bar Centrale', lavoratori: 3, scadute: 0, statoAzienda: 'attiva', completezza: 90 },
    { ...base, id: 2, ragione_sociale: 'Autofficina', lavoratori: 9, scadute: 2, statoAzienda: 'avvio', completezza: 50 },
    { ...base, id: 3, ragione_sociale: 'Cantina', lavoratori: 9, scadute: 1, statoAzienda: 'attiva', completezza: 70 },
  ];
  it('nome crescente al primo clic, numeri decrescenti, a parità per nome', () => {
    expect(filtraTabella(righe, FILTRO_TABELLA).map((r) => r.id)).toEqual([2, 1, 3]);
    expect(filtraTabella(righe, { ...FILTRO_TABELLA, ordine: { col: 'lavoratori', inverso: false } }).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(filtraTabella(righe, { ...FILTRO_TABELLA, ordine: { col: 'scadute', inverso: true } }).map((r) => r.id)).toEqual([1, 3, 2]);
  });
  it('filtri per stato e solo con scadenze superate', () => {
    expect(filtraTabella(righe, { ...FILTRO_TABELLA, stato: 'attiva' }).map((r) => r.id)).toEqual([1, 3]);
    expect(filtraTabella(righe, { ...FILTRO_TABELLA, soloScadute: true }).length).toBe(2);
    expect(filtriAttivi({ ...FILTRO_TABELLA, ordine: { col: 'canone', inverso: true } })).toBe(false);
  });
  it('fascicolo e ultimo contatto', () => {
    expect([tonoFascicolo(85), tonoFascicolo(60), tonoFascicolo(59)]).toEqual(['grafite', 'utenti', 'ambra']);
    const ora = new Date('2026-10-14T10:00:00');
    expect(ultimoContatto('2026-10-14T08:00:00', ora)?.testo).toBe('oggi');
    expect(ultimoContatto('2026-10-13T08:00:00', ora)?.testo).toBe('ieri');
    expect(ultimoContatto('2026-09-01T08:00:00', ora)).toEqual({ testo: '43 giorni fa', ambra: true });
  });
});
