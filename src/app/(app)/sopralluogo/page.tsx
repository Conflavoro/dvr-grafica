'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { TabSopralluoghi } from '@/components/aziende/TabSopralluoghi';
import { getDataSource, type Company } from '@/lib/data-source';
import { Building2, Camera, Search, ArrowLeft, FileText, Network, BookOpen, Plus } from 'lucide-react';

export default function Page() {
  return (
    <Suspense fallback={<AppShell pageTitle="Sopralluogo"><div /></AppShell>}>
      <SopralluogoCruscotto />
    </Suspense>
  );
}

/**
 * CRUSCOTTO SOPRALLUOGO — pannello di controllo del consulente in azienda.
 * Mobile-first: scegli l'azienda visitata, poi cattura foto/audio/note che
 * l'AI elabora e salva nella knowledge base, pronta per generare il DVR.
 */
function SopralluogoCruscotto() {
  const params = useSearchParams();
  const router = useRouter();
  const companyId = Number(params.get('company')) || null;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Carica l'elenco aziende (per il selettore) e, se selezionata, l'azienda corrente.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ds = getDataSource();
    if (companyId) {
      ds.companies
        .get(companyId)
        .then((c) => {
          if (!cancelled) setCompany(c);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      ds.companies
        .list()
        .then((list) => {
          if (!cancelled) setCompanies(list);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // ---- Modalità campo: azienda selezionata ----
  if (companyId) {
    if (loading) {
      return (
        <AppShell pageTitle="Sopralluogo">
          <div className="card-luxury p-10 text-center text-ink-muted">Caricamento…</div>
        </AppShell>
      );
    }
    if (!company) {
      return (
        <AppShell pageTitle="Sopralluogo">
          <EmptyState
            icon={<Building2 size={26} />}
            title="Azienda non trovata"
            description="Seleziona un'altra azienda per avviare il sopralluogo."
            action={<Link href="/sopralluogo" className="btn-primary">Scegli azienda</Link>}
          />
        </AppShell>
      );
    }
    return (
      <AppShell pageTitle="Sopralluogo">
        <div className="space-y-5 animate-fade-up">
          {/* Header azienda + cambio */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/sopralluogo" className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700">
              <ArrowLeft size={14} /> Cambia azienda
            </Link>
          </div>
          <div className="card-luxury p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                <Camera size={22} />
              </div>
              <div className="min-w-0">
                <p className="label-upper">Sopralluogo in corso</p>
                <h2 className="truncate studio-h2 text-ink">{company.ragione_sociale}</h2>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/aziende/scheda?id=${company.id}`} className="btn-ghost"><Network size={15} /> Organigramma</Link>
              <Link href={`/aziende/scheda?id=${company.id}`} className="btn-ghost"><BookOpen size={15} /> Knowledge base</Link>
              <Link href={`/dvr/nuovo?company_id=${company.id}`} className="btn-primary"><FileText size={15} /> Genera DVR</Link>
            </div>
          </div>

          {/* Pannello di cattura (foto/audio/note -> KB) */}
          <TabSopralluoghi
            company={company}
            onSaved={() => getDataSource().companies.get(company.id).then((c) => c && setCompany(c))}
          />
        </div>
      </AppShell>
    );
  }

  // ---- Selettore azienda ----
  const filtered = companies.filter(
    (c) => !q || c.ragione_sociale.toLowerCase().includes(q.toLowerCase()) || c.ateco.includes(q)
  );

  return (
    <AppShell pageTitle="Sopralluogo">
      <div className="space-y-5 animate-fade-up">
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-5">
          <div className="flex items-start gap-3">
            <Camera size={22} className="mt-0.5 shrink-0 text-brand-600" />
            <div>
              <h2 className="studio-h2 text-ink">Pannello di sopralluogo</h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                Scegli l&apos;azienda che stai visitando: poi potrai scattare foto, registrare note vocali e scrivere
                appunti direttamente dal telefono. L&apos;AI li elabora e li salva nella knowledge base dell&apos;azienda,
                pronti per generare il DVR.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card-luxury p-10 text-center text-ink-muted">Caricamento…</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 size={26} />}
            title="Nessuna azienda"
            description="Aggiungi prima un'azienda cliente, poi potrai avviare il sopralluogo."
            action={<Link href="/aziende/nuova" className="btn-primary"><Plus size={14} /> Nuova azienda</Link>}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  placeholder="Cerca l'azienda da visitare…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="input-luxury pl-11"
                />
              </div>
              <Link href="/aziende/nuova" className="btn-ghost"><Plus size={16} /> Nuova azienda</Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/sopralluogo?company=${c.id}`)}
                  className="card-luxury flex items-center gap-3 p-4 text-left transition-colors hover:bg-brand-50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{c.ragione_sociale}</p>
                    <p className="truncate text-[11px] text-ink-muted">ATECO {c.ateco}{c.sedi[0]?.comune ? ` · ${c.sedi[0].comune}` : ''}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-[13px] text-ink-muted">Nessuna azienda corrisponde alla ricerca.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
