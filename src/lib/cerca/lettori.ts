/**
 * I lettori del contenuto per la ricerca nel computer: pdf.js per i PDF a testo e il riconoscimento del testo (OCR,
 * tesseract.js) per scansioni e foto. Si caricano solo quando servono e dalle copie statiche servite dal sito (nessuna
 * rete esterna, nessuna dipendenza npm per tesseract): `base` è la cartella pubblica che le contiene, passata da fuori
 * (per esempio percorsoPubblico('/vendor/ocr')). Il contenuto dei file resta nel browser.
 * Portato da FondoFormazione (lettori-locali.ts).
 */
import type { Lettori } from './cerca-file'

const PAGINE_TESTO = 8
const PAGINE_OCR = 2

/** I file che devono stare nella cartella `base`. */
export const FILE_LETTORI = [
  'pdf.min.mjs',
  'pdf.worker.min.mjs',
  'tesseract.min.js',
  'worker.min.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
  'lang/ita.traineddata.gz',
]

interface Pdfjs {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<PdfDoc>, destroy?: () => Promise<void> }
}
interface PdfDoc {
  numPages: number
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: { str?: string }[] }>
    getViewport: (o: { scale: number }) => { width: number, height: number }
    render: (o: { canvasContext: unknown, viewport: unknown }) => { promise: Promise<void> }
  }>
  destroy?: () => Promise<void>
}
interface Operaio {
  recognize: (img: Blob | Uint8Array) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}
interface Tela {
  getContext: (t: '2d') => unknown
  convertToBlob: (o: { type: string }) => Promise<Blob>
}

function caricaScript(url: string): Promise<void> {
  return new Promise((ok, ko) => {
    const s = document.createElement('script')
    s.src = url
    s.onload = () => ok()
    s.onerror = () => ko(new Error('script non caricato: ' + url))
    document.head.appendChild(s)
  })
}

/**
 * Import dinamico di un modulo servito dal sito, che il bundler non deve impacchettare. Niente new Function: la CSP
 * di produzione non permette 'unsafe-eval'.
 */
const importaDaUrl = (u: string): Promise<unknown> => import(/* webpackIgnore: true */ u)

/**
 * `base`: cartella pubblica con pdf.min.mjs, pdf.worker.min.mjs, tesseract.min.js, worker.min.js, il core wasm e
 * lang/ita.traineddata.gz (vedi {@link FILE_LETTORI}). Senza barra finale.
 */
export function creaLettori(base: string, opzioni: { testoFoglio?: Lettori['testoFoglio'] } = {}): Lettori & { chiudi: () => Promise<void> } {
  let pdfjs: Promise<Pdfjs> | null = null
  let operaio: Promise<Operaio> | null = null

  const caricaPdfjs = (): Promise<Pdfjs> => {
    pdfjs ??= (async () => {
      const m = await importaDaUrl(`${base}/pdf.min.mjs`) as Pdfjs
      m.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`
      return m
    })()
    return pdfjs
  }
  const caricaOcr = (): Promise<Operaio> => {
    operaio ??= (async () => {
      const w = window as unknown as { Tesseract?: { createWorker: (l: string, m: number, o: Record<string, unknown>) => Promise<Operaio> } }
      if (!w.Tesseract) await caricaScript(`${base}/tesseract.min.js`)
      return w.Tesseract!.createWorker('ita', 1, {
        workerPath: `${base}/worker.min.js`,
        // Cartella: tesseract sceglie da solo la versione SIMD o quella per i telefoni piu' vecchi.
        corePath: base,
        langPath: `${base}/lang`,
        gzip: true,
        workerBlobURL: false,
        logger: () => {},
      })
    })()
    return operaio
  }

  const testoPdf = async (dati: Uint8Array): Promise<string> => {
    const lib = await caricaPdfjs()
    const compito = lib.getDocument({ data: dati.slice() })
    const doc = await compito.promise
    try {
      const pezzi: string[] = []
      for (let n = 1; n <= Math.min(doc.numPages, PAGINE_TESTO); n++) {
        const pagina = await doc.getPage(n)
        const c = await pagina.getTextContent()
        pezzi.push(c.items.map(i => i.str ?? '').join(' '))
      }
      return pezzi.join('\n')
    }
    finally {
      // pdf.js 5 e successivi chiudono dal compito; le versioni vecchie dal documento.
      await (compito.destroy ? compito.destroy() : doc.destroy?.())?.catch?.(() => {})
    }
  }

  const ocrImmagine = async (dati: Uint8Array): Promise<string> => {
    const o = await caricaOcr()
    return (await o.recognize(dati)).data.text
  }

  const ocrPdf = async (dati: Uint8Array): Promise<string> => {
    const lib = await caricaPdfjs()
    const o = await caricaOcr()
    const compito = lib.getDocument({ data: dati.slice() })
    const doc = await compito.promise
    try {
      const pezzi: string[] = []
      for (let n = 1; n <= Math.min(doc.numPages, PAGINE_OCR); n++) {
        const pagina = await doc.getPage(n)
        const vista = pagina.getViewport({ scale: 2 })
        const Costruttore = (globalThis as unknown as { OffscreenCanvas: new (w: number, h: number) => Tela }).OffscreenCanvas
        const tela = new Costruttore(Math.ceil(vista.width), Math.ceil(vista.height))
        await pagina.render({ canvasContext: tela.getContext('2d'), viewport: vista }).promise
        pezzi.push((await o.recognize(await tela.convertToBlob({ type: 'image/png' }))).data.text)
      }
      return pezzi.join('\n')
    }
    finally {
      // pdf.js 5 e successivi chiudono dal compito; le versioni vecchie dal documento.
      await (compito.destroy ? compito.destroy() : doc.destroy?.())?.catch?.(() => {})
    }
  }

  return {
    testoPdf,
    ocrImmagine,
    ocrPdf,
    ...(opzioni.testoFoglio ? { testoFoglio: opzioni.testoFoglio } : {}),
    async chiudi() {
      const o = operaio
      operaio = null
      if (o) await (await o).terminate().catch(() => {})
    },
  }
}
