'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Avviso, CerchioSpunta, Rotore, Scarica } from '@/components/icone';
import { Caricamento, Chip, Errore, Foglio } from '@/components/portale/kit';
import { clsx } from '@/lib/clsx';
import { ESITO, domandaDifetto, livelloQualita, motivoValido, percentualePassi, raggruppaSegnalazioni, type GruppoDoc, type PassoGenerazione, type Segnalazione, type VoceDocumento } from '@/lib/portale/documenti';
import { qualita as caricaQualita, scarica, type SchedaQualita } from '@/lib/portale/documenti-api';

/** Messaggio breve dopo un'azione, che sparisce da solo. */
export function useAvviso(): [string | null, (t: string | null) => void] {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), 6000);
    return () => clearTimeout(h);
  }, [t]);
  return [t, setT];
}

export function Notizia({ testo }: { testo: string | null }) {
  if (!testo) return null;
  return (
    <p role="status" className="rounded-[1rem] bg-acido-200 px-4 py-3 text-[14px] text-acido-950">
      {testo}
    </p>
  );
}

/** Conferma esplicita di chi firma: approvazione ed emissione restano un atto umano. */
export function FoglioConferma({
  aperto,
  titolo,
  spiega,
  spunta,
  azione,
  onChiudi,
  onConferma,
}: {
  aperto: boolean;
  titolo: string;
  spiega: ReactNode;
  spunta: string;
  azione: string;
  onChiudi: () => void;
  onConferma: () => Promise<void>;
}) {
  const [ok, setOk] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (aperto) {
      setOk(false);
      setErr(null);
    }
  }, [aperto]);
  const vai = async () => {
    setLavoro(true);
    setErr(null);
    try {
      await onConferma();
      onChiudi();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setLavoro(false);
    }
  };
  return (
    <Foglio
      aperto={aperto}
      titolo={titolo}
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" disabled={!ok || lavoro} onClick={() => void vai()}>
            {lavoro && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {azione}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-[14.5px] leading-relaxed text-ink-soft">
        {spiega}
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[1rem] bg-perla-velo px-4 py-3 text-ink">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#18181b]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>{spunta}</span>
        </label>
        {err && <Errore testo={err} />}
      </div>
    </Foglio>
  );
}

/** Pulsanti Word e PDF del documento. */
export function Scaricamenti({ gruppo, id, nome, revisione, onErrore }: { gruppo: GruppoDoc; id: number; nome: (f: 'pdf' | 'docx') => string; revisione?: number; onErrore: (t: string) => void }) {
  const [inCorso, setInCorso] = useState<'pdf' | 'docx' | null>(null);
  const vai = async (f: 'pdf' | 'docx') => {
    setInCorso(f);
    try {
      await scarica(gruppo, id, f, nome(f), revisione);
    } catch (e) {
      onErrore(e instanceof Error ? e.message : 'Download non riuscito.');
    } finally {
      setInCorso(null);
    }
  };
  return (
    <>
      {(['docx', 'pdf'] as const).map((f) => (
        <button key={f} type="button" className="btn-ghost" disabled={inCorso !== null} onClick={() => void vai(f)}>
          {inCorso === f ? <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Scarica size={16} aria-hidden />}
          {f === 'docx' ? 'Word' : 'PDF'}
        </button>
      ))}
    </>
  );
}

/** Avanzamento dal vivo della squadra di agenti che scrive il DVR. */
export function Avanzamento({ passi, errore }: { passi: PassoGenerazione[]; errore: string | null }) {
  const pc = percentualePassi(passi);
  return (
    <div className="rounded-[1.25rem] bg-grafite-950 p-4 text-white sm:p-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <Rotore size={18} aria-hidden className="animate-spin text-acido-400 motion-reduce:animate-none" />
        <p className="min-w-0 flex-1 text-[15px] font-medium">La squadra sta scrivendo il DVR</p>
        <span className="cifre text-[14px] text-grafite-300">{pc}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-acido-400 transition-[width] duration-500" style={{ width: `${Math.max(4, pc)}%` }} />
      </div>
      {passi.length > 0 && (
        <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {passi.map((p) => (
            <li key={p.agente} className={clsx('flex items-center gap-2 text-[13px]', p.stato === 'attesa' || p.stato === 'saltato' ? 'text-grafite-400' : 'text-white')}>
              <span
                aria-hidden
                className={clsx('h-2 w-2 shrink-0 rounded-full', p.stato === 'fatto' ? 'bg-acido-400' : p.stato === 'in_corso' ? 'bg-white' : p.stato === 'errore' ? 'bg-[#ef4444]' : 'bg-white/25')}
              />
              <span className="min-w-0 flex-1">{p.etichetta}</span>
              {p.stato === 'in_corso' && <span className="text-[12px] text-grafite-300">in corso</span>}
              {p.stato === 'errore' && <span className="text-[12px] text-[#ffc6ac]">da rifare</span>}
              {p.stato === 'saltato' && <span className="text-[12px] text-grafite-400">non serve</span>}
              {p.stato === 'fatto' && p.secondi != null && <span className="cifre text-[12px] text-grafite-400">{Math.round(p.secondi)} s</span>}
            </li>
          ))}
        </ol>
      )}
      {errore && <p className="mt-3 text-[13px] text-[#ffc6ac]">{errore}</p>}
      <p className="mt-3 text-[12.5px] text-grafite-400">Di solito servono da 4 a 6 minuti. Puoi lasciare la pagina: il lavoro continua.</p>
    </div>
  );
}

/** Scheda di qualità con i difetti da correggere: ogni difetto si porta al Falco. */
export function PannelloQualita({ voce, versione, onChiedi }: { voce: VoceDocumento; versione: number; onChiedi: (t: string) => void }) {
  const [q, setQ] = useState<SchedaQualita | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [carico, setCarico] = useState(true);
  useEffect(() => {
    let vivo = true;
    setCarico(true);
    setErr(null);
    caricaQualita(voce.gruppo, voce.id)
      .then((r) => vivo && setQ(r))
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'Qualità non disponibile.'))
      .finally(() => vivo && setCarico(false));
    return () => {
      vivo = false;
    };
  }, [voce.gruppo, voce.id, versione]);

  if (carico) return <Caricamento testo="Misuro la qualità" />;
  if (err) return <Errore testo={err} />;
  if (!q) return null;
  const liv = livelloQualita(q.punteggio);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <p className="cifre leading-none text-ink">
          <span className="text-[56px] font-light tracking-[-0.04em]">{q.punteggio}</span>
          <span className="ml-1 text-[18px] text-ink-muted">su 100</span>
        </p>
        <div className="flex flex-wrap gap-2 pb-1.5">
          <Chip stato={liv.chip}>{liv.testo}</Chip>
          {q.bloccanti > 0 ? <Chip stato="danger">{q.bloccanti === 1 ? '1 riferimento superato' : `${q.bloccanti} riferimenti superati`}</Chip> : <Chip stato="ok">Nessun riferimento superato</Chip>}
        </div>
      </div>
      {q.riferimenti.filter((r) => r.esito === 'blocca').length > 0 && (
        <div>
          <h3 className="text-[15px] font-medium text-ink">Riferimenti da sostituire prima della firma</h3>
          <ul className="mt-2 space-y-2">
            {q.riferimenti
              .filter((r) => r.esito === 'blocca')
              .map((r, i) => (
                <li key={`${r.voce}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onChiedi(`Nel ${voce.gruppo === 'dvr' ? `DVR ${voce.id}` : `documento ${voce.id}`} c'è un riferimento superato: «${r.trovato}»${r.sostituitoDa ? `, oggi vale ${r.sostituitoDa}` : ''}. Dimmi dove compare e preparami la correzione.`)}
                    className="flex min-h-[52px] w-full items-start gap-3 rounded-[1rem] bg-stato-danger px-4 py-3 text-left text-[14px] text-stato-danger-ink hover:shadow-[inset_0_0_0_1.5px_#d63d3e]"
                  >
                    <Avviso size={17} aria-hidden className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.trovato || r.voce}</span>
                      {r.sostituitoDa && <span className="block text-[13px] opacity-85">Sostituito da {r.sostituitoDa}</span>}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="text-[15px] font-medium text-ink">Difetti da correggere</h3>
        <p className="mt-0.5 text-[13px] text-ink-muted">Tocca un difetto: il Falco spiega perché conta e propone la correzione. Non cambia nulla senza il tuo sì.</p>
        {q.miglioramenti.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-soft">
            <CerchioSpunta size={17} aria-hidden className="text-acido-700" /> Nessun difetto misurabile.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {q.miglioramenti.map((m, i) => (
              <li key={`${m.componente}-${i}`}>
                <button
                  type="button"
                  onClick={() => onChiedi(domandaDifetto(m, voce))}
                  className="flex min-h-[52px] w-full items-start gap-3 rounded-[1rem] px-4 py-3 text-left text-[14px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
                >
                  <span className="min-w-0 flex-1">{m.azione}</span>
                  <span className="cifre shrink-0 text-[12.5px] text-ink-muted">+{m.guadagno}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {q.componenti.length > 0 && (
        <div>
          <h3 className="text-[15px] font-medium text-ink">Come è misurato</h3>
          <ul className="mt-2 space-y-2.5">
            {q.componenti
              .filter((c) => c.punti !== null)
              .map((c) => (
                <li key={c.chiave}>
                  <div className="flex items-baseline gap-2 text-[13.5px]">
                    <span className="min-w-0 flex-1 text-ink-soft">{c.titolo}</span>
                    <span className="cifre text-ink-muted">
                      {Math.round((c.punti ?? 0) * 10) / 10} su {c.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-perla-velo">
                    <div className="h-full rounded-full bg-grafite-900" style={{ width: `${c.max > 0 ? Math.round(((c.punti ?? 0) / c.max) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-ink-muted">Punteggio calcolato dal codice, senza modelli AI{q.modello ? `, sul modello «${q.modello}»` : ''}. Il documento resta da verificare e firmare.</p>
        </div>
      )}
    </div>
  );
}

/** Segnalazioni dei controlli: blocchi, correzioni di libreria e avvisi accettabili con motivo. */
export function Segnalazioni({
  voci,
  puoAccettare,
  onAccetta,
  onChiedi,
}: {
  voci: Segnalazione[];
  puoAccettare: boolean;
  onAccetta?: (chiave: string, motivo: string) => Promise<void>;
  onChiedi: (t: string) => void;
}) {
  const [aperta, setAperta] = useState<Segnalazione | null>(null);
  const [motivo, setMotivo] = useState('');
  const gruppi = raggruppaSegnalazioni(voci);
  if (gruppi.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-ink-soft">
        <CerchioSpunta size={17} aria-hidden className="text-acido-700" /> Nessuna segnalazione aperta: i controlli sono superati.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {gruppi.map((g) => (
        <section key={g.esito}>
          <h3 className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
            <Chip stato={ESITO[g.esito].chip}>{ESITO[g.esito].testo}</Chip>
            <span className="cifre text-ink-muted">{g.voci.length}</span>
          </h3>
          <ul className="mt-2 space-y-2">
            {g.voci.slice(0, 40).map((s) => (
              <li key={s.chiave} className="rounded-[1rem] px-4 py-3 shadow-[inset_0_0_0_1px_#e2e2e5]">
                <p className="text-[14px] leading-snug text-ink">{s.messaggio}</p>
                {(s.dove || s.riferimento) && <p className="mt-1 text-[12.5px] text-ink-muted">{[s.dove, s.riferimento].filter(Boolean).join(' · ')}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" onClick={() => onChiedi(`Segnalazione «${s.messaggio}»${s.dove ? ` (${s.dove})` : ''}: cosa serve per risolverla? Registriamolo insieme.`)}>
                    Risolvi con il Falco
                  </button>
                  {s.accettabile && puoAccettare && onAccetta && (
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]"
                      onClick={() => {
                        setMotivo('');
                        setAperta(s);
                      }}
                    >
                      Accetta con un motivo
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {g.voci.length > 40 && <p className="mt-2 text-[13px] text-ink-muted">Altre {g.voci.length - 40}: chiedile al Falco.</p>}
        </section>
      ))}
      <Foglio
        aperto={aperta !== null}
        titolo="Accetta l'avviso"
        onChiudi={() => setAperta(null)}
        piede={
          <>
            <button type="button" className="btn-ghost" onClick={() => setAperta(null)}>
              Annulla
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!motivoValido(motivo)}
              onClick={() => {
                if (!aperta || !onAccetta) return;
                void onAccetta(aperta.chiave, motivo.trim()).then(() => setAperta(null));
              }}
            >
              Accetta
            </button>
          </>
        }
      >
        <p className="text-[14.5px] text-ink">{aperta?.messaggio}</p>
        <label className="mt-4 block text-[13.5px] font-medium text-ink" htmlFor="motivo-avviso">
          Perché lo accetti
        </label>
        <textarea
          id="motivo-avviso"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          className="mt-1.5 w-full rounded-[1rem] bg-perla-velo px-4 py-3 text-[15px] text-ink outline-none"
          placeholder="Per esempio: il corso è prenotato per il 20/11, prima dell'ingresso in cantiere."
        />
        <p className="mt-1.5 text-[12.5px] text-ink-muted">Il motivo resta nel registro del documento con il tuo nome. Almeno 10 caratteri.</p>
      </Foglio>
    </div>
  );
}
