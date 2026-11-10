'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StudioFormModal, type StudioFormResult } from '@/components/tenants/StudioFormModal';
import { getDataSource, type Studio } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, canCreate, canEdit, canDelete } from '@/lib/permissions';
import { Network, Upload, Search, Plus, Pencil, Trash2 } from 'lucide-react';

export default function TenantsPage() {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'studi');
  const showCreate = canCreate(user?.role, 'studi');
  const showEdit = canEdit(user?.role, 'studi');
  const showDelete = canDelete(user?.role, 'studi');

  const [items, setItems] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Studio | null>(null);
  const [toDelete, setToDelete] = useState<Studio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await getDataSource().studi.list().catch(() => [] as Studio[]);
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((s: Studio) => {
    setEditing(s);
    setFormOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (result: StudioFormResult): Promise<void> => {
      const ds = getDataSource();
      if (editing) {
        await ds.studi.update(editing.id, { ragione_sociale: result.ragione_sociale, plan: result.plan });
      } else {
        await ds.studi.create({
          ragione_sociale: result.ragione_sociale,
          plan: result.plan,
          partita_iva: '',
          email_referente: '',
          attivo: true,
        });
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    },
    [editing, reload]
  );

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await getDataSource().studi.delete(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (e) {
      // Il backend può rispondere 422 quando lo studio ha collegamenti (utenti/aziende).
      setDeleteError(
        e instanceof Error
          ? e.message
          : 'Impossibile eliminare lo studio: potrebbe avere consulenti o aziende collegate.'
      );
    } finally {
      setDeleting(false);
    }
  }, [toDelete, reload]);

  const filtered = items.filter(
    (s) =>
      !q ||
      `${s.ragione_sociale} ${s.partita_iva} ${s.email_referente} ${s.comune ?? ''} ${s.codice_studio ?? ''}`
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  return (
    <AppShell pageTitle="Studi affiliati">
      <div className="space-y-5 animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Cerca per ragione sociale, P.IVA, email, codice…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-luxury pl-11"
            />
          </div>
          {showImport && (
            <Link href="/tenants/importa" className="btn-ghost">
              <Upload size={16} /> Import massivo
            </Link>
          )}
          {showCreate && (
            <button type="button" onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Nuovo studio
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Network size={28} />}
            title={items.length === 0 ? 'Nessuno studio affiliato' : 'Nessun risultato'}
            description={
              items.length === 0
                ? showCreate
                  ? 'Crea il primo studio consulenza affiliato a Conflavoro PMI, oppure importali massivamente da Excel/CSV.'
                  : 'L\'elenco degli studi affiliati è gestito da admin Conflavoro PMI.'
                : 'Nessuno studio corrisponde alla ricerca.'
            }
            action={
              items.length === 0 && showCreate ? (
                <button type="button" onClick={openCreate} className="btn-primary">
                  <Plus size={16} /> Nuovo studio
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <div key={s.id} className="card-luxury p-5">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                    <Network size={18} />
                  </div>
                  <div className="flex items-center gap-2">
                    {s.plan && <Badge variant="brand">{s.plan}</Badge>}
                    <Badge variant={s.attivo ? 'success' : 'neutral'}>{s.attivo ? 'attivo' : 'inattivo'}</Badge>
                  </div>
                </header>
                <h3 className="mt-3 text-[15px] font-bold text-ink truncate">{s.ragione_sociale}</h3>
                <p className="text-[12px] text-ink-muted truncate">
                  {s.email_referente || (s.codice_studio ? `Codice ${s.codice_studio}` : 'n.d.')}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <dt className="label-upper">{s.partita_iva ? 'P.IVA' : 'Codice'}</dt>
                    <dd className="mt-0.5 font-mono text-[12px] text-ink truncate">
                      {s.partita_iva || s.codice_studio || 'n.d.'}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-upper">Sede</dt>
                    <dd className="mt-0.5 text-[13px] font-semibold text-ink truncate">
                      {s.comune ?? 'n.d.'} {s.provincia ? `(${s.provincia})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-upper">Consulenti</dt>
                    <dd className="mt-0.5 text-[14px] font-semibold text-ink">{s.numero_consulenti ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="label-upper">Aziende</dt>
                    <dd className="mt-0.5 text-[14px] font-semibold text-ink">{s.numero_aziende_clienti ?? 0}</dd>
                  </div>
                </dl>

                {(showEdit || showDelete) && (
                  <div className="mt-4 flex items-center justify-end gap-1 border-t border-brand-100 pt-3">
                    {showEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="btn-icon"
                        aria-label={`Modifica ${s.ragione_sociale}`}
                        title="Modifica"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        onClick={() => setToDelete(s)}
                        className="btn-icon text-danger-mark hover:bg-danger"
                        aria-label={`Elimina ${s.ragione_sociale}`}
                        title="Elimina"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <StudioFormModal
        open={formOpen}
        record={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminare lo studio?"
        message={
          toDelete
            ? `Lo studio "${toDelete.ragione_sociale}" verrà eliminato. Se ha consulenti o aziende collegate l'operazione sarà rifiutata.`
            : ''
        }
        confirmLabel="Elimina"
        destructive
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setToDelete(null);
          setDeleteError(null);
        }}
      />
    </AppShell>
  );
}
