import {
  accettaSezione,
  affiancati,
  avanzamento,
  colonneNumeriche,
  daRicaricare,
  divisioneIndice,
  fraseBanner,
  fraseLavori,
  livelloRischio,
  motivoValido,
  prossimaAperta,
  puoApprovare,
  sezioneIniziale,
  statoLavoro,
  statoSezione,
  testoAvanzamento,
  testoCella,
  vedeBozze,
} from './logica';
import type { Controlli, Documento, Paragrafo, Sezione, VoceIndice } from './tipi';

const voce = (chiave: string, stato: string): VoceIndice => ({ chiave, titolo: `Sezione ${chiave}`, ordine: Number(chiave) || 900, stato, paragrafi: { totali: 1, chiusi: stato === 'completo' ? 1 : 0 }, motivo: null });

const INDICE = [voce('1', 'completo'), voce('2', 'bozza_assistente'), voce('3', 'non_applicabile'), voce('4', 'da_rivedere'), voce('allegato_b', 'completo')];

const par = (o: Partial<Paragrafo> = {}): Paragrafo => ({
  id: 1, chiave: '2.1', sezione: '2', ordine: 1, tipo: 'testo', stato: 'proposto', motivo: null, versioneBase: 1, accettata: null,
  proposta: { id: 9, versione: 1, testo: 'x', origine: 'ai', istruzione: null, autoreId: null, revisione: null, fonti: [], creataIl: null },
  confronto: null, azioni: ['accetta', 'riscrivi'], ...o,
});

const sez = (elenco: Paragrafo[]): Sezione => ({ chiave: '2', titolo: 'Due', stato: 'bozza_assistente', paragrafi: { totali: elenco.length, chiusi: 0 }, elenco, tabelle: [] });

const ctrl = (bloccanti: Array<{ sezione: string; stato?: string }>): Controlli => ({
  bloccanti: bloccanti.map((b, i) => ({ id: i, regola: 'r', livello: 'bloccante', stato: b.stato ?? 'aperto', messaggio: 'm', riferimento: null, sezione: b.sezione, paragrafoId: null, azione: null, motivo: null, fonte: null, accettatoIl: null, azioni: [] })),
  avvisi: [],
  info: [],
});

describe('stati', () => {
  it('traduce i valori noti e lascia neutri gli sconosciuti', () => {
    expect(statoLavoro('pronto_da_firmare')).toEqual({ testo: 'Pronto da firmare', tono: 'sign' });
    expect(statoSezione('completo').tono).toBe('ok');
    expect(statoSezione('in_coda_speciale')).toEqual({ testo: 'In coda speciale', tono: 'neutral' });
  });
});

describe('indice e avanzamento', () => {
  it('conta chiusi completi e non applicabili', () => {
    const a = avanzamento(INDICE);
    expect(a).toEqual({ chiusi: 3, totale: 5, percento: 60 });
    expect(testoAvanzamento(a)).toBe('3 di 5 chiusi');
  });

  it('separa capitoli e allegati', () => {
    const d = divisioneIndice(INDICE);
    expect(d.capitoli).toHaveLength(4);
    expect(d.allegati.map((v) => v.chiave)).toEqual(['allegato_b']);
  });

  it('trova la prossima sezione aperta, anche ripartendo dall’inizio', () => {
    expect(prossimaAperta(INDICE, '2')).toBe('4');
    expect(prossimaAperta(INDICE, '4')).toBe('2');
    expect(prossimaAperta([voce('1', 'completo')], '1')).toBeNull();
  });

  it('sezione iniziale: quella chiesta o la prima da lavorare', () => {
    expect(sezioneIniziale(INDICE, '3')).toBe('3');
    expect(sezioneIniziale(INDICE, '99')).toBe('2');
    expect(sezioneIniziale([], null)).toBeNull();
  });
});

describe('banner', () => {
  const doc = (b: Partial<Documento['banner']>, extra: Partial<Documento> = {}): Documento => ({
    testata: { tipo: 'dvr', id: 42, aziendaId: 7, titolo: 'DVR', versione: 1, stato: 'bozza', statoDocumento: 'draft', revisione: 2, tecnico: null, oreSulDocumento: null, livello: 3, aggiornatoIl: null },
    banner: { paragrafiAssistente: 26, paragrafiUmani: 1, rischiValutati: 24, citazioni: 16, generatoIl: null, fonti: [], ...b },
    indice: [voce('22', 'da_rivedere')],
    controlli: { bloccanti: 0, avvisi: 0, info: 0 },
    lavoriInCorso: [],
    lavoriInAttesa: [],
    cursore: null,
    ...extra,
  });

  it('frase naturale senza trattini', () => {
    const f = fraseBanner(doc({}));
    expect(f).toBe("L'assistente ha preparato 26 paragrafi, con 24 rischi valutati e 16 citazioni di legge. Un paragrafo è già scritto da una persona.");
    expect(f).not.toMatch(/[–—]| - /);
  });

  it('documento ancora vuoto', () => {
    expect(fraseBanner(doc({ paragrafiAssistente: 0, paragrafiUmani: 0 }))).toMatch(/non ha ancora scritto/);
  });

  it('lavori in corso e in attesa', () => {
    expect(fraseLavori(doc({}, { lavoriInCorso: [{ sezione: '22', fase: 'redazione', da: null }] }))).toBe("L'assistente sta riscrivendo la sezione 22, Sezione 22.");
    expect(fraseLavori(doc({}, { lavoriInAttesa: [{ sezione: '22', stato: 'in_attesa_budget', priorita: null, prontoDal: null, eventi: 1 }] }))).toMatch(/tetto di spesa/);
    expect(fraseLavori(doc({}))).toBeNull();
  });
});

describe('ruoli', () => {
  it('lo studio vede le bozze, il datore no; approva solo il titolare', () => {
    expect(vedeBozze('consulente')).toBe(true);
    expect(vedeBozze('datore_lavoro')).toBe(false);
    expect(vedeBozze(null)).toBe(false);
    expect(puoApprovare('titolare_studio')).toBe(true);
    expect(puoApprovare('consulente')).toBe(false);
  });
});

describe('accetta la sezione', () => {
  it('attivo con proposte e senza bloccanti', () => {
    expect(accettaSezione(sez([par()]), ctrl([]))).toEqual({ visibile: true, attivo: true, motivo: null });
  });

  it('disattivato con un bloccante aperto sulla sezione', () => {
    const r = accettaSezione(sez([par()]), ctrl([{ sezione: '2' }, { sezione: '5' }]));
    expect(r.attivo).toBe(false);
    expect(r.motivo).toMatch(/bloccante/);
  });

  it('un bloccante su altra sezione o accettato non blocca', () => {
    expect(accettaSezione(sez([par()]), ctrl([{ sezione: '5' }, { sezione: '2', stato: 'accettato' }])).attivo).toBe(true);
  });

  it('nascosto per chi non ha azioni (documento approvato o ruolo senza permesso)', () => {
    expect(accettaSezione(sez([par({ azioni: [] })]), null).visibile).toBe(false);
  });

  it('niente da accettare', () => {
    const r = accettaSezione(sez([par({ azioni: ['modifica'] })]), null);
    expect(r).toMatchObject({ visibile: true, attivo: false });
  });
});

describe('paragrafi', () => {
  it('affiancati solo con testo in vigore e proposta', () => {
    expect(affiancati(par())).toBe(false);
    expect(affiancati(par({ accettata: par().proposta }))).toBe(true);
  });

  it('motivo di almeno 5 caratteri', () => {
    expect(motivoValido('  no ')).toBe(false);
    expect(motivoValido('Nessun locale interrato')).toBe(true);
  });
});

describe('tabelle', () => {
  it('livello dal testo o dal valore R', () => {
    expect(livelloRischio('molto alto')).toBe('molto_alto');
    expect(livelloRischio('Medio')).toBe('medio');
    expect(livelloRischio(null, 6)).toBe('alto');
    expect(livelloRischio(null, 12)).toBe('molto_alto');
    expect(livelloRischio(null, 2)).toBe('basso');
    expect(livelloRischio('boh')).toBeNull();
  });

  it('celle leggibili', () => {
    expect(testoCella(['A', 'B'])).toBe('A, B');
    expect(testoCella(null)).toBe('');
    expect(testoCella(true)).toBe('Sì');
  });

  it('colonne numeriche', () => {
    const t = { colonne: [{ chiave: 'pericolo', etichetta: 'Pericolo' }, { chiave: 'p', etichetta: 'P' }, { chiave: 'livello', etichetta: 'Livello' }], righe: [{ pericolo: 'x', p: 3, livello: 'alto' }] };
    expect(colonneNumeriche(t)).toEqual(['p']);
  });
});

describe('flusso: cosa ricaricare', () => {
  const ctx = { tipo: 'dvr', id: 42, sezione: '13' };
  it('ignora gli altri documenti', () => {
    expect(daRicaricare([{ tipo: 'paragrafo_proposto', documentoTipo: 'dvr', documentoId: 7, sezione: '13', paragrafoId: null }], ctx)).toEqual({ documento: false, sezione: false, controlli: false });
  });
  it('evento sulla sezione aperta: tutto', () => {
    expect(daRicaricare([{ tipo: 'paragrafo_proposto', documentoTipo: 'dvr', documentoId: 42, sezione: '13', paragrafoId: 1 }], ctx)).toEqual({ documento: true, sezione: true, controlli: true });
  });
  it('evento su altra sezione: solo il documento', () => {
    expect(daRicaricare([{ tipo: 'sezione_completa', documentoTipo: 'dvr', documentoId: 42, sezione: '4', paragrafoId: null }], ctx)).toEqual({ documento: true, sezione: false, controlli: false });
  });
  it('controllo nuovo altrove: documento e controlli', () => {
    expect(daRicaricare([{ tipo: 'controllo_nuovo', documentoTipo: 'dvr', documentoId: 42, sezione: '4', paragrafoId: null }], ctx)).toEqual({ documento: true, sezione: false, controlli: true });
  });
  it('evento senza documento: per sicurezza si ricarica', () => {
    expect(daRicaricare([{ tipo: 'lavoro', documentoTipo: null, documentoId: null, sezione: null, paragrafoId: null }], ctx).sezione).toBe(true);
  });
});
