import type { AppPortale, Sezione } from '@/lib/portale/sezioni';

/**
 * Regole di navigazione dell'app per telefono (03 §1 e §2), senza React: profondità delle
 * pagine, transizione da usare, destinazione di Indietro e contatori della barra in basso.
 */

export type Transizione = 'v-push' | 'v-pop' | 'v-tab' | '';

/** Sezioni di servizio che non sono nel menu ma hanno una pagina propria. */
const SERVIZIO = new Set(['notifiche', 'account']);

/**
 * Profondità: voce della barra (o Tutto) = 0; altra sezione = 1; dettaglio con id = +2.
 */
export function livello(sezione: string, haId: boolean, visibili: Sezione[]): number {
  const base = sezione === 'tutto' || visibili.some((s) => s.chiave === sezione && s.tab) ? 0 : 1;
  return base + (haId ? 2 : 0);
}

/** Una pagina interna (livello > 0) mostra Indietro al posto delle iniziali e il titolo sempre. */
export function interna(sezione: string, haId: boolean, visibili: Sezione[]): boolean {
  return livello(sezione, haId, visibili) > 0 || SERVIZIO.has(sezione);
}

export interface PaginaVista {
  chiave: string;
  livello: number;
}

/**
 * Transizione tra due pagine: più in profondità = push, verso l'alto = pop, stesso livello
 * su un'altra pagina = tab, stessa pagina ridisegnata = nessuna animazione.
 */
export function transizione(prima: PaginaVista | null, ora: PaginaVista): Transizione {
  // Primo disegno: come il cambio di voce (04-schermate/telefono, Transizioni di pagina).
  if (!prima) return 'v-tab';
  if (prima.chiave === ora.chiave) return '';
  if (ora.livello > prima.livello) return 'v-push';
  if (ora.livello < prima.livello) return 'v-pop';
  return 'v-tab';
}

/**
 * Dove porta Indietro quando non c'è una pagina precedente dell'app (04-schermate/telefono:
 * history.back(), senza storia la prima pagina del ruolo).
 */
export function indietroDi(app: AppPortale, visibili: Sezione[]): string {
  const prima = visibili.find((s) => s.tab) ?? visibili[0];
  return prima ? `/${app}/${prima.chiave}/` : `/${app}/tutto/`;
}

// L'ultima pagina vista resta in memoria tra una navigazione e l'altra (il guscio si rimonta).
let ultima: PaginaVista | null = null;
let ultimaTransizione: Transizione = '';
let pagineViste = 0;

/**
 * Registra la pagina aperta e restituisce la transizione da applicare. Una seconda chiamata
 * per la stessa pagina (doppio disegno di React in sviluppo) restituisce la stessa transizione.
 */
export function entraIn(ora: PaginaVista): Transizione {
  if (ultima && ultima.chiave === ora.chiave && ultima.livello === ora.livello) return ultimaTransizione;
  ultimaTransizione = transizione(ultima, ora);
  ultima = ora;
  pagineViste++;
  return ultimaTransizione;
}

/** C'è una pagina precedente dell'app a cui tornare con la cronologia. */
export function cePrecedente(): boolean {
  return pagineViste > 1;
}

/** Solo per le prove. */
export function azzeraNavigazione(): void {
  ultima = null;
  ultimaTransizione = '';
  pagineViste = 0;
}

export interface ContatoriBarra {
  home: number;
  scadenze: number;
  tutto: number;
}

/**
 * Contatori della barra (03 §2): Home = "Da fare adesso"; Scadenze = scadenze superate entro
 * 30 giorni; Persone nessuno; Tutto = somma delle sezioni con contaInTutto visibili al ruolo
 * (Documenti, Servizi, Completa il fascicolo, Antincendio, Primo soccorso, Infortuni, Messaggi).
 */
export function contatoriBarra(contatori: Record<string, number | undefined>, visibili: Sezione[]): ContatoriBarra {
  const n = (k: string) => Math.max(0, Math.floor(contatori[k] ?? 0));
  const vede = (k: string) => visibili.some((s) => s.chiave === k);
  return {
    home: vede('dashboard') ? n('dashboard') : 0,
    scadenze: vede('scadenze') ? n('scadenze') : 0,
    tutto: visibili.filter((s) => s.contaInTutto).reduce((t, s) => t + n(s.chiave), 0),
  };
}
