// Componenti della Control Room: resa statica (ambiente node, niente DOM) e
// testi che partono verso l'agente.

import { renderToStaticMarkup } from 'react-dom/server';
import { mapPannello } from '@/lib/data-source/agente-mappers';
import type { CrCriticita, CrVoceScadenza } from '@/lib/data-source';
import { AzioniPannelliProvider, type AzioniPannelli } from '../pannelli/contesto';
import { PannelloVista, titoloPannello } from '../pannelli/Pannelli';
import { ElencoCriticita, CaselleConformita, richiestaCriticita, testoTendenza } from './ControlRoom';
import { ChecklistEssenziali } from './Fascicolo';
import { Andamento } from './Report';
import { StrisciaSettimana } from './Scadenzario';
import { AnelloPunteggio, dataCr, quando } from './kit';
import { SCHEDE_CONTROL_ROOM, eSchedaControlRoom } from './index';

const crit = (titolo: string, priorita: CrCriticita['priorita']): CrCriticita => ({
  area: 'sicurezza', chiave: titolo, titolo, esito: 'non_conforme', priorita, peso: 10,
  messaggio: `Manca ${titolo}.`, azione: `Sistema ${titolo}.`, riferimento: 'art. 18 D.Lgs. 81/08',
});

const azioni: AzioniPannelli = {
  ruolo: 'consulente',
  occupato: false,
  invia: () => undefined,
  apriAzienda: () => undefined,
  scegliFoto: () => undefined,
  caricaAudio: async () => undefined,
  nomeAzienda: () => 'Officina Rossi Srl',
};

test('anello: etichetta accessibile con valore e livello, nessun dato = nd', () => {
  const html = renderToStaticMarkup(<AnelloPunteggio totale={72} livello="discreto" />);
  expect(html).toContain('aria-label="Safety Score 72 su 100, livello discreto"');
  expect(renderToStaticMarkup(<AnelloPunteggio totale={null} livello="nd" />)).toContain('Safety Score non calcolabile');
});

test('criticità: tre visibili, le altre a richiesta, una richiesta precisa per Falco', () => {
  const lista = ['RSPP', 'Medico', 'Addetti', 'Formazione'].map((t) => crit(t, 'alta'));
  const html = renderToStaticMarkup(<ElencoCriticita criticita={lista} chiedi={() => undefined} azienda="Officina Rossi Srl" />);
  expect((html.match(/<li /g) ?? []).length).toBe(3);
  expect(html).toContain('Vedi tutte (1 in più)');
  expect(html).toContain('Chiedi a Falco');
  const t = richiestaCriticita(lista[0], 'Officina Rossi Srl');
  expect(t).toContain('di Officina Rossi Srl: RSPP.');
  expect(t).toContain('Azione suggerita dalla Control Room: Sistema RSPP.');
  expect(t).toContain('art. 18 D.Lgs. 81/08');
  expect(/[–—]/.test(t)).toBe(false);
});

test('conformità in quattro caselle, tendenza in italiano', () => {
  const html = renderToStaticMarkup(<CaselleConformita c={{ conformi: 14, in_scadenza: 2, non_conformi: 4, da_verificare: 2, non_applicabili: 3 }} />);
  expect((html.match(/<dd/g) ?? []).length).toBe(4);
  expect(testoTendenza({ mese: '2026-10', mese_precedente: '2026-09', totale_precedente: 65, delta: 7, direzione: 'su' })).toBe('7 punti in più rispetto a settembre.');
  expect(testoTendenza({ mese: '2026-10', mese_precedente: '2026-09', totale_precedente: null, delta: null, direzione: 'nd' })).toContain('Prima fotografia');
});

test('striscia della settimana: pallino nei giorni con scadenze', () => {
  const oggi = new Date(2026, 9, 14, 9);
  const v = (data: string, priorita: CrVoceScadenza['priorita']): CrVoceScadenza => ({
    chiave: data, fonte: 'scadenza', id: 1, data, giorni: 1, stato: 'in_scadenza', azienda_id: 1, azienda: null, titolo: 'x', descrizione: '', categoria: 'altro', priorita,
  });
  const html = renderToStaticMarkup(<StrisciaSettimana voci={[v('2026-10-15', 'alta'), v('2026-10-18', 'media')]} oggi={oggi} />);
  expect(html).toContain('Oggi 14: nessuna scadenza');
  expect(html).toContain('gio 15: 1 scadenza');
  expect((html.match(/bg-danger-mark/g) ?? []).length).toBe(1);
  expect((html.match(/bg-oro-500/g) ?? []).length).toBe(1);
  expect(quando(-3)).toBe('scaduta da 3 giorni');
});

test('checklist e andamento leggibili senza colore', () => {
  const c = renderToStaticMarkup(
    <ChecklistEssenziali voci={[{ chiave: 'dvr', voce: 'DVR aggiornato', esito: 'conforme', messaggio: 'Presente.' }, { chiave: 'rls', voce: 'Verbale RLS', esito: 'non_conforme', messaggio: 'Non presente.' }]} />
  );
  expect(c).toContain('pronti su');
  expect(c).toContain('Da sistemare');
  const a = renderToStaticMarkup(<Andamento dati={[{ mese: '2026-09', totale: null }, { mese: '2026-10', totale: 72 }]} />);
  expect(a).toContain('set senza dato, ott 72');
});

test('pannelli della chat: safety score e passaporto creato dentro la conversazione', () => {
  const p = mapPannello({
    tipo: 'safety_score', azienda_id: 12, ragione_sociale: 'Officina Rossi Srl', totale: 72, livello: 'discreto',
    aree: { sicurezza: { nome: 'Sicurezza', punteggio: 80 } }, criticita: [crit('RSPP', 'alta')], conformita: { conformi: 3 },
  })!;
  expect(titoloPannello(p)).toBe('Safety Score 72');
  const html = renderToStaticMarkup(
    <AzioniPannelliProvider value={azioni}>
      <PannelloVista p={p} />
    </AzioniPannelliProvider>
  );
  expect(html).toContain('Livello discreto');
  expect(html).toContain('Chiedi a Falco');
  const pass = mapPannello({ tipo: 'passaporto', azienda_id: 12, creato: true, pin_inviato_a: 'l.bianchi@studio.it', attivo: { id: 3, valido: true, sezioni: ['dvr'] } })!;
  const h2 = renderToStaticMarkup(
    <AzioniPannelliProvider value={azioni}>
      <PannelloVista p={pass} />
    </AzioniPannelliProvider>
  );
  expect(h2).toContain('arrivato per email a l.bianchi@studio.it');
  expect(h2).not.toContain('PIN:');
});

test('schede esportate per lo spazio di lavoro', () => {
  expect(SCHEDE_CONTROL_ROOM.map((s) => s.chiave)).toEqual(['control_room', 'scadenzario', 'fascicolo', 'report', 'passaporto', 'pronto_controllo']);
  expect(eSchedaControlRoom('report')).toBe(true);
  expect(eSchedaControlRoom('azienda')).toBe(false);
  for (const s of SCHEDE_CONTROL_ROOM) expect(/[–—]/.test(s.titolo)).toBe(false);
});

test('dataCr: data e ora senza fuso dal server sono UTC, come quelle con il fuso', () => {
  expect(dataCr('2026-10-15 17:44:14', true)).toBe(dataCr('2026-10-15T17:44:14+00:00', true));
  expect(dataCr('2026-10-15')).not.toBe('');
});
