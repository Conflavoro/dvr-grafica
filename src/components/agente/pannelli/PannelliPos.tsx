'use client';

import { useState } from 'react';
import { Download, FileText, HardHat, Novita, ScudoAllerta } from '@/components/icone';
import type { Pannello, PannelloSegnalazione } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clsx } from '@/lib/clsx';
import { BTN, CartaPannello, Vuoto, dataBreve, puoScrivere, useAzioniPannelli } from './contesto';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const errMsg = (e: unknown, r: string) => (e instanceof Error && e.message ? e.message : r);

// ------------------------------------------------------------------
// Novita normative
// ------------------------------------------------------------------
function Rilevanza({ v }: { v: number | null }) {
  if (v == null) return null;
  const livello = v >= 70 ? 'alta' : v >= 40 ? 'media' : 'bassa';
  return (
    <span
      className={clsx(
        'cifre inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        livello === 'alta' ? 'bg-oro-100 text-oro-700' : livello === 'media' ? 'bg-brand-50 text-brand-700' : 'bg-perla-velo text-ink-muted'
      )}
      title={`Rilevanza ${v} su 100`}
    >
      <span aria-hidden className="flex h-1.5 w-8 overflow-hidden rounded-full bg-black/[0.06]">
        <span className={clsx('h-full rounded-full', livello === 'alta' ? 'bg-oro-500' : livello === 'media' ? 'bg-brand-500' : 'bg-brand-300')} style={{ width: `${v}%` }} />
      </span>
      {v}
    </span>
  );
}

export function PannelloNovitaVista({ p }: { p: P<'novita'> }) {
  const sotto = [p.argomento && `su ${p.argomento}`, p.giorni != null && `ultimi ${p.giorni} giorni`].filter(Boolean).join(', ');
  return (
    <CartaPannello icona={Novita} titolo="Novità normative" sottotitolo={sotto || `${p.novita.length} aggiornamenti`}>
      {p.novita.length === 0 ? (
        <Vuoto>Nessuna novità pertinente nel periodo.</Vuoto>
      ) : (
        <ol className="space-y-3">
          {p.novita.map((n, i) => (
            <li key={`${n.titolo}-${i}`} className="rounded-[0.875rem] bg-perla-superficie px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
                <span className="font-semibold text-brand-800">{n.fonte}</span>
                {n.data && <span className="cifre">{dataBreve(n.data)}</span>}
                {n.tipo && <span>{n.tipo}</span>}
                <span className="ml-auto">
                  <Rilevanza v={n.rilevanza} />
                </span>
              </p>
              <p className="mt-1 text-[13.5px] font-semibold leading-snug text-ink">{n.titolo}</p>
              {n.sintesi && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{n.sintesi}</p>}
              {n.url && (
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex min-h-[36px] items-center text-[12.5px] font-semibold text-brand-700 underline-offset-2 hover:underline">
                  Leggi alla fonte
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11.5px] text-ink-subtle">Sintesi preparate con assistenza AI dalle fonti ufficiali: per citare, verifica il testo alla fonte.</p>
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Cantiere
// ------------------------------------------------------------------
const STATO_POS: Record<string, { l: string; cls: string }> = {
  bozza: { l: 'Bozza', cls: 'bg-grafite-100 text-grafite-700' },
  pronto: { l: 'Pronto da emettere', cls: 'bg-oro-100 text-oro-700' },
  emesso: { l: 'Emesso', cls: 'bg-ok text-ok-ink' },
};

export function BadgePos({ stato }: { stato: string | null }) {
  const s = (stato && STATO_POS[stato]) || { l: stato || 'Senza stato', cls: 'bg-grafite-100 text-grafite-700' };
  return <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', s.cls)}>{s.l}</span>;
}

export function PannelloCantiereVista({ p }: { p: P<'cantiere'> }) {
  const az = useAzioniPannelli();
  const c = p.cantiere;
  const periodo = [c.data_inizio && `dal ${dataBreve(c.data_inizio)}`, c.data_fine && `al ${dataBreve(c.data_fine)}`].filter(Boolean).join(' ');
  return (
    <CartaPannello icona={HardHat} titolo={c.denominazione} sottotitolo={c.indirizzo || null}>
      <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        {c.impresa && (
          <>
            <dt className="text-ink-muted">Impresa</dt>
            <dd className="text-ink">{c.impresa}</dd>
          </>
        )}
        {c.committente && (
          <>
            <dt className="text-ink-muted">Committente</dt>
            <dd className="text-ink">{c.committente}</dd>
          </>
        )}
        {periodo && (
          <>
            <dt className="text-ink-muted">Lavori</dt>
            <dd className="text-ink">{periodo}</dd>
          </>
        )}
        {c.subappalti > 0 && (
          <>
            <dt className="text-ink-muted">Subappalti</dt>
            <dd className="cifre text-ink">{c.subappalti}</dd>
          </>
        )}
      </dl>
      <div className="mt-3">
        <p className="mb-1 text-[12px] font-semibold text-ink-muted">POS del cantiere</p>
        {c.pos.length === 0 ? (
          <Vuoto>Ancora nessun POS.</Vuoto>
        ) : (
          <ul className="space-y-1">
            {c.pos.map((x) => (
              <li key={x.pos_id} className="flex min-h-[40px] items-center gap-2 rounded-[0.875rem] bg-perla-superficie px-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]">
                <span className="cifre text-[12.5px] font-medium text-ink">POS {x.pos_id}</span>
                {x.revisione != null && <span className="cifre text-[11.5px] text-ink-muted">rev. {x.revisione}</span>}
                <span className="ml-auto">
                  <BadgePos stato={x.stato} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {puoScrivere(az.ruolo) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={az.occupato} onClick={() => az.invia(`Prepara il POS per il cantiere ${c.denominazione} (cantiere n. ${p.cantiere_id})`)} className={BTN}>
            <FileText size={15} aria-hidden /> {c.pos.length ? 'Nuovo POS' : 'Prepara il POS'}
          </button>
        </div>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// POS
// ------------------------------------------------------------------
export function PannelloPosVista({ p }: { p: P<'pos'> }) {
  const az = useAzioniPannelli();
  const ds = useDataSource();
  const [chiedi, setChiedi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scarico, setScarico] = useState<'pdf' | 'docx' | null>(null);
  const blocca = p.conteggi.blocca ?? 0;
  const corregge = p.conteggi.corregge ?? 0;
  const avvisa = p.conteggi.avvisa ?? 0;
  const conControllo = blocca + corregge + avvisa > 0 || p.puo_emettere != null;

  const scarica = async (f: 'pdf' | 'docx') => {
    setScarico(f);
    setErr(null);
    try {
      await ds.pos.download(p.pos_id, f);
    } catch (e) {
      setErr(errMsg(e, 'Download non riuscito.'));
    } finally {
      setScarico(null);
    }
  };

  return (
    <CartaPannello
      icona={FileText}
      titolo={`POS n. ${p.pos_id}`}
      sottotitolo={p.revisione != null ? `Revisione ${p.revisione}` : 'Non ancora emesso'}
      azioni={<BadgePos stato={p.stato} />}
    >
      {conControllo && (
        <ul className="mb-3 grid grid-cols-3 gap-1.5 text-center" aria-label="Esito dei controlli">
          {(
            [
              ['Bloccano', blocca, 'text-danger-ink bg-danger'],
              ['Da correggere', corregge, 'text-warn-ink bg-warn'],
              ['Avvisi', avvisa, 'text-ink-soft bg-perla-velo'],
            ] as const
          ).map(([l, n, cls]) => (
            <li key={l} className={clsx('rounded-[0.875rem] px-2 py-2', cls)}>
              <span className="cifre block text-[18px] font-medium leading-none">{n}</span>
              <span className="mt-1 block text-[11px] font-semibold">{l}</span>
            </li>
          ))}
        </ul>
      )}
      {p.fasi.length > 0 && (
        <p className="mb-2 text-[12.5px] text-ink-muted">
          Fasi: <span className="cifre text-ink-soft">{p.fasi.join(', ')}</span>
        </p>
      )}
      {(p.prossimo_passo || p.nota) && <p className="mb-2 text-[13px] text-ink-soft">{p.nota ?? `Prossimo passo: ${p.prossimo_passo}`}</p>}
      {err && <p className="mb-2 text-[12.5px] text-warn-ink">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {p.stato === 'emesso' && (
          <>
            <button type="button" onClick={() => void scarica('pdf')} disabled={scarico !== null} className={BTN}>
              <Download size={15} aria-hidden /> {scarico === 'pdf' ? 'Scarico' : 'PDF'}
            </button>
            <button type="button" onClick={() => void scarica('docx')} disabled={scarico !== null} className={BTN}>
              <Download size={15} aria-hidden /> {scarico === 'docx' ? 'Scarico' : 'Word'}
            </button>
          </>
        )}
        {puoScrivere(az.ruolo) && p.stato !== 'emesso' && (
          <button type="button" disabled={az.occupato} onClick={() => az.invia(`Controlla il POS n. ${p.pos_id}`)} className={BTN}>
            <ScudoAllerta size={15} aria-hidden /> Controlla
          </button>
        )}
        {puoScrivere(az.ruolo) && p.stato === 'pronto' && (
          <button type="button" disabled={az.occupato} onClick={() => setChiedi(true)} className="btn-primary premi min-h-[44px] px-3.5 text-[13px]">
            Emetti il POS
          </button>
        )}
      </div>
      <ConfirmDialog
        open={chiedi}
        title="Emettere il POS?"
        message="L'emissione crea una nuova revisione con Word e PDF. Il POS va poi firmato dal datore di lavoro e messo a disposizione del RLS."
        confirmLabel="Chiedi l'emissione"
        onConfirm={() => {
          setChiedi(false);
          az.invia(`Emetti il POS n. ${p.pos_id}: confermo l'emissione.`);
        }}
        onCancel={() => setChiedi(false)}
      />
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Segnalazioni dei controlli
// ------------------------------------------------------------------
const ESITO: Record<PannelloSegnalazione['esito'], { l: string; riga: string; badge: string }> = {
  blocca: { l: 'Blocca', riga: 'bg-danger/70 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.18)]', badge: 'bg-danger-mark text-white' },
  corregge: { l: 'Da correggere', riga: 'bg-warn/70 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]', badge: 'bg-warn-mark text-white' },
  avvisa: { l: 'Avviso', riga: 'bg-perla-superficie shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]', badge: 'bg-grafite-500 text-white' },
};

export function PannelloSegnalazioniVista({ p }: { p: P<'segnalazioni'> }) {
  const aperte = p.segnalazioni.filter((s) => !s.accettata);
  return (
    <CartaPannello
      icona={ScudoAllerta}
      titolo="Controlli del POS"
      sottotitolo={aperte.length === 0 ? 'Nessuna segnalazione aperta' : `${aperte.length} da risolvere su ${p.segnalazioni.length}`}
    >
      {p.segnalazioni.length === 0 ? (
        <Vuoto>Nessuna segnalazione: il POS supera i controlli.</Vuoto>
      ) : (
        <ul className="max-h-[460px] space-y-1.5 overflow-y-auto">
          {p.segnalazioni.map((s, i) => {
            const e = ESITO[s.esito];
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
      )}
    </CartaPannello>
  );
}
