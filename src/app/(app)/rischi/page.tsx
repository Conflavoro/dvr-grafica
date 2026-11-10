'use client';

import { AppShell } from '@/components/layout/AppShell';
import { RISCHI_TIPICI } from '@/lib/dvr-rischi-standard';
import { clsx } from '@/lib/clsx';

const PROBABILITA_LABEL = ['', 'Improbabile', 'Poco probabile', 'Probabile', 'Altamente probabile'];
const GRAVITA_LABEL = ['', 'Lieve', 'Medio', 'Grave', 'Gravissimo'];

function getCellLevel(p: number, g: number) {
  const r = p * g;
  if (r >= 9) return 'critical';
  if (r >= 6) return 'high';
  if (r >= 3) return 'medium';
  return 'low';
}

const CELL_BG: Record<string, string> = {
  low: 'bg-ok text-ok-ink',
  medium: 'bg-warn text-warn-ink',
  high: 'bg-danger text-danger-ink',
  critical: 'bg-risk-critical text-white',
};

export default function RischiPage() {
  return (
    <AppShell pageTitle="Matrice rischi (P × G)">
      <div className="space-y-6 animate-fade-up">
        <div className="card-luxury p-6">
          <header className="mb-5">
            <h2 className="section-title text-[17px]">Metodo P × G (4×4)</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Livello di rischio = Probabilità × Gravità. Standard D.Lgs. 81/08 art. 28.
            </p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-[13px] min-w-[560px]">
              <thead>
                <tr>
                  <th></th>
                  {[1, 2, 3, 4].map((g) => (
                    <th key={g} className="border-b border-brand-100 px-3 py-2 text-[10px] uppercase tracking-wider2 text-ink-muted">
                      G{g} · {GRAVITA_LABEL[g]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[4, 3, 2, 1].map((p) => (
                  <tr key={p}>
                    <th className="border-r border-brand-100 px-3 py-2 text-[10px] uppercase tracking-wider2 text-ink-muted">
                      P{p} · {PROBABILITA_LABEL[p]}
                    </th>
                    {[1, 2, 3, 4].map((g) => {
                      const level = getCellLevel(p, g);
                      return (
                        <td key={g} className="p-1.5">
                          <div className={clsx('flex h-14 items-center justify-center rounded-lg font-bold', CELL_BG[level])}>
                            {p * g}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 text-[12px] sm:grid-cols-4">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-risk-low" /><span className="text-ink-soft">R 1-2 · Basso</span></div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-risk-medium" /><span className="text-ink-soft">R 3-4 · Medio</span></div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-risk-high" /><span className="text-ink-soft">R 6-9 · Alto</span></div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-risk-critical" /><span className="text-ink-soft">R 12-16 · Molto alto</span></div>
          </div>
        </div>

        <div className="card-luxury p-6">
          <h2 className="studio-h2 mb-4 uppercase tracking-wider2">Catalogo rischi tipici D.Lgs. 81/08</h2>
          <p className="text-[13px] text-ink-muted mb-4">
            {RISCHI_TIPICI.length} rischi pre-configurati con riferimento normativo. Selezionabili dal wizard DVR (step E).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Categoria</th>
                  <th className="py-2 pr-3 font-semibold">Riferimento normativo</th>
                  <th className="py-2 pr-3 font-semibold">P default</th>
                  <th className="py-2 font-semibold">G default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {RISCHI_TIPICI.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-3 font-semibold text-ink">{r.categoria}</td>
                    <td className="py-3 pr-3 text-ink-muted">{r.fonte_norma}</td>
                    <td className="py-3 pr-3 text-ink">{r.p_default}</td>
                    <td className="py-3 text-ink">{r.g_default}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
