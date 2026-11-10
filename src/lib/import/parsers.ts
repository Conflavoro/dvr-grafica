// Parser unificato per file caricati. Tutti i parser ritornano una rappresentazione
// normalizzata: tabellare (rows[][]) per Excel/CSV, oppure testo grezzo per PDF/DOCX.
// L'AI extractor o il field-mapper poi processa questa rappresentazione per
// produrre dati strutturati (Company, DvrPayload sezioni, ecc.).

'use client';

export type ParsedFile =
  | { kind: 'tabular'; filename: string; sheets: ParsedSheet[] }
  | { kind: 'text'; filename: string; text: string; pages?: number };

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  rawRows: string[][];
}

const TEXT_EXT = ['txt', 'md', 'csv', 'tsv'];
const EXCEL_EXT = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'];
const DOCX_EXT = ['docx'];
const PDF_EXT = ['pdf'];

export function detectKind(file: File): 'excel' | 'csv' | 'docx' | 'pdf' | 'text' | 'unknown' {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (EXCEL_EXT.includes(ext)) return 'excel';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (DOCX_EXT.includes(ext)) return 'docx';
  if (PDF_EXT.includes(ext)) return 'pdf';
  if (TEXT_EXT.includes(ext)) return 'text';
  return 'unknown';
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const kind = detectKind(file);
  switch (kind) {
    case 'excel':
      return parseExcel(file);
    case 'csv':
      return parseCsv(file);
    case 'docx':
      return parseDocx(file);
    case 'pdf':
      return parsePdf(file);
    case 'text':
      return { kind: 'text', filename: file.name, text: await file.text() };
    default:
      throw new Error(`Tipo file non supportato: ${file.name}`);
  }
}

// ============================================================
// EXCEL — usa xlsx package
// ============================================================
async function parseExcel(file: File): Promise<ParsedFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: ParsedSheet[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: false }) as string[][];
    if (rawRows.length === 0) continue;
    const headers = rawRows[0].map((h) => String(h ?? '').trim());
    const rows = rawRows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = String(row[i] ?? '').trim();
      });
      return obj;
    });
    sheets.push({ name: sheetName, headers, rows, rawRows });
  }
  return { kind: 'tabular', filename: file.name, sheets };
}

// ============================================================
// CSV — usa papaparse
// ============================================================
async function parseCsv(file: File): Promise<ParsedFile> {
  const Papa = (await import('papaparse')).default;
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const rows = result.data.map((r) => {
          const o: Record<string, string> = {};
          for (const h of headers) o[h] = String(r[h] ?? '').trim();
          return o;
        });
        const rawRows = [headers, ...rows.map((r) => headers.map((h) => r[h]))];
        resolve({
          kind: 'tabular',
          filename: file.name,
          sheets: [{ name: 'sheet', headers, rows, rawRows }],
        });
      },
      error: (e: Error) => reject(new Error(`Errore parsing CSV: ${e.message}`)),
    });
  });
}

// ============================================================
// DOCX — usa mammoth (estrai testo, conserva paragrafi)
// ============================================================
async function parseDocx(file: File): Promise<ParsedFile> {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { kind: 'text', filename: file.name, text: result.value };
}

// ============================================================
// PDF — usa pdfjs-dist (estrai testo per pagina)
// ============================================================
async function parsePdf(file: File): Promise<ParsedFile> {
  const pdfjs = await import('pdfjs-dist');
  // Worker via blob (evita problemi CORS in produzione)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
  }
  return { kind: 'text', filename: file.name, text: pages.join('\n\n--- PAG ---\n\n'), pages: doc.numPages };
}
