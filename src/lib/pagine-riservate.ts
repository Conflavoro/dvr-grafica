import type { Role } from './mock-auth';

/**
 * Pagine di gestione riservate ad alcuni ruoli. Chi apre l'indirizzo a mano
 * con un altro profilo vede un avviso chiaro invece di una pagina vuota o di
 * un errore di caricamento (il backend risponde comunque 403).
 */
const RISERVATE: Array<[string, Role[]]> = [
  ['/tenants', ['admin_conflavoro']],
  ['/piattaforma', ['admin_conflavoro']],
  ['/utenti', ['admin_conflavoro', 'titolare_studio']],
  ['/team', ['admin_conflavoro', 'titolare_studio']],
];

export function paginaConsentita(role: Role | undefined, pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  for (const [prefisso, ruoli] of RISERVATE) {
    if (p === prefisso || p.startsWith(prefisso + '/')) return role != null && ruoli.includes(role);
  }
  return true;
}
