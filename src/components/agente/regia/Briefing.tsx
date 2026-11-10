'use client';

import { ChevronLeft } from '@/components/icone';
import type { AgenteTema } from '@/lib/agente-temi';
import { clsx } from '@/lib/clsx';
import { temiPerRuolo } from '../ScenaApertura';
import type { DaFare } from './RegiaFalco';

function saluto(ora: number): string {
  if (ora < 5) return 'Buonasera';
  if (ora < 13) return 'Buongiorno';
  if (ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Colore di categoria del Portale HSE per ogni tema: solo nel pallino dell'icona. */
export const CATEGORIA_TEMA: Record<string, string> = {
  dvr: 'bg-cat-documenti text-cat-documenti-ink',
  pos: 'bg-cat-contratto text-cat-contratto-ink',
  psc: 'bg-cat-servizi text-cat-servizi-ink',
  duvri: 'bg-cat-assistenza text-cat-assistenza-ink',
  formazione: 'bg-cat-formazione text-cat-formazione-ink',
  sopralluogo: 'bg-cat-visite text-cat-visite-ink',
  nomine: 'bg-cat-persone text-cat-persone-ink',
  normativa: 'bg-cat-utenti text-cat-utenti-ink',
  emergenze: 'bg-cat-antincendio text-cat-antincendio-ink',
  aziende: 'bg-cat-pagamenti text-cat-pagamenti-ink',
};

function oggi(): string {
  const t = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Conversazione vuota, come la home del Portale HSE: la data, il saluto grande,
 * su telefono il riquadro acido "Da fare adesso", poi i temi come scorciatoie.
 * Sta tutto in una schermata, senza scorrere.
 */
export function Briefing({
  nomeUtente,
  nomeAgente,
  isDatore,
  disabled,
  daFare,
  mostraDaFare,
  onTema,
}: {
  nomeUtente: string;
  nomeAgente: string;
  isDatore: boolean;
  disabled: boolean;
  daFare: DaFare[];
  mostraDaFare: boolean;
  onTema: (t: AgenteTema) => void;
}) {
  const temi = temiPerRuolo(isDatore);
  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col px-4 pb-6 pt-5 sm:px-8 sm:pt-[9vh]">
      <p className="text-[17px] font-light text-ink-muted sm:text-[22px]">{oggi()}</p>
      <h1 className="mt-0.5 text-[40px] font-normal leading-[1.02] tracking-[-0.035em] text-ink sm:text-[60px]">
        {saluto(new Date().getHours())}
        {nomeUtente ? `, ${nomeUtente}` : ''}
      </h1>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
        Dimmi cosa ti serve, a voce o per scritto. {nomeAgente} fa il lavoro e ti prepara tutto sul tavolo.
      </p>

      {mostraDaFare && daFare.length > 0 && (
        <section aria-labelledby="br-dafare" className="mt-6 rounded-[1.75rem] bg-oro-500 p-3 text-acido-950">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <h2 id="br-dafare" className="text-[19px] font-medium tracking-[-0.01em]">
              Da fare adesso
            </h2>
            <span className="cifre inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-black px-2 text-[12px] font-medium text-oro-500">{daFare.length}</span>
          </div>
          <ul className="space-y-1.5">
            {daFare.slice(0, 3).map((d) => (
              <li key={d.chiave}>
                <button type="button" onClick={d.onClick} className="premi flex min-h-[56px] w-full items-center gap-3 rounded-[1.25rem] bg-white px-3.5 py-2 text-left text-ink">
                  <span aria-hidden className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', d.tono === 'rosso' ? 'bg-[#d63d3e]' : d.tono === 'oro' ? 'bg-[#a86800]' : 'bg-grafite-300')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{d.titolo}</span>
                    <span className="block truncate text-[12.5px] text-ink-muted">{d.dettaglio}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="br-temi" className="mt-8">
        <h2 id="br-temi" className="text-[13px] font-medium text-ink-muted">
          Oppure parti da un tema
        </h2>
        <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {temi.map((t) => {
            const Icona = t.icona;
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onTema(t)}
                  disabled={disabled}
                  title={t.descrizione}
                  className="premi inline-flex min-h-[46px] items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[14px] font-medium text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#18181b] disabled:opacity-50 [--icona-lame:currentColor] [--icona-lame-opacita:1]"
                >
                  <span aria-hidden className={clsx('grid h-[34px] w-[34px] place-items-center rounded-full', CATEGORIA_TEMA[t.id] ?? 'bg-perla-velo text-ink')}>
                    <Icona size={16} />
                  </span>
                  {t.titolo}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Tema scelto: tre domande pronte e "parti tu". Compatto, senza falco (e' gia' in regia). */
export function TemaVista({
  tema,
  disabled,
  onIndietro,
  onDomanda,
  onAvvio,
}: {
  tema: AgenteTema;
  disabled: boolean;
  onIndietro: () => void;
  onDomanda: (q: string) => void;
  onAvvio: () => void;
}) {
  const Icona = tema.icona;
  return (
    <div className="mx-auto w-full max-w-[44rem] px-4 pb-6 pt-4 sm:px-8 sm:pt-[10vh]">
      <button type="button" onClick={onIndietro} className="premi -ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[13.5px] font-medium text-ink-muted hover:bg-perla-velo hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Tutti i temi
      </button>
      <div className="mt-2 flex items-center gap-4 [--icona-lame:currentColor] [--icona-lame-opacita:1]">
        <span aria-hidden className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full', CATEGORIA_TEMA[tema.id] ?? 'bg-perla-velo text-ink')}>
          <Icona size={21} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[32px] font-normal leading-tight tracking-[-0.03em] text-ink sm:text-[40px]">{tema.titolo}</h1>
          <p className="text-[13.5px] text-ink-muted">{tema.descrizione}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {tema.domande.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onDomanda(q)}
              disabled={disabled}
              className="premi flex min-h-[56px] w-full items-center rounded-[1.25rem] bg-white px-4 py-2 text-left text-[15px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#18181b] disabled:opacity-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onAvvio} disabled={disabled} className="btn-ghost premi mt-4 min-h-[44px]">
        Fammi tu le domande giuste
      </button>
    </div>
  );
}
