'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Corso } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport } from '@/lib/permissions';
import { GraduationCap, Upload } from 'lucide-react';

function isExpiringSoon(date?: string): boolean {
  if (!date) return false;
  const d = new Date(date).getTime();
  const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

export function TabFormazione({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'corsi');
  const [items, setItems] = useState<Corso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataSource().corsi.list({ companyId }).then((list) => {
      setItems(list.filter((c) => !c.company_id || c.company_id === companyId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap size={24} />}
        title="Nessun corso registrato"
        description={
          showImport
            ? `Carica i corsi di formazione svolti dai lavoratori di ${companyName} (art. 37 D.Lgs. 81/08 e Accordo Stato-Regioni). Antincendio, primo soccorso, formazione generale e specifica per mansione.`
            : `I corsi di formazione di ${companyName} saranno disponibili non appena il consulente RSPP li avrà caricati.`
        }
        action={
          showImport ? (
            <Link href={`/formazione/importa?company_id=${companyId}`} className="btn-primary"><Upload size={14} /> Importa corsi</Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="card-luxury overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] min-w-[640px]">
          <thead className="bg-brand-50/40">
            <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
              <th className="px-4 py-3 font-semibold">Corso</th>
              <th className="px-4 py-3 font-semibold">Ore</th>
              <th className="px-4 py-3 font-semibold">Svolto</th>
              <th className="px-4 py-3 font-semibold">Ente</th>
              <th className="px-4 py-3 font-semibold">Partecipanti</th>
              <th className="px-4 py-3 font-semibold">Scadenza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {items.map((x) => (
              <tr key={x.id}>
                <td className="px-4 py-3 font-semibold text-ink">{x.titolo}</td>
                <td className="px-4 py-3 text-ink">{x.durata_ore}h</td>
                <td className="px-4 py-3 text-ink-muted">{x.data_svolgimento ?? 'da pianificare'}</td>
                <td className="px-4 py-3 text-ink-muted">{x.ente_erogatore ?? 'n/d'}</td>
                <td className="px-4 py-3 text-ink-muted">{x.partecipanti?.length ?? 0}</td>
                <td className="px-4 py-3">
                  {x.data_scadenza
                    ? isExpiringSoon(x.data_scadenza)
                      ? <Badge variant="warning">{x.data_scadenza}</Badge>
                      : <Badge variant="neutral">{x.data_scadenza}</Badge>
                    : 'n/d'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
