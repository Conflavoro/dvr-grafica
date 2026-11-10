'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, FileText, Plus, Search, Upload } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Company, type Dvr } from '@/lib/data-source';

interface CompanyPickerProps {
  /** Callback quando l'utente sceglie un'azienda + template (opzionale). */
  onPick: (companyId: number, templateDvrId: number | null) => void;
  /** Callback per "anagrafica nuova" (crea azienda durante il wizard). */
  onNewCompany: () => void;
  canCreateCompany: boolean;
}

interface CompanyWithDvrs extends Company {
  dvrs: Dvr[];
}

export function CompanyPicker({ onPick, onNewCompany, canCreateCompany }: CompanyPickerProps) {
  const [items, setItems] = useState<CompanyWithDvrs[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const ds = getDataSource();
    Promise.all([ds.companies.list(), ds.dvr.list()]).then(([companies, dvrs]) => {
      const dvrsByCompany = new Map<number, Dvr[]>();
      for (const d of dvrs) {
        const arr = dvrsByCompany.get(d.company_id) ?? [];
        arr.push(d);
        dvrsByCompany.set(d.company_id, arr);
      }
      const enriched = companies.map((c) => ({
        ...c,
        dvrs: (dvrsByCompany.get(c.id) ?? []).sort((a, b) => b.versione - a.versione),
      }));
      setItems(enriched);
      setLoading(false);
    });
  }, []);

  const filtered = items.filter((a) =>
    !q || `${a.ragione_sociale} ${a.ateco} ${a.partita_iva}`.toLowerCase().includes(q.toLowerCase())
  );

  if (loading) {
    return <div className="card-luxury p-10 text-center text-ink-muted">Caricamento aziende in corso.</div>;
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Hero: due percorsi chiari per iniziare */}
      <section className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <IconaAi size={16} className="text-brand-600" />
          <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Inizia il nuovo DVR</strong>
        </div>
        <p className="text-[13px] text-ink-soft">
          Scegli una <strong>azienda esistente</strong> dal tuo registro (qui sotto), oppure crea una <strong>nuova anagrafica</strong> al volo: i dati verranno salvati insieme al DVR.
        </p>
        {canCreateCompany && (
          <p className="mt-2 text-[12px] text-ink-muted">
            Hai già una versione precedente del DVR? Puoi replicarla e aggiornare solo i campi cambiati, oppure ripartire da zero.
          </p>
        )}
      </section>

      {/* Toolbar: search + creazione/import */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder="Cerca azienda per nome, P.IVA o ATECO"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-luxury pl-11"
          />
        </div>
        {canCreateCompany && (
          <button
            type="button"
            onClick={onNewCompany}
            className="btn-ghost"
            title="Crea una nuova anagrafica direttamente nel wizard"
          >
            <Plus size={16} /> Nuova anagrafica
          </button>
        )}
        {canCreateCompany && (
          <Link
            href="/aziende/importa"
            className="btn-ghost"
            title="Carica più aziende insieme da un file Excel"
          >
            <Upload size={16} /> Importa da Excel
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title={items.length === 0 ? 'Nessuna azienda nel registro' : 'Nessun risultato'}
          description={
            items.length === 0
              ? canCreateCompany
                ? 'Non hai ancora aziende nel registro. Puoi crearne una al volo per questo DVR, oppure tornare alla sezione Aziende per caricarne diverse insieme da Excel.'
                : 'Nessuna azienda assegnata. Contatta il titolare dello studio.'
              : 'Nessuna azienda corrisponde alla ricerca. Prova con un termine diverso.'
          }
          action={
            items.length === 0 && canCreateCompany ? (
              <button type="button" onClick={onNewCompany} className="btn-primary">
                <Plus size={16} /> Crea anagrafica al volo
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <article key={a.id} className="card-luxury p-5">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-ink truncate">{a.ragione_sociale}</h3>
                    <p className="text-[11px] text-ink-muted truncate">
                      P.IVA {a.partita_iva} · ATECO {a.ateco}
                    </p>
                  </div>
                </div>
                <Badge variant={a.dimensione === 'grande' ? 'brand' : a.dimensione === 'media' ? 'info' : 'neutral'}>{a.dimensione}</Badge>
              </header>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <dt className="label-upper">Lavoratori</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-ink">{a.lavoratori}</dd>
                </div>
                <div>
                  <dt className="label-upper">Sede</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-ink truncate">{a.sedi[0]?.comune ?? 'da definire'}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-brand-100 pt-3">
                {a.dvrs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onPick(a.id, null)}
                    className="btn-primary w-full"
                    title="Crea il primo DVR per questa azienda, partendo da un wizard guidato"
                  >
                    <FileText size={14} /> Crea primo DVR
                  </button>
                ) : (
                  <>
                    <p className="label-upper mb-2">
                      Ha già {a.dvrs.length} {a.dvrs.length === 1 ? 'DVR' : 'DVR'}. Come procedere?
                    </p>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => onPick(a.id, a.dvrs[0].id)}
                        className="btn-primary w-full justify-start text-[12px]"
                        title="Parti dai contenuti della versione precedente, aggiorna solo ciò che è cambiato"
                      >
                        <IconaAi size={13} /> Replica v.{a.dvrs[0].versione}, crea v.{a.dvrs[0].versione + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPick(a.id, null)}
                        className="btn-ghost w-full justify-start text-[12px]"
                        title="Compila tutte le sezioni da capo, ignorando i DVR precedenti"
                      >
                        <Plus size={13} /> Crea v.{a.dvrs[0].versione + 1} da zero
                      </button>
                      {a.dvrs.length > 1 && (
                        <details className="group rounded-lg border border-brand-100 bg-white/40">
                          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-ink-muted hover:text-brand-700">
                            <span className="inline-flex items-center gap-1">
                              <span className="transition-transform group-open:rotate-90">›</span>
                              Vedi altre {a.dvrs.length - 1} versioni precedenti
                            </span>
                          </summary>
                          <ul className="border-t border-brand-100 px-2 py-1 space-y-1">
                            {a.dvrs.slice(1).map((d) => (
                              <li key={d.id}>
                                <button
                                  type="button"
                                  onClick={() => onPick(a.id, d.id)}
                                  className="w-full text-left rounded-lg px-2 py-1 text-[11px] text-ink-muted hover:bg-brand-50/60 hover:text-brand-700"
                                >
                                  Replica v.{d.versione} ({d.data_creazione.slice(0, 10)})
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
