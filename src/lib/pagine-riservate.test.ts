import { paginaConsentita } from './pagine-riservate';

describe('paginaConsentita', () => {
  it('blocca al consulente le pagine di gestione dello studio e della piattaforma', () => {
    for (const p of ['/team/', '/utenti', '/utenti/importa/', '/tenants/', '/piattaforma/audit/']) {
      expect(paginaConsentita('consulente', p)).toBe(false);
    }
  });
  it('il titolare gestisce team e utenti ma non gli studi affiliati', () => {
    expect(paginaConsentita('titolare_studio', '/team/')).toBe(true);
    expect(paginaConsentita('titolare_studio', '/utenti/')).toBe(true);
    expect(paginaConsentita('titolare_studio', '/tenants/')).toBe(false);
  });
  it("l'admin Conflavoro entra ovunque e le pagine operative restano libere", () => {
    expect(paginaConsentita('admin_conflavoro', '/tenants/')).toBe(true);
    expect(paginaConsentita('consulente', '/aziende/scheda/')).toBe(true);
    expect(paginaConsentita('datore_lavoro', '/agente/')).toBe(true);
    expect(paginaConsentita('consulente', '/teamwork/')).toBe(true);
  });
});
