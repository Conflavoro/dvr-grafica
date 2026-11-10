// Test unitari dei mapper backend<->frontend (funzioni pure, no fetch).

import {
  mapCompanyFromApi,
  mapCompanyToApi,
  mapDvrFromApi,
  rischioMaxFromPayload,
  unwrap,
  unwrapList,
  type ApiCompany,
  type ApiDvr,
} from './api-mappers';
import type { DvrPayload } from './types';

describe('unwrap envelope', () => {
  test('unwrap estrae { data }', () => {
    expect(unwrap<{ x: number }>({ data: { x: 1 } })).toEqual({ x: 1 });
  });
  test('unwrap passa attraverso un oggetto senza data', () => {
    expect(unwrap<{ x: number }>({ x: 2 })).toEqual({ x: 2 });
  });
  test('unwrapList estrae array da { data: [] }', () => {
    expect(unwrapList<number>({ data: [1, 2] })).toEqual([1, 2]);
  });
  test('unwrapList su array nudo', () => {
    expect(unwrapList<number>([3])).toEqual([3]);
  });
  test('unwrapList su forma inattesa -> []', () => {
    expect(unwrapList<number>(null)).toEqual([]);
    expect(unwrapList<number>({ data: { not: 'array' } })).toEqual([]);
  });
});

describe('company mapping', () => {
  const raw: ApiCompany = {
    id: 1,
    tenant_id: 9,
    ragione_sociale: 'Acme',
    vat: 'IT99887766554',
    codice_fiscale: '99887766554',
    ateco: '25.62',
    dimensione: 'media',
    lavoratori_totali: 40,
    sedi: [{ tipo: 'legale', indirizzo: 'V', comune: 'C', provincia: 'MI', cap: '20100' }],
    settings: { ateco_label: 'Lavorazione metalli', created_by: 5 },
    created_at: '2026-01-01T00:00:00+00:00',
  };

  test('fromApi mappa nomi divergenti + estrae ateco_label/created_by da settings', () => {
    const c = mapCompanyFromApi(raw);
    expect(c.partita_iva).toBe('IT99887766554');
    expect(c.lavoratori).toBe(40);
    expect(c.ateco_label).toBe('Lavorazione metalli');
    expect(c.created_by).toBe(5);
    expect(c.sedi).toHaveLength(1);
  });

  test('fromApi con settings assenti usa default sicuri', () => {
    const c = mapCompanyFromApi({ ...raw, settings: null });
    expect(c.ateco_label).toBe('');
    expect(c.created_by).toBe(0);
  });

  test('toApi normalizza la P.IVA e incapsula ateco_label in settings', () => {
    const body = mapCompanyToApi({
      partita_iva: ' it99887766554 ',
      lavoratori: 40,
      ateco_label: 'X',
      created_by: 7,
    });
    expect(body.vat).toBe('IT99887766554');
    expect(body.lavoratori_totali).toBe(40);
    expect(body.settings).toEqual({ ateco_label: 'X', created_by: 7 });
  });

  test('toApi non include settings se nessun campo extra', () => {
    const body = mapCompanyToApi({ ragione_sociale: 'Solo nome' });
    expect(body).toEqual({ ragione_sociale: 'Solo nome' });
  });
});

describe('dvr mapping', () => {
  const payload = {
    sezione_a: { ragione_sociale: 'Fallback Srl' },
    sezione_e: {
      matrice_rischi: [
        { pericolo: 'A', probabilita: 2, gravita: 2, livello: 'medio' },
        { pericolo: 'B', probabilita: 3, gravita: 3, livello: 'alto' },
      ],
    },
  } as unknown as DvrPayload;

  test('rischioMaxFromPayload prende il livello piu alto', () => {
    expect(rischioMaxFromPayload(payload)).toBe('alto');
    expect(rischioMaxFromPayload(undefined)).toBe('basso');
  });

  test('fromApi usa la company se presente per il campo azienda', () => {
    const raw: ApiDvr = {
      id: 1,
      tenant_id: 1,
      company_id: 2,
      company: { id: 2, tenant_id: 1, ragione_sociale: 'Vera Srl', vat: 'IT1', ateco: '1', dimensione: 'micro', lavoratori_totali: 1 },
      version: 4,
      status: 'review',
      payload,
      created_at: '2026-01-01T00:00:00+00:00',
    };
    const d = mapDvrFromApi(raw);
    expect(d.versione).toBe(4);
    expect(d.azienda).toBe('Vera Srl');
    expect(d.rischio_max).toBe('alto');
  });

  test('fromApi cade su sezione_a.ragione_sociale se manca la company', () => {
    const raw: ApiDvr = {
      id: 1,
      tenant_id: 1,
      company_id: 2,
      version: 1,
      status: 'draft',
      payload,
      created_at: '2026-01-01T00:00:00+00:00',
    };
    expect(mapDvrFromApi(raw).azienda).toBe('Fallback Srl');
  });
});
