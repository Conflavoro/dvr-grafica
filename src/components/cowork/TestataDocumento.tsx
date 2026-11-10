'use client';

import { useState } from 'react';
import { Firma, Indietro, Rotore, Scarica } from '@/components/icone';
import { Chip, dataIt } from '@/components/portale/kit';
import { anteprima } from '@/lib/cowork/api';
import { fraseBanner, fraseLavori, statoLavoro } from '@/lib/cowork/logica';
import type { Documento } from '@/lib/cowork/tipi';
import { Fonti, Pulsante, Stato } from './parti';

const ore = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

const LIVELLI: Record<number, string> = { 1: 'segnala soltanto', 2: 'propone su richiesta', 3: 'prepara da solo' };

/** Testata: azienda, documento, stato, revisione, tecnico; azioni di anteprima e approvazione. */
export function TestataDocumento({
  documento,
  azienda,
  puoApprovare,
  lavoroApprova,
  onApprova,
  onIndietro,
  onErrore,
}: {
  documento: Documento;
  azienda: string;
  puoApprovare: boolean;
  lavoroApprova: boolean;
  onApprova: () => void;
  onIndietro?: () => void;
  onErrore: (t: string) => void;
}) {
  const t = documento.testata;
  const [scarica, setScarica] = useState<'pdf' | 'docx' | null>(null);
  const approvato = t.statoDocumento === 'approved' || t.stato === 'emesso';
  const vai = async (f: 'pdf' | 'docx') => {
    setScarica(f);
    try {
      await anteprima(t.tipo, t.id, f, `Anteprima DVR ${azienda || t.id}.${f}`.replace(/[\\/:*?"<>|]+/g, ' '));
    } catch (e) {
      onErrore(e instanceof Error ? e.message : 'Anteprima non disponibile.');
    } finally {
      setScarica(null);
    }
  };

  return (
    <header className="rounded-[1.5rem] bg-white px-4 py-4 shadow-[inset_0_0_0_1px_#e2e2e5] sm:px-5">
      {onIndietro && (
        <button type="button" onClick={onIndietro} className="-ml-1 mb-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-[13px] text-ink-muted hover:text-ink">
          <Indietro size={15} aria-hidden /> Documenti di {azienda || 'questa azienda'}
        </button>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-[18rem]">
          <p className="text-[13px] text-ink-muted">{azienda}</p>
          <h1 className="mt-0.5 text-[22px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[26px]">{t.titolo}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Stato e={statoLavoro(t.stato)} />
            {t.revisione !== null && <Chip stato="neutral">{t.versione !== null ? `Versione ${t.versione}, revisione ${t.revisione}` : `Revisione ${t.revisione}`}</Chip>}
            {t.tecnico && <Chip stato="neutral">Tecnico {t.tecnico.nome}</Chip>}
            {t.oreSulDocumento !== null && t.oreSulDocumento > 0 && <span className="text-[12.5px] text-ink-muted">{ore.format(t.oreSulDocumento)} ore sul documento</span>}
            {t.aggiornatoIl && <span className="text-[12.5px] text-ink-muted">Aggiornato il {dataIt(t.aggiornatoIl)}</span>}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {(['pdf', 'docx'] as const).map((f) => (
            <button key={f} type="button" className="btn-ghost min-h-[44px]" disabled={scarica !== null} onClick={() => void vai(f)} title="Documento composto con i testi accettati e le proposte segnate come bozza">
              {scarica === f ? <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Scarica size={16} aria-hidden />}
              Anteprima {f === 'pdf' ? 'PDF' : 'Word'}
            </button>
          ))}
          {puoApprovare && !approvato && (
            <Pulsante classe="btn-acido" lavora={lavoroApprova} onClick={onApprova}>
              <Firma size={16} aria-hidden /> Approva il DVR
            </Pulsante>
          )}
        </div>
      </div>
    </header>
  );
}

/** Banner scuro: cosa ha preparato l'assistente, da quali fonti, e che la firma è di una persona. */
export function BannerAssistente({ documento }: { documento: Documento }) {
  const lavori = fraseLavori(documento);
  const b = documento.banner;
  const t = documento.testata;
  return (
    <section aria-label="Lavoro dell'assistente" className="rounded-[1.5rem] bg-grafite-900 px-4 py-4 text-white sm:px-5">
      <p className="text-[15.5px] leading-relaxed">{fraseBanner(documento)}</p>
      {b.fonti.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12.5px] text-grafite-400">Da queste fonti</p>
          <Fonti fonti={b.fonti} scuro />
        </div>
      )}
      {lavori && (
        <p role="status" className="mt-3 flex items-center gap-2 text-[13.5px] text-acido-300">
          <Rotore size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />
          {lavori}
        </p>
      )}
      <p className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-grafite-300">
        <Firma size={16} aria-hidden className="mt-0.5 shrink-0 text-acido-400" />
        <span>
          Ogni testo resta una proposta finché una persona non lo accetta. La firma è sempre di una persona: l&apos;assistente non approva e non emette.
          {t.livello !== null && LIVELLI[t.livello] ? ` Per questa azienda l'assistente ${LIVELLI[t.livello]}.` : ''}
          {b.generatoIl ? ` Prima bozza del ${dataIt(b.generatoIl)}.` : ''}
        </span>
      </p>
    </section>
  );
}
