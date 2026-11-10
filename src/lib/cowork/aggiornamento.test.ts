import { avviaAggiornamento, type OpzioniAggiornamento } from './aggiornamento';
import type { EsitoFlusso } from './api';

/** Orologio finto: i giri si fanno partire a mano e si aspetta che finiscano. */
function orologio() {
  const coda: Array<{ fn: () => void; ms: number }> = [];
  return {
    coda,
    pianifica: (fn: () => void, ms: number) => {
      const h = { fn, ms };
      coda.push(h);
      return h;
    },
    annulla: (h: unknown) => {
      const i = coda.indexOf(h as { fn: () => void; ms: number });
      if (i >= 0) coda.splice(i, 1);
    },
    async avanza() {
      const h = coda.shift();
      if (!h) throw new Error('nessun giro pianificato');
      h.fn();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      return h.ms;
    },
  };
}

const evento = { tipo: 'paragrafo_proposto', documentoTipo: 'dvr', documentoId: 42, sezione: '13', paragrafoId: 1 };

function prepara(risposte: Array<EsitoFlusso | Error>, extra: Partial<OpzioniAggiornamento> = {}) {
  const o = orologio();
  const cursori: Array<string | null> = [];
  const suEventi = jest.fn();
  const suRiserva = jest.fn();
  const suModo = jest.fn();
  const a = avviaAggiornamento({
    leggiFlusso: async (c) => {
      cursori.push(c);
      const r = risposte.shift();
      if (!r) return { esito: 'niente', cursore: c };
      if (r instanceof Error) throw r;
      return r;
    },
    suEventi,
    suRiserva,
    suModo,
    pianifica: o.pianifica,
    annulla: o.annulla,
    ogniMs: 4000,
    riservaMs: 10000,
    ...extra,
  });
  return { o, a, cursori, suEventi, suRiserva, suModo };
}

describe('aggiornamento a cursore', () => {
  it('il primo giro prende solo il cursore, poi gli eventi arrivano con il cursore nuovo', async () => {
    const t = prepara([
      { esito: 'eventi', voci: [evento], cursore: 'c1' },
      { esito: 'niente', cursore: 'c1' },
      { esito: 'eventi', voci: [evento], cursore: 'c2' },
    ]);
    expect(await t.o.avanza()).toBe(0);
    expect(t.suEventi).not.toHaveBeenCalled();
    expect(await t.o.avanza()).toBe(4000);
    expect(await t.o.avanza()).toBe(4000);
    expect(t.suEventi).toHaveBeenCalledTimes(1);
    expect(t.cursori).toEqual([null, 'c1', 'c1']);
    expect(t.o.coda[0].ms).toBe(4000);
    t.a.ferma();
    expect(t.o.coda).toHaveLength(0);
  });

  it('con un cursore iniziale gli eventi del primo giro contano', async () => {
    const t = prepara([{ esito: 'eventi', voci: [evento], cursore: 'c9' }], { cursoreIniziale: 'c8' });
    await t.o.avanza();
    expect(t.suEventi).toHaveBeenCalledWith([evento]);
    expect(t.cursori).toEqual(['c8']);
  });

  it('senza endpoint del flusso passa alla ricarica ogni 10 secondi', async () => {
    const t = prepara([{ esito: 'assente' }]);
    await t.o.avanza();
    expect(t.suModo).toHaveBeenCalledWith('riserva');
    expect(t.a.modo()).toBe('riserva');
    expect(t.o.coda[0].ms).toBe(10000);
    await t.o.avanza();
    expect(t.suRiserva).toHaveBeenCalledTimes(1);
    expect(t.o.coda[0].ms).toBe(10000);
    expect(t.cursori).toHaveLength(1);
  });

  it('dopo un errore riprova più tardi, poi torna al passo normale', async () => {
    const t = prepara([new Error('rete'), new Error('rete'), { esito: 'niente', cursore: 'c1' }]);
    await t.o.avanza();
    expect(t.o.coda[0].ms).toBe(8000);
    await t.o.avanza();
    expect(t.o.coda[0].ms).toBe(16000);
    await t.o.avanza();
    expect(t.o.coda[0].ms).toBe(4000);
  });

  it('a pagina nascosta non interroga il server', async () => {
    let vis = false;
    const t = prepara([{ esito: 'niente', cursore: 'c1' }], { visibile: () => vis });
    await t.o.avanza();
    expect(t.cursori).toHaveLength(0);
    vis = true;
    t.a.subito();
    await t.o.avanza();
    expect(t.cursori).toHaveLength(1);
  });
});
