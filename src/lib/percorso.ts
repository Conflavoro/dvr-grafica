/**
 * Percorso base dell'app (NEXT_PUBLIC_BASE_PATH, es. "/demo" per la demo dal vivo
 * su https://dvr.conflavoro.it/demo/). Il router di Next lo aggiunge da solo a
 * Link e router.push; i file di public (immagini, video, modelli), window.location
 * e i tag <a> scritti a mano invece passano da qui. Nella build normale è vuoto.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

/** Aggiunge il percorso base a un percorso assoluto del sito ("/brand/x.svg" -> "/demo/brand/x.svg"). */
export function percorso(p: string, base: string = BASE_PATH): string {
  if (!p.startsWith('/') || p.startsWith('//')) return p;
  if (base && (p === base || p.startsWith(`${base}/`))) return p;
  return `${base}${p}`;
}

/** Toglie il percorso base da un pathname del browser ("/demo/azienda/" -> "/azienda/"). */
export function senzaBase(pathname: string, base: string = BASE_PATH): string {
  if (!base) return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}
