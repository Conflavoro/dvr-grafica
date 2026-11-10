import { azioneConfermata, classeRischio, mappaSopralluogo, percentuale, prossimaArea, prossimoEsito, quando, termineConsigliato, type Area } from './sopralluoghi-api';

describe('regole del sopralluogo', () => {
  it('classe di rischio e termine come nel verbale (7, 30, 90 e 180 giorni)', () => {
    expect(classeRischio(3, 4)).toMatchObject({ r: 12, classe: 'molto alto', giorni: 7 });
    expect(classeRischio(2, 3)).toMatchObject({ r: 6, classe: 'alto', giorni: 30 });
    expect(classeRischio(1, 3)).toMatchObject({ r: 3, classe: 'medio' });
    expect(classeRischio(1, 2)).toMatchObject({ r: 2, classe: 'basso', giorni: 180 });
    expect(classeRischio(5, 1)).toBeNull();
    expect(classeRischio(null, 2)).toBeNull();
    expect(termineConsigliato(3, 4, new Date(2026, 9, 20))).toBe('2026-10-27');
    expect(termineConsigliato(2, 3, new Date(2026, 9, 20))).toBe('2026-11-19');
  });

  it('secondo tocco annulla, avanzamento e prossima area con voci da fare', () => {
    expect(prossimoEsito('conforme', 'conforme')).toBeNull();
    expect(prossimoEsito('conforme', 'non_serve')).toBe('non_serve');
    expect(percentuale(3, 8)).toBe(38);
    expect(percentuale(0, 0)).toBe(0);
    const a = (fatte: number, totale: number): Area => ({ nome: 'x', voci: [], fatte, totale });
    expect(prossimaArea([a(2, 2), a(1, 3), a(0, 2)], 1)).toBe(2);
    expect(prossimaArea([a(0, 2), a(3, 3), a(2, 2)], 2)).toBe(0);
    expect(prossimaArea([a(2, 2), a(3, 3)], 0)).toBeNull();
  });

  it('azione confermata solo se completa e non solo proposta', () => {
    const base = { cosa: 'Liberare l’uscita', responsabile: 'Datore di lavoro', entro: '2026-10-27', p: 3, d: 4, pericolo: '', riferimento: '', proposta: false };
    expect(azioneConfermata(base)).toBe(true);
    expect(azioneConfermata({ ...base, proposta: true })).toBe(false);
    expect(azioneConfermata({ ...base, p: null })).toBe(false);
    expect(azioneConfermata(null)).toBe(false);
  });

  it('date in parole', () => {
    // Ora italiana (UTC+2 in ottobre) qualunque sia il fuso del telefono.
    const oggi = new Date('2026-10-20T06:00:00Z');
    expect(quando('2026-10-20T07:30:00Z', oggi)).toBe('oggi alle 09:30');
    expect(quando('2026-10-21T12:00:00Z', oggi)).toBe('domani alle 14:00');
    expect(quando('2026-10-20T22:30:00Z', oggi)).toBe('domani alle 00:30');
    expect(quando(null, oggi)).toBe('');
  });

  it('mappatore tollerante del sopralluogo', () => {
    const s = mappaSopralluogo({
      id: 7,
      azienda: { id: 1, ragione_sociale: 'Trattoria' },
      stato: 'in_corso',
      aree: [{ nome: 'Cucina', voci: [{ id: 1, testo: 'Cappa', esito: 'conforme', foto: [{ id: 3, tipo: 'foto', documento_id: 9 }] }, { id: 2, testo: 'Gas', esito: 'strano' }, { testo: 'senza id' }] }],
      conteggi: { voci: 2, risposte: 1, non_conformi: '0' },
      puo: { emettere: true, modificare: true },
      verbale: null,
    });
    expect(s?.aree[0].voci).toHaveLength(2);
    expect(s?.aree[0].fatte).toBe(1);
    expect(s?.aree[0].voci[1].esito).toBeNull();
    expect(s?.aree[0].voci[0].foto[0].documentoId).toBe(9);
    expect(s?.conteggi.nonConformi).toBe(0);
    expect(s?.puoEmettere).toBe(true);
    expect(s?.modificabile).toBe(true);
    expect(mappaSopralluogo({})).toBeNull();
  });
});
