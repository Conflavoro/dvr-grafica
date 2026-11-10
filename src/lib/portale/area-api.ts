/**
 * Chiamate dell'area azienda, operativita' (ADR-009 V4): scadenziario,
 * dipendenti, formazione, visite, antincendio. Tutte sotto
 * /api/portale/aziende/{id}/area; senza backend (modalita' demo) restano vuote.
 * I mappatori sono tolleranti: un campo strano non rompe la vista.
 */

import { apiUpload, apiUrl, getToken } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';
import type { StatoChip } from '@/components/portale/kit';
import { consegnaFile } from '@/lib/app/file-recenti';

const STATI: StatoChip[] = ['ok', 'warn', 'danger', 'todo', 'info', 'run', 'sign', 'pay', 'approve', 'neutral', 'blocked'];
export const stato = (v: unknown, riserva: StatoChip = 'neutral'): StatoChip => (STATI.includes(v as StatoChip) ? (v as StatoChip) : riserva);
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';
const base = (id: number) => `/portale/aziende/${id}/area`;
/** Sede scelta nel selettore del guscio: il server filtra i dati per quella sede (FiltroSede). */
const conSede = (path: string, sede?: number | null) => (sede ? `${path}${path.includes('?') ? '&' : '?'}sede=${sede}` : path);
const dati = (r: unknown) => rec(rec(r).data);

// ---------------------------------------------------------------- scadenziario

export type CategoriaScadenza = 'visite' | 'formazione' | 'antincendio' | 'primosoccorso' | 'haccp' | 'documenti' | 'contratto' | 'ispezioni' | 'attrezzature' | 'impianti' | 'altro';
/** Fase di una voce: la visita fissata e' "Prenotata" (il lavoratore non conferma, 09). */
export type Fase = 'scaduta' | 'da_prenotare' | 'prenotata';
export type Finestra = '30' | '60' | '90' | 'tutte';

export interface VoceScadenza {
  chiave: string;
  categoria: CategoriaScadenza;
  titolo: string;
  sotto: string;
  data: string | null;
  giorni: number | null;
  fase: Fase;
  stato: StatoChip;
  allarme: boolean;
  lavoratoreId: number | null;
  scadenzaId: number | null;
  appuntamento: string | null;
  inAttesaPagamento: boolean;
  corso: string | null;
  /** Prenota (visite), Iscrivi (formazione), Apri il documento, Vedi il rinnovo, Vedi. */
  azione: 'prenota' | 'iscrivi' | 'apri_documento' | 'vedi_rinnovo' | 'vedi';
  /** Rotta dell'app della voce (es. "visite/lavoratori/12"). */
  link: string | null;
}

export interface Scadenziario {
  contatori: { scadute: number; maiFatte: number; allarme: number; daPrenotare: number; prenotate: number; totale: number; badge30: number };
  categorie: Array<{ k: CategoriaScadenza; t: string }>;
  perCategoria: Partial<Record<CategoriaScadenza, number>>;
  voci: VoceScadenza[];
  promemoria: unknown;
  permessi: { prenota: boolean; iscrivi: boolean; attestati: boolean };
}

const CATEGORIE: CategoriaScadenza[] = ['visite', 'formazione', 'antincendio', 'primosoccorso', 'haccp', 'documenti', 'contratto', 'ispezioni', 'attrezzature', 'impianti', 'altro'];
const FASI: Fase[] = ['scaduta', 'da_prenotare', 'prenotata'];

export function mappaVoce(raw: unknown): VoceScadenza | null {
  const r = rec(raw);
  const titolo = testo(r.titolo);
  if (!titolo) return null;
  const cat = CATEGORIE.includes(r.categoria as CategoriaScadenza) ? (r.categoria as CategoriaScadenza) : 'altro';
  const az = testo(r.azione);
  return {
    chiave: testo(r.chiave) ?? titolo,
    categoria: cat,
    titolo,
    sotto: testo(r.sotto) ?? '',
    data: testo(r.data),
    giorni: numero(r.giorni),
    fase: FASI.includes(r.fase as Fase) ? (r.fase as Fase) : 'da_prenotare',
    stato: stato(r.stato, 'todo'),
    allarme: bool(r.allarme),
    lavoratoreId: numero(r.lavoratore_id),
    scadenzaId: numero(r.scadenza_id),
    appuntamento: testo(r.appuntamento_il),
    inAttesaPagamento: bool(r.in_attesa_pagamento),
    corso: testo(r.corso),
    azione: (['prenota', 'iscrivi', 'apri_documento', 'vedi_rinnovo', 'vedi'].includes(az ?? '') ? az : 'vedi') as VoceScadenza['azione'],
    link: testo(r.link),
  };
}

export function mappaScadenziario(raw: unknown): Scadenziario {
  const d = dati(raw);
  const c = rec(d.contatori);
  const cat = rec(d.categorie);
  const per = rec(d.per_categoria);
  const p = rec(d.permessi);
  return {
    contatori: {
      scadute: numero(c.scadute) ?? 0,
      maiFatte: numero(c.mai_fatte) ?? 0,
      allarme: numero(c.allarme) ?? 0,
      daPrenotare: numero(c.da_prenotare) ?? 0,
      prenotate: numero(c.prenotate) ?? 0,
      totale: numero(c.totale) ?? 0,
      badge30: numero(c.badge_30) ?? 0,
    },
    categorie: CATEGORIE.filter((k) => testo(cat[k])).map((k) => ({ k, t: testo(cat[k])! })),
    perCategoria: Object.fromEntries(CATEGORIE.map((k) => [k, numero(per[k]) ?? 0])) as Partial<Record<CategoriaScadenza, number>>,
    voci: lista(d.voci).map(mappaVoce).filter((x): x is VoceScadenza => x !== null),
    promemoria: d.promemoria ?? null,
    permessi: { prenota: bool(p.prenota), iscrivi: bool(p.iscrivi), attestati: bool(p.attestati) },
  };
}

const VUOTO_SCAD: Scadenziario = {
  contatori: { scadute: 0, maiFatte: 0, allarme: 0, daPrenotare: 0, prenotate: 0, totale: 0, badge30: 0 },
  categorie: [],
  perCategoria: {},
  voci: [],
  promemoria: null,
  permessi: { prenota: false, iscrivi: false, attestati: false },
};

export async function scadenziario(aziendaId: number, finestra: Finestra, sede?: number | null): Promise<Scadenziario> {
  if (!isApiMode()) return VUOTO_SCAD;
  return mappaScadenziario(await prendi(conSede(`${base(aziendaId)}/scadenze?finestra=${finestra}`, sede)));
}

// ---------------------------------------------------------------- dipendenti

export interface CorsoPersona {
  codice: string;
  nome: string;
  ore: number | null;
  anni: number | null;
  rif: string | null;
  stato: StatoChip;
  scadeIl: string | null;
  conseguitoIl: string | null;
}

export interface RigaPersona {
  id: number;
  nome: string;
  mansione: string;
  reparto: string | null;
  rischio: string | null;
  assuntoIl: string | null;
  nuovo: boolean;
  sorveglianza: boolean | null;
  sorveglianzaDaDefinire: boolean;
  visita: { stato: StatoChip; finoAl: string | null; appuntamento: string | null } | null;
  corsiValidi: number;
  corsiRichiesti: number;
  stato: StatoChip;
  statoTesto: string;
  quotaDaPagare: boolean;
}

export interface Persone {
  contatori: { lavoratori: number; conVisita: number | null; nuovi: number; daSistemare: number; copertura: number | null; canoneMese: string | number | null };
  lavoratori: RigaPersona[];
  cessati: Array<{ id: number; nome: string; mansione: string; reparto: string | null; cessatoIl: string | null; motivo: string | null }>;
  motivi: Array<{ k: string; t: string }>;
  nota: string | null;
  /** Nuovi assunti in avvio con i passi (04, "Nuovi assunti e regolarizzazioni"). */
  nuovi: NuovoInAvvio[];
  regolarizzazioni: Array<{ id: number; nome: string; mansione: string; dal: string | null; regolarizzatoIl: string | null; conguaglio: number }>;
  /** Organico su tre fonti: null per il consulente del lavoro. */
  organico: { elenco: number; ebiasp: number; visitatiFormati: number; massimo: number; vale: 'elenco' | 'ebiasp' | 'visitati_formati'; coincidono: boolean } | null;
  reparti: string[];
  mansioni: string[];
  permessi: { assumi: boolean; cessa: boolean; modifica: boolean; richiedi: boolean };
}

export interface NuovoInAvvio {
  id: number;
  nome: string;
  mansione: string;
  reparto: string | null;
  assuntoIl: string | null;
  contratto: string | null;
  stato: StatoChip;
  quota: { id: number; importo: number; pagata: boolean; rischio: string | null; conVisita: boolean };
  passi: Array<{ k: string; fatto?: boolean; stato?: string; quando?: string | null; cellulare?: string | null; lingua?: string | null }>;
}

export function mappaRigaPersona(raw: unknown): RigaPersona | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const v = r.visita ? rec(r.visita) : null;
  return {
    id,
    nome: testo(r.nome) ?? 'Lavoratore',
    mansione: testo(r.mansione) ?? '',
    reparto: testo(r.reparto),
    rischio: testo(r.rischio),
    assuntoIl: testo(r.assunto_il),
    nuovo: bool(r.nuovo),
    sorveglianza: r.sorveglianza === null || r.sorveglianza === undefined ? null : bool(r.sorveglianza),
    sorveglianzaDaDefinire: bool(r.sorveglianza_da_definire),
    visita: v ? { stato: stato(v.stato, 'todo'), finoAl: testo(v.fino_al), appuntamento: testo(v.appuntamento_il) } : null,
    corsiValidi: numero(r.corsi_validi) ?? 0,
    corsiRichiesti: numero(r.corsi_richiesti) ?? 0,
    stato: stato(r.stato, 'ok'),
    statoTesto: testo(r.stato_testo) ?? '',
    quotaDaPagare: bool(r.quota_da_pagare),
  };
}

export async function persone(aziendaId: number, sede?: number | null): Promise<Persone> {
  const vuoto: Persone = {
    contatori: { lavoratori: 0, conVisita: null, nuovi: 0, daSistemare: 0, copertura: null, canoneMese: null },
    lavoratori: [],
    cessati: [],
    motivi: [],
    nota: null,
    nuovi: [],
    regolarizzazioni: [],
    organico: null,
    reparti: [],
    mansioni: [],
    permessi: { assumi: false, cessa: false, modifica: false, richiedi: false },
  };
  if (!isApiMode()) return vuoto;
  const d = dati(await prendi(conSede(`${base(aziendaId)}/persone`, sede)));
  const c = rec(d.contatori);
  return {
    contatori: {
      lavoratori: numero(c.lavoratori) ?? 0,
      conVisita: numero(c.con_visita),
      nuovi: numero(c.nuovi) ?? 0,
      daSistemare: numero(c.da_sistemare) ?? 0,
      copertura: numero(c.copertura),
      canoneMese: (numero(c.canone_mese) ?? testo(c.canone_mese)) as string | number | null,
    },
    lavoratori: lista(d.lavoratori).map(mappaRigaPersona).filter((x): x is RigaPersona => x !== null),
    cessati: lista(d.cessati).map((x) => {
      const r = rec(x);
      return { id: numero(r.id) ?? 0, nome: testo(r.nome) ?? '', mansione: testo(r.mansione) ?? '', reparto: testo(r.reparto), cessatoIl: testo(r.cessato_il), motivo: testo(r.motivo) };
    }),
    motivi: Object.entries(rec(d.motivi_cessazione)).map(([k, t]) => ({ k, t: String(t) })),
    nota: testo(d.nota),
    nuovi: lista(d.nuovi).map((x) => {
      const r = rec(x);
      const q = rec(r.quota);
      return {
        id: numero(r.id) ?? 0,
        nome: testo(r.nome) ?? '',
        mansione: testo(r.mansione) ?? '',
        reparto: testo(r.reparto),
        assuntoIl: testo(r.assunto_il),
        contratto: testo(r.contratto),
        stato: stato(r.stato, 'todo'),
        quota: { id: numero(q.id) ?? 0, importo: numero(q.importo) ?? 0, pagata: bool(q.pagata), rischio: testo(q.rischio), conVisita: bool(q.con_visita) },
        passi: lista(r.passi).map((y) => {
          const p = rec(y);
          return { k: testo(p.k) ?? '', fatto: bool(p.fatto), stato: testo(p.stato) ?? undefined, quando: testo(p.quando), cellulare: testo(p.cellulare), lingua: testo(p.lingua) };
        }),
      };
    }),
    regolarizzazioni: lista(d.regolarizzazioni).map((x) => {
      const r = rec(x);
      return { id: numero(r.id) ?? 0, nome: testo(r.nome) ?? '', mansione: testo(r.mansione) ?? '', dal: testo(r.dal), regolarizzatoIl: testo(r.regolarizzato_il), conguaglio: numero(r.conguaglio) ?? 0 };
    }),
    organico: d.organico
      ? (() => {
          const o = rec(d.organico);
          const vale = o.vale === 'ebiasp' || o.vale === 'visitati_formati' ? o.vale : 'elenco';
          return { elenco: numero(o.elenco) ?? 0, ebiasp: numero(o.ebiasp) ?? 0, visitatiFormati: numero(o.visitati_formati) ?? 0, massimo: numero(o.massimo) ?? 0, vale, coincidono: bool(o.coincidono) } as Persone['organico'];
        })()
      : null,
    reparti: lista(d.reparti).map(String),
    mansioni: lista(d.mansioni).map(String),
    permessi: { assumi: bool(rec(d.permessi).assumi), cessa: bool(rec(d.permessi).cessa), modifica: bool(rec(d.permessi).modifica), richiedi: bool(rec(d.permessi).richiedi) },
  };
}

export interface SchedaPersona {
  id: number;
  nome: string;
  anagrafica: Record<string, string>;
  rischio: string | null;
  sorveglianza: boolean | null;
  sorveglianzaDaDefinire: boolean;
  stato: { stato: StatoChip; testo: string };
  corsi: CorsoPersona[] | null;
  visita: {
    stato: StatoChip;
    finoAl: string | null;
    ultima: string | null;
    scadenzaId: number | null;
    statoPrenotazione: string | null;
    appuntamento: string | null;
    luogo: string | null;
    tipoVisita: string | null;
    inAttesaPagamento: boolean;
    esito: { codice: string; testo: string } | null;
  } | null;
  visiteBloccate: boolean;
  dpi: Array<{ id: number; descrizione: string; norma: string | null; consegnatoIl: string | null; scadeIl: string | null; stato: StatoChip }>;
  scadenze: Array<{ id: number; tipo: string; descrizione: string; data: string | null; statoPrenotazione: string | null }>;
  quota: { importo: number | string; stato: string } | null;
  link: { attivo: boolean; inviatoIl: string | null };
  permessi: { modifica: boolean; cessa: boolean; prenota: boolean; attestati: boolean };
}

export function mappaCorso(raw: unknown): CorsoPersona {
  const r = rec(raw);
  return {
    codice: testo(r.codice) ?? '',
    nome: testo(r.nome) ?? '',
    ore: numero(r.ore),
    anni: numero(r.anni),
    rif: testo(r.rif),
    stato: stato(r.stato, 'todo'),
    scadeIl: testo(r.scade_il),
    conseguitoIl: testo(r.conseguito_il),
  };
}

export function mappaSchedaPersona(raw: unknown): SchedaPersona {
  const d = dati(raw);
  const v = d.visita ? rec(d.visita) : null;
  const es = v?.esito ? rec(v.esito) : null;
  const st = rec(d.stato);
  const p = rec(d.permessi);
  const q = d.quota ? rec(d.quota) : null;
  const l = rec(d.link);
  return {
    id: numero(d.id) ?? 0,
    nome: testo(d.nome) ?? 'Lavoratore',
    anagrafica: Object.fromEntries(Object.entries(rec(d.anagrafica)).map(([k, x]) => [k, String(x)])),
    rischio: testo(d.rischio),
    sorveglianza: d.sorveglianza === null || d.sorveglianza === undefined ? null : bool(d.sorveglianza),
    sorveglianzaDaDefinire: bool(d.sorveglianza_da_definire),
    stato: { stato: stato(st.stato, 'ok'), testo: testo(st.testo) ?? '' },
    corsi: Array.isArray(d.corsi) ? d.corsi.map(mappaCorso) : null,
    visita: v
      ? {
          stato: stato(v.stato, 'todo'),
          finoAl: testo(v.fino_al),
          ultima: testo(v.ultima),
          scadenzaId: numero(v.scadenza_id),
          statoPrenotazione: testo(v.stato_prenotazione),
          appuntamento: testo(v.appuntamento_il),
          luogo: testo(v.luogo),
          tipoVisita: testo(v.tipo_visita),
          inAttesaPagamento: bool(v.in_attesa_pagamento),
          esito: es && testo(es.testo) ? { codice: testo(es.codice) ?? '', testo: testo(es.testo)! } : null,
        }
      : null,
    visiteBloccate: bool(d.visite_bloccate),
    dpi: lista(d.dpi).map((x) => {
      const r = rec(x);
      return { id: numero(r.id) ?? 0, descrizione: testo(r.descrizione) ?? 'DPI', norma: testo(r.norma), consegnatoIl: testo(r.consegnato_il), scadeIl: testo(r.scade_il), stato: stato(r.stato, 'ok') };
    }),
    scadenze: lista(d.scadenze).map((x) => {
      const r = rec(x);
      return { id: numero(r.id) ?? 0, tipo: testo(r.tipo) ?? '', descrizione: testo(r.descrizione) ?? '', data: testo(r.data), statoPrenotazione: testo(r.stato_prenotazione) };
    }),
    quota: q ? { importo: (numero(q.importo) ?? testo(q.importo) ?? 0) as number | string, stato: testo(q.stato) ?? '' } : null,
    link: { attivo: bool(l.attivo), inviatoIl: testo(l.inviato_il) },
    permessi: { modifica: bool(p.modifica), cessa: bool(p.cessa), prenota: bool(p.prenota), attestati: bool(p.attestati) },
  };
}

export async function schedaPersona(aziendaId: number, id: number): Promise<SchedaPersona | null> {
  if (!isApiMode()) return null;
  return mappaSchedaPersona(await prendi(`${base(aziendaId)}/persone/${id}`));
}

export interface DatiNuovoAssunto {
  nome: string;
  cognome: string;
  mansione: string;
  reparto?: string;
  data_assunzione: string;
  contratto: string;
  cellulare: string;
  lingua: string;
  unilav_riferimento: string;
  rischio?: string;
  visita?: boolean;
  /** Risposte si' o no che decidono la visita (vdt, notte, carichi). */
  risposte?: Record<string, boolean>;
  sede_id?: number | null;
}

export async function nuovoAssunto(aziendaId: number, d: DatiNuovoAssunto): Promise<{ id: number; nome: string; quota: string | number | null; link: string | null }> {
  const r = dati(await manda(`${base(aziendaId)}/persone`, d));
  const l = rec(r.lavoratore);
  return { id: numero(l.id) ?? 0, nome: testo(l.nome) ?? '', quota: (numero(rec(r.quota).importo) ?? testo(rec(r.quota).importo)) as string | number | null, link: testo(r.link_lavoratore) };
}

export interface EsitoMansione {
  anteprima: boolean;
  cambiato: boolean;
  effetti: string[];
}

export async function modificaMansione(aziendaId: number, id: number, d: { mansione: string; reparto?: string | null; rischio?: string | null; sorveglianza?: boolean; conferma: boolean }): Promise<EsitoMansione> {
  const r = dati(await manda(`${base(aziendaId)}/persone/${id}/mansione`, d));
  return { anteprima: bool(r.anteprima), cambiato: bool(r.cambiato), effetti: lista(r.effetti).map(String) };
}

export async function cessa(aziendaId: number, id: number, data: string, motivo: string): Promise<string | null> {
  return testo(dati(await manda(`${base(aziendaId)}/persone/${id}/cessazione`, { data, motivo })).nota);
}

export async function inviaLink(aziendaId: number, id: number): Promise<{ link: string; nota: string }> {
  const r = dati(await manda(`${base(aziendaId)}/persone/${id}/link`));
  return { link: testo(r.link) ?? '', nota: testo(r.nota) ?? '' };
}

// ---------------------------------------------------------------- formazione

export interface Obbligo {
  codice: string;
  nome: string;
  anni: number | null;
  rif: string | null;
  ore: string | null;
  chi: string;
  richiestoA: number;
  conteggi: Record<'ok' | 'warn' | 'danger' | 'todo' | 'info', number>;
  lavoratori: Array<{ id: number; nome: string; mansione: string; stato: StatoChip; scadeIl: string | null; conseguitoIl: string | null }>;
}

export interface Formazione {
  contatori: { copertura: number | null; inRegola: number; lavoratori: number; daFare: number; inScadenza: number; prenotati: number; attestati: number };
  obblighi: Obbligo[];
  persone: Array<{ id: number; nome: string; mansione: string; rischio: string | null; corsi: Array<{ codice: string; stato: StatoChip; scadeIl: string | null }>; validi: number; richiesti: number; stato: StatoChip }>;
  attestati: Array<{ id: number; lavoratoreId: number; lavoratore: string | null; corso: string; nomeCorso: string; ente: string | null; conseguitoIl: string | null; scadeIl: string | null; file: boolean }>;
  catalogo: Array<{ codice: string; nome: string; anni: number | null; aPagamento: boolean; prezzo: number | null }>;
  /** Colonne della matrice (nomi brevi della specifica). */
  colonne: Array<{ codice: string; nome: string; aPagamento: boolean }>;
  /** Classi in programma (solo gli iscritti di questa azienda). */
  classi: ClasseFutura[];
  attrezzature: Array<{ codice: string; servizio: string; nome: string; ore: number | null; prezzo: number | null }>;
  richieste: Array<{ testo: string; chi: string; il: string | null; stato: string }>;
  permessi: { attestati: boolean; prenota: boolean; iscrivi: boolean; richiedi: boolean; ordina: boolean };
  nota: string | null;
}

export interface ClasseFutura {
  id: number;
  titolo: string;
  corsi: string[];
  data: string;
  ora: string | null;
  modalita: string;
  luogo: string | null;
  posti: number;
  liberi: number;
  iscritti: string[];
}

export function mappaFormazione(raw: unknown): Formazione {
  const d = dati(raw);
  const c = rec(d.contatori);
  const p = rec(d.permessi);
  return {
    contatori: {
      copertura: numero(c.copertura),
      inRegola: numero(c.in_regola) ?? 0,
      lavoratori: numero(c.lavoratori) ?? 0,
      daFare: numero(c.da_fare) ?? 0,
      inScadenza: numero(c.in_scadenza) ?? 0,
      prenotati: numero(c.prenotati) ?? 0,
      attestati: numero(c.attestati) ?? 0,
    },
    obblighi: lista(d.obblighi).map((x) => {
      const r = rec(x);
      return {
        codice: testo(r.codice) ?? '',
        nome: testo(r.nome) ?? '',
        anni: numero(r.anni),
        rif: testo(r.rif),
        ore: testo(r.ore),
        chi: testo(r.chi) ?? '',
        richiestoA: numero(r.richiesto_a) ?? 0,
        conteggi: { ok: numero(r.ok) ?? 0, warn: numero(r.warn) ?? 0, danger: numero(r.danger) ?? 0, todo: numero(r.todo) ?? 0, info: numero(r.info) ?? 0 },
        lavoratori: lista(r.lavoratori).map((y) => {
          const l = rec(y);
          return { id: numero(l.id) ?? 0, nome: testo(l.nome) ?? '', mansione: testo(l.mansione) ?? '', stato: stato(l.stato, 'todo'), scadeIl: testo(l.scade_il), conseguitoIl: testo(l.conseguito_il) };
        }),
      };
    }),
    persone: lista(d.persone).map((x) => {
      const r = rec(x);
      return {
        id: numero(r.id) ?? 0,
        nome: testo(r.nome) ?? '',
        mansione: testo(r.mansione) ?? '',
        rischio: testo(r.rischio),
        corsi: lista(r.corsi).map((y) => {
          const k = rec(y);
          return { codice: testo(k.codice) ?? '', stato: stato(k.stato, 'todo'), scadeIl: testo(k.scade_il) };
        }),
        validi: numero(r.validi) ?? 0,
        richiesti: numero(r.richiesti) ?? 0,
        stato: stato(r.stato, 'ok'),
      };
    }),
    attestati: lista(d.attestati).map((x) => {
      const r = rec(x);
      return {
        id: numero(r.id) ?? 0,
        lavoratoreId: numero(r.lavoratore_id) ?? 0,
        lavoratore: testo(r.lavoratore),
        corso: testo(r.corso) ?? '',
        nomeCorso: testo(r.nome_corso) ?? '',
        ente: testo(r.ente),
        conseguitoIl: testo(r.conseguito_il),
        scadeIl: testo(r.scade_il),
        file: bool(r.file),
      };
    }),
    catalogo: lista(d.corsi_catalogo).map((x) => {
      const r = rec(x);
      return { codice: testo(r.codice) ?? '', nome: testo(r.nome) ?? '', anni: numero(r.anni), aPagamento: bool(r.a_pagamento), prezzo: numero(r.prezzo) };
    }),
    colonne: lista(rec(d.matrice).colonne).map((x) => ({ codice: testo(rec(x).codice) ?? '', nome: testo(rec(x).nome) ?? '', aPagamento: bool(rec(x).a_pagamento) })).filter((x) => x.codice),
    classi: lista(d.classi).map((x) => {
      const r = rec(x);
      return {
        id: numero(r.id) ?? 0,
        titolo: testo(r.titolo) ?? '',
        corsi: lista(r.corsi).map(String),
        data: testo(r.data) ?? '',
        ora: testo(r.ora),
        modalita: testo(r.modalita) ?? '',
        luogo: testo(r.luogo),
        posti: numero(r.posti) ?? 0,
        liberi: numero(r.liberi) ?? 0,
        iscritti: lista(r.iscritti).map(String),
      };
    }),
    attrezzature: lista(d.corsi_attrezzature).map((x) => {
      const r = rec(x);
      return { codice: testo(r.codice) ?? '', servizio: testo(r.servizio) ?? '', nome: testo(r.nome) ?? '', ore: numero(r.ore), prezzo: numero(r.prezzo) };
    }),
    richieste: lista(d.richieste_corsi).map((x) => {
      const r = rec(x);
      return { testo: testo(r.testo) ?? '', chi: testo(r.chi) ?? '', il: testo(r.il), stato: testo(r.stato) ?? 'In valutazione da ISFOR' };
    }),
    permessi: { attestati: bool(p.attestati), prenota: bool(p.prenota), iscrivi: bool(p.iscrivi), richiedi: bool(p.richiedi), ordina: bool(p.ordina) },
    nota: testo(d.nota),
  };
}

export async function formazione(aziendaId: number, sede?: number | null): Promise<Formazione | null> {
  if (!isApiMode()) return null;
  return mappaFormazione(await prendi(conSede(`${base(aziendaId)}/formazione`, sede)));
}

export async function caricaAttestato(aziendaId: number, d: { lavoratore_id: number; corso: string; data_conseguimento: string; data_scadenza?: string; ente?: string }, file: File | null): Promise<string> {
  const fd = new FormData();
  Object.entries(d).forEach(([k, v]) => v !== undefined && v !== '' && fd.append(k, String(v)));
  if (file) fd.append('file', file);
  try {
    const r = await apiUpload(`${base(aziendaId)}/attestati`, fd);
    return testo(dati(r).nota) ?? 'Attestato registrato.';
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

/** Scarica un file protetto (attestato, documento) con il token dell'utente. */
export async function scarica(path: string, nome: string): Promise<void> {
  const token = getToken();
  const res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(res.status === 403 ? 'Con il tuo ruolo questo file non è disponibile.' : 'File non disponibile.');
  // Web: download del browser. App: visore del telefono e copia cifrata tra i file recenti.
  await consegnaFile(await res.blob(), nome, path);
}

// ---------------------------------------------------------------- visite

export interface RigaVisita {
  id: number;
  nome: string;
  mansione: string;
  rischio: string | null;
  stato: StatoChip;
  finoAl: string | null;
  ultima: string | null;
  scadenzaId: number | null;
  statoPrenotazione: string | null;
  appuntamento: string | null;
  luogo: string | null;
  tipoVisita: string | null;
  inAttesaPagamento: boolean;
  esito: { codice: string; testo: string } | null;
  storico: Array<{ data: string | null; tipo: string | null; descrizione: string | null }>;
}

export interface Visite {
  contatori: { conSorveglianza: number; valide: number; scadute: number; daFare: number; daPrenotare: number; inCalendario: number; daDefinire: number };
  lavoratori: RigaVisita[];
  calendario: Array<{ lavoratoreId: number; nome: string; mansione: string; scadenzaId: number | null; appuntamento: string; luogo: string | null; tipoVisita: string | null; disdettaGratuita: boolean | null }>;
  medico: { nome: string; email: string | null; conAccesso: boolean; nominaFinoAl: string | null; coordinatore: boolean; testo: string | null } | null;
  /** Con piu' sedi: un medico coordinato per sede. */
  mediciSede: Array<{ sedeId: number; sede: string; medico: string | null; email: string | null; centro: string | null; testo: string }>;
  centri: Array<{ nome: string; indirizzo: string | null }>;
  sorveglianzaNonPrevista: boolean;
  tipiVisita: string[];
  permessi: { prenota: boolean };
  nota: string | null;
}

export function mappaVisite(raw: unknown): Visite {
  const d = dati(raw);
  const c = rec(d.contatori);
  const m = d.medico ? rec(d.medico) : null;
  return {
    contatori: {
      conSorveglianza: numero(c.con_sorveglianza) ?? 0,
      valide: numero(c.valide) ?? 0,
      scadute: numero(c.scadute) ?? 0,
      daFare: numero(c.da_fare) ?? 0,
      inCalendario: numero(c.in_calendario) ?? 0,
      daPrenotare: numero(c.da_prenotare) ?? (numero(c.scadute) ?? 0) + (numero(c.da_fare) ?? 0),
      daDefinire: numero(c.da_definire) ?? 0,
    },
    lavoratori: lista(d.lavoratori).map((x) => {
      const r = rec(x);
      const es = r.esito ? rec(r.esito) : null;
      return {
        id: numero(r.id) ?? 0,
        nome: testo(r.nome) ?? '',
        mansione: testo(r.mansione) ?? '',
        rischio: testo(r.rischio),
        stato: stato(r.stato, 'todo'),
        finoAl: testo(r.fino_al),
        ultima: testo(r.ultima),
        scadenzaId: numero(r.scadenza_id),
        statoPrenotazione: testo(r.stato_prenotazione),
        appuntamento: testo(r.appuntamento_il),
        luogo: testo(r.luogo),
        tipoVisita: testo(r.tipo_visita),
        inAttesaPagamento: bool(r.in_attesa_pagamento),
        esito: es && testo(es.testo) ? { codice: testo(es.codice) ?? '', testo: testo(es.testo)! } : null,
        storico: lista(r.storico).map((y) => {
          const s = rec(y);
          return { data: testo(s.data), tipo: testo(s.tipo), descrizione: testo(s.descrizione) };
        }),
      };
    }),
    calendario: lista(d.calendario)
      .map((x) => {
        const r = rec(x);
        const app = testo(r.appuntamento_il);
        return app
          ? {
              lavoratoreId: numero(r.lavoratore_id) ?? 0,
              nome: testo(r.nome) ?? '',
              mansione: testo(r.mansione) ?? '',
              scadenzaId: numero(r.scadenza_id),
              appuntamento: app,
              luogo: testo(r.luogo),
              tipoVisita: testo(r.tipo_visita),
              disdettaGratuita: r.disdetta_gratuita === null || r.disdetta_gratuita === undefined ? null : bool(r.disdetta_gratuita),
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    medico: m && testo(m.nome) ? { nome: testo(m.nome)!, email: testo(m.email), conAccesso: bool(m.con_accesso), nominaFinoAl: testo(m.nomina_fino_al), coordinatore: bool(m.coordinatore), testo: testo(m.testo) } : null,
    mediciSede: lista(d.medici_sede).map((x) => {
      const r = rec(x);
      return { sedeId: numero(r.sede_id) ?? 0, sede: testo(r.sede) ?? '', medico: testo(r.medico), email: testo(r.email), centro: testo(r.centro), testo: testo(r.testo) ?? '' };
    }),
    centri: lista(d.centri).map((x) => ({ nome: testo(rec(x).nome) ?? '', indirizzo: testo(rec(x).indirizzo) })).filter((x) => x.nome),
    sorveglianzaNonPrevista: bool(d.sorveglianza_non_prevista),
    tipiVisita: lista(d.tipi_visita).map(String),
    permessi: { prenota: bool(rec(d.permessi).prenota) },
    nota: testo(d.nota),
  };
}

export async function visite(aziendaId: number, sede?: number | null): Promise<Visite | null> {
  if (!isApiMode()) return null;
  return mappaVisite(await prendi(conSede(`${base(aziendaId)}/visite`, sede)));
}

export interface RichiestaPrenotazione {
  tipo: 'visita' | 'corso';
  lavoratori: number[];
  corso?: string;
  tipo_visita?: string;
  preferenza?: string;
  note?: string;
}

export async function richiediPrenotazione(aziendaId: number, d: RichiestaPrenotazione): Promise<string> {
  return testo(dati(await manda(`${base(aziendaId)}/prenotazioni`, d)).nota) ?? 'Richiesta inviata alla segreteria.';
}

export async function disdici(scadenzaId: number, motivo: string): Promise<{ gratuita: boolean; nota: string }> {
  const r = dati(await manda(`/portale/area/scadenze/${scadenzaId}/disdici`, { motivo }));
  return { gratuita: bool(r.gratuita), nota: testo(r.nota) ?? '' };
}

export async function richiestaStudio(aziendaId: number, titolo: string, testoRichiesta: string): Promise<string> {
  return testo(dati(await manda(`${base(aziendaId)}/richieste`, { titolo, testo: testoRichiesta })).nota) ?? 'Richiesta inviata allo studio.';
}

// ---------------------------------------------------------------- antincendio

export interface Presidio {
  id: number;
  tipo: string;
  tipoNome: string;
  descrizione: string;
  posizione: string | null;
  sede: string | null;
  ultima: string | null;
  prossima: string | null;
  stato: 'ok' | 'da_riparare' | 'sostituito';
  chip: StatoChip;
  nota: string | null;
  norma: string | null;
}

export interface Addetto {
  nome: string;
  lavoratoreId: number | null;
  mansione: string | null;
  corso: { stato: StatoChip; scadeIl: string | null; conseguitoIl: string | null };
}

export interface Antincendio {
  livello: { numero: number; nome: string; ore: number; aggiornamento: number; uso: string } | null;
  contatori: { presidi: number; presidiOk: number; daRiparare: number; addettiAntincendio: number; addettiMinimi: number; addettiPrimoSoccorso: number; daFare: number };
  daFare: Array<{ testo: string; extra: string; urg: number; azione: string; presidioId: number | null; lavoratoreId: number | null }>;
  presidi: Presidio[];
  registro: Array<{ id: number; data: string; tipo: string; tipoTesto: string; chi: string | null; sede: string | null; esito: 'ok' | 'nota'; note: string | null }>;
  sorveglianzaMese: { fatta: boolean; sediMancanti: string[]; ultima: string | null } | null;
  prossimoSemestrale: string | null;
  addetti: { antincendio: Addetto[]; primoSoccorso: Addetto[] };
  prove: { ultima: Record<string, unknown> | null; prossimaEntro: string | null; stato: StatoChip; numero: number };
  manutentore: { ditta: string; telefono: string; contratto: string } | null;
  piano: { id: number; titolo: string; revisione: number | null; emessoIl: string | null; download: string } | null;
  tipiPresidio: Array<{ codice: string; nome: string }>;
  voci: Record<string, string[]>;
  motivi: Array<{ k: string; t: string }>;
  permessi: { registra: boolean; manutentore: boolean; prenota: boolean };
}

const mappaAddetto = (x: unknown): Addetto => {
  const r = rec(x);
  const k = rec(r.corso);
  return { nome: testo(r.nome) ?? '', lavoratoreId: numero(r.lavoratore_id), mansione: testo(r.mansione), corso: { stato: stato(k.stato, 'todo'), scadeIl: testo(k.scade_il), conseguitoIl: testo(k.conseguito_il) } };
};

export function mappaAntincendio(raw: unknown): Antincendio {
  const d = dati(raw);
  const c = rec(d.contatori);
  const lv = d.livello ? rec(d.livello) : null;
  const sm = d.sorveglianza_mese ? rec(d.sorveglianza_mese) : null;
  const pr = rec(d.prove);
  const man = d.manutentore ? rec(d.manutentore) : null;
  const pi = d.piano ? rec(d.piano) : null;
  const ad = rec(d.addetti);
  const p = rec(d.permessi);
  return {
    livello: lv && numero(lv.numero) ? { numero: numero(lv.numero)!, nome: testo(lv.nome) ?? '', ore: numero(lv.ore) ?? 0, aggiornamento: numero(lv.aggiornamento) ?? 0, uso: testo(lv.uso) ?? '' } : null,
    contatori: {
      presidi: numero(c.presidi) ?? 0,
      presidiOk: numero(c.presidi_ok) ?? 0,
      daRiparare: numero(c.da_riparare) ?? 0,
      addettiAntincendio: numero(c.addetti_antincendio) ?? 0,
      addettiMinimi: numero(c.addetti_minimi) ?? 1,
      addettiPrimoSoccorso: numero(c.addetti_primo_soccorso) ?? 0,
      daFare: numero(c.da_fare) ?? 0,
    },
    daFare: lista(d.da_fare).map((x) => {
      const r = rec(x);
      return { testo: testo(r.testo) ?? '', extra: testo(r.extra) ?? '', urg: numero(r.urg) ?? 3, azione: testo(r.azione) ?? '', presidioId: numero(r.presidio_id), lavoratoreId: numero(r.lavoratore_id) };
    }),
    presidi: lista(d.presidi).map((x) => {
      const r = rec(x);
      const st = testo(r.stato);
      return {
        id: numero(r.id) ?? 0,
        tipo: testo(r.tipo) ?? 'altro',
        tipoNome: testo(r.tipo_nome) ?? 'Presidio',
        descrizione: testo(r.descrizione) ?? '',
        posizione: testo(r.posizione),
        sede: testo(r.sede),
        ultima: testo(r.ultima_verifica),
        prossima: testo(r.prossima_verifica),
        stato: st === 'da_riparare' || st === 'sostituito' ? st : 'ok',
        chip: stato(r.chip, 'ok'),
        nota: testo(r.nota),
        norma: testo(r.norma),
      };
    }),
    registro: lista(d.registro).map((x) => {
      const r = rec(x);
      return { id: numero(r.id) ?? 0, data: testo(r.data) ?? '', tipo: testo(r.tipo) ?? '', tipoTesto: testo(r.tipo_testo) ?? '', chi: testo(r.chi), sede: testo(r.sede), esito: r.esito === 'nota' ? 'nota' : 'ok', note: testo(r.note) };
    }),
    sorveglianzaMese: sm ? { fatta: bool(sm.fatta), sediMancanti: lista(sm.sedi_mancanti).map(String), ultima: testo(sm.ultima) } : null,
    prossimoSemestrale: testo(d.prossimo_semestrale),
    addetti: { antincendio: lista(ad.antincendio).map(mappaAddetto), primoSoccorso: lista(ad.primo_soccorso).map(mappaAddetto) },
    prove: { ultima: pr.ultima ? rec(pr.ultima) : null, prossimaEntro: testo(pr.prossima_entro), stato: stato(pr.stato, 'todo'), numero: numero(pr.numero) ?? 0 },
    manutentore: man && testo(man.ditta) ? { ditta: testo(man.ditta)!, telefono: testo(man.telefono) ?? '', contratto: testo(man.contratto) ?? '' } : null,
    piano: pi && numero(pi.id) ? { id: numero(pi.id)!, titolo: testo(pi.titolo) ?? 'Piano di emergenza', revisione: numero(pi.revisione), emessoIl: testo(pi.emesso_il), download: testo(pi.download) ?? '' } : null,
    tipiPresidio: lista(d.tipi_presidio).map((x) => {
      const r = rec(x);
      return { codice: testo(r.codice) ?? '', nome: testo(r.nome) ?? '' };
    }),
    voci: Object.fromEntries(Object.entries(rec(d.voci_sorveglianza)).map(([k, v]) => [k, lista(v).map(String)])),
    motivi: Object.entries(rec(d.motivi)).map(([k, t]) => ({ k, t: String(t) })),
    permessi: { registra: bool(p.registra), manutentore: bool(p.manutentore), prenota: bool(p.prenota) },
  };
}

export async function antincendio(aziendaId: number): Promise<Antincendio | null> {
  if (!isApiMode()) return null;
  return mappaAntincendio(await prendi(`${base(aziendaId)}/antincendio`));
}

export const anti = {
  presidio: (aid: number, d: Record<string, unknown>) => manda(`${base(aid)}/antincendio/presidi`, d),
  sorveglianza: async (aid: number, d: { sede: string | null; risposte: Array<{ presidio_id: number; ok: boolean; nota?: string }> }) =>
    testo(dati(await manda(`${base(aid)}/antincendio/sorveglianza`, d)).nota) ?? 'Sorveglianza registrata.',
  segnala: async (aid: number, d: { presidio_id: number; motivo: string; dettagli?: string }) => testo(dati(await manda(`${base(aid)}/antincendio/segnalazioni`, d)).nota) ?? 'Segnalato.',
  riparato: (id: number) => manda(`/portale/area/presidi/${id}/riparato`),
  semestrale: (aid: number, d: { data: string; chi?: string; sede?: string | null }) => manda(`${base(aid)}/antincendio/semestrale`, d),
  prova: async (aid: number, d: Record<string, unknown>) => testo(dati(await manda(`${base(aid)}/antincendio/prove`, d)).nota) ?? 'Prova registrata.',
  manutentore: (aid: number, d: { ditta: string; telefono: string; contratto?: string }) => manda(`${base(aid)}/antincendio/manutentore`, d, 'PUT'),
};
