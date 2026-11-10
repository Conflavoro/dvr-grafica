/**
 * Riconoscere un documento della sicurezza sul lavoro dal CONTENUTO, come farebbe un tecnico HSE esperto: il nome del
 * file conta quasi nulla, contano le diciture tipiche del tipo (per una visura «Camera di Commercio», «Registro
 * Imprese», «REA»; per una SDS le sedici sezioni del Regolamento REACH) incrociate con i dati dell'azienda che Falco già
 * conosce (codice fiscale, partita IVA, denominazione, lavoratori). Un documento che porta i dati di un'altra azienda si
 * scarta; i dati sanitari (giudizi di idoneità, cartelle sanitarie e di rischio, certificati medici, esiti di esami) si
 * escludono sempre: li conserva il medico competente. Ogni scelta ha la sua spiegazione.
 * Logica pura, senza browser né rete: gira in locale, sul testo già letto, e non conserva nulla.
 * Portata dalla ricerca collaudata di FondoFormazione (riconosci-documento.ts), con i tipi HSE.
 */

export type TipoCercato =
  | 'visura'
  | 'nomina'
  | 'attestato_formazione'
  | 'verbale_verifica'
  | 'sds'
  | 'dvr'
  | 'libretto_attrezzatura'
  | 'elenco_lavoratori'
  | 'planimetria'
  | 'piano_emergenza'
  | 'altro'

export const TIPI_CERCATI: TipoCercato[] = ['visura', 'nomina', 'attestato_formazione', 'verbale_verifica', 'sds', 'dvr', 'libretto_attrezzatura', 'elenco_lavoratori', 'planimetria', 'piano_emergenza', 'altro']

/** Un lavoratore noto dell'azienda: serve a riconoscere i suoi attestati e l'elenco del personale. */
export interface Lavoratore {
  nome: string
  cognome: string
  codice_fiscale?: string | null
}

/** Ciò che Falco sa dell'azienda per cui si cerca il documento. Tutti facoltativi. */
export interface Impresa {
  codice_fiscale?: string | null
  partita_iva?: string | null
  denominazione?: string | null
  legale_rappresentante?: string | null
  /** Facoltativo: i lavoratori noti, per gli attestati di formazione e l'elenco del personale. */
  lavoratori?: Lavoratore[] | null
}

/** Etichette leggibili, per l'interfaccia e le frasi di Falco. */
export const ETICHETTE_TIPO: Record<TipoCercato, string> = {
  visura: 'Visura camerale',
  nomina: 'Nomina',
  attestato_formazione: 'Attestato di formazione',
  verbale_verifica: 'Verbale di verifica',
  sds: 'Scheda di dati di sicurezza',
  dvr: 'DVR precedente',
  libretto_attrezzatura: 'Libretto o dichiarazione CE',
  elenco_lavoratori: 'Elenco dei lavoratori',
  planimetria: 'Planimetria',
  piano_emergenza: 'Piano di emergenza',
  altro: 'Altro documento',
}

/**
 * Tipi di cui possono esistere più documenti giusti insieme (una nomina per ruolo, un attestato per persona e corso,
 * una SDS per prodotto): si propone il più recente per ciascuna `chiave`, e la ricerca non si ferma al primo.
 */
export const TIPI_MULTIPLI: TipoCercato[] = ['nomina', 'attestato_formazione', 'verbale_verifica', 'sds', 'libretto_attrezzatura', 'planimetria']

export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.,;:()[\]{}+'’"«»/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** [frase già normalizzata, peso]. Le diciture più specifiche pesano di più. */
export const INDIZI_PER_TIPO: Record<TipoCercato, [string, number][]> = {
  visura: [['visura ordinaria', 10], ['visura storica', 10], ['visura camerale', 10], ['camera di commercio', 8], ['registro delle imprese', 8], ['registro imprese', 8], ['cciaa', 6], ['numero rea', 8], ['rea', 3], ['codice ateco', 4], ['attivita prevalente', 4], ['forma giuridica', 3], ['data iscrizione', 3], ['capitale sociale', 3], ['oggetto sociale', 3], ['sede legale', 2]],
  nomina: [['lettera di nomina', 10], ['atto di nomina', 10], ['nomina del responsabile del servizio di prevenzione e protezione', 14], ['nomina rspp', 10], ['nomina del medico competente', 12], ['incarico di medico competente', 10], ['verbale di elezione', 10], ['designazione', 6], ['designa', 4], ['conferisce l incarico', 8], ['per accettazione', 8], ['nomina', 4], ['responsabile del servizio di prevenzione e protezione', 6], ['medico competente', 3], ['rappresentante dei lavoratori per la sicurezza', 6], ['rspp', 3], ['aspp', 3], ['rls', 2], ['rlst', 3], ['preposto', 3], ['addetti', 2], ['datore di lavoro', 2]],
  attestato_formazione: [['attestato di frequenza', 10], ['attestato di formazione', 10], ['attestato di partecipazione', 8], ['attestato di frequenza con verifica dell apprendimento', 6], ['si attesta che', 6], ['ha frequentato', 6], ['ha partecipato', 4], ['verifica dell apprendimento', 6], ['superamento della verifica', 6], ['accordo stato regioni', 6], ['soggetto formatore', 6], ['ente formatore', 5], ['corso di formazione', 5], ['formazione generale', 4], ['formazione specifica', 4], ['durata del corso', 4], ['ore', 1], ['docente', 2], ['aggiornamento', 2]],
  verbale_verifica: [['verbale di verifica', 10], ['verifica periodica', 10], ['dpr 462', 12], ['impianto di messa a terra', 8], ['impianti di messa a terra', 8], ['scariche atmosferiche', 6], ['organismo abilitato', 8], ['organismo di ispezione', 6], ['esito della verifica', 8], ['prossima verifica', 8], ['tecnico verificatore', 8], ['verificatore', 4], ['controllo periodico', 6], ['uni 9994', 10], ['estintori', 5], ['apparecchi di sollevamento', 8], ['ascensore', 5], ['dpr 162', 8], ['allegato vii', 6], ['matricola', 3], ['esito positivo', 4], ['esito negativo', 4]],
  sds: [['scheda di dati di sicurezza', 14], ['scheda dati di sicurezza', 12], ['safety data sheet', 10], ['1907 2006', 8], ['2020 878', 6], ['1272 2008', 5], ['reach', 4], ['identificazione della sostanza o della miscela', 8], ['identificazione dei pericoli', 5], ['misure di primo soccorso', 4], ['informazioni tossicologiche', 5], ['informazioni ecologiche', 5], ['considerazioni sullo smaltimento', 5], ['indicazioni di pericolo', 4], ['consigli di prudenza', 4], ['numero cas', 3]],
  dvr: [['documento di valutazione dei rischi', 14], ['documento di valutazione del rischio', 12], ['valutazione dei rischi', 6], ['dvr', 5], ['art 28', 5], ['art 29', 4], ['matrice dei rischi', 6], ['magnitudo', 4], ['probabilita', 2], ['gravita', 2], ['misure di prevenzione e protezione', 6], ['programma delle misure', 6], ['piano di miglioramento', 4], ['gruppi omogenei', 4], ['data certa', 6], ['mansioni', 2]],
  libretto_attrezzatura: [['manuale d uso e manutenzione', 12], ['libretto di uso e manutenzione', 12], ['libretto d uso', 8], ['manuale di istruzioni', 8], ['istruzioni per l uso', 8], ['istruzioni originali', 8], ['dichiarazione ce di conformita', 14], ['dichiarazione di conformita ce', 12], ['dichiarazione di conformita', 6], ['direttiva macchine', 8], ['2006 42 ce', 10], ['2023 1230', 8], ['marcatura ce', 6], ['fabbricante', 4], ['costruttore', 4], ['numero di serie', 5], ['anno di costruzione', 5]],
  elenco_lavoratori: [['libro unico del lavoro', 14], ['elenco dei lavoratori', 10], ['elenco del personale', 10], ['elenco dipendenti', 10], ['elenco lavoratori', 10], ['data assunzione', 6], ['data di assunzione', 6], ['mansione', 3], ['qualifica', 3], ['matricola', 3], ['codice fiscale', 2], ['cognome', 2], ['nome', 1]],
  planimetria: [['planimetria di emergenza', 12], ['piano di evacuazione', 10], ['voi siete qui', 10], ['planimetria', 8], ['layout', 6], ['vie di fuga', 6], ['via di esodo', 6], ['punto di raccolta', 5], ['uscita di emergenza', 5], ['legenda', 4], ['pianta', 4], ['scala 1', 4], ['idrante', 3], ['estintore', 2]],
  piano_emergenza: [['piano di emergenza ed evacuazione', 14], ['piano di emergenza', 12], ['gestione delle emergenze', 6], ['coordinatore dell emergenza', 8], ['squadra di emergenza', 6], ['procedure di evacuazione', 6], ['segnale di allarme', 5], ['chiamata dei soccorsi', 6], ['numeri utili', 4], ['punto di raccolta', 3], ['terremoto', 3], ['incendio', 2]],
  altro: [],
}

/**
 * Diciture dei dati sanitari (art. 25 e 41 D.Lgs. 81/08): il documento si esclude se queste pesano più di ogni altro tipo
 * e c'è almeno una dicitura forte (peso 8 o più). Le parole che compaiono anche in un DVR o in una nomina del medico
 * competente pesano poco, così quei documenti non si perdono.
 */
export const INDIZI_SANITARI: [string, number][] = [
  ['giudizio di idoneita alla mansione specifica', 10], ['giudizio di idoneita', 6], ['idoneo con prescrizioni', 8], ['idoneo con limitazioni', 8],
  ['temporaneamente non idoneo', 8], ['non idoneo', 4], ['idoneo', 2], ['avverso il giudizio', 10], ['cartella sanitaria e di rischio', 14],
  ['cartella sanitaria', 6], ['anamnesi', 8], ['esame obiettivo', 8], ['certificato medico', 10], ['certificato di malattia', 10], ['prognosi', 8],
  ['diagnosi', 4], ['referto', 8], ['esito degli esami', 8], ['esami ematochimici', 8], ['emocromo', 6], ['audiometria', 5], ['spirometria', 5],
  ['visita medica', 3], ['medico competente', 2],
]

export const MOTIVO_SANITARIO = 'dato sanitario: lo conserva il medico competente, non si carica'

export interface Riconoscimento {
  /** Punti del tipo di documento (diciture trovate). */
  tipoPunti: number
  /** Punti per i dati dell'azienda trovati nel testo. */
  identitaPunti: number
  punteggio: number
  tipo: TipoCercato | null
  /** Spiegazione in italiano, una voce per indizio: «ha il codice fiscale 0123…». */
  motivi: string[]
  /** Il documento porta i dati di un'altra azienda e nessuno dei nostri. */
  altraAzienda: boolean
  altro?: string
  /** La dicitura sanitaria più forte, se il documento è un dato sanitario: si esclude sempre. */
  sanitario: string | null
}

const SIGLE = new Set(['iso', 'ea', 'uni', 'en', 'rea', 'dvr', 'inail', 'inps', 'cciaa', 'rspp', 'aspp', 'rls', 'rlst', 'dpr', 'sds', 'ce', 'reach', 'clp', 'vii', 'ple'])
const SIGLE_SOCIETARIE = new Set(['srl', 'spa', 'snc', 'sas', 'ss', 'srls', 'scarl', 'scrl', 'sapa', 'ltd', 'llc', 'societa', 'cooperativa', 'coop', 'di', 'e', 'dei', 'del', 'la', 'il', 'in', 'liquidazione', 'unipersonale', 'a', 'r', 'l', 's', 'p', 'c', 'n'])

export function paroleDistintive(denominazione: string): string[] {
  return normalizza(denominazione).split(' ').filter(p => p.length >= 3 && !SIGLE_SOCIETARIE.has(p))
}

const soloCifre = (s: string): string => s.replace(/\D/g, '')
const compattaCodice = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, '').toUpperCase()

/** Una frase presente nel testo normalizzato, come parola intera (mai a metà di un'altra). */
export function ha(norm: string, frase: string): boolean {
  return new RegExp(`(^| )${frase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(norm)
}

/** Cerca nel testo i dati dell'azienda: i motivi trovati e i punti. */
export function trovaIdentita(testo: string, impresa: Impresa | null | undefined): { punti: number, motivi: string[], conosciuta: boolean, codice: boolean } {
  const imp = impresa ?? {}
  const cf = compattaCodice(imp.codice_fiscale)
  const piva = soloCifre(imp.partita_iva ?? '')
  const denom = imp.denominazione ?? ''
  const lr = imp.legale_rappresentante ?? ''
  const conosciuta = !!(cf || piva || denom.trim().length >= 4)
  const compatto = testo.toUpperCase().replace(/[\s.]+/g, '')
  const norm = ' ' + normalizza(testo) + ' '
  let punti = 0
  const motivi: string[] = []
  if (cf && compatto.indexOf(cf) >= 0) {
    punti += 14
    motivi.push(`ha il codice fiscale ${cf}`)
  }
  if (piva.length === 11 && compatto.indexOf(piva) >= 0 && !(cf && cf === piva && motivi.length)) {
    punti += 12
    motivi.push(`ha la partita IVA ${piva}`)
  }
  const parole = paroleDistintive(denom)
  if (parole.length && parole.join('').length >= 4 && parole.every(p => norm.indexOf(' ' + p) >= 0)) {
    punti += 10
    motivi.push(`porta il nome «${denom.trim()}»`)
  }
  const nomi = normalizza(lr).split(' ').filter(p => p.length >= 3)
  if (nomi.length >= 2 && nomi.every(p => norm.indexOf(' ' + p + ' ') >= 0)) {
    punti += 6
    motivi.push(`indica il legale rappresentante ${lr.trim()}`)
  }
  return { punti, motivi, conosciuta, codice: motivi.some(m => /codice fiscale|partita IVA/.test(m)) }
}

const RE_CODICE = /\b(codice\s+fiscale|cod\.?\s*fisc\.?|c\.\s?f\.?|partita\s+iva|p\.\s?iva|p\.?iva)(?:\s+e\s+n\.?\s+(?:di\s+)?iscrizione\s+al\s+registro\s+(?:delle\s+)?imprese)?\s*[:.]?\s*(?:IT\s?)?([0-9]{11}|[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z])(?![0-9A-Z])/gi

/** I codici scritti accanto a «codice fiscale» o «partita IVA», nell'ordine del testo. */
export function codiciEtichettati(testo: string): { codice: string, etichetta: 'cf' | 'piva', pos: number }[] {
  return Array.from(testo.matchAll(RE_CODICE)).map(m => ({ codice: m[2]!.toUpperCase(), etichetta: /iva/i.test(m[1]!) ? 'piva' as const : 'cf' as const, pos: m.index! }))
}

/**
 * Dove comincia l'intestatario, per tipo: dopo queste parole il primo codice è dell'azienda. Per il verbale si salta
 * l'intestazione dell'organismo che ha fatto la verifica; per la nomina il codice della persona nominata viene dopo.
 */
const RE_INTESTATARIO: Partial<Record<TipoCercato, RegExp>> = {
  visura: /denominazione|ragione\s+sociale|\bimpresa\s*:|\bditta\b/i,
  nomina: /datore\s+di\s+lavoro|\bditta\b|\bazienda\b|\bsociet[àa]\b|\bimpresa\b|denominazione|ragione\s+sociale/i,
  dvr: /\bazienda\b|ragione\s+sociale|denominazione|\bditta\b|\bimpresa\b|datore\s+di\s+lavoro/i,
  verbale_verifica: /datore\s+di\s+lavoro|\butente\b|committente|propriet|\bcliente\b|\bditta\b|\bazienda\b|ragione\s+sociale|denominazione|\bimpresa\b/i,
  elenco_lavoratori: /datore\s+di\s+lavoro|\bazienda\b|\bditta\b|ragione\s+sociale|denominazione|\bimpresa\b/i,
  planimetria: /\bazienda\b|\bditta\b|committente|ragione\s+sociale|denominazione|\bimpresa\b/i,
  piano_emergenza: /\bazienda\b|\bditta\b|ragione\s+sociale|denominazione|\bimpresa\b|datore\s+di\s+lavoro/i,
}

/** Tipi in cui un codice estraneo nel posto dell'intestatario basta a scartare il documento: sono dell'azienda. */
const TIPI_SCARTABILI: TipoCercato[] = ['visura', 'nomina', 'dvr', 'elenco_lavoratori', 'piano_emergenza']

/** Il codice dell'intestatario dopo l'etichetta del tipo; per la visura (come nell'originale) il primo codice d'impresa. */
function codiceIntestatario(testo: string, tipo: TipoCercato, conFallback: boolean): { codice: string, etichetta: 'cf' | 'piva', pos: number } | null {
  const codici = codiciEtichettati(testo)
  const re = RE_INTESTATARIO[tipo]
  const inizio = re ? (re.exec(testo)?.index ?? -1) : -1
  const dopo = inizio >= 0 ? codici.find(c => c.pos > inizio) : undefined
  return dopo ?? (conFallback ? codici[0] ?? null : null)
}

function punteggiTipo(norm: string, tipo: TipoCercato): { punti: number, frasi: string[] } {
  let punti = 0
  const frasi: string[] = []
  for (const [frase, peso] of INDIZI_PER_TIPO[tipo] ?? []) {
    if (ha(norm, frase)) {
      punti += peso
      if (peso >= 6) frasi.push(frase)
    }
  }
  return { punti, frasi }
}

/** Il documento è un dato sanitario? La dicitura più forte, se le diciture sanitarie superano ogni altro tipo. */
export function datoSanitario(testo: string): string | null {
  const norm = normalizza(testo.slice(0, 120000))
  let punti = 0
  let forte: [string, number] | null = null
  for (const [frase, peso] of INDIZI_SANITARI) {
    if (!ha(norm, frase)) continue
    punti += peso
    if (peso >= 8 && (!forte || peso > forte[1])) forte = [frase, peso]
  }
  if (!forte || punti < 14) return null
  for (const t of TIPI_CERCATI) if (punteggiTipo(norm, t).punti >= punti) return null
  return forte[0]
}

/**
 * Giudica il testo di un documento rispetto ai tipi cercati e all'azienda. La dicitura del tipo è necessaria per
 * proporlo; i dati dell'azienda lo fanno salire (è proprio suo) o lo fanno scartare (è di un'altra azienda).
 */
export function riconosci(testo: string, tipi: TipoCercato[], impresa?: Impresa | null): Riconoscimento {
  const norm = normalizza(testo.slice(0, 120000))
  const cercati = tipi.length ? tipi : TIPI_CERCATI
  const sanitario = datoSanitario(testo)
  let migliore: { tipo: TipoCercato, punti: number, frasi: string[] } = { tipo: cercati[0] ?? 'altro', punti: 0, frasi: [] }
  for (const tipo of cercati) {
    const p = punteggiTipo(norm, tipo)
    if (p.punti > migliore.punti) migliore = { tipo, ...p }
  }
  const id = trovaIdentita(testo, impresa)
  const motivi: string[] = []
  if (migliore.punti > 0) {
    const diciture = migliore.frasi.slice(0, 3).map(f => `«${f.trim().replace(/\w+/g, w => (SIGLE.has(w) || /\d/.test(w) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))}»`)
    if (diciture.length) motivi.push(`ha ${diciture.length > 1 ? 'le diciture' : 'la dicitura'} ${diciture.join(', ')}`)
    else motivi.push('ha diciture tipiche di questo documento')
  }
  motivi.push(...id.motivi)
  const tipoValido = migliore.punti >= 6
  // Dati di un'altra azienda e nessuno dei nostri, nel posto dell'intestatario: non è il documento di questa azienda.
  // Solo per i tipi intestati all'azienda: una SDS è del fornitore, un libretto del costruttore, un attestato di una persona.
  let altra: string | null = null
  // Contano i codici: il solo nome o il legale rappresentante non salvano un documento intestato a un altro codice.
  if (tipoValido && id.conosciuta && !id.codice && TIPI_SCARTABILI.indexOf(migliore.tipo) >= 0) {
    const nostri = [compattaCodice(impresa?.codice_fiscale), soloCifre(impresa?.partita_iva ?? '')].filter(Boolean)
    if (migliore.tipo === 'visura') {
      altra = codiciEtichettati(testo).map(c => c.codice).find(c => /^\d{11}$/.test(c) && nostri.indexOf(c) < 0) ?? null
    }
    else {
      const c = codiceIntestatario(testo, migliore.tipo, false)
      altra = c && /^\d{11}$/.test(c.codice) && nostri.indexOf(c.codice) < 0 ? c.codice : null
    }
  }
  const altraAzienda = altra !== null
  if (altraAzienda) motivi.splice(0, motivi.length, `riguarda un'altra azienda (codice ${altra}), non ${impresa?.denominazione?.trim() || 'questa azienda'}`)
  const punteggio = tipoValido ? migliore.punti + id.punti : 0
  return {
    tipoPunti: migliore.punti, identitaPunti: id.punti, punteggio: altraAzienda ? 0 : punteggio,
    tipo: tipoValido ? migliore.tipo : null, motivi: tipoValido ? motivi : [], altraAzienda,
    ...(altraAzienda && altra ? { altro: altra } : {}),
    sanitario,
  }
}

const NOMI: Record<TipoCercato, string> = {
  visura: 'una visura camerale', nomina: 'una nomina', attestato_formazione: 'un attestato di formazione', verbale_verifica: 'un verbale di verifica',
  sds: 'una scheda di dati di sicurezza', dvr: 'un documento di valutazione dei rischi', libretto_attrezzatura: 'un libretto o una dichiarazione CE',
  elenco_lavoratori: 'un elenco dei lavoratori', planimetria: 'una planimetria', piano_emergenza: 'un piano di emergenza', altro: 'un documento',
}

/** «una visura camerale di Officine Brianza S.r.l.»: il tipo e, se si legge, la ragione sociale. */
export function descrivi(testo: string, tipo: TipoCercato | null): string {
  const base = NOMI[tipo ?? 'altro']
  if (tipo === 'sds' || tipo === 'libretto_attrezzatura') {
    const p = nomeProdotto(testo, tipo)
    return p ? `${base} di ${p}` : base
  }
  if (tipo === 'nomina') {
    const norm = normalizza(testo)
    const atto = /\b(nomina|nomine|designazione|designa|incarico|elezione)\b/.exec(norm)
    const ruolo = atto ? primoFra(norm, RUOLI_NOMINA, atto.index) : null
    if (ruolo) return `la nomina ${ruolo[2]}`
  }
  const m = /(?:denominazione|ragione sociale)\s*:?\s*(.+?)(?=\s+(?:codice fiscale|partita iva|p\.?\s?iva|forma giuridica|sede|numero rea|pec|legale|indirizzo)\b|$)/i.exec(testo.replace(/\s+/g, ' '))
  const nome = m?.[1]?.trim()
  return nome && nome.length >= 3 && nome.length <= 90 ? `${base} di ${nome}` : base
}

/* ---- Verifica prima di proporre: identità, tipo, validità ----
 * Un documento si propone come "giusto" (già spuntato per il caricamento) solo se dal CONTENUTO risultano tre cose:
 * è intestato all'azienda (codice fiscale o partita IVA esatti, non il solo nome; per l'attestato un lavoratore noto;
 * per SDS e libretti il fornitore o il costruttore), è davvero del tipo cercato (le diciture che lo definiscono, e non è
 * una fattura o una ricevuta) ed è valido oggi (la data letta accanto alla sua etichetta). In ogni altro caso resta "da
 * controllare" con il motivo scritto in chiaro, e non parte mai da solo. I dati sanitari sono "esclusi", sempre. */

export type Verdetto = 'giusto' | 'da_controllare' | 'escluso'

export interface Verifica {
  verdetto: Verdetto
  /** Che cosa ho controllato e trovato a posto, una frase per controllo. */
  verificato: string[]
  /** Perché non lo propongo, in chiaro; nullo se è giusto. */
  problema: string | null
  /** Data che dice quanto è recente (estrazione, nomina, rilascio, verifica, revisione), AAAA-MM-GG. */
  data: string | null
  scadenza: string | null
  /**
   * Per i tipi multipli, che cosa distingue un documento dall'altro dello stesso tipo: il ruolo della nomina
   * («rspp»), persona e corso dell'attestato («RSSMRC80A01F205X|preposto»), la verifica («messa_terra»), il prodotto.
   */
  chiave: string | null
}

/** La visura non ha una scadenza scritta: oltre sei mesi la si fa guardare a una persona (prudenza di Falco). */
export const MESI_VISURA = 6
/** Sotto questa soglia la scadenza vicina si segnala, ma il documento resta valido. */
export const GIORNI_AVVISO_SCADENZA = 15
/** Un DVR più vecchio di così si propone ma si dice che va rivisto (art. 29 c. 3 D.Lgs. 81/08). */
export const ANNI_DVR_DA_RIVEDERE = 4
/** Una SDS revisionata prima di questa data precede il formato del Reg. UE 2015/830 e il 2020/878: si chiede quella aggiornata. */
export const SDS_REVISIONE_MINIMA = '2015-06-01'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** Gli errori tipici dell'OCR dentro numeri e date: O al posto di 0, l o I al posto di 1. Le parole restano com'erano. */
export function sistemaOcr(testo: string): string {
  // Solo le parole fatte tutte di cifre e di caratteri confondibili: un codice fiscale (BNCGLI82...) resta com'è.
  return testo.replace(/[0-9A-Za-z|/.-]+/g, t => /^[0-9OoIl|/.-]+$/.test(t) && /\d/.test(t) && /[OoIl|]/.test(t) ? t.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : t)
}

const DATA = new RegExp(`^\\s*[:.]?\\s*(?:(?:al|il|del|dal|entro\\s+il|entro)\\s+)?(?:(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})\\s*[/.-]\\s*(\\d{4})|(\\d{1,2})\\s+(${MESI.join('|')})\\s+(\\d{4}))(?!\\d)`, 'i')

function dataValida(g: number, m: number, a: number): string | null {
  if (a < 1950 || a > 2100 || m < 1 || m > 12 || g < 1 || g > 31) return null
  const d = new Date(Date.UTC(a, m - 1, g))
  return d.getUTCMonth() === m - 1 ? d.toISOString().slice(0, 10) : null
}

/**
 * La data scritta SUBITO dopo un'etichetta («Prossima verifica 12/02/2027», «rilasciato il 3 marzo 2025»). Se
 * l'etichetta c'è ma la data non si legge, niente data: mai prendere una data qualunque più avanti nel testo.
 */
export function dataDopo(testo: string, etichetta: RegExp): { data: string | null, etichetta: boolean } {
  const re = new RegExp(etichetta.source, 'gi')
  let trovata = false
  for (const m of Array.from(testo.matchAll(re))) {
    trovata = true
    const d = DATA.exec(testo.slice(m.index! + m[0].length, m.index! + m[0].length + 40))
    if (!d) continue
    const iso = d[1] ? dataValida(+d[1], +d[2]!, +d[3]!) : dataValida(+d[4]!, MESI.indexOf(d[5]!.toLowerCase()) + 1, +d[6]!)
    if (iso) return { data: iso, etichetta: true }
  }
  return { data: null, etichetta: trovata }
}

export function dataInChiaro(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  return `${g} ${MESI[m! - 1]} ${a}`
}

const giorniTra = (da: string, a: string): number => Math.round((Date.parse(a) - Date.parse(da)) / 86400000)

/** Aggiunge (o toglie) mesi a una data AAAA-MM-GG. */
export function spostaMesi(iso: string, mesi: number): string {
  const d = new Date(Date.parse(iso))
  d.setUTCMonth(d.getUTCMonth() + mesi)
  return d.toISOString().slice(0, 10)
}

const unaCifraDiversa = (a: string, b: string): boolean => a.length === b.length && a.split('').filter((c, i) => c !== b[i]).length === 1

/** Di chi è il documento: il primo codice dopo l'intestazione (o il primo del testo), confrontato con i nostri. */
function controllaIntestatario(testo: string, tipo: TipoCercato, nostri: string[], nome: string): { ok: boolean, frase: string } {
  const intest = codiceIntestatario(testo, tipo, true)
  const parola = (c: { etichetta: 'cf' | 'piva' }): string => c.etichetta === 'piva' ? 'la partita IVA' : 'il codice fiscale'
  // Il nostro codice compare accanto a un'etichetta, anche se non è il primo (un verbale con l'organismo in testa).
  const nostroEtichettato = codiciEtichettati(testo).find(c => nostri.indexOf(c.codice) >= 0)
  if (intest && nostri.indexOf(intest.codice) >= 0) return { ok: true, frase: `è intestato a ${nome}: ${parola(intest)} ${intest.codice} è proprio ${intest.etichetta === 'piva' ? 'quella' : 'quello'} dell'azienda` }
  if (intest) {
    const vicino = nostri.find(n => unaCifraDiversa(n, intest.codice))
    if (vicino) return { ok: false, frase: `${parola(intest)} scritto nel documento (${intest.codice}) è diverso per una cifra da quello di ${nome} (${vicino}): è un'altra azienda o un errore di lettura` }
    if (nostroEtichettato && tipo !== 'visura') return { ok: true, frase: `riguarda ${nome}: ${parola(nostroEtichettato)} ${nostroEtichettato.codice} è ${nostroEtichettato.etichetta === 'piva' ? 'quella' : 'quello'} dell'azienda` }
    return { ok: false, frase: `è intestato a un'altra azienda (${parola(intest)} ${intest.codice})` }
  }
  // Nessun codice accanto a un'etichetta: vale solo il nostro, scritto per intero e da solo.
  const nudo = nostri.find(n => new RegExp(`(^|[^0-9A-Z])(?:IT)?${n}([^0-9A-Z]|$)`, 'i').test(testo))
  if (nudo) return { ok: true, frase: `riporta il codice ${nudo}, che è quello di ${nome}` }
  const prima = paroleDistintive(nome)
  const conNome = prima.length > 0 && prima.every(p => ha(normalizza(testo), p))
  return { ok: false, frase: `${conNome ? `porta il nome «${nome}» ma ` : ''}non trovo il codice fiscale né la partita IVA dell'azienda: dal solo nome non posso esserne certo` }
}

const FATTURA = /\bfattura\s+(?:n|nr|num|numero)\b|\bimponibile\b|\btotale\s+documento\b|\bnota\s+di\s+credito\b/i
const RICEVUTA = /\bricevuta\s+di\s+pagamento\b|\bdiritti\s+di\s+segreteria\b|\btotale\s+pagato\b|\bpreventivo\s+n/i

/* ---- Ruoli, corsi, verifiche: le sottovoci dei tipi multipli ---- */

/** [chiave, espressione sul testo normalizzato, etichetta, serve la firma per accettazione]. */
export const RUOLI_NOMINA: [string, RegExp, string, boolean][] = [
  ['rspp', /\bresponsabile del servizio di prevenzione e protezione\b|\brspp\b/, 'del RSPP', true],
  ['aspp', /\baddett[oi] al servizio di prevenzione e protezione\b|\baspp\b/, 'dell\'ASPP', true],
  ['medico_competente', /\bmedico competente\b/, 'del medico competente', true],
  ['rls', /\brappresentante dei lavoratori per la sicurezza\b|\brlst?\b/, 'del RLS', false],
  ['antincendio', /\bantincendio\b|\blotta antincendio\b|\bprevenzione incendi\b/, 'degli addetti antincendio', false],
  ['primo_soccorso', /\bprimo soccorso\b/, 'degli addetti al primo soccorso', false],
  ['preposto', /\bprepost[oi]\b/, 'del preposto', false],
  ['emergenze', /\bgestione delle emergenze\b/, 'degli addetti alle emergenze', false],
]

/**
 * [chiave, espressione, etichetta, anni dell'aggiornamento]. Periodi prudenti di Falco: preposti 2 anni (Accordo
 * Stato Regioni 17/04/2025), primo soccorso 3 (DM 388/2003), RLS 1 (aggiornamento annuale, art. 37 c. 11), il resto 5.
 */
export const CORSI: [string, RegExp, string, number][] = [
  ['preposto', /\bprepost[oi]\b/, 'preposti', 2],
  ['dirigente', /\bdirigent[ei]\b/, 'dirigenti', 5],
  ['datore_rspp', /\bdatore di lavoro che svolge (?:direttamente )?i compiti\b|\bdatore di lavoro rspp\b|\bddl rspp\b/, 'datore di lavoro RSPP', 5],
  ['rspp', /\brspp\b|\bresponsabile del servizio di prevenzione\b/, 'RSPP', 5],
  ['aspp', /\baspp\b|\baddetto al servizio di prevenzione\b/, 'ASPP', 5],
  ['rls', /\brlst?\b|\brappresentante dei lavoratori per la sicurezza\b/, 'RLS', 1],
  ['antincendio', /\bantincendio\b|\blotta antincendio\b/, 'antincendio', 5],
  ['primo_soccorso', /\bprimo soccorso\b/, 'primo soccorso', 3],
  ['carrelli', /\bcarrell[io] elevator[ei]\b|\bcarrellist[ai]\b/, 'carrelli elevatori', 5],
  ['ple', /\bpiattaform[ae] di lavoro mobil[ei] elevabil[ei]\b|\bple\b/, 'PLE', 5],
  ['gru', /\bgru\b/, 'gru', 5],
  ['trattori', /\btrattor[ei]\b/, 'trattori', 5],
  ['movimento_terra', /\bmovimento terra\b|\bescavator[ei]\b/, 'macchine movimento terra', 5],
  ['spazi_confinati', /\bspazi confinati\b|\bambienti confinati\b/, 'spazi confinati', 5],
  ['lavoratori_specifica', /\bformazione specifica\b/, 'formazione specifica dei lavoratori', 5],
  ['lavoratori_generale', /\bformazione generale\b/, 'formazione generale dei lavoratori', 0],
  ['lavoratori', /\blavorator[ei]\b/, 'formazione dei lavoratori', 5],
]

/** [chiave, espressione, etichetta, mesi della periodicità se il verbale non scrive la prossima verifica (0 = non si deduce)]. */
export const VERIFICHE: [string, RegExp, string, number][] = [
  ['scariche_atmosferiche', /\bscariche atmosferiche\b|\bparafulmin/, 'delle protezioni contro le scariche atmosferiche', 24],
  ['messa_terra', /\bmessa a terra\b|\bdpr 462\b/, 'dell\'impianto di messa a terra', 24],
  ['antincendio', /\bestintor|\bidrant|\bpresidi antincendio\b|\buni 9994\b/, 'dei presidi antincendio', 6],
  ['ascensore', /\bascensor|\bmontacarich|\bdpr 162\b/, 'dell\'ascensore', 24],
  ['sollevamento', /\bapparecchi di sollevamento\b|\bgru\b|\bparanc|\bcarroponte\b|\bcarro ponte\b/, 'dell\'apparecchio di sollevamento', 12],
  ['pressione', /\brecipient[ei] a pressione\b|\bapparecchi a pressione\b|\bgeneratori? di vapore\b/, 'dell\'apparecchio a pressione', 0],
  ['attrezzatura', /\ballegato vii\b|\battrezzatur[ae] di lavoro\b/, 'dell\'attrezzatura di lavoro', 0],
]

/** Il primo (per posizione) fra le voci che compare nel testo, a partire da `da`. */
function primoFra<T extends [string, RegExp, ...unknown[]]>(norm: string, voci: T[], da = 0): T | null {
  let meglio: { v: T, pos: number } | null = null
  const parte = norm.slice(da)
  for (const v of voci) {
    const m = v[1].exec(parte)
    if (m && (!meglio || m.index < meglio.pos)) meglio = { v, pos: m.index }
  }
  return meglio?.v ?? null
}

/** Nome del prodotto della SDS o della macchina del libretto, se si legge. */
export function nomeProdotto(testo: string, tipo: 'sds' | 'libretto_attrezzatura'): string | null {
  const t = testo.replace(/\s+/g, ' ')
  // Le etichette in ordine di preferenza: «Nome commerciale» dice il prodotto meglio di «Identificatore del prodotto».
  const etichette = tipo === 'sds' ? ['nome commerciale', 'denominazione commerciale', 'nome del prodotto', 'identificatore del prodotto'] : ['modello', 'macchina', 'denominazione', 'tipo']
  const fine = tipo === 'sds' ? '(?=\\s+(?:codice|numero|uso|cas|ufi|fornitore|sezione|informazioni|nome commerciale)\\b|\\s+\\d+\\.\\d|$)' : '(?=\\s+(?:matricola|numero di serie|n\\.? di serie|anno|costruttore|fabbricante|marca)\\b|$)'
  for (const e of etichette) {
    const m = new RegExp(`${e}\\s*:?\\s*(.+?)${fine}`, 'i').exec(t)
    const nome = m?.[1]?.trim()
    if (nome && nome.length >= 2 && nome.length <= 70) return nome
  }
  return null
}

function nomeFornitore(testo: string, tipo: 'sds' | 'libretto_attrezzatura'): string | null {
  const re = tipo === 'sds'
    ? /(?:fornitore|produttore|ragione sociale)\s*:\s*(.+?)(?=\s+(?:via|indirizzo|sede|partita|p\.?\s?iva|tel|telefono|e-?mail|codice)\b|[,;]|$)/i
    : /(?:fabbricante|costruttore|produttore)\s*:\s*(.+?)(?=\s+(?:via|indirizzo|sede|partita|p\.?\s?iva|tel|telefono|e-?mail|dichiara|codice)\b|[,;]|$)/i
  const m = re.exec(testo.replace(/\s+/g, ' '))
  const nome = m?.[1]?.trim()
  return nome && nome.length >= 3 && nome.length <= 70 ? nome : null
}

/** La dicitura che DEFINISCE il tipo: senza, il tipo non è verificato (le diciture deboli servono solo a trovarlo). */
function definisce(norm: string, tipo: TipoCercato): string | null {
  const c = (f: string): boolean => ha(norm, f)
  switch (tipo) {
    case 'visura': return ['visura ordinaria', 'visura storica', 'visura camerale'].find(c) ?? ((c('camera di commercio') || c('registro delle imprese') || c('registro imprese')) && (c('numero rea') || c('rea')) ? 'Registro delle Imprese con numero REA' : null)
    case 'nomina': {
      const atto = /\b(nomina|nomine|designazione|designa|conferimento dell incarico|conferisce l incarico|incarico|verbale di elezione|elezione)\b/.exec(norm)
      if (!atto) return null
      return primoFra(norm, RUOLI_NOMINA, atto.index) ? atto[1]! : null
    }
    case 'attestato_formazione':
      if (/\battestat[oi] di (frequenza|formazione|partecipazione|idoneita tecnica)\b/.test(norm)) return 'attestato di ' + /\battestat[oi] di (frequenza|formazione|partecipazione|idoneita tecnica)\b/.exec(norm)![1]!
      return c('si attesta che') && /\b(corso|formazione|ha frequentato)\b/.test(norm) ? 'si attesta che ha frequentato il corso' : null
    case 'verbale_verifica':
      return /\b(verbale|rapporto|registro|certificato)\b/.test(norm) && /\b(verifica|verifiche|controllo|controlli|ispezione)\b/.test(norm) && primoFra(norm, VERIFICHE) ? 'verbale di verifica' : null
    case 'sds': {
      const titolo = ['scheda di dati di sicurezza', 'scheda dati di sicurezza', 'safety data sheet'].find(c)
      return titolo && (contaSezioniSds(norm) >= 4 || c('1907 2006')) ? titolo : null
    }
    case 'dvr': return c('documento di valutazione dei rischi') ? 'documento di valutazione dei rischi' : c('documento di valutazione del rischio') ? 'documento di valutazione del rischio' : c('valutazione dei rischi') && (c('art 28') || c('art 17')) ? 'valutazione dei rischi (art. 28)' : null
    case 'libretto_attrezzatura':
      if (['manuale d uso e manutenzione', 'libretto di uso e manutenzione', 'libretto d uso', 'manuale di istruzioni', 'istruzioni per l uso', 'istruzioni originali'].find(c)) return ['manuale d uso e manutenzione', 'libretto di uso e manutenzione', 'libretto d uso', 'manuale di istruzioni', 'istruzioni per l uso', 'istruzioni originali'].find(c)!
      return (c('dichiarazione ce di conformita') || c('dichiarazione di conformita ce') || c('dichiarazione di conformita')) && (c('2006 42 ce') || c('direttiva macchine') || c('2023 1230')) ? 'dichiarazione CE di conformità' : null
    case 'elenco_lavoratori':
      if (c('libro unico del lavoro')) return 'Libro Unico del Lavoro'
      return c('cognome') && c('nome') && (c('codice fiscale') || c('matricola')) && (c('mansione') || c('qualifica') || c('data assunzione') || c('data di assunzione')) ? 'elenco con cognome, nome, codice fiscale e mansione' : null
    case 'planimetria': return ['planimetria di emergenza', 'piano di evacuazione', 'voi siete qui', 'planimetria', 'layout'].find(c) ?? null
    case 'piano_emergenza': return c('piano di emergenza ed evacuazione') ? 'piano di emergenza ed evacuazione' : c('piano di emergenza') ? 'piano di emergenza' : null
    default: return null
  }
}

const SEZIONI_SDS = ['identificazione della sostanza o della miscela', 'identificazione dei pericoli', 'composizione informazioni sugli ingredienti', 'misure di primo soccorso', 'misure di lotta antincendio', 'misure in caso di rilascio accidentale', 'manipolazione e immagazzinamento', 'controlli dell esposizione', 'proprieta fisiche e chimiche', 'stabilita e reattivita', 'informazioni tossicologiche', 'informazioni ecologiche', 'considerazioni sullo smaltimento', 'informazioni sul trasporto', 'informazioni sulla regolamentazione', 'altre informazioni']
const contaSezioniSds = (norm: string): number => SEZIONI_SDS.filter(s => norm.indexOf(s) >= 0).length

const ETICHETTA_DATA_GENERICA = /data\s+(?:di\s+)?(?:emissione|rilascio|redazione)|rilasciat[oa]\s+(?:il|in\s+data)|in\s+data|\bdata\b|\bl[iì](?=\s)|\badd[iì](?=\s)|con\s+decorrenza|a\s+decorrere\s+dal|a\s+far\s+data\s+dal/

/**
 * Verifica un documento già riconosciuto come `tipo` per l'azienda, alla data `oggi` (AAAA-MM-GG). Logica pura.
 */
export function verifica(testoGrezzo: string, tipo: TipoCercato, impresa: Impresa | null | undefined, oggi: string): Verifica {
  const testo = sistemaOcr(testoGrezzo.replace(/\s+/g, ' ').slice(0, 120000))
  const norm = normalizza(testo)
  const verificato: string[] = []
  let chiave: string | null = null
  const no = (problema: string, data: string | null = null, scadenza: string | null = null): Verifica => ({ verdetto: 'da_controllare', verificato: verificato.slice(), problema, data, scadenza, chiave })
  const si = (data: string | null, scadenza: string | null = null): Verifica => ({ verdetto: 'giusto', verificato, problema: null, data, scadenza, chiave })

  // 0. I dati sanitari non si caricano mai, qualunque cosa si cercasse.
  if (datoSanitario(testoGrezzo)) return { verdetto: 'escluso', verificato: [], problema: MOTIVO_SANITARIO, data: null, scadenza: null, chiave: null }

  // 1. Il tipo, dal contenuto (il nome del file non conta).
  if (FATTURA.test(testo)) return no(`è una fattura, non ${NOMI[tipo]}`)
  if (RICEVUTA.test(testo)) return no(`è una ricevuta di pagamento, non ${NOMI[tipo]}`)
  if (tipo === 'dvr' && (ha(norm, 'duvri') || ha(norm, 'rischi da interferenze') || ha(norm, 'piano operativo di sicurezza'))) return no(`è un ${ha(norm, 'piano operativo di sicurezza') ? 'POS' : 'DUVRI'}, non il DVR dell'azienda`)
  if (tipo === 'nomina' && /\brevoca (della nomina|dell incarico|della designazione)\b/.test(norm)) return no('è una revoca della nomina, non una nomina in vigore')
  const dicitura = definisce(norm, tipo)
  if (!dicitura) return no(tipo === 'altro' ? 'non so verificarne il tipo dal contenuto' : `dentro non trovo le diciture che ne fanno ${NOMI[tipo]}`)
  verificato.push(`è ${NOMI[tipo]} (c'è la dicitura «${dicitura}»)`)

  // 2. Di chi è.
  if (tipo === 'sds' || tipo === 'libretto_attrezzatura') {
    const chi = nomeFornitore(testo, tipo)
    const prodotto = nomeProdotto(testo, tipo)
    const matricola = tipo === 'libretto_attrezzatura' ? /(?:matricola|numero di serie|n\.?\s*di\s+serie)\s*:?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i.exec(testo)?.[1] ?? null : null
    chiave = normalizza([prodotto ?? '', matricola ?? ''].join(' ')) || null
    verificato.push(tipo === 'sds'
      ? `è del fornitore${chi ? ` ${chi}` : ''}: non serve la partita IVA dell'azienda`
      : `è del costruttore${chi ? ` ${chi}` : ''}: non serve la partita IVA dell'azienda`)
    if (prodotto) verificato.push(tipo === 'sds' ? `riguarda il prodotto ${prodotto}` : `riguarda ${prodotto}${matricola ? `, matricola ${matricola}` : ''}`)
  }
  else if (tipo === 'attestato_formazione') {
    const corso = primoFra(norm, CORSI)
    const persona = controllaPersona(testo, norm, impresa?.lavoratori ?? [])
    if (!persona.ok) return no(persona.frase)
    verificato.push(persona.frase)
    chiave = `${persona.chiave}|${corso?.[0] ?? 'corso'}`
    if (corso) verificato.push(`è un corso ${corso[2]}`)
    // 4 per l'attestato: rilascio e aggiornamento.
    const scritta = dataDopo(testo, /valid[oa]\s+fino\s+al|scadenza|da\s+aggiornare\s+entro/)
    // 09/11: anche «Data di conclusione del corso:», «terminato il», «superato il» e la riga finale «Viterbo, 20/10/2026».
    const d = dataDopo(testo, /data\s+(?:di\s+|del\s+|della\s+)?(?:rilascio|fine(?:\s+del)?\s+corso|emissione|conseguimento|conclusione(?:\s+del\s+corso)?|svolgimento(?:\s+del\s+corso)?|termine(?:\s+del\s+corso)?|esame|verifica(?:\s+finale)?|corso)|rilasciat[oa]\s+(?:il|in\s+data)|conseguit[oa]\s+(?:il|in\s+data)|svolt[oa]\s+(?:il|in\s+data)|conclus[oa]\s+il|terminat[oa]\s+il|superat[oa]\s+il|in\s+data|\bdata\b|\bl[iì](?=\s)|\badd[iì](?=\s)/)
    // Ultima possibilita': la riga finale «Viterbo, 20/10/2026», solo in fondo al documento
    // (piu' in alto potrebbe essere una data di nascita).
    if (!d.data && !scritta.data) {
      const f = /[A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{2,29},\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})\s*$/.exec(testo.trim().slice(-120))
      const iso = f ? dataValida(+f[1], +f[2], +f[3]) : null
      if (iso) d.data = iso
    }
    if (!d.data && !scritta.data) return no('non riesco a leggere la data dell\'attestato')
    const anni = corso?.[3] ?? 5
    const scade = scritta.data ?? (anni > 0 && d.data ? spostaMesi(d.data, anni * 12) : null)
    if (scade && scade < oggi) return no(scritta.data ? `è scaduto il ${dataInChiaro(scade)}` : `è del ${dataInChiaro(d.data!)}: l'aggiornamento ${corso ? `per ${corso[2]} ` : ''}va fatto ogni ${anni === 1 ? 'anno' : `${anni} anni`}, quindi è scaduto il ${dataInChiaro(scade)}`, d.data, scade)
    if (d.data) verificato.push(`è rilasciato il ${dataInChiaro(d.data)}`)
    if (scade) verificato.push(scritta.data ? `è valido fino al ${dataInChiaro(scade)}` : `l'aggiornamento va fatto entro il ${dataInChiaro(scade)}`)
    else if (anni === 0) verificato.push('la formazione generale non scade')
    return si(d.data ?? scritta.data, scade)
  }
  else {
    const nostri = [compattaCodice(impresa?.codice_fiscale), compattaCodice(impresa?.partita_iva)].filter(s => s.length === 11 || s.length === 16)
    const unici = nostri.filter((s, i) => nostri.indexOf(s) === i)
    const nome = impresa?.denominazione?.trim() || 'l\'azienda'
    let ok: { ok: boolean, frase: string } | null = null
    if (tipo === 'elenco_lavoratori') {
      const conosciuti = lavoratoriNelTesto(testo, impresa?.lavoratori ?? [])
      const servono = Math.min(2, (impresa?.lavoratori ?? []).filter(l => compattaCodice(l.codice_fiscale).length === 16).length)
      if (servono > 0 && conosciuti >= servono) ok = { ok: true, frase: `contiene il codice fiscale di ${conosciuti === 1 ? 'un lavoratore' : `${conosciuti} lavoratori`} dell'azienda che conosco` }
    }
    if (!ok) {
      if (!unici.length) return no('non conosco il codice fiscale né la partita IVA dell\'azienda per confrontarli')
      ok = controllaIntestatario(testo, tipo, unici, nome)
    }
    if (!ok.ok) return no(ok.frase)
    verificato.push(ok.frase)
  }

  // 3. Che dica ciò che serve: impresa attiva, verifica con esito positivo, nomina accettata.
  if (tipo === 'visura') {
    const stato = /\b(in liquidazione|scioglimento e liquidazione|fallit[oa]|cessat[oa]|inattiv[oa])\b/.exec(norm)
    if (stato) return no(`la visura dice che l'impresa è ${stato[1] === 'scioglimento e liquidazione' ? 'in liquidazione' : stato[1]}`)
  }
  if (tipo === 'nomina') {
    const atto = /\b(nomina|nomine|designazione|designa|conferimento dell incarico|conferisce l incarico|incarico|verbale di elezione|elezione)\b/.exec(norm)!
    const ruolo = primoFra(norm, RUOLI_NOMINA, atto.index)!
    chiave = ruolo[0]
    verificato.push(`è la nomina ${ruolo[2]}`)
    if (ruolo[3]) {
      if (!ha(norm, 'per accettazione') && !ha(norm, 'accetta l incarico') && !ha(norm, 'dichiara di accettare')) return no(`non trovo la parte «per accettazione» firmata da chi riceve la nomina ${ruolo[2]}`)
      verificato.push('c\'è la parte «per accettazione»')
    }
  }
  if (tipo === 'verbale_verifica') {
    const v = primoFra(norm, VERIFICHE)!
    chiave = v[0]
    verificato.push(`è la verifica ${v[2]}`)
    if (/\besito\s*(?:della verifica)?\s*negativo\b|\bnon conforme\b|\bnon superata\b|\besito sfavorevole\b/.test(norm)) return no('l\'esito della verifica è negativo: serve l\'intervento e una nuova verifica')
    if (/\besito\s*(?:della verifica)?\s*(?:positivo|favorevole)\b|\bconforme\b|\bsuperata\b/.test(norm)) verificato.push('l\'esito è positivo')
    else return no('non leggo l\'esito della verifica')
    const fatta = dataDopo(testo, /data\s+(?:della\s+)?(?:verifica|ispezione|controllo|sopralluogo|intervento)|verifica\s+(?:eseguita|effettuata)\s+(?:il|in\s+data)|eseguit[oa]\s+il|effettuat[oa]\s+il|in\s+data/)
    const prossima = dataDopo(testo, /prossim[oa]\s+(?:verifica|controllo|ispezione)|scadenza\s+(?:della\s+)?verifica|da\s+ripetere\s+entro/)
    const scade = prossima.data ?? (fatta.data && v[3] > 0 ? spostaMesi(fatta.data, v[3]) : null)
    if (!scade) return no(fatta.data ? 'non leggo la data della prossima verifica' : 'non riesco a leggere la data della verifica')
    if (scade < oggi) return no(prossima.data ? `la prossima verifica era da fare entro il ${dataInChiaro(scade)}: è scaduta` : `è una verifica del ${dataInChiaro(fatta.data!)}: con la periodicità prudente di ${v[3] === 6 ? 'sei mesi' : `${v[3] / 12 === 1 ? 'un anno' : `${v[3] / 12} anni`}`} risulta scaduta; controlla se ce n'è una più recente`, fatta.data, scade)
    if (fatta.data) verificato.push(`è eseguita il ${dataInChiaro(fatta.data)}`)
    verificato.push(prossima.data ? `la prossima verifica è entro il ${dataInChiaro(scade)}` : `con la periodicità prudente vale fino al ${dataInChiaro(scade)}`)
    return si(fatta.data ?? null, scade)
  }

  // 4. Valido oggi: la data che dice quanto è recente.
  if (tipo === 'visura') {
    const d = dataDopo(testo, /estratt[oa]\s+dal\s+registro\s+(?:delle\s+)?imprese\s+in\s+data|data\s+(?:di\s+)?estrazione|estratt[oa]\s+(?:il|in\s+data)|aggiornat[oa]\s+al/)
    if (!d.data) return no('non riesco a leggere la data della visura')
    if (d.data < spostaMesi(oggi, -MESI_VISURA)) return no(`è una visura del ${dataInChiaro(d.data)}, di più di sei mesi fa: meglio una aggiornata`, d.data)
    verificato.push(`è estratta il ${dataInChiaro(d.data)}`)
    return si(d.data)
  }
  if (tipo === 'nomina') {
    const d = dataDopo(testo, ETICHETTA_DATA_GENERICA)
    if (!d.data) return no('non riesco a leggere la data della nomina')
    verificato.push(`è datata ${dataInChiaro(d.data)}`)
    return si(d.data)
  }
  if (tipo === 'dvr') {
    const d = dataDopo(testo, /data\s+certa|data\s+(?:di\s+)?(?:emissione|redazione|aggiornamento|revisione)|revisione\s+n\.?\s*\d+\s+del|rev\.?\s*\d+\s+del|aggiornat[oa]\s+al|\bdata\b/)
    if (!d.data) return no('non riesco a leggere la data del DVR')
    verificato.push(d.data < spostaMesi(oggi, -12 * ANNI_DVR_DA_RIVEDERE) ? `è datato ${dataInChiaro(d.data)}: ha più di ${ANNI_DVR_DA_RIVEDERE} anni, va rivisto` : `è datato ${dataInChiaro(d.data)}`)
    return si(d.data)
  }
  if (tipo === 'sds') {
    const d = dataDopo(testo, /data\s+(?:di\s+)?(?:revisione|compilazione|emissione|stampa)|revisione\s+n\.?\s*\d+\s+del|versione\s+\S+\s+del|rev\.?\s*\d+\s+del|\bdata\b/)
    const soloFrasiR = !/\bh[23]\d\d\b|\b1272 2008\b|\bclp\b/.test(norm) && (/\b67 548\b|\bfrasi r\b/.test(norm))
    if (soloFrasiR) return no('usa ancora le frasi R della vecchia direttiva, senza le indicazioni H del CLP: chiedi al fornitore quella aggiornata', d.data)
    if (!d.data) return no('non riesco a leggere la data di revisione della scheda')
    if (d.data < SDS_REVISIONE_MINIMA) return no(`è una scheda del ${dataInChiaro(d.data)}, precedente agli ultimi formati REACH: chiedi al fornitore quella aggiornata`, d.data)
    verificato.push(`è revisionata il ${dataInChiaro(d.data)}`)
    return si(d.data)
  }
  if (tipo === 'planimetria') {
    const piano = /\b(piano terra|piano primo|primo piano|secondo piano|piano secondo|piano interrato|seminterrato|soppalco|piano rialzato)\b/.exec(norm)
    chiave = piano ? piano[1]!.replace('primo piano', 'piano primo').replace('secondo piano', 'piano secondo') : null
    if (chiave) verificato.push(`riguarda il ${chiave}`)
  }
  // Planimetria, piano di emergenza, elenco dei lavoratori, libretti: nessuna scadenza; la data, se c'è, dice il più recente.
  const d = dataDopo(testo, ETICHETTA_DATA_GENERICA)
  if (d.data) verificato.push(`è datato ${dataInChiaro(d.data)}`)
  return si(d.data)
}

/** Il codice fiscale compatto di un lavoratore, se ha la forma giusta. */
const cfLavoratore = (l: Lavoratore): string => {
  const c = compattaCodice(l.codice_fiscale)
  return c.length === 16 ? c : ''
}

function lavoratoriNelTesto(testo: string, lavoratori: Lavoratore[]): number {
  const compatto = testo.toUpperCase().replace(/[\s.]+/g, '')
  return lavoratori.filter(l => cfLavoratore(l) && compatto.indexOf(cfLavoratore(l)) >= 0).length
}

/** Diciture dell'attestato accanto alle quali si cerca il nome del partecipante. */
const ANCORE_ATTESTATO = /\b(si attesta che|attesta che|rilasciato a|conferito a|il sig|la sig|sig ra|signor[ae]?|partecipante|discente|nominativo|cognome e nome|nome e cognome|ha frequentato|ha partecipato)\b/g

/**
 * Di chi è l'attestato: il codice fiscale di un lavoratore noto, oppure nome e cognome di un lavoratore noto accanto alle
 * diciture tipiche («si attesta che», «ha frequentato»). Un codice fiscale di un'altra persona prevale sul nome.
 */
function controllaPersona(testo: string, norm: string, lavoratori: Lavoratore[]): { ok: boolean, frase: string, chiave: string } {
  if (!lavoratori.length) return { ok: false, frase: 'non conosco i lavoratori dell\'azienda per riconoscere di chi è l\'attestato', chiave: '' }
  const compatto = testo.toUpperCase().replace(/[\s.]+/g, '')
  const conCf = lavoratori.find(l => cfLavoratore(l) && compatto.indexOf(cfLavoratore(l)) >= 0)
  const chi = (l: Lavoratore): string => `${l.nome.trim()} ${l.cognome.trim()}`
  if (conCf) return { ok: true, frase: `è intestato a ${chi(conCf)}: il codice fiscale ${cfLavoratore(conCf)} è proprio il suo`, chiave: cfLavoratore(conCf) }
  // Codici fiscali di persona scritti accanto alla loro etichetta, ma di nessun lavoratore noto: è di un'altra persona.
  const persone = codiciEtichettati(testo).filter(c => c.codice.length === 16)
  if (persone.length) return { ok: false, frase: `è intestato a una persona che non è fra i lavoratori che conosco (codice fiscale ${persone[0]!.codice})`, chiave: '' }
  const ancore = Array.from(norm.matchAll(ANCORE_ATTESTATO)).map(m => m.index!)
  for (const l of lavoratori) {
    const nome = normalizza(l.nome)
    const cognome = normalizza(l.cognome)
    if (nome.length < 2 || cognome.length < 2) continue
    const vicino = ancore.some(p => {
      const finestra = ' ' + norm.slice(Math.max(0, p - 120), p + 220) + ' '
      return finestra.indexOf(' ' + nome + ' ') >= 0 && finestra.indexOf(' ' + cognome + ' ') >= 0
    })
    if (vicino) return { ok: true, frase: `è intestato a ${chi(l)}, lavoratore dell'azienda (nome e cognome accanto alle diciture dell'attestato)`, chiave: normalizza(`${l.cognome} ${l.nome}`) }
  }
  return { ok: false, frase: 'non riguarda nessuno dei lavoratori che conosco: forse è di un nuovo assunto, controlla tu', chiave: '' }
}
