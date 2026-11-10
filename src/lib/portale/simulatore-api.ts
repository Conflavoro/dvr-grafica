/**
 * Chiamate del simulatore di costo (porta pubblica, scheda Confronto del
 * preventivo, valore dell'abbonamento) e dell'attivazione del cliente nuovo.
 * Tutto vuoto senza il backend (modalità dimostrativa locale).
 */

import { ApiError, apiRequest, apiUpload } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { erroreLeggibile, lista, manda, numero, prendi, rec, testo } from './api';
import { mappaSimulazione, type Simulazione } from './simulatore-logica';

// ---------------------------------------------------------------- porta pubblica

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

async function pubblico<T = unknown>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  try {
    return await apiRequest<T>(`/pubblico/simulatore${path}`, { method, body: body as Record<string, unknown> | undefined, anonymous: true, cache: 'no-store' });
  } catch (e) {
    throw erroreLeggibile(e);
  }
}

function sim(raw: unknown): Simulazione {
  const s = mappaSimulazione(rec(raw).data);
  if (!s) throw new Error('Risposta del simulatore non valida.');
  return s;
}

export async function nuovaSimulazione(ingressi: Record<string, unknown> = {}): Promise<Simulazione> {
  return sim(await pubblico('', 'POST', { ingressi }));
}

export async function simulazione(token: string): Promise<Simulazione> {
  return sim(await pubblico(`/${token}`));
}

export async function aggiornaSimulazione(token: string, ingressi: Record<string, unknown>): Promise<Simulazione> {
  return sim(await pubblico(`/${token}`, 'PATCH', { ingressi }));
}

export interface PulsanteFalco {
  etichetta: string;
  campo?: string;
  valore?: unknown;
  azione?: 'contatto' | 'fattura';
  invia?: string;
}

export interface RispostaFalco {
  testo: string;
  simulazione: Simulazione;
  pulsanti: PulsanteFalco[];
  mostraContatto: boolean;
}

export async function chiediFalco(token: string, t: string, storico: Array<{ ruolo: 'utente' | 'falco'; testo: string }>, vocale = false): Promise<RispostaFalco> {
  const r = rec(rec(await pubblico(`/${token}/falco`, 'POST', { testo: t, storico: storico.slice(-8), vocale })).data);
  const s = mappaSimulazione(r.simulazione);
  if (!s) throw new Error('Risposta del Falco non valida.');
  return {
    testo: testo(r.testo) ?? '',
    simulazione: s,
    mostraContatto: r.mostra_contatto === true,
    pulsanti: lista(r.pulsanti).map((x) => {
      const p = rec(x);
      return {
        etichetta: testo(p.etichetta) ?? '',
        campo: testo(p.campo) ?? undefined,
        valore: p.valore,
        azione: p.azione === 'contatto' || p.azione === 'fattura' ? p.azione : undefined,
        invia: testo(p.invia) ?? undefined,
      };
    }),
  };
}

export async function inviaContatto(token: string, d: { nome: string; azienda: string; telefono: string; consenso: boolean }): Promise<Simulazione> {
  return sim(await pubblico(`/${token}/contatto`, 'POST', d));
}

export async function caricaFatturaPubblica(token: string, file: File): Promise<Simulazione> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch(`${API_BASE}/pubblico/simulatore/${token}/fatture`, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
    const body: unknown = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, body, testo(rec(body).message) ?? 'Caricamento non riuscito');
    return sim({ data: rec(rec(body).data).simulazione });
  } catch (e) {
    throw erroreLeggibile(e, 'Non sono riuscito a leggere la fattura.');
  }
}

export async function confermaFatturaPubblica(token: string, id: number, righe?: Array<{ indice: number; categoria: string }>): Promise<Simulazione> {
  return sim({ data: rec(rec(await pubblico(`/${token}/fatture/${id}/conferma`, 'POST', righe ? { righe } : {})).data).simulazione });
}

export async function eliminaFatturaPubblica(token: string, id: number): Promise<Simulazione> {
  return sim(await pubblico(`/${token}/fatture/${id}`, 'DELETE'));
}

export interface ConfigSimulatore {
  caselle: Record<string, string>;
  informativa: string;
}

export async function configurazioneSimulatore(): Promise<ConfigSimulatore> {
  const r = rec(rec(await pubblico('/configurazione')).data);
  const caselle: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(r.caselle))) caselle[k] = String(v);
  return { caselle, informativa: testo(r.informativa_fatture) ?? '' };
}

// ---------------------------------------------------------------- porta B: confronto nel preventivo

export async function confrontoPreventivo(id: number): Promise<Simulazione | null> {
  if (!isApiMode()) return null;
  return sim(await prendi(`/gestionale/preventivi/${id}/confronto`));
}

export async function aggiornaConfrontoPreventivo(id: number, d: { ingressi?: Record<string, unknown>; prezzi_reali?: Record<string, number> }): Promise<Simulazione> {
  return sim(await manda(`/gestionale/preventivi/${id}/confronto`, d, 'PATCH'));
}

export async function confrontoNelModulo(id: number, si: boolean): Promise<Simulazione> {
  return sim(await manda(`/gestionale/preventivi/${id}/confronto/modulo`, { nel_modulo: si }));
}

// ---------------------------------------------------------------- porta C: valore dell'abbonamento

export interface ValoreAbbonamento {
  dal: string;
  mesi: number;
  righe: Array<{ chiave: string; titolo: string; quante: number; valore: number }>;
  valore: number;
  pagato: number;
  risparmio: number;
  risparmioPct: number | null;
  frase: string;
  nota: string;
  rinnovoTraGiorni: number | null;
}

export async function valoreAbbonamento(aziendaId: number): Promise<ValoreAbbonamento | null> {
  if (!isApiMode()) return null;
  const d = rec(await prendi(`/portale/aziende/${aziendaId}/valore`)).data;
  if (!d) return null;
  const v = rec(d);
  return {
    dal: testo(v.dal) ?? '',
    mesi: numero(v.mesi) ?? 0,
    righe: lista(v.righe).map((x) => {
      const r = rec(x);
      return { chiave: testo(r.chiave) ?? '', titolo: testo(r.titolo) ?? '', quante: numero(r.quante) ?? 0, valore: numero(r.valore) ?? 0 };
    }),
    valore: numero(v.valore_listino) ?? 0,
    pagato: numero(v.pagato) ?? 0,
    risparmio: numero(v.risparmio) ?? 0,
    risparmioPct: numero(v.risparmio_pct),
    frase: testo(v.frase) ?? '',
    nota: testo(v.nota) ?? '',
    rinnovoTraGiorni: numero(v.rinnovo_tra_giorni),
  };
}

// ---------------------------------------------------------------- attivazione del cliente nuovo

export interface DomandaVisita {
  chiave: 'vdt' | 'notte' | 'carichi';
  testo: string;
  risposta: boolean;
}

export interface LavoratoreAttivazione {
  id: number;
  nome: string;
  mansione: string;
  reparto: string | null;
  rischio: string;
  motivoRischio: string;
  corsoOre: number;
  /** Calcolata: con il reparto non scelto è provvisoria (daCalcolare). */
  visita: boolean;
  daCalcolare: boolean;
  motivo: string;
  domande: DomandaVisita[];
  segnalazione: string | null;
}

export interface EsitoAttivita {
  scelta: { categoria: string | null; sotto: string; spec: string | null; fonte: string; confermata: boolean } | null;
  nome: string;
  codice: string;
  rischio: string;
  incendio: { livello: number; nome: string; ore: number; testo: string };
  nota: string;
  reparti?: Array<{ reparto: string; lavoratori: number; rischio: string; ore: number }>;
  avviso?: { titolo: string; testo: string } | null;
}

export interface CategoriaAteco {
  id: string;
  nome: string;
  sotto: Array<{ id: string; nome: string; specifiche: Array<{ id: string; nome: string }> }>;
}

export interface StatoAttivazione {
  aziendaId: number;
  stato: string;
  attiva: boolean;
  benvenuto: boolean;
  schermata: 'passo' | 'attesa_sepa' | 'benvenuto';
  passo: number;
  passi: Array<{ chiave: string; nome: string; titolo: string; fatto: boolean }>;
  documenti: Array<{ nome: string; tipo: string; stato: string; letto: string }>;
  estratti: Array<{ campo: string; etichetta: string; valore: string }>;
  dati: {
    ragioneSociale: string;
    partitaIva: string | null;
    sede: string | null;
    legaleRappresentante: string | null;
    ateco: string | null;
    attivita: EsitoAttivita | null;
    socio: 'socio' | 'associarsi' | 'no' | null;
    confermati: boolean;
  };
  quota: { fascia: number; testo: string; importo: number; mese: number };
  lavoratori: LavoratoreAttivazione[];
  enti: { ebiasp: boolean | null; fondo: boolean | null; sediAlimentari: number; risparmio: { ebiasp: number; fondo: number } };
  firma: { firmatoIl: string; da: string | null } | null;
  pagamento: { metodo: string; iban: string | null } | null;
  contratto: { titolo: string; voci: Array<[string, string]>; socio: string | null; testo: string; comprende: string };
  canone: { vuoto: boolean; testo: string | null; mensile: number; annuo: number; righe: Array<{ chiave: string; voce: string; quantita: number; unitario: number; mensile: number }>; durata: string | null };
  dopo: string[];
  referente: { nome: string; email: string } | null;
  albero: CategoriaAteco[];
  reparti: string[];
  mancano: string[];
  messaggio: string | null;
}

export function mappaEsitoAttivita(raw: unknown): EsitoAttivita | null {
  const a = rec(raw);
  if (!testo(a.nome)) return null;
  const sc = a.scelta ? rec(a.scelta) : null;
  const inc = rec(a.incendio);
  return {
    scelta: sc ? { categoria: testo(sc.categoria), sotto: testo(sc.sotto) ?? '', spec: testo(sc.spec), fonte: testo(sc.fonte) ?? 'azienda', confermata: sc.confermata === true } : null,
    nome: testo(a.nome) ?? '',
    codice: testo(a.codice) ?? '',
    rischio: testo(a.rischio) ?? 'medio',
    incendio: { livello: numero(inc.livello) ?? 1, nome: testo(inc.nome) ?? '', ore: numero(inc.ore) ?? 4, testo: testo(inc.testo) ?? '' },
    nota: testo(a.nota) ?? '',
    reparti: lista(a.reparti).map((x) => {
      const r = rec(x);
      return { reparto: testo(r.reparto) ?? '', lavoratori: numero(r.lavoratori) ?? 0, rischio: testo(r.rischio) ?? '', ore: numero(r.ore) ?? 0 };
    }),
    avviso: a.avviso ? { titolo: testo(rec(a.avviso).titolo) ?? '', testo: testo(rec(a.avviso).testo) ?? '' } : null,
  };
}

export function mappaAttivazione(raw: unknown): StatoAttivazione | null {
  const s = rec(raw);
  const id = numero(s.azienda_id);
  if (id === null) return null;
  const d = rec(s.dati);
  const e = rec(s.enti);
  const k = rec(s.contratto);
  const c = rec(s.canone);
  const q = rec(s.quota);
  const f = s.firma ? rec(s.firma) : null;
  const p = s.pagamento ? rec(s.pagamento) : null;
  const ref = s.referente ? rec(s.referente) : null;
  const bn = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
  const socio = testo(d.socio);
  const sch = testo(s.schermata);
  return {
    aziendaId: id,
    stato: testo(s.stato) ?? 'in_corso',
    attiva: s.attiva === true,
    benvenuto: s.benvenuto === true,
    schermata: sch === 'attesa_sepa' || sch === 'benvenuto' ? sch : 'passo',
    passo: numero(s.passo) ?? 1,
    passi: lista(s.passi).map((x) => ({ chiave: testo(rec(x).chiave) ?? '', nome: testo(rec(x).nome) ?? '', titolo: testo(rec(x).titolo) ?? '', fatto: rec(x).fatto === true })),
    documenti: lista(s.documenti).map((x) => ({ nome: testo(rec(x).nome) ?? '', tipo: testo(rec(x).tipo) ?? 'altro', stato: testo(rec(x).stato) ?? 'letto', letto: testo(rec(x).letto) ?? '' })),
    estratti: lista(s.estratti).map((x) => ({ campo: testo(rec(x).campo) ?? '', etichetta: testo(rec(x).etichetta) ?? '', valore: testo(rec(x).valore) ?? '' })),
    dati: {
      ragioneSociale: testo(d.ragione_sociale) ?? '',
      partitaIva: testo(d.partita_iva),
      sede: testo(d.sede),
      legaleRappresentante: testo(d.legale_rappresentante),
      ateco: testo(d.ateco),
      attivita: d.attivita ? mappaEsitoAttivita(d.attivita) : null,
      socio: socio === 'socio' || socio === 'associarsi' || socio === 'no' ? socio : null,
      confermati: d.confermati === true,
    },
    quota: { fascia: numero(q.fascia) ?? 1, testo: testo(q.testo) ?? '', importo: numero(q.importo) ?? 0, mese: numero(q.mese) ?? 0 },
    lavoratori: lista(s.lavoratori).map((x) => {
      const l = rec(x);
      return {
        id: numero(l.id) ?? 0,
        nome: testo(l.nome) ?? '',
        mansione: testo(l.mansione) ?? '',
        reparto: testo(l.reparto),
        rischio: testo(l.rischio) ?? 'medio',
        motivoRischio: testo(l.motivo_rischio) ?? '',
        corsoOre: numero(l.corso_ore) ?? 0,
        visita: l.visita === true,
        daCalcolare: l.da_calcolare === true,
        motivo: testo(l.motivo) ?? '',
        domande: lista(l.domande).map((y) => {
          const dd = rec(y);
          const ch = testo(dd.chiave);
          return { chiave: ch === 'vdt' || ch === 'carichi' ? ch : 'notte', testo: testo(dd.testo) ?? '', risposta: dd.risposta === true } as DomandaVisita;
        }),
        segnalazione: testo(l.segnalazione),
      };
    }),
    enti: { ebiasp: bn(e.ebiasp), fondo: bn(e.fondo), sediAlimentari: numero(e.sedi_alimentari) ?? 0, risparmio: { ebiasp: numero(rec(e.risparmio).ebiasp) ?? 0, fondo: numero(rec(e.risparmio).fondo) ?? 0 } },
    firma: f ? { firmatoIl: testo(f.firmato_il) ?? '', da: testo(f.da) } : null,
    pagamento: p ? { metodo: testo(p.metodo) ?? '', iban: testo(rec(p.sepa).iban) } : null,
    contratto: {
      titolo: testo(k.titolo) ?? 'Contratto di abbonamento',
      voci: lista(k.voci).map((v) => [String(lista(v)[0] ?? ''), String(lista(v)[1] ?? '')] as [string, string]),
      socio: testo(k.socio),
      testo: testo(k.testo) ?? '',
      comprende: testo(k.comprende) ?? '',
    },
    canone: {
      vuoto: c.vuoto === true,
      testo: testo(c.testo),
      mensile: numero(c.mensile) ?? 0,
      annuo: numero(c.annuo) ?? 0,
      durata: testo(c.durata),
      righe: lista(c.righe).map((x) => {
        const r = rec(x);
        return { chiave: testo(r.chiave) ?? '', voce: testo(r.voce) ?? '', quantita: numero(r.quantita) ?? 0, unitario: numero(r.unitario) ?? 0, mensile: numero(r.mensile) ?? 0 };
      }),
    },
    dopo: lista(s.dopo).map(String),
    referente: ref ? { nome: testo(ref.nome) ?? '', email: testo(ref.email) ?? '' } : null,
    albero: lista(s.albero).map((x) => {
      const cat = rec(x);
      return {
        id: testo(cat.id) ?? '',
        nome: testo(cat.nome) ?? '',
        sotto: lista(cat.sotto).map((y) => {
          const so = rec(y);
          return { id: testo(so.id) ?? '', nome: testo(so.nome) ?? '', specifiche: lista(so.specifiche).map((z) => ({ id: testo(rec(z).id) ?? '', nome: testo(rec(z).nome) ?? '' })) };
        }),
      };
    }),
    reparti: lista(s.reparti).map(String),
    mancano: lista(s.mancano).map(String),
    messaggio: testo(s.messaggio),
  };
}

const att = (id: number, p = '') => `/portale/aziende/${id}/attivazione${p}`;

export async function statoAttivazione(id: number): Promise<StatoAttivazione | null> {
  if (!isApiMode()) return null;
  return mappaAttivazione(rec(await prendi(att(id))).data);
}

export async function compilaAttivazione(id: number, d: Record<string, unknown>): Promise<StatoAttivazione | null> {
  return mappaAttivazione(rec(await manda(att(id), d)).data);
}

export async function caricaDocumentoAttivazione(id: number, file: File, tipo?: string): Promise<{ stato: StatoAttivazione | null; letto: string | null; esito: string | null }> {
  const fd = new FormData();
  fd.append('file', file);
  if (tipo) fd.append('tipo', tipo);
  try {
    const r = rec(rec(await apiUpload(att(id, '/documenti'), fd)).data);
    return { stato: mappaAttivazione(r), letto: testo(r.letto), esito: testo(r.esito) };
  } catch (e) {
    throw erroreLeggibile(e, 'Caricamento non riuscito.');
  }
}

/** Anteprima di un'attività prima della conferma: classe, incendio, reparti e chi cambia rischio. */
export async function anteprimaAttivita(id: number, sotto: string, spec: string | null): Promise<EsitoAttivita | null> {
  return mappaEsitoAttivita(rec(await prendi(att(id, `/attivita?sotto=${encodeURIComponent(sotto)}${spec ? `&spec=${encodeURIComponent(spec)}` : ''}`))).data);
}

export interface RisultatoAteco {
  categoria: string;
  sotto: string;
  spec: string | null;
  nome: string;
  codice: string;
  percorso: string;
}

/** Ricerca per codice o parola chiave, da 2 caratteri, al massimo 7 risultati. */
export async function cercaAteco(id: number, q: string): Promise<{ risultati: RisultatoAteco[]; vuoto: string | null }> {
  if (q.trim().length < 2) return { risultati: [], vuoto: null };
  const d = rec(rec(await prendi(att(id, `/cerca?q=${encodeURIComponent(q.trim())}`))).data);
  return {
    risultati: lista(d.risultati).map((x) => {
      const r = rec(x);
      return { categoria: testo(r.categoria) ?? '', sotto: testo(r.sotto) ?? '', spec: testo(r.spec), nome: testo(r.nome) ?? '', codice: testo(r.codice) ?? '', percorso: testo(r.percorso) ?? '' };
    }),
    vuoto: testo(d.vuoto),
  };
}

/** "Non è giusto?": la segnalazione arriva al tecnico, il dato non cambia. */
export async function segnalaAttivazione(id: number, cosa: 'lavoratore' | 'incendio', lavoratoreId?: number, testoSegnalazione?: string): Promise<{ stato: StatoAttivazione | null; messaggio: string | null }> {
  const d = rec(rec(await manda(att(id, '/segnala'), { cosa, ...(lavoratoreId ? { lavoratore_id: lavoratoreId } : {}), ...(testoSegnalazione !== undefined ? { testo: testoSegnalazione } : {}) })).data);
  return { stato: mappaAttivazione(d), messaggio: testo(d.messaggio) };
}

export async function codiceFirmaAttivazione(id: number): Promise<{ token: string; cellulare: string | null; codiceProva: string | null }> {
  const d = rec(rec(await manda(att(id, '/firma/codice'))).data);
  return { token: testo(d.token) ?? '', cellulare: testo(d.cellulare), codiceProva: testo(d.codice_prova) };
}

export async function firmaAttivazione(id: number, token: string, codice: string, letto: boolean): Promise<StatoAttivazione | null> {
  return mappaAttivazione(rec(await manda(att(id, '/firma'), { token, codice, letto })).data);
}

export async function pagamentoAttivazione(
  id: number,
  metodo: 'carta' | 'sepa',
  dati: { numero: string; scadenza: string; cvc: string } | { intestatario: string; iban: string; mandato: boolean }
): Promise<StatoAttivazione | null> {
  return mappaAttivazione(rec(await manda(att(id, '/pagamento'), { metodo, [metodo]: dati })).data);
}

/** "Preferisco pagare con carta": annulla il mandato SEPA in attesa. */
export async function annullaSepaAttivazione(id: number): Promise<StatoAttivazione | null> {
  return mappaAttivazione(rec(await manda(att(id, '/pagamento/annulla'))).data);
}

export async function benvenutoVisto(id: number): Promise<void> {
  await manda(att(id, '/benvenuto'));
}

export async function cercaAttivita(q: string): Promise<Array<{ prefisso: string; descrizione: string; rischio: string; nota: string | null }>> {
  if (q.trim().length < 2) return [];
  const r = rec(await pubblico(`/attivita?q=${encodeURIComponent(q.trim())}`));
  return lista(r.data).map((x) => {
    const a = rec(x);
    return { prefisso: testo(a.prefisso) ?? '', descrizione: testo(a.descrizione) ?? '', rischio: testo(a.rischio) ?? 'medio', nota: testo(a.nota) };
  });
}
