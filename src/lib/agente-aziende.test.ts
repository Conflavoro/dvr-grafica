import type { Company, Dvr, Scadenza } from '@/lib/data-source';
import { FILTRO_AZIENDE_INIZIALE, conPreferita, conRecente, contaPerStato, filtraAziende, filtroVuoto, iniziale, indiceAziende, leggiPreferenze, salvaPreferenze, statoAzienda, type AziendaIndice } from './agente-aziende';
import { AGENTE_TEMI, conTema, senzaTema, temaDelTesto, temaPerRuolo } from './agente-temi';

const az = (id: number, nome: string, extra: Partial<Company> = {}): Company =>
  ({ id, ragione_sociale: nome, partita_iva: '', ateco: '', ateco_label: '', dimensione: 'micro', lavoratori: 3, sedi: [], created_by: 1, created_at: '2026-01-01', ...extra }) as Company;
const dvr = (company_id: number, status: Dvr['status'], extra: Partial<Dvr> = {}): Dvr =>
  ({ id: company_id * 10, company_id, azienda: '', versione: 1, status, payload: {}, rischio_max: 'basso', data_creazione: '2026-05-01', data_approvazione: null, created_by: 1, ai_disclaimer_text: '', ...extra }) as unknown as Dvr;
const sc = (company_id: number, data: string, stato: Scadenza['stato'] = 'aperta'): Scadenza =>
  ({ id: 1, company_id, tipo: 'formazione', descrizione: 'x', data_prevista: data, priorita: 'media', stato, created_by: 1, created_at: '' }) as Scadenza;

const OGGI = '2026-10-13';

describe('stato delle aziende', () => {
  test('scadenze superate in rosso hanno la precedenza', () => {
    expect(statoAzienda(az(1, 'A'), [sc(1, '2026-10-01')], [dvr(1, 'approved')], OGGI)).toEqual({ stato: 'scaduto', motivo: '1 scadenza superata' });
    expect(statoAzienda(az(1, 'A'), [sc(1, '2026-10-01', 'completata')], [dvr(1, 'approved')], OGGI).stato).toBe('ok');
  });

  test('DVR mancante, in bozza o superato dai dati: da aggiornare', () => {
    expect(statoAzienda(az(1, 'A'), [], [], OGGI).motivo).toBe('DVR da preparare');
    expect(statoAzienda(az(1, 'A'), [], [dvr(1, 'draft')], OGGI).stato).toBe('aggiornare');
    expect(statoAzienda(az(1, 'A', { updated_at: '2026-09-01' }), [], [dvr(1, 'approved', { generated_at: '2026-06-01' })], OGGI).stato).toBe('aggiornare');
    expect(statoAzienda(az(1, 'A'), [sc(1, '2026-12-01')], [dvr(1, 'approved')], OGGI).stato).toBe('ok');
  });

  test('indice in ordine alfabetico con comune della sede legale e iniziali', () => {
    const i = indiceAziende([az(2, 'Zeta'), az(1, 'Ática', { sedi: [{ tipo: 'legale', indirizzo: '', comune: 'Prato', provincia: '', cap: '' }] })], [], [], OGGI);
    expect(i.map((x) => x.ragione_sociale)).toEqual(['Ática', 'Zeta']);
    expect(i[0].comune).toBe('Prato');
    expect(iniziale('Ática')).toBe('A');
    expect(iniziale('3M Italia')).toBe('#');
  });
});

describe('preferite e recenti', () => {
  test('recenti senza doppioni e al massimo cinque, preferite si alternano', () => {
    let p = { preferite: [], recenti: [] } as { preferite: number[]; recenti: number[] };
    for (const id of [1, 2, 3, 2, 4, 5, 6]) p = conRecente(p, id);
    expect(p.recenti).toEqual([6, 5, 4, 2, 3]);
    p = conPreferita(conPreferita(p, 7), 8);
    expect(conPreferita(p, 7).preferite).toEqual([8]);
  });

  test('salvate per utente, storage rotto non fa danni', () => {
    salvaPreferenze(3, { preferite: [1], recenti: [2] });
    expect(leggiPreferenze(3)).toEqual({ preferite: [1], recenti: [2] });
    expect(leggiPreferenze(4)).toEqual({ preferite: [], recenti: [] });
    localStorage.setItem('crm_dvr_agente_aziende:u5', '{rotto');
    expect(leggiPreferenze(5)).toEqual({ preferite: [], recenti: [] });
  });
});

describe('contesto del tema', () => {
  const pos = AGENTE_TEMI.find((t) => t.id === 'pos')!;
  test('prefisso nascosto aggiunto una volta e tolto a schermo', () => {
    const t = conTema('Prepara il POS per un nuovo cantiere', pos);
    expect(t).toBe('[Tema: POS e cantieri] Prepara il POS per un nuovo cantiere');
    expect(conTema(t, pos)).toBe(t);
    expect(senzaTema(t)).toBe('Prepara il POS per un nuovo cantiere');
    expect(temaDelTesto(t)?.id).toBe('pos');
    expect(conTema('ciao', null)).toBe('ciao');
  });

  test('il datore vede tutti i temi con domande informative', () => {
    for (const t of AGENTE_TEMI) {
      const d = temaPerRuolo(t, true);
      expect(d.domande.some((q) => /^Prepara\b/.test(q))).toBe(false);
    }
  });
});

describe('filtraAziende', () => {
  const az = (id: number, ragione_sociale: string, stato: 'scaduto' | 'aggiornare' | 'ok', extra: Partial<AziendaIndice> = {}): AziendaIndice => ({
    id, ragione_sociale, stato, partita_iva: '', ateco: '', ateco_label: '', comune: '', lavoratori: 0, motivo: '', ...extra,
  });
  const elenco = [
    az(1, 'Trattoria Da Mario S.n.c.', 'aggiornare', { ateco: '56.10.11', ateco_label: 'Ristorazione con somministrazione', comune: 'Lucca', lavoratori: 6, partita_iva: '01234567890' }),
    az(2, 'Edil Rossi S.r.l.', 'scaduto', { ateco: '41.20.00', comune: 'Pisa', lavoratori: 9 }),
    az(3, 'Studio Commercialista Bianchi', 'ok', { ateco: '69.20.11', comune: 'Città di Castello', lavoratori: 12 }),
  ];

  test('cerca per nome, comune, ATECO e partita IVA, senza accenti e punti', () => {
    const f = (testo: string) => filtraAziende(elenco, { ...FILTRO_AZIENDE_INIZIALE, testo }).map((a) => a.id);
    expect(f('mario')).toEqual([1]);
    expect(f('citta')).toEqual([3]);
    expect(f('56.10')).toEqual([1]);
    expect(f('ristorazione lucca')).toEqual([1]);
    expect(f('0123456')).toEqual([1]);
    expect(f('srl')).toEqual([2]);
    expect(f('niente')).toEqual([]);
  });

  test('filtra per stato o preferite e ordina per urgenza o lavoratori', () => {
    expect(filtraAziende(elenco, { ...FILTRO_AZIENDE_INIZIALE, stato: 'scaduto' }).map((a) => a.id)).toEqual([2]);
    expect(filtraAziende(elenco, { ...FILTRO_AZIENDE_INIZIALE, stato: 'preferite' }, [3]).map((a) => a.id)).toEqual([3]);
    expect(filtraAziende(elenco, { ...FILTRO_AZIENDE_INIZIALE, ordine: 'urgenza' }).map((a) => a.id)).toEqual([2, 1, 3]);
    expect(filtraAziende(elenco, { ...FILTRO_AZIENDE_INIZIALE, ordine: 'lavoratori' }).map((a) => a.id)).toEqual([3, 2, 1]);
    expect(contaPerStato(elenco, [1])).toEqual({ tutte: 3, scaduto: 1, aggiornare: 1, ok: 1, preferite: 1 });
    expect(filtroVuoto(FILTRO_AZIENDE_INIZIALE)).toBe(true);
    expect(filtroVuoto({ ...FILTRO_AZIENDE_INIZIALE, testo: ' x' })).toBe(false);
  });
});
