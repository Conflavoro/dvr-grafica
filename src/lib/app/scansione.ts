/**
 * Scansione di documenti con la fotocamera (app nativa).
 *
 * Plugin @capgo/capacitor-document-scanner: VisionKit su iOS (bordi rilevati e
 * raddrizzati dal sistema), ML Kit Document Scanner su Android (ritaglio e
 * rotazione nell'interfaccia di Google). Su iOS si lascia spento
 * letUserAdjustCrop, che usa agganci privati di VisionKit (rischio in revisione
 * App Store): il ritaglio automatico di VisionKit resta.
 * Se il plugin non c'e' o non funziona (Android senza Google Play Services) si
 * ripiega sulla fotocamera con il ritaglio del sistema (@capacitor/camera, allowEditing).
 * Le pagine diventano un unico PDF A4.
 */

import { fileDaBase64 } from './fotocamera';
import { isNativa, piattaforma } from './nativa';

export const PAGINE_MASSIME = 12;

/** Dimensioni dell'immagine in un foglio A4 (mm) con margine, proporzioni mantenute. */
export function inPagina(larghezza: number, altezza: number, margine = 8): { x: number; y: number; w: number; h: number } {
  const W = 210 - 2 * margine;
  const H = 297 - 2 * margine;
  const r = Math.min(W / Math.max(1, larghezza), H / Math.max(1, altezza));
  const w = larghezza * r;
  const h = altezza * r;
  return { x: (210 - w) / 2, y: (297 - h) / 2, w, h };
}

export function nomeScansione(ora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `Scansione ${ora.getFullYear()}-${p(ora.getMonth() + 1)}-${p(ora.getDate())} ${p(ora.getHours())}.${p(ora.getMinutes())}.pdf`;
}

function dimensioni(src: string): Promise<{ w: number; h: number }> {
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => ok({ w: 210, h: 297 });
    i.src = src;
  });
}

/** Pagine JPEG (base64) in un PDF A4. */
export async function pdfDaPagine(pagine: string[], nome = nomeScansione()): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < pagine.length; i++) {
    const src = pagine[i].startsWith('data:') ? pagine[i] : `data:image/jpeg;base64,${pagine[i]}`;
    const d = await dimensioni(src);
    const r = inPagina(d.w, d.h);
    if (i > 0) doc.addPage();
    doc.addImage(src, 'JPEG', r.x, r.y, r.w, r.h, undefined, 'FAST');
  }
  return new File([doc.output('blob')], nome, { type: 'application/pdf' });
}

async function conPlugin(): Promise<string[] | null> {
  const { DocumentScanner, ResponseType, ScannerMode } = await import('@capgo/capacitor-document-scanner');
  const r = await DocumentScanner.scanDocument({
    responseType: ResponseType.Base64,
    maxNumDocuments: PAGINE_MASSIME,
    croppedImageQuality: 85,
    letUserAdjustCrop: piattaforma() === 'android',
    scannerMode: ScannerMode.Full,
  });
  if (r.status === 'cancel') return [];
  return (r.scannedImages ?? []).filter((x) => typeof x === 'string' && x.length > 0);
}

async function conFotocamera(): Promise<string[]> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const f = await Camera.getPhoto({
    quality: 85,
    width: 2200,
    correctOrientation: true,
    allowEditing: true, // ritaglio del sistema
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    saveToGallery: false,
  });
  return f.base64String ? [f.base64String] : [];
}

/**
 * Scansiona e restituisce un PDF pronto per il caricamento, null se l'utente
 * annulla o se non siamo nell'app (sul web si usa la scelta del file).
 */
export async function scansionaDocumento(): Promise<File | null> {
  if (!isNativa()) return null;
  let pagine: string[] | null = null;
  try {
    pagine = await conPlugin();
  } catch {
    pagine = null;
  }
  if (pagine === null) {
    try {
      pagine = await conFotocamera();
    } catch {
      return null;
    }
  }
  if (pagine.length === 0) return null;
  try {
    return await pdfDaPagine(pagine.slice(0, PAGINE_MASSIME));
  } catch {
    // PDF non riuscito: almeno la prima pagina come foto.
    return fileDaBase64(pagine[0], 'jpeg', 'scansione');
  }
}
