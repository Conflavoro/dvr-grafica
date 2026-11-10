/**
 * Dentro i file che non sono un PDF qualunque: archivi .zip (anche annidati nelle cartelle), documenti firmati .p7m,
 * documenti Word .docx. Tutto in locale, senza librerie: lo zip si legge dalla tabella finale e si decomprime con
 * DecompressionStream; il .p7m porta il documento originale in chiaro dentro la busta; il .docx è uno zip di XML.
 */

export interface VoceZip { nome: string, byte: number, leggi: () => Promise<Uint8Array> }

const u16 = (b: Uint8Array, i: number): number => b[i]! | (b[i + 1]! << 8)
const u32 = (b: Uint8Array, i: number): number => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0

async function inflateRaw(dati: Uint8Array): Promise<Uint8Array> {
  const ds = new Blob([dati as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(ds).arrayBuffer())
}

/** Le voci di uno zip (solo file, nomi in UTF-8 o CP437 semplice). Vuoto se non è uno zip leggibile o è protetto. */
export function vociZip(dati: Uint8Array, massimo = 400): VoceZip[] {
  let fine = -1
  for (let i = dati.length - 22; i >= Math.max(0, dati.length - 66000); i--) {
    if (dati[i] === 0x50 && dati[i + 1] === 0x4B && dati[i + 2] === 5 && dati[i + 3] === 6) { fine = i; break }
  }
  if (fine < 0) return []
  const quante = u16(dati, fine + 10)
  let p = u32(dati, fine + 16)
  const voci: VoceZip[] = []
  for (let n = 0; n < quante && n < massimo; n++) {
    if (p + 46 > dati.length || u32(dati, p) !== 0x02014B50) break
    const flag = u16(dati, p + 8)
    const metodo = u16(dati, p + 10)
    const compressi = u32(dati, p + 20)
    const originali = u32(dati, p + 24)
    const lunNome = u16(dati, p + 28)
    const lunExtra = u16(dati, p + 30)
    const lunCommento = u16(dati, p + 32)
    const locale = u32(dati, p + 42)
    const nome = new TextDecoder((flag & 0x800) ? 'utf-8' : 'latin1').decode(dati.subarray(p + 46, p + 46 + lunNome))
    p += 46 + lunNome + lunExtra + lunCommento
    if (nome.endsWith('/') || (flag & 1) || nome.startsWith('__MACOSX/')) continue
    voci.push({
      nome,
      byte: originali,
      leggi: async () => {
        const l = locale
        if (u32(dati, l) !== 0x04034B50) throw new Error('zip rovinato')
        const inizio = l + 30 + u16(dati, l + 26) + u16(dati, l + 28)
        const corpo = dati.subarray(inizio, inizio + compressi)
        if (metodo === 0) return corpo
        if (metodo === 8) return inflateRaw(corpo)
        throw new Error('compressione non supportata')
      },
    })
  }
  return voci
}

/**
 * Il documento dentro una busta .p7m (CAdES): il contenuto originale sta in chiaro. Per un PDF si cerca l'intestazione
 * «%PDF» e la fine «%%EOF»; altrimenti si prova a leggere come testo. Null se non si riconosce niente.
 */
export function contenutoP7m(dati: Uint8Array): { tipo: 'pdf' | 'testo', dati: Uint8Array } | null {
  const latino = new TextDecoder('latin1').decode(dati)
  const inizio = latino.indexOf('%PDF-')
  if (inizio >= 0) {
    const fine = latino.lastIndexOf('%%EOF')
    return { tipo: 'pdf', dati: dati.subarray(inizio, fine > inizio ? fine + 5 : dati.length) }
  }
  const leggibile = latino.match(/[\x20-\x7E\xC0-\xFF\n\r\t]{200,}/)
  return leggibile ? { tipo: 'testo', dati: new TextEncoder().encode(leggibile[0]) } : null
}

/** Il testo di un .docx: i paragrafi di word/document.xml, senza i marcatori. */
export async function testoDaDocx(dati: Uint8Array): Promise<string> {
  const doc = vociZip(dati, 60).find(v => v.nome === 'word/document.xml')
  if (!doc) return ''
  const xml = new TextDecoder().decode(await doc.leggi())
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'')
}
