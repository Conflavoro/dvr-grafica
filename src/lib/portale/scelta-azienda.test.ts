import type { AziendaIndice } from '@/lib/agente-aziende';
import type { AgenteConversazione } from '@/lib/data-source';
import {
  aziendaDaUrl,
  chiaveScelta,
  cosaHaFatto,
  elencoSelettore,
  filtraStorico,
  leggiScelta,
  quandoStorico,
  sceglieCliente,
  scriviScelta,
  senzaAziendaUrl,
  tipoSezione,
  titoloSezioneFalco,
} from './scelta-azienda';
import { SEZIONI_GESTIONALE } from './sezioni';

const az = (id: number, ragione_sociale: string, extra: Partial<AziendaIndice> = {}): AziendaIndice => ({
  id,
  ragione_sociale,
  partita_iva: '',
  ateco: '',
  ateco_label: '',
  comune: '',
  lavoratori: 0,
  stato: 'ok',
  motivo: '',
  ...extra,
});

describe('memoria della scelta', () => {
  beforeEach(() => window.localStorage.clear());

  it('si ricorda per utente', () => {
    expect(leggiScelta(7)).toBeNull();
    scriviScelta(7, 12);
    expect(leggiScelta(7)).toBe(12);
    expect(leggiScelta(8)).toBeNull();
    expect(window.localStorage.getItem(chiaveScelta(7))).toBe('12');
    scriviScelta(7, null);
    expect(leggiScelta(7)).toBeNull();
  });

  it('valori sporchi o storage che lancia: nessuna scelta, nessun errore', () => {
    window.localStorage.setItem(chiaveScelta(3), 'abc');
    expect(leggiScelta(3)).toBeNull();
    window.localStorage.setItem(chiaveScelta(3), '-4');
    expect(leggiScelta(3)).toBeNull();
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('bloccato');
    };
    try {
      expect(leggiScelta(3)).toBeNull();
    } finally {
      window.localStorage.getItem = orig;
    }
  });

  it('legge e toglie ?azienda= dal link', () => {
    expect(aziendaDaUrl('?azienda=15')).toBe(15);
    expect(aziendaDaUrl('?azienda=0')).toBeNull();
    expect(aziendaDaUrl('?id=3')).toBeNull();
    expect(aziendaDaUrl('?azienda=1.5')).toBeNull();
    expect(senzaAziendaUrl('?azienda=15&id=3')).toBe('?id=3');
    expect(senzaAziendaUrl('?azienda=15')).toBe('');
  });

  it('solo lo staff dello studio sceglie il cliente', () => {
    expect(sceglieCliente('consulente')).toBe(true);
    expect(sceglieCliente('titolare_studio')).toBe(true);
    expect(sceglieCliente('admin_conflavoro')).toBe(true);
    expect(sceglieCliente('datore_lavoro')).toBe(false);
    expect(sceglieCliente('utente_azienda')).toBe(false);
    expect(sceglieCliente(null)).toBe(false);
  });
});

describe('classificazione delle sezioni', () => {
  it('schermate di studio e schermate per azienda', () => {
    for (const k of ['coda', 'aziende', 'cruscotto', 'aggiornamenti', 'ispezioni', 'giornata', 'laboratorio', 'medico']) expect(tipoSezione('gestionale', k)).toBe('studio');
    for (const k of ['dvr', 'sopralluoghi', 'pos', 'avvio', 'prenotazioni', 'classi', 'promemoria', 'preventivi', 'ore', 'crediti']) {
      expect(tipoSezione('gestionale', k)).toBe('azienda');
    }
    expect(tipoSezione('gestionale', 'tutto')).toBe('libera');
    expect(tipoSezione('gestionale', 'inventata')).toBe('libera');
    expect(tipoSezione('azienda', 'documenti')).toBe('libera');
  });

  it('ogni sezione del gestionale ha una classe', () => {
    for (const s of SEZIONI_GESTIONALE) expect(['studio', 'azienda']).toContain(tipoSezione('gestionale', s.chiave));
  });
});

describe('elenco del selettore', () => {
  const tutte = [az(1, 'Zeta Srl'), az(2, 'Alfa Snc', { comune: 'Lucca', partita_iva: '01234567890' }), az(3, 'Bottega Città'), az(4, 'Officina Esempio')];

  it('preferite e recenti in alto, poi le altre per nome, senza doppioni', () => {
    const e = elencoSelettore(tutte, { preferite: [4], recenti: [4, 1] }, '');
    expect(e.gruppi.map((g) => g.titolo)).toEqual(['Preferite', 'Recenti', 'Tutte le aziende']);
    expect(e.gruppi.map((g) => g.voci.map((v) => v.id))).toEqual([[4], [1], [2, 3]]);
    expect(e.totale).toBe(4);
  });

  it('senza preferite ne recenti un solo elenco senza titolo', () => {
    const e = elencoSelettore(tutte, { preferite: [99], recenti: [] }, '');
    expect(e.gruppi).toHaveLength(1);
    expect(e.gruppi[0].titolo).toBeNull();
    expect(e.gruppi[0].voci.map((v) => v.ragione_sociale)).toEqual(['Alfa Snc', 'Bottega Città', 'Officina Esempio', 'Zeta Srl']);
  });

  it('ricerca tollerante: accenti, maiuscole, comune e partita IVA', () => {
    expect(elencoSelettore(tutte, { preferite: [], recenti: [] }, 'citta').gruppi[0].voci.map((v) => v.id)).toEqual([3]);
    expect(elencoSelettore(tutte, { preferite: [], recenti: [] }, 'LUCCA').gruppi[0].voci.map((v) => v.id)).toEqual([2]);
    expect(elencoSelettore(tutte, { preferite: [], recenti: [] }, '0123456').gruppi[0].voci.map((v) => v.id)).toEqual([2]);
    expect(elencoSelettore(tutte, { preferite: [], recenti: [] }, 'nessuna').gruppi).toEqual([]);
  });
});

describe('storico del Falco', () => {
  const c = (id: number, aziendaId: number | null, aggiornata: string, sezione: string | null = null): AgenteConversazione => ({
    id,
    titolo: `Conversazione ${id}`,
    azienda: aziendaId ? { id: aziendaId, ragione_sociale: `Azienda ${aziendaId}` } : null,
    aggiornata,
    sezione,
  });
  const voci = [c(1, 5, '2026-10-10T10:00:00Z'), c(2, 6, '2026-10-12T10:00:00Z'), c(3, null, '2026-10-11T10:00:00Z'), c(4, 5, '2026-10-13T10:00:00Z')];

  it('di default quelle dell azienda, con l interruttore tutte le mie', () => {
    expect(filtraStorico(voci, { aziendaId: 5, tutte: false }).map((x) => x.id)).toEqual([4, 1]);
    expect(filtraStorico(voci, { aziendaId: 5, tutte: true }).map((x) => x.id)).toEqual([4, 2, 3, 1]);
    expect(filtraStorico(voci, { aziendaId: null, tutte: false }).map((x) => x.id)).toEqual([4, 2, 3, 1]);
  });

  it('titolo della sezione e data breve', () => {
    expect(titoloSezioneFalco('gestionale.dvr')).toBe('Scrivania del DVR');
    expect(titoloSezioneFalco('azienda.documenti')).toBe('Documenti e DVR');
    expect(titoloSezioneFalco('azienda.ispezioni')).toBe('Pronto Ispezioni');
    expect(titoloSezioneFalco('altro.x')).toBe('Falco');
    expect(titoloSezioneFalco(null)).toBe('Falco');
    const adesso = new Date('2026-10-19T12:00:00Z');
    expect(quandoStorico('2026-10-19T08:05:00Z', adesso)).toBe('oggi, 10:05');
    expect(quandoStorico('2026-10-02T08:05:00Z', adesso)).toBe('2 ott');
    expect(quandoStorico('2025-03-02T08:05:00Z', adesso)).toBe('2 mar 2025');
    expect(quandoStorico(null, adesso)).toBe('');
    expect(quandoStorico('non una data', adesso)).toBe('');
  });

  it('cosa ha fatto: strumenti in ordine, senza doppioni, con esito', () => {
    expect(
      cosaHaFatto([
        { tipo: 'piano' },
        { tipo: 'strumento', strumento: 'documento_azienda_leggi', titolo: 'Letto il DVR', ok: true },
        { tipo: 'strumento', strumento: 'documento_azienda_leggi', titolo: 'Letto il DVR', ok: true },
        { tipo: 'strumento', strumento: 'scadenza_aggiungi', titolo: '', ok: false },
        { tipo: 'autocorrezione' },
      ])
    ).toEqual([
      { testo: 'Letto il DVR', ok: true },
      { testo: 'scadenza_aggiungi', ok: false },
    ]);
  });
});
