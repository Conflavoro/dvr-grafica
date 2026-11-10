import { verifica } from './riconosci'

// Casi trovati provando la ricerca dal vivo il 09/11: attestati con la data in fondo o dopo
// «Data di conclusione del corso», letti con l'OCR da una foto.
const imp = { partita_iva: '00011122244', lavoratori: [{ nome: 'Maria', cognome: 'Greco' }] }
const corpo = 'ATTESTATO DI FREQUENZA E PROFITTO\nCorso di formazione per addetti al primo soccorso\nAziende del Gruppo B - DM 388/2003 - durata 12 ore\nSi attesta che\nMARIA GRECO\nha frequentato il corso con verifica finale superata\n'

test('data dopo «Data di conclusione del corso»', () => {
  const v = verifica(corpo + 'Data di conclusione del corso: 20/10/2026\nEnte formatore: Formazione Sicura Srl', 'attestato_formazione', imp, '2026-11-09')
  expect(v.verdetto).toBe('giusto')
  expect(v.data).toBe('2026-10-20')
})

test('data solo nella riga finale «Città, data»', () => {
  const v = verifica(corpo + 'Ente formatore: Formazione Sicura Srl\n\nViterbo, 20/10/2026', 'attestato_formazione', imp, '2026-11-09')
  expect(v.data).toBe('2026-10-20')
})

test('persona che non lavora in azienda: da controllare', () => {
  const v = verifica(corpo.replace('MARIA GRECO', 'PAOLO BIANCHI') + 'Data di conclusione del corso: 20/10/2026', 'attestato_formazione', imp, '2026-11-09')
  expect(v.verdetto).toBe('da_controllare')
})
