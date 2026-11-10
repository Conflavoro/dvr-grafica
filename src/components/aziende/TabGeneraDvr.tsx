'use client';

import Link from 'next/link';
import { schedaDvr } from '@/lib/portale/rotte-nuove';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getDataSource,
  calcolaLivelloRischio,
  type Company,
  type CompanyDocument,
  type DvrPayload,
  type RischioValutato,
} from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { FileText, Loader2, Trash2, CheckCircle2, ArrowRight, FolderOpen } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

type RigaRischio = { id: string; categoria: string; pericolo: string; p: 1 | 2 | 3 | 4; g: 1 | 2 | 3 | 4; fonte_norma: string; misure_tecniche: string; misure_organizzative: string };

/**
 * Flusso GENERA DVR a SELEZIONE (D.Lgs. 81/08 art. 28):
 *  1) il consulente SPUNTA il materiale dell'archivio da usare;
 *  2) "Genera matrice rischi" -> l'AI propone la matrice P×G dal materiale selezionato;
 *  3) revisiona/edita la matrice (P/G, elimina righe);
 *  4) "Genera DVR" -> crea e genera il documento usando SOLO il materiale selezionato.
 * Mai auto-approvato: firma umana obbligatoria.
 */
export function TabGeneraDvr({ company }: { company: Company }) {
  const { user } = useAuth();
  const editable = can(user?.role, 'dvr', 'create');

  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'select' | 'matrix'>('select');
  const [rischi, setRischi] = useState<RigaRischio[]>([]);
  const [busy, setBusy] = useState<null | 'matrice' | 'dvr'>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newDvrId, setNewDvrId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDataSource()
      .companyDocuments.list(company.id)
      .then((d) => {
        if (cancelled) return;
        setDocs(d);
        // Default: selezionato SOLO il materiale con analisi. Prima veniva
        // pre-selezionato tutto, inclusi video/audio senza analisi: il
        // consulente generava il DVR convinto che il sopralluogo fosse dentro,
        // mentre il backend scartava in silenzio il materiale vuoto.
        setSelected(new Set(d.filter((x) => (x.testo_analisi ?? '').trim() !== '').map((x) => x.id)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const generaMatrice = async () => {
    setBusy('matrice');
    setMsg(null);
    try {
      const ds = getDataSource();
      // Mansioni reali dell'azienda (per rischi per-mansione).
      let mansioni: string | undefined;
      try {
        const lav = await ds.lavoratori.list({ companyId: company.id });
        const uniche = Array.from(new Set(lav.filter((l) => l.mansione).map((l) => l.mansione.trim())));
        if (uniche.length) mansioni = uniche.join(', ');
      } catch {
        /* best-effort */
      }
      const res = await ds.ai.risks({ companyId: company.id, mansioni, documentIds: Array.from(selected) });
      if (res.errore && res.rischi.length === 0) {
        setMsg(res.errore);
        return;
      }
      if (res.rischi.length === 0) {
        setMsg('L\'AI non ha proposto rischi dal materiale selezionato. Aggiungi materiale o riprova.');
        return;
      }
      setRischi(
        res.rischi.map((r, i) => ({
          id: `r-${i}`,
          categoria: r.categoria,
          pericolo: r.pericolo,
          p: r.probabilita,
          g: r.gravita,
          fonte_norma: r.fonte_norma,
          misure_tecniche: r.misure_tecniche,
          misure_organizzative: r.misure_organizzative,
        }))
      );
      setStep('matrix');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Generazione matrice non riuscita.');
    } finally {
      setBusy(null);
    }
  };

  const updateRiga = (id: string, field: 'p' | 'g', value: number) =>
    setRischi((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value as 1 | 2 | 3 | 4 } : r)));
  const removeRiga = (id: string) => setRischi((rs) => rs.filter((r) => r.id !== id));

  const generaDvr = useCallback(async () => {
    setBusy('dvr');
    setMsg(null);
    try {
      const ds = getDataSource();
      const matrice: RischioValutato[] = rischi.map((r) => ({
        pericolo: r.pericolo || r.categoria,
        probabilita: r.p,
        gravita: r.g,
        livello: calcolaLivelloRischio(r.p, r.g),
        fonte_norma: r.fonte_norma,
      }));
      const mt = rischi.map((r) => r.misure_tecniche).filter(Boolean).join('\n');
      const mo = rischi.map((r) => r.misure_organizzative).filter(Boolean).join('\n');
      const sede = company.sedi[0];
      const payload: DvrPayload = {
        sezione_a: {
          ragione_sociale: company.ragione_sociale,
          partita_iva: company.partita_iva,
          ateco: company.ateco,
          sede_legale: sede ? `${sede.indirizzo}, ${sede.cap} ${sede.comune} (${sede.provincia})` : '',
          lavoratori_totali: company.lavoratori,
          dimensione: company.dimensione,
          data_redazione: new Date().toISOString().slice(0, 10),
        },
        sezione_b: { datore_lavoro: '', rspp: '' },
        sezione_c: { descrizione_attivita: '', reparti: [], fasi_lavorative: [], attrezzature_principali: [] },
        sezione_d: { pericoli_identificati: rischi.map((r) => r.categoria) },
        sezione_e: { matrice_rischi: matrice },
        sezione_f: { misure_tecniche: mt, misure_organizzative: mo, dpi_assegnati: '', formazione: '' },
        sezione_g: { interventi_pianificati: [] },
        sezione_i: { allegati: [] },
      };
      // Materiale selezionato propagato alla generazione (il Crew usa SOLO questo).
      const payloadConSel = { ...payload, selected_document_ids: Array.from(selected) } as DvrPayload;

      const livelli = matrice.map((m) => m.livello);
      const rischioMax = livelli.includes('molto_alto') ? 'molto_alto' : livelli.includes('alto') ? 'alto' : livelli.includes('medio') ? 'medio' : 'basso';

      const dvr = await ds.dvr.create({
        company_id: company.id,
        azienda: company.ragione_sociale,
        status: 'draft',
        payload: payloadConSel,
        rischio_max: rischioMax,
        data_approvazione: null,
      });
      setNewDvrId(dvr.id);
      setMsg('DVR creato. Avvio della generazione AI in corso (può richiedere alcuni minuti)…');
      // Avvia la generazione (il Crew compone le 27 sezioni dal materiale + matrice).
      void ds.dvr.generate(dvr.id).catch(() => {});
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Creazione DVR non riuscita.');
    } finally {
      setBusy(null);
    }
  }, [rischi, selected, company]);

  if (!editable) {
    return <div className="card-luxury p-8 text-center text-ink-muted">La generazione del DVR è a cura del consulente RSPP.</div>;
  }

  if (newDvrId) {
    return (
      <div className="card-luxury p-8 text-center">
        <CheckCircle2 size={36} className="mx-auto mb-3 text-ok-mark" />
        <h3 className="section-title text-[17px]">DVR avviato</h3>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-ink-soft">
          Il DVR di {company.ragione_sociale} è in generazione dal materiale selezionato e dalla matrice rivista. Sarà pronto a breve nello stato bozza (firma RSPP obbligatoria).
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={schedaDvr(newDvrId)} className="btn-primary">Apri il DVR</Link>
          <Link href="/gestionale/dvr/" className="btn-ghost">Tutti i DVR</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="card-luxury p-8 text-center text-ink-muted">Caricamento…</div>;

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen size={24} />}
        title="Nessun materiale in archivio"
        description={`Aggiungi foto, audio, documenti o note nella "Conoscenza azienda" di ${company.ragione_sociale}, poi torna qui per generare il DVR.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider2">
        <span className={step === 'select' ? 'text-brand-700' : 'text-ink-muted'}>1 · Seleziona materiale</span>
        <ArrowRight size={14} className="text-ink-muted" />
        <span className={step === 'matrix' ? 'text-brand-700' : 'text-ink-muted'}>2 · Rivedi matrice</span>
        <ArrowRight size={14} className="text-ink-muted" />
        <span className="text-ink-muted">3 · Genera DVR</span>
      </div>

      {msg && <p className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-2 text-[13px] text-brand-700">{msg}</p>}

      {step === 'select' ? (
        <>
          <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4 text-[12px] text-ink-muted">
            Spunta il materiale dell&apos;archivio che vuoi usare per QUESTO DVR. L&apos;AI fonderà la matrice rischi su ciò che selezioni.
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-muted"><strong className="text-ink">{selected.size}</strong> di {docs.length} selezionati</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setSelected(new Set(docs.map((d) => d.id)))}>Tutti</button>
              <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>Nessuno</button>
            </div>
          </div>
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className={`card-luxury flex items-start gap-3 p-4 ${selected.has(d.id) ? 'border-brand-300' : ''}`}>
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="mt-1 h-4 w-4 accent-brand-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{d.tipo}</Badge>
                    <span className="truncate text-[13px] font-semibold text-ink">{d.titolo || d.filename || d.tipo}</span>
                    {(d.testo_analisi ?? '').trim() === '' && (
                      <Badge variant="warning">senza analisi</Badge>
                    )}
                  </div>
                  {d.testo_analisi ? (
                    <p className="mt-1 line-clamp-2 text-[12px] text-ink-soft">{d.testo_analisi}</p>
                  ) : (
                    <p className="mt-1 text-[12px] text-warn-ink">
                      Non ancora analizzato: se lo selezioni NON contribuirà al DVR. Usa &quot;Ri-analizza&quot; nell&apos;Archivio.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={generaMatrice} disabled={busy !== null || selected.size === 0}>
              {busy === 'matrice' ? <Loader2 size={16} className="animate-spin" /> : <IconaAi size={16} />} Genera matrice rischi
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4 text-[12px] text-ink-muted">
            Matrice proposta dall&apos;AI sul materiale selezionato. Rivedi P×G ed elimina ciò che non serve, poi genera il DVR. Resta tutto modificabile e va verificato/firmato dall&apos;RSPP.
          </div>
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] min-w-[680px]">
                <thead className="bg-brand-50/40">
                  <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
                    <th className="px-4 py-3 font-semibold">Pericolo · Norma</th>
                    <th className="px-3 py-3 font-semibold w-20">P</th>
                    <th className="px-3 py-3 font-semibold w-20">G</th>
                    <th className="px-3 py-3 font-semibold w-16">R</th>
                    <th className="px-3 py-3 font-semibold">Livello</th>
                    <th className="px-3 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {rischi.map((r) => {
                    const liv = calcolaLivelloRischio(r.p, r.g);
                    const variant = liv === 'molto_alto' ? 'risk-critical' : liv === 'alto' ? 'risk-high' : liv === 'medio' ? 'risk-medium' : 'risk-low';
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3"><p className="font-semibold text-ink">{r.pericolo || r.categoria}</p><p className="text-[11px] text-ink-muted">{r.fonte_norma}</p></td>
                        <td className="px-3 py-3"><select className="input-luxury h-9 px-3" value={r.p} onChange={(e) => updateRiga(r.id, 'p', Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                        <td className="px-3 py-3"><select className="input-luxury h-9 px-3" value={r.g} onChange={(e) => updateRiga(r.id, 'g', Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                        <td className="px-3 py-3 font-bold text-ink">{r.p * r.g}</td>
                        <td className="px-3 py-3"><Badge variant={variant}>{liv.replace('_', ' ')}</Badge></td>
                        <td className="px-3 py-3"><button type="button" className="btn-icon hover:text-danger-mark" aria-label="Rimuovi" onClick={() => removeRiga(r.id)}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep('select')}>← Torna alla selezione</button>
            <button type="button" className="btn-primary" onClick={generaDvr} disabled={busy !== null || rischi.length === 0}>
              {busy === 'dvr' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Genera DVR
            </button>
          </div>
        </>
      )}
    </div>
  );
}
