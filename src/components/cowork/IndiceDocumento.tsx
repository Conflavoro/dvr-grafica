'use client';

import { CerchioSpunta, Cerchio } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { avanzamento, divisioneIndice, sezioneChiusa, statoSezione, testoAvanzamento } from '@/lib/cowork/logica';
import type { VoceIndice } from '@/lib/cowork/tipi';

const PUNTO: Record<string, string> = {
  ok: 'bg-stato-ok-segno',
  warn: 'bg-stato-warn-segno',
  todo: 'bg-grafite-400',
  run: 'bg-stato-info-segno',
  neutral: 'bg-grafite-300',
};

function Voce({ v, attiva, onApri }: { v: VoceIndice; attiva: boolean; onApri: (k: string) => void }) {
  const s = statoSezione(v.stato);
  const chiusa = sezioneChiusa(v);
  return (
    <li>
      <button
        type="button"
        onClick={() => onApri(v.chiave)}
        aria-current={attiva ? 'true' : undefined}
        className={clsx('flex min-h-[48px] w-full items-center gap-2.5 rounded-[0.875rem] px-2.5 py-2 text-left', attiva ? 'bg-grafite-900 text-white' : 'hover:bg-perla-velo')}
      >
        {chiusa ? (
          <CerchioSpunta size={17} aria-hidden className={clsx('shrink-0', attiva ? 'text-acido-400' : 'text-stato-ok-segno')} />
        ) : (
          <span aria-hidden className="grid h-[17px] w-[17px] shrink-0 place-items-center">
            <span className={clsx('h-2 w-2 rounded-full', PUNTO[s.tono] ?? 'bg-grafite-400')} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className={clsx('cifre shrink-0 text-[12.5px]', attiva ? 'text-grafite-300' : 'text-ink-muted')}>{/^\d+$/.test(v.chiave) ? v.chiave : ''}</span>
            <span className="truncate text-[13.5px] font-medium leading-snug">{v.titolo}</span>
          </span>
          <span className={clsx('mt-0.5 block text-[12px]', attiva ? 'text-grafite-300' : 'text-ink-muted')}>
            {s.testo}
            {v.paragrafi.totali > 1 ? `, ${v.paragrafi.chiusi} di ${v.paragrafi.totali}` : ''}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Indice dei capitoli e degli allegati con lo stato di ciascuno e l'avanzamento. */
export function IndiceDocumento({ indice, attiva, onApri }: { indice: VoceIndice[]; attiva: string | null; onApri: (k: string) => void }) {
  const a = avanzamento(indice);
  const { capitoli, allegati } = divisioneIndice(indice);
  return (
    <nav aria-label="Indice del documento" className="rounded-[1.25rem] bg-white p-3 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <div className="px-1.5 pb-3 pt-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-medium text-ink">Indice</span>
          <span className="cifre text-[13px] text-ink-muted">{testoAvanzamento(a)}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-perla-velo" role="progressbar" aria-valuemin={0} aria-valuemax={a.totale} aria-valuenow={a.chiusi} aria-label={testoAvanzamento(a)}>
          <div className="h-full rounded-full bg-acido-500" style={{ width: `${a.percento}%` }} />
        </div>
      </div>
      {indice.length === 0 ? (
        <p className="flex items-center gap-2 px-1.5 py-3 text-[13.5px] text-ink-muted">
          <Cerchio size={15} aria-hidden /> Nessuna sezione ancora.
        </p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {capitoli.map((v) => (
              <Voce key={v.chiave} v={v} attiva={v.chiave === attiva} onApri={onApri} />
            ))}
          </ul>
          {allegati.length > 0 && (
            <>
              <h3 className="mt-3 px-2.5 pb-1 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted">Allegati</h3>
              <ul className="space-y-0.5">
                {allegati.map((v) => (
                  <Voce key={v.chiave} v={v} attiva={v.chiave === attiva} onApri={onApri} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </nav>
  );
}
