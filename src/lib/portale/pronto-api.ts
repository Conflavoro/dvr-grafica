/**
 * Pronto Ispezioni lato studio (SPEC_GESTIONALE 12): la scrivania del tecnico
 * di turno. Richieste aperte con traccia a 4 passi, note, chiusura con esito,
 * storico, tempi di richiamata e turni. Mappatori tolleranti; fuori dalla
 * modalità API la lettura torna vuota e le scritture si fermano.
 */

import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';

/** Stati della scheda Adesso (04 gestionale 8.1). */
export type StatoPronto = 'aperta' | 'presa' | 'chiamando' | 'in_chiamata' | 'chiusa' | 'archiviata';
export type PassoPronto = 'presa' | 'chiamando' | 'in_chiamata' | 'chiusa' | 'fascicolo';
export type TipoNota = 'telefonata' | 'messaggio' | 'nota' | 'ha_chiesto' | 'mostrato' | 'sistema';

export interface NotaPronto {
  quando: string | null;
  tipo: TipoNota;
  testo: string;
  autore: string | null;
}

export interface RichiestaPronto {
  id: number;
  aziendaId: number | null;
  azienda: string;
  ente: string | null;
  messaggio: string | null;
  presenti: string[];
  richiestoDa: string | null;
  emailRichiedente: string | null;
  richiestaIl: string | null;
  obiettivoEntro: string | null;
  presaInCaricoIl: string | null;
  presaInCaricoDa: string | null;
  richiamataIl: string | null;
  minutiAllaRichiamata: number | null;
  entroObiettivo: boolean | null;
  inRitardo: boolean;
  esitoRichiamata: string | null;
  stato: StatoPronto;
  statoTesto: string;
  prossimoPasso: PassoPronto | null;
  fascicoloInviatoIl: string | null;
  telefono: string | null;
  passo: 1 | 2 | 3 | 4;
  avvisoTitolareIl: string | null;
  esitoChiusura: string | null;
  esitoChiusuraTesto: string | null;
  chiusaIl: string | null;
  note: NotaPronto[];
}

export interface Persona {
  id: number;
  nome: string;
}

export interface VistaPronto {
  minutiRichiamata: number;
  minutiAvvisoTitolare: number;
  inFinestra: boolean;
  finestra: string;
  turnoOggi: { titolare: Persona | null; sostituto: Persona | null };
  aperte: RichiestaPronto[];
  storico: RichiestaPronto[];
  kpi: { richiamate30: number; mediaMinuti: number | null; entroObiettivoPct: number | null; inRitardoOra: number; perMese: Array<{ mese: string; richieste: number }> };
  esiti: Array<{ chiave: string; testo: string }>;
}

export interface TurniPronto {
  settimanaDal: string;
  giorni: Array<{ giorno: string; feriale: boolean; titolare: Persona | null; sostituto: Persona | null }>;
  tecnici: Persona[];
  puoModificare: boolean;
}

const STATI: StatoPronto[] = ['aperta', 'presa', 'chiamando', 'in_chiamata', 'chiusa', 'archiviata'];
const TIPI: TipoNota[] = ['telefonata', 'messaggio', 'nota', 'ha_chiesto', 'mostrato', 'sistema'];
const PASSI: PassoPronto[] = ['presa', 'chiamando', 'in_chiamata', 'chiusa', 'fascicolo'];

export const TESTO_STATO: Record<StatoPronto, string> = {
  aperta: 'Da richiamare',
  presa: 'Presa in carico',
  chiamando: 'Sto chiamando',
  in_chiamata: 'In chiamata',
  chiusa: 'Telefonata chiusa',
  archiviata: 'Archiviata',
};

/** Tono del chip per stato: rosso, ambra, azzurro, verde. */
export const TONO_STATO: Record<StatoPronto, 'danger' | 'warn' | 'info' | 'ok'> = {
  aperta: 'danger',
  presa: 'warn',
  chiamando: 'warn',
  in_chiamata: 'info',
  chiusa: 'info',
  archiviata: 'ok',
};

/** Sequenza mostrata sotto il riquadro nero e stato che la raggiunge. */
export const SEQUENZA: Array<{ testo: string; stato: StatoPronto }> = [
  { testo: 'Arrivata', stato: 'aperta' },
  { testo: 'Presa', stato: 'presa' },
  { testo: 'Sto chiamando', stato: 'chiamando' },
  { testo: 'In chiamata', stato: 'in_chiamata' },
  { testo: 'Chiusa', stato: 'chiusa' },
];

/** Testo del solo pulsante del passo successivo. */
export const PULSANTE_PASSO: Record<Exclude<PassoPronto, 'fascicolo'>, string> = {
  presa: 'Prendo io',
  chiamando: 'Sto chiamando',
  in_chiamata: 'In chiamata',
  chiusa: 'Chiusa',
};

export const NOMI_NOTA: Record<TipoNota, string> = {
  telefonata: 'Telefonata', messaggio: 'Messaggio', nota: 'Nota', ha_chiesto: 'Ha chiesto', mostrato: 'Mostrato', sistema: 'Sistema',
};

/** Indice dello stato nella sequenza (archiviata conta come chiusa). */
export function indiceSequenza(s: StatoPronto): number {
  return s === 'archiviata' ? SEQUENZA.length - 1 : SEQUENZA.findIndex((x) => x.stato === s);
}

/** Conto alla rovescia "mm:ss" dai secondi rimasti; oltre zero "+m:ss". */
export function contoAllaRovescia(secondi: number): string {
  const a = Math.abs(Math.trunc(secondi));
  const t = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  return secondi < 0 ? `+${t}` : t.padStart(5, '0');
}

function persona(v: unknown): Persona | null {
  const r = rec(v);
  const id = numero(r.id);
  const nome = testo(r.nome);
  return id !== null && nome ? { id, nome } : null;
}

export function mappaRichiesta(raw: unknown): RichiestaPronto | null {
  const r = rec(raw);
  const id = numero(r.richiesta_id);
  if (id === null) return null;
  const stato = STATI.includes(r.stato as StatoPronto) ? (r.stato as StatoPronto) : 'aperta';
  const prossimo = PASSI.includes(r.prossimo_passo as PassoPronto) ? (r.prossimo_passo as PassoPronto) : null;
  const passo = numero(r.passo);
  return {
    id,
    aziendaId: numero(r.azienda_id),
    azienda: testo(r.azienda) ?? 'Azienda',
    ente: testo(r.ente),
    messaggio: testo(r.messaggio),
    presenti: lista(r.presenti).filter((x): x is string => typeof x === 'string' && x.trim() !== ''),
    richiestoDa: testo(r.richiesto_da),
    emailRichiedente: testo(r.email_richiedente),
    richiestaIl: testo(r.richiesta_il),
    obiettivoEntro: testo(r.obiettivo_entro),
    presaInCaricoIl: testo(r.presa_in_carico_il),
    presaInCaricoDa: testo(r.presa_in_carico_da),
    richiamataIl: testo(r.richiamata_il),
    minutiAllaRichiamata: numero(r.minuti_alla_richiamata),
    entroObiettivo: typeof r.entro_obiettivo === 'boolean' ? r.entro_obiettivo : null,
    inRitardo: r.in_ritardo === true,
    esitoRichiamata: testo(r.esito_richiamata),
    stato,
    statoTesto: testo(r.stato_testo) ?? TESTO_STATO[stato],
    prossimoPasso: prossimo,
    fascicoloInviatoIl: testo(r.fascicolo_inviato_il),
    telefono: testo(r.telefono),
    passo: passo === 1 || passo === 2 || passo === 3 || passo === 4 ? passo : 1,
    avvisoTitolareIl: testo(r.avviso_titolare_il),
    esitoChiusura: testo(r.esito_chiusura),
    esitoChiusuraTesto: testo(r.esito_chiusura_testo),
    chiusaIl: testo(r.chiusa_il),
    note: lista(r.note)
      .map(rec)
      .map((n) => ({ quando: testo(n.quando), tipo: TIPI.includes(n.tipo as TipoNota) ? (n.tipo as TipoNota) : 'nota', testo: testo(n.testo) ?? '', autore: testo(n.autore) }))
      .filter((n) => n.testo !== ''),
  };
}

export function mappaVista(raw: unknown): VistaPronto {
  const r = rec(raw);
  const k = rec(r.kpi);
  const t = rec(r.turno_oggi);
  const richieste = (v: unknown) => lista(v).map(mappaRichiesta).filter((x): x is RichiestaPronto => x !== null);
  return {
    minutiRichiamata: numero(r.minuti_richiamata) ?? 15,
    minutiAvvisoTitolare: numero(r.minuti_avviso_titolare) ?? 10,
    inFinestra: r.in_finestra === true,
    finestra: testo(r.finestra) ?? 'dal lunedì al venerdì',
    turnoOggi: { titolare: persona(t.titolare), sostituto: persona(t.sostituto) },
    aperte: richieste(r.aperte),
    storico: richieste(r.storico),
    kpi: {
      richiamate30: numero(k.richiamate_30_giorni) ?? 0,
      mediaMinuti: numero(k.media_minuti),
      entroObiettivoPct: numero(k.entro_obiettivo_pct),
      inRitardoOra: numero(k.in_ritardo_ora) ?? 0,
      perMese: lista(k.per_mese)
        .map(rec)
        .map((m) => ({ mese: testo(m.mese) ?? '', richieste: numero(m.richieste) ?? 0 }))
        .filter((m) => /^\d{4}-\d{2}$/.test(m.mese)),
    },
    esiti: lista(r.esiti)
      .map(rec)
      .map((e) => ({ chiave: testo(e.chiave) ?? '', testo: testo(e.testo) ?? '' }))
      .filter((e) => e.chiave !== ''),
  };
}

export function mappaTurni(raw: unknown): TurniPronto {
  const r = rec(raw);
  return {
    settimanaDal: testo(r.settimana_dal) ?? '',
    giorni: lista(r.giorni)
      .map(rec)
      .map((g) => ({ giorno: testo(g.giorno) ?? '', feriale: g.feriale !== false, titolare: persona(g.titolare), sostituto: persona(g.sostituto) }))
      .filter((g) => g.giorno !== ''),
    tecnici: lista(r.tecnici).map(persona).filter((x): x is Persona => x !== null),
    puoModificare: r.puo_modificare === true,
  };
}

/** Minuti che mancano all'obiettivo di richiamata (negativi = in ritardo); null se già richiamata. */
export function minutiAllObiettivo(r: RichiestaPronto, ora: Date = new Date()): number | null {
  if (r.richiamataIl || r.chiusaIl || !r.obiettivoEntro) return null;
  const t = new Date(r.obiettivoEntro).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - ora.getTime()) / 60_000);
}

/** Etichetta del mese in italiano breve ("ott 2026"). */
export function etichettaMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number);
  if (!a || !m) return mese;
  return new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' }).format(new Date(a, m - 1, 15));
}

const VUOTA: VistaPronto = mappaVista({});

function soloApi(): void {
  if (!isApiMode()) throw new Error('Disponibile solo con il collegamento al server.');
}

export async function vistaPronto(): Promise<VistaPronto> {
  if (!isApiMode()) return VUOTA;
  return mappaVista(rec(await prendi('/gestionale/pronto')).data);
}

export async function prendiInCarico(id: number): Promise<void> {
  soloApi();
  await manda(`/portale/richieste-assistenza/${id}/presa-in-carico`);
}

export async function segnaRichiamata(id: number, esito: string): Promise<void> {
  soloApi();
  await manda(`/portale/richieste-assistenza/${id}/richiamata`, { esito: esito.trim() || null });
}

export async function aggiungiNota(id: number, tipo: TipoNota, t: string): Promise<RichiestaPronto | null> {
  soloApi();
  return mappaRichiesta(rec(await manda(`/gestionale/pronto/richieste/${id}/note`, { tipo, testo: t })).data);
}

export async function avanzaPasso(id: number, passo: PassoPronto): Promise<RichiestaPronto | null> {
  soloApi();
  return mappaRichiesta(rec(await manda(`/gestionale/pronto/richieste/${id}/passo`, { passo })).data);
}

export async function chiudiRichiesta(id: number, esito: string, nota: string): Promise<{ richiesta: RichiestaPronto | null; nota: string | null }> {
  soloApi();
  const d = rec(rec(await manda(`/gestionale/pronto/richieste/${id}/chiudi`, { esito, nota: nota.trim() || null })).data);
  return { richiesta: mappaRichiesta(d), nota: testo(d.nota) };
}

export async function turniPronto(dal?: string): Promise<TurniPronto> {
  if (!isApiMode()) return mappaTurni({});
  return mappaTurni(rec(await prendi(`/gestionale/pronto/turni${dal ? `?dal=${encodeURIComponent(dal)}` : ''}`)).data);
}

export async function impostaTurno(giorno: string, titolareId: number | null, sostitutoId: number | null): Promise<TurniPronto> {
  soloApi();
  return mappaTurni(rec(await manda('/gestionale/pronto/turni', { giorno, titolare_id: titolareId, sostituto_id: sostitutoId }, 'PUT')).data);
}
