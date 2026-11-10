'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getDataSource } from '@/lib/data-source';
import type { Company, CompanyDimensione, TipologieContrattuali } from '@/lib/data-source';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { AiAssistField } from '@/components/ai/AiAssistField';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  MapPin,
  NotebookPen,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';
import Link from 'next/link';

interface SedeOperativaForm {
  indirizzo: string;
  comune: string;
  provincia: string;
  cap: string;
}

interface FormValues {
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale: string;
  ateco: string;
  ateco_label: string;
  lavoratori: string;
  dimensione: CompanyDimensione;
  sede_indirizzo: string;
  sede_comune: string;
  sede_provincia: string;
  sede_cap: string;
  // Una o piu' sedi operative oltre alla sede legale (cantieri/stabilimenti/depositi).
  sedi_operative: SedeOperativaForm[];
  note: string;
}

const INITIAL: FormValues = {
  ragione_sociale: '',
  partita_iva: '',
  codice_fiscale: '',
  ateco: '',
  ateco_label: '',
  lavoratori: '',
  dimensione: 'piccola',
  sede_indirizzo: '',
  sede_comune: '',
  sede_provincia: '',
  sede_cap: '',
  sedi_operative: [],
  note: '',
};

const PIVA_REGEX = /^[A-Z]{0,2}\d{11}$/;
const ATECO_REGEX = /^\d{2}(\.\d{1,2})?$/;
const CAP_REGEX = /^\d{5}$/;

// Campi essenziali della visura che NON hanno un input nel form base: vengono
// estratti dall'AI e persistiti in Company.settings (round-trip completo).
const VISURA_EXTRA_KEYS = [
  'forma_giuridica', 'numero_rea', 'camera_commercio', 'pec', 'telefono', 'email',
  'ateco_secondari', 'oggetto_sociale', 'data_costituzione', 'data_iscrizione_registro',
  'capitale_sociale', 'capitale_versato', 'stato_attivita', 'sede_legale', 'amministratori',
] as const;

function deriveDimensione(lavoratori: number): CompanyDimensione {
  if (lavoratori >= 250) return 'grande';
  if (lavoratori >= 50) return 'media';
  if (lavoratori >= 10) return 'piccola';
  return 'micro';
}

export default function Page() {
  return (
    <Suspense fallback={<AppShell pageTitle="Caricamento"><div /></AppShell>}>
      <NuovaAziendaPage />
    </Suspense>
  );
}

function NuovaAziendaPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Modalita EDIT quando arriva ?id=<n> in querystring; altrimenti creazione.
  const editId = (() => {
    const raw = params.get('id');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  })();
  const isEdit = editId !== null;

  const [values, setValues] = useState<FormValues>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateExistingId, setDuplicateExistingId] = useState<number | null>(null);
  const [dimensioneTouched, setDimensioneTouched] = useState(false);
  // Campi extra della visura (forma giuridica, REA, PEC, amministratori, sede
  // legale, ecc.): catturati dall'estrazione AI e persistiti in Company.settings.
  const [extraVisura, setExtraVisura] = useState<Record<string, unknown>>({});
  // Composizione organico per tipologia contrattuale (art. 28 c.2a D.Lgs. 81/08).
  const [tipologieContrattuali, setTipologieContrattuali] = useState<TipologieContrattuali>({});
  const [showTipologie, setShowTipologie] = useState(false);
  // Caricamento dell'azienda da modificare (solo in modalita edit).
  const [loadingCompany, setLoadingCompany] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  // In modalita edit: carica l'azienda e precompila il form.
  useEffect(() => {
    if (editId === null) return;
    let active = true;
    setLoadingCompany(true);
    setLoadError(null);
    getDataSource()
      .companies.get(editId)
      .then((c) => {
        if (!active) return;
        if (!c) {
          setLoadError('Azienda non trovata o non accessibile.');
          return;
        }
        const sediArr = c.sedi ?? [];
        const sede = sediArr.find((s) => s.tipo === 'legale') ?? sediArr[0];
        const operative = sediArr
          .filter((s) => s !== sede && s.tipo !== 'legale')
          .map((s) => ({ indirizzo: s.indirizzo, comune: s.comune, provincia: (s.provincia ?? '').toUpperCase(), cap: s.cap }));
        setValues({
          ragione_sociale: c.ragione_sociale ?? '',
          partita_iva: (c.partita_iva ?? '').toUpperCase(),
          codice_fiscale: (c.codice_fiscale ?? '').toUpperCase(),
          ateco: c.ateco ?? '',
          ateco_label: c.ateco_label ?? '',
          lavoratori: c.lavoratori != null ? String(c.lavoratori) : '',
          dimensione: c.dimensione ?? 'piccola',
          sede_indirizzo: sede?.indirizzo ?? '',
          sede_comune: sede?.comune ?? '',
          sede_provincia: (sede?.provincia ?? '').toUpperCase(),
          sede_cap: sede?.cap ?? '',
          sedi_operative: operative,
          note: c.note ?? '',
        });
        // Preserva gli extra visura gia' salvati (escludi le chiavi tecniche di round-trip).
        if (c.settings && typeof c.settings === 'object') {
          const { ateco_label: _a, created_by: _c, note: _n, ...extra } = c.settings as Record<string, unknown>;
          setExtraVisura(extra);
          // Precompila le tipologie contrattuali se presenti.
          if (c.settings.tipologie_contrattuali && typeof c.settings.tipologie_contrattuali === 'object') {
            setTipologieContrattuali(c.settings.tipologie_contrattuali as TipologieContrattuali);
            setShowTipologie(true);
          }
        }
        // La dimensione esistente non va sovrascritta dall'auto-derive.
        setDimensioneTouched(true);
      })
      .catch((err) => {
        if (active) setLoadError((err as Error)?.message ?? 'Impossibile caricare l\'azienda.');
      })
      .finally(() => {
        if (active) setLoadingCompany(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  // Estrazione AI da visura camerale (PDF/immagine).
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  // true = errore grave (server 422/5xx, formato rifiutato) -> banner rosso.
  // false = avviso morbido (0 campi estratti) -> banner ambra.
  const [extractErrorSevere, setExtractErrorSevere] = useState(false);
  const [extractDisclaimer, setExtractDisclaimer] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<number | null>(null);

  const setField = <K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues((v) => {
      const next = { ...v, [key]: val };
      // Auto-deriva dimensione da numero lavoratori finché l'utente non la cambia manualmente.
      if (key === 'lavoratori' && !dimensioneTouched) {
        const n = Number(val);
        if (!Number.isNaN(n) && n > 0) next.dimensione = deriveDimensione(n);
      }
      return next;
    });
  };

  /**
   * Precompila SOLO i campi non-null tornati dall'estrazione. Non sovrascrive il vuoto.
   *
   * IMPORTANTE: il conteggio dei campi va calcolato DAI dati (sincrono), non
   * dentro l'updater di setValues — React puo' eseguire l'updater in modo
   * differito, quindi un contatore incrementato lì tornerebbe 0 al chiamante.
   */
  const prefillFromExtraction = (data: Partial<Company>): number => {
    const patch: Partial<typeof values> = {};
    if (data.ragione_sociale) patch.ragione_sociale = data.ragione_sociale;
    if (data.partita_iva) patch.partita_iva = data.partita_iva.toUpperCase();
    if (data.codice_fiscale) patch.codice_fiscale = data.codice_fiscale.toUpperCase();
    if (data.ateco) patch.ateco = data.ateco;
    if (data.ateco_label) patch.ateco_label = data.ateco_label;
    if (typeof data.lavoratori === 'number' && data.lavoratori > 0) {
      patch.lavoratori = String(data.lavoratori);
    }
    if (data.dimensione) {
      patch.dimensione = data.dimensione;
      // L'AI ha indicato una fascia: non lasciare che l'auto-derive la cambi.
      setDimensioneTouched(true);
    }
    const sede = data.sedi?.[0];
    if (sede?.indirizzo) patch.sede_indirizzo = sede.indirizzo;
    if (sede?.comune) patch.sede_comune = sede.comune;
    if (sede?.provincia) patch.sede_provincia = sede.provincia.toUpperCase();
    if (sede?.cap) patch.sede_cap = sede.cap;

    // Sedi operative estratte dalla visura (oltre la legale): le precompila tutte.
    const operativeEstratte = (data.sedi ?? [])
      .slice(1)
      .filter((s) => s.indirizzo || s.comune)
      .map((s) => ({ indirizzo: s.indirizzo ?? '', comune: s.comune ?? '', provincia: (s.provincia ?? '').toUpperCase(), cap: s.cap ?? '' }));
    if (operativeEstratte.length > 0) patch.sedi_operative = operativeEstratte;

    // Cattura i campi extra della visura (non presenti nel form base) per il
    // round-trip via settings: forma giuridica, REA, PEC, capitale, amministratori, ecc.
    const raw = data as unknown as Record<string, unknown>;
    const extra: Record<string, unknown> = {};
    for (const key of VISURA_EXTRA_KEYS) {
      const v = raw[key];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      extra[key] = v;
    }
    let extraCount = 0;
    if (Object.keys(extra).length > 0) {
      setExtraVisura((prev) => ({ ...prev, ...extra }));
      extraCount = Object.keys(extra).length;
    }

    const count = Object.keys(patch).length + extraCount;
    if (Object.keys(patch).length > 0) setValues((v) => ({ ...v, ...patch }));
    return count;
  };

  const handleExtract = async (files: File[]) => {
    const file = files[0];
    if (!file || extracting) return;
    // Guardia dimensione gentile: documenti fino a ~20MB. Non blocca i tipi,
    // segnala solo i file troppo grandi senza far crashare la UI.
    const MAX_DOC_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_DOC_BYTES) {
      setExtractError(
        'Il file supera 20 MB. Comprimi il documento o caricane una versione più leggera, oppure compila i campi a mano.'
      );
      setExtractErrorSevere(true);
      return;
    }
    setExtracting(true);
    setExtractProgress(0);
    setExtractError(null);
    setExtractErrorSevere(false);
    setExtractDisclaimer(null);
    setExtractedFields(null);
    try {
      const res = await getDataSource().companies.extractFromDocument(file, setExtractProgress);
      const count = prefillFromExtraction(res.data);
      setExtractedFields(count);
      setExtractDisclaimer(res.disclaimer);
      if (count === 0) {
        setExtractError(
          'Non sono riuscito a riconoscere dati nel documento. Compila i campi a mano: la visura potrebbe essere una scansione non leggibile.'
        );
        setExtractErrorSevere(false);
      }
    } catch (err) {
      const e = err as Error;
      // Errore grave: server ha rifiutato il file (formato non ammesso, 422, 5xx).
      // Mostriamo il messaggio esatto del server in un banner rosso ben visibile.
      setExtractError(
        e?.message ||
          'Caricamento non riuscito. Verificare che il file sia un PDF, PDF firmato (.p7m), immagine, Excel o Word, entro 20 MB.'
      );
      setExtractErrorSevere(true);
    } finally {
      setExtracting(false);
    }
  };

  // Validazioni inline (solo a campo riempito).
  const valid = {
    partita_iva: values.partita_iva ? PIVA_REGEX.test(values.partita_iva.toUpperCase()) : null,
    ateco: values.ateco ? ATECO_REGEX.test(values.ateco) : null,
    sede_cap: values.sede_cap ? CAP_REGEX.test(values.sede_cap) : null,
    sede_provincia: values.sede_provincia ? values.sede_provincia.length === 2 : null,
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDuplicateExistingId(null);
    setSubmitting(true);

    const payload = {
      ragione_sociale: values.ragione_sociale.trim(),
      partita_iva: values.partita_iva.trim().toUpperCase(),
      codice_fiscale: values.codice_fiscale.trim() || undefined,
      ateco: values.ateco.trim(),
      ateco_label: values.ateco_label.trim(),
      dimensione: values.dimensione,
      lavoratori: Number(values.lavoratori || 0),
      note: values.note.trim() || undefined,
      sedi: [
        {
          tipo: 'legale' as const,
          indirizzo: values.sede_indirizzo.trim(),
          comune: values.sede_comune.trim(),
          provincia: values.sede_provincia.trim().toUpperCase(),
          cap: values.sede_cap.trim(),
        },
        // Sedi operative compilate (almeno indirizzo o comune).
        ...values.sedi_operative
          .filter((s) => s.indirizzo.trim() !== '' || s.comune.trim() !== '')
          .map((s) => ({
            tipo: 'operativa' as const,
            indirizzo: s.indirizzo.trim(),
            comune: s.comune.trim(),
            provincia: s.provincia.trim().toUpperCase(),
            cap: s.cap.trim(),
          })),
      ],
      // Tutti i dati essenziali della visura (forma giuridica, REA, PEC, capitale,
      // oggetto sociale, amministratori, ecc.) persistiti in settings.
      // Merge con tipologie_contrattuali (art. 28 c.2a): round-trip conservativo.
      ...(Object.keys(extraVisura).length > 0 || Object.keys(tipologieContrattuali).length > 0
        ? {
            settings: {
              ...extraVisura,
              ...(Object.keys(tipologieContrattuali).length > 0
                ? { tipologie_contrattuali: tipologieContrattuali }
                : {}),
            },
          }
        : {}),
    };

    try {
      if (editId !== null) {
        const company = await getDataSource().companies.update(editId, payload);
        router.push(`/aziende/scheda?id=${company.id}`);
      } else {
        const company = await getDataSource().companies.create(payload);
        router.push(`/aziende/scheda?id=${company.id}&created=1`);
      }
    } catch (err) {
      const e = err as Error & { code?: string; existingId?: number };
      setError(e.message);
      if (e.code === 'DUPLICATE_PIVA' && typeof e.existingId === 'number') {
        setDuplicateExistingId(e.existingId);
      }
      setSubmitting(false);
    }
  };

  if (isEdit && loadingCompany) {
    return (
      <AppShell pageTitle="Modifica azienda">
        <div className="card-luxury p-10 text-center text-ink-muted">Caricamento dei dati azienda.</div>
      </AppShell>
    );
  }

  if (isEdit && loadError) {
    return (
      <AppShell pageTitle="Modifica azienda">
        <div className="max-w-3xl space-y-4 animate-fade-up">
          <Link
            href="/aziende"
            className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft size={14} /> Aziende
          </Link>
          <div role="alert" className="card-luxury border-2 border-danger bg-danger/60 p-6 text-[13px] text-danger-ink">
            {loadError}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={isEdit ? 'Modifica azienda' : 'Nuova azienda'}>
      <div className="max-w-3xl space-y-5 animate-fade-up">
        <Link
          href={isEdit ? `/aziende/scheda?id=${editId}` : '/aziende'}
          className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider2 text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft size={14} /> {isEdit ? 'Torna alla scheda' : 'Aziende'}
        </Link>

        {/* Compila da visura con l'AI (solo in creazione: in modifica i dati esistono gia) */}
        {!isEdit && (
        <section
          aria-label="Compila da visura con l'AI"
          className="card-luxury p-6 sm:p-7 space-y-4"
        >
          <header className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
              <IconaAi size={18} />
            </span>
            <div>
              <h2 className="section-title text-[17px] text-ink">Compila da visura con l&apos;AI</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Carica la visura camerale o un documento dell&apos;azienda: PDF, PDF firmato digitalmente (.p7m,
                formato Registro Imprese), foto (JPG, PNG), Excel, Word. Limite 20 MB. L&apos;AI ne riconosce
                i dati (ragione sociale, partita IVA, ATECO, dimensione e sede) e precompila il modulo
                qui sotto. Verifichi e salvi tu.
              </p>
            </div>
          </header>

          {!extracting && (
            <ImportDropzone
              accept={['.pdf', '.p7m', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv', '.docx', '.txt']}
              multiple={false}
              onFiles={handleExtract}
              title="Carica la visura camerale o un documento dell'azienda"
              description="Trascina qui il file o clicca per selezionarlo. PDF, PDF firmato (.p7m), foto (JPG, PNG), Excel, Word, CSV, testo. Massimo 20 MB."
            />
          )}

          {extracting && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5"
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700">
                <Loader2 size={16} className="animate-spin" /> Lettura visura in corso…
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
                  style={{ width: `${Math.max(5, extractProgress)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                Analisi del documento in corso (30-60 secondi per i PDF firmati). Attendi.
              </p>
            </div>
          )}

          {!extracting && extractDisclaimer && extractedFields !== null && extractedFields > 0 && (
            <div
              role="status"
              className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-[13px] text-brand-800"
            >
              <p className="font-semibold">
                {extractedFields} {extractedFields === 1 ? 'campo precompilato' : 'campi precompilati'} dalla visura.
              </p>
              <p className="mt-1 text-[12px] text-brand-700">{extractDisclaimer}</p>
            </div>
          )}

          {!extracting && extractError && (
            <div
              role="alert"
              aria-live="assertive"
              className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] ${
                extractErrorSevere
                  ? 'border-danger bg-danger/90 text-danger-ink'
                  : 'border-warn bg-warn/80 text-warn-ink'
              }`}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {extractErrorSevere ? 'Caricamento non riuscito' : 'Nessun dato riconosciuto'}
                </p>
                <p className="mt-0.5">{extractError}</p>
              </div>
            </div>
          )}
        </section>
        )}

        <form onSubmit={handleSubmit} className="card-luxury p-6 sm:p-8 space-y-6">
          <header>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white">
              <Building2 size={22} />
            </div>
            <h2 className="mt-3 studio-h1 uppercase tracking-wider2">
              {isEdit ? 'Modifica anagrafica' : 'Anagrafica azienda'}
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              {isEdit
                ? 'Aggiorna i dati anagrafici dell’azienda. Le modifiche si riflettono nel frontespizio dei nuovi DVR (Sezione A).'
                : 'I dati che inserisci finiscono nel frontespizio del DVR (Sezione A). Servono circa 2 minuti.'}
            </p>
          </header>

          {/* Gruppo 1: Identificazione */}
          <FieldGroup
            icon={<FileText size={16} />}
            title="Identificazione"
            description="Ragione sociale, partita IVA e codice ATECO dell'attività principale."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ragione sociale"
                required
                value={values.ragione_sociale}
                onChange={(v) => setField('ragione_sociale', v)}
                placeholder="Es. Verdi Costruzioni Srl"
                full
              />
              <Field
                label="Partita IVA"
                required
                value={values.partita_iva}
                onChange={(v) => setField('partita_iva', v.toUpperCase())}
                placeholder="IT12345678901"
                valid={valid.partita_iva}
                hint="11 cifre, opzionalmente preceduto da prefisso paese (es. IT)"
              />
              <Field
                label="Codice fiscale"
                value={values.codice_fiscale}
                onChange={(v) => setField('codice_fiscale', v.toUpperCase())}
                placeholder="Opzionale"
              />
              <Field
                label="Codice ATECO"
                required
                value={values.ateco}
                onChange={(v) => setField('ateco', v)}
                placeholder="41.20"
                valid={valid.ateco}
                hint="Formato: due cifre, opzionalmente con sottocategoria (es. 41.20)"
              />
              <Field
                label="Descrizione attività ATECO"
                value={values.ateco_label}
                onChange={(v) => setField('ateco_label', v)}
                placeholder="Es. Costruzione di edifici residenziali e non residenziali"
                full
              />
            </div>
          </FieldGroup>

          {/* Gruppo 2: Dimensione e attività */}
          <FieldGroup
            icon={<Users size={16} />}
            title="Dimensione"
            description="Quanti lavoratori conta l'azienda. La fascia di dimensione si compila in automatico ma puoi modificarla."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Numero lavoratori"
                required
                type="number"
                value={values.lavoratori}
                onChange={(v) => setField('lavoratori', v)}
                placeholder="24"
                min={0}
                max={100000}
                hint="Include dipendenti, soci lavoratori, apprendisti, somministrati"
              />
              <SelectField
                label="Fascia dimensionale"
                required
                value={values.dimensione}
                onChange={(v) => {
                  setDimensioneTouched(true);
                  setField('dimensione', v as CompanyDimensione);
                }}
                options={[
                  { value: 'micro', label: 'Micro (1-9 lavoratori)' },
                  { value: 'piccola', label: 'Piccola (10-49 lavoratori)' },
                  { value: 'media', label: 'Media (50-249 lavoratori)' },
                  { value: 'grande', label: 'Grande (250 lavoratori o più)' },
                ]}
              />
            </div>
          </FieldGroup>

          {/* Gruppo 2-bis: Composizione organico per tipologia contrattuale (art. 28 c.2a) */}
          <fieldset className="space-y-3 rounded-2xl border border-brand-100 bg-white/40 p-5">
            <legend className="flex w-full items-center gap-2 px-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Users size={16} />
              </span>
              <button
                type="button"
                className="flex flex-1 items-center justify-between text-left"
                aria-expanded={showTipologie}
                onClick={() => setShowTipologie((v) => !v)}
              >
                <span className="text-[12px] font-bold uppercase tracking-wider2 text-ink">
                  Composizione organico per tipologia contrattuale
                </span>
                {showTipologie ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
              </button>
            </legend>
            <p className="-mt-1 text-[12px] text-ink-muted">
              Indicare la composizione per tipologia contrattuale ai sensi dell&apos;art. 28 c.2a D.Lgs. 81/08. Tutti i campi sono opzionali: compila solo le tipologie presenti.
            </p>
            {showTipologie && (
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    { key: 'dipendenti', label: 'Dipendenti' },
                    { key: 'apprendisti', label: 'Apprendisti' },
                    { key: 'somministrati', label: 'Somministrati' },
                    { key: 'tirocinanti', label: 'Tirocinanti' },
                    { key: 'autonomi', label: 'Lavoratori autonomi' },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="label-upper">{label}</label>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={tipologieContrattuali[key] ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? undefined : Number(e.target.value);
                        setTipologieContrattuali((prev) => {
                          const next = { ...prev };
                          if (n === undefined) {
                            delete next[key];
                          } else {
                            next[key] = n;
                          }
                          return next;
                        });
                      }}
                      className="input-luxury"
                      placeholder="0"
                      disabled={submitting}
                    />
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          {/* Gruppo 3: Sede legale */}
          <FieldGroup
            icon={<MapPin size={16} />}
            title="Sede legale"
            description="Indirizzo dove ha sede l'azienda secondo visura camerale."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Indirizzo"
                required
                value={values.sede_indirizzo}
                onChange={(v) => setField('sede_indirizzo', v)}
                placeholder="Via dei Costruttori 24"
                full
              />
              <Field
                label="Comune"
                required
                value={values.sede_comune}
                onChange={(v) => setField('sede_comune', v)}
                placeholder="Bergamo"
              />
              <Field
                label="Provincia"
                required
                value={values.sede_provincia}
                onChange={(v) => setField('sede_provincia', v.toUpperCase())}
                placeholder="BG"
                maxLength={2}
                valid={valid.sede_provincia}
                hint="Sigla a 2 lettere"
              />
              <Field
                label="CAP"
                required
                value={values.sede_cap}
                onChange={(v) => setField('sede_cap', v)}
                placeholder="24100"
                maxLength={5}
                valid={valid.sede_cap}
                hint="5 cifre"
              />
            </div>
          </FieldGroup>

          {/* Gruppo 3-bis: Sedi operative (oltre la legale) — una o piu' */}
          <FieldGroup
            icon={<Building2 size={16} />}
            title="Sedi operative"
            description="Stabilimenti, cantieri, magazzini o filiali oltre la sede legale. Ogni sede operativa ha i suoi luoghi di lavoro e rischi: aggiungile tutte."
          >
            <div className="space-y-4">
              {values.sedi_operative.length === 0 && (
                <p className="text-[13px] text-ink-muted">Nessuna sede operativa. Aggiungine una se l&apos;azienda opera in piu&apos; luoghi.</p>
              )}
              {values.sedi_operative.map((s, i) => (
                <div key={i} className="rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="label-upper">Sede operativa {i + 1}</span>
                    <button
                      type="button"
                      className="btn-icon hover:text-danger-mark"
                      aria-label={`Rimuovi sede operativa ${i + 1}`}
                      onClick={() => setValues((v) => ({ ...v, sedi_operative: v.sedi_operative.filter((_, j) => j !== i) }))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Indirizzo"
                      value={s.indirizzo}
                      onChange={(val) => setValues((v) => ({ ...v, sedi_operative: v.sedi_operative.map((x, j) => (j === i ? { ...x, indirizzo: val } : x)) }))}
                      placeholder="Via dello Stabilimento 10"
                      full
                    />
                    <Field
                      label="Comune"
                      value={s.comune}
                      onChange={(val) => setValues((v) => ({ ...v, sedi_operative: v.sedi_operative.map((x, j) => (j === i ? { ...x, comune: val } : x)) }))}
                      placeholder="Brescia"
                    />
                    <Field
                      label="Provincia"
                      value={s.provincia}
                      onChange={(val) => setValues((v) => ({ ...v, sedi_operative: v.sedi_operative.map((x, j) => (j === i ? { ...x, provincia: val.toUpperCase() } : x)) }))}
                      placeholder="BS"
                      maxLength={2}
                      hint="Sigla a 2 lettere"
                    />
                    <Field
                      label="CAP"
                      value={s.cap}
                      onChange={(val) => setValues((v) => ({ ...v, sedi_operative: v.sedi_operative.map((x, j) => (j === i ? { ...x, cap: val } : x)) }))}
                      placeholder="25100"
                      maxLength={5}
                      hint="5 cifre"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setValues((v) => ({ ...v, sedi_operative: [...v.sedi_operative, { indirizzo: '', comune: '', provincia: '', cap: '' }] }))}
              >
                <Plus size={16} /> Aggiungi sede operativa
              </button>
            </div>
          </FieldGroup>

          {/* Gruppo 4: Note attività (compilazione assistita AI: scrivi o detta) */}
          <FieldGroup
            icon={<NotebookPen size={16} />}
            title="Note attività"
            description="Descrivi l'oggetto dell'attività e il ciclo lavorativo. Puoi scrivere a mano, farti assistere dall'AI o dettare a voce: il testo confluisce nel contesto del DVR."
          >
            <AiAssistField
              value={values.note}
              onChange={(v) => setField('note', v)}
              sezione="azienda.note"
              companyId={editId ?? undefined}
              placeholder="Es. Officina meccanica con tornitura e saldatura, 8 addetti, 2 turni…"
              rows={5}
              defaultIstruzione="Scrivi una descrizione professionale dell'oggetto dell'attività e del ciclo lavorativo dell'azienda, adatta alla Sezione C del DVR, sulla base dei dati anagrafici e ATECO inseriti."
              disabled={submitting}
            />
          </FieldGroup>

          {error && (
            <div role="alert" className="rounded-xl border border-danger bg-danger/80 px-4 py-3 text-[13px] text-danger-ink space-y-2">
              <p>{error}</p>
              {duplicateExistingId !== null && (
                <Link
                  href={`/aziende/scheda?id=${duplicateExistingId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-danger-mark px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider2 text-white hover:bg-danger-mark"
                >
                  Vai all&apos;azienda esistente
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-brand-100 pt-5">
            <Link href={isEdit ? `/aziende/scheda?id=${editId}` : '/aziende'} className="btn-ghost">
              Annulla
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              <Save size={16} />{' '}
              {submitting
                ? 'Salvataggio in corso'
                : isEdit
                  ? 'Salva modifiche'
                  : 'Salva azienda'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FieldGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-brand-100 bg-white/40 p-5">
      <legend className="flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">{icon}</span>
        <span className="text-[12px] font-bold uppercase tracking-wider2 text-ink">{title}</span>
      </legend>
      <p className="-mt-2 text-[12px] text-ink-muted">{description}</p>
      {children}
    </fieldset>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  full?: boolean;
  /** null = non ancora valutato (campo vuoto), true = valido, false = non valido */
  valid?: boolean | null;
  hint?: string;
}) {
  const showCheck = props.valid === true;
  const showError = props.valid === false;
  return (
    <div className={`space-y-1.5 ${props.full ? 'sm:col-span-2' : ''}`}>
      <label className="label-upper flex items-center gap-1.5">
        {props.label} {props.required && <span className="text-brand-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={props.type ?? 'text'}
          required={props.required}
          placeholder={props.placeholder}
          min={props.min}
          max={props.max}
          maxLength={props.maxLength}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={`input-luxury ${showCheck ? 'pr-10 border-ok' : ''} ${showError ? 'pr-10 border-danger' : ''}`}
          aria-invalid={showError || undefined}
        />
        {showCheck && (
          <Check
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ok-mark"
            aria-label="formato valido"
          />
        )}
      </div>
      {props.hint && !showError && (
        <p className="text-[11px] text-ink-muted">{props.hint}</p>
      )}
      {showError && (
        <p className="text-[11px] text-danger-mark">Formato non valido. {props.hint}</p>
      )}
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="label-upper flex items-center gap-1.5">
        {props.label} {props.required && <span className="text-brand-500">*</span>}
      </label>
      <select
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="input-luxury"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
