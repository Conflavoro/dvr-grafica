// Banco dei documenti HSE: un documento sbagliato già spuntato per il caricamento è l'errore più grave.
// Qui si pretende: zero errori gravi, ogni "da controllare" col suo motivo, ogni dato sanitario escluso, richiamo alto.
import { misura } from './__prove__/misura'

describe('banco dei documenti HSE', () => {
  it('zero errori gravi, sanitari sempre esclusi, precisione e richiamo misurati', async () => {
    const m = await misura()
    // I numeri, per il resoconto.
    console.log(`Banco: ${m.casi} casi, ${m.documenti} documenti. Proposti ${m.proposti}, corretti ${m.corretti}, attesi ${m.attesi}. Precisione ${(m.precisione * 100).toFixed(1)}%, richiamo ${(m.richiamo * 100).toFixed(1)}%, gravi ${m.gravi}, sanitari non esclusi ${m.sanitariNonEsclusi}\n${m.dettagli.join('\n')}`)
    expect(m.casi).toBeGreaterThanOrEqual(12)
    expect(m.gravi).toBe(0)
    expect(m.sanitariNonEsclusi).toBe(0)
    expect(m.senzaMotivo).toBe(0)
    expect(m.precisione).toBeGreaterThanOrEqual(0.95)
    expect(m.richiamo).toBeGreaterThanOrEqual(0.9)
  })
})

// Casi tenuti FUORI dal banco, per non tarare le regole sul banco stesso.
import { cartellaDaFile, piuAggiornatoPossibile, proposti, righeVerificate, scansiona } from './cerca-file'
import type { Trovato } from './cerca-file'
import { dataDopo, datoSanitario, sistemaOcr, verifica } from './riconosci'
import { IMPRESA, OGGI, attestato, dvr, nominaRspp, sds, verbaleTerra } from './__prove__/banco-documenti'
import { file } from './__prove__/costruttori'

const OGGI_ISO = '2026-11-06'
const NOI = { den: 'Officine Brianza S.r.l.', cf: '12345670966' }

describe('fuori banco', () => {
  it('partita IVA col prefisso IT va bene; un codice più lungo che contiene il nostro no', () => {
    expect(verifica(nominaRspp({ ...NOI, cf: 'IT12345670966' }, '10/03/2025'), 'nomina', IMPRESA, OGGI_ISO).verdetto).toBe('giusto')
    expect(verifica(nominaRspp({ ...NOI, cf: '912345670966' }, '10/03/2025'), 'nomina', IMPRESA, OGGI_ISO).verdetto).toBe('da_controllare')
  })

  it('senza codici dell\'azienda noti non si propone nulla, anche se il nome coincide', () => {
    const v = verifica(nominaRspp(NOI, '10/03/2025'), 'nomina', { denominazione: 'Officine Brianza S.r.l.' }, OGGI_ISO)
    expect(v.verdetto).toBe('da_controllare')
    expect(v.problema).toMatch(/non conosco il codice fiscale/)
  })

  it('la data si legge solo accanto alla sua etichetta, mai una data qualunque', () => {
    const t = verbaleTerra(NOI, '20/06/2025', '--/--/----').replace('Data della verifica 20/06/2025', 'Data della verifica --/--/----') + ' Data stampa 30/12/2027'
    const v = verifica(t, 'verbale_verifica', IMPRESA, OGGI_ISO)
    expect(v.verdetto).toBe('da_controllare')
    expect(dataDopo('valido fino al 31 febbraio 2027', /valido fino al/).data).toBeNull()
    expect(dataDopo('Prossima verifica entro il 3 marzo 2027', /prossima verifica/).data).toBe('2027-03-03')
    expect(dataDopo('Monza, lì 10/03/2025', /\bl[iì](?=\s)/).data).toBe('2025-03-10')
  })

  it('l\'OCR sistema numeri e date ma non tocca le parole né i codici fiscali', () => {
    expect(sistemaOcr('Il codice 1234567O966 del 2O/1O/2026 è valido')).toBe('Il codice 12345670966 del 20/10/2026 è valido')
    expect(sistemaOcr('ROSSI Olga, Il Lido')).toBe('ROSSI Olga, Il Lido')
    expect(sistemaOcr('codice fiscale BNCGLI82B41F205Y')).toBe('codice fiscale BNCGLI82B41F205Y')
  })

  it('verbale con esito negativo, verbale senza prossima verifica con periodicità prudente', () => {
    expect(verifica(verbaleTerra(NOI, '20/06/2025', '20/06/2027', 'NEGATIVO'), 'verbale_verifica', IMPRESA, OGGI_ISO).problema).toMatch(/esito della verifica è negativo/)
    const senzaProssima = verbaleTerra(NOI, '20/06/2025', '').replace(/Prossima verifica entro il\s*$/, '')
    const v = verifica(senzaProssima, 'verbale_verifica', IMPRESA, OGGI_ISO)
    expect(v.verdetto).toBe('giusto')
    expect(v.scadenza).toBe('2027-06-20')
    const vecchio = verifica(verbaleTerra(NOI, '20/06/2023', '').replace(/Prossima verifica entro il\s*$/, ''), 'verbale_verifica', IMPRESA, OGGI_ISO)
    expect(vecchio.problema).toMatch(/periodicità prudente di 2 anni risulta scaduta/)
  })

  it('SDS con le sole frasi R della vecchia direttiva: da controllare', () => {
    const vecchia = sds('Diluente', '10/02/2018').replace('Indicazioni di pericolo H315 H319', 'Frasi R: R11 R36/38 Direttiva 67/548/CEE')
    expect(verifica(vecchia, 'sds', IMPRESA, OGGI_ISO).problema).toMatch(/frasi R/)
  })

  it('un DUVRI non è il DVR; un DVR di cinque anni fa si propone ma si dice che va rivisto', () => {
    const duvri = 'DOCUMENTO UNICO DI VALUTAZIONE DEI RISCHI DA INTERFERENZE (DUVRI) art. 26 ' + dvr(NOI, '15/01/2025')
    expect(verifica(duvri, 'dvr', IMPRESA, OGGI_ISO).problema).toMatch(/DUVRI/)
    const v = verifica(dvr(NOI, '15/01/2021'), 'dvr', IMPRESA, OGGI_ISO)
    expect(v.verdetto).toBe('giusto')
    expect(v.verificato.join(' ')).toMatch(/va rivisto/)
  })

  it('attestato: RLS da aggiornare ogni anno, formazione generale che non scade, lavoratori sconosciuti', () => {
    const rls = verifica(attestato('Corso di aggiornamento per Rappresentante dei lavoratori per la sicurezza', 'Marco Rossi, codice fiscale RSSMRC80A01F205X,', '01/06/2025', 4), 'attestato_formazione', IMPRESA, OGGI_ISO)
    expect(rls.problema).toMatch(/ogni anno/)
    const generale = verifica(attestato('Formazione generale', 'Marco Rossi, codice fiscale RSSMRC80A01F205X,', '01/06/2010', 4), 'attestato_formazione', IMPRESA, OGGI_ISO)
    expect(generale.verdetto).toBe('giusto')
    const senzaLavoratori = verifica(attestato('Corso preposti', 'Marco Rossi', '01/06/2026'), 'attestato_formazione', { ...IMPRESA, lavoratori: [] }, OGGI_ISO)
    expect(senzaLavoratori.problema).toMatch(/non conosco i lavoratori/)
  })

  it('dati sanitari: cartella sanitaria, certificato medico, esiti di esami; non il DVR né la nomina del medico', () => {
    expect(datoSanitario('CARTELLA SANITARIA E DI RISCHIO (Allegato 3A) Lavoratore Mario Bianchi anamnesi lavorativa esame obiettivo')).toBe('cartella sanitaria e di rischio')
    expect(datoSanitario('CERTIFICATO MEDICO si certifica che il paziente presenta diagnosi di lombalgia prognosi di giorni 7')).not.toBeNull()
    expect(datoSanitario('Esito degli esami ematochimici: emocromo nella norma, referto allegato')).not.toBeNull()
    expect(datoSanitario(dvr(NOI, '15/01/2025'))).toBeNull()
    expect(verifica('CERTIFICATO MEDICO diagnosi prognosi di giorni 7 referto', 'nomina', IMPRESA, OGGI_ISO).verdetto).toBe('escluso')
  })

  it('proposti: mai un da controllare o un escluso, fra due validi il più recente e lo dice, una proposta per chiave', () => {
    const r: Trovato[] = [
      { percorso: 'a', nome: 'a', byte: 1, modificato: 3, punteggio: 30, tipo: 'nomina', verdetto: 'giusto', data: '2024-01-10', chiave: 'rspp' },
      { percorso: 'b', nome: 'b', byte: 1, modificato: 1, punteggio: 30, tipo: 'nomina', verdetto: 'giusto', data: '2025-02-25', chiave: 'rspp' },
      { percorso: 'c', nome: 'c', byte: 1, modificato: 1, punteggio: 30, tipo: 'nomina', verdetto: 'giusto', data: '2025-02-25', chiave: 'medico_competente' },
      { percorso: 'd', nome: 'd', byte: 1, modificato: 9, punteggio: 9, tipo: 'visura', verdetto: 'da_controllare', problema: 'vecchia' },
      { percorso: 'e', nome: 'e', byte: 1, modificato: 9, punteggio: 0, tipo: null, verdetto: 'escluso', problema: 'dato sanitario' },
    ]
    const p = proposti(r, ['nomina', 'visura'])
    expect(p.map(x => x.trovato.percorso)).toEqual(['b', 'c'])
    expect(p[0]!.nota).toMatch(/scelgo il più recente, con la data del 25 febbraio 2025/)
  })

  it('il DVR vecchio non ferma la ricerca: se ne cerca uno più recente', () => {
    expect(piuAggiornatoPossibile('dvr', '2025-01-15', OGGI_ISO)).toBe(false)
    expect(piuAggiornatoPossibile('dvr', '2026-03-01', OGGI_ISO)).toBe(true)
    expect(piuAggiornatoPossibile('visura', null, OGGI_ISO)).toBe(true)
  })

  it('il messaggio a Falco dice che cosa è stato verificato, o perché il file è da controllare o escluso', () => {
    const righe = righeVerificate(
      [{ id: 1, nome: 'rspp.pdf', etichetta: 'Nomina' }, { id: 2, nome: 'visura.pdf', etichetta: 'Visura' }, { id: 3, nome: 'x.pdf', etichetta: 'Altro' }],
      [{ verdetto: 'giusto', verificato: ['è la nomina del RSPP', 'è datata 10 marzo 2025'] }, { verdetto: 'da_controllare', problema: 'è una visura del 12 marzo 2023, di più di sei mesi fa' }, { verdetto: 'escluso', problema: 'dato sanitario: lo conserva il medico competente, non si carica' }],
    )
    expect(righe[0]).toBe('«rspp.pdf» [documento 1, riconosciuto come: Nomina] Verificato sul computer: è la nomina del RSPP; è datata 10 marzo 2025.')
    expect(righe[1]).toMatch(/Da controllare, l'ha scelto la persona: è una visura del 12 marzo 2023/)
    expect(righe[2]).toMatch(/Escluso: dato sanitario/)
  })

  it('un file scelto per nome ma illeggibile non si propone: resta da controllare col motivo', async () => {
    const trovati: Trovato[] = []
    await scansiona(cartellaDaFile([file('Nomina RSPP.pdf', Buffer.from('%PDF-1.4 rovinato'), 'P/Nomina RSPP.pdf')]), { tipi: ['nomina'], parole_chiave: [], impresa: IMPRESA }, t => trovati.push(t), { oggi: () => OGGI.getTime() })
    expect(trovati[0]?.verdetto).toBe('da_controllare')
    expect(trovati[0]!.problema).toMatch(/non sono riuscito a leggere il contenuto/)
    expect(proposti(trovati, ['nomina'])).toHaveLength(0)
  })
})
