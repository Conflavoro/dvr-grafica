// Misura del banco: "proposto" = il file che la ricerca spunta da sola per il caricamento (la persona poi conferma).
// Errore grave = proposto ma non andava (altra azienda, persona sconosciuta, scaduto, altro tipo, dato sanitario).
import { cartellaDaFile, proposti, scansiona } from '../cerca-file'
import type { Trovato } from '../cerca-file'
import type { TipoCercato } from '../riconosci'
import { casi, contaDocumenti, IMPRESA, OGGI } from './banco-documenti'
import type { Verita } from './banco-documenti'
import { lettoriFinti } from './costruttori'


export interface Misura {
  casi: number, documenti: number, attesi: number, proposti: number, corretti: number, gravi: number,
  senzaMotivo: number, sanitariNonEsclusi: number, precisione: number, richiamo: number, dettagli: string[],
  perTipo: Record<string, { attesi: number, proposti: number, corretti: number, gravi: number }>
}

export async function misura(): Promise<Misura> {
  const S = casi()
  const tot = { attesi: 0, proposti: 0, corretti: 0, gravi: 0, senzaMotivo: 0, sanitariNonEsclusi: 0 }
  const perTipo: Misura['perTipo'] = {}
  const dettagli: string[] = []
  for (const s of S) {
    const verita = new Map<string, Verita>()
    for (const d of s.documenti) {
      verita.set(d.f.name, d.v)
      for (const [n, v] of Object.entries(d.dentro ?? {})) verita.set(n, v)
    }
    const righe: Trovato[] = []
    await scansiona(cartellaDaFile(s.documenti.map(d => d.f)), { tipi: s.tipi, parole_chiave: [], impresa: IMPRESA }, t => righe.push(t), { lettori: lettoriFinti(s.ocr ?? {}), oggi: () => OGGI.getTime() })
    const p = proposti(righe, s.tipi).map(x => x.trovato)
    for (const t of s.tipi as TipoCercato[]) {
      const pt = (perTipo[t] ??= { attesi: 0, proposti: 0, corretti: 0, gravi: 0 })
      const attesi = s.attesi[t] ?? []
      tot.attesi += attesi.length; pt.attesi += attesi.length
      for (const x of p.filter(y => y.tipo === t)) {
        tot.proposti++; pt.proposti++
        const v = verita.get(x.nome)
        if (attesi.indexOf(x.nome) >= 0) { tot.corretti++; pt.corretti++ }
        else if (!v || !v.buono || v.tipo !== t) { tot.gravi++; pt.gravi++; dettagli.push(`GRAVE  ${s.nome} › ${t}: proposto ${x.nome}`) }
        else dettagli.push(`errato ${s.nome} › ${t}: proposto ${x.nome}`)
      }
      for (const a of attesi) if (!p.some(x => x.tipo === t && x.nome === a)) dettagli.push(`manca  ${s.nome} › ${t}: atteso ${a}`)
    }
    for (const r of righe) {
      if (r.verdetto === 'da_controllare' && !r.problema) tot.senzaMotivo++
      if (verita.get(r.nome)?.tipo === 'sanitario' && r.verdetto !== 'escluso') tot.sanitariNonEsclusi++
    }
    // Ogni dato sanitario letto deve comparire come escluso.
    for (const [n, v] of Array.from(verita.entries())) {
      if (v.tipo === 'sanitario' && !righe.some(r => r.nome === n && r.verdetto === 'escluso')) { tot.sanitariNonEsclusi++; dettagli.push(`sanitario non escluso: ${n}`) }
    }
  }
  return {
    casi: S.length, documenti: contaDocumenti(S), ...tot, perTipo, dettagli,
    precisione: tot.proposti ? tot.corretti / tot.proposti : 1,
    richiamo: tot.attesi ? tot.corretti / tot.attesi : 1,
  }
}
