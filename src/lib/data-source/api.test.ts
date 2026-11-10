// Test ApiDataSource: verifica per ogni entita' che i metodi chiamino
// path/metodo/payload giusti verso Laravel e mappino bene la risposta.
//
// Strategia: mock di global.fetch. Ogni test ispeziona l'ultima fetch e
// controlla URL, method, header Authorization e body inviato.

import { ApiDataSource } from './api';
import { setToken } from '@/lib/api';

const BASE = 'http://localhost:8000/api';

type FetchCall = { url: string; method: string; headers: Record<string, string>; body: unknown };

let lastCall: FetchCall | null = null;

/** Imposta il prossimo (o sequenza di) responso/i del fetch mock. */
function mockFetchOnce(status: number, json: unknown): void {
  (global.fetch as jest.Mock).mockImplementationOnce(async (url: string, init: RequestInit = {}) => {
    lastCall = {
      url: String(url),
      method: (init.method ?? 'GET').toUpperCase(),
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: `HTTP ${status}`,
      json: async () => json,
    } as Response;
  });
}

beforeEach(() => {
  lastCall = null;
  global.fetch = jest.fn() as unknown as typeof fetch;
  setToken('jwt-token-abc');
});

function ds(): ApiDataSource {
  return new ApiDataSource();
}

// ============================================================
// AUTH
// ============================================================

describe('auth', () => {
  test('me() senza token NON chiama l\'API e ritorna null', async () => {
    setToken(null);
    const res = await ds().auth.me();
    expect(res).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('me() con token mappa l\'utente e manda il Bearer', async () => {
    mockFetchOnce(200, {
      id: 7,
      name: 'Mario Rossi',
      email: 'mario@example.it',
      role: 'consulente',
      tenant_id: 3,
      mfa_enabled: false,
    });
    const u = await ds().auth.me();
    expect(lastCall?.url).toBe(`${BASE}/auth/me`);
    expect(lastCall?.method).toBe('GET');
    expect(lastCall?.headers['Authorization']).toBe('Bearer jwt-token-abc');
    expect(u).toMatchObject({ id: 7, role: 'consulente', tenant_id: 3 });
  });

  test('login salva il token e mappa l\'utente via /auth/me', async () => {
    mockFetchOnce(200, { access_token: 'new-jwt', token_type: 'bearer', expires_in: 3600 });
    mockFetchOnce(200, {
      id: 1,
      name: 'Tit',
      email: 't@s.it',
      role: 'titolare_studio',
      tenant_id: 2,
      mfa_enabled: false,
    });
    const u = await ds().auth.login('t@s.it', 'password123');
    expect(u.role).toBe('titolare_studio');
  });

  test('googleLogin manda { credential } e usa l\'utente in risposta (no /me)', async () => {
    mockFetchOnce(200, {
      access_token: 'g-jwt',
      token_type: 'bearer',
      expires_in: 3600,
      needs_onboarding: true,
      user: { id: 9, name: 'G', email: 'g@x.it', role: null, tenant_id: null, mfa_enabled: false },
    });
    const res = await ds().auth.googleLogin('id-token-xyz');
    expect(lastCall?.url).toBe(`${BASE}/auth/google`);
    expect(lastCall?.body).toEqual({ credential: 'id-token-xyz' });
    expect(res.needs_onboarding).toBe(true);
    // role null -> default 'consulente' nel mapper, ma deve esistere un user
    expect(res.user.id).toBe(9);
    expect(global.fetch).toHaveBeenCalledTimes(1); // niente /me aggiuntivo
  });

  test('completeOnboarding rimappa i campi e rigenera il token', async () => {
    mockFetchOnce(200, {
      access_token: 'onb-jwt',
      token_type: 'bearer',
      expires_in: 3600,
      needs_onboarding: false,
      user: { id: 5, name: 'C', email: 'c@x.it', role: 'titolare_studio', tenant_id: 4, mfa_enabled: false },
    });
    const u = await ds().auth.completeOnboarding({
      role: 'titolare_studio',
      studio_nome: 'Studio Alfa',
      admin_invite_code: 'CODE',
      studio_codice_invito: 'slug-123',
      azienda_invite_code: 'INV-42',
    });
    expect(lastCall?.url).toBe(`${BASE}/onboarding`);
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.body).toEqual({
      role: 'titolare_studio',
      access_code: 'CODE',
      studio_name: 'Studio Alfa',
      studio_code: 'slug-123',
      azienda_invite_code: 'INV-42',
    });
    expect(u).toMatchObject({ id: 5, role: 'titolare_studio', tenant_id: 4 });
  });
});

// ============================================================
// COMPANIES
// ============================================================

describe('companies', () => {
  const apiCompany = {
    id: 11,
    tenant_id: 2,
    ragione_sociale: 'Lavanderia Srl',
    vat: 'IT12345678901',
    codice_fiscale: '12345678901',
    ateco: '96.01',
    dimensione: 'piccola',
    lavoratori_totali: 12,
    sedi: [{ tipo: 'legale', indirizzo: 'Via X', comune: 'Roma', provincia: 'RM', cap: '00100' }],
    settings: { ateco_label: 'Lavanderie' },
    created_at: '2026-01-01T00:00:00+00:00',
  };

  test('list mappa vat->partita_iva e lavoratori_totali->lavoratori', async () => {
    mockFetchOnce(200, { data: [apiCompany], meta: { total: 1 } });
    const list = await ds().companies.list();
    expect(lastCall?.url).toBe(`${BASE}/companies`);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 11,
      partita_iva: 'IT12345678901',
      lavoratori: 12,
      ateco_label: 'Lavanderie',
      dimensione: 'piccola',
    });
  });

  test('get 404 ritorna null', async () => {
    mockFetchOnce(404, { message: 'Not Found' });
    const c = await ds().companies.get(999);
    expect(c).toBeNull();
  });

  test('create invia body Laravel (vat + settings) e mappa la risposta', async () => {
    mockFetchOnce(201, { data: apiCompany });
    await ds().companies.create({
      ragione_sociale: 'Lavanderia Srl',
      partita_iva: 'it12345678901',
      ateco: '96.01',
      ateco_label: 'Lavanderie',
      dimensione: 'piccola',
      lavoratori: 12,
      sedi: [],
    } as never);
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.url).toBe(`${BASE}/companies`);
    const body = lastCall?.body as Record<string, unknown>;
    expect(body.vat).toBe('IT12345678901'); // normalizzato upper/no-space
    expect(body.lavoratori_totali).toBe(12);
    expect((body.settings as Record<string, unknown>).ateco_label).toBe('Lavanderie');
  });

  test('create con P.IVA duplicata (422 su vat) marca code DUPLICATE_PIVA', async () => {
    mockFetchOnce(422, { message: 'The given data was invalid.', errors: { vat: ['P.IVA gia presente'] } });
    await expect(
      ds().companies.create({
        ragione_sociale: 'Dup',
        partita_iva: 'IT12345678901',
        ateco: '96.01',
        ateco_label: '',
        dimensione: 'micro',
        lavoratori: 1,
        sedi: [],
      } as never)
    ).rejects.toMatchObject({ code: 'DUPLICATE_PIVA' });
  });

  test('update usa PATCH e invia solo i campi presenti', async () => {
    mockFetchOnce(200, { data: { ...apiCompany, lavoratori_totali: 20 } });
    const c = await ds().companies.update(11, { lavoratori: 20 });
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.url).toBe(`${BASE}/companies/11`);
    expect(lastCall?.body).toEqual({ lavoratori_totali: 20 });
    expect(c.lavoratori).toBe(20);
  });

  test('delete usa DELETE', async () => {
    mockFetchOnce(204, null);
    await ds().companies.delete(11);
    expect(lastCall?.method).toBe('DELETE');
    expect(lastCall?.url).toBe(`${BASE}/companies/11`);
  });
});

// ============================================================
// DVR
// ============================================================

describe('dvr', () => {
  const apiDvr = {
    id: 21,
    tenant_id: 2,
    company_id: 11,
    company: { id: 11, tenant_id: 2, ragione_sociale: 'Lavanderia Srl', vat: 'IT1', ateco: '96.01', dimensione: 'piccola', lavoratori_totali: 12 },
    version: 3,
    status: 'draft',
    payload: {
      sezione_a: { ragione_sociale: 'Lavanderia Srl' },
      sezione_e: {
        matrice_rischi: [
          { pericolo: 'Rumore', probabilita: 3, gravita: 3, livello: 'alto' },
          { pericolo: 'Caduta', probabilita: 4, gravita: 4, livello: 'molto_alto' },
        ],
      },
    },
    content_hash: 'abc',
    approved_at: null,
    ai_disclaimer_text: 'Documento generato con assistenza AI...',
    created_at: '2026-02-02T10:00:00+00:00',
  };

  test('list mappa version->versione, azienda dalla company e rischio_max dal payload', async () => {
    mockFetchOnce(200, { data: [apiDvr] });
    const list = await ds().dvr.list();
    expect(lastCall?.url).toBe(`${BASE}/dvr`);
    expect(list[0]).toMatchObject({
      id: 21,
      versione: 3,
      azienda: 'Lavanderia Srl',
      rischio_max: 'molto_alto',
      status: 'draft',
    });
  });

  test('create invia { company_id, payload } e mappa la risposta', async () => {
    mockFetchOnce(201, { data: apiDvr });
    await ds().dvr.create({ company_id: 11, payload: apiDvr.payload, status: 'draft', azienda: 'x', rischio_max: 'basso', data_approvazione: null } as never);
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.body).toEqual({ company_id: 11, payload: apiDvr.payload });
  });

  test('update invia solo payload/status', async () => {
    mockFetchOnce(200, { data: { ...apiDvr, status: 'review' } });
    const d = await ds().dvr.update(21, { status: 'review', azienda: 'ignorato' } as never);
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.body).toEqual({ status: 'review' });
    expect(d.status).toBe('review');
  });

  test('approve fa POST /dvr/{id}/approve', async () => {
    mockFetchOnce(200, { data: { ...apiDvr, status: 'approved', approved_at: '2026-03-01T00:00:00+00:00', approved_by: 5 } });
    const d = await ds().dvr.approve(21);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/approve`);
    expect(lastCall?.method).toBe('POST');
    expect(d.status).toBe('approved');
    expect(d.data_approvazione).toBe('2026-03-01T00:00:00+00:00');
  });

  test('delete chiama DELETE /dvr/{id}', async () => {
    mockFetchOnce(204, null);
    await ds().dvr.delete(21);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21`);
    expect(lastCall?.method).toBe('DELETE');
  });

  test('audit ritorna lista vuota (non esposto via API)', async () => {
    await expect(ds().dvr.audit(21)).resolves.toEqual([]);
  });

  test('ai_disclaimer_text e\' preservato dalla risposta', async () => {
    mockFetchOnce(200, { data: apiDvr });
    const d = await ds().dvr.get(21);
    expect(d?.ai_disclaimer_text).toContain('assistenza AI');
  });
});

// ============================================================
// ENTITA' ANAGRAFICHE (pass-through 1:1)
// ============================================================

describe.each([
  ['lavoratori', { id: 1, company_id: 11, nome: 'Anna', cognome: 'Bianchi', mansione: 'Operaia', created_by: 5, created_at: 'x' }],
  ['dpi', { id: 1, tipo: 'Guanti', categoria: 'II', created_by: 5, created_at: 'x' }],
  ['attrezzature', { id: 1, company_id: 11, codice_interno: 'A1', marcatura_ce: true, created_by: 5, created_at: 'x' }],
  ['corsi', { id: 1, titolo: 'Antincendio', durata_ore: 8, partecipanti: [], created_by: 5, created_at: 'x' }],
  ['scadenze', { id: 1, tipo: 'sopralluogo', descrizione: 'X', data_prevista: '2026-01-01', priorita: 'media', stato: 'aperta', created_by: 5, created_at: 'x' }],
])('%s (REST 1:1)', (entity, sample) => {
  const key = entity as 'lavoratori' | 'dpi' | 'attrezzature' | 'corsi' | 'scadenze';

  test('list unwrappa la collection', async () => {
    mockFetchOnce(200, { data: [sample] });
    const list = await ds()[key].list();
    expect(lastCall?.url).toBe(`${BASE}/${entity}`);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 1 });
  });

  test('get unwrappa la risorsa singola', async () => {
    mockFetchOnce(200, { data: sample });
    const item = await ds()[key].get(1);
    expect(lastCall?.url).toBe(`${BASE}/${entity}/1`);
    expect(item).toMatchObject({ id: 1 });
  });

  test('get 404 ritorna null', async () => {
    mockFetchOnce(404, { message: 'nope' });
    await expect(ds()[key].get(99)).resolves.toBeNull();
  });

  test('create POST + unwrap', async () => {
    mockFetchOnce(201, { data: sample });
    await ds()[key].create({ foo: 'bar' } as never);
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.url).toBe(`${BASE}/${entity}`);
    expect(lastCall?.body).toEqual({ foo: 'bar' });
  });

  test('update PATCH + unwrap', async () => {
    mockFetchOnce(200, { data: sample });
    await ds()[key].update(1, { note: 'agg' } as never);
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.url).toBe(`${BASE}/${entity}/1`);
    expect(lastCall?.body).toEqual({ note: 'agg' });
  });

  test('delete DELETE', async () => {
    mockFetchOnce(204, null);
    await ds()[key].delete(1);
    expect(lastCall?.method).toBe('DELETE');
    expect(lastCall?.url).toBe(`${BASE}/${entity}/1`);
  });

  test('403 -> code FORBIDDEN (datore_lavoro read-only lato backend)', async () => {
    mockFetchOnce(403, { message: 'This action is unauthorized.' });
    await expect(ds()[key].create({} as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('422 -> messaggio leggibile dal primo campo', async () => {
    mockFetchOnce(422, { message: 'invalid', errors: { mansione: ['Il campo mansione e obbligatorio'] } });
    await expect(ds()[key].create({} as never)).rejects.toThrow('mansione');
  });
});

// ============================================================
// UTENTI STUDIO (gate titolare)
// ============================================================

describe('utenti', () => {
  test('list GET /utenti + mappa al tipo UtenteStudio', async () => {
    mockFetchOnce(200, { data: [{ id: 9, nome: 'Anna Bianchi', email: 'anna@studio.it', ruolo: 'consulente', attivo: true, created_at: 'x' }] });
    const list = await ds().utenti.list();
    expect(lastCall?.url).toBe(`${BASE}/utenti`);
    expect(list[0]).toMatchObject({ id: 9, nome: 'Anna', cognome: 'Bianchi', ruolo: 'consulente' });
  });

  test('list: datore di lavoro e admin non diventano consulenti', async () => {
    mockFetchOnce(200, {
      data: [
        { id: 5, nome: 'Mario Bertini', email: 'datore@x.it', ruolo: 'datore_lavoro', attivo: true, created_at: 'x' },
        { id: 6, nome: 'Anna Conflavoro', email: 'admin@x.it', ruolo: 'admin_conflavoro', attivo: true, created_at: 'x' },
      ],
    });
    const list = await ds().utenti.list();
    expect(list.map((u) => u.ruolo)).toEqual(['datore_lavoro', 'admin_conflavoro']);
  });

  test('create POST /utenti con nome completo + propaga password_temporanea', async () => {
    mockFetchOnce(201, {
      data: { id: 12, nome: 'Luca Verdi', email: 'luca@studio.it', ruolo: 'consulente', attivo: true, created_at: 'x' },
      password_temporanea: 'Temp-9f2a!',
    });
    const u = await ds().utenti.create({ studio_id: 3, nome: 'Luca', cognome: 'Verdi', email: 'luca@studio.it', ruolo: 'consulente', attivo: true } as never);
    expect(lastCall?.url).toBe(`${BASE}/utenti`);
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.body).toMatchObject({ nome: 'Luca Verdi', email: 'luca@studio.it', ruolo: 'consulente' });
    expect(u.password_temporanea).toBe('Temp-9f2a!');
  });

  test('create con password esplicita non genera temporanea', async () => {
    mockFetchOnce(201, { data: { id: 13, nome: 'Sara Neri', email: 'sara@studio.it', ruolo: 'titolare_studio', attivo: true, created_at: 'x' } });
    const u = await ds().utenti.create({ studio_id: 3, nome: 'Sara', cognome: 'Neri', email: 'sara@studio.it', ruolo: 'titolare_studio', attivo: true, password: 'Secret123' } as never);
    expect(lastCall?.body).toMatchObject({ password: 'Secret123' });
    expect(u.password_temporanea === undefined).toBe(true);
  });

  test('update PATCH /utenti/{id} con nome/ruolo/attivo', async () => {
    mockFetchOnce(200, { data: { id: 9, nome: 'Anna Bianchi', email: 'anna@studio.it', ruolo: 'consulente', attivo: false, created_at: 'x' } });
    await ds().utenti.update(9, { nome: 'Anna', cognome: 'Bianchi', ruolo: 'consulente', attivo: false });
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.url).toBe(`${BASE}/utenti/9`);
    expect(lastCall?.body).toMatchObject({ nome: 'Anna Bianchi', ruolo: 'consulente', attivo: false });
  });

  test('delete DELETE /utenti/{id}', async () => {
    mockFetchOnce(204, null);
    await ds().utenti.delete(9);
    expect(lastCall?.method).toBe('DELETE');
    expect(lastCall?.url).toBe(`${BASE}/utenti/9`);
  });

  test('403 -> code FORBIDDEN', async () => {
    mockFetchOnce(403, { message: 'unauthorized' });
    await expect(ds().utenti.create({} as never)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ============================================================
// STUDI (gate admin)
// ============================================================

describe('studi', () => {
  test('list GET /studi mappa nome->ragione_sociale, slug->codice, n_utenti/n_aziende', async () => {
    mockFetchOnce(200, { data: [{ id: 4, nome: 'Studio Rossi', slug: 'studio-rossi', plan: 'pro', n_utenti: 3, n_aziende: 12, created_at: 'x' }] });
    const list = await ds().studi.list();
    expect(lastCall?.url).toBe(`${BASE}/studi`);
    expect(list[0]).toMatchObject({
      id: 4,
      ragione_sociale: 'Studio Rossi',
      codice_studio: 'studio-rossi',
      plan: 'pro',
      numero_consulenti: 3,
      numero_aziende_clienti: 12,
    });
  });

  test('create POST /studi con {nome, plan}', async () => {
    mockFetchOnce(201, { data: { id: 5, nome: 'Studio Verdi', plan: 'free', created_at: 'x' } });
    await ds().studi.create({ ragione_sociale: 'Studio Verdi', plan: 'free', partita_iva: '', email_referente: '', attivo: true } as never);
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.body).toEqual({ nome: 'Studio Verdi', plan: 'free' });
  });

  test('update PATCH /studi/{id} solo i campi forniti', async () => {
    mockFetchOnce(200, { data: { id: 5, nome: 'Studio Verdi 2', plan: 'pro', created_at: 'x' } });
    await ds().studi.update(5, { ragione_sociale: 'Studio Verdi 2', plan: 'pro' });
    expect(lastCall?.method).toBe('PATCH');
    expect(lastCall?.url).toBe(`${BASE}/studi/5`);
    expect(lastCall?.body).toEqual({ nome: 'Studio Verdi 2', plan: 'pro' });
  });

  test('delete DELETE /studi/{id}', async () => {
    mockFetchOnce(204, null);
    await ds().studi.delete(5);
    expect(lastCall?.method).toBe('DELETE');
    expect(lastCall?.url).toBe(`${BASE}/studi/5`);
  });

  test('delete 422 (collegamenti) -> messaggio leggibile', async () => {
    mockFetchOnce(422, { message: 'Lo studio ha consulenti collegati', errors: {} });
    await expect(ds().studi.delete(5)).rejects.toThrow('consulenti');
  });
});

// ============================================================
// GENERAZIONE DVR
// ============================================================

describe('generazione DVR', () => {
  test('generate POST /dvr/{id}/generate e normalizza la risposta', async () => {
    mockFetchOnce(202, { mode: 'async', generation_status: 'pending' });
    const res = await ds().generate(21);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/generate`);
    expect(lastCall?.method).toBe('POST');
    expect(res).toEqual({ mode: 'async', status: 'pending', result: undefined });
  });

  test('generate invia riscrivi_modifiche_umane (default false)', async () => {
    mockFetchOnce(202, { mode: 'async', generation_status: 'pending' });
    await ds().dvr.generate(21);
    expect(lastCall?.body).toEqual({ riscrivi_modifiche_umane: false });
    mockFetchOnce(202, { mode: 'async', generation_status: 'pending' });
    await ds().dvr.generate(21, { riscriviModificheUmane: true });
    expect(lastCall?.body).toEqual({ riscrivi_modifiche_umane: true });
  });

  test('generationStatus GET /dvr/{id}/generation-status', async () => {
    mockFetchOnce(200, { dvr_id: 21, dvr_status: 'draft', generation: { status: 'running' } });
    const res = await ds().generationStatus(21);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/generation-status`);
    expect(res.generation.status).toBe('running');
  });
});

// ============================================================
// STORICO REVISIONI DVR
// ============================================================

describe('revisioni DVR', () => {
  const summary = {
    numero: 3, origine: 'umano', autore: 'Laura Bianchi', motivo: 'Sopralluogo',
    sezioni_modificate: ['b'], sezioni_umane: ['b'], totale_sezioni: 2,
    canonical_27: false, ha_file: true, created_at: '2026-10-13T10:00:00+02:00',
  };

  test('revisions GET /dvr/{id}/revisions con corrente', async () => {
    mockFetchOnce(200, { dvr_id: 21, corrente: 3, data: [summary] });
    const res = await ds().dvr.revisions(21);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/revisions`);
    expect(lastCall?.headers.Authorization).toBe('Bearer jwt-token-abc');
    expect(res.corrente).toBe(3);
    expect(res.data[0].autore).toBe('Laura Bianchi');
  });

  test('revision GET /dvr/{id}/revisions/{numero} con sezioni', async () => {
    mockFetchOnce(200, { data: { ...summary, sezioni: [{ key: 'B', title: 'Organigramma', body: 'Testo', origine: 'umano', modificata_da: 7 }] } });
    const res = await ds().dvr.revision(21, 3);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/revisions/3`);
    expect(res.sezioni[0]).toMatchObject({ key: 'B', origine: 'umano', modificata_da: null });
  });

  test('createRevision POST con modifiche e motivo, omette motivo vuoto', async () => {
    mockFetchOnce(201, { data: { ...summary, numero: 4, sezioni: [] } });
    await ds().dvr.createRevision(21, { modifiche: [{ key: 'B', body: 'Nuovo' }], motivo: '  ' });
    expect(lastCall?.method).toBe('POST');
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/revisions`);
    expect(lastCall?.body).toEqual({ modifiche: [{ key: 'B', body: 'Nuovo' }] });
  });

  test('createRevision 422 propaga il messaggio del backend', async () => {
    mockFetchOnce(422, { message: 'Nessuna modifica rispetto alla revisione corrente.' });
    await expect(ds().dvr.createRevision(21, { modifiche: [{ key: 'B', body: 'x' }] })).rejects.toThrow('Nessuna modifica');
  });

  test('restoreRevision POST /dvr/{id}/revisions/{numero}/restore', async () => {
    mockFetchOnce(201, { data: { ...summary, numero: 5 } });
    const res = await ds().dvr.restoreRevision(21, 2);
    expect(lastCall?.url).toBe(`${BASE}/dvr/21/revisions/2/restore`);
    expect(res.numero).toBe(5);
  });
});

// ============================================================
// HEALTH
// ============================================================

describe('health', () => {
  test('ok quando app=ok', async () => {
    mockFetchOnce(200, { app: 'ok', laravel: '12.0' });
    const h = await ds().health();
    expect(h.ok).toBe(true);
    expect(h.version).toBe('Laravel 12.0');
  });

  test('non rompe su errore di rete', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('network down');
    });
    const h = await ds().health();
    expect(h.ok).toBe(false);
    expect(h.error).toContain('network');
  });
});
