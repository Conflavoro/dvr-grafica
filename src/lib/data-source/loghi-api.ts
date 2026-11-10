// Namespace `loghi` verso il backend Laravel: logo dell'azienda (portale/aziende/{id}/logo)
// e logo dello studio (studio/logo). Il file e' privato: l'anteprima arriva con il token.

import { ApiError, apiRequest, apiUpload, apiUrl, getToken } from '@/lib/api';
import { testoErroreHttp } from './moduli-api';
import type { LoghiDataSource, LogoInfo, StatoLogo } from './types';

/** Formati e peso accettati dal backend (Loghi::MAX_KB). */
export const LOGO_MAX_BYTE = 2 * 1024 * 1024;
export const LOGO_TIPI = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function errore(e: unknown): Error {
  if (e instanceof ApiError) {
    const body = (e.body ?? {}) as { message?: string; errors?: Record<string, string[]> };
    const primo = body.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return new Error(testoErroreHttp(e.status, primo ?? body.message ?? null));
  }
  return e instanceof Error ? e : new Error('Operazione non riuscita. Riprova.');
}

/** Controllo prima dell'invio: stesso messaggio del server, senza attendere la rete. */
export function controllaFileLogo(file: File, svg: boolean): string | null {
  if (file.size > LOGO_MAX_BYTE) return 'Il logo supera 2 MB: usa un file più leggero.';
  const tipo = file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : '');
  if (tipo && !LOGO_TIPI.includes(tipo)) return 'Formato non valido: carica il logo in PNG, JPG, WebP o SVG.';
  if (tipo === 'image/svg+xml' && !svg) return 'Questo server non converte i file SVG: carica il logo in PNG (meglio con fondo trasparente), JPG o WebP.';
  return null;
}

async function stato(path: string): Promise<StatoLogo> {
  try {
    const r = await apiRequest<{ data: StatoLogo }>(path, { method: 'GET', cache: 'no-store' });
    return r.data;
  } catch (e) {
    throw errore(e);
  }
}

async function anteprima(path: string): Promise<string | null> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  } catch {
    throw new Error(testoErroreHttp(0));
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(testoErroreHttp(res.status));
  return URL.createObjectURL(await res.blob());
}

async function carica(path: string, file: File): Promise<LogoInfo> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await apiUpload<{ data: { logo: LogoInfo } }>(path, fd);
    return r.data.logo;
  } catch (e) {
    throw errore(e);
  }
}

async function rimuovi(path: string): Promise<void> {
  try {
    await apiRequest(path, { method: 'DELETE' });
  } catch (e) {
    throw errore(e);
  }
}

export function creaLoghiApi(): LoghiDataSource {
  const az = (id: number) => `/portale/aziende/${id}/logo`;
  return {
    azienda: (id) => stato(az(id)),
    anteprimaAzienda: (id) => anteprima(`${az(id)}/file`),
    caricaAzienda: (id, file) => carica(az(id), file),
    rimuoviAzienda: (id) => rimuovi(az(id)),
    studio: () => stato('/studio/logo'),
    anteprimaStudio: () => anteprima('/studio/logo/file'),
    caricaStudio: (file) => carica('/studio/logo', file),
    rimuoviStudio: () => rimuovi('/studio/logo'),
  };
}

/**
 * Versione del browser (demo senza backend): il logo resta in localStorage come data URL.
 * Nessun ritaglio ne' pulizia: quelli li fa solo il server.
 */
export function creaLoghiLocale(chiave: () => string): LoghiDataSource {
  const leggi = (k: string): { url: string; w: number; h: number; il: string } | null => {
    try {
      const v = localStorage.getItem(`${chiave()}:logo:${k}`);
      return v ? (JSON.parse(v) as { url: string; w: number; h: number; il: string }) : null;
    } catch {
      return null;
    }
  };
  const info = (k: string): LogoInfo | null => {
    const x = leggi(k);
    return x ? { presente: true, larghezza: x.w, altezza: x.h, aggiornato_il: x.il, versione: x.il } : null;
  };
  const salva = async (k: string, file: File): Promise<LogoInfo> => {
    const msg = controllaFileLogo(file, false);
    if (msg) throw new Error(msg);
    const url = await new Promise<string>((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => ko(new Error('Non riesco a leggere il file.'));
      r.readAsDataURL(file);
    });
    const [w, h] = await new Promise<[number, number]>((ok) => {
      const img = new Image();
      img.onload = () => ok([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => ok([0, 0]);
      img.src = url;
    });
    if (!w) throw new Error('Non riesco a leggere l\'immagine: prova a salvarla di nuovo in PNG.');
    const il = new Date().toISOString();
    try {
      localStorage.setItem(`${chiave()}:logo:${k}`, JSON.stringify({ url, w, h, il }));
    } catch {
      throw new Error('Spazio del browser esaurito: usa un logo più leggero.');
    }
    return { presente: true, larghezza: w, altezza: h, aggiornato_il: il, versione: il };
  };
  const togli = async (k: string) => {
    try {
      localStorage.removeItem(`${chiave()}:logo:${k}`);
    } catch {
      /* niente da togliere */
    }
  };
  return {
    azienda: async (id) => ({ logo: info(`azienda:${id}`), puo_modificare: true, svg: false }),
    anteprimaAzienda: async (id) => leggi(`azienda:${id}`)?.url ?? null,
    caricaAzienda: (id, f) => salva(`azienda:${id}`, f),
    rimuoviAzienda: (id) => togli(`azienda:${id}`),
    studio: async () => ({ logo: info('studio'), puo_modificare: true, svg: false }),
    anteprimaStudio: async () => leggi('studio')?.url ?? null,
    caricaStudio: (f) => salva('studio', f),
    rimuoviStudio: () => togli('studio'),
  };
}
