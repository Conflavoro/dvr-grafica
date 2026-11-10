/**
 * Tempo reale nel browser e nell'app (ADR-013): un solo motore per sessione,
 * avviato dal guscio, sospeso in background (visibilitychange e stato dell'app
 * Capacitor) e ripreso al ritorno in primo piano. Campanella, liste aperte e
 * Falco di sezione si iscrivono con ascoltaTempoReale.
 */

import { apiRequest, clearApiCache } from '@/lib/api';
import { isNativa } from '@/lib/app/nativa';
import { creaMotore, driverRicarica, mappaLettura, type DriverTempoReale, type Lettura, type Motore } from './motore';

export type { EventoTempoReale, Lettura, DriverTempoReale } from './motore';
export { riguarda } from './motore';

/**
 * Driver disponibili. Un servizio gestito futuro (Pusher, Ably, Firebase) si
 * aggiunge qui come nuovo driver che chiama la sveglia; le sue chiavi pubbliche
 * arrivano dal backend nel campo canale del feed, mai scritte nel codice.
 */
const DRIVER: Record<string, DriverTempoReale> = { ricarica: driverRicarica };

const ascoltatori = new Set<(l: Lettura) => void>();
let motore: Motore | null = null;
let utente: number | null = null;
let scollegaVista: (() => void) | null = null;

export function ascoltaTempoReale(f: (l: Lettura) => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}

function consegna(l: Lettura): void {
  // Qualcosa e' cambiato: le letture tenute in memoria non valgono piu'.
  if (l.eventi.length > 0) clearApiCache();
  ascoltatori.forEach((f) => {
    try {
      f(l);
    } catch {
      /* un ascoltatore guasto non ferma gli altri */
    }
  });
}

async function leggi(cursore: string | null): Promise<Lettura> {
  const q = cursore ? `?dopo=${encodeURIComponent(cursore)}` : '';
  return mappaLettura(await apiRequest<unknown>(`/eventi${q}`, { method: 'GET', cache: 'no-store' }));
}

/** In primo piano? (scheda visibile e app attiva) */
function inVista(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function collegaVista(m: Motore): () => void {
  const cambia = (attiva: boolean) => (attiva ? m.riprendi() : m.sospendi());
  const vis = () => cambia(inVista());
  document.addEventListener('visibilitychange', vis);
  let togliApp: (() => void) | null = null;
  let vivo = true;
  if (isNativa()) {
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => cambia(isActive)))
      .then((h) => {
        if (vivo) togliApp = () => void h.remove();
        else void h.remove();
      })
      .catch(() => undefined);
  }
  return () => {
    vivo = false;
    document.removeEventListener('visibilitychange', vis);
    togliApp?.();
  };
}

/** Avvia il motore per l'utente (idempotente); un utente diverso riparte da zero. */
export function avviaTempoReale(utenteId: number): void {
  if (typeof window === 'undefined') return;
  if (motore && utente === utenteId) return;
  fermaTempoReale();
  utente = utenteId;
  const m = creaMotore({ leggi, consegna, driver: (n) => DRIVER[n] ?? driverRicarica });
  motore = m;
  scollegaVista = collegaVista(m);
  m.avvia();
  if (!inVista()) m.sospendi();
}

export function fermaTempoReale(): void {
  motore?.ferma();
  scollegaVista?.();
  motore = null;
  utente = null;
  scollegaVista = null;
}

/** Lettura subito (dopo un'azione dell'utente che cambia dati). */
export function aggiornaOra(): void {
  void motore?.leggiOra();
}
