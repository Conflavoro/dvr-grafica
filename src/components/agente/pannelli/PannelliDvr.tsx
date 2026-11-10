'use client';

import Link from 'next/link';
import { schedaDvr } from '@/lib/portale/rotte-nuove';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Download, FileText, History, ListOrdered, Loader2, Pencil } from '@/components/icone';
import type { DvrRevisionCreateInput, Pannello } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { apiUrl, getToken } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DvrSectionEditor, type SectionDraft } from '@/components/dvr/DvrSectionEditor';
import { AgenteMarkdown } from '../AgenteMarkdown';
import { BTN, BadgeStato, CartaPannello, Vuoto, dataBreve, puoApprovare, puoScrivere, useAzioniPannelli } from './contesto';
import { fetchConTempo } from '@/lib/attesa';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const POLL_MS = 5000;
const IN_CORSO = new Set(['pending', 'running', 'queued', 'in_corso']);

function errMsg(e: unknown, riserva: string): string {
  return e instanceof Error && e.message ? e.message : riserva;
}

function nomeFile(header: string | null, riserva: string): string {
  const m = header ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header) : null;
  if (!m) return riserva;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Download del DVR generato: API reale (JWT) oppure generatore locale in demo. */
async function scaricaDvr(dvrId: number, formato: 'pdf' | 'docx', modo: 'api' | 'local', carica: () => Promise<import('@/lib/data-source').Dvr | null>) {
  if (modo === 'api') {
    const token = getToken();
    const res = await fetchConTempo(apiUrl(`/dvr/${dvrId}/download/${formato}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 404) throw new Error('Il documento non è ancora disponibile.');
    if (!res.ok) throw new Error(`Download non riuscito (${res.status}).`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFile(res.headers.get('Content-Disposition'), `dvr-${dvrId}.${formato}`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const dvr = await carica();
  if (!dvr) throw new Error('DVR non trovato.');
  // Generatore locale pesante (docx/jspdf): caricato solo al primo download in demo.
  const { downloadDvr } = await import('@/lib/dvr-generator');
  await downloadDvr(dvr, formato);
}

// ------------------------------------------------------------------
// Carta di stato del DVR (si aggiorna da sola durante la generazione)
// ------------------------------------------------------------------
export function PannelloDvr({ p }: { p: P<'dvr'> }) {
  const az = useAzioniPannelli();
  const ds = useDataSource();
  const [stato, setStato] = useState<string | null>(p.dati.stato_documento);
  const [gen, setGen] = useState<string | null>(p.dati.generazione);
  const [revisione, setRevisione] = useState<number | null>(p.dati.revisione_corrente);
  const [azienda, setAzienda] = useState<string | null>(null);
  const [errGen, setErrGen] = useState<string | null>(p.dati.errore);
  const [download, setDownload] = useState<'pdf' | 'docx' | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);
  const [approvando, setApprovando] = useState(false);
  const [errApprova, setErrApprova] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivo = useRef(true);

  const aggiorna = useCallback(async () => {
    try {
      const st = await ds.dvr.generationStatus(p.dvr_id);
      if (!vivo.current) return;
      const g = typeof st.generation?.status === 'string' ? (st.generation.status as string) : null;
      setStato(st.dvr_status || null);
      setGen(g);
      setErrGen(typeof st.generation?.error === 'string' ? (st.generation.error as string) : null);
      if (g && IN_CORSO.has(g)) {
        timer.current = setTimeout(() => void aggiorna(), POLL_MS);
        return;
      }
      // Generazione finita (o mai partita): leggo revisione corrente e azienda.
      const [rev, dvr] = await Promise.all([ds.dvr.revisions(p.dvr_id).catch(() => null), ds.dvr.get(p.dvr_id).catch(() => null)]);
      if (!vivo.current) return;
      if (rev?.corrente != null) setRevisione(rev.corrente);
      if (dvr) {
        setAzienda(dvr.azienda || null);
        setStato(dvr.status);
      }
    } catch {
      // Errore transitorio: ritento finche' la generazione risulta in corso.
      if (vivo.current && gen && IN_CORSO.has(gen)) timer.current = setTimeout(() => void aggiorna(), POLL_MS);
    }
  }, [ds, p.dvr_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    vivo.current = true;
    void aggiorna();
    return () => {
      vivo.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [aggiorna]);

  const inCorso = !!gen && IN_CORSO.has(gen);
  const fallita = gen === 'failed';
  const [fermo, setFermo] = useState(false);
  // Stop della generazione: il server smette prima del prossimo passo, il documento in vigore resta.
  const ferma = async () => {
    setFermo(true);
    try {
      const token = getToken();
      await fetchConTempo(apiUrl(`/dvr/${p.dvr_id}/ferma`), { method: 'POST', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      void aggiorna();
    } finally {
      setFermo(false);
    }
  };

  const scarica = async (f: 'pdf' | 'docx') => {
    setDownload(f);
    setErrore(null);
    try {
      await scaricaDvr(p.dvr_id, f, ds.mode, () => ds.dvr.get(p.dvr_id));
    } catch (e) {
      setErrore(errMsg(e, 'Download non riuscito.'));
    } finally {
      setDownload(null);
    }
  };

  const approva = async () => {
    setApprovando(true);
    setErrApprova(null);
    try {
      const d = await ds.dvr.approve(p.dvr_id);
      setStato(d.status || 'approved');
      setConferma(false);
    } catch (e) {
      setErrApprova(errMsg(e, 'Approvazione non riuscita.'));
    } finally {
      setApprovando(false);
    }
  };

  return (
    <CartaPannello
      icona={FileText}
      titolo={`DVR n. ${p.dvr_id}`}
      sottotitolo={azienda}
      azioni={<BadgeStato stato={stato ?? 'draft'} />}
    >
      {inCorso ? (
        <p className="flex items-center gap-2 text-ink" role="status" aria-live="polite">
          <Loader2 size={15} aria-hidden className="animate-spin text-brand-500 motion-reduce:animate-none" />
          <span className="flex-1">Generazione in corso: gli agenti stanno redigendo il documento. Si aggiorna da solo.</span>
          {puoScrivere(az.ruolo) && (
            <button type="button" className={BTN} disabled={fermo} onClick={() => void ferma()}>
              {fermo ? 'Fermo...' : 'Ferma'}
            </button>
          )}
        </p>
      ) : fallita ? (
        <p className="text-warn-ink" role="status">
          {errGen && /fermata/i.test(errGen) ? 'Generazione fermata. Il documento in vigore resta com’era.' : <>La generazione non è riuscita{errGen ? `: ${errGen}` : '.'} Chiedi all&apos;agente di riprovare.</>}
        </p>
      ) : (
        <p role="status">
          {revisione != null ? `Revisione corrente: ${revisione}.` : 'Nessun testo generato.'}{' '}
          {stato === 'review' && 'In attesa di approvazione del titolare.'}
          {stato === 'approved' && 'Documento approvato.'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN} disabled={inCorso || download !== null} onClick={() => void scarica('pdf')}>
          {download === 'pdf' ? <Loader2 size={15} aria-hidden className="animate-spin" /> : <Download size={15} aria-hidden />} Scarica PDF
        </button>
        <button type="button" className={BTN} disabled={inCorso || download !== null} onClick={() => void scarica('docx')}>
          {download === 'docx' ? <Loader2 size={15} aria-hidden className="animate-spin" /> : <Download size={15} aria-hidden />} Scarica Word
        </button>
        <button type="button" className={BTN} disabled={inCorso || az.occupato} onClick={() => az.invia(`Mostrami l'indice del DVR n. ${p.dvr_id}`)}>
          <BookOpen size={15} aria-hidden /> Apri testo
        </button>
        {puoApprovare(az.ruolo) && stato === 'review' && !inCorso && (
          <button type="button" className="btn-primary min-h-[44px] px-3 text-[13px]" onClick={() => setConferma(true)}>
            <CheckCircle2 size={15} aria-hidden /> Approva
          </button>
        )}
        <Link href={schedaDvr(p.dvr_id)} className={BTN}>
          Scheda DVR
        </Link>
      </div>
      {errore && <p role="alert" className="mt-2 text-[12px] text-danger-mark">{errore}</p>}

      <ConfirmDialog
        open={conferma}
        title="Approvare il DVR?"
        message="Confermi di aver verificato il documento? L'approvazione è un atto del titolare."
        confirmLabel="Approva"
        busy={approvando}
        error={errApprova}
        onConfirm={() => void approva()}
        onCancel={() => setConferma(false)}
      />
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Elenco DVR
// ------------------------------------------------------------------
export function PannelloDvrElenco({ p }: { p: P<'dvr_elenco'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={FileText} titolo="DVR" sottotitolo={`${p.dvr.length} documenti`}>
      {p.dvr.length === 0 ? (
        <Vuoto>Nessun DVR.</Vuoto>
      ) : (
        <ul className="-mx-2 max-h-[420px] space-y-0.5 overflow-y-auto">
          {p.dvr.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                disabled={az.occupato}
                onClick={() => az.invia(`Com'è lo stato del DVR n. ${d.id}?`)}
                className="flex min-h-[52px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">
                    DVR n. {d.id}
                    {d.azienda_id != null && az.nomeAzienda(d.azienda_id) ? `, ${az.nomeAzienda(d.azienda_id)}` : ''}
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    {[d.versione != null && `Versione ${d.versione}`, d.revisione_corrente != null && `revisione ${d.revisione_corrente}`, d.generazione && IN_CORSO.has(d.generazione) && 'in generazione']
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </span>
                <BadgeStato stato={d.stato} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Indice del testo
// ------------------------------------------------------------------
export function PannelloIndice({ p }: { p: P<'indice'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={ListOrdered} titolo={`Indice del DVR n. ${p.dvr_id}`} sottotitolo={p.revisione != null ? `Revisione ${p.revisione}` : null}>
      {p.indice.length === 0 ? (
        <Vuoto>Il DVR non ha ancora un testo.</Vuoto>
      ) : (
        <ol className="-mx-2 max-h-[460px] overflow-y-auto">
          {p.indice.map((s) => (
            <li key={s.sezione}>
              <button
                type="button"
                disabled={az.occupato}
                onClick={() => az.invia(`Mostrami la sezione ${s.sezione} del DVR n. ${p.dvr_id}`)}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-60"
              >
                <span className="w-8 shrink-0 text-[12px] font-semibold uppercase tabular-nums text-ink-muted">{s.sezione}</span>
                <span className="min-w-0 flex-1 truncate">{s.titolo || `Sezione ${s.sezione}`}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${s.scritta_da === 'RSPP' ? 'bg-ok text-ok-ink' : 'bg-brand-50 text-brand-700'}`}>
                  {s.scritta_da}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Testo di una sezione, modificabile come revisione
// ------------------------------------------------------------------
export function PannelloSezione({ p }: { p: P<'sezione'> }) {
  const az = useAzioniPannelli();
  const ds = useDataSource();
  const originale: SectionDraft = { title: p.sezione.titolo, body: p.sezione.testo };
  const [testo, setTesto] = useState<SectionDraft>(originale);
  const [bozza, setBozza] = useState<SectionDraft | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvata, setSalvata] = useState<number | null>(null);
  const [tutto, setTutto] = useState(false);
  const lungo = testo.body.length > 1600;

  const salva = async () => {
    if (!bozza) return;
    const modifica: DvrRevisionCreateInput['modifiche'][number] = { key: p.sezione.chiave };
    if (bozza.body !== testo.body) modifica.body = bozza.body;
    if (bozza.title.trim() && bozza.title !== testo.title) modifica.title = bozza.title;
    if (modifica.body === undefined && modifica.title === undefined) {
      setBozza(null);
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      const rev = await ds.dvr.createRevision(p.dvr_id, { modifiche: [modifica], motivo: motivo.trim() || undefined });
      setTesto({ title: modifica.title ?? testo.title, body: modifica.body ?? testo.body });
      setSalvata(rev.numero);
      setBozza(null);
      setMotivo('');
    } catch (e) {
      setErrore(errMsg(e, 'Salvataggio non riuscito.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <CartaPannello
      icona={FileText}
      titolo={testo.title || `Sezione ${p.sezione.chiave}`}
      sottotitolo={`DVR n. ${p.dvr_id}, sezione ${p.sezione.chiave}${p.revisione != null ? `, revisione ${p.revisione}` : ''}`}
      azioni={
        puoScrivere(az.ruolo) && !bozza ? (
          <button type="button" className="btn-ghost min-h-[40px] shrink-0 px-2.5 text-[12.5px]" onClick={() => { setSalvata(null); setBozza(testo); }}>
            <Pencil size={14} aria-hidden /> Modifica
          </button>
        ) : undefined
      }
    >
      {salvata != null && (
        <p role="status" className="mb-2 rounded-lg bg-ok px-3 py-2 text-[12.5px] text-ok-ink">
          Salvata come revisione {salvata}.
        </p>
      )}
      {bozza ? (
        <>
          <DvrSectionEditor
            sectionKey={p.sezione.chiave}
            draft={bozza}
            original={testo}
            onChange={setBozza}
            onDiscard={() => setBozza(testo)}
            onClose={() => setBozza(null)}
            disabled={salvando}
          />
          <label className="mt-3 block">
            <span className="label-upper">Motivo della modifica (facoltativo)</span>
            <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className="input-field mt-1" placeholder="Esempio: corretti i nominativi degli addetti" />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary min-h-[44px] px-3 text-[13px]" disabled={salvando} onClick={() => void salva()}>
              {salvando && <Loader2 size={14} aria-hidden className="animate-spin" />} Salva revisione
            </button>
            {errore && <span role="alert" className="text-[12px] text-danger-mark">{errore}</span>}
          </div>
        </>
      ) : (
        <>
          <div className={lungo && !tutto ? 'max-h-[380px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_80%,transparent)]' : ''}>
            {testo.body.trim() ? <AgenteMarkdown testo={testo.body} /> : <Vuoto>Sezione vuota.</Vuoto>}
          </div>
          {lungo && (
            <button type="button" onClick={() => setTutto((v) => !v)} aria-expanded={tutto} className="mt-2 min-h-[32px] text-[12px] font-medium text-brand-700 hover:underline">
              {tutto ? 'Riduci' : 'Mostra tutta la sezione'}
            </button>
          )}
        </>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Storico revisioni
// ------------------------------------------------------------------
export function PannelloRevisioni({ p }: { p: P<'revisioni'> }) {
  return (
    <CartaPannello icona={History} titolo="Storico revisioni" sottotitolo={`DVR n. ${p.dvr_id}`}>
      {p.revisioni.length === 0 ? (
        <Vuoto>Nessuna revisione.</Vuoto>
      ) : (
        <ol className="max-h-[440px] space-y-3 overflow-y-auto border-l-2 border-brand-100 pl-4">
          {p.revisioni.map((r) => (
            <li key={r.numero} className="relative">
              <span aria-hidden className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ${r.redazione.startsWith('RSPP') ? 'bg-ok-mark' : 'bg-brand-500'}`} />
              <p className="font-medium text-ink">
                Revisione {r.numero} <span className="font-normal text-ink-muted">· {r.redazione}</span>
              </p>
              <p className="text-[11.5px] text-ink-muted">
                {dataBreve(r.data)}
                {r.sezioni_modificate.length > 0 && `, sezioni ${r.sezioni_modificate.join(', ')}`}
              </p>
              {r.motivo && <p className="mt-0.5 text-[12.5px]">{r.motivo}</p>}
            </li>
          ))}
        </ol>
      )}
    </CartaPannello>
  );
}
