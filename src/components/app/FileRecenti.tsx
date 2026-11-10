'use client';

// File recenti consultabili senza rete (app nativa): elenco dalla copia cifrata
// sul telefono, apertura con il visore del sistema. Non serve il server.

import { useCallback, useEffect, useState } from 'react';
import { Documento } from '@/components/icone';
import { apriFileRecente, elencoFileRecenti, type VoceRecente } from '@/lib/app/file-recenti';
import { isNativa } from '@/lib/app/nativa';

const data = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};
const peso = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function FileRecenti({ utente = null }: { utente?: number | null }) {
  const [voci, setVoci] = useState<VoceRecente[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const carica = useCallback(() => {
    void elencoFileRecenti(utente).then(setVoci);
  }, [utente]);
  useEffect(carica, [carica]);

  if (!isNativa()) {
    return <p className="text-[14px] text-ink-muted">I file recenti senza rete sono disponibili nell’app per telefono.</p>;
  }
  if (voci === null) return <p className="text-[14px] text-ink-muted">Carico i file del telefono</p>;
  if (voci.length === 0) {
    return <p className="rounded-[1.25rem] bg-perla-velo px-5 py-8 text-center text-[14.5px] text-ink-muted">Nessun file sul telefono. I documenti che apri dall’app compaiono qui.</p>;
  }
  return (
    <div>
      {errore && <p role="alert" className="mb-3 rounded-[1rem] bg-stato-danger px-4 py-3 text-[14px] text-stato-danger-ink">{errore}</p>}
      <ul className="divide-y divide-perla-linea rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]">
        {voci.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => {
                setErrore(null);
                apriFileRecente(v.id).catch((e: unknown) => {
                  setErrore(e instanceof Error ? e.message : 'Non riesco ad aprire il file.');
                  carica();
                });
              }}
            >
              <Documento size={20} aria-hidden className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{v.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">
                  Aperto il {data(v.aperto)} · {peso(v.byte)} · resta fino al {new Date(v.scade).toLocaleDateString('it-IT')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
