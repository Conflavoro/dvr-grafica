'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/ui/KpiCard';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/use-auth';
import { canCreate } from '@/lib/permissions';
import { getDataSource } from '@/lib/data-source';
import type {
  Attrezzatura,
  Company,
  Corso,
  Dpi,
  Dvr,
  Lavoratore,
  Scadenza,
  Studio,
  UtenteStudio,
} from '@/lib/data-source';
import {
  Building2,
  FileText,
  ShieldCheck,
  Plus,
  AlertTriangle,
  Users,
  Wrench,
  HardHat,
  GraduationCap,
  CalendarClock,
  Network,
  Copy,
  Check,
  KeyRound,
  Camera,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

interface DataBundle {
  companies: Company[];
  dvrs: Dvr[];
  lavoratori: Lavoratore[];
  dpi: Dpi[];
  attrezzature: Attrezzatura[];
  corsi: Corso[];
  scadenze: Scadenza[];
  studi: Studio[];
  utenti: UtenteStudio[];
}

const EMPTY: DataBundle = {
  companies: [],
  dvrs: [],
  lavoratori: [],
  dpi: [],
  attrezzature: [],
  corsi: [],
  scadenze: [],
  studi: [],
  utenti: [],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DataBundle>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ds = getDataSource();
    let cancelled = false;
    // Resilienza: un'entita' non disponibile per il ruolo/modalita NON rompe la dashboard -> [].
    const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
    const canTeam = user?.role === 'titolare_studio' || user?.role === 'admin_conflavoro';

    // FASE 1 (paint veloce): solo cio' che serve subito (aziende, DVR, scadenze).
    Promise.all([safe(ds.companies.list()), safe(ds.dvr.list()), safe(ds.scadenze.list())])
      .then(([companies, dvrs, scadenze]) => {
        if (cancelled) return;
        setData((d) => ({ ...d, companies, dvrs, scadenze }));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    // FASE 2 (dopo il paint): totali secondari (KPI a 'n.d.' finche' non arrivano).
    Promise.all([
      safe(ds.lavoratori.list()),
      safe(ds.dpi.list()),
      safe(ds.attrezzature.list()),
      safe(ds.corsi.list()),
      canTeam ? safe(ds.studi.list()) : Promise.resolve([]),
      canTeam ? safe(ds.utenti.list()) : Promise.resolve([]),
    ]).then(([lavoratori, dpi, attrezzature, corsi, studi, utenti]) => {
      if (cancelled) return;
      setData((d) => ({ ...d, lavoratori, dpi, attrezzature, corsi, studi, utenti }));
    });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  // Senza sessione la pagina restituiva null = schermata BIANCA.
  // Passiamo dalla shell, che ha la guardia e riporta al login.
  if (!user) {
    return <AppShell pageTitle="Panoramica"><div className="card-luxury p-8 text-center text-ink-muted">Sessione non attiva.</div></AppShell>;
  }
  const firstName = user.name.split(' ')[0];

  return (
    <AppShell pageTitle="Panoramica">
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {user.role === 'consulente' ? (
              <>
                <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[30px]">Ciao {firstName}.</h1>
                <p className="mt-1 text-[14px] text-ink-soft">Cosa facciamo oggi?</p>
              </>
            ) : (
              <>
                <p className="text-[15px] text-ink-soft">Bentornato, {firstName}.</p>
                <p className="text-[12px] text-ink-muted">{ROLE_TAGLINE[user.role]}</p>
              </>
            )}
          </div>
          {user.role !== 'consulente' && (
            <QuickActions role={user.role} canCreateDvr={canCreate(user.role, 'dvr')} />
          )}
        </div>

        {user.role === 'datore_lavoro' && <DashboardDatore data={data} loading={loading} />}
        {user.role === 'consulente' && <DashboardConsulente data={data} loading={loading} canCreate={canCreate(user.role, 'dvr')} />}
        {user.role === 'titolare_studio' && <DashboardTitolare data={data} loading={loading} studioCode={user.studio_code} />}
        {user.role === 'admin_conflavoro' && <DashboardAdminConflavoro data={data} loading={loading} />}
      </div>
    </AppShell>
  );
}

const ROLE_TAGLINE: Record<string, string> = {
  admin_conflavoro: 'Vista piattaforma: studi affiliati, salute sistema e utilizzo.',
  titolare_studio: 'Vista studio: approvazioni DVR, rischi critici e performance del team.',
  consulente: 'Le tue attività: DVR in lavorazione, aziende e scadenze.',
  datore_lavoro: 'La tua azienda: stato dei DVR, scadenze e documenti.',
};

// Scorciatoie operative per ruolo: dalla dashboard ai task chiave in 1 click.
function QuickActions({ role, canCreateDvr }: { role: string; canCreateDvr: boolean }) {
  if (role === 'admin_conflavoro') {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href="/tenants" className="btn-ghost"><Network size={14} /> Studi affiliati</Link>
        <Link href="/piattaforma/audit" className="btn-ghost"><ShieldCheck size={14} /> Audit</Link>
      </div>
    );
  }
  if (role === 'datore_lavoro') {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href="/dvr" className="btn-ghost"><FileText size={14} /> I miei DVR</Link>
        <Link href="/documenti" className="btn-ghost"><FileText size={14} /> Documenti</Link>
      </div>
    );
  }
  // titolare_studio + consulente: azioni operative
  return (
    <div className="flex flex-wrap gap-2">
      {canCreateDvr && (
        <Link href="/dvr/nuovo" className="btn-primary"><IconaAi size={14} /> Genera DVR</Link>
      )}
      <Link href="/aziende" className="btn-ghost"><Building2 size={14} /> Aziende</Link>
      <Link href="/scadenziario" className="btn-ghost"><Plus size={14} /> Scadenze</Link>
    </div>
  );
}

function dvrStats(dvrs: Dvr[]) {
  return {
    approvati: dvrs.filter((d) => d.status === 'approved').length,
    inRevisione: dvrs.filter((d) => d.status === 'review' || d.status === 'draft').length,
    altoRischio: dvrs.filter((d) => d.rischio_max === 'alto' || d.rischio_max === 'molto_alto').length,
  };
}

function scadenzeImminenti(scadenze: Scadenza[], days = 60): Scadenza[] {
  const now = Date.now();
  return scadenze
    .filter((s) => s.stato !== 'completata')
    .filter((s) => {
      const t = new Date(s.data_prevista).getTime();
      const diff = (t - now) / (1000 * 60 * 60 * 24);
      return diff <= days;
    })
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
}

// ============================================================
// DASHBOARD DATORE DI LAVORO — read-only, vede SOLO la sua azienda
// ============================================================

function DashboardDatore({ data, loading }: { data: DataBundle; loading: boolean }) {
  const dvrApprovati = data.dvrs.filter((d) => d.status === 'approved');
  const ultimoDvr = dvrApprovati.sort((a, b) => b.versione - a.versione)[0];
  const formazioneInScadenza = data.corsi.filter((c) => {
    if (!c.data_scadenza) return false;
    const days = (new Date(c.data_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  });
  const scadenzeAperte = scadenzeImminenti(data.scadenze, 90);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Lavoratori" value={loading ? 'n.d.' : data.lavoratori.length} icon={<Users size={20} />} />
        <KpiCard label="DVR ricevuti" value={loading ? 'n.d.' : dvrApprovati.length} icon={<FileText size={20} />} />
        <KpiCard label="DPI assegnati" value={loading ? 'n.d.' : data.dpi.length} icon={<HardHat size={20} />} />
        <KpiCard label="Scadenze aperte" value={loading ? 'n.d.' : scadenzeAperte.length} icon={<CalendarClock size={20} />} />
      </div>

      {!loading && dvrApprovati.length === 0 && (
        <div className="card-luxury p-8 text-center">
          <FileText size={32} className="mx-auto text-brand-500 mb-3" />
          <h3 className="section-title text-[17px]">Nessun DVR ancora consegnato</h3>
          <p className="mt-3 text-[14px] text-ink-soft max-w-2xl mx-auto">
            Il consulente RSPP del tuo studio sta lavorando alla valutazione dei rischi della tua azienda.
            Riceverai notifica via email appena il DVR sarà pronto da consultare e firmare.
          </p>
        </div>
      )}

      {!loading && ultimoDvr && (
        <section className="card-luxury p-6">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-upper">Ultimo DVR ricevuto</p>
              <h2 className="section-title text-[17px] mt-1">v{ultimoDvr.versione} · {ultimoDvr.azienda}</h2>
            </div>
            <Link href={`/dvr/scheda?id=${ultimoDvr.id}`} className="btn-primary">
              <FileText size={14} /> Apri DVR
            </Link>
          </header>
          <p className="text-[13px] text-ink-muted">
            Approvato il {ultimoDvr.data_approvazione ? new Date(ultimoDvr.data_approvazione).toLocaleDateString('it-IT') : 'n.d.'}.
            Rischio massimo rilevato: <strong>{ultimoDvr.rischio_max.replace('_', ' ')}</strong>.
          </p>
        </section>
      )}

      {!loading && scadenzeAperte.length > 0 && (
        <section className="card-luxury p-6">
          <h2 className="section-title text-[17px] mb-4">Prossime scadenze</h2>
          <ul className="divide-y divide-brand-100">
            {scadenzeAperte.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{s.descrizione}</p>
                  <p className="text-[11px] text-ink-muted">{s.tipo.replace('_', ' ')} · {s.responsabile ?? 'da assegnare'}</p>
                </div>
                <Badge variant={s.priorita === 'critica' ? 'danger' : s.priorita === 'alta' ? 'warning' : 'neutral'}>
                  {new Date(s.data_prevista).toLocaleDateString('it-IT')}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && formazioneInScadenza.length > 0 && (
        <section className="card-luxury p-6 border-l-4 border-warn-mark">
          <header className="flex items-center gap-2 mb-2">
            <GraduationCap size={18} className="text-warn-ink" />
            <h2 className="section-title text-[17px] text-warn-ink">Formazione in scadenza</h2>
          </header>
          <p className="text-[13px] text-ink-soft">
            {formazioneInScadenza.length} corsi scadono nei prossimi 90 giorni. Il consulente RSPP ti contatterà per pianificare gli aggiornamenti.
          </p>
        </section>
      )}
    </>
  );
}

// ============================================================
// DASHBOARD CONSULENTE — opera sulle sue aziende
// ============================================================

/** Stato del DVR piu' recente di un'azienda, per le card del cockpit. */
function companyDvrStatus(company: Company, dvrs: Dvr[]): { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' } {
  const own = dvrs.filter((d) => d.company_id === company.id);
  if (own.length === 0) return { label: 'DVR mancante', variant: 'neutral' };
  const latest = [...own].sort((a, b) => b.versione - a.versione)[0];
  // Da aggiornare: dati azienda cambiati dopo l'ultima generazione.
  const gen = latest.generated_at ?? latest.data_creazione;
  if (company.updated_at && gen && new Date(company.updated_at).getTime() > new Date(gen).getTime() + 2000) {
    return { label: 'Da aggiornare', variant: 'warning' };
  }
  if (latest.status === 'approved') return { label: 'DVR aggiornato', variant: 'success' };
  if (latest.status === 'review') return { label: 'In revisione', variant: 'info' };
  if (latest.status === 'draft') return { label: 'Bozza in corso', variant: 'neutral' };
  return { label: 'Sostituito', variant: 'neutral' };
}

function ActionTile({ href, icon, title, subtitle, primary }: { href: string; icon: ReactNode; title: string; subtitle: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-3xl p-5 transition-all hover:-translate-y-0.5 ${
        primary
          ? 'bg-brand-gradient text-white shadow-luxury-md'
          : 'card-luxury text-ink hover:border-brand-300'
      }`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${primary ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'}`}>
        {icon}
      </span>
      <div>
        <p className="text-[16px] font-bold leading-tight">{title}</p>
        <p className={`mt-0.5 text-[12px] ${primary ? 'text-white/85' : 'text-ink-muted'}`}>{subtitle}</p>
      </div>
    </Link>
  );
}

function DashboardConsulente({ data, loading, canCreate }: { data: DataBundle; loading: boolean; canCreate: boolean }) {
  const inRevisione = data.dvrs.filter((d) => d.status === 'review').length;
  const daAggiornare = data.companies.filter((c) => companyDvrStatus(c, data.dvrs).label === 'Da aggiornare').length;
  const scadenzeAperte = scadenzeImminenti(data.scadenze, 30);
  const aziende = [...data.companies].sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale)).slice(0, 6);
  const haDaFare = inRevisione > 0 || scadenzeAperte.length > 0 || daAggiornare > 0;

  return (
    <>
      {/* Tile azione: arrivi e parti subito */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionTile href="/sopralluogo" primary icon={<Camera size={24} />} title="Sopralluogo" subtitle="Foto, audio e note in azienda" />
        {canCreate && <ActionTile href="/aziende/nuova" icon={<Plus size={24} />} title="Nuova azienda" subtitle="Carica visura o inserisci a mano" />}
        {canCreate && <ActionTile href="/dvr/nuovo" icon={<FileText size={24} />} title="Genera DVR" subtitle="L'AI prepara la valutazione" />}
      </div>

      {/* Da fare (solo se c'e' qualcosa) */}
      {!loading && haDaFare && (
        <section className="card-luxury p-5">
          <h2 className="section-title mb-3">Da fare</h2>
          <ul className="space-y-1">
            {daAggiornare > 0 && (
              <li><Link href="/aziende" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-brand-50">
                <span className="flex items-center gap-2 text-[14px] text-ink"><RefreshCw size={15} className="text-warn-mark" /> {daAggiornare} DVR da aggiornare</span>
                <ArrowRight size={15} className="text-ink-muted" />
              </Link></li>
            )}
            {inRevisione > 0 && (
              <li><Link href="/dvr" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-brand-50">
                <span className="flex items-center gap-2 text-[14px] text-ink"><IconaAi size={15} className="text-brand-600" /> {inRevisione} DVR in revisione</span>
                <ArrowRight size={15} className="text-ink-muted" />
              </Link></li>
            )}
            {scadenzeAperte.length > 0 && (
              <li><Link href="/scadenziario" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-brand-50">
                <span className="flex items-center gap-2 text-[14px] text-ink"><CalendarClock size={15} className="text-warn-mark" /> {scadenzeAperte.length} scadenze nei prossimi 30 giorni</span>
                <ArrowRight size={15} className="text-ink-muted" />
              </Link></li>
            )}
          </ul>
        </section>
      )}

      {/* Le tue aziende */}
      {!loading && data.companies.length === 0 ? (
        <div className="card-luxury p-8 text-center">
          <p className="label-upper">Inizia da qui</p>
          <p className="mt-3 text-[15px] text-ink-soft">
            Aggiungi le aziende a te assegnate, poi avvia il sopralluogo o genera direttamente il DVR.
          </p>
          {canCreate && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/aziende/nuova" className="btn-primary"><Plus size={14} /> Nuova azienda</Link>
              <Link href="/aziende/importa" className="btn-ghost"><Plus size={14} /> Import massivo</Link>
            </div>
          )}
        </div>
      ) : !loading ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Le tue aziende</h2>
            <Link href="/aziende" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Vedi tutte</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aziende.map((c) => {
              const st = companyDvrStatus(c, data.dvrs);
              return (
                <Link key={c.id} href={`/aziende/scheda?id=${c.id}`} className="card-luxury flex flex-col gap-3 p-4 hover:border-brand-300">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Building2 size={18} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">{c.ragione_sociale}</p>
                      <p className="truncate text-[11px] text-ink-muted">ATECO {c.ateco}{c.sedi[0]?.comune ? ` · ${c.sedi[0].comune}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <span className="text-[11px] text-ink-muted">{data.dvrs.filter((d) => d.company_id === c.id).length} DVR</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

// ============================================================
// DASHBOARD TITOLARE STUDIO — supervisione studio + consulenti
// ============================================================

/**
 * Card che mostra il codice studio (slug del tenant) condivisibile dal titolare
 * con i propri consulenti: in onboarding il consulente lo digita per associarsi.
 */
function StudioCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard non disponibile: l'utente puo' selezionare il codice manualmente */
    }
  };

  return (
    <section className="card-luxury p-6 border-l-4 border-brand-400">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <KeyRound size={20} />
          </span>
          <div>
            <p className="label-upper">Codice studio</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Condividilo con i tuoi consulenti: lo inseriscono in fase di registrazione per unirsi allo studio.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="select-all rounded-lg bg-ink/5 px-3 py-2 font-mono text-[15px] font-semibold tracking-wide text-ink">
            {code}
          </code>
          <button type="button" onClick={copy} className="btn-ghost" aria-label="Copia codice studio">
            {copied ? <Check size={14} className="text-ok-mark" /> : <Copy size={14} />}
            {copied ? 'Copiato' : 'Copia'}
          </button>
        </div>
      </div>
    </section>
  );
}

function DashboardTitolare({ data, loading, studioCode }: { data: DataBundle; loading: boolean; studioCode?: string }) {
  const consulenti = data.utenti.filter((u) => u.ruolo === 'consulente').length;
  const recentDvrs = [...data.dvrs].sort((a, b) => b.id - a.id).slice(0, 5);
  // KPI specifiche del titolare: approvazioni pendenti + rischi critici + scadenze urgenti.
  const daApprovare = data.dvrs.filter((d) => d.status === 'review');
  const rischiCritici = data.dvrs.filter((d) => d.rischio_max === 'molto_alto').length;
  const scadenzeUrgenti = scadenzeImminenti(data.scadenze, 30);

  return (
    <>
      {studioCode && <StudioCodeCard code={studioCode} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="DVR da approvare" value={loading ? 'n.d.' : daApprovare.length} icon={<IconaAi size={20} />} />
        <KpiCard label="Rischi molto alti" value={loading ? 'n.d.' : rischiCritici} icon={<AlertTriangle size={20} />} />
        <KpiCard label="Scadenze urgenti (30gg)" value={loading ? 'n.d.' : scadenzeUrgenti.length} icon={<CalendarClock size={20} />} />
        <KpiCard label="Consulenti del team" value={loading ? 'n.d.' : consulenti} icon={<Users size={20} />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Aziende clienti" value={loading ? 'n.d.' : data.companies.length} icon={<Building2 size={20} />} />
        <KpiCard label="DVR generati" value={loading ? 'n.d.' : data.dvrs.length} icon={<FileText size={20} />} />
        <KpiCard label="DVR approvati" value={loading ? 'n.d.' : data.dvrs.filter((d) => d.status === 'approved').length} icon={<ShieldCheck size={20} />} />
        <KpiCard label="Lavoratori coperti" value={loading ? 'n.d.' : data.lavoratori.length} icon={<Users size={20} />} />
      </div>

      {!loading && daApprovare.length > 0 && (
        <section className="card-luxury p-6 border-l-4 border-warn-mark">
          <header className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconaAi size={18} className="text-warn-ink" />
              <h2 className="section-title text-[17px] text-warn-ink">In attesa della tua approvazione</h2>
            </div>
            <Link href="/dvr" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Gestisci</Link>
          </header>
          <ul className="divide-y divide-brand-100">
            {daApprovare.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5">
                <Link href={`/dvr/scheda?id=${d.id}`} className="min-w-0 flex-1 hover:text-brand-700">
                  <p className="truncate text-[13px] font-semibold text-ink">{d.azienda}</p>
                  <p className="text-[11px] text-ink-muted">v{d.versione} · rischio max {d.rischio_max.replace('_', ' ')}</p>
                </Link>
                <Badge variant="warning">Da approvare</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && data.companies.length === 0 && data.dvrs.length === 0 && (
        <div className="card-luxury p-8 text-center">
          <p className="label-upper">Onboarding studio</p>
          <p className="mt-3 text-[15px] text-ink-soft">
            Inizia importando massivamente le aziende clienti e i consulenti del tuo studio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/aziende/importa" className="btn-primary"><Plus size={14} /> Importa aziende</Link>
            <Link href="/utenti/importa" className="btn-ghost"><Plus size={14} /> Importa consulenti</Link>
          </div>
        </div>
      )}

      {!loading && recentDvrs.length > 0 && (
        <section className="card-luxury p-6">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="section-title text-[17px]">DVR recenti dello studio</h2>
            <Link href="/dvr" className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">Vedi tutti</Link>
          </header>
          <ul className="divide-y divide-brand-100">
            {recentDvrs.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <Link href={`/dvr/scheda?id=${d.id}`} className="min-w-0 flex-1 hover:text-brand-700">
                  <p className="truncate text-[14px] font-semibold text-ink">{d.azienda}</p>
                  <p className="text-[11px] text-ink-muted">v{d.versione} · {new Date(d.data_creazione).toLocaleDateString('it-IT')}</p>
                </Link>
                <Badge variant={d.status === 'approved' ? 'success' : d.status === 'review' ? 'warning' : 'neutral'}>
                  {d.status === 'approved' ? 'Approvato' : d.status === 'review' ? 'Revisione' : d.status === 'draft' ? 'Bozza' : 'Sostituito'}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ============================================================
// DASHBOARD ADMIN CONFLAVORO — proprietario piattaforma
// Vista aggregata: studi affiliati + reporting + configurazione tecnica
// ============================================================

function DashboardAdminConflavoro({ data, loading }: { data: DataBundle; loading: boolean }) {
  const studiAttivi = data.studi.filter((s) => s.attivo).length;
  const totaleConsulenti = data.utenti.filter((u) => u.ruolo === 'consulente').length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Studi affiliati" value={loading ? 'n.d.' : data.studi.length} icon={<Network size={20} />} />
        <KpiCard label="Studi attivi" value={loading ? 'n.d.' : studiAttivi} icon={<ShieldCheck size={20} />} />
        <KpiCard label="Consulenti RSPP" value={loading ? 'n.d.' : totaleConsulenti} icon={<Users size={20} />} />
        <KpiCard label="DVR generati" value={loading ? 'n.d.' : data.dvrs.length} icon={<FileText size={20} />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Aziende clienti" value={loading ? 'n.d.' : data.companies.length} icon={<Building2 size={20} />} />
        <KpiCard label="Lavoratori coperti" value={loading ? 'n.d.' : data.lavoratori.length} icon={<Users size={20} />} />
        <KpiCard label="Attrezzature mappate" value={loading ? 'n.d.' : data.attrezzature.length} icon={<Wrench size={20} />} />
        <KpiCard label="Corsi formazione" value={loading ? 'n.d.' : data.corsi.length} icon={<GraduationCap size={20} />} />
      </div>

      {!loading && data.studi.length === 0 && (
        <div className="card-luxury p-8 text-center">
          <p className="label-upper">Onboarding piattaforma</p>
          <p className="mt-3 text-[15px] text-ink-soft">
            Inizia importando massivamente gli studi consulenza affiliati a Conflavoro PMI da Excel/CSV.
            Per ogni studio, popola poi l&apos;elenco consulenti. La configurazione tecnica della piattaforma
            (AI, RAG, storage) è gestibile dalla sezione <strong>Configurazione piattaforma</strong>.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/tenants/importa" className="btn-primary"><Plus size={14} /> Importa studi affiliati</Link>
            <Link href="/utenti/importa" className="btn-ghost"><Plus size={14} /> Importa consulenti</Link>
            <Link href="/piattaforma" className="btn-ghost"><Plus size={14} /> Configurazione</Link>
          </div>
        </div>
      )}
    </>
  );
}
