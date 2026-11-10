'use client';

import { useState } from 'react';
import { Foglio } from '@/components/portale/kit';
import { colonneNumeriche, livelloRischio, testoCella } from '@/lib/cowork/logica';
import type { Tabella } from '@/lib/cowork/tipi';
import { Livello } from './parti';

/** Una tabella dati in forma compatta: una scheda per riga, numeri e livello in linea. */
function TabellaCompatta({ t }: { t: Tabella }) {
  const [intera, setIntera] = useState(false);
  const numeriche = colonneNumeriche(t);
  const haLivello = t.colonne.some((c) => c.chiave === 'livello');
  const prima = t.colonne.find((c) => !numeriche.includes(c.chiave) && c.chiave !== 'livello');
  const altre = t.colonne.filter((c) => c !== prima && !numeriche.includes(c.chiave) && c.chiave !== 'livello');
  const r = t.colonne.find((c) => c.chiave === 'valore_rischio')?.chiave;

  return (
    <section className="rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]" aria-label={t.titolo}>
      <header className="flex items-baseline gap-2 px-4 pb-2 pt-4">
        <h3 className="min-w-0 flex-1 text-[15px] font-medium text-ink">{t.titolo}</h3>
        <span className="cifre text-[12.5px] text-ink-muted">{t.righe.length}</span>
      </header>
      {t.righe.length === 0 ? (
        <p className="px-4 pb-4 text-[13.5px] text-ink-muted">Nessuna riga.</p>
      ) : (
        <ul className="px-4">
          {t.righe.map((riga, i) => {
            const l = haLivello || r ? livelloRischio(riga.livello ?? null, r ? riga[r] : null) : null;
            return (
              <li key={i} className="border-b border-perla-linea py-2.5 last:border-b-0">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-ink">{prima ? testoCella(riga[prima.chiave]) : `Riga ${i + 1}`}</span>
                  {l && <Livello l={l} />}
                </div>
                {numeriche.length > 0 && (
                  <p className="cifre mt-1 flex flex-wrap gap-1.5 text-[12.5px] text-ink-soft">
                    {numeriche.map((k) => (
                      <span key={k} className="rounded-[0.5rem] bg-perla-velo px-1.5 py-0.5">
                        <span className="text-ink-muted">{t.colonne.find((c) => c.chiave === k)?.etichetta ?? k}</span> {testoCella(riga[k])}
                      </span>
                    ))}
                  </p>
                )}
                {altre.map((c) =>
                  testoCella(riga[c.chiave]) ? (
                    <p key={c.chiave} className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                      {c.etichetta}: {testoCella(riga[c.chiave])}
                    </p>
                  ) : null,
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="px-4 pb-3 pt-1">
        <button type="button" className="min-h-[40px] text-[13px] text-ink-muted underline underline-offset-2 hover:text-ink" onClick={() => setIntera(true)}>
          Vedi come tabella
        </button>
        <p className="text-[12px] text-ink-subtle">Calcolata dai dati del documento, non scritta dall&apos;assistente.</p>
      </div>
      <Foglio aperto={intera} titolo={t.titolo} onChiudi={() => setIntera(false)} largo>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-[13.5px]">
            <thead>
              <tr>
                {t.colonne.map((c) => (
                  <th key={c.chiave} scope="col" className="border-b border-perla-linea px-2 py-2 font-medium text-ink-muted">
                    {c.etichetta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.righe.map((riga, i) => (
                <tr key={i} className="align-top">
                  {t.colonne.map((c) => {
                    const l = c.chiave === 'livello' ? livelloRischio(riga.livello ?? null, r ? riga[r] : null) : null;
                    return (
                      <td key={c.chiave} className="border-b border-perla-linea px-2 py-2 text-ink">
                        {l ? <Livello l={l} /> : <span className={numeriche.includes(c.chiave) ? 'cifre' : undefined}>{testoCella(riga[c.chiave])}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Foglio>
    </section>
  );
}

export function TabelleSezione({ tabelle }: { tabelle: Tabella[] }) {
  if (tabelle.length === 0) return null;
  return (
    <div className="space-y-3">
      {tabelle.map((t) => (
        <TabellaCompatta key={t.chiave} t={t} />
      ))}
    </div>
  );
}
