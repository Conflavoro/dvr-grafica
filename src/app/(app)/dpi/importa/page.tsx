'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Dpi } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { DPI_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';

export default function ImportaDpiPage() {
  // useSearchParams richiede un confine Suspense nell'export statico.
  return (
    <Suspense fallback={<AppShell pageTitle="Importa catalogo DPI"><div /></AppShell>}>
      <ImportaDpiPageInner />
    </Suspense>
  );
}

function ImportaDpiPageInner() {
  const { user } = useAuth();
  // L'import puo' partire dalla scheda di UNA azienda: in quel caso ogni riga
  // importata nasce gia' legata a quella azienda (senza, finirebbe "globale" e
  // comparirebbe nell'elenco di tutte le aziende dello studio).
  const params = useSearchParams();
  const companyId = Number(params.get('company_id')) || null;

  const allowed = canImport(user?.role, 'dpi');

  return (
    <AppShell pageTitle="Importa catalogo DPI">
      <BulkImportPanel<Dpi, Dpi>
        fields={DPI_FIELDS}
        buildRow={(row, mappings, n) => {
          const r = buildEntityFromRow<Dpi>(row, mappings, DPI_FIELDS, n);
          if (r.ok && r.data) {
            const data = { ...r.data } as Dpi;
            if (!data.categoria) data.categoria = 'II';
            return { ok: true, row: n, data };
          }
          return r as never;
        }}
        saveOne={async (data) => {
          await getDataSource().dpi.create(
            companyId ? ({ ...data, company_id: companyId } as Dpi) : data
          );
        }}
        dedupe={{
          uniqueKey: (d) => {
            if (!d.tipo) return null;
            return `${d.tipo.toLowerCase()}|${(d.norma_en ?? '').toLowerCase()}|${(d.marca ?? '').toLowerCase()}|${(d.modello ?? '').toLowerCase()}`;
          },
          list: () => getDataSource().dpi.list(companyId ? { companyId } : undefined) as never,
          update: (id, patch) => getDataSource().dpi.update(id, patch as Partial<Dpi>),
          matchLabel: 'tipo + norma EN + marca + modello',
        }}
        previewColumns={[
          { key: 'tipo', label: 'Tipo DPI' },
          { key: 'norma_en', label: 'Norma' },
          { key: 'categoria', label: 'Cat' },
          { key: 'marca', label: 'Marca' },
        ]}
        title="Carica catalogo DPI"
        hint="Excel/CSV con catalogo DPI. Headers riconosciuti: tipo · norma EN · categoria (I/II/III) · marca · modello · fornitore · data consegna · scadenza."
        successMessageTitle="DPI importati"
        returnUrl={companyId ? `/aziende/scheda?id=${companyId}` : '/dpi'}
        returnLabel={companyId ? 'azienda' : 'DPI'}
        blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare DPI.` }}
      />
    </AppShell>
  );
}
