'use client';

import { MessageSquarePlus, Star, Trash2 } from '@/components/icone';
import type { AgenteConversazione } from '@/lib/data-source';
import type { AziendaIndice } from '@/lib/agente-aziende';
import { senzaTema } from '@/lib/agente-temi';
import { useRef } from 'react';
import { clsx } from '@/lib/clsx';
import { useEntrata } from '@/lib/use-entrata';
import { Lame } from './spazio/kit';
import { CruscottoAzienda } from './CruscottoAzienda';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const ore = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
function quando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString() === new Date().toDateString() ? `oggi alle ${ore.format(d)}` : fmt.format(d);
}

const STATO: Record<AziendaIndice['stato'], { cls: string; pallino: string }> = {
  scaduto: { cls: 'border-transparent bg-stato-danger text-stato-danger-ink', pallino: 'bg-stato-danger-segno' },
  aggiornare: { cls: 'border-transparent bg-stato-warn text-stato-warn-ink', pallino: 'bg-stato-warn-segno' },
  ok: { cls: 'border-transparent bg-stato-ok text-stato-ok-ink', pallino: 'bg-stato-ok-segno' },
};

/**
 * Vista azienda: identita' in alto, sotto le conversazioni su questa azienda
 * (una chat per ogni lavoro) e le richieste piu' frequenti. Lo spazio di
 * lavoro a destra e' gia' aperto su di lei.
 */
export function VistaAzienda({
  azienda,
  conversazioni,
  preferita,
  isDatore,
  disabled,
  onPreferita,
  onNuova,
  onApri,
  onElimina,
  onChiedi,
}: {
  azienda: AziendaIndice;
  conversazioni: AgenteConversazione[];
  preferita: boolean;
  isDatore: boolean;
  disabled: boolean;
  onPreferita: () => void;
  onNuova: () => void;
  onApri: (id: number) => void;
  onElimina: (c: AgenteConversazione) => void;
  onChiedi: (t: string) => void;
}) {
  const s = STATO[azienda.stato];
  const box = useRef<HTMLDivElement>(null);
  useEntrata(box, `azienda-${azienda.id}`);
  const nome = azienda.ragione_sociale;
  const rapide = isDatore
    ? [`Com'è messo il DVR di ${nome}`, `Quali scadenze di ${nome} sono vicine`, `Cosa devo fare come datore di lavoro di ${nome}`]
    : [`Com'è messo il DVR di ${nome}`, `Cosa scade nei prossimi 60 giorni per ${nome}`, `Prepara il POS per un nuovo cantiere di ${nome}`];

  return (
    <div ref={box} className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-8 sm:pt-9">
      {/* Identita' */}
      <div className="flex items-start gap-4">
        <span data-entra="" aria-hidden className="relative mt-1 hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black text-[19px] font-medium tracking-[-0.02em] text-oro-500 sm:flex">
          {nome.slice(0, 2).toUpperCase()}
                  </span>
        <div className="min-w-0 flex-1">
          <h1 key={azienda.id} data-titolo="" className="text-[32px] font-medium leading-[1.02] tracking-[-0.035em] text-brand-900 sm:text-[44px]">
            {nome}
          </h1>
          <p data-entra="" className="mt-2 text-[14px] text-ink-muted">
            {[azienda.ateco && `ATECO ${azienda.ateco}${azienda.ateco_label ? `, ${azienda.ateco_label}` : ''}`, azienda.comune, `${azienda.lavoratori} lavoratori`].filter(Boolean).join(', ')}
          </p>
          <div data-entra="" className="mt-3 flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex min-h-[34px] items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold', s.cls)}>
              <span aria-hidden className={clsx('h-2 w-2 rounded-full', s.pallino)} />
              {azienda.motivo}
            </span>
            <button
              type="button"
              onClick={onPreferita}
              aria-pressed={preferita}
              className={clsx('premi inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 lg:min-h-[34px] text-[12.5px] font-semibold', preferita ? 'border-transparent bg-oro-500 text-acido-950' : 'border-perla-linea bg-white text-ink-muted hover:text-ink')}
            >
              <Star size={13} aria-hidden className={preferita ? 'fill-current' : undefined} />
              {preferita ? 'Preferita' : 'Aggiungi alle preferite'}
            </button>
          </div>
        </div>
      </div>

      {/* Home dell'azienda come nel Portale HSE: da fare adesso, Pronto Ispezioni, riquadri */}
      <CruscottoAzienda aziendaId={azienda.id} nome={nome} disabled={disabled} onChiedi={onChiedi} />

      {/* Conversazioni su questa azienda */}
      <section data-entra="" aria-labelledby="va-conv" className="mt-9">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="va-conv" className="flex-1 text-[17px] font-medium tracking-[-0.015em] text-brand-900">
            Conversazioni su questa azienda
          </h2>
          <button type="button" onClick={onNuova} className="btn-ghost min-h-[44px]">
            <MessageSquarePlus size={16} aria-hidden /> Nuova conversazione su questa azienda
          </button>
        </div>
        {conversazioni.length === 0 ? (
          <p className="superficie rounded-[1.25rem] px-4 py-5 text-[13.5px] text-ink-muted">Ancora nessuna conversazione. Scrivi qui sotto oppure parti da una delle richieste.</p>
        ) : (
          <ul className="superficie divide-y divide-perla-linea overflow-hidden rounded-[1.25rem]">
            {conversazioni.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onApri(c.id)}
                  className="flex min-h-[58px] w-full items-center gap-3 py-2 pl-4 pr-12 text-left transition-colors hover:bg-perla-velo/70 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{senzaTema(c.titolo)}</span>
                  <span className="cifre shrink-0 text-[11.5px] text-ink-subtle">{quando(c.aggiornata)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onElimina(c)}
                  aria-label={`Elimina la conversazione ${senzaTema(c.titolo)}`}
                  className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle hover:bg-danger hover:text-danger-ink focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-entra="" aria-labelledby="va-rapide" className="mt-8">
        <h2 id="va-rapide" className="mb-2 text-[13.5px] font-semibold text-ink-soft">
          Chiedi subito
        </h2>
        <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
          {rapide.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChiedi(q)}
                className="premi premi-su superficie flex min-h-[46px] w-full items-center gap-2.5 rounded-full px-3.5 text-left text-[13.5px] font-medium text-ink-soft hover:text-brand-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 sm:w-auto"
              >
                <Lame />
                {q}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
