// Ricerca per contenuto (portata da FondoFormazione, tests/cerca-intelligente.test.mjs): una cartella difficile con nomi
// casuali, esche di altre aziende, scansioni, zip, p7m e dati sanitari.
import { cartellaDaFile, cercaInCartella, scansiona, valutaFileScelti } from './cerca-file'
import type { EventoLavoro, Trovato, VoceFile } from './cerca-file'
import { riconosci } from './riconosci'
import { contenutoP7m, testoDaDocx, vociZip } from './archivio'
import { file, foto, lettoriFinti, p7m, pdf, scansione, zip } from './__prove__/costruttori'
import { attestato, giudizioIdoneita, IMPRESA, nominaMc, nominaRspp, OGGI, sds, verbaleTerra, visura } from './__prove__/banco-documenti'

const NOI = { den: 'Officine Brianza S.r.l.', cf: '12345670966' }
const ALTRA = { den: 'Metalli Nord S.p.A.', cf: '98765432109' }
const oggi = () => OGGI.getTime()

function cartellaDifficile() {
  return cartellaDaFile([
    file('scan_0012.pdf', pdf(visura(NOI, '15/10/2026')), 'PC/Documenti/Contabilita/scan_0012.pdf'),
    file('visura camerale aggiornata.pdf', pdf(visura(ALTRA, '30/10/2026', 'attiva', 2, 'Giorgio Neri')), 'PC/Documenti/Clienti/visura camerale aggiornata.pdf'),
    file('IMG_4432.jpg', foto('giudizio'), 'PC/Download/IMG_4432.jpg'),
    file('pratiche_2026.zip', zip([['sub/allegato_7.pdf', pdf(verbaleTerra(NOI, '20/06/2025', '20/06/2027'))], ['note.txt', Buffer.from('ciao')]]), 'PC/Download/pratiche_2026.zip'),
    file('x9f3.pdf.p7m', p7m(pdf(nominaMc(NOI, '02/02/2026'))), 'PC/Documenti/Posta/x9f3.pdf.p7m'),
    file('scansione.pdf', scansione('rspp'), 'PC/Documenti/scansione.pdf'),
    file('ricetta.pdf', pdf('Tagliatelle al ragu'), 'PC/Documenti/ricetta.pdf'),
  ])
}
const lettori = lettoriFinti({ giudizio: giudizioIdoneita(NOI), rspp: nominaRspp(NOI, '10/03/2025') })

describe('ricerca per contenuto', () => {
  it('cartella difficile: nomi casuali, esca di un\'altra azienda, scansione, zip, p7m, dato sanitario', async () => {
    const trovati: Trovato[] = []
    const eventi: EventoLavoro[] = []
    const esito = await scansiona(cartellaDifficile(), { tipi: ['visura', 'nomina', 'verbale_verifica'], parole_chiave: [], impresa: IMPRESA }, t => trovati.push(t), { lettori, suEvento: e => eventi.push(e), oggi })
    const per = (tipo: string) => trovati.filter(t => t.tipo === tipo).sort((a, b) => b.punteggio - a.punteggio)
    expect(per('visura').map(t => t.nome)).toEqual(['scan_0012.pdf'])
    expect(esito.scartati).toBe(1)
    expect(eventi.some(e => e.tipo === 'scartato' && /altra azienda/.test(e.motivo))).toBe(true)
    expect(per('nomina').map(t => t.nome).sort()).toEqual(['scansione.pdf', 'x9f3.pdf.p7m'])
    expect(per('verbale_verifica')[0]!.percorso).toMatch(/pratiche_2026\.zip › sub\/allegato_7\.pdf/)
    expect(trovati.some(t => t.nome === 'ricetta.pdf')).toBe(false)
    // Il giudizio di idoneità letto dalla foto è escluso, mai spuntato.
    const giudizio = trovati.find(t => t.nome === 'IMG_4432.jpg')!
    expect(giudizio.verdetto).toBe('escluso')
    expect(giudizio.problema).toMatch(/dato sanitario: lo conserva il medico competente, non si carica/)
    expect(esito.esclusi).toBe(1)
    // La spiegazione dice perché.
    const v = per('visura')[0]!
    expect(v.verdetto).toBe('giusto')
    expect(v.motivi!.join(' | ')).toMatch(/codice fiscale 12345670966/)
    expect(v.descrizione).toMatch(/visura camerale di Officine Brianza/)
    expect(eventi.some(e => e.tipo === 'ocr')).toBe(true)
    expect(eventi.some(e => e.tipo === 'archivio')).toBe(true)
  })

  it('il file dentro lo zip si può caricare come un file vero', async () => {
    const voci: [Trovato, VoceFile][] = []
    await scansiona(cartellaDifficile(), { tipi: ['verbale_verifica'], parole_chiave: [], impresa: IMPRESA }, (t, voce) => voci.push([t, voce]), { lettori, oggi })
    const [, voce] = voci.find(([t]) => t.nome === 'allegato_7.pdf')!
    const f = await voce.getFile() as File
    expect(f.name).toBe('allegato_7.pdf')
    expect(Buffer.from(await f.arrayBuffer()).toString('latin1')).toMatch(/%PDF/)
  })

  it('il nome conta quasi nulla: un file chiamato nomina senza nomina dentro sta in fondo', async () => {
    const cartella = cartellaDaFile([
      file('nomina rspp.pdf', pdf('qualcosa di diverso'), 'P/nomina rspp.pdf'),
      file('qwerty.pdf', pdf(nominaRspp(NOI, '10/03/2025')), 'P/qwerty.pdf'),
    ])
    const trovati: Trovato[] = []
    await scansiona(cartella, { tipi: ['nomina'], parole_chiave: [], impresa: IMPRESA }, t => trovati.push(t), { oggi })
    const ordinati = trovati.sort((a, b) => b.punteggio - a.punteggio)
    expect(ordinati[0]!.nome).toBe('qwerty.pdf')
    expect(ordinati[0]!.punteggio).toBeGreaterThan(20)
    expect(ordinati[1]!.punteggio).toBeLessThan(10)
    expect(ordinati[1]!.problema).toMatch(/dentro non trovo le diciture/)
  })

  it('riconoscimento: codice di un\'altra azienda = scartato; SDS e attestati con la partita IVA di altri no', () => {
    expect(riconosci(visura(ALTRA, '01/11/2026'), ['visura'], IMPRESA).altraAzienda).toBe(true)
    expect(riconosci(visura(ALTRA, '01/11/2026'), ['visura'], null).altraAzienda).toBe(false)
    expect(riconosci(sds('Sgrassante', '12/01/2024'), ['sds'], IMPRESA).altraAzienda).toBe(false)
    expect(riconosci(attestato('Corso preposti', 'Marco Rossi', '01/03/2026'), ['attestato_formazione'], IMPRESA).altraAzienda).toBe(false)
    const ok = riconosci(visura(NOI, '01/11/2026'), ['visura'], IMPRESA)
    expect(ok.tipo).toBe('visura')
    expect(ok.motivi.some(x => /Officine Brianza/.test(x))).toBe(true)
  })

  it('zip, p7m e docx si aprono', async () => {
    const voci = vociZip(new Uint8Array(zip([['a.txt', Buffer.from('ciao')]])))
    expect(voci).toHaveLength(1)
    expect(Buffer.from(await voci[0]!.leggi()).toString()).toBe('ciao')
    expect(contenutoP7m(new Uint8Array(Buffer.concat([Buffer.from('xx'), pdf('a')])))!.tipo).toBe('pdf')
    const docx = zip([['word/document.xml', Buffer.from('<w:document><w:p><w:r><w:t>Lettera di nomina RSPP</w:t></w:r></w:p></w:document>')]])
    expect(await testoDaDocx(new Uint8Array(docx))).toMatch(/nomina RSPP/)
  })

  it('appena trova con certezza ciò che serve si ferma e non apre il resto della cartella, né usa l\'OCR', async () => {
    const altri = Array.from({ length: 80 }, (_, i) => file(`documento_${i}.pdf`, pdf('Fattura numero ' + i + ' importo 100 euro'), `PC/Documenti/documento_${i}.pdf`))
    const radice = cartellaDaFile([file('scan_0012.pdf', pdf(visura(NOI, '15/10/2026')), 'PC/Documenti/scan_0012.pdf'), ...altri, file('IMG_1.jpg', Buffer.from('jpeg'), 'PC/Documenti/IMG_1.jpg')])
    let ocr = 0
    const l = { ocrImmagine: async () => { ocr++; return '' }, ocrPdf: async () => { ocr++; return '' } }
    const r = await cercaInCartella(radice, { tipi: ['visura'], parole_chiave: [], impresa: IMPRESA }, { lettori: l, oggi })
    expect(r.trovati[0]?.nome).toBe('scan_0012.pdf')
    expect(ocr).toBe(0)
    expect(r.esito.letti).toBe(1)
    expect(r.proposte.map(p => p.trovato.nome)).toEqual(['scan_0012.pdf'])
  })

  it('per i tipi multipli si ferma solo quando ha tutte le chiavi che servono', async () => {
    const altri = Array.from({ length: 30 }, (_, i) => file(`doc_${i}.pdf`, pdf('Appunti vari ' + i), `PC/doc_${i}.pdf`))
    const radice = () => cartellaDaFile([file('a.pdf', pdf(nominaRspp(NOI, '10/03/2025')), 'PC/a.pdf'), file('b.pdf', pdf(nominaMc(NOI, '02/02/2026')), 'PC/b.pdf'), ...altri])
    const conServono = await cercaInCartella(radice(), { tipi: ['nomina'], parole_chiave: [], impresa: IMPRESA, servono: { nomina: ['rspp', 'medico_competente'] } }, { oggi })
    const senza = await cercaInCartella(radice(), { tipi: ['nomina'], parole_chiave: [], impresa: IMPRESA }, { oggi })
    expect(conServono.proposte.map(p => p.chiave).sort()).toEqual(['medico_competente', 'rspp'])
    expect(conServono.esito.letti).toBe(2)
    expect(senza.esito.letti).toBe(32)
  })

  it('se i documenti a testo non bastano, legge le scansioni con l\'OCR nel secondo giro', async () => {
    const radice = cartellaDaFile([file('foto_documento.jpg', foto('v'), 'PC/Documenti/foto_documento.jpg'), file('nota.pdf', pdf('Appunti vari'), 'PC/Documenti/nota.pdf')])
    const trovati: Trovato[] = []
    await scansiona(radice, { tipi: ['visura'], parole_chiave: [], impresa: IMPRESA }, t => trovati.push(t), { lettori: lettoriFinti({ v: visura(NOI, '15/10/2026') }), oggi })
    expect(trovati[0]?.nome).toBe('foto_documento.jpg')
  })

  it('il limite delle scansioni OCR si rispetta', async () => {
    const foto20 = Array.from({ length: 20 }, (_, i) => file(`f${i}.jpg`, foto('x'), `P/f${i}.jpg`))
    let ocr = 0
    await scansiona(cartellaDaFile(foto20), { tipi: ['visura'], parole_chiave: [], impresa: IMPRESA }, () => {}, { lettori: { ocrImmagine: async () => { ocr++; return '' } }, oggi })
    expect(ocr).toBe(12)
  })

  it('dal telefono: i file scelti a mano si valutano con le stesse regole', async () => {
    const scelti = [
      file('IMG_0001.jpg', foto('att')),
      file('WhatsApp Document.pdf', pdf(nominaRspp(NOI, '10/03/2025'))),
      file('referto.pdf', pdf(giudizioIdoneita(NOI))),
    ]
    const r = await valutaFileScelti(scelti, { tipi: [], parole_chiave: [], impresa: IMPRESA }, { lettori: lettoriFinti({ att: attestato('Corso per addetti antincendio livello 2', 'Giulia Bianchi, codice fiscale BNCGLI82B41F205Y,', '10/01/2025', 8) }), oggi })
    const per = (n: string) => r.trovati.find(t => t.nome === n)!
    expect(per('WhatsApp Document.pdf').verdetto).toBe('giusto')
    expect(per('IMG_0001.jpg').tipo).toBe('attestato_formazione')
    expect(per('IMG_0001.jpg').chiave).toBe('BNCGLI82B41F205Y|antincendio')
    expect(per('referto.pdf').verdetto).toBe('escluso')
    expect(r.proposte.map(p => p.trovato.nome).sort()).toEqual(['IMG_0001.jpg', 'WhatsApp Document.pdf'])
  })
})
