// Dichiarazione minima di react-dom/server per i test dei componenti
// (resa statica in ambiente node). Evita la dipendenza @types/react-dom.
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';
  export function renderToStaticMarkup(element: ReactElement): string;
}
