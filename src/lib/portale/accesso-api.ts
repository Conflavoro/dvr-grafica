/**
 * Accesso e sicurezza dell'account (S2): registrazione con email e codice SMS,
 * secondo passaggio del gestionale, scheda Sicurezza (verifica in due passaggi,
 * cambio del numero e della password, dispositivi collegati), sedi e accesso
 * per azienda. Ogni risposta passa da un mappatore tollerante.
 */

import { ApiError, apiRequest } from '@/lib/api';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';

// ------------------------------------------------------------ registrazione

/** Controlli della specifica, nello stesso ordine del server (05 par. 1.3). */
export const ERRORE_EMAIL = "Controlla l'email: sembra incompleta.";
export const ERRORE_CELLULARE = 'Controlla il cellulare: deve iniziare con 3 e avere 9 o 10 cifre.';

export function controllaRegistrazione(email: string, cellulare: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return ERRORE_EMAIL;
  if (!/^3\d{8,9}$/.test(cellulare.replace(/\D/g, ''))) return ERRORE_CELLULARE;
  return null;
}

/** "+39 333 ••• ••67": prime 3 e ultime 2 cifre. */
export function mascheraNumero(cellulare: string): string {
  const n = cellulare.replace(/\D/g, '');
  return `+39 ${n.slice(0, 3)} ••• ••${n.slice(-2)}`;
}

export async function chiediCodice(email: string, cellulare: string): Promise<{ numeroMascherato: string; minuti: number; canale: 'sms' | 'email'; emailMascherata: string | null }> {
  let raw: unknown;
  try {
    raw = await apiRequest('/auth/registrazione/codice', { method: 'POST', body: { email, cellulare }, anonymous: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) throw new Error(testo(rec(e.body).message) ?? ERRORE_EMAIL);
    throw erroreLeggibile(e);
  }
  const r = rec(rec(raw).data);
  // Finche' non c'e' il fornitore SMS il codice arriva per email (canale "email").
  return {
    numeroMascherato: testo(r.numero_mascherato) ?? mascheraNumero(cellulare),
    minuti: numero(r.minuti) ?? 10,
    canale: testo(r.canale) === 'email' ? 'email' : 'sms',
    emailMascherata: testo(r.email_mascherata) ?? null,
  };
}

export interface EsitoAccesso {
  token: string | null;
  daConfigurare: boolean;
  /** Gestionale: serve il codice dell'app di autenticazione. */
  sfida: string | null;
  configura: boolean;
  segreto: string | null;
  otpauth: string | null;
}

export function mappaEsito(raw: unknown): EsitoAccesso {
  const r = rec(raw);
  return {
    token: testo(r.access_token),
    daConfigurare: r.needs_onboarding === true,
    sfida: testo(r.sfida),
    configura: r.configura === true,
    segreto: testo(r.segreto),
    otpauth: testo(r.otpauth),
  };
}

/** Verifica il codice SMS. Errore 409: l'email ha gia' un accesso con un altro metodo. */
/** Primo passaggio con email e password: token, oppure la sfida del codice del gestionale. */
export async function entraConPassword(email: string, password: string): Promise<EsitoAccesso> {
  try {
    return mappaEsito(await apiRequest('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new Error('Email o password non corrette.');
    throw erroreLeggibile(e);
  }
}

export async function verificaCodice(email: string, cellulare: string, codice: string): Promise<EsitoAccesso> {
  try {
    return mappaEsito(await apiRequest('/auth/registrazione/verifica', { method: 'POST', body: { email, cellulare, codice }, anonymous: true }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) throw new Error(testo(rec(e.body).message) ?? "Il codice non è giusto. Controlla l'SMS e riprova.");
    throw erroreLeggibile(e);
  }
}

/** Secondo passaggio del gestionale: codice di 6 cifre dell'app di autenticazione. */
export async function secondoPassaggio(sfida: string, codice: string): Promise<EsitoAccesso> {
  try {
    return mappaEsito(await apiRequest('/auth/codice', { method: 'POST', body: { sfida, codice }, anonymous: true }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) throw new Error(testo(rec(e.body).message) ?? 'Il codice non è giusto.');
    throw erroreLeggibile(e);
  }
}

// ---------------------------------------------------------------- sicurezza

export interface Dispositivo {
  id: number;
  dispositivo: string;
  tipo: 'monitor' | 'smartphone';
  quando: string | null;
  questo: boolean;
}

export interface Sicurezza {
  email: string;
  duePassaggi: { attiva: boolean; obbligatoria: boolean; numeroFinale: string | null };
  passwordImpostata: boolean;
  dispositivi: Dispositivo[];
}

export function mappaSicurezza(raw: unknown): Sicurezza {
  const r = rec(rec(raw).data);
  const d = rec(r.due_passaggi);
  return {
    email: testo(r.email) ?? '',
    duePassaggi: { attiva: d.attiva === true, obbligatoria: d.obbligatoria === true, numeroFinale: testo(d.numero_finale) },
    passwordImpostata: rec(r.password).impostata === true,
    dispositivi: lista(r.sessioni).map((x) => {
      const s = rec(x);
      return {
        id: numero(s.id) ?? 0,
        dispositivo: testo(s.dispositivo) ?? 'Dispositivo',
        tipo: s.tipo === 'smartphone' ? 'smartphone' : 'monitor',
        quando: testo(s.quando),
        questo: s.questo === true,
      };
    }),
  };
}

export async function sicurezza(): Promise<Sicurezza> {
  return mappaSicurezza(await prendi('/account/sicurezza'));
}

export async function attivaDuePassaggi(): Promise<void> {
  await manda('/account/due-passaggi');
}

export async function esciDispositivo(id: number): Promise<void> {
  await manda(`/account/sessioni/${id}`, undefined, 'DELETE');
}

export async function esciAltri(): Promise<void> {
  await manda('/account/sessioni/esci-altre');
}

export async function inviaCodiciNumero(cellulare: string): Promise<{ codici: number }> {
  const r = rec(rec(await manda('/account/numero', { cellulare })).data);
  return { codici: numero(r.codici) ?? 1 };
}

export async function confermaNumero(cellulare: string, codiceNuovo: string, codiceVecchio: string | null): Promise<void> {
  await manda('/account/numero/conferma', { cellulare, codice_nuovo: codiceNuovo, codice_vecchio: codiceVecchio });
}

/** Errori per campo della specifica (Cambia la password). */
export type ErroriPassword = Partial<Record<'attuale' | 'nuova' | 'ripeti', string>>;

export function controllaPassword(attuale: string, nuova: string, ripeti: string, serveAttuale: boolean): ErroriPassword {
  const e: ErroriPassword = {};
  if (serveAttuale && attuale === '') e.attuale = 'Scrivi la password che usi adesso.';
  if (nuova.length < 12) e.nuova = 'La nuova password deve avere almeno 12 caratteri.';
  else if (nuova === attuale) e.nuova = 'La nuova password deve essere diversa da quella attuale.';
  if (nuova !== ripeti) e.ripeti = 'Le due password non coincidono.';
  return e;
}

export async function cambiaPassword(attuale: string, nuova: string, ripeti: string): Promise<ErroriPassword | null> {
  try {
    await apiRequest('/account/password', { method: 'POST', body: { attuale, nuova, ripeti } });
    return null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) {
      const errs = rec(rec(e.body).errors);
      const out: ErroriPassword = {};
      for (const k of ['attuale', 'nuova', 'ripeti'] as const) {
        const m = lista(errs[k])[0];
        if (typeof m === 'string') out[k] = m;
      }
      return out;
    }
    throw erroreLeggibile(e);
  }
}

// ---------------------------------------------------------- sedi e accesso

export interface Sede {
  id: number;
  nome: string;
  insegna: string | null;
  indirizzo: string | null;
  alimentare: boolean;
  medico: { nome: string; email: string | null; centro: string | null; coordinatore: boolean } | null;
}

export interface SediAzienda {
  sedi: Sede[];
  limitata: boolean;
  testoLimite: string | null;
  puoGestire: boolean;
}

export function mappaSedi(raw: unknown): SediAzienda {
  const r = rec(rec(raw).data);
  return {
    sedi: lista(r.sedi).map((x) => {
      const s = rec(x);
      const m = rec(s.medico);
      return {
        id: numero(s.id) ?? 0,
        nome: testo(s.nome) ?? 'Sede',
        insegna: testo(s.insegna),
        indirizzo: testo(s.indirizzo),
        alimentare: s.alimentare === true,
        medico: testo(m.nome) ? { nome: testo(m.nome)!, email: testo(m.email), centro: testo(m.centro), coordinatore: m.coordinatore === true } : null,
      };
    }),
    limitata: r.limitata === true,
    testoLimite: testo(r.testo_limite),
    puoGestire: r.puo_gestire === true,
  };
}

export async function sediAzienda(aziendaId: number): Promise<SediAzienda> {
  return mappaSedi(await prendi(`/portale/aziende/${aziendaId}/sedi`));
}
