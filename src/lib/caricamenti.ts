/**
 * Coda dei file caricati dalla chat: piu' file insieme, ognuno con il suo
 * avanzamento e il suo errore, poi un solo riassunto per l'agente.
 *
 * Logica pura (niente React): la pagina tiene lo stato e chiama queste
 * funzioni. I controlli di ingresso sono quelli di ingresso-file.ts (stesso
 * elenco di estensioni del server, limite di 24 MB, video grandi analizzati
 * nel browser).
 */
import type { CompanyDocumentTipo } from '@/lib/data-source/types';
import { controlloCaricamento, tipoDaFile } from '@/lib/ingresso-file';

export type StatoCaricamento = 'in_coda' | 'carico' | 'analizzo' | 'fatto' | 'errore';

export interface VoceCaricamento {
  id: string;
  file: File;
  nome: string;
  peso: number;
  tipo: CompanyDocumentTipo;
  stato: StatoCaricamento;
  /** 0..100 durante l'invio; null quando non misurabile (analisi, fotogrammi). */
  percento: number | null;
  /** Cosa sta succedendo, in italiano. */
  fase: string;
  /** Errore del caricamento: il file non e' nell'archivio. */
  errore: string | null;
  /** Il file non si puo' caricare cosi' com'e' (tipo, peso): Riprova non serve. */
  definitivo: boolean;
  analisi: string;
  /** Il file e' nell'archivio ma l'analisi automatica non e' riuscita. */
  analisiErrore: string | null;
}

/** Massimo di file per volta: oltre si chiede di caricarne meno. */
export const MAX_FILE_PER_VOLTA = 20;

let progressivo = 0;

/** Voci della coda dai file scelti o trascinati; quelli non caricabili sono gia' in errore. */
export function preparaCaricamenti(files: File[]): VoceCaricamento[] {
  return files.map((file, i) => {
    const blocco = controlloCaricamento(file);
    const oltre = i >= MAX_FILE_PER_VOLTA;
    const errore = oltre ? `Oltre i ${MAX_FILE_PER_VOLTA} file per volta: caricalo nel prossimo gruppo.` : blocco;
    return {
      id: `c${Date.now().toString(36)}${(progressivo++).toString(36)}`,
      file,
      nome: file.name || 'file senza nome',
      peso: file.size,
      tipo: tipoDaFile(file),
      stato: errore ? 'errore' : 'in_coda',
      percento: null,
      fase: errore ? 'non caricato' : 'in coda',
      errore,
      definitivo: errore !== null,
      analisi: '',
      analisiErrore: null,
    };
  });
}

/** "820 KB", "3,4 MB". */
export function pesoLeggibile(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
}

const COSA: Record<string, string> = {
  foto: 'una foto di sopralluogo',
  audio: 'una nota vocale di sopralluogo',
  video: 'un video di sopralluogo',
  documento: 'un documento',
};

/**
 * Messaggio per l'agente dopo il caricamento. Un file: la frase di sempre.
 * Piu' file: un elenco numerato con l'analisi di ciascuno, dentro il limite
 * del messaggio. null se nessun file e' arrivato nell'archivio.
 */
export function riassuntoPerAgente(voci: VoceCaricamento[], perChi: string, maxCaratteri = 7800): string | null {
  const arrivati = voci.filter((v) => v.stato === 'fatto');
  if (arrivati.length === 0) return null;
  const falliti = voci.filter((v) => v.stato === 'errore');
  const esito = (v: VoceCaricamento, max: number): string => {
    const a = v.analisi.trim();
    if (a) return `Analisi: ${a.length > max ? `${a.slice(0, max).trimEnd()}…` : a}`;
    if (v.analisiErrore) return `L'analisi automatica non è riuscita: ${v.analisiErrore}.`;
    return "L'analisi è ancora in corso nell'archivio dell'azienda.";
  };
  if (arrivati.length === 1 && falliti.length === 0) {
    const v = arrivati[0];
    return `Ho caricato ${COSA[v.tipo] ?? COSA.documento}${perChi}: ${v.nome}. ${esito(v, 600)}`;
  }
  const testa = `Ho caricato ${arrivati.length} file${perChi}.`;
  const coda = falliti.length ? `\nNon caricati (${falliti.length}): ${falliti.map((v) => v.nome).join(', ')}.` : '';
  // Spazio per le analisi: diviso tra i file, almeno 160 caratteri ciascuno.
  const fisso = testa.length + coda.length + arrivati.reduce((n, v) => n + v.nome.length + 16, 0);
  const perFile = Math.max(160, Math.min(600, Math.floor((maxCaratteri - fisso) / arrivati.length) - 40));
  const righe = arrivati.map((v, i) => `${i + 1}. ${v.nome}. ${esito(v, perFile)}`);
  const msg = `${testa}\n${righe.join('\n')}${coda}`;
  return msg.length > maxCaratteri ? `${msg.slice(0, maxCaratteri - 1).trimEnd()}…` : msg;
}

/** true se tra i dati trascinati ci sono file (non testo o link). */
export function trascinaFile(tipi: ReadonlyArray<string> | DOMStringList | null | undefined): boolean {
  if (!tipi) return false;
  return Array.from(tipi as ArrayLike<string>).includes('Files');
}
