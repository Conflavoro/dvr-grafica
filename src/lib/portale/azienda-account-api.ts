/**
 * Area azienda (V4): documenti emessi, fascicolo a cartelle, caricamenti,
 * condivisioni, revisioni, utenti e inviti, avvio, Pronto Ispezioni, messaggi.
 * Ogni chiamata torna vuota quando il backend non e' attivo (demo) e ogni
 * risposta passa da un mappatore tollerante.
 */

import { ApiError, apiRequest, apiUpload, apiUrl, getToken } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';
import { consegnaFile } from '@/lib/app/file-recenti';

// ================================================================ documenti

export type GruppoDocumento =
  | 'dvr'
  | 'pos'
  | 'duvri'
  | 'pimus'
  | 'haccp'
  | 'valutazioni'
  | 'verbali'
  | 'nomine'
  | 'procedure'
  | 'emergenza'
  | 'altro';

export const GRUPPI_DOCUMENTO: Array<{ k: GruppoDocumento; t: string }> = [
  { k: 'dvr', t: 'Valutazione dei rischi (DVR)' },
  { k: 'valutazioni', t: 'Valutazioni specifiche' },
  { k: 'emergenza', t: 'Piano di emergenza' },
  { k: 'nomine', t: 'Nomine' },
  { k: 'procedure', t: 'Procedure' },
  { k: 'verbali', t: 'Verbali' },
  { k: 'pos', t: 'POS' },
  { k: 'pimus', t: 'PiMUS' },
  { k: 'duvri', t: 'DUVRI' },
  { k: 'haccp', t: 'HACCP' },
  { k: 'altro', t: 'Altri documenti' },
];

/** Gruppo di un documento dal "genere" che manda il backend (DocumentiAzienda). */
export function gruppoDi(genere: string): GruppoDocumento {
  if (genere === 'dvr') return 'dvr';
  if (genere === 'pos') return 'pos';
  if (genere.startsWith('valutazione') || genere === 'radon') return 'valutazioni';
  if (genere === 'sopralluogo' || genere === 'riunione') return 'verbali';
  if (genere === 'nomina') return 'nomine';
  if (genere === 'procedura') return 'procedure';
  if (genere === 'emergenza') return 'emergenza';
  if (genere === 'duvri' || genere === 'pimus' || genere === 'haccp') return genere;
  return 'altro';
}

export interface DocumentoEmesso {
  tipo: 'dvr' | 'pos' | 'valutazione' | 'documento';
  id: number;
  titolo: string;
  genere: string;
  gruppo: GruppoDocumento;
  revisione: number;
  emessoIl: string | null;
  pdf: string | null;
  docx: string | null;
}

const TIPI_DOC = ['dvr', 'pos', 'valutazione', 'documento'] as const;

export function mappaDocumento(raw: unknown): DocumentoEmesso | null {
  const r = rec(raw);
  const id = numero(r.id);
  const tipo = testo(r.tipo);
  if (id === null || !tipo || !(TIPI_DOC as readonly string[]).includes(tipo)) return null;
  const genere = testo(r.genere) ?? tipo;
  const d = rec(r.download);
  return {
    tipo: tipo as DocumentoEmesso['tipo'],
    id,
    titolo: testo(r.titolo) ?? 'Documento',
    genere,
    gruppo: gruppoDi(genere),
    revisione: numero(r.revisione) ?? 1,
    emessoIl: testo(r.emesso_il),
    pdf: testo(d.pdf),
    docx: testo(d.docx),
  };
}

/** Raggruppa per tipo nell'ordine dei gruppi; dentro il gruppo, il piu' recente prima. */
export function raggruppa(docs: DocumentoEmesso[]): Array<{ gruppo: GruppoDocumento; titolo: string; voci: DocumentoEmesso[] }> {
  return GRUPPI_DOCUMENTO.map((g) => ({
    gruppo: g.k,
    titolo: g.t,
    voci: docs.filter((d) => d.gruppo === g.k).sort((a, b) => (b.emessoIl ?? '').localeCompare(a.emessoIl ?? '')),
  })).filter((g) => g.voci.length > 0);
}

export async function documentiEmessi(aziendaId: number): Promise<DocumentoEmesso[]> {
  if (!isApiMode()) return [];
  const r = rec(await prendi(`/portale/aziende/${aziendaId}/documenti`));
  return lista(r.data).map(mappaDocumento).filter((x): x is DocumentoEmesso => x !== null);
}

/** Scarica un file protetto (JWT) e lo salva con il nome che dà il server. */
export async function scaricaFile(path: string, riserva: string): Promise<void> {
  const token = getToken();
  const p = path.startsWith('/api/') ? path.slice(4) : path;
  let res: Response;
  try {
    res = await fetch(apiUrl(p), { headers: token ? { Authorization: `Bearer ${token}`, Accept: '*/*' } : {} });
  } catch {
    throw new Error('Rete non disponibile: riprova tra poco.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw erroreLeggibile(new ApiError(res.status, body, testo(rec(body).message) ?? 'Download non riuscito'), 'Download non riuscito.');
  }
  const b = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const nome = m ? decodeURIComponent(m[1]) : riserva;
  await consegnaFile(b, nome, p);
}

export async function chiediRevisione(aziendaId: number, d: Pick<DocumentoEmesso, 'tipo' | 'id'>, motivo: string): Promise<number | null> {
  const r = rec(await manda(`/portale/documenti/${d.tipo}/${d.id}/revisione`, { azienda_id: aziendaId, motivo }));
  return numero(rec(r.data).id);
}

// ================================================================ fascicolo

export interface VoceFascicolo {
  id: string;
  /** Documento caricato (scaricabile dal fascicolo) o documento della piattaforma. */
  caricato: boolean;
  titolo: string;
  data: string | null;
  scadenza: string | null;
  esito: string | null;
  haFile: boolean;
}

export interface Cartella {
  chiave: string;
  nome: string;
  documenti: number;
  voci: VoceFascicolo[];
  visite: Array<{ lavoratore: string; mansione: string | null; ultima: string | null; validaFino: string | null }>;
  nota: string | null;
}

export function mappaCartella(raw: unknown): Cartella | null {
  const r = rec(raw);
  const chiave = testo(r.chiave);
  if (!chiave) return null;
  return {
    chiave,
    nome: testo(r.nome) ?? chiave,
    documenti: numero(r.documenti) ?? 0,
    voci: lista(r.elementi).map((x) => {
      const v = rec(x);
      const idNum = numero(v.id);
      return {
        id: String(v.id ?? ''),
        caricato: idNum !== null && v.virtuale !== true,
        titolo: testo(v.titolo) ?? 'Documento',
        data: testo(v.data),
        scadenza: testo(v.scadenza),
        esito: testo(v.esito),
        haFile: v.ha_file === true,
      };
    }),
    visite: lista(r.visite).map((x) => {
      const v = rec(x);
      return { lavoratore: testo(v.lavoratore) ?? '', mansione: testo(v.mansione), ultima: testo(v.ultima_visita), validaFino: testo(v.valida_fino_al) };
    }),
    nota: testo(r.nota),
  };
}

export async function cartelle(aziendaId: number): Promise<Cartella[]> {
  if (!isApiMode()) return [];
  const r = rec(rec(await prendi(`/portale/aziende/${aziendaId}/fascicolo`)).data);
  return lista(r.cartelle).map(mappaCartella).filter((x): x is Cartella => x !== null);
}

export interface Caricamento {
  cartella: string;
  titolo: string;
  data?: string;
  scadenza?: string;
  file: File;
}

/** Errore del modulo di caricamento prima dell'invio, o null se va bene. */
export function validaCaricamento(c: Partial<Caricamento>, oggi: string): string | null {
  if (!c.cartella) return 'Scegli la cartella.';
  if (!c.titolo || c.titolo.trim().length < 2) return 'Scrivi il nome del documento, così lo ritrovi nel fascicolo.';
  if (c.data && c.data > oggi) return 'La data del documento non può essere futura.';
  if (c.data && c.scadenza && c.scadenza <= c.data) return 'La scadenza deve venire dopo la data del documento.';
  if (!c.file) return 'Scegli il file da caricare.';
  if (c.file.size > 20 * 1024 * 1024) return 'Il file supera i 20 MB.';
  return null;
}

/** Nome o titolo che fanno pensare a un documento sanitario (lo blocca comunque il server). */
export function sembraSanitario(...parti: Array<string | null | undefined>): boolean {
  const t = parti.filter(Boolean).join(' ').toLowerCase().replace(/[_.-]+/g, ' ');
  if (/protocollo sanitario|nomina|relazione sanitaria/.test(t)) return false;
  return /giudiz|idoneit|referto|referti|esami|esito|cartella sanitaria|cartella clinica|anamnesi/.test(t);
}

export async function caricaDocumento(aziendaId: number, c: Caricamento, avanzamento?: (p: number) => void): Promise<{ id: number; nota: string | null }> {
  const fd = new FormData();
  fd.append('file', c.file);
  fd.append('cartella', c.cartella);
  fd.append('titolo', c.titolo.trim());
  if (c.data) fd.append('data', c.data);
  if (c.scadenza) fd.append('scadenza', c.scadenza);
  try {
    const r = rec(rec(await apiUpload(`/portale/aziende/${aziendaId}/documenti/carica`, fd, avanzamento)).data);
    return { id: numero(r.id) ?? 0, nota: testo(r.nota) };
  } catch (e) {
    throw erroreLeggibile(e, 'Caricamento non riuscito.');
  }
}

// ================================================================ condivisioni

export interface Condivisione {
  id: number;
  cartelle: string[];
  destinatario: string;
  motivo: string | null;
  scadeIl: string | null;
  valida: boolean;
  revocata: boolean;
  aperture: number;
}

export function mappaCondivisione(raw: unknown): Condivisione | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  return {
    id,
    cartelle: lista(r.cartelle).map(String),
    destinatario: testo(r.destinatario) ?? '',
    motivo: testo(r.motivo),
    scadeIl: testo(r.scade_il),
    valida: r.valida === true,
    revocata: r.revocata_il != null,
    aperture: lista(r.accessi).length,
  };
}

/** Stato del link come nel prototipo: attivo, scade presto (entro 7 giorni), scaduto o revocato. */
export function statoCondivisione(c: Condivisione, ora: Date = new Date()): 'attivo' | 'presto' | 'scaduto' | 'revocato' {
  if (c.revocata) return 'revocato';
  if (!c.valida || !c.scadeIl) return 'scaduto';
  const giorni = (new Date(c.scadeIl).getTime() - ora.getTime()) / 86400000;
  return giorni <= 7 ? 'presto' : 'attivo';
}

export async function condivisioni(aziendaId: number): Promise<{ ammesse: string[]; giorniMax: number; voci: Condivisione[] }> {
  if (!isApiMode()) return { ammesse: [], giorniMax: 90, voci: [] };
  const r = rec(rec(await prendi(`/portale/aziende/${aziendaId}/condivisioni`)).data);
  return {
    ammesse: lista(r.cartelle_ammesse).map(String),
    giorniMax: numero(r.giorni_massimi) ?? 90,
    voci: lista(r.condivisioni).map(mappaCondivisione).filter((x): x is Condivisione => x !== null),
  };
}

export async function creaCondivisione(aziendaId: number, d: { cartelle: string[]; destinatario: string; giorni: number; motivo?: string }): Promise<{ link: string; voce: Condivisione | null }> {
  const r = rec(rec(await manda(`/portale/aziende/${aziendaId}/condivisioni`, d)).data);
  return { link: testo(r.link) ?? '', voce: mappaCondivisione(r.condivisione) };
}

export async function revocaCondivisione(id: number): Promise<void> {
  await manda(`/portale/condivisioni/${id}`, undefined, 'DELETE');
}

// ================================================================ utenti

export interface UtenteAzienda {
  ruoloId: number | null;
  utenteId: number | null;
  nome: string;
  email: string;
  ruolo: string;
  etichetta: string;
  stato: 'invitato' | 'attivo' | 'revocato';
  invitoScadeIl: string | null;
  scadeIl: string | null;
}

export function mappaUtente(raw: unknown): UtenteAzienda | null {
  const r = rec(raw);
  const ruolo = testo(r.ruolo);
  if (!ruolo) return null;
  const s = testo(r.stato);
  return {
    ruoloId: numero(r.id),
    utenteId: numero(r.utente_id),
    nome: testo(r.nome) ?? '',
    email: testo(r.email) ?? '',
    ruolo,
    etichetta: testo(r.etichetta) ?? ruolo,
    stato: s === 'invitato' || s === 'revocato' ? s : r.attivo === false ? 'revocato' : 'attivo',
    invitoScadeIl: testo(r.invito_scade_il),
    scadeIl: testo(r.scade_il),
  };
}

const ORDINE_STATO = { attivo: 0, invitato: 1, revocato: 2 } as const;

export function ordinaUtenti(u: UtenteAzienda[]): UtenteAzienda[] {
  return [...u].sort((a, b) => ORDINE_STATO[a.stato] - ORDINE_STATO[b.stato] || (a.ruolo === 'titolare' ? -1 : b.ruolo === 'titolare' ? 1 : a.nome.localeCompare(b.nome)));
}

export async function utentiAzienda(aziendaId: number): Promise<UtenteAzienda[]> {
  if (!isApiMode()) return [];
  const r = rec(await prendi(`/portale/aziende/${aziendaId}/utenti`));
  return ordinaUtenti(lista(r.data).map(mappaUtente).filter((x): x is UtenteAzienda => x !== null));
}

export async function invitaUtente(aziendaId: number, d: { nome: string; email: string; ruolo: string; scade_il?: string }): Promise<void> {
  await manda(`/portale/aziende/${aziendaId}/utenti`, d);
}

/** Chi segue la sicurezza dell'azienda: lo studio e il tecnico, oppure l'HSE proprio. */
export interface ChiSegue {
  gestione: 'studio' | 'interna';
  studio: string | null;
  tecnico: string | null;
  hse: Array<{ id: number; nome: string; email: string; stato: 'attivo' | 'invitato'; invitoScadeIl: string | null }>;
  puoInvitareHse: boolean;
}

export function mappaChiSegue(raw: unknown): ChiSegue {
  const r = rec(raw);
  return {
    gestione: r.gestione === 'interna' ? 'interna' : 'studio',
    studio: testo(rec(r.studio).nome),
    tecnico: testo(rec(r.tecnico).nome),
    hse: lista(r.hse).flatMap((x) => {
      const h = rec(x);
      const id = numero(h.id);
      return id === null ? [] : [{ id, nome: testo(h.nome) ?? '', email: testo(h.email) ?? '', stato: h.stato === 'invitato' ? ('invitato' as const) : ('attivo' as const), invitoScadeIl: testo(h.invito_scade_il) }];
    }),
    puoInvitareHse: r.puo_invitare_hse === true,
  };
}

export async function chiSegue(aziendaId: number): Promise<ChiSegue | null> {
  if (!isApiMode()) return null;
  return mappaChiSegue(rec(await prendi(`/portale/aziende/${aziendaId}/chi-segue`)).data);
}

export async function invitaHse(aziendaId: number, d: { nome: string; email: string }): Promise<void> {
  await manda(`/portale/aziende/${aziendaId}/hse`, d);
}

export async function reinviaInvito(ruoloId: number): Promise<void> {
  await manda(`/portale/ruoli/${ruoloId}/reinvia`);
}

export async function revocaAccesso(ruoloId: number): Promise<void> {
  await manda(`/portale/ruoli/${ruoloId}`, undefined, 'DELETE');
}

export interface Matrice {
  ruoli: Array<{ chiave: string; etichetta: string; esterno: boolean }>;
  righe: Array<{ azione: string; gruppo: string; frase: string; ruoli: Record<string, boolean> }>;
  note: string[];
}

export async function matricePermessi(): Promise<Matrice> {
  if (!isApiMode()) return { ruoli: [], righe: [], note: [] };
  const r = rec(rec(await prendi('/portale/ruoli/matrice')).data);
  return {
    ruoli: lista(r.ruoli).map((x) => {
      const v = rec(x);
      return { chiave: testo(v.chiave) ?? '', etichetta: testo(v.etichetta) ?? '', esterno: v.esterno === true };
    }),
    righe: lista(r.righe).map((x) => {
      const v = rec(x);
      const ruoli = rec(v.ruoli);
      return { azione: testo(v.azione) ?? '', gruppo: testo(v.gruppo) ?? 'Altro', frase: testo(v.frase) ?? '', ruoli: Object.fromEntries(Object.entries(ruoli).map(([k, b]) => [k, b === true])) };
    }),
    note: lista(r.note).map(String),
  };
}

// ================================================================ invito (pubblico)

export const TOKEN_INVITO = /^inv_[A-Za-z0-9]{40}$/;

export interface Invito {
  email: string;
  nome: string;
  azienda: string;
  etichetta: string;
  studio: string | null;
  scadeIl: string | null;
}

/** Regole della password come il server: almeno 12 caratteri, lettere e numeri. */
export function controllaPassword(p: string, ripeti: string): string | null {
  if (p.length < 12) return 'La password deve avere almeno 12 caratteri.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Usa lettere e numeri insieme.';
  if (p !== ripeti) return 'Le due password non coincidono.';
  return null;
}

export async function mostraInvito(token: string): Promise<Invito> {
  try {
    const r = rec(rec(await apiRequest(`/inviti/${token}`, { method: 'GET', anonymous: true })).data);
    return {
      email: testo(r.email) ?? '',
      nome: testo(r.nome) ?? '',
      azienda: testo(rec(r.azienda).ragione_sociale) ?? '',
      etichetta: testo(r.etichetta) ?? '',
      studio: testo(r.studio),
      scadeIl: testo(r.scade_il),
    };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 410 || e.status === 404)) throw new Error(testo(rec(e.body).message) ?? 'Invito non trovato.');
    throw erroreLeggibile(e);
  }
}

export async function accettaInvito(token: string, password: string): Promise<string> {
  try {
    const r = rec(await apiRequest(`/inviti/${token}`, { method: 'POST', anonymous: true, body: { password } }));
    const t = testo(r.access_token);
    if (!t) throw new Error('Accesso non riuscito.');
    return t;
  } catch (e) {
    if (e instanceof ApiError && e.status === 410) throw new Error(testo(rec(e.body).message) ?? 'Invito non più valido.');
    throw erroreLeggibile(e);
  }
}

// ================================================================ avvio

export interface PassoAvvio {
  numero: number;
  nome: string;
  stato: string;
  nota: string | null;
  documenti: number;
  letti: number;
  inLettura: number;
  bloccati: number;
  ultimi: Array<{ id: number; titolo: string; letto: boolean }>;
  daConfermare: Array<{ id: number; titolo: string }>;
  mancanti: Array<{ voce: string; campo: string; essenziale: boolean; domanda: string }>;
  utenti: number;
}

export interface SchedaAvvio {
  passi: PassoAvvio[];
  rspp: string | null;
  medico: string | null;
  pagatoIl: string | null;
  fascicoloEntro: string | null;
  validataIl: string | null;
  inRitardo: boolean;
}

export function mappaAvvio(raw: unknown): SchedaAvvio {
  const r = rec(raw);
  const dom = rec(r.domande);
  return {
    passi: lista(r.passi).map((x) => {
      const p = rec(x);
      return {
        numero: numero(p.numero) ?? 0,
        nome: testo(p.nome) ?? '',
        stato: testo(p.stato) ?? 'da_fare',
        nota: testo(p.nota),
        documenti: numero(p.documenti) ?? 0,
        letti: numero(p.letti) ?? 0,
        inLettura: numero(p.in_lettura) ?? 0,
        bloccati: numero(p.sanitari_bloccati) ?? 0,
        ultimi: lista(p.ultimi).map((u) => ({ id: numero(rec(u).id) ?? 0, titolo: testo(rec(u).titolo) ?? 'Documento', letto: rec(u).letto === true })),
        daConfermare: lista(p.da_confermare).map((u) => ({ id: numero(rec(u).proposta_id) ?? 0, titolo: testo(rec(u).titolo) ?? '' })),
        mancanti: lista(p.mancanti).map((u) => {
          const m = rec(u);
          return { voce: testo(m.voce) ?? '', campo: testo(m.campo) ?? '', essenziale: m.essenziale === true, domanda: testo(m.domanda) ?? '' };
        }),
        utenti: lista(p.utenti).length,
      };
    }),
    rspp: testo(rec(dom.rspp).modalita),
    medico: testo(rec(dom.medico).modalita),
    pagatoIl: testo(r.pagato_il),
    fascicoloEntro: testo(r.fascicolo_entro),
    validataIl: testo(r.validata_il),
    inRitardo: r.in_ritardo === true,
  };
}

/** Percentuale dei passi fatti (un passo "in corso" vale mezzo). */
export function percentualeAvvio(s: SchedaAvvio): number {
  if (s.passi.length === 0) return 0;
  const punti = s.passi.reduce((t, p) => t + (p.stato === 'fatto' ? 1 : p.stato === 'in_corso' ? 0.5 : 0), 0);
  return Math.round((punti / s.passi.length) * 100);
}

export async function schedaAvvio(aziendaId: number): Promise<SchedaAvvio | null> {
  if (!isApiMode()) return null;
  return mappaAvvio(rec(await prendi(`/portale/aziende/${aziendaId}/avvio`)).data);
}

export async function rispondiAvvio(aziendaId: number, d: { rspp?: { modalita: string; nominativo?: string }; medico?: { modalita: string; nome?: string; email?: string } }): Promise<void> {
  await manda(`/portale/aziende/${aziendaId}/avvio`, d);
}

// ================================================================ Pronto Ispezioni

export interface VoceMostrare {
  chiave: string;
  voce: string;
  esito: string;
  messaggio: string | null;
  riferimento: string | null;
}

export interface Richiesta {
  id: number;
  ente: string | null;
  messaggio: string | null;
  richiestaIl: string | null;
  entro: string | null;
  stato: 'in_attesa' | 'presa_in_carico' | 'richiamata' | 'chiusa';
  inRitardo: boolean;
}

export interface StatoPronto {
  minuti: number;
  pronti: number;
  totale: number;
  mostra: VoceMostrare[];
  referente: { nome: string; email: string; ruolo: string } | null;
  richieste: Richiesta[];
  ultime: Array<{ data: string | null; ente: string; esito: string | null }>;
}

export function mappaRichiesta(raw: unknown): Richiesta | null {
  const r = rec(raw);
  const id = numero(r.richiesta_id);
  if (id === null) return null;
  const s = testo(r.stato);
  return {
    id,
    ente: testo(r.ente),
    messaggio: testo(r.messaggio),
    richiestaIl: testo(r.richiesta_il),
    entro: testo(r.obiettivo_entro),
    stato: s === 'presa_in_carico' || s === 'richiamata' || s === 'chiusa' ? s : 'in_attesa',
    inRitardo: r.in_ritardo === true,
  };
}

export function mappaPronto(raw: unknown): StatoPronto {
  const r = rec(raw);
  const ref = rec(r.referente);
  return {
    minuti: numero(r.minuti_richiamata) ?? 15,
    pronti: numero(r.pronti) ?? 0,
    totale: numero(r.totale) ?? 0,
    mostra: lista(r.mostra_subito).map((x) => {
      const v = rec(x);
      return { chiave: testo(v.chiave) ?? '', voce: testo(v.voce) ?? '', esito: testo(v.esito) ?? '', messaggio: testo(v.messaggio), riferimento: testo(v.riferimento) };
    }),
    referente: testo(ref.nome) ? { nome: testo(ref.nome)!, email: testo(ref.email) ?? '', ruolo: testo(ref.ruolo) ?? '' } : null,
    richieste: lista(r.richieste_aperte).map(mappaRichiesta).filter((x): x is Richiesta => x !== null),
    ultime: lista(r.ultime_ispezioni).map((x) => {
      const v = rec(x);
      return { data: testo(v.data), ente: testo(v.ente) ?? '', esito: testo(v.esito) };
    }),
  };
}

/** Secondi che mancano alla richiamata promessa (mai negativi). */
export function secondiAllaRichiamata(entro: string | null, ora: Date = new Date()): number {
  if (!entro) return 0;
  return Math.max(0, Math.round((new Date(entro).getTime() - ora.getTime()) / 1000));
}

export async function statoPronto(aziendaId: number): Promise<StatoPronto | null> {
  if (!isApiMode()) return null;
  return mappaPronto(rec(await prendi(`/portale/aziende/${aziendaId}/pronto-ispezioni`)).data);
}

export async function attivaPronto(aziendaId: number, d: { enti: string[]; ispettore?: string; telefono?: string; messaggio?: string; presenti?: string[] }): Promise<Richiesta | null> {
  const r = rec(rec(await manda(`/portale/aziende/${aziendaId}/pronto-ispezioni`, d)).data);
  return mappaRichiesta(r.traccia);
}

// ================================================================ messaggi

export interface Conversazione {
  id: number;
  argomento: string;
  etichetta: string;
  titolo: string;
  ultimoIl: string | null;
  anteprima: string | null;
  ultimoLato: string | null;
  nonLetti: number;
  oggetto: { tipo: string; id: number } | null;
}

export interface Messaggio {
  id: number;
  lato: 'azienda' | 'studio';
  mio: boolean;
  dallaMiaParte: boolean;
  autore: string;
  testo: string | null;
  quando: string | null;
  nuovo: boolean;
  allegato: { nome: string; url: string; bytes: number | null } | null;
}

export function mappaConversazione(raw: unknown): Conversazione | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const o = rec(r.oggetto);
  return {
    id,
    argomento: testo(r.argomento) ?? 'generale',
    etichetta: testo(r.argomento_etichetta) ?? '',
    titolo: testo(r.titolo) ?? 'Conversazione',
    ultimoIl: testo(r.ultimo_il),
    anteprima: testo(r.anteprima),
    ultimoLato: testo(r.ultimo_lato),
    nonLetti: numero(r.non_letti) ?? 0,
    oggetto: testo(o.tipo) && numero(o.id) !== null ? { tipo: testo(o.tipo)!, id: numero(o.id)! } : null,
  };
}

export function mappaMessaggio(raw: unknown): Messaggio | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const a = rec(r.allegato);
  return {
    id,
    lato: r.lato === 'studio' ? 'studio' : 'azienda',
    mio: r.mio === true,
    dallaMiaParte: r.dalla_mia_parte === true,
    autore: testo(r.autore) ?? '',
    testo: testo(r.testo),
    quando: testo(r.quando),
    nuovo: r.nuovo === true,
    allegato: testo(a.url) ? { nome: testo(a.nome) ?? 'allegato', url: testo(a.url)!, bytes: numero(a.bytes) } : null,
  };
}

export async function conversazioni(aziendaId: number): Promise<{ voci: Conversazione[]; argomenti: Record<string, string>; nonLetti: number }> {
  if (!isApiMode()) return { voci: [], argomenti: {}, nonLetti: 0 };
  const r = rec(rec(await prendi(`/portale/aziende/${aziendaId}/messaggi`)).data);
  return {
    voci: lista(r.conversazioni).map(mappaConversazione).filter((x): x is Conversazione => x !== null),
    argomenti: Object.fromEntries(Object.entries(rec(r.argomenti)).map(([k, v]) => [k, String(v)])),
    nonLetti: numero(r.non_letti) ?? 0,
  };
}

export interface VistaConversazione {
  conversazione: Conversazione;
  messaggi: Messaggio[];
  referente: { nome: string; email: string; ruolo: string } | null;
}

function mappaVista(raw: unknown): VistaConversazione {
  const r = rec(raw);
  const ref = rec(r.referente);
  return {
    conversazione: mappaConversazione(r) ?? { id: 0, argomento: 'generale', etichetta: '', titolo: '', ultimoIl: null, anteprima: null, ultimoLato: null, nonLetti: 0, oggetto: null },
    messaggi: lista(r.messaggi).map(mappaMessaggio).filter((x): x is Messaggio => x !== null),
    referente: testo(ref.nome) ? { nome: testo(ref.nome)!, email: testo(ref.email) ?? '', ruolo: testo(ref.ruolo) ?? '' } : null,
  };
}

export async function apriConversazione(id: number): Promise<VistaConversazione> {
  return mappaVista(rec(await prendi(`/portale/conversazioni/${id}`)).data);
}

async function inviaModulo(path: string, campi: Record<string, string | undefined>, file?: File | null): Promise<VistaConversazione> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campi)) if (v !== undefined && v !== '') fd.append(k, v);
  if (file) fd.append('file', file);
  try {
    return mappaVista(rec(await apiUpload(path, fd)).data);
  } catch (e) {
    throw erroreLeggibile(e, 'Messaggio non inviato.');
  }
}

export function nuovaConversazione(aziendaId: number, d: { argomento: string; titolo?: string; testo?: string }, file?: File | null): Promise<VistaConversazione> {
  return inviaModulo(`/portale/aziende/${aziendaId}/messaggi`, d, file);
}

export function rispondi(convId: number, testoMsg: string, file?: File | null): Promise<VistaConversazione> {
  return inviaModulo(`/portale/conversazioni/${convId}/messaggi`, { testo: testoMsg }, file);
}

/** Separatore di giorno nella chat: Oggi, Ieri o la data lunga. */
export function giornoChat(iso: string | null, oggi: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const g = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((g(oggi) - g(d)) / 86400000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ================================================================ contratto e wallet

/**
 * Contratto e wallet: le API le prepara la squadra dell'amministrazione. Finche'
 * non ci sono, la vista mostra uno stato vuoto chiaro (404 o 405 = non ancora attivo).
 */
export async function provaSezione(path: string): Promise<Record<string, unknown> | null> {
  if (!isApiMode()) return null;
  try {
    return rec(rec(await apiRequest(path, { method: 'GET', cache: 'no-store' })).data);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw erroreLeggibile(e);
  }
}
