'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDataSource } from '@/lib/data-source';
import type { Dvr } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canCreate } from '@/lib/permissions';
import { FileText, Plus } from 'lucide-react';

export default function DvrPage() {
  const { user } = useAuth();
  const showCreate = canCreate(user?.role, 'dvr');
  const [dvrs, setDvrs] = useState<Dvr[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getDataSource()
      .dvr.list()
      .then((list) => {
        if (cancelled) return;
        setDvrs([...list].sort((a, b) => b.id - a.id));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <AppShell pageTitle="Documenti Valutazione Rischi">
      <div className="space-y-5 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-soft">
            {dvrs.length === 0
              ? showCreate
                ? 'Nessun DVR ancora.'
                : 'Nessun DVR ancora consegnato. Il consulente RSPP del tuo studio caricherà qui i documenti.'
              : `${dvrs.length} DVR · ultimi aggiornamenti.`}
          </p>
          {showCreate && (
            <Link href="/dvr/nuovo" className="btn-primary">
              <Plus size={16} /> Genera nuovo DVR
            </Link>
          )}
        </div>

        {loading ? (
          <div className="card-luxury p-10 text-center text-ink-muted">Caricamento…</div>
        ) : loadError ? (
          <EmptyState
            icon={<FileText size={28} />}
            title="Caricamento non riuscito"
            description="Non è stato possibile caricare i DVR. Controlla la connessione e riprova."
            action={
              <button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
                Riprova
              </button>
            }
          />
        ) : dvrs.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title={showCreate ? 'Nessun DVR generato' : 'Nessun DVR ancora consegnato'}
            description={
              showCreate
                ? 'Avvia il wizard guidato per creare il primo Documento di Valutazione dei Rischi conforme al D.Lgs. 81/08 art. 28.'
                : 'Quando il consulente RSPP del tuo studio avrà finalizzato e firmato un DVR, lo troverai qui pronto da consultare e scaricare. Riceverai notifica via email a ogni nuova versione.'
            }
            action={
              showCreate ? (
                <Link href="/dvr/nuovo" className="btn-primary">
                  <Plus size={16} /> Crea il primo DVR
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] min-w-[780px]">
                <thead className="bg-brand-50/40">
                  <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
                    <th className="px-5 py-3 font-semibold">Azienda</th>
                    <th className="px-3 py-3 font-semibold">Versione</th>
                    <th className="px-3 py-3 font-semibold">Stato</th>
                    <th className="px-3 py-3 font-semibold">Rischio max</th>
                    <th className="px-3 py-3 font-semibold">Creato il</th>
                    <th className="px-5 py-3 text-right font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100">
                  {dvrs.map((d) => (
                    <tr key={d.id} className="hover:bg-brand-50/40">
                      <td className="px-5 py-3 font-semibold text-ink">{d.azienda}</td>
                      <td className="px-3 py-3 text-ink">v{d.versione}</td>
                      <td className="px-3 py-3">
                        <Badge variant={d.status === 'approved' ? 'success' : d.status === 'review' ? 'warning' : 'neutral'}>
                          {d.status === 'approved' ? 'Approvato' : d.status === 'review' ? 'In revisione' : d.status === 'draft' ? 'Bozza' : 'Sostituito'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={d.rischio_max === 'molto_alto' ? 'risk-critical' : d.rischio_max === 'alto' ? 'risk-high' : d.rischio_max === 'medio' ? 'risk-medium' : 'risk-low'}>
                          {d.rischio_max.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{new Date(d.data_creazione).toLocaleDateString('it-IT')}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/dvr/scheda?id=${d.id}`}
                          className="text-[12px] font-semibold uppercase tracking-wider2 text-brand-600 hover:text-brand-700"
                        >
                          Apri
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card-luxury p-5 text-[12px] text-ink-muted">
          <p className="font-semibold uppercase tracking-wider2 text-ink">Disclaimer AI</p>
          <p className="mt-1.5">
            Tutti i DVR generati riportano in copertina la dicitura: <em>&quot;Documento generato con
            assistenza AI. La validità è subordinata alla verifica e sottoscrizione da parte delle
            figure competenti (Datore di Lavoro, RSPP, Medico Competente, RLS)&quot;</em> ai sensi del
            D.Lgs. 81/08.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
