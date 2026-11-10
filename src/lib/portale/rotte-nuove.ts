/**
 * Le pagine della prima versione (/aziende, /dvr, /sopralluogo, /dashboard...) hanno ancora la
 * grafica vecchia. Rocco 10/11: "a un certo punto mi ha rimandato alla grafica vecchia". Ogni
 * collegamento e ogni indirizzo vecchio passa da qui e finisce nella schermata nuova del portale.
 */

/** Sezioni del gestionale in cui atterrano le pagine vecchie. */
const GESTIONALE: Record<string, string> = {
  aziende: '/gestionale/aziende/',
  dvr: '/gestionale/dvr/',
  sopralluogo: '/gestionale/sopralluoghi/',
  rischi: '/gestionale/dvr/',
  documenti: '/gestionale/dvr/',
  registro: '/gestionale/aziende/',
  lavoratori: '/gestionale/aziende/',
  dpi: '/gestionale/aziende/',
  attrezzature: '/gestionale/aziende/',
  formazione: '/gestionale/aziende/',
  scadenziario: '/gestionale/aziende/',
  kb: '/gestionale/aziende/',
}

/** Indirizzo nuovo della scheda di un'azienda (tab facoltativa: persone, scadenze, documenti). */
export function schedaAzienda(id: number | string, tab?: string): string {
  return `/gestionale/aziende/?id=${id}${tab ? `&tab=${tab}` : ''}`
}

/** Indirizzo nuovo di un DVR: la Scrivania del DVR aperta su quel documento. */
export function schedaDvr(id: number | string): string {
  return `/gestionale/dvr/?cowork=${id}`
}

/**
 * Dove portare chi arriva su una pagina vecchia. Null = la pagina resta (le poche pagine
 * dello staff Conflavoro che non hanno ancora un equivalente nel portale).
 * @param home pagina iniziale del ruolo (/gestionale/coda/ o /azienda/dashboard/)
 */
export function rottaPortale(percorso: string, query: string, home: string): string | null {
  const p = percorso.replace(/\/+$/, '') || '/'
  const q = new URLSearchParams(query)
  const pezzi = p.split('/').filter(Boolean)
  const primo = pezzi[0] ?? ''
  if (['tenants', 'piattaforma'].includes(primo)) return null
  const lato = home.startsWith('/azienda/') ? 'azienda' : 'gestionale'
  if (lato === 'azienda') return home
  const id = q.get('id')
  if (primo === 'aziende' && pezzi[1] === 'scheda' && id) return schedaAzienda(id, q.get('tab') ?? undefined)
  if (primo === 'dvr' && pezzi[1] === 'scheda' && id) return schedaDvr(id)
  if (primo === 'dvr' && pezzi[1] === 'nuovo') {
    const az = q.get('company_id') ?? q.get('azienda')
    return az ? `/gestionale/dvr/?az=${az}` : '/gestionale/dvr/'
  }
  return GESTIONALE[primo] ?? home
}
