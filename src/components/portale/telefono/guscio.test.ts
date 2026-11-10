import { SEZIONI_AZIENDA, SEZIONI_GESTIONALE, gruppi, sezioniVisibili, trovaSezione, vociBarra } from '@/lib/portale/sezioni';
import { azzeraNavigazione, cePrecedente, contatoriBarra, entraIn, indietroDi, interna, livello, transizione } from './navigazione';
import { GESTI, chiudeFoglio, parteOrizzontale, rigaResta, tornaDalBordo } from './gesti';
import { DURATA_TOAST, azzeraContatori, impostaContatori, leggiContatori } from './stato';
import { fascicoloCompletoDi, sediAlimentariDi, sediDi } from './SceltaSede';

const TUTTI = ['dashboard', 'scadenziario', 'dipendenti_vedi', 'formazione_vedi', 'visite_vedi', 'documenti_vedi', 'ordini_richiedi', 'contratto_fatture', 'wallet_saldo', 'utenti_invita_dipendenti', 'avvio', 'messaggi', 'primosoccorso_modifica', 'haccp_gestisci', 'infortuni_denuncia'];

describe('menu dell area azienda (03 §3)', () => {
  it('ordine e gruppi della specifica, senza Near miss e Importa dati', () => {
    const g = gruppi(sezioniVisibili('azienda', { permessi: TUTTI, sediAlimentari: 1 }));
    expect(g.map((x) => x.titolo)).toEqual([null, 'Operatività', 'Documenti e servizi', 'Account', null]);
    expect(g[1].voci.map((s) => s.chiave)).toEqual(['scadenze', 'persone', 'formazione', 'visite', 'antincendio', 'primosoccorso', 'haccp', 'infortuni']);
    expect(g[3].voci.map((s) => s.chiave)).toEqual(['contratto', 'wallet', 'utenti', 'avvio']);
    expect(g[4].voci.map((s) => s.chiave)).toEqual(['messaggi']);
    expect(SEZIONI_AZIENDA.map((s) => s.chiave)).not.toContain('nearmiss');
  });

  it('HACCP solo con una sede alimentare, anche sul telefono', () => {
    const v = (o: object) => sezioniVisibili('azienda', { permessi: TUTTI, ...o }).map((s) => s.chiave);
    expect(v({})).not.toContain('haccp');
    expect(v({ sediAlimentari: 0 })).not.toContain('haccp');
    expect(v({ sediAlimentari: 2 })).toContain('haccp');
    // Con la sede alimentare HACCP c'è anche sul telefono.
    expect(v({ sediAlimentari: 2, telefono: true })).toContain('haccp');
    // Le sezioni dei luoghi seguono quelle che il server calcola per il ruolo.
    expect(v({ sediAlimentari: 2, sezioni: ['antincendio', 'infortuni'] })).not.toContain('primosoccorso');
  });

  it('Completa il fascicolo sparisce quando il fascicolo e completo', () => {
    expect(sezioniVisibili('azienda', { permessi: TUTTI, fascicoloCompleto: true }).map((s) => s.chiave)).not.toContain('avvio');
    expect(sezioniVisibili('azienda', { permessi: TUTTI, fascicoloCompleto: false }).map((s) => s.chiave)).toContain('avvio');
  });

  it('le categorie nuove hanno colore e icona', () => {
    for (const k of ['primosoccorso', 'haccp', 'infortuni']) {
      const s = trovaSezione('azienda', k);
      expect(s?.categoria).toBe(k);
      expect(typeof s?.icona).toBe('function');
    }
  });

  it('Near miss e Importa dati nel gestionale', () => {
    expect(SEZIONI_GESTIONALE.map((s) => s.chiave)).toContain('nearmiss');
    expect(SEZIONI_GESTIONALE.map((s) => s.chiave)).toContain('importa');
  });
});

describe('barra in basso del telefono (03 §2)', () => {
  it('cinque colonne: Home, Scadenze, assistente, Persone, Tutto; Messaggi non c e', () => {
    const v = vociBarra(sezioniVisibili('azienda', { permessi: TUTTI }));
    expect(v.map((s) => s?.chiave ?? null)).toEqual(['dashboard', 'scadenze', 'persone']);
    expect(SEZIONI_AZIENDA.find((s) => s.chiave === 'messaggi')?.tab ?? null).toBe(null);
  });

  it('il consulente vede solo Persone: le colonne vuote restano, l assistente resta al centro (09)', () => {
    const v = vociBarra(sezioniVisibili('azienda', { permessi: ['dipendenti_vedi', 'messaggi'] }));
    expect(v.map((s) => s?.chiave ?? null)).toEqual([null, null, 'persone']);
  });

  it('contatori: Home e Scadenze dai loro numeri, Tutto somma le sezioni visibili', () => {
    const vis = sezioniVisibili('azienda', { permessi: TUTTI, fascicoloCompleto: false });
    const c = contatoriBarra({ dashboard: 19, scadenze: 3, documenti: 1, servizi: 1, antincendio: 3, primosoccorso: 4, messaggi: 1, avvio: 0, formazione: 7 }, vis);
    expect(c).toEqual({ home: 19, scadenze: 3, tutto: 10 });
    // Messaggi non visibile al ruolo: non entra nella somma.
    const senza = sezioniVisibili('azienda', { permessi: ['documenti_vedi'] });
    expect(contatoriBarra({ documenti: 2, messaggi: 5 }, senza).tutto).toBe(2);
  });
});

describe('profondita e transizioni (03 §2)', () => {
  const vis = SEZIONI_AZIENDA;
  beforeEach(() => azzeraNavigazione());

  it('voce della barra 0, altra sezione 1, dettaglio con id +2', () => {
    expect(livello('dashboard', false, vis)).toBe(0);
    expect(livello('tutto', false, vis)).toBe(0);
    expect(livello('formazione', false, vis)).toBe(1);
    expect(livello('persone', true, vis)).toBe(2);
    expect(livello('documenti', true, vis)).toBe(3);
    expect(interna('dashboard', false, vis)).toBe(false);
    expect(interna('notifiche', false, vis)).toBe(true);
  });

  it('push scendendo, pop risalendo, tab allo stesso livello e al primo disegno, niente sulla stessa pagina', () => {
    expect(transizione(null, { chiave: 'a', livello: 0 })).toBe('v-tab');
    expect(transizione({ chiave: 'a', livello: 0 }, { chiave: 'b', livello: 1 })).toBe('v-push');
    expect(transizione({ chiave: 'b', livello: 1 }, { chiave: 'a', livello: 0 })).toBe('v-pop');
    expect(transizione({ chiave: 'a', livello: 0 }, { chiave: 'c', livello: 0 })).toBe('v-tab');
    expect(transizione({ chiave: 'a', livello: 0 }, { chiave: 'a', livello: 0 })).toBe('');
  });

  it('entraIn ricorda la pagina precedente e regge il doppio disegno', () => {
    expect(cePrecedente()).toBe(false);
    expect(entraIn({ chiave: 'azienda/dashboard', livello: 0 })).toBe('v-tab');
    expect(entraIn({ chiave: 'azienda/dashboard', livello: 0 })).toBe('v-tab');
    expect(cePrecedente()).toBe(false);
    expect(entraIn({ chiave: 'azienda/formazione', livello: 1 })).toBe('v-push');
    expect(cePrecedente()).toBe(true);
  });

  it('Indietro senza storia porta alla prima pagina del ruolo', () => {
    expect(indietroDi('azienda', sezioniVisibili('azienda', { permessi: TUTTI }))).toBe('/azienda/dashboard/');
    expect(indietroDi('azienda', sezioniVisibili('azienda', { permessi: ['dipendenti_vedi'] }))).toBe('/azienda/persone/');
  });
});

describe('gesti (08 §B)', () => {
  it('soglie della specifica', () => {
    expect(GESTI).toMatchObject({ rigaSoglia: 8, rigaAzione: 78, bordo: 24, bordoSegue: 0.6, bordoSoglia: 90, foglioSoglia: 110 });
    expect(parteOrizzontale(9, 2)).toBe(true);
    expect(parteOrizzontale(8, 0)).toBe(false);
    expect(parteOrizzontale(20, 30)).toBe(false);
    expect(rigaResta(-40, 1)).toBe(true);
    expect(rigaResta(-38, 1)).toBe(false);
    expect(chiudeFoglio(111)).toBe(true);
    expect(chiudeFoglio(110)).toBe(false);
    expect(tornaDalBordo(20, 91)).toBe(true);
    expect(tornaDalBordo(30, 200)).toBe(false);
    expect(tornaDalBordo(10, 80)).toBe(false);
  });
});

describe('stato del guscio', () => {
  it('contatori: zero e null tolgono il pallino', () => {
    azzeraContatori();
    impostaContatori({ documenti: 2, messaggi: 0, servizi: null });
    expect(leggiContatori()).toEqual({ documenti: 2 });
    impostaContatori({ documenti: 0 });
    expect(leggiContatori()).toEqual({});
  });

  it('il toast resta 3,2 secondi', () => {
    expect(DURATA_TOAST).toBe(3200);
  });
});

describe('sedi (contratto con S2)', () => {
  it('legge le sedi senza dipendere dalla forma attuale', () => {
    expect(sediDi(null)).toEqual([]);
    expect(sediDi({ sedi: [{ id: 3, nome: 'Lucca', alimentare: true }, { nome: 'senza id' }] })).toEqual([
      { id: 3, nome: 'Lucca', indirizzo: null, insegna: null, alimentare: true },
    ]);
    expect(sediAlimentariDi({ sedi_alimentari: 2 })).toBe(2);
    expect(sediAlimentariDi({ sedi: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B', alimentare: true }] })).toBe(1);
    expect(sediAlimentariDi({})).toBeNull();
    expect(fascicoloCompletoDi({ fascicolo_completo: true })).toBe(true);
    expect(fascicoloCompletoDi({})).toBeNull();
  });
});
