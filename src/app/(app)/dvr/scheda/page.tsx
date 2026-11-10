'use client';

import Link from 'next/link';
import { LinkScrivania } from '@/components/cowork/LinkScrivania';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DvrGenerationPanel } from '@/components/upload/DvrGenerationPanel';
import { DvrRevisionsPanel } from '@/components/dvr/DvrRevisionsPanel';
import { getDataSource, isApiMode } from '@/lib/data-source';
import type { AuditLogEntry, Dvr } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canApprove, canDelete, canEdit } from '@/lib/permissions';
import { downloadDvr, downloadDvrFromUrl } from '@/lib/dvr-generator';
import { getToken, apiUrl } from '@/lib/api';
import { Download, FileText, ShieldCheck, Trash2, Send, Lock, CheckCircle2 } from 'lucide-react';

export default function Page() {
  return (
    <Suspense fallback={<AppShell pageTitle="Caricamento…"><div /></AppShell>}>
      <DvrSchedaPage />
    </Suspense>
  );
}

function DvrSchedaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = Number(params.get('id'));
  const { user } = useAuth();
  const [dvr, setDvr] = useState<Dvr | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'docx' | 'pdf' | null>(null);
  // Incrementato a ogni rigenerazione: lo storico revisioni si ricarica.
  const [revisionsToken, setRevisionsToken] = useState(0);

  const userCanApprove = canApprove(user?.role, 'dvr');
  const userCanDelete = canDelete(user?.role, 'dvr');
  const userCanEdit = canEdit(user?.role, 'dvr');
  // Revisione del testo: consulente, titolare studio e admin Conflavoro (il datore legge e scarica).
  const userCanRevise = userCanEdit || user?.role === 'admin_conflavoro';

  const reload = useCallback(async () => {
    if (!id) return;
    const ds = getDataSource();
    try {
      const [d, a] = await Promise.all([ds.dvr.get(id), ds.dvr.audit(id)]);
      setDvr(d);
      setAudit(a);
    } catch {
      // Non bloccare la UI: il DVR già mostrato resta valido.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDownload = async (format: 'docx' | 'pdf') => {
    if (!dvr) return;
    setDownloading(format);
    try {
      // In modalità API scarica il documento REALE generato dal backend AI via
      // l'endpoint dedicato (fetch con JWT). Se non ancora generato (404) o errore,
      // fallback graceful al generatore client-side.
      if (isApiMode()) {
        try {
          await downloadDvrFromUrl(dvr, format, apiUrl(`/dvr/${dvr.id}/download/${format}`), getToken());
          return;
        } catch {
          await downloadDvr(dvr, format);
          return;
        }
      }
      await downloadDvr(dvr, format);
    } catch (e) {
      alert('Errore generazione documento: ' + (e as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  const handleApprove = async () => {
    if (!dvr) return;
    if (!userCanApprove) {
      alert('Solo il Titolare studio può approvare in via definitiva il DVR. Il documento è già in stato "in revisione": riceverai notifica quando il titolare avrà completato la firma.');
      return;
    }
    if (!confirm(`Approvare definitivamente il DVR v${dvr.versione} di ${dvr.azienda}? L'operazione è registrata in audit log immutabile e impegna la tua firma.`)) return;
    const updated = await getDataSource().dvr.approve(dvr.id);
    setDvr(updated);
    const a = await getDataSource().dvr.audit(dvr.id);
    setAudit(a);
  };

  const handleSubmitForReview = async () => {
    if (!dvr) return;
    const updated = await getDataSource().dvr.update(dvr.id, { status: 'review' });
    setDvr(updated);
    alert('DVR inviato al titolare studio per approvazione finale. Il titolare riceverà notifica.');
  };

  const handleDelete = async () => {
    if (!dvr || !confirm(`Eliminare DVR ${dvr.azienda} v${dvr.versione}? Operazione irreversibile.`)) return;
    await getDataSource().dvr.delete(dvr.id);
    router.push('/dvr');
  };

  if (loading) {
    return (
      <AppShell pageTitle="Caricamento DVR…">
        <div className="card-luxury p-10 text-center text-ink-muted">Caricamento…</div>
      </AppShell>
    );
  }

  if (!dvr) {
    return (
      <AppShell pageTitle="DVR non trovato">
        <EmptyState
          icon={<FileText size={28} />}
          title="DVR non trovato"
          description="Il DVR richiesto non esiste o è stato eliminato."
          action={<Link href="/dvr" className="btn-primary">Torna ai DVR</Link>}
        />
      </AppShell>
    );
  }

  // Normalizza il payload con default sicuri: un DVR appena creato (o generato in
  // corso) può avere sezioni mancanti/parziali. Senza questo, accedere a
  // sezione_e.matrice_rischi & co. farebbe crashare il render della scheda.
  const raw = (dvr.payload ?? {}) as Partial<typeof dvr.payload>;
  const part = <S,>(s: S | undefined): Partial<S> => (s ?? {}) as Partial<S>;
  const pl = {
    sezione_a: {
      ragione_sociale: '', partita_iva: '', ateco: '', sede_legale: '',
      lavoratori_totali: 0, dimensione: 'piccola', data_redazione: '',
      ...part(raw.sezione_a),
    },
    sezione_b: { datore_lavoro: '', rspp: '', ...part(raw.sezione_b) },
    sezione_c: {
      descrizione_attivita: '', reparti: [], fasi_lavorative: [],
      attrezzature_principali: [], ...part(raw.sezione_c),
    },
    sezione_d: { pericoli_identificati: [], ...part(raw.sezione_d) },
    sezione_e: { matrice_rischi: [], ...part(raw.sezione_e) },
    sezione_f: {
      misure_tecniche: '', misure_organizzative: '', dpi_assegnati: '',
      formazione: '', ...part(raw.sezione_f),
    },
    sezione_g: { interventi_pianificati: [], ...part(raw.sezione_g) },
    sezione_h: { ...part(raw.sezione_h) },
    sezione_i: { allegati: [], ...part(raw.sezione_i) },
  } as typeof dvr.payload;
  const totalRischi = pl.sezione_e.matrice_rischi.length;
  const rischiAlto = pl.sezione_e.matrice_rischi.filter((r) => r.livello === 'alto' || r.livello === 'molto_alto').length;
  const pericoli = pl.sezione_d.pericoli_identificati.length;

  return (
    <AppShell pageTitle={`DVR · ${dvr.azienda} v${dvr.versione}`}>
      <div className="space-y-6 animate-fade-up">
        <div className="card-luxury p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label-upper">v{dvr.versione} · {new Date(dvr.data_creazione).toLocaleDateString('it-IT')}</p>
              <h2 className="studio-h1 mt-1 text-ink">{dvr.azienda}</h2>
              <p className="text-[13px] text-ink-muted">ATECO {pl.sezione_a.ateco} · {pl.sezione_a.lavoratori_totali} lavoratori</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={dvr.status === 'approved' ? 'success' : dvr.status === 'review' ? 'warning' : 'neutral'}>
                {dvr.status === 'approved' ? 'Approvato' : dvr.status === 'review' ? 'In revisione' : dvr.status === 'draft' ? 'Bozza' : 'Sostituito'}
              </Badge>
              <Badge variant={dvr.rischio_max === 'molto_alto' ? 'risk-critical' : dvr.rischio_max === 'alto' ? 'risk-high' : dvr.rischio_max === 'medio' ? 'risk-medium' : 'risk-low'}>
                Rischio max: {dvr.rischio_max.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-brand-100 pt-5">
            <button onClick={() => handleDownload('docx')} disabled={downloading !== null} className="btn-primary">
              <Download size={14} /> {downloading === 'docx' ? 'Generazione…' : 'Scarica DOCX'}
            </button>
            <button onClick={() => handleDownload('pdf')} disabled={downloading !== null} className="btn-primary">
              <Download size={14} /> {downloading === 'pdf' ? 'Generazione…' : 'Scarica PDF'}
            </button>

            {/* Workflow firma 2-step:
                - Consulente: bottone "Invia in revisione al titolare" (status draft → review)
                - Titolare/Admin super: bottone "Approva definitivamente" (status review → approved) */}
            {dvr.status === 'draft' && userCanEdit && !userCanApprove && (
              <button onClick={handleSubmitForReview} className="btn-ghost border-warn text-warn-ink hover:bg-warn">
                <Send size={14} /> Invia in revisione
              </button>
            )}

            {dvr.status !== 'approved' && userCanApprove && (
              <button onClick={handleApprove} className="btn-ghost border-ok text-ok-ink hover:bg-ok">
                <ShieldCheck size={14} /> Approva definitivamente
              </button>
            )}

            {dvr.status !== 'approved' && !userCanApprove && userCanEdit && dvr.status === 'review' && (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-warn border border-warn text-[12px] text-warn-ink">
                <Lock size={12} /> In attesa approvazione titolare
              </span>
            )}

            <Link href={`/aziende/scheda?id=${dvr.company_id}`} className="btn-ghost">
              Apri scheda azienda
            </Link>

            {dvr.status !== 'superseded' && <LinkScrivania dvrId={dvr.id} aziendaId={dvr.company_id} ruolo={user?.role} />}

            {userCanDelete && (
              <button onClick={handleDelete} className="btn-ghost border-danger text-danger-ink hover:bg-danger ml-auto">
                <Trash2 size={14} /> Elimina
              </button>
            )}
          </div>
        </div>

        <div className="card-luxury border-2 border-brand-300 bg-brand-50/40 p-5">
          <p className="label-upper text-brand-700">Disclaimer AI</p>
          <p className="mt-2 text-[13px] italic text-ink-soft">{dvr.ai_disclaimer_text}</p>
          {dvr.data_approvazione && (
            <p className="mt-3 inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-ok-ink font-semibold">
              <CheckCircle2 size={13} /> Approvato il {new Date(dvr.data_approvazione).toLocaleDateString('it-IT')}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Pericoli identificati" value={String(pericoli)} />
          <Stat label="Rischi valutati" value={String(totalRischi)} />
          <Stat label="Alto / molto alto" value={`${rischiAlto} su ${totalRischi}`} />
        </div>

        {/* Sezioni A→I */}
        <Section letter="A" title="Frontespizio e dati aziendali">
          <KVRow k="Ragione sociale" v={pl.sezione_a.ragione_sociale} />
          <KVRow k="P. IVA" v={pl.sezione_a.partita_iva} />
          <KVRow k="ATECO" v={pl.sezione_a.ateco} />
          <KVRow k="Sede legale" v={pl.sezione_a.sede_legale} />
          <KVRow k="Lavoratori" v={String(pl.sezione_a.lavoratori_totali)} />
          <KVRow k="Dimensione" v={pl.sezione_a.dimensione} />
        </Section>

        <Section letter="B" title="Organigramma sicurezza">
          <KVRow k="Datore di lavoro" v={pl.sezione_b.datore_lavoro} />
          <KVRow k="RSPP" v={pl.sezione_b.rspp} />
          <KVRow k="Medico Competente" v={pl.sezione_b.medico_competente ?? 'n.d.'} />
          <KVRow k="RLS / RLST" v={pl.sezione_b.rls ?? 'n.d.'} />
        </Section>

        <Section letter="C" title="Descrizione attività">
          <p className="text-[14px] text-ink mb-4">{pl.sezione_c.descrizione_attivita || 'n.d.'}</p>
          <ListBlock title="Reparti" items={pl.sezione_c.reparti} />
          <ListBlock title="Fasi lavorative" items={pl.sezione_c.fasi_lavorative} />
          <ListBlock title="Attrezzature" items={pl.sezione_c.attrezzature_principali} />
        </Section>

        <Section letter="D" title="Identificazione pericoli">
          <ListBlock title="Pericoli identificati" items={pl.sezione_d.pericoli_identificati} />
        </Section>

        <Section letter="E" title="Valutazione rischi (P × G)">
          <p className="text-[12px] text-ink-muted italic mb-3">
            Metodo P × G (4×4): R = P × G. Livelli: basso (R 1-2) · medio (3-4) · alto (6-9) · molto alto (12-16).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Pericolo · Norma</th>
                  <th className="py-2 pr-3 font-semibold">P</th>
                  <th className="py-2 pr-3 font-semibold">G</th>
                  <th className="py-2 pr-3 font-semibold">R</th>
                  <th className="py-2 font-semibold">Livello</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {pl.sezione_e.matrice_rischi.map((r, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink">{r.pericolo}</p>
                      {r.fonte_norma && <p className="text-[11px] text-ink-muted">{r.fonte_norma}</p>}
                    </td>
                    <td className="py-3 pr-3 text-ink">{r.probabilita}</td>
                    <td className="py-3 pr-3 text-ink">{r.gravita}</td>
                    <td className="py-3 pr-3 font-bold text-ink">{r.probabilita * r.gravita}</td>
                    <td className="py-3">
                      <Badge variant={r.livello === 'molto_alto' ? 'risk-critical' : r.livello === 'alto' ? 'risk-high' : r.livello === 'medio' ? 'risk-medium' : 'risk-low'}>
                        {r.livello.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section letter="F" title="Misure di prevenzione e protezione">
          <KVRow k="Tecniche" v={pl.sezione_f.misure_tecniche || 'n.d.'} />
          <KVRow k="Organizzative" v={pl.sezione_f.misure_organizzative || 'n.d.'} />
          <KVRow k="DPI assegnati" v={pl.sezione_f.dpi_assegnati || 'n.d.'} />
          <KVRow k="Formazione" v={pl.sezione_f.formazione || 'n.d.'} />
        </Section>

        {pl.sezione_h && Object.values(pl.sezione_h).some((v) => v) && (
          <Section letter="H" title="Valutazioni specifiche">
            {pl.sezione_h.rumore && <KVRow k="Rumore (UNI 9612)" v={pl.sezione_h.rumore} />}
            {pl.sezione_h.mmc && <KVRow k="MMC (NIOSH)" v={pl.sezione_h.mmc} />}
            {pl.sezione_h.vibrazioni && <KVRow k="Vibrazioni" v={pl.sezione_h.vibrazioni} />}
            {pl.sezione_h.chimico && <KVRow k="Chimico" v={pl.sezione_h.chimico} />}
          </Section>
        )}

        {/* Testo della revisione corrente (modificabile) + storico revisioni. */}
        <DvrRevisionsPanel
          dvr={dvr}
          canEdit={userCanRevise}
          reloadToken={revisionsToken}
          onDvrChanged={() => void reload()}
        />

        {/* Ponte verso il DVR reale: upload documenti/foto + generazione AI.
            Solo per chi puo' modificare (consulente/titolare, NON datore_lavoro). */}
        {userCanEdit && (
          <DvrGenerationPanel
            dvrId={dvr.id}
            onGenerated={() => {
              void reload();
              setRevisionsToken((t) => t + 1);
            }}
          />
        )}

        {audit.length > 0 && (
          <section className="card-luxury p-6">
            <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Audit log (hash chain)</h3>
            <ul className="divide-y divide-brand-100">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-semibold text-ink uppercase tracking-wider2">{a.action}</span>
                  <span className="text-ink-muted">{new Date(a.created_at).toLocaleString('it-IT')}</span>
                  <span className="font-mono text-[10px] text-ink-subtle">{a.current_hash.slice(0, 12)}…</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {userCanDelete && (
          <div className="flex justify-end">
            <button onClick={handleDelete} className="btn-ghost border-danger text-danger-ink hover:bg-danger">
              Elimina DVR
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card-luxury p-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[13px] font-bold text-white">
          {letter}
        </span>
        <h3 className="section-title text-[17px]">{title}</h3>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function KVRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-brand-100 pb-2 last:border-b-0">
      <dt className="label-upper">{k}</dt>
      <dd className="col-span-2 text-[14px] text-ink">{v}</dd>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="label-upper">{title}</p>
      <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-soft">
        {items.map((it, i) => <li key={i}>• {it}</li>)}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-luxury p-4">
      <p className="label-upper">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-ink">{value}</p>
    </div>
  );
}
