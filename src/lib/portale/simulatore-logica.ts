/**
 * Logica pura del simulatore di costo e dell'attivazione: formati, mappatori
 * tolleranti delle risposte del backend, testi brevi. Nessun prezzo qui
 * dentro (CP-04): tutti gli importi arrivano dal server, in centesimi.
 */

import { lista, numero, rec, testo } from './api';

// ---------------------------------------------------------------- formati

/** 128160 -> "1.281,60 €" (centesimi esatti, mai arrotondati). */
export function euroC(c: number | null | undefined, conCent = true): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return '';
  const neg = c < 0;
  const a = Math.abs(Math.round(c));
  const intero = Math.floor(a / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cent = String(a % 100).padStart(2, '0');
  return `${neg ? '-' : ''}${intero}${conCent || cent !== '00' ? `,${cent}` : ''} €`;
}

export type Vista = 'primo_anno' | 'regime' | 'media_5';

export const VISTE: Array<{ k: Vista; t: string }> = [
  { k: 'regime', t: 'A regime' },
  { k: 'primo_anno', t: 'Primo anno' },
  { k: 'media_5', t: 'Media 5 anni' },
];

export const COPERTURE: Record<string, string> = {
  canone: 'Nel canone',
  supplemento: 'Con supplemento',
  a_parte: 'A parte',
  fuori: 'Si quota a parte',
};

export const STATI_FATTURA: Record<string, { t: string; tono: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  coperto: { t: 'Coperto', tono: 'ok' },
  parziale: { t: 'In parte', tono: 'warn' },
  scaduto: { t: 'Scaduto', tono: 'danger' },
  non_risulta: { t: 'Non risulta', tono: 'neutral' },
};

// ---------------------------------------------------------------- tipi

export interface Domanda {
  campo: string;
  domanda: string;
  scelte: Array<{ valore: unknown; testo: string }>;
}

export interface Obbligo {
  code: string;
  gruppo: string;
  titolo: string;
  quantita: number;
  periodicita: string | null;
  articolo: string;
  copertura: string;
  presunto: boolean;
  motivoPresunto: string | null;
  fatture: { stato: string; testo: string; scoperto: number } | null;
}

export interface RigaConfronto {
  code: string;
  titolo: string;
  gruppo: string;
  quantita: number;
  primoAnno: number;
  regime: number;
  fonte: string;
  presunto: boolean;
  copertura: string;
  nota: string | null;
}

export interface VistaConfronto {
  titolo: string;
  vecchio: number;
  abbonamento: number | null;
  risparmio: number | null;
  risparmioPct: number | null;
  vecchioLavoratoreMese: number;
  abbonamentoLavoratoreMese: number | null;
}

export interface Risultato {
  profilo: {
    attivita: string | null;
    ateco: string | null;
    rischio: string;
    lavoratori: number;
    conVisita: number;
    senzaVisita: number;
    sediAlimentari: number;
    presunti: Record<string, string>;
    ebiasp: boolean;
    fondo: boolean;
    socio: boolean;
  };
  obblighi: Obbligo[];
  sintesi: { totale: number; nelCanone: number; presunti: number };
  righe: RigaConfronto[];
  fuori: RigaConfronto[];
  viste: Record<Vista, VistaConfronto>;
  abbonamento: { offertaStandard: boolean; canoneMensile: number | null; quota: number | null; nota: string; risparmioConEnti: number | null; righe: Array<{ voce: string; quantita: number; mensile: number }> };
  tessera: { tipo: string; testo: string; conVisita: number | null; senzaVisita: number | null; media: number | null };
  contoOnesto: string | null;
  notaStime: string | null;
  fatture: { scoperto: number; pagato: number; categorie: Array<{ k: string; titolo: string; pagato: number; righe: number }> } | null;
  mancano: Domanda[];
}

export interface FatturaSim {
  id: number;
  fornitore: string | null;
  data: string | null;
  formato: string;
  stato: string;
  nota: string | null;
  righe: Array<{ descrizione: string; quantita: number; importo: number; categoria: string; obbligo: string | null }>;
}

export interface Simulazione {
  token: string;
  risultato: Risultato | null;
  contattoRichiesto: boolean;
  fatture: FatturaSim[];
  ingressi: Record<string, unknown>;
  prezziReali: Record<string, number>;
  nelModuloOrdine: boolean;
}

// ---------------------------------------------------------------- mappatori

const n0 = (v: unknown): number => numero(v) ?? 0;
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';

function mappaVista(raw: unknown): VistaConfronto {
  const v = rec(raw);
  return {
    titolo: testo(v.titolo) ?? '',
    vecchio: n0(v.vecchio),
    abbonamento: numero(v.abbonamento),
    risparmio: numero(v.risparmio),
    risparmioPct: numero(v.risparmio_pct),
    vecchioLavoratoreMese: n0(v.vecchio_lavoratore_mese),
    abbonamentoLavoratoreMese: numero(v.abbonamento_lavoratore_mese),
  };
}

function mappaRiga(raw: unknown): RigaConfronto {
  const r = rec(raw);
  return {
    code: testo(r.code) ?? '',
    titolo: testo(r.titolo) ?? '',
    gruppo: testo(r.gruppo) ?? '',
    quantita: n0(r.quantita),
    primoAnno: n0(r.primo_anno),
    regime: n0(r.regime),
    fonte: testo(r.fonte) ?? 'stima',
    presunto: bool(r.presunto),
    copertura: testo(r.copertura) ?? 'canone',
    nota: testo(r.nota),
  };
}

export function mappaRisultato(raw: unknown): Risultato | null {
  const r = rec(raw);
  const c = rec(r.confronto);
  if (!r.profilo || !c.viste) return null;
  const p = rec(r.profilo);
  const viste = rec(c.viste);
  const abb = rec(c.abbonamento);
  const tes = rec(c.tessera);
  const sin = rec(r.sintesi_obblighi);
  const f = r.fatture ? rec(r.fatture) : null;
  const presunti: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(p.presunti))) presunti[k] = String(v);
  return {
    profilo: {
      attivita: testo(p.attivita),
      ateco: testo(p.ateco),
      rischio: testo(p.rischio) ?? 'medio',
      lavoratori: n0(p.lavoratori),
      conVisita: n0(p.con_visita),
      senzaVisita: n0(p.senza_visita),
      sediAlimentari: n0(p.sedi_alimentari),
      presunti,
      ebiasp: bool(p.ebiasp),
      fondo: bool(p.fondo),
      socio: bool(p.socio),
    },
    obblighi: lista(r.obblighi).map((x) => {
      const o = rec(x);
      const ff = o.fatture ? rec(o.fatture) : null;
      return {
        code: testo(o.code) ?? '',
        gruppo: testo(o.gruppo) ?? '',
        titolo: testo(o.titolo) ?? '',
        quantita: n0(o.quantita),
        periodicita: testo(o.periodicita),
        articolo: testo(o.articolo) ?? '',
        copertura: testo(o.copertura) ?? 'canone',
        presunto: bool(o.presunto),
        motivoPresunto: testo(o.motivo_presunto),
        fatture: ff ? { stato: testo(ff.stato) ?? 'non_risulta', testo: testo(ff.stato_testo) ?? '', scoperto: n0(ff.scoperto_listino) } : null,
      };
    }),
    sintesi: { totale: n0(sin.totale), nelCanone: n0(rec(sin.per_copertura).canone), presunti: n0(sin.presunti) },
    righe: lista(c.righe).map(mappaRiga),
    fuori: lista(c.fuori_confronto).map(mappaRiga),
    viste: { primo_anno: mappaVista(viste.primo_anno), regime: mappaVista(viste.regime), media_5: mappaVista(viste.media_5) },
    abbonamento: {
      offertaStandard: abb.offerta_standard !== false,
      canoneMensile: numero(abb.canone_mensile),
      quota: abb.quota_associativa ? numero(rec(abb.quota_associativa).importo) : null,
      nota: testo(abb.nota) ?? '',
      risparmioConEnti: numero(abb.risparmio_con_enti),
      righe: lista(abb.righe).map((x) => {
        const y = rec(x);
        return { voce: testo(y.voce) ?? '', quantita: n0(y.quantita), mensile: n0(y.mensile) };
      }),
    },
    tessera: { tipo: testo(tes.tipo) ?? 'listino', testo: testo(tes.testo) ?? '', conVisita: numero(tes.con_visita), senzaVisita: numero(tes.senza_visita), media: numero(tes.media_lavoratore_mese) },
    contoOnesto: testo(c.conto_onesto),
    notaStime: testo(rec(c.stime).nota),
    fatture: f
      ? {
          scoperto: n0(f.scoperto_totale),
          pagato: n0(f.pagato_totale),
          categorie: Object.entries(rec(f.categorie)).map(([k, v]) => ({ k, titolo: testo(rec(v).titolo) ?? k, pagato: n0(rec(v).pagato), righe: n0(rec(v).righe) })),
        }
      : null,
    mancano: lista(r.mancano).map((x) => {
      const d = rec(x);
      return { campo: testo(d.campo) ?? '', domanda: testo(d.domanda) ?? '', scelte: lista(d.scelte).map((s) => ({ valore: rec(s).valore, testo: testo(rec(s).testo) ?? '' })) };
    }),
  };
}

export function mappaSimulazione(raw: unknown): Simulazione | null {
  const s = rec(raw);
  const token = testo(s.token);
  if (!token) return null;
  const prezzi: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(s.prezzi_reali))) {
    const x = numero(v);
    if (x !== null) prezzi[k] = x;
  }
  return {
    token,
    risultato: mappaRisultato(s.risultato),
    contattoRichiesto: bool(s.contatto_richiesto),
    ingressi: rec(s.ingressi),
    prezziReali: prezzi,
    nelModuloOrdine: bool(s.nel_modulo_ordine),
    fatture: lista(s.fatture).map((x) => {
      const f = rec(x);
      return {
        id: n0(f.id),
        fornitore: testo(f.fornitore),
        data: testo(f.data),
        formato: testo(f.formato) ?? 'xml',
        stato: testo(f.stato) ?? 'letta',
        nota: testo(f.nota),
        righe: lista(f.righe).map((y) => {
          const r = rec(y);
          return { descrizione: testo(r.descrizione) ?? '', quantita: n0(r.quantita), importo: n0(r.importo), categoria: testo(r.categoria) ?? 'altro', obbligo: testo(r.obligation_code) };
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------- testi

/** Il messaggio della testata (CP-01): il mensile per lavoratore a confronto. */
export function messaggioTessera(r: Risultato, vista: Vista = 'regime'): { vecchio: string; nuovo: string; risparmio: string | null; piu: boolean } {
  const v = r.viste[vista];
  const nuovo =
    r.tessera.tipo === 'listino' && r.tessera.conVisita !== null
      ? `${euroC(r.tessera.conVisita)}${r.tessera.senzaVisita !== null && r.profilo.senzaVisita > 0 ? ` e ${euroC(r.tessera.senzaVisita)}` : ''}`
      : r.tessera.media !== null
        ? euroC(r.tessera.media)
        : euroC(v.abbonamentoLavoratoreMese);
  const piu = v.risparmio !== null && v.risparmio < 0;
  return {
    vecchio: euroC(v.vecchioLavoratoreMese),
    nuovo,
    risparmio: v.risparmio === null ? null : euroC(Math.abs(v.risparmio)),
    piu,
  };
}

/** Somma per gruppo delle righe del vecchio metodo nella vista scelta. */
export function perGruppo(r: Risultato, vista: Vista): Array<{ gruppo: string; importo: number; righe: RigaConfronto[] }> {
  const out = new Map<string, { gruppo: string; importo: number; righe: RigaConfronto[] }>();
  for (const x of r.righe) {
    const g = out.get(x.gruppo) ?? { gruppo: x.gruppo, importo: 0, righe: [] };
    const imp = vista === 'primo_anno' ? x.primoAnno : vista === 'regime' ? x.regime : Math.floor((x.primoAnno + 4 * x.regime) / 5);
    g.importo += imp;
    g.righe.push(x);
    out.set(x.gruppo, g);
  }
  return Array.from(out.values()).sort((a, b) => b.importo - a.importo);
}

export const GRUPPI: Record<string, string> = {
  documenti: 'Documenti',
  figure: 'Figure',
  assistenza: 'Assistenza',
  formazione: 'Formazione',
  sorveglianza: 'Medicina del lavoro',
  verifiche: 'Verifiche e sedi',
  cantieri: 'Cantieri e appalti',
};

/** Telefono italiano accettato dal backend. */
export function telefonoValido(t: string): boolean {
  const s = t.replace(/[^\d+]/g, '');
  return /^(\+39)?(3\d{8,9}|0\d{5,10})$/.test(s);
}

/** IBAN italiano: 27 caratteri, inizia con IT. */
export function ibanValido(t: string): boolean {
  return /^IT\d{2}[A-Z0-9]{23}$/.test(t.replace(/\s+/g, '').toUpperCase());
}
