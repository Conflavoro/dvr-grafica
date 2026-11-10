import { statoAnalisi, tipoDaFile } from './archivio'

describe('archivio azienda', () => {
  it('riconosce il tipo dal file, anche dal telefono', () => {
    expect(tipoDaFile({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe('foto')
    expect(tipoDaFile({ type: 'video/quicktime', name: 'a.mov' })).toBe('video')
    expect(tipoDaFile({ type: 'audio/mp4', name: 'nota.m4a' })).toBe('audio')
    expect(tipoDaFile({ type: '', name: 'visura.pdf.p7m' })).toBe('documento')
  })
  it('stato della lettura AI', () => {
    const base = { id: 1, company_id: 1, origine: 'caricato', created_at: '' }
    expect(statoAnalisi({ ...base, tipo: 'foto', filename: 'a.jpg', testo_analisi: null })).toBe('in_lettura')
    expect(statoAnalisi({ ...base, tipo: 'foto', filename: 'a.jpg', testo_analisi: 'Una pressa' })).toBe('letto')
    expect(statoAnalisi({ ...base, tipo: 'video', filename: 'a.mp4', analisi_errore: 'troppo grande' })).toBe('non_letto')
    expect(statoAnalisi({ ...base, tipo: 'nota', testo_analisi: 'x' })).toBe('letto')
  })
})
