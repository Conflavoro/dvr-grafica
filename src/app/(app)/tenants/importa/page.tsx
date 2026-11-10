'use client';

import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Studio } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { STUDIO_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';

export default function ImportaStudiPage() {
  const { user } = useAuth();
  const allowed = canImport(user?.role, 'studi');

  return (
    <AppShell pageTitle="Importa studi affiliati">
      <BulkImportPanel<Studio, Studio>
        fields={STUDIO_FIELDS}
        buildRow={(row, mappings, n) => {
          const r = buildEntityFromRow<Studio>(row, mappings, STUDIO_FIELDS, n);
          if (r.ok && r.data) {
            const data = { ...r.data } as Studio;
            if (data.attivo === undefined) data.attivo = true;
            return { ok: true, row: n, data };
          }
          return r as never;
        }}
        saveOne={async (data) => { await getDataSource().studi.create(data); }}
        previewColumns={[
          { key: 'ragione_sociale', label: 'Studio' },
          { key: 'partita_iva', label: 'P.IVA' },
          { key: 'email_referente', label: 'Email' },
          { key: 'comune', label: 'Comune' },
          { key: 'numero_consulenti', label: 'Cons.' },
        ]}
        title="Carica file studi"
        hint="Excel/CSV con anagrafica studi consulenza affiliati. Headers riconosciuti: ragione sociale · P.IVA · email referente · telefono · indirizzo · comune · provincia · CAP · numero consulenti · numero aziende clienti."
        successMessageTitle="studi importati"
        returnUrl="/tenants"
        returnLabel="Studi"
        dedupe={{
          uniqueKey: (d) => (d.partita_iva ? d.partita_iva.replace(/\s/g, '').toUpperCase() : null),
          list: () => getDataSource().studi.list() as never,
          update: (id, patch) => getDataSource().studi.update(id, patch as Partial<Studio>),
          matchLabel: 'P.IVA',
        }}
        blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare studi affiliati. Solo Admin Conflavoro e Super Admin gestiscono questo elenco.` }}
      />
    </AppShell>
  );
}
