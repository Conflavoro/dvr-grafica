'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Attrezzatura } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport } from '@/lib/permissions';
import { Wrench, Upload } from 'lucide-react';

export function TabAttrezzature({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'attrezzature');
  const [items, setItems] = useState<Attrezzatura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataSource().attrezzature.list({ companyId }).then((list) => {
      setItems(list.filter((a) => a.company_id === companyId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Wrench size={24} />}
        title="Nessuna attrezzatura registrata"
        description={
          showImport
            ? `Carica il registro attrezzature di ${companyName} (art. 71 D.Lgs. 81/08). Marcatura CE, anno installazione, prossima manutenzione vengono tracciate per ogni asset.`
            : `Il registro attrezzature di ${companyName} sarà disponibile non appena il consulente RSPP lo avrà caricato.`
        }
        action={
          showImport ? (
            <Link href={`/attrezzature/importa?company_id=${companyId}`} className="btn-primary"><Upload size={14} /> Importa attrezzature</Link>
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
              <th className="px-4 py-3 font-semibold">Codice</th>
              <th className="px-4 py-3 font-semibold">Marca, modello</th>
              <th className="px-4 py-3 font-semibold">CE</th>
              <th className="px-4 py-3 font-semibold">Anno</th>
              <th className="px-4 py-3 font-semibold">Prossima manutenzione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {items.map((x) => (
              <tr key={x.id}>
                <td className="px-4 py-3 font-mono text-[12px] text-ink">{x.codice_interno}</td>
                <td className="px-4 py-3 text-ink">{[x.marca, x.modello].filter(Boolean).join(' ') || 'n/d'}</td>
                <td className="px-4 py-3">{x.marcatura_ce ? <Badge variant="success">CE</Badge> : <Badge variant="warning">no CE</Badge>}</td>
                <td className="px-4 py-3 text-ink-muted">{x.anno_installazione ?? 'n/d'}</td>
                <td className="px-4 py-3 text-ink-muted">{x.prossima_manutenzione ?? 'n/d'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
