import { linkNovita } from './Campanella';
import type { Novita } from '@/lib/portale/api';

const voce = (link: Novita['link']): Novita => ({
  id: 1, categoria: 'persone', evento: 'portale.nuovo_assunto', titolo: 'Nuovo assunto', testo: null,
  priorita: 'normale', link, azienda: null, letta: false, creato: null,
});

describe('collegamento di una novità', () => {
  test('la sezione registrata con il nome dell app porta alla pagina vera', () => {
    expect(linkNovita(voce({ app: 'gestionale', sezione: 'gestionale.aziende', oggetto_tipo: null, oggetto_id: null, azienda_id: 7 }), 'gestionale'))
      .toBe('/gestionale/aziende/?azienda=7');
    expect(linkNovita(voce({ app: 'azienda', sezione: 'azienda.persone', oggetto_tipo: 'lavoratore', oggetto_id: 3, azienda_id: null }), 'gestionale'))
      .toBe('/azienda/persone/?id=3');
  });

  test('una sezione senza prefisso resta com e', () => {
    expect(linkNovita(voce({ app: null, sezione: 'scadenze', oggetto_tipo: null, oggetto_id: null, azienda_id: null }), 'azienda')).toBe('/azienda/scadenze/');
  });

  test('senza sezione non si va da nessuna parte', () => {
    expect(linkNovita(voce({ app: 'azienda', sezione: null, oggetto_tipo: null, oggetto_id: null, azienda_id: null }), 'azienda')).toBeNull();
  });
});
