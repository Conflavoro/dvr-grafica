import { euroC, ibanValido, mappaRisultato, mappaSimulazione, messaggioTessera, perGruppo, telefonoValido } from './simulatore-logica';
import { mappaAttivazione } from './simulatore-api';


const vista = (vecchio: number, abb: number | null, n = 12) => ({
  titolo: 'A regime',
  vecchio,
  abbonamento: abb,
  risparmio: abb === null ? null : vecchio - abb,
  risparmio_pct: abb === null ? null : Math.floor(((vecchio - abb) * 100) / vecchio),
  vecchio_lavoratore_mese: Math.floor(vecchio / (12 * n)),
  abbonamento_lavoratore_mese: abb === null ? null : Math.ceil(abb / (12 * n)),
});

const risultato = (abbRegime = 128160, tessera: Record<string, unknown> = { tipo: 'listino', con_visita: 990, senza_visita: 590, testo: '9,90 €' }) => ({
  profilo: { attivita: 'Ristorazione', rischio: 'alto', lavoratori: 12, con_visita: 9, senza_visita: 3, sedi_alimentari: 0, presunti: { socio: 'x' }, ebiasp: true, fondo: true, socio: true },
  obblighi: [{ code: 'OB-31', gruppo: 'formazione', titolo: 'Formazione dei lavoratori', quantita: 12, articolo: 'Art. 37', copertura: 'canone', presunto: false, fatture: { stato: 'parziale', stato_testo: 'Coperto 8 su 12', scoperto_listino: 7200 } }],
  sintesi_obblighi: { totale: 24, per_copertura: { canone: 21 }, presunti: 6 },
  confronto: {
    righe: [
      { code: 'OB-01', gruppo: 'documenti', titolo: 'DVR', quantita: 1, primo_anno: 95000, regime: 70000, fonte: 'stima' },
      { code: 'OB-31', gruppo: 'formazione', titolo: 'Formazione', quantita: 12, primo_anno: 240000, regime: 21600, fonte: 'stima' },
    ],
    fuori_confronto: [],
    viste: { primo_anno: vista(1069000, abbRegime), regime: vista(509050, abbRegime), media_5: vista(621040, abbRegime) },
    abbonamento: { offerta_standard: true, canone_mensile: 10680, quota_associativa: null, righe: [], risparmio_con_enti: null },
    tessera,
    stime: { nota: 'Stime da validare' },
    conto_onesto: null,
  },
  fatture: null,
  mancano: [{ campo: 'socio', domanda: 'Sei già socio Conflavoro?', scelte: [{ valore: true, testo: 'Sì' }, { valore: false, testo: 'No' }] }],
});

describe('simulatore', () => {
  it('scrive gli euro dai centesimi senza arrotondare', () => {
    expect(euroC(509050)).toBe('5.090,50 €');
    expect(euroC(128160)).toBe('1.281,60 €');
    expect(euroC(-21600)).toBe('-216,00 €');
    expect(euroC(99000, false)).toBe('990 €');
    expect(euroC(null)).toBe('');
  });

  it('mappa il risultato in modo tollerante', () => {
    const r = mappaRisultato(risultato());
    expect(r?.viste.regime.vecchio).toBe(509050);
    expect(r?.obblighi[0].fatture?.scoperto).toBe(7200);
    expect(r?.mancano[0].scelte).toHaveLength(2);
    expect(mappaRisultato({})).toBeNull();
    expect(mappaSimulazione({ token: 'sim_x', risultato: [] })?.risultato).toBeNull();
  });

  it('mette il mensile per lavoratore in testata (CP-01)', () => {
    const m = messaggioTessera(mappaRisultato(risultato())!);
    expect(m.vecchio).toBe('35,35 €');
    expect(m.nuovo).toBe('9,90 € e 5,90 €');
    expect(m.piu).toBe(false);
    const piu = messaggioTessera(mappaRisultato(risultato(600000, { tipo: 'media', media_lavoratore_mese: 4167 }))!);
    expect(piu.piu).toBe(true);
    expect(piu.nuovo).toBe('41,67 €');
  });

  it('somma per gruppo nella vista scelta', () => {
    const g = perGruppo(mappaRisultato(risultato())!, 'regime');
    expect(g[0]).toMatchObject({ gruppo: 'documenti', importo: 70000 });
    expect(perGruppo(mappaRisultato(risultato())!, 'primo_anno')[0].gruppo).toBe('formazione');
  });

  it('controlla telefono e IBAN come il server', () => {
    expect(telefonoValido('333 1234567')).toBe(true);
    expect(telefonoValido('12')).toBe(false);
    expect(ibanValido('IT60 X054 2811 1010 0000 0123 456')).toBe(true);
    expect(ibanValido('DE00')).toBe(false);
  });

  it('mappa lo stato dell\'attivazione', () => {
    const s = mappaAttivazione({ azienda_id: 3, passo: 2, passi: [{ chiave: 'documenti', nome: 'Documenti', fatto: true }], lavoratori: [{ id: 1, nome: 'Mario', mansione: 'Cuoco', visita: false, domande: [{ chiave: 'notte', testo: 'Lavora di notte?', risposta: false }] }],
      canone: { vuoto: false, mensile: 2980, annuo: 35760, righe: [{ voce: 'Lavoratori con visita medica', quantita: 2, unitario: 990, mensile: 1980 }] }, contratto: { voci: [['Canone', '29,80 €']] } });
    expect(s?.passo).toBe(2);
    expect(s?.lavoratori[0].visita).toBe(false);
    expect(s?.lavoratori[0].domande[0].chiave).toBe('notte');
    expect(s?.canone.righe[0].mensile).toBe(1980);
    expect(s?.contratto.voci[0]).toEqual(['Canone', '29,80 €']);
    expect(mappaAttivazione({})).toBeNull();
  });
});
