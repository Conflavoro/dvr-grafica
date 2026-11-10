'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataSource } from '@/lib/use-data-source';
import { controllaFileLogo } from '@/lib/data-source/loghi-api';
import type { StatoLogo } from '@/lib/data-source';
import { Scheda } from './kit';

type Props =
  | { tipo: 'azienda'; companyId: number; nome?: string }
  | { tipo: 'studio'; nome?: string };

/**
 * Riquadro "Logo" per i documenti: anteprima, Carica (o Sostituisci) e Rimuovi.
 * Il logo dell'azienda va in copertina e nell'intestazione di DVR, POS, DUVRI e
 * valutazioni; quello dello studio, piccolo, nell'intestazione delle pagine.
 */
export function RiquadroLogo(props: Props) {
  const ds = useDataSource();
  const input = useRef<HTMLInputElement>(null);
  const [stato, setStato] = useState<StatoLogo | null>(null);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState<'carico' | 'tolgo' | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const companyId = props.tipo === 'azienda' ? props.companyId : null;

  const aggiorna = useCallback(async () => {
    const st = companyId !== null ? await ds.loghi.azienda(companyId) : await ds.loghi.studio();
    setStato(st);
    const url = st.logo ? (companyId !== null ? await ds.loghi.anteprimaAzienda(companyId) : await ds.loghi.anteprimaStudio()) : null;
    setAnteprima((prima) => {
      if (prima?.startsWith('blob:')) URL.revokeObjectURL(prima);
      return url;
    });
  }, [ds, companyId]);

  useEffect(() => {
    aggiorna().catch((e: Error) => setErrore(e.message));
  }, [aggiorna]);

  useEffect(
    () => () => {
      if (anteprima?.startsWith('blob:')) URL.revokeObjectURL(anteprima);
    },
    [anteprima],
  );

  const scegli = async (file: File | undefined) => {
    if (!file) return;
    setErrore(null);
    setFatto(null);
    const msg = controllaFileLogo(file, stato?.svg ?? false);
    if (msg) {
      setErrore(msg);
      return;
    }
    setLavoro('carico');
    try {
      if (companyId !== null) await ds.loghi.caricaAzienda(companyId, file);
      else await ds.loghi.caricaStudio(file);
      await aggiorna();
      setFatto('Logo salvato. Compare nei documenti che generi da adesso.');
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(null);
      if (input.current) input.current.value = '';
    }
  };

  const rimuovi = async () => {
    setErrore(null);
    setFatto(null);
    setLavoro('tolgo');
    try {
      if (companyId !== null) await ds.loghi.rimuoviAzienda(companyId);
      else await ds.loghi.rimuoviStudio();
      await aggiorna();
      setFatto('Logo tolto. I documenti tornano senza logo.');
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(null);
    }
  };

  const studio = props.tipo === 'studio';
  const titolo = studio ? 'Logo dello studio' : 'Logo dell’azienda';
  const sotto = studio
    ? 'Compare piccolo nell’intestazione delle pagine di tutti i documenti che lo studio redige.'
    : 'Compare in copertina e nell’intestazione di DVR, POS, DUVRI, valutazioni e verbali.';
  const formati = stato?.svg ? 'PNG con fondo trasparente, JPG, WebP o SVG' : 'PNG con fondo trasparente, JPG o WebP';
  const puo = stato?.puo_modificare ?? false;

  return (
    <Scheda titolo={titolo} sotto={sotto}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-[96px] w-full shrink-0 items-center justify-center rounded-[1rem] bg-[#f4f4f5] px-4 sm:w-[240px]"
          aria-live="polite"
        >
          {anteprima ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={anteprima} alt={props.nome ? `Logo di ${props.nome}` : titolo} className="max-h-[64px] max-w-full object-contain" />
          ) : (
            <span className="text-[13px] text-ink-subtle">{stato === null && !errore ? 'Carico il logo' : 'Nessun logo'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[13px] text-ink-muted">
            {formati}, fino a 2 MB. Lo puliamo e lo ridimensioniamo noi; le proporzioni restano sempre quelle originali.
          </p>
          {puo ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={input}
                type="file"
                accept={stato?.svg ? 'image/png,image/jpeg,image/webp,image/svg+xml' : 'image/png,image/jpeg,image/webp'}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => scegli(e.target.files?.[0])}
              />
              <button type="button" className="btn-primary min-h-[44px]" disabled={lavoro !== null} onClick={() => input.current?.click()}>
                {lavoro === 'carico' ? 'Salvo il logo' : stato?.logo ? 'Sostituisci' : 'Carica il logo'}
              </button>
              {stato?.logo && (
                <button type="button" className="btn-ghost min-h-[44px]" disabled={lavoro !== null} onClick={rimuovi}>
                  {lavoro === 'tolgo' ? 'Tolgo il logo' : 'Rimuovi'}
                </button>
              )}
            </div>
          ) : (
            stato && (
              <p className="text-[13px] text-ink-subtle">
                {studio ? 'Il logo dello studio lo cambia il titolare.' : 'Il logo lo cambiano il titolare, il referente e lo studio.'}
              </p>
            )
          )}
          {errore && (
            <p role="alert" className="text-[13px] text-stato-danger-ink">
              {errore}
            </p>
          )}
          {fatto && <p className="text-[13px] text-ink-muted">{fatto}</p>}
        </div>
      </div>
    </Scheda>
  );
}
