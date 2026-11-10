'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { WizardStepper, type WizardStepDef } from '@/components/wizard/WizardStepper';
import { CompanyPicker } from '@/components/wizard/CompanyPicker';
import { SezioneUploader } from '@/components/wizard/SezioneUploader';
import { AiAssistField } from '@/components/ai/AiAssistField';
import type { WizardDraftPatch } from '@/lib/import/dvr-extractor';
import { Badge } from '@/components/ui/Badge';
import { getDataSource, calcolaLivelloRischio } from '@/lib/data-source';
import type {
  CompanyDimensione,
  DvrPayload,
  RischioValutato,
} from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { canCreate } from '@/lib/permissions';
import { RISCHI_TIPICI, PERICOLI_DLGS_81 } from '@/lib/dvr-rischi-standard';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { extractDvrFromFile, extractedToWizardPatch, type ExtractedDvr } from '@/lib/import/dvr-extractor';
import { Upload, AlertCircle, Lock } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

const _ = RISCHI_TIPICI; // referenced below in template prefill
import { ArrowLeft, ArrowRight, CheckCircle2, Save, FileDown, Plus, Trash2, Loader2 } from 'lucide-react';

const STEPS: WizardStepDef[] = [
  { key: 'a', label: 'A · Anagrafica', description: 'Ragione sociale · P.IVA · ATECO' },
  { key: 'b', label: 'B · Organigramma', description: 'Datore · RSPP · MC · RLS' },
  { key: 'c', label: 'C · Ciclo lavorativo', description: 'Reparti · fasi · attrezzature' },
  { key: 'd', label: 'D · Pericoli', description: 'Check-list TUSL' },
  { key: 'e', label: 'E · Valutazione P×G', description: 'Matrice rischi' },
  { key: 'f', label: 'F · Misure', description: 'Tecniche · DPI · formazione' },
  { key: 'g', label: 'G · Riepilogo', description: 'Genera DVR' },
];

const DRAFT_KEY = 'crm_dvr_wizard_draft_v2';

interface DraftPayload {
  step: number;
  completed: number[];
  company_id: number | null;
  ragione_sociale: string;
  partita_iva: string;
  ateco: string;
  ateco_label: string;
  lavoratori: number;
  dimensione: CompanyDimensione;
  sede_indirizzo: string;
  sede_comune: string;
  sede_provincia: string;
  sede_cap: string;
  datore_lavoro: string;
  rspp: string;
  medico_competente: string;
  rls: string;
  addetti_pronto_soccorso: string;
  addetti_antincendio: string;
  descrizione_attivita: string;
  reparti: string;
  fasi_lavorative: string;
  attrezzature: string;
  pericoli_selezionati: Record<string, boolean>;
  rischi: Array<{ id: string; categoria: string; p: 1 | 2 | 3 | 4; g: 1 | 2 | 3 | 4; fonte_norma: string }>;
  misure_tecniche: string;
  misure_organizzative: string;
  dpi: string;
  formazione: string;
  rumore: string;
  mmc: string;
  vibrazioni: string;
  chimico: string;
}

const EMPTY: DraftPayload = {
  step: 0,
  completed: [],
  company_id: null,
  ragione_sociale: '',
  partita_iva: '',
  ateco: '',
  ateco_label: '',
  lavoratori: 0,
  dimensione: 'piccola',
  sede_indirizzo: '',
  sede_comune: '',
  sede_provincia: '',
  sede_cap: '',
  datore_lavoro: '',
  rspp: '',
  medico_competente: '',
  rls: '',
  addetti_pronto_soccorso: '',
  addetti_antincendio: '',
  descrizione_attivita: '',
  reparti: '',
  fasi_lavorative: '',
  attrezzature: '',
  pericoli_selezionati: {},
  rischi: [],
  misure_tecniche: '',
  misure_organizzative: '',
  dpi: '',
  formazione: '',
  rumore: '',
  mmc: '',
  vibrazioni: '',
  chimico: '',
};

export default function Page() {
  return (
    <Suspense fallback={<AppShell pageTitle="Caricamento wizard…"><div /></AppShell>}>
      <NuovoDvrPage />
    </Suspense>
  );
}

function NuovoDvrPage() {
  const router = useRouter();
  const params = useSearchParams();
  const presetCompanyId = Number(params.get('company_id')) || null;
  const presetTemplateId = Number(params.get('template_dvr_id')) || null;
  const explicitNew = params.get('new_company') === '1';

  const { user, loading: authLoading } = useAuth();
  const canCreateDvr = canCreate(user?.role, 'dvr');
  const canCreateCompany = canCreate(user?.role, 'companies');

  const [pickerSelected, setPickerSelected] = useState<{ companyId: number | null; templateDvrId: number | null; isNew: boolean } | null>(
    presetCompanyId
      ? { companyId: presetCompanyId, templateDvrId: presetTemplateId, isNew: false }
      : explicitNew
        ? { companyId: null, templateDvrId: null, isNew: true }
        : null
  );

  const [draft, setDraft] = useState<DraftPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedDvrId, setSavedDvrId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResults, setExtractResults] = useState<ExtractedDvr[] | null>(null);

  const handleImportFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const results = await Promise.all(files.map((f) => extractDvrFromFile(f)));
      setExtractResults(results);
      // Applica TUTTI i patch in cascata (i successivi sovrascrivono i precedenti)
      setDraft((d) => {
        let next = d;
        for (const r of results) {
          const patch = extractedToWizardPatch(r);
          next = { ...next, ...patch };
        }
        return next;
      });
    } catch (e) {
      alert('Errore estrazione: ' + (e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    let saved: Partial<DraftPayload> | null = null;
    if (raw) {
      try { saved = JSON.parse(raw) as Partial<DraftPayload>; } catch { saved = null; }
    }

    const targetCompanyId = pickerSelected?.companyId ?? null;
    const targetTemplateId = pickerSelected?.templateDvrId ?? null;

    if (!targetCompanyId) {
      // Nessuna azienda preselezionata: ripristina la bozza salvata (flusso CompanyPicker).
      if (saved) setDraft({ ...EMPTY, ...saved });
      return;
    }

    // La bozza salvata vale SOLO se e' della STESSA azienda e non si replica un
    // template: in quel caso si continua la modifica. Altrimenti si riparte puliti
    // (EMPTY + anagrafica) per evitare il bleed di figure/rischi da un'altra azienda.
    const continueSameCompany =
      saved != null && saved.company_id === targetCompanyId && targetTemplateId === null;

    const ds = getDataSource();
    Promise.all([ds.companies.get(targetCompanyId), ds.dvr.list()]).then(([c, allDvrs]) => {
      if (!c) return;
      const companyDvrs = allDvrs.filter((d) => d.company_id === c.id).sort((a, b) => b.versione - a.versione);
      const lastDvr = targetTemplateId
        ? (allDvrs.find((d) => d.id === targetTemplateId) ?? companyDvrs[0])
        : companyDvrs[0];

      const anagrafica = {
        company_id: c.id,
        ragione_sociale: c.ragione_sociale,
        partita_iva: c.partita_iva,
        ateco: c.ateco,
        ateco_label: c.ateco_label,
        lavoratori: c.lavoratori,
        dimensione: c.dimensione,
        sede_indirizzo: c.sedi[0]?.indirizzo ?? '',
        sede_comune: c.sedi[0]?.comune ?? '',
        sede_provincia: c.sedi[0]?.provincia ?? '',
        sede_cap: c.sedi[0]?.cap ?? '',
      };

      // Continua la bozza in corso della STESSA azienda (solo anagrafica rinfrescata).
      if (continueSameCompany && saved) {
        setDraft({ ...EMPTY, ...saved, ...anagrafica });
        return;
      }

      // Nuovo DVR per questa azienda: si riparte PULITI (nessun dato di altre aziende).
      const base = { ...EMPTY, ...anagrafica };

      // Replica un DVR esistente SOLO se l'utente ha scelto un template esplicito.
      if (targetTemplateId !== null && lastDvr) {
        const pl = lastDvr.payload;
        const pericoliMap: Record<string, boolean> = {};
        pl.sezione_d.pericoli_identificati.forEach((p) => { pericoliMap[p] = true; });
        const categoriaToId = new Map(RISCHI_TIPICI.map((r) => [r.categoria, r.id]));
        setDraft({
          ...base,
          datore_lavoro: pl.sezione_b.datore_lavoro,
          rspp: pl.sezione_b.rspp,
          medico_competente: pl.sezione_b.medico_competente ?? '',
          rls: pl.sezione_b.rls ?? '',
          addetti_pronto_soccorso: pl.sezione_b.addetti_pronto_soccorso ?? '',
          addetti_antincendio: pl.sezione_b.addetti_antincendio ?? '',
          descrizione_attivita: pl.sezione_c.descrizione_attivita,
          reparti: pl.sezione_c.reparti.join('\n'),
          fasi_lavorative: pl.sezione_c.fasi_lavorative.join('\n'),
          attrezzature: pl.sezione_c.attrezzature_principali.join('\n'),
          pericoli_selezionati: pericoliMap,
          rischi: pl.sezione_e.matrice_rischi.map((r) => ({
            id: categoriaToId.get(r.pericolo) ?? r.pericolo,
            categoria: r.pericolo,
            p: r.probabilita,
            g: r.gravita,
            fonte_norma: r.fonte_norma ?? '',
          })),
          misure_tecniche: pl.sezione_f.misure_tecniche,
          misure_organizzative: pl.sezione_f.misure_organizzative,
          dpi: pl.sezione_f.dpi_assegnati,
          formazione: pl.sezione_f.formazione,
          rumore: pl.sezione_h?.rumore ?? '',
          mmc: pl.sezione_h?.mmc ?? '',
          vibrazioni: pl.sezione_h?.vibrazioni ?? '',
          chimico: pl.sezione_h?.chimico ?? '',
        });
        return;
      }

      setDraft(base);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSelected?.companyId, pickerSelected?.templateDvrId]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const completedSet = new Set(draft.completed);
  const current = draft.step;

  const goto = (i: number) => setDraft((d) => ({ ...d, step: i }));
  const next = () => setDraft((d) => ({
    ...d,
    step: Math.min(d.step + 1, STEPS.length - 1),
    completed: Array.from(new Set([...d.completed, d.step])),
  }));
  const prev = () => setDraft((d) => ({ ...d, step: Math.max(0, d.step - 1) }));
  const reset = () => {
    if (confirm('Resettare tutto il draft DVR?')) {
      setDraft(EMPTY);
      setSavedDvrId(null);
      localStorage.removeItem(DRAFT_KEY);
    }
  };

  const [reusedCompany, setReusedCompany] = useState<{ id: number; ragione_sociale: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setReusedCompany(null);
    try {
      const ds = getDataSource();
      let companyId = draft.company_id;
      if (!companyId) {
        // Pre-check: se esiste già un'azienda con questa P.IVA, riusala (no duplicato).
        const normalizedPiva = (draft.partita_iva ?? '').replace(/\s/g, '').toUpperCase();
        let alreadyExisting: { id: number; ragione_sociale: string } | null = null;
        if (normalizedPiva) {
          const allCompanies = await ds.companies.list();
          const match = allCompanies.find(
            (c) => (c.partita_iva ?? '').replace(/\s/g, '').toUpperCase() === normalizedPiva
          );
          if (match) alreadyExisting = { id: match.id, ragione_sociale: match.ragione_sociale };
        }
        if (alreadyExisting) {
          companyId = alreadyExisting.id;
          setReusedCompany(alreadyExisting);
        } else {
          const created = await ds.companies.create({
            ragione_sociale: draft.ragione_sociale,
            partita_iva: draft.partita_iva,
            ateco: draft.ateco,
            ateco_label: draft.ateco_label,
            dimensione: draft.dimensione,
            lavoratori: draft.lavoratori,
            sedi: [{
              tipo: 'legale',
              indirizzo: draft.sede_indirizzo,
              comune: draft.sede_comune,
              provincia: draft.sede_provincia,
              cap: draft.sede_cap,
            }],
          });
          companyId = created.id;
        }
      }

      const matrice: RischioValutato[] = draft.rischi.map((r) => ({
        pericolo: r.categoria,
        probabilita: r.p,
        gravita: r.g,
        livello: calcolaLivelloRischio(r.p, r.g),
        fonte_norma: r.fonte_norma,
      }));

      const payload: DvrPayload = {
        sezione_a: {
          ragione_sociale: draft.ragione_sociale,
          partita_iva: draft.partita_iva,
          ateco: draft.ateco,
          sede_legale: `${draft.sede_indirizzo}, ${draft.sede_cap} ${draft.sede_comune} (${draft.sede_provincia})`,
          lavoratori_totali: draft.lavoratori,
          dimensione: draft.dimensione,
          data_redazione: new Date().toISOString().slice(0, 10),
        },
        sezione_b: {
          datore_lavoro: draft.datore_lavoro,
          rspp: draft.rspp,
          medico_competente: draft.medico_competente || undefined,
          rls: draft.rls || undefined,
          addetti_pronto_soccorso: draft.addetti_pronto_soccorso || undefined,
          addetti_antincendio: draft.addetti_antincendio || undefined,
        },
        sezione_c: {
          descrizione_attivita: draft.descrizione_attivita,
          reparti: draft.reparti.split('\n').map((s) => s.trim()).filter(Boolean),
          fasi_lavorative: draft.fasi_lavorative.split('\n').map((s) => s.trim()).filter(Boolean),
          attrezzature_principali: draft.attrezzature.split('\n').map((s) => s.trim()).filter(Boolean),
        },
        sezione_d: {
          pericoli_identificati: Object.entries(draft.pericoli_selezionati)
            .filter(([, v]) => v)
            .map(([k]) => k),
        },
        sezione_e: { matrice_rischi: matrice },
        sezione_f: {
          misure_tecniche: draft.misure_tecniche,
          misure_organizzative: draft.misure_organizzative,
          dpi_assegnati: draft.dpi,
          formazione: draft.formazione,
        },
        sezione_g: { interventi_pianificati: [] },
        sezione_h: {
          rumore: draft.rumore || undefined,
          mmc: draft.mmc || undefined,
          vibrazioni: draft.vibrazioni || undefined,
          chimico: draft.chimico || undefined,
        },
        sezione_i: { allegati: [] },
      };

      const dvr = await ds.dvr.create({
        company_id: companyId!,
        azienda: draft.ragione_sociale,
        status: 'draft',
        payload,
        rischio_max: 'basso',
        data_approvazione: null,
      });

      setSavedDvrId(dvr.id);
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Permission gate: solo ruoli con canCreate('dvr') possono accedere
  if (!authLoading && !canCreateDvr) {
    return (
      <AppShell pageTitle="Nuovo DVR">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <Lock size={32} className="mx-auto text-warn-mark mb-3" />
          <h3 className="section-title text-[17px] text-warn-ink">Funzione non disponibile</h3>
          <p className="mt-2 text-[13px] text-ink-soft">
            Il tuo ruolo non prevede la generazione di DVR. Riceverai i documenti completati direttamente in lista DVR
            quando il consulente RSPP li avrà finalizzati e firmati.
          </p>
          <button onClick={() => router.push('/dvr')} className="btn-primary mt-5"><ArrowLeft size={14} /> Torna ai DVR</button>
        </div>
      </AppShell>
    );
  }

  // Step pre-wizard: scelta azienda
  if (!pickerSelected) {
    return (
      <AppShell pageTitle="Nuovo DVR · Scegli azienda">
        <CompanyPicker
          canCreateCompany={canCreateCompany}
          onPick={(companyId, templateDvrId) => {
            setPickerSelected({ companyId, templateDvrId, isNew: false });
            // Reset draft a EMPTY se non si replica template (così non resta sporco da sessione precedente)
            if (templateDvrId === null) {
              setDraft({ ...EMPTY, company_id: companyId });
            }
          }}
          onNewCompany={() => {
            setPickerSelected({ companyId: null, templateDvrId: null, isNew: true });
            setDraft(EMPTY);
            localStorage.removeItem(DRAFT_KEY);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Nuovo DVR · Wizard guidato">
      <div className="space-y-6 animate-fade-up">
        {/* Ritorno contestuale alla scheda dell'azienda da cui si e' partiti. */}
        {draft.company_id && (
          <Link
            href={`/aziende/scheda?id=${draft.company_id}`}
            className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft size={14} /> Torna a {draft.ragione_sociale || 'scheda azienda'}
          </Link>
        )}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => { if (confirm('Cambiare azienda? Il draft corrente verrà perso.')) { setPickerSelected(null); setDraft(EMPTY); localStorage.removeItem(DRAFT_KEY); } }}
              className="text-[11px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft size={11} /> cambia azienda
            </button>
            <p className="label-upper">Step {current + 1} di {STEPS.length}</p>
            <h2 className="studio-h1 mt-1 uppercase tracking-wider2">{STEPS[current].label}</h2>
            <p className="text-[13px] text-ink-muted">
              {STEPS[current].description}
              {pickerSelected.templateDvrId && <Badge variant="brand" className="ml-2"><IconaAi size={10} /> replica attiva</Badge>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider2 text-ink-muted">
              <Save size={12} /> Autosave attivo
            </span>
            <button onClick={() => setShowImport((v) => !v)} type="button" className="btn-ghost">
              <Upload size={14} /> {showImport ? 'Chiudi import' : 'Importa documenti'}
            </button>
            <button onClick={reset} type="button" className="btn-ghost">Reset</button>
          </div>
        </header>

        {showImport && (
          <section className="card-luxury p-6 border-2 border-brand-200 bg-brand-50/40 space-y-4">
            <header>
              <div className="flex items-center gap-2">
                <IconaAi size={18} className="text-brand-600" />
                <h3 className="section-title text-[17px]">Caricamento massivo intelligente</h3>
              </div>
              <p className="mt-2 text-[13px] text-ink-soft">
                Carica vecchi DVR (PDF/DOCX), Excel con anagrafiche, organigrammi, manuali macchine.
                Il sistema estrae automaticamente i dati e pre-compila il wizard. <strong>Verifica sempre</strong> i campi
                con confidence bassa prima di salvare.
              </p>
            </header>
            <ImportDropzone
              accept={['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt']}
              multiple
              onFiles={handleImportFiles}
              title="Carica documenti DVR / supporto"
              description="PDF / Word / Excel / CSV / testo. Anche più file insieme: i dati vengono uniti."
            />
            {extracting && <div className="text-center text-[13px] text-ink-muted">Estrazione in corso…</div>}
            {extractResults && extractResults.length > 0 && (
              <div className="rounded-xl border border-ok bg-ok p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider2 text-ok-ink">
                  Estrazione completata ({extractResults.length} file)
                </p>
                {extractResults.map((r, i) => (
                  <details key={i} className="mt-3 text-[12px]">
                    <summary className="cursor-pointer font-semibold text-ink">
                      {r.source_filename} · {Object.keys(r.confidence).length} campi estratti · mode: {r.mode}
                    </summary>
                    <div className="mt-2 space-y-1 text-ink-soft">
                      {r.warnings.map((w, j) => (
                        <p key={j} className="flex items-start gap-2">
                          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warn-mark" />
                          {w}
                        </p>
                      ))}
                      <details className="ml-6 mt-2">
                        <summary className="cursor-pointer text-[11px] uppercase tracking-wider2 text-ink-muted">
                          Dettaglio campi estratti
                        </summary>
                        <ul className="mt-2 space-y-0.5 text-[11px] font-mono">
                          {Object.entries(r.confidence).map(([k, c]) => (
                            <li key={k}>
                              <span className="text-ink-muted">{k}</span>:{' '}
                              <span className={c >= 0.8 ? 'text-ok-ink' : c >= 0.7 ? 'text-warn-ink' : 'text-danger-ink'}>
                                {Math.round(c * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </details>
                ))}
                <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-ok-ink">
                  <CheckCircle2 size={13} /> Compilazione assistita. Scorri le sezioni per verificare e completare.
                </p>
              </div>
            )}
          </section>
        )}

        <WizardStepper steps={STEPS} current={current} completed={completedSet} onJump={goto} />

        <div className="card-luxury p-6 sm:p-8">
          {current === 0 && <StepA draft={draft} setDraft={setDraft} />}
          {current === 1 && <StepB draft={draft} setDraft={setDraft} />}
          {current === 2 && <StepC draft={draft} setDraft={setDraft} />}
          {current === 3 && <StepDWrapper draft={draft} setDraft={setDraft} />}
          {current === 4 && <StepEWrapper draft={draft} setDraft={setDraft} />}
          {current === 5 && <StepFWrapper draft={draft} setDraft={setDraft} />}
          {current === 6 && (
            <StepG
              draft={draft}
              saving={saving}
              savedDvrId={savedDvrId}
              error={error}
              reusedCompany={reusedCompany}
              onSave={handleSave}
              onView={() => savedDvrId && router.push(`/dvr/scheda?id=${savedDvrId}`)}
            />
          )}
        </div>

        <nav className="flex items-center justify-between gap-3">
          <button type="button" onClick={prev} disabled={current === 0} className="btn-ghost disabled:opacity-40">
            <ArrowLeft size={16} /> Indietro
          </button>
          {current < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary">
              Avanti <ArrowRight size={16} />
            </button>
          ) : null}
        </nav>
      </div>
    </AppShell>
  );
}

type StepProps = { draft: DraftPayload; setDraft: (fn: (d: DraftPayload) => DraftPayload) => void };

/**
 * Applica un patch sezione-bound al draft fondendo intelligentemente:
 *  - pericoli_selezionati: merge per chiave (no overwrite)
 *  - rischi: merge per categoria (gli ultimi vincono per stessa categoria)
 *  - altri campi: overwrite solo se non vuoto
 */
function applySectionPatch(setDraft: StepProps['setDraft'], patch: WizardDraftPatch): void {
  setDraft((d) => {
    const next: DraftPayload = { ...d };
    if (patch.ragione_sociale) next.ragione_sociale = patch.ragione_sociale;
    if (patch.partita_iva) next.partita_iva = patch.partita_iva;
    if (patch.ateco) next.ateco = patch.ateco;
    if (patch.lavoratori) next.lavoratori = patch.lavoratori;
    if (patch.dimensione) next.dimensione = patch.dimensione;
    if (patch.datore_lavoro) next.datore_lavoro = patch.datore_lavoro;
    if (patch.rspp) next.rspp = patch.rspp;
    if (patch.medico_competente) next.medico_competente = patch.medico_competente;
    if (patch.rls) next.rls = patch.rls;
    if (patch.pericoli_selezionati) {
      next.pericoli_selezionati = { ...d.pericoli_selezionati, ...patch.pericoli_selezionati };
    }
    if (patch.rischi && patch.rischi.length > 0) {
      const byCat = new Map(d.rischi.map((r) => [r.categoria, r]));
      for (const r of patch.rischi) byCat.set(r.categoria, r);
      next.rischi = Array.from(byCat.values());
    }
    if (patch.rumore) next.rumore = patch.rumore;
    if (patch.mmc) next.mmc = patch.mmc;
    if (patch.vibrazioni) next.vibrazioni = patch.vibrazioni;
    if (patch.chimico) next.chimico = patch.chimico;
    return next;
  });
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label-upper">{label}</label>
      {children}
    </div>
  );
}

function StepA({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">
        Dati anagrafici dell&apos;azienda, frontespizio del DVR (Sezione A · D.Lgs. 81/08 art. 28).
      </p>
      <SezioneUploader
        section="a"
        sectionLabel="Sezione A · Anagrafica"
        acceptedDocs="visura camerale, certificato attribuzione P.IVA, vecchio DVR (frontespizio)"
        onApply={(patch) => applySectionPatch(setDraft, patch)}
      />
      <FormGrid>
        <Field label="Ragione sociale *">
          <input className="input-luxury" required value={draft.ragione_sociale}
            onChange={(e) => setDraft((d) => ({ ...d, ragione_sociale: e.target.value }))} />
        </Field>
        <Field label="P. IVA *">
          <input className="input-luxury" required value={draft.partita_iva}
            onChange={(e) => setDraft((d) => ({ ...d, partita_iva: e.target.value }))} placeholder="IT12345678901" />
        </Field>
        <Field label="ATECO *">
          <input className="input-luxury" required value={draft.ateco}
            onChange={(e) => setDraft((d) => ({ ...d, ateco: e.target.value }))} placeholder="41.20" />
        </Field>
        <Field label="Descrizione attività ATECO">
          <input className="input-luxury" value={draft.ateco_label}
            onChange={(e) => setDraft((d) => ({ ...d, ateco_label: e.target.value }))} placeholder="Costruzione di edifici" />
        </Field>
        <Field label="Lavoratori totali *">
          <input type="number" min={0} className="input-luxury" required value={draft.lavoratori || ''}
            onChange={(e) => setDraft((d) => ({ ...d, lavoratori: Number(e.target.value) }))} />
        </Field>
        <Field label="Dimensione *">
          <select className="input-luxury" value={draft.dimensione}
            onChange={(e) => setDraft((d) => ({ ...d, dimensione: e.target.value as CompanyDimensione }))}>
            <option value="micro">Micro (1-9)</option>
            <option value="piccola">Piccola (10-49)</option>
            <option value="media">Media (50-249)</option>
            <option value="grande">Grande (≥250)</option>
          </select>
        </Field>
        <Field label="Indirizzo sede legale *">
          <input className="input-luxury" required value={draft.sede_indirizzo}
            onChange={(e) => setDraft((d) => ({ ...d, sede_indirizzo: e.target.value }))} />
        </Field>
        <Field label="Comune *">
          <input className="input-luxury" required value={draft.sede_comune}
            onChange={(e) => setDraft((d) => ({ ...d, sede_comune: e.target.value }))} />
        </Field>
        <Field label="Provincia *">
          <input className="input-luxury" required maxLength={2} value={draft.sede_provincia}
            onChange={(e) => setDraft((d) => ({ ...d, sede_provincia: e.target.value.toUpperCase() }))} placeholder="BG" />
        </Field>
        <Field label="CAP *">
          <input className="input-luxury" required pattern="\d{5}" value={draft.sede_cap}
            onChange={(e) => setDraft((d) => ({ ...d, sede_cap: e.target.value }))} />
        </Field>
      </FormGrid>
    </div>
  );
}

function StepB({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">Figure di sicurezza ai sensi del D.Lgs. 81/08 art. 18.</p>
      <SezioneUploader
        section="b"
        sectionLabel="Sezione B · Organigramma"
        acceptedDocs="organigramma sicurezza, lettera nomina RSPP, contratto medico competente, verbale elezione RLS"
        onApply={(patch) => applySectionPatch(setDraft, patch)}
      />
      <FormGrid>
        <Field label="Datore di lavoro *">
          <input className="input-luxury" required value={draft.datore_lavoro}
            onChange={(e) => setDraft((d) => ({ ...d, datore_lavoro: e.target.value }))} />
        </Field>
        <Field label="RSPP (interno o esterno) *">
          <input className="input-luxury" required value={draft.rspp}
            onChange={(e) => setDraft((d) => ({ ...d, rspp: e.target.value }))} />
        </Field>
        <Field label="Medico Competente">
          <input className="input-luxury" value={draft.medico_competente}
            onChange={(e) => setDraft((d) => ({ ...d, medico_competente: e.target.value }))} />
        </Field>
        <Field label="RLS / RLST">
          <input className="input-luxury" value={draft.rls}
            onChange={(e) => setDraft((d) => ({ ...d, rls: e.target.value }))} />
        </Field>
        <Field label="Addetti Primo Soccorso">
          <input className="input-luxury" value={draft.addetti_pronto_soccorso}
            onChange={(e) => setDraft((d) => ({ ...d, addetti_pronto_soccorso: e.target.value }))}
            placeholder="Nomi separati da virgola" />
        </Field>
        <Field label="Addetti Antincendio">
          <input className="input-luxury" value={draft.addetti_antincendio}
            onChange={(e) => setDraft((d) => ({ ...d, addetti_antincendio: e.target.value }))} />
        </Field>
      </FormGrid>
    </div>
  );
}

function StepC({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">Sezione C: descrivi attività, reparti, fasi e attrezzature. Una voce per riga.</p>
      <Field label="Descrizione attività">
        <AiAssistField
          value={draft.descrizione_attivita}
          onChange={(v) => setDraft((d) => ({ ...d, descrizione_attivita: v }))}
          sezione="dvr.sezione_c.descrizione_attivita"
          companyId={draft.company_id ?? undefined}
          placeholder="Descrivi il ciclo lavorativo: cosa produce/eroga l'azienda, le fasi principali, gli ambienti…"
          rows={4}
          defaultIstruzione="Scrivi la descrizione dell'attività e del ciclo lavorativo per la Sezione C del DVR, sulla base del settore ATECO e dei dati dell'azienda."
        />
      </Field>
      <Field label="Reparti / aree (uno per riga)">
        <textarea rows={4} className="input-luxury rounded-2xl py-3 h-auto" value={draft.reparti}
          onChange={(e) => setDraft((d) => ({ ...d, reparti: e.target.value }))}
          placeholder="Cantiere principale&#10;Magazzino&#10;Ufficio" />
      </Field>
      <Field label="Fasi lavorative (una per riga)">
        <textarea rows={4} className="input-luxury rounded-2xl py-3 h-auto" value={draft.fasi_lavorative}
          onChange={(e) => setDraft((d) => ({ ...d, fasi_lavorative: e.target.value }))} />
      </Field>
      <Field label="Attrezzature principali (una per riga)">
        <textarea rows={4} className="input-luxury rounded-2xl py-3 h-auto" value={draft.attrezzature}
          onChange={(e) => setDraft((d) => ({ ...d, attrezzature: e.target.value }))} />
      </Field>
    </div>
  );
}

function StepDWrapper({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <SezioneUploader
        section="d"
        sectionLabel="Sezione D · Pericoli identificati"
        acceptedDocs="vecchi DVR, registro pericoli, verbale sopralluogo RSPP, documenti UNI/INAIL specifici settore"
        onApply={(patch) => applySectionPatch(setDraft, patch)}
      />
      <_StepDInner draft={draft} setDraft={setDraft} />
    </div>
  );
}

function _StepDInner({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">Spunta i pericoli presenti: check-list completa per titolo del D.Lgs. 81/08.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PERICOLI_DLGS_81.map((p) => {
          const checked = !!draft.pericoli_selezionati[p];
          return (
            <label key={p} className="flex items-center gap-3 rounded-xl border border-brand-100 bg-white/60 px-4 py-2.5 cursor-pointer hover:border-brand-300">
              <input type="checkbox" checked={checked} className="h-4 w-4 accent-brand-500"
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  pericoli_selezionati: { ...d.pericoli_selezionati, [p]: e.target.checked },
                }))} />
              <span className="text-[13px] text-ink">{p}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StepEWrapper({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <SezioneUploader
        section="e"
        sectionLabel="Sezione E · Valutazione P×G"
        acceptedDocs="vecchi DVR con matrice rischi, report tecnici di settore, valutazioni RSPP precedenti"
        onApply={(patch) => applySectionPatch(setDraft, patch)}
      />
      <_StepEInner draft={draft} setDraft={setDraft} />
    </div>
  );
}

function _StepEInner({ draft, setDraft }: StepProps) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const addRischioTipico = (id: string) => {
    const r = RISCHI_TIPICI.find((x) => x.id === id);
    if (!r || draft.rischi.find((x) => x.id === id)) return;
    setDraft((d) => ({
      ...d,
      rischi: [...d.rischi, { id: r.id, categoria: r.categoria, p: r.p_default, g: r.g_default, fonte_norma: r.fonte_norma }],
    }));
  };
  const removeRischio = (id: string) => setDraft((d) => ({ ...d, rischi: d.rischi.filter((r) => r.id !== id) }));
  const updateRischio = (id: string, field: 'p' | 'g', value: number) =>
    setDraft((d) => ({
      ...d,
      rischi: d.rischi.map((r) => (r.id === id ? { ...r, [field]: value as 1 | 2 | 3 | 4 } : r)),
    }));

  // AI: genera pericoli + P×G + misure dal profilo azienda. Output editabile (l'RSPP verifica/firma).
  const generaConAI = async () => {
    setAiBusy(true);
    setAiMsg(null);
    try {
      const ds = getDataSource();
      // Mansioni REALI dell'azienda (dai lavoratori) -> rischi per-mansione (canone sez. 22).
      let mansioni: string | undefined;
      if (draft.company_id) {
        try {
          const lavoratori = await ds.lavoratori.list();
          const uniche = Array.from(
            new Set(
              lavoratori
                .filter((l) => l.company_id === draft.company_id && l.mansione)
                .map((l) => l.mansione.trim())
            )
          );
          if (uniche.length > 0) mansioni = uniche.join(', ');
        } catch {
          /* best-effort: senza mansioni l'AI usa comunque ATECO + KB */
        }
      }
      const res = await ds.ai.risks({ companyId: draft.company_id ?? undefined, mansioni });
      if (res.errore && res.rischi.length === 0) {
        setAiMsg(res.errore);
        return;
      }
      if (res.rischi.length === 0) {
        setAiMsg('L\'AI non ha proposto rischi: aggiungili dal catalogo o riprova.');
        return;
      }
      setDraft((d) => {
        // Dedup vs i rischi gia' presenti E tra i rischi AI dello stesso batch.
        const visti = new Set(d.rischi.map((r) => `${r.categoria}`.toLowerCase()));
        const nuovi: typeof d.rischi = [];
        res.rischi.forEach((r, i) => {
          const key = r.pericolo.toLowerCase();
          if (visti.has(key)) return;
          visti.add(key);
          nuovi.push({
            id: `ai-${Date.now()}-${i}`,
            categoria: r.pericolo,
            p: r.probabilita,
            g: r.gravita,
            fonte_norma: r.fonte_norma,
          });
        });
        // Aggrega le misure proposte nei campi misure (sezione F), senza perdere il testo esistente.
        const mt = res.rischi.map((r) => r.misure_tecniche).filter(Boolean).join(' ');
        const mo = res.rischi.map((r) => r.misure_organizzative).filter(Boolean).join(' ');
        return {
          ...d,
          rischi: [...d.rischi, ...nuovi],
          misure_tecniche: [d.misure_tecniche, mt].filter(Boolean).join('\n').trim(),
          misure_organizzative: [d.misure_organizzative, mo].filter(Boolean).join('\n').trim(),
        };
      });
      setAiMsg(`${res.rischi.length} rischi proposti dall'AI aggiunti. Verifica P×G e misure prima di procedere.`);
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : 'Generazione AI non riuscita.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">
        Per ogni rischio: <strong>P × G</strong> (scala 1-4). R = P × G classifica il livello.
      </p>

      {/* AI: pericoli + rischi + misure automatici dal profilo azienda */}
      <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-ink">Lascia che l&apos;AI proponga i rischi</p>
            <p className="text-[12px] text-ink-muted">Pericoli, valutazione P×G e misure dal profilo dell&apos;azienda. Resta tutto modificabile.</p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={generaConAI} disabled={aiBusy}>
            {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <IconaAi size={16} />}
            {aiBusy ? 'Generazione…' : 'Genera con AI'}
          </button>
        </div>
        {aiMsg && <p className="mt-2 text-[12px] text-brand-700">{aiMsg}</p>}
      </div>

      <Field label="Aggiungi rischio dal catalogo D.Lgs. 81/08">
        <select className="input-luxury" value="" onChange={(e) => addRischioTipico(e.target.value)}>
          <option value="">Scegli un rischio...</option>
          {RISCHI_TIPICI.filter((r) => !draft.rischi.find((x) => x.id === r.id)).map((r) => (
            <option key={r.id} value={r.id}>{r.categoria}</option>
          ))}
        </select>
      </Field>
      {draft.rischi.length === 0 ? (
        <p className="text-[13px] text-ink-muted italic">Nessun rischio aggiunto. Seleziona dal menu sopra.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] min-w-[680px]">
            <thead>
              <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Rischio · Norma</th>
                <th className="py-2 pr-3 font-semibold w-24">P</th>
                <th className="py-2 pr-3 font-semibold w-24">G</th>
                <th className="py-2 pr-3 font-semibold w-20">R</th>
                <th className="py-2 pr-3 font-semibold">Livello</th>
                <th className="py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {draft.rischi.map((r) => {
                const total = r.p * r.g;
                const livello = calcolaLivelloRischio(r.p, r.g);
                const variant = livello === 'molto_alto' ? 'risk-critical' : livello === 'alto' ? 'risk-high' : livello === 'medio' ? 'risk-medium' : 'risk-low';
                return (
                  <tr key={r.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink">{r.categoria}</p>
                      <p className="text-[11px] text-ink-muted">{r.fonte_norma}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select className="input-luxury h-9 px-3" value={r.p}
                        onChange={(e) => updateRischio(r.id, 'p', Number(e.target.value))}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select className="input-luxury h-9 px-3" value={r.g}
                        onChange={(e) => updateRischio(r.id, 'g', Number(e.target.value))}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pr-3 font-bold text-ink">{total}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={variant}>{livello.replace('_', ' ')}</Badge>
                    </td>
                    <td className="py-3">
                      <button onClick={() => removeRischio(r.id)} className="btn-icon" aria-label="Rimuovi">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StepFWrapper({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <SezioneUploader
        section="h"
        sectionLabel="Sezione H · Valutazioni specifiche (rumore, MMC, vibrazioni, chimico)"
        acceptedDocs="report fonometrico (UNI 9612), valutazione MMC NIOSH, report vibrazioni HAV/WBV, valutazione chimico MoVaRisCh"
        onApply={(patch) => applySectionPatch(setDraft, patch)}
      />
      <_StepFInner draft={draft} setDraft={setDraft} />
    </div>
  );
}

function _StepFInner({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="studio-body text-ink-muted">
        Sezione F · Gerarchia art. 15: <strong>1) eliminazione, 2) sostituzione, 3) protezione collettiva, 4) DPI</strong>.
      </p>
      <Field label="Misure tecniche">
        <textarea rows={3} className="input-luxury rounded-2xl py-3 h-auto" value={draft.misure_tecniche}
          onChange={(e) => setDraft((d) => ({ ...d, misure_tecniche: e.target.value }))} />
      </Field>
      <Field label="Misure organizzative">
        <textarea rows={3} className="input-luxury rounded-2xl py-3 h-auto" value={draft.misure_organizzative}
          onChange={(e) => setDraft((d) => ({ ...d, misure_organizzative: e.target.value }))} />
      </Field>
      <Field label="DPI assegnati (con norma EN)">
        <textarea rows={3} className="input-luxury rounded-2xl py-3 h-auto" value={draft.dpi}
          onChange={(e) => setDraft((d) => ({ ...d, dpi: e.target.value }))}
          placeholder="Es. Casco EN 397, scarpe S3 EN ISO 20345, otoprotettori EN 352…" />
      </Field>
      <Field label="Formazione (Accordo Stato-Regioni)">
        <textarea rows={3} className="input-luxury rounded-2xl py-3 h-auto" value={draft.formazione}
          onChange={(e) => setDraft((d) => ({ ...d, formazione: e.target.value }))} />
      </Field>
      <div className="border-t border-brand-100 pt-5">
        <p className="label-upper mb-3">Sezione H · Valutazioni specifiche (opzionali)</p>
        <FormGrid>
          <Field label="Rumore (LEX,8h)">
            <input className="input-luxury" value={draft.rumore}
              onChange={(e) => setDraft((d) => ({ ...d, rumore: e.target.value }))} placeholder="Es. 87 dB(A) · UNI 9612" />
          </Field>
          <Field label="MMC (NIOSH LI)">
            <input className="input-luxury" value={draft.mmc}
              onChange={(e) => setDraft((d) => ({ ...d, mmc: e.target.value }))} placeholder="Es. LI 2.1" />
          </Field>
          <Field label="Vibrazioni HAV A(8)">
            <input className="input-luxury" value={draft.vibrazioni}
              onChange={(e) => setDraft((d) => ({ ...d, vibrazioni: e.target.value }))} placeholder="Es. 4.2 m/s²" />
          </Field>
          <Field label="Chimico (MoVaRisCh)">
            <input className="input-luxury" value={draft.chimico}
              onChange={(e) => setDraft((d) => ({ ...d, chimico: e.target.value }))} />
          </Field>
        </FormGrid>
      </div>
    </div>
  );
}

function StepG({ draft, saving, savedDvrId, error, reusedCompany, onSave, onView }: {
  draft: DraftPayload; saving: boolean; savedDvrId: number | null; error: string | null;
  reusedCompany: { id: number; ragione_sociale: string } | null;
  onSave: () => void; onView: () => void;
}) {
  const totalRischi = draft.rischi.length;
  const rischiAlto = draft.rischi.filter((r) => r.p * r.g >= 6).length;
  const pericoli = Object.values(draft.pericoli_selezionati).filter(Boolean).length;
  const requiredOk =
    draft.ragione_sociale && draft.partita_iva && draft.ateco &&
    draft.sede_indirizzo && draft.sede_comune && draft.sede_provincia && draft.sede_cap &&
    draft.datore_lavoro && draft.rspp && draft.lavoratori > 0;

  return (
    <div className="space-y-6">
      <p className="studio-body text-ink-muted">Verifica e salva il DVR. Saranno incluse tutte le 9 sezioni, dalla A alla I.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-brand-50/70 px-4 py-3">
          <p className="label-upper">Azienda</p>
          <p className="mt-1 text-[14px] font-bold text-ink truncate">{draft.ragione_sociale || 'n.d.'}</p>
        </div>
        <div className="rounded-2xl bg-brand-50/70 px-4 py-3">
          <p className="label-upper">Pericoli</p>
          <p className="mt-1 text-[14px] font-bold text-ink">{pericoli}</p>
        </div>
        <div className="rounded-2xl bg-brand-50/70 px-4 py-3">
          <p className="label-upper">Rischi alto/molto alto</p>
          <p className="mt-1 text-[14px] font-bold text-ink">{rischiAlto} su {totalRischi}</p>
        </div>
      </div>
      <div className="rounded-2xl border-2 border-brand-300 bg-brand-50/40 p-5">
        <p className="label-upper text-brand-700">Disclaimer AI obbligatorio</p>
        <p className="mt-2 text-[13px] italic text-ink-soft">
          Documento generato con assistenza AI. La validità è subordinata alla verifica e
          sottoscrizione da parte delle figure competenti (Datore di Lavoro, RSPP, Medico Competente,
          RLS) ai sensi del D.Lgs. 81/08.
        </p>
      </div>
      {!requiredOk && !savedDvrId && (
        <div className="rounded-xl border border-warn bg-warn px-4 py-3 text-[13px] text-warn-ink">
          Mancano dati obbligatori. Torna agli step precedenti e completa i campi marcati con *.
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-danger bg-danger px-4 py-3 text-[13px] text-danger-ink">{error}</div>
      )}
      {!savedDvrId ? (
        <button onClick={onSave} disabled={saving || !requiredOk} className="btn-primary w-full sm:w-auto">
          {saving ? 'Salvataggio…' : 'Salva DVR'}
          {!saving && <FileDown size={16} />}
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-ok bg-ok p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={28} className="text-ok-mark" />
            <div>
              <p className="text-[15px] font-bold text-ok-ink">DVR salvato!</p>
              <p className="text-[12px] text-ok-ink">Versione registrata. Apri la scheda per scaricare DOCX e PDF.</p>
            </div>
          </div>
          {reusedCompany && (
            <div className="mt-3 rounded-xl border border-ok bg-white/60 px-3 py-2 text-[12px] text-ok-ink">
              <strong>Riutilizzata azienda esistente:</strong> {reusedCompany.ragione_sociale} (id {reusedCompany.id}). Il DVR è stato collegato a questa anagrafica per evitare duplicati.
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onView} className="btn-primary"><Plus size={14} /> Apri scheda DVR</button>
          </div>
        </div>
      )}
    </div>
  );
}
