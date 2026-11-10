import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { battute, mapPassiInterfaccia, pianoEsecuzione, posizioneCursore, riassunto, stessaRotta } from './interfaccia';

describe('passi dell\'interfaccia del Falco', () => {
  it('tiene solo passi validi con rotte delle due app', () => {
    const p = mapPassiInterfaccia([
      { tipo: 'apri', rotta: '/azienda/scadenze/', sezione: 'azienda.scadenze', azienda_id: 7, etichetta: 'Apro lo scadenziario' },
      { tipo: 'apri', rotta: 'https://altro.sito/x/' },
      { tipo: 'apri', rotta: '/azienda/../admin/' },
      { tipo: 'esegui', rotta: '/azienda/scadenze/' },
      { tipo: 'tocca', rotta: '/azienda/persone/' },
      { tipo: 'evidenzia', rotta: '/azienda/persone/', elemento: 'a"]; script' },
      { tipo: 'compila', rotta: '/azienda/persone/', campo: 'assunto_nome', valore: 'Mario' },
    ]);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ tipo: 'apri', aziendaId: 7, etichetta: 'Apro lo scadenziario' });
    expect(p[1]).toMatchObject({ tipo: 'compila', campo: 'assunto_nome', valore: 'Mario', aziendaId: null });
    expect(mapPassiInterfaccia(null)).toEqual([]);
  });

  it('pianifica: azienda prima di navigare, niente navigazione sulla stessa schermata', () => {
    const passi = mapPassiInterfaccia([
      { tipo: 'apri', rotta: '/azienda/persone/', azienda_id: 3, etichetta: 'Apro i dipendenti' },
      { tipo: 'tocca', rotta: '/azienda/persone/', azienda_id: 3, elemento: 'nuovo_assunto', etichetta: 'Apro il nuovo assunto' },
      { tipo: 'compila', rotta: '/azienda/persone/', azienda_id: 3, campo: 'assunto_mansione', valore: 'Magazziniere', etichetta: 'Scrivo la mansione' },
    ]);
    const ops = pianoEsecuzione(passi, { percorso: '/demo/azienda/dashboard/', aziendaId: 1, basePath: '/demo' });
    expect(ops.map((o) => o.op)).toEqual(['riga', 'azienda', 'naviga', 'punta', 'riga', 'punta', 'riga', 'scrivi']);
    expect(ops[1]).toEqual({ op: 'azienda', id: 3 });
    expect(ops[5]).toEqual({ op: 'punta', selettore: '[data-falco="nuovo_assunto"]', tocca: true });
    expect(ops[7]).toEqual({ op: 'scrivi', selettore: '[data-falco-campo="assunto_mansione"]', valore: 'Magazziniere' });

    const qui = pianoEsecuzione(passi.slice(0, 1), { percorso: '/azienda/persone', aziendaId: 3 });
    expect(qui.map((o) => o.op)).toEqual(['riga', 'punta']);
  });

  it('confronta i percorsi con basePath e senza barra finale', () => {
    expect(stessaRotta('/demo/gestionale/dvr', '/gestionale/dvr/', '/demo')).toBe(true);
    expect(stessaRotta('/gestionale/dvr/?x=1', '/gestionale/dvr/')).toBe(true);
    expect(stessaRotta('/gestionale/coda/', '/gestionale/dvr/')).toBe(false);
  });

  it('digita a pezzi e riassume la risposta in una frase', () => {
    expect(battute('Ciao')).toEqual(['C', 'Ci', 'Cia', 'Ciao']);
    expect(battute('x'.repeat(200)).length <= 41).toBe(true);
    expect(riassunto('**Fatto.** Ho aperto le scadenze di novembre.')).toBe('Fatto.');
  });
});

// Ogni punto che il Falco puo' mostrare o compilare esiste davvero nell'interfaccia.
describe('catalogo dell\'interfaccia', () => {
  const radice = join(__dirname, '..', '..');
  const catalogo = JSON.parse(readFileSync(join(radice, '..', '..', 'backend-laravel', 'resources', 'agente', 'interfaccia.json'), 'utf8')) as {
    comuni: Record<string, { tocca?: boolean }>;
    sezioni: Record<string, { elementi?: Record<string, { tocca?: boolean }>; campi?: Record<string, unknown> }>;
  };
  const sorgenti: Array<[string, string]> = [];
  const visita = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) visita(p);
      else if (/\.tsx$/.test(n) && !/\.test\./.test(n)) sorgenti.push([p, readFileSync(p, 'utf8')]);
    }
  };
  visita(join(radice, 'components'));

  // Attributo scritto per esteso, oppure nome passato a un componente del kit che lo applica (es. Schede con falco: 'finestra_30').
  const dove = (attr: string, nome: string) =>
    sorgenti.filter(([, s]) => s.includes(`${attr}="${nome}"`) || (s.includes(attr === 'data-falco' ? 'falco:' : 'falcoCampo') && s.includes(`'${nome}'`)));

  it('elementi e campi hanno il loro attributo, i pulsanti da toccare sono segnati', () => {
    const mancanti: string[] = [];
    for (const n of Object.keys(catalogo.comuni)) if (dove('data-falco', n).length === 0) mancanti.push(n);
    for (const [sez, def] of Object.entries(catalogo.sezioni)) {
      for (const [n, d] of Object.entries(def.elementi ?? {})) {
        const f = dove('data-falco', n);
        if (f.length === 0) mancanti.push(`${sez}: ${n}`);
        // Le schede del kit (Schede con falco:) mettono gia' data-falco-tocca.
        else if (d.tocca && !f.some(([, s]) => s.includes('data-falco-tocca') || s.includes(`falco: '${n}'`))) mancanti.push(`${sez}: ${n} senza data-falco-tocca`);
      }
      for (const n of Object.keys(def.campi ?? {})) if (dove('data-falco-campo', n).length === 0) mancanti.push(`${sez}: campo ${n}`);
    }
    expect(mancanti).toEqual([]);
  });

  it('le voci del menu portano il nome della sezione del Falco', () => {
    expect(sorgenti.some(([, s]) => s.includes('data-falco={`menu.${'))).toBe(true);
  });
});

describe('posizioneCursore', () => {
  const vista = { larghezza: 390, altezza: 844 };
  it('punta sul bordo basso: la scritta resta sotto il titolo', () => {
    const r = { left: 16, top: 80, width: 358, height: 160 };
    const p = posizioneCursore(r, vista);
    expect(p.sopra).toBe(false);
    expect(p.y).toBeGreaterThanOrEqual(80 + 160 - 6);
    expect(p.x).toBe(56);
  });
  it('vicino al fondo o sopra la striscia la scritta sale', () => {
    const r = { left: 16, top: 700, width: 200, height: 44 };
    expect(posizioneCursore(r, { ...vista, riservaBasso: 73 }).sopra).toBe(true);
    expect(posizioneCursore(r, vista).sopra).toBe(false);
  });
  it('resta dentro lo schermo', () => {
    expect(posizioneCursore({ left: 380, top: 10, width: 300, height: 20 }, vista).x).toBe(390 - 72);
  });
});

describe('rotta della scheda azienda', () => {
  it('accetta id e sottoscheda, scarta il resto', () => {
    const ok = mapPassiInterfaccia([{ tipo: 'apri', rotta: '/gestionale/aziende/?id=9&tab=persone', azienda_id: 9 }]);
    expect(ok).toHaveLength(1);
    expect(mapPassiInterfaccia([{ tipo: 'apri', rotta: '/aziende/scheda/?id=9' }])).toHaveLength(0);
    expect(mapPassiInterfaccia([{ tipo: 'apri', rotta: '/gestionale/aziende/?id=9&x=https://' }])).toHaveLength(0);
  });
});
