'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DocumentUploadPanel } from '@/components/upload/DocumentUploadPanel';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { getDataSource, type Dvr, type DvrUpload } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

export default function DocumentiPage() {
  const { user } = useAuth();
  // datore_lavoro e' read-only: vede i file ma non carica/elimina (coerente col backend).
  const editable = can(user?.role, 'dvr', 'update');
  const [dvrs, setDvrs] = useState<Dvr[]>([]);
  const [dvrId, setDvrId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<DvrUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataSource()
      .dvr.list()
      .then((list) => {
        setDvrs(list);
        if (list.length > 0) setDvrId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (dvrId == null) {
      setUploads([]);
      return;
    }
    getDataSource().media.listUploads(dvrId).then(setUploads).catch(() => setUploads([]));
  }, [dvrId]);

  async function refreshUploads(): Promise<void> {
    if (dvrId == null) return;
    setUploads(await getDataSource().media.listUploads(dvrId));
  }

  async function handleDelete(upload: DvrUpload): Promise<void> {
    if (dvrId == null) return;
    const label = upload.kind === 'media' ? 'l\'immagine' : 'il documento';
    if (typeof window !== 'undefined' && !window.confirm(`Eliminare ${label} "${upload.filename}"?`)) {
      return;
    }
    try {
      await getDataSource().media.deleteUpload(dvrId, upload.kind, upload.id);
      void refreshUploads();
    } catch {
      // Nessun crash: in caso di errore la lista resta invariata.
    }
  }

  return (
    <AppShell pageTitle="Documenti">
      <div className="space-y-6 animate-fade-up">
        <p className="text-[13px] text-ink-soft">
          Carica documenti e immagini collegati a un DVR. In produzione lo storage è privato per
          studio (Cloudflare R2, cifratura at-rest) e il backend classifica ed estrae i dati.
        </p>

        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : dvrs.length === 0 ? (
          <div className="card-luxury p-8 text-center">
            <FileText size={28} className="mx-auto mb-3 text-brand-500" />
            <h3 className="section-title text-[17px]">Nessun DVR a cui collegare i file</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-muted">
              Crea prima un DVR dalla sezione DVR, poi potrai allegare qui documenti e foto.
            </p>
          </div>
        ) : (
          <>
            <div className="card-luxury max-w-xl p-4">
              <label htmlFor="dvr-sel" className="label-upper mb-2 block">
                DVR di destinazione
              </label>
              <select
                id="dvr-sel"
                value={dvrId ?? ''}
                onChange={(e) => setDvrId(Number(e.target.value))}
                className="input-luxury"
              >
                {dvrs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.azienda} · v{d.versione}
                  </option>
                ))}
              </select>
            </div>

            {dvrId != null && editable && (
              <DocumentUploadPanel dvrId={dvrId} onUploaded={() => void refreshUploads()} />
            )}

            <section className="card-luxury overflow-hidden">
              <header className="flex items-center justify-between border-b border-brand-100 px-5 py-3">
                <h3 className="section-title">File collegati</h3>
                <span className="text-[11px] text-ink-muted">{uploads.length} elementi</span>
              </header>
              {uploads.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-ink-muted">
                  Nessun file collegato a questo DVR. Caricane uno dal pannello qui sopra.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] min-w-[640px]">
                    <thead className="bg-brand-50/40">
                      <tr className="text-[10px] uppercase tracking-wider2 text-ink-muted">
                        <th className="px-5 py-3 font-semibold">Nome</th>
                        <th className="px-3 py-3 font-semibold">Tipo</th>
                        <th className="px-3 py-3 font-semibold">Dimensione</th>
                        <th className="px-3 py-3 font-semibold">Stato</th>
                        {editable && <th className="px-5 py-3 text-right font-semibold">Azioni</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {uploads.map((d) => (
                        <tr key={d.id} className="hover:bg-brand-50/40">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              {d.kind === 'media' ? (
                                <ImageIcon size={16} className="text-brand-500" />
                              ) : (
                                <FileText size={16} className="text-brand-500" />
                              )}
                              <span className="font-semibold text-ink">{d.filename}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            {d.kind === 'media' ? 'Immagine' : 'Documento'}
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            {(d.size_bytes / 1024).toFixed(0)} KB
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={d.status === 'elaborato' ? 'success' : 'info'}>
                              {d.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          {editable && (
                            <td className="px-5 py-3 text-right">
                              <button
                                aria-label={`Elimina ${d.kind === 'media' ? 'immagine' : 'documento'} ${d.filename}`}
                                className="btn-icon"
                                onClick={() => void handleDelete(d)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
