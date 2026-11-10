'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Studio, type UtenteStudio } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { UTENTE_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';
import { Network } from 'lucide-react';

export default function ImportaUtentiPage() {
  const { user } = useAuth();
  const allowed = canImport(user?.role, 'utenti');
  const [studi, setStudi] = useState<Studio[]>([]);
  const [studioId, setStudioId] = useState<number | null>(null);

  useEffect(() => {
    getDataSource().studi.list().then((list) => {
      setStudi(list);
      if (list.length === 1) setStudioId(list[0].id);
    });
  }, []);

  if (studi.length === 0 && allowed) {
    return (
      <AppShell pageTitle="Importa utenti studio">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <Network size={32} className="mx-auto text-brand-500 mb-3" />
          <h3 className="section-title text-[17px]">Nessuno studio</h3>
          <p className="mt-2 text-[13px] text-ink-muted">
            Aggiungi prima uno studio affiliato (sezione <strong>Studi</strong>) per associare gli utenti.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Importa utenti studio">
      <div className="space-y-4">
        {studi.length > 1 && (
          <div className="card-luxury p-4 max-w-xl">
            <p className="label-upper mb-2">Studio di destinazione *</p>
            <select value={studioId ?? ''} onChange={(e) => setStudioId(e.target.value ? Number(e.target.value) : null)} className="input-luxury">
              <option value="">Seleziona studio...</option>
              {studi.map((s) => <option key={s.id} value={s.id}>{s.ragione_sociale}</option>)}
            </select>
            <p className="mt-2 text-[11px] text-ink-muted">Tutti gli utenti importati verranno collegati a questo studio.</p>
          </div>
        )}

        {(studioId || studi.length === 0) && (
          <BulkImportPanel<UtenteStudio, UtenteStudio>
            fields={UTENTE_FIELDS}
            buildRow={(row, mappings, n) => {
              const r = buildEntityFromRow<UtenteStudio>(row, mappings, UTENTE_FIELDS, n);
              if (r.ok && r.data) {
                const data = { ...r.data, studio_id: studioId ?? 0 } as UtenteStudio;
                if (data.attivo === undefined) data.attivo = true;
                return { ok: true, row: n, data };
              }
              return r as never;
            }}
            saveOne={async (data) => { await getDataSource().utenti.create(data); }}
            previewColumns={[
              { key: 'cognome', label: 'Cognome' },
              { key: 'nome', label: 'Nome' },
              { key: 'email', label: 'Email' },
              { key: 'ruolo', label: 'Ruolo' },
              { key: 'qualifica', label: 'Qualifica' },
            ]}
            title="Carica file utenti"
            hint="Excel/CSV con utenti dello studio. Headers riconosciuti: nome · cognome · email · ruolo (titolare_studio/consulente) · qualifica professionale · iscrizione albo · telefono · attivo."
            successMessageTitle="utenti importati"
            returnUrl="/utenti"
            returnLabel="Utenti"
            dedupe={{
              uniqueKey: (d) => (d.email ? `email:${d.email.toLowerCase()}` : null),
              list: () => getDataSource().utenti.list() as never,
              update: (id, patch) => getDataSource().utenti.update(id, patch as Partial<UtenteStudio>),
              matchLabel: 'email',
            }}
            blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare utenti studio.` }}
          />
        )}
      </div>
    </AppShell>
  );
}
