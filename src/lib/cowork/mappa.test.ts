import { mappaControlli, mappaDocumentiAzienda, mappaDocumento, mappaFlusso, mappaParagrafo, mappaSezione } from './mappa';

// Esempi presi da docs/integrazioni/COWORK_API.md (contratto cowork.v1).
const DOCUMENTO = {
  contratto: 'cowork.v1',
  documento: {
    tipo: 'dvr', id: 42, azienda_id: 7, titolo: 'Documento di valutazione dei rischi', versione: 1, stato: 'bozza', stato_documento: 'draft',
    revisione: 2, tecnico: { id: 12, nome: 'L. Bianchi' }, ore_sul_documento: 2.5, livello: 3, firma: 'sempre_umana', aggiornato_il: '2026-10-21T10:38:58+00:00',
  },
  banner: { paragrafi_assistente: 26, paragrafi_umani: 1, rischi_valutati: 24, citazioni: 16, generato_il: '2026-10-21T10:38:58+00:00', fonti: [{ tipo: 'materiale', id: 311, etichetta: 'Foto reparto stiro' }] },
  indice: [
    { chiave: '13', titolo: 'Agenti chimici e biologici', ordine: 13, stato: 'completo', paragrafi: { totali: 1, chiusi: 1 }, motivo: null },
    { chiave: '1', titolo: 'Frontespizio del DVR', ordine: 1, stato: 'bozza_assistente', paragrafi: { totali: 1, chiusi: 0 }, motivo: null },
  ],
  controlli: { bloccanti: 0, avvisi: 0, info: 0 },
  lavori_in_corso: [{ sezione: null, fase: 'generazione_completa', da: '2026-10-21T10:12:00+02:00' }],
  lavori_in_attesa: [{ sezione: '22', stato: 'in_attesa', priorita: 'alta', pronto_dal: '2026-10-21T10:15:00+02:00', eventi: 3 }],
  campo_nuovo_che_non_conosciamo: true,
};

const SEZIONE = {
  contratto: 'cowork.v1',
  documento: { tipo: 'dvr', id: 42 },
  sezione: { chiave: '13', titolo: 'Agenti chimici e biologici', stato: 'da_rivedere', paragrafi: { totali: 1, chiusi: 0 } },
  paragrafi: [
    {
      id: 901, chiave: '13.1', sezione: '13', ordine: 1301, tipo: 'testo', stato: 'da_rivedere', motivo: 'Nuova proposta', versione_base: 3,
      accettata: { id: 5001, versione: 2, testo: 'Testo deciso dal RSPP.', origine: 'umano', istruzione: null, autore_id: 12, revisione: 2, fonti: [{ tipo: 'revisione_dvr', id: 2, etichetta: 'Revisione 2 del DVR' }], creata_il: '2026-10-21T09:00:00+00:00' },
      proposta: { id: 5002, versione: 3, testo: 'Testo riscritto.', origine: 'ai', istruzione: null, autore_id: null, revisione: 3, fonti: [], creata_il: '2026-10-21T10:00:00+00:00' },
      confronto: [{ op: '-', testo: 'Testo deciso dal RSPP.' }, { op: '+', testo: 'Testo riscritto.' }, { op: '?', testo: 'scartata' }],
      azioni: ['accetta', 'modifica', 'riscrivi', 'rigenera', 'non_applicabile', 'azione_futura'],
    },
  ],
  tabelle: [
    {
      chiave: 'rischi', titolo: 'Rischi valutati (P x D)', origine: 'dati',
      colonne: [{ chiave: 'pericolo', etichetta: 'Pericolo' }, { chiave: 'mansioni_esposte', etichetta: 'Mansioni esposte' }, { chiave: 'probabilita', etichetta: 'P' }, { chiave: 'livello', etichetta: 'Livello' }],
      righe: [{ pericolo: 'Rumore', mansioni_esposte: ['Tornitore', 'Saldatore'], probabilita: 3, livello: 'alto', extra: { x: 1 } }],
    },
  ],
};

describe('mappaDocumento', () => {
  it('legge testata, banner, indice ordinato e lavori', () => {
    const d = mappaDocumento(DOCUMENTO)!;
    expect(d.testata).toMatchObject({ id: 42, aziendaId: 7, stato: 'bozza', revisione: 2, tecnico: { id: 12, nome: 'L. Bianchi' }, oreSulDocumento: 2.5, livello: 3 });
    expect(d.banner).toMatchObject({ paragrafiAssistente: 26, paragrafiUmani: 1, rischiValutati: 24, citazioni: 16 });
    expect(d.banner.fonti).toEqual([{ tipo: 'materiale', id: 311, etichetta: 'Foto reparto stiro', estratto: null }]);
    expect(d.indice.map((v) => v.chiave)).toEqual(['1', '13']);
    expect(d.lavoriInCorso[0]).toEqual({ sezione: null, fase: 'generazione_completa', da: '2026-10-21T10:12:00+02:00' });
    expect(d.lavoriInAttesa[0]).toMatchObject({ sezione: '22', eventi: 3 });
    expect(d.cursore).toBeNull();
  });

  it('senza testata non inventa un documento', () => {
    expect(mappaDocumento({ contratto: 'cowork.v1' })).toBeNull();
  });

  it('valori strani diventano neutri', () => {
    const d = mappaDocumento({ documento: { id: '5', tecnico: null, stato: 7 }, indice: 'no', banner: null })!;
    expect(d.testata.id).toBe(5);
    expect(d.testata.tecnico).toBeNull();
    expect(d.testata.stato).toBe('bozza');
    expect(d.indice).toEqual([]);
    expect(d.banner.paragrafiAssistente).toBe(0);
  });
});

describe('mappaSezione', () => {
  it('legge paragrafi, versioni, confronto e tabelle', () => {
    const s = mappaSezione(SEZIONE)!;
    expect(s).toMatchObject({ chiave: '13', stato: 'da_rivedere', paragrafi: { totali: 1, chiusi: 0 } });
    const p = s.elenco[0];
    expect(p).toMatchObject({ id: 901, versioneBase: 3, stato: 'da_rivedere' });
    expect(p.accettata).toMatchObject({ versione: 2, origine: 'umano', testo: 'Testo deciso dal RSPP.' });
    expect(p.proposta).toMatchObject({ versione: 3, origine: 'ai' });
    expect(p.confronto).toHaveLength(2);
    expect(p.azioni).toEqual(['accetta', 'modifica', 'riscrivi', 'rigenera', 'non_applicabile']);
    const t = s.tabelle[0];
    expect(t.colonne.map((c) => c.etichetta)).toEqual(['Pericolo', 'Mansioni esposte', 'P', 'Livello']);
    expect(t.righe[0]).toEqual({ pericolo: 'Rumore', mansioni_esposte: ['Tornitore', 'Saldatore'], probabilita: 3, livello: 'alto' });
  });

  it('confronto null resta null', () => {
    const p = mappaParagrafo({ id: 1, azioni: [], accettata: null, proposta: null, confronto: null })!;
    expect(p.confronto).toBeNull();
    expect(p.accettata).toBeNull();
  });
});

describe('mappaControlli', () => {
  it('legge avvisi con azione suggerita', () => {
    const c = mappaControlli({
      controlli: {
        bloccanti: [],
        avvisi: [
          {
            id: 77, regola: 'abilitazione_mancante', livello: 'avviso', stato: 'aperto', messaggio: 'M. Rossi senza attestato.', riferimento: 'art. 73 c.5', sezione: '11', paragrafo_id: 911,
            azione: { strumento: 'prenotazione_richiedi', etichetta: 'Chiedi il corso', argomenti: { azienda_id: 7 } }, motivo: null, fonte: 'formazione', azioni: ['esegui', 'accetta'],
          },
          { id: 78 },
        ],
        info: null,
      },
    });
    expect(c.bloccanti).toEqual([]);
    expect(c.info).toEqual([]);
    expect(c.avvisi).toHaveLength(1);
    expect(c.avvisi[0]).toMatchObject({ id: 77, sezione: '11', azione: { etichetta: 'Chiedi il corso' }, azioni: ['esegui', 'accetta'] });
  });
});

describe('mappaFlusso e documenti dell’azienda', () => {
  it('accetta voci o eventi e il nuovo cursore', () => {
    expect(mappaFlusso({ voci: [{ tipo: 'paragrafo_proposto', documento: { tipo: 'dvr', id: 42 }, sezione: 13 }], cursore: 'c_2' })).toEqual({
      voci: [{ tipo: 'paragrafo_proposto', documentoTipo: 'dvr', documentoId: 42, sezione: '13', paragrafoId: null }],
      cursore: 'c_2',
    });
    expect(mappaFlusso({ eventi: [{ evento: 'controllo_nuovo', documento_id: 42 }] }).voci[0]).toMatchObject({ tipo: 'controllo_nuovo', documentoId: 42 });
  });

  it('documenti dell’azienda', () => {
    const l = mappaDocumentiAzienda({ documenti: [{ tipo: 'dvr', id: 42, paragrafi: { totali: 27, accettati: 1, da_rivedere: 0 }, controlli: { bloccanti: 1 } }, {}] });
    expect(l).toHaveLength(1);
    expect(l[0].paragrafi).toMatchObject({ totali: 27, accettati: 1, proposti: 0 });
    expect(l[0].controlli.bloccanti).toBe(1);
  });
});
