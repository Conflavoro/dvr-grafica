import { Fragment, type ReactNode } from 'react';

/**
 * Renderer di markdown LEGGERO per le risposte dell'agente.
 *
 * Sicuro per costruzione: produce solo elementi React (niente
 * dangerouslySetInnerHTML), quindi qualunque HTML nel testo resta testo.
 * Supporta titoli (#, ##, ###), elenchi puntati (-, *) e numerati (1.),
 * tabelle semplici a barre verticali, paragrafi, **grassetto**, *corsivo* e
 * `codice`. Gli indirizzi web diventano link; [testo](url) con schemi diversi
 * da http e https resta solo testo.
 */

type Blocco =
  | { k: 'titolo'; livello: 1 | 2 | 3; testo: string }
  | { k: 'ul'; voci: string[] }
  | { k: 'ol'; voci: string[]; inizio: number }
  | { k: 'tabella'; righe: string[][] }
  | { k: 'p'; righe: string[] };

const RE_TITOLO = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const RE_UL = /^\s*[-*•]\s+(.*)$/;
const RE_OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_TAB = /^\s*\|.*\|\s*$/;
const RE_TAB_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/**
 * Lineette lunghe e medie usate come punteggiatura diventano virgole (regola di
 * stile della piattaforma: nessuna lineetta nei testi a schermo); quelle tra
 * cifre (intervalli) diventano "a".
 */
export function senzaLineette(t: string): string {
  return t
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 a $2')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/^,\s*/gm, '');
}

export function parseBlocchi(md: string): Blocco[] {
  const righe = senzaLineette(md).replace(/\r\n?/g, '\n').split('\n');
  const out: Blocco[] = [];
  let i = 0;
  while (i < righe.length) {
    const r = righe[i];
    if (r.trim() === '' || RE_HR.test(r)) {
      i++;
      continue;
    }
    const t = RE_TITOLO.exec(r);
    if (t) {
      out.push({ k: 'titolo', livello: Math.min(3, t[1].length) as 1 | 2 | 3, testo: t[2] });
      i++;
      continue;
    }
    if (RE_TAB.test(r)) {
      const tab: string[][] = [];
      while (i < righe.length && (RE_TAB.test(righe[i]) || RE_TAB_SEP.test(righe[i]))) {
        if (!RE_TAB_SEP.test(righe[i])) {
          tab.push(righe[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
        }
        i++;
      }
      if (tab.length) out.push({ k: 'tabella', righe: tab });
      continue;
    }
    if (RE_UL.test(r)) {
      const voci: string[] = [];
      while (i < righe.length && RE_UL.test(righe[i])) {
        voci.push(RE_UL.exec(righe[i])![1]);
        i++;
      }
      out.push({ k: 'ul', voci });
      continue;
    }
    const o = RE_OL.exec(r);
    if (o) {
      const voci: string[] = [];
      const inizio = Number(o[1]) || 1;
      while (i < righe.length && RE_OL.test(righe[i])) {
        voci.push(RE_OL.exec(righe[i])![2]);
        i++;
      }
      out.push({ k: 'ol', voci, inizio });
      continue;
    }
    const par: string[] = [];
    while (
      i < righe.length &&
      righe[i].trim() !== '' &&
      !RE_HR.test(righe[i]) &&
      !RE_TITOLO.test(righe[i]) &&
      !RE_UL.test(righe[i]) &&
      !RE_OL.test(righe[i]) &&
      !RE_TAB.test(righe[i])
    ) {
      par.push(righe[i].trim());
      i++;
    }
    out.push({ k: 'p', righe: par });
  }
  return out;
}

const RE_URL = /^https?:\/\/[^\s<>]+$/i;
const LINK = 'break-all font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900';

function collegamento(href: string, testo: string, k: string): ReactNode {
  return (
    <a key={k} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {testo}
    </a>
  );
}

/**
 * Inline: **grassetto**, *corsivo*, `codice`, link. Solo gli indirizzi web
 * (http e https) diventano link, aperti in una nuova scheda; [testo](url) con
 * altri schemi resta testo.
 */
function inline(testo: string, chiave: string): ReactNode[] {
  const re = /(\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>]+|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    let tok = m[0];
    const k = `${chiave}-${n++}`;
    if (/^https?:/i.test(tok)) {
      // La punteggiatura in coda alla frase non fa parte dell'indirizzo.
      const coda = /[.,;:!?)\]'"]+$/.exec(tok);
      if (coda) {
        tok = tok.slice(0, -coda[0].length);
        re.lastIndex = m.index + tok.length;
      }
    }
    if (m.index > last) out.push(testo.slice(last, m.index));
    if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      out.push(RE_URL.test(mm[2]) ? collegamento(mm[2], mm[1], k) : mm[1]);
    } else if (/^https?:/i.test(tok)) {
      out.push(collegamento(tok, tok, k));
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(<strong key={k} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      out.push(<code key={k} className="rounded bg-brand-50 px-1 py-0.5 font-mono text-[0.92em]">{tok.slice(1, -1)}</code>);
    } else {
      out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < testo.length) out.push(testo.slice(last));
  return out;
}

export function AgenteMarkdown({ testo, className }: { testo: string; className?: string }) {
  const blocchi = parseBlocchi(testo);
  return (
    <div className={className ?? 'space-y-2.5 break-words text-[14.5px] leading-relaxed text-ink-soft'}>
      {blocchi.map((b, i) => {
        const k = `b${i}`;
        switch (b.k) {
          case 'titolo': {
            const cls =
              b.livello === 1
                ? 'text-[16px] font-semibold text-ink'
                : b.livello === 2
                  ? 'text-[15px] font-semibold text-ink'
                  : 'text-[14.5px] font-semibold text-ink';
            return (
              <p key={k} role="heading" aria-level={b.livello + 2} className={`${cls} pt-1`}>
                {inline(b.testo, k)}
              </p>
            );
          }
          case 'ul':
            return (
              <ul key={k} className="list-disc space-y-1 pl-5 marker:text-brand-400">
                {b.voci.map((v, j) => (
                  <li key={j}>{inline(v, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={k} start={b.inizio} className="list-decimal space-y-1 pl-5 marker:text-ink-subtle">
                {b.voci.map((v, j) => (
                  <li key={j}>{inline(v, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'tabella':
            return (
              <div key={k} className="max-w-full overflow-x-auto rounded-xl border border-brand-100">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {b.righe.map((riga, j) => (
                      <tr key={j} className={j === 0 ? 'bg-brand-50/70 font-semibold text-ink' : 'border-t border-brand-100'}>
                        {riga.map((c, z) => (
                          <td key={z} className="px-3 py-1.5 align-top">
                            {inline(c, `${k}-${j}-${z}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={k}>
                {b.righe.map((r, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(r, `${k}-${j}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Testo semplice per la sintesi vocale: niente simboli markdown, tabelle in righe. */
export function markdownInTestoSemplice(md: string): string {
  return parseBlocchi(md)
    .map((b) => {
      const pulisci = (s: string) =>
        s
          .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
          // La voce non legge indirizzi e codici dei link.
          .replace(/https?:\/\/[^\s<>]+?(?=[.,;:!?)]*(\s|$))[.,;:!?)]*/gi, 'il link qui sotto')
          .replace(/\*\*|__|`/g, '')
          .replace(/(^|\s)\*([^*]+)\*/g, '$1$2');
      switch (b.k) {
        case 'titolo':
          return `${pulisci(b.testo)}.`;
        case 'ul':
        case 'ol':
          return b.voci.map((v) => pulisci(v)).join('. ');
        case 'tabella':
          return b.righe.map((r) => r.map(pulisci).join(', ')).join('. ');
        default:
          return pulisci(b.righe.join(' '));
      }
    })
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
