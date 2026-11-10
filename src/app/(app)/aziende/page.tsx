'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { getDataSource } from '@/lib/data-source';
import type { Company, Dvr } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canCreate, canImport, canAssign } from '@/lib/permissions';
import { Building2, FileSpreadsheet, Plus, Search, Upload, UserPlus } from 'lucide-react';

export default function AziendePage() {
  const { user } = useAuth();
  const router = useRouter();
  const showImport = canImport(user?.role, 'companies');
  const showCreate = canCreate(user?.role, 'companies');
  const showAssignment = canAssign(user?.role, 'companies');
  const [aziende, setAziende] = useState<Company[]>([]);
  const [dvrs, setDvrs] = useState<Dvr[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState('');
  const [dimFilter, setDimFilter] = useState<'tutte' | 'micro' | 'piccola' | 'media' | 'grande'>('tutte');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const ds = getDataSource();
    Promise.all([ds.companies.list(), ds.dvr.list()])
      .then(([companies, allDvrs]) => {
        if (cancelled) return;
        // Per il datore di lavoro con una sola azienda: redirect diretto alla scheda.
        // È la sua sola "casa", evita di obbligarlo a passare da una lista con 1 record.
        if (user?.role === 'datore_lavoro' && companies.length === 1) {
          router.replace(`/aziende/scheda?id=${companies[0].id}`);
          return;
        }
        setAziende(companies);
        setDvrs(allDvrs);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, router, reloadKey]);

  const filtered = aziende.filter((a) => {
    const matchQ =
      !q ||
      a.ragione_sociale.toLowerCase().includes(q.toLowerCase()) ||
      a.ateco.includes(q) ||
      (a.ateco_label ?? '').toLowerCase().includes(q.toLowerCase()) ||
      (a.sedi[0]?.comune ?? '').toLowerCase().includes(q.toLowerCase());
    const matchDim = dimFilter === 'tutte' || a.dimensione === dimFilter;
    return matchQ && matchDim;
  });

  const aziendeConDvrAttivo = new Set(
    dvrs.filter((d) => d.status === 'approved').map((d) => d.company_id)
  ).size;

  const isDatoreLavoro = user?.role === 'datore_lavoro';

  return (
    <AppShell pageTitle={isDatoreLavoro ? 'La mia azienda' : 'Aziende clienti'}>
      <div className="space-y-5 animate-fade-up">
        {/* Toolbar: search + azioni */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Cerca per nome, ATECO, attività o comune…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-luxury pl-11"
            />
          </div>
          {showImport && (
            <Link
              href="/aziende/importa"
              className="btn-ghost"
              title="Carica più aziende insieme da un file Excel o CSV"
            >
              <Upload size={16} /> Importa da Excel
            </Link>
          )}
          {showCreate && (
            <Link
              href="/aziende/nuova"
              className="btn-primary"
              title="Compila l'anagrafica di una singola azienda"
            >
              <Plus size={16} /> Nuova azienda
            </Link>
          )}
        </div>

        {/* Contatore + filtro dimensione */}
        {!loading && aziende.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-muted">
              <strong className="text-ink">{filtered.length}</strong>
              {filtered.length === aziende.length ? '' : ` su ${aziende.length}`} {filtered.length === 1 ? 'azienda' : 'aziende'}
              {!isDatoreLavoro && aziendeConDvrAttivo > 0 && (
                <>
                  {' · '}
                  <strong className="text-ink">{aziendeConDvrAttivo}</strong> con DVR attivo
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {(['tutte', 'micro', 'piccola', 'media', 'grande'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDimFilter(d)}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize transition-colors ${
                    dimFilter === d ? 'bg-brand-gradient text-white' : 'text-ink-muted hover:bg-brand-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : loadError ? (
          <EmptyState
            icon={<Building2 size={26} />}
            title="Caricamento non riuscito"
            description="Non è stato possibile caricare le aziende. Controlla la connessione e riprova."
            action={
              <button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
                Riprova
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          aziende.length === 0 ? (
            isDatoreLavoro ? (
              <EmptyState
                icon={<Building2 size={28} />}
                title="Anagrafica azienda non ancora caricata"
                description="Il consulente RSPP del tuo studio sta completando l'anagrafica della tua azienda. Apparirà qui appena pronta."
              />
            ) : (
              <DualPathEmptyState showCreate={showCreate} showImport={showImport} />
            )
          ) : (
            <EmptyState
              icon={<Building2 size={28} />}
              title="Nessun risultato"
              description="Nessuna azienda corrisponde alla ricerca. Prova con un termine diverso."
            />
          )
        ) : (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] min-w-[720px]">
                <thead className="bg-brand-50/40">
                  <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
                    <th className="px-4 py-3 font-semibold">Azienda</th>
                    <th className="px-4 py-3 font-semibold">ATECO</th>
                    <th className="px-4 py-3 font-semibold">Dimensione</th>
                    <th className="px-4 py-3 font-semibold text-right">Lavoratori</th>
                    <th className="px-4 py-3 font-semibold">Sede</th>
                    <th className="px-4 py-3 font-semibold">DVR</th>
                    {showAssignment && (
                      <th className="hidden sm:table-cell px-4 py-3 font-semibold">Assegnazione</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {filtered.map((a) => {
                    const nDvr = dvrs.filter((d) => d.company_id === a.id).length;
                    return (
                      <tr key={a.id} className="group cursor-pointer hover:bg-brand-50/50">
                        <td className="px-4 py-3">
                          <Link href={`/aziende/scheda?id=${a.id}`} className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                              <Building2 size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ink group-hover:text-brand-700">{a.ragione_sociale}</span>
                              {a.ateco_label && <span className="block truncate text-[11px] text-ink-muted">{a.ateco_label}</span>}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{a.ateco}</td>
                        <td className="px-4 py-3">
                          <Badge variant={a.dimensione === 'grande' ? 'brand' : a.dimensione === 'media' ? 'info' : 'neutral'}>
                            {a.dimensione}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{a.lavoratori}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {a.sedi[0]?.comune ?? 'n.d.'}{a.sedi[0]?.provincia ? ` (${a.sedi[0].provincia})` : ''}
                        </td>
                        <td className="px-4 py-3">
                          {nDvr > 0 ? (
                            <Badge variant="success">{nDvr}</Badge>
                          ) : (
                            <span className="text-[11px] text-ink-muted">n.d.</span>
                          )}
                        </td>
                        {showAssignment && (
                          <td className="hidden sm:table-cell px-4 py-3">
                            {a.assigned_user_id ? (
                              <Badge variant="brand">Assegnata</Badge>
                            ) : (
                              <span className="text-[11px] text-ink-muted">Comune</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Empty state a due percorsi: caricamento singolo vs bulk Excel.
 * Aiuta il consulente a capire subito quale strada prendere in base al numero di clienti.
 */
function DualPathEmptyState({ showCreate, showImport }: { showCreate: boolean; showImport: boolean }) {
  // Se l'utente non ha permessi per nulla, fallback su empty state base.
  if (!showCreate && !showImport) {
    return (
      <EmptyState
        icon={<Building2 size={28} />}
        title="Nessuna azienda assegnata"
        description="Non hai aziende clienti nel tuo registro. Contatta il titolare dello studio."
      />
    );
  }

  return (
    <section className="card-luxury p-6 sm:p-8 space-y-6 animate-fade-up">
      <header className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100/80 text-brand-600">
          <Building2 size={28} />
        </div>
        <h2 className="mt-4 section-title text-[17px] text-ink">Inizia caricando le tue aziende</h2>
        <p className="mt-2 max-w-xl mx-auto text-[14px] text-ink-muted">
          Hai due strade. Scegli quella più comoda in base a quante aziende vuoi inserire ora.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {showCreate && (
          <article className="flex flex-col rounded-2xl border-2 border-brand-100 bg-white/80 p-5 transition-all hover:border-brand-300 hover:shadow-luxury-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <UserPlus size={22} />
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-ink">Una azienda alla volta</h3>
            <p className="mt-1 text-[13px] text-ink-muted">
              Compili l&apos;anagrafica passo per passo. Ideale se hai pochi clienti da inserire ora o per la prima azienda di prova.
            </p>
            <p className="mt-3 text-[12px] text-ink-soft">
              <strong className="text-ink">Tempo:</strong> circa 2 minuti per azienda.
            </p>
            <div className="mt-auto pt-4">
              <Link href="/aziende/nuova" className="btn-primary w-full justify-center">
                <Plus size={16} /> Aggiungi azienda
              </Link>
            </div>
          </article>
        )}

        {showImport && (
          <article className="flex flex-col rounded-2xl border-2 border-brand-100 bg-white/80 p-5 transition-all hover:border-brand-300 hover:shadow-luxury-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <FileSpreadsheet size={22} />
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-ink">Tutte insieme da Excel</h3>
            <p className="mt-1 text-[13px] text-ink-muted">
              Carichi un file con la lista clienti. Il sistema riconosce le colonne in automatico, ti mostra l&apos;anteprima e tu confermi.
            </p>
            <p className="mt-3 text-[12px] text-ink-soft">
              <strong className="text-ink">Tempo:</strong> circa 30 secondi per 50 aziende.
            </p>
            <div className="mt-auto pt-4">
              <Link href="/aziende/importa" className="btn-primary w-full justify-center">
                <Upload size={16} /> Importa da Excel
              </Link>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
