// Test del namespace `agente` del DataSource: mapping difensivo delle risposte,
// chiamate REST verso Laravel e modalita' dimostrativa (localStorage).

import { ApiDataSource } from './api';
import { LocalStorageDataSource } from './localstorage';
import { mapAgenteConversazione, mapAgenteMessaggio, mapAgenteProfilo, mapAgenteProgresso, mapCantiere, mapPannello, mapPos, nuovoIdRichiesta } from './agente-mappers';
import { setToken, clearApiCache } from '@/lib/api';
import { ROLES } from '@/lib/mock-auth';

const BASE = 'http://localhost:8000/api';

type FetchCall = { url: string; method: string; body: unknown };
let calls: FetchCall[] = [];

function mockFetchOnce(status: number, json: unknown): void {
  (global.fetch as jest.Mock).mockImplementationOnce(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: (init.method ?? 'GET').toUpperCase(),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: `HTTP ${status}`,
      json: async () => json,
    } as Response;
  });
}

beforeEach(() => {
  calls = [];
  global.fetch = jest.fn() as unknown as typeof fetch;
  setToken('jwt-token-abc');
  clearApiCache();
});

describe('mapper agente', () => {
  test('messaggio: passi e azioni validi, scarta quelli malformati o non sicuri', () => {
    const m = mapAgenteMessaggio({
      id: 5,
      ruolo: 'agente',
      testo: '**Ciao**',
      passi: [
        { tipo: 'strumento', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', ok: true },
        { tipo: 'strumento', strumento: 'azienda_scheda', ok: false, errore: 'non trovata' },
        { tipo: 'autocorrezione', problemi: ['soglia errata', 3] },
        { tipo: 'sconosciuto' },
        null,
      ],
      azioni: [
        { tipo: 'download', formato: 'PDF', url: 'https://dvr.conflavoro.it/api/agent-files/dvr/1/revisions/2/pdf?signature=x', etichetta: 'Scarica PDF' },
        { tipo: 'download', formato: 'pdf', url: 'javascript:alert(1)', etichetta: 'cattivo' },
        { tipo: 'dvr', dvr_id: '12', etichetta: 'Apri il DVR' },
        { tipo: 'azienda', azienda_id: 0, etichetta: 'id non valido' },
      ],
      creato: '2026-10-13T10:00:00+00:00',
    });
    expect(m.passi).toEqual([
      { tipo: 'strumento', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', ok: true, errore: null },
      { tipo: 'strumento', strumento: 'azienda_scheda', titolo: 'azienda_scheda', ok: false, errore: 'non trovata' },
      { tipo: 'autocorrezione', problemi: ['soglia errata'] },
    ]);
    expect(m.azioni).toHaveLength(2);
    expect(m.azioni[0]).toMatchObject({ tipo: 'download', formato: 'pdf', etichetta: 'Scarica PDF' });
    expect(m.azioni[1]).toEqual({ tipo: 'dvr', dvr_id: 12, etichetta: 'Apri il DVR' });
  });

  test('messaggio: input nullo produce un oggetto completo', () => {
    expect(mapAgenteMessaggio(null)).toEqual({ id: 0, ruolo: 'agente', testo: '', passi: [], azioni: [], pannelli: [], creato: null });
  });

  test('conversazione: azienda opzionale e titolo di riserva', () => {
    expect(mapAgenteConversazione({ id: 3, titolo: '  ', azienda: null, aggiornata: 'x' })).toEqual({
      id: 3,
      titolo: 'Nuova conversazione',
      azienda: null,
      aggiornata: 'x',
      sezione: null,
    });
    expect(mapAgenteConversazione({ id: 5, sezione: 'gestionale.dvr' }).sezione).toBe('gestionale.dvr');
    expect(mapAgenteConversazione({ id: 4, titolo: 'DVR', azienda: { id: 9, ragione_sociale: 'Brembo' } }).azienda).toEqual({
      id: 9,
      ragione_sociale: 'Brembo',
    });
  });

  test('profilo: valori di riserva e strumenti filtrati', () => {
    const p = mapAgenteProfilo({ tono: 'boh', strumenti: [{ nome: 'dvr_genera', titolo: 'Genera DVR', scrive: true }, { titolo: 'senza nome' }] });
    expect(p).toEqual({
      nome: 'Falco',
      tono: 'autorevole',
      istruzioni_studio: '',
      strumenti_disattivati: [],
      strumenti: [{ nome: 'dvr_genera', titolo: 'Genera DVR', scrive: true }],
      modificabile: false,
      voce: false,
    });
    expect(mapAgenteProfilo({ voce: true }).voce).toBe(true);
  });
});

describe('pannelli del modulo POS e dell osservatorio', () => {
  test('novita: url solo http(s), rilevanza tra 0 e 100', () => {
    const p = mapPannello({ tipo: 'novita', giorni: 30, argomento: 'cantieri', novita: [
      { fonte: 'Gazzetta Ufficiale', data: '2026-10-01', tipo: 'decreto', titolo: 'Nuovo decreto', sintesi: 'In sintesi', url: 'javascript:alert(1)', rilevanza: 140 },
      { titolo: '', sintesi: '' },
    ] });
    expect(p).toMatchObject({ tipo: 'novita', giorni: 30, argomento: 'cantieri' });
    if (p?.tipo !== 'novita') throw new Error('tipo');
    expect(p.novita).toHaveLength(1);
    expect(p.novita[0]).toMatchObject({ url: null, rilevanza: 100, fonte: 'Gazzetta Ufficiale' });
  });

  test('cantiere, pos e segnalazioni ordinate per gravita', () => {
    const c = mapPannello({ tipo: 'cantiere', cantiere_id: 4, azienda_id: 2, cantiere: { denominazione: 'Scuola Rodari', committente: { nome: 'Comune' }, pos: [{ pos_id: 9, stato: 'bozza', revisione: null }], subappalti: [{}, {}] } });
    expect(c).toMatchObject({ tipo: 'cantiere', cantiere_id: 4, cantiere: { denominazione: 'Scuola Rodari', committente: 'Comune', subappalti: 2 } });
    const pos = mapPannello({ tipo: 'pos', pos_id: 9, stato: 'pronto', revisione: 2, puo_emettere: true, conteggi: { blocca: 0, avvisa: 1 }, fasi: ['F01', 'F07'] });
    expect(pos).toMatchObject({ tipo: 'pos', pos_id: 9, stato: 'pronto', revisione: 2, puo_emettere: true, fasi: ['F01', 'F07'] });
    const dati = mapPannello({ tipo: 'pos', pos_id: 0, dati: { pos_id: 5, stato: 'bozza', prossimo_passo: 'controlla il POS' } });
    expect(dati).toMatchObject({ pos_id: 5, stato: 'bozza', prossimo_passo: 'controlla il POS' });
    const s = mapPannello({ tipo: 'segnalazioni', pos_id: 9, segnalazioni: [
      { chiave: 'a', esito: 'avvisa', messaggio: 'Manca il layout' },
      { chiave: 'b', esito: 'blocca', messaggio: 'Lavoratore senza formazione', accettata: false },
      { chiave: 'c', esito: 'strano', messaggio: 'x' },
    ] });
    if (s?.tipo !== 'segnalazioni') throw new Error('tipo');
    expect(s.segnalazioni.map((x) => x.esito)).toEqual(['blocca', 'avvisa', 'avvisa']);
  });

  test('cantiere e pos dalle API REST', () => {
    expect(mapCantiere({ id: 3, company_id: 1, denominazione: 'Via Roma', comune: 'Prato' })).toMatchObject({ id: 3, company_id: 1, comune: 'Prato', provincia: null });
    expect(mapCantiere({ id: 3 })).toBeNull();
    expect(mapPos({ id: 7, company_id: 1, cantiere_id: 3, stato: 'emesso', revisione_corrente: 1, fasi: [{ codice: 'F01' }] })).toMatchObject({ id: 7, stato: 'emesso', fasi: ['F01'] });
  });
});

describe('ApiDataSource.agente', () => {
  const ds = () => new ApiDataSource();

  test('invia: POST /agente/messaggi con i campi backend e mappa la risposta', async () => {
    mockFetchOnce(200, {
      data: {
        conversazione: { id: 7, titolo: 'Rumore', azienda: { id: 2, ragione_sociale: 'Acme' }, aggiornata: 't' },
        messaggio_utente: { id: 1, ruolo: 'utente', testo: 'ciao', passi: [], azioni: [], creato: 't' },
        risposta: { id: 2, ruolo: 'agente', testo: 'risposta', passi: [], azioni: [], creato: 't' },
      },
    });
    const r = await ds().agente.invia({ testo: 'ciao', conversazioneId: null, aziendaId: 2, vocale: true });
    expect(calls[0]).toEqual({ url: `${BASE}/agente/messaggi`, method: 'POST', body: { testo: 'ciao', azienda_id: 2, vocale: true } });
    expect(r.conversazione.id).toBe(7);
    expect(r.risposta.testo).toBe('risposta');
  });

  test('invia: conversazione esistente senza vocale', async () => {
    mockFetchOnce(200, { data: {} });
    await ds().agente.invia({ testo: 'x', conversazioneId: 7 });
    expect(calls[0].body).toEqual({ testo: 'x', conversazione_id: 7 });
  });

  test('invia: 429 diventa un messaggio in italiano', async () => {
    mockFetchOnce(429, { message: 'Too Many Attempts.' });
    await expect(ds().agente.invia({ testo: 'x' })).rejects.toThrow('Troppe richieste');
  });

  test('conversazioni, dettaglio ed eliminazione', async () => {
    mockFetchOnce(200, { data: [{ id: 1, titolo: 'A', azienda: null, aggiornata: 't' }] });
    expect(await ds().agente.conversazioni()).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `${BASE}/agente/conversazioni`, method: 'GET' });

    mockFetchOnce(200, { data: { id: 1, titolo: 'A', azienda: null, messaggi: [{ id: 1, ruolo: 'utente', testo: 'q' }] } });
    const d = await ds().agente.conversazione(1);
    expect(calls[1].url).toBe(`${BASE}/agente/conversazioni/1`);
    expect(d.messaggi[0].ruolo).toBe('utente');

    mockFetchOnce(204, null);
    await ds().agente.eliminaConversazione(1);
    expect(calls[2]).toMatchObject({ url: `${BASE}/agente/conversazioni/1`, method: 'DELETE' });
  });

  test('aggiornaProfilo: PUT e rilettura del profilo completo', async () => {
    mockFetchOnce(200, { data: { nome: 'Aquila', tono: 'semplice' } });
    mockFetchOnce(200, { data: { nome: 'Aquila', tono: 'semplice', strumenti: [{ nome: 'dvr_genera', titolo: 'Genera DVR', scrive: true }], modificabile: true } });
    const p = await ds().agente.aggiornaProfilo({ nome: 'Aquila', tono: 'semplice' });
    expect(calls[0]).toEqual({ url: `${BASE}/agente/profilo`, method: 'PUT', body: { nome: 'Aquila', tono: 'semplice' } });
    expect(calls[1]).toMatchObject({ url: `${BASE}/agente/profilo`, method: 'GET' });
    expect(p.strumenti).toHaveLength(1);
    expect(p.modificabile).toBe(true);
  });

  test('voce: POST con token e blob audio, errore parlante su 503', async () => {
    const audio = { size: 3 } as unknown as Blob;
    (global.fetch as jest.Mock).mockImplementationOnce(async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), method: String(init.method), body: JSON.parse(String(init.body)) });
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token-abc');
      return { ok: true, status: 200, blob: async () => audio } as unknown as Response;
    });
    await expect(ds().agente.voce('Ciao')).resolves.toBe(audio);
    expect(calls[0]).toEqual({ url: `${BASE}/agente/voce`, method: 'POST', body: { testo: 'Ciao' } });
    (global.fetch as jest.Mock).mockImplementationOnce(async () => ({ ok: false, status: 503 }) as Response);
    await expect(ds().agente.voce('Ciao')).rejects.toMatchObject({ status: 503 });
  });
});

describe('LocalStorageDataSource.agente (demo)', () => {
  const login = (role: keyof typeof ROLES) =>
    localStorage.setItem('crm_dvr_demo_user', JSON.stringify(ROLES[role].defaultUser));

  test('risposta dimostrativa onesta e conversazione persistita', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    const r = await ds.agente.invia({ testo: 'Prepara il DVR' });
    expect(r.risposta.testo).toContain('Modalità dimostrativa');
    const elenco = await ds.agente.conversazioni();
    expect(elenco).toHaveLength(1);
    const d = await ds.agente.conversazione(r.conversazione.id);
    expect(d.messaggi.map((m) => m.ruolo)).toEqual(['utente', 'agente']);
    await ds.agente.eliminaConversazione(r.conversazione.id);
    expect(await ds.agente.conversazioni()).toHaveLength(0);
  });

  test('profilo modificabile solo da titolare', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    expect((await ds.agente.profilo()).modificabile).toBe(false);
    await expect(ds.agente.aggiornaProfilo({ nome: 'X' })).rejects.toThrow();
    login('titolare_studio');
    const p = await ds.agente.aggiornaProfilo({ nome: 'Aquila' });
    expect(p.nome).toBe('Aquila');
    expect(p.modificabile).toBe(true);
    expect(p.voce).toBe(false);
    await expect(ds.agente.voce('Ciao')).rejects.toThrow();
  });
});

describe('mapper pannelli', () => {
  test('tipi sconosciuti e dati inutilizzabili vengono ignorati', () => {
    expect(mapPannello({ tipo: 'grafico_3d', chiave: 'x' })).toBeNull();
    expect(mapPannello(null)).toBeNull();
    expect(mapPannello({ tipo: 'dvr', chiave: 'dvr:0', dvr_id: 0 })).toBeNull();
    const m = mapAgenteMessaggio({ id: 1, ruolo: 'agente', testo: 't', pannelli: [{ tipo: 'boh' }, { tipo: 'fonti', chiave: 'fonti:0', passaggi: [{ fonte: 'D.Lgs. 81/08 art. 190', testo: 'valori' }] }] });
    expect(m.pannelli).toEqual([{ tipo: 'fonti', chiave: 'fonti:0', passaggi: [{ fonte: 'D.Lgs. 81/08 art. 190', testo: 'valori' }] }]);
  });

  test('azienda: figure leggibili dall\'organigramma e conteggi numerici', () => {
    const p = mapPannello({
      tipo: 'azienda',
      chiave: 'azienda:5',
      azienda: {
        id: 5,
        ragione_sociale: 'Lavanderia Bianca',
        lavoratori_totali: 7,
        sedi: [{ tipo: 'operativa', indirizzo: 'Via Roma 1', comune: 'Bergamo', provincia: 'BG' }],
        organigramma: { datore_lavoro: 'Mario Rossi', datore_svolge_rspp: true, rappresentante_tipo: 'RLST', rappresentante_nominativo: 'Cpt', preposti: ['A', 'B'] },
        mansioni: { Stiratrice: '3' },
        archivio: { foto: 2 },
      },
    });
    expect(p).toMatchObject({
      tipo: 'azienda',
      nuova: false,
      azienda: {
        figure: [
          { ruolo: 'Datore di lavoro', nome: 'Mario Rossi' },
          { ruolo: 'RSPP', nome: 'Svolto dal datore di lavoro' },
          { ruolo: 'RLST', nome: 'Cpt' },
          { ruolo: 'Preposti', nome: 'A, B' },
        ],
        mansioni: { Stiratrice: 3 },
        archivio: { foto: 2 },
      },
    });
  });

  test('rischi: P e G riportati nella scala 1..4, misure in testo', () => {
    const p = mapPannello({
      tipo: 'rischi',
      chiave: 'rischi:5',
      azienda_id: 5,
      rischi: [{ categoria: 'Fisico', pericolo: 'Rumore', probabilita: 7, gravita: '3', misure_tecniche: ['cabine', 'silenziatori'] }],
    });
    expect(p).toMatchObject({ rischi: [{ probabilita: 4, gravita: 3, misure_tecniche: 'cabine; silenziatori' }] });
  });

  test('dvr: stato iniziale da generazione avviata', () => {
    expect(mapPannello({ tipo: 'dvr', chiave: 'dvr:9', dvr_id: 9, dati: { dvr_id: 9, stato: 'generazione avviata', versione: 2 } })).toEqual({
      tipo: 'dvr',
      chiave: 'dvr:9',
      dvr_id: 9,
      dati: { stato_documento: null, generazione: 'pending', revisione_corrente: null, errore: null },
    });
  });

  test('scadenze ordinate per data', () => {
    const p = mapPannello({
      tipo: 'scadenze',
      chiave: 'scadenze:0',
      scadenze: [
        { id: 2, tipo: 'visita', descrizione: 'b', data: '2026-12-01' },
        { id: 1, tipo: 'corso', descrizione: 'a', data: '2026-10-01', scaduta: true },
      ],
    });
    expect(p && p.tipo === 'scadenze' ? p.scadenze.map((s) => s.id) : []).toEqual([1, 2]);
  });
});

describe('avanzamento dal vivo', () => {
  test('mapping eventi e piano, scarta il resto', () => {
    expect(
      mapAgenteProgresso({
        eventi: [
          { t: 'fase', testo: 'Rileggo la risposta' },
          { t: 'passo', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', stato: 'ok' },
          { t: 'boh' },
          { t: 'fine' },
        ],
        piano: [{ testo: 'Leggo l\'archivio', stato: 'fatto' }, { testo: '', stato: 'da_fare' }, { testo: 'Scrivo', stato: 'x' }],
        fine: true,
      })
    ).toEqual({
      eventi: [
        { t: 'fase', testo: 'Rileggo la risposta' },
        { t: 'passo', strumento: 'normativa_cerca', titolo: 'Cerca nella normativa', stato: 'ok' },
        { t: 'fine' },
      ],
      piano: [{ testo: 'Leggo l\'archivio', stato: 'fatto' }, { testo: 'Scrivo', stato: 'da_fare' }],
      fine: true,
    });
    expect(mapAgenteProgresso(null)).toEqual({ eventi: [], piano: null, fine: false });
  });

  test('il piano salvato nei passi e la ricerca in archivio arrivano al messaggio', () => {
    const m = mapAgenteMessaggio({
      ruolo: 'agente',
      passi: [{ tipo: 'piano', passi: [{ testo: 'Genero il DVR', stato: 'fatto' }] }],
      pannelli: [{ tipo: 'archivio', chiave: 'archivio:3', azienda_id: 3, ricerca: true, elementi: [{ id: 9, tipo: 'foto', titolo: 'Stiro', analisi: 'estratto' }] }],
    });
    expect(m.passi).toEqual([{ tipo: 'piano', passi: [{ testo: 'Genero il DVR', stato: 'fatto' }] }]);
    expect(m.pannelli[0]).toMatchObject({ tipo: 'archivio', ricerca: true });
  });

  test('id richiesta valido per il backend', () => {
    for (let i = 0; i < 20; i++) expect(/^[A-Za-z0-9_-]{8,64}$/.test(nuovoIdRichiesta())).toBe(true);
  });

  test('ApiDataSource: richiesta_id inviato e progresso letto senza cache', async () => {
    const ds = new ApiDataSource();
    mockFetchOnce(200, { data: {} });
    await ds.agente.invia({ testo: 'x', richiestaId: 'abcdef1234' });
    expect(calls[0].body).toEqual({ testo: 'x', richiesta_id: 'abcdef1234' });
    mockFetchOnce(200, { data: { eventi: [{ t: 'fase', testo: 'Leggo' }], piano: null, fine: false } });
    mockFetchOnce(200, { data: { eventi: [], piano: null, fine: true } });
    const a = await ds.agente.progresso('abcdef1234');
    const b = await ds.agente.progresso('abcdef1234');
    expect(calls[1]).toMatchObject({ url: `${BASE}/agente/progresso/abcdef1234`, method: 'GET' });
    expect(calls).toHaveLength(3);
    expect(a.eventi).toHaveLength(1);
    expect(b.fine).toBe(true);
  });
});
