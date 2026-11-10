/**
 * Versione dimostrativa (NEXT_PUBLIC_DEMO=true): le richieste /api/* non escono
 * dal browser. Rispondono le registrazioni di un giro vero dell'interfaccia,
 * servite come file statici in /demo/. Nella build normale questo modulo non
 * viene mai installato.
 */

import { DEMO } from './attivo';
import {
  SCRITTURE,
  cursoreDopo,
  cursoreIniziale,
  domandeRegistrate,
  scegli,
  sezioneDomanda,
  soloPercorso,
  testoDomanda,
  vuotoBenFormato,
  type VoceRegistrata,
} from './abbina';

export const CHIAVE_PROFILO = 'demo_profilo';
const CHIAVE_CURSORE = 'demo_cursore_';
const SOGLIA_DOMANDA = 0.5;

export interface ProfiloDemo {
  chiave: string;
  nome: string;
  ruolo: string;
  descrizione: string;
  app: 'gestionale' | 'azienda' | 'lavoratore';
  destinazione: string;
}

export interface IndiceDemo {
  registrato_il: string;
  profili: ProfiloDemo[];
}

type FetchFn = typeof fetch;
let fetchVero: FetchFn | null = null;
const registrazioni = new Map<string, Promise<VoceRegistrata[]>>();
const cursori = new Map<string, number>();

function leggi(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function scrivi(k: string, v: string | null): void {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* archivio del browser non disponibile: resta lo stato in memoria */
  }
}

export function profiloAttivo(): string | null {
  return typeof window === 'undefined' ? null : leggi(CHIAVE_PROFILO);
}

export function scegliProfilo(chiave: string | null): void {
  scrivi(CHIAVE_PROFILO, chiave);
}

function vero(): FetchFn {
  return fetchVero ?? window.fetch.bind(window);
}

let indice: Promise<IndiceDemo> | null = null;
export function caricaIndice(): Promise<IndiceDemo> {
  indice ??= vero()('/demo/indice.json').then((r) => r.json() as Promise<IndiceDemo>);
  return indice;
}

function registrazione(profilo: string): Promise<VoceRegistrata[]> {
  let r = registrazioni.get(profilo);
  if (!r) {
    r = vero()(`/demo/r/${encodeURIComponent(profilo)}.json`)
      .then((x) => (x.ok ? x.json() : { voci: [] }))
      .then((j: { voci?: VoceRegistrata[] }) => (Array.isArray(j.voci) ? j.voci : []))
      .catch(() => [] as VoceRegistrata[]);
    registrazioni.set(profilo, r);
  }
  return r;
}

function cursore(profilo: string, voci: VoceRegistrata[]): number {
  let c = cursori.get(profilo);
  if (c === undefined) {
    const salvato = Number(leggi(CHIAVE_CURSORE + profilo));
    c = Number.isFinite(salvato) && leggi(CHIAVE_CURSORE + profilo) !== null ? salvato : cursoreIniziale(voci);
    cursori.set(profilo, c);
  }
  return c;
}

function spostaCursore(profilo: string, valore: number): void {
  cursori.set(profilo, valore);
  scrivi(CHIAVE_CURSORE + profilo, String(valore === Infinity ? Number.MAX_SAFE_INTEGER : valore));
}

/** Riporta la dimostrazione allo stato iniziale di tutti i profili. */
export function azzeraDemo(): void {
  cursori.clear();
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(CHIAVE_CURSORE))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* niente da azzerare */
  }
}

function json(corpo: unknown, stato = 200): Response {
  if (stato === 204) return new Response(null, { status: 204 });
  return new Response(JSON.stringify(corpo ?? null), { status: stato, headers: { 'Content-Type': 'application/json' } });
}

const attesa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clona<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

async function rispostaFile(v: VoceRegistrata): Promise<Response> {
  const r = await vero()('/' + String(v.f).replace(/^\/+/, ''));
  const blob = await r.blob();
  const h: Record<string, string> = { 'Content-Type': v.ct || blob.type || 'application/octet-stream' };
  if (v.cd) h['Content-Disposition'] = v.cd;
  return new Response(blob, { status: v.st || 200, headers: h });
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Risposta del Falco: registrata se la domanda somiglia, altrimenti onesta. */
async function falco(voci: VoceRegistrata[], corpo: unknown): Promise<Response> {
  const domanda = testoDomanda(corpo);
  const scelta = scegli(voci, 'POST', '/agente/messaggi', corpo, Infinity);
  await attesa(900 + Math.min(1600, domanda.length * 12));
  if (scelta && scelta.punteggio >= SOGLIA_DOMANDA && scelta.voce.st < 400) {
    const b = clona(scelta.voce.b) as Record<string, unknown>;
    const d = rec(b?.data);
    if (d.messaggio_utente) rec(d.messaggio_utente).testo = domanda;
    return json(b, 200);
  }
  const modello = voci.find((v) => v.m === 'POST' && soloPercorso(v.p) === '/agente/messaggi' && v.st < 400);
  const proposte = domandeRegistrate(voci, sezioneDomanda(corpo));
  // Pulsanti d'azione dell'interfaccia ("Prenota: ...", "Chiedi allo studio: ..."): nella dimostrazione non partono.
  const azione = /^[A-ZÀ-Ý][^:\n]{2,40}:\s+\S/.test(domanda);
  const testo =
    (azione
      ? 'Nella versione dimostrativa questa azione non parte davvero: nella piattaforma la preparo io e la trovi da confermare, come sempre. '
      : 'Questa è la versione dimostrativa con dati di esempio: rispondo con le risposte vere che ho dato alle domande proposte in ogni sezione. ') +
    (proposte.length ? `Prova per esempio a chiedermi:\n\n${proposte.map((p) => `- ${p}`).join('\n')}` : 'Prova una delle domande proposte nella sezione.');
  const base = rec(clona(modello?.b));
  const d = rec(base.data);
  const ora = new Date().toISOString();
  return json(
    {
      data: {
        conversazione: d.conversazione ?? { id: 1, titolo: 'Dimostrazione' },
        messaggio_utente: { ...rec(d.messaggio_utente), id: Date.now(), ruolo: 'utente', testo: domanda, passi: [], azioni: [], pannelli: [], creato: ora },
        risposta: { ...rec(d.risposta), id: Date.now() + 1, ruolo: 'agente', testo, passi: [], azioni: [], pannelli: [], creato: ora },
      },
    },
    200
  );
}

/** Richieste senza registrazione (per il controllo della dimostrazione). */
function mancante(metodo: string, percorso: string): void {
  const w = window as unknown as { __demoMancanti?: string[] };
  (w.__demoMancanti ??= []).push(`${metodo} ${percorso}`);
}

const DOWNLOAD = /\/(download|pdf|file|docx)(\/|\?|$)|\/documenti\/\d+$|\/giudizio\/\d+$/;

/** Risposta dimostrativa per /api/<percorso>. */
export async function rispondi(metodo: string, percorso: string, corpo: unknown): Promise<Response> {
  const m = metodo.toUpperCase();
  const solo = soloPercorso(percorso);
  const lavoratore = solo.startsWith('/lavoratore/');
  const profilo = lavoratore ? 'lavoratore' : profiloAttivo();

  if (solo === '/auth/logout') {
    scegliProfilo(null);
    return json({ message: 'Uscita eseguita' });
  }
  if (solo === '/auth/refresh') return profilo ? json({ access_token: `demo-${profilo}`, token_type: 'bearer', expires_in: 3600 }) : json({ message: 'Sessione scaduta' }, 401);
  if (!profilo) return json({ message: 'Scegli un profilo della dimostrazione.' }, 401);

  const voci = await registrazione(profilo);
  if (m === 'POST' && solo === '/agente/messaggi') return falco(voci, corpo);
  // La voce del Falco nella dimostrazione è quella del browser.
  if (solo === '/agente/voce') return json({ message: 'Voce non disponibile nella dimostrazione' }, 404);
  if (m === 'POST' && (solo === '/ai/transcribe' || solo.endsWith('/nota-vocale'))) {
    return json({ message: 'Nella versione dimostrativa la dettatura non è attiva: scrivi la richiesta.' }, 422);
  }

  const c = cursore(profilo, voci);
  const scelta = scegli(voci, m, percorso, corpo, c);
  if (scelta) {
    const v = scelta.voce;
    if (SCRITTURE.has(m)) spostaCursore(profilo, cursoreDopo(voci, v, c));
    if (v.f) return rispostaFile(v);
    let b = clona(v.b);
    if (solo === '/agente/profilo' && m === 'GET') {
      const d = rec(rec(b).data);
      d.voce = false;
    }
    if (SCRITTURE.has(m) && scelta.livello !== 'esatto' && v.st >= 400) b = { data: { ...rec(corpo), demo: true }, message: 'Fatto.' };
    return json(b, SCRITTURE.has(m) && scelta.livello !== 'esatto' && v.st >= 400 ? 200 : v.st);
  }
  mancante(m, percorso);
  if (SCRITTURE.has(m)) {
    await attesa(350);
    return json({ data: { id: Math.floor(Date.now() / 1000), ...rec(corpo), demo: true }, message: 'Fatto.' }, 200);
  }
  // Un file mai registrato non si inventa: l'interfaccia dice che non è disponibile.
  if (DOWNLOAD.test(solo)) return json({ message: 'File non disponibile nella dimostrazione.' }, 404);
  return json(vuotoBenFormato(), 200);
}

function percorsoApi(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url, window.location.href);
  } catch {
    return null;
  }
  if (u.origin !== window.location.origin) return null;
  const i = u.pathname.indexOf('/api/');
  if (i !== 0) return null;
  return u.pathname.slice(4) + u.search;
}

async function corpoRichiesta(init: RequestInit | undefined): Promise<unknown> {
  const b = init?.body;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return b;
    }
  }
  if (typeof FormData !== 'undefined' && b instanceof FormData) {
    const o: Record<string, unknown> = {};
    b.forEach((v, k) => {
      o[k] = typeof v === 'string' ? v : '[file]';
    });
    return o;
  }
  return null;
}

/** Orologio della dimostrazione: il giorno della registrazione, che scorre normalmente. */
function fermaOrologio(): void {
  const ora = Date.parse(process.env.NEXT_PUBLIC_DEMO_ORA || '');
  if (!Number.isFinite(ora)) return;
  const Vero = Date;
  const scarto = ora - Vero.now();
  const adesso = () => Vero.now() + scarto;
  function Orologio(this: unknown, ...a: unknown[]) {
    if (!(this instanceof Vero)) return new Vero(adesso()).toString();
    return a.length === 0 ? new Vero(adesso()) : new (Vero as unknown as new (...x: unknown[]) => Date)(...a);
  }
  Orologio.prototype = Vero.prototype;
  Orologio.now = adesso;
  Orologio.parse = Vero.parse;
  Orologio.UTC = Vero.UTC;
  (window as unknown as { Date: unknown }).Date = Orologio;
}

/** I link diretti a /api/* (documenti del lavoratore) diventano scaricamenti dalla registrazione. */
function intercettaLink(): void {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const p = percorsoApi(a.href);
      if (p === null) return;
      e.preventDefault();
      void rispondi('GET', p, null).then(async (r) => {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const cd = r.headers.get('Content-Disposition') || '';
        const nome = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)?.[1];
        const l = document.createElement('a');
        l.href = url;
        l.download = nome ? decodeURIComponent(nome) : 'documento';
        document.body.appendChild(l);
        l.click();
        l.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
    },
    true
  );
}

export function installaDemo(): void {
  if (!DEMO || typeof window === 'undefined') return;
  const w = window as unknown as { __demoInstallata?: boolean };
  if (w.__demoInstallata) return;
  w.__demoInstallata = true;
  fetchVero = window.fetch.bind(window);
  fermaOrologio();
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const p = percorsoApi(url);
    if (p === null) return (fetchVero as FetchFn)(input, init);
    const metodo = init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET';
    return rispondi(metodo, p, await corpoRichiesta(init));
  }) as FetchFn;
  intercettaLink();
}
