// Home dell'azienda in stile Portale HSE: dati dal backend normalizzati e resa statica.

import { renderToStaticMarkup } from 'react-dom/server';
import { mappaDaFareAzienda } from '@/lib/data-source';
import { CruscottoAzienda, quandoLeggibile } from './CruscottoAzienda';

describe('mappaDaFareAzienda', () => {
  test('legge voci, conteggi e riquadri del backend', () => {
    const d = mappaDaFareAzienda({
      conteggi: { totale_da_pagare: '€ 169,00', quote_da_pagare: 1 },
      cruscotto: { scadenze_30_giorni: 4, copertura_formativa: 71.4, visite_valide: null, completezza_fascicolo: '64.5' },
      voci: [
        { tipo: 'quota_da_pagare', id: 7, testo: "Quota d'ingresso di Luca P.", importo: '€ 169,00', azione: 'Paga nel portale' },
        { tipo: 'sconosciuto', id: 'x', testo: 'Altro da fare' },
        { tipo: 'firma', testo: '   ' },
        'spazzatura',
      ],
    });
    expect(d.voci).toHaveLength(2);
    expect(d.voci[0]).toEqual({ tipo: 'quota_da_pagare', id: 7, testo: "Quota d'ingresso di Luca P.", azione: 'Paga nel portale', importo: '€ 169,00', quando: null });
    expect(d.voci[1].tipo).toBe('altro');
    expect(d.totaleDaPagare).toBe('€ 169,00');
    expect([d.scadenze30, d.coperturaFormativa, d.visiteValide, d.completezzaFascicolo]).toEqual([4, 71.4, null, 64.5]);
  });

  test('risposta vuota o strana: nessun errore, riquadri non disponibili', () => {
    const d = mappaDaFareAzienda(null);
    expect(d.voci).toEqual([]);
    expect(d.coperturaFormativa).toBeNull();
  });
});

describe('CruscottoAzienda', () => {
  test('in dimostrazione mostra da fare, Pronto Ispezioni e i quattro riquadri', () => {
    const html = renderToStaticMarkup(<CruscottoAzienda aziendaId={1} nome="Trattoria Da Mario" disabled={false} onChiedi={() => undefined} />);
    expect(html).toContain('Da fare adesso');
    expect(html).toContain('Pronto Ispezioni');
    expect(html).toContain('Scadenze entro 30 giorni');
    expect(html).toContain('Copertura formativa');
    expect(html).toContain('Visite valide');
    expect(html).toContain('Completezza del fascicolo');
    expect(html).toContain('Prenota');
    // niente trattini come punteggiatura nei testi
    expect(html).not.toMatch(/ [—–] /);
  });
});

describe('quandoLeggibile', () => {
  test('le date ISO diventano giorno e mese, il resto resta', () => {
    expect(quandoLeggibile('2026-10-20')).toBe('20 ott');
    expect(quandoLeggibile('mar 20 ott, 9:30')).toBe('mar 20 ott, 9:30');
    expect(quandoLeggibile(null)).toBeNull();
  });
});
