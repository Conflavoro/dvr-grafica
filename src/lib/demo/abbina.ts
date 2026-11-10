/**
 * Versione dimostrativa: scelta della risposta registrata per una richiesta.
 * Logica pura (nessun accesso al browser), provata con Jest.
 *
 * Una registrazione è la sequenza delle risposte /api/* viste durante un giro
 * vero dell'interfaccia con un profilo. Il "cursore" dice fin dove è arrivata la
 * storia: dopo una scrittura registrata le letture mostrano lo stato registrato
 * dopo quella scrittura, così l'interfaccia vede il cambiamento.
 */

export interface VoceRegistrata {
  /** Numero d'ordine nella registrazione. */
  s: number;
  /** Metodo HTTP. */
  m: string;
  /** Percorso senza il prefisso /api, con la query. */
  p: string;
  /** Stato HTTP. */
  st: number;
  /** Corpo JSON della risposta (null per i file). */
  b?: unknown;
  /** File statico con il corpo binario (percorso relativo alla radice del sito). */
  f?: string;
  /** Tipo del contenuto del file. */
  ct?: string;
  /** Content-Disposition del file. */
  cd?: string;
  /** Corpo JSON della richiesta (scritture). */
  q?: unknown;
}

export const SCRITTURE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function soloPercorso(p: string): string {
  const i = p.indexOf('?');
  return i < 0 ? p : p.slice(0, i);
}

/** Forma del percorso: i segmenti che sembrano identificativi diventano "*". */
export function forma(p: string): string {
  return soloPercorso(p)
    .split('/')
    .map((x) => (/^\d+$/.test(x) || /^[A-Za-z0-9_-]{16,}$/.test(x) || /^[0-9a-f-]{20,}$/i.test(x) ? '*' : x))
    .join('/');
}

const VUOTE = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'ma', 'che', 'chi',
  'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dal', 'dalla', 'dai', 'nel', 'nella', 'nei', 'sul', 'sulla',
  'mi', 'ti', 'ci', 'si', 'vi', 'ne', 'non', 'come', 'cosa', 'quali', 'quale', 'sono', 'è', 'e', 'ho', 'hai', 'ha', 'abbiamo', 'questo', 'questa', 'quello',
  'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'nostro', 'nostra', 'oggi', 'per', 'favore', 'puoi', 'dimmi', 'fammi',
]);

/** Parole significative di un testo, senza accenti e senza parole vuote. */
export function parole(t: string): Set<string> {
  const norm = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ');
  return new Set(norm.split(/\s+/).filter((w) => w.length >= 3 && !VUOTE.has(w)).map((w) => (w.length > 5 ? w.slice(0, 5) : w)));
}

/** Somiglianza tra due testi da 0 a 1 (media tra Jaccard e copertura della domanda). */
export function somiglianza(a: string, b: string): number {
  const x = parole(a);
  const y = parole(b);
  if (x.size === 0 || y.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let comuni = 0;
  x.forEach((w) => {
    if (y.has(w)) comuni++;
  });
  const jaccard = comuni / (x.size + y.size - comuni);
  const copertura = comuni / x.size;
  return (jaccard + copertura) / 2;
}

/** Testo della domanda al Falco in un corpo di richiesta. */
export function testoDomanda(corpo: unknown): string {
  const c = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
  return typeof c.testo === 'string' ? c.testo : '';
}

/** Sezione della domanda al Falco. */
export function sezioneDomanda(corpo: unknown): string {
  const c = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
  return typeof c.sezione === 'string' ? c.sezione : '';
}

function stabile(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stabile).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => k !== 'richiesta_id')
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stabile(o[k])}`)
    .join(',')}}`;
}

/** Seq della prima scrittura successiva a s (Infinity se non ce ne sono). */
export function prossimaScrittura(voci: VoceRegistrata[], s: number): number {
  let min = Infinity;
  for (const v of voci) if (SCRITTURE.has(v.m) && v.s > s && v.s < min) min = v.s;
  return min;
}

/** Cursore iniziale: tutto quello che è stato letto prima della prima scrittura. */
export function cursoreIniziale(voci: VoceRegistrata[]): number {
  return prossimaScrittura(voci, -Infinity) - 1;
}

/** Cursore dopo una scrittura registrata: arriva fino alla scrittura successiva. Mai indietro. */
export function cursoreDopo(voci: VoceRegistrata[], scelta: VoceRegistrata, attuale: number): number {
  return Math.max(attuale, prossimaScrittura(voci, scelta.s) - 1);
}

export type Livello = 'esatto' | 'percorso' | 'forma';

export interface Scelta {
  voce: VoceRegistrata;
  livello: Livello;
  punteggio: number;
}

/**
 * Risposta registrata per la richiesta: prima metodo e percorso con la query,
 * poi il percorso senza query, poi la forma del percorso. Tra più letture vale
 * l'ultima entro il cursore (o la prima, se sono tutte dopo); tra più scritture
 * quella col corpo più simile.
 */
export function scegli(voci: VoceRegistrata[], metodo: string, percorso: string, corpo: unknown, cursore: number): Scelta | null {
  const m = metodo.toUpperCase();
  const stessi = voci.filter((v) => v.m === m);
  const livelli: Array<[Livello, (v: VoceRegistrata) => boolean]> = [
    ['esatto', (v) => v.p === percorso],
    ['percorso', (v) => soloPercorso(v.p) === soloPercorso(percorso)],
    ['forma', (v) => forma(v.p) === forma(percorso)],
  ];
  for (const [livello, ok] of livelli) {
    const c = stessi.filter(ok);
    if (c.length === 0) continue;
    if (!SCRITTURE.has(m)) {
      const entro = c.filter((v) => v.s <= cursore);
      const voce = entro.length ? entro.reduce((a, b) => (b.s > a.s ? b : a)) : c.reduce((a, b) => (b.s < a.s ? b : a));
      return { voce, livello, punteggio: 1 };
    }
    const chiave = stabile(corpo);
    const uguale = c.find((v) => stabile(v.q) === chiave);
    if (uguale) return { voce: uguale, livello, punteggio: 1 };
    const domanda = testoDomanda(corpo);
    let migliore = c[0];
    let punteggio = domanda ? -1 : 0.5;
    if (domanda) {
      for (const v of c) {
        const p = somiglianza(domanda, testoDomanda(v.q));
        if (p > punteggio) {
          punteggio = p;
          migliore = v;
        }
      }
    }
    return { voce: migliore, livello, punteggio };
  }
  return null;
}

/** Domande registrate per il Falco di una sezione (per i suggerimenti onesti). */
export function domandeRegistrate(voci: VoceRegistrata[], sezione: string, quante = 3): string[] {
  const tutte = voci.filter((v) => v.m === 'POST' && soloPercorso(v.p) === '/agente/messaggi' && v.st < 400);
  const della = tutte.filter((v) => sezioneDomanda(v.q) === sezione);
  const elenco = (della.length ? della : tutte).map((v) => testoDomanda(v.q)).filter(Boolean);
  return Array.from(new Set(elenco)).slice(0, quante);
}

/** Corpo vuoto ma ben formato per una lettura senza registrazione. */
export function vuotoBenFormato(): Record<string, unknown> {
  return { data: [], meta: { total: 0, demo: true } };
}
