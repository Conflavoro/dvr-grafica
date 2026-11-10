'use client';

// Lettura ad alta voce delle risposte dell'agente (Web Speech API, it-IT) e
// preferenza dell'utente ricordata nel browser. Ogni accesso a localStorage e'
// protetto: in navigazione privata o con dati bloccati si ricade sul default.

import { boccaSuAudio, boccaSuSintesi, chiudiBocca } from './falco-bocca';

const CHIAVE_VOCE = 'crm_dvr_agente_lettura_voce';

export function letturaVoceAttiva(): boolean {
  try {
    return localStorage.getItem(CHIAVE_VOCE) !== '0';
  } catch {
    return true;
  }
}

export function salvaLetturaVoce(attiva: boolean): void {
  try {
    localStorage.setItem(CHIAVE_VOCE, attiva ? '1' : '0');
  } catch {
    /* preferenza non salvabile: resta valida per questa sessione */
  }
}

export function sintesiDisponibile(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function vocePreferita(): SpeechSynthesisVoice | null {
  try {
    const voci = window.speechSynthesis.getVoices();
    return voci.find((v) => v.lang === 'it-IT') ?? voci.find((v) => v.lang.toLowerCase().startsWith('it')) ?? null;
  } catch {
    return null;
  }
}

/** Legge il testo in italiano. Ritorna false se la sintesi non e' disponibile. */
export function leggiAdAltaVoce(
  testo: string,
  callbacks: { onInizio?: () => void; onFine?: () => void } = {}
): boolean {
  if (!sintesiDisponibile() || !testo.trim()) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(testo.slice(0, 4000));
    u.lang = 'it-IT';
    const v = vocePreferita();
    if (v) u.voice = v;
    u.rate = 1;
    boccaSuSintesi(u, testo.slice(0, 4000));
    u.onstart = () => callbacks.onInizio?.();
    u.onend = () => callbacks.onFine?.();
    u.onerror = () => callbacks.onFine?.();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    callbacks.onFine?.();
    return false;
  }
}

// ------------------------------------------------------------------
// Voce dell'agente (voce clonata dal backend, audio mp3 per paragrafi)
// ------------------------------------------------------------------

/** Lettura in corso con la voce dell'agente: la si ferma da interrompiVoce(). */
let fermaAttuale: (() => void) | null = null;

/**
 * Divide il testo in paragrafi da sintetizzare uno per volta. Il primo pezzo e'
 * corto (la prima frase o due, fino a `primo` caratteri): la sintesi risponde in
 * un paio di secondi e voce e testo partono insieme. I paragrafi molto brevi si
 * uniscono al successivo, quelli lunghi si spezzano sulle frasi.
 */
export function paragrafiPerVoce(testo: string, max = 900, min = 90, primo = 220): string[] {
  const blocchi = testo
    .split(/\n\s*\n+/)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const spezzati: string[] = [];
  for (const b of blocchi) {
    if (b.length <= max) {
      spezzati.push(b);
      continue;
    }
    let corrente = '';
    for (const frase of b.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [b]) {
      if ((corrente + frase).length > max && corrente) {
        spezzati.push(corrente.trim());
        corrente = '';
      }
      corrente += frase;
    }
    if (corrente.trim()) spezzati.push(corrente.trim());
  }
  const uniti: string[] = [];
  for (const p of spezzati) {
    const ultimo = uniti[uniti.length - 1];
    if (ultimo !== undefined && ultimo.length < min && (ultimo + ' ' + p).length <= max) uniti[uniti.length - 1] = `${ultimo} ${p}`;
    else uniti.push(p);
  }
  // Primo pezzo corto: le prime frasi fino a `primo` caratteri, il resto torna in coda.
  if (uniti.length > 0 && uniti[0].length > primo) {
    const frasi = uniti[0].match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [uniti[0]];
    let testa = '';
    let i = 0;
    while (i < frasi.length && (testa === '' || (testa + frasi[i]).length <= primo)) {
      testa += frasi[i];
      i++;
    }
    const coda = frasi.slice(i).join('').trim();
    if (coda) uniti.splice(0, 1, testa.trim(), coda);
  }
  return uniti;
}

/**
 * Legge il testo con la voce dell'agente: chiede il primo paragrafo subito e
 * il successivo mentre suona il precedente. Se la voce non risponde ripiega
 * sulla sintesi del dispositivo (it-IT) per il testo che manca.
 */
/** Parole di un pezzo come le conta il server (tratti senza spazi). */
export function parolePezzo(p: string): string[] {
  return p.split(/\s+/).filter(Boolean);
}

/**
 * Indice dell'ultima parola iniziata all'istante `ms`. Con i tempi della voce è esatto;
 * senza, si stima dalla lunghezza delle parole sulla durata dell'audio.
 */
export function parolaAlTempo(pezzo: string, ms: number, durataMs: number, tempi?: number[]): number {
  const parole = parolePezzo(pezzo);
  if (parole.length === 0) return -1;
  if (tempi && tempi.length > 0) {
    // Se il server conta parole diverse, si riporta la posizione in proporzione.
    let k = -1;
    for (let i = 0; i < tempi.length && tempi[i] <= ms; i++) k = i;
    if (k < 0) return -1;
    return tempi.length === parole.length ? k : Math.min(parole.length - 1, Math.round(((k + 1) / tempi.length) * parole.length) - 1);
  }
  if (!(durataMs > 0)) return -1;
  const tot = parole.reduce((a, w) => a + w.length + 1, 0);
  const soglia = (ms / durataMs) * tot;
  let acc = 0;
  for (let i = 0; i < parole.length; i++) {
    if (acc > soglia) return i - 1;
    acc += parole[i].length + 1;
  }
  return parole.length - 1;
}

export interface CallbackVoce {
  onInizio?: () => void;
  onFine?: () => void;
  /** I pezzi che verranno letti, nell'ordine: il testo da mostrare a tempo. */
  onPezzi?: (pezzi: string[]) => void;
  /** Parola arrivata nella lettura (pezzo, indice della parola nel pezzo). */
  onParola?: (pezzo: number, parola: number) => void;
}

/**
 * Lettura in corso, fuori da React: il Falco può cambiare schermata mentre parla e il
 * guscio nuovo (o la striscia in basso) continua a mostrare le parole a tempo.
 */
export interface LetturaVoce {
  /** Messaggio letto (id della risposta), se noto. */
  id: number | null;
  pezzi: string[];
  pezzo: number;
  parola: number;
}
let lettura: LetturaVoce | null = null;
const ascoltatoriLettura = new Set<() => void>();
function pubblica(l: LetturaVoce | null): void {
  lettura = l;
  ascoltatoriLettura.forEach((f) => f());
}
export function letturaInCorso(): LetturaVoce | null {
  return lettura;
}
export function ascoltaLettura(f: () => void): () => void {
  ascoltatoriLettura.add(f);
  return () => {
    ascoltatoriLettura.delete(f);
  };
}

export function leggiConVoceAgente(
  testo: string,
  sintetizza: (t: string) => Promise<Blob>,
  callbacks: CallbackVoce = {},
  id: number | null = null
): void {
  interrompiVoce();
  const pezzi = paragrafiPerVoce(testo);
  if (pezzi.length > 0) {
    pubblica({ id, pezzi, pezzo: 0, parola: -1 });
    callbacks.onPezzi?.(pezzi);
  }
  const avanza = (pezzo: number, parola: number) => {
    if (lettura && lettura.pezzi === pezzi && (lettura.pezzo !== pezzo || lettura.parola !== parola)) pubblica({ ...lettura, pezzo, parola });
    callbacks.onParola?.(pezzo, parola);
  };
  if (pezzi.length === 0 || typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') {
    if (!leggiAdAltaVoce(testo, callbacks)) callbacks.onFine?.();
    return;
  }
  let fermata = false;
  let iniziata = false;
  let audio: HTMLAudioElement | null = null;
  const url: string[] = [];
  const richieste = new Map<number, Promise<Blob>>();
  const chiedi = (i: number) => {
    if (i < pezzi.length && !richieste.has(i)) {
      const r = sintetizza(pezzi[i]);
      r.catch(() => undefined);
      richieste.set(i, r);
    }
    return richieste.get(i);
  };
  const pulisci = () => {
    url.forEach((u) => URL.revokeObjectURL(u));
    url.length = 0;
  };
  const fine = () => {
    if (lettura?.pezzi === pezzi) pubblica(null);
    if (fermaAttuale === ferma) fermaAttuale = null;
    pulisci();
    callbacks.onFine?.();
  };
  const ripiega = (da: number) => {
    if (fermata) return;
    if (fermaAttuale === ferma) fermaAttuale = null;
    pulisci();
    // La voce del dispositivo non dà i tempi: il testo che resta compare intero.
    avanza(pezzi.length - 1, parolePezzo(pezzi[pezzi.length - 1]).length - 1);
    if (lettura?.pezzi === pezzi) pubblica(null);
    const resto = pezzi.slice(da).join('\n\n');
    const ok = leggiAdAltaVoce(resto, { onInizio: iniziata ? undefined : callbacks.onInizio, onFine: callbacks.onFine });
    if (!ok) callbacks.onFine?.();
  };
  const suona = async (i: number) => {
    if (fermata) return;
    if (i >= pezzi.length) return fine();
    let blob: Blob;
    try {
      blob = await chiedi(i)!;
    } catch {
      return ripiega(i);
    }
    if (fermata) return;
    const u = URL.createObjectURL(blob);
    url.push(u);
    audio = new Audio(u);
    const tempi = (blob as Blob & { parole?: number[] }).parole;
    const corrente = audio;
    let giro = 0;
    const segui = () => {
      if (fermata || audio !== corrente) return;
      avanza(i, parolaAlTempo(pezzi[i], corrente.currentTime * 1000, corrente.duration * 1000, tempi));
      giro = requestAnimationFrame(segui);
    };
    audio.onended = () => {
      cancelAnimationFrame(giro);
      avanza(i, parolePezzo(pezzi[i]).length - 1);
      void suona(i + 1);
    };
    audio.onerror = () => ripiega(i);
    audio.onplay = () => {
      if (audio) boccaSuAudio(audio, pezzi[i]);
      if (typeof requestAnimationFrame === 'function') giro = requestAnimationFrame(segui);
      if (!iniziata) {
        iniziata = true;
        callbacks.onInizio?.();
      }
      chiedi(i + 1); // i prossimi paragrafi si preparano mentre questo suona
      chiedi(i + 2);
    };
    try {
      await audio.play();
    } catch {
      ripiega(i);
    }
  };
  function ferma() {
    if (fermata) return;
    fermata = true;
    try {
      audio?.pause();
    } catch {
      /* gia' fermo */
    }
    fine();
  }
  fermaAttuale = ferma;
  // Primo e secondo pezzo chiesti insieme: il secondo e' pronto quando finisce il primo.
  chiedi(0);
  chiedi(1);
  void suona(0);
}

export function interrompiVoce(): void {
  chiudiBocca();
  if (fermaAttuale) {
    const f = fermaAttuale;
    fermaAttuale = null;
    f();
  }
  if (!sintesiDisponibile()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* niente da interrompere */
  }
}
