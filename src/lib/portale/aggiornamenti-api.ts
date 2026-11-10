/**
 * Aggiornamento automatico (ADR-009, V8): cosa è cambiato nelle aziende e cosa va
 * aggiornato (impatti), importazioni dagli export dei sistemi delle aziende.
 * Ogni risposta passa da un mappatore tollerante; senza backend le chiamate
 * restituiscono vuoto.
 */

import { isApiMode } from '@/lib/data-source';
import { lista, manda, numero, prendi, rec, testo } from './api';

export type Priorita = 'alta' | 'media' | 'bassa';
export type StatoImpatto = 'aperto' | 'in_corso' | 'chiuso' | 'non_serve';

export interface Impatto {
  id: number;
  aziendaId: number;
  ragioneSociale: string | null;
  documento: string;
  documentoNome: string;
  titolo: string;
  motivo: string;
  riferimento: string | null;
  entro: string | null;
  priorita: Priorita;
  stato: StatoImpatto;
  occorrenze: number;
  propostaId: number | null;
  scadenzaId: number | null;
  notaChiusura: string | null;
  motivi: Array<{ etichetta: string | null; testo: string; il: string | null }>;
  aggiornatoIl: string | null;
}

export interface CambiamentoRecente {
  id: number;
  aziendaId: number | null;
  ragioneSociale: string | null;
  tipo: string;
  etichetta: string;
  sintesi: string;
  fonte: string;
  impatti: number;
  il: string | null;
}

export interface ElencoAggiornamenti {
  impatti: Impatto[];
  cambiamenti: CambiamentoRecente[];
  conteggi: { aperti: number; alta: number; inRitardo: number; cambiamenti: number };
  puoDecidere: boolean;
}

const PRIORITA: Priorita[] = ['alta', 'media', 'bassa'];
const STATI: StatoImpatto[] = ['aperto', 'in_corso', 'chiuso', 'non_serve'];

export function mappaImpatto(raw: unknown): Impatto | null {
  const r = rec(raw);
  const id = numero(r.id);
  const azienda = numero(r.azienda_id);
  if (id === null || azienda === null) return null;
  const p = testo(r.priorita) as Priorita | null;
  const s = testo(r.stato) as StatoImpatto | null;
  return {
    id,
    aziendaId: azienda,
    ragioneSociale: testo(r.ragione_sociale),
    documento: testo(r.documento) ?? 'documento',
    documentoNome: testo(r.documento_nome) ?? testo(r.documento) ?? 'Documento',
    titolo: testo(r.titolo) ?? 'Aggiornamento',
    motivo: testo(r.motivo) ?? '',
    riferimento: testo(r.riferimento),
    entro: testo(r.entro),
    priorita: p && PRIORITA.includes(p) ? p : 'media',
    stato: s && STATI.includes(s) ? s : 'aperto',
    occorrenze: numero(r.occorrenze) ?? 1,
    propostaId: numero(r.proposta_id),
    scadenzaId: numero(r.scadenza_id),
    notaChiusura: testo(r.nota_chiusura),
    motivi: lista(r.motivi).map((m) => {
      const x = rec(m);
      return { etichetta: testo(x.etichetta), testo: testo(x.testo) ?? '', il: testo(x.il) };
    }),
    aggiornatoIl: testo(r.aggiornato_il),
  };
}

export function mappaElenco(raw: unknown): ElencoAggiornamenti {
  const r = rec(raw);
  const c = rec(r.conteggi);
  return {
    impatti: lista(r.impatti).map(mappaImpatto).filter((x): x is Impatto => x !== null),
    cambiamenti: lista(r.cambiamenti)
      .map((x) => {
        const m = rec(x);
        const id = numero(m.id);
        if (id === null) return null;
        return {
          id,
          aziendaId: numero(m.azienda_id),
          ragioneSociale: testo(m.ragione_sociale),
          tipo: testo(m.tipo) ?? '',
          etichetta: testo(m.etichetta) ?? 'Cambiamento',
          sintesi: testo(m.sintesi) ?? '',
          fonte: testo(m.fonte) ?? 'app',
          impatti: numero(m.impatti) ?? 0,
          il: testo(m.il),
        } satisfies CambiamentoRecente;
      })
      .filter((x): x is CambiamentoRecente => x !== null),
    conteggi: { aperti: numero(c.aperti) ?? 0, alta: numero(c.alta) ?? 0, inRitardo: numero(c.in_ritardo) ?? 0, cambiamenti: numero(c.cambiamenti) ?? 0 },
    puoDecidere: r.puo_decidere === true,
  };
}

/** Oltre il termine: termine passato e impatto ancora attivo. */
export function inRitardo(i: Impatto, oggi: Date = new Date()): boolean {
  if (!i.entro || (i.stato !== 'aperto' && i.stato !== 'in_corso')) return false;
  const g = new Date(`${i.entro}T23:59:59`);
  return !Number.isNaN(g.getTime()) && g.getTime() < oggi.getTime();
}

/** Raggruppa per azienda mantenendo l'ordine del backend (priorità, poi termine). */
export function perAzienda(impatti: Impatto[]): Array<{ aziendaId: number; ragioneSociale: string; voci: Impatto[] }> {
  const out: Array<{ aziendaId: number; ragioneSociale: string; voci: Impatto[] }> = [];
  for (const i of impatti) {
    let g = out.find((x) => x.aziendaId === i.aziendaId);
    if (!g) {
      g = { aziendaId: i.aziendaId, ragioneSociale: i.ragioneSociale ?? `Azienda ${i.aziendaId}`, voci: [] };
      out.push(g);
    }
    g.voci.push(i);
  }
  return out;
}

export const VUOTO: ElencoAggiornamenti = { impatti: [], cambiamenti: [], conteggi: { aperti: 0, alta: 0, inRitardo: 0, cambiamenti: 0 }, puoDecidere: false };

export async function elencoAggiornamenti(opz: { aziendaId?: number | null; stato?: 'attivi' | 'chiusi' | 'tutti'; giorni?: number } = {}): Promise<ElencoAggiornamenti> {
  if (!isApiMode()) return VUOTO;
  const q = new URLSearchParams();
  if (opz.aziendaId) q.set('azienda_id', String(opz.aziendaId));
  if (opz.stato) q.set('stato', opz.stato);
  if (opz.giorni) q.set('giorni', String(opz.giorni));
  const r = rec(await prendi(`/portale/aggiornamenti${q.toString() ? `?${q}` : ''}`));
  return mappaElenco(r.data);
}

export async function decidiImpatto(id: number, stato: StatoImpatto, nota?: string): Promise<Impatto | null> {
  if (!isApiMode()) return null;
  const r = rec(await manda(`/portale/aggiornamenti/${id}/stato`, { stato, nota: nota ?? null }));
  return mappaImpatto(rec(r.data).impatto);
}

// ---------------------------------------------------------------- importazioni

export type EntitaImport = 'lavoratori' | 'attrezzature' | 'presenze';

export interface Differenza {
  indice: number;
  tipo: string;
  nome: string;
  nota: string;
  applica: boolean;
  riga: number | null;
  esito: string | null;
}

export interface Importazione {
  id: number;
  entita: EntitaImport;
  nomeFile: string | null;
  stato: 'proposta' | 'applicata' | 'respinta' | 'errore';
  righeTotali: number;
  differenze: Differenza[];
  scartate: Array<{ riga: number | null; motivo: string }>;
  conteggi: Record<string, number>;
  applicate: number | null;
  creataIl: string | null;
}

export const ETICHETTE_DIFFERENZA: Record<string, string> = {
  nuovo: 'Nuovo lavoratore',
  cambio_mansione: 'Cambio di mansione',
  cessato: 'Cessato',
  assente: 'Non nell’export',
  nuova: 'Nuova attrezzatura',
  dismessa: 'Dismessa',
  verifica: 'Verifica aggiornata',
  presenza: 'Presenza',
  assenza: 'Assenza',
  non_dichiarato: 'Non in anagrafica',
  senza_scadenza: 'Senza scadenza collegata',
};

export function etichettaDifferenza(tipo: string): string {
  return ETICHETTE_DIFFERENZA[tipo] ?? tipo.replace(/_/g, ' ');
}

export function mappaImportazione(raw: unknown): Importazione | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const ent = testo(r.entita) as EntitaImport | null;
  const st = testo(r.stato) as Importazione['stato'] | null;
  const conteggi: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(r.conteggi))) {
    const n = numero(v);
    if (n !== null) conteggi[k] = n;
  }
  return {
    id,
    entita: ent === 'attrezzature' || ent === 'presenze' ? ent : 'lavoratori',
    nomeFile: testo(r.nome_file),
    stato: st === 'applicata' || st === 'respinta' || st === 'errore' ? st : 'proposta',
    righeTotali: numero(r.righe_totali) ?? 0,
    differenze: lista(r.differenze).map((d, k) => {
      const x = rec(d);
      return {
        indice: numero(x.indice) ?? k,
        tipo: testo(x.tipo) ?? '',
        nome: testo(x.nome) ?? '',
        nota: testo(x.nota) ?? '',
        applica: x.applica === true,
        riga: numero(x.riga),
        esito: testo(x.esito),
      };
    }),
    scartate: lista(r.scartate).map((s) => {
      const x = rec(s);
      return { riga: numero(x.riga), motivo: testo(x.motivo) ?? '' };
    }),
    conteggi,
    applicate: numero(rec(r.esito).applicate),
    creataIl: testo(r.creata_il),
  };
}

const NOMI_CONTEGGI: Record<string, [string, string]> = {
  nuovi: ['nuovo lavoratore', 'nuovi lavoratori'],
  cambi_mansione: ['cambio di mansione', 'cambi di mansione'],
  cessati: ['cessato', 'cessati'],
  assenti: ['non presente nell\u2019export', 'non presenti nell\u2019export'],
  scartate: ['riga non letta', 'righe non lette'],
  nuove: ['nuova attrezzatura', 'nuove attrezzature'],
  dismesse: ['attrezzatura dismessa', 'attrezzature dismesse'],
  verifiche: ['verifica aggiornata', 'verifiche aggiornate'],
  presenze: ['presenza', 'presenze'],
  assenze: ['assenza', 'assenze'],
  non_dichiarati: ['lavoratore non in anagrafica', 'lavoratori non in anagrafica'],
  senza_scadenza: ['senza scadenza collegata', 'senza scadenza collegata'],
};

/** Testo breve dei conteggi ("1 nuovo lavoratore, 2 cambi di mansione"), senza gli invariati. */
export function sintesiConteggi(c: Record<string, number>): string {
  const parti = Object.entries(c)
    .filter(([k, v]) => v > 0 && k !== 'invariati' && k !== 'invariate')
    .map(([k, v]) => {
      const n = NOMI_CONTEGGI[k];
      return `${v} ${n ? n[v === 1 ? 0 : 1] : k.replace(/_/g, ' ')}`;
    });
  return parti.length ? parti.join(', ') : 'nessuna differenza';
}

export async function inviaImportazione(aziendaId: number, entita: EntitaImport, righe: Array<Record<string, string>>, nomeFile: string): Promise<Importazione | null> {
  if (!isApiMode()) return null;
  const r = rec(await manda(`/portale/aziende/${aziendaId}/importazioni`, { entita, righe, nome_file: nomeFile }));
  return mappaImportazione(rec(r.data).importazione);
}

export async function importazioniRecenti(aziendaId: number): Promise<Importazione[]> {
  if (!isApiMode()) return [];
  const r = rec(await prendi(`/portale/aziende/${aziendaId}/importazioni`));
  return lista(r.data).map(mappaImportazione).filter((x): x is Importazione => x !== null);
}

export async function applicaImportazione(id: number, indici?: number[]): Promise<Importazione | null> {
  if (!isApiMode()) return null;
  const r = rec(await manda(`/portale/importazioni/${id}/applica`, indici ? { indici } : {}));
  return mappaImportazione(rec(r.data).importazione);
}

export async function respingiImportazione(id: number, nota?: string): Promise<Importazione | null> {
  if (!isApiMode()) return null;
  const r = rec(await manda(`/portale/importazioni/${id}/respingi`, { nota: nota ?? null }));
  return mappaImportazione(rec(r.data).importazione);
}
