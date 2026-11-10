'use client';

import { Voce } from '../amministrazione-kit';
import { euro } from '@/lib/portale/amministrazione-logica';
import type { Preventivo } from '@/lib/portale/amministrazione-api';

/** Dettaglio di un preventivo dello studio (usato anche dal gestionale). */
export function DettaglioPreventivo({ p }: { p: Preventivo }) {
  const righe = (p.calcolo.canone as { righe?: Array<Record<string, unknown>> } | undefined)?.righe ?? [];
  const una = (p.calcolo.una_tantum as { righe?: Array<Record<string, unknown>> } | undefined)?.righe ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] bg-black p-4 text-white">
        <p className="text-[13px] text-grafite-300">Canone al mese</p>
        <p className="cifre text-[40px] font-light leading-none tracking-[-0.04em]">{euro(p.canone_mensile)}</p>
        <p className="mt-1 text-[13px] text-grafite-400">{euro(p.canone_annuo)} l&apos;anno · annuale anticipato</p>
      </div>
      <div>
        {righe.map((r, i) => (
          <Voce key={i} k={`${String(r.voce)} (${String(r.quantita)})`} v={`${euro(Number(r.mensile))} al mese`} />
        ))}
        {una.map((r, i) => (
          <Voce key={`u${i}`} k={`${String(r.voce)} (${String(r.quantita)})`} v={`${euro(Number(r.totale))} una tantum`} />
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Prezzi IVA esclusa. La quota associativa Conflavoro è a parte e non si paga con il wallet. Il contratto dura 12 mesi con rinnovo tacito salvo disdetta 60 giorni prima.
      </p>
    </div>
  );
}
