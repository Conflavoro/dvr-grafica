/**
 * Pagamenti, firma e adesioni del Portale HSE (regole di business 2.8, 2.9, 5.6, 6).
 * Controlli dei campi uguali a quelli del server: gli errori si mostrano tutti insieme,
 * ognuno sotto il suo campo. Il server non riceve mai il numero della carta quando
 * il fornitore vero (Stripe) è acceso: lo crea il browser e manda solo l'id.
 */

import { apiUpload } from '@/lib/api';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

export type R = Record<string, unknown>;
const dati = (r: unknown): R => rec(rec(r).data);

// ---------------------------------------------------------------- controlli

export type Errori = Record<string, string>;

export function controllaCarta(c: { numero: string; scadenza: string; cvc: string }): Errori {
  const e: Errori = {};
  if (!/^\d{16}$/.test(c.numero.replace(/\s+/g, ''))) e.numero = 'Il numero ha 16 cifre.';
  if (!/^\d{2}\/\d{2}$/.test(c.scadenza)) e.scadenza = 'Scrivi la scadenza come MM/AA.';
  if (!/^\d{3,4}$/.test(c.cvc)) e.cvc = 'Il CVC ha 3 o 4 cifre.';
  return e;
}

export function controllaSepa(s: { intestatario: string; iban: string; mandato: boolean }): Errori {
  const e: Errori = {};
  if (s.intestatario.trim().length < 3) e.intestatario = 'Scrivi l\'intestatario del conto.';
  if (!/^IT\d{2}[A-Z0-9]{23}$/.test(s.iban.replace(/\s+/g, '').toUpperCase())) e.iban = 'Un IBAN italiano ha 27 caratteri e inizia con IT.';
  if (!s.mandato) e.mandato = 'Serve la tua autorizzazione per addebitare il canone.';
  return e;
}

/** Firma: prima la casella, poi il codice di 6 cifre. Un solo messaggio, nell'ordine. */
export function controllaFirma(letto: boolean, codice: string): string | null {
  if (!letto) return 'Spunta la casella per confermare di aver letto il documento.';
  if (!/^\d{6}$/.test(codice)) return 'Il codice ha 6 cifre.';
  return null;
}

/** Errori di campo restituiti dal server (chiave "errori"), se ci sono. */
export function erroriServer(e: unknown): Errori | null {
  const b = rec(rec(e).body);
  const x = rec(b.errori);
  const out: Errori = {};
  for (const [k, v] of Object.entries(x)) if (typeof v === 'string') out[k] = v;
  return Object.keys(out).length ? out : null;
}

export const euro = (v: number): string => '€ ' + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------- pagamenti

export type MetodoFoglio = 'wallet' | 'carta' | 'bonifico';

export interface MetodoSalvato {
  id: number;
  tipo: 'carta' | 'sepa';
  etichetta: string;
  scadenza: string | null;
}

export interface MetodiPagamento {
  predefinito: MetodoSalvato | null;
  puoPagare: boolean;
  ibanBonifico: string;
  fornitore: string;
}

export interface EsitoPagamento {
  id: number;
  stato: 'riuscito' | 'in_attesa' | 'fallito' | 'richiesta_titolare';
  messaggio: string | null;
  importo: number;
  daWallet: number;
  iban: string | null;
  nota: string | null;
}

function metodo(raw: unknown): MetodoSalvato | null {
  const m = rec(raw);
  const id = numero(m.id);
  return id === null ? null : { id, tipo: m.tipo === 'sepa' ? 'sepa' : 'carta', etichetta: testo(m.etichetta) ?? '', scadenza: testo(m.scadenza) };
}

export function mappaEsito(raw: unknown): EsitoPagamento {
  const p = rec(raw);
  const s = testo(p.stato);
  return {
    id: numero(p.id) ?? 0,
    stato: s === 'riuscito' || s === 'in_attesa' || s === 'fallito' || s === 'richiesta_titolare' ? s : 'fallito',
    messaggio: testo(p.messaggio),
    importo: numero(p.importo) ?? 0,
    daWallet: numero(p.da_wallet) ?? 0,
    iban: testo(p.iban),
    nota: testo(p.nota),
  };
}

const az = (id: number, p: string) => `/portale/aziende/${id}${p}`;

export async function metodiPagamento(aziendaId: number): Promise<MetodiPagamento> {
  const d = dati(await prendi(az(aziendaId, '/pagamenti/metodi')));
  return { predefinito: metodo(d.predefinito), puoPagare: d.puo_pagare === true, ibanBonifico: testo(d.iban_bonifico) ?? '', fornitore: testo(d.fornitore) ?? 'prova' };
}

export async function salvaCarta(aziendaId: number, carta: { numero: string; scadenza: string; cvc: string }): Promise<MetodoSalvato | null> {
  return metodo(dati(await manda(az(aziendaId, '/pagamenti/metodi'), { tipo: 'carta', carta: { ...carta, numero: carta.numero.replace(/\s+/g, '') } })));
}

export async function salvaSepa(aziendaId: number, sepa: { intestatario: string; iban: string; mandato: boolean }): Promise<MetodoSalvato | null> {
  return metodo(dati(await manda(az(aziendaId, '/pagamenti/metodi'), { tipo: 'sepa', sepa })));
}

export async function pagaFattura(aziendaId: number, fatturaId: number, metodoScelto: MetodoFoglio): Promise<EsitoPagamento> {
  return mappaEsito(dati(await manda(az(aziendaId, `/fatture/${fatturaId}/paga`), { metodo: metodoScelto })));
}

// ---------------------------------------------------------------- adesioni

export type StatoAdesione = 'da_verificare' | 'in_verifica' | 'verificata' | 'non_risulta' | 'non_serve' | 'ridotta';

export interface VoceAdesione {
  ente: 'socio' | 'ebiasp' | 'fondo';
  nome: string;
  dichiarato: string;
  stato: StatoAdesione;
  etichetta: string;
  prova: string;
  puoCaricare: boolean;
  nonRisulta: { testo: string; conguaglio: number; dettaglio: string; pagato: boolean; puoPagare: boolean; nota: string } | null;
  riduzione: { comunicataDal: string | null; dal: string | null } | null;
}

export interface Adesioni {
  entro: string | null;
  aperte: number;
  stato: 'in_corso' | 'conguaglio_da_pagare' | 'completata';
  voci: VoceAdesione[];
  puoComunicare: boolean;
}

export function mappaAdesioni(raw: unknown): Adesioni {
  const d = rec(raw);
  const st = testo(d.stato);
  return {
    entro: testo(d.entro),
    aperte: numero(d.aperte) ?? 0,
    stato: st === 'conguaglio_da_pagare' || st === 'completata' ? st : 'in_corso',
    puoComunicare: d.puo_comunicare === true,
    voci: lista(d.voci).map((x) => {
      const v = rec(x);
      const nr = v.non_risulta ? rec(v.non_risulta) : null;
      const rd = v.riduzione ? rec(v.riduzione) : null;
      const ente = testo(v.ente);
      return {
        ente: ente === 'ebiasp' || ente === 'fondo' ? ente : 'socio',
        nome: testo(v.nome) ?? '',
        dichiarato: testo(v.dichiarato) ?? '',
        stato: (testo(v.stato) ?? 'da_verificare') as StatoAdesione,
        etichetta: testo(v.etichetta) ?? '',
        prova: testo(v.prova) ?? '',
        puoCaricare: v.puo_caricare === true,
        nonRisulta: nr
          ? { testo: testo(nr.testo) ?? '', conguaglio: numero(nr.conguaglio) ?? 0, dettaglio: testo(nr.dettaglio) ?? '', pagato: nr.pagato === true, puoPagare: nr.puo_pagare === true, nota: testo(nr.nota) ?? '' }
          : null,
        riduzione: rd ? { comunicataDal: testo(rd.comunicata_dal), dal: testo(rd.dal) } : null,
      };
    }),
  };
}

export async function adesioni(aziendaId: number): Promise<Adesioni> {
  return mappaAdesioni(dati(await prendi(az(aziendaId, '/adesioni'))));
}

export async function caricaProvaAdesione(aziendaId: number, ente: string, file: File): Promise<{ adesioni: Adesioni; messaggio: string | null }> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const d = dati(await apiUpload(az(aziendaId, `/adesioni/${ente}/prova`), fd));
    return { adesioni: mappaAdesioni(d), messaggio: testo(d.messaggio) };
  } catch (e) {
    throw erroreLeggibile(e, 'Caricamento non riuscito.');
  }
}

export async function comunicaAdesione(aziendaId: number, ente: string, dal: string, file: File): Promise<{ adesioni: Adesioni; messaggio: string | null }> {
  const fd = new FormData();
  fd.append('ente', ente);
  fd.append('dal', dal);
  fd.append('file', file);
  try {
    const d = dati(await apiUpload(az(aziendaId, '/adesioni/comunica'), fd));
    return { adesioni: mappaAdesioni(d), messaggio: testo(d.messaggio) };
  } catch (e) {
    throw erroreLeggibile(e, 'Invio non riuscito.');
  }
}

export async function pagaConguaglio(aziendaId: number, ente: string, metodoScelto: MetodoFoglio): Promise<EsitoPagamento> {
  return mappaEsito(dati(await manda(az(aziendaId, `/adesioni/${ente}/paga`), { metodo: metodoScelto })));
}

// ---------------------------------------------------------------- rinnovo

export interface RigaRinnovo {
  chiave: string;
  voce: string;
  prima: number;
  quantita: number;
  prezzo: number;
  mensile: number;
}

export interface StatoRinnovo {
  stato: 'da_confermare' | 'firmato' | 'attesa_bonifico' | 'confermato';
  etichetta: string;
  anno: number;
  dal: string;
  al: string;
  pagatoIl: string | null;
  puo: boolean;
  fonti: { elenco: number; ebiasp: number; visitatiFormati: number };
  organico: number;
  nonDichiarati: Array<{ id: number; nome: string }>;
  righe: RigaRinnovo[];
  mensile: number;
  annuo: number;
  oggi: number;
  differenza: number;
  nota: string;
}

export function mappaRinnovo(raw: unknown): StatoRinnovo {
  const r = rec(raw);
  const f = rec(r.fonti);
  const st = testo(r.stato);
  return {
    stato: st === 'firmato' || st === 'attesa_bonifico' || st === 'confermato' ? st : 'da_confermare',
    etichetta: testo(r.etichetta) ?? '',
    anno: numero(r.anno) ?? 0,
    dal: testo(r.dal) ?? '',
    al: testo(r.al) ?? '',
    pagatoIl: testo(r.pagato_il),
    puo: r.puo === true,
    fonti: { elenco: numero(f.elenco) ?? 0, ebiasp: numero(f.ebiasp) ?? 0, visitatiFormati: numero(f.visitati_formati) ?? 0 },
    organico: numero(r.organico) ?? 0,
    nonDichiarati: lista(r.non_dichiarati).map((x) => ({ id: numero(rec(x).id) ?? 0, nome: testo(rec(x).nome) ?? '' })),
    righe: lista(r.righe).map((x) => {
      const y = rec(x);
      return { chiave: testo(y.chiave) ?? '', voce: testo(y.voce) ?? '', prima: numero(y.prima) ?? 0, quantita: numero(y.quantita) ?? 0, prezzo: numero(y.prezzo) ?? 0, mensile: numero(y.mensile) ?? 0 };
    }),
    mensile: numero(r.mensile) ?? 0,
    annuo: numero(r.annuo) ?? 0,
    oggi: numero(r.oggi) ?? 0,
    differenza: numero(r.differenza) ?? 0,
    nota: testo(r.nota) ?? '',
  };
}

export async function rinnovo(aziendaId: number): Promise<StatoRinnovo> {
  return mappaRinnovo(dati(await prendi(az(aziendaId, '/rinnovo'))));
}

export async function codiceRinnovo(aziendaId: number, confermo: boolean): Promise<{ token: string; cellulare: string | null; codiceProva: string | null }> {
  const d = dati(await manda(az(aziendaId, '/rinnovo/codice'), { confermo }));
  return { token: testo(d.token) ?? '', cellulare: testo(d.cellulare), codiceProva: testo(d.codice_prova) };
}

export async function firmaRinnovo(aziendaId: number, token: string, codice: string, letto: boolean): Promise<StatoRinnovo> {
  return mappaRinnovo(dati(await manda(az(aziendaId, '/rinnovo/firma'), { token, codice, letto })));
}

export async function pagaRinnovo(aziendaId: number, metodoScelto: MetodoFoglio): Promise<EsitoPagamento> {
  return mappaEsito(dati(await manda(az(aziendaId, '/rinnovo/paga'), { metodo: metodoScelto })));
}

// ---------------------------------------------------------------- gestionale: adesioni e crediti

export interface AdesioniGestionale {
  entro: string | null;
  puoConfermare: boolean;
  puoEmettere: boolean;
  voci: Array<VoceAdesione & { emesso: boolean }>;
}

export async function adesioniGestionale(aziendaId: number): Promise<AdesioniGestionale> {
  const d = dati(await prendi(`/gestionale/aziende/${aziendaId}/adesioni`));
  const base = mappaAdesioni(d);
  return {
    entro: testo(d.entro),
    puoConfermare: d.puo_confermare === true,
    puoEmettere: d.puo_emettere === true,
    voci: base.voci.map((v, i) => ({ ...v, emesso: rec(lista(d.voci)[i]).emesso === true })),
  };
}

export async function esitoAdesione(aziendaId: number, ente: string, esito: 'verificata' | 'non_risulta'): Promise<string | null> {
  return testo(dati(await manda(`/gestionale/aziende/${aziendaId}/adesioni/${ente}/esito`, { esito })).messaggio);
}

export async function emettiConguaglio(aziendaId: number, ente: string): Promise<string | null> {
  return testo(dati(await manda(`/gestionale/aziende/${aziendaId}/adesioni/${ente}/conguaglio`)).messaggio);
}

export async function adesioneSuccessiva(aziendaId: number, ente: string, dal: string): Promise<string | null> {
  return testo(dati(await manda(`/gestionale/aziende/${aziendaId}/adesioni/comunica`, { ente, dal })).messaggio);
}


export const crediti = {
  regalati: async (): Promise<R> => dati(await prendi('/gestionale/crediti/regalati')),
  campagne: async (): Promise<R> => dati(await prendi('/gestionale/crediti/campagne')),
  budget: async (): Promise<R> => dati(await prendi('/gestionale/crediti/budget')),
  bonifici: async (): Promise<R> => dati(await prendi('/gestionale/crediti/bonifici')),
  regala: async (aziendaId: number, d: R): Promise<R> => dati(await manda(`/gestionale/aziende/${aziendaId}/crediti`, d)),
  decidi: async (tipo: 'credito' | 'campagna', id: number, esito: 'approva' | 'rifiuta', motivo?: string): Promise<R> =>
    dati(await manda(`/gestionale/crediti/${tipo}/${id}/decisione`, { esito, ...(motivo ? { motivo } : {}) })),
  revoca: async (id: number, motivo: string): Promise<R> => dati(await manda(`/gestionale/crediti/${id}/revoca`, { motivo })),
  nuovaCampagna: async (d: R): Promise<R> => dati(await manda('/gestionale/crediti/campagne', d)),
  stima: async (segmento: string, importo: number): Promise<R> => dati(await prendi(`/gestionale/crediti/campagne/stima?segmento=${encodeURIComponent(segmento)}&importo=${importo}`)),
  chiudi: async (id: number): Promise<R> => dati(await manda(`/gestionale/crediti/campagne/${id}/chiudi`)),
  abbina: async (id: number, d: R): Promise<R> => dati(await manda(`/gestionale/crediti/bonifici/${id}/abbina`, d)),
};
