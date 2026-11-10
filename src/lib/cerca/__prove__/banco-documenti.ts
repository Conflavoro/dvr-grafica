// Banco dei documenti HSE per la ricerca nel computer (Falco). Casi sintetici, realistici, con la verità di ciascun
// documento: che tipo è davvero e se è giusto proporlo (dell'azienda o di un suo lavoratore, valido oggi; per SDS e
// libretti basta che sia del fornitore o del costruttore). Il banco misura precisione, richiamo e soprattutto ERRORI
// GRAVI: un documento proposto (già spuntato per il caricamento) che non andava proposto. I dati sanitari devono
// risultare sempre esclusi. Oggi, per il banco, è il 6 novembre 2026.
import type { Impresa, TipoCercato } from '../riconosci'
import { file, foto, pdf, scansione, zip } from './costruttori'

export const OGGI = new Date(Date.UTC(2026, 10, 6, 10, 0, 0))

export const IMPRESA: Impresa = {
  codice_fiscale: '12345670966', partita_iva: '12345670966', denominazione: 'Officine Brianza S.r.l.', legale_rappresentante: 'Marco Rossi',
  lavoratori: [
    { nome: 'Marco', cognome: 'Rossi', codice_fiscale: 'RSSMRC80A01F205X' },
    { nome: 'Giulia', cognome: 'Bianchi', codice_fiscale: 'BNCGLI82B41F205Y' },
    { nome: 'Luca', cognome: 'Verdi' },
  ],
}

interface Soggetto { den: string, cf: string }
const NOI: Soggetto = { den: 'Officine Brianza S.r.l.', cf: '12345670966' }
const ALTRA: Soggetto = { den: 'Metalli Nord S.p.A.', cf: '98765432109' }

const g = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d)

// ---- Testi tipici ----
export const visura = ({ den, cf }: Soggetto, data: string, stato = 'attiva', n = 1, lr = 'Marco Rossi'): string => `VISURA ORDINARIA SOCIETA' DI CAPITALE Camera di Commercio Industria Artigianato e Agricoltura di MILANO MONZA BRIANZA LODI Registro delle Imprese Documento n. T 44550${n} estratto dal Registro Imprese in data ${data} Denominazione: ${den} Codice fiscale e n. iscrizione al Registro Imprese: ${cf} Partita IVA: ${cf} Forma giuridica: societa' a responsabilita' limitata Sede legale: Monza (MB) Via Roma 1 Numero REA: MB-99887${n} Stato attivita': ${stato} Legale rappresentante: ${lr}`

export const nominaRspp = ({ den, cf }: Soggetto, data: string, accettazione = true): string => `LETTERA DI NOMINA DEL RESPONSABILE DEL SERVIZIO DI PREVENZIONE E PROTEZIONE (artt. 17 e 31 D.Lgs. 81/08) Il sottoscritto Marco Rossi, in qualità di datore di lavoro della ditta ${den} con sede in Monza, Partita IVA ${cf}, NOMINA il Dott. Paolo Neri, codice fiscale NREPLA70C10F205Z, Partita IVA 04567890123, quale Responsabile del Servizio di Prevenzione e Protezione, in possesso dei requisiti dell'art. 32. Monza, lì ${data} Il datore di lavoro${accettazione ? ' Per accettazione il RSPP Paolo Neri' : ''}`

export const nominaMc = ({ den, cf }: Soggetto, data: string): string => `NOMINA DEL MEDICO COMPETENTE (art. 18 c. 1 lett. a D.Lgs. 81/08) La società ${den}, Codice fiscale ${cf}, nella persona del datore di lavoro Marco Rossi, conferisce l'incarico di medico competente alla Dott.ssa Anna Gialli, che effettuerà la sorveglianza sanitaria, esprimerà i giudizi di idoneità alla mansione e istituirà e aggiornerà la cartella sanitaria e di rischio per ogni lavoratore sottoposto a sorveglianza. Data ${data} Per accettazione il medico competente`

export const attestato = (corso: string, persona: string, data: string, ore = 12): string => `ATTESTATO DI FREQUENZA CON VERIFICA DELL'APPRENDIMENTO ${corso} (Accordo Stato Regioni 17/04/2025, art. 37 D.Lgs. 81/08) Soggetto formatore: Formazione Sicura S.r.l. Partita IVA 07777777777 Si attesta che ${persona} ha frequentato il corso della durata di ${ore} ore superando la verifica finale dell'apprendimento. Rilasciato il ${data} Il responsabile del progetto formativo`

export const verbaleTerra = ({ den, cf }: Soggetto, data: string, prossima: string, esito = 'POSITIVO'): string => `VerificheSicure S.r.l. Organismo di ispezione di tipo A abilitato ai sensi del DPR 462/01 Partita IVA 06666666666 VERBALE DI VERIFICA PERIODICA dell'impianto di messa a terra Datore di lavoro: ${den} Partita IVA ${cf} Sede dell'impianto Monza Via Roma 1 Data della verifica ${data} Tecnico verificatore Ing. Carlo Bruni Esito della verifica: ${esito} Prossima verifica entro il ${prossima}`

export const sds = (prodotto: string, revisione: string): string => `SCHEDA DI DATI DI SICUREZZA conforme al Regolamento (CE) n. 1907/2006 (REACH) e al Regolamento (UE) 2020/878 Data di revisione ${revisione} Versione 3 SEZIONE 1: Identificazione della sostanza o della miscela e della società/impresa 1.1 Identificatore del prodotto Nome commerciale: ${prodotto} 1.3 Informazioni sul fornitore della scheda di dati di sicurezza Fornitore: Chimica Lombarda S.p.A. Via dell'Industria 3 Partita IVA 05555555555 SEZIONE 2: Identificazione dei pericoli Indicazioni di pericolo H315 H319 Consigli di prudenza P280 SEZIONE 3: Composizione/informazioni sugli ingredienti SEZIONE 4: Misure di primo soccorso In caso di contatto con gli occhi consultare un medico SEZIONE 11: Informazioni tossicologiche SEZIONE 12: Informazioni ecologiche SEZIONE 13: Considerazioni sullo smaltimento`

export const dvr = ({ den, cf }: Soggetto, data: string): string => `DOCUMENTO DI VALUTAZIONE DEI RISCHI ai sensi degli artt. 17 e 28 del D.Lgs. 81/08 Azienda: ${den} Partita IVA ${cf} Sede Monza Via Roma 1 Revisione n. 2 del ${data} Metodo: matrice dei rischi probabilità per magnitudo. Misure di prevenzione e protezione. Programma delle misure ritenute opportune. Sorveglianza sanitaria: il medico competente esprime il giudizio di idoneità secondo il protocollo sanitario. Redatto con la collaborazione dello Studio Tecnico Alfa P.IVA 01111111111`

export const giudizioIdoneita = ({ den, cf }: Soggetto): string => `GIUDIZIO DI IDONEITA' ALLA MANSIONE SPECIFICA (art. 41 D.Lgs. 81/08) Azienda: ${den} Partita IVA ${cf} Lavoratore: Marco Rossi codice fiscale RSSMRC80A01F205X Mansione: saldatore Visita medica periodica del 03/03/2026 Giudizio: IDONEO CON PRESCRIZIONI uso di otoprotettori Avverso il giudizio è ammesso ricorso entro 30 giorni all'organo di vigilanza. Il medico competente Dott.ssa Anna Gialli`

export const FATTURA_DVR = 'FATTURA N. 2026/118 del 10/10/2026 Studio Tecnico Alfa Partita IVA 01111111111 Spett.le Officine Brianza S.r.l. Codice fiscale 12345670966 Oggetto: aggiornamento del documento di valutazione dei rischi e incarico RSPP esterno Imponibile 900,00 IVA 22% 198,00 Totale documento 1.098,00'

export const libretto = (): string => `MANUALE D'USO E MANUTENZIONE Istruzioni originali Fabbricante: Torni Bergamo S.p.A. Partita IVA 03333333333 Macchina: tornio parallelo TP 400 Matricola TB-2019-0042 Anno di costruzione 2019 Dichiarazione CE di conformità secondo la Direttiva Macchine 2006/42/CE`

export const ELENCO_CSV = 'Cognome;Nome;Codice fiscale;Mansione;Data assunzione\nRossi;Marco;RSSMRC80A01F205X;Saldatore;01/03/2015\nBianchi;Giulia;BNCGLI82B41F205Y;Impiegata;10/09/2018\nVerdi;Luca;VRDLCU90E10F205K;Operaio;01/02/2024\n'

const RUMORE = [
  (n: number) => `Fattura n. ${n} Ferramenta Lissone Partita IVA 03${String(n).padStart(9, '0')} viti e bulloni imponibile 40,00 IVA 22% totale 48,80`,
  (n: number) => `Ricetta della nonna numero ${n}: tagliatelle al ragù, cuocere per due ore a fuoco lento`,
  (n: number) => `Contratto di locazione ad uso commerciale n. ${n} tra le parti locatore e conduttore canone mensile`,
  (n: number) => `Verbale di assemblea dei soci n. ${n} ordine del giorno approvazione del bilancio`,
  (n: number) => `Cedolino paga mese ${n % 12 + 1} lavoratore matricola INPS ${n} netto in busta 1.450,00`,
]

export interface Verita { tipo: TipoCercato | 'sanitario' | 'nessuno', buono: boolean }
export interface Documento { f: File, v: Verita, dentro?: Record<string, Verita> }
export interface Caso { nome: string, tipi: TipoCercato[], documenti: Documento[], attesi: Partial<Record<TipoCercato, string[]>>, ocr?: Record<string, string> }

const doc = (nome: string, buf: Buffer, v: Verita, modificato?: number, dentro?: Record<string, Verita>): Documento => ({ f: file(nome, buf, `PC/Documenti/${nome}`, modificato), v, ...(dentro ? { dentro } : {}) })
const giusto = (tipo: TipoCercato): Verita => ({ tipo, buono: true })
const nonBuono = (tipo: Verita['tipo']): Verita => ({ tipo, buono: false })

/** I casi del banco. `attesi[tipo]` = i nomi dei file da proporre; vuoto se nessun file va proposto. */
export function casi(): Caso[] {
  const S: Caso[] = []

  S.push({ nome: 'visura giusta con nome qualunque', tipi: ['visura'],
    documenti: [doc('scan_0012.pdf', pdf(visura(NOI, '15/10/2026')), giusto('visura'))],
    attesi: { visura: ['scan_0012.pdf'] } })

  S.push({ nome: 'visura di altra azienda col nome giusto', tipi: ['visura'],
    documenti: [doc('visura camerale officine.pdf', pdf(visura(ALTRA, '20/10/2026')), nonBuono('visura'))],
    attesi: { visura: [] } })

  S.push({ nome: 'visura vecchia di nove mesi', tipi: ['visura'],
    documenti: [doc('visura.pdf', pdf(visura(NOI, '01/02/2026')), nonBuono('visura'))],
    attesi: { visura: [] } })

  S.push({ nome: 'due visure valide: vince la più recente', tipi: ['visura'],
    documenti: [
      doc('visura_settembre.pdf', pdf(visura(NOI, '02/09/2026', 'attiva', 2)), giusto('visura'), g(2026, 11, 1)),
      doc('visura_ottobre.pdf', pdf(visura(NOI, '15/10/2026', 'attiva', 3)), giusto('visura'), g(2026, 10, 15)),
    ],
    attesi: { visura: ['visura_ottobre.pdf'] } })

  S.push({ nome: 'nomina RSPP giusta e nomina del medico competente (non è un dato sanitario)', tipi: ['nomina'],
    documenti: [
      doc('lettera.pdf', pdf(nominaRspp(NOI, '10/03/2025')), giusto('nomina')),
      doc('nomina_mc.pdf', pdf(nominaMc(NOI, '02/02/2026')), giusto('nomina')),
    ],
    attesi: { nomina: ['lettera.pdf', 'nomina_mc.pdf'] } })

  S.push({ nome: 'nomina RSPP senza accettazione e nomina di altra azienda', tipi: ['nomina'],
    documenti: [
      doc('rspp_bozza.pdf', pdf(nominaRspp(NOI, '10/03/2025', false)), nonBuono('nomina')),
      doc('rspp_metalli.pdf', pdf(nominaRspp(ALTRA, '10/03/2025')), nonBuono('nomina')),
    ],
    attesi: { nomina: [] } })

  S.push({ nome: 'attestati: codice fiscale noto, persona sconosciuta, solo nome e cognome, preposto scaduto', tipi: ['attestato_formazione'],
    documenti: [
      doc('att_carrelli.pdf', pdf(attestato('Corso per addetti alla conduzione di carrelli elevatori semoventi', 'Giulia Bianchi, codice fiscale BNCGLI82B41F205Y,', '15/05/2024')), giusto('attestato_formazione')),
      doc('att_sconosciuto.pdf', pdf(attestato('Corso per addetti alla conduzione di carrelli elevatori semoventi', 'Franco Blu, codice fiscale BLUFNC75D15F205W,', '15/05/2024')), nonBuono('attestato_formazione')),
      doc('att_specifica.pdf', pdf(attestato('Formazione specifica dei lavoratori rischio alto', 'il sig. Luca Verdi', '10/09/2025')), giusto('attestato_formazione')),
      doc('att_preposto.pdf', pdf(attestato('Corso di formazione per preposti', 'Marco Rossi, codice fiscale RSSMRC80A01F205X,', '01/03/2024', 12)), nonBuono('attestato_formazione')),
    ],
    attesi: { attestato_formazione: ['att_carrelli.pdf', 'att_specifica.pdf'] } })

  S.push({ nome: 'SDS di un fornitore e SDS vecchia', tipi: ['sds'],
    documenti: [
      doc('SG40_IT.pdf', pdf(sds('Sgrassante Industriale SG40', '12/01/2024')), giusto('sds')),
      doc('vernice.pdf', pdf(sds('Vernice VX', '20/05/2011')), nonBuono('sds')),
    ],
    attesi: { sds: ['SG40_IT.pdf'] } })

  S.push({ nome: 'verbale messa a terra giusto e verbale scaduto', tipi: ['verbale_verifica'],
    documenti: [
      doc('verbale_2025.pdf', pdf(verbaleTerra(NOI, '20/06/2025', '20/06/2027')), giusto('verbale_verifica'), g(2025, 6, 21)),
      doc('verbale_2021.pdf', pdf(verbaleTerra(NOI, '10/05/2021', '10/05/2023')), nonBuono('verbale_verifica'), g(2021, 5, 11)),
    ],
    attesi: { verbale_verifica: ['verbale_2025.pdf'] } })

  S.push({ nome: 'DVR precedente e fattura del consulente', tipi: ['dvr'],
    documenti: [
      doc('DVR_rev2.pdf', pdf(dvr(NOI, '15/01/2025')), giusto('dvr')),
      doc('fattura_118.pdf', pdf(FATTURA_DVR), nonBuono('nessuno')),
    ],
    attesi: { dvr: ['DVR_rev2.pdf'] } })

  S.push({ nome: 'giudizio di idoneità: escluso anche se si cerca una nomina', tipi: ['nomina', 'attestato_formazione'],
    documenti: [doc('documento_rossi.pdf', pdf(giudizioIdoneita(NOI)), nonBuono('sanitario'))],
    attesi: { nomina: [], attestato_formazione: [] } })

  S.push({ nome: 'elenco dei lavoratori in CSV e libretto del costruttore', tipi: ['elenco_lavoratori', 'libretto_attrezzatura'],
    documenti: [
      doc('personale.csv', Buffer.from(ELENCO_CSV), giusto('elenco_lavoratori')),
      doc('tornio.pdf', pdf(libretto()), giusto('libretto_attrezzatura')),
    ],
    attesi: { elenco_lavoratori: ['personale.csv'], libretto_attrezzatura: ['tornio.pdf'] } })

  S.push({ nome: 'cartella con rumore, zip, scansione da leggere con OCR e giudizio nascosto', tipi: ['visura', 'nomina', 'verbale_verifica'],
    documenti: [
      ...Array.from({ length: 60 }, (_, i) => doc(`documento_${i}.pdf`, pdf(RUMORE[i % RUMORE.length]!(i)), nonBuono('nessuno'))),
      doc('pratiche.zip', zip([['sub/allegato_7.pdf', pdf(verbaleTerra(NOI, '20/06/2025', '20/06/2027'))], ['note.txt', Buffer.from('ciao')]]), nonBuono('nessuno'), undefined, { 'allegato_7.pdf': giusto('verbale_verifica') }),
      doc('scansione_nomina.pdf', scansione('nomina'), giusto('nomina')),
      doc('IMG_4432.jpg', foto('giudizio'), nonBuono('sanitario')),
      doc('visura_cliente.pdf', pdf(visura(ALTRA, '05/11/2026')), nonBuono('visura')),
      doc('visura_noi.pdf', pdf(visura(NOI, '01/11/2026')), giusto('visura')),
    ],
    ocr: { nomina: nominaRspp(NOI, '10/03/2025'), giudizio: giudizioIdoneita(NOI) },
    attesi: { visura: ['visura_noi.pdf'], nomina: ['scansione_nomina.pdf'], verbale_verifica: ['allegato_7.pdf'] } })

  return S
}

export const contaDocumenti = (S: Caso[]): number => S.reduce((n, s) => n + s.documenti.length + s.documenti.reduce((m, d) => m + Object.keys(d.dentro ?? {}).length, 0), 0)
