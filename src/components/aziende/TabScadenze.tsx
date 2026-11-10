'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource, type Scadenza } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport } from '@/lib/permissions';
import { CalendarClock, Upload } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  aggiornamento_dvr: 'Aggiornamento DVR',
  sopralluogo: 'Sopralluogo',
  formazione: 'Formazione',
  visita_medica: 'Visita medica',
  verifica_impianti: 'Verifica impianti',
  manutenzione_attrezzature: 'Manutenzione',
  altro: 'Altro',
};

export function TabScadenze({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { user } = useAuth();
  const showImport = canImport(user?.role, 'scadenze');
  const [items, setItems] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataSource().scadenze.list({ companyId }).then((list) => {
      const filtered = list
        .filter((s) => !s.company_id || s.company_id === companyId)
        .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
      setItems(filtered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={24} />}
        title="Scadenziario vuoto"
        description={
          showImport
            ? `Pianifica le scadenze ricorrenti di ${companyName}: aggiornamento DVR, sopralluoghi, visite mediche, verifiche impianti, manutenzioni attrezzature.`
            : `Le scadenze pianificate per ${companyName} dal consulente RSPP appariranno qui.`
        }
        action={
          showImport ? (
            <Link href={`/scadenziario/importa?company_id=${companyId}`} className="btn-primary"><Upload size={14} /> Importa scadenze</Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="card-luxury overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] min-w-[720px]">
          <thead className="bg-brand-50/40">
            <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Descrizione</th>
              <th className="px-4 py-3 font-semibold">Priorità</th>
              <th className="px-4 py-3 font-semibold">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {items.map((x) => (
              <tr key={x.id}>
                <td className="px-4 py-3 font-mono text-[12px] text-ink">{x.data_prevista}</td>
                <td className="px-4 py-3 text-ink">{TIPO_LABELS[x.tipo] ?? x.tipo}</td>
                <td className="px-4 py-3 text-ink">{x.descrizione}</td>
                <td className="px-4 py-3">
                  <Badge variant={x.priorita === 'critica' ? 'danger' : x.priorita === 'alta' ? 'warning' : 'neutral'}>
                    {x.priorita}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={x.stato === 'completata' ? 'success' : x.stato === 'scaduta' ? 'danger' : 'neutral'}>
                    {x.stato.replace('_', ' ')}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
