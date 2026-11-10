// Namespace `controlRoom` in modalita' dimostrativa (dati nel browser).
//
// Calcola Safety Score, scadenzario, fascicolo, report e Pronto Controllo dai
// dati gia' presenti nella demo (azienda, organigramma, lavoratori, corsi,
// scadenze, attrezzature, DPI, DVR, archivio) con le stesse regole del backend
// (pesi, crediti, soglie), in forma semplificata. Passaporti, ispezioni,
// osservazioni e fotografie mensili restano nel browser dell'utente.
// Nessun avviso parte davvero: le risposte lo dicono in chiaro.

import { AREE, livelloDa } from './control-room-mappers';
import type {
  AssistenzaEsito,
  Company,
  CompanyDocument,
  ControlRoomDataSource,
  ControlRoomPanoramica,
  Corso,
  CrArea,
  CrAreaChiave,
  CrContatori,
  CrConformita,
  CrControllo,
  CrCriticita,
  CrEsito,
  CrPriorita,
  CrScadenzaPriorita,
  CrTendenza,
  CrVoceScadenza,
  DataSource,
  Dvr,
  FascicoloAggiornaInput,
  FascicoloAzienda,
  FascicoloCategoriaStato,
  FascicoloEssenziale,
  FascicoloVoce,
  Ispezione,
  IspezioneInput,
  Lavoratore,
  OrganigrammaHSE,
  PassaportoAccesso,
  PassaportoConsultazione,
  PassaportoCreato,
  PassaportoStato,
  PassaportoVista,
  ProntoControllo,
  ReportMensile,
  Role,
  SafetyScoreCompleto,
  ScadenzarioAzienda,
  ScadenzarioFiltri,
  User,
} from './types';

export interface DepsControlRoomLocale {
  ds: () => Pick<DataSource, 'companies' | 'lavoratori' | 'corsi' | 'scadenze' | 'attrezzature' | 'dpi' | 'dvr' | 'companyDocuments'>;
  utente: () => User;
  leggi: <T>(chiave: string) => T[];
  scrivi: <T>(chiave: string, valore: T[]) => void;
  /** Per i test: data di oggi. */
  oggi?: () => Date;
  /** Per la pagina pubblica: tutti i passaporti del browser (di qualsiasi utente demo). */
  tuttiIPassaporti?: () => Array<{ chiave: string; voci: PassDemo[] }>;
}

export interface PassDemo {
  id: number;
  company_id: number;
  ragione_sociale: string;
  token: string;
  pin: string;
  sezioni: string[];
  scade_il: string | null;
  creato_il: string;
  revocato_il: string | null;
  attivo: boolean;
  accessi: PassaportoAccesso[];
  /** Fotografia di cio' che l'ispettore vede, presa alla creazione (la pagina pubblica non ha login). */
  contenuto?: Pick<PassaportoConsultazione, 'azienda' | 'organigramma' | 'documenti_essenziali' | 'formazione' | 'sorveglianza'>;
}

interface FascicoloOverride extends FascicoloAggiornaInput {
  doc_id: number;
}

const K = {
  ispezioni: 'cr_ispezioni',
  passaporti: 'cr_passaporti',
  fascicolo: 'cr_fascicolo',
  report: 'cr_report',
  snapshot: 'cr_snapshot',
  assistenza: 'cr_assistenza',
};

export const CONSIGLI_PRONTO = [
  'Accogli gli ispettori e chiedi di vedere il tesserino di riconoscimento.',
  'Avvisa subito il tuo consulente con la richiesta di assistenza.',
  'Mostra i documenti richiesti: li trovi qui sotto o con il Safety Passport.',
  'Leggi il verbale prima di firmarlo: puoi far mettere a verbale le tue dichiarazioni e chiederne una copia.',
  "Registra l'ispezione nella piattaforma: le prescrizioni con un termine diventano scadenze.",
];

export const CATEGORIE_FASCICOLO: Array<{ chiave: string; nome: string }> = [
  { chiave: 'dvr', nome: 'DVR e valutazioni' },
  { chiave: 'nomine', nome: 'Nomine e designazioni' },
  { chiave: 'attestati', nome: 'Attestati' },
  { chiave: 'verbali', nome: 'Verbali' },
  { chiave: 'sorveglianza', nome: 'Sorveglianza sanitaria' },
  { chiave: 'formazione', nome: 'Formazione e informazione' },
  { chiave: 'pos_duvri', nome: 'POS, PSC e DUVRI' },
  { chiave: 'impianti', nome: 'Impianti e attrezzature' },
  { chiave: 'emergenza', nome: 'Emergenza e antincendio' },
  { chiave: 'altro', nome: 'Altro' },
];

/** Stesse regole del backend (Fascicolo::REGOLE): vince la prima. */
const REGOLE: Array<[string, RegExp]> = [
  ['pos_duvri', /\bpos\b|piano operativo|\bduvri\b|interferenz|\bpsc\b|piano di sicurezza e coordinamento/],
  ['dvr', /\bdvr\b|valutazione (dei |del )?rischi|documento di valutazione|valutazione (del )?rumore|valutazione (delle )?vibrazioni|rischio chimico|stress lavoro/],
  ['sorveglianza', /idoneit|sorveglianza sanitaria|protocollo sanitario|cartella sanitaria|relazione sanitaria|visita medica|giudizio/],
  ['nomine', /nomina|designazion|incarico|accettazione|\brls\b|\brlst\b|organigramma/],
  ['verbali', /verbale|riunione periodica|sopralluogo|elezione/],
  ['attestati', /attestat|certificato di frequenza|patentino|abilitazione/],
  ['formazione', /formazione|\bcorso\b|registro (delle )?presenze|addestramento|informativa/],
  ['emergenza', /emergenz|evacuaz|antincendio|primo soccorso|planimetri|\bcpi\b|prevenzione incendi|estintor|vie di esodo/],
  ['impianti', /impiant|messa a terra|dpr 462|dichiarazione di conformit|manutenzion|verifica periodica|libretto|ascensor|macchin|attrezzatur/],
];

export function classificaDocumento(titolo: string | null | undefined, testo?: string | null): string {
  for (const fonte of [titolo ?? '', (testo ?? '').slice(0, 3000)]) {
    const t = fonte.toLowerCase();
    if (!t.trim()) continue;
    for (const [cat, re] of REGOLE) if (re.test(t)) return cat;
  }
  return 'altro';
}

// ------------------------------------------------------------------ date
const GIORNO = 86_400_000;
const isoGiorno = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const meseDi = (d: Date) => isoGiorno(d).slice(0, 7);
const giorno = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const piuGiorni = (d: Date, n: number) => new Date(d.getTime() + n * GIORNO);
const meseSpostato = (m: string, delta: number) => {
  const [a, mm] = m.split('-').map(Number);
  const d = new Date(a, mm - 1 + delta, 15);
  return meseDi(d);
};

function errore(code: string, msg: string): Error {
  return Object.assign(new Error(msg), { code });
}
const vietato = () => errore('FORBIDDEN', 'Operazione non consentita per il tuo ruolo.');
const nonTrovato = () => errore('NOT_FOUND', 'Risorsa non trovata.');

const daConsulente = (r: Role) => r === 'consulente' || r === 'titolare_studio' || r === 'admin_conflavoro';
const gestisceIlPassaporto = (r: Role) => r === 'consulente' || r === 'titolare_studio';

// ------------------------------------------------------------------ dati dell'azienda
interface Dati {
  c: Company;
  org: OrganigrammaHSE;
  lav: Lavoratore[];
  corsi: Corso[];
  scad: Awaited<ReturnType<DataSource['scadenze']['list']>>;
  attr: Awaited<ReturnType<DataSource['attrezzature']['list']>>;
  dpi: Awaited<ReturnType<DataSource['dpi']['list']>>;
  dvr: Dvr[];
  docs: CompanyDocument[];
  ispezioni: Ispezione[];
  override: Map<number, FascicoloOverride>;
  oggi: Date;
}

const nome = (l: Lavoratore) => `${l.nome} ${l.cognome}`.trim();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function creaControlRoomLocale(deps: DepsControlRoomLocale): ControlRoomDataSource {
  const oggi = () => deps.oggi?.() ?? new Date();

  async function dati(companyId: number): Promise<Dati> {
    const ds = deps.ds();
    const c = await ds.companies.get(companyId);
    if (!c) throw nonTrovato();
    const [lav, corsi, scad, attr, dpi, dvr, docs] = await Promise.all([
      ds.lavoratori.list({ companyId }),
      ds.corsi.list({ companyId }),
      ds.scadenze.list({ companyId }),
      ds.attrezzature.list({ companyId }),
      ds.dpi.list({ companyId }),
      ds.dvr.list(),
      ds.companyDocuments.list(companyId),
    ]);
    const override = new Map(deps.leggi<FascicoloOverride>(K.fascicolo).map((o) => [o.doc_id, o]));
    return {
      c,
      org: (c.settings?.organigramma ?? {}) as OrganigrammaHSE,
      lav: lav.filter((l) => l.company_id === companyId),
      corsi: corsi.filter((x) => x.company_id == null || x.company_id === companyId),
      scad: scad.filter((s) => s.company_id == null || s.company_id === companyId),
      attr: attr.filter((a) => a.company_id === companyId),
      dpi: dpi.filter((d) => d.company_id == null || d.company_id === companyId),
      dvr: dvr.filter((d) => d.company_id === companyId),
      docs,
      ispezioni: deps.leggi<Ispezione>(K.ispezioni).filter((i) => i.azienda_id === companyId),
      override,
      oggi: oggi(),
    };
  }

  // ---------------------------------------------------------------- formazione
  function haCorso(x: Dati, chi: string, re: RegExp): CrEsito {
    const n = norm(chi);
    const lav = x.lav.find((l) => norm(nome(l)) === n);
    const corsi = x.corsi.filter((c) => re.test(c.titolo.toLowerCase()) && c.partecipanti.some((p) => norm(p) === n));
    const dichiarati = lav?.formazione_svolta?.some((f) => re.test(f.toLowerCase())) ?? false;
    if (corsi.length === 0) return dichiarati ? 'conforme' : 'non_conforme';
    const scade = corsi.map((c) => giorno(c.data_scadenza)).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];
    if (!scade) return 'conforme';
    if (scade < x.oggi) return 'non_conforme';
    return scade.getTime() - x.oggi.getTime() < 30 * GIORNO ? 'in_scadenza' : 'conforme';
  }

  const CREDITO: Record<CrEsito, number> = { conforme: 1, in_scadenza: 0.7, da_verificare: 0, non_conforme: 0, non_applicabile: 0 };

  function perLavoratore(x: Dati, re: RegExp): { esito: CrEsito; credito: number | null; ok: number } {
    if (x.lav.length === 0) return { esito: 'da_verificare', credito: null, ok: 0 };
    const esiti = x.lav.map((l) => haCorso(x, nome(l), re));
    const credito = esiti.reduce((s, e) => s + CREDITO[e], 0) / esiti.length;
    const ok = esiti.filter((e) => e !== 'non_conforme').length;
    const esito: CrEsito = credito >= 0.999 ? 'conforme' : esiti.every((e) => e !== 'non_conforme') ? 'in_scadenza' : 'non_conforme';
    return { esito, credito: Math.round(credito * 100) / 100, ok };
  }

  function idoneita(x: Dati): { esito: CrEsito; credito: number | null; validi: number } {
    if (x.lav.length === 0) return { esito: 'da_verificare', credito: null, validi: 0 };
    const esiti = x.lav.map((l): CrEsito => {
      const v = giorno(l.idoneita_sanitaria_data);
      if (!v) return 'non_conforme';
      const scade = piuGiorni(v, 365);
      if (scade < x.oggi) return 'non_conforme';
      return scade.getTime() - x.oggi.getTime() < 30 * GIORNO ? 'in_scadenza' : 'conforme';
    });
    const credito = esiti.reduce((s, e) => s + CREDITO[e], 0) / esiti.length;
    return {
      esito: credito >= 0.999 ? 'conforme' : esiti.every((e) => e !== 'non_conforme') ? 'in_scadenza' : 'non_conforme',
      credito: Math.round(credito * 100) / 100,
      validi: esiti.filter((e) => e !== 'non_conforme').length,
    };
  }

  // ---------------------------------------------------------------- fascicolo
  function voceDocumento(x: Dati, d: CompanyDocument): FascicoloVoce {
    const o = x.override.get(d.id);
    const titolo = d.titolo || d.filename || `Documento ${d.id}`;
    const categoria = o?.categoria ?? classificaDocumento(titolo, d.testo_analisi);
    const scad = o && 'scadenza_documento' in o ? o.scadenza_documento ?? null : null;
    const stato = o?.stato_documento ?? 'aggiornato';
    const sd = giorno(scad);
    const esito: CrEsito =
      stato === 'da_aggiornare' || (sd && sd < x.oggi)
        ? 'non_conforme'
        : stato === 'in_revisione' || (sd && sd.getTime() - x.oggi.getTime() < 30 * GIORNO)
          ? 'in_scadenza'
          : 'conforme';
    return {
      id: String(d.id),
      documento_id: d.id,
      virtuale: false,
      tipo: d.tipo,
      dvr_id: null,
      pos_id: null,
      titolo,
      categoria,
      categoria_manuale: !!o?.categoria,
      versione: o?.versione ?? '1.0',
      stato_documento: stato,
      data: o?.data_documento ?? d.created_at.slice(0, 10),
      scadenza: scad,
      essenziale: o?.essenziale ?? ['dvr', 'nomine', 'emergenza', 'pos_duvri'].includes(categoria),
      esito,
      ha_file: !!d.filename,
      stato_piattaforma: null,
    };
  }

  function ultimoDvr(x: Dati): Dvr | null {
    return [...x.dvr].sort((a, b) => b.versione - a.versione)[0] ?? null;
  }

  function statoDvr(x: Dati, d: Dvr): 'aggiornato' | 'in_revisione' | 'da_aggiornare' {
    const gen = giorno(d.generated_at ?? d.data_approvazione ?? d.data_creazione);
    const mod = giorno(x.c.updated_at);
    if (gen && mod && mod.getTime() > gen.getTime() + 60_000) return 'da_aggiornare';
    return d.status === 'approved' ? 'aggiornato' : 'in_revisione';
  }

  function virtuali(x: Dati): FascicoloVoce[] {
    const d = ultimoDvr(x);
    if (!d) return [];
    const stato = statoDvr(x, d);
    return [
      {
        id: `dvr:${d.id}`,
        documento_id: null,
        virtuale: true,
        tipo: 'dvr',
        dvr_id: d.id,
        pos_id: null,
        titolo: `Documento di valutazione dei rischi, versione ${d.versione}`,
        categoria: 'dvr',
        categoria_manuale: false,
        versione: String(d.versione),
        stato_documento: stato,
        data: (d.data_approvazione ?? d.generated_at ?? d.data_creazione ?? '').slice(0, 10) || null,
        scadenza: null,
        essenziale: true,
        esito: stato === 'aggiornato' ? 'conforme' : stato === 'in_revisione' ? 'in_scadenza' : 'non_conforme',
        ha_file: true,
        stato_piattaforma: d.status,
      },
    ];
  }

  const vociFascicolo = (x: Dati) => [...virtuali(x), ...x.docs.filter((d) => d.tipo === 'documento').map((d) => voceDocumento(x, d))];

  function migliore(esiti: CrEsito[]): CrEsito {
    for (const e of ['conforme', 'in_scadenza', 'da_verificare', 'non_conforme'] as CrEsito[]) if (esiti.includes(e)) return e;
    return 'non_conforme';
  }

  function checklist(x: Dati): FascicoloEssenziale[] {
    const voci = vociFascicolo(x);
    const cerca = (cat: string[], re?: RegExp) => voci.filter((v) => cat.includes(v.categoria) && (!re || re.test(v.titolo.toLowerCase())));
    const voce = (chiave: string, nomeV: string, rif: string, sezione: string, trovati: FascicoloVoce[], es?: CrEsito, msg?: string): FascicoloEssenziale => {
      const e = es ?? (trovati.length === 0 ? 'non_conforme' : migliore(trovati.map((t) => t.esito ?? 'conforme')));
      const m =
        msg ??
        ({ conforme: 'Presente e aggiornato.', in_scadenza: 'Presente, ma in revisione o in scadenza.', non_applicabile: 'Non richiesto per questa azienda.', da_verificare: 'Da verificare.' } as Record<string, string>)[e] ??
        (trovati.length === 0 ? 'Non presente nel fascicolo.' : 'Presente ma da aggiornare.');
      return { chiave, voce: nomeV, riferimento: rif, sezione, esito: e, messaggio: m, documenti: trovati.slice(0, 5) };
    };
    const o = x.org;
    const n = x.c.lavoratori || x.lav.length;
    const out: FascicoloEssenziale[] = [];
    out.push(voce('dvr', 'DVR aggiornato', 'art. 17 c.1 lett. a), art. 28 e art. 29 D.Lgs. 81/08', 'dvr', cerca(['dvr'])));
    const haOrg = !!o.datore_lavoro && (!!o.rspp || !!o.datore_svolge_rspp);
    const org = cerca(['nomine', 'altro'], /organigramma/);
    if (haOrg)
      org.unshift({
        id: 'organigramma', documento_id: null, virtuale: true, tipo: 'organigramma', dvr_id: null, pos_id: null,
        titolo: 'Organigramma della sicurezza (dati della piattaforma)', categoria: 'nomine', categoria_manuale: false, versione: '1.0',
        stato_documento: 'aggiornato', data: (x.c.updated_at ?? x.c.created_at).slice(0, 10), scadenza: null, essenziale: true, esito: 'conforme', ha_file: false, stato_piattaforma: null,
      });
    out.push(voce('organigramma', 'Organigramma della sicurezza', 'art. 18 e art. 28 c.2 lett. d) D.Lgs. 81/08', 'organigramma', org, undefined, org.length === 0 ? "Mancano datore di lavoro e RSPP nell'organigramma." : undefined));
    out.push(
      voce(
        'nomina_rspp',
        o.datore_svolge_rspp ? 'Attestazione del datore di lavoro che svolge i compiti del SPP' : 'Nomina del RSPP',
        o.datore_svolge_rspp ? 'art. 34 D.Lgs. 81/08' : 'art. 17 c.1 lett. b) e art. 31, 32 D.Lgs. 81/08',
        'nomine',
        cerca(['nomine', 'attestati'], /\brspp\b|responsabile del servizio/)
      )
    );
    out.push(
      o.medico_non_necessario
        ? voce('nomina_medico', 'Nomina del medico competente', 'art. 18 c.1 lett. a) e art. 41 D.Lgs. 81/08', 'nomine', [], 'non_applicabile', 'Sorveglianza sanitaria dichiarata non necessaria dalla valutazione dei rischi.')
        : voce('nomina_medico', 'Nomina del medico competente', 'art. 18 c.1 lett. a) e art. 41 D.Lgs. 81/08', 'nomine', cerca(['nomine'], /medico competente|\bmc\b/))
    );
    out.push(voce('rls', o.rappresentante_tipo === 'RLST' ? 'Comunicazione del RLST' : 'Verbale di elezione o designazione del RLS', 'art. 47 e 48 D.Lgs. 81/08', 'nomine', cerca(['nomine', 'verbali'], /\brls\b|\brlst\b|rappresentante dei lavoratori/)));
    const anti = cerca(['nomine'], /antincendio|emergenz|evacuaz/);
    const ps = cerca(['nomine'], /primo soccorso/);
    const tutti = [...anti, ...ps].filter((v, i, a) => a.findIndex((w) => w.id === v.id) === i);
    out.push(
      voce(
        'nomine_addetti',
        'Nomine degli addetti antincendio e primo soccorso',
        'art. 18 c.1 lett. b), art. 43 e 45 D.Lgs. 81/08; DM 02/09/2021; DM 388/2003',
        'nomine',
        tutti,
        anti.length === 0 || ps.length === 0 ? 'non_conforme' : undefined,
        anti.length === 0 && ps.length === 0 ? undefined : anti.length === 0 ? 'Manca la nomina degli addetti antincendio.' : ps.length === 0 ? 'Manca la nomina degli addetti al primo soccorso.' : undefined
      )
    );
    const gen = perLavoratore(x, /generale/);
    out.push(
      voce(
        'elenco_formati',
        'Elenco dei lavoratori formati',
        'art. 37 D.Lgs. 81/08; Accordo Stato Regioni 17/04/2025',
        'formazione',
        cerca(['formazione', 'attestati']),
        x.lav.length === 0 ? 'da_verificare' : gen.esito,
        x.lav.length === 0 ? 'Nessun lavoratore registrato.' : `Formazione generale valida per ${gen.ok} lavoratori su ${x.lav.length}.`
      )
    );
    const pe = cerca(['emergenza'], /piano|emergenz|evacuaz/);
    out.push(
      n < 10 && pe.length === 0
        ? voce('piano_emergenza', 'Piano di emergenza ed evacuazione', 'art. 43 e 46 D.Lgs. 81/08; DM 02/09/2021 art. 2', 'emergenza', [], 'non_applicabile', 'Sotto i 10 lavoratori non è obbligatorio, salvo i casi del DM 02/09/2021.')
        : voce('piano_emergenza', 'Piano di emergenza ed evacuazione', 'art. 43 e 46 D.Lgs. 81/08; DM 02/09/2021 art. 2', 'emergenza', pe)
    );
    out.push(
      n <= 15
        ? voce('riunione_periodica', 'Verbale della riunione periodica', 'art. 35 D.Lgs. 81/08', 'verbali', [], 'non_applicabile', 'Obbligatoria oltre i 15 lavoratori.')
        : voce('riunione_periodica', 'Verbale della riunione periodica', 'art. 35 D.Lgs. 81/08', 'verbali', cerca(['verbali'], /riunione/))
    );
    return out;
  }

  // ---------------------------------------------------------------- score
  function calcola(x: Dati): { aree: CrArea[]; criticita: CrCriticita[]; conformita: CrConformita; totale: number | null } {
    const o = x.org;
    const ctr = (
      chiave: string, titolo: string, peso: number, esito: CrEsito, priorita: CrPriorita, messaggio: string, azione: string, riferimento: string, credito: number | null = null
    ): CrControllo => ({ chiave, titolo, peso, esito, priorita, messaggio, azione, riferimento, credito });

    const d = ultimoDvr(x);
    const sDvr = d ? statoDvr(x, d) : null;
    const etaDvr = d ? (x.oggi.getTime() - (giorno(d.data_approvazione ?? d.data_creazione)?.getTime() ?? x.oggi.getTime())) / (365 * GIORNO) : null;
    const sicurezza: CrControllo[] = [
      ctr('dvr_presente', 'DVR presente', 25, d ? (d.status === 'approved' ? 'conforme' : 'in_scadenza') : 'non_conforme', 'alta',
        d ? (d.status === 'approved' ? 'DVR approvato in piattaforma.' : 'DVR presente ma non ancora approvato.') : 'Nessun DVR in piattaforma né nel fascicolo.',
        'Redigi il DVR con Falco e portalo in approvazione al titolare.', 'art. 17 c.1 lett. a) e art. 28 D.Lgs. 81/08'),
      ctr('dvr_aggiornato', 'DVR allineato ai dati', 15, !d ? 'non_applicabile' : sDvr === 'da_aggiornare' ? 'non_conforme' : 'conforme', 'alta',
        sDvr === 'da_aggiornare' ? "I dati dell'azienda sono cambiati dopo la redazione del DVR." : 'Nessuna modifica dopo la redazione.',
        'Rigenera il DVR con i dati aggiornati.', 'art. 29 c.3 D.Lgs. 81/08'),
      ctr('dvr_eta', 'Revisione del DVR negli ultimi 4 anni', 10, etaDvr == null ? 'non_applicabile' : etaDvr > 4 ? 'non_conforme' : etaDvr > 3.9 ? 'in_scadenza' : 'conforme', 'media',
        etaDvr != null && etaDvr > 4 ? 'Ultima revisione oltre 4 anni fa.' : 'Revisione recente.', 'Pianifica la revisione periodica del DVR.', 'art. 29 c.3 D.Lgs. 81/08, prassi dello studio'),
      ctr('rspp', 'RSPP', 15, o.rspp || o.datore_svolge_rspp ? 'conforme' : 'non_conforme', 'alta',
        o.datore_svolge_rspp ? 'Il datore di lavoro svolge i compiti del SPP.' : o.rspp ? `RSPP: ${o.rspp}.` : 'RSPP non indicato.',
        "Indica l'RSPP nell'organigramma o dichiara che il datore svolge i compiti (art. 34).", 'art. 17 c.1 lett. b), art. 31 e 34 D.Lgs. 81/08'),
      ctr('medico', 'Medico competente', 10, o.medico_non_necessario ? 'non_applicabile' : o.medico_competente ? 'conforme' : 'non_conforme', 'alta',
        o.medico_non_necessario ? 'Sorveglianza dichiarata non necessaria.' : o.medico_competente ? `Medico competente: ${o.medico_competente}.` : 'Medico competente non indicato.',
        "Nomina il medico competente o registra che la sorveglianza non è prevista.", 'art. 18 c.1 lett. a) e art. 41 D.Lgs. 81/08'),
      ctr('rls', 'Rappresentante dei lavoratori', 10,
        o.rappresentante_tipo === 'RLST' || o.rappresentante_tipo === 'assente' || (o.rappresentante_tipo === 'RLS' && !!o.rappresentante_nominativo) ? 'conforme' : 'non_conforme', 'media',
        o.rappresentante_tipo ? 'Scelta registrata.' : 'Manca la scelta tra RLS, RLST o nessun RLS eletto.', "Registra nell'organigramma la scelta su RLS o RLST.", 'art. 47 e 48 D.Lgs. 81/08'),
      ctr('addetti_emergenze', 'Addetti antincendio e primo soccorso', 15,
        (o.addetti_antincendio?.length ?? 0) > 0 && (o.addetti_primo_soccorso?.length ?? 0) > 0 ? 'conforme' : 'non_conforme', 'alta',
        (o.addetti_antincendio?.length ?? 0) === 0 && (o.addetti_primo_soccorso?.length ?? 0) === 0
          ? 'Mancano gli addetti antincendio e al primo soccorso.'
          : (o.addetti_antincendio?.length ?? 0) === 0 ? 'Mancano gli addetti antincendio.' : (o.addetti_primo_soccorso?.length ?? 0) === 0 ? 'Mancano gli addetti al primo soccorso.' : 'Addetti designati.',
        "Designa gli addetti e inseriscili nell'organigramma, poi pianifica i corsi.", 'art. 18 c.1 lett. b), art. 43, 45 e 46 D.Lgs. 81/08; DM 02/09/2021; DM 388/2003'),
    ];

    const fg = perLavoratore(x, /generale/);
    const fs = perLavoratore(x, /specifica/);
    const figure = (elenco: string[] | undefined, re: RegExp): CrEsito => {
      if (!elenco || elenco.length === 0) return 'non_applicabile';
      const e = elenco.map((p) => haCorso(x, p, re));
      return e.every((v) => v === 'conforme') ? 'conforme' : e.every((v) => v !== 'non_conforme') ? 'in_scadenza' : 'non_conforme';
    };
    const scaduti = x.corsi.filter((c) => {
      const s = giorno(c.data_scadenza);
      return s != null && s < x.oggi;
    });
    const formazione: CrControllo[] = [
      ctr('formazione_generale', 'Formazione generale', 25, fg.esito, 'alta', x.lav.length ? `Valida per ${fg.ok} lavoratori su ${x.lav.length}.` : 'Nessun lavoratore registrato.',
        'Registra gli attestati o pianifica il corso di formazione generale.', 'art. 37 D.Lgs. 81/08; Accordo Stato Regioni 17/04/2025', fg.credito),
      ctr('formazione_specifica', 'Formazione specifica', 25, fs.esito, 'alta', x.lav.length ? `Valida per ${fs.ok} lavoratori su ${x.lav.length}.` : 'Nessun lavoratore registrato.',
        'Pianifica la formazione specifica in base ai rischi della mansione.', 'art. 37 D.Lgs. 81/08; Accordo Stato Regioni 17/04/2025', fs.credito),
      ctr('formazione_preposti', 'Formazione dei preposti', 15, figure(o.preposti, /prepost/), 'media', 'Corso del preposto con aggiornamento biennale.',
        'Iscrivi i preposti al corso o al suo aggiornamento.', 'art. 37 c.7 e 7-ter D.Lgs. 81/08'),
      ctr('formazione_antincendio', 'Formazione antincendio', 10, figure(o.addetti_antincendio, /antincendio/), 'media', 'Corso per livello di rischio, aggiornamento quinquennale.',
        'Pianifica il corso antincendio degli addetti.', 'DM 02/09/2021'),
      ctr('formazione_primo_soccorso', 'Formazione primo soccorso', 10, figure(o.addetti_primo_soccorso, /primo soccorso/), 'media', 'Corso con aggiornamento triennale.',
        'Pianifica il corso di primo soccorso degli addetti.', 'DM 388/2003'),
      ctr('attestati_scaduti', 'Nessun attestato scaduto', 15, x.corsi.length === 0 ? 'da_verificare' : scaduti.length ? 'non_conforme' : 'conforme', 'media',
        scaduti.length ? `${scaduti.length} corsi con attestato scaduto.` : x.corsi.length ? 'Nessun attestato scaduto.' : 'Nessun corso registrato.',
        "Pianifica l'aggiornamento dei corsi scaduti.", 'art. 37 D.Lgs. 81/08'),
    ];

    const id = idoneita(x);
    const sorveglianza: CrControllo[] = o.medico_non_necessario
      ? []
      : [
          ctr('idoneita', 'Idoneità alla mansione', 100, id.esito, 'alta', x.lav.length ? `Idoneità valide per ${id.validi} lavoratori su ${x.lav.length}.` : 'Nessun lavoratore registrato.',
            'Pianifica con il medico competente le visite scadute o mancanti.', 'art. 41 D.Lgs. 81/08', id.credito),
        ];

    const documenti: CrControllo[] = checklist(x).map((v) =>
      ctr(`doc_${v.chiave}`, v.voce, 10, v.esito, ['dvr', 'organigramma', 'nomina_rspp', 'nomine_addetti'].includes(v.chiave) ? 'alta' : 'media', v.messaggio,
        v.esito === 'conforme' ? '' : `Carica nel fascicolo: ${v.voce.toLowerCase()}.`, v.riferimento)
    );

    const perArea: Record<CrAreaChiave, CrControllo[]> = { sicurezza, formazione, sorveglianza, documenti };
    const aree: CrArea[] = AREE.map(({ chiave, nome: n }) => {
      const app = perArea[chiave].filter((c) => c.esito !== 'non_applicabile');
      if (app.length === 0) return { chiave, nome: n, punteggio: null, stato: 'non_applicabile', controlli: perArea[chiave] };
      const pesi = app.reduce((s, c) => s + c.peso, 0);
      const somma = app.reduce((s, c) => s + c.peso * (c.credito ?? CREDITO[c.esito]), 0);
      return { chiave, nome: n, punteggio: Math.round((100 * somma) / pesi), stato: 'applicabile', controlli: perArea[chiave] };
    });
    const PESI: Record<CrAreaChiave, number> = { sicurezza: 35, formazione: 25, sorveglianza: 20, documenti: 20 };
    const valide = aree.filter((a) => a.punteggio != null);
    const totale = valide.length
      ? Math.round(valide.reduce((s, a) => s + PESI[a.chiave] * (a.punteggio ?? 0), 0) / valide.reduce((s, a) => s + PESI[a.chiave], 0))
      : null;

    const tutti = Object.entries(perArea).flatMap(([area, cs]) => cs.map((c) => ({ ...c, area })));
    const ordine: Record<CrPriorita, number> = { alta: 0, media: 1, bassa: 2 };
    const criticita: CrCriticita[] = tutti
      .filter((c) => c.esito === 'non_conforme' || c.esito === 'in_scadenza' || c.esito === 'da_verificare')
      .map((c) => ({ area: c.area, chiave: c.chiave, titolo: c.titolo, esito: c.esito, priorita: c.esito === 'in_scadenza' && c.priorita === 'alta' ? 'media' : c.priorita, peso: c.peso, messaggio: c.messaggio, azione: c.azione, riferimento: c.riferimento }))
      .sort((a, b) => ordine[a.priorita] - ordine[b.priorita] || b.peso - a.peso);
    const conta = (e: CrEsito) => tutti.filter((c) => c.esito === e).length;
    return {
      aree,
      criticita,
      totale,
      conformita: { conformi: conta('conforme'), in_scadenza: conta('in_scadenza'), non_conformi: conta('non_conforme'), da_verificare: conta('da_verificare'), non_applicabili: conta('non_applicabile') },
    };
  }

  function tendenza(companyId: number, totale: number | null, registra: boolean): CrTendenza {
    const mese = meseDi(oggi());
    const prec = meseSpostato(mese, -1);
    let foto = deps.leggi<{ company_id: number; mese: string; totale: number | null }>(K.snapshot);
    if (registra) {
      foto = [...foto.filter((f) => !(f.company_id === companyId && f.mese === mese)), { company_id: companyId, mese, totale }];
      deps.scrivi(K.snapshot, foto);
    }
    const p = foto.find((f) => f.company_id === companyId && f.mese === prec)?.totale ?? null;
    const delta = p != null && totale != null ? totale - p : null;
    return { mese, mese_precedente: prec, totale_precedente: p, delta, direzione: delta == null ? 'nd' : delta > 0 ? 'su' : delta < 0 ? 'giu' : 'stabile' };
  }

  // ---------------------------------------------------------------- scadenzario
  function tutteLeVoci(x: Dati): CrVoceScadenza[] {
    const out: CrVoceScadenza[] = [];
    const add = (fonte: string, id: number | null, data: string | null | undefined, titolo: string, descrizione: string, categoria: string, priorita: CrScadenzaPriorita) => {
      const d = giorno(data);
      if (!d) return;
      // Giorni di calendario (mezzogiorno contro mezzogiorno: niente sorprese con l'ora legale).
      const oggi12 = giorno(isoGiorno(x.oggi)) ?? x.oggi;
      const giorni = Math.round((d.getTime() - oggi12.getTime()) / GIORNO);
      out.push({
        chiave: `${fonte}:${id ?? titolo}`,
        fonte, id, data: isoGiorno(d), giorni,
        stato: giorni < 0 ? 'scaduta' : giorni <= 30 ? 'in_scadenza' : 'programmata',
        azienda_id: x.c.id, azienda: x.c.ragione_sociale, titolo, descrizione, categoria, priorita,
      });
    };
    const CAT: Record<string, string> = { formazione: 'formazione', visita_medica: 'visita_medica', verifica_impianti: 'verifica', manutenzione_attrezzature: 'verifica', aggiornamento_dvr: 'dvr', sopralluogo: 'altro', altro: 'altro' };
    for (const s of x.scad) if (s.stato !== 'completata') add('scadenza', s.id, s.data_prevista, s.descrizione, s.note ?? '', CAT[s.tipo] ?? 'altro', s.priorita);
    for (const c of x.corsi) if (c.data_scadenza) add('corso', c.id, c.data_scadenza, `Aggiornamento: ${c.titolo}`, `${c.partecipanti.length} partecipanti.`, 'formazione', 'alta');
    for (const l of x.lav) {
      const v = giorno(l.idoneita_sanitaria_data);
      if (v) add('visita_medica', l.id, isoGiorno(piuGiorni(v, 365)), `Visita medica: ${nome(l)}`, 'Rinnovo del giudizio di idoneità (art. 41 D.Lgs. 81/08).', 'visita_medica', 'alta');
    }
    for (const a of x.attr) if (a.prossima_manutenzione) add('attrezzatura_manutenzione', a.id, a.prossima_manutenzione, `Manutenzione: ${[a.marca, a.modello].filter(Boolean).join(' ') || a.codice_interno}`, 'Manutenzione programmata (art. 71 D.Lgs. 81/08).', 'verifica', 'media');
    for (const d of x.dpi) if (d.scadenza) add('dpi', d.id, d.scadenza, `Scadenza DPI: ${d.tipo}`, d.norma_en ?? '', 'dpi', 'media');
    for (const i of x.ispezioni)
      for (const p of i.prescrizioni) if (p.termine) add('scadenza', p.scadenza_id ?? null, p.termine, `Prescrizione ${i.ente}: ${p.descrizione}`, `Ispezione del ${i.data ?? ''}.`, 'altro', 'critica');
    for (const v of vociFascicolo(x)) if (v.scadenza && !v.virtuale) add('documento', v.documento_id, v.scadenza, `Documento in scadenza: ${v.titolo}`, '', 'documento', 'media');
    return out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }

  function contatori(voci: CrVoceScadenza[]): CrContatori {
    const g = (v: CrVoceScadenza) => v.giorni ?? 0;
    return {
      entro_30: voci.filter((v) => g(v) >= 0 && g(v) <= 30).length,
      scadute: voci.filter((v) => g(v) < 0).length,
      visite_da_pianificare: voci.filter((v) => v.categoria === 'visita_medica' && g(v) <= 60).length,
      corsi_in_scadenza: voci.filter((v) => v.categoria === 'formazione' && g(v) <= 60).length,
      alert_aperti: voci.filter((v) => g(v) < 0 || (g(v) <= 7 && (v.priorita === 'alta' || v.priorita === 'critica'))).length,
    };
  }

  const LIVELLO_PRI: Record<CrScadenzaPriorita, number> = { bassa: 0, media: 1, alta: 2, critica: 3 };

  async function panoramica(companyId: number): Promise<ControlRoomPanoramica> {
    const x = await dati(companyId);
    const s = calcola(x);
    const voci = tutteLeVoci(x);
    return {
      azienda_id: x.c.id,
      ragione_sociale: x.c.ragione_sociale,
      calcolato_il: new Date().toISOString(),
      totale: s.totale,
      livello: livelloDa(s.totale),
      aree: s.aree.map((a) => ({ ...a, controlli: [] })),
      criticita: s.criticita.slice(0, 10),
      criticita_totali: s.criticita.length,
      conformita: s.conformita,
      tendenza: tendenza(companyId, s.totale, true),
      scadenze: { contatori: contatori(voci), prossime: voci.filter((v) => (v.giorni ?? 0) <= 30).slice(0, 8) },
    };
  }

  // ---------------------------------------------------------------- passaporto
  function contenutoPubblico(x: Dati): NonNullable<PassDemo['contenuto']> {
    const o = x.org;
    const sede = x.c.sedi[0];
    const fg = perLavoratore(x, /generale/);
    const id = idoneita(x);
    const righe: Array<[string, string[] | undefined]> = [
      ['Datore di lavoro', o.datore_lavoro ? [o.datore_lavoro] : undefined],
      ['RSPP', o.datore_svolge_rspp ? ['Il datore di lavoro (art. 34)'] : o.rspp ? [o.rspp] : undefined],
      ['Medico competente', o.medico_non_necessario ? ['Non previsto'] : o.medico_competente ? [o.medico_competente] : undefined],
      ['Rappresentante dei lavoratori', o.rappresentante_tipo ? [`${o.rappresentante_tipo === 'assente' ? 'Nessun RLS eletto' : o.rappresentante_tipo} ${o.rappresentante_nominativo ?? ''}`.trim()] : undefined],
      ['Preposti', o.preposti],
      ['Addetti antincendio', o.addetti_antincendio],
      ['Addetti primo soccorso', o.addetti_primo_soccorso],
    ];
    return {
      azienda: {
        ragione_sociale: x.c.ragione_sociale,
        ateco: x.c.ateco || null,
        lavoratori: x.c.lavoratori || x.lav.length || null,
        sede: sede ? [sede.indirizzo, sede.comune].filter(Boolean).join(', ') || null : null,
      },
      organigramma: righe.filter(([, n]) => n && n.length).map(([ruolo, nomi]) => ({ ruolo, nomi: nomi as string[] })),
      documenti_essenziali: checklist(x)
        .filter((v) => v.esito !== 'non_applicabile')
        .map((v) => ({
          voce: v.voce, esito: v.esito, riferimento: v.riferimento, messaggio: v.messaggio,
          documenti: v.documenti.map((d) => ({ titolo: d.titolo, data: d.data, versione: d.versione, stato: d.stato_documento, link: null })),
        })),
      formazione: x.lav.length ? `Formazione generale e specifica valida per ${fg.ok} lavoratori su ${x.lav.length}.` : null,
      sorveglianza: o.medico_non_necessario
        ? 'Sorveglianza sanitaria non prevista dalla valutazione dei rischi.'
        : x.lav.length
          ? `Idoneità valide per ${id.validi} lavoratori su ${x.lav.length}, giudizi custoditi dal medico competente.`
          : null,
    };
  }

  const passaporti = () => deps.leggi<PassDemo>(K.passaporti);
  const valido = (p: PassDemo, d = oggi()) => p.attivo && !p.revocato_il && (!p.scade_il || (giorno(p.scade_il)?.getTime() ?? 0) >= d.getTime() - GIORNO);
  const vista = (p: PassDemo): PassaportoVista => {
    const ok = p.accessi.filter((a) => a.esito === 'ok');
    return {
      id: p.id, azienda_id: p.company_id, attivo: p.attivo, valido: valido(p), scade_il: p.scade_il, sezioni: p.sezioni, creato_il: p.creato_il,
      revocato_il: p.revocato_il, qr_disponibile: false, accessi_totali: ok.length, ultimo_accesso: ok[0]?.quando ?? null,
    };
  };
  const casuale = (n: number, alfabeto: string) => {
    const b = new Uint32Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 2 ** 32);
    return Array.from(b, (v) => alfabeto[v % alfabeto.length]).join('');
  };
  const SEZIONI = ['anagrafica', 'organigramma', 'dvr', 'nomine', 'formazione', 'sorveglianza', 'emergenza', 'verbali', 'impianti', 'pos_duvri'];

  function trovaPubblico(token: string): { chiave: string; voci: PassDemo[]; p: PassDemo } | null {
    let tutti = deps.tuttiIPassaporti?.() ?? [];
    if (tutti.length === 0) {
      try {
        tutti = [{ chiave: K.passaporti, voci: passaporti() }];
      } catch {
        tutti = [];
      }
    }
    for (const g of tutti) {
      const p = g.voci.find((v) => v.token === token);
      if (p) return valido(p) ? { ...g, p } : null;
    }
    return null;
  }

  async function report(companyId: number, mese: string): Promise<ReportMensile> {
    if (!/^\d{4}-\d{2}$/.test(mese)) throw errore('VALIDATION', 'Mese non valido: usa il formato AAAA-MM.');
    if (mese > meseDi(oggi())) throw errore('VALIDATION', 'Il report si prepara per il mese corrente o per quelli passati.');
    const x = await dati(companyId);
    const s = calcola(x);
    const nel = (iso: string | null | undefined) => !!iso && iso.slice(0, 7) === mese;
    const salvati = deps.leggi<{ company_id: number; mese: string; osservazioni: string | null; con_ai: boolean; il: string | null; pdf: boolean }>(K.report);
    const r = salvati.find((v) => v.company_id === companyId && v.mese === mese);
    const foto = deps.leggi<{ company_id: number; mese: string; totale: number | null }>(K.snapshot);
    const corrente = meseDi(oggi());
    const andamento = Array.from({ length: 6 }, (_, i) => {
      const m = meseSpostato(mese, i - 5);
      const t = m === corrente ? s.totale : foto.find((f) => f.company_id === companyId && f.mese === m)?.totale ?? null;
      return { mese: m, totale: t };
    });
    const succ = meseSpostato(mese, 1);
    const voci = tutteLeVoci(x);
    const assistenza = deps.leggi<{ company_id: number; quando: string }>(K.assistenza).filter((a) => a.company_id === companyId && nel(a.quando));
    const ispMese = x.ispezioni.filter((i) => nel(i.data));
    return {
      report_id: null,
      azienda_id: x.c.id,
      ragione_sociale: x.c.ragione_sociale,
      mese,
      osservazioni: r?.osservazioni ?? null,
      osservazioni_ai: r?.con_ai ?? false,
      osservazioni_il: r?.il ?? null,
      pdf_disponibile: r?.pdf ?? false,
      aggiornato_il: new Date().toISOString(),
      dati: {
        periodo: { dal: `${mese}-01`, al: isoGiorno(new Date(Number(mese.slice(0, 4)), Number(mese.slice(5, 7)), 0)) },
        attivita: {
          dvr_generati: x.dvr.filter((d) => nel(d.data_creazione)).length,
          dvr_approvati: x.dvr.filter((d) => nel(d.data_approvazione)).length,
          rilievi_sopralluogo: x.docs.filter((d) => d.tipo !== 'documento' && nel(d.created_at)).length,
          documenti_caricati: x.docs.filter((d) => d.tipo === 'documento' && nel(d.created_at)).length,
          attestati_registrati: x.corsi.filter((c) => nel(c.data_svolgimento)).reduce((n, c) => n + c.partecipanti.length, 0),
          consegne_dpi: x.dpi.filter((d) => nel(d.data_consegna)).length,
          ispezioni: ispMese.length,
          richieste_assistenza: assistenza.length,
        },
        visite_svolte: x.lav.filter((l) => nel(l.idoneita_sanitaria_data)).length,
        corsi_erogati: x.corsi.filter((c) => nel(c.data_svolgimento)).map((c) => ({ corso: c.titolo, attestati: c.partecipanti.length })),
        ispezioni: ispMese.map((i) => ({ data: i.data, ente: i.ente, tipo: i.tipo, esito: i.esito })),
        safety_score: { totale: s.totale, livello: livelloDa(s.totale), aree: Object.fromEntries(s.aree.map((a) => [a.chiave, a.punteggio])), al: isoGiorno(oggi()) },
        criticita_aperte: s.criticita.map((c) => ({ area: c.area, priorita: c.priorita, titolo: c.titolo, messaggio: c.messaggio, azione: c.azione, riferimento: c.riferimento })),
        andamento,
        priorita_mese_successivo: {
          mese: succ,
          scadenze: voci.filter((v) => v.data?.slice(0, 7) === succ || (v.giorni ?? 0) < 0).slice(0, 10).map((v) => ({ data: v.data, titolo: v.titolo, categoria: v.categoria, priorita: v.priorita, scaduta: (v.giorni ?? 0) < 0 })),
          criticita: s.criticita.filter((c) => c.priorita === 'alta').slice(0, 5).map((c) => `${c.titolo}: ${c.azione}`),
        },
      },
    };
  }

  function salvaReport(companyId: number, mese: string, campi: Partial<{ osservazioni: string | null; con_ai: boolean; il: string | null; pdf: boolean }>) {
    const arr = deps.leggi<{ company_id: number; mese: string; osservazioni: string | null; con_ai: boolean; il: string | null; pdf: boolean }>(K.report);
    const i = arr.findIndex((v) => v.company_id === companyId && v.mese === mese);
    const prima = i >= 0 ? arr[i] : { company_id: companyId, mese, osservazioni: null, con_ai: false, il: null, pdf: false };
    const dopo = { ...prima, ...campi };
    if (i >= 0) arr[i] = dopo;
    else arr.push(dopo);
    deps.scrivi(K.report, arr);
  }

  function validaIspezione(input: Partial<IspezioneInput>, ruolo: Role, nuova: boolean) {
    if (!daConsulente(ruolo) && (input.esito != null || (input.prescrizioni?.length ?? 0) > 0)) {
      throw errore('VALIDATION', "Esito e prescrizioni li registra il consulente: indica solo ente, data, tipo e note.");
    }
    if (nuova && !input.ente) throw errore('VALIDATION', "Indica l'ente che ha svolto il controllo.");
    if (input.data && input.data > isoGiorno(oggi())) throw errore('VALIDATION', "La data dell'ispezione non può essere futura.");
  }

  return {
    controlRoom: panoramica,
    safetyScore: async (companyId): Promise<SafetyScoreCompleto> => {
      const x = await dati(companyId);
      const s = calcola(x);
      return {
        azienda_id: x.c.id, ragione_sociale: x.c.ragione_sociale, calcolato_il: new Date().toISOString(), totale: s.totale, livello: livelloDa(s.totale),
        aree: s.aree, criticita: s.criticita, conformita: s.conformita, tendenza: tendenza(companyId, s.totale, false), lavoratori_considerati: x.lav.length,
        formula: 'Ogni controllo ha un peso; conforme vale 1, in scadenza 0,7, da verificare e non conforme 0, non applicabile non conta. Area = media pesata dei controlli; totale = media delle aree con pesi sicurezza 35, formazione 25, sorveglianza 20, documenti 20.',
      };
    },
    scadenzario: async (companyId, f?: ScadenzarioFiltri): Promise<ScadenzarioAzienda> => {
      const x = await dati(companyId);
      const tutte = tutteLeVoci(x);
      const periodo = f?.periodo ?? '30';
      const max = periodo === 'oggi' ? 0 : Number(periodo);
      const min = f?.priorita ? LIVELLO_PRI[f.priorita] : 0;
      const voci = tutte.filter((v) => {
        const g = v.giorni ?? 0;
        if (g < 0) return f?.includi_scadute !== false && LIVELLO_PRI[v.priorita] >= min;
        return g <= max && LIVELLO_PRI[v.priorita] >= min;
      });
      return { azienda_id: x.c.id, ragione_sociale: x.c.ragione_sociale, periodo, priorita_minima: f?.priorita ?? null, contatori: contatori(tutte), voci };
    },
    fascicolo: async (companyId, f): Promise<FascicoloAzienda> => {
      const x = await dati(companyId);
      const voci = vociFascicolo(x);
      const categorie: FascicoloCategoriaStato[] = CATEGORIE_FASCICOLO.map(({ chiave, nome: n }) => {
        const qui = voci.filter((v) => v.categoria === chiave);
        const stato: FascicoloCategoriaStato['stato'] =
          qui.length === 0 ? 'vuota' : qui.some((v) => v.esito === 'non_conforme') ? 'da_aggiornare' : qui.some((v) => v.esito === 'in_scadenza') ? 'in_revisione' : 'aggiornato';
        return { chiave, nome: n, documenti: qui.length, stato };
      });
      const q = (f?.cerca ?? '').trim().toLowerCase();
      const filtrate = voci
        .filter((v) => (!f?.categoria || v.categoria === f.categoria) && (!q || v.titolo.toLowerCase().includes(q)))
        .sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')));
      return {
        azienda_id: x.c.id, ragione_sociale: x.c.ragione_sociale, totale: voci.length, cerca: q || null, categoria: f?.categoria ?? null, categorie,
        recenti: filtrate.slice(0, q || f?.categoria ? 100 : 10),
        essenziali: checklist(x).filter((e) => e.esito !== 'non_applicabile'),
      };
    },
    fascicoloAggiorna: async (docId, campi): Promise<FascicoloVoce> => {
      if (!daConsulente(deps.utente().role)) throw vietato();
      const ds = deps.ds();
      const arr = deps.leggi<FascicoloOverride>(K.fascicolo);
      const prima = arr.find((o) => o.doc_id === docId) ?? { doc_id: docId };
      const dopo = { ...prima, ...campi };
      deps.scrivi(K.fascicolo, [...arr.filter((o) => o.doc_id !== docId), dopo]);
      const companies = await ds.companies.list();
      for (const c of companies) {
        const docs = await ds.companyDocuments.list(c.id);
        const d = docs.find((v) => v.id === docId);
        if (d) return voceDocumento({ ...(await dati(c.id)) }, d);
      }
      throw nonTrovato();
    },
    report,
    reportPdf: async (companyId, mese) => {
      if (!daConsulente(deps.utente().role)) throw vietato();
      await report(companyId, mese);
      salvaReport(companyId, mese, { pdf: true });
      return report(companyId, mese);
    },
    scaricaReportPdf: async (companyId, mese) => {
      const r = await report(companyId, mese);
      if (!r.pdf_disponibile) throw errore('NOT_FOUND', 'Il PDF di questo mese non è ancora stato generato.');
      const { scaricaReportDemo } = await import('./control-room-pdf');
      await scaricaReportDemo(r);
    },
    salvaOsservazioni: async (companyId, mese, osservazioni, conAi = false) => {
      if (!daConsulente(deps.utente().role)) throw vietato();
      await report(companyId, mese);
      salvaReport(companyId, mese, { osservazioni: osservazioni.trim() || null, con_ai: conAi, il: new Date().toISOString(), pdf: false });
      return report(companyId, mese);
    },
    passaporto: async (companyId): Promise<PassaportoStato> => {
      const x = await dati(companyId);
      const tutti = passaporti().filter((p) => p.company_id === companyId).sort((a, b) => b.id - a.id);
      const attivo = tutti.find((p) => valido(p)) ?? null;
      return {
        azienda_id: x.c.id, ragione_sociale: x.c.ragione_sociale, attivo: attivo ? vista(attivo) : null, storico: tutti.slice(0, 10).map(vista),
        accessi: attivo ? attivo.accessi.slice(0, 20) : [], nota: attivo ? null : 'Nessun passaporto attivo: lo crea il titolare o il consulente.',
      };
    },
    creaPassaporto: async (companyId, input): Promise<PassaportoCreato> => {
      if (!gestisceIlPassaporto(deps.utente().role)) throw vietato();
      const x = await dati(companyId);
      const pin = input?.pin?.trim() || casuale(6, '0123456789');
      if (!/^\d{4,8}$/.test(pin)) throw errore('VALIDATION', 'Il PIN deve avere da 4 a 8 cifre.');
      const ora = new Date().toISOString();
      const arr = passaporti().map((p) => (p.company_id === companyId && p.attivo ? { ...p, attivo: false, revocato_il: p.revocato_il ?? ora } : p));
      const p: PassDemo = {
        id: arr.reduce((m, v) => Math.max(m, v.id), 0) + 1, company_id: companyId, ragione_sociale: x.c.ragione_sociale,
        token: `pass_${casuale(48, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}`, pin,
        sezioni: input?.sezioni?.length ? input.sezioni : SEZIONI, scade_il: input?.scade_il ?? null, creato_il: ora, revocato_il: null, attivo: true, accessi: [],
        contenuto: contenutoPubblico(x),
      };
      deps.scrivi(K.passaporti, [...arr, p]);
      const origine = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://dvr.conflavoro.it';
      return { passaporto: vista(p), token: p.token, pin, link: `${origine}/passaporto/?t=${p.token}` };
    },
    revocaPassaporto: async (pid) => {
      if (!gestisceIlPassaporto(deps.utente().role)) throw vietato();
      const arr = passaporti();
      const i = arr.findIndex((p) => p.id === pid);
      if (i < 0) throw nonTrovato();
      arr[i] = { ...arr[i], attivo: false, revocato_il: new Date().toISOString() };
      deps.scrivi(K.passaporti, arr);
      return vista(arr[i]);
    },
    passaportoAccessi: async (pid) => {
      const p = passaporti().find((v) => v.id === pid);
      if (!p) throw nonTrovato();
      return p.accessi;
    },
    // In demo non c'e' un generatore di QR: lo produce il server.
    qrSvgUrl: async () => null,
    scaricaQrPdf: async () => {
      throw errore('DEMO', 'In modalità dimostrativa il foglio con il QR non si scarica: lo prepara il server collegato.');
    },
    ispezioni: async (companyId) => {
      await dati(companyId);
      return deps
        .leggi<Ispezione>(K.ispezioni)
        .filter((i) => i.azienda_id === companyId)
        .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id);
    },
    creaIspezione: async (input) => {
      validaIspezione(input, deps.utente().role, true);
      await dati(input.company_id);
      const arr = deps.leggi<Ispezione>(K.ispezioni);
      const i: Ispezione = {
        id: arr.reduce((m, v) => Math.max(m, v.id), 0) + 1, azienda_id: input.company_id, ente: input.ente, data: input.data || isoGiorno(oggi()),
        tipo: input.tipo?.trim() || null, esito: input.esito ?? null, note: input.note?.trim() || null,
        prescrizioni: (input.prescrizioni ?? []).filter((p) => p.descrizione.trim()).map((p, k) => ({ descrizione: p.descrizione.trim(), termine: p.termine || null, scadenza_id: p.termine ? 9000 + k : null })),
        creato_il: new Date().toISOString(),
      };
      deps.scrivi(K.ispezioni, [...arr, i]);
      return i;
    },
    aggiornaIspezione: async (id, patch) => {
      const ruolo = deps.utente().role;
      if (!daConsulente(ruolo)) throw vietato();
      validaIspezione(patch, ruolo, false);
      const arr = deps.leggi<Ispezione>(K.ispezioni);
      const k = arr.findIndex((v) => v.id === id);
      if (k < 0) throw nonTrovato();
      const v = arr[k];
      arr[k] = {
        ...v,
        ente: patch.ente ?? v.ente,
        data: patch.data ?? v.data,
        tipo: patch.tipo !== undefined ? patch.tipo.trim() || null : v.tipo,
        note: patch.note !== undefined ? patch.note.trim() || null : v.note,
        esito: patch.esito !== undefined ? patch.esito : v.esito,
        prescrizioni: patch.prescrizioni
          ? patch.prescrizioni.filter((p) => p.descrizione.trim()).map((p, j) => ({ descrizione: p.descrizione.trim(), termine: p.termine || null, scadenza_id: p.termine ? 9000 + j : null }))
          : v.prescrizioni,
      };
      deps.scrivi(K.ispezioni, arr);
      return arr[k];
    },
    eliminaIspezione: async (id) => {
      const r = deps.utente().role;
      if (r !== 'titolare_studio' && r !== 'admin_conflavoro') throw vietato();
      deps.scrivi(K.ispezioni, deps.leggi<Ispezione>(K.ispezioni).filter((v) => v.id !== id));
    },
    prontoControllo: async (companyId): Promise<ProntoControllo> => {
      const x = await dati(companyId);
      const mostra = checklist(x).filter((v) => v.esito !== 'non_applicabile');
      const u = deps.utente();
      const pass = passaporti().some((p) => p.company_id === companyId && valido(p));
      return {
        azienda_id: x.c.id,
        ragione_sociale: x.c.ragione_sociale,
        mostra_subito: mostra.map((v) => ({
          chiave: v.chiave, voce: v.voce, esito: v.esito, messaggio: v.messaggio, riferimento: v.riferimento,
          documenti: v.documenti.map((d) => ({ id: d.id, titolo: d.titolo, virtuale: d.virtuale, tipo: d.tipo, ha_file: d.ha_file })),
        })),
        pronti: mostra.filter((v) => v.esito === 'conforme').length,
        totale: mostra.length,
        referente: u.role === 'consulente' || u.role === 'titolare_studio' ? { nome: u.name, email: u.email, ruolo: u.role } : null,
        passaporto_attivo: pass,
        ultime_ispezioni: x.ispezioni.sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5),
        consigli: CONSIGLI_PRONTO,
      };
    },
    richiediAssistenza: async (companyId, input): Promise<AssistenzaEsito> => {
      await dati(companyId);
      const arr = deps.leggi<{ id: number; company_id: number; quando: string; ente: string | null; messaggio: string | null }>(K.assistenza);
      const id = arr.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      deps.scrivi(K.assistenza, [...arr, { id, company_id: companyId, quando: new Date().toISOString(), ente: input?.ente ?? null, messaggio: input?.messaggio?.trim() || null }]);
      return {
        richiesta_id: id, azienda_id: companyId, avvisati: 0, email: 0, canali: 0, referente: null,
        nota: "Modalità dimostrativa: la richiesta è registrata ma nessun avviso è partito. Con il server collegato l'email arriva subito al consulente e ai titolari dello studio.",
      };
    },
    passaportoPubblico: async (token) => {
      if (!trovaPubblico(token)) throw errore('NOT_FOUND', 'Passaporto non trovato o non più valido.');
      return {
        richiede: ['pin', 'ente', 'nome'],
        enti: ['ASL', 'INL', 'VVF', 'NAS', 'ARPA', 'consulente', 'altro'],
        informativa:
          "Per consultare i documenti di sicurezza dell'azienda inserisci il PIN che ti ha comunicato, l'ente che rappresenti e il tuo nome. L'accesso viene registrato con data e ora. I dati sanitari dei lavoratori non sono consultabili.",
      };
    },
    apriPassaportoPubblico: async (token, input): Promise<PassaportoConsultazione> => {
      const t = trovaPubblico(token);
      if (!t) throw errore('NOT_FOUND', 'Passaporto non trovato o non più valido.');
      const ora = new Date();
      const recenti = t.p.accessi.filter((a) => a.esito === 'pin_errato' && a.quando && ora.getTime() - new Date(a.quando).getTime() < 15 * 60_000);
      if (recenti.length >= 5) throw errore('RATE_LIMIT', 'Troppi tentativi con PIN errato: riprova tra 15 minuti.');
      const ok = input.pin === t.p.pin;
      const acc: PassaportoAccesso = { quando: ora.toISOString(), ente: ok ? input.ente : null, nome: ok ? input.nome.trim() : null, esito: ok ? 'ok' : 'pin_errato', aperto: ok ? 'elenco documenti' : null };
      const aggiornati = t.voci.map((v) => (v.id === t.p.id ? { ...v, accessi: [acc, ...v.accessi].slice(0, 200) } : v));
      // K.passaporti = passaporti dell'utente in sessione; altrimenti chiave completa di un altro utente demo.
      if (t.chiave === K.passaporti) deps.scrivi(K.passaporti, aggiornati);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(t.chiave, JSON.stringify(aggiornati));
      if (!ok) throw errore('FORBIDDEN', 'PIN non corretto.');
      const c = t.p.contenuto;
      return {
        azienda: c?.azienda ?? { ragione_sociale: t.p.ragione_sociale, ateco: null, lavoratori: null, sede: null },
        consultato_il: ora.toISOString(),
        link_validi_minuti: 15,
        avviso: 'Accesso registrato. In modalità dimostrativa i documenti non si scaricano.',
        organigramma: c?.organigramma ?? [],
        documenti_essenziali: c?.documenti_essenziali ?? [],
        altri_documenti: [],
        formazione: c?.formazione ?? null,
        sorveglianza: c?.sorveglianza ?? null,
      };
    },
  };
}
