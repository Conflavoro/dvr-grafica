/**
 * Tempo massimo per qualunque attesa dell'interfaccia: nessuno spinner
 * infinito. Allo scadere la promessa viene rifiutata con un messaggio che
 * dice cosa fare; il lavoro sul server puo' comunque concludersi.
 */
export class TempoScaduto extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'TempoScaduto';
  }
}

export function conTempoMassimo<T>(p: Promise<T>, ms: number, messaggio: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scade = new Promise<never>((_, rifiuta) => {
    timer = setTimeout(() => rifiuta(new TempoScaduto(messaggio)), ms);
  });
  return Promise.race([p, scade]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Tempi massimi usati nell'app (millisecondi). */
export const TEMPI = {
  /** Risposta dell'agente: puo' lavorare a lungo (documenti interi), il progresso si vede dal vivo. */
  agente: 10 * 60_000,
  /** Caricamento di un file (fino a 24 MB anche su rete lenta). */
  caricamento: 6 * 60_000,
  /** Attesa dell'analisi di un file nell'archivio. */
  analisi: 3 * 60_000,
  /** Letture e azioni brevi (elenchi, approvazioni). */
  breve: 45_000,
} as const;

/**
 * fetch con tempo massimo (default 2 minuti) per file e chiamate dirette:
 * allo scadere TempoScaduto, senza rete un errore in italiano.
 */
export async function fetchConTempo(url: RequestInfo | URL, init: RequestInit = {}, ms = 120_000): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' && !init.signal ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    return await fetch(url, ctrl ? { ...init, signal: ctrl.signal } : init);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new TempoScaduto('Il server non ha risposto in tempo. Riprova tra poco.');
    throw new Error('Connessione assente o interrotta. Controlla la rete e riprova.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
