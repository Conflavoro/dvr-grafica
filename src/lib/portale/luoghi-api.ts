/**
 * Sicurezza dei luoghi dell'area azienda (squadra S5): Primo soccorso, Infortuni, HACCP
 * e scheda del manutentore dell'antincendio. Le rotte stanno sotto
 * /api/portale/aziende/{id}; i permessi e la sede li decide il server.
 */

import { apiUpload } from '@/lib/api';
import { erroreLeggibile, manda, prendi, rec } from './api';
import type { StatoChip } from '@/components/portale/kit';

const base = (id: number) => `/portale/aziende/${id}`;
const dati = <T,>(r: unknown) => rec(r).data as T;
const conSede = (sede: number | null) => (sede ? `?sede=${sede}` : '');

/** Voce "Da fare" comune alle sezioni (contratto anche per la Home). */
export interface VoceDaFare {
  sezione: string;
  testo: string;
  extra: string | null;
  urg: number;
  pulsante: string;
  scheda: string | null;
  azione: string | null;
  id: number | null;
}

export interface Esito {
  titolo?: string;
  testo: string;
}

// ---------------------------------------------------------------- primo soccorso

export type StatoProdotto = 'manca' | 'scaduto' | 'in_scadenza' | 'ok';

export interface ProdottoCassetta {
  codice: string;
  breve: string;
  nome: string;
  richiesti: number;
  presenti: number;
  scadenza: string | null;
  dura: boolean;
  ricomprare: boolean;
  stato: StatoProdotto;
  etichetta: string;
  chip: StatoChip;
}

export interface Cassetta {
  id: number;
  posizione: string;
  nome: string;
  sede_id: number | null;
  sede: string | null;
  prodotti: ProdottoCassetta[];
  problemi: number;
  ultima_verifica: string | null;
  verificata_mese: boolean;
}

export interface AddettoPs {
  lavoratore_id: number;
  nome: string;
  mansione: string | null;
  reparto: string | null;
  corso: { stato: StatoChip; scade_il: string | null; conseguito_il: string | null };
}

export interface PrimoSoccorso {
  gruppo: { g: 'A' | 'B' | 'C'; n: number; motivo: string; allegato: 1 | 2; contenitore: string; ore: number };
  mese: string;
  mese_prossimo: string;
  piu_sedi: boolean;
  cassette: Cassetta[];
  verifiche: Array<{ id: number; data: string; cassetta: string; chi: string | null; esito: 'ok' | 'note'; note: string | null }>;
  addetti: Array<{ sede_id: number | null; sede: string | null; addetti: AddettoPs[] }>;
  da_fare: VoceDaFare[];
  indicatori: { cassette: number; cassette_ok: number; da_sostituire: number; prossima_scadenza: string | null; addetti: number; da_verificare: number; sedi_senza_addetti: number };
  permessi: { modifica: boolean; iscrivi: boolean; persone: boolean };
  candidati: Array<{ id: number; nome: string; mansione: string | null; reparto: string | null; sede_id: number | null }>;
}

export type RispostaVerifica = { esito: 'si' | 'sostituito' | 'manca'; scadenza?: string };

export const ps = {
  vista: async (aid: number, sede: number | null) => dati<PrimoSoccorso>(await prendi(`${base(aid)}/primo-soccorso${conSede(sede)}`)),
  aggiungi: async (aid: number, posizione: string, sedeId: number | null) =>
    dati<Esito & { cassetta_id: number }>(await manda(`${base(aid)}/primo-soccorso/cassette`, { posizione, sede_id: sedeId })),
  sostituito: async (aid: number, cassetta: number, codice: string, scadenza: string | null) =>
    dati<Esito>(await manda(`${base(aid)}/primo-soccorso/cassette/${cassetta}/prodotti/${codice}/sostituito`, { scadenza })),
  verifica: async (aid: number, cassetta: number, risposte: Record<string, RispostaVerifica>) =>
    dati<Esito>(await manda(`${base(aid)}/primo-soccorso/cassette/${cassetta}/verifica`, { risposte })),
  nomina: async (aid: number, lavoratoreId: number) =>
    dati<Esito & { lavoratore_id: number; puo_iscrivere: boolean }>(await manda(`${base(aid)}/primo-soccorso/addetti`, { lavoratore_id: lavoratoreId })),
};

// ---------------------------------------------------------------- infortuni

export interface Infortunio {
  id: number;
  data: string;
  ora: string | null;
  lavoratore_id: number | null;
  lavoratore: string;
  mansione: string | null;
  sede_id: number | null;
  sede: string | null;
  reparto: string | null;
  come: string | null;
  parte_corpo: string | null;
  lesione: string | null;
  prognosi_giorni: number | null;
  rientro: string | null;
  mancano: string[];
  file: { nome: string | null; caricato_da: string | null; caricato_il: string | null };
  dvr: {
    stato: 'approvazione' | 'aggiornato';
    chip: StatoChip;
    etichetta: string;
    approvato_da: string | null;
    approvato_il: string | null;
    versione: number | null;
    rischio?: string;
    testo?: string;
    misure?: string[];
    capitoli?: string[];
  };
}

export interface ElencoInfortuni {
  anno: number;
  piu_sedi: boolean;
  infortuni: Infortunio[];
  indicatori: { anno: number; giorni_prognosi: number; dall_ultimo: number | null };
  da_fare: VoceDaFare[];
  permessi: { denuncia: boolean };
  lavoratori: Array<{ id: number; nome: string; mansione: string | null; reparto: string | null; sede_id: number | null }>;
}

export interface CampiInfortunio {
  data: string;
  ora: string;
  lavoratore_id: number | null;
  sede_id: number | null;
  reparto: string;
  come: string;
  parte_corpo: string;
  lesione: string;
  prognosi_giorni: string;
}

export const inf = {
  elenco: async (aid: number, sede: number | null) => dati<ElencoInfortuni>(await prendi(`${base(aid)}/infortuni${conSede(sede)}`)),
  dettaglio: async (aid: number, id: number) => dati<Infortunio>(await prendi(`${base(aid)}/infortuni/${id}`)),
  leggi: async (aid: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      return dati<{ file: string; nome: string; letta: boolean; proposta: Partial<Record<keyof CampiInfortunio, string | number | null>> & { lavoratore: string | null } }>(
        await apiUpload(`${base(aid)}/infortuni/leggi`, fd),
      );
    } catch (e) {
      throw erroreLeggibile(e);
    }
  },
  registra: async (aid: number, file: string, nome: string, c: CampiInfortunio) =>
    dati<Esito & { infortunio: Infortunio }>(await manda(`${base(aid)}/infortuni`, { file, nome, ...corpo(c) })),
  correggi: async (aid: number, id: number, c: CampiInfortunio) => dati<Esito & { infortunio: Infortunio }>(await manda(`${base(aid)}/infortuni/${id}`, corpo(c), 'PATCH')),
  denuncia: (aid: number, id: number) => `${base(aid)}/infortuni/${id}/denuncia`,
};

function corpo(c: CampiInfortunio): Record<string, unknown> {
  return { ...c, prognosi_giorni: c.prognosi_giorni === '' ? null : Number(c.prognosi_giorni) };
}

// ---------------------------------------------------------------- haccp

export interface SedeHaccp {
  id: number;
  sede_id: number;
  nome: string;
  indirizzo: string | null;
  stato: 'da_fissare' | 'fissato' | 'preparazione' | 'consegnato';
  chip: StatoChip;
  etichetta: string;
  sopralluogo_il: string | null;
  revisione_entro: string | null;
  versione: string | null;
  manuale: { id: number; titolo: string; data: string | null } | null;
}

export interface Haccp {
  sedi: SedeHaccp[];
  piu_sedi: boolean;
  tecnico: string | null;
  laboratorio: string | null;
  campionamenti: Array<{ id: number; sede: string | null; analisi: string; punti: string[]; laboratorio: string | null; previsto_il: string | null; referto_il: string | null; documento_id: number | null; stato: string; ritardo: boolean; chip: StatoChip; etichetta: string }>;
  addetti: Array<{ lavoratore_id: number; nome: string; mansione: string | null; sede: string | null; corso: { stato: StatoChip; scade_il: string | null; etichetta: string } }>;
  da_fare: VoceDaFare[];
  indicatori: { sedi: number; consegnati: number; prossimo_prelievo: { analisi: string; previsto_il: string } | null; addetti: number; addetti_formati: number; rapporti: number; sedi_da_fissare: number; in_ritardo: number; da_formare: number };
  permessi: { richiedi: boolean; modifica: boolean; iscrivi: boolean };
  lavoratori: Array<{ id: number; nome: string; mansione: string | null; sede: string | null }>;
  date: Array<{ quando: string; testo: string }>;
}

export const haccp = {
  vista: async (aid: number, sede: number | null) => dati<Haccp>(await prendi(`${base(aid)}/haccp${conSede(sede)}`)),
  fissa: async (aid: number, sedeHaccp: number, quando: string) => dati<Esito>(await manda(`${base(aid)}/haccp/sedi/${sedeHaccp}/sopralluogo`, { quando })),
  addetti: async (aid: number, lavoratori: number[]) => dati<Esito>(await manda(`${base(aid)}/haccp/addetti`, { lavoratori })),
};

// ---------------------------------------------------------------- scheda del manutentore (antincendio 9.9)

export interface PresidioScheda {
  id: number;
  descrizione: string;
  posizione: string | null;
  controllato: boolean;
  esito: 'ok' | 'anomalia';
  nota: string | null;
}

export interface PropostaScheda {
  data: string | null;
  tipo: 'semestrale' | 'annuale' | 'revisione' | 'collaudo';
  ditta: string | null;
  tecnico: string | null;
  verbale: string | null;
  sede: string | null;
  presidi: PresidioScheda[];
}

export const scheda = {
  leggi: async (aid: number, file: File, sede: string | null) => {
    const fd = new FormData();
    fd.append('file', file);
    if (sede) fd.append('sede', sede);
    try {
      return dati<{ file: string; nome: string; letta: boolean; proposta: PropostaScheda }>(await apiUpload(`${base(aid)}/antincendio/scheda/leggi`, fd));
    } catch (e) {
      throw erroreLeggibile(e);
    }
  },
  salva: async (aid: number, file: string, nome: string, p: PropostaScheda) => dati<Esito>(await manda(`${base(aid)}/antincendio/scheda`, { file, nome, ...p })),
};

/** Dati dell'antincendio aggiunti da S5 (9.8 e 9.9) letti dalla stessa rotta dell'area. */
export interface AntincendioExtra {
  pianoObbligatorio: boolean;
  lavoratori: number;
  schede: Array<{ testo: string; sede: string | null }>;
}

export async function antincendioExtra(aid: number): Promise<AntincendioExtra> {
  const d = rec(rec(await prendi(`${base(aid)}/area/antincendio`)).data);
  const voci = Array.isArray(d.da_fare) ? d.da_fare.map(rec) : [];
  return {
    pianoObbligatorio: d.piano_obbligatorio !== false,
    lavoratori: typeof d.lavoratori === 'number' ? d.lavoratori : 0,
    schede: voci.filter((v) => v.azione === 'scheda').map((v) => ({ testo: String(v.testo ?? ''), sede: typeof v.sede === 'string' ? v.sede : null })),
  };
}

// ---------------------------------------------------------------- documenti: da firmare, completezza, nuova versione

export interface DaFirmare {
  da_firmare: Array<{ tipo: 'dvr' | 'documento'; id: number; titolo: string; cartella: string; cartella_nome: string; versione: string; preparato_il: string | null }>;
  firmati: Array<{ tipo: string; id: number | null; titolo: string; firmato_il: string }>;
  puo_firmare: boolean;
}

export interface Completezza {
  percento: number;
  frase: string;
  ateco: string | null;
  azienda: number;
  isfor: number;
  cartelle: Array<{ chiave: string; nome: string; attiva: boolean; chip: string; cose: Array<{ testo: string; chi: 'azienda' | 'isfor'; azione: 'firma' | 'carica' | 'apri'; tipo?: 'dvr' | 'documento'; documento?: number | string | null; nome?: string }> }>;
  permessi: { firma: boolean; carica: boolean };
}

export const docStato = {
  daFirmare: async (aid: number) => dati<DaFirmare>(await prendi(`${base(aid)}/documenti/da-firmare`)),
  completezza: async (aid: number) => dati<Completezza>(await prendi(`${base(aid)}/documenti/completezza`)),
  avviaFirma: async (aid: number, tipo: string, id: number) =>
    dati<{ token: string; cellulare: string | null; codice_prova?: string }>(await manda(`${base(aid)}/documenti/${tipo}/${id}/firma/avvia`)),
  firma: async (aid: number, tipo: string, id: number, token: string, codice: string, letto: boolean) =>
    dati<Esito>(await manda(`${base(aid)}/documenti/${tipo}/${id}/firma`, { token, codice, letto })),
  nuovaVersione: async (aid: number, id: number, file: File, nota: string, scadenza: string | null) => {
    const fd = new FormData();
    fd.append('file', file);
    if (nota) fd.append('nota', nota);
    if (scadenza) fd.append('scadenza', scadenza);
    try {
      return dati<Esito & { id: number; versione: number }>(await apiUpload(`${base(aid)}/documenti/${id}/versione`, fd));
    } catch (e) {
      throw erroreLeggibile(e);
    }
  },
};

// ---------------------------------------------------------------- completa il fascicolo

export interface VoceAttrezzatura { gruppo: 'macchinari' | 'attrezzature' | 'chimici'; nome: string; fonte?: 'suggerita' | 'aggiunta' | 'etichetta'; pittogrammi?: string[] }

export interface StatoAttrezzature {
  gruppi: Array<{ chiave: VoceAttrezzatura['gruppo']; nome: string; scelte: VoceAttrezzatura[]; suggerite: string[] }>;
  confermato: boolean;
  riepilogo: string;
  puo: boolean;
}

export interface StatoFascicolo {
  stato: 'azienda' | 'isfor' | 'completo';
  etichetta: string;
  isfor: Array<{ voce: string; fatto: boolean }>;
}

export const fascicolo = {
  stato: async (aid: number) => dati<StatoFascicolo>(await prendi(`${base(aid)}/fascicolo/stato`)),
  attrezzature: async (aid: number) => dati<StatoAttrezzature>(await prendi(`${base(aid)}/fascicolo/attrezzature`)),
  salva: async (aid: number, voci: VoceAttrezzatura[], conferma: boolean) => dati<{ titolo: string }>(await manda(`${base(aid)}/fascicolo/attrezzature`, { voci, conferma }, 'PUT')),
  etichetta: async (aid: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      return dati<{ nome: string; pittogrammi: string[] }>(await apiUpload(`${base(aid)}/fascicolo/attrezzature/etichetta`, fd));
    } catch (e) {
      throw erroreLeggibile(e);
    }
  },
};
