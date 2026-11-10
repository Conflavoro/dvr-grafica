// Portate da FondoFormazione (tests/cerca-file.test.mjs), con i tipi HSE.
import { capacitaBrowser, cartellaDaFile, fileDaIgnorare, scansiona, testoDaPdf, valutaContenuto, valutaFile } from './cerca-file'
import type { Trovato, VoceCartella, VoceFile } from './cerca-file'
import { file, pdf, pdfNonCompresso } from './__prove__/costruttori'

const VISURA = 'Visura ordinaria - Registro delle Imprese - Numero REA 12345 - Forma giuridica srl'

describe('ricerca dei file: nomi, cartelle, lettura dei PDF', () => {
  it('il testo dei PDF si legge anche con i flussi compressi', async () => {
    for (const b of [pdfNonCompresso(VISURA), pdf(VISURA)]) {
      const t = await testoDaPdf(new Uint8Array(b).buffer)
      expect(t).toMatch(/Visura ordinaria/)
      expect(t).toMatch(/Registro delle Imprese/)
    }
  })

  it('dal contenuto si riconosce il tipo di documento', () => {
    expect(valutaContenuto('VISURA ORDINARIA - Registro delle Imprese - Numero REA MI-123', { tipi: ['visura'] }).tipo).toBe('visura')
    expect(valutaContenuto('Scheda di dati di sicurezza Regolamento (CE) n. 1907/2006', { tipi: ['sds', 'visura'] }).tipo).toBe('sds')
    expect(valutaContenuto('Lettera di nomina del medico competente', { tipi: ['nomina', 'dvr'] }).tipo).toBe('nomina')
    expect(valutaContenuto('ricetta della nonna', { tipi: ['visura'] }).punteggio).toBe(0)
  })

  it('una scansione con nome qualunque, che è una visura, viene trovata dal contenuto; le ricette no', async () => {
    const files = [
      file('scansione_0042.pdf', pdf(VISURA), 'Documenti/Azienda/scansione_0042.pdf'),
      file('ricetta.pdf', pdf('Tagliatelle al ragu'), 'Documenti/ricetta.pdf'),
      file('visura-camerale-2026.pdf', pdf('qualcosa'), 'Documenti/visura-camerale-2026.pdf'),
      file('note.exe', Buffer.from('x'), 'Documenti/note.exe'),
    ]
    const trovati: Trovato[] = []
    await scansiona(cartellaDaFile(files), { tipi: ['visura'], parole_chiave: [] }, t => trovati.push(t))
    expect(trovati.map(t => t.nome).sort()).toEqual(['scansione_0042.pdf', 'visura-camerale-2026.pdf'])
    const s = trovati.find(t => t.nome === 'scansione_0042.pdf')!
    expect(s.tipo).toBe('visura')
    expect(s.percorso).toBe('Azienda/scansione_0042.pdf')
  })

  it('una cartella scelta con webkitdirectory si scorre come una cartella vera, la cartella di raccolta no', async () => {
    const albero = cartellaDaFile([file('a.pdf', Buffer.from('x'), 'Radice/a.pdf'), file('b.pdf', Buffer.from('x'), 'Radice/sotto/b.pdf')])
    expect(albero.name).toBe('Radice')
    const nomi: string[] = []
    for await (const v of albero.values()) nomi.push(v.kind + ':' + v.name)
    expect(nomi.sort()).toEqual(['directory:sotto', 'file:a.pdf'])
    const conRaccolta = cartellaDaFile([file('v.pdf', pdf(VISURA), 'R/DVR Conflavoro/v.pdf')])
    const trovati: Trovato[] = []
    const eventi: string[] = []
    await scansiona(conRaccolta, { tipi: ['visura'], parole_chiave: [] }, t => trovati.push(t), { suEvento: e => eventi.push(e.tipo) })
    expect(trovati).toHaveLength(0)
    expect(eventi).toContain('salto')
  })

  it('i file di sistema, le miniature e i temporanei di Office si saltano; maiuscole, accenti e firmati no', () => {
    for (const n of ['.DS_Store', 'Thumbs.db', 'desktop.ini', '~$nomina.docx', '.hidden.pdf', 'note.exe']) expect(fileDaIgnorare(n)).toBe(true)
    for (const n of ['NOMINA RSPP.PDF', 'Attestato Formazione 2026.pdf', 'nomina rspp.pdf.p7m', 'Elenco dipendenti.xlsx', 'personale.csv']) expect(fileDaIgnorare(n)).toBe(false)
    expect(valutaFile('NOMINA RSPP.PDF', { tipi: ['nomina'], parole_chiave: [] }).punteggio).toBeGreaterThanOrEqual(10)
    expect(valutaFile('Nomina_Medico_Competente.pdf.p7m', { tipi: ['nomina'], parole_chiave: [] }).tipo).toBe('nomina')
    expect(valutaFile('SDS sgrassante.pdf', { tipi: ['sds'], parole_chiave: [] }).tipo).toBe('sds')
    expect(valutaFile('Elenco dipendenti.xlsx', { tipi: ['elenco_lavoratori', 'nomina'], parole_chiave: [] }).tipo).toBe('elenco_lavoratori')
  })

  it('una cartella che non si legge non ferma la ricerca', async () => {
    const rotta: VoceCartella = { kind: 'directory', name: 'rotta', values: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('permesso negato')) }) }) }
    const buona: VoceFile = { kind: 'file', name: 'v.pdf', getFile: async () => file('v.pdf', pdf(VISURA)) }
    const radice: VoceCartella = { kind: 'directory', name: 'R', async* values() { yield rotta; yield buona } }
    const trovati: Trovato[] = []
    await scansiona(radice, { tipi: ['visura'], parole_chiave: [] }, t => trovati.push(t))
    expect(trovati.map(t => t.nome)).toEqual(['v.pdf'])
  })

  it('il browser dice la verità su come si scelgono i documenti', () => {
    const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
    const ff = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
    expect(capacitaBrowser({ ua: win, picker: true, cartella: true, puntatoreFine: true })).toEqual({ nome: 'Chrome', sistema: 'Windows', modo: 'picker', frase: '' })
    const s = capacitaBrowser({ ua: mac, picker: false, cartella: true, puntatoreFine: true })
    expect(s.modo).toBe('cartella')
    expect(s.frase).toMatch(/Safari su macOS non lascia a Falco/)
    expect(capacitaBrowser({ ua: ff, picker: false, cartella: true, puntatoreFine: true }).frase).toMatch(/Firefox su Linux/)
    expect(capacitaBrowser({ ua: iphone, picker: false, cartella: true, puntatoreFine: false }).modo).toBe('file')
    expect(capacitaBrowser({ ua: iphone, picker: false, cartella: true, puntatoreFine: false }).frase).toMatch(/iPhone/)
    expect(capacitaBrowser({ ua: android, picker: true, cartella: false, puntatoreFine: false }).modo).toBe('file')
    expect(capacitaBrowser({ ua: ff, picker: false, cartella: false, puntatoreFine: true }).modo).toBe('file')
  })
})
