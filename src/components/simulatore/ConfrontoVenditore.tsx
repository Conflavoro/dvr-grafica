'use client';

import { useEffect, useState } from 'react';
import { PannelloConfronto, TestataCosto } from './PannelloConfronto';
import { aggiornaConfrontoPreventivo, confrontoNelModulo, confrontoPreventivo } from '@/lib/portale/simulatore-api';
import { GRUPPI, euroC, type Simulazione, type Vista } from '@/lib/portale/simulatore-logica';

/**
 * Porta B: la scheda "Confronto" del preventivo. Parte dai numeri del
 * preventivo; il venditore scrive quanto il cliente spende oggi per voce
 * (valgono solo per questa simulazione) e mette il confronto nel modulo d'ordine.
 * Se l'abbonamento costa di più lo vede prima del cliente.
 */
export function ConfrontoVenditore({ preventivoId }: { preventivoId: number }) {
  const [s, setS] = useState<Simulazione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('regime');
  const [reali, setReali] = useState<Record<string, string>>({});
  const [occupato, setOccupato] = useState(false);

  useEffect(() => {
    confrontoPreventivo(preventivoId)
      .then((x) => {
        setS(x);
        if (x) setReali(Object.fromEntries(Object.entries(x.prezziReali).map(([k, v]) => [k, String(v)])));
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Confronto non disponibile.'));
  }, [preventivoId]);

  const salva = async (d: Parameters<typeof aggiornaConfrontoPreventivo>[1]) => {
    setOccupato(true);
    try {
      setS(await aggiornaConfrontoPreventivo(preventivoId, d));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setOccupato(false);
    }
  };

  if (errore) return <p className="rounded-[1rem] bg-stato-warn px-3 py-2 text-[13.5px] text-stato-warn-ink">{errore}</p>;
  if (!s || !s.risultato) return <p className="text-[13.5px] text-ink-muted">Preparo il confronto</p>;
  const r = s.risultato;
  const prezzi = () =>
    Object.fromEntries(
      Object.entries(reali)
        .filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))))
        .map(([k, v]) => [k, Number(v.replace(',', '.'))])
    );

  return (
    <div className="space-y-4">
      <TestataCosto r={r} vista={vista} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[13px] text-ink-muted">Classe di rischio</span>
          <select className="input-field" value={r.profilo.rischio} disabled={occupato} onChange={(e) => void salva({ ingressi: { rischio: e.target.value } })}>
            <option value="basso">Basso</option>
            <option value="medio">Medio</option>
            <option value="alto">Alto</option>
          </select>
        </label>
        <label className="flex items-center gap-2.5 self-end rounded-[1rem] px-3 py-2.5 shadow-[inset_0_0_0_1px_#e2e2e5]">
          <input type="checkbox" className="h-5 w-5" checked={s.nelModuloOrdine} disabled={occupato} onChange={async (e) => setS(await confrontoNelModulo(preventivoId, e.target.checked))} />
          <span className="text-[13.5px] text-ink">Metti il confronto nel modulo d&apos;ordine</span>
        </label>
      </div>
      <PannelloConfronto r={r} vista={vista} onVista={setVista} nascondiTestata />
      <section className="rounded-[1.5rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
        <p className="text-[15px] font-medium text-ink">Quanto spende oggi</p>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Euro all&apos;anno dai preventivi che il cliente ti mostra: sostituiscono la stima solo per questa simulazione.</p>
        <ul className="mt-3 space-y-2">
          {r.righe.map((x) => (
            <li key={x.code} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[13.5px] text-ink">
                {x.titolo}
                <span className="block text-[11.5px] text-ink-muted">
                  {GRUPPI[x.gruppo] ?? x.gruppo} · stima {euroC(x.regime, false)} all&apos;anno
                </span>
              </span>
              <input
                className="input-field w-28"
                inputMode="decimal"
                aria-label={`Spesa attuale per ${x.titolo}`}
                placeholder="€/anno"
                value={reali[x.code] ?? ''}
                onChange={(e) => setReali((p) => ({ ...p, [x.code]: e.target.value }))}
                onBlur={() => void salva({ prezzi_reali: prezzi() })}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
