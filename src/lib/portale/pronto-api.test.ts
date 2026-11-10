import { contoAllaRovescia, etichettaMese, indiceSequenza, mappaRichiesta, mappaTurni, mappaVista, minutiAllObiettivo, vistaPronto } from './pronto-api';

describe('Pronto Ispezioni lato studio', () => {
  it('mappa una richiesta con note e passo in modo tollerante', () => {
    const r = mappaRichiesta({
      richiesta_id: 4,
      azienda_id: 2,
      azienda: 'Officina Prova',
      ente: 'ASL',
      presenti: ['Titolare', 3, ''],
      stato: 'presa',
      prossimo_passo: 'chiamando',
      passo: 2,
      in_ritardo: true,
      note: [{ quando: '2026-10-14T08:03:00Z', tipo: 'telefonata', testo: 'Parlato con il titolare', autore: 'Luca' }, { tipo: 'strano', testo: 'x' }, { testo: '' }],
    });
    expect(r).not.toBeNull();
    expect(r?.presenti).toEqual(['Titolare']);
    expect(r?.passo).toBe(2);
    expect(r?.inRitardo).toBe(true);
    expect(r?.note).toHaveLength(2);
    expect(r?.note[1].tipo).toBe('nota');
    expect(mappaRichiesta({ azienda: 'senza id' })).toBeNull();
    expect(r?.statoTesto).toBe('Presa in carico');
    expect(r?.prossimoPasso).toBe('chiamando');
    // Stato sconosciuto: aperta, nessun passo inventato.
    const x = mappaRichiesta({ richiesta_id: 1, stato: 'strano', prossimo_passo: 'vola' });
    expect(x?.stato).toBe('aperta');
    expect(x?.prossimoPasso).toBeNull();
  });

  it('sequenza e conto alla rovescia della scheda Adesso', () => {
    expect(indiceSequenza('aperta')).toBe(0);
    expect(indiceSequenza('in_chiamata')).toBe(3);
    expect(indiceSequenza('archiviata')).toBe(4);
    expect(contoAllaRovescia(900)).toBe('15:00');
    expect(contoAllaRovescia(65)).toBe('01:05');
    expect(contoAllaRovescia(-75)).toBe('+1:15');
  });

  it('mappa la vista e tiene solo i mesi validi', () => {
    const v = mappaVista({
      minuti_richiamata: 15,
      in_finestra: true,
      turno_oggi: { titolare: { id: 3, nome: 'Luca' }, sostituto: null },
      aperte: [{ richiesta_id: 1 }, null],
      kpi: { media_minuti: 9, entro_obiettivo_pct: 80, per_mese: [{ mese: '2026-10', richieste: 2 }, { mese: 'x' }] },
      esiti: [{ chiave: 'in_regola', testo: 'Nessuna irregolarità' }, {}],
    });
    expect(v.aperte).toHaveLength(1);
    expect(v.turnoOggi.titolare?.nome).toBe('Luca');
    expect(v.kpi.perMese).toEqual([{ mese: '2026-10', richieste: 2 }]);
    expect(v.esiti).toHaveLength(1);
    expect(mappaVista(null).minutiRichiamata).toBe(15);
  });

  it('conta i minuti all obiettivo e smette dopo la richiamata', () => {
    const base = mappaRichiesta({ richiesta_id: 1, obiettivo_entro: '2026-10-14T08:15:00Z' })!;
    expect(minutiAllObiettivo(base, new Date('2026-10-14T08:05:00Z'))).toBe(10);
    expect(minutiAllObiettivo(base, new Date('2026-10-14T08:20:00Z'))).toBe(-5);
    expect(minutiAllObiettivo({ ...base, richiamataIl: '2026-10-14T08:10:00Z' })).toBeNull();
  });

  it('turni: giorni, tecnici e permesso', () => {
    const t = mappaTurni({
      settimana_dal: '2026-10-12',
      giorni: [{ giorno: '2026-10-12', feriale: true, titolare: { id: 1, nome: 'A' } }, { giorno: '' }],
      tecnici: [{ id: 1, nome: 'A' }, { nome: 'senza id' }],
      puo_modificare: true,
    });
    expect(t.giorni).toHaveLength(1);
    expect(t.tecnici).toHaveLength(1);
    expect(t.puoModificare).toBe(true);
    expect(mappaTurni(undefined).giorni).toEqual([]);
  });

  it('fuori dalla modalità API la vista è vuota', async () => {
    const v = await vistaPronto();
    expect(v.aperte).toEqual([]);
    expect(etichettaMese('2026-10')).toMatch(/ott/);
  });
});
