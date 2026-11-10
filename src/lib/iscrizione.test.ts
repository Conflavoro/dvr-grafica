import { mappaStato, mappaStudio, testoPasso, validaAzienda, AZIENDA_VUOTA } from './iscrizione';
import { mappaChiSegue } from './portale/azienda-account-api';

describe('iscrizione', () => {
  test('validaAzienda: campi obbligatori e formati', () => {
    const e = validaAzienda(AZIENDA_VUOTA);
    expect(Object.keys(e).sort()).toEqual(['ateco', 'comune', 'lavoratori', 'partita_iva', 'ragione_sociale']);
    expect(validaAzienda({ ragione_sociale: 'Trattoria Srl', partita_iva: 'IT 01234567890', ateco: '56.10.11', comune: 'Bergamo', lavoratori: '0' })).toEqual({});
    const sbagliati = validaAzienda({ ragione_sociale: 'X Srl', partita_iva: '123', ateco: 'ristorante', comune: 'Bg', lavoratori: '-2' });
    expect(typeof sbagliati.partita_iva).toBe('string');
  });

  test('mappaStato: richiesta, proposta dal dominio e contatto di assistenza', () => {
    const s = mappaStato({
      stato: 'richiesta',
      organizzazione: { id: 3, nome: 'Conflavoro PMI', comune: 'Roma' },
      proposta: { id: 3, nome: 'Conflavoro PMI', comune: null },
      assistenza: 'staff@conflavoro.com',
    });
    expect(s).toMatchObject({ stato: 'richiesta', organizzazione: { id: 3, nome: 'Conflavoro PMI' }, proposta: { id: 3 }, assistenza: 'staff@conflavoro.com' });
    expect(mappaStato({ stato: 'nuovo', assistenza: 'non una mail' })?.assistenza).toBeNull();
    expect(mappaStato({ stato: 'boh' })).toBeNull();
    expect(mappaStato({ stato: 'rifiutata', azienda: { ragione_sociale: 'A', lavoratori: 12 } })?.azienda?.lavoratori).toBe('12');
  });

  test('mappaStudio scarta voci incomplete', () => {
    expect(mappaStudio({ id: 1 })).toBeNull();
    expect(mappaStudio({ id: '2', nome: 'Studio' })).toEqual({ id: 2, nome: 'Studio', comune: null });
  });

  test('testoPasso resta tra 1 e 3', () => {
    expect(testoPasso(1)).toBe('Passo 1 di 3');
    expect(testoPasso(5)).toBe('Passo 3 di 3');
  });

  test('mappaChiSegue: studio o HSE proprio', () => {
    expect(mappaChiSegue({ gestione: 'studio', studio: { nome: 'Conflavoro PMI' }, tecnico: { nome: 'Luca' } })).toMatchObject({ gestione: 'studio', studio: 'Conflavoro PMI', tecnico: 'Luca', hse: [], puoInvitareHse: false });
    const i = mappaChiSegue({ gestione: 'interna', hse: [{ id: 4, nome: 'Ing. Rossi', email: 'r@x.it', stato: 'invitato' }, { nome: 'senza id' }], puo_invitare_hse: true });
    expect(i.hse).toHaveLength(1);
    expect(i.hse[0]).toMatchObject({ id: 4, stato: 'invitato' });
    expect(i.puoInvitareHse).toBe(true);
  });
});
