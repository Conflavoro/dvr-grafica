'use client';

import { useMemo, useState } from 'react';
import { ShieldAlert } from '@/components/icone';
import type { Pannello, PannelloRischio } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { CartaPannello, Vuoto, useAzioniPannelli } from './contesto';

type P = Extract<Pannello, { tipo: 'rischi' }>;

/** Classi di rischio della matrice P×G (stesso schema del DVR). */
export function classeRischio(r: number): { nome: string; cella: string; badge: string } {
  if (r >= 9) return { nome: 'Molto alto', cella: 'bg-risk-critical text-white', badge: 'bg-danger text-danger-ink border-danger' };
  if (r >= 6) return { nome: 'Alto', cella: 'bg-risk-high text-white', badge: 'bg-cat-documenti text-cat-documenti-ink border-cat-documenti' };
  if (r >= 3) return { nome: 'Medio', cella: 'bg-risk-medium text-ink', badge: 'bg-warn text-warn-ink border-warn' };
  return { nome: 'Basso', cella: 'bg-risk-low text-white', badge: 'bg-ok text-ok-ink border-ok' };
}

function Rischio({ r }: { r: PannelloRischio }) {
  const [aperto, setAperto] = useState(false);
  const R = r.probabilita * r.gravita;
  const c = classeRischio(R);
  const haDettagli = !!(r.fonte_norma || r.misure_tecniche || r.misure_organizzative);
  return (
    <li className="border-t border-brand-100 py-2 first:border-t-0">
      <button
        type="button"
        onClick={() => haDettagli && setAperto((v) => !v)}
        aria-expanded={haDettagli ? aperto : undefined}
        className="flex min-h-[44px] w-full items-start gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <span className={clsx('mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums', c.badge)}>
          R {R}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{r.pericolo || r.categoria}</span>
          <span className="block text-[11.5px] text-ink-muted">
            {r.categoria && r.pericolo ? `${r.categoria} · ` : ''}P {r.probabilita} × G {r.gravita} · {c.nome}
          </span>
        </span>
      </button>
      {aperto && (
        <dl className="mt-1 space-y-1.5 pl-12 text-[12.5px]">
          {r.misure_tecniche && (
            <div>
              <dt className="font-medium text-ink">Misure tecniche</dt>
              <dd>{r.misure_tecniche}</dd>
            </div>
          )}
          {r.misure_organizzative && (
            <div>
              <dt className="font-medium text-ink">Misure organizzative</dt>
              <dd>{r.misure_organizzative}</dd>
            </div>
          )}
          {r.fonte_norma && (
            <div>
              <dt className="font-medium text-ink">Riferimento</dt>
              <dd>{r.fonte_norma}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

export function PannelloRischi({ p }: { p: P }) {
  const az = useAzioniPannelli();
  const [filtro, setFiltro] = useState<{ p: number; g: number } | null>(null);
  const conteggi = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of p.rischi) m.set(`${r.probabilita}-${r.gravita}`, (m.get(`${r.probabilita}-${r.gravita}`) ?? 0) + 1);
    return m;
  }, [p.rischi]);
  const ordinati = useMemo(
    () =>
      [...p.rischi]
        .filter((r) => !filtro || (r.probabilita === filtro.p && r.gravita === filtro.g))
        .sort((a, b) => b.probabilita * b.gravita - a.probabilita * a.gravita || b.gravita - a.gravita),
    [p.rischi, filtro]
  );

  return (
    <CartaPannello
      icona={ShieldAlert}
      titolo="Valutazione dei rischi"
      sottotitolo={[az.nomeAzienda(p.azienda_id), `${p.rischi.length} rischi proposti`].filter(Boolean).join(' · ')}
    >
      {p.rischi.length === 0 ? (
        <Vuoto>Nessun rischio proposto.</Vuoto>
      ) : (
        <>
          <div className="flex gap-2">
            <span className="flex w-4 items-center justify-center text-[11px] font-semibold text-ink-muted [writing-mode:vertical-rl] rotate-180">
              Probabilità
            </span>
            <div className="min-w-0 flex-1">
              <table className="w-full max-w-[14rem] table-fixed border-separate border-spacing-1" aria-label="Matrice probabilità per gravità">
                <tbody>
                  {[4, 3, 2, 1].map((pr) => (
                    <tr key={pr}>
                      <th scope="row" className="w-5 text-[11px] font-semibold text-ink-muted">
                        {pr}
                      </th>
                      {[1, 2, 3, 4].map((g) => {
                        const n = conteggi.get(`${pr}-${g}`) ?? 0;
                        const sel = filtro?.p === pr && filtro?.g === g;
                        return (
                          <td key={g} className="p-0">
                            <button
                              type="button"
                              disabled={n === 0}
                              onClick={() => setFiltro(sel ? null : { p: pr, g })}
                              aria-pressed={sel}
                              aria-label={`P ${pr}, G ${g}, R ${pr * g}: ${n} rischi`}
                              className={clsx(
                                'flex aspect-square w-full min-h-[36px] items-center justify-center rounded-md text-[13px] font-semibold tabular-nums',
                                classeRischio(pr * g).cella,
                                n === 0 && 'opacity-35',
                                sel && 'ring-2 ring-ink ring-offset-1'
                              )}
                            >
                              {n > 0 ? n : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th />
                    {[1, 2, 3, 4].map((g) => (
                      <th key={g} scope="col" className="text-[11px] font-semibold text-ink-muted">
                        {g}
                      </th>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="ml-6 max-w-[13rem] text-center text-[11px] font-semibold text-ink-muted">Gravità</p>
            </div>
          </div>
          {filtro && (
            <button type="button" onClick={() => setFiltro(null)} className="mt-2 min-h-[32px] text-[12px] font-medium text-brand-700 hover:underline">
              Mostra tutti i rischi
            </button>
          )}
          <ul className="mt-2 max-h-[420px] overflow-y-auto">
            {ordinati.map((r, i) => (
              <Rischio key={`${r.pericolo}-${i}`} r={r} />
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-subtle">Proposta generata con assistenza AI: valutazione da verificare e firmare dall&apos;RSPP.</p>
        </>
      )}
    </CartaPannello>
  );
}
