import { dividiScadenze, leggiRicevute, mappaAppLavoratore, salvaRicevuta } from './lavoratore-api';
import { etichettaStato, mappaNearMiss, mappaRegistro, passoNearMiss, prossimaAzione } from './nearmiss-api';
import { mappaDettaglio, validaFinoAl } from './medico-api';
import { sezioniVisibili, trovaSezione } from './sezioni';

describe('app del lavoratore', () => {
  it('divide le scadenze in scadute, entro 30 giorni e più avanti', () => {
    const oggi = new Date(2026, 9, 14);
    const r = dividiScadenze(
      [
        { tipo: 'corso', cosa: 'Generale', data: '2026-12-31' },
        { tipo: 'visita', cosa: 'Visita', data: '2026-10-01' },
        { tipo: 'dpi', cosa: 'Guanti', data: '2026-11-10' },
      ],
      oggi,
    );
    expect(r.scadute.map((x) => x.cosa)).toEqual(['Visita']);
    expect(r.vicine.map((x) => x.cosa)).toEqual(['Guanti']);
    expect(r.lontane.map((x) => x.cosa)).toEqual(['Generale']);
  });

  it('mappa la risposta in modo tollerante', () => {
    const d = mappaAppLavoratore({
      scadenze: [{ tipo: 'corso', cosa: 'A', data: '2027-01-01' }, { tipo: 'strano', data: 'x' }, null],
      visita: { prossima: { scadenza_id: 3, quando: '2026-10-20 09:00', luogo: 'Centro' }, esito: 'Idoneo', giudizio_id: 9 },
      informativa_mansione: { mansione: 'Cuoco', dvr_versione: 2, rischi: [{ categoria: 'Rumore', misure: ['Cuffie', 3] }], dpi: ['Guanti'] },
      near_miss: [{ id: 1, stato: 'analisi' }, { nessuno: true }],
    });
    expect(d.scadenze).toHaveLength(1);
    expect(d.visita.prossima?.luogo).toBe('Centro');
    expect(d.visita.giudizioId).toBe(9);
    expect(d.informativa?.rischi[0].misure).toEqual(['Cuffie']);
    expect(d.nearMiss).toHaveLength(1);
    expect(mappaAppLavoratore(null).informativa).toBeNull();
  });

  it('i codici ricevuta restano sul telefono, per link, solo nel formato giusto', () => {
    const t = 'lav_' + 'a'.repeat(40);
    const altro = 'lav_' + 'b'.repeat(40);
    salvaRicevuta(t, 'nmr_' + 'X'.repeat(24));
    salvaRicevuta(t, 'non valido');
    expect(leggiRicevute(t)).toEqual(['nmr_' + 'X'.repeat(24)]);
    expect(leggiRicevute(altro)).toEqual([]);
  });
});

describe('near miss', () => {
  it('flusso: passi ed azione successiva', () => {
    expect(prossimaAzione('ricevuta')).toBe('presa');
    expect(prossimaAzione('presa_in_carico')).toBe('analisi');
    expect(prossimaAzione('analisi')).toBe('azioni');
    expect(prossimaAzione('azioni')).toBe('chiudi');
    expect(prossimaAzione('chiusa')).toBeNull();
    expect(passoNearMiss('azioni')).toBe(3);
    expect(passoNearMiss('boh')).toBe(0);
    expect(etichettaStato('presa_in_carico')).toBe('Presa in carico');
  });

  it('mappa segnalazione e registro senza rompersi', () => {
    const n = mappaNearMiss({
      id: 4,
      codice: 'NM-2026-0004',
      stato: 'xx',
      gravita: 'alta',
      analisi: { cause: ['a', ''], classificazione: 'altro' },
      rischio_dvr: { dvr_id: 2, indice: 1, etichetta: 'Rumore' },
    });
    expect(n?.stato).toBe('ricevuta');
    expect(n?.gravita).toBe('alta');
    expect(n?.analisi?.cause).toEqual(['a']);
    expect(n?.rischio?.indice).toBe(1);
    expect(mappaNearMiss({})).toBeNull();
    const r = mappaRegistro({ near_miss: [{ id: 1 }], statistiche: { totale: 3, aperti: 2, per_classificazione: { a: 1, b: 2 }, giorni_medi_chiusura: null } });
    expect(r.voci).toHaveLength(1);
    expect(r.statistiche.perClassificazione[0]).toEqual({ k: 'b', n: 2 });
    expect(r.statistiche.giorniMedi).toBeNull();
  });
});

describe('portale del medico', () => {
  it('calcola la validità come il backend, anche a fine mese', () => {
    expect(validaFinoAl('2026-10-13', 12)).toBe('2027-10-13');
    expect(validaFinoAl('2026-01-31', 6)).toBe('2026-07-31');
    expect(validaFinoAl('2026-08-31', 6)).toBe('2027-02-28');
    expect(validaFinoAl('x', 12)).toBeNull();
  });

  it('mappa il dettaglio dell azienda', () => {
    const d = mappaDettaglio({
      azienda: { id: 1, ragione_sociale: 'A' },
      puo_registrare: true,
      lavoratori: [{ id: 2, nome: 'Aldo', da_fare_entro_60: true, rischi: ['Rumore'] }, {}],
      periodi_mesi: [6, 12],
    });
    expect(d.puoRegistrare).toBe(true);
    expect(d.lavoratori).toHaveLength(1);
    expect(d.lavoratori[0].daFare).toBe(true);
    expect(d.periodi).toEqual([6, 12]);
  });
});

describe('sezioni', () => {
  it('near miss fuori dall app del cliente: resta nel gestionale (decisione del 30/10/2026)', () => {
    expect(sezioniVisibili('azienda', { permessi: ['nearmiss_vedi'] }).map((s) => s.chiave)).not.toContain('nearmiss');
    expect(trovaSezione('azienda', 'nearmiss')?.titolo).toBe('Near miss');
    expect(sezioniVisibili('gestionale', { ruolo: 'consulente' }).map((s) => s.chiave)).toContain('nearmiss');
  });

  it('il medico esterno nel gestionale vede solo il suo portale; lo studio non perde le sue voci', () => {
    const m = sezioniVisibili('gestionale', { ruolo: 'utente_azienda' });
    expect(m.map((s) => s.chiave)).toEqual(['medico']);
    expect(m[0].tab).toBe(1);
    const studio = sezioniVisibili('gestionale', { ruolo: 'consulente' });
    expect(studio.map((s) => s.chiave)).toContain('medico');
    expect(studio.find((s) => s.chiave === 'medico')?.tab ?? 0).toBe(0);
  });
});
