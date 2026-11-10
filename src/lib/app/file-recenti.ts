/**
 * File recenti consultabili offline (app nativa).
 *
 * Gli ultimi documenti aperti dall'app restano sul telefono per SCADENZA_GIORNI,
 * cifrati con AES-GCM: la chiave e' una CryptoKey non estraibile salvata in
 * IndexedDB (il codice della pagina la usa ma non puo' leggerla), i file cifrati
 * stanno nello spazio privato dell'app (iOS Library/NoCloud, fuori dal backup
 * iCloud; Android files/, con il backup dell'app spento). Anche l'indice (nomi
 * dei file) e' cifrato. All'uscita dall'account o con un utente diverso si
 * cancella tutto.
 *
 * Sul web non si salva nulla: il documento si scarica come prima.
 */

import { isNativa, piattaforma } from './nativa';

export const SCADENZA_GIORNI = 30;
export const MASSIMO_FILE = 20;
export const BYTE_MASSIMI = 60 * 1024 * 1024;
const CARTELLA = 'recenti';
const INDICE = 'indice.bin';

export interface VoceRecente {
  id: string;
  nome: string;
  tipo: string;
  byte: number;
  aperto: string;
  scade: string;
  /** Da dove viene (es. "dvr:12:pdf"): lo stesso documento riaperto sostituisce la copia vecchia. */
  origine: string;
}

export interface Indice {
  utente: number;
  voci: VoceRecente[];
}

// ---------------------------------------------------------------- logica pura

/** Toglie le voci scadute. */
export function valide(voci: VoceRecente[], ora: Date): VoceRecente[] {
  return voci.filter((v) => Date.parse(v.scade) > ora.getTime());
}

/**
 * Indice dopo l'aggiunta di un file: la voce nuova in testa, via la copia vecchia
 * dello stesso documento, via le scadute, poi si tolgono le piu' vecchie finche'
 * si sta nei limiti di numero e di spazio. Restituisce anche gli id da cancellare.
 */
export function aggiungiAllIndice(voci: VoceRecente[], nuova: VoceRecente, ora: Date): { voci: VoceRecente[]; via: string[] } {
  const tenute = valide(voci, ora).filter((v) => v.origine !== nuova.origine && v.id !== nuova.id);
  const out = [nuova, ...tenute.sort((a, b) => Date.parse(b.aperto) - Date.parse(a.aperto))];
  let byte = out.reduce((s, v) => s + v.byte, 0);
  while (out.length > 1 && (out.length > MASSIMO_FILE || byte > BYTE_MASSIMI)) {
    byte -= out.pop()!.byte;
  }
  const restano = new Set(out.map((v) => v.id));
  return { voci: out, via: voci.filter((v) => !restano.has(v.id)).map((v) => v.id) };
}

export function nuovaVoce(nome: string, tipo: string, byte: number, origine: string, ora: Date, id: string): VoceRecente {
  return {
    id,
    nome: nome.slice(0, 160),
    tipo: tipo || 'application/octet-stream',
    byte,
    aperto: ora.toISOString(),
    scade: new Date(ora.getTime() + SCADENZA_GIORNI * 86_400_000).toISOString(),
    origine: origine || nome,
  };
}

// ---------------------------------------------------------------- cifratura

export function base64DaByte(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...Array.from(b.subarray(i, i + 0x8000)));
  return btoa(s);
}

export function byteDaBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Cifra con AES-GCM: 12 byte di IV in testa al testo cifrato. */
export async function cifra(chiave: CryptoKey, dati: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, dati as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decifra(chiave: CryptoKey, dati: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dati.subarray(0, 12) as BufferSource }, chiave, dati.subarray(12) as BufferSource));
}

const DB = 'crm-file-recenti';

function apriDb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('chiavi');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

/** Chiave AES non estraibile, creata al primo uso e conservata in IndexedDB. */
async function chiave(crea: boolean): Promise<CryptoKey | null> {
  const db = await apriDb();
  try {
    const letta = await new Promise<CryptoKey | undefined>((ok, ko) => {
      const r = db.transaction('chiavi').objectStore('chiavi').get('aes');
      r.onsuccess = () => ok(r.result as CryptoKey | undefined);
      r.onerror = () => ko(r.error);
    });
    if (letta || !crea) return letta ?? null;
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise<void>((ok, ko) => {
      const t = db.transaction('chiavi', 'readwrite');
      t.objectStore('chiavi').put(k, 'aes');
      t.oncomplete = () => ok();
      t.onerror = () => ko(t.error);
    });
    return k;
  } finally {
    db.close();
  }
}

async function togliChiave(): Promise<void> {
  await new Promise<void>((ok) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  });
}

// ---------------------------------------------------------------- deposito nativo

async function fs() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  // iOS: Library/NoCloud resta fuori dal backup iCloud; Android: files/ privato.
  const directory = piattaforma() === 'ios' ? Directory.LibraryNoCloud : Directory.Data;
  return { Filesystem, Directory, directory };
}

async function leggiIndice(k: CryptoKey): Promise<Indice | null> {
  const { Filesystem, directory } = await fs();
  try {
    const r = await Filesystem.readFile({ path: `${CARTELLA}/${INDICE}`, directory });
    const testo = new TextDecoder().decode(await decifra(k, byteDaBase64(String(r.data))));
    const i = JSON.parse(testo) as Indice;
    return Array.isArray(i.voci) && typeof i.utente === 'number' ? i : null;
  } catch {
    return null;
  }
}

async function scriviIndice(k: CryptoKey, i: Indice): Promise<void> {
  const { Filesystem, directory } = await fs();
  const dati = await cifra(k, new TextEncoder().encode(JSON.stringify(i)));
  await Filesystem.writeFile({ path: `${CARTELLA}/${INDICE}`, directory, data: base64DaByte(dati), recursive: true });
}

/** Utente dell'archivio: impostato dal guscio dopo l'accesso. */
let utenteCorrente: number | null = null;

export function impostaUtenteFileRecenti(id: number | null): void {
  utenteCorrente = id;
}

/**
 * Salva una copia cifrata del documento appena aperto. Non blocca mai l'apertura:
 * un errore qui lascia solo il documento fuori dai recenti.
 */
export async function ricordaFile(blob: Blob, nome: string, origine: string): Promise<void> {
  if (!isNativa() || utenteCorrente === null) return;
  try {
    const k = (await chiave(true))!;
    const { Filesystem, directory } = await fs();
    let indice = await leggiIndice(k);
    if (indice && indice.utente !== utenteCorrente) {
      await svuotaFileRecenti();
      indice = null;
    }
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const ora = new Date();
    const voce = nuovaVoce(nome, blob.type, blob.size, origine, ora, id);
    const dati = await cifra(k, new Uint8Array(await blob.arrayBuffer()));
    await Filesystem.writeFile({ path: `${CARTELLA}/${id}.bin`, directory, data: base64DaByte(dati), recursive: true });
    const { voci, via } = aggiungiAllIndice(indice?.voci ?? [], voce, ora);
    await scriviIndice(k, { utente: utenteCorrente, voci });
    await Promise.all(via.map((v) => Filesystem.deleteFile({ path: `${CARTELLA}/${v}.bin`, directory }).catch(() => undefined)));
  } catch {
    /* il documento si apre lo stesso */
  }
}

/** Voci ancora valide dell'utente corrente (le scadute si cancellano qui). */
export async function elencoFileRecenti(utente: number | null = utenteCorrente): Promise<VoceRecente[]> {
  if (!isNativa()) return [];
  try {
    const k = await chiave(false);
    if (!k) return [];
    const indice = await leggiIndice(k);
    if (!indice) return [];
    if (utente !== null && indice.utente !== utente) {
      await svuotaFileRecenti();
      return [];
    }
    const ora = new Date();
    const restano = valide(indice.voci, ora);
    if (restano.length !== indice.voci.length) {
      const { Filesystem, directory } = await fs();
      const via = indice.voci.filter((v) => !restano.includes(v));
      await Promise.all(via.map((v) => Filesystem.deleteFile({ path: `${CARTELLA}/${v.id}.bin`, directory }).catch(() => undefined)));
      await scriviIndice(k, { utente: indice.utente, voci: restano });
    }
    return restano;
  } catch {
    return [];
  }
}

/**
 * Apre un file recente con il visore del telefono: si decifra in una copia
 * temporanea nella cache dell'app, cancellata alla prossima apertura.
 */
export async function apriFileRecente(id: string): Promise<void> {
  const k = await chiave(false);
  if (!k) throw new Error('Il file non è più sul telefono.');
  const indice = await leggiIndice(k);
  const voce = indice?.voci.find((v) => v.id === id);
  if (!voce) throw new Error('Il file non è più sul telefono.');
  const { Filesystem, Directory, directory } = await fs();
  const r = await Filesystem.readFile({ path: `${CARTELLA}/${id}.bin`, directory });
  const chiaro = await decifra(k, byteDaBase64(String(r.data)));
  await apriNelTelefono(new Blob([chiaro as BlobPart], { type: voce.tipo }), voce.nome, Filesystem, Directory.Cache);
}

type Fs = Awaited<ReturnType<typeof fs>>['Filesystem'];

/** Copia temporanea in chiaro nella cache e visore del sistema (FileOpener). */
async function apriNelTelefono(blob: Blob, nome: string, Filesystem: Fs, cache: Awaited<ReturnType<typeof fs>>['Directory']['Cache']): Promise<void> {
  await Filesystem.rmdir({ path: 'aperti', directory: cache, recursive: true }).catch(() => undefined);
  const sicuro = nome.replace(/[\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 120) || 'documento';
  const scritto = await Filesystem.writeFile({
    path: `aperti/${sicuro}`,
    directory: cache,
    data: base64DaByte(new Uint8Array(await blob.arrayBuffer())),
    recursive: true,
  });
  const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');
  await FileOpener.openFile({ path: scritto.uri, mimeType: blob.type || undefined });
}

/**
 * Consegna un documento scaricato: sul web lo salva con il browser, nell'app lo
 * apre con il visore del telefono e ne tiene una copia cifrata tra i recenti.
 */
export async function consegnaFile(blob: Blob, nome: string, origine: string): Promise<void> {
  if (!isNativa()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  await ricordaFile(blob, nome, origine);
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  await apriNelTelefono(blob, nome, Filesystem, Directory.Cache);
}

/** Cancella file, indice, copie aperte e chiave (uscita dall'account). */
export async function svuotaFileRecenti(): Promise<void> {
  if (!isNativa()) return;
  try {
    const { Filesystem, Directory, directory } = await fs();
    await Filesystem.rmdir({ path: CARTELLA, directory, recursive: true }).catch(() => undefined);
    await Filesystem.rmdir({ path: 'aperti', directory: Directory.Cache, recursive: true }).catch(() => undefined);
  } finally {
    await togliChiave().catch(() => undefined);
  }
}
