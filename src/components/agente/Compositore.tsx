'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Camera, Loader2, Mic, SendHorizontal, Square, X } from '@/components/icone';
import { clsx } from '@/lib/clsx';

export const MAX_TESTO = 8000;

/** Barra di scrittura in basso: foto, voce, testo che cresce, invio. */
export function Compositore({
  testo,
  onTesto,
  onInvia,
  nomeAgente,
  occupato,
  inAttesa,
  registrando,
  secondi,
  conFoto,
  onFoto,
  onMicrofono,
  errore,
  onChiudiErrore,
  onRiprova,
  areaRef: areaEsterna,
  segnaposto,
  prima,
  sopra,
}: {
  testo: string;
  onTesto: (t: string) => void;
  onInvia: () => void;
  nomeAgente: string;
  occupato: boolean;
  inAttesa: boolean;
  registrando: boolean;
  secondi: number;
  conFoto: boolean;
  onFoto: () => void;
  onMicrofono: () => void;
  errore: string | null;
  onChiudiErrore: () => void;
  /** Se presente, l'avviso d'errore offre "Riprova" (es. reinvio dell'ultimo messaggio). */
  onRiprova?: () => void;
  /** Riferimento alla textarea (scorciatoie da tastiera della pagina). */
  areaRef?: RefObject<HTMLTextAreaElement>;
  /** Testo d'invito della casella (default "Scrivi a <agente>"). */
  segnaposto?: string;
  /** Elemento a sinistra della scrivania (il falco compatto durante la conversazione). */
  prima?: ReactNode;
  /** Sopra la plancia: i file in caricamento con avanzamento ed errori. */
  sopra?: ReactNode;
}) {
  const areaInterna = useRef<HTMLTextAreaElement>(null);
  const areaRef = areaEsterna ?? areaInterna;

  // Textarea che cresce con il testo (fino a circa 8 righe).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [testo]);

  const onTasto = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onInvia();
    }
  };

  const mmss = `${String(Math.floor(secondi / 60)).padStart(2, '0')}:${String(secondi % 60).padStart(2, '0')}`;

  const vuoto = !testo.trim();
  const tastoVoce = (grande: boolean) => (
    <button
      type="button"
      onClick={onMicrofono}
      disabled={!registrando && occupato}
      aria-label={registrando ? 'Ferma la registrazione e invia' : `Parla con ${nomeAgente}`}
      aria-pressed={registrando}
      title={registrando ? 'Ferma e invia' : 'Messaggio vocale'}
      className={clsx(
        'premi inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full disabled:opacity-40',
        registrando
          ? 'h-[52px] min-w-[52px] bg-[#d63d3e] px-4 text-white shadow-[0_0_0_4px_rgba(214,61,62,0.22)]'
          : grande
            ? 'h-[52px] w-[52px] bg-oro-500 text-acido-950 hover:bg-acido-500'
            : 'h-11 w-11 text-ink-muted hover:bg-perla-velo hover:text-ink'
      )}
    >
      {registrando ? (
        <>
          <Square size={16} aria-hidden className="fill-current" />
          <span className="cifre text-[12.5px] font-semibold">{mmss}</span>
        </>
      ) : (
        <Mic size={grande ? 23 : 19} aria-hidden strokeWidth={grande ? 1.8 : 1.5} />
      )}
    </button>
  );
  const tastoInvia = (
    <button
      type="button"
      onClick={onInvia}
      disabled={vuoto || occupato || registrando}
      aria-label="Invia il messaggio"
      className="premi inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-grafite-900 px-5 text-[14px] font-medium text-white hover:opacity-90 disabled:bg-perla-velo disabled:text-grafite-400"
    >
      {inAttesa ? <Loader2 size={17} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <SendHorizontal size={17} aria-hidden />}
      <span className="hidden sm:inline">Invia</span>
    </button>
  );

  return (
    <div className="shrink-0 px-2.5 pt-2 sm:px-6" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className={clsx('mx-auto flex w-full items-end gap-3', prima ? 'max-w-[56rem]' : 'max-w-3xl')}>
        {prima && <div className="mb-6 hidden shrink-0 lg:block">{prima}</div>}
        <div className="min-w-0 flex-1">
          {sopra}
          {errore && (
            <div role="alert" className="mb-2 flex items-start gap-2 rounded-[0.875rem] border border-warn bg-warn px-3 py-2 text-[13px] text-warn-ink">
              <span className="min-w-0 flex-1">{errore}</span>
              {onRiprova && (
                <button type="button" onClick={onRiprova} className="-my-1 min-h-[32px] shrink-0 rounded-md px-2 text-[12.5px] font-semibold text-warn-ink underline-offset-2 hover:bg-warn hover:underline">
                  Riprova
                </button>
              )}
              <button type="button" onClick={onChiudiErrore} aria-label="Chiudi avviso" className="-my-2.5 -mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-warn">
                <X size={14} aria-hidden />
              </button>
            </div>
          )}
          {/* Casella del Portale HSE: bianca con bordo, al fuoco bordo pieno. Telefono: foto, testo, voce grande. */}
          <div
            className={clsx(
              'grid grid-cols-[auto_1fr_auto] items-end gap-1 rounded-[1.75rem] bg-white p-1.5 shadow-[inset_0_0_0_1.5px_#e2e2e5,0_8px_24px_-12px_rgba(14,14,16,0.14)] transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_2px_#111113,0_8px_24px_-12px_rgba(14,14,16,0.14)] sm:grid-cols-[auto_auto_1fr_auto] sm:gap-1.5 sm:p-2',
              '[--icona-lame:#677f02] [--icona-lame-opacita:1]'
            )}
          >
            <label className="col-start-2 row-start-1 block min-w-0 sm:col-span-4 sm:col-start-1">
              <span className="sr-only">Messaggio per l’agente</span>
              <textarea
                ref={areaRef}
                value={testo}
                onChange={(e) => onTesto(e.target.value.slice(0, MAX_TESTO))}
                onKeyDown={onTasto}
                rows={1}
                disabled={registrando}
                placeholder={registrando ? 'Ti ascolto' : segnaposto ?? `Scrivi a ${nomeAgente}`}
                className="block max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-2 py-[11px] text-base leading-snug text-ink placeholder:text-grafite-400 focus:outline-none focus-visible:shadow-none disabled:opacity-60 sm:min-h-[52px] sm:px-3 sm:pt-3 sm:text-[15.5px]"
              />
            </label>
            {conFoto ? (
              <button
                type="button"
                onClick={onFoto}
                disabled={occupato || registrando}
                aria-label="Carica foto o file, anche più insieme"
                title="Foto o file, anche più insieme o trascinati qui: documenti, fogli, presentazioni, email, immagini, audio, video, ZIP, disegni"
                className="premi col-start-1 row-start-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-perla-velo hover:text-ink disabled:opacity-40 sm:row-start-2"
              >
                <Camera size={20} aria-hidden />
              </button>
            ) : (
              <span className="col-start-1 row-start-1 w-1 sm:row-start-2" />
            )}
            {/* Telefono: un solo tasto grande, voce se la casella e' vuota, invio se c'e' testo. */}
            <div className="col-start-3 row-start-1 sm:hidden">{vuoto || registrando ? tastoVoce(true) : tastoInvia}</div>
            <div className="hidden sm:col-start-2 sm:row-start-2 sm:block">{tastoVoce(false)}</div>
            <div className="hidden min-w-0 items-center justify-end gap-3 sm:col-start-4 sm:row-start-2 sm:flex">
              <span className="hidden truncate text-[12px] text-ink-subtle lg:block">{registrando ? 'Registro: tocca di nuovo per inviare' : 'Invio per mandare'}</span>
              {tastoInvia}
            </div>
          </div>
          <p className="mt-1.5 text-center text-[11px] leading-snug text-ink-subtle">
            <span title="Invio per mandare, Maiusc e Invio per andare a capo, spazio tenuto premuto per parlare, Ctrl o Cmd e K per cercare, Ctrl o Cmd, Maiusc e O per una nuova conversazione">
              Risposte generate con assistenza AI: verificale prima di usarle nei documenti.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
