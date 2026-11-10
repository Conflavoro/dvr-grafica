/**
 * Fogli aperti (Foglio del kit): li conta la striscia del Falco per sapere se
 * deve scendere in fondo allo schermo e lasciare spazio al piede del foglio.
 */

let aperti = 0;
const ascoltatori = new Set<() => void>();

function avvisa(): void {
  ascoltatori.forEach((f) => f());
}

/** Segna un foglio aperto; la funzione restituita lo richiude (una sola volta). */
export function apriFoglio(): () => void {
  aperti++;
  avvisa();
  let chiuso = false;
  return () => {
    if (chiuso) return;
    chiuso = true;
    aperti = Math.max(0, aperti - 1);
    avvisa();
  };
}

export function fogliAperti(): number {
  return aperti;
}

export function ascoltaFogli(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
