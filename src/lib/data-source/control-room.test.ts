// Safety Control Room: mapping difensivo, chiamate REST verso Laravel e
// modalita' dimostrativa calcolata dai dati del browser.

import { ApiDataSource } from './api';
import { LocalStorageDataSource } from './localstorage';
import { mapPannello } from './agente-mappers';
import { classificaDocumento } from './control-room-locale';
import { linkSicuro, mapAree, mapConsultazione, mapControlRoom, mapFascicolo, mapScadenzario } from './control-room-mappers';
import { setToken, clearApiCache } from '@/lib/api';
import { ROLES } from '@/lib/mock-auth';
import type { Role } from './types';

const BASE = 'http://localhost:8000/api';

type Chiamata = { url: string; method: string; body: unknown; auth: string | null };
let calls: Chiamata[] = [];

function risposta(status: number, json: unknown): void {
  (global.fetch as jest.Mock).mockImplementationOnce(async (url: string, init: RequestInit = {}) => {
    const h = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url: String(url), method: (init.method ?? 'GET').toUpperCase(), body: init.body ? JSON.parse(init.body as string) : undefined, auth: h.Authorization ?? null });
    return { ok: status >= 200 && status < 300, status, statusText: `HTTP ${status}`, json: async () => json } as Response;
  });
}

beforeEach(() => {
  calls = [];
  global.fetch = jest.fn() as unknown as typeof fetch;
  setToken('jwt-token-abc');
  clearApiCache();
});

describe('mapper Control Room', () => {
  test('aree sempre nelle quattro chiavi, in ordine, con punteggio limitato', () => {
    const a = mapAree({ documenti: { nome: 'Documenti', punteggio: 140, stato: 'applicabile' }, sicurezza: { punteggio: '80' }, sorveglianza: { punteggio: null, stato: 'non_applicabile' } });
    expect(a.map((x) => x.chiave)).toEqual(['sicurezza', 'formazione', 'sorveglianza', 'documenti']);
    expect(a[0]).toMatchObject({ nome: 'Sicurezza', punteggio: 80, stato: 'applicabile' });
    expect(a[1]).toMatchObject({ punteggio: null, stato: 'non_applicabile' });
    expect(a[3].punteggio).toBe(100);
  });

  test('panoramica: criticita ordinate per priorita, livello dedotto, campi mancanti', () => {
    const p = mapControlRoom({
      azienda_id: 12,
      totale: 72,
      criticita: [
        { titolo: 'B', priorita: 'bassa' },
        { titolo: 'A', priorita: 'alta', esito: 'non_conforme' },
        { titolo: '', messaggio: '' },
      ],
      scadenze: { contatori: { entro_30: '3' }, prossime: [{ titolo: 'Dopo', data: '2026-11-02' }, { titolo: 'Prima', data: '2026-10-20' }] },
    });
    expect(p.livello).toBe('discreto');
    expect(p.criticita.map((c) => c.titolo)).toEqual(['A', 'B']);
    expect(p.criticita_totali).toBe(2);
    expect(p.tendenza.direzione).toBe('nd');
    expect(p.scadenze.contatori).toEqual({ entro_30: 3, scadute: 0, visite_da_pianificare: 0, corsi_in_scadenza: 0, alert_aperti: 0 });
    expect(p.scadenze.prossime.map((v) => v.titolo)).toEqual(['Prima', 'Dopo']);
  });

  test('scadenzario: stato dedotto dai giorni quando manca', () => {
    const s = mapScadenzario({ voci: [{ titolo: 'Visita', giorni: -2, priorita: 'urgente' }] });
    expect(s.voci[0]).toMatchObject({ stato: 'scaduta', priorita: 'media', categoria: 'altro' });
  });

  test('fascicolo: id virtuali, documenti numerici, essenziali non applicabili scartati', () => {
    const f = mapFascicolo({
      recenti: [
        { id: 'dvr:31', virtuale: true, tipo: 'dvr', titolo: 'DVR' },
        { id: 88, titolo: 'Nomina RSPP', categoria: 'nomine' },
      ],
      essenziali: [
        { chiave: 'dvr', voce: 'DVR aggiornato', esito: 'conforme' },
        { chiave: 'piano_emergenza', voce: 'Piano', esito: 'non_applicabile' },
      ],
    });
    expect(f.recenti[0]).toMatchObject({ id: 'dvr:31', virtuale: true, dvr_id: 31, documento_id: null });
    expect(f.recenti[1]).toMatchObject({ id: '88', virtuale: false, documento_id: 88 });
    expect(f.essenziali.map((e) => e.chiave)).toEqual(['dvr']);
  });

  test('passaporto pubblico: solo link http(s) e organigramma leggibile', () => {
    expect(linkSicuro('javascript:alert(1)')).toBeNull();
    expect(linkSicuro('https://dvr.conflavoro.it/x')).toBe('https://dvr.conflavoro.it/x');
    const c = mapConsultazione({
      azienda: { ragione_sociale: 'Officina Rossi Srl' },
      organigramma: { rspp: 'Luca Bianchi', addetti_antincendio: ['Anna', 'Piero'] },
      documenti_essenziali: [{ voce: 'Nomina RSPP', esito: 'conforme', documenti: [{ titolo: 'Nomina', link: 'data:text/html,x' }] }],
    });
    expect(c.organigramma).toEqual([
      { ruolo: 'RSPP', nomi: ['Luca Bianchi'] },
      { ruolo: 'Addetti antincendio', nomi: ['Anna', 'Piero'] },
    ]);
    expect(c.documenti_essenziali[0].documenti[0].link).toBeNull();
  });

  test('pannelli della chat: tipi della Control Room riconosciuti, senza azienda scartati', () => {
    const p = mapPannello({ tipo: 'safety_score', azienda_id: 4, totale: 38, aree: { sicurezza: { nome: 'Sicurezza', punteggio: 30 } }, criticita: [{ titolo: 'RSPP', priorita: 'alta' }] });
    expect(p).toMatchObject({ tipo: 'safety_score', chiave: 'safety_score:4', livello: 'grave' });
    expect(mapPannello({ tipo: 'passaporto', azienda_id: 4, creato: true, pin_inviato_a: 'l.bianchi@studio.it', link_foglio_qr: 'ftp://x' })).toMatchObject({ creato: true, link_foglio_qr: null });
    expect(mapPannello({ tipo: 'pronto_controllo', azienda_id: 4, mostra_subito: [{ voce: 'DVR', esito: 'conforme', documenti: 2 }] })).toMatchObject({ mostra_subito: [{ voce: 'DVR', documenti: 2 }] });
    expect(mapPannello({ tipo: 'ispezioni' })).toBeNull();
  });

  test('classificazione dei documenti con le regole del backend', () => {
    expect(classificaDocumento('Nomina RSPP 2026')).toBe('nomine');
    expect(classificaDocumento('POS cantiere via Roma')).toBe('pos_duvri');
    expect(classificaDocumento('Verbale riunione periodica')).toBe('verbali');
    expect(classificaDocumento('Scansione 004', 'Giudizio di idoneità alla mansione')).toBe('sorveglianza');
    expect(classificaDocumento('foto.jpg')).toBe('altro');
  });
});

describe('ApiDataSource.controlRoom', () => {
  test('letture con filtri in query e JWT', async () => {
    const ds = new ApiDataSource();
    risposta(200, { data: { azienda_id: 12, voci: [] } });
    await ds.controlRoom.scadenzario(12, { periodo: '7', priorita: 'alta', includi_scadute: false });
    expect(calls[0]).toMatchObject({ url: `${BASE}/companies/12/scadenzario?periodo=7&priorita=alta&includi_scadute=false`, method: 'GET', auth: 'Bearer jwt-token-abc' });
    risposta(200, { data: {} });
    await ds.controlRoom.fascicolo(12, { cerca: ' nomina ', categoria: 'nomine' });
    expect(calls[1].url).toBe(`${BASE}/companies/12/fascicolo?cerca=nomina&categoria=nomine`);
  });

  test('scritture: fascicolo, osservazioni con AI, ispezione, assistenza', async () => {
    const ds = new ApiDataSource();
    risposta(200, { data: { id: 88, titolo: 'Nomina', categoria: 'nomine' } });
    const v = await ds.controlRoom.fascicoloAggiorna(88, { categoria: 'nomine', scadenza_documento: null });
    expect(calls[0]).toMatchObject({ url: `${BASE}/company-documents/88/fascicolo`, method: 'PATCH', body: { categoria: 'nomine', scadenza_documento: null } });
    expect(v.documento_id).toBe(88);
    risposta(200, { data: { mese: '2026-10', dati: {} } });
    await ds.controlRoom.salvaOsservazioni(12, '2026-10', 'Bene', true);
    expect(calls[1]).toMatchObject({ url: `${BASE}/companies/12/report/2026-10/osservazioni`, method: 'PUT', body: { osservazioni: 'Bene', con_ai: true } });
    risposta(201, { data: { id: 7, azienda_id: 12, ente: 'ASL', data: '2026-10-08' } });
    await ds.controlRoom.creaIspezione({ company_id: 12, ente: 'ASL', note: 'Due ispettori' });
    expect(calls[2]).toMatchObject({ url: `${BASE}/ispezioni`, method: 'POST' });
    risposta(201, { data: { richiesta_id: 3, azienda_id: 12, avvisati: 3 } });
    const a = await ds.controlRoom.richiediAssistenza(12, { ente: 'ASL', messaggio: '  ' });
    expect(calls[3].body).toEqual({ ente: 'ASL' });
    expect(a.avvisati).toBe(3);
    await expect(ds.controlRoom.report(12, '2026-1')).rejects.toThrow('Mese non valido');
  });

  test('passaporto creato: token e PIN restituiti una volta, errori in italiano', async () => {
    const ds = new ApiDataSource();
    risposta(201, { data: { passaporto: { id: 3, azienda_id: 12, attivo: true }, token: 'pass_x', pin: '4821', link: 'https://dvr.conflavoro.it/passaporto/?t=pass_x' } });
    const c = await ds.controlRoom.creaPassaporto(12, { pin: '4821' });
    expect(c).toMatchObject({ token: 'pass_x', pin: '4821' });
    risposta(403, { message: 'This action is unauthorized.' });
    await expect(ds.controlRoom.revocaPassaporto(3)).rejects.toThrow('Operazione non consentita per il tuo ruolo.');
  });

  test('passaporto pubblico: chiamate anonime, PIN errato e blocco', async () => {
    const ds = new ApiDataSource();
    const token = `pass_${'a'.repeat(48)}`;
    risposta(200, { data: { richiede: ['pin', 'ente', 'nome'], enti: ['ASL'], informativa: 'Registrato.' } });
    const info = await ds.controlRoom.passaportoPubblico(token);
    expect(info.enti).toEqual(['ASL']);
    expect(calls[0].auth).toBeNull();
    risposta(403, { message: 'PIN non corretto.' });
    await expect(ds.controlRoom.apriPassaportoPubblico(token, { pin: '1', ente: 'ASL', nome: 'Mario' })).rejects.toMatchObject({ message: 'PIN non corretto.', status: 403 });
    expect(calls[1]).toMatchObject({ method: 'POST', auth: null, body: { pin: '1', ente: 'ASL', nome: 'Mario' } });
    risposta(429, {});
    await expect(ds.controlRoom.apriPassaportoPubblico(token, { pin: '1', ente: 'ASL', nome: 'Mario' })).rejects.toThrow('Troppi tentativi');
    await expect(ds.controlRoom.passaportoPubblico('pass_corto')).rejects.toThrow('non valido');
    expect(calls).toHaveLength(3);
  });
});

describe('LocalStorageDataSource.controlRoom (demo)', () => {
  const login = (role: Role) => localStorage.setItem('crm_dvr_demo_user', JSON.stringify(ROLES[role].defaultUser));

  async function azienda(ds: LocalStorageDataSource, completa: boolean) {
    const c = await ds.companies.create({
      ragione_sociale: 'Officina Rossi Srl',
      partita_iva: completa ? '01234567890' : '09876543210',
      ateco: '25.62.00',
      ateco_label: 'Lavori di meccanica generale',
      dimensione: 'piccola',
      lavoratori: 2,
      sedi: [{ tipo: 'legale', indirizzo: 'Via Roma 1', comune: 'Bergamo', provincia: 'BG', cap: '24100' }],
      settings: completa
        ? {
            organigramma: {
              datore_lavoro: 'Mario Rossi',
              rspp: 'Luca Bianchi',
              medico_competente: 'Dott.ssa Neri',
              rappresentante_tipo: 'RLST',
              addetti_antincendio: ['Anna Verdi'],
              addetti_primo_soccorso: ['Anna Verdi'],
            },
          }
        : {},
    });
    for (const [nome, cognome] of [['Anna', 'Verdi'], ['Piero', 'Gialli']]) {
      await ds.lavoratori.create({ company_id: c.id, nome, cognome, mansione: 'Tornitore', idoneita_sanitaria_data: new Date().toISOString().slice(0, 10), formazione_svolta: completa ? ['Formazione generale', 'Formazione specifica'] : [] });
    }
    return c;
  }

  test('score calcolato dai dati: azienda in ordine sopra quella incompleta', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    const buona = await azienda(ds, true);
    const vuota = await azienda(ds, false);
    const a = await ds.controlRoom.controlRoom(buona.id);
    const b = await ds.controlRoom.controlRoom(vuota.id);
    expect(a.aree.map((x) => x.chiave)).toEqual(['sicurezza', 'formazione', 'sorveglianza', 'documenti']);
    expect(a.totale).not.toBeNull();
    expect(b.totale).not.toBeNull();
    expect(a.totale! > b.totale!).toBe(true);
    expect(b.criticita[0].priorita).toBe('alta');
    expect(b.criticita.some((c) => c.chiave === 'rspp')).toBe(true);
    expect(/^\d{4}-\d{2}$/.test(a.tendenza.mese ?? '')).toBe(true);
    const completo = await ds.controlRoom.safetyScore(buona.id);
    expect(completo.aree[0].controlli.length > 3).toBe(true);
    expect(completo.formula).toContain('sicurezza 35');
  });

  test('scadenzario: filtri per periodo e priorita, prescrizioni critiche', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    const c = await azienda(ds, true);
    const tra = (g: number) => new Date(Date.now() + g * 86_400_000).toISOString().slice(0, 10);
    await ds.scadenze.create({ company_id: c.id, tipo: 'verifica_impianti', descrizione: 'Verifica messa a terra', data_prevista: tra(3), priorita: 'media', stato: 'aperta' });
    await ds.scadenze.create({ company_id: c.id, tipo: 'altro', descrizione: 'Scaduta', data_prevista: tra(-4), priorita: 'bassa', stato: 'aperta' });
    await ds.scadenze.create({ company_id: c.id, tipo: 'altro', descrizione: 'Lontana', data_prevista: tra(80), priorita: 'alta', stato: 'aperta' });
    const s7 = await ds.controlRoom.scadenzario(c.id, { periodo: '7' });
    expect(s7.voci.map((v) => v.titolo)).toEqual(['Scaduta', 'Verifica messa a terra']);
    expect(s7.contatori.scadute).toBe(1);
    const alta = await ds.controlRoom.scadenzario(c.id, { periodo: '90', priorita: 'alta' });
    expect(alta.voci.every((v) => v.priorita === 'alta' || v.priorita === 'critica')).toBe(true);
    await ds.controlRoom.creaIspezione({ company_id: c.id, ente: 'ASL', esito: 'prescrizioni', prescrizioni: [{ descrizione: 'Ripristinare il carter', termine: tra(10) }] });
    const dopo = await ds.controlRoom.scadenzario(c.id, { periodo: '30' });
    expect(dopo.voci.find((v) => v.titolo.includes('carter'))).toMatchObject({ priorita: 'critica' });
  });

  test('fascicolo: classificazione, correzione solo da consulente in su', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    const c = await azienda(ds, true);
    const file = { name: 'nomina_rspp.pdf', type: 'application/pdf', size: 10 } as File;
    const d = await ds.companyDocuments.addFile(c.id, 'documento', file, { titolo: 'Nomina RSPP' });
    const f = await ds.controlRoom.fascicolo(c.id);
    expect(f.recenti.find((v) => v.documento_id === d.id)?.categoria).toBe('nomine');
    expect(f.essenziali.find((e) => e.chiave === 'nomina_rspp')?.esito).toBe('conforme');
    const v = await ds.controlRoom.fascicoloAggiorna(d.id, { categoria: 'attestati', versione: '2.0' });
    expect(v).toMatchObject({ categoria: 'attestati', categoria_manuale: true, versione: '2.0' });
    const filtro = await ds.controlRoom.fascicolo(c.id, { categoria: 'attestati' });
    expect(filtro.recenti).toHaveLength(1);
  });

  test('passaporto: PIN mostrato una volta, consultazione pubblica registrata', async () => {
    login('consulente');
    const ds = new LocalStorageDataSource();
    const c = await azienda(ds, true);
    const creato = await ds.controlRoom.creaPassaporto(c.id, { pin: '4821' });
    expect(/^pass_[A-Za-z0-9]{48}$/.test(creato.token)).toBe(true);
    expect(creato.link).toContain(`/passaporto/?t=${creato.token}`);
    await expect(ds.controlRoom.apriPassaportoPubblico(creato.token, { pin: '0000', ente: 'ASL', nome: 'Mario Bianchi' })).rejects.toThrow('PIN non corretto');
    const ok = await ds.controlRoom.apriPassaportoPubblico(creato.token, { pin: '4821', ente: 'ASL', nome: 'Mario Bianchi' });
    expect(ok.azienda.ragione_sociale).toBe('Officina Rossi Srl');
    expect(ok.organigramma.find((r) => r.ruolo === 'RSPP')?.nomi).toEqual(['Luca Bianchi']);
    const stato = await ds.controlRoom.passaporto(c.id);
    expect(stato.attivo?.accessi_totali).toBe(1);
    expect(stato.accessi.map((a) => a.esito)).toEqual(['ok', 'pin_errato']);
    await ds.controlRoom.revocaPassaporto(creato.passaporto.id);
    await expect(ds.controlRoom.passaportoPubblico(creato.token)).rejects.toThrow('non più valido');
  });

  test('ruoli: il datore registra solo ente e note, non crea passaporti', async () => {
    login('datore_lavoro');
    const ds = new LocalStorageDataSource();
    const c = await azienda(ds, false);
    await expect(ds.controlRoom.creaIspezione({ company_id: c.id, ente: 'INL', esito: 'sanzione' })).rejects.toMatchObject({ code: 'VALIDATION' });
    const i = await ds.controlRoom.creaIspezione({ company_id: c.id, ente: 'INL', note: 'Controllo documentale' });
    expect(i.esito).toBeNull();
    await expect(ds.controlRoom.aggiornaIspezione(i.id, { esito: 'nessuna_criticita' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(ds.controlRoom.creaPassaporto(c.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(ds.controlRoom.reportPdf(c.id, new Date().toISOString().slice(0, 7))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const a = await ds.controlRoom.richiediAssistenza(c.id, { ente: 'INL' });
    expect(a.nota).toContain('dimostrativa');
    const r = await ds.controlRoom.report(c.id, new Date().toISOString().slice(0, 7));
    expect(r.dati.andamento).toHaveLength(6);
    expect(r.dati.attivita.richieste_assistenza).toBe(1);
  });
});
