'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Corso } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { CORSO_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';

export default function ImportaFormazionePage() {
  // useSearchParams richiede un confine Suspense nell'export statico.
  return (
    <Suspense fallback={<AppShell pageTitle="Importa formazione"><div /></AppShell>}>
      <ImportaFormazionePageInner />
    </Suspense>
  );
}

function ImportaFormazionePageInner() {
  const { user } = useAuth();
  // L'import puo' partire dalla scheda di UNA azienda: in quel caso ogni riga
  // importata nasce gia' legata a quella azienda (senza, finirebbe "globale" e
  // comparirebbe nell'elenco di tutte le aziende dello studio).
  const params = useSearchParams();
  const companyId = Number(params.get('company_id')) || null;

  const allowed = canImport(user?.role, 'corsi');

  return (
    <AppShell pageTitle="Importa formazione">
      <BulkImportPanel<Corso, Corso>
        fields={CORSO_FIELDS}
        buildRow={(row, mappings, n) => {
          const r = buildEntityFromRow<Corso>(row, mappings, CORSO_FIELDS, n);
          if (r.ok && r.data) {
            const data = { ...r.data } as Corso;
            if (!data.partecipanti) data.partecipanti = [];
            return { ok: true, row: n, data };
          }
          return r as never;
        }}
        saveOne={async (data) => {
          await getDataSource().corsi.create(
            companyId ? ({ ...data, company_id: companyId } as Corso) : data
          );
        }}
        dedupe={{
          uniqueKey: (d) => (d.titolo ? `${d.titolo.toLowerCase()}|${d.data_svolgimento ?? ''}` : null),
          list: () => getDataSource().corsi.list(companyId ? { companyId } : undefined) as never,
          update: (id, patch) => getDataSource().corsi.update(id, patch as Partial<Corso>),
          matchLabel: 'titolo corso + data svolgimento',
        }}
        previewColumns={[
          { key: 'titolo', label: 'Corso' },
          { key: 'durata_ore', label: 'Ore' },
          { key: 'data_svolgimento', label: 'Svolto' },
          { key: 'data_scadenza', label: 'Scadenza' },
        ]}
        title="Carica file corsi formazione"
        hint="Excel/CSV con corsi formazione. Headers riconosciuti: corso/titolo · durata ore · data svolgimento · ente/docente · partecipanti (CSV) · data scadenza."
        successMessageTitle="corsi importati"
        returnUrl={companyId ? `/aziende/scheda?id=${companyId}` : '/formazione'}
        returnLabel={companyId ? 'azienda' : 'Formazione'}
        blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare corsi.` }}
      />
    </AppShell>
  );
}
