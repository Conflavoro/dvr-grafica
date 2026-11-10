/**
 * Ingresso dei file dalla chat e dall'archivio: che tipo di materiale e',
 * se si puo' caricare, e come trattare i video troppo grandi.
 *
 * Il server accetta fino a 25 MB per caricamento (cPanel). Oltre:
 *  - i VIDEO non si caricano: il browser estrae i fotogrammi e la traccia
 *    audio (16 kHz mono) e manda solo quelli, cosi' anche un video di 300 MB
 *    dal telefono viene analizzato;
 *  - gli altri file danno subito un messaggio chiaro, prima di aspettare un
 *    caricamento che il server rifiuterebbe.
 */
import type { CompanyDocumentTipo } from '@/lib/data-source/types';
import { TARGET_RATE, downsample, encodeWav } from '@/components/ui/AudioRecorder';

/** Limite di un caricamento (sotto i 25 MB di upload_max_filesize, con margine). */
export const MAX_CARICAMENTO = 24 * 1024 * 1024;

/** Estensioni accettate dall'archivio (stesso elenco del server). */
export const ESTENSIONI_ACCETTATE = [
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm', 'xml', 'p7m', 'p7s',
  'xls', 'xlsx', 'xlsm', 'ods', 'csv', 'tsv', 'ppt', 'pptx', 'odp', 'eml', 'msg',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif',
  'mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'flac', 'weba', 'amr',
  'mp4', 'mov', 'webm', 'm4v', '3gp', 'mkv', 'avi', 'mpeg', 'mpg',
  'zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'dxf', 'dwg',
];

/** Valore per l'attributo accept degli input file. */
export const ACCEPT_ARCHIVIO = ['image/*', 'audio/*', 'video/*', ...ESTENSIONI_ACCETTATE.map((e) => `.${e}`)].join(',');

const IMMAGINI = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif'];
const AUDIO = ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'flac', 'weba', 'amr'];
const VIDEO = ['mp4', 'mov', 'webm', 'm4v', '3gp', 'mkv', 'avi', 'mpeg', 'mpg'];

export function estensione(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

/** Tipo di materiale per l'archivio, dal MIME del browser o, se manca (HEIC su desktop), dal nome. */
export function tipoDaFile(file: Pick<File, 'name' | 'type'>): CompanyDocumentTipo {
  const ext = estensione(file.name);
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/') || IMMAGINI.includes(ext)) return 'foto';
  // .webm e .m4a possono essere audio o video: decide il MIME, poi il nome.
  if (t.startsWith('audio/') || (!t.startsWith('video/') && AUDIO.includes(ext))) return 'audio';
  if (t.startsWith('video/') || VIDEO.includes(ext)) return 'video';
  return 'documento';
}

/** Messaggio se il file non si puo' caricare, altrimenti null. */
export function controlloCaricamento(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const ext = estensione(file.name);
  if (ext && !ESTENSIONI_ACCETTATE.includes(ext) && !(file.type || '').match(/^(image|audio|video)\//)) {
    return `Il tipo di file .${ext} non è accettato. Carica documenti, immagini, audio, video, archivi ZIP o disegni DXF.`;
  }
  if (file.size > MAX_CARICAMENTO && tipoDaFile(file) !== 'video') {
    const mb = Math.round(file.size / 1048576);
    return `Il file pesa ${mb} MB, oltre il limite di 24 MB del caricamento. Dividilo in parti più piccole (per i PDF bastano due o tre file) e caricale una alla volta.`;
  }
  return null;
}

/** True se il video va analizzato nel browser invece di essere caricato. */
export function videoDaAnalizzareNelBrowser(file: Pick<File, 'name' | 'type' | 'size'>): boolean {
  return tipoDaFile(file) === 'video' && file.size > MAX_CARICAMENTO;
}

/**
 * Traccia audio di un video (o di un audio) come WAV 16 kHz mono, per la
 * trascrizione sul server. Fino a `maxSecondi` (12 minuti stanno in 24 MB).
 * Ritorna null se il browser non sa decodificare l'audio del file.
 */
export async function audioComeWav(file: File, maxSecondi = 12 * 60): Promise<Blob | null> {
  const Ctx: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const dati = await file.arrayBuffer();
    const buf = await ctx.decodeAudioData(dati.slice(0));
    const canali = buf.numberOfChannels;
    const lunghezza = Math.min(buf.length, Math.floor(maxSecondi * buf.sampleRate));
    const mono = new Float32Array(lunghezza);
    for (let c = 0; c < canali; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < lunghezza; i++) mono[i] += d[i] / canali;
    }
    return encodeWav(downsample(mono, buf.sampleRate), Math.min(buf.sampleRate, TARGET_RATE));
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}
