/**
 * Chiamate della Scrivania dei documenti e di POS e PiMUS (gestionale, ADR-009 V3).
 * Fuori dalla modalità API ritornano vuoto: le viste mostrano lo stato vuoto.
 */

import { apiUrl, getToken } from '@/lib/api';
import { fetchConTempo } from '@/lib/attesa';
import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';
import type { AziendaScrivania, GruppoDoc, Miglioramento, PassoGenerazione, Segnalazione, StatoDoc, VoceDocumento } from './documenti';
import { consegnaFile } from '@/lib/app/file-recenti';

const STATI: StatoDoc[] = ['bozza', 'revisione', 'emesso', 'da_aggiornare'];
const statoDoc = (v: unknown): StatoDoc => (STATI.includes(v as StatoDoc) ? (v as StatoDoc) : 'bozza');
const GRUPPI: GruppoDoc[] = ['dvr', 'valutazione', 'documento', 'pos'];

export function mappaVoce(raw: unknown): VoceDocumento | null {
  const r = rec(raw);
  const id = numero(r.id);
  const gruppo = GRUPPI.includes(r.gruppo as GruppoDoc) ? (r.gruppo as GruppoDoc) : null;
  if (id === null || !gruppo) return null;
  return {
    chiave: testo(r.chiave) ?? `${gruppo}:${id}`,
    gruppo,
    id,
    tipo: testo(r.tipo) ?? gruppo,
    etichetta: testo(r.etichetta) ?? 'Documento',
    titolo: testo(r.titolo),
    stato: statoDoc(r.stato),
    statoOriginale: testo(r.stato_originale) ?? '',
    revisione: numero(r.revisione) ?? 0,
    versione: numero(r.versione),
    emessoIl: testo(r.emesso_il),
    aggiornatoIl: testo(r.aggiornato_il),
    perche: lista(r.perche).map((x) => testo(x)).filter((x): x is string => x !== null),
    bloccanti: numero(r.bloccanti) ?? 0,
    generazione: testo(r.generazione),
    cantiereId: numero(r.cantiere_id),
  };
}

export function mappaAzienda(raw: unknown): AziendaScrivania | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const c = rec(r.conteggi);
  const d = rec(r.dvr);
  const pr = testo(r.priorita);
  return {
    id,
    ragioneSociale: testo(r.ragione_sociale) ?? `Azienda ${id}`,
    ateco: testo(r.ateco),
    lavoratori: numero(r.lavoratori),
    documenti: numero(r.documenti) ?? 0,
    conteggi: { bozza: numero(c.bozza) ?? 0, revisione: numero(c.revisione) ?? 0, emesso: numero(c.emesso) ?? 0, da_aggiornare: numero(c.da_aggiornare) ?? 0 },
    dvr: numero(d.id) !== null ? { id: numero(d.id)!, stato: statoDoc(d.stato), versione: numero(d.versione) } : null,
    priorita: (['senza_dvr', 'da_aggiornare', 'revisione', 'bozza', 'in_regola'] as const).find((x) => x === pr) ?? 'bozza',
  };
}

export async function scrivaniaAziende(): Promise<AziendaScrivania[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi('/gestionale/scrivania')).data)
    .map(mappaAzienda)
    .filter((x): x is AziendaScrivania => x !== null);
}

export interface Mancante {
  tipo: string;
  etichetta: string;
  perche: string;
}

/** Dato che manca per un DVR completo, con dove si completa e cosa caricare. */
export interface DatoMancante {
  campo: string;
  motivo: string;
  scheda: string;
  carica: string | null;
}

/** Cosa manca a un documento (bozza o da creare): gli stessi controlli che bloccano l'emissione. */
export interface MancaDocumento {
  gruppo: string;
  tipo: string;
  id: number | null;
  nome: string;
  stato: 'bozza' | 'da_creare';
  voci: string[];
  altre: number;
}

export interface DatiScrivania {
  documenti: VoceDocumento[];
  mancanti: Mancante[];
  nome: string;
  ateco: string | null;
  datiMancanti: DatoMancante[];
  mancaDocumenti: MancaDocumento[];
}

export async function scrivaniaAzienda(id: number): Promise<DatiScrivania> {
  if (!isApiMode()) return { documenti: [], mancanti: [], nome: '', ateco: null, datiMancanti: [], mancaDocumenti: [] };
  const d = rec(rec(await prendi(`/gestionale/scrivania/aziende/${id}`)).data);
  const a = rec(d.azienda);
  return {
    nome: testo(a.ragione_sociale) ?? '',
    ateco: testo(a.ateco),
    documenti: lista(d.documenti).map(mappaVoce).filter((x): x is VoceDocumento => x !== null),
    mancanti: lista(d.mancanti)
      .map((x) => {
        const m = rec(x);
        const etichetta = testo(m.etichetta);
        return etichetta ? { tipo: testo(m.tipo) ?? '', etichetta, perche: testo(m.perche) ?? '' } : null;
      })
      .filter((x): x is Mancante => x !== null),
    datiMancanti: lista(rec(d.cosa_manca_dvr).voci)
      .map((x) => {
        const m = rec(x);
        const campo = testo(m.campo);
        return campo ? { campo, motivo: testo(m.motivo) ?? '', scheda: testo(m.scheda) ?? 'panoramica', carica: testo(m.carica) } : null;
      })
      .filter((x): x is DatoMancante => x !== null),
    mancaDocumenti: lista(d.cosa_manca_documenti)
      .map((x): MancaDocumento | null => {
        const m = rec(x);
        const nome = testo(m.nome);
        const voci = lista(m.voci).map((v) => testo(rec(v).messaggio)).filter((v): v is string => !!v);
        if (!nome || voci.length === 0) return null;
        return { gruppo: testo(m.gruppo) ?? 'documento', tipo: testo(m.tipo) ?? '', id: numero(m.id), nome, stato: testo(m.stato) === 'da_creare' ? 'da_creare' : 'bozza', voci, altre: numero(m.altre) ?? 0 };
      })
      .filter((x): x is MancaDocumento => x !== null),
  };
}

// ---------------------------------------------------------------- qualità

export interface SchedaQualita {
  punteggio: number;
  livello: string;
  bloccanti: number;
  prontoPerRevisione: boolean;
  componenti: Array<{ chiave: string; titolo: string; punti: number | null; max: number; nota: string | null }>;
  miglioramenti: Miglioramento[];
  riferimenti: Array<{ voce: string; trovato: string; sostituitoDa: string | null; esito: string }>;
  modello: string | null;
}

export function mappaQualita(raw: unknown): SchedaQualita {
  const d = rec(rec(raw).data);
  return {
    punteggio: numero(d.punteggio) ?? 0,
    livello: testo(d.livello) ?? '',
    bloccanti: numero(d.bloccanti) ?? 0,
    prontoPerRevisione: d.pronto_per_revisione === true,
    componenti: lista(d.componenti).map((x) => {
      const c = rec(x);
      return { chiave: testo(c.chiave) ?? '', titolo: testo(c.titolo) ?? testo(c.chiave) ?? '', punti: numero(c.punti), max: numero(c.max) ?? 0, nota: testo(c.nota) };
    }),
    miglioramenti: lista(d.miglioramenti)
      .map((x) => {
        const m = rec(x);
        const azione = testo(m.azione);
        return azione ? { componente: testo(m.componente) ?? '', guadagno: numero(m.guadagno) ?? 0, azione } : null;
      })
      .filter((x): x is Miglioramento => x !== null),
    riferimenti: lista(d.riferimenti_superati).map((x) => {
      const r = rec(x);
      return { voce: testo(r.voce) ?? '', trovato: testo(r.trovato) ?? testo(r.estratto) ?? '', sostituitoDa: testo(r.sostituito_da), esito: testo(r.esito) ?? '' };
    }),
    modello: testo(rec(d.modello).titolo),
  };
}

export async function qualita(gruppo: GruppoDoc, id: number): Promise<SchedaQualita | null> {
  if (!isApiMode()) return null;
  return mappaQualita(await prendi(`/gestionale/scrivania/qualita/${gruppo}/${id}`));
}

// ---------------------------------------------------------------- DVR

export interface SezioneDvr {
  key: string;
  title: string;
  body: string;
  origine: string;
}

export interface RevisioneDvr {
  numero: number;
  origine: string;
  autore: string | null;
  motivo: string | null;
  quando: string | null;
  sezioniModificate: string[];
  haFile: boolean;
}

function mappaRevisione(x: unknown): RevisioneDvr | null {
  const r = rec(x);
  const n = numero(r.numero);
  if (n === null) return null;
  return {
    numero: n,
    origine: testo(r.origine) ?? 'ai',
    autore: testo(r.autore),
    motivo: testo(r.motivo),
    quando: testo(r.created_at),
    sezioniModificate: lista(r.sezioni_modificate).map(String),
    haFile: r.ha_file === true,
  };
}

export async function revisioniDvr(id: number): Promise<RevisioneDvr[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/dvr/${id}/revisions`)).data)
    .map(mappaRevisione)
    .filter((x): x is RevisioneDvr => x !== null);
}

export async function sezioniDvr(id: number, numeroRev: number): Promise<SezioneDvr[]> {
  if (!isApiMode()) return [];
  return lista(rec(rec(await prendi(`/dvr/${id}/revisions/${numeroRev}`)).data).sezioni)
    .map((x) => {
      const s = rec(x);
      const key = testo(s.key);
      return key ? { key, title: testo(s.title) ?? key, body: typeof s.body === 'string' ? s.body : '', origine: testo(s.origine) ?? 'ai' } : null;
    })
    .filter((x): x is SezioneDvr => x !== null);
}

export async function salvaSezione(id: number, s: { key: string; title: string; body: string }, motivo: string): Promise<number | null> {
  const r = rec(rec(await manda(`/dvr/${id}/revisions`, { modifiche: [s], motivo: motivo.trim() || null })).data);
  return numero(r.numero);
}

export async function ripristinaRevisione(id: number, numeroRev: number): Promise<void> {
  await manda(`/dvr/${id}/revisions/${numeroRev}/restore`);
}

export async function inviaInRevisione(id: number): Promise<void> {
  await manda(`/dvr/${id}`, { status: 'review' }, 'PATCH');
}

export async function approvaDvr(id: number): Promise<void> {
  await manda(`/dvr/${id}/approve`);
}

export async function generaDvr(id: number): Promise<void> {
  await manda(`/dvr/${id}/generate`, { riscrivi_modifiche_umane: false });
}

/** Nuovo DVR dell'azienda con il materiale scelto dall'archivio, poi avvio della Crew. */
export async function nuovoDvr(aziendaId: number, nome: string, ateco: string | null, materiale: number[]): Promise<number> {
  const r = rec(
    await manda('/dvr', {
      company_id: aziendaId,
      payload: {
        sezione_a: { ragione_sociale: nome, ateco: ateco ?? '', data_redazione: new Date().toISOString().slice(0, 10) },
        selected_document_ids: materiale,
      },
    })
  );
  const id = numero(rec(r.data).id) ?? numero(r.id);
  if (id === null) throw new Error('Il DVR non è stato creato. Riprova.');
  await generaDvr(id);
  return id;
}

export interface StatoGenerazione {
  stato: string;
  errore: string | null;
  passi: PassoGenerazione[];
  dvrStato: string;
}

export function mappaGenerazione(raw: unknown): StatoGenerazione {
  const r = rec(raw);
  const g = rec(r.generation);
  return {
    stato: testo(g.status) ?? 'idle',
    errore: testo(g.error),
    dvrStato: testo(r.dvr_status) ?? '',
    passi: lista(r.avanzamento).map((x) => {
      const p = rec(x);
      const s = testo(p.stato);
      return {
        agente: testo(p.agente) ?? '',
        etichetta: testo(p.etichetta) ?? '',
        stato: s === 'in_corso' || s === 'fatto' || s === 'errore' || s === 'saltato' ? s : 'attesa',
        secondi: numero(p.secondi),
      };
    }),
  };
}

export async function statoGenerazione(id: number): Promise<StatoGenerazione> {
  return mappaGenerazione(await prendi(`/dvr/${id}/generation-status`));
}

export interface Materiale {
  id: number;
  titolo: string;
  tipo: string;
  analizzato: boolean;
}

export async function materialeAzienda(aziendaId: number): Promise<Materiale[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/company-documents?company_id=${aziendaId}`)).data)
    .map((x) => {
      const d = rec(x);
      const id = numero(d.id);
      if (id === null) return null;
      return {
        id,
        titolo: testo(d.titolo) ?? testo(d.filename) ?? `Documento ${id}`,
        tipo: testo(d.tipo) ?? 'documento',
        analizzato: (testo(d.testo_analisi) ?? '').length > 0,
      };
    })
    .filter((x): x is Materiale => x !== null);
}

// ---------------------------------------------------------------- valutazioni e documenti HSE

export async function segnaPronta(id: number): Promise<void> {
  await manda(`/gestionale/scrivania/valutazioni/${id}/pronta`);
}

export async function emetti(gruppo: 'valutazione' | 'documento', id: number): Promise<number | null> {
  return numero(rec(rec(await manda(`/gestionale/scrivania/${gruppo}/${id}/emetti`, { conferma: true })).data).revisione);
}

export function mappaSegnalazioni(v: unknown): Segnalazione[] {
  return lista(v)
    .map((x) => {
      const s = rec(x);
      const esito = testo(s.esito);
      const messaggio = testo(s.messaggio);
      if (!messaggio || (esito !== 'blocca' && esito !== 'corregge' && esito !== 'avvisa')) return null;
      return {
        chiave: testo(s.chiave) ?? messaggio,
        esito,
        messaggio,
        riferimento: testo(s.riferimento),
        dove: testo(s.dove),
        accettabile: s.accettabile === true,
        accettata: s.accettata != null && s.accettata !== false,
      } as Segnalazione;
    })
    .filter((x): x is Segnalazione => x !== null);
}

/** Controlli del documento HSE (DUVRI, HACCP, piano di emergenza...). */
export async function controlliDocumento(id: number): Promise<Segnalazione[]> {
  if (!isApiMode()) return [];
  return mappaSegnalazioni(rec(rec(rec(await prendi(`/documenti-hse/${id}`)).data).controllo).segnalazioni);
}

// ---------------------------------------------------------------- download

const URL_DOWNLOAD: Record<GruppoDoc, (id: number, f: 'pdf' | 'docx', rev?: number) => string> = {
  dvr: (id, f, rev) => (rev && rev > 0 ? `/dvr/${id}/revisions/${rev}/download/${f}` : `/dvr/${id}/download/${f}`),
  valutazione: (id, f) => `/valutazioni/${id}/download/${f}`,
  documento: (id, f) => `/documenti-hse/${id}/download/${f}`,
  pos: (id, f) => `/pos/${id}/download/${f}`,
};

/** Scarica Word o PDF con il token: il file non è pubblico. */
export async function scarica(gruppo: GruppoDoc, id: number, formato: 'pdf' | 'docx', nome: string, revisione?: number): Promise<void> {
  const token = getToken();
  const res = await fetchConTempo(apiUrl(URL_DOWNLOAD[gruppo](id, formato, revisione)), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 404) throw new Error('Il file non è ancora disponibile: genera il documento o aspetta che finisca.');
  if (!res.ok) throw new Error('Download non riuscito. Riprova.');
  // Web: download del browser. App: visore del telefono e copia cifrata tra i file recenti.
  await consegnaFile(await res.blob(), nome, `${gruppo}:${id}:${formato}:${revisione ?? 0}`);
}

// ---------------------------------------------------------------- POS e PiMUS

export interface CantiereBreve {
  id: number;
  denominazione: string;
  indirizzo: string | null;
  inizio: string | null;
  fine: string | null;
  committente: string | null;
  aziendaId: number | null;
  /** Il cantiere ha già un PSC collegato (caricato dallo studio o dal link pubblico). */
  haPsc?: boolean;
}

export interface PosVoce {
  id: number;
  aziendaId: number;
  cantiereId: number | null;
  stato: 'bozza' | 'pronto' | 'emesso';
  revisione: number;
  fasi: number;
  bloccanti: number;
  avvisi: number;
  emessoIl: string | null;
  aggiornatoIl: string | null;
}

export function mappaPos(raw: unknown): PosVoce | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const c = rec(rec(r.ultimo_controllo).conteggi);
  const s = testo(r.stato);
  return {
    id,
    aziendaId: numero(r.company_id) ?? 0,
    cantiereId: numero(r.cantiere_id),
    stato: s === 'pronto' || s === 'emesso' ? s : 'bozza',
    revisione: numero(r.revisione_corrente) ?? 0,
    fasi: lista(r.fasi).length,
    bloccanti: (numero(c.blocca) ?? 0) + (numero(c.corregge) ?? 0),
    avvisi: numero(c.avvisa) ?? 0,
    emessoIl: testo(r.emesso_il),
    aggiornatoIl: testo(r.updated_at),
  };
}

export function mappaCantiere(raw: unknown): CantiereBreve | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const com = r.committente;
  return {
    id,
    denominazione: testo(r.denominazione) ?? `Cantiere ${id}`,
    indirizzo: [testo(r.indirizzo), testo(r.comune)].filter(Boolean).join(', ') || null,
    inizio: testo(r.data_inizio)?.slice(0, 10) ?? null,
    fine: testo(r.data_fine)?.slice(0, 10) ?? null,
    committente: typeof com === 'string' ? testo(com) : testo(rec(com).nome) ?? testo(rec(com).ragione_sociale),
    aziendaId: numero(r.company_id),
    haPsc: numero(r.psc_document_id) !== null,
  };
}

const conAzienda = (aziendaId?: number | null) => (aziendaId ? `&company_id=${aziendaId}` : '');

export async function elencoPos(aziendaId?: number | null): Promise<PosVoce[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/pos?per_page=100${conAzienda(aziendaId)}`)).data)
    .map(mappaPos)
    .filter((x): x is PosVoce => x !== null);
}

export async function elencoCantieri(aziendaId?: number | null): Promise<CantiereBreve[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/cantieri?per_page=100${conAzienda(aziendaId)}`)).data)
    .map(mappaCantiere)
    .filter((x): x is CantiereBreve => x !== null);
}

export interface PimusVoce {
  id: number;
  aziendaId: number;
  cantiereId: number | null;
  titolo: string | null;
  stato: 'bozza' | 'emesso';
  revisione: number;
  bloccanti: number;
}

export async function elencoPimus(aziendaId?: number | null): Promise<PimusVoce[]> {
  if (!isApiMode()) return [];
  return lista(rec(await prendi(`/documenti-hse?tipo=pimus&per_page=100${conAzienda(aziendaId)}`)).data)
    .map((x) => {
      const r = rec(x);
      const id = numero(r.id);
      if (id === null) return null;
      const c = rec(rec(r.ultimo_controllo).conteggi);
      return {
        id,
        aziendaId: numero(r.company_id) ?? 0,
        cantiereId: numero(r.cantiere_id),
        titolo: testo(r.titolo),
        stato: r.stato === 'emesso' ? 'emesso' : 'bozza',
        revisione: numero(r.revisione_corrente) ?? 0,
        bloccanti: (numero(c.blocca) ?? 0) + (numero(c.corregge) ?? 0),
      } as PimusVoce;
    })
    .filter((x): x is PimusVoce => x !== null);
}

export async function controllaPos(id: number, accetta: Array<{ chiave: string; motivo: string }> = []): Promise<{ segnalazioni: Segnalazione[]; puoEmettere: boolean }> {
  const d = rec(rec(await manda(`/pos/${id}/check`, accetta.length ? { accetta } : {})).data);
  return { segnalazioni: mappaSegnalazioni(d.segnalazioni), puoEmettere: d.puo_emettere === true };
}

export async function posPronto(id: number): Promise<void> {
  await manda(`/pos/${id}/pronto`);
}

export async function posEmetti(id: number): Promise<void> {
  await manda(`/pos/${id}/emit`, { conferma: true });
}

/** Prepara la bozza Word e PDF del POS (non crea revisioni). */
export async function posAnteprima(id: number): Promise<void> {
  await manda(`/pos/${id}/anteprima`);
}
