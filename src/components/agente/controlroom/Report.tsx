'use client';

import { useEffect, useState } from 'react';
import { Download, ChevronLeft, ChevronRight } from '@/components/icone';
import type { ReportDati } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { AREA, Caricamento, Errore, Vuota } from '../spazio/kit';
import { Contatore, DISCLAIMER_AI_CR, LINK_CR, LIVELLO, Titoletto, daConsulente, dataCr, meseCorrente, nomeMese, testoErrore, useDato, type SchedaControlRoomProps } from './kit';

export const ATTIVITA: Record<string, string> = {
  dvr_generati: 'DVR generati',
  dvr_approvati: 'DVR approvati',
  dvr_revisioni_ai: 'Revisioni AI del DVR',
  dvr_revisioni_umane: 'Revisioni del consulente',
  rilievi_sopralluogo: 'Rilievi di sopralluogo',
  documenti_caricati: 'Documenti caricati',
  attestati_registrati: 'Attestati registrati',
  idoneita_registrate: 'Idoneità registrate',
  consegne_dpi: 'Consegne di DPI',
  pos_emessi: 'POS emessi',
  scadenze_chiuse: 'Scadenze chiuse',
  ispezioni: 'Ispezioni',
  richieste_assistenza: 'Richieste di assistenza',
};

const sposta = (m: string, d: number) => {
  const [a, mm] = m.split('-').map(Number);
  const x = new Date(a, mm - 1 + d, 15);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};

/** Andamento del punteggio sugli ultimi 6 mesi, barre in SVG. */
export function Andamento({ dati, altezza = 92 }: { dati: ReportDati['andamento']; altezza?: number }) {
  const w = 300;
  const base = altezza - 18;
  const passo = w / Math.max(1, dati.length);
  const larg = Math.min(28, passo * 0.55);
  const testo = dati.map((d) => `${nomeMese(d.mese, true)} ${d.totale ?? 'senza dato'}`).join(', ');
  return (
    <svg viewBox={`0 0 ${w} ${altezza}`} width="100%" height={altezza} role="img" aria-label={`Andamento del Safety Score: ${testo}`} className="block">
      <line x1={0} x2={w} y1={base} y2={base} stroke="#e2e2e5" />
      {[50, 85].map((s) => (
        <line key={s} x1={0} x2={w} y1={base - (s / 100) * (base - 14)} y2={base - (s / 100) * (base - 14)} stroke="#f4f4f5" strokeDasharray="2 3" />
      ))}
      {dati.map((d, i) => {
        const x = i * passo + (passo - larg) / 2;
        const h = d.totale == null ? 0 : Math.max(2, (d.totale / 100) * (base - 14));
        const ultimo = i === dati.length - 1;
        const colore = d.totale == null ? '#e2e2e5' : ultimo ? LIVELLO[d.totale >= 85 ? 'buono' : d.totale >= 65 ? 'discreto' : d.totale >= 40 ? 'critico' : 'grave'].colore : '#c4c4c9';
        return (
          <g key={d.mese}>
            {d.totale == null ? (
              <line x1={x + larg / 2} x2={x + larg / 2} y1={base - 1} y2={base - 6} stroke="#e2e2e5" strokeWidth={1.5} strokeLinecap="round" />
            ) : (
              <rect x={x} y={base - h} width={larg} height={h} rx={4} fill={colore} />
            )}
            {d.totale != null && (
              <text x={x + larg / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fontFamily="Geist Mono, ui-monospace, monospace" fill="#232326">
                {d.totale}
              </text>
            )}
            <text x={x + larg / 2} y={altezza - 4} textAnchor="middle" fontSize={10} fill={ultimo ? '#18181b' : '#6b6b73'} fontWeight={ultimo ? 600 : 400}>
              {nomeMese(d.mese, true)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ElencoAttivita({ attivita }: { attivita: Record<string, number> }) {
  const voci = Object.entries(attivita).filter(([, n]) => n > 0);
  if (voci.length === 0) return <Vuota>Nessuna attività registrata nel mese.</Vuota>;
  return (
    <ul className="grid grid-cols-2 gap-x-4">
      {voci.map(([k, n]) => (
        <li key={k} className="flex items-baseline justify-between gap-2 border-b border-perla-linea py-1.5">
          <span className="min-w-0 truncate text-[12.5px] text-ink-soft">{ATTIVITA[k] ?? k.replace(/_/g, ' ')}</span>
          <span className="cifre text-[12.5px] font-semibold text-brand-900">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Report mensile: mese, contatori, andamento, attività, priorità e osservazioni. */
export function Report({ aziendaId, ruolo, versione, chiedi, occupato, nomeAgente = 'Falco' }: SchedaControlRoomProps & { nomeAgente?: string }) {
  const ds = useDataSource();
  const corrente = meseCorrente();
  const [mese, setMese] = useState(corrente);
  const r = useDato(() => ds.controlRoom.report(aziendaId, mese), [ds, aziendaId, versione, mese]);
  const [testo, setTesto] = useState('');
  const [modifica, setModifica] = useState(false);
  const [lavoro, setLavoro] = useState<null | 'salvo' | 'pdf' | 'scarico'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  const scrive = daConsulente(ruolo);

  useEffect(() => {
    setTesto(r.dato?.osservazioni ?? '');
    setModifica(false);
  }, [r.dato?.osservazioni, mese]);

  const esegui = async (tipo: 'salvo' | 'pdf' | 'scarico', f: () => Promise<unknown>, ok: string) => {
    setLavoro(tipo);
    setErr(null);
    setFatto(null);
    try {
      const v = await f();
      if (v && typeof v === 'object' && 'dati' in (v as object)) r.setDato(v as NonNullable<typeof r.dato>);
      setFatto(ok);
    } catch (e) {
      setErr(testoErrore(e, 'Operazione non riuscita.'));
    } finally {
      setLavoro(null);
    }
  };

  const mesi = Array.from({ length: 12 }, (_, i) => sposta(corrente, -i));

  return (
    <div className="space-y-1 py-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setMese(sposta(mese, -1))} aria-label="Mese precedente" className="btn-icon h-11 w-11">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Mese del report</span>
          <select value={mese} onChange={(e) => setMese(e.target.value)} className="h-11 w-full rounded-[0.875rem] border border-[#e2e2e5] bg-perla-carta px-3 text-center text-base font-semibold capitalize text-brand-900 sm:text-[14px]">
            {(mesi.includes(mese) ? mesi : [mese, ...mesi]).map((m) => (
              <option key={m} value={m}>
                {nomeMese(m)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setMese(sposta(mese, 1))} disabled={mese >= corrente} aria-label="Mese successivo" className="btn-icon h-11 w-11 disabled:opacity-40">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      {r.inCorso && !r.dato ? (
        <Caricamento testo="Preparo il report" />
      ) : r.errore ? (
        <Errore testo={r.errore} onRiprova={r.ricarica} />
      ) : r.dato ? (
        (() => {
          const d = r.dato.dati;
          const a = d.attivita;
          return (
            <>
              <div className="grid grid-cols-4 gap-1.5 pt-2">
                <Contatore n={d.safety_score?.totale ?? 0} etichetta={d.safety_score?.totale == null ? 'Score nd' : 'Safety Score'} />
                <Contatore n={d.criticita_aperte.length} etichetta="Criticità aperte" allerta />
                <Contatore n={d.visite_svolte} etichetta="Visite svolte" />
                <Contatore n={(a.attestati_registrati ?? 0) + (a.consegne_dpi ?? 0)} etichetta="Attestati e DPI" />
              </div>

              <Titoletto>Andamento ultimi 6 mesi</Titoletto>
              <Andamento dati={d.andamento} />

              <Titoletto>Attività svolte</Titoletto>
              <ElencoAttivita attivita={a} />
              {d.corsi_erogati.length > 0 && (
                <p className="mt-1.5 text-[12px] text-ink-muted">Corsi: {d.corsi_erogati.map((c) => `${c.corso} (${c.attestati})`).join('; ')}</p>
              )}

              <Titoletto>Priorità di {nomeMese(d.priorita_mese_successivo.mese).split(' ')[0] || 'prossimo mese'}</Titoletto>
              {d.priorita_mese_successivo.scadenze.length === 0 && d.priorita_mese_successivo.criticita.length === 0 ? (
                <Vuota>Nessuna priorità segnalata per il mese successivo.</Vuota>
              ) : (
                <ul className="space-y-1">
                  {d.priorita_mese_successivo.criticita.map((c) => (
                    <li key={c} className="text-[12.5px] leading-relaxed text-ink-soft">{c}</li>
                  ))}
                  {d.priorita_mese_successivo.scadenze.map((s, i) => (
                    <li key={`${s.titolo}-${i}`} className="flex gap-2 text-[12.5px]">
                      <span className={clsx('cifre w-[52px] shrink-0 text-right', s.scaduta ? 'text-danger-ink' : 'text-brand-900')}>{dataCr(s.data).replace(/ \d{4}$/, '')}</span>
                      <span className="min-w-0 text-ink-soft">{s.titolo}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Titoletto
                azione={
                  scrive && !modifica ? (
                    <button type="button" onClick={() => setModifica(true)} className={clsx(LINK_CR, '-mr-2 text-[12.5px]')}>
                      {r.dato.osservazioni ? 'Modifica' : 'Scrivi'}
                    </button>
                  ) : undefined
                }
              >
                Osservazioni del referente
              </Titoletto>
              {modifica ? (
                <div className="space-y-2">
                  <label htmlFor="rep-oss" className="sr-only">
                    Osservazioni del referente
                  </label>
                  <textarea id="rep-oss" className={AREA} rows={5} value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={5000} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={lavoro !== null}
                      onClick={() => void esegui('salvo', () => ds.controlRoom.salvaOsservazioni(aziendaId, mese, testo, false), 'Osservazioni salvate. Rigenera il PDF per includerle.')}
                      className="btn-primary min-h-[44px] flex-1"
                    >
                      {lavoro === 'salvo' ? 'Salvo' : 'Salva le osservazioni'}
                    </button>
                    <button type="button" onClick={() => { setModifica(false); setTesto(r.dato?.osservazioni ?? ''); }} className="btn-ghost min-h-[44px]">
                      Annulla
                    </button>
                  </div>
                </div>
              ) : r.dato.osservazioni ? (
                <>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{r.dato.osservazioni}</p>
                  {r.dato.osservazioni_ai && <p className="mt-1 text-[11.5px] text-ink-subtle">{DISCLAIMER_AI_CR}</p>}
                </>
              ) : (
                <Vuota>{scrive ? 'Nessuna osservazione per questo mese.' : 'Il referente non ha ancora scritto osservazioni.'}</Vuota>
              )}
              {scrive && !modifica && (
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() => chiedi(`Prepara una bozza delle osservazioni del referente per il report di ${nomeMese(mese)} di questa azienda, partendo da criticità aperte e attività svolte. Salvala come bozza AI nel report.`)}
                  className={clsx(LINK_CR, '-ml-2')}
                >
                  Chiedi a {nomeAgente} una bozza
                </button>
              )}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-perla-linea pt-3">
                {scrive && (
                  <button
                    type="button"
                    disabled={lavoro !== null}
                    onClick={() => void esegui('pdf', () => ds.controlRoom.reportPdf(aziendaId, mese), 'PDF pronto.')}
                    className="btn-primary min-h-[44px] flex-1"
                  >
                    {lavoro === 'pdf' ? 'Genero il PDF' : r.dato.pdf_disponibile ? 'Rigenera PDF' : 'Genera PDF'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={lavoro !== null || !r.dato.pdf_disponibile}
                  onClick={() => void esegui('scarico', () => ds.controlRoom.scaricaReportPdf(aziendaId, mese), 'Download avviato.')}
                  className="btn-ghost min-h-[44px] flex-1 disabled:opacity-50"
                  title={r.dato.pdf_disponibile ? undefined : 'Il PDF di questo mese non è ancora stato generato'}
                >
                  <Download size={15} aria-hidden /> Scarica PDF
                </button>
              </div>
              <div aria-live="polite">
                {err && <Errore testo={err} />}
                {fatto && <p className="text-[12px] text-ok-ink">{fatto}</p>}
              </div>
              {!r.dato.pdf_disponibile && !scrive && <p className="text-[12px] text-ink-muted">Il PDF del mese lo prepara il tuo consulente.</p>}
              {d.safety_score?.al && <p className="text-[11.5px] text-ink-subtle">Situazione al {dataCr(d.safety_score.al)}.</p>}
            </>
          );
        })()
      ) : null}
    </div>
  );
}
