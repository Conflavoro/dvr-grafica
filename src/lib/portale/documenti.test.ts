import { azioniDocumento, domandaDifetto, livelloQualita, motivoValido, nomeFile, ordinaAziende, ordinaDocumenti, percentualePassi, puoEmettere, raggruppaSegnalazioni, testoStato, type AziendaScrivania, type VoceDocumento } from './documenti';
import { mappaAzienda, mappaGenerazione, mappaPos, mappaQualita, mappaSegnalazioni, mappaVoce } from './documenti-api';

const voce = (p: Partial<VoceDocumento>): VoceDocumento => ({
  chiave: 'dvr:1',
  gruppo: 'dvr',
  id: 1,
  tipo: 'dvr',
  etichetta: 'Documento di valutazione dei rischi',
  titolo: null,
  stato: 'bozza',
  statoOriginale: 'draft',
  revisione: 1,
  versione: 1,
  emessoIl: null,
  aggiornatoIl: null,
  perche: [],
  bloccanti: 0,
  generazione: 'completed',
  cantiereId: null,
  ...p,
});

describe('azioni per ruolo', () => {
  it('il consulente genera e invia in revisione, ma non approva', () => {
    expect(azioniDocumento(voce({}), 'consulente')).toEqual(['rigenera', 'invia_revisione']);
    expect(azioniDocumento(voce({ statoOriginale: 'review', stato: 'revisione' }), 'consulente')).toEqual(['rigenera']);
  });
  it('solo il titolare approva il DVR in revisione', () => {
    expect(azioniDocumento(voce({ statoOriginale: 'review', stato: 'revisione' }), 'titolare_studio')).toContain('approva');
    expect(puoEmettere('consulente')).toBe(false);
    expect(puoEmettere('titolare_studio')).toBe(true);
  });
  it('durante la generazione non si rigenera né si approva', () => {
    expect(azioniDocumento(voce({ generazione: 'running', statoOriginale: 'review' }), 'titolare_studio')).toEqual([]);
  });
  it('un DVR mai generato propone solo la generazione', () => {
    expect(azioniDocumento(voce({ revisione: 0, generazione: 'idle' }), 'consulente')).toEqual(['genera']);
  });
  it('valutazioni: pronta dal consulente, emissione del titolare', () => {
    const v = voce({ gruppo: 'valutazione', statoOriginale: 'bozza', etichetta: 'Valutazione: Rumore' });
    expect(azioniDocumento(v, 'consulente')).toEqual(['segna_pronta']);
    expect(azioniDocumento({ ...v, statoOriginale: 'pronta' }, 'consulente')).toEqual([]);
    expect(azioniDocumento({ ...v, statoOriginale: 'pronta' }, 'titolare_studio')).toEqual(['emetti']);
  });
  it('il datore di lavoro e gli utenti del portale non hanno azioni', () => {
    expect(azioniDocumento(voce({}), 'datore_lavoro')).toEqual([]);
    expect(azioniDocumento(voce({ gruppo: 'documento', statoOriginale: 'bozza' }), 'utente_azienda')).toEqual([]);
  });
});

describe('testi e ordinamenti', () => {
  it('chiama approvato il DVR ed emesso il resto', () => {
    expect(testoStato({ stato: 'emesso', gruppo: 'dvr' })).toBe('Approvato');
    expect(testoStato({ stato: 'emesso', gruppo: 'documento' })).toBe('Emesso');
    expect(testoStato({ stato: 'revisione', gruppo: 'valutazione' })).toBe('Pronto da emettere');
  });
  it('mette il DVR in cima e dentro ogni gruppo prima ciò che chiede lavoro', () => {
    const r = ordinaDocumenti([
      voce({ chiave: 'documento:1', gruppo: 'documento', etichetta: 'HACCP', stato: 'emesso' }),
      voce({ chiave: 'documento:2', gruppo: 'documento', etichetta: 'DUVRI', stato: 'da_aggiornare' }),
      voce({ chiave: 'dvr:1' }),
    ]);
    expect(r.map((x) => x.chiave)).toEqual(['dvr:1', 'documento:2', 'documento:1']);
  });
  it('ordina le aziende per lavoro in sospeso e filtra', () => {
    const a = (id: number, priorita: AziendaScrivania['priorita'], nome: string): AziendaScrivania => ({ id, ragioneSociale: nome, ateco: null, lavoratori: null, documenti: 0, conteggi: { bozza: 0, revisione: 0, emesso: 0, da_aggiornare: 0 }, dvr: null, priorita });
    const l = [a(1, 'in_regola', 'Alfa'), a(2, 'senza_dvr', 'Zeta'), a(3, 'da_aggiornare', 'Beta')];
    expect(ordinaAziende(l).map((x) => x.id)).toEqual([2, 3, 1]);
    expect(ordinaAziende(l, 'in_regola').map((x) => x.id)).toEqual([1]);
  });
  it('nome del file senza accenti né spazi', () => {
    expect(nomeFile({ etichetta: 'Piano di emergenza', revisione: 0 }, 'Trattoria Da Mario S.n.c.', 'pdf')).toBe('piano-di-emergenza_trattoria-da-mario-s-n-c_bozza.pdf');
    expect(nomeFile({ etichetta: 'Qualità', revisione: 2 }, 'Caffè', 'docx')).toBe('qualita_caffe_rev2.docx');
  });
});

describe('generazione, qualità e segnalazioni', () => {
  it('calcola la percentuale dei passi chiusi', () => {
    expect(percentualePassi([])).toBe(0);
    expect(
      percentualePassi([
        { agente: 'a', etichetta: 'A', stato: 'fatto', secondi: 1 },
        { agente: 'b', etichetta: 'B', stato: 'errore', secondi: 1 },
        { agente: 'c', etichetta: 'C', stato: 'in_corso', secondi: null },
        { agente: 'd', etichetta: 'D', stato: 'attesa', secondi: null },
      ])
    ).toBe(50);
    expect(percentualePassi([{ agente: 'a', etichetta: 'A', stato: 'saltato', secondi: null }, { agente: 'b', etichetta: 'B', stato: 'attesa', secondi: null }])).toBe(50);
  });
  it('livelli della qualità come nel backend', () => {
    expect(livelloQualita(90).testo).toBe('Eccellente');
    expect(livelloQualita(72).testo).toBe('Buono');
    expect(livelloQualita(55).chip).toBe('warn');
    expect(livelloQualita(10).chip).toBe('danger');
  });
  it('la domanda sul difetto chiede conferma prima di modificare', () => {
    const t = domandaDifetto({ componente: 'specificita', guadagno: 4, azione: 'Cita le mansioni reali' }, { gruppo: 'dvr', id: 7, etichetta: 'DVR' });
    expect(t).toContain('DVR 7');
    expect(t).toContain('Non modificare nulla');
    expect(t).not.toMatch(/ - |—/);
  });
  it('raggruppa le segnalazioni aperte per esito e richiede un motivo vero', () => {
    const s = mappaSegnalazioni([
      { chiave: 'a', esito: 'avvisa', messaggio: 'Avviso', accettabile: true, accettata: null },
      { chiave: 'b', esito: 'blocca', messaggio: 'Blocco', accettabile: false, accettata: null },
      { chiave: 'c', esito: 'avvisa', messaggio: 'Già accettato', accettabile: true, accettata: { motivo: 'x' } },
      { chiave: 'd', esito: 'strano', messaggio: 'Ignorato' },
    ]);
    expect(s).toHaveLength(3);
    expect(raggruppaSegnalazioni(s).map((g) => [g.esito, g.voci.length])).toEqual([
      ['blocca', 1],
      ['avvisa', 1],
    ]);
    expect(motivoValido('   breve   ')).toBe(false);
    expect(motivoValido('Corso prenotato per il 20/11')).toBe(true);
  });
});

describe('mappatori tolleranti', () => {
  it('voce e azienda della scrivania', () => {
    expect(mappaVoce({ id: 3, gruppo: 'documento', tipo: 'haccp', etichetta: 'Manuale HACCP', stato: 'da_aggiornare', perche: ['Norma cambiata', 4], revisione: '2' })).toMatchObject({ chiave: 'documento:3', stato: 'da_aggiornare', perche: ['Norma cambiata'], revisione: 2 });
    expect(mappaVoce({ id: 3, gruppo: 'altro' })).toBeNull();
    expect(mappaVoce({ id: 1, gruppo: 'dvr', stato: 'boh' })?.stato).toBe('bozza');
    expect(mappaAzienda({ id: 1, ragione_sociale: 'Alfa', priorita: 'senza_dvr', conteggi: { bozza: 2 } })).toMatchObject({ priorita: 'senza_dvr', conteggi: { bozza: 2, revisione: 0 }, dvr: null });
  });
  it('generazione con avanzamento', () => {
    const g = mappaGenerazione({ dvr_status: 'draft', generation: { status: 'running' }, avanzamento: [{ agente: 'redazione', etichetta: 'Scrittura', stato: 'in_corso' }, { agente: 'qa', stato: 'x' }] });
    expect(g.stato).toBe('running');
    expect(g.passi.map((p) => p.stato)).toEqual(['in_corso', 'attesa']);
  });
  it('qualità e POS', () => {
    const q = mappaQualita({ data: { punteggio: 81, miglioramenti: [{ componente: 'misure', guadagno: 3, azione: 'Responsabili' }, { guadagno: 1 }], riferimenti_superati: [{ voce: 'dm_1998', trovato: 'DM 10/03/1998', sostituito_da: 'DM 02/09/2021', esito: 'blocca' }] } });
    expect(q.punteggio).toBe(81);
    expect(q.miglioramenti).toHaveLength(1);
    expect(q.riferimenti[0].sostituitoDa).toBe('DM 02/09/2021');
    expect(mappaPos({ id: 5, company_id: 2, stato: 'pronto', fasi: [{}, {}], ultimo_controllo: { conteggi: { blocca: 1, corregge: 2, avvisa: 3 } } })).toMatchObject({ stato: 'pronto', fasi: 2, bloccanti: 3, avvisi: 3 });
  });
});
