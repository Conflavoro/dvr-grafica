// Loghi nei documenti: controlli prima dell'invio e chiamate verso il backend.

import { controllaFileLogo, creaLoghiApi, LOGO_MAX_BYTE } from './loghi-api';

const file = (nome: string, tipo: string, byte = 10) => new File([new Uint8Array(byte)], nome, { type: tipo });

test('controllaFileLogo: formati, peso e SVG secondo il server', () => {
  expect(controllaFileLogo(file('l.png', 'image/png'), false)).toBeNull();
  expect(controllaFileLogo(file('l.jpg', 'image/jpeg'), false)).toBeNull();
  expect(controllaFileLogo(file('l.webp', 'image/webp'), false)).toBeNull();
  expect(controllaFileLogo(file('l.pdf', 'application/pdf'), true)).toMatch(/Formato non valido/);
  expect(controllaFileLogo(file('l.png', 'image/png', LOGO_MAX_BYTE + 1), false)).toMatch(/2 MB/);
  expect(controllaFileLogo(file('l.svg', 'image/svg+xml'), false)).toMatch(/non converte i file SVG/);
  expect(controllaFileLogo(file('l.svg', ''), false)).toMatch(/non converte i file SVG/);
  expect(controllaFileLogo(file('l.svg', 'image/svg+xml'), true)).toBeNull();
});

describe('creaLoghiApi', () => {
  const vero = global.fetch;
  afterEach(() => {
    global.fetch = vero;
  });

  test('legge lo stato del logo dell azienda dalla rotta del portale', async () => {
    const chiamate: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      chiamate.push(String(url));
      return new Response(JSON.stringify({ data: { logo: { presente: true, larghezza: 800, altezza: 300, aggiornato_il: null, versione: 'abc' }, puo_modificare: true, svg: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const st = await creaLoghiApi().azienda(7);
    expect(st.logo?.larghezza).toBe(800);
    expect(st.puo_modificare).toBe(true);
    expect(chiamate[0]).toMatch(/\/portale\/aziende\/7\/logo$/);
  });

  test('anteprima senza logo restituisce null, rimozione con errore leggibile', async () => {
    global.fetch = jest.fn(async () => new Response('{"message":"Nessun logo."}', { status: 404 })) as typeof fetch;
    expect(await creaLoghiApi().anteprimaStudio()).toBeNull();
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ message: 'Il logo dello studio lo cambiano il titolare dello studio e lo staff Conflavoro.' }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    ) as typeof fetch;
    await expect(creaLoghiApi().rimuoviStudio()).rejects.toThrow(/titolare dello studio/);
  });
});
