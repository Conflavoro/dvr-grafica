'use client';

import { percorso } from '@/lib/percorso';
import { AppShell } from '@/components/layout/AppShell';
import { BulkImportPanel } from '@/components/import/BulkImportPanel';
import { getDataSource } from '@/lib/data-source';
import type { Company } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canImport, roleLabel } from '@/lib/permissions';
import { COMPANY_FIELDS, buildCompanyFromRow } from '@/lib/import/field-mapper';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

export default function ImportaAziendePage() {
  const { user } = useAuth();
  const allowed = canImport(user?.role, 'companies');

  return (
    <AppShell pageTitle="Importa aziende da Excel">
      <div className="space-y-5 animate-fade-up">
        {/* Hero esplicativo: cosa caricare e come */}
        {allowed && (
          <section className="card-luxury p-6 sm:p-8 space-y-5">
            <header className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h2 className="section-title text-[17px] text-ink">Carica un file Excel o CSV con la lista aziende</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Trascini il file qui sotto, il sistema riconosce in automatico le colonne, ti mostra l&apos;anteprima e tu confermi prima del salvataggio.
                </p>
              </div>
            </header>

            {/* Mini esempio di Excel atteso */}
            <div>
              <p className="label-upper mb-2">Esempio di file atteso</p>
              <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white/60">
                <table className="w-full text-left text-[12px] min-w-[760px]">
                  <thead className="bg-brand-50/60">
                    <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-soft">
                      <th className="px-3 py-2 font-semibold">Ragione Sociale</th>
                      <th className="px-3 py-2 font-semibold">P.IVA</th>
                      <th className="px-3 py-2 font-semibold">ATECO</th>
                      <th className="px-3 py-2 font-semibold">Lavoratori</th>
                      <th className="px-3 py-2 font-semibold">Comune</th>
                      <th className="px-3 py-2 font-semibold">Provincia</th>
                      <th className="px-3 py-2 font-semibold">CAP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 text-ink">
                    <tr>
                      <td className="px-3 py-2">Verdi Costruzioni Srl</td>
                      <td className="px-3 py-2 font-mono">IT12345678901</td>
                      <td className="px-3 py-2 font-mono">41.20</td>
                      <td className="px-3 py-2">24</td>
                      <td className="px-3 py-2">Bergamo</td>
                      <td className="px-3 py-2">BG</td>
                      <td className="px-3 py-2 font-mono">24100</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Rossi Metalmeccanica SpA</td>
                      <td className="px-3 py-2 font-mono">IT09876543210</td>
                      <td className="px-3 py-2 font-mono">25.62</td>
                      <td className="px-3 py-2">58</td>
                      <td className="px-3 py-2">Brescia</td>
                      <td className="px-3 py-2">BS</td>
                      <td className="px-3 py-2 font-mono">25100</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rassicurazione auto-mapping + link template */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                <IconaAi size={18} className="shrink-0 text-brand-600" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Mapping automatico</p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    Se le tue colonne hanno nomi diversi (es. &quot;denominazione&quot;, &quot;piva&quot;, &quot;dipendenti&quot;) il sistema le riconosce comunque. Puoi sempre correggere il mapping manualmente.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                <Download size={18} className="shrink-0 text-brand-600" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Template pronto</p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    Non hai un file? <a href={percorso('/templates/aziende-template.xlsx')} className="font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline">Scarica il template Excel</a> precompilato con tutte le colonne.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pannello di import (parser + mapping + preview + save) */}
        <BulkImportPanel<Company, Company>
          fields={COMPANY_FIELDS}
          buildRow={(row, mappings, n) => buildCompanyFromRow(row, mappings, n) as never}
          saveOne={async (data) => { await getDataSource().companies.create(data); }}
          dedupe={{
            uniqueKey: (d) => (d.partita_iva ? d.partita_iva.replace(/\s/g, '').toUpperCase() : null),
            list: () => getDataSource().companies.list() as never,
            update: (id, patch) => getDataSource().companies.update(id, patch as Partial<Company>),
            matchLabel: 'P.IVA',
          }}
          previewColumns={[
            { key: 'ragione_sociale', label: 'Ragione sociale' },
            { key: 'partita_iva', label: 'P.IVA' },
            { key: 'ateco', label: 'ATECO' },
            { key: 'lavoratori', label: 'Lav.' },
          ]}
          title="Trascina qui il file aziende"
          hint="Carica Excel (.xlsx) o CSV con la lista clienti. Il sistema riconosce in automatico le colonne, valida i dati e ti mostra l'anteprima prima di salvare."
          successMessageTitle="aziende importate"
          returnUrl="/aziende"
          returnLabel="Aziende"
          saveButtonLabel={undefined}
          blocked={allowed ? undefined : { reason: `Il ruolo ${user ? roleLabel(user.role) : ''} non può importare anagrafiche aziende. Contatta l'amministratore dello studio.` }}
        />
      </div>
    </AppShell>
  );
}
