/**
 * Falco principale: passi dell'interfaccia che arrivano con la risposta del Falco
 * (campo `interfaccia`, App\Services\Agent\Interfaccia) e piano delle operazioni
 * che il browser esegue davanti all'utente. Qui solo logica pura, provata con Jest:
 * l'esecuzione nel DOM sta in esecutore.ts.
 *
 * Regole: i passi non cambiano dati; "tocca" apre solo pulsanti segnati con
 * data-falco-tocca (mai invii, firme, pagamenti, conferme); le rotte sono solo
 * quelle delle due app.
 */

export type TipoPasso = 'apri' | 'evidenzia' | 'tocca' | 'compila';

export interface PassoInterfaccia {
  tipo: TipoPasso;
  sezione: string;
  /** /gestionale/<chiave>/ o /azienda/<chiave>/ */
  rotta: string;
  aziendaId: number | null;
  /** data-falco="..." (evidenzia, tocca). */
  elemento?: string;
  /** data-falco-campo="..." (compila). */
  campo?: string;
  valore?: string;
  oggetto?: { tipo: string; id: number } | null;
  /** Riga per la barra "Falco sta lavorando". */
  etichetta: string;
}

// Schermata, con al massimo id e sottoscheda (scheda dell'azienda nel gestionale).
const ROTTA = /^\/(gestionale|azienda)\/[a-z]+\/(\?id=\d{1,9}(&tab=[a-z]{3,20})?)?$/;
const NOME = /^[a-z0-9_.]{1,60}$/;
const TIPI: TipoPasso[] = ['apri', 'evidenzia', 'tocca', 'compila'];
export const MAX_PASSI = 12;

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Passi validi della risposta; quelli malformati o con rotte estranee si scartano. */
export function mapPassiInterfaccia(raw: unknown): PassoInterfaccia[] {
  if (!Array.isArray(raw)) return [];
  const out: PassoInterfaccia[] = [];
  for (const x of raw.slice(0, MAX_PASSI)) {
    const r = rec(x);
    if (!r) continue;
    const tipo = r.tipo as TipoPasso;
    const rotta = typeof r.rotta === 'string' ? r.rotta : '';
    if (!TIPI.includes(tipo) || !ROTTA.test(rotta)) continue;
    const elemento = typeof r.elemento === 'string' && NOME.test(r.elemento) ? r.elemento : undefined;
    const campo = typeof r.campo === 'string' && NOME.test(r.campo) ? r.campo : undefined;
    if ((tipo === 'evidenzia' || tipo === 'tocca') && !elemento) continue;
    if (tipo === 'compila' && (!campo || typeof r.valore !== 'string')) continue;
    const az = Number(r.azienda_id);
    const og = rec(r.oggetto);
    const ogId = og ? Number(og.id) : NaN;
    out.push({
      tipo,
      sezione: typeof r.sezione === 'string' ? r.sezione : '',
      rotta,
      aziendaId: Number.isInteger(az) && az > 0 ? az : null,
      elemento,
      campo,
      valore: tipo === 'compila' ? String(r.valore).slice(0, 200) : undefined,
      oggetto: og && typeof og.tipo === 'string' && Number.isInteger(ogId) && ogId > 0 ? { tipo: og.tipo, id: ogId } : null,
      etichetta: typeof r.etichetta === 'string' && r.etichetta.trim() ? r.etichetta.trim().slice(0, 140) : 'Lavoro sulla schermata',
    });
  }
  return out;
}

/**
 * Ricerca dei documenti sul dispositivo dell'utente (09/11, strumento cerca_documenti): il
 * pannello si apre con i tipi chiesti e i dati per riconoscere i documenti dell'azienda.
 */
export interface RicercaDocumenti {
  aziendaId: number;
  tipi: string[];
  etichetta: string;
  impresa: {
    denominazione?: string;
    partita_iva?: string;
    codice_fiscale?: string;
    legale_rappresentante?: string;
    lavoratori?: { nome?: string; cognome?: string; codice_fiscale?: string }[];
  };
}

const TIPI_RICERCA = ['logo', 'visura', 'nomina', 'attestato_formazione', 'verbale_verifica', 'sds', 'dvr', 'libretto_attrezzatura', 'elenco_lavoratori', 'planimetria', 'piano_emergenza', 'altro'];

/** Prima richiesta di ricerca valida tra i passi della risposta, se c'e'. */
export function mapRicercaDocumenti(raw: unknown): RicercaDocumenti | null {
  if (!Array.isArray(raw)) return null;
  for (const x of raw.slice(0, MAX_PASSI)) {
    const r = rec(x);
    if (!r || r.tipo !== 'cerca_documenti') continue;
    const az = Number(r.azienda_id);
    const tipi = Array.isArray(r.tipi) ? r.tipi.filter((t): t is string => typeof t === 'string' && TIPI_RICERCA.includes(t)) : [];
    if (!Number.isInteger(az) || az <= 0 || tipi.length === 0) continue;
    const im = rec(r.impresa) ?? {};
    const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);
    const lav = Array.isArray(im.lavoratori)
      ? im.lavoratori.slice(0, 300).map((l) => rec(l) ?? {}).map((l) => ({ nome: txt(l.nome), cognome: txt(l.cognome), codice_fiscale: txt(l.codice_fiscale) }))
      : undefined;
    return {
      aziendaId: az,
      tipi,
      etichetta: txt(r.etichetta) ?? 'Cerco i documenti',
      impresa: { denominazione: txt(im.denominazione), partita_iva: txt(im.partita_iva), codice_fiscale: txt(im.codice_fiscale), legale_rappresentante: txt(im.legale_rappresentante), lavoratori: lav },
    };
  }
  return null;
}

/** Operazioni elementari che l'esecutore compie, nell'ordine. */
export type Operazione =
  | { op: 'riga'; testo: string }
  | { op: 'azienda'; id: number }
  | { op: 'naviga'; rotta: string }
  | { op: 'oggetto'; tipo: string; id: number; aziendaId: number | null }
  | { op: 'punta'; selettore: string; tocca: boolean }
  | { op: 'scrivi'; selettore: string; valore: string };

export const selettoreElemento = (n: string) => `[data-falco="${n}"]`;
export const selettoreCampo = (n: string) => `[data-falco-campo="${n}"]`;

/** Normalizza un percorso (con o senza basePath e barra finale) per il confronto con la rotta. */
export function stessaRotta(percorso: string, rotta: string, basePath = ''): boolean {
  let p = percorso.split('?')[0].split('#')[0];
  if (basePath && p.startsWith(basePath)) p = p.slice(basePath.length) || '/';
  if (!p.endsWith('/')) p += '/';
  return p === rotta;
}

/**
 * Piano delle operazioni: si naviga solo se la rotta cambia, l'azienda si sceglie
 * prima di navigare (cosi' la schermata nuova si apre gia' sull'azienda giusta).
 */
export function pianoEsecuzione(passi: PassoInterfaccia[], stato: { percorso: string; aziendaId: number | null; basePath?: string }): Operazione[] {
  const ops: Operazione[] = [];
  let percorso = stato.percorso;
  let azienda = stato.aziendaId;
  for (const p of passi) {
    ops.push({ op: 'riga', testo: p.etichetta });
    if (p.aziendaId !== null && p.aziendaId !== azienda) {
      ops.push({ op: 'azienda', id: p.aziendaId });
      azienda = p.aziendaId;
    }
    if (!stessaRotta(percorso, p.rotta, stato.basePath)) {
      ops.push({ op: 'naviga', rotta: p.rotta });
      percorso = p.rotta;
    }
    if (p.tipo === 'apri') {
      if (p.oggetto) ops.push({ op: 'oggetto', tipo: p.oggetto.tipo, id: p.oggetto.id, aziendaId: p.aziendaId });
      ops.push({ op: 'punta', selettore: selettoreElemento('testata'), tocca: false });
    } else if (p.tipo === 'evidenzia' || p.tipo === 'tocca') {
      ops.push({ op: 'punta', selettore: selettoreElemento(p.elemento!), tocca: p.tipo === 'tocca' });
    } else {
      ops.push({ op: 'scrivi', selettore: selettoreCampo(p.campo!), valore: p.valore ?? '' });
    }
  }
  return ops;
}

/** Testo progressivo della digitazione simulata: un pezzo per battuta (al massimo ~40 battute). */
export function battute(valore: string): string[] {
  if (!valore) return [''];
  const passo = Math.max(1, Math.ceil(valore.length / 40));
  const out: string[] = [];
  for (let i = passo; i < valore.length; i += passo) out.push(valore.slice(0, i));
  out.push(valore);
  return out;
}

/** Prima frase della risposta per la striscia finale (senza markdown). */
export function riassunto(testo: string, max = 160): string {
  const t = testo
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fine = t.search(/[.!?](\s|$)/);
  const f = fine > 0 ? t.slice(0, fine + 1) : t;
  return f.length > max ? `${f.slice(0, max - 1).trimEnd()}…` : f;
}

/** Rettangolo minimo (DOMRect o finto nei test). */
export interface Rettangolo {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Dove mettere la punta del cursore fantasma perche' la scritta "Falco" non copra
 * il testo del punto (titolo della schermata, etichetta del campo): la punta va sul
 * bordo basso del punto e la scritta resta sotto, fuori. Se sotto non c'e' spazio
 * (fondo dello schermo o striscia del Falco) la punta va sul bordo alto e la
 * scritta sale sopra.
 */
export function posizioneCursore(r: Rettangolo, vista: { larghezza: number; altezza: number; riservaBasso?: number }): { x: number; y: number; sopra: boolean } {
  const ingombro = 46; // freccia piu' scritta sotto la punta
  const x = Math.round(Math.min(Math.max(r.left + Math.min(r.width / 2, 40), 4), Math.max(4, vista.larghezza - 72)));
  const basso = r.top + r.height;
  const rientro = Math.min(6, r.height / 3);
  const limite = vista.altezza - (vista.riservaBasso ?? 0);
  if (basso - rientro + ingombro <= limite) return { x, y: Math.round(basso - rientro), sopra: false };
  return { x, y: Math.round(Math.max(r.top + rientro, 24)), sopra: true };
}
