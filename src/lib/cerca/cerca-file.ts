/**
 * Ricerca dei documenti della sicurezza nel computer della persona: logica pura (punteggio, filtri, scansione su
 * un'interfaccia minima di cartelle), senza browser né rete, così si prova con cartelle finte.
 * Il contenuto si legge in locale, sul computer della persona: non lascia mai il computer prima della conferma e non
 * si conserva (serve solo a riconoscere un "scansione_0042.pdf" che è una nomina del RSPP).
 * Portata dalla ricerca collaudata di FondoFormazione (cerca-file.ts), con i tipi HSE.
 */

import { dataInChiaro, descrivi, MOTIVO_SANITARIO, normalizza, riconosci, TIPI_CERCATI, TIPI_MULTIPLI, verifica, spostaMesi } from './riconosci'
import type { Impresa, TipoCercato, Verdetto } from './riconosci'
import { contenutoP7m, testoDaDocx, vociZip } from './archivio'

export type { Impresa, TipoCercato, Verdetto }

export interface RichiestaRicerca {
  tipi: TipoCercato[]
  parole_chiave: string[]
  /** Ciò che Falco sa dell'azienda: serve a riconoscere i suoi documenti e a scartare quelli di altre aziende. */
  impresa?: Impresa | null
  /**
   * Facoltativo, per i tipi multipli: le chiavi che servono (per la nomina «rspp», «medico_competente»; per il verbale
   * «messa_terra»). Quando sono trovate tutte, quel tipo è completo e la ricerca si può fermare. Senza, per i tipi
   * multipli si guarda tutta la cartella entro i limiti.
   */
  servono?: Partial<Record<TipoCercato, string[]>>
}

export interface Limiti {
  profondita: number
  fileVisitati: number
  risultati: number
  byteMassimi: number
  /** Quanti file si aprono per leggerne il contenuto, e quanto tempo al massimo si lavora. */
  lettureContenuto: number
  letturePerArchivio: number
  scansioniOcr: number
  tempoMs: number
}

export const LIMITI_RICERCA: Limiti = { profondita: 8, fileVisitati: 12000, risultati: 60, byteMassimi: 25 * 1024 * 1024, lettureContenuto: 600, letturePerArchivio: 14, scansioniOcr: 12, tempoMs: 90000 }

/** Nome della sottocartella dove si raccolgono le copie: non si riscansiona. */
export const CARTELLA_RACCOLTA = 'DVR Conflavoro'

/** Parole tipiche del nome di file per ciascun tipo, già normalizzate. */
export const PAROLE_PER_TIPO: Record<TipoCercato, string[]> = {
  visura: ['visura', 'camerale', 'registro imprese', 'cciaa', 'camera di commercio'],
  nomina: ['nomina', 'designazione', 'incarico', 'rspp', 'aspp', 'medico competente', 'rls', 'rlst', 'preposto', 'addetti', 'elezione'],
  attestato_formazione: ['attestato', 'formazione', 'corso', 'frequenza', 'aggiornamento', 'carrelli', 'carrellista', 'ple', 'preposti', 'antincendio', 'primo soccorso'],
  verbale_verifica: ['verbale', 'verifica', '462', 'messa a terra', 'estintori', 'ascensore', 'sollevamento', 'gru', 'controllo periodico'],
  sds: ['sds', 'msds', 'scheda sicurezza', 'scheda di sicurezza', 'scheda dati', 'safety data sheet'],
  dvr: ['dvr', 'valutazione rischi', 'valutazione dei rischi', 'documento valutazione'],
  libretto_attrezzatura: ['manuale', 'libretto', 'istruzioni', 'dichiarazione ce', 'conformita ce', 'uso e manutenzione'],
  elenco_lavoratori: ['elenco', 'lavoratori', 'dipendenti', 'libro unico', 'lul', 'organico', 'anagrafica', 'personale'],
  planimetria: ['planimetria', 'pianta', 'layout', 'piano evacuazione', 'piano di evacuazione'],
  piano_emergenza: ['piano emergenza', 'piano di emergenza', 'pee', 'emergenza'],
  altro: [],
}

/** Quanti file si aprono al massimo e quanto grandi (default; i limiti veri stanno in {@link LIMITI_RICERCA}). */
export const LIMITI_CONTENUTO = { pdf: 220, byte: 25 * 1024 * 1024 }

const LEGGIBILI = ['pdf', 'p7m', 'docx', 'txt', 'csv']
const IMMAGINI = ['jpg', 'jpeg', 'png', 'webp']
const ARCHIVI = ['zip']

// p7m: documenti firmati digitalmente (nome.pdf.p7m); l'estensione maiuscola (.PDF) è la stessa cosa.
const DOCUMENTI = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'docx', 'txt', 'p7m', 'zip']
const FOGLI = ['xlsx', 'xls', 'csv', 'ods']
export const ESTENSIONI = DOCUMENTI.concat(FOGLI)

/** Cartelle di sistema, di programmi e di sviluppo: dentro non ci sono documenti della persona. */
const CARTELLE_IGNORATE = new Set([
  'node_modules', 'vendor', 'library', 'applications', 'system', 'system volume information', 'windows', 'program files',
  'program files (x86)', 'programdata', 'appdata', 'application data', 'temp', 'tmp', 'cache', 'caches', 'dist', 'build',
  'site-packages', 'venv', 'bower_components', 'pods', 'deriveddata', 'onedrivetemp', 'logs',
])

export function normalizzaNomeFile(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.,;()[\]{}+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function estensioneFile(nome: string): string {
  const i = nome.lastIndexOf('.')
  return i > 0 ? nome.slice(i + 1).toLowerCase() : ''
}

export function cartellaDaIgnorare(nome: string): boolean {
  if (!nome || nome.startsWith('.') || nome.startsWith('$') || nome.startsWith('~')) return true
  const n = nome.toLowerCase()
  return CARTELLE_IGNORATE.has(n) || n === CARTELLA_RACCOLTA.toLowerCase()
}

export function fileDaIgnorare(nome: string): boolean {
  // File nascosti (.DS_Store), miniature di Windows, temporanei di Office (~$) e file senza estensione utile.
  const n = nome.toLowerCase()
  return !nome || nome.startsWith('.') || nome.startsWith('~') || n === 'thumbs.db' || n === 'desktop.ini' || n === 'ehthumbs.db' || ESTENSIONI.indexOf(estensioneFile(nome)) < 0
}

export interface Valutazione {
  punteggio: number
  tipo: TipoCercato | null
}

/**
 * Punteggio di un file dal nome: parola intera 10, parola dentro un'altra 4, estensione adatta al tipo 2 (6 per i
 * fogli quando si cerca un elenco). Zero vuol dire che non c'entra. Il nome serve solo a decidere l'ordine di lettura.
 */
export function valutaFile(nome: string, r: Pick<RichiestaRicerca, 'tipi' | 'parole_chiave'>): Valutazione {
  const ext = estensioneFile(nome)
  if (ESTENSIONI.indexOf(ext) < 0) return { punteggio: 0, tipo: null }
  const base = ' ' + normalizzaNomeFile(nome.slice(0, nome.length - ext.length - 1)) + ' '
  const tipi = r.tipi.length ? r.tipi : TIPI_CERCATI
  const libere = r.parole_chiave.map(normalizzaNomeFile).filter(p => p.length >= 2)

  const puntiParole = (parole: string[]): number => parole.reduce((s, p) => {
    if (base.indexOf(' ' + p + ' ') >= 0) return s + 10
    return base.indexOf(p) >= 0 ? s + 4 : s
  }, 0)

  let migliore: Valutazione = { punteggio: 0, tipo: null }
  for (const t of tipi) {
    let punti = puntiParole(PAROLE_PER_TIPO[t] ?? [])
    if (punti === 0) continue
    if (t === 'elenco_lavoratori') punti += FOGLI.indexOf(ext) >= 0 ? 6 : 0
    else punti += DOCUMENTI.indexOf(ext) >= 0 ? 2 : 0
    if (punti > migliore.punteggio) migliore = { punteggio: punti, tipo: t }
  }
  const extra = puntiParole(libere)
  if (extra > 0) {
    migliore = { punteggio: migliore.punteggio + extra, tipo: migliore.tipo ?? (tipi.length === 1 ? tipi[0]! : 'altro') }
  }
  return migliore
}

export interface Trovato {
  /** Percorso relativo alla cartella scelta, per mostrarlo e distinguere omonimi. */
  percorso: string
  nome: string
  byte: number
  modificato: number
  punteggio: number
  tipo: TipoCercato | null
  /** Che cosa è, letto dal contenuto: "una nomina di Officine Srl". */
  descrizione?: string
  /** Perché è stato scelto, una frase per indizio. */
  motivi?: string[]
  /**
   * «giusto» solo con intestatario, tipo e validità verificati dal contenuto; «da_controllare» con il `problema` in
   * chiaro (non si spunta mai da solo); «escluso» per i dati sanitari (mai caricabile).
   */
  verdetto?: Verdetto
  /** Che cosa è stato verificato, in frasi: lo dice anche Falco quando il file arriva. */
  verificato?: string[]
  problema?: string | null
  /** Data letta nel documento, AAAA-MM-GG: fra due validi vince il più recente. */
  data?: string | null
  /** Sottovoce dei tipi multipli (ruolo della nomina, persona e corso dell'attestato, verifica, prodotto). */
  chiave?: string | null
}

/** Fascia di pertinenza: dentro la stessa fascia conta la data, perché un documento vecchio di solito non vale più. */
export function fasciaPertinenza(punteggio: number): number {
  return punteggio >= 20 ? 3 : punteggio >= 10 ? 2 : punteggio > 0 ? 1 : 0
}

/** Ordine: prima la fascia di pertinenza, dentro la fascia i più recenti, poi il punteggio. */
export function confrontaTrovati(a: Trovato, b: Trovato): number {
  return fasciaPertinenza(b.punteggio) - fasciaPertinenza(a.punteggio) || b.modificato - a.modificato || b.punteggio - a.punteggio
}

export function inserisciOrdinato(elenco: Trovato[], nuovo: Trovato): number {
  let i = elenco.findIndex(x => confrontaTrovati(nuovo, x) < 0)
  if (i < 0) i = elenco.length
  elenco.splice(i, 0, nuovo)
  return i
}

/** Valuta il testo di un documento: le diciture tipiche del tipo pesano, da 10 in su è un buon candidato. */
export function valutaContenuto(testo: string, r: Pick<RichiestaRicerca, 'tipi'>): Valutazione {
  const x = riconosci(testo, r.tipi)
  return { punteggio: x.tipoPunti, tipo: x.tipo }
}

/** Testo dei PDF "a testo" (anche con i flussi compressi): lettura minima, senza librerie; per le scansioni non c'è testo. */
export async function testoDaPdf(dati: ArrayBuffer): Promise<string> {
  const byte = new Uint8Array(dati)
  const latino = new TextDecoder('latin1').decode(byte)
  const pezzi: string[] = []
  const flussi = /stream\r?\n/g
  let m: RegExpExecArray | null
  let letti = 0
  while ((m = flussi.exec(latino)) !== null && letti < 400) {
    // "stream" a inizio flusso, mai la coda di "endstream".
    if (latino.slice(Math.max(0, m.index - 3), m.index) === 'end') continue
    const inizio = m.index + m[0].length
    const fine = latino.indexOf('endstream', inizio)
    if (fine < 0) break
    letti++
    const intestazione = latino.slice(Math.max(0, m.index - 300), m.index)
    // La lunghezza dichiarata (/Length) è la misura esatta; senza, prima di "endstream" c'è un a capo che non fa
    // parte dei dati (ma si toglie solo quello: l'ultimo byte compresso può essere a sua volta un a capo).
    const dichiarata = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(intestazione.slice(intestazione.lastIndexOf('<<')))
    let fin = fine
    if (dichiarata && inizio + Number(dichiarata[1]) <= fine) fin = inizio + Number(dichiarata[1])
    else if (byte[fin - 1] === 10) fin -= byte[fin - 2] === 13 ? 2 : 1
    else if (byte[fin - 1] === 13) fin--
    let corpo = byte.subarray(inizio, fin)
    if (/FlateDecode/.test(intestazione)) {
      try {
        const ds = new Blob([corpo as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
        corpo = new Uint8Array(await new Response(ds).arrayBuffer())
      }
      catch {
        flussi.lastIndex = fine
        continue
      }
    }
    const testo = new TextDecoder('latin1').decode(corpo)
    if (!/\bT[jJ]\b|\bTJ\b/.test(testo)) { flussi.lastIndex = fine; continue }
    for (const t of Array.from(testo.matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g))) {
      if (t[1] !== undefined) pezzi.push(t[1].replace(/\\([()\\])/g, '$1'))
      else if (t[2] && t[2].replace(/\s/g, '').length % 2 === 0) pezzi.push(t[2].replace(/\s/g, '').replace(/../g, h => String.fromCharCode(parseInt(h, 16))))
    }
    pezzi.push(' ')
    flussi.lastIndex = fine
  }
  return pezzi.join(' ')
}

/** "una visura camerale di Officine Brianza Prova S.r.l.": il tipo e, se si legge, l'intestatario. */
export function descriviContenuto(testo: string, tipo: TipoCercato | null): string {
  return descrivi(testo, tipo)
}

/* Interfaccia minima delle cartelle: la soddisfano FileSystemDirectoryHandle e le cartelle finte. */
export interface VoceFile { kind: 'file', name: string, getFile(): Promise<File | { size: number, lastModified: number }> }
export interface VoceCartella { kind: 'directory', name: string, values(): AsyncIterable<VoceFile | VoceCartella> }

/**
 * Cartella finta costruita da un elenco di file con percorso relativo (input webkitdirectory, trascinamento) o da
 * file scelti uno per uno (telefono): così dove non c'è showDirectoryPicker si usa la stessa scansione.
 */
export function cartellaDaFile(files: { webkitRelativePath?: string, name: string }[]): VoceCartella {
  type Nodo = { nome: string, cartelle: Map<string, Nodo>, file: { name: string }[] }
  const radice: Nodo = { nome: '', cartelle: new Map(), file: [] }
  for (const f of files) {
    const parti = (f.webkitRelativePath || f.name).split('/').filter(Boolean)
    // Il primo pezzo è la cartella scelta: la radice la rappresenta già.
    const dentro = f.webkitRelativePath ? parti.slice(1) : parti
    let n = radice
    if (f.webkitRelativePath && parti.length) radice.nome = parti[0]!
    for (const d of dentro.slice(0, -1)) {
      if (!n.cartelle.has(d)) n.cartelle.set(d, { nome: d, cartelle: new Map(), file: [] })
      n = n.cartelle.get(d)!
    }
    n.file.push(f)
  }
  const come = (n: Nodo): VoceCartella => ({
    kind: 'directory',
    name: n.nome,
    async* values() {
      for (const c of Array.from(n.cartelle.values())) yield come(c)
      for (const f of n.file) yield { kind: 'file', name: f.name, getFile: async () => f as File } as VoceFile
    },
  })
  return come(radice)
}

/** Quello che l'agente sta facendo, per mostrarlo mentre lavora. Resta nel browser: non va mai al server. */
export type EventoLavoro =
  | { tipo: 'inizio', nome: string }
  | { tipo: 'cartella', nome: string }
  | { tipo: 'file', nome: string }
  | { tipo: 'salto', nome: string }
  | { tipo: 'trovato', nome: string }
  | { tipo: 'apro', nome: string }
  | { tipo: 'ocr', nome: string }
  | { tipo: 'archivio', nome: string, voci: number }
  | { tipo: 'letto', nome: string, descrizione: string, motivi?: string[] }
  | { tipo: 'scartato', nome: string, motivo: string }
  | { tipo: 'fine', guardati: number, trovati: number }

export interface EsitoScansione { visitati: number, interrotta: boolean, trovati: number, scartati: number, esclusi: number, letti: number }

/** I lettori del contenuto, dati da fuori: pdf.js e il riconoscimento del testo (OCR) si caricano solo quando servono. */
export interface Lettori {
  /** Testo di un PDF a testo; se manca, lettura minima senza librerie. */
  testoPdf?: (dati: Uint8Array) => Promise<string>
  /** Testo letto da un'immagine (foto, scansione): OCR locale. */
  ocrImmagine?: (dati: Uint8Array, nome: string) => Promise<string>
  /** Testo letto dalle prime pagine di un PDF che è una scansione (senza testo). */
  ocrPdf?: (dati: Uint8Array) => Promise<string>
  /** Testo di un foglio Excel o ODS (per esempio con la libreria xlsx già nel progetto); i CSV si leggono da soli. */
  testoFoglio?: (dati: Uint8Array, nome: string) => Promise<string>
  /** Libera ciò che i lettori hanno caricato (il lavoratore dell'OCR): si chiama a ricerca finita. */
  chiudi?: () => Promise<void>
}

const basename = (n: string): string => n.slice(n.lastIndexOf('/') + 1)

/** Dove guardare quando in una cartella non si trova niente. */
export const POSTI_DOVE_CERCARE: { chiave: 'downloads' | 'documents' | 'desktop', etichetta: string }[] = [
  { chiave: 'downloads', etichetta: 'Download' },
  { chiave: 'documents', etichetta: 'Documenti' },
  { chiave: 'desktop', etichetta: 'Scrivania' },
]
export const SUGGERIMENTO_ALTRI_POSTI = 'Prova anche la cartella del consulente o del RSPP, quella degli allegati della posta o una chiavetta USB.'

interface Candidato {
  voce: VoceFile
  nome: string
  percorso: string
  ext: string
  nomePunti: number
  nomeTipo: TipoCercato | null
  priorita: number
}

interface Base { percorso: string, nome: string, byte: number, modificato: number, nomePunti: number, nomeTipo: TipoCercato | null }

export interface OpzioniScansione {
  limiti?: Limiti
  fermo?: () => boolean
  lettori?: Lettori
  suEvento?: (e: EventoLavoro) => void
  adesso?: () => number
  oggi?: () => number
}

/**
 * Scorre la cartella in profondità (sottocartelle, archivi .zip, firmati .p7m), poi apre i file nell'ordine in cui è
 * più probabile trovare il documento e ne legge il CONTENUTO, in locale: il nome del file conta quasi nulla. Il testo
 * si incrocia con i dati dell'azienda; un documento di un'altra azienda si scarta, un dato sanitario si esclude.
 * `trovato` riceve ogni candidato con la spiegazione (anche gli esclusi, con il motivo). Tutto entro i limiti di
 * file e di tempo; `fermo()` interrompe.
 */
export async function scansiona(
  radice: VoceCartella,
  r: Pick<RichiestaRicerca, 'tipi' | 'parole_chiave' | 'servono'> & { impresa?: Impresa | null },
  trovato: (t: Trovato, voce: VoceFile) => void,
  opzioni: OpzioniScansione = {},
): Promise<EsitoScansione> {
  const limiti = opzioni.limiti ?? LIMITI_RICERCA
  const lettori = opzioni.lettori ?? {}
  const testoPdf = lettori.testoPdf ?? (async (d: Uint8Array) => testoDaPdf(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) as ArrayBuffer))
  const dillo = opzioni.suEvento ?? (() => {})
  const adesso = opzioni.adesso ?? Date.now
  const inizio = adesso()
  const finito = (): boolean => adesso() - inizio > limiti.tempoMs
  const impresa = r.impresa ?? null
  const oggi = dataLocale(opzioni.oggi?.() ?? Date.now())
  const fogliLeggibili = (ext: string): boolean => ext === 'csv' || (FOGLI.indexOf(ext) >= 0 && !!lettori.testoFoglio)
  const leggibileExt = (ext: string): boolean => LEGGIBILI.indexOf(ext) >= 0 || fogliLeggibili(ext)

  // Fase 1: l'elenco dei file, in ampiezza.
  const coda: { cartella: VoceCartella, percorso: string, livello: number }[] = [{ cartella: radice, percorso: '', livello: 0 }]
  const candidati: Candidato[] = []
  let visitati = 0
  let interrotta = false
  while (coda.length && !interrotta) {
    const { cartella, percorso, livello } = coda.shift()!
    if (livello > 0) dillo({ tipo: 'cartella', nome: percorso.slice(0, -1) })
    try {
      for await (const voce of cartella.values()) {
        if (opzioni.fermo?.()) return { visitati, interrotta: true, trovati: 0, scartati: 0, esclusi: 0, letti: 0 }
        if (voce.kind === 'directory') {
          if (cartellaDaIgnorare(voce.name)) dillo({ tipo: 'salto', nome: percorso + voce.name })
          else if (livello + 1 <= limiti.profondita) coda.push({ cartella: voce, percorso: percorso + voce.name + '/', livello: livello + 1 })
          continue
        }
        if (++visitati > limiti.fileVisitati) { visitati--; interrotta = true; break }
        // Cartelle grandi: ogni tanto si lascia respirare il browser, così non si blocca.
        if (visitati % 150 === 0) await new Promise(ok => setTimeout(ok, 0))
        dillo({ tipo: 'file', nome: voce.name })
        if (fileDaIgnorare(voce.name)) continue
        const ext = estensioneFile(voce.name)
        const v = valutaFile(voce.name, r)
        // Priorità di lettura: i documenti prima delle immagini (l'OCR costa), il nome solo come indizio.
        const priorita = (leggibileExt(ext) || ARCHIVI.indexOf(ext) >= 0 ? 100 : IMMAGINI.indexOf(ext) >= 0 ? 50 : 0) + Math.min(v.punteggio, 20)
        candidati.push({ voce, nome: voce.name, percorso: percorso + voce.name, ext, nomePunti: v.punteggio, nomeTipo: v.tipo, priorita })
      }
    }
    catch {
      // Una cartella non leggibile (permessi, file in uso) non ferma la ricerca.
    }
  }

  // Fase 2: si aprono i file, i più promettenti per primi.
  const ordinati = candidati.slice().sort((a, b) => b.priorita - a.priorita)
  let trovati = 0
  let scartati = 0
  let esclusi = 0
  let letti = 0
  let ocrUsati = 0
  let fermata = false

  // Tipi già trovati con certezza: quando ci sono tutti, la ricerca si ferma subito invece di aprire il resto della
  // cartella. Per i tipi multipli serve l'elenco `servono` (ruoli, verifiche): senza, si guarda tutto.
  const cercati = r.tipi.filter(t => t !== 'altro')
  const sicuri = new Set<TipoCercato>()
  const chiaviTrovate = new Map<TipoCercato, Set<string>>()
  const completo = (t: TipoCercato): boolean => {
    if (TIPI_MULTIPLI.indexOf(t) < 0) return sicuri.has(t)
    const servono = r.servono?.[t] ?? []
    const viste = chiaviTrovate.get(t)
    return servono.length > 0 && !!viste && servono.every(k => viste.has(k))
  }
  const tuttiTrovati = (): boolean => cercati.length > 0 ? cercati.every(completo) : sicuri.size > 0
  // Lo stesso contenuto in due posti (una copia, un allegato salvato due volte) si mostra una volta sola.
  const impronte = new Map<string, string>()
  const emetti = (c: Base, testo: string | null, voce: VoceFile): boolean => {
    let punteggio = 0
    let tipo: TipoCercato | null = null
    let motivi: string[] = []
    let descrizione: string | undefined
    let esame: { verdetto: Verdetto, verificato: string[], problema: string | null, data: string | null, chiave: string | null } = { verdetto: 'da_controllare', verificato: [], problema: null, data: null, chiave: null }
    if (testo !== null && testo.trim().length > 0) {
      const x = riconosci(testo, r.tipi, impresa)
      if (x.sanitario) {
        // Dato sanitario: si dice che c'era e perché non si carica, ma non si conserva nulla e non si spunta mai.
        esclusi++
        dillo({ tipo: 'scartato', nome: c.nome, motivo: MOTIVO_SANITARIO })
        trovato({ percorso: c.percorso, nome: c.nome, byte: c.byte, modificato: c.modificato, punteggio: 0, tipo: null, motivi: [MOTIVO_SANITARIO], verdetto: 'escluso', verificato: [], problema: MOTIVO_SANITARIO, data: null, chiave: null }, voce)
        return false
      }
      if (x.altraAzienda) {
        scartati++
        dillo({ tipo: 'scartato', nome: c.nome, motivo: x.motivi[0] ?? 'è di un\'altra azienda' })
        return false
      }
      if (x.tipo) {
        const impronta = improntaTesto(testo)
        const gia = impronte.get(impronta)
        if (gia) {
          dillo({ tipo: 'scartato', nome: c.nome, motivo: `è una copia identica di ${gia}` })
          return false
        }
        impronte.set(impronta, c.percorso)
        // Il nome conta quasi nulla: al massimo due punti, solo come conferma.
        punteggio = x.punteggio + Math.min(c.nomePunti, 10) / 5
        tipo = x.tipo
        const v = verifica(testo, x.tipo, impresa, oggi)
        esame = v
        if (v.verdetto === 'giusto') {
          if (TIPI_MULTIPLI.indexOf(x.tipo) >= 0) {
            if (v.chiave) {
              const s = chiaviTrovate.get(x.tipo) ?? new Set<string>()
              s.add(v.chiave)
              chiaviTrovate.set(x.tipo, s)
            }
          }
          // Ci si ferma solo se non può esisterne uno più aggiornato: un DVR vecchio non chiude la ricerca.
          else if (piuAggiornatoPossibile(x.tipo, v.data, oggi)) sicuri.add(x.tipo)
          motivi = v.verificato.slice()
        }
        else {
          // Da controllare: resta nell'elenco, sotto i giusti e senza spunta, con il motivo in chiaro.
          punteggio = Math.min(punteggio, 9)
          motivi = [v.problema!].concat(v.verificato)
        }
        descrizione = descrivi(testo, x.tipo)
      }
      else if (c.nomePunti > 0) {
        // Il nome promette ma dentro non lo riconosco: resta in fondo, con la spiegazione.
        punteggio = Math.min(c.nomePunti, 4)
        tipo = c.nomeTipo
        esame.problema = 'dal nome sembra giusto, ma dentro non trovo le diciture che mi aspetto'
        motivi = [esame.problema]
      }
    }
    else if (c.nomePunti > 0) {
      punteggio = Math.min(c.nomePunti, 9)
      tipo = c.nomeTipo
      esame.problema = 'non sono riuscito a leggere il contenuto: lo dice solo il nome del file'
      motivi = [esame.problema]
    }
    if (punteggio <= 0) return false
    if (esame.verdetto === 'giusto') dillo({ tipo: 'trovato', nome: c.nome })
    if (descrizione) dillo({ tipo: 'letto', nome: c.nome, descrizione, motivi })
    trovato({ percorso: c.percorso, nome: c.nome, byte: c.byte, modificato: c.modificato, punteggio, tipo, motivi, ...(descrizione ? { descrizione } : {}), verdetto: esame.verdetto, verificato: esame.verificato, problema: esame.problema, data: esame.data, chiave: esame.chiave }, voce)
    trovati++
    return trovati >= limiti.risultati
  }

  // L'OCR costa secondi: nel primo giro non si usa, le scansioni e le foto si mettono da parte e si leggono
  // solo se con i documenti a testo non ho già trovato tutto.
  let conOcr = false
  const rimandati: { dati: Uint8Array, ext: string, nome: string, base: Base, voce: VoceFile }[] = []
  const DA_OCR = '\u0000ocr'
  /** Il testo di un file, secondo il tipo: PDF a testo, scansione (OCR), immagine (OCR), Word, testo, foglio, busta firmata. */
  const leggiTesto = async (dati: Uint8Array, ext: string, nome: string): Promise<string | null> => {
    if (ext === 'p7m') {
      const dentro = contenutoP7m(dati)
      if (!dentro) return null
      return dentro.tipo === 'pdf' ? leggiTesto(dentro.dati, 'pdf', nome) : new TextDecoder().decode(dentro.dati)
    }
    if (ext === 'pdf') {
      let t = await testoPdf(dati).catch((e: unknown) => { if (typeof console !== 'undefined') console.warn('Lettura PDF non riuscita:', nome, e instanceof Error ? e.message : String(e)); return '' })
      if (t.trim().length < 40 && !conOcr && lettori.ocrPdf) return DA_OCR
      if (t.trim().length < 40 && lettori.ocrPdf && ocrUsati < limiti.scansioniOcr) {
        ocrUsati++
        dillo({ tipo: 'ocr', nome })
        t = await lettori.ocrPdf(dati).catch((e: unknown) => { if (typeof console !== 'undefined') console.warn('OCR del PDF non riuscito:', nome, e instanceof Error ? e.message : String(e)); return '' })
      }
      return t
    }
    if (IMMAGINI.indexOf(ext) >= 0) {
      if (!lettori.ocrImmagine || ocrUsati >= limiti.scansioniOcr) return null
      if (!conOcr) return DA_OCR
      ocrUsati++
      dillo({ tipo: 'ocr', nome })
      return lettori.ocrImmagine(dati, nome).catch(() => null)
    }
    if (ext === 'docx') return testoDaDocx(dati).catch(() => null)
    if (ext === 'txt' || ext === 'csv') return new TextDecoder().decode(dati.subarray(0, 200000))
    if (FOGLI.indexOf(ext) >= 0 && lettori.testoFoglio) return lettori.testoFoglio(dati, nome).catch(() => null)
    return null
  }

  /** Dentro un archivio .zip, anche uno zip dentro l'altro (un livello): vero se si è raggiunto il limite dei risultati. */
  const apriArchivio = async (dati: Uint8Array, percorso: string, modificato: number, livello: number): Promise<boolean> => {
    const voci = vociZip(dati).filter(v => !fileDaIgnorare(basename(v.nome)) && v.byte > 0 && v.byte <= limiti.byteMassimi)
    dillo({ tipo: 'archivio', nome: basename(percorso), voci: voci.length })
    let dentro = 0
    for (const v of voci) {
      if (dentro >= limiti.letturePerArchivio || letti >= limiti.lettureContenuto || finito() || opzioni.fermo?.()) break
      const nomeFile = basename(v.nome)
      const ext = estensioneFile(nomeFile)
      if (ARCHIVI.indexOf(ext) >= 0) {
        if (livello >= 1) continue
        const interno = await v.leggi().catch(() => null)
        if (interno && await apriArchivio(interno, `${percorso} › ${v.nome}`, modificato, livello + 1)) return true
        continue
      }
      if (!leggibileExt(ext) && IMMAGINI.indexOf(ext) < 0) continue
      dentro++
      letti++
      const bytes = await v.leggi().catch(() => null)
      if (!bytes) continue
      dillo({ tipo: 'apro', nome: `${basename(percorso)} › ${nomeFile}` })
      const letto = await leggiTesto(bytes, ext, nomeFile)
      const nvp = valutaFile(nomeFile, r)
      const file = (): File => new File([bytes as BlobPart], nomeFile, { lastModified: modificato })
      const finta: VoceFile = { kind: 'file', name: nomeFile, getFile: async () => file() }
      const baseZip: Base = { percorso: `${percorso} › ${v.nome}`, nome: nomeFile, byte: bytes.byteLength, modificato, nomePunti: nvp.punteggio, nomeTipo: nvp.tipo }
      if (letto === DA_OCR) { rimandati.push({ dati: bytes, ext, nome: nomeFile, base: baseZip, voce: finta }); continue }
      if (emetti(baseZip, letto, finta)) return true
    }
    return false
  }

  for (const c of ordinati) {
    if (fermata || opzioni.fermo?.()) { fermata = true; break }
    // Trovato tutto con certezza: si guardano solo i file che dal nome potrebbero essere un'alternativa più recente.
    if (tuttiTrovati() && c.nomePunti <= 0) continue
    if (finito()) { interrotta = true; break }
    const leggibile = leggibileExt(c.ext) || IMMAGINI.indexOf(c.ext) >= 0 || ARCHIVI.indexOf(c.ext) >= 0
    let meta: File | { size: number, lastModified: number }
    try {
      meta = await c.voce.getFile()
    }
    catch {
      continue
    }
    if (meta.size === 0 || meta.size > limiti.byteMassimi) continue
    const base: Base = { percorso: c.percorso, nome: c.nome, byte: meta.size, modificato: meta.lastModified, nomePunti: c.nomePunti, nomeTipo: c.nomeTipo }
    const apribile = leggibile && letti < limiti.lettureContenuto && typeof (meta as File).arrayBuffer === 'function'
    if (!apribile) {
      if (c.nomePunti > 0 && ARCHIVI.indexOf(c.ext) < 0 && emetti(base, null, c.voce)) { interrotta = true; break }
      continue
    }
    letti++
    dillo({ tipo: 'apro', nome: c.nome })
    let dati: Uint8Array
    try {
      dati = new Uint8Array(await (meta as File).arrayBuffer())
    }
    catch {
      continue
    }
    try {
      if (ARCHIVI.indexOf(c.ext) >= 0) {
        if (await apriArchivio(dati, c.percorso, meta.lastModified, 0)) { interrotta = true; break }
        continue
      }
      const letto = await leggiTesto(dati, c.ext, c.nome)
      if (letto === DA_OCR) { rimandati.push({ dati, ext: c.ext, nome: c.nome, base, voce: c.voce }); continue }
      if (emetti(base, letto, c.voce)) { interrotta = true; break }
    }
    catch {
      // File illeggibile o protetto: resta il giudizio sul nome.
      if (c.nomePunti > 0 && emetti(base, null, c.voce)) { interrotta = true; break }
    }
  }
  // Secondo giro, solo se manca ancora qualcosa: scansioni e foto con l'OCR, prima quelle col nome più promettente.
  if (!tuttiTrovati() && !fermata && !interrotta && !opzioni.fermo?.()) {
    conOcr = true
    rimandati.sort((a, b) => b.base.nomePunti - a.base.nomePunti || b.base.modificato - a.base.modificato)
    for (const x of rimandati) {
      if (tuttiTrovati() || ocrUsati >= limiti.scansioniOcr || finito() || opzioni.fermo?.()) break
      try {
        const t = await leggiTesto(x.dati, x.ext, x.nome)
        if (t !== DA_OCR && emetti(x.base, t, x.voce)) break
      }
      catch {
        if (x.base.nomePunti > 0) emetti(x.base, null, x.voce)
      }
    }
  }
  await lettori.chiudi?.().catch(() => {})
  dillo({ tipo: 'fine', guardati: visitati, trovati })
  return { visitati, interrotta: interrotta || fermata, trovati, scartati, esclusi, letti }
}

/** Il risultato completo di una ricerca, per l'interfaccia: tutti i candidati, le proposte già spuntate, l'esito. */
export interface RisultatoRicerca {
  trovati: Trovato[]
  /** Le voci per ciascun file trovato, nello stesso ordine di `trovati`: servono per caricare il file scelto. */
  voci: VoceFile[]
  proposte: Proposta[]
  esito: EsitoScansione
}

/** Cerca in una cartella (showDirectoryPicker o {@link cartellaDaFile}) e restituisce candidati e proposte. */
export async function cercaInCartella(radice: VoceCartella, r: RichiestaRicerca, opzioni: OpzioniScansione = {}): Promise<RisultatoRicerca> {
  const trovati: Trovato[] = []
  const voci: VoceFile[] = []
  const esito = await scansiona(radice, r, (t, v) => { trovati.push(t); voci.push(v) }, opzioni)
  return { trovati, voci, proposte: proposti(trovati, r.tipi), esito }
}

/**
 * Il telefono non apre una cartella intera: la persona sceglie i file a mano e qui si valutano con le stesse regole,
 * contenuto letto in locale, verdetto e motivo per ciascuno.
 */
export function valutaFileScelti(files: File[], r: RichiestaRicerca, opzioni: OpzioniScansione = {}): Promise<RisultatoRicerca> {
  // I file scelti a mano si leggono tutti: niente fermata anticipata e limiti di risultati alti quanto la scelta.
  const limiti = { ...(opzioni.limiti ?? LIMITI_RICERCA) }
  limiti.risultati = Math.max(limiti.risultati, files.length)
  const piatti = files.map(f => ({ name: f.name, getFile: async () => f }))
  const radice: VoceCartella = {
    kind: 'directory',
    name: '',
    async* values() {
      for (const f of piatti) yield { kind: 'file', name: f.name, getFile: f.getFile } as VoceFile
    },
  }
  return cercaInCartella(radice, { ...r, servono: undefined, tipi: r.tipi.length ? r.tipi : TIPI_CERCATI.filter(t => t !== 'altro') }, { ...opzioni, limiti })
}

/**
 * Un documento giusto chiude la ricerca del suo tipo solo se è il più aggiornato che possa esistere: per il DVR, uno
 * datato nell'ultimo anno (un DVR più vecchio potrebbe avere una revisione più recente nella stessa cartella).
 * Per gli altri tipi basta che sia valido: uno più recente non lo renderebbe più giusto.
 */
export function piuAggiornatoPossibile(tipo: TipoCercato, data: string | null | undefined, oggi: string): boolean {
  if (tipo !== 'dvr') return true
  return !!data && data >= spostaMesi(oggi, -12)
}

/** La data di oggi sul computer della persona, AAAA-MM-GG (non in UTC: a mezzanotte cambia il giorno giusto). */
export function dataLocale(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Impronta breve del contenuto (FNV-1a sul testo normalizzato): due copie dello stesso documento hanno la stessa. */
export function improntaTesto(testo: string): string {
  let h = 0x811C9DC5
  const n = normalizza(testo.slice(0, 60000))
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

export interface Proposta { tipo: TipoCercato, chiave: string | null, trovato: Trovato, nota: string | null }

/**
 * I file da spuntare per il caricamento: per ciascun tipo (e per ciascuna chiave dei tipi multipli: una nomina per
 * ruolo, un attestato per persona e corso), solo fra quelli con verdetto «giusto», il più recente (la data letta nel
 * documento, poi la data del file). Se ce n'era più di uno lo dice. Un file «da controllare» o «escluso» non si
 * propone mai: il primo lo spunta la persona, se vuole, dopo averne letto il motivo; il secondo mai.
 */
export function proposti(trovati: Trovato[], tipi: TipoCercato[] = []): Proposta[] {
  const fuori: Proposta[] = []
  const presenti = trovati.map(t => t.tipo).filter((t): t is TipoCercato => !!t)
  const elenco = tipi.length ? tipi : presenti.filter((t, i) => presenti.indexOf(t) === i)
  for (const tipo of elenco) {
    const giusti = trovati.filter(t => t.tipo === tipo && t.verdetto === 'giusto')
    const chiavi = giusti.map(t => t.chiave ?? null).filter((k, i, a) => a.indexOf(k) === i)
    for (const chiave of chiavi) {
      const gruppo = giusti.filter(t => (t.chiave ?? null) === chiave)
        .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || b.modificato - a.modificato)
      const primo = gruppo[0]
      if (!primo) continue
      const altri = gruppo.length - 1
      const quando = primo.data ? `con la data del ${dataInChiaro(primo.data)}` : `salvato il ${new Date(primo.modificato).toLocaleDateString('it-IT')}`
      fuori.push({ tipo, chiave, trovato: primo, nota: altri > 0 ? `${altri === 1 ? 'c\'era un altro file valido' : `c'erano altri ${altri} file validi`}: scelgo il più recente, ${quando}` : null })
    }
  }
  return fuori
}

/**
 * Le righe del messaggio che porta a Falco i file caricati: il riferimento al documento e che cosa si è verificato sul
 * computer, così Falco lo dice alla persona. Un file da controllare, caricato perché l'ha spuntato lei, porta il motivo.
 */
export function righeVerificate(documenti: { id: string | number, nome: string, etichetta: string }[], righe: { verdetto?: Verdetto, verificato?: string[], problema?: string | null, scelta?: string | null }[]): string[] {
  return documenti.map((d, i) => {
    const r = righe[i]
    const base = `«${d.nome}» [documento ${d.id}, riconosciuto come: ${d.etichetta}]`
    if (r?.verdetto === 'giusto' && r.verificato?.length) return `${base} Verificato sul computer: ${r.verificato.join('; ')}.${r.scelta ? ` ${r.scelta[0]!.toUpperCase()}${r.scelta.slice(1)}.` : ''}`
    if (r?.verdetto === 'da_controllare' && r.problema) return `${base} Da controllare, l'ha scelto la persona: ${r.problema}.`
    if (r?.verdetto === 'escluso') return `${base} Escluso: ${r.problema ?? MOTIVO_SANITARIO}.`
    return `${base} Non verificato sul computer.`
  })
}

export function dimensioneLeggibile(byte: number): string {
  if (byte < 1024) return byte + ' byte'
  if (byte < 1024 * 1024) return Math.round(byte / 1024) + ' kB'
  return (byte / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'
}

/* ---- Il riquadro di lavoro di Falco: racconta la ricerca riga per riga, tutto nel browser ---- */

export interface RigaLavoro { testo: string, tipo: EventoLavoro['tipo'] }
export interface StatoLavoro { righe: RigaLavoro[], guardati: number, finito: boolean }

export function testoLavoro(e: EventoLavoro): string {
  switch (e.tipo) {
    case 'inizio': return `Apro la cartella ${e.nome}`
    case 'cartella': return `Entro in ${e.nome}`
    case 'file': return e.nome
    case 'salto': return `Salto ${e.nome}, è una cartella di sistema`
    case 'trovato': return `Questo mi sembra giusto: ${e.nome}`
    case 'apro': return `Leggo il contenuto di ${e.nome}…`
    case 'ocr': return `${e.nome} è una scansione: la leggo con il riconoscimento del testo`
    case 'archivio': return `${e.nome} è un archivio con ${e.voci} file: guardo dentro`
    case 'letto': return `È ${e.descrizione}${e.motivi?.length ? `: ${e.motivi.join('; ')}` : ''}`
    case 'scartato': return `Scarto ${e.nome}: ${e.motivo}`
    case 'fine': return e.trovati ? `Ho finito: ${e.guardati} file guardati, ${e.trovati === 1 ? 'un candidato' : e.trovati + ' candidati'}` : `Ho finito: ${e.guardati} file guardati, nessun candidato`
  }
}

/**
 * Mette in scena la ricerca: gli eventi arrivano di colpo, la regista li mostra uno dopo l'altro (veloce ma
 * leggibile, al massimo qualche secondo in tutto). Con "meno movimento" mostra solo il risultato.
 * `aggiorna` riceve lo stato da disegnare; `finita()` si risolve quando tutto è stato mostrato.
 */
export function creaRegista(aggiorna: (s: StatoLavoro) => void, opzioni: { menoMovimento?: boolean, passoMs?: number, righeVisibili?: number } = {}) {
  const passo = opzioni.passoMs ?? 55
  const visibili = opzioni.righeVisibili ?? 7
  const stato: StatoLavoro = { righe: [], guardati: 0, finito: false }
  const coda: EventoLavoro[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let chiusa = false
  let sveglia: (() => void) | null = null

  const mostra = (e: EventoLavoro): void => {
    if (e.tipo === 'file') stato.guardati++
    // I file banali scorrono nel contatore; le righe scritte sono quelle che raccontano qualcosa.
    stato.righe = stato.righe.concat([{ testo: testoLavoro(e), tipo: e.tipo }]).slice(-visibili)
    if (e.tipo === 'fine') stato.finito = true
  }
  const giro = (): void => {
    timer = null
    // Più c'è da raccontare, più righe per volta: in tutto non si supera una manciata di secondi.
    const n = Math.max(1, Math.ceil(coda.length / 45))
    for (let i = 0; i < n && coda.length; i++) mostra(coda.shift()!)
    aggiorna({ ...stato, righe: stato.righe.slice() })
    if (coda.length) timer = setTimeout(giro, passo)
    else if (chiusa) sveglia?.()
  }
  return {
    evento(e: EventoLavoro): void {
      if (opzioni.menoMovimento) {
        if (e.tipo === 'file') stato.guardati++
        if (e.tipo === 'inizio' || e.tipo === 'trovato' || e.tipo === 'letto' || e.tipo === 'scartato' || e.tipo === 'salto' || e.tipo === 'fine') mostra(e)
        return
      }
      coda.push(e)
      if (!timer) timer = setTimeout(giro, 0)
    },
    /** Si risolve quando l'ultima riga è stata mostrata. */
    finita(): Promise<void> {
      chiusa = true
      return new Promise((ok) => {
        sveglia = ok
        if (opzioni.menoMovimento) {
          aggiorna({ ...stato, righe: stato.righe.slice() })
          ok()
        }
        else if (!coda.length && !timer) ok()
      })
    },
    ferma(): void {
      if (timer) clearTimeout(timer)
      timer = null
      coda.length = 0
      sveglia?.()
    },
    stato: () => stato,
  }
}

/* ---- Che cosa può fare questo browser: la verità, per dirla alla persona ---- */

export interface CapacitaBrowser {
  nome: string
  sistema: string
  /** picker: showDirectoryPicker; cartella: input webkitdirectory; file: solo scelta di file. */
  modo: 'picker' | 'cartella' | 'file'
  frase: string
}

/** Dal user agent e da quello che il browser sa fare: nome, sistema e modo di scegliere i documenti. */
export function capacitaBrowser(i: { ua: string, picker: boolean, cartella: boolean, puntatoreFine: boolean }): CapacitaBrowser {
  const ua = i.ua
  const nome = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Questo browser'
  const sistema = /iPhone|iPad|iPod/.test(ua) ? 'iPhone o iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : 'questo dispositivo'
  const telefono = sistema === 'Android' || sistema === 'iPhone o iPad' || !i.puntatoreFine
  if (i.picker && !telefono) return { nome, sistema, modo: 'picker', frase: '' }
  if (telefono) return { nome, sistema, modo: 'file', frase: `Da ${sistema === 'iPhone o iPad' ? 'iPhone' : 'telefono'} non si apre una cartella intera: scegli i file che vuoi caricare, li vedi qui prima di confermare.` }
  if (i.cartella) return { nome, sistema, modo: 'cartella', frase: `${nome} su ${sistema} non lascia a Falco di aprire una cartella da solo né di ricordarla: scegli la cartella dal selettore del browser e la guardo da lì, ogni volta. Funziona uguale, ma devi sceglierla di nuovo la prossima volta.` }
  return { nome, sistema, modo: 'file', frase: `${nome} su ${sistema} non permette di scegliere una cartella intera: scegli i file che vuoi caricare, li vedi qui prima di confermare.` }
}
