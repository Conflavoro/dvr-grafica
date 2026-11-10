/**
 * @jest-environment node
 */
import { aggiungiAllIndice, base64DaByte, byteDaBase64, cifra, decifra, MASSIMO_FILE, nuovaVoce, valide, BYTE_MASSIMI, SCADENZA_GIORNI } from './file-recenti';

const ora = new Date('2026-10-30T10:00:00Z');
const voce = (id: string, giorniFa: number, byte = 1000, origine = id) => nuovaVoce(`${id}.pdf`, 'application/pdf', byte, origine, new Date(ora.getTime() - giorniFa * 86_400_000), id);

describe('file recenti: indice', () => {
  it('scadono dopo i giorni previsti', () => {
    expect(SCADENZA_GIORNI).toBe(30);
    expect(valide([voce('a', 29), voce('b', 31)], ora).map((v) => v.id)).toEqual(['a']);
  });

  it('lo stesso documento riaperto sostituisce la copia vecchia', () => {
    const r = aggiungiAllIndice([voce('vecchio', 2, 1000, 'dvr:1:pdf'), voce('altro', 1)], voce('nuovo', 0, 1000, 'dvr:1:pdf'), ora);
    expect(r.voci.map((v) => v.id)).toEqual(['nuovo', 'altro']);
    expect(r.via).toEqual(['vecchio']);
  });

  it('tiene al massimo MASSIMO_FILE file, togliendo i piu vecchi', () => {
    const tanti = Array.from({ length: MASSIMO_FILE }, (_, i) => voce(`f${i}`, i + 1));
    const r = aggiungiAllIndice(tanti, voce('nuovo', 0), ora);
    expect(r.voci).toHaveLength(MASSIMO_FILE);
    expect(r.voci[0].id).toBe('nuovo');
    expect(r.via).toEqual([`f${MASSIMO_FILE - 1}`]);
  });

  it('resta nel limite di spazio, ma il file appena aperto rimane sempre', () => {
    const r = aggiungiAllIndice([voce('a', 1, BYTE_MASSIMI / 2), voce('b', 2, BYTE_MASSIMI / 2)], voce('c', 0, BYTE_MASSIMI / 2), ora);
    expect(r.voci.map((v) => v.id)).toEqual(['c', 'a']);
    const enorme = aggiungiAllIndice([voce('a', 1)], voce('grande', 0, BYTE_MASSIMI * 2), ora);
    expect(enorme.voci.map((v) => v.id)).toEqual(['grande']);
  });

  it('toglie anche le scadute quando aggiunge', () => {
    expect(aggiungiAllIndice([voce('scaduta', 40)], voce('n', 0), ora).via).toEqual(['scaduta']);
  });
});

describe('file recenti: cifratura', () => {
  it('cifra e decifra con AES-GCM, IV diverso a ogni scrittura', async () => {
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const dati = new TextEncoder().encode('DVR Officina Esempio');
    const a = await cifra(k, dati);
    const b = await cifra(k, dati);
    expect(base64DaByte(a)).not.toBe(base64DaByte(b));
    expect(new TextDecoder().decode(await decifra(k, byteDaBase64(base64DaByte(a))))).toBe('DVR Officina Esempio');
    expect(new TextDecoder().decode(a)).not.toContain('Officina');
  });

  it('con un altra chiave non si legge', async () => {
    const k1 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const k2 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    let letto = true;
    await decifra(k2, await cifra(k1, new Uint8Array([1, 2, 3]))).catch(() => {
      letto = false;
    });
    expect(letto).toBe(false);
  });
});
