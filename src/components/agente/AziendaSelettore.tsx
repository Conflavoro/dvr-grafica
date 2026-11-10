'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search } from '@/components/icone';
import type { Company } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';

export type AziendaBreve = { id: number; ragione_sociale: string };

/**
 * Chip dell'azienda legata alla conversazione. Si sceglie solo prima del primo
 * messaggio: poi resta fissata alla conversazione (come fa il backend).
 */
export function AziendaSelettore({
  valore,
  fissata,
  aperto,
  onAperto,
  onCambia,
}: {
  valore: AziendaBreve | null;
  fissata: boolean;
  aperto: boolean;
  onAperto: (v: boolean) => void;
  onCambia: (a: AziendaBreve | null) => void;
}) {
  const ds = useDataSource();
  const [aziende, setAziende] = useState<Company[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto || aziende) return;
    let annullato = false;
    ds.companies
      .list()
      .then((l) => !annullato && setAziende(l))
      .catch((e: unknown) => !annullato && setErrore(e instanceof Error ? e.message : 'Elenco aziende non disponibile.'));
    return () => {
      annullato = true;
    };
  }, [aperto, aziende, ds]);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onAperto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onAperto(false);
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto, onAperto]);

  const etichetta = valore ? valore.ragione_sociale : fissata ? 'Nessuna azienda' : 'Scegli l’azienda';

  if (fissata) {
    return (
      <span
        className="inline-flex min-h-[40px] min-w-0 max-w-full items-center gap-2 rounded-full bg-perla-velo px-3.5 text-[13.5px] font-medium text-ink-soft"
        title="L'azienda resta legata a questa conversazione"
      >
        <Building2 size={14} aria-hidden className="shrink-0 text-oro-600" />
        <span className="truncate">{etichetta}</span>
      </span>
    );
  }

  const q = filtro.trim().toLowerCase();
  const visibili = (aziende ?? []).filter((a) => !q || a.ragione_sociale.toLowerCase().includes(q));

  return (
    <div ref={box} className="min-w-0 sm:relative">
      <button
        type="button"
        onClick={() => onAperto(!aperto)}
        aria-haspopup="listbox"
        aria-expanded={aperto}
        aria-label={`Azienda della conversazione: ${etichetta}. Cambia`}
        className="inline-flex min-h-[44px] min-w-0 max-w-full items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-medium text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]"
      >
        <Building2 size={14} aria-hidden className="shrink-0 text-oro-600" />
        <span className="truncate">{etichetta}</span>
        <ChevronDown size={14} aria-hidden className="shrink-0" />
      </button>
      {aperto && (
        <div className="absolute inset-x-3 top-full z-30 mt-2 rounded-[1.25rem] bg-white p-2 shadow-[inset_0_0_0_1px_#e2e2e5,0_20px_40px_-16px_rgba(14,14,16,0.25)] sm:inset-x-auto sm:left-0 sm:w-80">
          {(aziende?.length ?? 0) > 6 && (
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-brand-100 px-2">
              <Search size={14} aria-hidden className="text-ink-subtle" />
              <span className="sr-only">Cerca azienda</span>
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Cerca azienda"
                className="h-10 w-full bg-transparent text-base outline-none sm:text-[13px]"
              />
            </label>
          )}
          <ul role="listbox" aria-label="Aziende" className="max-h-64 overflow-y-auto">
            <Opzione selezionata={!valore} onClick={() => { onCambia(null); onAperto(false); }}>
              Nessuna azienda
            </Opzione>
            {!aziende && !errore && <li className="px-3 py-2 text-[13px] text-ink-muted">Caricamento…</li>}
            {errore && <li className="px-3 py-2 text-[13px] text-danger-mark">{errore}</li>}
            {aziende && aziende.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-muted">Nessuna azienda in elenco.</li>}
            {visibili.map((a) => (
              <Opzione
                key={a.id}
                selezionata={valore?.id === a.id}
                onClick={() => {
                  onCambia({ id: a.id, ragione_sociale: a.ragione_sociale });
                  onAperto(false);
                }}
              >
                {a.ragione_sociale}
              </Opzione>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Opzione({ selezionata, onClick, children }: { selezionata: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li role="option" aria-selected={selezionata}>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[13px]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          selezionata ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-soft hover:bg-brand-50/70'
        )}
      >
        <span className="truncate">{children}</span>
        {selezionata && <Check size={14} aria-hidden className="shrink-0" />}
      </button>
    </li>
  );
}
