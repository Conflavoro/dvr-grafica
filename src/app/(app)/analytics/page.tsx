'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KpiCard } from '@/components/ui/KpiCard';
import { CardGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { getDataSource } from '@/lib/data-source';
import type { Company, CompanyDimensione, Dvr, Lavoratore, Scadenza } from '@/lib/data-source';
import {
  Building2,
  FileText,
  Users,
  CalendarClock,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

interface Bundle {
  companies: Company[];
  dvrs: Dvr[];
  lavoratori: Lavoratore[];
  scadenze: Scadenza[];
}

const EMPTY: Bundle = { companies: [], dvrs: [], lavoratori: [], scadenze: [] };

const DIM_LABEL: Record<CompanyDimensione, string> = {
  micro: 'Micro',
  piccola: 'Piccola',
  media: 'Media',
  grande: 'Grande',
};

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Bundle>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ds = getDataSource();
    // Ogni chiamata isolata: una entita' non disponibile per il ruolo/modalita
    // (es. lavoratori/scadenze sul backend reale) NON deve rompere la pagina.
    const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
    Promise.all([
      safe(ds.companies.list()),
      safe(ds.dvr.list()),
      safe(ds.lavoratori.list()),
      safe(ds.scadenze.list()),
    ])
      .then(([companies, dvrs, lavoratori, scadenze]) => {
        setData({ companies, dvrs, lavoratori, scadenze });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (authLoading) {
    return (
      <AppShell pageTitle="Performance studio">
        <CardGridSkeleton cards={4} />
      </AppShell>
    );
  }

  // Gating: dati aggregati riservati a chi gestisce lo studio/piattaforma o opera sui DVR.
  const allowed = can(user?.role, 'dvr', 'read');
  if (!allowed) {
    return (
      <AppShell pageTitle="Performance studio">
        <div className="card-luxury mx-auto max-w-xl p-8 text-center animate-fade-up">
          <ShieldCheck size={32} className="mx-auto mb-3 text-warn-mark" />
          <h3 className="section-title text-[17px] text-warn-ink">Accesso riservato</h3>
          <p className="mt-2 text-[13px] text-ink-soft">
            Le statistiche aggregate sono disponibili per i ruoli operativi dello studio.
          </p>
        </div>
      </AppShell>
    );
  }

  const { companies, dvrs, lavoratori, scadenze } = data;

  // KPI DVR per stato
  const bozza = dvrs.filter((d) => d.status === 'draft').length;
  const inRevisione = dvrs.filter((d) => d.status === 'review').length;
  const approvati = dvrs.filter((d) => d.status === 'approved').length;

  // Scadenze urgenti (< 30 giorni, non completate)
  const now = Date.now();
  const scadenzeUrgenti = scadenze.filter((s) => {
    if (s.stato === 'completata') return false;
    const diff = (new Date(s.data_prevista).getTime() - now) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  }).length;
  const hasScadenze = scadenze.length > 0;
  const hasLavoratori = lavoratori.length > 0;

  // Distribuzione DVR per stato (per barre)
  const dvrByStatus = [
    { label: 'Bozza', value: bozza, color: 'bg-brand-300' },
    { label: 'In revisione', value: inRevisione, color: 'bg-warn-mark' },
    { label: 'Approvati', value: approvati, color: 'bg-ok-mark' },
  ];

  // Distribuzione aziende per dimensione
  const dimCounts = (['micro', 'piccola', 'media', 'grande'] as CompanyDimensione[]).map((dim) => ({
    label: DIM_LABEL[dim],
    value: companies.filter((c) => c.dimensione === dim).length,
    color: 'bg-brand-400',
  }));

  // Top settori per prefisso ATECO (prime 2 cifre)
  const settoreMap = new Map<string, number>();
  for (const c of companies) {
    const prefix = (c.ateco || '').replace(/\D/g, '').slice(0, 2);
    if (!prefix) continue;
    settoreMap.set(prefix, (settoreMap.get(prefix) ?? 0) + 1);
  }
  const topSettori = Array.from(settoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([prefix, value]) => ({ label: `ATECO ${prefix}`, value, color: 'bg-brand-500' }));

  const isEmpty = !loading && companies.length === 0 && dvrs.length === 0;

  return (
    <AppShell pageTitle="Performance studio">
      <div className="space-y-6 animate-fade-up">
        <p className="max-w-3xl text-[14px] text-ink-soft">
          Statistiche aggregate sui dati del tuo studio: aziende seguite, DVR prodotti e loro stato,
          copertura lavoratori e scadenze imminenti.
        </p>

        {isEmpty ? (
          <EmptyState
            icon={<IconaAi size={28} />}
            title="Ancora nessun dato"
            description="Genera il primo DVR per vedere le statistiche del tuo studio prendere forma."
          />
        ) : (
          <>
            {/* KPI principali */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Aziende clienti" value={loading ? 'n.d.' : companies.length} icon={<Building2 size={20} />} />
              <KpiCard label="DVR totali" value={loading ? 'n.d.' : dvrs.length} icon={<FileText size={20} />} />
              <KpiCard
                label="Lavoratori coperti"
                value={loading ? 'n.d.' : hasLavoratori ? lavoratori.length : 'n.d.'}
                icon={<Users size={20} />}
              />
              <KpiCard
                label="Scadenze urgenti (30gg)"
                value={loading ? 'n.d.' : hasScadenze ? scadenzeUrgenti : 'n.d.'}
                icon={<CalendarClock size={20} />}
                className={!loading && hasScadenze && scadenzeUrgenti > 0 ? 'border-warn bg-warn/40' : undefined}
              />
            </div>

            {/* Dettaglio DVR per stato */}
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="DVR in bozza" value={loading ? 'n.d.' : bozza} icon={<FileText size={20} />} />
              <KpiCard label="DVR in revisione" value={loading ? 'n.d.' : inRevisione} icon={<IconaAi size={20} />} />
              <KpiCard label="DVR approvati" value={loading ? 'n.d.' : approvati} icon={<ShieldCheck size={20} />} />
            </div>

            {/* Distribuzioni a barre */}
            <div className="grid gap-5 lg:grid-cols-3">
              <BarPanel title="DVR per stato" rows={dvrByStatus} total={dvrs.length} />
              <BarPanel title="Aziende per dimensione" rows={dimCounts} total={companies.length} />
              <BarPanel
                title="Top settori (ATECO)"
                rows={topSettori}
                total={companies.length}
                emptyHint="Nessun codice ATECO disponibile sulle aziende."
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

interface BarRow {
  label: string;
  value: number;
  color: string;
}

function BarPanel({
  title,
  rows,
  total,
  emptyHint,
}: {
  title: string;
  rows: BarRow[];
  total: number;
  emptyHint?: string;
}) {
  const visible = rows.filter((r) => r.value > 0);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="card-luxury p-5">
      <header className="mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-brand-500" />
        <h3 className="section-title text-[17px]">{title}</h3>
      </header>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-muted">
          {emptyHint ?? 'Nessun dato da mostrare.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.label}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-soft">{r.label}</span>
                  <span className="font-semibold text-ink">
                    {r.value}
                    <span className="ml-1 text-ink-muted">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-brand-50" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${r.color}`}
                    style={{ width: `${Math.round((r.value / max) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
