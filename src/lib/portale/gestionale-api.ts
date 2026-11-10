/**
 * Chiamate del gestionale dello studio (ADR-009, V2): coda di lavoro, aziende,
 * avvio dei clienti, cruscotto. Ogni risposta passa da un mappatore tollerante;
 * senza backend (demo) le chiamate tornano vuote.
 */

import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';

// ---------------------------------------------------------------- coda di lavoro

export type FiltroCoda = 'tutto' | 'mie' | 'oggi' | 'in_ritardo' | 'fatto_oggi' | 'proposte' | 'allarmi' | 'compiti';
export const FILTRI_CODA: FiltroCoda[] = ['tutto', 'mie', 'oggi', 'in_ritardo', 'fatto_oggi', 'proposte', 'allarmi', 'compiti'];

export type TipoElemento = 'proposta' | 'allarme' | 'compito';

export interface PersonaStudio {
  id: number;
  nome: string;
  ruolo: string;
}

export interface ElementoCoda {
  chiave: string;
  tipo: TipoElemento;
  id: number;
  sottotipo: string | null;
  /** Oggetto da cui nasce la voce (es. id della richiesta di accesso). */
  fonteId?: number | null;
  titolo: string;
  dettaglio: string | null;
  azienda: { id: number; nome: string } | null;
  agente: string | null;
  livello: number | null;
  termine: string | null;
  gravita: 'danger' | 'warn' | null;
  assegnato: PersonaStudio | null;
  stato: 'aperto' | 'in_carico' | 'fatto';
  esito: 'approvata' | 'corretta' | 'respinta' | 'errore' | 'fatto' | 'risolto_da_solo' | null;
  payload: Record<string, unknown> | null;
  fonte: string | null;
  certezza: number | null;
  origine: string | null;
  creato: string | null;
  chiuso: string | null;
  decisoDa: PersonaStudio | null;
  nota: string | null;
  motivoRifiuto: string | null;
  puoDecidere: boolean;
  blocco: string | null;
  sezione: string | null;
  correggibile: boolean;
}

export interface AzioneLivello1 {
  chiave: string;
  assistente: string;
  cosa: string;
  numero: number;
  rivisti: number;
  daCorreggere: number;
}

export interface VistaCoda {
  filtro: FiltroCoda;
  conteggi: Record<FiltroCoda, number>;
  elementi: ElementoCoda[];
  assistenti: Array<{ nome: string; proposte: number }>;
  tessere: {
    proposte: { numero: number; oltreTermine: number };
    allarmi: { numero: number; gravi: number; miei: number };
    scadenze: { numero: number; aziende: number };
    avvii: { numero: number; fermi: Array<{ azienda: { id: number; nome: string } | null; termine: string | null }> };
  };
  compitiOggi: { totale: number; fatti: number };
  deciseOggi: ElementoCoda[];
  livello1: AzioneLivello1[];
  persone: PersonaStudio[];
  puoCampione: boolean;
}

const persona = (v: unknown): PersonaStudio | null => {
  const r = rec(v);
  const id = numero(r.id);
  return id === null ? null : { id, nome: testo(r.nome) ?? '', ruolo: testo(r.ruolo) ?? '' };
};
const aziendaBreve = (v: unknown): { id: number; nome: string } | null => {
  const r = rec(v);
  const id = numero(r.id);
  return id === null ? null : { id, nome: testo(r.nome) ?? '' };
};

const ESITI = ['approvata', 'corretta', 'respinta', 'errore', 'fatto', 'risolto_da_solo'] as const;

export function mappaElemento(raw: unknown): ElementoCoda | null {
  const r = rec(raw);
  const chiave = testo(r.chiave);
  const id = numero(r.id);
  const tipo = r.tipo === 'proposta' || r.tipo === 'allarme' || r.tipo === 'compito' ? r.tipo : null;
  if (!chiave || id === null || !tipo) return null;
  const esito = ESITI.find((e) => e === r.esito) ?? null;
  return {
    chiave,
    tipo,
    id,
    sottotipo: testo(r.sottotipo),
    fonteId: numero(r.fonte_id),
    titolo: testo(r.titolo) ?? 'Senza titolo',
    dettaglio: testo(r.dettaglio),
    azienda: aziendaBreve(r.azienda),
    agente: testo(r.agente),
    livello: numero(r.livello),
    termine: testo(r.termine_il),
    gravita: r.gravita === 'danger' || r.gravita === 'warn' ? r.gravita : null,
    assegnato: persona(r.assegnato),
    stato: r.stato === 'fatto' ? 'fatto' : r.stato === 'in_carico' ? 'in_carico' : 'aperto',
    esito,
    payload: r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload) ? (r.payload as Record<string, unknown>) : null,
    fonte: testo(r.fonte),
    certezza: numero(r.certezza),
    origine: testo(r.origine),
    creato: testo(r.creato_il),
    chiuso: testo(r.chiuso_il),
    decisoDa: persona(r.deciso_da),
    nota: testo(r.nota),
    motivoRifiuto: testo(r.motivo_rifiuto_testo) ?? testo(r.motivo_rifiuto),
    puoDecidere: r.puo_decidere === true,
    blocco: testo(r.blocco),
    sezione: testo(r.sezione),
    correggibile: r.correggibile === true,
  };
}

const elementi = (v: unknown): ElementoCoda[] => lista(v).map(mappaElemento).filter((x): x is ElementoCoda => x !== null);

export function mappaVistaCoda(raw: unknown): VistaCoda {
  const d = rec(raw);
  const c = rec(d.conteggi);
  const t = rec(d.tessere);
  const tp = rec(t.proposte);
  const ta = rec(t.allarmi);
  const ts = rec(t.scadenze);
  const tv = rec(t.avvii);
  const co = rec(d.compiti_oggi);
  const conteggi = {} as Record<FiltroCoda, number>;
  for (const f of FILTRI_CODA) conteggi[f] = numero(c[f]) ?? 0;
  return {
    filtro: (FILTRI_CODA as string[]).includes(String(d.filtro)) ? (d.filtro as FiltroCoda) : 'tutto',
    conteggi,
    elementi: elementi(d.elementi),
    assistenti: lista(d.assistenti)
      .map((x) => ({ nome: testo(rec(x).nome) ?? '', proposte: numero(rec(x).proposte) ?? 0 }))
      .filter((x) => x.nome !== ''),
    tessere: {
      proposte: { numero: numero(tp.numero) ?? 0, oltreTermine: numero(tp.oltre_termine) ?? 0 },
      allarmi: { numero: numero(ta.numero) ?? 0, gravi: numero(ta.gravi) ?? 0, miei: numero(ta.miei) ?? 0 },
      scadenze: { numero: numero(ts.numero) ?? 0, aziende: numero(ts.aziende) ?? 0 },
      avvii: { numero: numero(tv.numero) ?? 0, fermi: lista(tv.fermi).map((x) => ({ azienda: aziendaBreve(rec(x).azienda), termine: testo(rec(x).termine_il) })) },
    },
    compitiOggi: { totale: numero(co.totale) ?? 0, fatti: numero(co.fatti) ?? 0 },
    deciseOggi: elementi(d.decise_oggi),
    livello1: lista(d.livello_1).map((x) => {
      const a = rec(x);
      return {
        chiave: testo(a.chiave) ?? '',
        assistente: testo(a.assistente) ?? '',
        cosa: testo(a.cosa) ?? '',
        numero: numero(a.numero) ?? 0,
        rivisti: numero(a.rivisti) ?? 0,
        daCorreggere: numero(a.da_correggere) ?? 0,
      };
    }),
    persone: lista(d.persone).map(persona).filter((x): x is PersonaStudio => x !== null),
    puoCampione: d.puo_campione === true,
  };
}

const VUOTA: VistaCoda = mappaVistaCoda({});

export async function caricaCoda(f: { filtro?: FiltroCoda; aziendaId?: number | null; assistente?: string | null } = {}): Promise<VistaCoda> {
  if (!isApiMode()) return VUOTA;
  const q = new URLSearchParams();
  if (f.filtro && f.filtro !== 'tutto') q.set('filtro', f.filtro);
  if (f.aziendaId) q.set('azienda_id', String(f.aziendaId));
  if (f.assistente) q.set('assistente', f.assistente);
  return mappaVistaCoda(rec(await prendi(`/gestionale/coda${q.toString() ? `?${q}` : ''}`)).data);
}

export async function elementoCoda(chiave: string): Promise<ElementoCoda | null> {
  if (!isApiMode()) return null;
  return mappaElemento(rec(await prendi(`/gestionale/coda/${encodeURIComponent(chiave)}`)).data);
}

export type MotivoRifiuto = 'dati_sbagliati' | 'non_ora' | 'a_mano' | 'persona_sbagliata' | 'altro';
export const MOTIVI_RIFIUTO: Array<{ k: MotivoRifiuto; t: string }> = [
  { k: 'dati_sbagliati', t: 'Dati sbagliati' },
  { k: 'non_ora', t: 'Non è il momento' },
  { k: 'a_mano', t: 'Lo faccio io a mano' },
  { k: 'persona_sbagliata', t: 'Azienda o persona sbagliata' },
  { k: 'altro', t: 'Altro' },
];

export async function decidiProposta(
  id: number,
  d: { decisione: 'approva' | 'correggi' | 'respingi'; nota?: string; payload?: Record<string, unknown>; motivo?: MotivoRifiuto }
): Promise<ElementoCoda | null> {
  return mappaElemento(rec(rec(await manda(`/gestionale/coda/proposte/${id}/decisione`, d)).data).elemento);
}

export async function assegnaElemento(chiave: string, personaId: number | null, nota?: string): Promise<ElementoCoda | null> {
  return mappaElemento(rec(await manda(`/gestionale/coda/${encodeURIComponent(chiave)}/assegna`, { persona_id: personaId, nota })).data);
}

export async function statoVoce(id: number, azione: 'prendi' | 'fatto' | 'riapri', nota?: string): Promise<ElementoCoda | null> {
  return mappaElemento(rec(await manda(`/gestionale/coda/voci/${id}/stato`, { azione, nota })).data);
}

/** Iscrizione di un'azienda che ha scelto lo studio: la decide il titolare dello studio. */
export async function accettaIscrizione(aziendaId: number): Promise<void> {
  await manda(`/gestionale/iscrizioni/${aziendaId}/accetta`);
}

export async function rifiutaIscrizione(aziendaId: number, motivo?: string): Promise<void> {
  await manda(`/gestionale/iscrizioni/${aziendaId}/rifiuta`, { motivo: motivo || undefined });
}

/** Richieste di accesso: ruoli che il titolare puo' dare e aziende per i ruoli sull'azienda. */
export interface ScelteAccesso {
  ruoli: Array<{ k: string; t: string; azienda: boolean }>;
  aziende: Array<{ id: number; nome: string }>;
}

export async function scelteAccesso(): Promise<ScelteAccesso> {
  const d = rec(rec(await prendi('/gestionale/richieste-accesso')).data);
  return {
    ruoli: lista(d.ruoli).flatMap((x) => {
      const r = rec(x);
      const k = testo(r.k);
      return k ? [{ k, t: testo(r.t) ?? k, azienda: r.azienda === true }] : [];
    }),
    aziende: lista(d.aziende).flatMap((x) => {
      const r = rec(x);
      const id = numero(r.id);
      return id === null ? [] : [{ id, nome: testo(r.nome) ?? '' }];
    }),
  };
}

export async function approvaAccesso(id: number, ruolo: string, companyId?: number | null): Promise<void> {
  await manda(`/gestionale/richieste-accesso/${id}/approva`, { ruolo, company_id: companyId ?? undefined });
}

export async function rifiutaAccesso(id: number, motivo?: string): Promise<void> {
  await manda(`/gestionale/richieste-accesso/${id}/rifiuta`, { motivo: motivo || undefined });
}

export async function nuovoCompito(d: { titolo: string; dettaglio?: string; azienda_id?: number | null; scade_il?: string | null; assegnato_a?: number | null }): Promise<ElementoCoda | null> {
  return mappaElemento(rec(await manda('/gestionale/coda/compiti', d)).data);
}

export interface AzioneCampione {
  oggettoTipo: 'documento' | 'promemoria';
  oggettoId: number;
  assistente: string;
  azienda: { id: number; nome: string } | null;
  testo: string;
  estratto: string | null;
}

export async function caricaCampione(): Promise<AzioneCampione[]> {
  if (!isApiMode()) return [];
  return lista(rec(rec(await prendi('/gestionale/coda/campione')).data).azioni)
    .map((x) => {
      const a = rec(x);
      const id = numero(a.oggetto_id);
      const tipo = a.oggetto_tipo === 'documento' || a.oggetto_tipo === 'promemoria' ? a.oggetto_tipo : null;
      return id === null || !tipo
        ? null
        : { oggettoTipo: tipo, oggettoId: id, assistente: testo(a.assistente) ?? '', azienda: aziendaBreve(a.azienda), testo: testo(a.testo) ?? '', estratto: testo(a.estratto) };
    })
    .filter((x): x is AzioneCampione => x !== null);
}

export async function salvaCampione(esiti: Array<{ oggetto_tipo: string; oggetto_id: number; esito: 'corretta' | 'da_correggere'; nota?: string }>): Promise<{ corrette: number; daCorreggere: number }> {
  const d = rec(rec(await manda('/gestionale/coda/campione', { esiti })).data);
  return { corrette: numero(d.corrette) ?? 0, daCorreggere: numero(d.da_correggere) ?? 0 };
}

// ---------------------------------------------------------------- aziende

export interface RigaAzienda {
  id: number;
  ragione_sociale: string;
  partita_iva: string;
  ateco: string;
  ateco_label: string;
  comune: string;
  lavoratori: number;
  tecnico: { id: number; nome: string } | null;
  stato: 'scaduto' | 'aggiornare' | 'ok';
  motivo: string;
  fase: 'avvio' | 'attiva' | 'nuova';
  scadute: number;
  entro30: number;
  dvr: { id: number; versione: number; stato: string } | null;
  safetyScore: number | null;
  codaAperte: number;
  /** 2.1: stato dell'azienda, sedi, rischio, completezza del fascicolo, fonte; canone solo con vediContratti. */
  statoAzienda?: string;
  sedi?: number;
  rischio?: string | null;
  completezza?: number;
  fonte?: string;
  canone?: number | null;
  aggiornata?: string | null;
}

export interface ElencoAziende {
  aziende: RigaAzienda[];
  totali: { aziende: number; lavoratori: number; inAvvio: number };
  tecnici: PersonaStudio[];
  puoCambiareTecnico: boolean;
}

export function mappaRigaAzienda(raw: unknown): RigaAzienda | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const d = rec(r.dvr);
  const tec = rec(r.tecnico);
  return {
    id,
    ragione_sociale: testo(r.ragione_sociale) ?? '',
    partita_iva: testo(r.partita_iva) ?? '',
    ateco: testo(r.ateco) ?? '',
    ateco_label: testo(r.ateco_label) ?? '',
    comune: testo(r.comune) ?? '',
    lavoratori: numero(r.lavoratori) ?? 0,
    tecnico: numero(tec.id) !== null ? { id: numero(tec.id)!, nome: testo(tec.nome) ?? '' } : null,
    stato: r.stato === 'scaduto' || r.stato === 'ok' ? r.stato : 'aggiornare',
    motivo: testo(r.motivo) ?? '',
    fase: r.fase === 'avvio' || r.fase === 'nuova' ? r.fase : 'attiva',
    scadute: numero(r.scadute) ?? 0,
    entro30: numero(r.entro_30) ?? 0,
    dvr: numero(d.id) !== null ? { id: numero(d.id)!, versione: numero(d.versione) ?? 0, stato: testo(d.stato) ?? '' } : null,
    safetyScore: numero(r.safety_score),
    codaAperte: numero(r.coda_aperte) ?? 0,
    statoAzienda: testo(r.stato_azienda) ?? 'attiva',
    sedi: numero(r.sedi) ?? 1,
    rischio: testo(r.rischio),
    completezza: numero(r.completezza) ?? 0,
    fonte: testo(r.fonte) ?? 'Diretta',
    ...('canone' in r ? { canone: numero(r.canone) } : {}),
    aggiornata: testo(r.aggiornata_il),
  };
}

export async function caricaAziende(): Promise<ElencoAziende> {
  if (!isApiMode()) return { aziende: [], totali: { aziende: 0, lavoratori: 0, inAvvio: 0 }, tecnici: [], puoCambiareTecnico: false };
  const d = rec(rec(await prendi('/gestionale/aziende')).data);
  const t = rec(d.totali);
  return {
    aziende: lista(d.aziende).map(mappaRigaAzienda).filter((x): x is RigaAzienda => x !== null),
    totali: { aziende: numero(t.aziende) ?? 0, lavoratori: numero(t.lavoratori) ?? 0, inAvvio: numero(t.in_avvio) ?? 0 },
    tecnici: lista(d.tecnici).map(persona).filter((x): x is PersonaStudio => x !== null),
    puoCambiareTecnico: d.puo_cambiare_tecnico === true,
  };
}

/** Scheda a 360 gradi: i blocchi restano oggetti del backend letti con rec/lista dalla vista. */
export async function caricaScheda(id: number): Promise<Record<string, unknown> | null> {
  if (!isApiMode()) return null;
  return rec(rec(await prendi(`/gestionale/aziende/${id}`)).data);
}

export async function cambiaTecnico(aziendaId: number, tecnicoId: number | null): Promise<void> {
  await manda(`/gestionale/aziende/${aziendaId}/tecnico`, { tecnico_id: tecnicoId });
}

export async function safetyScore(aziendaId: number): Promise<{ totale: number | null; livello: string | null } | null> {
  if (!isApiMode()) return null;
  const d = rec(rec(await prendi(`/companies/${aziendaId}/control-room`)).data);
  return { totale: numero(d.totale), livello: testo(d.livello) };
}

// ---------------------------------------------------------------- avvio dei clienti

export interface TitolarePortale {
  stato: 'attivo' | 'invitato' | 'mancante';
  nome: string | null;
  email: string | null;
  invitoScade: string | null;
}

export interface PraticaAvvio {
  azienda: { id: number; nome: string };
  tecnico: PersonaStudio | null;
  pagatoIl: string | null;
  fascicoloEntro: string | null;
  oreDalPagamento: number | null;
  inRitardo: boolean;
  passi: Array<{ numero: number; nome: string; stato: string }>;
  passiFatti: number;
  passiTotali: number;
  documenti: number;
  letti: number;
  sanitariBloccati: number;
  daConfermare: number;
  mancantiEssenziali: number;
  pronta: boolean;
  titolare: TitolarePortale;
}

export interface AvvioCompletato {
  azienda: { id: number; nome: string };
  pagatoIl: string | null;
  validataIl: string | null;
  ore: number | null;
  neiTempi: boolean;
  tecnico: PersonaStudio | null;
}

export interface VistaAvvio {
  aperte: PraticaAvvio[];
  completate: AvvioCompletato[];
  kpi: { aperte: number; senzaPagamento: number; oltre48: number; datiDaConfermare: number; tempoMedioOre: number | null; entro48Pct: number | null; baseMedia: number };
  oreObiettivo: number;
}

export function mappaTitolare(v: unknown): TitolarePortale {
  const t = rec(v);
  return {
    stato: t.stato === 'attivo' || t.stato === 'invitato' ? t.stato : 'mancante',
    nome: testo(t.nome),
    email: testo(t.email),
    invitoScade: testo(t.invito_scade_il),
  };
}

export function mappaPratica(raw: unknown): PraticaAvvio | null {
  const r = rec(raw);
  const az = aziendaBreve(r.azienda);
  if (!az) return null;
  return {
    azienda: az,
    tecnico: persona(r.tecnico),
    pagatoIl: testo(r.pagato_il),
    fascicoloEntro: testo(r.fascicolo_entro),
    oreDalPagamento: numero(r.ore_dal_pagamento),
    inRitardo: r.in_ritardo === true,
    passi: lista(r.passi).map((x) => ({ numero: numero(rec(x).numero) ?? 0, nome: testo(rec(x).nome) ?? '', stato: testo(rec(x).stato) ?? 'da_fare' })),
    passiFatti: numero(r.passi_fatti) ?? 0,
    passiTotali: numero(r.passi_totali) ?? 5,
    documenti: numero(r.documenti) ?? 0,
    letti: numero(r.letti) ?? 0,
    sanitariBloccati: numero(r.sanitari_bloccati) ?? 0,
    daConfermare: numero(r.da_confermare) ?? 0,
    mancantiEssenziali: numero(r.mancanti_essenziali) ?? 0,
    pronta: r.pronta === true,
    titolare: mappaTitolare(r.titolare),
  };
}

export async function caricaAvvii(): Promise<VistaAvvio> {
  const vuota: VistaAvvio = { aperte: [], completate: [], kpi: { aperte: 0, senzaPagamento: 0, oltre48: 0, datiDaConfermare: 0, tempoMedioOre: null, entro48Pct: null, baseMedia: 0 }, oreObiettivo: 48 };
  if (!isApiMode()) return vuota;
  const d = rec(rec(await prendi('/gestionale/avvio')).data);
  const k = rec(d.kpi);
  return {
    aperte: lista(d.aperte).map(mappaPratica).filter((x): x is PraticaAvvio => x !== null),
    completate: lista(d.completate)
      .map((x) => {
        const r = rec(x);
        const az = aziendaBreve(r.azienda);
        return az
          ? { azienda: az, pagatoIl: testo(r.pagato_il), validataIl: testo(r.validata_il), ore: numero(r.ore), neiTempi: r.nei_tempi !== false, tecnico: persona(r.tecnico) }
          : null;
      })
      .filter((x): x is AvvioCompletato => x !== null),
    kpi: {
      aperte: numero(k.aperte) ?? 0,
      senzaPagamento: numero(k.senza_pagamento) ?? 0,
      oltre48: numero(k.oltre_48_ore) ?? 0,
      datiDaConfermare: numero(k.dati_da_confermare) ?? 0,
      tempoMedioOre: numero(k.tempo_medio_ore),
      entro48Pct: numero(k.entro_48_pct),
      baseMedia: numero(k.base_media) ?? 0,
    },
    oreObiettivo: numero(d.ore_obiettivo) ?? 48,
  };
}

/** Scheda di avvio di un'azienda (passi di SchedaAvvio piu' titolare e fase). */
export async function caricaPratica(id: number): Promise<Record<string, unknown> | null> {
  if (!isApiMode()) return null;
  return rec(rec(await prendi(`/gestionale/avvio/${id}`)).data);
}

export async function iniziaAvvio(id: number, tecnicoId?: number | null): Promise<void> {
  await manda(`/gestionale/avvio/${id}/inizia`, tecnicoId ? { tecnico_id: tecnicoId } : {});
}

export async function invitaTitolare(id: number, email: string, nome?: string): Promise<void> {
  await manda(`/gestionale/avvio/${id}/titolare`, { email, nome: nome || undefined });
}

export async function registraPagamento(id: number): Promise<void> {
  await manda(`/portale/aziende/${id}/avvio/pagato`, {});
}

export async function apriFascicolo(id: number): Promise<void> {
  await manda(`/portale/aziende/${id}/avvio/valida`, {});
}

// ---------------------------------------------------------------- cruscotto

export async function caricaCruscotto(): Promise<Record<string, unknown> | null> {
  if (!isApiMode()) return null;
  return rec(rec(await prendi('/gestionale/cruscotto')).data);
}

// ---------------------------------------------------------------- registro ore per fase (13.3)

export interface FaseOre {
  fase: string;
  nome: string;
  coefficiente: number;
  budget: number;
  fatte: number;
  stato: string;
}

export async function caricaOreFasi(mesi = 12): Promise<{ lavoratori: number; fasi: FaseOre[] }> {
  if (!isApiMode()) return { lavoratori: 0, fasi: [] };
  const d = rec(rec(await prendi(`/portale/gestionale/ore/fasi?mesi=${mesi}`)).data);
  return {
    lavoratori: numero(d.lavoratori) ?? 0,
    fasi: lista(d.fasi).map((x) => {
      const r = rec(x);
      return { fase: testo(r.fase) ?? '', nome: testo(r.nome) ?? '', coefficiente: numero(r.coefficiente) ?? 0, budget: numero(r.budget) ?? 0, fatte: numero(r.fatte) ?? 0, stato: testo(r.stato) ?? 'in_linea' };
    }),
  };
}

// ---------------------------------------------------------------- prenotazioni: nuovi assunti (9.1)

export interface CasoNuovoAssunto {
  quotaId: number;
  lavoratoreId: number;
  lavoratore: string;
  mansione: string | null;
  aziendaId: number;
  azienda: string;
  comune: string | null;
  rischio: string | null;
  conVisita: boolean;
  nonDichiarato: boolean;
  unilav: boolean;
  dal: string | null;
  cellulare: boolean;
  lingua: string;
  arrivataIl: string | null;
  quota: { importo: number; stato: string };
  prenotazioni: Array<{ tipo: string; stato: string | null; quando: string | null; luogo: string | null; tenuta: boolean }>;
  stato: string;
  statoTesto: string;
}

export interface VistaNuoviAssunti {
  casi: CasoNuovoAssunto[];
  conteggi: { daGestire: number; totale: number; quoteDaIncassare: number; quoteNumero: number; tenute: number; conguagli: number };
}

export function mappaCaso(raw: unknown): CasoNuovoAssunto {
  const r = rec(raw);
  const q = rec(r.quota);
  return {
    quotaId: numero(r.quota_id) ?? 0,
    lavoratoreId: numero(r.lavoratore_id) ?? 0,
    lavoratore: testo(r.lavoratore) ?? '',
    mansione: testo(r.mansione),
    aziendaId: numero(r.azienda_id) ?? 0,
    azienda: testo(r.azienda) ?? '',
    comune: testo(r.comune),
    rischio: testo(r.rischio),
    conVisita: r.con_visita === true,
    nonDichiarato: r.non_dichiarato === true,
    unilav: r.unilav === true,
    dal: testo(r.dal),
    cellulare: r.cellulare === true,
    lingua: testo(r.lingua) ?? 'it',
    arrivataIl: testo(r.arrivata_il),
    quota: { importo: numero(q.importo) ?? 0, stato: testo(q.stato) ?? 'da_pagare' },
    prenotazioni: lista(r.prenotazioni).map((p) => {
      const x = rec(p);
      return { tipo: testo(x.tipo) ?? '', stato: testo(x.stato), quando: testo(x.quando), luogo: testo(x.luogo), tenuta: x.tenuta === true };
    }),
    stato: testo(r.stato) ?? 'da_prenotare',
    statoTesto: testo(r.stato_testo) ?? '',
  };
}

export async function caricaNuoviAssunti(aziendaId?: number | null): Promise<VistaNuoviAssunti> {
  if (!isApiMode()) return { casi: [], conteggi: { daGestire: 0, totale: 0, quoteDaIncassare: 0, quoteNumero: 0, tenute: 0, conguagli: 0 } };
  const d = rec(rec(await prendi(`/portale/gestionale/nuovi-assunti${aziendaId ? `?azienda_id=${aziendaId}` : ''}`)).data);
  const c = rec(d.conteggi);
  return {
    casi: lista(d.casi).map(mappaCaso),
    conteggi: {
      daGestire: numero(c.da_gestire) ?? 0,
      totale: numero(c.totale) ?? 0,
      quoteDaIncassare: numero(c.quote_da_incassare) ?? 0,
      quoteNumero: numero(c.quote_numero) ?? 0,
      tenute: numero(c.tenute) ?? 0,
      conguagli: numero(c.conguagli) ?? 0,
    },
  };
}

// ------------------------------------------------- calendario e fatture dei partner (16.2, 16.3, 18.3)

export interface GiornataCalendario {
  id: number;
  data: string;
  centro: string;
  oraInizio: string;
  passoMinuti: number;
  prenotati: number;
  visitati: number;
  aziende: number;
  fase: 'oggi' | 'futura' | 'passata';
  visibile: boolean;
  motivo: 'in_preparazione' | 'privacy' | null;
  disponibileDal: string | null;
  visibileFinoAl: string | null;
}

export interface RigaFattura {
  prestazione: string;
  nome: string;
  numero: number;
  tariffa: number;
  totale: number;
}

export interface FatturaInviata {
  id: number;
  numero: string;
  ente: string;
  giornata: string | null;
  mese: string | null;
  inviataIl: string | null;
  importo: number;
  atteso: number;
  controllo: string | null;
  stato: 'inviata' | 'controllata' | 'in_verifica' | 'pagata';
  pagataIl: string | null;
}

export interface DaFatturareCentro {
  giornataId: number;
  data: string;
  centro: string;
  righe: RigaFattura[];
  totale: number;
  ancoraAttesi: number;
  visitati: number;
}

export interface FattureCentro {
  partner: boolean;
  daFatturare: DaFatturareCentro[];
  inviate: FatturaInviata[];
  nota: string;
}

export interface FattureLaboratorio {
  partner: boolean;
  mese: string;
  righe: RigaFattura[];
  totale: number;
  fatturata: boolean;
  inviate: FatturaInviata[];
  nota: string;
}

const STATI_FATTURA: FatturaInviata['stato'][] = ['inviata', 'controllata', 'in_verifica', 'pagata'];

export const TESTO_STATO_FATTURA: Record<FatturaInviata['stato'], string> = {
  inviata: 'Inviata',
  controllata: 'Controllata, in pagamento',
  in_verifica: 'In verifica',
  pagata: 'Pagata',
};

/** Centesimi in euro con la virgola. */
export const daCentesimi = (c: number) => c / 100;

export function mappaGiornataCalendario(raw: unknown): GiornataCalendario | null {
  const r = rec(raw);
  const id = numero(r.id);
  const data = testo(r.data);
  if (id === null || !data) return null;
  const fase = r.fase === 'oggi' || r.fase === 'futura' ? r.fase : 'passata';
  return {
    id,
    data,
    centro: testo(r.centro) ?? '',
    oraInizio: testo(r.ora_inizio) ?? '',
    passoMinuti: numero(r.passo_minuti) ?? 20,
    prenotati: numero(r.prenotati) ?? 0,
    visitati: numero(r.visitati) ?? 0,
    aziende: numero(r.aziende) ?? 0,
    fase,
    visibile: r.visibile === true,
    motivo: r.motivo === 'in_preparazione' || r.motivo === 'privacy' ? r.motivo : null,
    disponibileDal: testo(r.disponibile_dal),
    visibileFinoAl: testo(r.visibile_fino_al),
  };
}

function mappaRighe(v: unknown): RigaFattura[] {
  return lista(v)
    .map(rec)
    .map((x) => ({
      prestazione: testo(x.prestazione) ?? '',
      nome: testo(x.nome) ?? testo(x.prestazione) ?? '',
      numero: numero(x.numero) ?? 0,
      tariffa: daCentesimi(numero(x.tariffa_centesimi) ?? 0),
      totale: daCentesimi(numero(x.totale_centesimi) ?? 0),
    }))
    .filter((x) => x.prestazione !== '' && x.numero > 0);
}

export function mappaFatturaInviata(raw: unknown): FatturaInviata | null {
  const r = rec(raw);
  const id = numero(r.id);
  const numeroF = testo(r.numero);
  if (id === null || !numeroF) return null;
  return {
    id,
    numero: numeroF,
    ente: testo(r.ente) ?? '',
    giornata: testo(r.giornata),
    mese: testo(r.mese),
    inviataIl: testo(r.inviata_il),
    importo: daCentesimi(numero(r.importo_centesimi) ?? 0),
    atteso: daCentesimi(numero(r.atteso_centesimi) ?? 0),
    controllo: testo(r.controllo),
    stato: STATI_FATTURA.includes(r.stato as FatturaInviata['stato']) ? (r.stato as FatturaInviata['stato']) : 'inviata',
    pagataIl: testo(r.pagata_il),
  };
}

const inviate = (v: unknown) => lista(v).map(mappaFatturaInviata).filter((x): x is FatturaInviata => x !== null);

export function mappaFattureCentro(raw: unknown): FattureCentro {
  const r = rec(raw);
  return {
    partner: r.partner === true,
    daFatturare: lista(r.da_fatturare)
      .map(rec)
      .map((g) => ({
        giornataId: numero(g.giornata_id) ?? 0,
        data: testo(g.data) ?? '',
        centro: testo(g.centro) ?? '',
        righe: mappaRighe(g.righe),
        totale: daCentesimi(numero(g.totale_centesimi) ?? 0),
        ancoraAttesi: numero(g.ancora_attesi) ?? 0,
        visitati: numero(g.visitati) ?? 0,
      }))
      .filter((g) => g.giornataId > 0 && g.data !== ''),
    inviate: inviate(r.inviate),
    nota: testo(r.nota) ?? '',
  };
}

export function mappaFattureLaboratorio(raw: unknown): FattureLaboratorio {
  const r = rec(raw);
  const d = rec(r.da_fatturare);
  return {
    partner: r.partner === true,
    mese: testo(r.mese) ?? '',
    righe: mappaRighe(d.righe),
    totale: daCentesimi(numero(d.totale_centesimi) ?? 0),
    fatturata: d.fatturata === true,
    inviate: inviate(r.inviate),
    nota: testo(r.nota) ?? '',
  };
}

export async function calendarioGiornate(): Promise<GiornataCalendario[]> {
  if (!isApiMode()) return [];
  return lista(rec(rec(await prendi('/portale/gestionale/giornate/calendario')).data).giornate)
    .map(mappaGiornataCalendario)
    .filter((x): x is GiornataCalendario => x !== null);
}

export async function fattureCentro(): Promise<FattureCentro> {
  if (!isApiMode()) return mappaFattureCentro({});
  return mappaFattureCentro(rec(await prendi('/portale/gestionale/giornate/fatture')).data);
}

export async function generaFatturaGiornata(id: number): Promise<FatturaInviata | null> {
  return mappaFatturaInviata(rec(await manda(`/portale/gestionale/giornate/${id}/fattura`)).data);
}

export async function fattureLaboratorio(): Promise<FattureLaboratorio> {
  if (!isApiMode()) return mappaFattureLaboratorio({});
  return mappaFattureLaboratorio(rec(await prendi('/portale/gestionale/laboratorio/fatture')).data);
}

export async function generaFatturaLaboratorio(): Promise<FatturaInviata | null> {
  return mappaFatturaInviata(rec(await manda('/portale/gestionale/laboratorio/fatture')).data);
}

// ------------------------------------------------- otto indicatori del cruscotto (14)

export type StatoIndicatore = 'ok' | 'warn' | 'danger' | 'neutral';

export interface Indicatore {
  id: string;
  nome: string;
  valore: number | null;
  unita: string;
  obiettivo: number;
  soglia: number;
  meglio: 'alto' | 'basso';
  stato: StatoIndicatore;
  regola: string;
  nota: string | null;
  numeratore: string;
  denominatore: string;
  fonte: string;
  serie: Array<{ mese: string; valore: number | null }>;
}

export const TESTO_STATO_INDICATORE: Record<StatoIndicatore, string> = {
  ok: 'In obiettivo',
  warn: 'Da seguire',
  danger: 'Allarme',
  neutral: 'Dati insufficienti',
};

export function mappaIndicatori(raw: unknown): Indicatore[] {
  return lista(raw)
    .map(rec)
    .map((r) => {
      const stato: StatoIndicatore = r.stato === 'ok' || r.stato === 'warn' || r.stato === 'danger' ? r.stato : 'neutral';
      return {
        id: testo(r.id) ?? '',
        nome: testo(r.nome) ?? '',
        valore: numero(r.valore),
        unita: testo(r.unita) ?? '',
        obiettivo: numero(r.obiettivo) ?? 0,
        soglia: numero(r.soglia) ?? 0,
        meglio: r.meglio === 'basso' ? ('basso' as const) : ('alto' as const),
        stato,
        regola: testo(r.regola) ?? '',
        nota: testo(r.nota),
        numeratore: testo(r.numeratore) ?? '',
        denominatore: testo(r.denominatore) ?? '',
        fonte: testo(r.fonte) ?? '',
        serie: lista(r.serie)
          .map(rec)
          .map((s) => ({ mese: testo(s.mese) ?? '', valore: numero(s.valore) }))
          .filter((s) => /^\d{4}-\d{2}$/.test(s.mese)),
      };
    })
    .filter((x) => x.id !== '' && x.nome !== '');
}

/** Valore con l'unità come nel cruscotto: "11 min", "94%", "2,4 h"; senza unità il numero. */
export function valoreIndicatore(v: number | null, unita: string): string {
  if (v === null) return 'n.d.';
  const n = v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  return unita === '%' ? `${n}%` : unita ? `${n} ${unita}` : n;
}

/** Differenza rispetto al mese prima, con il segno. */
export function rispettoAlMesePrima(serie: Indicatore['serie'], i: number): string | null {
  const a = serie[i]?.valore;
  const b = serie[i - 1]?.valore;
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const d = Math.round((a - b) * 10) / 10;
  return d === 0 ? 'uguale' : `${d > 0 ? '+' : ''}${d.toLocaleString('it-IT')}`;
}
