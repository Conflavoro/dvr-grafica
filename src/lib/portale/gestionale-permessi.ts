/**
 * Permessi dello staff nel gestionale (06 par. 5 e 6), letti dal server
 * (GET /gestionale/permessi): le viste nascondono quello che il ruolo non può
 * fare. Il controllo vero resta sul server, rotta per rotta.
 *
 * Qui anche la logica pura delle schede nuove (Avanzamento, Listino, Rinnovi,
 * Vedi come il cliente): niente DOM, si prova con Jest.
 */

'use client';

import { useEffect, useState } from 'react';
import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';
import type { TonoChip } from './gestionale-logica';

export type PermessoStaff =
  | 'approvaProposte' | 'tutteLeAziende' | 'modificaAzienda' | 'assegnaTecnico' | 'creaPreventivo' | 'confermaAdesione'
  | 'registraIncasso' | 'sospendi' | 'vediContratti' | 'vediComeCliente' | 'orePerPersona' | 'oreDiTutti' | 'cruscottoCompleto'
  | 'firmaDvr' | 'validaAvvio' | 'prenotaVisite' | 'gestisciClassi' | 'gestisciIspezioni' | 'regalaCrediti' | 'approvaCampagne'
  | 'riconcilia' | 'registraVisita' | 'gestisciGiornata' | 'caricaReferto';

export interface PermessiStaff {
  ruolo: string | null;
  etichetta: string | null;
  esterno: boolean;
  sezioni: string[];
  permessi: string[];
}

export const NESSUN_PERMESSO: PermessiStaff = { ruolo: null, etichetta: null, esterno: false, sezioni: [], permessi: [] };

export function mappaPermessi(raw: unknown): PermessiStaff {
  const d = rec(raw);
  return {
    ruolo: testo(d.ruolo),
    etichetta: testo(d.etichetta),
    esterno: d.esterno === true,
    sezioni: lista(d.sezioni).map((x) => String(x)),
    permessi: lista(d.permessi).map((x) => String(x)),
  };
}

export function puoStaff(p: PermessiStaff, permesso: PermessoStaff): boolean {
  return p.permessi.includes(permesso);
}

export async function caricaPermessi(): Promise<PermessiStaff> {
  if (!isApiMode()) return NESSUN_PERMESSO;
  return mappaPermessi(rec(await prendi('/gestionale/permessi')).data);
}

/** Permessi dell'utente corrente; finché non arrivano nessun pulsante che scrive. */
export function usePermessiStaff(attivo = true): { permessi: PermessiStaff; caricati: boolean; puo: (p: PermessoStaff) => boolean } {
  const [permessi, setPermessi] = useState<PermessiStaff>(NESSUN_PERMESSO);
  const [caricati, setCaricati] = useState(false);
  useEffect(() => {
    if (!attivo) return;
    let vivo = true;
    caricaPermessi()
      .then((p) => vivo && setPermessi(p))
      .catch(() => undefined)
      .finally(() => vivo && setCaricati(true));
    return () => {
      vivo = false;
    };
  }, [attivo]);
  return { permessi, caricati, puo: (x) => puoStaff(permessi, x) };
}

// ---------------------------------------------------------------- vedi come il cliente (06 par. 7.3)

/** Area azienda in sola lettura, come il titolare; "da" riporta alla pagina del gestionale. */
export function linkVediComeCliente(aziendaId: number, da: string): string {
  return `/azienda/dashboard/?come=isfor&az=${aziendaId}&da=${encodeURIComponent(da)}`;
}

/** Il pulsante è attivo solo con vediComeCliente e se l'azienda ha un'area cliente (un titolare attivo). */
export function statoVediComeCliente(p: PermessiStaff, haAreaCliente: boolean): { attivo: boolean; motivo: string | null } {
  if (!puoStaff(p, 'vediComeCliente')) return { attivo: false, motivo: 'Il tuo ruolo non può aprire l’area del cliente' };
  return { attivo: haAreaCliente, motivo: null };
}

// ---------------------------------------------------------------- preventivi: avanzamento e listino (3.2, 3.3)

export type ColonnaAvanzamento = 'bozza' | 'inviato' | 'firmato' | 'pagato';

export const COLONNE_AVANZAMENTO: Array<{ k: ColonnaAvanzamento; t: string; tono: TonoChip }> = [
  { k: 'bozza', t: 'Bozza', tono: 'neutral' },
  { k: 'inviato', t: 'Inviato per la firma', tono: 'info' },
  { k: 'firmato', t: 'Firmato, attesa pagamento', tono: 'warn' },
  { k: 'pagato', t: 'Pagato, avvio aperto', tono: 'ok' },
];

/** Lo stato "accettato" del server è il preventivo firmato dal cliente. */
export function colonnaDi(stato: string): ColonnaAvanzamento | null {
  if (stato === 'accettato' || stato === 'firmato') return 'firmato';
  return (['bozza', 'inviato', 'pagato'] as string[]).includes(stato) ? (stato as ColonnaAvanzamento) : null;
}

/** "Da oggi" / "Da 1 giorno" / "Da n giorni", in rosso se inviato da più di 5 giorni o firmato da più di 3. */
export function etaNelloStato(colonna: ColonnaAvanzamento, giorni: number): { testo: string; rosso: boolean } {
  const g = Math.max(0, Math.floor(giorni));
  const testoEta = g === 0 ? 'Da oggi' : g === 1 ? 'Da 1 giorno' : `Da ${g} giorni`;
  const rosso = (colonna === 'inviato' && g > 5) || (colonna === 'firmato' && g > 3);
  return { testo: testoEta, rosso };
}

export const LISTINO_CANONE: Array<[string, string, string, number]> = [
  ['SUB_MED', 'Abbonamento Sicurezza e medicina', 'per lavoratore', 9.9],
  ['SUB_NOMED', 'Abbonamento Sicurezza senza sorveglianza sanitaria', 'per lavoratore', 5.9],
  ['HACCP', 'Supplemento HACCP', 'per sede alimentare', 29.9],
  ['SURCH_EBIASP', 'Maggiorazione per chi non versa a EBIASP', 'per lavoratore', 7.5],
  ['SURCH_FUND', 'Maggiorazione per chi non aderisce a FondoFormazione', 'per lavoratore', 4.0],
];

export const LISTINO_UNA_TANTUM: Array<[string, string, number]> = [
  ['ENTRY_LOW_NOVISIT', 'Quota d’ingresso, rischio basso, senza visita', 49],
  ['ENTRY_MED_NOVISIT', 'Quota d’ingresso, rischio medio, senza visita', 79],
  ['ENTRY_HIGH_NOVISIT', 'Quota d’ingresso, rischio alto, senza visita', 99],
  ['ENTRY_LOW_VISIT', 'Quota d’ingresso, rischio basso, con visita', 119],
  ['ENTRY_MED_VISIT', 'Quota d’ingresso, rischio medio, con visita', 149],
  ['ENTRY_HIGH_VISIT', 'Quota d’ingresso, rischio alto, con visita', 169],
  ['POS', 'POS', 49.9],
  ['PIMUS', 'PiMUS standard', 99.9],
  ['POS_PIMUS', 'POS più PiMUS per lo stesso cantiere', 129.9],
  ['POS_REV', 'Revisione sostanziale del POS', 24.9],
  ['DRUG_TEST', 'Drug test, a test', 49.9],
];

export const LISTINO_QUOTE: Array<[number, string, number]> = [
  [1, 'fino a 10 dipendenti', 190],
  [2, 'da 11 a 20 dipendenti', 290],
  [3, 'da 21 a 50 dipendenti', 490],
  [4, 'da 51 a 100 dipendenti', 690],
];

/** Importo con due decimali e virgola: 9,90. */
export function cifra(v: number): string {
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------- rinnovi a 90 giorni (2.3)

export interface RigaRinnovo {
  azienda: { id: number; nome: string; comune: string };
  ingressoIl: string | null;
  rinnovoIl: string;
  giorni: number;
  disdettaEntro: string;
  disdettaPassata: boolean;
  elenco: number;
  ebiasp: number | null;
  serviti: number | null;
  organicoConfermato: boolean;
  canoneOra?: number | null;
  canoneRinnovo?: number | null;
}

export interface VistaRinnovi {
  testo: string;
  entro90: RigaRinnovo[];
  piuAvanti: RigaRinnovo[];
  vedeCanone: boolean;
}

export function mappaRinnovo(raw: unknown): RigaRinnovo | null {
  const r = rec(raw);
  const a = rec(r.azienda);
  const id = numero(a.id);
  const rinnovo = testo(r.rinnovo_il);
  if (id === null || rinnovo === null) return null;
  const out: RigaRinnovo = {
    azienda: { id, nome: testo(a.nome) ?? '', comune: testo(a.comune) ?? '' },
    ingressoIl: testo(r.ingresso_il),
    rinnovoIl: rinnovo,
    giorni: numero(r.giorni) ?? 0,
    disdettaEntro: testo(r.disdetta_entro) ?? '',
    disdettaPassata: r.disdetta_passata === true,
    elenco: numero(r.elenco) ?? 0,
    ebiasp: numero(r.ebiasp),
    serviti: numero(r.serviti),
    organicoConfermato: r.organico_confermato === true,
  };
  if ('canone_ora' in r) out.canoneOra = numero(r.canone_ora);
  if ('canone_rinnovo' in r) out.canoneRinnovo = numero(r.canone_rinnovo);
  return out;
}

export async function caricaRinnovi(): Promise<VistaRinnovi> {
  if (!isApiMode()) return { testo: '', entro90: [], piuAvanti: [], vedeCanone: false };
  const d = rec(rec(await prendi('/gestionale/aziende/rinnovi')).data);
  const m = (x: unknown) => lista(x).map(mappaRinnovo).filter((r): r is RigaRinnovo => r !== null);
  return { testo: testo(d.testo) ?? '', entro90: m(d.entro_90), piuAvanti: m(d.piu_avanti), vedeCanone: d.vede_canone === true };
}

export async function confermaOrganico(aziendaId: number): Promise<string> {
  const d = rec(rec(await manda(`/gestionale/aziende/${aziendaId}/rinnovo/organico`)).data);
  return testo(d.messaggio) ?? '';
}

/** "tra {g} giorni", ambra se mancano 30 giorni o meno. */
export function chipRinnovo(giorni: number): { testo: string; tono: TonoChip } {
  return { testo: giorni === 0 ? 'oggi' : giorni === 1 ? 'tra 1 giorno' : `tra ${giorni} giorni`, tono: giorni <= 30 ? 'warn' : 'neutral' };
}

/** Sotto "Al rinnovo": "invariato" oppure "+{diff} €", ambra se aumenta. */
export function differenzaRinnovo(ora: number | null | undefined, rinnovo: number | null | undefined): { testo: string; aumenta: boolean } | null {
  if (rinnovo === null || rinnovo === undefined || ora === null || ora === undefined) return null;
  const diff = Math.round((rinnovo - ora) * 100) / 100;
  if (diff === 0) return { testo: 'invariato', aumenta: false };
  return { testo: `${diff > 0 ? '+' : ''}${cifra(diff)} €`, aumenta: diff > 0 };
}

// ---------------------------------------------------------------- ore per persona (13.4)

export interface OrePersona {
  id: number;
  nome: string;
  ruolo: string | null;
  confermate: number;
  daConfermare: number;
  totale: number;
  fasi: Array<{ fase: string; nome: string; minuti: number }>;
}

export async function caricaOrePersone(settimana?: string): Promise<{ dal: string; al: string; persone: OrePersona[] }> {
  if (!isApiMode()) return { dal: '', al: '', persone: [] };
  const d = rec(rec(await prendi(`/portale/gestionale/ore/persone${settimana ? `?settimana=${settimana}` : ''}`)).data);
  return {
    dal: testo(d.dal) ?? '',
    al: testo(d.al) ?? '',
    persone: lista(d.persone).map((x) => {
      const r = rec(x);
      return {
        id: numero(r.id) ?? 0,
        nome: testo(r.nome) ?? '',
        ruolo: testo(r.ruolo),
        confermate: numero(r.confermate_minuti) ?? 0,
        daConfermare: numero(r.da_confermare_minuti) ?? 0,
        totale: numero(r.totale_minuti) ?? 0,
        fasi: lista(r.fasi).map((f) => ({ fase: testo(rec(f).fase) ?? '', nome: testo(rec(f).nome) ?? '', minuti: numero(rec(f).minuti) ?? 0 })),
      };
    }),
  };
}

/** "{fase} {durata} · …" oppure "Nessuna ora registrata". */
export function riepilogoFasi(fasi: OrePersona['fasi'], durata: (min: number) => string): string {
  return fasi.length === 0 ? 'Nessuna ora registrata' : fasi.map((f) => `${f.nome} ${durata(f.minuti)}`).join(' · ');
}

// ---------------------------------------------------------------- nuovi assunti: regole applicate (9.1)

const ORE_FORMAZIONE: Record<string, number> = { basso: 8, medio: 12, alto: 16 };

/** Righe "Regole applicate" con il codice della regola, testi della specifica. */
export function regoleCaso(c: { rischio: string | null; conVisita: boolean; nonDichiarato: boolean; quotaImporto: number; quotaPagata: boolean; unilav: boolean; dal: string | null; cellulare: boolean; lingua: string; nomeLingua?: string }, dataIt: (d: string | null) => string): Array<{ testo: string; codice: string }> {
  const r = c.rischio ?? 'basso';
  if (c.nonDichiarato) {
    const annua = c.conVisita ? 118.8 : 70.8;
    return [
      { testo: `Lavoratore già in forza non dichiarato: conguaglio pari alla tariffa annua ${cifra(annua)} €`, codice: 'BR-26' },
      { testo: 'Viene servito lo stesso: corso e visita si prenotano, la differenza va a conguaglio', codice: 'BR-27' },
      { testo: 'Senza comunicazione di assunzione si considera in forza dalla firma del contratto', codice: 'BR-25' },
      { testo: 'L’azienda regolarizza denunce e versamenti entro 30 giorni', codice: 'BR-26' },
    ];
  }
  const out = [
    { testo: `Quota d’ingresso: rischio ${r} ${c.conVisita ? 'con visita preventiva' : 'senza visita'}, ${cifra(c.quotaImporto)} € (formazione iniziale di ${ORE_FORMAZIONE[r] ?? 8} ore)`, codice: 'BR-21, BR-22' },
  ];
  if (!c.quotaPagata) out.push({ testo: 'Prenotazioni tenute finché la quota non è pagata', codice: 'BR-24, TR-11' });
  out.push(
    c.unilav
      ? { testo: `Comunicazione di assunzione ricevuta: in servizio dal ${dataIt(c.dal)}, dopo la data di ingresso`, codice: 'BR-25' }
      : { testo: 'Comunicazione di assunzione mancante: senza documento si considera in forza dalla firma', codice: 'BR-25' },
  );
  if (!c.cellulare) out.push({ testo: 'Manca il cellulare WhatsApp: si usa l’SMS e il referente riceve tutti i messaggi', codice: 'BR-108' });
  else if (c.lingua !== 'it') out.push({ testo: `Promemoria e materiali in ${c.nomeLingua ?? c.lingua}, verifica della comprensione della lingua`, codice: 'BR-108, TR-07' });
  return out;
}

// ---------------------------------------------------------------- elenco aziende a tabella (2.1)

export const STATI_AZIENDA: Array<{ k: string; t: string; tono: TonoChip }> = [
  { k: 'attiva', t: 'Attiva', tono: 'ok' },
  { k: 'avvio', t: 'In avvio', tono: 'info' },
  { k: 'attesa_pagamento', t: 'In attesa di pagamento', tono: 'warn' },
  { k: 'rinnovo', t: 'In rinnovo', tono: 'warn' },
  { k: 'sospesa', t: 'Sospesa', tono: 'danger' },
];

export interface FiltroTabella {
  stato: string;
  testo: string;
  tecnico: number | null;
  settore: string;
  rischio: string;
  soloScadute: boolean;
  ordine: { col: 'nome' | 'lavoratori' | 'canone' | 'fascicolo' | 'scadute' | 'dafare' | 'contatto'; inverso: boolean };
}

export const FILTRO_TABELLA: FiltroTabella = { stato: 'tutte', testo: '', tecnico: null, settore: '', rischio: '', soloScadute: false, ordine: { col: 'nome', inverso: false } };

interface RigaPerTabella {
  id: number;
  ragione_sociale: string;
  partita_iva: string;
  comune: string;
  ateco_label: string;
  lavoratori: number;
  tecnico: { id: number; nome: string } | null;
  scadute: number;
  entro30: number;
  statoAzienda?: string;
  rischio?: string | null;
  completezza?: number;
  canone?: number | null;
  aggiornata?: string | null;
  titolare?: string;
}

/** Filtri attivi (l'ordinamento non conta). */
export function filtriAttivi(f: FiltroTabella): boolean {
  return f.stato !== 'tutte' || f.testo.trim() !== '' || f.tecnico !== null || f.settore !== '' || f.rischio !== '' || f.soloScadute;
}

/** Filtra e ordina: primo clic nome crescente, numeri e date decrescenti; a parità per nome. */
export function filtraTabella<T extends RigaPerTabella>(righe: T[], f: FiltroTabella): T[] {
  const q = f.testo.trim().toLowerCase();
  const out = righe.filter(
    (r) =>
      (f.stato === 'tutte' || (r.statoAzienda ?? 'attiva') === f.stato) &&
      (q === '' || [r.ragione_sociale, r.partita_iva, r.comune, r.titolare ?? ''].some((x) => x.toLowerCase().includes(q))) &&
      (f.tecnico === null || r.tecnico?.id === f.tecnico) &&
      (f.settore === '' || r.ateco_label === f.settore) &&
      (f.rischio === '' || r.rischio === f.rischio) &&
      (!f.soloScadute || r.scadute > 0),
  );
  const val = (r: T): number | string => {
    switch (f.ordine.col) {
      case 'lavoratori': return r.lavoratori;
      case 'canone': return r.canone ?? -1;
      case 'fascicolo': return r.completezza ?? 0;
      case 'scadute': return r.scadute;
      case 'dafare': return r.entro30;
      case 'contatto': return r.aggiornata ?? '';
      default: return r.ragione_sociale.toLowerCase();
    }
  };
  const crescente = f.ordine.col === 'nome';
  out.sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    let c = va < vb ? -1 : va > vb ? 1 : 0;
    if (!crescente) c = -c;
    if (f.ordine.inverso) c = -c;
    return c !== 0 ? c : a.ragione_sociale.localeCompare(b.ragione_sociale, 'it');
  });
  return out;
}

/** Barra del fascicolo: ≥ 85 grafite, 60–84 colore utenti, < 60 ambra. */
export function tonoFascicolo(p: number): 'grafite' | 'utenti' | 'ambra' {
  return p >= 85 ? 'grafite' : p >= 60 ? 'utenti' : 'ambra';
}

/** Ultimo contatto: "oggi" / "ieri" / "{n} giorni fa", ambra oltre 30 giorni. */
export function ultimoContatto(iso: string | null | undefined, adesso: Date = new Date()): { testo: string; ambra: boolean } | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const g = Math.floor((new Date(adesso.toDateString()).getTime() - new Date(t.toDateString()).getTime()) / 86400000);
  return { testo: g <= 0 ? 'oggi' : g === 1 ? 'ieri' : `${g} giorni fa`, ambra: g > 30 };
}
