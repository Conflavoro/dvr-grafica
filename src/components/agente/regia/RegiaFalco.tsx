'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Mic, Square, Volume2, VolumeX } from '@/components/icone';
import type { AgenteEvento, AgenteProgresso } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { FalcoMascot, type FalcoMascotProps, type FalcoStato } from '../FalcoMascot';
import { FalcoPalco } from '../FalcoPalco';
import { PianoLavoro } from '../PianoLavoro';
import { passiDaEventi } from '../LavoroInCorso';

export interface DaFare {
  chiave: string;
  titolo: string;
  dettaglio: string;
  tono: 'rosso' | 'oro' | 'neutro';
  onClick: () => void;
}

type PropsFalco = Pick<FalcoMascotProps, 'onAttiva' | 'etichettaAttiva' | 'onReazioneFinita'>;

const STATO: Record<FalcoStato, string> = {
  riposo: 'pronto',
  ascolta: 'ti ascolta',
  pensa: 'al lavoro',
  parla: 'ti risponde',
  attenzione: 'ha trovato qualcosa',
  fatto: 'ha finito',
};

export interface RegiaProps {
  nomeAgente: string;
  stato: FalcoStato;
  propsFalco: PropsFalco;
  /** Avanzamento dal vivo della risposta in corso. */
  progresso: AgenteProgresso | null;
  /** Lavoro in corso senza avanzamento del server (trascrizione, caricamento). */
  dettaglio: string | null;
  lavorando: boolean;
  /** Cosa sta dicendo: l'inizio della risposta mentre la legge o la scrive. */
  sottotitolo: string | null;
  daFare: DaFare[];
  registrando: boolean;
  secondi: number;
  onParla: () => void;
  voce: { possibile: boolean; attiva: boolean; parlando: boolean; onCambia: () => void; onFerma: () => void };
}

function useSecondi(attivo: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    if (!attivo) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [attivo]);
  return s;
}

function faseDi(eventi: AgenteEvento[]): string | undefined {
  return [...eventi].reverse().find((e): e is Extract<AgenteEvento, { t: 'fase' }> => e.t === 'fase')?.testo;
}

/** Il pensiero del falco: cosa fa adesso, il piano dal vivo, cosa dice, cosa propone. */
function Pensiero({ p, compatto }: { p: RegiaProps; compatto: boolean }) {
  const sec = useSecondi(p.lavorando);
  const eventi = p.progresso?.eventi ?? [];
  const passi = passiDaEventi(eventi);
  const fase = p.dettaglio ?? faseDi(eventi) ?? (p.lavorando ? 'Sto leggendo la richiesta' : null);

  if (p.registrando) {
    return (
      <p className="flex items-center gap-2 text-[14px] font-medium text-brand-900" role="status">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#d63d3e]" />
        Ti ascolto <span className="cifre text-ink-muted">{p.secondi} s</span>
      </p>
    );
  }
  if (p.lavorando) {
    return (
      <div role="status" aria-live="polite" className="min-w-0">
        <p className="flex items-center gap-2 text-[14px] font-medium leading-snug text-brand-900">
          <Loader2 size={15} aria-hidden className="shrink-0 animate-spin text-oro-600 motion-reduce:animate-none" />
          <span className="min-w-0 flex-1">{fase}</span>
          {sec >= 3 && <span className="cifre shrink-0 text-[11.5px] font-normal text-ink-subtle">{sec} s</span>}
        </p>
        {!compatto && p.progresso?.piano && (
          <div className="mt-3 border-t border-perla-linea pt-3">
            <PianoLavoro passi={p.progresso.piano} compatto />
          </div>
        )}
        {!compatto && passi.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-perla-linea pt-3" aria-label="Cosa sta facendo">
            {passi.slice(-6).map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-[12.5px]">
                {x.stato === 'in_corso' ? (
                  <Loader2 size={12} aria-hidden className="shrink-0 animate-spin text-brand-500 motion-reduce:animate-none" />
                ) : x.stato === 'ok' ? (
                  <Check size={12} aria-hidden strokeWidth={3} className="shrink-0 text-ok-mark" />
                ) : (
                  <AlertCircle size={12} aria-hidden className="shrink-0 text-warn-mark" />
                )}
                <span className="min-w-0 flex-1 truncate text-ink-soft">{x.titolo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (p.sottotitolo) {
    return (
      <p className={clsx('text-ink-soft', compatto ? 'line-clamp-2 text-[13px] leading-snug' : 'line-clamp-5 text-[14px] leading-relaxed')} aria-live="polite">
        {p.sottotitolo}
      </p>
    );
  }
  if (p.daFare.length === 0) {
    return <p className="text-[13.5px] leading-relaxed text-ink-muted">Dimmi cosa ti serve: aziende, documenti, scadenze, sopralluoghi. Ci penso io.</p>;
  }
  if (compatto) {
    const primo = p.daFare[0];
    return (
      <button type="button" onClick={primo.onClick} className="block min-h-[44px] w-full min-w-0 text-left">
        <span className="block truncate text-[13px] font-semibold text-brand-900">{primo.titolo}</span>
        <span className="block truncate text-[12px] text-ink-muted">
          {p.daFare.length > 1 ? `${primo.dettaglio.replace(/[.\s]+$/, '')}, e altre ${p.daFare.length - 1}` : primo.dettaglio}
        </span>
      </button>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-ink-subtle">Ho notato</p>
      <ul className="mt-1.5 space-y-1">
        {p.daFare.slice(0, 4).map((d) => (
          <li key={d.chiave}>
            <button
              type="button"
              onClick={d.onClick}
              className="premi -mx-2 flex min-h-[48px] w-[calc(100%+1rem)] items-start gap-2.5 rounded-full px-2 py-1.5 text-left hover:bg-perla-velo focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <span aria-hidden className={clsx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', d.tono === 'rosso' ? 'bg-[#d63d3e]' : d.tono === 'oro' ? 'bg-acido-700' : 'bg-grafite-300')} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-ink">{d.titolo}</span>
                <span className="block truncate text-[12px] text-ink-muted">{d.dettaglio}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PulsanteParla({ p, grande }: { p: RegiaProps; grande: boolean }) {
  // Nella colonna nera: pulsante acido a pillola, come l'azione principale del Portale HSE.
  const Icona = p.registrando ? Square : Mic;
  return (
    <button
      type="button"
      onClick={p.onParla}
      aria-pressed={p.registrando}
      className={clsx(
        'premi inline-flex items-center justify-center gap-2 rounded-full font-medium',
        p.registrando ? 'bg-[#d63d3e] text-white' : grande ? 'bg-oro-500 text-acido-950 hover:bg-acido-500' : 'comando',
        grande ? 'h-[3.25rem] w-full text-[15px]' : 'h-11 w-11 shrink-0'
      )}
      aria-label={p.registrando ? `Ferma e invia a ${p.nomeAgente}` : `Parla con ${p.nomeAgente}`}
    >
      <Icona size={grande ? 17 : 18} aria-hidden />
      {grande && (p.registrando ? 'Ferma e invia' : `Parla con ${p.nomeAgente}`)}
    </button>
  );
}

function TastoVoce({ p, scuro = false }: { p: RegiaProps; scuro?: boolean }) {
  if (!p.voce.possibile) return null;
  const cls = scuro
    ? 'inline-flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-grafite-300 shadow-[inset_0_0_0_1.5px_#34343a] transition-colors hover:bg-grafite-800 hover:text-white'
    : 'btn-icon h-11 w-11 shrink-0';
  if (p.voce.parlando) {
    return (
      <button type="button" onClick={p.voce.onFerma} aria-label="Ferma la lettura" title="Ferma la lettura" className={cls}>
        <Square size={16} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={p.voce.onCambia}
      aria-pressed={p.voce.attiva}
      aria-label={p.voce.attiva ? 'Voce attiva: disattiva' : 'Voce disattivata: attiva'}
      title={p.voce.attiva ? `Quando parli, ${p.nomeAgente} ti risponde anche a voce` : 'Risposte solo scritte'}
      className={cls}
    >
      {p.voce.attiva ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
    </button>
  );
}

/**
 * La regia: il falco sempre in vista, protagonista. Su schermo largo e' una
 * colonna a sinistra; su telefono una striscia fissa in alto.
 */
export function RegiaFalco(p: RegiaProps & { variante: 'colonna' | 'striscia'; altezza?: number }) {
  if (p.variante === 'striscia') {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <FalcoMascot stato={p.stato} size={96} ritaglio="busto" {...p.propsFalco} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-ink-muted">
            <span className="font-semibold text-brand-900">{p.nomeAgente}</span> {STATO[p.stato]}
          </p>
          <div className="mt-0.5 min-w-0">
            <Pensiero p={p} compatto />
          </div>
        </div>
        <TastoVoce p={p} />
      </div>
    );
  }
  // Colonna nera del Portale HSE. Il falco si adatta all'altezza: grande quando c'e' spazio, mai da scorrere.
  const h = p.altezza ?? 800;
  const size = h >= 860 ? 212 : h >= 760 ? 184 : h >= 680 ? 156 : 132;
  const punto =
    p.stato === 'parla' || p.stato === 'fatto' || p.stato === 'ascolta'
      ? 'bg-oro-500'
      : p.stato === 'pensa'
        ? 'animate-pulse bg-white motion-reduce:animate-none'
        : p.stato === 'attenzione'
          ? 'bg-[#ffc6ac]'
          : 'bg-grafite-500';
  return (
    <div className="flex h-full min-h-0 flex-col bg-black text-white">
      <div className="flex shrink-0 justify-center pt-6">
        <FalcoPalco stato={p.stato} size={size} scuro {...p.propsFalco} />
      </div>
      <div className="mt-2 shrink-0 px-5 text-center">
        <p className="text-[22px] font-medium tracking-[-0.02em] text-white">{p.nomeAgente}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-grafite-400" aria-live="polite">
          <span aria-hidden className={clsx('h-2 w-2 rounded-full', punto)} />
          {STATO[p.stato]}
        </p>
      </div>
      <div className="mx-3 mt-5 min-h-0 shrink overflow-y-auto overscroll-contain rounded-[1.25rem] bg-white px-4 py-3.5 text-ink">
        <Pensiero p={p} compatto={false} />
      </div>
      <div aria-hidden className="min-h-0 flex-1" />
      <div className="flex shrink-0 items-center gap-2 px-3 pb-4 pt-3">
        <PulsanteParla p={p} grande />
        <TastoVoce p={p} scuro />
      </div>
    </div>
  );
}
