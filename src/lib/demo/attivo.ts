/** Versione dimostrativa a risposte registrate: accesa solo con NEXT_PUBLIC_DEMO=true al momento della build. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';

/**
 * Demo dal vivo (NEXT_PUBLIC_DEMO_LIVE=true): backend vero con DEMO_MODE, Falco vero,
 * accesso scegliendo un profilo. Niente risposte registrate.
 */
export const DEMO_LIVE = process.env.NEXT_PUBLIC_DEMO_LIVE === 'true';

/**
 * Installazioni sullo stesso dominio della produzione (demo, simulazione privata):
 * localStorage e sessionStorage hanno un prefisso proprio, cosi' l'accesso non tocca
 * mai la sessione della produzione. Vuoto in produzione.
 */
export const PREFISSO_ARCHIVIO = process.env.NEXT_PUBLIC_ARCHIVIO_PREFISSO || (DEMO_LIVE ? 'demo-vera:' : '');
