'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Dpi } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport } from '@/lib/permissions';
import { HardHat, Upload } from 'lucide-react';

export function TabDpi({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'dpi');
  const [items, setItems] = useState<Dpi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataSource().dpi.list({ companyId }).then((list) => {
      setItems(list.filter((d) => !d.company_id || d.company_id === companyId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<HardHat size={24} />}
        title="Catalogo DPI vuoto"
        description={
          showImport
            ? `Carica i DPI assegnati ai lavoratori di ${companyName} (art. 77 D.Lgs. 81/08). Tipo, norma EN, categoria (I, II, III), scadenza vengono validati automaticamente.`
            : `Il catalogo DPI di ${companyName} sarà disponibile non appena il consulente RSPP lo avrà caricato.`
        }
        action={
          showImport ? (
            <Link href={`/dpi/importa?company_id=${companyId}`} className="btn-primary"><Upload size={14} /> Importa DPI</Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="card-luxury overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] min-w-[680px]">
          <thead className="bg-brand-50/40">
            <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
              <th className="px-4 py-3 font-semibold">Tipo DPI</th>
              <th className="px-4 py-3 font-semibold">Norma EN</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Marca, modello</th>
              <th className="px-4 py-3 font-semibold">Scadenza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {items.map((x) => (
              <tr key={x.id}>
                <td className="px-4 py-3 font-semibold text-ink">{x.tipo}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-ink">{x.norma_en ?? 'n/d'}</td>
                <td className="px-4 py-3">
                  <Badge variant={x.categoria === 'III' ? 'danger' : x.categoria === 'II' ? 'warning' : 'neutral'}>
                    {x.categoria}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink">{[x.marca, x.modello].filter(Boolean).join(' ') || 'n/d'}</td>
                <td className="px-4 py-3 text-ink-muted">{x.scadenza ?? 'n/d'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
