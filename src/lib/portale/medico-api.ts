/**
 * Portale del medico competente (gestionale, portali dei partner): aziende con
 * nomina attiva, lavoratori in sorveglianza, protocollo per mansione, registro
 * delle visite con l'esito del giudizio (mai diagnosi).
 */

import { apiUpload, apiUrl, getToken } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

export interface AziendaMedico {
  id: number;
  ragioneSociale: string;
  nominaFinoAl: string | null;
  giorniAllaScadenza: number | null;
  perdiAccesso: boolean;
  medico: string | null;
  lavoratori: number;
  inSorveglianza: number;
  entro60: number;
  prossimaGiornata: string | null;
}

export interface PanoramicaMedico {
  studio: boolean;
  totali: { aziende: number; inSorveglianza: number; entro60: number };
  aziende: AziendaMedico[];
  nomineChiuse: Array<{
    aziendaId: number;
    chiusaIl: string | null;
    motivo: string;
  }>;
  nota: string;
}

export interface LavoratoreMedico {
  id: number;
  nome: string;
  cognome: string;
  mansione: string | null;
  inSorveglianza: boolean;
  rischi: string[];
  ultimaVisita: string | null;
  validaFinoAl: string | null;
  esito: string | null;
  inCalendario: string | null;
  daFare: boolean;
  prossimaDefaultMesi: number;
}

export interface GiudizioMedico {
  id: number;
  lavoratoreId: number;
  lavoratore: string | null;
  dataVisita: string;
  tipoVisita: string;
  esito: string;
  esitoEtichetta: string;
  prescrizioni: string | null;
  validoFinoAl: string | null;
  haFile: boolean;
}

export interface DettaglioMedico {
  azienda: { id: number; ragioneSociale: string };
  puoRegistrare: boolean;
  dvr: { id: number; versione: number; approvatoIl: string | null } | null;
  protocollo: Array<{
    mansione: string;
    sorveglianza: string[];
    rischi: string[];
  }>;
  lavoratori: LavoratoreMedico[];
  registrate: GiudizioMedico[];
  esiti: Record<string, string>;
  tipiVisita: string[];
  periodi: number[];
}

const strs = (v: unknown): string[] =>
  lista(v)
    .map((x) => testo(x))
    .filter((x): x is string => x !== null);

export const ETICHETTE_TIPO_VISITA: Record<string, string> = {
  periodica: 'Periodica',
  preventiva: 'Preventiva',
  preassuntiva: 'Preassuntiva',
  su_richiesta: 'Su richiesta del lavoratore',
  cambio_mansione: 'Cambio mansione',
  rientro: 'Rientro dopo 60 giorni di assenza',
  cessazione: 'Alla cessazione del rapporto',
};

/** "Visita valida fino al" dalla data e dai mesi, come il backend (fine mese senza sforare). */
export function validaFinoAl(data: string, mesi: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m || !Number.isFinite(mesi) || mesi <= 0) return null;
  const a = Number(m[1]);
  const me = Number(m[2]) - 1 + mesi;
  const g = Number(m[3]);
  const anno = a + Math.floor(me / 12);
  const mese = me % 12;
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(anno, mese, Math.min(g, ultimo)));
  return d.toISOString().slice(0, 10);
}

export function mappaPanoramica(raw: unknown): PanoramicaMedico {
  const r = rec(raw);
  const t = rec(r.totali);
  return {
    studio: r.studio === true,
    totali: {
      aziende: numero(t.aziende) ?? 0,
      inSorveglianza: numero(t.in_sorveglianza) ?? 0,
      entro60: numero(t.entro_60) ?? 0,
    },
    aziende: lista(r.aziende)
      .map((x) => {
        const a = rec(x);
        const n = rec(a.nomina);
        const id = numero(a.id);
        if (id === null) return null;
        return {
          id,
          ragioneSociale: testo(a.ragione_sociale) ?? 'Azienda',
          nominaFinoAl: testo(n.fino_al),
          giorniAllaScadenza: numero(n.giorni_alla_scadenza),
          perdiAccesso: n.perdi_accesso === true,
          medico: testo(a.medico),
          lavoratori: numero(a.lavoratori) ?? 0,
          inSorveglianza: numero(a.in_sorveglianza) ?? 0,
          entro60: numero(a.entro_60_giorni) ?? 0,
          prossimaGiornata: testo(a.prossima_giornata),
        };
      })
      .filter((x): x is AziendaMedico => x !== null),
    nomineChiuse: lista(r.nomine_chiuse).map((x) => ({
      aziendaId: numero(rec(x).azienda_id) ?? 0,
      chiusaIl: testo(rec(x).chiusa_il),
      motivo: testo(rec(x).motivo) ?? '',
    })),
    nota: testo(r.nota) ?? '',
  };
}

function mappaGiudizio(raw: unknown): GiudizioMedico | null {
  const g = rec(raw);
  const id = numero(g.id);
  if (id === null) return null;
  return {
    id,
    lavoratoreId: numero(g.lavoratore_id) ?? 0,
    lavoratore: testo(g.lavoratore),
    dataVisita: testo(g.data_visita) ?? '',
    tipoVisita: testo(g.tipo_visita) ?? '',
    esito: testo(g.esito) ?? '',
    esitoEtichetta: testo(g.esito_etichetta) ?? '',
    prescrizioni: testo(g.prescrizioni),
    validoFinoAl: testo(g.valido_fino_al),
    haFile: g.ha_file === true,
  };
}

export function mappaDettaglio(raw: unknown): DettaglioMedico {
  const r = rec(raw);
  const a = rec(r.azienda);
  const d = rec(r.dvr);
  return {
    azienda: {
      id: numero(a.id) ?? 0,
      ragioneSociale: testo(a.ragione_sociale) ?? 'Azienda',
    },
    puoRegistrare: r.puo_registrare === true,
    dvr:
      numero(d.id) !== null
        ? {
            id: numero(d.id)!,
            versione: numero(d.versione) ?? 0,
            approvatoIl: testo(d.approvato_il),
          }
        : null,
    protocollo: lista(r.protocollo).map((x) => ({
      mansione: testo(rec(x).mansione) ?? '',
      sorveglianza: strs(rec(x).sorveglianza),
      rischi: strs(rec(x).rischi),
    })),
    lavoratori: lista(r.lavoratori)
      .map((x) => {
        const l = rec(x);
        const id = numero(l.id);
        if (id === null) return null;
        return {
          id,
          nome: testo(l.nome) ?? '',
          cognome: testo(l.cognome) ?? '',
          mansione: testo(l.mansione),
          inSorveglianza: l.in_sorveglianza === true,
          rischi: strs(l.rischi),
          ultimaVisita: testo(l.ultima_visita),
          validaFinoAl: testo(l.valida_fino_al),
          esito: testo(l.esito_etichetta),
          inCalendario: testo(l.in_calendario),
          daFare: l.da_fare_entro_60 === true,
          prossimaDefaultMesi: numero(l.prossima_default_mesi) ?? 12,
        };
      })
      .filter((x): x is LavoratoreMedico => x !== null),
    registrate: lista(r.registrate)
      .map(mappaGiudizio)
      .filter((x): x is GiudizioMedico => x !== null),
    esiti: Object.fromEntries(Object.entries(rec(r.esiti)).map(([k, v]) => [k, testo(v) ?? k])),
    tipiVisita: strs(r.tipi_visita),
    periodi: lista(r.periodi_mesi)
      .map((x) => numero(x))
      .filter((x): x is number => x !== null),
  };
}

export async function panoramicaMedico(): Promise<PanoramicaMedico> {
  if (!isApiMode()) return mappaPanoramica({});
  return mappaPanoramica(rec(await prendi('/portale/medico')).data);
}

export async function dettaglioMedico(aziendaId: number): Promise<DettaglioMedico> {
  return mappaDettaglio(rec(await prendi(`/portale/medico/aziende/${aziendaId}`)).data);
}

export async function registraGiudizio(
  aziendaId: number,
  d: {
    lavoratore_id: number;
    data: string;
    tipo_visita: string;
    esito: string;
    prescrizioni?: string;
    prossima_tra_mesi?: number | null;
    file?: File | null;
  },
): Promise<GiudizioMedico | null> {
  const fd = new FormData();
  fd.append('lavoratore_id', String(d.lavoratore_id));
  fd.append('data', d.data);
  fd.append('tipo_visita', d.tipo_visita);
  fd.append('esito', d.esito);
  if (d.prescrizioni) fd.append('prescrizioni', d.prescrizioni);
  if (d.prossima_tra_mesi) fd.append('prossima_tra_mesi', String(d.prossima_tra_mesi));
  if (d.file) fd.append('file', d.file);
  try {
    return mappaGiudizio(rec(rec(await apiUpload(`/portale/medico/aziende/${aziendaId}/giudizi`, fd)).data).giudizio);
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

/** Apre il giudizio firmato (solo il medico che l'ha caricato). */
export async function apriGiudizio(id: number): Promise<void> {
  const t = getToken();
  const r = await fetch(apiUrl(`/portale/medico/giudizi/${id}/file`), {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!r.ok) throw new Error('File non disponibile.');
  const url = URL.createObjectURL(await r.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ------------------------------------------------------------------
// Richieste di esami ai laboratori convenzionati (04 gestionale 17.4 e 18.1).

export type StatoEsame = 'richiesto' | 'prelievo_fissato' | 'prelievo_fatto' | 'referto_inviato';

export interface RichiestaEsami {
  id: number;
  codice: string;
  richiestaIl: string | null;
  lavoratore: string;
  azienda: string | null;
  esami: string[];
  laboratorio: string;
  medico: string | null;
  stato: StatoEsame;
  statoTesto: string;
  vistaEsterna: string | null;
  prelievoIl: string | null;
  refertoIl: string | null;
  referto: boolean;
  letto: boolean;
}

export interface VistaEsamiMedico {
  richieste: RichiestaEsami[];
  lavoratori: Array<{ id: number; nome: string }>;
  esami: string[];
  laboratori: string[];
  nota: string;
}

export interface VistaEsamiLaboratorio {
  laboratorio: string | null;
  anteprima: boolean;
  richieste: RichiestaEsami[];
  numeri: { aperte: number; medici: number; daAccettare: number; refertiDaInviare: number; fatturabiliMese: number };
  nota: string;
}

const STATI_ESAME: StatoEsame[] = ['richiesto', 'prelievo_fissato', 'prelievo_fatto', 'referto_inviato'];

export const TONO_ESAME: Record<StatoEsame, 'todo' | 'info' | 'warn' | 'ok'> = {
  richiesto: 'todo',
  prelievo_fissato: 'info',
  prelievo_fatto: 'warn',
  referto_inviato: 'ok',
};

export function mappaRichiestaEsami(raw: unknown): RichiestaEsami | null {
  const r = rec(raw);
  const id = numero(r.id);
  if (id === null) return null;
  const stato = STATI_ESAME.includes(r.stato as StatoEsame) ? (r.stato as StatoEsame) : 'richiesto';
  return {
    id,
    codice: testo(r.codice) ?? `L-${id}`,
    richiestaIl: testo(r.richiesta_il),
    lavoratore: testo(r.lavoratore) ?? 'Lavoratore',
    azienda: testo(r.azienda),
    esami: lista(r.esami).filter((x): x is string => typeof x === 'string' && x !== ''),
    laboratorio: testo(r.laboratorio) ?? '',
    medico: testo(r.medico),
    stato,
    statoTesto: testo(r.stato_testo) ?? stato,
    vistaEsterna: testo(r.vista_esterna),
    prelievoIl: testo(r.prelievo_il),
    refertoIl: testo(r.referto_il),
    referto: r.referto === true,
    letto: r.letto === true,
  };
}

const richiesteEsami = (v: unknown) => lista(v).map(mappaRichiestaEsami).filter((x): x is RichiestaEsami => x !== null);
const stringhe = (v: unknown) => lista(v).filter((x): x is string => typeof x === 'string' && x !== '');

export function mappaEsamiMedico(raw: unknown): VistaEsamiMedico {
  const r = rec(raw);
  return {
    richieste: richiesteEsami(r.richieste),
    lavoratori: lista(r.lavoratori)
      .map(rec)
      .map((l) => ({ id: numero(l.id) ?? 0, nome: testo(l.nome) ?? '' }))
      .filter((l) => l.id > 0 && l.nome !== ''),
    esami: stringhe(r.esami),
    laboratori: stringhe(r.laboratori),
    nota: testo(r.nota) ?? 'Il referto arriva solo a te.',
  };
}

export function mappaEsamiLaboratorio(raw: unknown): VistaEsamiLaboratorio {
  const r = rec(raw);
  const n = rec(r.numeri);
  return {
    laboratorio: testo(r.laboratorio),
    anteprima: r.anteprima === true,
    richieste: richiesteEsami(r.richieste),
    numeri: {
      aperte: numero(n.aperte) ?? 0,
      medici: numero(n.medici) ?? 0,
      daAccettare: numero(n.da_accettare) ?? 0,
      refertiDaInviare: numero(n.referti_da_inviare) ?? 0,
      fatturabiliMese: numero(n.fatturabili_mese) ?? 0,
    },
    nota: testo(r.nota) ?? '',
  };
}

export async function esamiMedico(): Promise<VistaEsamiMedico> {
  if (!isApiMode()) return mappaEsamiMedico({});
  return mappaEsamiMedico(rec(await prendi('/portale/medico/esami')).data);
}

export async function richiediEsami(lavoratoreId: number, esami: string[], laboratorio: string): Promise<RichiestaEsami | null> {
  return mappaRichiestaEsami(rec(await manda('/portale/medico/esami', { lavoratore_id: lavoratoreId, esami, laboratorio })).data);
}

/** Scarica il referto: lo può fare solo il medico richiedente, e lo segna letto. */
export async function scaricaReferto(r: RichiestaEsami): Promise<void> {
  const t = getToken();
  const res = await fetch(apiUrl(`/portale/medico/esami/${r.id}/referto`), { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) throw new Error('Referto non disponibile.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `Referto-${r.codice}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function esamiLaboratorio(): Promise<VistaEsamiLaboratorio> {
  if (!isApiMode()) return mappaEsamiLaboratorio({});
  return mappaEsamiLaboratorio(rec(await prendi('/portale/gestionale/laboratorio/esami')).data);
}

export async function accettaEsami(id: number, prelievoIl: string): Promise<RichiestaEsami | null> {
  return mappaRichiestaEsami(rec(await manda(`/portale/gestionale/laboratorio/esami/${id}/accetta`, { prelievo_il: prelievoIl })).data);
}

export async function prelievoFatto(id: number): Promise<RichiestaEsami | null> {
  return mappaRichiestaEsami(rec(await manda(`/portale/gestionale/laboratorio/esami/${id}/prelievo`)).data);
}

export async function inviaReferto(id: number, file: File): Promise<RichiestaEsami | null> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    return mappaRichiestaEsami(rec(await apiUpload(`/portale/gestionale/laboratorio/esami/${id}/referto`, fd)).data);
  } catch (e) {
    throw erroreLeggibile(e);
  }
}
