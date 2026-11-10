import { cursoreDopo, cursoreIniziale, domandeRegistrate, forma, scegli, somiglianza, type VoceRegistrata } from './abbina';

const voci: VoceRegistrata[] = [
  { s: 1, m: 'GET', p: '/coda?stato=aperto', st: 200, b: { data: ['prima'] } },
  { s: 2, m: 'GET', p: '/aziende/5', st: 200, b: { data: { id: 5 } } },
  { s: 3, m: 'POST', p: '/coda/7/decidi', st: 200, b: { ok: true }, q: { esito: 'approva' } },
  { s: 4, m: 'GET', p: '/coda?stato=aperto', st: 200, b: { data: ['dopo'] } },
  { s: 5, m: 'POST', p: '/agente/messaggi', st: 200, b: { data: { risposta: { testo: 'scadenze' } } }, q: { testo: 'Quali scadenze sono in ritardo?', sezione: 'scadenze' } },
  { s: 6, m: 'POST', p: '/agente/messaggi', st: 200, b: { data: { risposta: { testo: 'dvr' } } }, q: { testo: 'Riassumi il DVR della Meccanica', sezione: 'dvr' } },
];

describe('demo: scelta della risposta registrata', () => {
  it('prima delle scritture mostra lo stato iniziale, dopo la scrittura quello registrato dopo', () => {
    const c0 = cursoreIniziale(voci);
    expect(c0).toBe(2);
    expect(scegli(voci, 'GET', '/coda?stato=aperto', null, c0)?.voce.b).toEqual({ data: ['prima'] });
    const w = scegli(voci, 'POST', '/coda/7/decidi', { esito: 'approva' }, c0)!;
    expect(w.livello).toBe('esatto');
    const c1 = cursoreDopo(voci, w.voce, c0);
    expect(c1).toBe(4);
    expect(scegli(voci, 'GET', '/coda?stato=aperto', null, c1)?.voce.b).toEqual({ data: ['dopo'] });
  });

  it('ricade sul percorso senza query e poi sulla forma con gli identificativi', () => {
    expect(scegli(voci, 'GET', '/coda?stato=chiuso', null, 2)?.livello).toBe('percorso');
    expect(scegli(voci, 'GET', '/aziende/9', null, 2)?.livello).toBe('forma');
    expect(scegli(voci, 'GET', '/sconosciuto', null, 2)).toBeNull();
    expect(forma('/lavoratore/lav_AbCdEfGhIjKlMnOpQr/documenti/3')).toBe('/lavoratore/*/documenti/*');
  });

  it('per il Falco sceglie la domanda registrata più simile', () => {
    const s = scegli(voci, 'POST', '/agente/messaggi', { testo: 'quali scadenze sono in ritardo' }, Infinity)!;
    expect((s.voce.b as { data: { risposta: { testo: string } } }).data.risposta.testo).toBe('scadenze');
    expect(s.punteggio).toBeGreaterThan(0.9);
    expect(somiglianza('come si fa la torta di mele', 'Riassumi il DVR della Meccanica')).toBeLessThan(0.2);
    expect(domandeRegistrate(voci, 'dvr')).toEqual(['Riassumi il DVR della Meccanica']);
  });

  it('il cursore non torna mai indietro', () => {
    const w = voci[2];
    expect(cursoreDopo(voci, w, 10)).toBe(10);
  });
});
