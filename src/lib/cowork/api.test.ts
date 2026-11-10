import { ApiError } from '@/lib/api';
import { flusso, inErrore, percorsoScrivania } from './api';

describe('errori del contratto', () => {
  it('409 porta il paragrafo attuale e un messaggio chiaro', () => {
    const e = inErrore(new ApiError(409, { contratto: 'cowork.v1', message: 'conflitto', paragrafo: { id: 901, versione_base: 5, stato: 'accettato', azioni: [] } }, 'conflitto'));
    expect(e.status).toBe(409);
    expect(e.paragrafo).toMatchObject({ id: 901, versioneBase: 5 });
    expect(e.message).toMatch(/cambiato questo paragrafo/);
  });

  it('422 dell’approvazione elenca paragrafi e controlli aperti', () => {
    const e = inErrore(
      new ApiError(422, {
        message: 'Il DVR non si può approvare: ci sono paragrafi da accettare o controlli aperti.',
        paragrafi_aperti: [{ id: 905, sezione: '4', stato: 'proposto' }],
        controlli_aperti: [{ id: 80, livello: 'bloccante', regola: 'riferimento_abrogato', sezione: '8', messaggio: 'DM 10/03/1998 abrogato' }],
      }, 'x'),
    );
    expect(e.message).toMatch(/non si può approvare/);
    expect(e.aperti).toEqual([
      { tipo: 'paragrafo', id: 905, sezione: '4', testo: 'proposto' },
      { tipo: 'controllo', id: 80, sezione: '8', testo: 'DM 10/03/1998 abrogato' },
    ]);
  });

  it('403 parla del ruolo, rete assente parla della rete', () => {
    expect(inErrore(new ApiError(403, {}, 'Forbidden')).message).toMatch(/ruolo/);
    expect(inErrore(new ApiError(0, null, 'x')).message).toMatch(/rete/);
  });
});

describe('flusso', () => {
  const vero = global.fetch;
  const chiamate: string[] = [];
  const risponde = (status: number, corpo: unknown) => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      chiamate.push(String(url));
      return new Response(corpo === null ? null : JSON.stringify(corpo), { status });
    }) as typeof fetch;
  };
  afterEach(() => {
    global.fetch = vero;
    chiamate.length = 0;
  });

  it('404 vuol dire endpoint non ancora presente', async () => {
    risponde(404, { message: 'Not Found' });
    await expect(flusso(7, null)).resolves.toEqual({ esito: 'assente' });
  });

  it('204 vuol dire niente di nuovo e il cursore resta', async () => {
    risponde(204, null);
    await expect(flusso(7, 'c1')).resolves.toEqual({ esito: 'niente', cursore: 'c1' });
    expect(chiamate[0]).toMatch(/\/cowork\/v1\/aziende\/7\/flusso\?dal=c1$/);
  });

  it('eventi con cursore nuovo', async () => {
    risponde(200, { contratto: 'cowork.v1', voci: [{ tipo: 'sezione_completa', documento_id: 42, sezione: '8' }], cursore: 'c2' });
    await expect(flusso(7, 'c1')).resolves.toMatchObject({ esito: 'eventi', cursore: 'c2' });
  });

  it('altri errori salgono come CoworkErrore', async () => {
    risponde(429, { message: 'Too Many' });
    await expect(flusso(7, null)).rejects.toMatchObject({ status: 429 });
  });
});

describe('percorso', () => {
  it('porta azienda, documento e sezione', () => {
    expect(percorsoScrivania(42, 7, '13')).toBe('/gestionale/dvr/?azienda=7&cowork=42&sezione=13');
    expect(percorsoScrivania(42, null)).toBe('/gestionale/dvr/?cowork=42');
  });
});
