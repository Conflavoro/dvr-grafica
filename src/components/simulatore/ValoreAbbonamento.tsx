'use client';

import { useEffect, useState } from 'react';
import { valoreAbbonamento, type ValoreAbbonamento as Valore } from '@/lib/portale/simulatore-api';
import { euroC } from '@/lib/portale/simulatore-logica';

/**
 * Porta C: "Il valore del tuo abbonamento" nella home dell'azienda. Conta le
 * prestazioni davvero ricevute e le valorizza al listino di confronto. Niente
 * nomi, niente date di visita: solo conteggi e importi.
 */
export function ValoreAbbonamentoBlocco({ aziendaId, versione, onChiedi }: { aziendaId: number; versione: number; onChiedi: (t: string) => void }) {
  const [v, setV] = useState<Valore | null>(null);
  useEffect(() => {
    let vivo = true;
    valoreAbbonamento(aziendaId)
      .then((x) => vivo && setV(x))
      .catch(() => vivo && setV(null));
    return () => {
      vivo = false;
    };
  }, [aziendaId, versione]);
  if (!v) return null;
  return (
    <section aria-labelledby="valore" className="rounded-[1.75rem] bg-grafite-950 p-5 text-white sm:p-6">
      <h2 id="valore" className="text-[15px] font-medium">
        Il valore del tuo abbonamento
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-grafite-200">{v.frase}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[1.25rem] bg-grafite-900 p-3">
          <p className="text-[12px] text-grafite-400">A preventivo</p>
          <p className="cifre mt-1 text-[22px] font-light">{euroC(v.valore, false)}</p>
        </div>
        <div className="rounded-[1.25rem] bg-oro-500 p-3 text-acido-950">
          <p className="text-[12px]">Hai pagato</p>
          <p className="cifre mt-1 text-[22px] font-light">{euroC(v.pagato, false)}</p>
        </div>
      </div>
      {v.righe.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {v.righe.map((r) => (
            <li key={r.chiave} className="rounded-full px-3 py-1 text-[12px] text-grafite-200 shadow-[inset_0_0_0_1px_#4a4a52]">
              {r.titolo}: {r.quante}
            </li>
          ))}
        </ul>
      )}
      {v.rinnovoTraGiorni !== null && v.rinnovoTraGiorni <= 90 && v.rinnovoTraGiorni >= 0 && (
        <p className="mt-3 text-[13px] text-oro-500">Il rinnovo è tra {v.rinnovoTraGiorni} giorni: questo è il tuo riepilogo dell&apos;anno.</p>
      )}
      <button type="button" onClick={() => onChiedi('Spiegami il valore del mio abbonamento: cosa ho ricevuto e quanto avrei speso a preventivo?')} className="mt-4 min-h-[44px] rounded-full px-4 text-[13px] text-grafite-200 lg:min-h-[40px] shadow-[inset_0_0_0_1px_#4a4a52] hover:text-white">
        Chiedi a Falco come è calcolato
      </button>
      <p className="mt-3 text-[11.5px] leading-relaxed text-grafite-500">{v.nota}</p>
    </section>
  );
}
