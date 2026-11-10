import type { AgenteProgresso } from './data-source';

/**
 * Un turno lungo del Falco puo' superare il tempo di un proxy tra il browser e
 * il server (502 o 504 dopo 30 s): il server continua e salva la risposta.
 * Qui si riconosce quel caso e si ritrova la risposta leggendo l'avanzamento,
 * invece di mostrare un errore.
 */

const RECUPERABILI = new Set([0, 408, 502, 503, 504]);

export function connessioneCaduta(e: unknown): boolean {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === 'number' && RECUPERABILI.has(s);
}

/** Cosa sta facendo il Falco adesso: lo strumento in corso, altrimenti l'ultima fase. */
export function faseCorrente(p: AgenteProgresso | null): string | null {
  if (!p) return null;
  for (let i = p.eventi.length - 1; i >= 0; i--) {
    const e = p.eventi[i];
    if (e.t === 'passo' && e.stato === 'in_corso') return e.titolo;
    if (e.t === 'fase') return e.testo;
  }
  return null;
}

export async function recuperaRisposta(
  leggi: (richiestaId: string) => Promise<AgenteProgresso>,
  richiestaId: string,
  opz: { intervalloMs?: number; maxMs?: number; attendi?: (ms: number) => Promise<void>; onProgresso?: (p: AgenteProgresso) => void } = {}
): Promise<{ conversazioneId: number; rispostaId: number } | null> {
  const intervallo = opz.intervalloMs ?? 2000;
  const max = opz.maxMs ?? 5 * 60_000;
  const attendi = opz.attendi ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let atteso = 0; atteso <= max; atteso += intervallo) {
    try {
      const p = await leggi(richiestaId);
      opz.onProgresso?.(p);
      if (p.conversazioneId && p.rispostaId) return { conversazioneId: p.conversazioneId, rispostaId: p.rispostaId };
    } catch {
      // Anche la lettura puo' cadere: si riprova al giro dopo.
    }
    await attendi(intervallo);
  }
  return null;
}
