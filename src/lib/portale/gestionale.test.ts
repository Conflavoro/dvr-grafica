import { filtraAziende, FILTRO_AZIENDE_INIZIALE, contaPerStato } from '@/lib/agente-aziende';
import { mappaElemento, mappaPratica, mappaRigaAzienda, mappaVistaCoda } from './gestionale-api';
import { cambiato, campiProposti, chipTermine, contoOre, cosaAspetta, durata, indiceDaRighe, iniziali, livello, payloadCorretto, tonoScore } from './gestionale-logica';

const ADESSO = new Date('2026-10-14T08:00:00Z');

describe('termini e durate', () => {
  it('minuti sotto un ora, ore sotto 48, poi giorni', () => {
    expect(durata(30 * 60000)).toBe('30 minuti');
    expect(durata(60000)).toBe('1 minuto');
    expect(durata(5 * 3600000)).toBe('5 ore');
    expect(durata(72 * 3600000)).toBe('3 giorni');
  });
  it('chip del termine: scaduta, entro 8 ore, oltre', () => {
    expect(chipTermine('2026-10-14T06:00:00Z', ADESSO)).toEqual({ tono: 'danger', testo: 'Scaduta da 2 ore' });
    expect(chipTermine('2026-10-14T10:00:00Z', ADESSO)).toEqual({ tono: 'warn', testo: 'Scade tra 2 ore' });
    expect(chipTermine('2026-10-20T10:00:00Z', ADESSO)?.tono).toBe('neutral');
    expect(chipTermine(null, ADESSO)).toBeNull();
    expect(chipTermine('non una data', ADESSO)).toBeNull();
  });
  it('conto delle 48 ore', () => {
    expect(contoOre(10)).toEqual({ tono: 'ok', testo: '10 h, ne restano 38', pct: 21 });
    expect(contoOre(30).tono).toBe('warn');
    expect(contoOre(60)).toEqual({ tono: 'danger', testo: '60 h, 12 oltre l’obiettivo', pct: 100 });
    expect(contoOre(null).testo).toBe('Parte all’incasso');
  });
  it('livelli degli assistenti', () => {
    expect(livello(2)?.testo).toBe('Livello 2 · approva');
    expect(livello(3)?.tono).toBe('sign');
    expect(livello(null)).toBeNull();
  });
  it('testi senza trattini come punteggiatura', () => {
    for (const t of [chipTermine('2026-10-14T06:00:00Z', ADESSO)!.testo, contoOre(60).testo, livello(1)!.spiega]) {
      expect(t).not.toMatch(/ - |—|–/);
    }
  });
});

describe('correggi e approva', () => {
  const payload = { campi: { pec: 'a@pec.example.test', telefono: '0583 1' }, fonte: 'Visura camerale' };
  it('campi dei dati dell azienda con etichette italiane', () => {
    expect(campiProposti('dati_azienda', payload)).toEqual([
      { campo: 'pec', etichetta: 'PEC', valore: 'a@pec.example.test' },
      { campo: 'telefono', etichetta: 'Telefono', valore: '0583 1' },
    ]);
  });
  it('i campi tolti non entrano, quelli cambiati prendono il valore della persona, la fonte resta', () => {
    expect(payloadCorretto('dati_azienda', payload, { pec: ' b@pec.example.test ' }, ['telefono'])).toEqual({ campi: { pec: 'b@pec.example.test' }, fonte: 'Visura camerale' });
    expect(cambiato('dati_azienda', payload, { pec: 'a@pec.example.test' }, [])).toBe(false);
    expect(cambiato('dati_azienda', payload, { pec: 'x' }, [])).toBe(true);
    expect(cambiato('dati_azienda', payload, {}, ['pec'])).toBe(true);
  });
  it('per le scadenze modifica i valori semplici e lascia il resto', () => {
    const p = { tipo: 'altro', descrizione: 'Verifica estintori', data_prevista: '2026-11-30' };
    expect(payloadCorretto('scadenza', p, { data_prevista: '2026-12-01' })).toEqual({ ...p, data_prevista: '2026-12-01' });
  });
});

describe('mappatori tolleranti', () => {
  it('elemento della coda: campi mancanti non rompono, tipo sconosciuto scartato', () => {
    expect(mappaElemento({ chiave: 'x', id: 1, tipo: 'boh' })).toBeNull();
    const e = mappaElemento({ chiave: 'p3', id: '3', tipo: 'proposta', titolo: 'Dati', gravita: 'danger', puo_decidere: true, azienda: { id: 5, nome: 'Officina' } });
    expect(e).toMatchObject({ chiave: 'p3', id: 3, gravita: 'danger', puoDecidere: true, azienda: { id: 5, nome: 'Officina' }, stato: 'aperto', esito: null });
  });
  it('vista della coda vuota con conteggi a zero', () => {
    const v = mappaVistaCoda(null);
    expect(v.conteggi.tutto).toBe(0);
    expect(v.elementi).toEqual([]);
    expect(cosaAspetta({ ...v.conteggi, proposte: 2, allarmi: 1 }, { totale: 3, fatti: 1 })).toBe(5);
  });
  it('pratica di avvio e titolare', () => {
    const p = mappaPratica({ azienda: { id: 2, nome: 'Bar' }, ore_dal_pagamento: 10, titolare: { stato: 'invitato', email: 't@example.test' } });
    expect(p?.titolare.stato).toBe('invitato');
    expect(p?.oreDalPagamento).toBe(10);
    expect(mappaPratica({})).toBeNull();
  });
});

describe('aziende: riuso della ricerca dell agente', () => {
  const righe = [
    { id: 1, ragione_sociale: 'Trattoria Da Mario', partita_iva: '01234567890', comune: 'Lucca', ateco: '56.10.11', stato: 'scaduto', lavoratori: 6 },
    { id: 2, ragione_sociale: 'Edile Rossi Srl', partita_iva: '09876543210', comune: 'Pisa', ateco: '41.20.00', stato: 'ok', lavoratori: 12 },
    { id: 3, ragione_sociale: 'Uffici Bianchi', comune: 'Lucca', stato: 'aggiornare', lavoratori: 3 },
  ].map(mappaRigaAzienda).filter((x): x is NonNullable<typeof x> => x !== null);

  it('cerca per comune e partita IVA, filtra per stato, ordina per urgenza', () => {
    const idx = indiceDaRighe(righe);
    expect(filtraAziende(idx, { ...FILTRO_AZIENDE_INIZIALE, testo: 'lucca' }).map((a) => a.id)).toEqual([1, 3]);
    expect(filtraAziende(idx, { ...FILTRO_AZIENDE_INIZIALE, testo: '0987654' }).map((a) => a.id)).toEqual([2]);
    expect(filtraAziende(idx, { ...FILTRO_AZIENDE_INIZIALE, ordine: 'urgenza' }).map((a) => a.id)).toEqual([1, 3, 2]);
    expect(contaPerStato(idx, [2])).toMatchObject({ tutte: 3, scaduto: 1, ok: 1, aggiornare: 1, preferite: 1 });
  });
  it('iniziali e tono del punteggio', () => {
    expect(iniziali('Ing. Laura Bianchi')).toBe('LB');
    expect(tonoScore(85)).toBe('ok');
    expect(tonoScore(65)).toBe('warn');
    expect(tonoScore(40)).toBe('danger');
    expect(tonoScore(null)).toBe('neutral');
  });
});
