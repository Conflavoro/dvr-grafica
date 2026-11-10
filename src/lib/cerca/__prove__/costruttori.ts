// Costruttori dei file finti per le prove: PDF a testo, PDF scansione, immagini, zip, buste p7m.
import { deflateRawSync, deflateSync } from 'zlib'

export function pdf(testo: string): Buffer {
  const contenuto = `BT /F1 12 Tf 72 720 Td (${testo.replace(/[()\\]/g, '\\$&')}) Tj ET`
  const corpo = deflateSync(Buffer.from(contenuto, 'latin1'))
  const testa = `%PDF-1.4\n1 0 obj\n<< /Length ${corpo.length} /Filter /FlateDecode >>\nstream\n`
  return Buffer.concat([Buffer.from(testa, 'latin1'), corpo, Buffer.from('\nendstream\nendobj\ntrailer\n<< >>\n%%EOF', 'latin1')])
}

export function pdfNonCompresso(testo: string): Buffer {
  const contenuto = Buffer.from(`BT /F1 12 Tf 72 720 Td (${testo.replace(/[()\\]/g, '\\$&')}) Tj ET`, 'latin1')
  const testa = `%PDF-1.4\n1 0 obj\n<< /Length ${contenuto.length} >>\nstream\n`
  return Buffer.concat([Buffer.from(testa, 'latin1'), contenuto, Buffer.from('\nendstream\nendobj\ntrailer\n<< >>\n%%EOF', 'latin1')])
}

/** Un PDF senza testo (una scansione): il marcatore dice all'OCR finto che cosa "leggere". */
export const scansione = (marcatore: string): Buffer => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image >>\nstream\nSCAN:${marcatore}:\nendstream\n%%EOF`, 'latin1')
export const foto = (marcatore: string): Buffer => Buffer.from(`\xFF\xD8\xFFSCAN:${marcatore}:`, 'latin1')

const TAVOLA_CRC = (() => {
  const t: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t.push(c >>> 0)
  }
  return t
})()
function crc32(b: Buffer): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < b.length; i++) c = TAVOLA_CRC[(c ^ b[i]!) & 0xFF]! ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

export function zip(voci: [string, Buffer][]): Buffer {
  const locali: Buffer[] = []
  const centrali: Buffer[] = []
  let pos = 0
  for (const [nome, dati] of voci) {
    const n = Buffer.from(nome)
    const c = deflateRawSync(dati)
    const crc = crc32(dati)
    const l = Buffer.alloc(30)
    l.writeUInt32LE(0x04034B50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x800, 6); l.writeUInt16LE(8, 8)
    l.writeUInt32LE(crc, 14); l.writeUInt32LE(c.length, 18); l.writeUInt32LE(dati.length, 22); l.writeUInt16LE(n.length, 26)
    locali.push(l, n, c)
    const z = Buffer.alloc(46)
    z.writeUInt32LE(0x02014B50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x800, 8); z.writeUInt16LE(8, 10)
    z.writeUInt32LE(crc, 16); z.writeUInt32LE(c.length, 20); z.writeUInt32LE(dati.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(pos, 42)
    centrali.push(z, n)
    pos += 30 + n.length + c.length
  }
  const cd = Buffer.concat(centrali)
  const fine = Buffer.alloc(22)
  fine.writeUInt32LE(0x06054B50, 0); fine.writeUInt16LE(voci.length, 8); fine.writeUInt16LE(voci.length, 10); fine.writeUInt32LE(cd.length, 12); fine.writeUInt32LE(pos, 16)
  return Buffer.concat(locali.concat([cd, fine]))
}

export const p7m = (dentro: Buffer): Buffer => Buffer.concat([Buffer.from([0x30, 0x82, 0x01, 0x00]), dentro, Buffer.from([0, 0])])

export function file(name: string, buf: Buffer, rel?: string, modificato = Date.UTC(2026, 9, 1)): File {
  const f = new File([new Uint8Array(buf) as BlobPart], name, { lastModified: modificato })
  if (rel) Object.defineProperty(f, 'webkitRelativePath', { value: rel })
  return f
}

/** Lettori finti: l'OCR "legge" il testo associato al marcatore della scansione. */
export function lettoriFinti(testiOcr: Record<string, string>) {
  const leggi = (dati: Uint8Array): string => {
    const m = /SCAN:([^:]+):/.exec(Buffer.from(dati).toString('latin1'))
    return m ? (testiOcr[m[1]!] ?? '') : ''
  }
  return { ocrPdf: async (dati: Uint8Array) => leggi(dati), ocrImmagine: async (dati: Uint8Array) => leggi(dati) }
}
