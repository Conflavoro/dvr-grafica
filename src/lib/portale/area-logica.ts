/**
 * Logica pura delle viste dell'area azienda, operativita': raggruppamenti,
 * filtri, etichette e controlli dei moduli. Niente React, niente rete:
 * si prova con Jest.
 */

import type { CategoriaScadenza, Fase, RigaPersona, VoceScadenza } from './area-api';

export const NOMI_CATEGORIA: Record<CategoriaScadenza, string> = {
  formazione: 'Formazione',
  visite: 'Visite',
  antincendio: 'Antincendio',
  primosoccorso: 'Primo soccorso',
  haccp: 'HACCP',
  contratto: 'Contratto',
  ispezioni: 'Ispezioni',
  attrezzature: 'Attrezzature e DPI',
  documenti: 'Documenti',
  impianti: 'Impianti',
  altro: 'Altro',
};

/** Pallino della categoria (la tinta di categoria solo nei segni, mai di fondo). */
export const SEGNO_CATEGORIA: Record<CategoriaScadenza, string> = {
  formazione: 'bg-cat-formazione-segno',
  visite: 'bg-cat-visite-segno',
  antincendio: 'bg-cat-antincendio-segno',
  // Primo soccorso e HACCP: i token di categoria arrivano con il design system (S1), intanto il grigio.
  primosoccorso: 'bg-grafite-400',
  haccp: 'bg-grafite-400',
  contratto: 'bg-cat-contratto-segno',
  ispezioni: 'bg-grafite-900',
  attrezzature: 'bg-cat-servizi-segno',
  documenti: 'bg-cat-documenti-segno',
  impianti: 'bg-cat-utenti-segno',
  altro: 'bg-grafite-400',
};

export const NOMI_FASE: Record<Fase, string> = {
  scaduta: 'Scaduta',
  da_prenotare: 'Da prenotare',
  prenotata: 'Prenotata',
};

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** Testo del chip di una voce, come nel prototipo. */
export function testoChip(v: Pick<VoceScadenza, 'fase' | 'data' | 'categoria'>): string {
  if (v.fase === 'scaduta') return 'Scaduta';
  if (v.fase === 'prenotata') return 'Prenotata';
  if (v.data === null) return 'Mai fatta';
  if (v.categoria === 'documenti') return 'Da aggiornare';
  if (v.categoria === 'contratto') return 'Da rinnovare';
  return 'Da prenotare';
}

export function giorniTesto(g: number | null): string {
  if (g === null) return 'Mai fatta';
  if (g < 0) return g === -1 ? 'scaduta da 1 giorno' : `scaduta da ${-g} giorni`;
  if (g === 0) return 'scade oggi';
  return g === 1 ? 'tra 1 giorno' : `tra ${g} giorni`;
}

export interface GruppoMese {
  chiave: string;
  titolo: string;
  voci: VoceScadenza[];
  scadute: number;
}

/** Voci per mese; quelle senza data in testa ("Mai fatte, senza data"). */
export function perMese(voci: VoceScadenza[]): GruppoMese[] {
  const out: GruppoMese[] = [];
  for (const v of voci) {
    const chiave = v.data ? v.data.slice(0, 7) : 'senza-data';
    let g = out.find((x) => x.chiave === chiave);
    if (!g) {
      const [a, m] = chiave.split('-');
      g = { chiave, titolo: v.data ? `${MESI[Number(m) - 1]} ${a}` : 'Mai fatte, senza data', voci: [], scadute: 0 };
      out.push(g);
    }
    g.voci.push(v);
    if (v.fase === 'scaduta') g.scadute++;
  }
  return out.sort((x, y) => (x.chiave === 'senza-data' ? -1 : y.chiave === 'senza-data' ? 1 : x.chiave.localeCompare(y.chiave)));
}

export function filtraVoci(voci: VoceScadenza[], categorie: CategoriaScadenza[], fase: Fase | null): VoceScadenza[] {
  return voci.filter((v) => (categorie.length === 0 || categorie.includes(v.categoria)) && (fase === null || v.fase === fase));
}

export function contaPer<K extends string>(voci: VoceScadenza[], chiave: (v: VoceScadenza) => K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const v of voci) out[chiave(v)] = (out[chiave(v)] ?? 0) + 1;
  return out;
}

/** Giorno e mese brevi per il blocco data della riga ("22" e "ott"). */
export function bloccoData(iso: string | null): { giorno: string; mese: string } {
  if (!iso) return { giorno: '', mese: '' };
  const [, m, g] = iso.slice(0, 10).split('-');
  return { giorno: String(Number(g)), mese: MESI_BREVI[Number(m) - 1] ?? '' };
}

/** "2026-10-26 09:30" -> "26/10/2026 alle 09:30". */
export function dataOra(v: string | null): string {
  if (!v) return '';
  const [d, h] = v.replace('T', ' ').split(' ');
  const [a, m, g] = d.split('-');
  return `${g}/${m}/${a}${h ? ` alle ${h.slice(0, 5)}` : ''}`;
}

export const NOMI_RISCHIO: Record<string, string> = { basso: 'Basso', medio: 'Medio', alto: 'Alto' };

export const NOMI_TIPO_VISITA: Record<string, string> = {
  preventiva: 'Preventiva',
  periodica: 'Periodica',
  cambio_mansione: 'Cambio mansione',
  rientro: 'Rientro dopo assenza',
  su_richiesta: 'Su richiesta del lavoratore',
  cessazione: 'Alla cessazione',
  preassuntiva: 'Preassuntiva',
};

export const CONTRATTI: Array<{ k: string; t: string }> = [
  { k: 'indeterminato', t: 'Indeterminato' },
  { k: 'determinato', t: 'Determinato' },
  { k: 'apprendistato', t: 'Apprendistato' },
  { k: 'somministrazione', t: 'Somministrazione' },
  { k: 'tirocinio', t: 'Tirocinio' },
  { k: 'intermittente', t: 'Intermittente' },
  { k: 'stagionale', t: 'Stagionale' },
];

export const LINGUE: Array<{ k: string; t: string }> = [
  { k: 'it', t: 'Italiano' },
  { k: 'en', t: 'Inglese' },
  { k: 'ar', t: 'Arabo' },
  { k: 'ro', t: 'Rumeno' },
  { k: 'sq', t: 'Albanese' },
  { k: 'es', t: 'Spagnolo' },
  { k: 'fr', t: 'Francese' },
  { k: 'zh', t: 'Cinese' },
  { k: 'ur', t: 'Urdu' },
  { k: 'pa', t: 'Punjabi' },
  { k: 'uk', t: 'Ucraino' },
];

/** Cellulare italiano senza spazi, punti, trattini e prefisso internazionale. */
export function pulisciCellulare(v: string): string {
  return v.replace(/[\s.\-/()]/g, '').replace(/^(\+39|0039)/, '');
}

export interface DatiAssunto {
  nome: string;
  cognome: string;
  mansione: string;
  data: string;
  cellulare: string;
  unilav: string;
}

/** Controlli del foglio "Comunica un nuovo assunto" (spec 4). */
export function validaAssunto(d: DatiAssunto, oggi: Date = new Date()): Partial<Record<keyof DatiAssunto, string>> {
  const e: Partial<Record<keyof DatiAssunto, string>> = {};
  if (d.nome.trim().length < 2) e.nome = 'Scrivi il nome.';
  if (d.cognome.trim().length < 2) e.cognome = 'Scrivi il cognome.';
  if (d.mansione.trim().length < 3) e.mansione = 'Scrivi la mansione (almeno 3 caratteri).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) e.data = 'Indica la data di assunzione.';
  else {
    const g = Math.round((new Date(`${d.data}T12:00:00`).getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 86400000);
    if (g > 60) e.data = 'Oltre 60 giorni: comunica l’assunzione più avanti.';
    else if (g < -365) e.data = 'Più di un anno fa: scrivi alla segreteria.';
  }
  if (!/^3\d{8,9}$/.test(pulisciCellulare(d.cellulare))) e.cellulare = 'Serve un cellulare italiano, per esempio 333 123 4567.';
  if (d.unilav.trim().length < 3) e.unilav = 'Indica il riferimento della comunicazione UniLav.';
  return e;
}

export type FiltroStatoPersona = 'tutti' | 'ok' | 'warn' | 'todo' | 'info' | 'danger' | 'pay';

export function filtraPersone(righe: RigaPersona[], f: { testo: string; stato: FiltroStatoPersona; rischio: string }): RigaPersona[] {
  const q = f.testo.trim().toLowerCase();
  return righe.filter(
    (r) =>
      (q === '' || r.nome.toLowerCase().includes(q) || r.mansione.toLowerCase().includes(q) || (r.reparto ?? '').toLowerCase().includes(q)) &&
      (f.stato === 'tutti' || r.stato === f.stato) &&
      (f.rischio === '' || r.rischio === f.rischio)
  );
}

/** Mese della sorveglianza antincendio ("ottobre"). */
export function nomeMese(d: Date = new Date()): string {
  return MESI[d.getMonth()];
}

/** Corsi che l'azienda chiede piu' spesso (nomi del catalogo del backend). */
export const CORSI_COMUNI: Array<{ codice: string; nome: string }> = [
  { codice: 'formazione_generale', nome: 'Formazione generale dei lavoratori' },
  { codice: 'formazione_specifica', nome: 'Formazione specifica dei lavoratori' },
  { codice: 'preposto', nome: 'Formazione del preposto' },
  { codice: 'antincendio', nome: 'Addetto antincendio e gestione emergenze' },
  { codice: 'primo_soccorso', nome: 'Addetto al primo soccorso' },
  { codice: 'rls', nome: 'Rappresentante dei lavoratori per la sicurezza' },
  { codice: 'carrello_elevatore', nome: 'Abilitazione all’uso dei carrelli elevatori' },
  { codice: 'ple', nome: 'Abilitazione all’uso delle PLE' },
];

/** Giorni del mese per il calendario dello scadenziario (settimana da lunedi'): null = cella vuota. */
export function giorniMese(anno: number, mese: number): Array<string | null> {
  const primo = new Date(anno, mese, 1);
  const vuote = (primo.getDay() + 6) % 7;
  const n = new Date(anno, mese + 1, 0).getDate();
  const out: Array<string | null> = Array.from({ length: vuote }, () => null);
  for (let g = 1; g <= n; g++) out.push(`${anno}-${String(mese + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`);
  return out;
}

/** Giorno da mostrare nel calendario: quello scelto se ha ancora voci, poi il primo da oggi, poi il primo. */
export function giornoScelto(giorni: string[], scelto: string | null, oggi: string): string | null {
  if (scelto && giorni.includes(scelto)) return scelto;
  const ordinati = [...giorni].sort();
  return ordinati.find((g) => g >= oggi) ?? ordinati[0] ?? null;
}
