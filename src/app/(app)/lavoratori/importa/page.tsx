'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource } from '@/lib/data-source';
import type { Company, Lavoratore } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { LAVORATORE_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';
import { Building2 } from 'lucide-react';

export default function ImportaLavoratoriPage() {
  const { user } = useAuth();
  const allowed = canImport(user?.role, 'lavoratori');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    getDataSource().companies.list().then((list) => {
      setCompanies(list);
      if (list.length === 1) setCompanyId(list[0].id);
    });
  }, []);

  if (companies.length === 0) {
    return (
      <AppShell pageTitle="Importa lavoratori">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <Building2 size={32} className="mx-auto text-brand-500 mb-3" />
          <h3 className="section-title text-[17px]">Nessuna azienda</h3>
          <p className="mt-2 text-[13px] text-ink-muted">Aggiungi prima un&apos;azienda cliente per associare i lavoratori.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Importa lavoratori massivo">
      <div className="space-y-4">
        <div className="card-luxury p-4 max-w-xl">
          <p className="label-upper mb-2">Azienda di destinazione *</p>
          <select
            value={companyId ?? ''}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            className="input-luxury"
          >
            <option value="">Seleziona azienda...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.ragione_sociale} ({c.lavoratori} lav.)</option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-ink-muted">Tutti i lavoratori importati verranno collegati a questa azienda.</p>
        </div>

        {companyId && (
          <BulkImportPanel<Lavoratore, Lavoratore>
            fields={LAVORATORE_FIELDS}
            buildRow={(row, mappings, n) => {
              const r = buildEntityFromRow<Lavoratore>(row, mappings, LAVORATORE_FIELDS, n);
              if (r.ok && r.data) return { ok: true, row: n, data: { ...r.data, company_id: companyId } as Lavoratore };
              return r as never;
            }}
            saveOne={async (data) => { await getDataSource().lavoratori.create(data); }}
            dedupe={{
              uniqueKey: (d) => {
                if (d.codice_fiscale) return `cf:${d.codice_fiscale.toUpperCase()}`;
                if (d.nome && d.cognome && d.company_id) return `nm:${d.nome.toLowerCase()}_${d.cognome.toLowerCase()}_${d.company_id}`;
                return null;
              },
              list: () => getDataSource().lavoratori.list() as never,
              update: (id, patch) => getDataSource().lavoratori.update(id, patch as Partial<Lavoratore>),
              matchLabel: 'codice fiscale (o nome+cognome+azienda)',
            }}
            previewColumns={[
              { key: 'nome', label: 'Nome' },
              { key: 'cognome', label: 'Cognome' },
              { key: 'mansione', label: 'Mansione' },
              { key: 'codice_fiscale', label: 'CF' },
            ]}
            title="Carica file lavoratori"
            hint="Excel/CSV con anagrafica lavoratori. Headers riconosciuti: nome · cognome · codice fiscale · mansione/ruolo · data assunzione · idoneità sanitaria · formazione svolta (CSV) · DPI assegnati (CSV)."
            successMessageTitle="lavoratori importati"
            returnUrl="/lavoratori"
            returnLabel="Lavoratori"
            blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare lavoratori.` }}
          />
        )}
      </div>
    </AppShell>
  );
}
