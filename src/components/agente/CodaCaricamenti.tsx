'use client';

import { useEffect, useState } from 'react';
import { Audio, CerchioSpunta, ChevronDown, Chiudi, Documento, Immagine, Video, type LucideIcon } from '@/components/icone';
import { pesoLeggibile, type VoceCaricamento } from '@/lib/caricamenti';
import { clsx } from '@/lib/clsx';

const ICONA: Record<string, LucideIcon> = { foto: Immagine, audio: Audio, video: Video, documento: Documento };

/**
 * File in caricamento dalla chat, uno per riga: avanzamento, fase, errore con
 * Riprova. Sta sopra la barra di scrittura finche' l'utente non la chiude.
 */
export function CodaCaricamenti({
  voci,
  azienda,
  onRiprova,
  onRimuovi,
  onChiudi,
}: {
  voci: VoceCaricamento[];
  azienda: string | null;
  onRiprova: (id: string) => void;
  onRimuovi: (id: string) => void;
  onChiudi: () => void;
}) {
  const finito = voci.length > 0 && voci.every((v) => v.stato === 'fatto' || v.stato === 'errore');
  // A lavoro finito e senza problemi l'elenco si raccoglie: resta il riepilogo e la conversazione torna in vista.
  const tuttoBene = finito && voci.every((v) => v.stato === 'fatto' && !v.analisiErrore);
  const [aperto, setAperto] = useState(false);
  useEffect(() => {
    if (!finito) setAperto(false);
  }, [finito]);
  if (voci.length === 0) return null;
  const raccolto = tuttoBene && !aperto;
  const fatti = voci.filter((v) => v.stato === 'fatto').length;
  const errori = voci.filter((v) => v.stato === 'errore').length;
  const titolo = finito
    ? `${fatti} di ${voci.length} ${voci.length === 1 ? 'file caricato' : 'file caricati'}${errori ? `, ${errori} con errore` : ''}`
    : `Carico ${voci.length === 1 ? 'un file' : `${voci.length} file`}${azienda ? ` nell’archivio di ${azienda}` : ''}`;

  return (
    <section aria-label="File in caricamento" className="mb-2 overflow-hidden rounded-[1.25rem] bg-perla-carta shadow-[0_0_0_1px_rgba(14,14,16,0.08),0_12px_28px_-18px_rgba(14,14,16,0.45)]">
      <header className={clsx('flex min-h-[44px] items-center gap-2 pl-3 pr-1', !raccolto && 'border-b border-perla-linea')}>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-900" aria-live="polite">
          {titolo}
        </p>
        {tuttoBene && (
          <button
            type="button"
            onClick={() => setAperto((v) => !v)}
            aria-expanded={!raccolto}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-semibold text-brand-700 hover:bg-perla-velo"
          >
            {raccolto ? 'Mostra i file' : 'Nascondi'}
            <ChevronDown size={14} aria-hidden className={clsx('transition-transform motion-reduce:transition-none', !raccolto && 'rotate-180')} />
          </button>
        )}
        {finito && (
          <button type="button" onClick={onChiudi} aria-label="Chiudi l’elenco dei caricamenti" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-perla-velo hover:text-ink">
            <Chiudi size={16} aria-hidden />
          </button>
        )}
      </header>
      {!raccolto && (
        <ul className="max-h-[30dvh] divide-y divide-perla-linea overflow-y-auto sm:max-h-[220px]">
          {voci.map((v) => {
            const Icona = ICONA[v.tipo] ?? Documento;
            const inCorso = v.stato === 'carico' || v.stato === 'analizzo';
            return (
              <li key={v.id} className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Icona size={17} aria-hidden className={clsx('shrink-0', v.stato === 'errore' ? 'text-danger-ink' : 'text-brand-700')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{v.nome}</span>
                    <span className={clsx('block truncate text-[11.5px]', v.stato === 'errore' ? 'text-danger-ink' : v.analisiErrore ? 'text-warn-ink' : 'text-ink-muted')}>
                      {pesoLeggibile(v.peso)}, {v.stato === 'errore' ? 'non caricato' : v.analisiErrore ? 'caricato, analisi non riuscita' : v.fase}
                    </span>
                  </span>
                  {v.stato === 'fatto' && !v.analisiErrore && <CerchioSpunta size={17} aria-label="Caricato" className="shrink-0 text-ok-ink" />}
                  {v.stato === 'errore' && !v.definitivo && (
                    <button type="button" onClick={() => onRiprova(v.id)} className="min-h-[44px] shrink-0 rounded-md px-2 text-[12.5px] font-semibold text-brand-700 hover:bg-perla-velo">
                      Riprova
                    </button>
                  )}
                  {(v.stato === 'errore' || v.stato === 'in_coda') && (
                    <button type="button" onClick={() => onRimuovi(v.id)} aria-label={`Togli ${v.nome}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-perla-velo hover:text-ink">
                      <Chiudi size={14} aria-hidden />
                    </button>
                  )}
                </div>
                {inCorso && (
                  <div
                    className="ml-[27px] mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]"
                    role="progressbar"
                    aria-label={`${v.nome}: ${v.fase}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={v.percento ?? undefined}
                  >
                    {/* Senza percentuale (analisi sul server) la barra resta piena e ferma: niente animazioni continue. */}
                    <span className={clsx('block h-full rounded-full', v.percento == null ? 'w-full bg-brand-200' : 'bg-brand-600')} style={v.percento == null ? undefined : { width: `${v.percento}%` }} />
                  </div>
                )}
                {v.errore && <p className="ml-[27px] mt-1 text-[12px] leading-snug text-danger-ink">{v.errore}</p>}
                {!v.errore && v.analisiErrore && <p className="ml-[27px] mt-1 text-[12px] leading-snug text-warn-ink">{v.analisiErrore}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
