import { rottaPortale, schedaAzienda, schedaDvr } from './rotte-nuove'

const STUDIO = '/gestionale/coda/'
const AZIENDA = '/azienda/dashboard/'

describe('rotte vecchie verso il portale', () => {
  it('scheda azienda e DVR vanno nelle schermate nuove', () => {
    expect(rottaPortale('/aziende/scheda/', '?id=10&tab=persone', STUDIO)).toBe('/gestionale/aziende/?id=10&tab=persone')
    expect(rottaPortale('/dvr/scheda', 'id=7', STUDIO)).toBe('/gestionale/dvr/?cowork=7')
    expect(schedaAzienda(3)).toBe('/gestionale/aziende/?id=3')
    expect(schedaDvr(5)).toBe('/gestionale/dvr/?cowork=5')
  })
  it('le altre pagine vecchie atterrano nella sezione giusta o nella home', () => {
    expect(rottaPortale('/sopralluogo/', '', STUDIO)).toBe('/gestionale/sopralluoghi/')
    expect(rottaPortale('/dashboard', '', STUDIO)).toBe(STUDIO)
    expect(rottaPortale('/agente', '', STUDIO)).toBe(STUDIO)
  })
  it("chi sta dal lato azienda torna sempre nella sua area", () => {
    expect(rottaPortale('/dvr/scheda', 'id=7', AZIENDA)).toBe(AZIENDA)
  })
  it('le pagine dello staff senza equivalente restano', () => {
    expect(rottaPortale('/tenants', '', STUDIO)).toBeNull()
  })
})
