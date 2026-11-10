import type { PassoInterfaccia, RicercaDocumenti } from '@/lib/falco/interfaccia';
// Tipi e interfacce condivise per il DataSource adapter.
//
// Modalità supportate:
//   - 'local'  → LocalStorageDataSource (CRUD persistente nel browser, scoped per utente)
//   - 'api'    → ApiDataSource (Laravel reale via JWT, post-cPanel)

import type { CodaDataSource, DocumentiHseDataSource, PannelloModuli } from './moduli-types';

export type Role =
  | 'admin_conflavoro'
  | 'titolare_studio'
  | 'consulente'
  | 'datore_lavoro'
  /** Persona dell'azienda cliente invitata dal titolare: referente, consulente del lavoro, medico (ruoli per azienda). */
  | 'utente_azienda';

/** App di ingresso decisa dal backend: lo studio lavora nel gestionale, l'azienda nella sua area. */
export type AppUtente = 'gestionale' | 'azienda';

/** Azienda su cui l'utente dell'azienda ha un ruolo, con le azioni consentite (RuoliAzienda::MATRICE). */
export interface AziendaUtente {
  id: number;
  ragione_sociale: string;
  ruoli: string[];
  permessi: string[];
  /** Cliente nuovo in attivazione (vede solo il percorso), o benvenuto da mostrare. */
  attivazione?: { stato: string; benvenuto: boolean } | null;
}

export type DataSourceMode = 'local' | 'api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  tenant_id: number | null;
  tenant_name?: string;
  mfa_enabled?: boolean;
  /** true finché l'utente non ha completato l'onboarding (scelta ruolo + profilo). */
  needs_onboarding?: boolean;
  /** URL avatar (es. da Google). Opzionale. */
  avatar_url?: string;
  /** Codice studio (slug del tenant) che il titolare condivide col consulente. */
  studio_code?: string;
  /** P.IVA del tenant (studio o azienda) raccolta in onboarding. */
  tenant_vat?: string;
  /** ATECO dell'azienda (datore_lavoro) raccolto in onboarding. */
  tenant_ateco?: string;
  /** App di ingresso (gestionale per lo studio, azienda per il cliente). */
  app?: AppUtente;
  /** Aziende su cui ha un ruolo (solo datore_lavoro e utente_azienda). */
  aziende?: AziendaUtente[];
}

// ============================================================
// ONBOARDING — profilo raccolto al primo accesso
// ============================================================

export interface OnboardingProfile {
  role: Role;
  /** Codice di accesso richiesto SOLO per il ruolo admin_conflavoro. */
  admin_invite_code?: string;
  /** titolare_studio: dati dello studio che sta creando. */
  studio_nome?: string;
  studio_partita_iva?: string;
  /** consulente: studio di appartenenza o codice invito ricevuto. */
  studio_codice_invito?: string;
  studio_appartenenza?: string;
  /**
   * datore_lavoro: codice invito ricevuto dal consulente RSPP.
   * Il backend lega l'account alla company corrispondente (sola lettura).
   * Sostituisce ragione_sociale + partita_iva (non servono: li ha gia' il consulente).
   */
  azienda_invite_code?: string;
  /** @deprecated Usa azienda_invite_code. Mantenuto per compatibilita' backward. */
  azienda_ragione_sociale?: string;
  /** @deprecated Usa azienda_invite_code. Mantenuto per compatibilita' backward. */
  azienda_partita_iva?: string;
  azienda_ateco?: string;
}

export interface GoogleLoginResult {
  user: User;
  needs_onboarding: boolean;
}

export type CompanyDimensione = 'micro' | 'piccola' | 'media' | 'grande';

export interface CompanySede {
  tipo: 'legale' | 'operativa' | 'deposito';
  indirizzo: string;
  comune: string;
  provincia: string;
  cap: string;
}

export interface Company {
  id: number;
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale?: string;
  ateco: string;
  ateco_label: string;
  dimensione: CompanyDimensione;
  lavoratori: number;
  sedi: CompanySede[];
  /**
   * Note descrittive sull'oggetto dell'attività (ciclo lavorativo, contesto).
   * Campo libero compilabile anche con assistenza AI (scrivi/detta).
   */
  note?: string;
  /**
   * Campi extra non-colonna (round-trip via settings): tutti i dati essenziali
   * della visura camerale — forma giuridica, REA, camera di commercio, PEC,
   * telefono, email, ATECO secondari, oggetto sociale, date costituzione/iscrizione,
   * capitale sociale/versato, stato attività, sede legale strutturata, amministratori.
   */
  settings?: CompanySettings;
  /**
   * ID consulente assegnato da titolare/admin. NULL = azienda comune (visibile a
   * tutti i consulenti dello studio). Valorizzato = solo quel consulente la vede.
   * In lettura: esposto da CompanyResource. In scrittura: PATCH accettato solo da
   * titolare_studio / admin_conflavoro (consulente riceve 403 dal backend).
   */
  assigned_user_id?: number | null;
  /** ID utente che ha creato l'azienda. */
  created_by: number;
  created_at: string;
  /** Ultima modifica dei dati azienda (per rilevare DVR da aggiornare). */
  updated_at?: string;
}

/**
 * Tipo di rappresentante dei lavoratori per la sicurezza. La scelta RLS vs RLST
 * e' SEMPRE esplicita (mai dedotta): RLS = eletto/designato in azienda; RLST =
 * territoriale (quando in azienda non e' eletto, art. 48 D.Lgs. 81/08).
 */
export type RappresentanteTipo = 'RLS' | 'RLST' | 'assente';

/**
 * Organigramma HSE per-azienda (sez. 3 del canone DVR). Ruolo-primo: ogni figura
 * e' assegnata a una sezione esplicita, mai dedotta. Persistito in Company.settings.
 */
export interface OrganigrammaHSE {
  datore_lavoro?: string;
  /** Il datore di lavoro svolge direttamente il ruolo di RSPP (art. 34). */
  datore_svolge_rspp?: boolean;
  rspp?: string;
  /** RSPP esterno (consulente) anziche' interno. */
  rspp_esterno?: boolean;
  aspp?: string[];
  medico_competente?: string;
  /** Sorveglianza sanitaria non prevista per i rischi valutati. */
  medico_non_necessario?: boolean;
  /** Scelta ESPLICITA RLS/RLST/assente. */
  rappresentante_tipo?: RappresentanteTipo;
  rappresentante_nominativo?: string;
  dirigenti?: string[];
  preposti?: string[];
  addetti_antincendio?: string[];
  addetti_primo_soccorso?: string[];
  addetti_evacuazione?: string[];
  consulenti_esterni?: Array<{ nominativo: string; ruolo?: string }>;
}

/**
 * Composizione organico per tipologia contrattuale (art. 28 c.2a D.Lgs. 81/08).
 * Persistita in Company.settings.tipologie_contrattuali. Tutti i campi opzionali
 * (si compilano solo le tipologie presenti in azienda).
 */
export interface TipologieContrattuali {
  dipendenti?: number;
  apprendisti?: number;
  somministrati?: number;
  tirocinanti?: number;
  autonomi?: number;
}

/** Dati extra della visura, persistiti in Company.settings (round-trip). */
export interface CompanySettings {
  organigramma?: OrganigrammaHSE;
  /** Composizione organico per tipologia contrattuale (art. 28 c.2a). */
  tipologie_contrattuali?: TipologieContrattuali;
  forma_giuridica?: string | null;
  numero_rea?: string | null;
  camera_commercio?: string | null;
  pec?: string | null;
  telefono?: string | null;
  email?: string | null;
  ateco_secondari?: string[] | null;
  oggetto_sociale?: string | null;
  data_costituzione?: string | null;
  data_iscrizione_registro?: string | null;
  capitale_sociale?: string | number | null;
  capitale_versato?: boolean | null;
  stato_attivita?: string | null;
  sede_legale?: { indirizzo?: string; comune?: string; provincia?: string; cap?: string } | null;
  amministratori?: Array<{ nome_cognome?: string; carica?: string; data_nomina?: string | null }> | null;
  [key: string]: unknown;
}

export type DvrStatus = 'draft' | 'review' | 'approved' | 'superseded';
export type RischioLivello = 'basso' | 'medio' | 'alto' | 'molto_alto';

// ============================================================
// DVR PAYLOAD COMPLETO — 9 sezioni A→I (D.Lgs. 81/08 art. 28)
// ============================================================

export interface SezioneA {
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale?: string;
  ateco: string;
  sede_legale: string;
  lavoratori_totali: number;
  dimensione: CompanyDimensione;
  data_redazione: string;
}

export interface SezioneB {
  datore_lavoro: string;
  rspp: string;
  medico_competente?: string;
  /**
   * Sorveglianza sanitaria non prevista per i rischi valutati (art. 41 D.Lgs. 81/08).
   * Quando true il backend omette il campo medico_competente dalla sezione B del DVR
   * e aggiunge la dichiarazione obbligatoria di non assoggettabilita'.
   */
  medico_non_necessario?: boolean;
  rls?: string;
  addetti_pronto_soccorso?: string;
  addetti_antincendio?: string;
}

export interface SezioneC {
  descrizione_attivita: string;
  reparti: string[];
  fasi_lavorative: string[];
  attrezzature_principali: string[];
}

export interface SezioneD {
  pericoli_identificati: string[];
}

export interface RischioValutato {
  pericolo: string;
  probabilita: 1 | 2 | 3 | 4;
  gravita: 1 | 2 | 3 | 4;
  livello: RischioLivello;
  fonte_norma?: string;
}

export interface SezioneE {
  matrice_rischi: RischioValutato[];
}

export interface SezioneF {
  misure_tecniche: string;
  misure_organizzative: string;
  dpi_assegnati: string;
  formazione: string;
}

export interface InterventoMiglioramento {
  intervento: string;
  responsabile: string;
  scadenza: string;
  stato: 'da_avviare' | 'in_corso' | 'completato';
}

export interface SezioneG {
  interventi_pianificati: InterventoMiglioramento[];
}

export interface SezioneH {
  rumore?: string;
  vibrazioni?: string;
  mmc?: string;
  chimico?: string;
  stress_lc?: string;
  incendio?: string;
}

export interface SezioneI {
  allegati: string[];
}

export interface DvrPayload {
  sezione_a: SezioneA;
  sezione_b: SezioneB;
  sezione_c: SezioneC;
  sezione_d: SezioneD;
  sezione_e: SezioneE;
  sezione_f: SezioneF;
  sezione_g: SezioneG;
  sezione_h?: SezioneH;
  sezione_i: SezioneI;
}

export interface Dvr {
  id: number;
  company_id: number;
  azienda: string; // denormalizzato per liste
  versione: number;
  status: DvrStatus;
  payload: DvrPayload;
  rischio_max: RischioLivello;
  data_creazione: string;
  data_approvazione: string | null;
  approved_by?: number;
  content_hash?: string;
  /** ID utente creatore (consulente/datore_lavoro). */
  created_by: number;
  ai_disclaimer_text: string;
  /** Istante dell'ultima generazione del contenuto DVR (per staleness vs dati azienda). */
  generated_at?: string;
  /** URL backend del DOCX reale generato dall'AI (R2/firmato). Solo modalità API. */
  docx_url?: string;
  /** URL backend del PDF reale generato dall'AI (R2/firmato). Solo modalità API. */
  pdf_url?: string;
}

// ============================================================
// GENERAZIONE DVR con AI (DVR Authoring Crew lato backend)
// ============================================================

/**
 * Esito dell'avvio generazione (POST /dvr/{id}/generate).
 * - mode 'sync'  → il backend ha completato nella stessa richiesta (result presente).
 * - mode 'async' → la generazione gira in coda: la UI deve fare polling di
 *   generationStatus finché non termina.
 */
export interface DvrGenerationResult {
  mode: 'sync' | 'async';
  /** Stato sintetico riportato dal backend (es. 'pending' | 'completed' | 'done'). */
  status?: string;
  /** Payload grezzo dell'esito quando sync (non tipizzato: dipende dal backend). */
  result?: unknown;
}

/** Stato corrente della generazione (GET /dvr/{id}/generation-status). */
export interface DvrGenerationStatus {
  dvr_id: number;
  dvr_status: string;
  /** Blocco libero del backend: status interno + eventuali url docx/pdf. */
  generation: Record<string, unknown>;
}

// ============================================================
// STORICO REVISIONI DVR (GET/POST /dvr/{id}/revisions)
// ============================================================

/** Origine del testo: scritto dall'AI oppure corretto a mano dal consulente. */
export type DvrRevisionOrigine = 'ai' | 'umano';

/** Riga dell'elenco revisioni (GET /dvr/{id}/revisions). */
export interface DvrRevisionSummary {
  numero: number;
  origine: DvrRevisionOrigine;
  autore: string | null;
  motivo: string | null;
  sezioni_modificate: string[];
  sezioni_umane: string[];
  totale_sezioni: number;
  canonical_27: boolean | null;
  ha_file: boolean;
  created_at: string | null;
}

/** Sezione di testo di una revisione. */
export interface DvrRevisionSection {
  key: string;
  title: string;
  body: string;
  origine: DvrRevisionOrigine;
  modificata_da?: string | null;
  modificata_at?: string | null;
}

/** Revisione completa con il testo delle sezioni. */
export interface DvrRevisionDetail extends DvrRevisionSummary {
  sezioni: DvrRevisionSection[];
}

/** Elenco revisioni con il numero della corrente (la piu recente). */
export interface DvrRevisionList {
  dvr_id: number;
  corrente: number | null;
  data: DvrRevisionSummary[];
}

/** Modifica a una sezione: almeno uno tra body e title. */
export interface DvrRevisionChange {
  key: string;
  body?: string;
  title?: string;
}

export interface DvrRevisionCreateInput {
  modifiche: DvrRevisionChange[];
  motivo?: string;
}

/** Opzioni di generazione AI. */
export interface DvrGenerateOptions {
  /** Se true l'AI riscrive anche le sezioni corrette a mano (default false). */
  riscriviModificheUmane?: boolean;
}

export interface AuditLogEntry {
  id: number;
  dvr_id: number;
  action: 'created' | 'updated' | 'approved' | 'generated' | 'downloaded';
  actor_id: number;
  payload?: Record<string, unknown>;
  prev_hash?: string;
  current_hash: string;
  created_at: string;
}

export interface HealthStatus {
  mode: DataSourceMode;
  ok: boolean;
  latency_ms: number;
  version?: string;
  error?: string;
}

// ============================================================
// DOCUMENTI / MEDIA caricati su un DVR (ponte verso il backend reale)
// ============================================================

export type UploadKind = 'document' | 'media';

export interface DvrUpload {
  id: number;
  dvr_id: number;
  kind: UploadKind;
  filename: string;
  /** MIME type (es. application/pdf, image/jpeg). */
  mime: string;
  size_bytes: number;
  /** URL di download (R2/firmato) quando disponibile lato backend. */
  url?: string;
  /** Stato di elaborazione lato backend (classificazione/estrazione/OCR/vision). */
  status: 'caricato' | 'in_elaborazione' | 'elaborato' | 'errore';
  /** Nota sintetica sull'esito (es. esito estrazione euristica in demo). */
  note?: string;
  created_by: number;
  created_at: string;
}

/** Callback di avanzamento upload: percent 0..100. */
export type UploadProgress = (percent: number) => void;

export interface DvrMediaDataSource {
  /** Carica un documento (PDF/DOCX/XLSX/...) collegato a un DVR. */
  uploadDocument(dvrId: number, file: File, onProgress?: UploadProgress): Promise<DvrUpload>;
  /** Carica una immagine/foto (sopralluogo, planimetria, DPI...) collegata a un DVR. */
  uploadMedia(dvrId: number, file: File, onProgress?: UploadProgress): Promise<DvrUpload>;
  /** Elenca documenti+media caricati su un DVR. */
  listUploads(dvrId: number): Promise<DvrUpload[]>;
  /**
   * Rimuove un upload identificato da kind + posizione 1-based (DvrUpload.id),
   * coerente con come listUploads numera gli elementi per ciascun kind.
   * Mappa sul backend a DELETE /dvr/{id}/{documents|media}/{index} (index 0-based).
   */
  deleteUpload(dvrId: number, kind: UploadKind, uploadId: number): Promise<void>;
}

// ============================================================
// Sub-interfacce DataSource
// ============================================================

export interface AuthDataSource {
  login(email: string, password: string): Promise<User>;
  loginAs(role: Role): Promise<User>;
  /**
   * Login con Google: riceve l'ID token (credential) ottenuto client-side da
   * @react-oauth/google e lo invia a POST /api/auth/google. Risponde con utente
   * + flag needs_onboarding (true al primo accesso, prima della scelta ruolo).
   */
  googleLogin(idToken: string): Promise<GoogleLoginResult>;
  /** Salva il profilo di onboarding e marca l'utente come onboarded. */
  completeOnboarding(profile: OnboardingProfile): Promise<User>;
  me(): Promise<User | null>;
  logout(): Promise<void>;
}

/** Esito dell'estrazione AI dei dati azienda da una visura camerale (PDF/immagine). */
export interface CompanyExtractionResult {
  /** Campi riconosciuti (solo quelli non-null). Da rivedere prima del salvataggio. */
  data: Partial<Company>;
  /** Disclaimer obbligatorio: i dati sono estratti con assistenza AI e vanno verificati. */
  disclaimer: string;
}

export interface CompaniesDataSource {
  list(): Promise<Company[]>;
  get(id: number): Promise<Company | null>;
  create(data: Omit<Company, 'id' | 'created_at' | 'created_by'>): Promise<Company>;
  update(id: number, patch: Partial<Company>): Promise<Company>;
  delete(id: number): Promise<void>;
  /**
   * Estrae i dati anagrafici di un'azienda da una visura camerale (PDF/JPG/PNG)
   * tramite AI. Precompila il form: NON crea l'azienda. L'utente verifica e salva.
   * In modalita API chiama POST /companies/extract; in modalita demo (localStorage)
   * usa parser + euristiche client-side e degrada con grazia (data vuoto, nessun crash).
   */
  extractFromDocument(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<CompanyExtractionResult>;
  /**
   * Genera un codice invito per il datore di lavoro (POST /companies/{id}/datore-invite).
   * Il consulente/titolare chiama questo metodo e condivide il codice col datore.
   * Il datore lo usa in onboarding (azienda_invite_code) per collegare il suo account
   * alla company in sola lettura (senza dover inserire P.IVA/ragione sociale).
   * In modalita demo ritorna un codice finto senza toccare il backend.
   */
  datoreInvite(companyId: number): Promise<{ code: string; company_id: number }>;
}

export interface DvrDataSource {
  list(): Promise<Dvr[]>;
  get(id: number): Promise<Dvr | null>;
  /** Crea un DVR con versione auto-incrementata per quella company. */
  create(data: Omit<Dvr, 'id' | 'versione' | 'data_creazione' | 'created_by' | 'ai_disclaimer_text'>): Promise<Dvr>;
  update(id: number, patch: Partial<Dvr>): Promise<Dvr>;
  approve(id: number): Promise<Dvr>;
  delete(id: number): Promise<void>;
  /** Audit log per un DVR specifico. */
  audit(dvrId: number): Promise<AuditLogEntry[]>;
  /**
   * Avvia la generazione del DVR con l'AI (DVR Authoring Crew lato backend).
   * In modalità API chiama POST /dvr/{id}/generate. In demo (localStorage) simula
   * un esito "completato" senza coda (mode 'sync'), così la UI resta usabile.
   */
  generate(dvrId: number, opts?: DvrGenerateOptions): Promise<DvrGenerationResult>;
  /**
   * Stato corrente della generazione (GET /dvr/{id}/generation-status).
   * In demo ritorna sempre uno stato "completed" coerente col DVR esistente.
   */
  generationStatus(dvrId: number): Promise<DvrGenerationStatus>;
  /** Storico revisioni del testo, dalla piu recente. */
  revisions(dvrId: number): Promise<DvrRevisionList>;
  /** Testo completo di una revisione. */
  revision(dvrId: number, numero: number): Promise<DvrRevisionDetail>;
  /** Registra una revisione umana (422 se nessuna modifica o DVR senza testo). */
  createRevision(dvrId: number, input: DvrRevisionCreateInput): Promise<DvrRevisionDetail>;
  /** Ripristina il testo di una revisione precedente creando una nuova revisione. */
  restoreRevision(dvrId: number, numero: number): Promise<DvrRevisionSummary>;
}

// ============================================================
// ENTITÀ ESTESE: lavoratori, DPI, attrezzature, corsi, scadenze
// ============================================================

export interface Lavoratore {
  id: number;
  company_id: number;
  azienda?: string;
  nome: string;
  cognome: string;
  codice_fiscale?: string;
  mansione: string;
  data_assunzione?: string;
  idoneita_sanitaria_data?: string;
  formazione_svolta?: string[];
  dpi_assegnati?: string[];
  note?: string;
  created_by: number;
  created_at: string;
}

export type DpiCategoria = 'I' | 'II' | 'III';

export interface Dpi {
  id: number;
  company_id?: number;
  tipo: string;
  norma_en?: string;
  categoria: DpiCategoria;
  marca?: string;
  modello?: string;
  fornitore?: string;
  data_consegna?: string;
  scadenza?: string;
  note?: string;
  created_by: number;
  created_at: string;
}

export interface Attrezzatura {
  id: number;
  company_id: number;
  azienda?: string;
  codice_interno: string;
  marca?: string;
  modello?: string;
  marcatura_ce: boolean;
  anno_installazione?: number;
  prossima_manutenzione?: string;
  note?: string;
  created_by: number;
  created_at: string;
}

export interface Corso {
  id: number;
  company_id?: number;
  titolo: string;
  durata_ore: number;
  data_svolgimento?: string;
  ente_erogatore?: string;
  partecipanti: string[];
  data_scadenza?: string;
  note?: string;
  created_by: number;
  created_at: string;
}

export type ScadenzaTipo =
  | 'aggiornamento_dvr'
  | 'sopralluogo'
  | 'formazione'
  | 'visita_medica'
  | 'verifica_impianti'
  | 'manutenzione_attrezzature'
  | 'altro';

export type ScadenzaPriorita = 'bassa' | 'media' | 'alta' | 'critica';
export type ScadenzaStato = 'aperta' | 'in_corso' | 'completata' | 'scaduta';

export interface Scadenza {
  id: number;
  company_id?: number;
  azienda?: string;
  tipo: ScadenzaTipo;
  descrizione: string;
  data_prevista: string;
  priorita: ScadenzaPriorita;
  stato: ScadenzaStato;
  responsabile?: string;
  note?: string;
  created_by: number;
  created_at: string;
}

export interface LavoratoriDataSource {
  list(params?: { companyId?: number }): Promise<Lavoratore[]>;
  get(id: number): Promise<Lavoratore | null>;
  create(data: Omit<Lavoratore, 'id' | 'created_at' | 'created_by'>): Promise<Lavoratore>;
  update(id: number, patch: Partial<Lavoratore>): Promise<Lavoratore>;
  delete(id: number): Promise<void>;
}
export interface DpiDataSourceX {
  list(params?: { companyId?: number }): Promise<Dpi[]>;
  get(id: number): Promise<Dpi | null>;
  create(data: Omit<Dpi, 'id' | 'created_at' | 'created_by'>): Promise<Dpi>;
  update(id: number, patch: Partial<Dpi>): Promise<Dpi>;
  delete(id: number): Promise<void>;
}
export interface AttrezzatureDataSource {
  list(params?: { companyId?: number }): Promise<Attrezzatura[]>;
  get(id: number): Promise<Attrezzatura | null>;
  create(data: Omit<Attrezzatura, 'id' | 'created_at' | 'created_by'>): Promise<Attrezzatura>;
  update(id: number, patch: Partial<Attrezzatura>): Promise<Attrezzatura>;
  delete(id: number): Promise<void>;
}
export interface CorsiDataSource {
  list(params?: { companyId?: number }): Promise<Corso[]>;
  get(id: number): Promise<Corso | null>;
  create(data: Omit<Corso, 'id' | 'created_at' | 'created_by'>): Promise<Corso>;
  update(id: number, patch: Partial<Corso>): Promise<Corso>;
  delete(id: number): Promise<void>;
}
export interface ScadenzeDataSource {
  list(params?: { companyId?: number }): Promise<Scadenza[]>;
  get(id: number): Promise<Scadenza | null>;
  create(data: Omit<Scadenza, 'id' | 'created_at' | 'created_by'>): Promise<Scadenza>;
  update(id: number, patch: Partial<Scadenza>): Promise<Scadenza>;
  delete(id: number): Promise<void>;
}

// Studio consulenza (tenant child di Conflavoro PMI)
export interface Studio {
  id: number;
  ragione_sociale: string;
  partita_iva: string;
  codice_studio?: string;
  /** Piano di abbonamento dello studio (es. free/pro/enterprise). Solo modalita API. */
  plan?: string;
  email_referente: string;
  telefono?: string;
  indirizzo?: string;
  comune?: string;
  provincia?: string;
  cap?: string;
  numero_consulenti?: number;
  numero_aziende_clienti?: number;
  attivo: boolean;
  created_by: number;
  created_at: string;
}

export interface UtenteStudio {
  id: number;
  studio_id: number;
  studio_nome?: string;
  nome: string;
  cognome: string;
  email: string;
  /** Il backend elenca anche datori di lavoro e staff Conflavoro del tenant: non sono consulenti. */
  ruolo: 'titolare_studio' | 'consulente' | 'datore_lavoro' | 'admin_conflavoro';
  qualifica?: string;
  iscrizione_albo?: string;
  telefono?: string;
  attivo: boolean;
  created_by: number;
  created_at: string;
  /**
   * Password temporanea generata dal backend quando si crea un utente senza
   * fornire una password esplicita. Presente SOLO sul valore restituito da
   * `utenti.create` in modalita API; va mostrata una volta al titolare e poi
   * scartata (mai persistita). In modalita demo (localStorage) e' sempre assente.
   */
  password_temporanea?: string;
}

export interface StudiDataSource {
  list(): Promise<Studio[]>;
  get(id: number): Promise<Studio | null>;
  create(data: Omit<Studio, 'id' | 'created_at' | 'created_by'>): Promise<Studio>;
  update(id: number, patch: Partial<Studio>): Promise<Studio>;
  delete(id: number): Promise<void>;
}
/**
 * Dati per creare un utente studio. `password` e' opzionale: se omessa, in
 * modalita API il backend genera una password temporanea e la restituisce sul
 * campo `password_temporanea` dell'utente creato (da mostrare una volta).
 */
export type UtenteCreateInput = Omit<UtenteStudio, 'id' | 'created_at' | 'created_by'> & {
  password?: string;
};

export interface UtentiDataSource {
  list(): Promise<UtenteStudio[]>;
  get(id: number): Promise<UtenteStudio | null>;
  create(data: UtenteCreateInput): Promise<UtenteStudio>;
  update(id: number, patch: Partial<UtenteStudio>): Promise<UtenteStudio>;
  delete(id: number): Promise<void>;
}

// ============================================================
// AI ASSIST — compilazione assistita (scrivi/detta) su qualsiasi campo
// ============================================================

/** Input per la generazione assistita di un testo (POST /ai/assist). */
export interface AiAssistInput {
  /** Sezione/contesto logico (es. 'azienda.note', 'dvr.sezione_c'). Guida il prompt backend. */
  sezione: string;
  /** Cosa deve scrivere l'AI (richiesta in linguaggio naturale dell'utente). */
  istruzione: string;
  /** Testo gia' presente nel campo, da integrare/migliorare. Opzionale. */
  contesto?: string;
  /** Azienda di riferimento per arricchire il contesto (RAG tenant-scoped). */
  companyId?: number;
}

/** Esito della generazione assistita. */
export interface AiAssistResult {
  /** Testo prodotto dall'AI, da inserire/integrare nel campo. */
  testo: string;
  /** Disclaimer obbligatorio: testo assistito da AI, verifica del consulente necessaria. */
  disclaimer: string;
  /** Riferimenti normativi/fonti citati (se il backend li espone). */
  fonti?: string[];
}

/** Opzioni per la trascrizione audio (POST /ai/transcribe, multipart). */
export interface AiTranscribeOptions {
  companyId?: number;
  contesto?: string;
}

/** Esito della trascrizione audio. */
export interface AiTranscribeResult {
  testo: string;
  /**
   * Motivo tecnico quando `testo` e' vuoto (es. "nessun parlato riconoscibile
   * nella registrazione"). Serve a dire la verita' all'utente invece di un
   * generico "non disponibile": l'audio muto e il servizio giu' sono cose diverse.
   */
  errore?: string;
}

/** Input per la generazione assistita dei rischi (POST /ai/risks). */
export interface AiRisksInput {
  companyId?: number;
  /** Mansioni dell'azienda (testo libero o elenco). */
  mansioni?: string;
  /** Cicli/fasi lavorative. */
  cicli?: string;
  /** Documenti dell'archivio selezionati: la loro analisi compone la matrice. */
  documentIds?: number[];
}

/** Un rischio proposto dall'AI (pericolo + P×G + misure), poi editabile. */
export interface AiRischioProposto {
  categoria: string;
  pericolo: string;
  probabilita: 1 | 2 | 3 | 4;
  gravita: 1 | 2 | 3 | 4;
  fonte_norma: string;
  misure_tecniche: string;
  misure_organizzative: string;
}

/** Esito della valutazione rischi assistita. */
export interface AiRisksResult {
  rischi: AiRischioProposto[];
  disclaimer: string;
  errore?: string;
}

// ============================================================
// ARCHIVIO DOCUMENTALE PER-AZIENDA (foto/audio/documenti/note)
// ============================================================

export type CompanyDocumentTipo = 'foto' | 'audio' | 'documento' | 'nota' | 'video';

/** Input per la descrizione AI di un video tramite keyframe estratti nel browser. */
export interface AiVideoInput {
  companyId?: number;
  /** Frame JPEG come stringhe base64 pura (senza prefisso data:image/...). */
  frames: string[];
  /** Contesto testuale opzionale (es. reparto, fase lavorativa). */
  contesto?: string;
  /** Trascrizione audio del video (opzionale, prodotta dalla WebSpeech API o caricata). */
  audioTranscript?: string;
}

/** Esito dell'analisi AI del video. */
export interface AiVideoResult {
  testo: string;
  disclaimer: string;
  errore?: string;
}

/** Elemento dell'archivio azienda: file conservato + analisi AT che alimenta il DVR. */
export interface CompanyDocument {
  id: number;
  company_id: number;
  tipo: CompanyDocumentTipo;
  titolo?: string | null;
  filename?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  /** Analisi AI: trascrizione audio / descrizione foto / testo documento / nota. */
  testo_analisi?: string | null;
  /** Motivo dell'ultimo fallimento di analisi (null se ok o in corso). */
  analisi_errore?: string | null;
  origine: string;
  created_at: string;
}

export interface CompanyDocumentsDataSource {
  /** Elenco documenti di un'azienda. */
  list(companyId: number): Promise<CompanyDocument[]>;
  /**
   * Aggiunge un elemento solo testuale: una nota, oppure l'analisi gia' fatta
   * nel browser di un materiale non caricato (video oltre il limite: tipo 'video').
   */
  addNote(companyId: number, testo: string, titolo?: string, origine?: string, tipo?: CompanyDocumentTipo): Promise<CompanyDocument>;
  /** Carica un file (foto/audio/documento): viene conservato e analizzato dall'AI. */
  addFile(
    companyId: number,
    tipo: CompanyDocumentTipo,
    file: File,
    options?: { titolo?: string; origine?: string; onProgress?: (p: number) => void }
  ): Promise<CompanyDocument>;
  /** Modifica titolo e/o analisi (correzione manuale del consulente). */
  update(id: number, fields: { titolo?: string | null; testo_analisi?: string | null }): Promise<CompanyDocument>;
  /** Ri-analizza il file conservato rigenerando testo_analisi via AI. */
  reanalyze(id: number): Promise<CompanyDocument>;
  /** Scarica il file originale conservato (foto/audio/documento). */
  download(id: number, filename?: string): Promise<void>;
  /** URL temporaneo (object URL) del file per anteprima inline (foto/audio). */
  previewUrl(id: number): Promise<string>;
  delete(id: number): Promise<void>;
}

export interface AiDataSource {
  /**
   * Genera/integra un testo per una sezione tramite AI (POST /ai/assist).
   * In demo (localStorage) ritorna un placeholder coerente senza chiamare il backend.
   */
  assist(input: AiAssistInput): Promise<AiAssistResult>;
  /**
   * Trascrive una registrazione audio in testo (POST /ai/transcribe, multipart).
   * In demo ritorna stringa vuota (nessun backend di trascrizione).
   */
  transcribe(file: File, options?: AiTranscribeOptions): Promise<AiTranscribeResult>;
  /**
   * Descrive una foto di sopralluogo in chiave sicurezza (POST /ai/describe-image,
   * multipart). GDPR: nessuna identificazione di persone. In demo ritorna vuoto.
   */
  describeImage(file: File, options?: AiTranscribeOptions): Promise<AiTranscribeResult>;
  /**
   * Genera la valutazione dei rischi (pericoli + P×G + misure) dal profilo azienda
   * (POST /ai/risks). L'output e' una PROPOSTA editabile: l'RSPP verifica e firma.
   * In demo ritorna lista vuota (nessun backend AI).
   */
  risks(input: AiRisksInput): Promise<AiRisksResult>;
  /**
   * Analizza un video tramite keyframe estratti nel browser (POST /ai/describe-video).
   * I frame sono JPEG base64 (senza prefisso data:). In demo ritorna placeholder.
   * GDPR: il backend non riceve il file video integrale, solo fotogrammi campionati.
   */
  describeVideo(input: AiVideoInput): Promise<AiVideoResult>;
}


// ============================================================
// SUPER AGENTE HSE (console conversazionale)
// Backend: POST /agente/messaggi, GET/DELETE /agente/conversazioni, GET/PUT /agente/profilo.
// ============================================================

export type AgenteRuoloMessaggio = 'utente' | 'agente';

/** Passo di lavoro dell'agente: uno strumento consultato o un giro del revisore. */
export type AgentePasso =
  | { tipo: 'strumento'; strumento: string; titolo: string; ok: boolean; errore?: string | null }
  | { tipo: 'autocorrezione'; problemi: string[] }
  | { tipo: 'piano'; passi: AgentePianoVoce[] };

/** Voce del piano di lavoro che l'agente pubblica per le richieste lunghe. */
export interface AgentePianoVoce {
  testo: string;
  stato: 'da_fare' | 'in_corso' | 'fatto';
}

/** Evento di avanzamento dal vivo (GET /agente/progresso/{richiesta_id}). */
export type AgenteEvento =
  | { t: 'fase'; testo: string }
  | { t: 'passo'; strumento: string; titolo: string; stato: 'in_corso' | 'ok' | 'errore' }
  | { t: 'fine' };

export interface AgenteProgresso {
  eventi: AgenteEvento[];
  piano: AgentePianoVoce[] | null;
  fine: boolean;
  /** Conversazione del turno e risposta salvata: servono a ritrovarla se la connessione cade. */
  conversazioneId?: number;
  rispostaId?: number;
}

/** Azione proposta sotto una risposta (pulsante). */
export type AgenteAzione =
  | { tipo: 'download'; formato: string; url: string; etichetta: string }
  | { tipo: 'dvr'; dvr_id: number; etichetta: string }
  | { tipo: 'azienda'; azienda_id: number; etichetta: string };

// ----- Pannelli interattivi (risultati degli strumenti mostrati a fianco della risposta) -----

export interface PannelloAziendaVoce {
  id: number;
  ragione_sociale: string;
  ateco: string | null;
  dimensione: string | null;
  lavoratori: number | null;
  /** Stato dell'ultimo DVR (draft, review, approved...) o null se assente. */
  ultimo_dvr: string | null;
}

export interface PannelloAziendaScheda {
  id: number;
  ragione_sociale: string;
  ateco: string | null;
  dimensione: string | null;
  lavoratori_totali: number | null;
  sedi: Array<{ tipo: string; indirizzo: string; comune: string; provincia: string }>;
  /** Figure HSE principali come coppie ruolo/nominativo gia' leggibili. */
  figure: Array<{ ruolo: string; nome: string }>;
  mansioni: Record<string, number>;
  archivio: Record<string, number>;
}

export interface PannelloArchivioElemento {
  id: number;
  tipo: string;
  titolo: string | null;
  analisi: string;
  errore_analisi: string | null;
  creato: string | null;
}

export interface PannelloRischio {
  categoria: string;
  pericolo: string;
  probabilita: number;
  gravita: number;
  fonte_norma: string;
  misure_tecniche: string;
  misure_organizzative: string;
}

export interface PannelloDvrDati {
  stato_documento: string | null;
  generazione: string | null;
  revisione_corrente: number | null;
  errore: string | null;
}

export interface PannelloIndiceVoce {
  sezione: string;
  titolo: string;
  caratteri: number;
  scritta_da: string;
}

export interface PannelloRevisione {
  numero: number;
  data: string | null;
  redazione: string;
  motivo: string | null;
  sezioni_modificate: string[];
}

export interface PannelloScadenza {
  id: number;
  azienda: string | null;
  azienda_id: number | null;
  tipo: string;
  descrizione: string;
  data: string | null;
  priorita: string | null;
  scaduta: boolean;
}

export interface PannelloDvrVoce {
  id: number;
  azienda_id: number | null;
  versione: number | null;
  stato: string | null;
  generazione: string | null;
  revisione_corrente: number | null;
}

export type Pannello =
  | { tipo: 'aziende'; chiave: string; aziende: PannelloAziendaVoce[] }
  | { tipo: 'azienda'; chiave: string; azienda: PannelloAziendaScheda; nuova: boolean }
  | {
      tipo: 'archivio';
      chiave: string;
      azienda_id: number;
      elementi: PannelloArchivioElemento[];
      /** true se sono risultati della ricerca nella base di conoscenza dell'azienda (analisi = estratto). */
      ricerca: boolean;
    }
  | { tipo: 'lavoratori'; chiave: string; azienda_id: number; lavoratori: Array<{ id: number; nome: string; mansione: string }> }
  | { tipo: 'rischi'; chiave: string; azienda_id: number; rischi: PannelloRischio[] }
  | { tipo: 'dvr'; chiave: string; dvr_id: number; dati: PannelloDvrDati }
  | { tipo: 'dvr_elenco'; chiave: string; dvr: PannelloDvrVoce[] }
  | { tipo: 'indice'; chiave: string; dvr_id: number; revisione: number | null; indice: PannelloIndiceVoce[] }
  | {
      tipo: 'sezione';
      chiave: string;
      dvr_id: number;
      revisione: number | null;
      sezione: { chiave: string; titolo: string; testo: string };
    }
  | { tipo: 'revisioni'; chiave: string; dvr_id: number; revisioni: PannelloRevisione[] }
  | { tipo: 'scadenze'; chiave: string; scadenze: PannelloScadenza[] }
  | { tipo: 'fonti'; chiave: string; passaggi: Array<{ fonte: string; testo: string }> }
  | { tipo: 'novita'; chiave: string; giorni: number | null; argomento: string | null; novita: PannelloNovita[] }
  | { tipo: 'cantiere'; chiave: string; cantiere_id: number; azienda_id: number | null; cantiere: PannelloCantiereDati }
  | {
      tipo: 'pos';
      chiave: string;
      pos_id: number;
      stato: string | null;
      revisione: number | null;
      puo_emettere: boolean | null;
      conteggi: Record<string, number>;
      fasi: string[];
      prossimo_passo: string | null;
      nota: string | null;
    }
  | { tipo: 'segnalazioni'; chiave: string; pos_id: number; conteggi: Record<string, number>; segnalazioni: PannelloSegnalazione[] }
  // ----- Safety Control Room (forma in app/Services/Agent/Pannelli.php) -----
  | {
      tipo: 'safety_score';
      chiave: string;
      azienda_id: number;
      ragione_sociale: string | null;
      totale: number | null;
      livello: CrLivello;
      aree: CrArea[];
      criticita: CrCriticita[];
      conformita: CrConformita;
      tendenza: CrTendenza;
    }
  | { tipo: 'scadenzario'; chiave: string; azienda_id: number; periodo: string | null; contatori: CrContatori; voci: CrVoceScadenza[] }
  | {
      tipo: 'fascicolo';
      chiave: string;
      azienda_id: number;
      categorie: FascicoloCategoriaStato[];
      documenti: FascicoloVoce[];
      essenziali: Array<{ chiave: string; voce: string; esito: CrEsito; messaggio: string }>;
      /** true se lo strumento ha appena corretto un documento (documenti = quello solo). */
      aggiornato: boolean;
    }
  | {
      tipo: 'report';
      chiave: string;
      azienda_id: number;
      mese: string | null;
      safety_score: ReportDati['safety_score'];
      attivita: Record<string, number>;
      criticita: ReportDati['criticita_aperte'];
      andamento: ReportDati['andamento'];
      osservazioni: string | null;
      osservazioni_ai: boolean;
      link_pdf: string | null;
    }
  | {
      tipo: 'passaporto';
      chiave: string;
      azienda_id: number;
      attivo: PassaportoVista | null;
      accessi: PassaportoAccesso[];
      link_foglio_qr: string | null;
      /** true se l'agente lo ha appena creato: il PIN arriva per email, mai in chat. */
      creato: boolean;
      pin_inviato_a: string | null;
    }
  | { tipo: 'ispezioni'; chiave: string; azienda_id: number; ispezioni: Ispezione[]; nuova: number | null }
  | {
      tipo: 'pronto_controllo';
      chiave: string;
      azienda_id: number;
      mostra_subito: Array<{ voce: string; esito: CrEsito; documenti: number }>;
      referente: CrReferente | null;
      consigli: string[];
      richiesta: AssistenzaEsito | null;
    }
  // ----- Moduli nuovi: valutazioni, documenti HSE, qualita', Nube 81, Portale HSE (moduli-types.ts) -----
  | PannelloModuli;

/** Aggiornamento normativo letto dall'osservatorio (rilevanza da 0 a 100). */
export interface PannelloNovita {
  fonte: string;
  data: string | null;
  tipo: string;
  titolo: string;
  sintesi: string;
  url: string | null;
  rilevanza: number | null;
}

export interface PannelloCantiereDati {
  denominazione: string;
  indirizzo: string;
  impresa: string | null;
  committente: string | null;
  data_inizio: string | null;
  data_fine: string | null;
  pos: Array<{ pos_id: number; stato: string | null; revisione: number | null }>;
  subappalti: number;
}

/** Esito dei controlli del POS: blocca (rosso), corregge (giallo), avvisa (grigio). */
export interface PannelloSegnalazione {
  chiave: string;
  esito: 'blocca' | 'corregge' | 'avvisa';
  messaggio: string;
  riferimento: string;
  accettata: boolean;
}

export type PannelloTipo = Pannello['tipo'];

export interface AgenteMessaggio {
  id: number;
  ruolo: AgenteRuoloMessaggio;
  /** Markdown leggero (grassetto, elenchi, titoli). */
  testo: string;
  passi: AgentePasso[];
  azioni: AgenteAzione[];
  /** Pannelli interattivi prodotti dagli strumenti (vuoto per i messaggi dell'utente). */
  pannelli: Pannello[];
  creato: string | null;
}

export interface AgenteConversazione {
  id: number;
  titolo: string;
  azienda: { id: number; ragione_sociale: string } | null;
  aggiornata: string | null;
  /** Sezione dell'app dove e' nata (es. gestionale.dvr), se legata a una sezione. */
  sezione?: string | null;
}

export interface AgenteConversazioneDettaglio extends AgenteConversazione {
  messaggi: AgenteMessaggio[];
}

export interface AgenteInvioInput {
  testo: string;
  conversazioneId?: number | null;
  aziendaId?: number | null;
  /** true se il testo arriva da una dettatura vocale (l'agente risponde anche a voce). */
  vocale?: boolean;
  /** Id della richiesta (8..64 caratteri [A-Za-z0-9_-]) per leggere l'avanzamento dal vivo. */
  richiestaId?: string;
  /** Sezione dell'app da cui si parla al Falco (es. gestionale.sopralluoghi): la conversazione resta legata li'. */
  sezione?: string | null;
  /** Oggetto aperto nella sezione (sopralluogo, dvr, lavoratore...). */
  oggetto?: { tipo: string; id: number } | null;
}

export interface AgenteInvioRisultato {
  conversazione: AgenteConversazione;
  messaggio_utente: AgenteMessaggio;
  risposta: AgenteMessaggio;
  /** Passi dell'interfaccia del turno (Falco principale): si eseguono una volta, non stanno nello storico. */
  interfaccia?: PassoInterfaccia[];
  /** Ricerca dei documenti sul dispositivo chiesta dal Falco (cerca_documenti). */
  ricerca?: RicercaDocumenti | null;
}

export type AgenteTono = 'autorevole' | 'semplice';

export interface AgenteStrumento {
  nome: string;
  titolo: string;
  /** true se lo strumento modifica dati (non solo lettura). */
  scrive: boolean;
}

export interface AgenteProfilo {
  nome: string;
  tono: AgenteTono;
  istruzioni_studio: string;
  strumenti_disattivati: string[];
  strumenti: AgenteStrumento[];
  /** true solo per titolare di studio e admin Conflavoro. */
  modificabile: boolean;
  /** true se il backend ha la voce clonata configurata (POST agente/voce). */
  voce: boolean;
}

export interface AgenteProfiloUpdate {
  nome?: string;
  tono?: AgenteTono;
  istruzioni_studio?: string;
  strumenti_disattivati?: string[];
}

// ============================================================
// CANTIERI E POS (modulo POS del backend)
// ============================================================

export interface Cantiere {
  id: number;
  company_id: number;
  denominazione: string;
  indirizzo: string;
  comune: string;
  provincia: string | null;
  impresa_affidataria: string | null;
  data_inizio: string | null;
  data_fine: string | null;
  durata_giorni: number | null;
  note: string | null;
}

export interface CantiereNuovo {
  company_id: number;
  denominazione: string;
  indirizzo: string;
  comune: string;
  provincia?: string | null;
  data_inizio?: string | null;
  data_fine?: string | null;
}

/** Stati del POS: bozza, pronto (controlli superati), emesso (revisione con Word e PDF). */
export type PosStato = 'bozza' | 'pronto' | 'emesso';

export interface PosDocumento {
  id: number;
  company_id: number;
  cantiere_id: number;
  stato: PosStato | string;
  revisione_corrente: number | null;
  motivo_revisione: string | null;
  emesso_il: string | null;
  fasi: string[];
  aggiornato: string | null;
}

export interface CantieriDataSource {
  list(params?: { companyId?: number }): Promise<Cantiere[]>;
  create(data: CantiereNuovo): Promise<Cantiere>;
}

export interface PosDataSource {
  list(params?: { cantiereId?: number; companyId?: number }): Promise<PosDocumento[]>;
  /** Scarica l'ultima revisione emessa (PDF o Word). */
  download(id: number, formato: 'pdf' | 'docx'): Promise<void>;
}

export interface AgenteDataSource {
  /** Invia un messaggio; crea la conversazione se conversazioneId manca. Risposta sincrona (10-60 s). */
  invia(input: AgenteInvioInput): Promise<AgenteInvioRisultato>;
  conversazioni(filtro?: { sezione?: string | null; aziendaId?: number | null }): Promise<AgenteConversazione[]>;
  conversazione(id: number): Promise<AgenteConversazioneDettaglio>;
  eliminaConversazione(id: number): Promise<void>;
  profilo(): Promise<AgenteProfilo>;
  /** Solo titolare/admin. Ritorna il profilo aggiornato completo. */
  aggiornaProfilo(input: AgenteProfiloUpdate): Promise<AgenteProfilo>;
  /** Avanzamento dal vivo di una richiesta in corso (mai dalla cache). */
  progresso(richiestaId: string): Promise<AgenteProgresso>;
  /** Audio mp3 del testo con la voce dell'agente (mai dalla cache). In demo lancia errore. */
  voce(testo: string): Promise<Blob>;
}

export interface DataSource {
  readonly mode: DataSourceMode;
  auth: AuthDataSource;
  companies: CompaniesDataSource;
  dvr: DvrDataSource;
  lavoratori: LavoratoriDataSource;
  dpi: DpiDataSourceX;
  attrezzature: AttrezzatureDataSource;
  corsi: CorsiDataSource;
  scadenze: ScadenzeDataSource;
  studi: StudiDataSource;
  utenti: UtentiDataSource;
  /** Upload documenti/media verso un DVR (ponte backend reale). */
  media: DvrMediaDataSource;
  /** Assistenza AI alla compilazione (scrivi/detta) per qualsiasi campo. */
  ai: AiDataSource;
  /** Archivio documentale per-azienda (foto/audio/documenti/note) che alimenta il DVR. */
  companyDocuments: CompanyDocumentsDataSource;
  /** Super Agente HSE: conversazioni, messaggi e profilo dello studio. */
  agente: AgenteDataSource;
  /** Cantieri delle imprese (modulo POS). */
  cantieri: CantieriDataSource;
  /** Piani operativi di sicurezza. */
  pos: PosDataSource;
  /** Safety Control Room dell'azienda: score, scadenzario, fascicolo, report, passaporto, ispezioni. */
  controlRoom: ControlRoomDataSource;
  /** Documenti dell'azienda per il tavolo: DVR, POS, valutazioni specifiche, documenti HSE. */
  documentiHse: DocumentiHseDataSource;
  /** Coda di lavoro del Portale HSE: approvazione delle proposte dell'agente. */
  coda: CodaDataSource;
  /** Loghi nei documenti: dell'azienda cliente e dello studio che redige. */
  loghi: LoghiDataSource;
  health(): Promise<HealthStatus>;
}

// ============================================================
// LOGHI NEI DOCUMENTI (copertina e intestazioni di DVR, POS, DUVRI, valutazioni)
// ============================================================

export interface LogoInfo {
  presente: true;
  larghezza: number;
  altezza: number;
  aggiornato_il: string | null;
  /** Cambia a ogni caricamento: serve a rinfrescare l'anteprima. */
  versione: string | null;
}

export interface StatoLogo {
  logo: LogoInfo | null;
  puo_modificare: boolean;
  /** Il server converte gli SVG (serve Imagick); altrimenti solo PNG, JPG, WebP. */
  svg: boolean;
}

export interface LoghiDataSource {
  azienda(companyId: number): Promise<StatoLogo>;
  /** URL locale (object URL) dell'anteprima, o null se non c'e' logo. Chi la usa la libera con URL.revokeObjectURL. */
  anteprimaAzienda(companyId: number): Promise<string | null>;
  caricaAzienda(companyId: number, file: File): Promise<LogoInfo>;
  rimuoviAzienda(companyId: number): Promise<void>;
  studio(): Promise<StatoLogo>;
  anteprimaStudio(): Promise<string | null>;
  caricaStudio(file: File): Promise<LogoInfo>;
  rimuoviStudio(): Promise<void>;
}

// ============================================================
// SAFETY CONTROL ROOM (contratto: docs/integrazioni/CONTROL_ROOM_API.md)
// ============================================================

/** Esito di un controllo: credito 1, 0,7, 0, 0; non_applicabile escluso dal calcolo. */
export type CrEsito = 'conforme' | 'in_scadenza' | 'da_verificare' | 'non_conforme' | 'non_applicabile';
export type CrLivello = 'buono' | 'discreto' | 'critico' | 'grave' | 'nd';
export type CrPriorita = 'alta' | 'media' | 'bassa';
export type CrAreaChiave = 'sicurezza' | 'formazione' | 'sorveglianza' | 'documenti';

export interface CrControllo {
  chiave: string;
  titolo: string;
  peso: number;
  esito: CrEsito;
  priorita: CrPriorita;
  messaggio: string;
  azione: string;
  riferimento: string;
  /** Quota in regola per i controlli per lavoratore (0..1), altrimenti null. */
  credito: number | null;
}

export interface CrArea {
  chiave: CrAreaChiave;
  nome: string;
  /** 0..100, null se non applicabile o senza dati. */
  punteggio: number | null;
  stato: 'applicabile' | 'non_applicabile';
  /** Pieno solo nel Safety Score completo. */
  controlli: CrControllo[];
}

export interface CrCriticita {
  area: string;
  chiave: string;
  titolo: string;
  esito: CrEsito;
  priorita: CrPriorita;
  peso: number;
  messaggio: string;
  azione: string;
  riferimento: string;
}

export interface CrConformita {
  conformi: number;
  in_scadenza: number;
  non_conformi: number;
  da_verificare: number;
  non_applicabili: number;
}

export interface CrTendenza {
  mese: string | null;
  mese_precedente: string | null;
  totale_precedente: number | null;
  delta: number | null;
  direzione: 'su' | 'giu' | 'stabile' | 'nd';
}

export interface CrContatori {
  entro_30: number;
  scadute: number;
  visite_da_pianificare: number;
  corsi_in_scadenza: number;
  alert_aperti: number;
}

export type CrScadenzaPriorita = 'bassa' | 'media' | 'alta' | 'critica';

export interface CrVoceScadenza {
  chiave: string;
  fonte: string;
  id: number | null;
  /** AAAA-MM-GG */
  data: string | null;
  /** Giorni da oggi (negativi se scaduta). */
  giorni: number | null;
  stato: 'scaduta' | 'in_scadenza' | 'programmata';
  azienda_id: number | null;
  azienda: string | null;
  titolo: string;
  descrizione: string;
  /** formazione, visita_medica, verifica, cantiere, dvr, dpi, documento, altro */
  categoria: string;
  priorita: CrScadenzaPriorita;
}

/** Schermata principale: GET /companies/{id}/control-room. */
export interface ControlRoomPanoramica {
  azienda_id: number;
  ragione_sociale: string;
  calcolato_il: string | null;
  totale: number | null;
  livello: CrLivello;
  /** Sempre nell'ordine sicurezza, formazione, sorveglianza, documenti. */
  aree: CrArea[];
  criticita: CrCriticita[];
  criticita_totali: number;
  conformita: CrConformita;
  tendenza: CrTendenza;
  scadenze: { contatori: CrContatori; prossime: CrVoceScadenza[] };
}

/** Safety Score completo: GET /companies/{id}/safety-score. */
export interface SafetyScoreCompleto extends Omit<ControlRoomPanoramica, 'scadenze' | 'criticita_totali'> {
  lavoratori_considerati: number | null;
  formula: string | null;
}

export type ScadenzarioPeriodo = 'oggi' | '7' | '30' | '60' | '90' | '365';

export interface ScadenzarioFiltri {
  periodo?: ScadenzarioPeriodo;
  /** Priorita' minima. */
  priorita?: CrScadenzaPriorita | null;
  includi_scadute?: boolean;
}

export interface ScadenzarioAzienda {
  azienda_id: number;
  ragione_sociale: string;
  periodo: string | null;
  priorita_minima: string | null;
  contatori: CrContatori;
  voci: CrVoceScadenza[];
}

export type FascicoloCategoria = 'dvr' | 'nomine' | 'attestati' | 'verbali' | 'sorveglianza' | 'formazione' | 'pos_duvri' | 'impianti' | 'emergenza' | 'altro';
export type FascicoloStatoDocumento = 'aggiornato' | 'in_revisione' | 'da_aggiornare';

export interface FascicoloVoce {
  /** Id grezzo del backend: "88" per i documenti, "dvr:31", "pos:4", "organigramma" per le voci virtuali. */
  id: string;
  /** Id numerico del company_document (null per le voci virtuali). */
  documento_id: number | null;
  virtuale: boolean;
  tipo: string;
  dvr_id: number | null;
  pos_id: number | null;
  titolo: string;
  categoria: string;
  categoria_manuale: boolean;
  versione: string | null;
  stato_documento: string | null;
  data: string | null;
  scadenza: string | null;
  essenziale: boolean;
  esito: CrEsito | null;
  ha_file: boolean;
  stato_piattaforma: string | null;
}

export interface FascicoloCategoriaStato {
  chiave: string;
  nome: string;
  documenti: number;
  stato: 'vuota' | 'aggiornato' | 'in_revisione' | 'da_aggiornare';
}

export interface FascicoloEssenziale {
  chiave: string;
  voce: string;
  riferimento: string;
  sezione: string | null;
  esito: CrEsito;
  messaggio: string;
  documenti: FascicoloVoce[];
}

export interface FascicoloAzienda {
  azienda_id: number;
  ragione_sociale: string;
  totale: number;
  cerca: string | null;
  categoria: string | null;
  categorie: FascicoloCategoriaStato[];
  recenti: FascicoloVoce[];
  essenziali: FascicoloEssenziale[];
}

export interface FascicoloFiltri {
  cerca?: string;
  categoria?: string | null;
}

export interface FascicoloAggiornaInput {
  categoria?: FascicoloCategoria;
  versione?: string;
  stato_documento?: FascicoloStatoDocumento;
  data_documento?: string;
  /** null toglie la scadenza. */
  scadenza_documento?: string | null;
  essenziale?: boolean;
}

export interface ReportDati {
  periodo: { dal: string | null; al: string | null };
  attivita: Record<string, number>;
  visite_svolte: number;
  corsi_erogati: Array<{ corso: string; attestati: number }>;
  ispezioni: Array<{ data: string | null; ente: string; tipo: string | null; esito: string | null }>;
  safety_score: { totale: number | null; livello: CrLivello; aree: Record<string, number | null>; al: string | null } | null;
  criticita_aperte: Array<{ area: string; priorita: string; titolo: string; messaggio: string; azione: string; riferimento: string }>;
  /** Sempre 6 mesi dal piu' vecchio; totale null se manca la fotografia. */
  andamento: Array<{ mese: string; totale: number | null }>;
  priorita_mese_successivo: {
    mese: string | null;
    scadenze: Array<{ data: string | null; titolo: string; categoria: string; priorita: string; scaduta: boolean }>;
    criticita: string[];
  };
}

export interface ReportMensile {
  report_id: number | null;
  azienda_id: number;
  ragione_sociale: string;
  /** AAAA-MM */
  mese: string;
  osservazioni: string | null;
  osservazioni_ai: boolean;
  osservazioni_il: string | null;
  pdf_disponibile: boolean;
  aggiornato_il: string | null;
  dati: ReportDati;
}

export type PassaportoSezione = 'anagrafica' | 'organigramma' | 'dvr' | 'nomine' | 'formazione' | 'sorveglianza' | 'emergenza' | 'verbali' | 'impianti' | 'pos_duvri';

export interface PassaportoVista {
  id: number;
  azienda_id: number;
  attivo: boolean;
  valido: boolean;
  scade_il: string | null;
  sezioni: string[];
  creato_il: string | null;
  revocato_il: string | null;
  qr_disponibile: boolean;
  accessi_totali: number;
  ultimo_accesso: string | null;
}

export interface PassaportoAccesso {
  quando: string | null;
  ente: string | null;
  nome: string | null;
  esito: string;
  aperto: string | null;
}

export interface PassaportoStato {
  azienda_id: number;
  ragione_sociale: string;
  attivo: PassaportoVista | null;
  storico: PassaportoVista[];
  accessi: PassaportoAccesso[];
  nota: string | null;
}

export interface PassaportoNuovoInput {
  pin?: string;
  sezioni?: PassaportoSezione[];
  scade_il?: string;
}

/** Risposta della creazione: l'UNICA volta in cui token e PIN sono in chiaro. */
export interface PassaportoCreato {
  passaporto: PassaportoVista;
  token: string;
  pin: string;
  link: string;
}

export type IspezioneEnte = 'ASL' | 'INL' | 'VVF' | 'NAS' | 'ARPA' | 'altro';
export type IspezioneEsito = 'nessuna_criticita' | 'note_informative' | 'prescrizioni' | 'sanzione';

export interface IspezionePrescrizione {
  descrizione: string;
  termine: string | null;
  scadenza_id: number | null;
}

export interface Ispezione {
  id: number;
  azienda_id: number;
  ente: string;
  data: string | null;
  tipo: string | null;
  esito: IspezioneEsito | null;
  note: string | null;
  prescrizioni: IspezionePrescrizione[];
  creato_il: string | null;
}

export interface IspezioneInput {
  company_id: number;
  ente: IspezioneEnte;
  data?: string;
  tipo?: string;
  note?: string;
  /** Solo consulente in su (il datore riceve 422). */
  esito?: IspezioneEsito | null;
  prescrizioni?: Array<{ descrizione: string; termine?: string | null }>;
}

export interface CrReferente {
  nome: string;
  email: string | null;
  ruolo: string | null;
}

export interface ProntoControlloVoce {
  chiave: string;
  voce: string;
  esito: CrEsito;
  messaggio: string;
  riferimento: string;
  documenti: Array<{ id: string; titolo: string; virtuale: boolean; tipo: string; ha_file: boolean }>;
}

export interface ProntoControllo {
  azienda_id: number;
  ragione_sociale: string;
  mostra_subito: ProntoControlloVoce[];
  pronti: number;
  totale: number;
  referente: CrReferente | null;
  passaporto_attivo: boolean;
  ultime_ispezioni: Ispezione[];
  consigli: string[];
}

export interface AssistenzaEsito {
  richiesta_id: number | null;
  azienda_id: number;
  avvisati: number;
  email: number;
  canali: number;
  referente: CrReferente | null;
  nota: string | null;
}

/** GET /passaporto/{token}: cosa serve per entrare, nessun dato dell'azienda. */
export interface PassaportoPubblicoInfo {
  richiede: string[];
  enti: string[];
  informativa: string;
}

export interface PassaportoPubblicoDocumento {
  titolo: string;
  data: string | null;
  versione: string | null;
  stato: string | null;
  /** Link firmato (15 minuti); null se assente o non sicuro. */
  link: string | null;
}

export interface PassaportoConsultazione {
  azienda: { ragione_sociale: string; ateco: string | null; lavoratori: number | null; sede: string | null };
  consultato_il: string | null;
  link_validi_minuti: number | null;
  avviso: string;
  /** Figure gia' in forma leggibile (ruolo e nominativi). */
  organigramma: Array<{ ruolo: string; nomi: string[] }>;
  documenti_essenziali: Array<{ voce: string; esito: CrEsito; riferimento: string; messaggio: string; documenti: PassaportoPubblicoDocumento[] }>;
  altri_documenti: PassaportoPubblicoDocumento[];
  formazione: string | null;
  sorveglianza: string | null;
}

export interface ControlRoomDataSource {
  controlRoom(companyId: number): Promise<ControlRoomPanoramica>;
  safetyScore(companyId: number): Promise<SafetyScoreCompleto>;
  scadenzario(companyId: number, filtri?: ScadenzarioFiltri): Promise<ScadenzarioAzienda>;
  fascicolo(companyId: number, filtri?: FascicoloFiltri): Promise<FascicoloAzienda>;
  /** Consulente in su. Risponde con la voce aggiornata. */
  fascicoloAggiorna(docId: number, campi: FascicoloAggiornaInput): Promise<FascicoloVoce>;
  /** Mese AAAA-MM (corrente o passato). */
  report(companyId: number, mese: string): Promise<ReportMensile>;
  /** Prepara il PDF (consulente in su). */
  reportPdf(companyId: number, mese: string): Promise<ReportMensile>;
  /** Scarica il PDF gia' generato (404 se non ancora preparato). */
  scaricaReportPdf(companyId: number, mese: string): Promise<void>;
  /** conAi: il testo nasce da una bozza dell'agente (il PDF riporta il disclaimer). */
  salvaOsservazioni(companyId: number, mese: string, osservazioni: string, conAi?: boolean): Promise<ReportMensile>;
  passaporto(companyId: number): Promise<PassaportoStato>;
  /** Titolare o consulente. Crearne uno nuovo revoca il precedente. */
  creaPassaporto(companyId: number, input?: PassaportoNuovoInput): Promise<PassaportoCreato>;
  revocaPassaporto(passaportoId: number): Promise<PassaportoVista>;
  passaportoAccessi(passaportoId: number): Promise<PassaportoAccesso[]>;
  /** Object URL dell'SVG del QR (il chiamante lo revoca) o null se non disponibile. */
  qrSvgUrl(passaportoId: number): Promise<string | null>;
  /** Scarica il foglio stampabile (il PIN non c'e' mai). */
  scaricaQrPdf(passaportoId: number): Promise<void>;
  ispezioni(companyId: number): Promise<Ispezione[]>;
  creaIspezione(input: IspezioneInput): Promise<Ispezione>;
  aggiornaIspezione(id: number, patch: Partial<Omit<IspezioneInput, 'company_id'>>): Promise<Ispezione>;
  eliminaIspezione(id: number): Promise<void>;
  prontoControllo(companyId: number): Promise<ProntoControllo>;
  richiediAssistenza(companyId: number, input?: { ente?: string | null; messaggio?: string | null }): Promise<AssistenzaEsito>;
  /** Pubblico, senza login. 404 se il passaporto non e' valido. */
  passaportoPubblico(token: string): Promise<PassaportoPubblicoInfo>;
  /** Pubblico, senza login. 403 PIN errato, 429 troppi tentativi, 404 non valido. */
  apriPassaportoPubblico(token: string, input: { pin: string; ente: string; nome: string }): Promise<PassaportoConsultazione>;
}

export const AI_DISCLAIMER =
  'Documento generato con assistenza AI. La validità è subordinata alla verifica e sottoscrizione da parte delle figure competenti (Datore di Lavoro, RSPP, Medico Competente, RLS) ai sensi del D.Lgs. 81/08';

/** Disclaimer per i dati anagrafici precompilati dall'AI a partire da una visura. */
export const AI_EXTRACTION_DISCLAIMER =
  'Dati estratti con assistenza AI dalla visura caricata. Verifica e correggi ogni campo prima di salvare: la responsabilità del dato resta del consulente.';

/** Disclaimer per i testi generati/integrati dall'assistente AI di compilazione. */
export const AI_ASSIST_DISCLAIMER =
  'Testo generato con assistenza AI. Rivedi e correggi prima di salvare: la responsabilità del contenuto resta del consulente (D.Lgs. 81/08).';

/** Calcola livello rischio da P×G. */
export function calcolaLivelloRischio(p: number, g: number): RischioLivello {
  const r = p * g;
  if (r >= 9) return 'molto_alto';
  if (r >= 6) return 'alto';
  if (r >= 3) return 'medio';
  return 'basso';
}

// ============================================================
// Portale HSE (ADR-008): link personale del lavoratore (pagina pubblica)
// ============================================================

/** Ruoli dell'utente su un'azienda cliente del portale. */
export type RuoloAzienda = 'titolare' | 'referente' | 'consulente_lavoro' | 'medico_competente' | 'studio';

/** Stato della prenotazione di corsi e visite nello scadenziario del portale. */
export type StatoPrenotazione = 'da_prenotare' | 'prenotata' | 'in_calendario';

export interface AppuntamentoLavoratore {
  id: number;
  tipo: 'visita_medica' | 'formazione';
  cosa: string;
  /** AAAA-MM-GG, ora italiana */
  data: string;
  /** HH:MM, ora italiana */
  ora: string;
  luogo: string | null;
  maps_url: string | null;
  /** Sempre "Prenotata": il lavoratore non conferma la visita (09). */
  stato: string;
  /** Ultimo giorno di disdetta gratuita (2 giorni lavorativi prima). */
  disdetta_gratuita_entro: string;
  disdetta_gratuita_scaduta: boolean;
  cosa_portare: string;
}

export interface LinkLavoratore {
  azienda: string | null;
  lavoratore: { nome: string; cognome: string; mansione: string; lingua: string };
  appuntamenti: AppuntamentoLavoratore[];
  da_fissare: Array<{ id: number; cosa: string; entro: string | null }>;
  attestati: Array<{ corso: string; conseguito_il: string | null; scade_il: string | null }>;
  numero_imprevisti: string | null;
  informativa: string;
  /** Presente dopo il cambio data. */
  messaggio?: string;
}
