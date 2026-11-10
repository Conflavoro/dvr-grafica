'use client';

import { percorso } from '@/lib/percorso';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RewriteHumanEditsToggle } from '@/components/dvr/RewriteHumanEditsToggle';
import { AziendaTabs, type TabDef } from '@/components/aziende/AziendaTabs';
import { TabLavoratori } from '@/components/aziende/TabLavoratori';
import { TabOrganigramma } from '@/components/aziende/TabOrganigramma';
import { TabArchivio } from '@/components/aziende/TabArchivio';
import { TabAttrezzature } from '@/components/aziende/TabAttrezzature';
import { TabDpi } from '@/components/aziende/TabDpi';
import { TabFormazione } from '@/components/aziende/TabFormazione';
import { TabScadenze } from '@/components/aziende/TabScadenze';
import { TabSopralluoghi } from '@/components/aziende/TabSopralluoghi';
import { TabGeneraDvr } from '@/components/aziende/TabGeneraDvr';
import { getDataSource } from '@/lib/data-source';
import type { Company, Dvr, Lavoratore, Attrezzatura, Dpi, Corso, Scadenza, UtenteStudio } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { LinkScrivania } from '@/components/cowork/LinkScrivania';
import { canCreate, canDelete, canEdit, canAssign } from '@/lib/permissions';
import {
  Building2,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Network,
  Users,
  Wrench,
  HardHat,
  GraduationCap,
  Camera,
  CalendarClock,
  FolderOpen,
  UserPlus,
  Copy,
  Check,
  X,
  UserCog,
} from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

export default function Page() {
  return (
    <Suspense fallback={<AppShell pageTitle="Caricamento"><div /></AppShell>}>
      <AziendaSchedaPage />
    </Suspense>
  );
}

function AziendaSchedaPage() {
  const params = useSearchParams();
  const id = Number(params.get('id'));
  const justCreated = params.get('created') === '1';
  const { user } = useAuth();
  const userCanCreate = canCreate(user?.role, 'dvr');
  const userCanDelete = canDelete(user?.role, 'companies');
  const userCanEdit = canEdit(user?.role, 'companies');
  const userCanAssign = canAssign(user?.role, 'companies');

  const [company, setCompany] = useState<Company | null>(null);
  const [dvrs, setDvrs] = useState<Dvr[]>([]);
  const [counts, setCounts] = useState({ lavoratori: 0, attrezzature: 0, dpi: 0, corsi: 0, scadenze: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreatedBanner, setShowCreatedBanner] = useState(justCreated);
  // ?tab= apre direttamente una scheda (es. lavoratori dal Falco del gestionale).
  const [activeTab, setActiveTab] = useState<string>(() => params.get('tab') || 'anagrafica');

  // CRITICO: azienda + DVR -> paint veloce (2 chiamate). Hero/anagrafica/tab appaiono subito.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const ds = getDataSource();
    Promise.all([ds.companies.get(id), ds.dvr.list()])
      .then(([c, dvrList]) => {
        if (cancelled) return;
        setCompany(c);
        setDvrs(dvrList.filter((d) => d.company_id === id));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // SECONDARIO: conteggi entita' (lavoratori/attrezzature/...) caricati DOPO, senza
  // bloccare il primo paint. I badge dei tab si popolano appena pronti.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const ds = getDataSource();
    // Scope per azienda lato server: payload piccoli + niente perdita righe oltre la prima pagina.
    Promise.all([
      ds.lavoratori.list({ companyId: id }),
      ds.attrezzature.list({ companyId: id }),
      ds.dpi.list({ companyId: id }),
      ds.corsi.list({ companyId: id }),
      ds.scadenze.list({ companyId: id }),
    ])
      .then(([lavoratori, attrezzature, dpi, corsi, scadenze]) => {
        if (cancelled) return;
        setCounts({
          lavoratori: lavoratori.length,
          attrezzature: attrezzature.length,
          dpi: dpi.length,
          corsi: corsi.length,
          scadenze: scadenze.length,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const [rewriteHuman, setRewriteHuman] = useState(false);

  // Assegnazione consulente (solo titolare/admin)
  const [consulenti, setConsulenti] = useState<UtenteStudio[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userCanAssign) return;
    getDataSource().utenti.list().then((list) => {
      setConsulenti(list.filter((u) => u.ruolo === 'consulente'));
    }).catch(() => {});
  }, [userCanAssign]);

  const handleAssignChange = async (newAssignedId: number | null) => {
    if (!company) return;
    setAssignSaving(true);
    setAssignMsg(null);
    try {
      const updated = await getDataSource().companies.update(company.id, { assigned_user_id: newAssignedId });
      setCompany(updated);
      setAssignMsg(newAssignedId ? 'Consulente assegnato correttamente.' : 'Azienda resa comune (tutti i consulenti).');
      setTimeout(() => setAssignMsg(null), 3000);
    } catch {
      setAssignMsg('Salvataggio assegnazione non riuscito.');
    } finally {
      setAssignSaving(false);
    }
  };

  // Invito datore di lavoro
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDatoreInvite = async () => {
    if (!company) return;
    setInviteLoading(true);
    setInviteCode(null);
    try {
      const res = await getDataSource().companies.datoreInvite(company.id);
      setInviteCode(res.code);
      setInviteOpen(true);
    } catch {
      // non-blocking: mostra l'errore inline nel modal
      setInviteCode('ERRORE');
      setInviteOpen(true);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: seleziona il testo (accessibility)
    }
  };

  const handleDelete = async () => {
    if (!company || !confirm(`Eliminare ${company.ragione_sociale}? Tutti i DVR collegati saranno rimossi.`)) return;
    await getDataSource().companies.delete(company.id);
    window.location.href = percorso('/aziende');
  };

  // Un DVR e' "da aggiornare" se i dati azienda sono cambiati dopo la sua generazione.
  const isDvrStale = (d: Dvr): boolean => {
    if (!company?.updated_at) return false;
    const gen = d.generated_at ?? d.data_creazione;
    if (!gen) return false;
    // Tolleranza 2s per evitare falsi positivi da scritture quasi-simultanee.
    return new Date(company.updated_at).getTime() > new Date(gen).getTime() + 2000;
  };

  const handleRegenerate = async (dvrId: number) => {
    if (regeneratingId !== null) return;
    setRegeneratingId(dvrId);
    setRegenMsg(null);
    try {
      await getDataSource().dvr.generate(dvrId, { riscriviModificheUmane: rewriteHuman });
      // Ricarica DVR aggiornati (nuovo generated_at -> non piu' stale) + company.
      const ds = getDataSource();
      const [dvrList, c] = await Promise.all([ds.dvr.list(), ds.companies.get(id)]);
      setDvrs(dvrList.filter((x) => x.company_id === id));
      if (c) setCompany(c);
      setRegenMsg('DVR rigenerato con i dati aggiornati. Scarica il nuovo documento dalla scheda DVR.');
    } catch (err) {
      setRegenMsg(err instanceof Error ? `Rigenerazione non riuscita: ${err.message}` : 'Rigenerazione non riuscita.');
    } finally {
      setRegeneratingId(null);
    }
  };

  if (loading) {
    return (
      <AppShell pageTitle="Caricamento">
        <div className="card-luxury p-10 text-center text-ink-muted">Caricamento in corso.</div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell pageTitle="Azienda non trovata">
        <EmptyState
          icon={<Building2 size={28} />}
          title="Azienda non trovata"
          description="L'azienda richiesta non esiste o è stata eliminata."
          action={<Link href="/aziende" className="btn-primary">Torna alle aziende</Link>}
        />
      </AppShell>
    );
  }

  const sedeFormatted = company.sedi[0]
    ? `${company.sedi[0].indirizzo}, ${company.sedi[0].cap} ${company.sedi[0].comune} (${company.sedi[0].provincia})`
    : 'Sede non ancora indicata';

  const tabs: TabDef[] = [
    { key: 'anagrafica', label: 'Anagrafica', icon: <Building2 size={14} />, group: 'azienda' },
    { key: 'organigramma', label: 'Organigramma', icon: <Network size={14} />, group: 'azienda' },
    { key: 'lavoratori', label: 'Lavoratori', count: counts.lavoratori, icon: <Users size={14} />, group: 'organico' },
    { key: 'attrezzature', label: 'Attrezzature', count: counts.attrezzature, icon: <Wrench size={14} />, group: 'organico' },
    { key: 'dpi', label: 'DPI', count: counts.dpi, icon: <HardHat size={14} />, group: 'organico' },
    { key: 'formazione', label: 'Formazione', count: counts.corsi, icon: <GraduationCap size={14} />, group: 'organico' },
    { key: 'archivio', label: 'Conoscenza azienda', icon: <FolderOpen size={14} />, group: 'campo' },
    { key: 'sopralluoghi', label: 'Sopralluogo', icon: <Camera size={14} />, group: 'campo' },
    ...(userCanCreate ? [{ key: 'genera', label: 'Genera DVR', icon: <IconaAi size={14} />, group: 'dvr' } as TabDef] : []),
    { key: 'dvr', label: 'DVR', count: dvrs.length, icon: <FileText size={14} />, group: 'dvr' },
    { key: 'scadenze', label: 'Scadenze', count: counts.scadenze, icon: <CalendarClock size={14} />, group: 'dvr' },
  ];

  // Completezza per la generazione DVR: cosa c'e' e cosa manca.
  const org = (company.settings?.organigramma ?? {}) as Record<string, unknown>;
  const kbNotes = Array.isArray(company.settings?.kb_notes) ? (company.settings!.kb_notes as unknown[]).length : 0;
  const steps = [
    { label: 'Anagrafica', done: Boolean(company.partita_iva && company.ateco) },
    { label: 'Organigramma', done: Boolean(org.datore_lavoro && (org.rspp || org.datore_svolge_rspp)) },
    { label: 'Lavoratori', done: counts.lavoratori > 0 },
    { label: 'Sopralluogo', done: kbNotes > 0 },
    { label: 'DVR', done: dvrs.length > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <AppShell pageTitle={company.ragione_sociale}>
      <div className="space-y-6 animate-fade-up">
        {/* Banner success post-creazione */}
        {showCreatedBanner && (
          <div role="status" className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border-2 border-ok bg-ok p-5">
            <div className="flex gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-ok-mark" />
              <div>
                <p className="text-[14px] font-bold text-ok-ink">Azienda creata correttamente.</p>
                <p className="mt-1 text-[13px] text-ok-ink">
                  Carica lavoratori, attrezzature, DPI e formazione nei tab qui sotto, poi procedi a creare il primo DVR.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {userCanCreate && (
                <Link href={`/dvr/nuovo?company_id=${company.id}`} className="btn-primary">
                  <Plus size={14} /> Crea primo DVR
                </Link>
              )}
              <button type="button" onClick={() => setShowCreatedBanner(false)} className="btn-ghost border-ok text-ok-ink hover:bg-ok" aria-label="Chiudi notifica">
                Chiudi
              </button>
            </div>
          </div>
        )}

        {/* Header azienda */}
        <div className="card-luxury p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                <Building2 size={26} />
              </div>
              <div className="min-w-0">
                <p className="label-upper">ATECO {company.ateco}</p>
                <h2 className="mt-1 break-words studio-h1 text-ink">{company.ragione_sociale}</h2>
                {company.ateco_label && <p className="text-[13px] text-ink-muted">{company.ateco_label}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={company.dimensione === 'grande' ? 'brand' : company.dimensione === 'media' ? 'info' : 'neutral'}>
                {company.dimensione}
              </Badge>
              {userCanEdit && (
                <Link
                  href={`/aziende/nuova?id=${company.id}`}
                  className="btn-ghost"
                  aria-label="Modifica azienda"
                >
                  <Pencil size={14} /> Modifica
                </Link>
              )}
              {userCanCreate && (
                <Link href={`/sopralluogo?company=${company.id}`} className="btn-ghost">
                  <Camera size={14} /> Sopralluogo
                </Link>
              )}
              {userCanEdit && (
                <button
                  type="button"
                  onClick={() => void handleDatoreInvite()}
                  disabled={inviteLoading}
                  className="btn-ghost"
                  title="Genera un codice invito da condividere col datore di lavoro"
                >
                  {inviteLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Invita il datore
                </button>
              )}
              {userCanCreate && (
                <button type="button" onClick={() => setActiveTab('genera')} className="btn-primary">
                  <IconaAi size={14} /> Genera DVR
                </button>
              )}
            </div>
          </div>

          {/* Assegnazione consulente (solo titolare/admin) */}
          {userCanAssign && (
            <div className="mt-4 border-t border-brand-100 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="assign-consulente" className="label-upper flex items-center gap-1.5 shrink-0">
                  <UserCog size={13} /> Consulente assegnato
                </label>
                <div className="flex flex-1 min-w-[220px] items-center gap-2">
                  <select
                    id="assign-consulente"
                    className="input-luxury flex-1"
                    value={company.assigned_user_id ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      void handleAssignChange(val);
                    }}
                    disabled={assignSaving}
                    aria-label="Seleziona il consulente da assegnare a questa azienda"
                  >
                    <option value="">Tutti i consulenti (non assegnata)</option>
                    {consulenti.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cognome}
                      </option>
                    ))}
                  </select>
                  {assignSaving && <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" />}
                </div>
                {assignMsg && (
                  <p className="w-full text-[12px] text-brand-700 font-semibold">{assignMsg}</p>
                )}
              </div>
            </div>
          )}

          {/* Barra di completezza per la generazione del DVR */}
          <div className="mt-6 border-t border-brand-100 pt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="label-upper">Completezza per il DVR</p>
              <span className="text-[12px] font-bold text-brand-700">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {steps.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    const map: Record<string, string> = { Anagrafica: 'anagrafica', Organigramma: 'organigramma', Lavoratori: 'lavoratori', Sopralluogo: 'sopralluoghi', DVR: 'dvr' };
                    setActiveTab(map[s.label] ?? 'anagrafica');
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 py-2 text-[12px]"
                >
                  {s.done ? (
                    <CheckCircle2 size={15} className="text-ok-mark" />
                  ) : (
                    <span className="h-[15px] w-[15px] rounded-full border-2 border-brand-200" />
                  )}
                  <span className={s.done ? 'text-ink' : 'text-ink-muted'}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <AziendaTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* Contenuto tab */}
        <div className="pt-2">
          {activeTab === 'anagrafica' && <AnagraficaSection company={company} sedeFormatted={sedeFormatted} />}
          {activeTab === 'organigramma' && (
            <TabOrganigramma company={company} onSaved={() => getDataSource().companies.get(id).then((c) => c && setCompany(c))} />
          )}
          {activeTab === 'archivio' && <TabArchivio company={company} />}
          {activeTab === 'genera' && <TabGeneraDvr company={company} />}

          {activeTab === 'lavoratori' && <TabLavoratori companyId={company.id} companyName={company.ragione_sociale} />}
          {activeTab === 'attrezzature' && <TabAttrezzature companyId={company.id} companyName={company.ragione_sociale} />}
          {activeTab === 'dpi' && <TabDpi companyId={company.id} companyName={company.ragione_sociale} />}
          {activeTab === 'formazione' && <TabFormazione companyId={company.id} companyName={company.ragione_sociale} />}
          {activeTab === 'scadenze' && <TabScadenze companyId={company.id} companyName={company.ragione_sociale} />}
          {activeTab === 'sopralluoghi' && (
            <TabSopralluoghi company={company} onSaved={() => getDataSource().companies.get(id).then((c) => c && setCompany(c))} />
          )}

          {activeTab === 'dvr' && (
            <section className="card-luxury p-6">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="section-title text-[17px]">DVR di questa azienda</h3>
                <FileText size={18} className="text-brand-500" />
              </header>
              {dvrs.length === 0 ? (
                <EmptyState
                  icon={<FileText size={24} />}
                  title="Nessun DVR ancora generato"
                  description={
                    userCanCreate
                      ? `Avvia il wizard guidato per produrre il primo Documento di Valutazione dei Rischi conforme al D.Lgs. 81/08 art. 28 per ${company.ragione_sociale}.`
                      : `I DVR di ${company.ragione_sociale} appariranno qui non appena il consulente RSPP li avrà finalizzati.`
                  }
                  action={userCanCreate ? (<button type="button" onClick={() => setActiveTab('genera')} className="btn-primary"><IconaAi size={14} /> Genera il primo DVR</button>) : undefined}
                />
              ) : (
                <>
                  {regenMsg && (
                    <p className="mb-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-2 text-[12px] text-brand-700">{regenMsg}</p>
                  )}
                  {userCanCreate && dvrs.some((d) => isDvrStale(d)) && (
                    <RewriteHumanEditsToggle
                      checked={rewriteHuman}
                      onChange={setRewriteHuman}
                      disabled={regeneratingId !== null}
                      className="mb-3"
                    />
                  )}
                  <ul className="divide-y divide-brand-100">
                    {[...dvrs].sort((a, b) => b.versione - a.versione).map((d) => {
                      const stale = isDvrStale(d);
                      return (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <Link href={`/dvr/scheda?id=${d.id}`} className="flex-1 min-w-[200px] hover:text-brand-700">
                            <p className="text-[14px] font-semibold text-ink">v{d.versione}, creato il {new Date(d.data_creazione).toLocaleDateString('it-IT')}</p>
                            <p className="text-[11px] text-ink-muted">Rischio massimo: {d.rischio_max.replace('_', ' ')}</p>
                          </Link>
                          <div className="flex items-center gap-2">
                            {stale && (
                              <Badge variant="warning">Da aggiornare</Badge>
                            )}
                            <Badge variant={d.status === 'approved' ? 'success' : d.status === 'review' ? 'warning' : 'neutral'}>
                              {d.status === 'approved' ? 'Approvato' : d.status === 'review' ? 'In revisione' : d.status === 'draft' ? 'Bozza' : 'Sostituito'}
                            </Badge>
                            {d.status !== 'superseded' && <LinkScrivania dvrId={d.id} aziendaId={company.id} ruolo={user?.role} testo="Paragrafi" />}
                            {stale && userCanCreate && (
                              <button
                                type="button"
                                className="btn-ghost"
                                disabled={regeneratingId === d.id}
                                onClick={() => handleRegenerate(d.id)}
                                title="Rigenera il DVR con i dati azienda aggiornati"
                              >
                                {regeneratingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Rigenera aggiornato
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        {userCanDelete && (
          <div className="flex justify-end">
            <button onClick={handleDelete} className="btn-ghost border-danger text-danger-ink hover:bg-danger">
              <Trash2 size={14} /> Elimina azienda
            </button>
          </div>
        )}
      </div>

      {/* Modal invito datore */}
      {inviteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Codice invito datore di lavoro"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setInviteOpen(false); setCopied(false); } }}
        >
          <div className="card-luxury w-full max-w-md p-6 animate-fade-up shadow-luxury-md">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <UserPlus size={20} />
                </span>
                <div>
                  <p className="label-upper">Invito datore di lavoro</p>
                  <h3 className="text-[15px] font-bold text-ink">{company?.ragione_sociale}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setInviteOpen(false); setCopied(false); }}
                className="rounded-lg p-1 text-ink-muted hover:bg-brand-50 hover:text-ink"
                aria-label="Chiudi"
              >
                <X size={16} />
              </button>
            </div>

            {inviteCode && inviteCode !== 'ERRORE' ? (
              <>
                <p className="mb-4 text-[13px] text-ink-soft leading-snug">
                  Condividi questo codice col datore di lavoro. Lo userà durante la registrazione per accedere ai DVR di questa azienda (sola lettura).
                </p>
                <div className="mb-4 flex items-center gap-2 rounded-2xl border-2 border-brand-300 bg-brand-50/80 px-4 py-3">
                  <span className="flex-1 select-all text-center font-mono text-[22px] font-bold tracking-widest text-brand-700" aria-label={`Codice invito: ${inviteCode}`}>
                    {inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-white text-brand-600 transition hover:bg-brand-100"
                    aria-label="Copia codice"
                  >
                    {copied ? <Check size={16} className="text-ok-mark" /> : <Copy size={16} />}
                  </button>
                </div>
                {copied && (
                  <p className="mb-3 text-center text-[12px] text-ok-ink font-semibold">Codice copiato negli appunti.</p>
                )}
                <p className="rounded-xl border border-warn bg-warn/70 px-3 py-2 text-[12px] text-warn-ink">
                  Il codice e' monouso e valido per questa azienda. Generane uno nuovo se il datore non riesce ad accedere.
                </p>
              </>
            ) : (
              <p className="text-[13px] text-danger-ink">
                Generazione del codice non riuscita. Riprova o contatta il supporto tecnico.
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => { setInviteOpen(false); setCopied(false); }}
                className="btn-ghost"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-upper">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Anagrafica COMPLETA: tutti i punti essenziali della visura camerale. */
function AnagraficaSection({ company, sedeFormatted }: { company: Company; sedeFormatted: string }) {
  const s = (company.settings ?? {}) as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = s[k];
    return typeof v === 'string' && v.trim() !== '' ? v : typeof v === 'number' ? String(v) : null;
  };
  const atecoSecondari = Array.isArray(s.ateco_secondari) ? (s.ateco_secondari as string[]) : [];
  const amministratori = Array.isArray(s.amministratori)
    ? (s.amministratori as Array<{ nome_cognome?: string; carica?: string; data_nomina?: string | null }>)
    : [];
  const sedeLegale = s.sede_legale as { indirizzo?: string; comune?: string; provincia?: string; cap?: string } | null | undefined;
  const sedeLegaleFmt =
    sedeLegale && (sedeLegale.indirizzo || sedeLegale.comune)
      ? `${sedeLegale.indirizzo ?? ''}${sedeLegale.cap || sedeLegale.comune ? ', ' : ''}${sedeLegale.cap ?? ''} ${sedeLegale.comune ?? ''}${sedeLegale.provincia ? ` (${sedeLegale.provincia})` : ''}`.trim()
      : sedeFormatted;
  const capitale = str('capitale_sociale');
  const capitaleVersato = s.capitale_versato === true ? ' (i.v.)' : '';
  // Sedi operative: tutte le sedi diverse dalla legale (cantieri/stabilimenti/depositi).
  const sediOperative = (company.sedi ?? []).filter((sd) => sd.tipo !== 'legale');

  return (
    <section className="space-y-5">
      {/* Identificazione */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Identificazione</h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="P. IVA" value={company.partita_iva} />
          {company.codice_fiscale && <Info label="Codice Fiscale" value={company.codice_fiscale} />}
          {str('forma_giuridica') && <Info label="Forma giuridica" value={str('forma_giuridica')!} />}
          {str('numero_rea') && <Info label="REA" value={str('numero_rea')!} />}
          {str('camera_commercio') && <Info label="Camera di commercio" value={str('camera_commercio')!} />}
          {str('stato_attivita') && <Info label="Stato attività" value={str('stato_attivita')!} />}
          {capitale && <Info label="Capitale sociale" value={`${capitale}${capitaleVersato}`} />}
          {str('data_costituzione') && <Info label="Costituzione" value={str('data_costituzione')!} />}
          {str('data_iscrizione_registro') && <Info label="Iscrizione Registro Imprese" value={str('data_iscrizione_registro')!} />}
        </dl>
      </div>

      {/* Attività */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Attività</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label="ATECO primario" value={`${company.ateco}${company.ateco_label ? ` (${company.ateco_label})` : ''}`} />
          {atecoSecondari.length > 0 && <Info label="ATECO secondari" value={atecoSecondari.join(' · ')} />}
          <Info label="Lavoratori totali" value={String(company.lavoratori)} />
          <Info label="Dimensione" value={company.dimensione} />
        </dl>
        {str('oggetto_sociale') && (
          <div className="mt-4">
            <dt className="label-upper">Oggetto sociale</dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-ink">{str('oggetto_sociale')}</dd>
          </div>
        )}
      </div>

      {/* Composizione organico per tipologia contrattuale (art. 28 c.2a) */}
      {(() => {
        const tc = s.tipologie_contrattuali as Record<string, number> | null | undefined;
        if (!tc || typeof tc !== 'object') return null;
        const voci: Array<{ label: string; key: string }> = [
          { key: 'dipendenti', label: 'Dipendenti' },
          { key: 'apprendisti', label: 'Apprendisti' },
          { key: 'somministrati', label: 'Somministrati' },
          { key: 'tirocinanti', label: 'Tirocinanti' },
          { key: 'autonomi', label: 'Lavoratori autonomi' },
        ];
        const presenti = voci.filter((v) => typeof tc[v.key] === 'number');
        if (presenti.length === 0) return null;
        return (
          <div className="card-luxury p-6">
            <h3 className="studio-h2 mb-4 uppercase tracking-wider2">
              Composizione organico per tipologia contrattuale (art. 28 c.2a)
            </h3>
            <dl className="grid gap-4 sm:grid-cols-3">
              {presenti.map(({ key, label }) => (
                <Info key={key} label={label} value={String(tc[key])} />
              ))}
            </dl>
          </div>
        );
      })()}

      {/* Sede e contatti */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Sede e contatti</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label="Sede legale" value={sedeLegaleFmt} />
          {str('pec') && <Info label="PEC" value={str('pec')!} />}
          {str('email') && <Info label="Email" value={str('email')!} />}
          {str('telefono') && <Info label="Telefono" value={str('telefono')!} />}
        </dl>
        {sediOperative.length > 0 && (
          <div className="mt-4">
            <dt className="label-upper mb-2">Sedi operative ({sediOperative.length})</dt>
            <ul className="space-y-1.5">
              {sediOperative.map((so, i) => (
                <li key={i} className="text-[13px] text-ink">
                  {`${so.indirizzo}${so.cap || so.comune ? ', ' : ''}${so.cap ?? ''} ${so.comune ?? ''}${so.provincia ? ` (${so.provincia})` : ''}`.trim()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Amministratori / cariche (base organigramma DVR) */}
      {amministratori.length > 0 && (
        <div className="card-luxury p-6">
          <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Amministratori e cariche</h3>
          <ul className="divide-y divide-brand-100">
            {amministratori.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="text-[14px] font-semibold text-ink">{a.nome_cognome ?? 'n.d.'}</span>
                <span className="text-[12px] text-ink-muted">
                  {a.carica ?? 'carica non indicata'}
                  {a.data_nomina ? ` · dal ${a.data_nomina}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
