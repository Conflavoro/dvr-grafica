'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { EntityFormModal } from '@/components/registro/EntityFormModal';
import { lavoratoriConfig } from '@/components/registro/configs';
import { getDataSource, type Lavoratore } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can, canImport } from '@/lib/permissions';
import { LAVORATORE_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';
import { Users, Upload, Plus, Pencil, Trash2, Loader2, Search, X } from 'lucide-react';

/**
 * Gestione lavoratori INLINE nel workspace azienda: aggiunta manuale + import
 * Excel/CSV + modifica/elimina, tutto senza uscire dalla scheda azienda
 * (company_id pre-impostato). Mobile-first. Permission-gated per ruolo.
 */
export function TabLavoratori({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { user } = useAuth();
  const role = user?.role;
  const showImportBtn = canImport(role, 'lavoratori');
  const canCreate = can(role, 'lavoratori', 'create');
  const canUpdate = can(role, 'lavoratori', 'update');
  const canDelete = can(role, 'lavoratori', 'delete');
  const hasRowActions = canUpdate || canDelete;

  const [items, setItems] = useState<Lavoratore[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  // null = chiuso; { record: null } = nuovo; record = modifica.
  const [modal, setModal] = useState<{ record: Lavoratore | null } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    return getDataSource()
      .lavoratori.list({ companyId })
      .then((list) => setItems(list))
      .catch(() => {
        /* best-effort, niente crash */
      });
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDataSource()
      .lavoratori.list({ companyId })
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleSubmit = useCallback(
    async (payload: Partial<Lavoratore>) => {
      const ds = getDataSource();
      if (modal?.record) {
        await ds.lavoratori.update(modal.record.id, payload);
      } else {
        await ds.lavoratori.create({
          ...payload,
          company_id: companyId,
        } as Omit<Lavoratore, 'id' | 'created_at' | 'created_by'>);
      }
      await refresh();
      setModal(null);
    },
    [modal, companyId, refresh]
  );

  const handleDelete = useCallback(
    async (item: Lavoratore) => {
      if (deletingId !== null) return;
      if (!window.confirm(`Eliminare ${item.cognome} ${item.nome} dal registro lavoratori? L’operazione non è reversibile.`)) return;
      setDeletingId(item.id);
      try {
        await getDataSource().lavoratori.delete(item.id);
        await refresh();
      } catch (err) {
        window.alert(err instanceof Error ? `Eliminazione non riuscita: ${err.message}` : 'Eliminazione non riuscita.');
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, refresh]
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (x) => !q || `${x.nome} ${x.cognome} ${x.mansione}`.toLowerCase().includes(q.toLowerCase())
      ),
    [items, q]
  );

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  return (
    <div className="space-y-4">
      {/* Toolbar: ricerca + import + aggiungi */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder="Cerca per nome o mansione…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-luxury pl-11"
          />
        </div>
        {showImportBtn && (
          <button
            type="button"
            className={`btn-ghost ${importing ? 'border-brand-500 text-brand-700' : ''}`}
            onClick={() => setImporting((v) => !v)}
          >
            {importing ? <X size={16} /> : <Upload size={16} />} {importing ? 'Chiudi import' : 'Importa Excel/CSV'}
          </button>
        )}
        {canCreate && (
          <button type="button" className="btn-primary" onClick={() => setModal({ record: null })}>
            <Plus size={16} /> Aggiungi lavoratore
          </button>
        )}
      </div>

      {/* Import massivo inline (azienda gia' impostata) */}
      {importing && showImportBtn && (
        <div className="card-luxury p-4">
          <BulkImportPanel<Lavoratore, Lavoratore>
            fields={LAVORATORE_FIELDS}
            buildRow={(row, mappings, n) => {
              const r = buildEntityFromRow<Lavoratore>(row, mappings, LAVORATORE_FIELDS, n);
              if (r.ok && r.data) return { ok: true, row: n, data: { ...r.data, company_id: companyId } as Lavoratore };
              return r as never;
            }}
            saveOne={async (data) => {
              await getDataSource().lavoratori.create(data);
            }}
            dedupe={{
              uniqueKey: (d) => {
                if (d.codice_fiscale) return `cf:${d.codice_fiscale.toUpperCase()}`;
                if (d.nome && d.cognome && d.company_id) return `nm:${d.nome.toLowerCase()}_${d.cognome.toLowerCase()}_${d.company_id}`;
                return null;
              },
              list: () => getDataSource().lavoratori.list() as never,
              update: (id, patch) => getDataSource().lavoratori.update(id, patch as Partial<Lavoratore>),
              matchLabel: 'codice fiscale (o nome+cognome+azienda)',
            }}
            previewColumns={[
              { key: 'nome', label: 'Nome' },
              { key: 'cognome', label: 'Cognome' },
              { key: 'mansione', label: 'Mansione' },
              { key: 'codice_fiscale', label: 'CF' },
            ]}
            title={`Carica lavoratori di ${companyName}`}
            hint="Excel/CSV. Headers riconosciuti: nome · cognome · codice fiscale · mansione/ruolo · data assunzione · idoneità sanitaria · formazione svolta (CSV) · DPI assegnati (CSV)."
            successMessageTitle="lavoratori"
            onImported={() => {
              void refresh();
            }}
          />
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="Nessun lavoratore registrato"
            description={
              canCreate
                ? `Aggiungi i lavoratori di ${companyName} manualmente o importali da Excel/CSV. Per ognuno: nome, cognome, mansione, idoneità, formazione, DPI.`
                : `Il registro lavoratori di ${companyName} sarà disponibile non appena il consulente RSPP lo avrà caricato.`
            }
            action={
              canCreate ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button type="button" className="btn-primary" onClick={() => setModal({ record: null })}>
                    <Plus size={14} /> Aggiungi lavoratore
                  </button>
                  {showImportBtn && (
                    <button type="button" className="btn-ghost" onClick={() => setImporting(true)}>
                      <Upload size={14} /> Importa da Excel/CSV
                    </button>
                  )}
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="card-luxury p-8 text-center text-ink-muted">Nessun lavoratore corrisponde alla ricerca.</div>
        )
      ) : (
        <div className="card-luxury overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[600px]">
              <thead className="bg-brand-50/40">
                <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Nominativo</th>
                  <th className="px-4 py-3 font-semibold">Mansione</th>
                  <th className="px-4 py-3 font-semibold">Idoneità</th>
                  <th className="px-4 py-3 font-semibold">Formazione</th>
                  {hasRowActions && <th className="px-4 py-3 text-right font-semibold">Azioni</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtered.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3 font-semibold text-ink">{x.cognome} {x.nome}</td>
                    <td className="px-4 py-3 text-ink">{x.mansione}</td>
                    <td className="px-4 py-3">
                      {x.idoneita_sanitaria_data ? (
                        <Badge variant="success">{x.idoneita_sanitaria_data}</Badge>
                      ) : (
                        <Badge variant="neutral">non registrata</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {x.formazione_svolta?.length ? `${x.formazione_svolta.length} corsi` : 'da pianificare'}
                    </td>
                    {hasRowActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <button
                              type="button"
                              className="btn-icon"
                              aria-label="Modifica lavoratore"
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
                              aria-label="Elimina lavoratore"
                              title="Elimina"
                              disabled={deletingId === x.id}
                              onClick={() => handleDelete(x)}
                            >
                              {deletingId === x.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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

      {/* Modale create/edit (azienda implicita = questa) */}
      {(canCreate || canUpdate) && modal !== null && (
        <EntityFormModal<Lavoratore>
          open
          title={modal.record ? 'Modifica lavoratore' : `Nuovo lavoratore · ${companyName}`}
          fields={lavoratoriConfig.formFields}
          record={modal.record}
          needsCompany={false}
          companyRequired={false}
          companies={[]}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
