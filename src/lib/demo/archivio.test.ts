import { chiaveDemo, installaPrefisso, PREFISSO_DEMO } from './archivio';

/** Archivio di prova con la stessa forma di Storage (metodi e length sul prototipo). */
class Archivio {
  dati = new Map<string, string>();
  getItem(k: string) {
    return this.dati.has(k) ? (this.dati.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.dati.set(k, String(v));
  }
  removeItem(k: string) {
    this.dati.delete(k);
  }
  key(i: number) {
    return Array.from(this.dati.keys())[i] ?? null;
  }
  clear() {
    this.dati.clear();
  }
  get length() {
    return this.dati.size;
  }
}

describe('archivio della demo dal vivo', () => {
  it('prefissa le chiavi una volta sola', () => {
    expect(chiaveDemo('crm_dvr_jwt')).toBe(`${PREFISSO_DEMO}crm_dvr_jwt`);
    expect(chiaveDemo(`${PREFISSO_DEMO}x`)).toBe(`${PREFISSO_DEMO}x`);
  });

  it('separa la sessione della demo da quella della produzione', () => {
    class Locale extends Archivio {}
    const a = new Locale();
    a.dati.set('crm_dvr_jwt', 'token-produzione');
    installaPrefisso(Locale.prototype);

    expect(a.getItem('crm_dvr_jwt')).toBeNull();
    a.setItem('crm_dvr_jwt', 'token-demo');
    expect(a.getItem('crm_dvr_jwt')).toBe('token-demo');
    expect(a.dati.get('crm_dvr_jwt')).toBe('token-produzione');
    expect(a.dati.get(`${PREFISSO_DEMO}crm_dvr_jwt`)).toBe('token-demo');

    a.removeItem('crm_dvr_jwt');
    expect(a.dati.get('crm_dvr_jwt')).toBe('token-produzione');
    expect(a.dati.has(`${PREFISSO_DEMO}crm_dvr_jwt`)).toBe(false);
  });

  it('length, key e clear vedono solo le chiavi della demo', () => {
    class Sessione extends Archivio {}
    const s = new Sessione();
    s.dati.set('produzione', '1');
    installaPrefisso(Sessione.prototype);
    s.setItem('uno', 'a');
    s.setItem('due', 'b');
    expect(s.length).toBe(2);
    expect([s.key(0), s.key(1)].sort()).toEqual(['due', 'uno']);
    expect(s.key(2)).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
    expect(s.dati.get('produzione')).toBe('1');
  });

  it('installarlo due volte non raddoppia il prefisso', () => {
    class Doppio extends Archivio {}
    installaPrefisso(Doppio.prototype);
    installaPrefisso(Doppio.prototype);
    const d = new Doppio();
    d.setItem('k', 'v');
    expect(Array.from(d.dati.keys())).toEqual([`${PREFISSO_DEMO}k`]);
  });
});
