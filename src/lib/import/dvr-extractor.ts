// Estrattore client-side di dati DVR da documenti caricati (PDF/DOCX/XLSX/text).
//
// Strategia ibrida:
// 1. PARSER → estrae testo grezzo dai documenti
// 2. AI EXTRACTOR (opzionale, se Anthropic API key configurata):
//    Claude Sonnet 4.6 con prompt strutturato → JSON con sezioni A→I
// 3. EUREISTICA FALLBACK (sempre disponibile):
//    Regex + dizionari per pattern italiani comuni (P.IVA, ATECO, codici fiscali,
//    nomi figure di sicurezza, valori dB/m/s², ecc.)
//
// Output: `ExtractedDvr` con confidence per campo + source_excerpts per audit.

'use client';

import type {
  CompanyDimensione,
  DvrPayload,
  RischioValutato,
} from '../data-source';
import { calcolaLivelloRischio } from '../data-source';
import { parseFile, type ParsedFile } from './parsers';
import { RISCHI_TIPICI } from '../dvr-rischi-standard';

export interface ExtractedDvr {
  /** Sezioni A→I parzialmente compilate. Lascia null/undefined per campi non trovati. */
  partial: Partial<DvrPayload>;
  /** Confidence 0..1 per ogni field path estratto. */
  confidence: Record<string, number>;
  /** Citazioni del documento di origine (per audit + verifica RSPP). */
  source_excerpts: Record<string, string>;
  /** Source file. */
  source_filename: string;
  /** Mode: 'ai' se Claude usato, 'heuristic' altrimenti. */
  mode: 'ai' | 'heuristic';
  /** Avvisi (es. campi missing, confidence bassa). */
  warnings: string[];
}

const ANTHROPIC_KEY_STORAGE = 'crm_dvr_anthropic_api_key';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ANTHROPIC_KEY_STORAGE);
}

export function setApiKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  if (!key) localStorage.removeItem(ANTHROPIC_KEY_STORAGE);
  else localStorage.setItem(ANTHROPIC_KEY_STORAGE, key);
}

// ============================================================
// EXTRACTOR PRINCIPALE
// ============================================================

export async function extractDvrFromFile(file: File): Promise<ExtractedDvr> {
  const parsed = await parseFile(file);
  const text = textFromParsed(parsed);

  // Per ora: euristica + regex (l'AI processing diretto verso Anthropic da
  // browser è bloccato da CORS; quando arriva backend Laravel via cPanel, il
  // proxy /api/ai/extract userà Claude API).
  return extractHeuristic(text, parsed.filename);
}

function textFromParsed(p: ParsedFile): string {
  if (p.kind === 'text') return p.text;
  // tabular: appiattisci tutti i sheets in un blocco di testo
  const blocks: string[] = [];
  for (const sh of p.sheets) {
    blocks.push(`# Foglio: ${sh.name}\n`);
    blocks.push(sh.headers.join(' | '));
    for (const row of sh.rawRows.slice(1)) {
      blocks.push(row.join(' | '));
    }
    blocks.push('');
  }
  return blocks.join('\n');
}

// ============================================================
// EUREISTICA REGEX
// ============================================================

const RX_PIVA = /\b(?:IT)?(\d{11})\b/;
const RX_CF = /\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/;
const RX_ATECO = /\b(\d{2}\.\d{1,2})\b/;
const RX_CAP = /\b(\d{5})\b/;
const RX_LAVORATORI = /(?:lavoratori|dipendenti|addetti)[\s\S]{0,40}?(\d{1,5})/i;
const RX_LEX_8H = /(?:LEX[,\s]*8h|LEX,?8H)\D{0,10}(\d{2,3}(?:[.,]\d)?)\s*dB/i;
const RX_NIOSH_LI = /(?:NIOSH|LI)\D{0,20}([\d.,]+)/i;
const RX_HAV_A8 = /(?:HAV|A\(8\)|A8)\D{0,20}(\d+(?:[.,]\d+)?)\s*m\/s/i;

const FIGURE_PATTERNS = [
  { key: 'datore_lavoro', label: 'Datore di lavoro', patterns: [/datore\s+di\s+lavoro\s*[:.]?\s*([A-Z][a-zA-Z'’ ]{4,60})/i] },
  { key: 'rspp', label: 'RSPP', patterns: [/RSPP\s*[:.]?\s*([A-Z][a-zA-Z'’ ]{4,60})/, /responsabile.{0,5}servizio.{0,5}prevenzione[\s\S]{0,40}?[:.]?\s*([A-Z][a-zA-Z'’ ]{4,60})/i] },
  { key: 'medico_competente', label: 'Medico Competente', patterns: [/medico\s+competente\s*[:.]?\s*((?:Dott\.?|Dr\.?\s*ssa?\s*)?[A-Z][a-zA-Z'’ ]{4,60})/i] },
  { key: 'rls', label: 'RLS', patterns: [/RLS\s*[:.]?\s*([A-Z][a-zA-Z'’ ]{4,60})/, /rappresentante.{0,5}lavoratori\s+(?:per\s+la\s+)?sicurezza[\s\S]{0,40}?[:.]?\s*([A-Z][a-zA-Z'’ ]{4,60})/i] },
];

const PERICOLI_KEYWORDS = [
  { keyword: 'rumore', pericolo: 'Rumore (Tit. VIII Capo II · UNI 9612)' },
  { keyword: 'caduta', pericolo: "Caduta dall'alto (Tit. IV)" },
  { keyword: 'movimentazione', pericolo: 'Movimentazione manuale carichi (Tit. VI)' },
  { keyword: 'mmc', pericolo: 'Movimentazione manuale carichi (Tit. VI)' },
  { keyword: 'elettric', pericolo: 'Rischio elettrico (Tit. III Capo III)' },
  { keyword: 'incendio', pericolo: 'Rischio incendio (DM 03/09/2021)' },
  { keyword: 'chimic', pericolo: 'Rischio chimico (Tit. IX Capo I)' },
  { keyword: 'biologic', pericolo: 'Rischio biologico (Tit. X)' },
  { keyword: 'vibrazion', pericolo: 'Vibrazioni HAV/WBV (Tit. VIII Capo III)' },
  { keyword: 'videoterminal', pericolo: 'Videoterminali (Tit. VII)' },
  { keyword: 'stress', pericolo: 'Stress lavoro-correlato (art. 28 c.1-bis)' },
  { keyword: 'atex', pericolo: 'ATEX, atmosfere esplosive (Tit. XI)' },
  { keyword: 'radon', pericolo: 'Radon (D.Lgs. 101/2020)' },
];

function extractHeuristic(text: string, filename: string): ExtractedDvr {
  const partial: Partial<DvrPayload> = {};
  const confidence: Record<string, number> = {};
  const source_excerpts: Record<string, string> = {};
  const warnings: string[] = [];

  const norm = text.replace(/\s+/g, ' ');

  // ----- Sezione A -----
  const sezA: Partial<DvrPayload['sezione_a']> = {
    data_redazione: new Date().toISOString().slice(0, 10),
  };

  const piva = norm.match(RX_PIVA);
  if (piva) {
    sezA.partita_iva = `IT${piva[1]}`;
    confidence['sezione_a.partita_iva'] = 0.85;
    source_excerpts['sezione_a.partita_iva'] = excerptAround(norm, piva.index ?? 0, 60);
  }
  const ateco = norm.match(RX_ATECO);
  if (ateco) {
    sezA.ateco = ateco[1];
    confidence['sezione_a.ateco'] = 0.75;
    source_excerpts['sezione_a.ateco'] = excerptAround(norm, ateco.index ?? 0, 60);
  }
  const lavMatch = norm.match(RX_LAVORATORI);
  if (lavMatch) {
    sezA.lavoratori_totali = parseInt(lavMatch[1], 10);
    confidence['sezione_a.lavoratori_totali'] = 0.7;
    source_excerpts['sezione_a.lavoratori_totali'] = excerptAround(norm, lavMatch.index ?? 0, 80);
  }

  // Ragione sociale: prima riga "Srl/SpA/Snc/Sas" o pattern simile
  const rsMatch = norm.match(/\b([A-Z][\w'’ &.,]{4,80}\s+(?:S\.?r\.?l\.?|S\.?p\.?A\.?|S\.?n\.?c\.?|S\.?a\.?s\.?|Coop\.?|Soc\.?))/);
  if (rsMatch) {
    sezA.ragione_sociale = rsMatch[1].trim();
    confidence['sezione_a.ragione_sociale'] = 0.7;
    source_excerpts['sezione_a.ragione_sociale'] = excerptAround(norm, rsMatch.index ?? 0, 80);
  }

  // Dimensione (deriva da lavoratori se presente)
  if (sezA.lavoratori_totali) {
    sezA.dimensione = (sezA.lavoratori_totali < 10
      ? 'micro'
      : sezA.lavoratori_totali < 50
        ? 'piccola'
        : sezA.lavoratori_totali < 250
          ? 'media'
          : 'grande') as CompanyDimensione;
    confidence['sezione_a.dimensione'] = 0.8;
  }

  if (Object.keys(sezA).length > 1) partial.sezione_a = sezA as DvrPayload['sezione_a'];

  // ----- Sezione B -----
  const sezB: Partial<DvrPayload['sezione_b']> = {};
  for (const f of FIGURE_PATTERNS) {
    for (const pat of f.patterns) {
      const m = norm.match(pat);
      if (m) {
        const name = m[1].trim();
        if (name.length > 4 && name.length < 80) {
          (sezB as Record<string, string>)[f.key] = name;
          confidence[`sezione_b.${f.key}`] = 0.75;
          source_excerpts[`sezione_b.${f.key}`] = excerptAround(norm, m.index ?? 0, 100);
          break;
        }
      }
    }
  }
  if (Object.keys(sezB).length > 0) partial.sezione_b = sezB as DvrPayload['sezione_b'];

  // ----- Sezione D — pericoli identificati per keyword -----
  const pericoli = new Set<string>();
  for (const pk of PERICOLI_KEYWORDS) {
    if (norm.toLowerCase().includes(pk.keyword)) {
      pericoli.add(pk.pericolo);
    }
  }
  if (pericoli.size > 0) {
    partial.sezione_d = { pericoli_identificati: Array.from(pericoli) };
    confidence['sezione_d.pericoli_identificati'] = 0.7;
  }

  // ----- Sezione E — matrice rischi pre-popolata dai pericoli rilevati -----
  if (pericoli.size > 0) {
    const matrice: RischioValutato[] = [];
    for (const pericolo of Array.from(pericoli)) {
      // Prova a matchare con catalogo standard
      const match = RISCHI_TIPICI.find((r) =>
        pericolo.toLowerCase().includes(r.categoria.toLowerCase().split(' ')[0])
      );
      if (match) {
        matrice.push({
          pericolo: match.categoria,
          probabilita: match.p_default,
          gravita: match.g_default,
          livello: calcolaLivelloRischio(match.p_default, match.g_default),
          fonte_norma: match.fonte_norma,
        });
      }
    }
    if (matrice.length > 0) {
      partial.sezione_e = { matrice_rischi: matrice };
      confidence['sezione_e.matrice_rischi'] = 0.6;
      warnings.push(
        `Matrice P×G pre-popolata con valori di default per ${matrice.length} rischi. Verifica e aggiusta P/G in base alla situazione reale dell'azienda.`
      );
    }
  }

  // ----- Sezione H — valutazioni specifiche -----
  const sezH: Partial<DvrPayload['sezione_h']> = {};
  const lex = norm.match(RX_LEX_8H);
  if (lex) {
    sezH.rumore = `LEX,8h ≈ ${lex[1]} dB(A) (UNI EN ISO 9612)`;
    confidence['sezione_h.rumore'] = 0.8;
    source_excerpts['sezione_h.rumore'] = excerptAround(norm, lex.index ?? 0, 100);
  }
  const niosh = norm.match(RX_NIOSH_LI);
  if (niosh) {
    sezH.mmc = `NIOSH LI ≈ ${niosh[1]}`;
    confidence['sezione_h.mmc'] = 0.7;
    source_excerpts['sezione_h.mmc'] = excerptAround(norm, niosh.index ?? 0, 100);
  }
  const hav = norm.match(RX_HAV_A8);
  if (hav) {
    sezH.vibrazioni = `HAV A(8) ≈ ${hav[1]} m/s²`;
    confidence['sezione_h.vibrazioni'] = 0.75;
    source_excerpts['sezione_h.vibrazioni'] = excerptAround(norm, hav.index ?? 0, 100);
  }
  if (Object.keys(sezH).length > 0) partial.sezione_h = sezH;

  // ----- Warnings -----
  if (Object.keys(confidence).length === 0) {
    warnings.push(
      'Nessun dato strutturato estratto dal documento. Compila manualmente nel wizard, oppure usa un documento più strutturato (vecchio DVR, registro infortuni, ecc.).'
    );
  } else {
    const lowConf = Object.entries(confidence).filter(([, v]) => v < 0.7).length;
    if (lowConf > 0) warnings.push(`${lowConf} campi estratti con bassa affidabilità (<70%): rivedere prima del salvataggio.`);
  }

  return {
    partial,
    confidence,
    source_excerpts,
    source_filename: filename,
    mode: 'heuristic',
    warnings,
  };
}

function excerptAround(text: string, idx: number, chars: number): string {
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + chars);
  return '…' + text.slice(start, end).trim() + '…';
}

// ============================================================
// MERGE EXTRACTED DVR INTO WIZARD DRAFT
// ============================================================

export interface WizardDraftPatch {
  ragione_sociale?: string;
  partita_iva?: string;
  ateco?: string;
  lavoratori?: number;
  dimensione?: CompanyDimensione;
  datore_lavoro?: string;
  rspp?: string;
  medico_competente?: string;
  rls?: string;
  pericoli_selezionati?: Record<string, boolean>;
  rischi?: Array<{ id: string; categoria: string; p: 1 | 2 | 3 | 4; g: 1 | 2 | 3 | 4; fonte_norma: string }>;
  rumore?: string;
  mmc?: string;
  vibrazioni?: string;
  chimico?: string;
}

export function extractedToWizardPatch(ex: ExtractedDvr): WizardDraftPatch {
  const patch: WizardDraftPatch = {};
  const a = ex.partial.sezione_a;
  if (a) {
    if (a.ragione_sociale) patch.ragione_sociale = a.ragione_sociale;
    if (a.partita_iva) patch.partita_iva = a.partita_iva;
    if (a.ateco) patch.ateco = a.ateco;
    if (a.lavoratori_totali) patch.lavoratori = a.lavoratori_totali;
    if (a.dimensione) patch.dimensione = a.dimensione;
  }
  const b = ex.partial.sezione_b;
  if (b) {
    if (b.datore_lavoro) patch.datore_lavoro = b.datore_lavoro;
    if (b.rspp) patch.rspp = b.rspp;
    if (b.medico_competente) patch.medico_competente = b.medico_competente;
    if (b.rls) patch.rls = b.rls;
  }
  const d = ex.partial.sezione_d;
  if (d?.pericoli_identificati) {
    patch.pericoli_selezionati = {};
    for (const p of d.pericoli_identificati) patch.pericoli_selezionati[p] = true;
  }
  const e = ex.partial.sezione_e;
  if (e?.matrice_rischi) {
    patch.rischi = e.matrice_rischi.map((r) => {
      const tipo = RISCHI_TIPICI.find((t) => t.categoria === r.pericolo);
      return {
        id: tipo?.id ?? r.pericolo,
        categoria: r.pericolo,
        p: r.probabilita,
        g: r.gravita,
        fonte_norma: r.fonte_norma ?? '',
      };
    });
  }
  const h = ex.partial.sezione_h;
  if (h) {
    if (h.rumore) patch.rumore = h.rumore;
    if (h.mmc) patch.mmc = h.mmc;
    if (h.vibrazioni) patch.vibrazioni = h.vibrazioni;
    if (h.chimico) patch.chimico = h.chimico;
  }
  return patch;
}

/**
 * Sezione-bound: dato il patch completo, ritorna solo i campi rilevanti per
 * lo step corrente del wizard. Permette upload mirati per sezione (es. carico
 * un report fonometrico nello step H → estraggo solo il LEX 8h, non altro).
 */
export type WizardSection = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'h';

const FIELDS_BY_SECTION: Record<WizardSection, (keyof WizardDraftPatch)[]> = {
  a: ['ragione_sociale', 'partita_iva', 'ateco', 'lavoratori', 'dimensione'],
  b: ['datore_lavoro', 'rspp', 'medico_competente', 'rls'],
  c: [],
  d: ['pericoli_selezionati'],
  e: ['rischi'],
  f: [],
  h: ['rumore', 'mmc', 'vibrazioni', 'chimico'],
};

export function filterPatchToSection(patch: WizardDraftPatch, section: WizardSection): WizardDraftPatch {
  const allowed = new Set<string>(FIELDS_BY_SECTION[section] as string[]);
  const out: WizardDraftPatch = {};
  for (const k of Object.keys(patch) as (keyof WizardDraftPatch)[]) {
    if (allowed.has(k as string)) {
      // @ts-expect-error key is in WizardDraftPatch
      out[k] = patch[k];
    }
  }
  return out;
}

export function countPatchFields(patch: WizardDraftPatch): number {
  return Object.keys(patch).filter((k) => {
    const v = patch[k as keyof WizardDraftPatch];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return false;
    return true;
  }).length;
}
