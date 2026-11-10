'use client';

/**
 * Apertura della bocca del falco, a tempo con quello che dice.
 *
 * Una sola sorgente alla volta pilota il livello (0 chiusa, 1 socchiusa, 2 aperta):
 * - voce dell'agente (audio mp3): analisi dell'ampiezza con Web Audio, fotogramma per fotogramma;
 * - voce del dispositivo (speechSynthesis): impulsi sui confini di parola;
 * - nessuna voce: il ritmo delle sillabe del testo mentre la risposta compare.
 *
 * Chi disegna il falco si iscrive con ascoltaBocca e riceve il livello.
 */

export type Apertura = 0 | 1 | 2;
type Ascoltatore = (a: Apertura) => void;

const ascoltatori = new Set<Ascoltatore>();
let corrente: Apertura = 0;
let fermaSorgente: (() => void) | null = null;

function imposta(a: Apertura) {
  if (a === corrente) return;
  corrente = a;
  ascoltatori.forEach((f) => f(a));
}

export function ascoltaBocca(f: Ascoltatore): () => void {
  ascoltatori.add(f);
  f(corrente);
  return () => ascoltatori.delete(f);
}

export function boccaParla(): boolean {
  return fermaSorgente !== null;
}

export function chiudiBocca(): void {
  const f = fermaSorgente;
  fermaSorgente = null;
  f?.();
  imposta(0);
}

function nuovaSorgente(ferma: () => void) {
  chiudiBocca();
  fermaSorgente = ferma;
}

/** Soglie su RMS normalizzato: sotto la prima chiusa, oltre la seconda aperta. */
export function livelloDaAmpiezza(rms: number): Apertura {
  if (rms < 0.035) return 0;
  if (rms < 0.11) return 1;
  return 2;
}

let contesto: AudioContext | null = null;
const giaCollegati = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function contestoAudio(): AudioContext | null {
  try {
    if (!contesto) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      contesto = new C();
    }
    if (contesto.state === 'suspended') void contesto.resume().catch(() => undefined);
    return contesto;
  } catch {
    return null;
  }
}

/** Da chiamare su un gesto dell'utente (invio, microfono): sblocca l'audio sui browser che lo richiedono. */
export function sbloccaAudio(): void {
  contestoAudio();
}

/**
 * La bocca segue l'audio di questo elemento finche' suona. Se Web Audio non e'
 * disponibile ripiega sul ritmo sillabico per la durata dell'audio.
 */
export function boccaSuAudio(audio: HTMLAudioElement, testo = ''): void {
  const ctx = contestoAudio();
  let raf = 0;
  let vivo = true;
  let analizzatore: AnalyserNode | null = null;
  // Solo con il contesto gia' attivo: un contesto sospeso renderebbe muto l'audio collegato.
  if (ctx && ctx.state === 'running') {
    try {
      let src = giaCollegati.get(audio);
      if (!src) {
        src = ctx.createMediaElementSource(audio);
        giaCollegati.set(audio, src);
      }
      analizzatore = ctx.createAnalyser();
      analizzatore.fftSize = 512;
      analizzatore.smoothingTimeConstant = 0.35;
      src.connect(analizzatore);
      analizzatore.connect(ctx.destination);
    } catch {
      analizzatore = null;
    }
  }
  if (!analizzatore) {
    const durata = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : stimaDurata(testo);
    boccaSuTesto(testo || 'parla', durata);
    return;
  }
  const dati = new Uint8Array(analizzatore.fftSize);
  let tenuta = 0;
  let ultimo: Apertura = 0;
  const giro = () => {
    if (!vivo || !analizzatore) return;
    analizzatore.getByteTimeDomainData(dati);
    let s = 0;
    for (let i = 0; i < dati.length; i++) {
      const v = (dati[i] - 128) / 128;
      s += v * v;
    }
    const liv = audio.paused ? 0 : livelloDaAmpiezza(Math.sqrt(s / dati.length));
    // Tengo un livello almeno 55 ms: niente sfarfallio tra due fotogrammi.
    const ora = performance.now();
    if (liv !== ultimo && ora - tenuta > 55) {
      ultimo = liv;
      tenuta = ora;
      imposta(liv);
    }
    raf = requestAnimationFrame(giro);
  };
  nuovaSorgente(() => {
    vivo = false;
    cancelAnimationFrame(raf);
    try {
      analizzatore?.disconnect();
    } catch {
      /* gia' scollegato */
    }
  });
  const fine = () => {
    if (fermaSorgente) chiudiBocca();
  };
  audio.addEventListener('ended', fine, { once: true });
  audio.addEventListener('pause', () => imposta(0));
  raf = requestAnimationFrame(giro);
}

/** Circa 14 caratteri al secondo, come una lettura calma in italiano. */
export function stimaDurata(testo: string): number {
  return Math.min(60000, Math.max(900, testo.length * 70));
}

/**
 * Sillabe approssimate dal testo: vocali aperte, consonanti chiudono, la
 * punteggiatura e' una pausa. Restituisce la sequenza dei livelli, uno per tempo.
 */
export function sequenzaSillabe(testo: string): Apertura[] {
  const out: Apertura[] = [];
  for (const ch of testo.toLowerCase()) {
    if ('aoeàòèé'.includes(ch)) out.push(2);
    else if ('iuìù'.includes(ch)) out.push(1);
    else if (/[.,;:!?\n]/.test(ch)) out.push(0, 0);
    else if (ch === ' ') out.push(0);
  }
  return out.length ? out : [1, 2, 1, 0];
}

/** La bocca recita il testo per la durata indicata (senza audio). onFine anche se interrotta. */
export function boccaSuTesto(testo: string, durataMs = stimaDurata(testo), onFine?: () => void): void {
  const seq = sequenzaSillabe(testo);
  const passo = Math.max(60, Math.min(140, durataMs / seq.length));
  let i = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chiuso = false;
  const finito = () => {
    if (chiuso) return;
    chiuso = true;
    onFine?.();
  };
  const avanti = () => {
    if (i >= seq.length) {
      chiudiBocca();
      return;
    }
    imposta(seq[i++]);
    timer = setTimeout(avanti, passo);
  };
  nuovaSorgente(() => {
    if (timer) clearTimeout(timer);
    finito();
  });
  avanti();
}

/** Voce del dispositivo: ogni confine di parola apre la bocca per un istante. */
export function boccaSuSintesi(u: SpeechSynthesisUtterance, testo: string): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let haConfini = false;
  const parola = (len: number) => {
    haConfini = true;
    imposta(len > 5 ? 2 : 1);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => imposta(0), Math.min(260, 60 + len * 28));
  };
  u.addEventListener('boundary', (e) => parola((e as SpeechSynthesisEvent).charLength || 4));
  u.addEventListener('start', () => {
    nuovaSorgente(() => {
      if (timer) clearTimeout(timer);
    });
    // Alcuni browser non emettono i confini: dopo un attimo ripiego sul testo.
    setTimeout(() => {
      if (!haConfini && fermaSorgente) boccaSuTesto(testo);
    }, 500);
  });
  u.addEventListener('end', () => chiudiBocca());
  u.addEventListener('error', () => chiudiBocca());
}
