/**
 * Area azienda, operativita' delle persone (Portale HSE, squadra S4): Home e
 * Dashboard, "Da fare adesso", prenotazione diretta delle visite, iscrizione
 * ai corsi, corso fuori catalogo, Excel, promemoria dello scadenziario,
 * rischio e visita calcolati nel modulo del nuovo assunto, regolarizzazione,
 * elenchi da piu' file. I permessi li controlla il server: qui solo i dati.
 * I mappatori sono tolleranti: un campo strano non rompe la vista.
 */

import { apiUpload } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';
import { scarica } from './area-api';

const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';
const base = (id: number) => `/portale/aziende/${id}/area`;
const dati = (r: unknown) => rec(rec(r).data);
const conSede = (path: string, sede?: number | null) => (sede ? `${path}${path.includes('?') ? '&' : '?'}sede=${sede}` : path);

// ---------------------------------------------------------------- da fare adesso

export interface AzioneDaFare {
  tipo: string;
  [k: string]: unknown;
}

export interface VoceDaFare {
  chiave: string;
  categoria: string;
  testo: string;
  nota: string | null;
  pulsante: string;
  /** Rotta dell'app senza prefisso, es. "persone/elenco/12". */
  link: string | null;
  azione: AzioneDaFare | null;
  urg: number;
}

export function mappaVoceDaFare(raw: unknown): VoceDaFare | null {
  const r = rec(raw);
  const t = testo(r.testo);
  if (!t) return null;
  const a = rec(r.azione);
  return {
    chiave: testo(r.chiave) ?? t,
    categoria: testo(r.categoria) ?? 'scadenze',
    testo: t,
    nota: testo(r.nota),
    pulsante: testo(r.pulsante) ?? 'Apri',
    link: testo(r.link),
    azione: testo(a.tipo) ? ({ ...a, tipo: testo(a.tipo)! } as AzioneDaFare) : null,
    urg: numero(r.urg) ?? 3,
  };
}

/** Href dell'area azienda per una voce o una scadenza: la prima parte e' la sezione, il resto va in ?vista. */
export function hrefArea(link: string | null): string {
  if (!link) return '/azienda/dashboard/';
  const [sezione, ...resto] = link.split('/').filter(Boolean);
  return `/azienda/${sezione}/${resto.length ? `?vista=${encodeURIComponent(resto.join('/'))}` : ''}`;
}

// ---------------------------------------------------------------- home e dashboard

export interface ScadenzaBreve {
  chiave: string;
  categoria: string;
  titolo: string;
  sotto: string;
  data: string | null;
  giorni: number | null;
  fase: 'scaduta' | 'da_prenotare' | 'prenotata';
  stato: string;
  allarme: boolean;
  link: string | null;
  azione: string;
  lavoratoreId: number | null;
  corso: string | null;
  scadenzaId: number | null;
}

export function mappaScadenzaBreve(raw: unknown): ScadenzaBreve | null {
  const r = rec(raw);
  const titolo = testo(r.titolo);
  if (!titolo) return null;
  const fase = (['scaduta', 'da_prenotare', 'prenotata'] as const).find((f) => f === r.fase) ?? 'da_prenotare';
  return {
    chiave: testo(r.chiave) ?? titolo,
    categoria: testo(r.categoria) ?? 'altro',
    titolo,
    sotto: testo(r.sotto) ?? '',
    data: testo(r.data),
    giorni: numero(r.giorni),
    fase,
    stato: testo(r.stato) ?? 'todo',
    allarme: bool(r.allarme),
    link: testo(r.link),
    azione: testo(r.azione) ?? 'vedi',
    lavoratoreId: numero(r.lavoratore_id),
    corso: testo(r.corso),
    scadenzaId: numero(r.scadenza_id),
  };
}

export interface HomeAzienda {
  servizio: { etichetta: string | null; attivo: boolean; rinnovoIl: string | null };
  sede: string | null;
  avvio: { pronti: number; totale: number; daCaricare: number } | null;
  daFare: VoceDaFare[];
  indicatori: {
    scadenze30: { totale: number; scadute: number; maiFatte: number; prenotate: number };
    copertura: { percentuale: number | null; ok: number; totale: number };
    visite: { ok: number; totale: number; inCalendario: number };
    fascicolo: { percentuale: number | null; manca: string[] };
  };
  prossimeScadenze: ScadenzaBreve[];
  prontoIspezioni: boolean;
  denunciaInfortunio: boolean;
  azioniRapide: Array<{ k: 'assumi' | 'prenota' | 'iscrivi' | 'richiedi'; testo: string }>;
  referente: { nome: string; ruolo: string; iniziali: string; telefono: string | null } | null;
  sedi: Array<{ id: number; nome: string; insegna: string | null; indirizzo: string | null; lavoratori: number; daFare: number; formazione: number | null; scadenzeSuperate: number }>;
}

export function mappaHome(raw: unknown): HomeAzienda {
  const d = dati(raw);
  const s = rec(d.servizio);
  const av = d.avvio ? rec(d.avvio) : null;
  const ind = rec(d.indicatori);
  const sc = rec(ind.scadenze_30);
  const co = rec(ind.copertura);
  const vi = rec(ind.visite);
  const fa = rec(ind.fascicolo);
  const re = d.referente ? rec(d.referente) : null;
  return {
    servizio: { etichetta: testo(s.etichetta), attivo: bool(s.attivo), rinnovoIl: testo(s.rinnovo_il) },
    sede: testo(d.sede),
    avvio: av ? { pronti: numero(av.pronti) ?? 0, totale: numero(av.totale) ?? 0, daCaricare: numero(av.da_caricare) ?? 0 } : null,
    daFare: lista(d.da_fare).map(mappaVoceDaFare).filter((x): x is VoceDaFare => x !== null),
    indicatori: {
      scadenze30: { totale: numero(sc.totale) ?? 0, scadute: numero(sc.scadute) ?? 0, maiFatte: numero(sc.mai_fatte) ?? 0, prenotate: numero(sc.prenotate) ?? 0 },
      copertura: { percentuale: numero(co.percentuale), ok: numero(co.ok) ?? 0, totale: numero(co.totale) ?? 0 },
      visite: { ok: numero(vi.ok) ?? 0, totale: numero(vi.totale) ?? 0, inCalendario: numero(vi.in_calendario) ?? 0 },
      fascicolo: { percentuale: numero(fa.percentuale), manca: lista(fa.manca).map(String) },
    },
    prossimeScadenze: lista(d.prossime_scadenze).map(mappaScadenzaBreve).filter((x): x is ScadenzaBreve => x !== null),
    prontoIspezioni: bool(d.pronto_ispezioni),
    denunciaInfortunio: bool(d.denuncia_infortunio),
    azioniRapide: lista(d.azioni_rapide)
      .map((x) => rec(x))
      .filter((x) => ['assumi', 'prenota', 'iscrivi', 'richiedi'].includes(String(x.k)))
      .map((x) => ({ k: x.k as 'assumi', testo: testo(x.testo) ?? '' })),
    referente: re && testo(re.nome) ? { nome: testo(re.nome)!, ruolo: testo(re.ruolo) ?? '', iniziali: testo(re.iniziali) ?? '', telefono: testo(re.telefono) } : null,
    sedi: lista(d.sedi).map((x) => {
      const r = rec(x);
      return {
        id: numero(r.id) ?? 0,
        nome: testo(r.nome) ?? '',
        insegna: testo(r.insegna),
        indirizzo: testo(r.indirizzo),
        lavoratori: numero(r.lavoratori) ?? 0,
        daFare: numero(r.da_fare) ?? 0,
        formazione: numero(r.formazione),
        scadenzeSuperate: numero(r.scadenze_superate) ?? 0,
      };
    }),
  };
}

export async function home(aziendaId: number, sede?: number | null): Promise<HomeAzienda | null> {
  if (!isApiMode()) return null;
  return mappaHome(await prendi(conSede(`${base(aziendaId)}/home`, sede)));
}

// ---------------------------------------------------------------- visite: prenotazione diretta

export interface Disponibilita {
  centri: Array<{ nome: string; indirizzo: string | null }>;
  orari: string[];
  tipi: Record<string, string>;
}

export async function disponibilitaVisite(aziendaId: number): Promise<Disponibilita> {
  const d = dati(await prendi(`${base(aziendaId)}/visite/disponibilita`));
  const t = rec(d.tipi);
  return {
    centri: lista(d.centri).map((x) => ({ nome: testo(rec(x).nome) ?? '', indirizzo: testo(rec(x).indirizzo) })).filter((x) => x.nome),
    orari: lista(d.orari).map(String),
    tipi: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, String(v)])),
  };
}

export async function prenotaVisita(aziendaId: number, d: { lavoratore_id: number; quando: string; centro?: string | null; tipo_visita?: string | null }): Promise<{ titolo: string; testo: string }> {
  const r = dati(await manda(`${base(aziendaId)}/visite/prenota`, d));
  return { titolo: testo(r.titolo) ?? 'Visita prenotata', testo: testo(r.testo) ?? '' };
}

// ---------------------------------------------------------------- formazione

export async function iscriviCorso(aziendaId: number, d: { corso: string; classe_id?: number | null; lavoratori: number[] }): Promise<{ titolo: string; testo: string }> {
  const r = dati(await manda(`${base(aziendaId)}/formazione/iscrivi`, d));
  return { titolo: testo(r.titolo) ?? '', testo: testo(r.testo) ?? '' };
}

export interface RispostaCorso {
  aCatalogo: boolean;
  codice: string | null;
  nome: string | null;
  aPagamento: boolean;
  prezzo: number | null;
  testo: string;
  nota: string | null;
}

export async function chiediCorso(aziendaId: number, testoCorso: string): Promise<RispostaCorso> {
  const r = dati(await manda(`${base(aziendaId)}/formazione/chiedi`, { testo: testoCorso }));
  return {
    aCatalogo: bool(r.a_catalogo),
    codice: testo(r.codice),
    nome: testo(r.nome),
    aPagamento: bool(r.a_pagamento),
    prezzo: numero(r.prezzo),
    testo: testo(r.testo) ?? '',
    nota: testo(r.nota),
  };
}

export async function scaricaExcelFormazione(aziendaId: number, azienda: string, sede?: number | null): Promise<string> {
  const nome = `Formazione · ${azienda}.xlsx`;
  await scarica(conSede(`${base(aziendaId)}/formazione/excel`, sede), nome);
  return `${nome} scaricato · si apre con Excel`;
}

// ---------------------------------------------------------------- scadenziario: promemoria

export interface Promemoria {
  anticipi: number[];
  allarme: boolean;
  canali: string[];
  destinatari: string[];
  nomi: { titolare: string | null; referente: string | null };
  nota: string | null;
}

export function mappaPromemoria(raw: unknown): Promemoria {
  const r = rec(raw);
  const n = rec(r.nomi);
  return {
    anticipi: lista(r.anticipi).map((x) => Number(x)).filter((x) => [90, 60, 30].includes(x)),
    allarme: bool(r.allarme),
    canali: lista(r.canali).map(String),
    destinatari: lista(r.destinatari).map(String),
    nomi: { titolare: testo(n.titolare), referente: testo(n.referente) },
    nota: testo(r.nota),
  };
}

/** Controlli del foglio (05 par. 8.4), uguali a quelli del server. */
export function erroriPromemoria(p: Pick<Promemoria, 'canali' | 'destinatari'>): { canali?: string; destinatari?: string } {
  return {
    ...(p.canali.length === 0 ? { canali: 'Scegli almeno un canale, altrimenti non ricevi nessun avviso.' } : {}),
    ...(p.destinatari.length === 0 ? { destinatari: 'Scegli almeno una persona che riceve i promemoria.' } : {}),
  };
}

export async function salvaPromemoria(aziendaId: number, p: Pick<Promemoria, 'anticipi' | 'allarme' | 'canali' | 'destinatari'>): Promise<Promemoria> {
  return mappaPromemoria(dati(await manda(`${base(aziendaId)}/scadenze/promemoria`, p, 'PUT')));
}

/** Link del calendario personale (iCal): si incolla in Google, Outlook o Apple. */
export async function linkCalendario(): Promise<string> {
  const r = dati(await manda('/calendario/feed', { ambito: 'personale' }));
  const url = testo(r.url) ?? testo(r.link) ?? testo(r.webcal);
  if (!url) throw new Error('Link del calendario non disponibile.');
  return url;
}

// ---------------------------------------------------------------- dipendenti

export interface Valutazione {
  rischio: string;
  motivoRischio: string;
  visita: boolean;
  daCalcolare: boolean;
  motivo: string;
  domande: Array<{ chiave: string; testo: string; risposta: boolean }>;
  quota: number | null;
  quote: { senzaVisita: Record<string, number>; conVisita: Record<string, number> };
}

export function mappaValutazione(raw: unknown): Valutazione {
  const d = dati(raw);
  const q = rec(d.quote);
  const tab = (x: unknown) => Object.fromEntries(Object.entries(rec(x)).map(([k, v]) => [k, Number(v)]));
  return {
    rischio: testo(d.rischio) ?? 'medio',
    motivoRischio: testo(d.motivo_rischio) ?? '',
    visita: bool(d.visita),
    daCalcolare: bool(d.da_calcolare),
    motivo: testo(d.motivo) ?? '',
    domande: lista(d.domande).map((x) => ({ chiave: testo(rec(x).chiave) ?? '', testo: testo(rec(x).testo) ?? '', risposta: bool(rec(x).risposta) })).filter((x) => x.chiave),
    quota: numero(d.quota),
    quote: { senzaVisita: tab(q.senza_visita), conVisita: tab(q.con_visita) },
  };
}

export async function valutaAssunto(aziendaId: number, d: { mansione: string; reparto: string | null; risposte: Record<string, boolean> }): Promise<Valutazione> {
  return mappaValutazione(await manda(`${base(aziendaId)}/persone/valuta`, d));
}

export async function regolarizza(aziendaId: number, lavoratoreId: number): Promise<{ quotaId: number; importo: number; messaggio: string }> {
  const r = dati(await manda(`${base(aziendaId)}/persone/${lavoratoreId}/regolarizza`));
  return { quotaId: numero(r.quota_id) ?? 0, importo: numero(r.importo) ?? 0, messaggio: testo(r.messaggio) ?? '' };
}

export interface PropostaElenco {
  nome: string;
  cognome: string;
  mansione: string;
  reparto: string | null;
  cellulare: string | null;
  rischio: string;
  visita: boolean;
}

export async function leggiElenchi(aziendaId: number, files: File[]): Promise<{ proposte: PropostaElenco[]; bloccati: string[]; nonLetti: string[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append('file[]', f));
  try {
    const d = dati(await apiUpload(`${base(aziendaId)}/persone/elenco/leggi`, fd));
    return {
      proposte: lista(d.proposte).map((x) => {
        const r = rec(x);
        return { nome: testo(r.nome) ?? '', cognome: testo(r.cognome) ?? '', mansione: testo(r.mansione) ?? '', reparto: testo(r.reparto), cellulare: testo(r.cellulare), rischio: testo(r.rischio) ?? 'medio', visita: bool(r.visita) };
      }),
      bloccati: lista(d.bloccati).map(String),
      nonLetti: lista(d.non_letti).map(String),
    };
  } catch (e) {
    throw erroreLeggibile(e, 'Non sono riuscito a leggere il file.');
  }
}

export async function aggiungiDaElenco(aziendaId: number, lavoratori: PropostaElenco[]): Promise<{ aggiunti: number; titolo: string; testo: string; errori: Array<{ nome: string; errore: string }> }> {
  const r = dati(await manda(`${base(aziendaId)}/persone/elenco/aggiungi`, { lavoratori }));
  return {
    aggiunti: numero(r.aggiunti) ?? 0,
    titolo: testo(r.titolo) ?? '',
    testo: testo(r.testo) ?? '',
    errori: lista(r.errori).map((x) => ({ nome: testo(rec(x).nome) ?? '', errore: testo(rec(x).errore) ?? '' })),
  };
}
