import { creaMotore, mappaLettura, riguarda, type Lettura, type Orologio } from './motore';

function orologioFinto() {
  let t = 0;
  let prossimo = 1;
  const voci = new Map<number, { quando: number; f: () => void }>();
  const o: Orologio = {
    imposta: (f, ms) => {
      const id = prossimo++;
      voci.set(id, { quando: t + ms, f });
      return id;
    },
    annulla: (h) => voci.delete(h as number),
  };
  const avanza = async (ms: number) => {
    t += ms;
    for (const [id, v] of Array.from(voci.entries()).sort((a, b) => a[1].quando - b[1].quando)) {
      if (v.quando <= t) {
        voci.delete(id);
        v.f();
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await new Promise((r) => setTimeout(r, 0));
  };
  return { o, avanza, pendenti: () => voci.size };
}

const lettura = (p: Partial<Lettura> = {}): Lettura => ({ eventi: [], cursore: 'c1', nonLette: 0, altri: false, canale: { driver: 'ricarica', attesa: 30 }, ...p });
const attendi = () => new Promise((r) => setTimeout(r, 0));

describe('motore del tempo reale', () => {
  it('legge subito senza cursore, poi ogni 30 secondi con il cursore', async () => {
    const { o, avanza } = orologioFinto();
    const chiamate: Array<string | null> = [];
    const m = creaMotore({ leggi: async (c) => (chiamate.push(c), lettura({ cursore: `c${chiamate.length}` })), consegna: () => undefined, orologio: o });
    m.avvia();
    await attendi();
    expect(chiamate).toEqual([null]);
    await avanza(29_000);
    expect(chiamate).toHaveLength(1);
    await avanza(1_000);
    expect(chiamate).toEqual([null, 'c1']);
  });

  it('in background non legge; al ritorno legge subito', async () => {
    const { o, avanza, pendenti } = orologioFinto();
    let n = 0;
    const m = creaMotore({ leggi: async () => (n++, lettura()), consegna: () => undefined, orologio: o });
    m.avvia();
    await attendi();
    m.sospendi();
    expect(pendenti()).toBe(0);
    await avanza(120_000);
    expect(n).toBe(1);
    m.riprendi();
    await attendi();
    expect(n).toBe(2);
  });

  it('con altri eventi in coda rilegge subito, con un tetto', async () => {
    const { o } = orologioFinto();
    let n = 0;
    const m = creaMotore({ leggi: async () => (n++, lettura({ altri: true })), consegna: () => undefined, orologio: o });
    m.avvia();
    await new Promise((r) => setTimeout(r, 5));
    expect(n).toBe(5);
  });

  it('dopo un errore rallenta e poi torna al passo normale', async () => {
    const { o, avanza } = orologioFinto();
    let n = 0;
    let rompi = true;
    const m = creaMotore({
      leggi: async () => {
        n++;
        if (rompi) throw new Error('rete');
        return lettura();
      },
      consegna: () => undefined,
      orologio: o,
    });
    m.avvia();
    await attendi();
    expect(m.stato().errori).toBe(1);
    await avanza(30_000);
    expect(m.stato().errori).toBe(2);
    await avanza(30_000);
    expect(n).toBe(2); // il secondo errore aspetta 60 s
    rompi = false;
    await avanza(30_000);
    expect(n).toBe(3);
    expect(m.stato().errori).toBe(0);
  });

  it('rispetta l attesa del backend (minimo 10 secondi) e collega il driver indicato', async () => {
    const { o, avanza } = orologioFinto();
    let n = 0;
    const collegati: string[] = [];
    let sveglia: (() => void) | null = null;
    const m = creaMotore({
      leggi: async () => (n++, lettura({ canale: { driver: 'gestito', attesa: 2 } })),
      consegna: () => undefined,
      orologio: o,
      driver: (nome) => ({ nome, collega: (s) => (collegati.push(nome), (sveglia = s), () => undefined) }),
    });
    m.avvia();
    await attendi();
    expect(collegati).toEqual(['gestito']);
    await avanza(10_000);
    expect(n).toBe(2);
    sveglia!();
    await attendi();
    expect(n).toBe(3);
    expect(collegati).toEqual(['gestito']);
  });

  it('fermato non legge piu e dimentica il cursore', async () => {
    const { o, avanza } = orologioFinto();
    let n = 0;
    const m = creaMotore({ leggi: async () => (n++, lettura()), consegna: () => undefined, orologio: o });
    m.avvia();
    await attendi();
    m.ferma();
    await avanza(100_000);
    expect(n).toBe(1);
    expect(m.stato().cursore).toBeNull();
  });
});

describe('risposta del feed', () => {
  it('mappa eventi validi e scarta quelli strani', () => {
    const l = mappaLettura({
      data: {
        eventi: [
          { chiave: 'n3', tipo: 'novita', azienda_id: 4, quando: '2026-10-30T10:00:00Z', novita: { evento: 'portale.nuovo_assunto', titolo: 'Nuovo assunto' } },
          { chiave: 'c9', tipo: 'cambiamento', azienda_id: null, cambiamento: { tipo: 'normativa_nuova', etichetta: 'Normativa' } },
          { chiave: 'x', tipo: 'altro' },
          'rotto',
        ],
        cursore: 'abc',
        non_lette: 2,
        altri: true,
        canale: { driver: 'ricarica', attesa: 30 },
      },
    });
    expect(l.eventi.map((e) => [e.chiave, e.aziendaId, e.cosa, e.etichetta])).toEqual([
      ['n3', 4, 'portale.nuovo_assunto', 'Nuovo assunto'],
      ['c9', null, 'normativa_nuova', 'Normativa'],
    ]);
    expect(l).toMatchObject({ cursore: 'abc', nonLette: 2, altri: true });
    expect(mappaLettura(null)).toMatchObject({ eventi: [], cursore: '', canale: { driver: 'ricarica', attesa: 30 } });
  });

  it('riguarda la schermata solo se e della stessa azienda o generale', () => {
    const e = { chiave: 'c1', tipo: 'cambiamento' as const, aziendaId: 4, quando: null, cosa: '', etichetta: '' };
    expect(riguarda(e, 4)).toBe(true);
    expect(riguarda(e, 5)).toBe(false);
    expect(riguarda(e, null)).toBe(true);
    expect(riguarda({ ...e, aziendaId: null }, 5)).toBe(true);
  });
});
