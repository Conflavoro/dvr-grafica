'use client';

import { useState } from 'react';
import { ChevronDown, Download } from '@/components/icone';
import type { ColoreEsito, ConteggiControllo, OrigineDocumento, SegnalazioneDocumento } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { BTN, STATO_DVR } from './contesto';

/** Colori degli esiti: verde, giallo, arancio, rosso, viola (cancerogeni, rimando al Capo II), grigio. */
export const COLORE: Record<ColoreEsito, { punto: string; testo: string; fondo: string; barra: string }> = {
  verde: { punto: 'bg-ok-mark', testo: 'text-ok-ink', fondo: 'bg-ok', barra: 'bg-ok-mark' },
  giallo: { punto: 'bg-warn-mark', testo: 'text-warn-ink', fondo: 'bg-warn', barra: 'bg-warn-mark' },
  arancio: { punto: 'bg-warn-mark', testo: 'text-warn-ink', fondo: 'bg-warn', barra: 'bg-warn-mark' },
  rosso: { punto: 'bg-danger-mark', testo: 'text-danger-ink', fondo: 'bg-danger', barra: 'bg-danger-mark' },
  viola: { punto: 'bg-info-mark', testo: 'text-info-ink', fondo: 'bg-info', barra: 'bg-info-mark' },
  grigio: { punto: 'bg-grafite-400', testo: 'text-ink-soft', fondo: 'bg-perla-velo', barra: 'bg-grafite-400' },
};

const STATI_DOC: Record<string, { l: string; cls: string }> = {
  bozza: { l: 'Bozza', cls: 'bg-grafite-100 text-grafite-700' },
  pronto: { l: 'Pronto da emettere', cls: 'bg-oro-100 text-oro-700' },
  pronta: { l: 'Pronta da emettere', cls: 'bg-oro-100 text-oro-700' },
  emesso: { l: 'Emesso', cls: 'bg-ok text-ok-ink' },
  emessa: { l: 'Emessa', cls: 'bg-ok text-ok-ink' },
  cessata: { l: 'Cessata', cls: 'bg-grafite-100 text-grafite-500' },
};

export function etichettaStato(stato: string | null): { l: string; cls: string } {
  if (!stato) return { l: 'Senza stato', cls: 'bg-grafite-100 text-grafite-700' };
  const dvr = STATO_DVR[stato];
  if (dvr) return { l: dvr.label, cls: dvr.cls };
  return STATI_DOC[stato] ?? { l: stato.charAt(0).toUpperCase() + stato.slice(1), cls: 'bg-grafite-100 text-grafite-700' };
}

export function BadgeStatoDoc({ stato }: { stato: string | null }) {
  const s = etichettaStato(stato);
  return <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', s.cls)}>{s.l}</span>;
}

/** true se lo stato e' un'emissione definitiva (file firmabile). */
export const emesso = (stato: string | null) => stato === 'emesso' || stato === 'emessa' || stato === 'approved';

export function PuntoEsito({ colore }: { colore: ColoreEsito }) {
  return <span aria-hidden className={clsx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', COLORE[colore].punto)} />;
}

const ESITO_SEGN: Record<SegnalazioneDocumento['esito'], { l: string; riga: string; badge: string }> = {
  blocca: { l: 'Blocca', riga: 'bg-danger/70 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.18)]', badge: 'bg-danger-mark text-white' },
  corregge: { l: 'Da correggere', riga: 'bg-warn/70 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]', badge: 'bg-warn-mark text-white' },
  avvisa: { l: 'Avviso', riga: 'bg-perla-superficie shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]', badge: 'bg-grafite-500 text-white' },
};

/** Tre caselle con il numero di segnalazioni per esito. */
export function CaselleControlli({ c }: { c: ConteggiControllo }) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 text-center" aria-label="Esito dei controlli">
      {(
        [
          ['Bloccano', c.blocca, 'text-danger-ink bg-danger'],
          ['Da correggere', c.corregge, 'text-warn-ink bg-warn'],
          ['Avvisi', c.avvisa, 'text-ink-soft bg-perla-velo'],
        ] as const
      ).map(([l, n, cls]) => (
        <li key={l} className={clsx('rounded-[0.875rem] px-2 py-2', cls)}>
          <span className="cifre block text-[18px] font-medium leading-none">{n}</span>
          <span className="mt-1 block text-[11px] font-semibold">{l}</span>
        </li>
      ))}
    </ul>
  );
}

/** Segnalazioni dei controlli colorate: le prime cinque, le altre a richiesta. */
export function ElencoSegnalazioni({ segnalazioni, visibili = 5 }: { segnalazioni: SegnalazioneDocumento[]; visibili?: number }) {
  const [tutte, setTutte] = useState(false);
  if (segnalazioni.length === 0) return null;
  const mostrate = tutte ? segnalazioni : segnalazioni.slice(0, visibili);
  return (
    <div>
      <ul className="space-y-1.5">
        {mostrate.map((s, i) => {
          const e = ESITO_SEGN[s.esito];
          return (
            <li key={`${s.chiave}-${i}`} className={clsx('rounded-[0.875rem] px-3 py-2', e.riga, s.accettata && 'opacity-60')}>
              <p className="flex items-center gap-2">
                <span className={clsx('rounded px-1.5 py-0.5 text-[10.5px] font-medium', e.badge)}>{e.l}</span>
                {s.accettata && <span className="text-[11px] font-semibold text-ink-muted">accettata</span>}
                {s.riferimento && <span className="cifre ml-auto truncate text-[11px] text-ink-muted">{s.riferimento}</span>}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink">{s.messaggio}</p>
            </li>
          );
        })}
      </ul>
      {segnalazioni.length > visibili && (
        <button type="button" onClick={() => setTutte((v) => !v)} aria-expanded={tutte} className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
          <ChevronDown size={14} aria-hidden className={clsx('transition-transform motion-reduce:transition-none', tutte && 'rotate-180')} />
          {tutte ? 'Mostra meno' : `Vedi tutte (${segnalazioni.length - visibili} in più)`}
        </button>
      )}
    </div>
  );
}

/**
 * Word e PDF di un documento: l'ultima revisione emessa o, se non c'e', la
 * bozza. Se la bozza non ha ancora un file si propone di chiedere l'anteprima.
 */
export function ScaricaDocumento({
  origine,
  id,
  stato,
  onAnteprima,
  compatto = false,
}: {
  origine: OrigineDocumento;
  id: number;
  stato: string | null;
  /** Chiede all'agente di preparare la bozza scaricabile. */
  onAnteprima?: () => void;
  compatto?: boolean;
}) {
  const ds = useDataSource();
  const [scarico, setScarico] = useState<'pdf' | 'docx' | null>(null);
  const [err, setErr] = useState<{ testo: string; formato: 'pdf' | 'docx' } | null>(null);
  const bozza = !emesso(stato);

  const scarica = async (f: 'pdf' | 'docx') => {
    setScarico(f);
    setErr(null);
    try {
      await ds.documentiHse.scarica(origine, id, f);
    } catch (e) {
      setErr({ testo: e instanceof Error && e.message ? e.message : 'Download non riuscito.', formato: f });
    } finally {
      setScarico(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(['pdf', 'docx'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => void scarica(f)}
            disabled={scarico !== null}
            aria-label={`Scarica ${bozza ? 'la bozza in' : ''} ${f === 'pdf' ? 'PDF' : 'Word'}`.replace(/\s+/g, ' ')}
            className={BTN}
          >
            <Download size={15} aria-hidden />
            {scarico === f ? 'Scarico' : `${compatto ? '' : bozza ? 'Bozza ' : ''}${f === 'pdf' ? 'PDF' : 'Word'}`}
          </button>
        ))}
      </div>
      {err && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[0.875rem] bg-warn px-3 py-2 text-[12.5px] text-warn-ink">
          <span className="min-w-0 flex-1">{err.testo}</span>
          {onAnteprima && /anteprima/.test(err.testo) ? (
            <button type="button" onClick={onAnteprima} className="min-h-[36px] font-semibold underline-offset-2 hover:underline">
              Chiedi l’anteprima
            </button>
          ) : (
            <button type="button" onClick={() => void scarica(err.formato)} className="min-h-[36px] font-semibold underline-offset-2 hover:underline">
              Riprova
            </button>
          )}
        </div>
      )}
    </div>
  );
}
