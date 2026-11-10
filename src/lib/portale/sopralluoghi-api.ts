/**
 * Sopralluoghi del gestionale (ADR-009, V1): chiamate REST, mappatori tolleranti
 * e regole pure (avanzamento, classe di rischio, termine consigliato) usate dalla
 * vista del telefono e da quella dell'ufficio.
 */

import { apiUpload, apiUrl, getToken } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

export type Esito = 'conforme' | 'non_conforme' | 'non_serve';

export interface Azione {
  cosa: string;
  responsabile: string;
  entro: string | null;
  p: number | null;
  d: number | null;
  pericolo: string;
  riferimento: string;
  proposta: boolean;
}

export interface Allegato {
  id: number;
  tipo: 'foto' | 'nota_vocale';
  voceId: number | null;
  documentoId: number | null;
  stato: string;
  trascrizione: string | null;
  errore: string | null;
  vocePropostaId: number | null;
  esitoProposto: Esito | null;
  analisi: { esito: string | null; motivo: string | null } | null;
}

export interface Voce {
  id: number;
  area: string;
  codice: string | null;
  testo: string;
  riferimento: string | null;
  fonte: string;
  esito: Esito | null;
  nota: string | null;
  azione: Azione | null;
  proposta: { esito: string; motivo: string; descrizione: string; fonte: string } | null;
  foto: Allegato[];
  note: Allegato[];
}

export interface Area {
  nome: string;
  voci: Voce[];
  fatte: number;
  totale: number;
}

export interface Conteggi {
  voci: number;
  risposte: number;
  conformi: number;
  nonConformi: number;
  nonServe: number;
  ncSenzaAzione: number;
  foto: number;
  note: number;
  noteDaApprovare: number;
  osservazioni: number;
}

export interface Sopralluogo {
  id: number;
  azienda: { id: number; ragioneSociale: string };
  tecnico: string | null;
  sede: string | null;
  motivo: string | null;
  tipo: string;
  stato: 'bozza' | 'in_corso' | 'chiuso';
  programmatoIl: string | null;
  iniziatoIl: string | null;
  chiusoIl: string | null;
  aree: Area[];
  conteggi: Conteggi;
  noteDaApprovare: Array<Allegato & { voce: { id: number; area: string; testo: string } | null }>;
  verbale: { documentoId: number; stato: string; revisione: number; emessoIl: string | null } | null;
  dvr: { inviatoIl: string | null; propostaId: number | null; propostaStato: string | null };
  puoEmettere: boolean;
  modificabile: boolean;
  fonti: { settore: string | null; dvrId: number | null; vociDalDvr: number };
}

export interface RigaSopralluogo {
  id: number;
  azienda: string;
  aziendaId: number;
  tecnico: string | null;
  sede: string | null;
  motivo: string | null;
  stato: string;
  programmatoIl: string | null;
  chiusoIl: string | null;
  voci: number;
  risposte: number;
  nonConformita: number;
  osservazioni: number;
  verbale: { stato: string; revisione: number } | null;
  inviatoDvr: boolean;
}

export interface Segnalazione {
  chiave: string;
  esito: string;
  messaggio: string;
  dove: string;
}

export interface EsitoVerbale {
  documentoId: number;
  puoEmettere: boolean;
  segnalazioni: Segnalazione[];
}

// ---------------------------------------------------------------- mappatori

const ESITI: Esito[] = ['conforme', 'non_conforme', 'non_serve'];
const esito = (v: unknown): Esito | null => (ESITI.includes(v as Esito) ? (v as Esito) : null);

export function mappaAllegato(raw: unknown): Allegato | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const an = rec(r.analisi);
  return {
    id,
    tipo: r.tipo === 'nota_vocale' ? 'nota_vocale' : 'foto',
    voceId: numero(r.voce_id),
    documentoId: numero(r.documento_id),
    stato: testo(r.stato) ?? '',
    trascrizione: testo(r.trascrizione),
    errore: testo(r.errore),
    vocePropostaId: numero(an.voce_proposta_id),
    esitoProposto: esito(an.esito_proposto),
    analisi: r.analisi ? { esito: testo(an.esito), motivo: testo(an.motivo) } : null,
  };
}

function mappaAzione(raw: unknown): Azione | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = rec(raw);
  return {
    cosa: testo(a.cosa) ?? '',
    responsabile: testo(a.responsabile) ?? '',
    entro: testo(a.entro),
    p: numero(a.p),
    d: numero(a.d),
    pericolo: testo(a.pericolo) ?? '',
    riferimento: testo(a.riferimento) ?? '',
    proposta: a.proposta === true,
  };
}

export function mappaVoce(raw: unknown): Voce | null {
  const v = rec(raw);
  const id = numero(v.id);
  const t = testo(v.testo);
  if (id === null || !t) return null;
  const p = rec(v.proposta);
  return {
    id,
    area: testo(v.area) ?? 'Area di lavoro',
    codice: testo(v.codice),
    testo: t,
    riferimento: testo(v.riferimento),
    fonte: testo(v.fonte) ?? 'modello',
    esito: esito(v.esito),
    nota: testo(v.nota),
    azione: mappaAzione(v.azione),
    proposta: v.proposta ? { esito: testo(p.esito) ?? '', motivo: testo(p.motivo) ?? '', descrizione: testo(p.descrizione) ?? '', fonte: testo(p.fonte) ?? '' } : null,
    foto: lista(v.foto).map(mappaAllegato).filter((x): x is Allegato => x !== null),
    note: lista(v.note).map(mappaAllegato).filter((x): x is Allegato => x !== null),
  };
}

export function mappaSopralluogo(raw: unknown): Sopralluogo | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const az = rec(r.azienda);
  const c = rec(r.conteggi);
  const n = (k: string) => numero(c[k]) ?? 0;
  const vb = rec(r.verbale);
  const dvr = rec(r.dvr);
  const puo = rec(r.puo);
  const f = rec(r.fonti);
  const stato = r.stato === 'chiuso' || r.stato === 'in_corso' ? r.stato : 'bozza';
  return {
    id,
    azienda: { id: numero(az.id) ?? 0, ragioneSociale: testo(az.ragione_sociale) ?? '' },
    tecnico: testo(rec(r.tecnico).nome),
    sede: testo(r.sede),
    motivo: testo(r.motivo),
    tipo: testo(r.tipo) ?? 'periodico',
    stato,
    programmatoIl: testo(r.programmato_il),
    iniziatoIl: testo(r.iniziato_il),
    chiusoIl: testo(r.chiuso_il),
    aree: lista(r.aree).map((x) => {
      const a = rec(x);
      const voci = lista(a.voci).map(mappaVoce).filter((v): v is Voce => v !== null);
      return { nome: testo(a.nome) ?? 'Area di lavoro', voci, fatte: voci.filter((v) => v.esito !== null).length, totale: voci.length };
    }),
    conteggi: {
      voci: n('voci'),
      risposte: n('risposte'),
      conformi: n('conformi'),
      nonConformi: n('non_conformi'),
      nonServe: n('non_serve'),
      ncSenzaAzione: n('nc_senza_azione'),
      foto: n('foto'),
      note: n('note'),
      noteDaApprovare: n('note_da_approvare'),
      osservazioni: n('osservazioni'),
    },
    noteDaApprovare: lista(r.note_da_approvare)
      .map((x) => {
        const a = mappaAllegato(x);
        if (!a) return null;
        const v = rec(rec(x).voce);
        const vid = numero(v.id);
        return { ...a, voce: vid !== null ? { id: vid, area: testo(v.area) ?? '', testo: testo(v.testo) ?? '' } : null };
      })
      .filter((x): x is Allegato & { voce: { id: number; area: string; testo: string } | null } => x !== null),
    verbale: numero(vb.documento_id) !== null ? { documentoId: numero(vb.documento_id)!, stato: testo(vb.stato) ?? 'bozza', revisione: numero(vb.revisione) ?? 0, emessoIl: testo(vb.emesso_il) } : null,
    dvr: { inviatoIl: testo(dvr.inviato_il), propostaId: numero(dvr.proposta_id), propostaStato: testo(dvr.proposta_stato) },
    puoEmettere: puo.emettere === true,
    modificabile: puo.modificare !== false && stato !== 'chiuso',
    fonti: { settore: testo(f.settore), dvrId: numero(f.dvr_id), vociDalDvr: numero(f.voci_dal_dvr) ?? 0 },
  };
}

export function mappaRiga(raw: unknown): RigaSopralluogo | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const az = rec(r.azienda);
  const vb = rec(r.verbale);
  return {
    id,
    azienda: testo(az.ragione_sociale) ?? '',
    aziendaId: numero(az.id) ?? 0,
    tecnico: testo(rec(r.tecnico).nome),
    sede: testo(r.sede),
    motivo: testo(r.motivo),
    stato: testo(r.stato) ?? 'bozza',
    programmatoIl: testo(r.programmato_il),
    chiusoIl: testo(r.chiuso_il),
    voci: numero(r.voci) ?? 0,
    risposte: numero(r.risposte) ?? 0,
    nonConformita: numero(r.non_conformita) ?? 0,
    osservazioni: numero(r.osservazioni) ?? 0,
    verbale: numero(vb.documento_id) !== null ? { stato: testo(vb.stato) ?? 'bozza', revisione: numero(vb.revisione) ?? 0 } : null,
    inviatoDvr: testo(r.inviato_dvr_il) !== null,
  };
}

// ---------------------------------------------------------------- regole pure

/** Classe di rischio dalla stima R = P x D (stessa scala del verbale). */
export function classeRischio(p: number | null, d: number | null): { r: number; classe: string; tono: 'danger' | 'warn' | 'ok' | 'neutral'; giorni: number } | null {
  if (!p || !d || p < 1 || p > 4 || d < 1 || d > 4) return null;
  const r = p * d;
  if (r >= 9) return { r, classe: 'molto alto', tono: 'danger', giorni: 7 };
  if (r >= 6) return { r, classe: 'alto', tono: 'danger', giorni: 30 };
  if (r >= 3) return { r, classe: 'medio', tono: 'warn', giorni: 90 };
  return { r, classe: 'basso', tono: 'ok', giorni: 180 };
}

/** Termine consigliato (AAAA-MM-GG) dalla classe di rischio, contato da oggi. */
export function termineConsigliato(p: number | null, d: number | null, oggi: Date = new Date()): string | null {
  const c = classeRischio(p, d);
  if (!c) return null;
  const x = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + c.giorni, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Percentuale di avanzamento arrotondata. */
export function percentuale(fatte: number, totale: number): number {
  return totale > 0 ? Math.round((fatte / totale) * 100) : 0;
}

/** Prossima area con voci senza esito, dopo quella attuale (poi dall'inizio). */
export function prossimaArea(aree: Area[], attuale: number): number | null {
  for (let k = 1; k <= aree.length; k++) {
    const i = (attuale + k) % aree.length;
    if (aree[i].fatte < aree[i].totale) return i;
  }
  return null;
}

/** Azione completa per chiudere: cosa, responsabile, entro, P e D, confermata. */
export function azioneConfermata(a: Azione | null): boolean {
  return !!a && !a.proposta && a.cosa.trim() !== '' && a.responsabile.trim() !== '' && !!a.entro && !!a.p && !!a.d;
}

/** Il secondo tocco sullo stesso esito lo annulla. */
export function prossimoEsito(attuale: Esito | null, toccato: Esito): Esito | null {
  return attuale === toccato ? null : toccato;
}

// Ora italiana, come nel verbale: lo studio e le aziende lavorano in Italia.
const TZ = 'Europe/Rome';
const fmtOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtLunga = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const fmtGiorno = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });

/** "oggi alle 09:30", "domani alle 14:00", "martedì 27 ottobre alle 10:30". */
export function quando(iso: string | null, oggi: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const g = Math.round((Date.parse(`${fmtGiorno.format(d)}T12:00:00Z`) - Date.parse(`${fmtGiorno.format(oggi)}T12:00:00Z`)) / 86400000);
  const giorno = g === 0 ? 'oggi' : g === 1 ? 'domani' : g === -1 ? 'ieri' : fmtLunga.format(d);
  return `${giorno} alle ${fmtOra.format(d)}`;
}

export const TIPI_SOPRALLUOGO: Array<{ v: string; t: string }> = [
  { v: 'periodico', t: 'Periodico' },
  { v: 'iniziale', t: 'Primo sopralluogo' },
  { v: 'straordinario', t: 'Straordinario' },
  { v: 'post_infortunio', t: 'Dopo un infortunio o un quasi infortunio' },
  { v: 'verifica_prescrizioni', t: 'Verifica delle misure' },
  { v: 'altro', t: 'Altro' },
];

export const SCALA_P = ['Improbabile', 'Poco probabile', 'Probabile', 'Molto probabile'];
export const SCALA_D = ['Lieve', 'Medio', 'Grave', 'Gravissimo'];

// ---------------------------------------------------------------- chiamate

const vista = (r: unknown, chiave?: string): Sopralluogo => {
  const d = rec(rec(r).data);
  const s = mappaSopralluogo(chiave ? d[chiave] : d);
  if (!s) throw new Error('Risposta non valida dal server.');
  return s;
};

export async function elencoSopralluoghi(stato: 'programmati' | 'fatti', aziendaId?: number | null): Promise<RigaSopralluogo[]> {
  if (!isApiMode()) return [];
  const r = rec(await prendi(`/sopralluoghi?stato=${stato}${aziendaId ? `&azienda_id=${aziendaId}` : ''}`));
  return lista(r.data).map(mappaRiga).filter((x): x is RigaSopralluogo => x !== null);
}

export async function aziendeStudio(): Promise<Array<{ id: number; nome: string }>> {
  if (!isApiMode()) return [];
  const r = rec(await prendi('/companies?per_page=200'));
  return lista(r.data)
    .map((x) => {
      const a = rec(x);
      const id = numero(a.id);
      return id === null ? null : { id, nome: testo(a.ragione_sociale) ?? `Azienda ${id}` };
    })
    .filter((x): x is { id: number; nome: string } => x !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

export async function caricaSopralluogo(id: number): Promise<Sopralluogo> {
  return vista(await prendi(`/sopralluoghi/${id}`));
}

export async function nuovoSopralluogo(d: { azienda_id: number; sede?: string; motivo?: string; tipo?: string; programmato_il?: string }): Promise<Sopralluogo> {
  return vista(await manda('/sopralluoghi', d));
}

export async function registraEsito(id: number, voce: number, e: Esito | null, nota?: string): Promise<Sopralluogo> {
  return vista(await manda(`/sopralluoghi/${id}/voci/${voce}`, nota !== undefined ? { esito: e, nota } : { esito: e }, 'PATCH'));
}

export async function salvaAzione(id: number, voce: number, a: { cosa: string; responsabile: string; entro: string; p: number; d: number; pericolo?: string }): Promise<Sopralluogo> {
  return vista(await manda(`/sopralluoghi/${id}/voci/${voce}/azione`, a, 'PUT'));
}

export async function proponiAzione(id: number, voce: number): Promise<{ proposta: Azione | null; s: Sopralluogo }> {
  const r = await manda(`/sopralluoghi/${id}/voci/${voce}/proponi-azione`);
  return { proposta: mappaAzione(rec(rec(r).data).proposta), s: vista(r, 'sopralluogo') };
}

async function carica(path: string, file: File, voce: number | null): Promise<unknown> {
  const fd = new FormData();
  fd.append('file', file);
  if (voce) fd.append('voce_id', String(voce));
  try {
    return await apiUpload(path, fd);
  } catch (e) {
    throw erroreLeggibile(e, 'Caricamento non riuscito. Riprova.');
  }
}

export async function caricaFoto(id: number, voce: number | null, file: File): Promise<{ allegato: number | null; s: Sopralluogo }> {
  const r = await carica(`/sopralluoghi/${id}/foto`, file, voce);
  return { allegato: numero(rec(rec(r).data).allegato_id), s: vista(r, 'sopralluogo') };
}

export async function analizzaFoto(id: number, allegato: number): Promise<{ esito: string | null; motivo: string | null; s: Sopralluogo }> {
  const r = await manda(`/sopralluoghi/${id}/allegati/${allegato}/analizza`);
  const p = rec(rec(rec(r).data).proposta);
  return { esito: testo(p.esito), motivo: testo(p.motivo), s: vista(r, 'sopralluogo') };
}

export async function caricaNota(id: number, voce: number | null, file: File): Promise<{ trascrizione: string | null; errore: string | null; s: Sopralluogo }> {
  const r = await carica(`/sopralluoghi/${id}/note`, file, voce);
  const d = rec(rec(r).data);
  return { trascrizione: testo(d.trascrizione), errore: testo(d.errore), s: vista(r, 'sopralluogo') };
}

export async function decidiNote(id: number, approva: boolean, spostamenti: Record<number, number> = {}): Promise<Sopralluogo> {
  return vista(await manda(`/sopralluoghi/${id}/note/decidi`, { approva, spostamenti }), 'sopralluogo');
}

export async function eliminaAllegato(id: number, allegato: number): Promise<Sopralluogo> {
  return vista(await manda(`/sopralluoghi/${id}/allegati/${allegato}`, undefined, 'DELETE'));
}

export async function generaVerbale(id: number): Promise<{ verbale: EsitoVerbale; s: Sopralluogo }> {
  const r = await manda(`/sopralluoghi/${id}/verbale`);
  const v = rec(rec(rec(r).data).verbale);
  return {
    verbale: {
      documentoId: numero(v.documento_id) ?? 0,
      puoEmettere: v.puo_emettere === true,
      segnalazioni: lista(v.segnalazioni).map((x) => {
        const s = rec(x);
        return { chiave: testo(s.chiave) ?? '', esito: testo(s.esito) ?? '', messaggio: testo(s.messaggio) ?? '', dove: testo(s.dove) ?? '' };
      }),
    },
    s: vista(r, 'sopralluogo'),
  };
}

export async function emettiVerbale(id: number): Promise<Sopralluogo> {
  return vista(await manda(`/sopralluoghi/${id}/emetti`, { conferma: true }), 'sopralluogo');
}

export async function inviaAlDvr(id: number): Promise<{ misure: number; osservazioni: number; s: Sopralluogo }> {
  const r = await manda(`/sopralluoghi/${id}/invia-dvr`);
  const i = rec(rec(rec(r).data).invio);
  return { misure: numero(i.misure) ?? 0, osservazioni: numero(i.osservazioni) ?? 0, s: vista(r, 'sopralluogo') };
}

export async function chiudiSopralluogo(id: number): Promise<{ scadenze: number; s: Sopralluogo }> {
  const r = await manda(`/sopralluoghi/${id}/chiudi`);
  return { scadenze: numero(rec(rec(rec(r).data).chiusura).scadenze) ?? 0, s: vista(r, 'sopralluogo') };
}

/** Immagine dell'archivio come indirizzo locale (con il token), per le miniature. */
export async function urlFoto(documentoId: number): Promise<string | null> {
  if (!isApiMode()) return null;
  const token = getToken();
  const res = await fetch(apiUrl(`/company-documents/${documentoId}/download`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/** Percorso di download del verbale: la bozza si rigenera, l'emesso e' l'ultima revisione. */
export function percorsoVerbale(documentoId: number, formato: 'pdf' | 'docx', bozza: boolean): string {
  return `/documenti-hse/${documentoId}/download/${formato}${bozza ? '?revisione=0' : ''}`;
}
