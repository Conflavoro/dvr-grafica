import { connessioneCaduta, faseCorrente, recuperaRisposta } from './agente-recupero';
import { mapAgenteProgresso } from './data-source/agente-mappers';
import type { AgenteProgresso } from './data-source';

const senzaAttesa = () => Promise.resolve();

describe('risposta del Falco con la connessione caduta', () => {
  test('solo rete, tempo scaduto e gateway sono recuperabili', () => {
    for (const s of [0, 408, 502, 503, 504]) expect(connessioneCaduta(Object.assign(new Error('x'), { status: s }))).toBe(true);
    for (const s of [403, 422, 429, 500]) expect(connessioneCaduta(Object.assign(new Error('x'), { status: s }))).toBe(false);
    expect(connessioneCaduta(new Error('x'))).toBe(false);
  });

  test("l'avanzamento porta conversazione e risposta salvata", () => {
    const p = mapAgenteProgresso({ eventi: [], piano: null, fine: true, conversazione_id: 7, risposta_id: 42 });
    expect(p.conversazioneId).toBe(7);
    expect(p.rispostaId).toBe(42);
  });

  test('aspetta la risposta salvata leggendo l\'avanzamento', async () => {
    const stati: AgenteProgresso[] = [
      { eventi: [{ t: 'fase', testo: 'Leggo la Scrivania' }], piano: null, fine: false, conversazioneId: 7 },
      { eventi: [], piano: null, fine: true, conversazioneId: 7 },
      { eventi: [], piano: null, fine: true, conversazioneId: 7, rispostaId: 42 },
    ];
    const visti: string[] = [];
    let i = 0;
    const r = await recuperaRisposta(() => Promise.resolve(stati[Math.min(i++, 2)]), 'abc12345', {
      attendi: senzaAttesa,
      onProgresso: (p) => visti.push(faseCorrente(p) ?? ''),
    });
    expect(r).toEqual({ conversazioneId: 7, rispostaId: 42 });
    expect(visti[0]).toBe('Leggo la Scrivania');
  });

  test('si arrende dopo il tempo massimo, senza risposta', async () => {
    let t = 0;
    const r = await recuperaRisposta(() => Promise.resolve({ eventi: [], piano: null, fine: false }), 'abc12345', {
      attendi: (ms) => {
        t += ms;
        return Promise.resolve();
      },
      intervalloMs: 2000,
      maxMs: 10_000,
    });
    expect(r).toBeNull();
    expect(t <= 12_000).toBe(true);
  });

  test('fase corrente: ultima fase o strumento in corso', () => {
    expect(faseCorrente({ eventi: [{ t: 'fase', testo: 'Leggo' }, { t: 'passo', strumento: 'cowork_stato', titolo: 'Stato della Scrivania', stato: 'in_corso' }], piano: null, fine: false })).toBe(
      'Stato della Scrivania'
    );
    expect(faseCorrente({ eventi: [{ t: 'fase', testo: 'Scrivo la risposta' }], piano: null, fine: false })).toBe('Scrivo la risposta');
    expect(faseCorrente(null)).toBeNull();
  });
});
