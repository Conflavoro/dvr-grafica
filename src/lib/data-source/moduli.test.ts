// Mapper dei pannelli dei moduli nuovi: forme del backend (Pannelli.php e
// metodi pannello() degli *Strumenti.php), dati sporchi, tipi sconosciuti.

import { mapPannello } from './agente-mappers';
import { mapPannelloModuli, mapProposta, mapRigaDocumentoHse, mapRigaValutazione, nomeTipoDocumento } from './moduli-mappers';
import { testoErroreHttp } from './moduli-api';
import { demoCoda, demoCruscotto, demoDuvri, demoNuovoAssunto, demoQualita, demoSchedaAvvio, demoValutazioneRumore, pannelliDemo } from './moduli-demo';

type P<T extends string> = Extract<NonNullable<ReturnType<typeof mapPannelloModuli>>, { tipo: T }>;

test('valutazione: esito, righe con colore e segnalazioni ordinate (blocca prima)', () => {
  const p = mapPannello({
    tipo: 'valutazione',
    chiave: 'valutazione:3',
    valutazione_id: '3',
    azienda_id: 7,
    tipo_valutazione: 'vibrazioni',
    nome: 'Vibrazioni',
    stato: 'bozza',
    esito: { livello: 3, colore: 'rosso', testo: 'Valore limite superato' },
    righe: [{ voce: 'Carrellista · corpo intero', valore: 'A(8) 1,12 m/s²', esito: 'Oltre il valore limite', colore: 'rosso' }, { voce: '', valore: '' }, 'x'],
    segnalazioni: [
      { chiave: 'a', esito: 'avvisa', messaggio: 'Avviso' },
      { chiave: 'b', esito: 'blocca', messaggio: 'Manca il tempo di esposizione', riferimento: 'art. 202' },
      { chiave: 'c', esito: 'strano', messaggio: '' },
    ],
  }) as P<'valutazione'>;
  expect(p.tipo).toBe('valutazione');
  expect(p.valutazione_id).toBe(3);
  expect(p.esito).toEqual({ testo: 'Valore limite superato', colore: 'rosso', livello: 3 });
  expect(p.righe).toHaveLength(1);
  expect(p.righe[0].colore).toBe('rosso');
  expect(p.segnalazioni.map((s) => s.esito)).toEqual(['blocca', 'avvisa']);
  expect(p.conteggi).toBeNull();
});

test('valutazione senza id e tipi sconosciuti vengono scartati', () => {
  expect(mapPannello({ tipo: 'valutazione', nome: 'Rumore' })).toBeNull();
  expect(mapPannelloModuli({ tipo: 'inventato', azienda_id: 1 })).toBeNull();
  expect(mapPannelloModuli(null)).toBeNull();
});

test('documento HSE: accettata null diventa false, conteggi completi, colore arancione normalizzato', () => {
  const p = mapPannello(demoDuvri()) as P<'documento_hse'>;
  expect(p.documento_id).toBe(9101);
  expect(p.tipo_documento).toBe('duvri');
  expect(p.puo_emettere).toBe(false);
  expect(p.conteggi).toEqual({ blocca: 1, corregge: 1, avvisa: 1 });
  expect(p.segnalazioni.every((s) => s.accettata === false)).toBe(true);
  expect(p.segnalazioni[0].esito).toBe('blocca');
});

test('elenco documenti HSE: righe senza id scartate', () => {
  const p = mapPannello({ tipo: 'documenti_hse', documenti: [{ documento_id: 4, tipo: 'pimus', stato: 'emesso', revisione: 2, conteggi: { blocca: '0' } }, { tipo: 'haccp' }] }) as P<'documenti_hse'>;
  expect(p.documenti).toHaveLength(1);
  expect(p.documenti[0].conteggi).toEqual({ blocca: 0, corregge: 0, avvisa: 0 });
});

test('qualità: punteggio limitato a 0..100 e miglioramenti leggibili', () => {
  const p = mapPannello({ ...demoQualita(), punteggio: 140 }) as P<'qualita'>;
  expect(p.punteggio).toBe(100);
  expect(p.componenti.length).toBe(5);
  expect(p.miglioramenti[0]).toEqual({ azione: 'Indica per ogni interferenza chi fa cosa e con quali attrezzature.', guadagno: 7.5 });
});

test('Nube 81: link solo http(s), elenchi puliti', () => {
  const p = mapPannello({ tipo: 'nube81', azienda_id: 2, modello: 'dvr_uffici', compilati: 40, mancanti: ['RSPP_NOME', 3], nube81: { da_aggiungere_a_nube: ['ATECO'] }, link: 'javascript:alert(1)', avvisi: ['Sede legale usata come sede operativa'] }) as P<'nube81'>;
  expect(p.link).toBeNull();
  expect(p.mancanti).toEqual(['RSPP_NOME']);
  expect(p.da_aggiungere_a_nube).toEqual(['ATECO']);
  expect(p.avvisi).toHaveLength(1);
});

test('coda di lavoro: dettaglio leggibile per tipo e allarmi', () => {
  const p = mapPannello(demoCoda(5)) as P<'coda_lavoro'>;
  expect(p.proposte).toHaveLength(3);
  expect(p.proposte[0].dettaglio).toContain('PEC: amministrazione@esempio-pec.it');
  expect(p.proposte[1].dettaglio[0]).toMatch(/^Entro il \d{2}\/\d{2}\/\d{4}$/);
  expect(p.proposte[2].dettaglio).toContain('Importo 360,00 €');
  expect(p.allarmi[0].livello).toBe('ambra');
  expect(p.fatto_oggi).toEqual({ approvate: 4, respinte: 1 });
});

test('proposta: stato sconosciuto diventa in attesa, errore dall’esito', () => {
  const p = mapProposta({ id: 1, tipo: 'attivita', titolo: 'Assegnare il RSPP', stato: 'boh', esito: { errore: 'Azienda non trovata' }, payload: { descrizione: 'Serve un RSPP esterno' } });
  expect(p?.stato).toBe('in_attesa');
  expect(p?.errore).toBe('Azienda non trovata');
  expect(p?.dettaglio).toEqual(['Serve un RSPP esterno']);
  expect(mapProposta({ titolo: 'senza id' })).toBeNull();
});

test('cruscotto: undici indicatori, stato non riconosciuto = n_d', () => {
  const p = mapPannello(demoCruscotto()) as P<'cruscotto'>;
  expect(p.indicatori).toHaveLength(11);
  expect(p.indicatori[10].valore).toBeNull();
  expect(p.indicatori[10].stato).toBe('n_d');
  const q = mapPannelloModuli({ tipo: 'cruscotto', indicatori: [{ codice: 'x', nome: 'X', stato: 'viola', valore: '12' }] }) as P<'cruscotto'>;
  expect(q.indicatori[0]).toMatchObject({ stato: 'n_d', valore: 12 });
});

test('scheda di avvio: dettagli dei passi in italiano', () => {
  const p = mapPannello(demoSchedaAvvio(3)) as P<'scheda_avvio'>;
  expect(p.passi).toHaveLength(4);
  expect(p.passi[0].dettagli[0]).toBe('9 documenti caricati, 9 letti');
  expect(p.passi[0].dettagli[1]).toContain('documento sanitario fermato');
  expect(p.passi[1].da_confermare).toEqual([{ proposta_id: 9301, titolo: 'Aggiornare i dati: pec, ateco' }]);
  expect(p.passi[2].dettagli).toEqual(['Medico competente', 'Addetti antincendio']);
});

test('portale: nuovo assunto, promemoria, condivisioni', () => {
  const n = mapPannello(demoNuovoAssunto(4)) as P<'nuovo_assunto'>;
  expect(n.lavoratore?.sorveglianza).toBe(true);
  expect(n.quota?.importo).toBe('95,00 €');
  expect(n.scadenze).toHaveLength(2);
  const pr = mapPannello({ tipo: 'promemoria', azienda_id: 4, scadenza: { descrizione: 'Visita periodica', appuntamento_il: '2026-10-20 09:30', confermata_il: null }, passi: [{ passo: 1, nome: 'Avviso dell’appuntamento', previsto_il: '2026-10-15 10:00', esito: 'inviato', canale: 'whatsapp' }, { nome: '' }] }) as P<'promemoria'>;
  expect(pr.visita?.confermata).toBe(false);
  expect(pr.passi).toHaveLength(1);
  const c = mapPannello({ tipo: 'condivisioni', azienda_id: 4, condivisioni: [{ id: 2, destinatario: 'Studio paghe Alfa', cartelle: ['formazione', 1], scade_il: '2027-01-10T00:00:00Z', valida: true, revocata_il: null, accessi: [{}, {}] }] }) as P<'condivisioni'>;
  expect(c.condivisioni[0]).toMatchObject({ cartelle: ['formazione'], accessi: 2, revocata: false });
});

test('radon: esito sopra o sotto e scadenze con nome', () => {
  const p = mapPannello({ tipo: 'radon_calcolo', media: 412.3, incertezza: 12, esito: 'sopra', giorni: 365, scadenze: { ripetizione: '2027-10-01', comunicazione: null, risanamento: '2028-10-01' } }) as P<'radon_calcolo'>;
  expect(p.sopra).toBe(true);
  expect(p.scadenze).toEqual([
    { voce: 'Nuova misura', data: '2027-10-01' },
    { voce: 'Misure correttive', data: '2028-10-01' },
  ]);
});

test('righe del tavolo: valutazione con esito, documento HSE con controllo', () => {
  const v = mapRigaValutazione({ id: 5, company_id: 2, tipo: 'chimico', nome: 'Agenti chimici', stato: 'emessa', revisione_corrente: 1, esito: { testo: 'Rischio irrilevante per la salute', colore: 'verde' }, updated_at: '2026-10-01T10:00:00Z' });
  expect(v).toMatchObject({ chiave: 'valutazione:5', origine: 'valutazione', titolo: 'Valutazione agenti chimici', revisione: 1 });
  expect(v?.esito?.colore).toBe('verde');
  const d = mapRigaDocumentoHse({ id: 8, tipo: 'emergenza', stato: 'bozza', revisione_corrente: 0, ultimo_controllo: { puo_emettere: false, conteggi: { blocca: 2 } } });
  expect(d).toMatchObject({ chiave: 'hse:8', titolo: 'Piano di emergenza', puo_emettere: false });
  expect(d?.conteggi?.blocca).toBe(2);
  expect(mapRigaDocumentoHse({ tipo: 'duvri' })).toBeNull();
  expect(nomeTipoDocumento('pimus')).toBe('PiMUS');
  expect(nomeTipoDocumento('nuovo_tipo')).toBe('Nuovo tipo');
});

test('demo: ogni pannello dimostrativo passa dal mapper vero', () => {
  for (const r of [demoValutazioneRumore(1), demoDuvri(), demoQualita(), demoCoda(1), demoCruscotto(), demoNuovoAssunto(1), demoSchedaAvvio(1)]) {
    expect(mapPannello(r)).not.toBeNull();
  }
  expect(pannelliDemo('Valuta il rumore della piegatura', 1)).toHaveLength(1);
  expect(pannelliDemo('Ciao', 1)).toHaveLength(0);
});

test('errori HTTP in italiano con cosa fare', () => {
  expect(testoErroreHttp(413)).toContain('24 MB');
  expect(testoErroreHttp(429)).toContain('Attendi un minuto');
  expect(testoErroreHttp(500)).toContain('Riprova tra qualche minuto');
  expect(testoErroreHttp(422, 'Il campo file è obbligatorio.')).toBe('Il campo file è obbligatorio.');
  expect(testoErroreHttp(403, 'Gli ordini li approva il titolare dell’azienda.')).toBe('Gli ordini li approva il titolare dell’azienda.');
  expect(testoErroreHttp(403, 'This action is unauthorized.')).toBe('Operazione non consentita per il tuo ruolo.');
  for (const s of [0, 408, 413, 422, 429, 500, 503]) expect(/[–—]/.test(testoErroreHttp(s))).toBe(false);
});
