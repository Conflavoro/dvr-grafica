/**
 * Mappatori tolleranti delle risposte cowork.v1: un campo mancante o di tipo
 * inatteso diventa un valore neutro, mai un errore che rompe la pagina.
 * I campi sconosciuti si ignorano (regola del contratto).
 */

import type {
  AzioneParagrafo,
  AzioneSuggerita,
  Banner,
  Cella,
  Colonna,
  ContaControlli,
  Conteggio,
  Controlli,
  Controllo,
  Documento,
  DocumentoAzienda,
  EventoFlusso,
  Fonte,
  Lavoro,
  LavoroInAttesa,
  Paragrafo,
  RigaConfronto,
  Sezione,
  Tabella,
  Testata,
  Versione,
  VoceIndice,
} from './tipi';

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const testo = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const chiave = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : testo(v));
const intero0 = (v: unknown): number => numero(v) ?? 0;

const AZIONI: AzioneParagrafo[] = ['accetta', 'modifica', 'riscrivi', 'rigenera', 'non_applicabile'];

export function mappaFonte(raw: unknown): Fonte | null {
  const r = rec(raw);
  const etichetta = testo(r.etichetta);
  if (!etichetta) return null;
  return { tipo: testo(r.tipo) ?? 'fonte', id: numero(r.id), etichetta, estratto: testo(r.estratto) };
}

const fonti = (v: unknown): Fonte[] => lista(v).map(mappaFonte).filter((x): x is Fonte => x !== null);

const conteggio = (v: unknown): Conteggio => {
  const r = rec(v);
  return { totali: intero0(r.totali), chiusi: intero0(r.chiusi) };
};

export function mappaContaControlli(v: unknown): ContaControlli {
  const r = rec(v);
  return { bloccanti: intero0(r.bloccanti), avvisi: intero0(r.avvisi), info: intero0(r.info) };
}

export function mappaTestata(raw: unknown): Testata | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const t = rec(r.tecnico);
  const tid = numero(t.id);
  return {
    tipo: testo(r.tipo) ?? 'dvr',
    id,
    aziendaId: numero(r.azienda_id),
    titolo: testo(r.titolo) ?? 'Documento di valutazione dei rischi',
    versione: numero(r.versione),
    stato: testo(r.stato) ?? 'bozza',
    statoDocumento: testo(r.stato_documento) ?? 'draft',
    revisione: numero(r.revisione),
    tecnico: tid !== null ? { id: tid, nome: testo(t.nome) ?? '' } : null,
    oreSulDocumento: numero(r.ore_sul_documento),
    livello: numero(r.livello),
    aggiornatoIl: testo(r.aggiornato_il),
  };
}

export function mappaBanner(raw: unknown): Banner {
  const r = rec(raw);
  return {
    paragrafiAssistente: intero0(r.paragrafi_assistente),
    paragrafiUmani: intero0(r.paragrafi_umani),
    rischiValutati: numero(r.rischi_valutati),
    citazioni: numero(r.citazioni),
    generatoIl: testo(r.generato_il),
    fonti: fonti(r.fonti),
  };
}

export function mappaVoceIndice(raw: unknown): VoceIndice | null {
  const r = rec(raw);
  const k = chiave(r.chiave);
  if (!k) return null;
  return {
    chiave: k,
    titolo: testo(r.titolo) ?? `Sezione ${k}`,
    ordine: numero(r.ordine) ?? 9999,
    stato: testo(r.stato) ?? 'in_preparazione',
    paragrafi: conteggio(r.paragrafi),
    motivo: testo(r.motivo),
  };
}

const lavoro = (raw: unknown): Lavoro => {
  const r = rec(raw);
  return { sezione: chiave(r.sezione), fase: testo(r.fase) ?? 'redazione', da: testo(r.da) };
};

const lavoroInAttesa = (raw: unknown): LavoroInAttesa => {
  const r = rec(raw);
  return { sezione: chiave(r.sezione), stato: testo(r.stato) ?? 'in_attesa', priorita: testo(r.priorita), prontoDal: testo(r.pronto_dal), eventi: intero0(r.eventi) };
};

export function mappaDocumento(raw: unknown): Documento | null {
  const r = rec(raw);
  const testata = mappaTestata(r.documento);
  if (!testata) return null;
  return {
    testata,
    banner: mappaBanner(r.banner),
    indice: lista(r.indice)
      .map(mappaVoceIndice)
      .filter((x): x is VoceIndice => x !== null)
      .sort((a, b) => a.ordine - b.ordine),
    controlli: mappaContaControlli(r.controlli),
    lavoriInCorso: lista(r.lavori_in_corso).map(lavoro),
    lavoriInAttesa: lista(r.lavori_in_attesa).map(lavoroInAttesa),
    cursore: testo(r.cursore),
  };
}

export function mappaVersione(raw: unknown): Versione | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null && typeof r.testo !== 'string') return null;
  return {
    id: id ?? 0,
    versione: numero(r.versione) ?? 0,
    testo: typeof r.testo === 'string' ? r.testo : '',
    origine: testo(r.origine) ?? 'ai',
    istruzione: testo(r.istruzione),
    autoreId: numero(r.autore_id),
    revisione: numero(r.revisione),
    fonti: fonti(r.fonti),
    creataIl: testo(r.creata_il),
  };
}

const rigaConfronto = (raw: unknown): RigaConfronto | null => {
  const r = rec(raw);
  const op = r.op === '-' || r.op === '+' || r.op === '=' ? r.op : null;
  return op && typeof r.testo === 'string' ? { op, testo: r.testo } : null;
};

export function mappaParagrafo(raw: unknown): Paragrafo | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const c = r.confronto;
  return {
    id,
    chiave: chiave(r.chiave) ?? String(id),
    sezione: chiave(r.sezione) ?? '',
    ordine: numero(r.ordine) ?? 0,
    tipo: testo(r.tipo) ?? 'testo',
    stato: testo(r.stato) ?? 'in_preparazione',
    motivo: testo(r.motivo),
    versioneBase: numero(r.versione_base) ?? 0,
    accettata: r.accettata ? mappaVersione(r.accettata) : null,
    proposta: r.proposta ? mappaVersione(r.proposta) : null,
    confronto: Array.isArray(c) ? c.map(rigaConfronto).filter((x): x is RigaConfronto => x !== null) : null,
    azioni: lista(r.azioni).filter((x): x is AzioneParagrafo => AZIONI.includes(x as AzioneParagrafo)),
  };
}

const cella = (v: unknown): Cella => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number');
  return null;
};

export function mappaTabella(raw: unknown): Tabella | null {
  const r = rec(raw);
  const colonne = lista(r.colonne)
    .map((c): Colonna | null => {
      const x = rec(c);
      const k = chiave(x.chiave);
      return k ? { chiave: k, etichetta: testo(x.etichetta) ?? k } : null;
    })
    .filter((x): x is Colonna => x !== null);
  if (colonne.length === 0) return null;
  return {
    chiave: chiave(r.chiave) ?? 'tabella',
    titolo: testo(r.titolo) ?? 'Dati della sezione',
    origine: testo(r.origine) ?? 'dati',
    colonne,
    righe: lista(r.righe).map((riga) => {
      const x = rec(riga);
      const out: Record<string, Cella> = {};
      for (const col of colonne) out[col.chiave] = cella(x[col.chiave]);
      return out;
    }),
  };
}

export function mappaSezione(raw: unknown): Sezione | null {
  const r = rec(raw);
  const s = rec(r.sezione);
  const k = chiave(s.chiave);
  if (!k) return null;
  return {
    chiave: k,
    titolo: testo(s.titolo) ?? `Sezione ${k}`,
    stato: testo(s.stato) ?? 'in_preparazione',
    paragrafi: conteggio(s.paragrafi),
    elenco: lista(r.paragrafi)
      .map(mappaParagrafo)
      .filter((x): x is Paragrafo => x !== null)
      .sort((a, b) => a.ordine - b.ordine),
    tabelle: lista(r.tabelle).map(mappaTabella).filter((x): x is Tabella => x !== null),
  };
}

export function mappaAzioneSuggerita(raw: unknown): AzioneSuggerita | null {
  const r = rec(raw);
  const strumento = testo(r.strumento);
  if (!strumento) return null;
  return { strumento, etichetta: testo(r.etichetta) ?? 'Esegui', argomenti: rec(r.argomenti) };
}

export function mappaControllo(raw: unknown): Controllo | null {
  const r = rec(raw);
  const id = numero(r.id);
  const messaggio = testo(r.messaggio);
  if (id === null || !messaggio) return null;
  return {
    id,
    regola: testo(r.regola) ?? '',
    livello: testo(r.livello) ?? 'info',
    stato: testo(r.stato) ?? 'aperto',
    messaggio,
    riferimento: testo(r.riferimento),
    sezione: chiave(r.sezione),
    paragrafoId: numero(r.paragrafo_id),
    azione: r.azione ? mappaAzioneSuggerita(r.azione) : null,
    motivo: testo(r.motivo),
    fonte: testo(r.fonte),
    accettatoIl: testo(r.accettato_il),
    azioni: lista(r.azioni).filter((x): x is string => typeof x === 'string'),
  };
}

export function mappaControlli(raw: unknown): Controlli {
  const c = rec(rec(raw).controlli);
  const voci = (v: unknown) => lista(v).map(mappaControllo).filter((x): x is Controllo => x !== null);
  return { bloccanti: voci(c.bloccanti), avvisi: voci(c.avvisi), info: voci(c.info) };
}

export function mappaEvento(raw: unknown): EventoFlusso | null {
  const r = rec(raw);
  const d = rec(r.documento);
  const tipo = testo(r.tipo) ?? testo(r.evento);
  if (!tipo) return null;
  return {
    tipo,
    documentoTipo: testo(r.documento_tipo) ?? testo(d.tipo),
    documentoId: numero(r.documento_id) ?? numero(d.id),
    sezione: chiave(r.sezione) ?? chiave(r.sezione_chiave),
    paragrafoId: numero(r.paragrafo_id),
  };
}

/** Risposta del flusso: voci e nuovo cursore (chiavi tolleranti, il contratto della fase 7 non e' ancora scritto). */
export function mappaFlusso(raw: unknown): { voci: EventoFlusso[]; cursore: string | null } {
  const r = rec(raw);
  const grezze = Array.isArray(r.voci) ? r.voci : Array.isArray(r.eventi) ? r.eventi : lista(r.data);
  return {
    voci: grezze.map(mappaEvento).filter((x): x is EventoFlusso => x !== null),
    cursore: testo(r.cursore) ?? chiave(r.prossimo),
  };
}

export function mappaDocumentiAzienda(raw: unknown): DocumentoAzienda[] {
  return lista(rec(raw).documenti)
    .map((x): DocumentoAzienda | null => {
      const r = rec(x);
      const id = numero(r.id);
      if (id === null) return null;
      const p = rec(r.paragrafi);
      return {
        tipo: testo(r.tipo) ?? 'dvr',
        id,
        titolo: testo(r.titolo) ?? 'Documento',
        versione: numero(r.versione),
        stato: testo(r.stato) ?? 'bozza',
        statoDocumento: testo(r.stato_documento) ?? 'draft',
        revisione: numero(r.revisione),
        paragrafi: {
          totali: intero0(p.totali),
          proposti: intero0(p.proposti),
          accettati: intero0(p.accettati),
          daRivedere: intero0(p.da_rivedere),
          inPreparazione: intero0(p.in_preparazione),
          nonApplicabili: intero0(p.non_applicabili),
        },
        controlli: mappaContaControlli(r.controlli),
        aggiornatoIl: testo(r.aggiornato_il),
      };
    })
    .filter((x): x is DocumentoAzienda => x !== null);
}
