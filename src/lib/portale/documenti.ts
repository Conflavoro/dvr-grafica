/**
 * Logica pura della Scrivania dei documenti e di POS e PiMUS (gestionale, ADR-009 V3):
 * stati comuni, etichette, permessi per ruolo, ordinamento, avanzamento della
 * generazione, gruppi di segnalazioni. Niente chiamate di rete: si prova con Jest.
 */

import type { StatoChip } from '@/components/portale/kit';
import type { Role } from '@/lib/data-source';

export type StatoDoc = 'bozza' | 'revisione' | 'emesso' | 'da_aggiornare';
export type GruppoDoc = 'dvr' | 'valutazione' | 'documento' | 'pos';

export interface VoceDocumento {
  chiave: string;
  gruppo: GruppoDoc;
  id: number;
  tipo: string;
  etichetta: string;
  titolo: string | null;
  stato: StatoDoc;
  statoOriginale: string;
  revisione: number;
  versione: number | null;
  emessoIl: string | null;
  aggiornatoIl: string | null;
  perche: string[];
  bloccanti: number;
  generazione: string | null;
  cantiereId: number | null;
}

export interface AziendaScrivania {
  id: number;
  ragioneSociale: string;
  ateco: string | null;
  lavoratori: number | null;
  documenti: number;
  conteggi: Record<StatoDoc, number>;
  dvr: { id: number; stato: StatoDoc; versione: number | null } | null;
  priorita: 'senza_dvr' | 'da_aggiornare' | 'revisione' | 'bozza' | 'in_regola';
}

export const STATO_DOC: Record<StatoDoc, { chip: StatoChip; testo: string }> = {
  bozza: { chip: 'neutral', testo: 'Bozza' },
  revisione: { chip: 'run', testo: 'In revisione' },
  emesso: { chip: 'ok', testo: 'Emesso' },
  da_aggiornare: { chip: 'warn', testo: 'Da aggiornare' },
};

/** Testo dello stato per gruppo: il DVR si approva, gli altri documenti si emettono. */
export function testoStato(v: Pick<VoceDocumento, 'stato' | 'gruppo'>): string {
  if (v.stato === 'emesso') return v.gruppo === 'dvr' ? 'Approvato' : 'Emesso';
  if (v.stato === 'revisione') return v.gruppo === 'dvr' ? 'In revisione' : 'Pronto da emettere';
  return STATO_DOC[v.stato].testo;
}

export const PRIORITA: Record<AziendaScrivania['priorita'], { chip: StatoChip; testo: string; ordine: number }> = {
  senza_dvr: { chip: 'danger', testo: 'Senza DVR', ordine: 0 },
  da_aggiornare: { chip: 'warn', testo: 'Da aggiornare', ordine: 1 },
  revisione: { chip: 'run', testo: 'In revisione', ordine: 2 },
  bozza: { chip: 'neutral', testo: 'Bozze aperte', ordine: 3 },
  in_regola: { chip: 'ok', testo: 'In regola', ordine: 4 },
};

const ORDINE_STATO: Record<StatoDoc, number> = { da_aggiornare: 0, revisione: 1, bozza: 2, emesso: 3 };
const ORDINE_GRUPPO: Record<GruppoDoc, number> = { dvr: 0, valutazione: 1, documento: 2, pos: 3 };

/** Ordine nella colonna: per gruppo, poi prima ciò che chiede lavoro. */
export function ordinaDocumenti(voci: VoceDocumento[]): VoceDocumento[] {
  return [...voci].sort((a, b) => ORDINE_GRUPPO[a.gruppo] - ORDINE_GRUPPO[b.gruppo] || ORDINE_STATO[a.stato] - ORDINE_STATO[b.stato] || a.etichetta.localeCompare(b.etichetta, 'it'));
}

/** Aziende con lavoro in sospeso prima, poi alfabetico. */
export function ordinaAziende(az: AziendaScrivania[], filtro: '' | AziendaScrivania['priorita'] = ''): AziendaScrivania[] {
  return az
    .filter((a) => !filtro || a.priorita === filtro)
    .sort((a, b) => PRIORITA[a.priorita].ordine - PRIORITA[b.priorita].ordine || a.ragioneSociale.localeCompare(b.ragioneSociale, 'it'));
}

export const GRUPPI: Record<GruppoDoc, string> = { dvr: 'DVR', valutazione: 'Valutazioni specifiche', documento: 'Documenti', pos: 'Cantieri' };

// ---------------------------------------------------------------- permessi

const STUDIO: Role[] = ['consulente', 'titolare_studio', 'admin_conflavoro'];
const EMETTE: Role[] = ['titolare_studio', 'admin_conflavoro'];

export const puoRedigere = (r: Role) => STUDIO.includes(r);
/** Approvazione del DVR ed emissione dei documenti: solo il titolare dello studio (o lo staff Conflavoro). */
export const puoEmettere = (r: Role) => EMETTE.includes(r);

export type AzioneDoc = 'genera' | 'rigenera' | 'invia_revisione' | 'approva' | 'segna_pronta' | 'emetti' | 'apri_pos';

/** Azioni proposte per un documento al ruolo. L'ordine è quello dei pulsanti. */
export function azioniDocumento(v: VoceDocumento, ruolo: Role): AzioneDoc[] {
  if (!puoRedigere(ruolo)) return [];
  const out: AzioneDoc[] = [];
  const inGenerazione = v.generazione === 'pending' || v.generazione === 'running';
  switch (v.gruppo) {
    case 'dvr':
      if (!inGenerazione) out.push(v.revisione > 0 ? 'rigenera' : 'genera');
      if (v.statoOriginale === 'draft' && v.revisione > 0 && !inGenerazione) out.push('invia_revisione');
      if (puoEmettere(ruolo) && v.statoOriginale === 'review' && !inGenerazione) out.push('approva');
      break;
    case 'valutazione':
      if (v.statoOriginale === 'bozza') out.push('segna_pronta');
      if (puoEmettere(ruolo) && v.statoOriginale === 'pronta') out.push('emetti');
      break;
    case 'documento':
      if (puoEmettere(ruolo) && v.statoOriginale === 'bozza') out.push('emetti');
      break;
    case 'pos':
      out.push('apri_pos');
      break;
  }
  return out;
}

// ---------------------------------------------------------------- generazione

export interface PassoGenerazione {
  agente: string;
  etichetta: string;
  stato: 'attesa' | 'in_corso' | 'fatto' | 'errore' | 'saltato';
  secondi: number | null;
}

/** Percentuale dei passi chiusi (fatti, saltati perché non servono o andati in errore). */
export function percentualePassi(passi: PassoGenerazione[]): number {
  if (passi.length === 0) return 0;
  const chiusi = passi.filter((p) => p.stato === 'fatto' || p.stato === 'errore' || p.stato === 'saltato').length;
  return Math.round((chiusi / passi.length) * 100);
}

export function inCorso(stato: string | null | undefined): boolean {
  return stato === 'pending' || stato === 'running';
}

// ---------------------------------------------------------------- qualità

export interface Miglioramento {
  componente: string;
  guadagno: number;
  azione: string;
}

export function livelloQualita(punteggio: number): { testo: string; chip: StatoChip } {
  if (punteggio >= 85) return { testo: 'Eccellente', chip: 'ok' };
  if (punteggio >= 70) return { testo: 'Buono', chip: 'ok' };
  if (punteggio >= 50) return { testo: 'Sufficiente', chip: 'warn' };
  return { testo: 'Insufficiente', chip: 'danger' };
}

/** Domanda al Falco per un difetto di qualità: spiega e propone la correzione, non la applica da solo. */
export function domandaDifetto(m: Miglioramento, doc: Pick<VoceDocumento, 'gruppo' | 'id' | 'etichetta'>): string {
  const cosa = doc.gruppo === 'dvr' ? `del DVR ${doc.id}` : `del documento «${doc.etichetta}» (${doc.gruppo} ${doc.id})`;
  return `Difetto di qualità ${cosa}: «${m.azione}». Spiegami perché conta e proponimi la correzione, sezione per sezione. Non modificare nulla finché non te lo confermo.`;
}

// ---------------------------------------------------------------- segnalazioni (POS, documenti, valutazioni)

export interface Segnalazione {
  chiave: string;
  esito: 'blocca' | 'corregge' | 'avvisa';
  messaggio: string;
  riferimento: string | null;
  dove: string | null;
  accettabile: boolean;
  accettata: boolean;
}

export const ESITO: Record<Segnalazione['esito'], { chip: StatoChip; testo: string; ordine: number }> = {
  blocca: { chip: 'danger', testo: 'Blocca', ordine: 0 },
  corregge: { chip: 'warn', testo: 'Da correggere in libreria', ordine: 1 },
  avvisa: { chip: 'info', testo: 'Avviso', ordine: 2 },
};

export function raggruppaSegnalazioni(s: Segnalazione[]): Array<{ esito: Segnalazione['esito']; voci: Segnalazione[] }> {
  const aperte = s.filter((x) => !x.accettata);
  return (['blocca', 'corregge', 'avvisa'] as const)
    .map((esito) => ({ esito, voci: aperte.filter((x) => x.esito === esito) }))
    .filter((g) => g.voci.length > 0);
}

/** Motivo di accettazione di un avviso: almeno 10 caratteri veri (come il backend). */
export function motivoValido(m: string): boolean {
  return m.trim().replace(/\s+/g, ' ').length >= 10;
}

// ---------------------------------------------------------------- download

export function nomeFile(v: Pick<VoceDocumento, 'etichetta' | 'revisione'>, azienda: string, formato: 'pdf' | 'docx'): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(v.etichetta) || 'documento'}_${slug(azienda) || 'azienda'}_${v.revisione > 0 ? `rev${v.revisione}` : 'bozza'}.${formato}`;
}
