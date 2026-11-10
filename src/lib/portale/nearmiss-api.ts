/**
 * Near miss (mancati infortuni) e link del lavoratore: API del Portale per area
 * azienda e gestionale. Mappatori tolleranti, nessuna chiamata fuori dalla
 * modalita' API (demo: elenco vuoto).
 */

import { apiUpload, getToken, apiUrl } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

export type StatoNearMiss = 'ricevuta' | 'presa_in_carico' | 'analisi' | 'azioni' | 'chiusa';
export type GravitaNearMiss = 'bassa' | 'media' | 'alta' | 'grave';

export const STATI_NEAR_MISS: Array<{ k: StatoNearMiss; t: string }> = [
  { k: 'ricevuta', t: 'Ricevuta' },
  { k: 'presa_in_carico', t: 'Presa in carico' },
  { k: 'analisi', t: 'Analisi' },
  { k: 'azioni', t: 'Azioni' },
  { k: 'chiusa', t: 'Chiusa' },
];

export const GRAVITA_NEAR_MISS: Array<{
  k: GravitaNearMiss;
  t: string;
  sotto: string;
}> = [
  { k: 'bassa', t: 'Bassa', sotto: 'al massimo un graffio' },
  { k: 'media', t: 'Media', sotto: 'una ferita da medicare' },
  { k: 'alta', t: 'Alta', sotto: 'un infortunio con giorni di assenza' },
  { k: 'grave', t: 'Grave', sotto: 'un infortunio grave' },
];

export function etichettaStato(s: string | null | undefined): string {
  return STATI_NEAR_MISS.find((x) => x.k === s)?.t ?? 'Ricevuta';
}

/** Indice del passo nel flusso (0-4), per la barra di avanzamento. */
export function passoNearMiss(s: string | null | undefined): number {
  const i = STATI_NEAR_MISS.findIndex((x) => x.k === s);
  return i < 0 ? 0 : i;
}

/** Cosa si fa adesso, dato lo stato. */
export function prossimaAzione(s: StatoNearMiss): 'presa' | 'analisi' | 'azioni' | 'chiudi' | null {
  if (s === 'ricevuta') return 'presa';
  if (s === 'presa_in_carico') return 'analisi';
  if (s === 'analisi') return 'azioni';
  if (s === 'azioni') return 'chiudi';
  return null;
}

export interface RischioDvr {
  dvr_id: number;
  dvr_versione: number;
  indice: number;
  etichetta: string;
  livello: string;
  pericolo: string;
}

export interface AzioneNearMiss {
  descrizione: string;
  responsabile: string;
  entro: string;
  scadenza_id: number | null;
}

export interface NearMiss {
  id: number;
  codice: string;
  aziendaId: number | null;
  origine: string;
  anonima: boolean;
  segnalatoDa: string;
  descrizione: string;
  dove: string | null;
  sede: string | null;
  accadutoIl: string | null;
  ricevutaIl: string | null;
  gravita: GravitaNearMiss;
  stato: StatoNearMiss;
  foto: number;
  classificazione: string | null;
  rischio: RischioDvr | null;
  notaVocale: string | null;
  analisi: {
    cause: string[];
    misure: string[];
    classificazione: string | null;
    nota: string | null;
    propostaAi: boolean;
  } | null;
  azioni: AzioneNearMiss[];
  esito: string | null;
  chiusaIl: string | null;
  registro: Array<{ quando: string; cosa: string; chi: string }>;
}

const strs = (v: unknown): string[] =>
  lista(v)
    .map((x) => testo(x))
    .filter((x): x is string => x !== null);

function rischio(v: unknown): RischioDvr | null {
  const r = rec(v);
  const id = numero(r.dvr_id);
  if (id === null) return null;
  return {
    dvr_id: id,
    dvr_versione: numero(r.dvr_versione) ?? 0,
    indice: numero(r.indice) ?? 0,
    etichetta: testo(r.etichetta) ?? 'Rischio',
    livello: testo(r.livello) ?? '',
    pericolo: testo(r.pericolo) ?? '',
  };
}

export function mappaNearMiss(raw: unknown): NearMiss | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const a = r.analisi ? rec(r.analisi) : null;
  const stato = (STATI_NEAR_MISS.some((x) => x.k === r.stato) ? r.stato : 'ricevuta') as StatoNearMiss;
  const gravita = (GRAVITA_NEAR_MISS.some((x) => x.k === r.gravita) ? r.gravita : 'media') as GravitaNearMiss;
  return {
    id,
    codice: testo(r.codice) ?? `NM ${id}`,
    aziendaId: numero(r.azienda_id),
    origine: testo(r.origine) ?? 'lavoratore',
    anonima: r.anonima === true,
    segnalatoDa: testo(r.segnalato_da) ?? 'Anonimo',
    descrizione: testo(r.descrizione) ?? '',
    dove: testo(r.dove),
    sede: testo(r.sede),
    accadutoIl: testo(r.accaduto_il),
    ricevutaIl: testo(r.ricevuta_il),
    gravita,
    stato,
    foto: numero(r.foto) ?? 0,
    classificazione: testo(r.classificazione),
    rischio: rischio(r.rischio_dvr),
    notaVocale: testo(r.nota_vocale),
    analisi: a
      ? {
          cause: strs(a.cause),
          misure: strs(a.misure),
          classificazione: testo(a.classificazione),
          nota: testo(a.nota),
          propostaAi: a.proposta_ai === true,
        }
      : null,
    azioni: lista(r.azioni).map((x) => {
      const z = rec(x);
      return {
        descrizione: testo(z.descrizione) ?? '',
        responsabile: testo(z.responsabile) ?? '',
        entro: testo(z.entro) ?? '',
        scadenza_id: numero(z.scadenza_id),
      };
    }),
    esito: testo(r.esito),
    chiusaIl: testo(r.chiusa_il),
    registro: lista(r.registro).map((x) => {
      const z = rec(x);
      return {
        quando: testo(z.quando) ?? '',
        cosa: testo(z.cosa) ?? '',
        chi: testo(z.chi) ?? '',
      };
    }),
  };
}

export interface StatisticheNearMiss {
  totale: number;
  aperti: number;
  daPrendere: number;
  perGravita: Record<string, number>;
  perClassificazione: Array<{ k: string; n: number }>;
  perMese: Array<{ mese: string; numero: number }>;
  giorniMedi: number | null;
  collegatiDvr: number;
  anonimi: number;
}

export interface RegistroNearMiss {
  voci: NearMiss[];
  statistiche: StatisticheNearMiss;
  classificazioni: Record<string, string>;
}

const VUOTO: RegistroNearMiss = {
  voci: [],
  statistiche: {
    totale: 0,
    aperti: 0,
    daPrendere: 0,
    perGravita: {},
    perClassificazione: [],
    perMese: [],
    giorniMedi: null,
    collegatiDvr: 0,
    anonimi: 0,
  },
  classificazioni: {},
};

export function mappaRegistro(raw: unknown): RegistroNearMiss {
  const r = rec(raw);
  const s = rec(r.statistiche);
  const cls = rec(r.classificazioni);
  return {
    voci: lista(r.near_miss)
      .map(mappaNearMiss)
      .filter((x): x is NearMiss => x !== null),
    statistiche: {
      totale: numero(s.totale) ?? 0,
      aperti: numero(s.aperti) ?? 0,
      daPrendere: numero(s.da_prendere_in_carico) ?? 0,
      perGravita: Object.fromEntries(Object.entries(rec(s.per_gravita)).map(([k, v]) => [k, numero(v) ?? 0])),
      perClassificazione: Object.entries(rec(s.per_classificazione))
        .map(([k, v]) => ({ k, n: numero(v) ?? 0 }))
        .sort((a, b) => b.n - a.n),
      perMese: lista(s.per_mese).map((x) => ({
        mese: testo(rec(x).mese) ?? '',
        numero: numero(rec(x).numero) ?? 0,
      })),
      giorniMedi: numero(s.giorni_medi_chiusura),
      collegatiDvr: numero(s.collegati_al_dvr) ?? 0,
      anonimi: numero(s.anonimi) ?? 0,
    },
    classificazioni: Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, testo(v) ?? k])),
  };
}

export async function registroNearMiss(aziendaId: number, stato?: string): Promise<RegistroNearMiss> {
  if (!isApiMode()) return VUOTO;
  const r = rec(await prendi(`/portale/aziende/${aziendaId}/near-miss${stato ? `?stato=${encodeURIComponent(stato)}` : ''}`));
  return mappaRegistro(r.data);
}

export async function nearMiss(id: number): Promise<NearMiss | null> {
  if (!isApiMode()) return null;
  return mappaNearMiss(rec(await prendi(`/portale/near-miss/${id}`)).data);
}

async function azione(id: number, cosa: string, body?: Record<string, unknown>): Promise<NearMiss | null> {
  return mappaNearMiss(rec(await manda(`/portale/near-miss/${id}/${cosa}`, body)).data);
}

export const prendiInCarico = (id: number) => azione(id, 'presa-in-carico');
export const registraAnalisi = (
  id: number,
  d: {
    cause: string[];
    misure: string[];
    classificazione: string;
    rischio_indice: number | null;
    nota?: string;
    proposta_ai?: boolean;
  },
) => azione(id, 'analisi', d as unknown as Record<string, unknown>);
export const aggiungiAzione = (id: number, d: { descrizione: string; responsabile: string; entro: string }) => azione(id, 'azioni', d);
export const chiudiNearMiss = (id: number, esito: string) => azione(id, 'chiudi', { esito });

export interface PropostaAnalisi {
  cause: string[];
  misure: string[];
  classificazione: string;
  rischioIndice: number | null;
  fonte: 'ai' | 'regole';
  rischiDvr: Array<{
    indice: number;
    etichetta: string;
    livello: string;
    pericolo: string;
  }>;
  dvr: { id: number; versione: number } | null;
  disclaimer: string;
}

export async function proponiAnalisi(id: number): Promise<PropostaAnalisi> {
  const r = rec(rec(await manda(`/portale/near-miss/${id}/analisi/proponi`)).data);
  const d = rec(r.dvr);
  return {
    cause: strs(r.cause),
    misure: strs(r.misure),
    classificazione: testo(r.classificazione) ?? 'altro',
    rischioIndice: numero(r.rischio_indice),
    fonte: r.fonte === 'ai' ? 'ai' : 'regole',
    rischiDvr: lista(r.rischi_dvr).map((x) => {
      const z = rec(x);
      return {
        indice: numero(z.indice) ?? 0,
        etichetta: testo(z.etichetta) ?? '',
        livello: testo(z.livello) ?? '',
        pericolo: testo(z.pericolo) ?? '',
      };
    }),
    dvr: numero(d.id) !== null ? { id: numero(d.id)!, versione: numero(d.versione) ?? 0 } : null,
    disclaimer: testo(r.disclaimer) ?? 'Proposta generata con assistenza AI: va verificata.',
  };
}

export async function segnalaNearMissAzienda(
  aziendaId: number,
  d: {
    descrizione: string;
    dove?: string;
    quando?: string;
    gravita: GravitaNearMiss;
    foto?: File[];
  },
): Promise<NearMiss | null> {
  const fd = new FormData();
  fd.append('descrizione', d.descrizione);
  if (d.dove) fd.append('dove', d.dove);
  if (d.quando) fd.append('quando', d.quando);
  fd.append('gravita', d.gravita);
  (d.foto ?? []).forEach((f) => fd.append('foto[]', f));
  try {
    return mappaNearMiss(rec(await apiUpload(`/portale/aziende/${aziendaId}/near-miss`, fd)).data);
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

/** Foto sanificata della segnalazione, come URL locale (serve il token). */
export async function fotoNearMiss(id: number, n: number): Promise<string | null> {
  try {
    const t = getToken();
    const r = await fetch(apiUrl(`/portale/near-miss/${id}/foto/${n}`), {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- link del lavoratore

export async function creaLinkLavoratore(lavoratoreId: number): Promise<string> {
  const r = rec(rec(await manda(`/portale/lavoratori/${lavoratoreId}/link`)).data);
  const url = testo(r.url);
  if (!url) throw new Error('Link non creato. Riprova.');
  return url;
}

export async function spegniLinkLavoratore(lavoratoreId: number): Promise<void> {
  await manda(`/portale/lavoratori/${lavoratoreId}/link`, undefined, 'DELETE');
}
