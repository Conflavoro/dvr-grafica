/**
 * Ricerca del logo dell'azienda sul dispositivo (Rocco 09/11: "anche il logo, basta che sia sempre
 * corretto"). Un logo non porta partita IVA: si riconosce dal nome del file e, per gli SVG, dal testo
 * che contiene. La conferma finale e' l'anteprima che la persona vede prima di caricarlo: se ne carica
 * uno solo. Logica pura, provata con cartelle finte.
 */
import type { VoceCartella, VoceFile } from './cerca-file'
import { normalizza } from './riconosci'

export const ESTENSIONI_LOGO = ['png', 'svg', 'jpg', 'jpeg', 'webp']
/** Stesso limite del caricamento del logo nella scheda azienda. */
export const BYTE_LOGO = 2 * 1024 * 1024

export interface LogoTrovato {
  percorso: string
  nome: string
  byte: number
  punteggio: number
  verdetto: 'giusto' | 'da_controllare'
  motivo: string
  voce: VoceFile
}

const PAROLE_LOGO = ['logo', 'logotipo', 'marchio', 'brand']
const VUOTE = new Set(['srl', 'spa', 'sas', 'snc', 'sapa', 'scarl', 'srls', 'societa', 'esempio', 'di', 'del', 'della', 'il', 'la', 'lo', 'le', 'i', 'gli', 'e', 'ed', 'and', 'the', 'ditta', 'impresa', 'azienda', 'studio'])

/** Parole che distinguono l'azienda nella denominazione ("Trattoria Il Glicine Esempio S.a.s." -> trattoria, glicine). */
export function paroleAzienda(denominazione: string | null | undefined): string[] {
  return normalizza(denominazione ?? '').split(' ').filter(p => p.length >= 4 && !VUOTE.has(p))
}

/** Punteggio e verdetto di un'immagine dal nome (e dal testo, per gli SVG). Null = non e' un candidato. */
export function valutaLogo(nome: string, byte: number, azienda: string[], testoSvg = ''): Omit<LogoTrovato, 'percorso' | 'voce' | 'nome' | 'byte'> | null {
  const ext = nome.split('.').pop()?.toLowerCase() ?? ''
  if (!ESTENSIONI_LOGO.includes(ext) || byte <= 0 || byte > BYTE_LOGO) return null
  const n = normalizza(nome.replace(/\.[^.]+$/, ''))
  const t = normalizza(testoSvg)
  const parolaLogo = PAROLE_LOGO.some(p => n.split(' ').includes(p) || n.includes(p))
  const nomeAzienda = azienda.filter(p => n.includes(p))
  const testoAzienda = azienda.filter(p => t.includes(p))
  if (!parolaLogo && nomeAzienda.length === 0 && testoAzienda.length === 0) return null
  const trovate = nomeAzienda.concat(testoAzienda).filter((p, i, a) => a.indexOf(p) === i)
  const punteggio = (parolaLogo ? 10 : 0) + 5 * trovate.length + (ext === 'svg' || ext === 'png' ? 2 : 0)
  if (parolaLogo && (nomeAzienda.length > 0 || testoAzienda.length > 0)) {
    return { punteggio, verdetto: 'giusto', motivo: `si chiama logo e porta il nome dell'azienda (${trovate.join(', ')})` }
  }
  if (parolaLogo) return { punteggio, verdetto: 'da_controllare', motivo: 'si chiama logo ma non porta il nome dell\'azienda: guarda l\'anteprima' }
  return { punteggio, verdetto: 'da_controllare', motivo: 'porta il nome dell\'azienda ma non si chiama logo: guarda l\'anteprima' }
}

const CARTELLE_SALTATE = new Set(['node_modules', 'library', 'appdata', 'windows', 'system32', 'program files', '.git', '.trash', 'cache'])

/** Cerca i loghi in una cartella (fino a 6 livelli, 8000 file), i migliori prima. */
export async function cercaLoghi(radice: VoceCartella, denominazione: string | null | undefined, fermo: () => boolean = () => false): Promise<LogoTrovato[]> {
  const azienda = paroleAzienda(denominazione)
  const out: LogoTrovato[] = []
  let visti = 0
  const coda: { c: VoceCartella, p: string, l: number }[] = [{ c: radice, p: '', l: 0 }]
  while (coda.length && visti < 8000 && !fermo()) {
    const { c, p, l } = coda.shift()!
    try {
      for await (const v of c.values()) {
        if (fermo()) break
        if (v.kind === 'directory') {
          if (l < 6 && !v.name.startsWith('.') && !CARTELLE_SALTATE.has(v.name.toLowerCase())) coda.push({ c: v, p: `${p}${v.name}/`, l: l + 1 })
          continue
        }
        visti++
        const ext = v.name.split('.').pop()?.toLowerCase() ?? ''
        if (!ESTENSIONI_LOGO.includes(ext)) continue
        const f = await v.getFile().catch(() => null)
        if (!f) continue
        const testo = ext === 'svg' && f.size < 400_000 && 'text' in f ? await (f as File).text().catch(() => '') : ''
        const val = valutaLogo(v.name, f.size, azienda, testo)
        if (val) out.push({ ...val, percorso: p + v.name, nome: v.name, byte: f.size, voce: v })
      }
    }
    catch {
      // Cartella non leggibile: si va avanti.
    }
  }
  return ordina(out)
}

/** Telefono: le immagini scelte a mano, stesse regole. */
export async function valutaLoghiScelti(files: File[], denominazione: string | null | undefined): Promise<LogoTrovato[]> {
  const azienda = paroleAzienda(denominazione)
  const out: LogoTrovato[] = []
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const testo = ext === 'svg' && f.size < 400_000 ? await f.text().catch(() => '') : ''
    const val = valutaLogo(f.name, f.size, azienda, testo)
    if (val) out.push({ ...val, percorso: f.name, nome: f.name, byte: f.size, voce: { kind: 'file', name: f.name, getFile: async () => f } })
  }
  return ordina(out)
}

function ordina(l: LogoTrovato[]): LogoTrovato[] {
  return l.sort((a, b) => (a.verdetto === b.verdetto ? 0 : a.verdetto === 'giusto' ? -1 : 1) || b.punteggio - a.punteggio).slice(0, 8)
}
