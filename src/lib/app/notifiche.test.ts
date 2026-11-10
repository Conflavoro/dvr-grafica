import { percorsoDaNotifica } from './notifiche';
import { percorsoDaLink } from '@/components/app/AvvioApp';
import { fileDaBase64 } from './fotocamera';

describe('collegamenti dell app', () => {
  test('notifica: solo percorsi interni', () => {
    expect(percorsoDaNotifica({ link: '/azienda/scadenze/' })).toBe('/azienda/scadenze/');
    expect(percorsoDaNotifica({ link: 'https://altro.it/x' })).toBeNull();
    expect(percorsoDaNotifica({ link: '//altro.it/x' })).toBeNull();
    expect(percorsoDaNotifica(null)).toBeNull();
    expect(percorsoDaNotifica({ link: 5 })).toBeNull();
  });

  test('link che apre l app: percorso, ricerca e ancora', () => {
    expect(percorsoDaLink('https://dvr.conflavoro.it/accesso/invito/?c=AB12')).toBe('/accesso/invito/?c=AB12');
    expect(percorsoDaLink('non un url')).toBeNull();
  });

  test('foto del plugin diventa un file jpeg', () => {
    const f = fileDaBase64(btoa('ciao'), 'jpeg', 'sopralluogo');
    expect(f.type).toBe('image/jpeg');
    expect(f.name).toMatch(/^sopralluogo-\d+\.jpg$/);
    expect(f.size).toBe(4);
  });
});

describe('tasto indietro di Android', () => {
  type Finto = { attr: Record<string, string>; chiuso?: boolean; rect: number };
  const doc = (fogli: Finto[]) =>
    ({
      querySelectorAll: () =>
        fogli.map((f) => ({
          getAttribute: (k: string) => f.attr[k] ?? null,
          closest: () => (f.chiuso ? {} : null),
          hidden: false,
          getClientRects: () => ({ length: f.rect }),
        })),
    }) as unknown as Document;

  test('un foglio chiuso non blocca il ritorno, uno aperto si', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { foglioAperto } = require('@/components/app/AvvioApp');
    expect(foglioAperto(doc([]))).toBe(false);
    expect(foglioAperto(doc([{ attr: { 'aria-hidden': 'true' }, rect: 1 }]))).toBe(false);
    expect(foglioAperto(doc([{ attr: {}, chiuso: true, rect: 1 }]))).toBe(false);
    expect(foglioAperto(doc([{ attr: {}, rect: 0 }]))).toBe(false);
    expect(foglioAperto(doc([{ attr: { 'aria-hidden': 'true' }, rect: 1 }, { attr: {}, rect: 1 }]))).toBe(true);
  });
});
