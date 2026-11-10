'use client';

import { useRef, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { euroC, type FatturaSim } from '@/lib/portale/simulatore-logica';
import { Cestino, Fotocamera, Piu, Rotore } from '@/components/icone';

const CATEGORIE: Record<string, string> = {
  documenti: 'Documenti',
  formazione: 'Formazione',
  medicina: 'Medicina',
  assistenza: 'Assistenza',
  haccp: 'HACCP',
  altro: 'Altro',
};

/**
 * "Le tue fatture": carica file o scatta una foto, vedi cosa è stato letto.
 * Le righe proposte dalla lettura automatica (PDF e foto) si confermano prima
 * di entrare nel confronto. Il file non si conserva.
 */
export function BloccoFatture({
  fatture,
  informativa,
  onCarica,
  onConferma,
  onElimina,
  apriRef,
}: {
  fatture: FatturaSim[];
  informativa: string;
  onCarica: (f: File) => Promise<void>;
  onConferma: (id: number) => Promise<void>;
  onElimina: (id: number) => Promise<void>;
  apriRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const foto = useRef<HTMLInputElement>(null);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  if (apriRef) apriRef.current = () => file.current?.click();

  const carica = async (f: File | undefined) => {
    if (!f) return;
    setErrore(null);
    setOccupato(true);
    try {
      await onCarica(f);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setOccupato(false);
      if (file.current) file.current.value = '';
      if (foto.current) foto.current.value = '';
    }
  };

  return (
    <section aria-label="Le tue fatture" className="rounded-[1.5rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <p className="text-[15px] font-medium text-ink">Le tue fatture</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{informativa || 'Carica le fatture dei servizi di sicurezza: le abbiniamo agli obblighi. Il file non si conserva.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={occupato} onClick={() => file.current?.click()}>
          {occupato ? <Rotore size={16} aria-hidden className="animate-spin" /> : <Piu size={16} aria-hidden />} Carica file
        </button>
        <button type="button" className="btn-ghost" disabled={occupato} onClick={() => foto.current?.click()}>
          <Fotocamera size={16} aria-hidden /> Scatta una foto
        </button>
        <input ref={file} type="file" className="sr-only" accept=".xml,.p7m,.pdf,.jpg,.jpeg,.png,.heic,application/pdf,text/xml,image/*" onChange={(e) => void carica(e.target.files?.[0])} />
        <input ref={foto} type="file" className="sr-only" accept="image/*" capture="environment" onChange={(e) => void carica(e.target.files?.[0])} />
      </div>
      {errore && (
        <p role="alert" className="mt-2 rounded-[0.875rem] bg-stato-warn px-3 py-2 text-[13px] text-stato-warn-ink">
          {errore}
        </p>
      )}
      {fatture.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fatture.map((f) => (
            <li key={f.id} className="rounded-[1rem] bg-perla-velo p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{f.fornitore ?? 'Fornitore non letto'}</p>
                  <p className="text-[12px] text-ink-muted">
                    {f.data ? new Date(f.data).toLocaleDateString('it-IT') : 'senza data'} · {f.formato.toUpperCase()} ·{' '}
                    {f.stato === 'letta' ? 'letta in modo esatto' : f.stato === 'confermata' ? 'confermata' : f.stato === 'bloccata' ? 'bloccata' : 'da confermare'}
                  </p>
                </div>
                <button type="button" aria-label="Togli la fattura" className="btn-icon" onClick={() => void onElimina(f.id)}>
                  <Cestino size={16} aria-hidden />
                </button>
              </div>
              {f.nota && <p className="mt-1 text-[12px] text-ink-muted">{f.nota}</p>}
              {f.righe.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {f.righe.slice(0, 6).map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{r.descrizione}</span>
                      <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px]', r.categoria === 'altro' ? 'bg-white text-ink-muted' : 'bg-oro-500 text-acido-950')}>{CATEGORIE[r.categoria] ?? r.categoria}</span>
                      <span className="cifre shrink-0 text-ink">{euroC(r.importo)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f.stato === 'da_confermare' && (
                <button type="button" className="btn-primary mt-2 w-full sm:w-auto" onClick={() => void onConferma(f.id)}>
                  Le righe sono giuste, conferma
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
