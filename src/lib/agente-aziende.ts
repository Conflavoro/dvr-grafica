import type { Company, Dvr, Scadenza } from '@/lib/data-source';

/**
 * Indice delle aziende per la console: stato a colpo d'occhio, preferite e
 * recenti (salvate nel browser, per utente, con try/catch).
 */
export type StatoAzienda = 'scaduto' | 'aggiornare' | 'ok';

export interface AziendaIndice {
  id: number;
  ragione_sociale: string;
  partita_iva: string;
  ateco: string;
  ateco_label: string;
  comune: string;
  lavoratori: number;
  stato: StatoAzienda;
  /** Spiegazione breve dello stato, letta anche dai lettori di schermo. */
  motivo: string;
}

const ORDINE_DVR: Record<string, number> = { approved: 3, review: 2, draft: 1, superseded: 0 };

/** Scadenze superate in rosso, DVR da fare o da aggiornare in oro, altrimenti tutto in regola. */
export function statoAzienda(c: Company, scadenze: Scadenza[], dvr: Dvr[], oggi: string): { stato: StatoAzienda; motivo: string } {
  const superate = scadenze.filter(
    (s) => s.company_id === c.id && s.stato !== 'completata' && (s.stato === 'scaduta' || (!!s.data_prevista && s.data_prevista.slice(0, 10) < oggi))
  ).length;
  if (superate > 0) return { stato: 'scaduto', motivo: superate === 1 ? '1 scadenza superata' : `${superate} scadenze superate` };
  const suoi = dvr.filter((d) => d.company_id === c.id && d.status !== 'superseded');
  if (suoi.length === 0) return { stato: 'aggiornare', motivo: 'DVR da preparare' };
  const ultimo = [...suoi].sort((a, b) => b.versione - a.versione || (ORDINE_DVR[b.status] ?? 0) - (ORDINE_DVR[a.status] ?? 0))[0];
  const rif = ultimo.generated_at ?? ultimo.data_creazione;
  if (c.updated_at && rif && c.updated_at > rif) return { stato: 'aggiornare', motivo: 'DVR da aggiornare: i dati sono cambiati' };
  if (ultimo.status !== 'approved') return { stato: 'aggiornare', motivo: ultimo.status === 'review' ? 'DVR in revisione' : 'DVR in bozza' };
  return { stato: 'ok', motivo: 'Tutto in regola' };
}

export function indiceAziende(aziende: Company[], scadenze: Scadenza[], dvr: Dvr[], oggi = new Date().toISOString().slice(0, 10)): AziendaIndice[] {
  return aziende
    .map((c) => {
      const sede = c.sedi?.find((s) => s.tipo === 'legale') ?? c.sedi?.[0];
      return {
        id: c.id,
        ragione_sociale: c.ragione_sociale,
        partita_iva: c.partita_iva ?? '',
        ateco: c.ateco ?? '',
        ateco_label: c.ateco_label ?? '',
        comune: sede?.comune ?? '',
        lavoratori: c.lavoratori ?? 0,
        ...statoAzienda(c, scadenze, dvr, oggi),
      };
    })
    .sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale, 'it', { sensitivity: 'base' }));
}

/** Lettera iniziale per i gruppi dell'elenco (cifre e simboli sotto "#"). */
export function iniziale(nome: string): string {
  const l = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : '#';
}

// ----- Preferite e recenti -----
export interface PreferenzeAziende {
  preferite: number[];
  recenti: number[];
}

const chiave = (userId: number) => `crm_dvr_agente_aziende:u${userId}`;
export const MAX_RECENTI = 5;

export function leggiPreferenze(userId: number): PreferenzeAziende {
  try {
    const raw = JSON.parse(window.localStorage.getItem(chiave(userId)) ?? 'null') as Partial<PreferenzeAziende> | null;
    const ids = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : []);
    return { preferite: ids(raw?.preferite), recenti: ids(raw?.recenti).slice(0, MAX_RECENTI) };
  } catch {
    return { preferite: [], recenti: [] };
  }
}

export function salvaPreferenze(userId: number, p: PreferenzeAziende): void {
  try {
    window.localStorage.setItem(chiave(userId), JSON.stringify(p));
  } catch {
    /* solo comodita': senza storage restano valide per la sessione */
  }
}

export function conRecente(p: PreferenzeAziende, id: number): PreferenzeAziende {
  return { ...p, recenti: [id, ...p.recenti.filter((x) => x !== id)].slice(0, MAX_RECENTI) };
}

export function conPreferita(p: PreferenzeAziende, id: number): PreferenzeAziende {
  return { ...p, preferite: p.preferite.includes(id) ? p.preferite.filter((x) => x !== id) : [...p.preferite, id] };
}

// ----- Ricerca e filtri dell'elenco aziende (colonna dell'agente) -----
export type FiltroStatoAziende = 'tutte' | 'scaduto' | 'aggiornare' | 'ok' | 'preferite';
export type OrdineAziende = 'nome' | 'urgenza' | 'lavoratori';

export interface FiltroAziende {
  testo: string;
  stato: FiltroStatoAziende;
  ordine: OrdineAziende;
}

export const FILTRO_AZIENDE_INIZIALE: FiltroAziende = { testo: '', stato: 'tutte', ordine: 'nome' };

const URGENZA: Record<StatoAzienda, number> = { scaduto: 0, aggiornare: 1, ok: 2 };

function normalizza(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.\s]+/g, ' ').trim();
}

/** Il filtro e' quello iniziale: si mostra l'elenco ordinato con preferite, recenti e lettere. */
export function filtroVuoto(f: FiltroAziende): boolean {
  return f.testo.trim() === '' && f.stato === 'tutte' && f.ordine === 'nome';
}

/**
 * Cerca in ragione sociale, partita IVA, comune, codice e descrizione ATECO
 * (ogni parola deve comparire, senza accenti e maiuscole), filtra per stato o
 * preferite e ordina per nome, urgenza (scadenze superate prima) o lavoratori.
 */
export function filtraAziende(aziende: AziendaIndice[], f: FiltroAziende, preferite: number[] = []): AziendaIndice[] {
  const parole = normalizza(f.testo).split(' ').filter(Boolean);
  const out = aziende.filter((a) => {
    if (f.stato === 'preferite' && !preferite.includes(a.id)) return false;
    if (f.stato !== 'tutte' && f.stato !== 'preferite' && a.stato !== f.stato) return false;
    if (parole.length === 0) return true;
    const dove = normalizza([a.ragione_sociale, a.partita_iva, a.comune, a.ateco, a.ateco_label].join(' '));
    const compatto = dove.replace(/ /g, '');
    return parole.every((p) => dove.includes(p) || compatto.includes(p));
  });
  const perNome = (x: AziendaIndice, y: AziendaIndice) => x.ragione_sociale.localeCompare(y.ragione_sociale, 'it', { sensitivity: 'base' });
  if (f.ordine === 'urgenza') return out.sort((x, y) => URGENZA[x.stato] - URGENZA[y.stato] || perNome(x, y));
  if (f.ordine === 'lavoratori') return out.sort((x, y) => y.lavoratori - x.lavoratori || perNome(x, y));
  return out.sort(perNome);
}

/** Quante aziende per stato: i numeri accanto ai filtri. */
export function contaPerStato(aziende: AziendaIndice[], preferite: number[] = []): Record<FiltroStatoAziende, number> {
  return {
    tutte: aziende.length,
    scaduto: aziende.filter((a) => a.stato === 'scaduto').length,
    aggiornare: aziende.filter((a) => a.stato === 'aggiornare').length,
    ok: aziende.filter((a) => a.stato === 'ok').length,
    preferite: aziende.filter((a) => preferite.includes(a.id)).length,
  };
}
