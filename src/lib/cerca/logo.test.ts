import { valutaLogo, paroleAzienda, valutaLoghiScelti } from './logo'

const az = paroleAzienda('Trattoria Il Glicine Esempio S.a.s.')

test('parole che distinguono l azienda', () => {
  expect(az).toEqual(['trattoria', 'glicine'])
})

test('logo con il nome dell azienda: giusto', () => {
  expect(valutaLogo('Logo_Glicine.png', 40_000, az)?.verdetto).toBe('giusto')
})

test('logo generico o immagine con il nome: da controllare nell anteprima', () => {
  expect(valutaLogo('logo.png', 40_000, az)?.verdetto).toBe('da_controllare')
  expect(valutaLogo('glicine_sala.jpg', 400_000, az)?.verdetto).toBe('da_controllare')
})

test('SVG col nome dentro: giusto anche se il file si chiama logo e basta', () => {
  expect(valutaLogo('logo.svg', 5_000, az, '<svg><text>Trattoria Il Glicine</text></svg>')?.verdetto).toBe('giusto')
})

test('foto qualsiasi, pdf e immagini troppo grandi: non sono candidati', () => {
  expect(valutaLogo('IMG_2031.jpg', 300_000, az)).toBeNull()
  expect(valutaLogo('logo.pdf', 30_000, az)).toBeNull()
  expect(valutaLogo('logo_glicine.png', 3 * 1024 * 1024, az)).toBeNull()
})

test('dal telefono: le immagini scelte con le stesse regole, la migliore prima', async () => {
  const f = (n: string, s = 'x') => new File([s], n)
  const l = await valutaLoghiScelti([f('foto.jpg'), f('logo.png'), f('logo-glicine.png')], 'Trattoria Il Glicine Esempio S.a.s.')
  expect(l.map((x) => x.nome)).toEqual(['logo-glicine.png', 'logo.png'])
  expect(l[0].verdetto).toBe('giusto')
})
