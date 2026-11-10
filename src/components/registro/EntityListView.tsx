'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Company, type DataSource } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can, canImport, type Entity } from '@/lib/permissions';
import { Upload, Search, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { EntityFormModal } from './EntityFormModal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { EntityFormField } from './entity-form';

export interface EntityColumn<T> {
  key: string;
  label: string;
  /** min-width hint sommato per la tabella (px). */
  render: (item: T) => ReactNode;
  className?: string;
}

export interface EntityListConfig<T> {
  /** Chiave permission (lib/permissions Entity). */
  entity: Entity;
  /** Icona grande per empty state. */
  icon: ReactNode;
  /** Selettore della collezione dal DataSource. */
  select: (ds: DataSource) => Promise<T[]>;
  /** Ordinamento opzionale (es. scadenze per data). */
  sort?: (a: T, b: T) => number;
  /** Stringa di ricerca per item. */
  searchText: (item: T) => string;
  searchPlaceholder: string;
  columns: EntityColumn<T>[];
  /** min-width della tabella, in px. */
  minWidth?: number;
  /** Route della pagina di import massivo. */
  importPath: string;
  importLabel: string;
  emptyTitle: string;
  /** Copy empty per chi NON puo' importare (datore di lavoro). */
  emptyReadOnly: string;
  /** Copy empty per chi puo' importare. */
  emptyImportable: string;
  // ----- CRUD manuale -----
  /** Etichetta singolare per i pulsanti (es. "lavoratore"). */
  singular: string;
  /** Campi del form CRUD (create/edit). */
  formFields: EntityFormField<T>[];
  /**
   * true se l'entita richiede il collegamento a un'azienda. Per lavoratori e
   * attrezzature il select azienda e' OBBLIGATORIO (company_id required nel
   * backend); per le altre e' opzionale (companyRequired=false).
   */
  needsCompany: boolean;
  /** company_id obbligatorio (default: = needsCompany). */
  companyRequired?: boolean;
  /**
   * Accesso CRUD al data source per questa entita. Restituisce la sub-resource
   * del DataSource (es. ds.lavoratori) che espone create/update/delete.
   */
  crud: (ds: DataSource) => EntityCrud<T>;
}

/** Facade CRUD minimale richiesta da EntityListView (compatibile con le sub-resource del DataSource). */
export interface EntityCrud<T> {
  create: (data: Omit<T, 'id' | 'created_at' | 'created_by'>) => Promise<T>;
  update: (id: number, patch: Partial<T>) => Promise<T>;
  delete: (id: number) => Promise<void>;
}

/**
 * Vista lista generica per le entita del registro aziendale (lavoratori, DPI,
 * attrezzature, formazione, scadenze). Sostituisce 5 pagine quasi identiche.
 * Search + import gating per ruolo + tabella + empty state coerenti.
 */
export function EntityListView<T extends { id: number }>({
  config,
  /** Se true non mostra il bottone import in toolbar (es. dentro un hub a tab). */
  hideImportButton = false,
}: {
  config: EntityListConfig<T>;
  hideImportButton?: boolean;
}) {
  const { user } = useAuth();
  const role = user?.role;
  const showImport = canImport(role, config.entity);
  const canCreate = can(role, config.entity, 'create');
  const canUpdate = can(role, config.entity, 'update');
  const canDelete = can(role, config.entity, 'delete');
  const hasRowActions = canUpdate || canDelete;
  const companyRequired = config.companyRequired ?? config.needsCompany;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);

  // Stato modale CRUD: null = chiuso; { record: null } = create; record = edit.
  const [modal, setModal] = useState<{ record: T | null } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await config.select(getDataSource());
      const sorted = config.sort ? [...list].sort(config.sort) : list;
      setItems(sorted);
    } catch {
      // best-effort: lascia la lista corrente, niente crash.
    }
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    config
      .select(getDataSource())
      .then((list) => {
        if (cancelled) return;
        const sorted = config.sort ? [...list].sort(config.sort) : list;
        setItems(sorted);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, reloadKey]);

  // Aziende per il select (best-effort, solo se serve).
  useEffect(() => {
    if (!config.needsCompany) return;
    let cancelled = false;
    getDataSource()
      .companies.list()
      .then((list) => {
        if (!cancelled) setCompanies(list);
      })
      .catch(() => {
        /* select restera vuoto -> avviso "crea prima un'azienda" */
      });
    return () => {
      cancelled = true;
    };
  }, [config.needsCompany]);

  const handleSubmit = useCallback(
    async (payload: Partial<T>) => {
      const ops = config.crud(getDataSource());
      if (modal?.record) {
        await ops.update(modal.record.id, payload);
      } else {
        // Il payload e' costruito dai formFields obbligatori del config: a
        // runtime contiene i campi required, ma TS lo vede come Partial<T>.
        await ops.create(payload as Omit<T, 'id' | 'created_at' | 'created_by'>);
      }
      await refresh();
      setModal(null);
    },
    [config, modal, refresh]
  );

  const handleDelete = useCallback(
    async (item: T) => {
      if (deletingId !== null) return;
      const ok = window.confirm(
        `Eliminare definitivamente questo elemento (${config.singular})? L’operazione non è reversibile.`
      );
      if (!ok) return;
      setDeletingId(item.id);
      try {
        await config.crud(getDataSource()).delete(item.id);
        await refresh();
      } catch (err) {
        window.alert(
          err instanceof Error
            ? `Eliminazione non riuscita: ${err.message}`
            : 'Eliminazione non riuscita. Riprova.'
        );
      } finally {
        setDeletingId(null);
      }
    },
    [config, deletingId, refresh]
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (x) => !q || config.searchText(x).toLowerCase().includes(q.toLowerCase())
      ),
    [items, q, config]
  );

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1" style={{ minWidth: '0' }}>
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder={config.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-luxury pl-11"
          />
        </div>
        {showImport && !hideImportButton && (
          <Link href={config.importPath} className="btn-ghost shrink-0">
            <Upload size={16} /> <span className="hidden sm:inline">Import massivo</span><span className="sm:hidden">Import</span>
          </Link>
        )}
        {canCreate && (
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={() => setModal({ record: null })}
          >
            <Plus size={16} /> Nuovo
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={config.columns.length} />
      ) : loadError ? (
        <EmptyState
          icon={config.icon}
          title="Caricamento non riuscito"
          description="Controlla la connessione e riprova."
          action={
            <button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
              Riprova
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={items.length === 0 ? config.emptyTitle : 'Nessun risultato'}
          description={
            items.length === 0 && !showImport
              ? config.emptyReadOnly
              : items.length === 0
                ? config.emptyImportable
                : 'Nessun elemento corrisponde alla ricerca.'
          }
          action={
            items.length === 0 && (canCreate || (showImport && !hideImportButton)) ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {canCreate && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setModal({ record: null })}
                  >
                    <Plus size={16} /> Nuovo {config.singular}
                  </button>
                )}
                {showImport && !hideImportButton && (
                  <Link href={config.importPath} className="btn-ghost">
                    <Upload size={16} /> {config.importLabel}
                  </Link>
                )}
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="card-luxury overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-[13px]"
              style={{ minWidth: config.minWidth ?? 640 }}
            >
              <thead className="bg-brand-50/40">
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  {config.columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-semibold">
                      {c.label}
                    </th>
                  ))}
                  {hasRowActions && (
                    <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtered.map((x) => (
                  <tr key={x.id}>
                    {config.columns.map((c) => (
                      <td key={c.key} className={c.className ?? 'px-4 py-3 text-ink'}>
                        {c.render(x)}
                      </td>
                    ))}
                    {hasRowActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <button
                              type="button"
                              className="btn-icon"
                              aria-label={`Modifica ${config.singular}`}
                              title="Modifica"
                              onClick={() => setModal({ record: x })}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn-icon hover:text-danger-mark"
                              aria-label={`Elimina ${config.singular}`}
                              title="Elimina"
                              disabled={deletingId === x.id}
                              onClick={() => handleDelete(x)}
                            >
                              {deletingId === x.id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(canCreate || canUpdate) && modal !== null && (
        <EntityFormModal<T>
          open
          title={
            modal.record
              ? `Modifica ${config.singular}`
              : `Nuovo ${config.singular}`
          }
          fields={config.formFields}
          record={modal.record}
          needsCompany={config.needsCompany}
          companyRequired={companyRequired}
          companies={companies}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
