'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { getDataSource, type UtenteStudio } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, canCreate } from '@/lib/permissions';
import { Users, Upload, Search, Plus } from 'lucide-react';

const ETICHETTA_RUOLO: Record<UtenteStudio['ruolo'], string> = {
  titolare_studio: 'titolare',
  consulente: 'consulente',
  datore_lavoro: 'datore di lavoro',
  admin_conflavoro: 'staff Conflavoro',
};

export default function UtentiPage() {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'utenti');
  const showCreate = canCreate(user?.role, 'utenti');
  const [items, setItems] = useState<UtenteStudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getDataSource()
      .utenti.list()
      .then((list) => {
        if (!cancelled) setItems(list);
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
  }, [reloadKey]);

  const filtered = items.filter((u) =>
    !q || `${u.nome} ${u.cognome} ${u.email} ${u.qualifica ?? ''} ${u.studio_nome ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell pageTitle="Utenti studio">
      <div className="space-y-5 animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Cerca per nome, email, qualifica…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input-luxury pl-11"
            />
          </div>
          {showImport && (
            <Link href="/utenti/importa" className="btn-ghost"><Upload size={16} /> Import massivo</Link>
          )}
          {showCreate && (
            <button className="btn-primary opacity-50 cursor-not-allowed" disabled title="Creazione manuale utente in arrivo">
              <Plus size={16} /> Nuovo utente
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : loadError ? (
          <EmptyState
            icon={<Users size={28} />}
            title="Caricamento non riuscito"
            description="Controlla la connessione e riprova."
            action={<button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>Riprova</button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title={items.length === 0 ? 'Nessun utente registrato' : 'Nessun risultato'}
            description={
              items.length === 0
                ? showImport
                  ? 'Importa i consulenti del tuo studio (o studi affiliati) da Excel/CSV. Per ogni utente: ruolo, qualifica, iscrizione albo, contatti.'
                  : 'Gli utenti studio sono gestiti da Admin Conflavoro o Titolare studio.'
                : 'Nessun utente corrisponde alla ricerca.'
            }
            action={
              items.length === 0 && showImport ? (
                <Link href="/utenti/importa" className="btn-primary"><Upload size={16} /> Importa utenti</Link>
              ) : undefined
            }
          />
        ) : (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[820px]">
              <thead className="bg-brand-50/40">
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Nominativo</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Ruolo</th>
                  <th className="px-4 py-3 font-semibold">Qualifica</th>
                  <th className="px-4 py-3 font-semibold">Albo</th>
                  <th className="px-4 py-3 font-semibold">Studio</th>
                  <th className="px-4 py-3 font-semibold">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-semibold text-ink">{u.cognome} {u.nome}</td>
                    <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.ruolo === 'titolare_studio' ? 'brand' : 'info'}>
                        {ETICHETTA_RUOLO[u.ruolo]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink">{u.qualifica ?? 'n.d.'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ink-muted">{u.iscrizione_albo ?? 'n.d.'}</td>
                    <td className="px-4 py-3 text-ink-muted truncate max-w-[160px]">{u.studio_nome ?? 'n.d.'}</td>
                    <td className="px-4 py-3"><Badge variant={u.attivo ? 'success' : 'neutral'}>{u.attivo ? 'attivo' : 'inattivo'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
