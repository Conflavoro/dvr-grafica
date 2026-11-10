/**
 * Iscrizione dell'azienda (nuovo onboarding): dati dell'azienda, scelta di chi
 * segue la sicurezza, attesa dello studio. Le chiamate parlano con
 * /api/onboarding/*; la validazione e' pura e provata da iscrizione.test.ts.
 */

import { apiUpload, clearApiCache, setToken } from '@/lib/api';
import { lista, manda, numero, prendi, rec, testo, erroreLeggibile } from '@/lib/portale/api';

export type Scelta = 'conflavoro' | 'studio' | 'interno' | 'studio_hse';

export interface DatiAzienda {
  ragione_sociale: string;
  partita_iva: string;
  ateco: string;
  comune: string;
  lavoratori: string;
}

export const AZIENDA_VUOTA: DatiAzienda = { ragione_sociale: '', partita_iva: '', ateco: '', comune: '', lavoratori: '' };

export interface Studio {
  id: number;
  nome: string;
  comune: string | null;
}

export interface StatoIscrizione {
  /** nuovo: niente in corso; richiesta: accesso chiesto a un'organizzazione; in_attesa: azienda in attesa dello studio. */
  stato: 'nuovo' | 'attivo' | 'in_attesa' | 'rifiutata' | 'richiesta' | 'richiesta_rifiutata';
  azienda: DatiAzienda | null;
  studio: Studio | null;
  /** Organizzazione a cui si e' chiesto l'accesso. */
  organizzazione: Studio | null;
  motivo: string | null;
  app: 'azienda' | 'gestionale' | null;
  /** Organizzazione proposta dal dominio della mail (es. Conflavoro PMI per @conflavoro.com). */
  proposta: Studio | null;
  /** Contatto "Hai bisogno di aiuto?". */
  assistenza: string | null;
}

const STATI: StatoIscrizione['stato'][] = ['nuovo', 'attivo', 'in_attesa', 'rifiutata', 'richiesta', 'richiesta_rifiutata'];

const PIVA = /^(IT)?\d{11}$/;
const ATECO = /^\d{2}(\.\d{1,2}){0,2}$/;

/** Errori dei campi dell'azienda, in parole semplici (vuoto = tutto a posto). */
export function validaAzienda(d: DatiAzienda): Partial<Record<keyof DatiAzienda, string>> {
  const e: Partial<Record<keyof DatiAzienda, string>> = {};
  if (d.ragione_sociale.trim().length < 2) e.ragione_sociale = 'Scrivi la ragione sociale.';
  if (!PIVA.test(d.partita_iva.replace(/\s+/g, '').toUpperCase())) e.partita_iva = 'La partita IVA ha 11 cifre.';
  if (!ATECO.test(d.ateco.trim())) e.ateco = 'Scrivi il codice ATECO, per esempio 56.10.11. Lo trovi nella visura.';
  if (d.comune.trim().length < 2) e.comune = 'Scrivi il comune della sede.';
  const n = Number(d.lavoratori);
  if (d.lavoratori.trim() === '' || !Number.isInteger(n) || n < 0) e.lavoratori = 'Quanti sono i lavoratori? Va bene anche a grandi linee.';
  return e;
}

/** Dati dell'azienda dal backend (stato rifiutato o in attesa). */
export function mappaAzienda(raw: unknown): DatiAzienda | null {
  const r = rec(raw);
  const rs = testo(r.ragione_sociale);
  if (!rs) return null;
  const n = numero(r.lavoratori);
  return {
    ragione_sociale: rs,
    partita_iva: testo(r.partita_iva) ?? '',
    ateco: testo(r.ateco) ?? '',
    comune: testo(r.comune) ?? '',
    lavoratori: n === null ? '' : String(n),
  };
}

export function mappaStudio(raw: unknown): Studio | null {
  const r = rec(raw);
  const id = numero(r.id);
  const nome = testo(r.nome);
  return id === null || !nome ? null : { id, nome, comune: testo(r.comune) };
}

export function mappaStato(raw: unknown): StatoIscrizione | null {
  const r = rec(raw);
  const s = testo(r.stato) as StatoIscrizione['stato'] | null;
  if (!s || !STATI.includes(s)) return null;
  const app = testo(r.app);
  const email = testo(r.assistenza);
  return {
    stato: s,
    azienda: mappaAzienda(r.azienda),
    studio: mappaStudio(r.studio),
    organizzazione: mappaStudio(r.organizzazione),
    motivo: testo(r.motivo),
    app: app === 'azienda' || app === 'gestionale' ? app : null,
    proposta: mappaStudio(r.proposta),
    assistenza: email && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null,
  };
}

/** Se il backend ha mandato il token nuovo (utente attivo) lo usa da subito. */
function prendiToken(r: Record<string, unknown>): void {
  const t = testo(r.access_token);
  if (!t) return;
  setToken(t);
  clearApiCache();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-changed'));
}

export async function iscrivi(d: DatiAzienda, scelta: Scelta, studio?: { id?: number; codice?: string }): Promise<StatoIscrizione> {
  const body = {
    ragione_sociale: d.ragione_sociale.trim(),
    partita_iva: d.partita_iva.replace(/\s+/g, '').toUpperCase(),
    ateco: d.ateco.trim(),
    comune: d.comune.trim(),
    lavoratori: Number(d.lavoratori),
    scelta,
    studio_id: studio?.id,
    studio_codice: studio?.codice?.trim() || undefined,
  };
  const r = rec(rec(await manda('/onboarding/azienda', body)).data);
  prendiToken(r);
  return mappaStato(r) ?? { stato: 'attivo', azienda: null, studio: null, organizzazione: null, motivo: null, app: null, proposta: null, assistenza: null };
}

export async function statoIscrizione(): Promise<StatoIscrizione | null> {
  const r = rec(rec(await prendi('/onboarding/stato')).data);
  prendiToken(r);
  return mappaStato(r);
}

export async function cercaStudi(q: string): Promise<Studio[]> {
  if (q.trim().length < 2) return [];
  const r = rec(await prendi(`/onboarding/studi?q=${encodeURIComponent(q.trim())}`));
  return lista(r.data).map(mappaStudio).filter((x): x is Studio => x !== null);
}

export async function studioDaCodice(codice: string): Promise<Studio | null> {
  if (!codice.trim()) return null;
  const r = rec(await prendi(`/onboarding/studi?codice=${encodeURIComponent(codice.trim())}`));
  return lista(r.data).map(mappaStudio).find((x): x is Studio => x !== null) ?? null;
}

/** Organizzazioni gia' iscritte (studi, aziende, Conflavoro) per nome: solo nome e comune. */
export async function cercaOrganizzazioni(q: string): Promise<Studio[]> {
  if (q.trim().length < 2) return [];
  const r = rec(await prendi(`/onboarding/organizzazioni?q=${encodeURIComponent(q.trim())}`));
  return lista(r.data).map(mappaStudio).filter((x): x is Studio => x !== null);
}

export async function organizzazioneDaCodice(codice: string): Promise<Studio | null> {
  if (!codice.trim()) return null;
  const r = rec(await prendi(`/onboarding/organizzazioni?codice=${encodeURIComponent(codice.trim())}`));
  return lista(r.data).map(mappaStudio).find((x): x is Studio => x !== null) ?? null;
}

export async function chiediAccesso(tenantId: number, messaggio?: string): Promise<StatoIscrizione | null> {
  return mappaStato(rec(await manda('/onboarding/richiesta', { tenant_id: tenantId, messaggio: messaggio?.trim() || undefined })).data);
}

export async function annullaRichiesta(): Promise<void> {
  await manda('/onboarding/richiesta', undefined, 'DELETE');
}

/** Passo dell'onboarding mostrato in alto: "Passo 2 di 3". */
export function testoPasso(n: number, di = 3): string {
  return `Passo ${Math.min(Math.max(n, 1), di)} di ${di}`;
}

/** Legge la visura (PDF, foto o .p7m) e torna i campi riconosciuti, da controllare. */
export async function leggiVisura(file: File): Promise<Partial<DatiAzienda>> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = rec(rec(await apiUpload<unknown>('/onboarding/visura', fd)).data);
    const out: Partial<DatiAzienda> = {};
    const rs = testo(r.ragione_sociale);
    if (rs) out.ragione_sociale = rs;
    const piva = testo(r.partita_iva);
    if (piva) out.partita_iva = piva.toUpperCase();
    const ateco = testo(r.ateco);
    if (ateco) out.ateco = ateco;
    const sede = lista(r.sedi).map(rec).find((s) => testo(s.comune));
    if (sede) out.comune = testo(sede.comune) ?? '';
    const n = numero(r.lavoratori);
    if (n !== null && n >= 0) out.lavoratori = String(Math.round(n));
    return out;
  } catch (e) {
    throw erroreLeggibile(e, 'Non sono riuscito a leggere la visura. Scrivi i dati a mano.');
  }
}
