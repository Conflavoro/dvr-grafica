'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Scadenza } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { SCADENZA_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';

export default function ImportaScadenzePage() {
  // useSearchParams richiede un confine Suspense nell'export statico.
  return (
    <Suspense fallback={<AppShell pageTitle="Importa scadenze"><div /></AppShell>}>
      <ImportaScadenzePageInner />
    </Suspense>
  );
}

function ImportaScadenzePageInner() {
  const { user } = useAuth();
  // L'import puo' partire dalla scheda di UNA azienda: in quel caso ogni riga
  // importata nasce gia' legata a quella azienda (senza, finirebbe "globale" e
  // comparirebbe nell'elenco di tutte le aziende dello studio).
  const params = useSearchParams();
  const companyId = Number(params.get('company_id')) || null;

  const allowed = canImport(user?.role, 'scadenze');

  return (
    <AppShell pageTitle="Importa scadenze">
      <BulkImportPanel<Scadenza, Scadenza>
        fields={SCADENZA_FIELDS}
        buildRow={(row, mappings, n) => {
          const r = buildEntityFromRow<Scadenza>(row, mappings, SCADENZA_FIELDS, n);
          if (r.ok && r.data) {
            const data = { ...r.data } as Scadenza;
            if (!data.priorita) data.priorita = 'media';
            if (!data.stato) data.stato = 'aperta';
            return { ok: true, row: n, data };
          }
          return r as never;
        }}
        saveOne={async (data) => {
          await getDataSource().scadenze.create(
            companyId ? ({ ...data, company_id: companyId } as Scadenza) : data
          );
        }}
        dedupe={{
          uniqueKey: (d) => (d.tipo && d.data_prevista ? `${d.tipo}|${d.data_prevista}|${d.company_id ?? ''}` : null),
          list: () => getDataSource().scadenze.list(companyId ? { companyId } : undefined) as never,
          update: (id, patch) => getDataSource().scadenze.update(id, patch as Partial<Scadenza>),
          matchLabel: 'tipo + data + azienda',
        }}
        previewColumns={[
          { key: 'data_prevista', label: 'Data' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'descrizione', label: 'Descrizione' },
          { key: 'priorita', label: 'Prio' },
        ]}
        title="Carica file scadenze"
        hint="Excel/CSV con scadenze pianificate. Headers riconosciuti: tipo (DVR/sopralluogo/formazione/visita medica/impianti/manutenzione) · descrizione · data prevista · priorità (bassa/media/alta/critica) · stato · responsabile."
        successMessageTitle="scadenze importate"
        returnUrl={companyId ? `/aziende/scheda?id=${companyId}` : '/scadenziario'}
        returnLabel={companyId ? 'azienda' : 'Scadenziario'}
        blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare scadenze.` }}
      />
    </AppShell>
  );
}
