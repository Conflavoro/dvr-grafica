'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { getDataSource, type Company, type Dvr, type UtenteStudio } from '@/lib/data-source';
import { MembroFormModal, type MembroFormResult } from '@/components/team/MembroFormModal';
import { TempPasswordNotice } from '@/components/team/TempPasswordNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Users, Upload, ShieldCheck, Building2, FileText, UserPlus, Pencil, Trash2 } from 'lucide-react';

interface ConsulenteStats extends UtenteStudio {
  aziendeAssegnate: number;
  dvrGenerati: number;
  dvrInRevisione: number;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [consulenti, setConsulenti] = useState<ConsulenteStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dvrs, setDvrs] = useState<Dvr[]>([]);
  const [loading, setLoading] = useState(true);

  // Stato modale form (creazione / modifica) + avviso password temporanea + conferma rimozione.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UtenteStudio | null>(null);
  const [tempPassword, setTempPassword] = useState<{ nome: string; email: string; password: string } | null>(null);
  const [toRemove, setToRemove] = useState<UtenteStudio | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setAllowed(can(user.role, 'team', 'read'));
      // Gestione team (CRUD utenti) riservata a chi può scrivere sull'entità utenti.
      setCanManage(can(user.role, 'utenti', 'create'));
    }
  }, [user]);

  const buildStats = useCallback(
    (utenti: UtenteStudio[], comps: Company[], allDvr: Dvr[]): ConsulenteStats[] =>
      utenti.map((u) => {
        const aziendeAssegnate = comps.filter(
          (c) => (c.created_by ?? 0) % Math.max(utenti.length, 1) === u.id % Math.max(utenti.length, 1)
        ).length;
        const dvrGenerati = allDvr.filter((d) => d.created_by === u.id).length;
        const dvrInRevisione = allDvr.filter(
          (d) => d.created_by === u.id && (d.status === 'review' || d.status === 'draft')
        ).length;
        return { ...u, aziendeAssegnate, dvrGenerati, dvrInRevisione };
      }),
    []
  );

  const reload = useCallback(async () => {
    const ds = getDataSource();
    const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
    const [utenti, comps, allDvr] = await Promise.all([
      safe(ds.utenti.list()),
      safe(ds.companies.list()),
      safe(ds.dvr.list()),
    ]);
    setConsulenti(buildStats(utenti, comps, allDvr));
    setCompanies(comps);
    setDvrs(allDvr);
    setLoading(false);
  }, [buildStats]);

  useEffect(() => {
    if (!allowed) return;
    void reload();
  }, [allowed, reload]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((u: UtenteStudio) => {
    setEditing(u);
    setFormOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (result: MembroFormResult): Promise<void> => {
      const ds = getDataSource();
      if (result.mode === 'create') {
        const created = await ds.utenti.create({
          studio_id: user?.tenant_id ?? 0,
          nome: result.nome,
          cognome: result.cognome,
          email: result.email,
          ruolo: result.ruolo,
          attivo: true,
          password: result.password,
        });
        if (created.password_temporanea) {
          setTempPassword({
            nome: `${created.nome} ${created.cognome}`.trim(),
            email: created.email,
            password: created.password_temporanea,
          });
        }
      } else {
        await ds.utenti.update(result.id, {
          nome: result.nome,
          cognome: result.cognome,
          ruolo: result.ruolo,
          attivo: result.attivo,
        });
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    },
    [user?.tenant_id, reload]
  );

  const confirmRemove = useCallback(async () => {
    if (!toRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await getDataSource().utenti.delete(toRemove.id);
      setToRemove(null);
      await reload();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'Rimozione non riuscita.');
    } finally {
      setRemoving(false);
    }
  }, [toRemove, reload]);

  if (allowed === null || loading) {
    return (
      <AppShell pageTitle="Team">
        <TableSkeleton rows={5} cols={4} />
      </AppShell>
    );
  }

  if (!allowed) {
    return (
      <AppShell pageTitle="Team">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <ShieldCheck size={32} className="mx-auto text-warn-mark mb-3" />
          <h3 className="section-title text-[17px] text-warn-ink">Accesso riservato</h3>
          <p className="mt-2 text-[13px] text-ink-soft">
            La gestione del team consulenti è prerogativa del Titolare studio.
          </p>
        </div>
      </AppShell>
    );
  }

  const titolari = consulenti.filter((u) => u.ruolo === 'titolare_studio');
  const operativi = consulenti.filter((u) => u.ruolo === 'consulente');

  return (
    <AppShell pageTitle="Team & assegnazioni">
      <div className="space-y-5 animate-fade-up">
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 text-[13px] text-ink-soft">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-brand-600" />
            <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Workflow studio · 2-step</strong>
          </div>
          <p>
            <strong>Tu</strong> (titolare) assegni le aziende ai consulenti. I consulenti preparano i DVR
            (status <em>review</em>) e tu li approvi in via definitiva (status <em>approved</em>). La firma
            finale resta a tua responsabilità ai sensi del D.Lgs. 81/08 art. 28.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            <KpiBox label="Consulenti attivi" value={operativi.filter((c) => c.attivo).length} icon={<Users size={18} />} />
            <KpiBox label="Aziende clienti" value={companies.length} icon={<Building2 size={18} />} />
            <KpiBox
              label="DVR in revisione"
              value={consulenti.reduce((s, c) => s + c.dvrInRevisione, 0)}
              icon={<FileText size={18} />}
              variant="warning"
            />
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/utenti/importa" className="btn-ghost">
              <Upload size={16} /> Importa da Excel
            </Link>
            <button type="button" onClick={openCreate} className="btn-primary">
              <UserPlus size={16} /> Aggiungi consulente
            </button>
          </div>
        )}

        {consulenti.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="Nessun consulente ancora"
            description={
              user?.studio_code
                ? `Aggiungi il primo consulente, condividi il codice studio (${user.studio_code}) per farli unire, oppure importali da Excel/CSV.`
                : 'Aggiungi il primo consulente del tuo studio, oppure importali massivamente da Excel/CSV.'
            }
            action={
              canManage ? (
                <button type="button" onClick={openCreate} className="btn-primary">
                  <UserPlus size={16} /> Aggiungi consulente
                </button>
              ) : (
                <Link href="/utenti/importa" className="btn-primary">
                  <Upload size={16} /> Importa consulenti
                </Link>
              )
            }
          />
        ) : (
          <>
            {titolari.length > 0 && (
              <section className="card-luxury p-5">
                <h3 className="section-title text-[17px] mb-4">Titolari</h3>
                <ul className="divide-y divide-brand-100">
                  {titolari.map((c) => (
                    <ConsulenteRow
                      key={c.id}
                      c={c}
                      canManage={canManage}
                      isSelf={isSameUser(user, c)}
                      onEdit={openEdit}
                      onRemove={setToRemove}
                    />
                  ))}
                </ul>
              </section>
            )}

            <section className="card-luxury p-5">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="section-title text-[17px]">Consulenti operativi</h3>
                {canManage && (
                  <button type="button" onClick={openCreate} className="btn-ghost text-[12px]">
                    <UserPlus size={14} /> Aggiungi
                  </button>
                )}
              </header>
              {operativi.length === 0 ? (
                <p className="text-[13px] text-ink-muted text-center py-8">
                  Nessun consulente operativo. {canManage ? 'Aggiungine uno o importa il team da Excel.' : 'Importa il team da Excel.'}
                </p>
              ) : (
                <ul className="divide-y divide-brand-100">
                  {operativi.map((c) => (
                    <ConsulenteRow
                      key={c.id}
                      c={c}
                      canManage={canManage}
                      isSelf={isSameUser(user, c)}
                      onEdit={openEdit}
                      onRemove={setToRemove}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="card-luxury p-5 border-l-4 border-brand-400">
              <h3 className="section-title text-[17px] mb-2">Riassegnazione aziende</h3>
              <p className="text-[13px] text-ink-soft mb-3">
                La riassegnazione drag-drop di aziende tra consulenti sarà attivata insieme al backend
                Laravel post-cPanel (tabella <code className="text-[11px] bg-brand-50 px-1 rounded">assignments</code>).
                Per ora l&apos;assegnazione segue il flusso naturale: il consulente che importa
                l&apos;azienda ne diventa owner.
              </p>
            </section>
          </>
        )}
      </div>

      <MembroFormModal
        open={formOpen}
        record={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {tempPassword && (
        <TempPasswordNotice
          nome={tempPassword.nome}
          email={tempPassword.email}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
        />
      )}

      <ConfirmDialog
        open={!!toRemove}
        title="Rimuovere il consulente?"
        message={
          toRemove
            ? `${toRemove.cognome} ${toRemove.nome} (${toRemove.email}) non avrà più accesso allo studio. L'azione è irreversibile.`
            : ''
        }
        confirmLabel="Rimuovi"
        destructive
        busy={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          setToRemove(null);
          setRemoveError(null);
        }}
      />
    </AppShell>
  );
}

/** Confronta l'utente loggato col membro: usato per non rimuovere se stessi. */
function isSameUser(user: { id: number; email: string } | null | undefined, c: UtenteStudio): boolean {
  if (!user) return false;
  return user.id === c.id || user.email.toLowerCase() === c.email.toLowerCase();
}

function ConsulenteRow({
  c,
  canManage,
  isSelf,
  onEdit,
  onRemove,
}: {
  c: ConsulenteStats;
  canManage: boolean;
  isSelf: boolean;
  onEdit: (u: UtenteStudio) => void;
  onRemove: (u: UtenteStudio) => void;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white text-[13px] font-bold">
        {c.nome[0]}
        {c.cognome[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink truncate">
          {c.cognome} {c.nome}
          {isSelf && <span className="ml-2 text-[10px] uppercase tracking-wider2 text-brand-500">tu</span>}
        </p>
        <p className="text-[11px] text-ink-muted truncate">
          {c.email}
          {c.iscrizione_albo ? ` · Albo ${c.iscrizione_albo}` : ''}
          {c.qualifica ? ` · ${c.qualifica}` : ''}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-3 text-[12px]">
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-ink">{c.aziendeAssegnate}</p>
          <p className="text-[10px] uppercase tracking-wider2 text-ink-muted">aziende</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-ink">{c.dvrGenerati}</p>
          <p className="text-[10px] uppercase tracking-wider2 text-ink-muted">DVR</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className={`font-bold ${c.dvrInRevisione > 0 ? 'text-warn-ink' : 'text-ink-muted'}`}>{c.dvrInRevisione}</p>
          <p className="text-[10px] uppercase tracking-wider2 text-ink-muted">in revisione</p>
        </div>
      </div>
      <Badge variant={c.attivo ? 'success' : 'neutral'}>{c.attivo ? 'attivo' : 'inattivo'}</Badge>
      {canManage && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(c)}
            className="btn-icon"
            aria-label={`Modifica ${c.nome} ${c.cognome}`}
            title="Modifica"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(c)}
            disabled={isSelf}
            className="btn-icon text-danger-mark hover:bg-danger disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={isSelf ? 'Non puoi rimuovere te stesso' : `Rimuovi ${c.nome} ${c.cognome}`}
            title={isSelf ? 'Non puoi rimuovere te stesso' : 'Rimuovi'}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

function KpiBox({
  label,
  value,
  icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning';
}) {
  return (
    <div className={`card-luxury p-4 ${variant === 'warning' && value > 0 ? 'border-warn bg-warn/40' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="label-upper">{label}</p>
        <span className="text-brand-500">{icon}</span>
      </div>
      <p className="mt-2 text-[24px] font-bold text-ink">{value}</p>
    </div>
  );
}
