'use client';

import { useSearchParams } from 'next/navigation';

import { useEffect, useState, Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource, type Attrezzatura, type Company } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { ATTREZZATURA_FIELDS, buildEntityFromRow } from '@/lib/import/field-mapper';
import { Building2 } from 'lucide-react';

export default function ImportaAttrezzaturePage() {
  // useSearchParams richiede un confine Suspense nell'export statico.
  return (
    <Suspense fallback={<AppShell pageTitle="Importa attrezzature"><div /></AppShell>}>
      <ImportaAttrezzaturePageInner />
    </Suspense>
  );
}

function ImportaAttrezzaturePageInner() {
  const { user } = useAuth();
  // Arrivo dalla scheda di un'azienda: l'azienda di destinazione e' gia'
  // scelta (niente doppia selezione, niente rischio di sbagliare cliente).
  const params = useSearchParams();
  const presetCompanyId = Number(params.get('company_id')) || null;

  const allowed = canImport(user?.role, 'attrezzature');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(presetCompanyId);

  useEffect(() => {
    getDataSource().companies.list().then((list) => {
      setCompanies(list);
      if (presetCompanyId === null && list.length === 1) setCompanyId(list[0].id);
    });
  }, [presetCompanyId]);

  if (companies.length === 0) {
    return (
      <AppShell pageTitle="Importa attrezzature">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <Building2 size={32} className="mx-auto text-brand-500 mb-3" />
          <h3 className="section-title text-[17px]">Nessuna azienda</h3>
          <p className="mt-2 text-[13px] text-ink-muted">Aggiungi prima un&apos;azienda cliente per associare le attrezzature.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Importa attrezzature massivo">
      <div className="space-y-4">
        <div className="card-luxury p-4 max-w-xl">
          <p className="label-upper mb-2">Azienda di destinazione *</p>
          <select value={companyId ?? ''} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)} className="input-luxury">
            <option value="">Seleziona azienda...</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
          </select>
        </div>

        {companyId && (
          <BulkImportPanel<Attrezzatura, Attrezzatura>
            fields={ATTREZZATURA_FIELDS}
            buildRow={(row, mappings, n) => {
              const r = buildEntityFromRow<Attrezzatura>(row, mappings, ATTREZZATURA_FIELDS, n);
              if (r.ok && r.data) {
                const data = { ...r.data, company_id: companyId } as Attrezzatura;
                if (data.marcatura_ce === undefined) data.marcatura_ce = false;
                return { ok: true, row: n, data };
              }
              return r as never;
            }}
            saveOne={async (data) => { await getDataSource().attrezzature.create({ ...data, company_id: companyId } as Attrezzatura); }}
            dedupe={{
              uniqueKey: (d) => (d.codice_interno && d.company_id ? `${d.codice_interno.toLowerCase()}|${d.company_id}` : null),
              list: () => getDataSource().attrezzature.list(companyId ? { companyId } : undefined) as never,
              update: (id, patch) => getDataSource().attrezzature.update(id, patch as Partial<Attrezzatura>),
              matchLabel: 'codice interno + azienda',
            }}
            previewColumns={[
              { key: 'codice_interno', label: 'Codice' },
              { key: 'marca', label: 'Marca' },
              { key: 'modello', label: 'Modello' },
              { key: 'marcatura_ce', label: 'CE' },
              { key: 'anno_installazione', label: 'Anno' },
            ]}
            title="Carica file attrezzature"
            hint="Excel/CSV con registro attrezzature. Headers riconosciuti: codice/matricola · marca · modello · marcatura CE (sì/no) · anno installazione · prossima manutenzione."
            successMessageTitle="attrezzature importate"
            returnUrl={companyId ? `/aziende/scheda?id=${companyId}` : '/attrezzature'}
            returnLabel={companyId ? 'azienda' : 'Attrezzature'}
            blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare attrezzature.` }}
          />
        )}
      </div>
    </AppShell>
  );
}
