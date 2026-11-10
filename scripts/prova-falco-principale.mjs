// Prova end to end del Falco principale sul sito statico costruito (out/), con il backend
// simulato da Playwright: una richiesta al Falco apre una schermata e mostra il cursore.
//
// Uso: NEXT_PUBLIC_USE_API=true NEXT_PUBLIC_API_BASE_URL=/api npx next build
//      node scripts/prova-falco-principale.mjs <cartella screenshot>
// Facoltativi: CHROMIUM=/percorso/chrome (altrimenti quello di Playwright).
//
// Due giri: computer 1440x900 (barra "Chiedi a Falco", scadenze entro 30 giorni) e
// telefono 390x844 (Falco al centro del menu, nuovo assunto aperto e compilato).
// Il pulsante di invio del foglio non viene mai premuto: lo preme l'utente.

import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const OUT = new URL('../out/', import.meta.url).pathname;
const CARTELLA = process.argv[2] || 'prova-falco';
await mkdir(CARTELLA, { recursive: true });

const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  let f = join(OUT, p);
  try {
    if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
  } catch {
    if (!extname(f)) f = join(OUT, p, 'index.html');
  }
  try {
    const b = await readFile(f);
    res.writeHead(200, { 'content-type': TIPI[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end('404');
  }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const AZIENDA = 7;
const PERMESSI = ['dashboard', 'dipendenti_vedi', 'dipendenti_modifica', 'nuovo_assunto', 'cessazione', 'scadenziario', 'formazione_vedi', 'visite_vedi', 'documenti_vedi', 'documenti_carica', 'avvio', 'pronto_ispezioni', 'messaggi', 'nearmiss_vedi', 'prenotazioni_richiedi'];
const UTENTE = {
  id: 41, name: 'Maria Greco', email: 'referente@esempio.it', role: 'utente_azienda', tenant_id: 1, tenant_name: 'Studio Esempio',
  needs_onboarding: false, app: 'azienda',
  aziende: [{ id: AZIENDA, ragione_sociale: 'Trattoria Il Glicine Esempio', ruoli: ['referente'], permessi: PERMESSI, attivazione: null }],
};

function risposta(testoUtente, testo, interfaccia) {
  const ora = new Date().toISOString();
  return {
    data: {
      conversazione: { id: 900, titolo: 'Falco', azienda: { id: AZIENDA, ragione_sociale: 'Trattoria Il Glicine Esempio' }, aggiornata: ora, sezione: 'azienda.dashboard' },
      messaggio_utente: { id: 1, ruolo: 'utente', testo: testoUtente, passi: [], azioni: [], pannelli: [], creato: ora },
      risposta: { id: 2, ruolo: 'agente', testo, passi: [], azioni: [], pannelli: [], creato: ora, interfaccia },
    },
  };
}

const SCENARI = {
  scadenze: risposta('Fammi vedere cosa scade nei prossimi 30 giorni', 'Ti ho aperto lo scadenziario sui prossimi 30 giorni. Parti dalle voci in rosso.', [
    { tipo: 'apri', sezione: 'azienda.scadenze', rotta: '/azienda/scadenze/', azienda_id: AZIENDA, etichetta: 'Apro lo scadenziario della Trattoria' },
    { tipo: 'tocca', sezione: 'azienda.scadenze', rotta: '/azienda/scadenze/', azienda_id: AZIENDA, elemento: 'finestra_30', etichetta: 'Scelgo le scadenze entro 30 giorni' },
  ]),
  assunto: risposta('Aggiungi Mario Rossi come magazziniere', 'Ho preparato la comunicazione del nuovo assunto. Controlla i dati e premi Comunica: la invio solo con la tua conferma.', [
    { tipo: 'apri', sezione: 'azienda.persone', rotta: '/azienda/persone/', azienda_id: AZIENDA, etichetta: 'Apro i dipendenti' },
    { tipo: 'tocca', sezione: 'azienda.persone', rotta: '/azienda/persone/', azienda_id: AZIENDA, elemento: 'nuovo_assunto', etichetta: 'Apro la comunicazione del nuovo assunto' },
    { tipo: 'compila', sezione: 'azienda.persone', rotta: '/azienda/persone/', azienda_id: AZIENDA, campo: 'assunto_nome', valore: 'Mario', etichetta: 'Scrivo il nome' },
    { tipo: 'compila', sezione: 'azienda.persone', rotta: '/azienda/persone/', azienda_id: AZIENDA, campo: 'assunto_cognome', valore: 'Rossi', etichetta: 'Scrivo il cognome' },
    { tipo: 'compila', sezione: 'azienda.persone', rotta: '/azienda/persone/', azienda_id: AZIENDA, campo: 'assunto_mansione', valore: 'Magazziniere', etichetta: 'Scrivo la mansione' },
  ]),
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const esiti = [];

async function giro(nome, viewport, partenza, scenario, chiedi, controlla) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));
  let inviati = 0;
  await page.route('**/api/**', async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^\/api/, '');
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/auth/me') return json(UTENTE);
    if (p === '/portale/aziende') return json({ data: UTENTE.aziende });
    if (p === '/agente/messaggi' && route.request().method() === 'POST') {
      inviati++;
      await new Promise((r) => setTimeout(r, 400));
      return json(SCENARI[scenario]);
    }
    if (p.startsWith('/agente/profilo')) return json({ data: { nome: 'Falco', tono: 'autorevole', istruzioni_studio: '', strumenti_disattivati: [], strumenti: [], modificabile: false, voce: false } });
    if (p.startsWith('/agente/progresso')) return json({ data: { eventi: [], fine: false } });
    return json({ data: [] });
  });
  await page.addInitScript(() => {
    localStorage.setItem('crm_dvr_jwt', 'prova');
    localStorage.setItem('crm_dvr_ha_accesso', '1');
  });
  await page.goto(`${BASE}${partenza}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(CARTELLA, `${nome}-1-partenza.png`) });
  await chiedi(page);
  // Il cursore del Falco e la striscia "sta lavorando" compaiono mentre esegue.
  await page.waitForSelector('[data-falco-striscia="lavoro"]', { timeout: 10000 });
  await page.waitForSelector('[data-falco-cursore]', { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(CARTELLA, `${nome}-2-lavoro.png`) });
  await page.waitForSelector('[data-falco-striscia="fatto"]', { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(CARTELLA, `${nome}-3-fatto.png`) });
  const esito = await controlla(page);
  esiti.push({ nome, inviati, errori, ...esito });
  await ctx.close();
}

try {
  await giro(
    'computer-1440',
    { width: 1440, height: 900 },
    '/azienda/documenti/',
    'scadenze',
    async (page) => {
      const barra = page.locator('form[data-falco="falco.chiedi"] input');
      await barra.fill('Fammi vedere cosa scade nei prossimi 30 giorni');
      await barra.press('Enter');
    },
    async (page) => ({
      percorso: new URL(page.url()).pathname,
      finestra30: await page.locator('[data-falco="finestra_30"]').getAttribute('aria-selected'),
      evidenziato: await page.locator('.falco-evidenza').count(),
    })
  );
  await giro(
    'telefono-390',
    { width: 390, height: 844 },
    '/azienda/dashboard/',
    'assunto',
    async (page) => {
      const testo = page.getByRole('textbox').first();
      await testo.fill('Aggiungi Mario Rossi come magazziniere');
      await testo.press('Enter');
    },
    async (page) => ({
      percorso: new URL(page.url()).pathname,
      campoNome: await page.locator('[data-falco-campo="assunto_nome"]').inputValue(),
      cognome: await page.locator('[data-falco-campo="assunto_cognome"]').inputValue(),
      mansione: await page.locator('[data-falco-campo="assunto_mansione"]').inputValue(),
    })
  );
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(esiti, null, 2));
const ok =
  esiti.length === 2 &&
  esiti[0].percorso === '/azienda/scadenze/' &&
  esiti[0].finestra30 === 'true' &&
  esiti[1].percorso === '/azienda/persone/' &&
  esiti[1].mansione === 'Magazziniere' &&
  esiti.every((e) => e.inviati === 1 && e.errori.length === 0);
console.log(ok ? 'PROVA OK' : 'PROVA NON RIUSCITA');
process.exit(ok ? 0 : 1);
