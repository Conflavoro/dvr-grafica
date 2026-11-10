'use client';

import { percorso } from '@/lib/percorso';
import Link from 'next/link';
import { schedaDvr, schedaAzienda } from '@/lib/portale/rotte-nuove';
import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Building2, ChevronDown, Download, FileText, ShieldCheck } from '@/components/icone';
import type { AgenteAzione, AgenteMessaggio, AgentePasso } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { AgenteMarkdown } from './AgenteMarkdown';
import { PianoLavoro } from './PianoLavoro';
import { senzaTema } from '@/lib/agente-temi';

type PassoStrumento = Extract<AgentePasso, { tipo: 'strumento' }>;
type PassoRevisore = Extract<AgentePasso, { tipo: 'autocorrezione' }>;
type PassoPiano = Extract<AgentePasso, { tipo: 'piano' }>;

function Azione({ a }: { a: AgenteAzione }) {
  const cls = 'btn-ghost min-h-[44px] px-3 text-[13px]';
  if (a.tipo === 'download') {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className={cls}>
        <Download size={15} aria-hidden />
        {a.etichetta}
      </a>
    );
  }
  if (a.tipo === 'dvr') {
    return (
      <Link href={schedaDvr(a.dvr_id)} className={cls}>
        <FileText size={15} aria-hidden />
        {a.etichetta}
      </Link>
    );
  }
  return (
    <Link href={schedaAzienda(a.azienda_id)} className={cls}>
      <Building2 size={15} aria-hidden />
      {a.etichetta}
    </Link>
  );
}

/** Riga discreta con gli strumenti consultati e l'eventuale passaggio del revisore. */
function Passi({ passi }: { passi: AgentePasso[] }) {
  const [aperto, setAperto] = useState(false);
  const idDettagli = useId();
  const strumenti = passi.filter((p): p is PassoStrumento => p.tipo === 'strumento');
  const revisioni = passi.filter((p): p is PassoRevisore => p.tipo === 'autocorrezione');
  const piano = passi.find((p): p is PassoPiano => p.tipo === 'piano') ?? null;
  if (strumenti.length === 0 && revisioni.length === 0 && !piano) return null;

  const titoli = Array.from(new Set(strumenti.map((s) => s.titolo)));
  const errori = strumenti.filter((s) => !s.ok).length;
  const problemi = revisioni.flatMap((r) => r.problemi);

  return (
    <div className="mt-2 text-[12.5px] text-ink-muted">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(titoli.length > 0 || piano) && (
          <button
            type="button"
            onClick={() => setAperto((v) => !v)}
            aria-expanded={aperto}
            aria-controls={idDettagli}
            className="inline-flex min-h-[44px] max-w-full lg:min-h-[32px] items-center gap-1 rounded-full text-left hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <span className="min-w-0">
              {titoli.length > 0 ? `Ha consultato: ${titoli.join(', ')}` : 'Piano di lavoro'}
              {errori > 0 && <span className="text-warn-ink"> ({errori === 1 ? '1 non riuscito' : `${errori} non riusciti`})</span>}
            </span>
            <ChevronDown size={14} aria-hidden className={clsx('shrink-0 transition-transform motion-reduce:transition-none', aperto && 'rotate-180')} />
          </button>
        )}
        {revisioni.length > 0 && (
          <span className="inline-flex items-center gap-1 text-ok-ink">
            <ShieldCheck size={14} aria-hidden />
            Ricontrollata dal revisore
          </span>
        )}
      </div>
      {aperto && piano && (
        <div className="mt-1.5 border-l border-oro-200 pl-3">
          <PianoLavoro passi={piano.passi} compatto />
        </div>
      )}
      {aperto && (strumenti.length > 0 || problemi.length > 0) && (
        <ul id={idDettagli} className="mt-1.5 space-y-1 border-l border-oro-200 pl-3">
          {strumenti.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              {s.ok ? (
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ok-mark" aria-hidden />
              ) : (
                <AlertCircle size={13} aria-hidden className="mt-[3px] shrink-0 text-warn-mark" />
              )}
              <span>
                {s.titolo}
                {!s.ok && <span className="text-warn-ink">: {s.errore || 'non riuscito'}</span>}
              </span>
            </li>
          ))}
          {problemi.length > 0 && (
            <li className="pt-1">
              <span className="font-medium text-ink-soft">Punti corretti dal revisore:</span>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {problemi.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Durata massima dell'effetto di scrittura progressiva. */
const SCRITTURA_MAX_MS = 1200;

/**
 * Testo che compare con una scrittura progressiva rapida (max 1,2 s). Si salta
 * con un clic o un tasto; con prefers-reduced-motion compare subito.
 */
function TestoProgressivo({ testo, onFine }: { testo: string; onFine?: () => void }) {
  const [n, setN] = useState(0);
  const fatto = useRef(false);
  const fine = useRef(onFine);
  fine.current = onFine;

  const completa = () => {
    if (fatto.current) return;
    fatto.current = true;
    setN(testo.length);
    fine.current?.();
  };

  useEffect(() => {
    let ridotto = false;
    try {
      ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* nessuna preferenza */
    }
    if (ridotto || testo.length < 40) {
      completa();
      return;
    }
    const durata = Math.min(SCRITTURA_MAX_MS, 250 + testo.length * 2);
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / durata);
      setN(Math.round(testo.length * k));
      if (k < 1 && !fatto.current) raf = requestAnimationFrame(passo);
      else completa();
    };
    raf = requestAnimationFrame(passo);
    const salta = () => completa();
    window.addEventListener('keydown', salta, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', salta);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testo]);

  const finito = n >= testo.length;
  return (
    <div onClick={finito ? undefined : completa} className={finito ? undefined : 'cursor-pointer'} title={finito ? undefined : 'Mostra subito tutta la risposta'}>
      {/* Il lettore di schermo riceve subito il testo completo. */}
      <span className="sr-only">{finito ? '' : testo}</span>
      <div aria-hidden={!finito}>
        <AgenteMarkdown testo={finito ? testo : testo.slice(0, n)} />
      </div>
    </div>
  );
}

export function MessaggioAgente({
  m,
  animato = false,
  onFineScrittura,
  nomeAgente = 'Falco',
}: {
  m: AgenteMessaggio;
  animato?: boolean;
  onFineScrittura?: () => void;
  nomeAgente?: string;
}) {
  const [scritto, setScritto] = useState(!animato);
  if (m.ruolo === 'utente') {
    return (
      <div className="flex justify-end">
        <div className="comando max-w-[88%] whitespace-pre-wrap break-words rounded-[1.25rem] rounded-br-[6px] px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[72%]">
          {senzaTema(m.testo)}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      {/* Firma dell'agente: il falco in un cerchio bianco, come le iniziali del Portale HSE. */}
      <span aria-hidden className="mt-0.5 hidden h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1px_#e2e2e5] sm:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={percorso('/brand/falco-acido/avatar.webp')} alt="" width={36} height={36} className="h-full w-full object-cover" style={{ transform: 'scale(2.7)', transformOrigin: '50% 20%' }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-2 text-[13px] font-medium tracking-[-0.01em] text-brand-900">
          {nomeAgente}
          {m.creato && <span className="cifre text-[11px] font-normal text-ink-subtle">{new Date(m.creato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>}
        </p>
        <div className="text-[15.5px] leading-[1.65] text-ink-soft">
          {scritto ? (
            <AgenteMarkdown testo={m.testo} />
          ) : (
            <TestoProgressivo
              testo={m.testo}
              onFine={() => {
                setScritto(true);
                onFineScrittura?.();
              }}
            />
          )}
        </div>
        {scritto && (
          <>
            <Passi passi={m.passi} />
            {m.azioni.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.azioni.map((a, i) => (
                  <Azione key={i} a={a} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
