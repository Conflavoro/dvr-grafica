/**
 * Ricerca istantanea della console: tollera errori di battitura e accenti.
 * Pura e senza dipendenze, cosi' gira a ogni tasto anche su centinaia di voci.
 */

export function normalizza(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Distanza di Levenshtein con uscita anticipata oltre `limite`. */
export function distanza(a: string, b: string, limite = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minRiga = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < minRiga) minRiga = v;
    }
    if (minRiga > limite) return limite + 1;
    prec = cur;
  }
  return prec[b.length];
}

function tollerati(len: number): number {
  return len >= 7 ? 2 : len >= 4 ? 1 : 0;
}

/**
 * Punteggio di una voce rispetto alla ricerca (0 = non corrisponde).
 * Ogni parola cercata deve trovare riscontro: inizio di parola vale piu' di
 * "contiene", che vale piu' di un riscontro con errori di battitura.
 * `campi[0]` e' il campo principale (nome): riscontri li' pesano di piu'.
 */
export function punteggio(ricerca: string, campi: Array<string | null | undefined>): number {
  const q = normalizza(ricerca);
  if (!q) return 0;
  const testi = campi.map((c) => normalizza(c ?? ''));
  const tutto = testi.join(' ');
  const parole = tutto.split(' ').filter(Boolean);
  const principale = testi[0] ?? '';
  const soloCifre = tutto.replace(/\s+/g, '');
  let totale = 0;
  for (const t of q.split(' ')) {
    let migliore = 0;
    if (parole.some((w) => w.startsWith(t))) migliore = 3;
    else if (tutto.includes(t) || (/^\d+$/.test(t) && soloCifre.includes(t))) migliore = 2;
    else {
      const k = tollerati(t.length);
      if (k > 0 && parole.some((w) => distanza(t, w.slice(0, t.length), k) <= k || distanza(t, w, k) <= k)) migliore = 1;
    }
    if (migliore === 0) return 0;
    totale += migliore;
  }
  if (principale.startsWith(q)) totale += 3;
  else if (principale.includes(q)) totale += 1;
  return totale;
}

/** Filtra e ordina per punteggio decrescente (a parita', ordine originale). */
export function cerca<T>(ricerca: string, voci: T[], campi: (v: T) => Array<string | null | undefined>, max = 8): T[] {
  return voci
    .map((v, i) => ({ v, i, p: punteggio(ricerca, campi(v)) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, max)
    .map((x) => x.v);
}
