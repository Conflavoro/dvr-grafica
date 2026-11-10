import {
  TOKEN_INVITO,
  controllaPassword,
  giornoChat,
  gruppoDi,
  mappaCartella,
  mappaConversazione,
  mappaDocumento,
  mappaMessaggio,
  mappaPronto,
  mappaUtente,
  ordinaUtenti,
  percentualeAvvio,
  mappaAvvio,
  raggruppa,
  secondiAllaRichiamata,
  sembraSanitario,
  statoCondivisione,
  validaCaricamento,
  type Condivisione,
} from './azienda-account-api';

describe('documenti emessi', () => {
  it('raggruppa per tipo con il genere del backend', () => {
    expect(gruppoDi('dvr')).toBe('dvr');
    expect(gruppoDi('valutazione_rumore')).toBe('valutazioni');
    expect(gruppoDi('radon')).toBe('valutazioni');
    expect(gruppoDi('sopralluogo')).toBe('verbali');
    expect(gruppoDi('riunione')).toBe('verbali');
    expect(gruppoDi('haccp')).toBe('haccp');
    expect(gruppoDi('emergenza')).toBe('emergenza');
    expect(gruppoDi('sconosciuto')).toBe('altro');
  });

  it('mappa e ordina, scarta righe senza id o tipo valido', () => {
    const a = mappaDocumento({ tipo: 'dvr', id: 3, titolo: 'DVR versione 2', genere: 'dvr', revisione: 2, emesso_il: '2026-09-01T10:00:00Z', download: { pdf: '/api/x.pdf', docx: '/api/x.docx' } });
    const b = mappaDocumento({ tipo: 'dvr', id: 4, titolo: 'DVR versione 3', genere: 'dvr', revisione: 3, emesso_il: '2026-10-01T10:00:00Z', download: {} });
    const c = mappaDocumento({ tipo: 'documento', id: 9, genere: 'nomina', revisione: 1 });
    expect(mappaDocumento({ tipo: 'bozza', id: 1 })).toBeNull();
    expect(mappaDocumento({ tipo: 'dvr' })).toBeNull();
    expect(a?.pdf).toBe('/api/x.pdf');
    expect(b?.docx).toBeNull();
    const g = raggruppa([a!, b!, c!]);
    expect(g.map((x) => x.gruppo)).toEqual(['dvr', 'nomine']);
    expect(g[0].voci.map((v) => v.id)).toEqual([4, 3]);
  });
});

describe('fascicolo e caricamenti', () => {
  it('distingue i documenti caricati da quelli della piattaforma', () => {
    const c = mappaCartella({ chiave: 'valutazione_rischi', nome: 'Valutazione dei rischi', documenti: 2, elementi: [{ id: 12, virtuale: false, titolo: 'Planimetria', ha_file: true }, { id: 'dvr:3', virtuale: true, titolo: 'DVR' }] });
    expect(c?.voci.map((v) => v.caricato)).toEqual([true, false]);
    expect(mappaCartella({})).toBeNull();
  });

  it('valida il modulo come il server', () => {
    const file = { size: 1000, name: 'a.pdf' } as File;
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'N', file }, '2026-10-16')).toMatch(/nome del documento/);
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'Nomina RSPP', data: '2026-10-20', file }, '2026-10-16')).toMatch(/futura/);
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'Nomina RSPP', data: '2026-05-10', scadenza: '2026-05-01', file }, '2026-10-16')).toMatch(/dopo/);
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'Nomina RSPP' }, '2026-10-16')).toMatch(/file/);
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'Nomina RSPP', file: { size: 25 * 1024 * 1024 } as File }, '2026-10-16')).toMatch(/20 MB/);
    expect(validaCaricamento({ cartella: 'nomine', titolo: 'Nomina RSPP', data: '2026-05-10', scadenza: '2027-05-10', file }, '2026-10-16')).toBeNull();
  });

  it('riconosce i nomi da documento sanitario, non la nomina o il protocollo', () => {
    expect(sembraSanitario('giudizio_idoneita_mario.pdf')).toBe(true);
    expect(sembraSanitario('Referto esami')).toBe(true);
    expect(sembraSanitario('Nomina del medico competente')).toBe(false);
    expect(sembraSanitario('Protocollo sanitario 2026')).toBe(false);
    expect(sembraSanitario('Planimetria dei locali')).toBe(false);
  });
});

describe('condivisioni', () => {
  const base: Condivisione = { id: 1, cartelle: ['nomine'], destinatario: 'ASL', motivo: null, scadeIl: null, valida: true, revocata: false, aperture: 0 };
  const ora = new Date('2026-10-16T10:00:00Z');
  it('stato del link: attivo, scade presto, scaduto, revocato', () => {
    expect(statoCondivisione({ ...base, scadeIl: '2026-11-30T22:00:00Z' }, ora)).toBe('attivo');
    expect(statoCondivisione({ ...base, scadeIl: '2026-10-20T22:00:00Z' }, ora)).toBe('presto');
    expect(statoCondivisione({ ...base, valida: false, scadeIl: '2026-10-01T22:00:00Z' }, ora)).toBe('scaduto');
    expect(statoCondivisione({ ...base, revocata: true, valida: false }, ora)).toBe('revocato');
  });
});

describe('utenti e invito', () => {
  it('stato dell utente e ordine: attivi, invitati, revocati; titolare in cima', () => {
    const u = [
      mappaUtente({ id: 5, nome: 'Zeno', ruolo: 'referente', stato: 'revocato' })!,
      mappaUtente({ id: 4, nome: 'Anna', ruolo: 'referente', stato: 'invitato', invito_scade_il: '2026-10-20' })!,
      mappaUtente({ id: null, nome: 'Mario', ruolo: 'titolare', stato: 'attivo' })!,
      mappaUtente({ id: 6, nome: 'Bruno', ruolo: 'consulente_lavoro', attivo: true })!,
    ];
    expect(ordinaUtenti(u).map((x) => x.nome)).toEqual(['Mario', 'Bruno', 'Anna', 'Zeno']);
    expect(mappaUtente({ nome: 'x' })).toBeNull();
  });

  it('token del link e regole della password', () => {
    expect(TOKEN_INVITO.test('inv_' + 'a'.repeat(40))).toBe(true);
    expect(TOKEN_INVITO.test('inv_corto')).toBe(false);
    expect(controllaPassword('Corta12345', 'Corta12345')).toMatch(/12 caratteri/);
    expect(controllaPassword('solamentelettere', 'solamentelettere')).toMatch(/lettere e numeri/);
    expect(controllaPassword('PasswordSicura2026', 'PasswordSicura2027')).toMatch(/coincidono/);
    expect(controllaPassword('PasswordSicura2026', 'PasswordSicura2026')).toBeNull();
  });
});

describe('avvio e Pronto Ispezioni', () => {
  it('percentuale dei passi, il passo in corso vale mezzo', () => {
    const s = mappaAvvio({ passi: [{ numero: 1, stato: 'fatto' }, { numero: 2, stato: 'in_corso' }, { numero: 3, stato: 'da_fare' }, { numero: 4, stato: 'da_fare' }] });
    expect(percentualeAvvio(s)).toBe(38);
    expect(percentualeAvvio(mappaAvvio({}))).toBe(0);
  });

  it('richieste e conto alla rovescia', () => {
    const p = mappaPronto({ minuti_richiamata: 15, pronti: 3, totale: 5, richieste_aperte: [{ richiesta_id: 7, stato: 'presa_in_carico', obiettivo_entro: '2026-10-16T10:15:00Z' }] });
    expect(p.richieste[0].stato).toBe('presa_in_carico');
    expect(secondiAllaRichiamata('2026-10-16T10:15:00Z', new Date('2026-10-16T10:10:30Z'))).toBe(270);
    expect(secondiAllaRichiamata('2026-10-16T10:15:00Z', new Date('2026-10-16T10:20:00Z'))).toBe(0);
    expect(secondiAllaRichiamata(null)).toBe(0);
  });
});

describe('messaggi', () => {
  it('mappa conversazioni e messaggi con allegato', () => {
    const c = mappaConversazione({ id: 2, argomento: 'visite', argomento_etichetta: 'Visite mediche', titolo: 'Spostare la visita', non_letti: 2, oggetto: { tipo: 'dvr', id: 3 } });
    expect(c?.nonLetti).toBe(2);
    expect(c?.oggetto).toEqual({ tipo: 'dvr', id: 3 });
    const m = mappaMessaggio({ id: 9, lato: 'studio', dalla_mia_parte: false, testo: 'Ok', allegato: { nome: 'a.pdf', url: '/api/portale/messaggi/9/allegato' } });
    expect(m?.lato).toBe('studio');
    expect(m?.allegato?.url).toContain('/allegato');
    expect(mappaMessaggio({})).toBeNull();
  });

  it('separatore di giorno: oggi, ieri, data lunga', () => {
    const oggi = new Date(2026, 9, 16, 15);
    expect(giornoChat(new Date(2026, 9, 16, 9).toISOString(), oggi)).toBe('Oggi');
    expect(giornoChat(new Date(2026, 9, 15, 9).toISOString(), oggi)).toBe('Ieri');
    expect(giornoChat(new Date(2026, 9, 10, 9).toISOString(), oggi)).toMatch(/10 ottobre/);
  });
});
