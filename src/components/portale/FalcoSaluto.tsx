'use client';

import { useState, type ReactNode } from 'react';
import { usePortale } from './PortaleShell';
import { AvatarFalco } from './FalcoSezione';
import { Invia, Microfono } from '@/components/icone';
import type { Suggerimento } from '@/lib/portale/api';

/** Saluto di Falco in testa alle home: dice cosa ha preparato e ascolta. */
export function FalcoSaluto({ titolo, frase, proposte = [], altro, senzaCasella = false }: { titolo: string; frase: string; proposte?: Suggerimento[]; altro?: ReactNode; senzaCasella?: boolean }) {
  const { chiedi, ascolta } = usePortale();
  const [testo, setTesto] = useState('');
  const oggi = new Date();
  return (
    <section className="rounded-[2.25rem] bg-grafite-950 p-5 text-white sm:p-8">
      <div className="flex items-start gap-4">
        <AvatarFalco size={64} parla />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-grafite-400 first-letter:uppercase">{oggi.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-0.5 text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[38px]">{titolo}</h1>
        </div>
      </div>
      <p className="mt-4 max-w-[44rem] text-[17px] leading-relaxed text-grafite-200 sm:text-[19px]">{frase}</p>
      {!senzaCasella && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!testo.trim()) return ascolta();
          chiedi(testo.trim());
          setTesto('');
        }}
        className="mt-5 flex items-center gap-2 rounded-full bg-white p-1.5"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Chiedi a Falco</span>
          <input value={testo} onChange={(e) => setTesto(e.target.value.slice(0, 4000))} placeholder="Chiedi a Falco" className="h-12 w-full bg-transparent px-4 text-base text-ink placeholder:text-grafite-400 focus:outline-none focus-visible:shadow-none" />
        </label>
        <button type="submit" aria-label={testo.trim() ? 'Invia a Falco' : 'Parla con Falco'} className="premi grid h-12 w-12 shrink-0 place-items-center rounded-full bg-oro-500 text-acido-950">
          {testo.trim() ? <Invia size={18} aria-hidden /> : <Microfono size={20} aria-hidden />}
        </button>
      </form>
      )}
      {(proposte.length > 0 || altro) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {proposte.slice(0, 3).map((p) => (
            <button key={p.etichetta} type="button" onClick={() => chiedi(p.richiesta)} className="min-h-[44px] lg:min-h-[40px] rounded-full px-4 text-[13.5px] text-grafite-200 shadow-[inset_0_0_0_1px_#4a4a52] hover:text-white hover:shadow-[inset_0_0_0_1px_#9a9aa2]">
              {p.etichetta}
            </button>
          ))}
          {altro}
        </div>
      )}
    </section>
  );
}

/** Numero piccolo sotto il saluto: niente riquadri giganti. */
export function NumeroPiccolo({ etichetta, valore, unita, tono, onClick }: { etichetta: string; valore: number | string | null; unita?: string; tono?: 'danger' | 'warn'; onClick?: () => void }) {
  const corpo = (
    <>
      <p className={`cifre text-[26px] font-light leading-none tracking-[-0.03em] ${tono === 'danger' ? 'text-[#d63d3e]' : tono === 'warn' ? 'text-[#a86800]' : 'text-ink'}`}>
        {valore ?? 'n.d.'}
        {valore !== null && unita && <span className="ml-0.5 text-[14px] text-ink-muted">{unita}</span>}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">{etichetta}</p>
    </>
  );
  const cls = 'rounded-[1.25rem] bg-white px-4 py-3 text-left shadow-[inset_0_0_0_1px_#e2e2e5]';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} premi hover:shadow-[inset_0_0_0_1.5px_#18181b]`}>
      {corpo}
    </button>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}
