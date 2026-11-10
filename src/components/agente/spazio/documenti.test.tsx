// Scheda "Documenti" del tavolo: raggruppamento per tipo e richieste all'agente.

import { renderToStaticMarkup } from 'react-dom/server';
import type { DocumentoAzienda } from '@/lib/data-source';
import { GRUPPI, SchedaDocumentiHse, raggruppa, richiestaApri, richiesteNuovo } from './SchedaDocumentiHse';

const doc = (origine: DocumentoAzienda['origine'], id: number, tipo: string, stato = 'bozza'): DocumentoAzienda => ({
  chiave: `${origine}:${id}`, origine, id, tipo, titolo: `Doc ${id}`, stato, revisione: null, aggiornato: null, puo_emettere: null, conteggi: null, esito: null,
});

test('raggruppa: ordine fisso, gruppi vuoti nascosti, tipi nuovi in "Altri documenti"', () => {
  const g = raggruppa([doc('hse', 1, 'duvri'), doc('dvr', 2, 'dvr', 'approved'), doc('valutazione', 3, 'rumore'), doc('hse', 4, 'riunione'), doc('hse', 5, 'sopralluogo'), doc('hse', 6, 'futuro')]);
  expect(g.map((x) => x.titolo)).toEqual(['DVR', 'Valutazioni specifiche', 'DUVRI', 'Verbali', 'Altri documenti']);
  expect(g[3].documenti).toHaveLength(2);
});

test('ogni tipo previsto dal backend ha un gruppo', () => {
  const tipi = GRUPPI.flatMap((x) => x.tipi);
  for (const t of ['dvr', 'pos', 'rumore', 'vibrazioni', 'mmc', 'chimico', 'stress', 'legionella', 'solitudine', 'duvri', 'pimus', 'haccp', 'emergenza', 'sopralluogo', 'riunione', 'nomina', 'procedura', 'radon']) {
    expect(tipi).toContain(t);
  }
});

test('richieste di creazione: precise, con il nome dell’azienda, senza trattini', () => {
  const r = richiesteNuovo('Officina Esempio Srl');
  const voci = r.flatMap((g) => g.voci);
  expect(voci.length).toBe(18);
  for (const v of voci) {
    expect(v.testo).toContain('Officina Esempio Srl');
    expect(/[–—]|\s-\s/.test(v.testo)).toBe(false);
  }
  expect(voci.find((v) => v.etichetta === 'Piano di emergenza')?.testo).toContain('DM 2 e 3 settembre 2021');
});

test('richiesta di apertura per origine', () => {
  expect(richiestaApri(doc('valutazione', 9, 'mmc'))).toBe('Apri la valutazione movimentazione manuale dei carichi n. 9 e dimmi a che punto è.');
  expect(richiestaApri(doc('hse', 4, 'pimus'))).toBe('Apri il documento n. 4 (PiMUS) e dimmi a che punto è.');
  expect(richiestaApri(doc('dvr', 2, 'dvr'))).toBe('Apri il DVR n. 2 e dimmi a che punto è.');
});

test('prima resa: caricamento con testo, "Crea" solo per chi scrive', () => {
  const props = { aziendaId: 1, versione: 0, chiedi: () => undefined, occupato: false, nomeAzienda: 'Officina Esempio Srl' };
  const scrive = renderToStaticMarkup(<SchedaDocumentiHse {...props} scrivibile />);
  expect(scrive).toContain('Carico i documenti');
  expect(scrive).toContain('Nuovo documento');
  const legge = renderToStaticMarkup(<SchedaDocumentiHse {...props} scrivibile={false} />);
  expect(legge).not.toContain('Nuovo documento');
});
