// Pannelli dei moduli nuovi: resa statica (ambiente node) per ruolo, colori
// degli esiti, pulsanti mostrati solo a chi puo' usarli, testi senza trattini.

import { renderToStaticMarkup } from 'react-dom/server';
import { mapPannello } from '@/lib/data-source/agente-mappers';
import { demoCoda, demoCruscotto, demoDuvri, demoNuovoAssunto, demoQualita, demoSchedaAvvio, demoValutazioneRumore } from '@/lib/data-source/moduli-demo';
import type { Pannello, Role } from '@/lib/data-source';
import { AzioniPannelliProvider, type AzioniPannelli } from './contesto';
import { PannelloVista, titoloPannello } from './Pannelli';
import { puoDecidere } from './PannelliPortale';

const azioni = (ruolo: Role): AzioniPannelli => ({
  ruolo,
  occupato: false,
  invia: () => undefined,
  apriAzienda: () => undefined,
  scegliFoto: () => undefined,
  caricaAudio: async () => undefined,
  nomeAzienda: () => 'Officina Esempio Srl',
});

const html = (raw: Record<string, unknown>, ruolo: Role = 'consulente'): { p: Pannello; h: string } => {
  const p = mapPannello(raw)!;
  const h = renderToStaticMarkup(
    <AzioniPannelliProvider value={azioni(ruolo)}>
      <PannelloVista p={p} />
    </AzioniPannelliProvider>
  );
  return { p, h };
};

/** Testo visibile senza tag, per cercare trattini usati come punteggiatura. */
const testo = (h: string) => h.replace(/<[^>]+>/g, ' ');

test('valutazione rumore: esito colorato, righe per mansione, scarica bozza, emetti solo al titolare', () => {
  const { p, h } = html(demoValutazioneRumore(3));
  expect(titoloPannello(p)).toBe('Valutazione rumore');
  expect(h).toContain('Valore superiore di azione superato in un gruppo');
  expect(h).toContain('bg-warn');
  expect(h).toContain('Addetto alla piegatura lamiera');
  expect(h).toContain('LEX,8h 86,4 dB(A)');
  expect(h).toContain('Bozza PDF');
  expect(h).toContain('Bozza Word');
  expect(h).toContain('Controlla');
  expect(h).not.toContain('>Emetti<');
  expect(html(demoValutazioneRumore(3), 'titolare_studio').h).toContain('>Emetti<');
  const datore = html(demoValutazioneRumore(3), 'datore_lavoro').h;
  expect(datore).not.toContain('Controlla');
  expect(datore).toContain('Bozza PDF');
  expect(/[–—]/.test(testo(h))).toBe(false);
});

test('documento HSE: segnalazioni blocca rosse prima, emissione bloccata', () => {
  const { p, h } = html(demoDuvri(), 'titolare_studio');
  expect(titoloPannello(p)).toBe('DUVRI manutenzione impianti di climatizzazione');
  expect(h.indexOf('Blocca')).toBeLessThan(h.indexOf('Da correggere'));
  expect(h).toContain('bg-danger-mark text-white');
  expect(h).toContain('Non si può emettere finché ci sono segnalazioni che bloccano.');
  expect(h).not.toContain('>Emetti<');
  expect(/[–—]/.test(testo(h))).toBe(false);
});

test('documento emesso: download diretto senza la parola bozza e senza controlla', () => {
  const { h } = html({ tipo: 'documento_hse', documento_id: 5, tipo_documento: 'emergenza', stato: 'emesso', revisione: 2, puo_emettere: true });
  expect(h).toContain('Piano di emergenza');
  expect(h).toContain('revisione 2');
  expect(h).toContain('>PDF<');
  expect(h).not.toContain('Bozza');
  expect(h).not.toContain('Controlla');
});

test('qualità: punteggio, barra accessibile, miglioramenti con guadagno', () => {
  const { h } = html(demoQualita());
  expect(h).toContain('role="meter"');
  expect(h).toContain('aria-valuenow="79"');
  expect(h).toContain('+7,5');
  expect(h).toContain('Applica con l’agente');
});

test('coda di lavoro: approva e respingi solo per chi può decidere', () => {
  const studio = html(demoCoda(2), 'consulente').h;
  // consulente: dati azienda e scadenza sì, ordine (servizio) no
  expect((studio.match(/>Approva</g) ?? []).length + (studio.match(/ Approva</g) ?? []).length).toBeGreaterThanOrEqual(2);
  expect(studio).toContain('PEC: amministrazione@esempio-pec.it');
  expect(studio).toContain('Quote d’ingresso da pagare');
  expect(puoDecidere('consulente', 'servizio')).toBe(false);
  expect(puoDecidere('datore_lavoro', 'servizio')).toBe(true);
  expect(puoDecidere('datore_lavoro', 'scadenza')).toBe(false);
  expect(puoDecidere('datore_lavoro', 'dati_azienda')).toBe(true);
  const datore = html(demoCoda(2), 'datore_lavoro').h;
  expect(datore).toContain('Respingi');
});

test('cruscotto: undici caselle con stato a parole, non solo colore', () => {
  const { h } = html(demoCruscotto(), 'titolare_studio');
  expect((h.match(/<li /g) ?? []).length).toBe(11);
  expect(h).toContain('In obiettivo');
  expect(h).toContain('Oltre la soglia');
  expect(h).toContain('Senza dati');
  expect(h).toContain('obiettivo 95%, soglia 80%');
  expect(h).toContain('Costo AI del mese');
});

test('portale: scheda di avvio, nuovo assunto con quota da pagare', () => {
  const a = html(demoSchedaAvvio(2)).h;
  expect(a).toContain('1 passi su 4 completati');
  expect(a).toContain('Fallo con l’agente');
  const n = html(demoNuovoAssunto(2)).h;
  expect(n).toContain('Quota da pagare');
  expect(n).toContain('Corso e visita restano fermi');
  expect(n).toContain('Da prenotare');
});

test('tipi sconosciuti: nessun pannello', () => {
  expect(mapPannello({ tipo: 'mai_visto', azienda_id: 1 })).toBeNull();
});
