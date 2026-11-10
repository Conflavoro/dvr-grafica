// Generatore DVR client-side: DOCX (via docx) + PDF (via jspdf + autotable).
// Output conforme D.Lgs. 81/08 art. 28 con disclaimer AI obbligatorio.

'use client';

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { Dvr, DvrPayload, RischioLivello, RischioValutato } from './data-source';
import { SCHEDE_RISCHIO, ALLEGATO_NORMATIVO, SCHEMA_FORMAZIONE } from './dvr-knowledge';
import { RISCHI_TIPICI } from './dvr-rischi-standard';
import { fetchConTempo } from '@/lib/attesa';

// ============================================================
// COLORI MATRICE RISCHI (D.Lgs. 81/08)
// ============================================================
const RISK_COLORS_HEX: Record<RischioLivello, string> = {
  basso: '22C55E',
  medio: 'EAB308',
  alto: 'F97316',
  molto_alto: 'EF4444',
};
const RISK_COLORS_RGB: Record<RischioLivello, [number, number, number]> = {
  basso: [220, 252, 231],
  medio: [254, 243, 199],
  alto: [255, 237, 213],
  molto_alto: [254, 226, 226],
};
const VIOLA_BRAND = '8A54EA';
const VIOLA_RGB: [number, number, number] = [138, 84, 234];
const VIOLA_DARK_RGB: [number, number, number] = [76, 60, 142];

const SECTION_TITLES: Array<[string, keyof DvrPayload]> = [
  ['A · Frontespizio e dati aziendali', 'sezione_a'],
  ['B · Organigramma sicurezza', 'sezione_b'],
  ['C · Descrizione attività e ciclo lavorativo', 'sezione_c'],
  ['D · Identificazione dei pericoli', 'sezione_d'],
  ['E · Valutazione dei rischi (P × G)', 'sezione_e'],
  ['F · Misure di prevenzione e protezione', 'sezione_f'],
  ['G · Piano di miglioramento', 'sezione_g'],
  ['H · Valutazioni specifiche', 'sezione_h'],
  ['I · Allegati', 'sezione_i'],
];

// ============================================================
// DOCX GENERATION
// ============================================================

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; italic?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spaceAfter?: number } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color, italics: opts.italic })],
    alignment: opts.alignment,
    spacing: { after: opts.spaceAfter ?? 120 },
  });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: title, bold: true, size: 32, color: VIOLA_BRAND })],
    spacing: { before: 360, after: 240 },
    pageBreakBefore: true,
  });
}

function kvRow(key: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: 'F3ECFE' },
        children: [p(key, { bold: true, size: 20 })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [p(value || '—', { size: 20 })],
      }),
    ],
  });
}

function tabellaKV(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) => kvRow(k, v)),
  });
}

function tabellaRischi(rischi: RischioValutato[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ['Pericolo', 'Norma', 'P', 'G', 'R', 'Livello'].map(
      (t) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND },
          children: [p(t, { bold: true, color: 'FFFFFF', size: 18 })],
        })
    ),
  });
  const rows = rischi.map((r) => {
    const totalR = r.probabilita * r.gravita;
    return new TableRow({
      children: [
        new TableCell({ children: [p(r.pericolo, { size: 18 })], width: { size: 30, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [p(r.fonte_norma ?? '', { size: 14, italic: true })], width: { size: 30, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [p(String(r.probabilita), { alignment: AlignmentType.CENTER, size: 18 })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [p(String(r.gravita), { alignment: AlignmentType.CENTER, size: 18 })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [p(String(totalR), { alignment: AlignmentType.CENTER, bold: true, size: 18 })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: RISK_COLORS_HEX[r.livello] },
          children: [p(r.livello.replace('_', ' '), { bold: true, size: 18 })],
          width: { size: 16, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

function listParagraphs(items: string[]): Paragraph[] {
  if (items.length === 0) return [p('—', { italic: true, color: '9CA3AF' })];
  return items.map((item) =>
    new Paragraph({
      children: [new TextRun({ text: '• ', bold: true }), new TextRun({ text: item, size: 20 })],
      spacing: { after: 80 },
      indent: { left: 360 },
    })
  );
}

export async function generateDocx(dvr: Dvr): Promise<Blob> {
  const pl = dvr.payload;

  const cover: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DOCUMENTO DI VALUTAZIONE DEI RISCHI', bold: true, size: 44, color: VIOLA_BRAND })],
      spacing: { before: 2400, after: 240 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: pl.sezione_a.ragione_sociale, bold: true, size: 36 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'D.Lgs. 9 aprile 2008, n. 81 · Art. 17, 28, 29', italics: true, color: '6B7280', size: 22 })],
      spacing: { after: 720 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DISCLAIMER AI', bold: true, size: 22, color: VIOLA_BRAND })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: dvr.ai_disclaimer_text, italics: true, size: 18, color: '4C3C8E' })],
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: VIOLA_BRAND }, bottom: { style: BorderStyle.SINGLE, size: 12, color: VIOLA_BRAND } },
      spacing: { after: 720, before: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Versione ${dvr.versione} · ${new Date(dvr.data_creazione).toLocaleDateString('it-IT')} · Hash ${dvr.content_hash?.slice(0, 16)}…`, size: 18, color: '6B7280' })],
    }),
  ];

  const body: Array<Paragraph | Table> = [];

  // Sezione A
  body.push(sectionHeading(SECTION_TITLES[0][0]));
  body.push(
    tabellaKV([
      ['Ragione sociale', pl.sezione_a.ragione_sociale],
      ['P. IVA', pl.sezione_a.partita_iva],
      ['ATECO', pl.sezione_a.ateco],
      ['Sede legale', pl.sezione_a.sede_legale],
      ['Lavoratori totali', String(pl.sezione_a.lavoratori_totali)],
      ['Dimensione', pl.sezione_a.dimensione],
      ['Data redazione', pl.sezione_a.data_redazione],
    ])
  );

  // Sezione B
  body.push(sectionHeading(SECTION_TITLES[1][0]));
  body.push(
    tabellaKV([
      ['Datore di lavoro', pl.sezione_b.datore_lavoro],
      ['RSPP', pl.sezione_b.rspp],
      ['Medico Competente', pl.sezione_b.medico_competente ?? '—'],
      ['RLS / RLST', pl.sezione_b.rls ?? '—'],
      ['Addetti Primo Soccorso', pl.sezione_b.addetti_pronto_soccorso ?? '—'],
      ['Addetti Antincendio', pl.sezione_b.addetti_antincendio ?? '—'],
    ])
  );

  // Sezione C
  body.push(sectionHeading(SECTION_TITLES[2][0]));
  body.push(p('Descrizione attività', { bold: true, size: 22 }));
  body.push(p(pl.sezione_c.descrizione_attivita || '—', { size: 20 }));
  body.push(p('Reparti / aree di lavoro', { bold: true, size: 22, spaceAfter: 80 }));
  body.push(...listParagraphs(pl.sezione_c.reparti));
  body.push(p('Fasi lavorative', { bold: true, size: 22, spaceAfter: 80 }));
  body.push(...listParagraphs(pl.sezione_c.fasi_lavorative));
  body.push(p('Attrezzature principali', { bold: true, size: 22, spaceAfter: 80 }));
  body.push(...listParagraphs(pl.sezione_c.attrezzature_principali));

  // Sezione D
  body.push(sectionHeading(SECTION_TITLES[3][0]));
  body.push(p('Pericoli identificati ai sensi del D.Lgs. 81/08:', { size: 20 }));
  body.push(...listParagraphs(pl.sezione_d.pericoli_identificati));

  // Sezione E (matrice colorata)
  body.push(sectionHeading(SECTION_TITLES[4][0]));
  body.push(p('Metodo P × G (4×4): R = P × G. Livello = basso (R 1-2) / medio (3-4) / alto (6-9) / molto alto (12-16).', { size: 18, italic: true }));
  body.push(p(' ', {}));
  body.push(tabellaRischi(pl.sezione_e.matrice_rischi));

  // Sezione F
  body.push(sectionHeading(SECTION_TITLES[5][0]));
  body.push(p('Misure tecniche', { bold: true, size: 22 }));
  body.push(p(pl.sezione_f.misure_tecniche || '—', { size: 20 }));
  body.push(p('Misure organizzative', { bold: true, size: 22 }));
  body.push(p(pl.sezione_f.misure_organizzative || '—', { size: 20 }));
  body.push(p('DPI assegnati', { bold: true, size: 22 }));
  body.push(p(pl.sezione_f.dpi_assegnati || '—', { size: 20 }));
  body.push(p('Formazione erogata', { bold: true, size: 22 }));
  body.push(p(pl.sezione_f.formazione || '—', { size: 20 }));

  // Sezione G
  body.push(sectionHeading(SECTION_TITLES[6][0]));
  body.push(p(pl.sezione_g.interventi_pianificati.length === 0 ? 'Nessun intervento pianificato.' : `${pl.sezione_g.interventi_pianificati.length} interventi pianificati.`, { size: 20 }));

  // Sezione H
  body.push(sectionHeading(SECTION_TITLES[7][0]));
  if (pl.sezione_h?.rumore) body.push(p(`Rumore (UNI 9612): ${pl.sezione_h.rumore}`, { size: 20 }));
  if (pl.sezione_h?.mmc) body.push(p(`MMC (NIOSH/Snook-Ciriello): ${pl.sezione_h.mmc}`, { size: 20 }));
  if (pl.sezione_h?.vibrazioni) body.push(p(`Vibrazioni HAV/WBV: ${pl.sezione_h.vibrazioni}`, { size: 20 }));
  if (pl.sezione_h?.chimico) body.push(p(`Chimico (MoVaRisCh): ${pl.sezione_h.chimico}`, { size: 20 }));
  if (!pl.sezione_h || Object.values(pl.sezione_h).every((v) => !v)) {
    body.push(p('Nessuna valutazione specifica applicabile a questa attività.', { italic: true, color: '9CA3AF', size: 18 }));
  }

  // Sezione I
  body.push(sectionHeading(SECTION_TITLES[8][0]));
  body.push(...listParagraphs(pl.sezione_i.allegati));

  // ===== ALLEGATO 1: Schede dettaglio rischi valutati =====
  // Per ogni rischio della matrice, una scheda completa (~1 pagina) con
  // descrizione, effetti salute, misure (gerarchia art. 15), DPI con norma EN,
  // formazione, sorveglianza sanitaria, riferimento normativo, estratto.
  body.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'ALLEGATO 1 · Schede di dettaglio dei rischi valutati', bold: true, size: 32, color: VIOLA_BRAND })],
      spacing: { before: 360, after: 240 },
      pageBreakBefore: true,
    })
  );
  // Mappa id rischio → categoria del catalogo standard (per linkare la scheda)
  const idToCategoria = new Map(RISCHI_TIPICI.map((r) => [r.categoria, r.id]));
  for (const r of pl.sezione_e.matrice_rischi) {
    const id = idToCategoria.get(r.pericolo);
    const scheda = id ? SCHEDE_RISCHIO[id] : undefined;
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Scheda · ${r.pericolo}`, bold: true, size: 26, color: '4C3C8E' })],
        spacing: { before: 360, after: 120 },
        pageBreakBefore: true,
      })
    );
    body.push(p(`Probabilita': ${r.probabilita} · Gravita': ${r.gravita} · R = ${r.probabilita * r.gravita} · Livello: ${r.livello.replace('_', ' ').toUpperCase()}`, { bold: true, size: 22, color: RISK_COLORS_HEX[r.livello] }));
    if (scheda) {
      body.push(p('Descrizione del rischio', { bold: true, size: 22 }));
      body.push(p(scheda.descrizione_rischio, { size: 20 }));
      body.push(p('Effetti sulla salute', { bold: true, size: 22 }));
      body.push(p(scheda.effetti_salute, { size: 20 }));
      body.push(p('Misure di prevenzione (gerarchia art. 15 D.Lgs. 81/08)', { bold: true, size: 22 }));
      if (scheda.misure_eliminazione.length) {
        body.push(p('1) Eliminazione del rischio alla fonte:', { bold: true, size: 20 }));
        body.push(...listParagraphs(scheda.misure_eliminazione));
      }
      if (scheda.misure_sostituzione.length) {
        body.push(p('2) Sostituzione con elementi meno pericolosi:', { bold: true, size: 20 }));
        body.push(...listParagraphs(scheda.misure_sostituzione));
      }
      if (scheda.misure_collettive.length) {
        body.push(p('3) Misure di protezione collettiva:', { bold: true, size: 20 }));
        body.push(...listParagraphs(scheda.misure_collettive));
      }
      if (scheda.dpi.length) {
        body.push(p('4) DPI individuali (ultima ratio):', { bold: true, size: 20 }));
        body.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Tipo DPI', { bold: true, color: 'FFFFFF', size: 18 })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Norma EN', { bold: true, color: 'FFFFFF', size: 18 })] }),
                ],
              }),
              ...scheda.dpi.map(
                (d) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [p(d.tipo, { size: 18 })] }),
                      new TableCell({ children: [p(d.norma_en, { size: 18, italic: true })] }),
                    ],
                  })
              ),
            ],
          })
        );
      }
      body.push(p('Formazione richiesta', { bold: true, size: 22 }));
      body.push(p(scheda.formazione, { size: 20 }));
      body.push(p('Sorveglianza sanitaria', { bold: true, size: 22 }));
      body.push(p(scheda.sorveglianza_sanitaria, { size: 20 }));
      body.push(p('Riferimento normativo', { bold: true, size: 22 }));
      body.push(p(scheda.riferimento_normativo, { size: 20, italic: true }));
      body.push(p('Estratto della norma', { bold: true, size: 22 }));
      body.push(p(scheda.estratto_norma, { size: 18, italic: true, color: '4C3C8E' }));
    } else {
      body.push(p(r.fonte_norma ?? 'Riferimento normativo non specificato', { size: 20, italic: true }));
      body.push(p('(Scheda di dettaglio non disponibile per questo rischio nel catalogo standard. Da personalizzare a cura del consulente RSPP.)', { size: 18, italic: true, color: '9CA3AF' }));
    }
  }

  // ===== ALLEGATO 2: Quadro normativo di riferimento =====
  body.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'ALLEGATO 2 · Quadro normativo di riferimento', bold: true, size: 32, color: VIOLA_BRAND })],
      spacing: { before: 360, after: 240 },
      pageBreakBefore: true,
    })
  );
  body.push(p('Riferimenti citati nel presente DVR e norme tecniche correlate.', { size: 20, italic: true }));
  body.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Norma', { bold: true, color: 'FFFFFF', size: 18 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Titolo / Oggetto', { bold: true, color: 'FFFFFF', size: 18 })] }),
          ],
        }),
        ...ALLEGATO_NORMATIVO.map(
          (n) =>
            new TableRow({
              children: [
                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [p(n.norma, { bold: true, size: 18 })] }),
                new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [p(n.titolo, { size: 18 })] }),
              ],
            })
        ),
      ],
    })
  );

  // ===== ALLEGATO 3: Schema formazione lavoratori =====
  body.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'ALLEGATO 3 · Schema formazione (Accordo Stato-Regioni 21/12/2011)', bold: true, size: 32, color: VIOLA_BRAND })],
      spacing: { before: 360, after: 240 },
      pageBreakBefore: true,
    })
  );
  body.push(p('Corsi obbligatori per mansione e periodicita\' di aggiornamento.', { size: 20, italic: true }));
  body.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Corso', { bold: true, color: 'FFFFFF', size: 16 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Durata', { bold: true, color: 'FFFFFF', size: 16 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Destinatari', { bold: true, color: 'FFFFFF', size: 16 })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: VIOLA_BRAND }, children: [p('Aggiornamento', { bold: true, color: 'FFFFFF', size: 16 })] }),
          ],
        }),
        ...SCHEMA_FORMAZIONE.map(
          (c) =>
            new TableRow({
              children: [
                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [p(c.corso, { bold: true, size: 16 })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [p(c.durata, { size: 16 })] }),
                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [p(c.destinatari, { size: 16 })] }),
                new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [p(c.aggiornamento, { size: 16 })] }),
              ],
            })
        ),
      ],
    })
  );

  // Disclaimer finale
  body.push(
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Sottoscrizione', bold: true, size: 32, color: VIOLA_BRAND })],
      spacing: { before: 360, after: 240 },
    })
  );
  body.push(p('Il presente Documento di Valutazione dei Rischi e\' stato redatto e sottoscritto dalle figure competenti ai sensi del D.Lgs. 81/08 art. 28 c.2.', { size: 20 }));
  body.push(p(' '));
  body.push(p('Datore di Lavoro: ' + pl.sezione_b.datore_lavoro, { bold: true, size: 22 }));
  body.push(p('Firma e data: _______________________________________', { size: 20 }));
  body.push(p(' '));
  body.push(p('RSPP: ' + pl.sezione_b.rspp, { bold: true, size: 22 }));
  body.push(p('Firma e data: _______________________________________', { size: 20 }));
  body.push(p(' '));
  if (pl.sezione_b.medico_competente) {
    body.push(p('Medico Competente: ' + pl.sezione_b.medico_competente, { bold: true, size: 22 }));
    body.push(p('Firma e data: _______________________________________', { size: 20 }));
    body.push(p(' '));
  }
  if (pl.sezione_b.rls) {
    body.push(p('RLS / RLST: ' + pl.sezione_b.rls, { bold: true, size: 22 }));
    body.push(p('Firma e data: _______________________________________', { size: 20 }));
  }

  // Footer disclaimer (pag. n di N)
  const footerDisclaimer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Documento generato con assistenza AI · verifica RSPP qualificato richiesta · D.Lgs. 81/08 ', italics: true, color: '6B7280', size: 14 }),
          new TextRun({ children: ['Pag. ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 14, color: '6B7280' }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: 'Piattaforma DVR · Conflavoro PMI',
    title: `DVR ${pl.sezione_a.ragione_sociale} v${dvr.versione}`,
    description: `Documento di Valutazione dei Rischi (D.Lgs. 81/08) · versione ${dvr.versione}`,
    styles: { default: { document: { run: { font: 'Helvetica', size: 22 } } } },
    sections: [
      { properties: { page: { margin: { top: 1440, bottom: 1440, left: 1134, right: 1134 } } }, footers: { default: footerDisclaimer }, children: [...cover, ...body] },
    ],
  });

  return await Packer.toBlob(doc);
}

// ============================================================
// PDF GENERATION
// ============================================================

export function generatePdf(dvr: Dvr): Blob {
  const pl = dvr.payload;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 20; // margin

  let y = 60;

  // ----- Cover -----
  doc.setTextColor(...VIOLA_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DOCUMENTO DI VALUTAZIONE', W / 2, y, { align: 'center' });
  doc.text('DEI RISCHI', W / 2, y + 8, { align: 'center' });
  y += 24;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(pl.sezione_a.ragione_sociale, W / 2, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('D.Lgs. 9 aprile 2008, n. 81 · Art. 17, 28, 29', W / 2, y, { align: 'center' });
  y += 30;

  // Disclaimer box
  doc.setDrawColor(...VIOLA_RGB);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, W - 2 * M, 38, 3, 3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...VIOLA_RGB);
  doc.setFontSize(10);
  doc.text('DISCLAIMER AI', W / 2, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...VIOLA_DARK_RGB);
  const disclaimerLines = doc.splitTextToSize(dvr.ai_disclaimer_text, W - 2 * M - 10);
  doc.text(disclaimerLines, W / 2, y + 14, { align: 'center' });
  y += 50;

  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Versione ${dvr.versione} · ${new Date(dvr.data_creazione).toLocaleDateString('it-IT')}`, W / 2, y, { align: 'center' });
  if (dvr.content_hash) {
    doc.text(`Hash SHA-256: ${dvr.content_hash.slice(0, 16)}…`, W / 2, y + 5, { align: 'center' });
  }

  // ----- Helper sezioni -----
  function newSection(title: string) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...VIOLA_DARK_RGB);
    doc.text(title, M, 20);
    doc.setDrawColor(...VIOLA_RGB);
    doc.line(M, 23, W - M, 23);
    doc.setTextColor(0, 0, 0);
  }

  function kvList(rows: Array<[string, string]>) {
    autoTable(doc, {
      startY: 30,
      head: [],
      body: rows.map(([k, v]) => [k, v || '—']),
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [243, 236, 254], cellWidth: 60 }, 1: {} },
      theme: 'grid',
    });
  }

  function bulletList(yStart: number, items: string[]): number {
    let curY = yStart;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (items.length === 0) {
      doc.setTextColor(156, 163, 175);
      doc.text('—', M, curY);
      doc.setTextColor(0, 0, 0);
      return curY + 6;
    }
    for (const item of items) {
      const lines = doc.splitTextToSize('• ' + item, W - 2 * M);
      doc.text(lines, M, curY);
      curY += lines.length * 5 + 1;
      if (curY > H - 25) {
        doc.addPage();
        curY = 20;
      }
    }
    return curY;
  }

  // ----- Sezione A -----
  newSection(SECTION_TITLES[0][0]);
  kvList([
    ['Ragione sociale', pl.sezione_a.ragione_sociale],
    ['P. IVA', pl.sezione_a.partita_iva],
    ['ATECO', pl.sezione_a.ateco],
    ['Sede legale', pl.sezione_a.sede_legale],
    ['Lavoratori totali', String(pl.sezione_a.lavoratori_totali)],
    ['Dimensione', pl.sezione_a.dimensione],
    ['Data redazione', pl.sezione_a.data_redazione],
  ]);

  // ----- Sezione B -----
  newSection(SECTION_TITLES[1][0]);
  kvList([
    ['Datore di lavoro', pl.sezione_b.datore_lavoro],
    ['RSPP', pl.sezione_b.rspp],
    ['Medico Competente', pl.sezione_b.medico_competente ?? '—'],
    ['RLS / RLST', pl.sezione_b.rls ?? '—'],
    ['Addetti Primo Soccorso', pl.sezione_b.addetti_pronto_soccorso ?? '—'],
    ['Addetti Antincendio', pl.sezione_b.addetti_antincendio ?? '—'],
  ]);

  // ----- Sezione C -----
  newSection(SECTION_TITLES[2][0]);
  let curY = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Descrizione attività', M, curY);
  curY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(pl.sezione_c.descrizione_attivita || '—', W - 2 * M);
  doc.text(descLines, M, curY);
  curY += descLines.length * 5 + 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Reparti / aree', M, curY);
  curY += 5;
  curY = bulletList(curY, pl.sezione_c.reparti);
  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Fasi lavorative', M, curY);
  curY += 5;
  curY = bulletList(curY, pl.sezione_c.fasi_lavorative);
  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Attrezzature principali', M, curY);
  curY += 5;
  bulletList(curY, pl.sezione_c.attrezzature_principali);

  // ----- Sezione D -----
  newSection(SECTION_TITLES[3][0]);
  bulletList(30, pl.sezione_d.pericoli_identificati);

  // ----- Sezione E (matrice colorata) -----
  newSection(SECTION_TITLES[4][0]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(107, 114, 128);
  doc.text('Metodo P × G (4×4): R = P × G. Livello = basso (R 1-2) · medio (3-4) · alto (6-9) · molto alto (12-16).', M, 30);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 36,
    head: [['Pericolo', 'Norma', 'P', 'G', 'R', 'Livello']],
    body: pl.sezione_e.matrice_rischi.map((r) => [
      r.pericolo,
      r.fonte_norma ?? '',
      String(r.probabilita),
      String(r.gravita),
      String(r.probabilita * r.gravita),
      r.livello.replace('_', ' '),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: VIOLA_RGB, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50, fontStyle: 'italic', fontSize: 8 },
      2: { halign: 'center', cellWidth: 10 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { fontStyle: 'bold', cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const livello = pl.sezione_e.matrice_rischi[data.row.index].livello;
        data.cell.styles.fillColor = RISK_COLORS_RGB[livello];
      }
    },
  });

  // ----- Sezione F -----
  newSection(SECTION_TITLES[5][0]);
  kvList([
    ['Misure tecniche', pl.sezione_f.misure_tecniche || '—'],
    ['Misure organizzative', pl.sezione_f.misure_organizzative || '—'],
    ['DPI assegnati', pl.sezione_f.dpi_assegnati || '—'],
    ['Formazione', pl.sezione_f.formazione || '—'],
  ]);

  // ----- Sezione G -----
  newSection(SECTION_TITLES[6][0]);
  doc.setFontSize(10);
  doc.text(
    pl.sezione_g.interventi_pianificati.length === 0
      ? 'Nessun intervento pianificato.'
      : `${pl.sezione_g.interventi_pianificati.length} interventi pianificati (vedi cronoprogramma).`,
    M,
    30
  );

  // ----- Sezione H -----
  newSection(SECTION_TITLES[7][0]);
  const hRows: Array<[string, string]> = [];
  if (pl.sezione_h?.rumore) hRows.push(['Rumore (UNI 9612)', pl.sezione_h.rumore]);
  if (pl.sezione_h?.mmc) hRows.push(['MMC (NIOSH)', pl.sezione_h.mmc]);
  if (pl.sezione_h?.vibrazioni) hRows.push(['Vibrazioni', pl.sezione_h.vibrazioni]);
  if (pl.sezione_h?.chimico) hRows.push(['Chimico (MoVaRisCh)', pl.sezione_h.chimico]);
  if (hRows.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(156, 163, 175);
    doc.text('Nessuna valutazione specifica applicabile.', M, 30);
  } else {
    kvList(hRows);
  }

  // ----- Sezione I -----
  newSection(SECTION_TITLES[8][0]);
  bulletList(30, pl.sezione_i.allegati);

  // ===== ALLEGATO 1: Schede dettaglio rischi (1+ pagina per ogni rischio valutato) =====
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...VIOLA_DARK_RGB);
  doc.text('ALLEGATO 1', M, 25);
  doc.setFontSize(13);
  doc.text('Schede di dettaglio dei rischi valutati', M, 33);
  doc.setDrawColor(...VIOLA_RGB);
  doc.line(M, 36, W - M, 36);
  doc.setTextColor(0, 0, 0);

  const idToCategoria = new Map(RISCHI_TIPICI.map((r) => [r.categoria, r.id]));
  for (const r of pl.sezione_e.matrice_rischi) {
    const id = idToCategoria.get(r.pericolo);
    const scheda = id ? SCHEDE_RISCHIO[id] : undefined;
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...VIOLA_DARK_RGB);
    doc.text(`Scheda · ${r.pericolo}`, M, 22);
    doc.setDrawColor(...VIOLA_RGB);
    doc.line(M, 25, W - M, 25);

    // Banner livello rischio colorato
    const [bgR, bgG, bgB] = RISK_COLORS_RGB[r.livello];
    doc.setFillColor(bgR, bgG, bgB);
    doc.roundedRect(M, 28, W - 2 * M, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `P=${r.probabilita} · G=${r.gravita} · R=${r.probabilita * r.gravita} · Livello: ${r.livello.replace('_', ' ').toUpperCase()}`,
      W / 2,
      34,
      { align: 'center' }
    );

    let cy = 45;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    if (scheda) {
      const sec = (label: string, txt: string, color?: [number, number, number]) => {
        if (cy > H - 30) { doc.addPage(); cy = 25; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...VIOLA_DARK_RGB);
        doc.text(label, M, cy);
        cy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(color?.[0] ?? 0, color?.[1] ?? 0, color?.[2] ?? 0);
        const lines = doc.splitTextToSize(txt, W - 2 * M);
        doc.text(lines, M, cy);
        cy += lines.length * 4 + 4;
      };
      const secList = (label: string, items: string[]) => {
        if (items.length === 0) return;
        if (cy > H - 30) { doc.addPage(); cy = 25; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...VIOLA_DARK_RGB);
        doc.text(label, M, cy);
        cy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        for (const it of items) {
          if (cy > H - 25) { doc.addPage(); cy = 25; }
          const lines = doc.splitTextToSize(`• ${it}`, W - 2 * M - 4);
          doc.text(lines, M + 2, cy);
          cy += lines.length * 4 + 1;
        }
        cy += 3;
      };

      sec('Descrizione del rischio', scheda.descrizione_rischio);
      sec('Effetti sulla salute', scheda.effetti_salute);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...VIOLA_DARK_RGB);
      if (cy > H - 30) { doc.addPage(); cy = 25; }
      doc.text('Misure di prevenzione (gerarchia art. 15 D.Lgs. 81/08)', M, cy);
      cy += 5;
      secList('1) Eliminazione del rischio alla fonte', scheda.misure_eliminazione);
      secList('2) Sostituzione con elementi meno pericolosi', scheda.misure_sostituzione);
      secList('3) Misure di protezione collettiva', scheda.misure_collettive);
      // DPI come tabella
      if (scheda.dpi.length > 0) {
        if (cy > H - 50) { doc.addPage(); cy = 25; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...VIOLA_DARK_RGB);
        doc.text('4) DPI individuali (ultima ratio)', M, cy);
        cy += 4;
        autoTable(doc, {
          startY: cy,
          head: [['Tipo DPI', 'Norma EN']],
          body: scheda.dpi.map((d) => [d.tipo, d.norma_en]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: VIOLA_RGB, textColor: 255 },
          margin: { left: M, right: M },
        });
        cy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      }
      sec('Formazione richiesta', scheda.formazione);
      sec('Sorveglianza sanitaria', scheda.sorveglianza_sanitaria);
      sec('Riferimento normativo', scheda.riferimento_normativo);
      sec('Estratto della norma', scheda.estratto_norma, VIOLA_DARK_RGB);
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(r.fonte_norma ?? 'Riferimento normativo non specificato', M, cy);
      cy += 6;
      doc.text('(Scheda di dettaglio non disponibile per questo rischio nel catalogo standard. Da personalizzare a cura del consulente RSPP.)', M, cy);
    }
  }

  // ===== ALLEGATO 2: Quadro normativo =====
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...VIOLA_DARK_RGB);
  doc.text('ALLEGATO 2', M, 25);
  doc.setFontSize(13);
  doc.text('Quadro normativo di riferimento', M, 33);
  doc.setDrawColor(...VIOLA_RGB);
  doc.line(M, 36, W - M, 36);
  autoTable(doc, {
    startY: 42,
    head: [['Norma', 'Titolo / Oggetto']],
    body: ALLEGATO_NORMATIVO.map((n) => [n.norma, n.titolo]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: VIOLA_RGB, textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: {} },
    margin: { left: M, right: M },
  });

  // ===== ALLEGATO 3: Schema formazione =====
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...VIOLA_DARK_RGB);
  doc.text('ALLEGATO 3', M, 25);
  doc.setFontSize(13);
  doc.text('Schema formazione (Accordo Stato-Regioni 21/12/2011)', M, 33);
  doc.setDrawColor(...VIOLA_RGB);
  doc.line(M, 36, W - M, 36);
  autoTable(doc, {
    startY: 42,
    head: [['Corso', 'Durata', 'Destinatari', 'Aggiornamento']],
    body: SCHEMA_FORMAZIONE.map((c) => [c.corso, c.durata, c.destinatari, c.aggiornamento]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: VIOLA_RGB, textColor: 255 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 25 },
      2: { cellWidth: 60 },
      3: { cellWidth: 35 },
    },
    margin: { left: M, right: M },
  });

  // ===== Sottoscrizione finale =====
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...VIOLA_DARK_RGB);
  doc.text('Sottoscrizione', M, 25);
  doc.setDrawColor(...VIOLA_RGB);
  doc.line(M, 28, W - M, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const sottoscrTxt = doc.splitTextToSize(
    'Il presente Documento di Valutazione dei Rischi è stato redatto e sottoscritto dalle figure competenti ai sensi del D.Lgs. 81/08 art. 28 c.2.',
    W - 2 * M
  );
  doc.text(sottoscrTxt, M, 38);

  let sy = 60;
  const firma = (label: string, name: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${label}: ${name}`, M, sy);
    sy += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Firma e data: __________________________________________', M, sy);
    sy += 18;
  };
  firma('Datore di Lavoro', pl.sezione_b.datore_lavoro);
  firma('RSPP', pl.sezione_b.rspp);
  if (pl.sezione_b.medico_competente) firma('Medico Competente', pl.sezione_b.medico_competente);
  if (pl.sezione_b.rls) firma('RLS / RLST', pl.sezione_b.rls);

  // ----- Footer su tutte le pagine (pre-existing pages get this) -----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setDrawColor(229, 231, 235);
    doc.line(M, H - 12, W - M, H - 12);
    doc.text('Documento generato con assistenza AI · verifica RSPP qualificato richiesta · D.Lgs. 81/08', W / 2, H - 8, { align: 'center' });
    doc.text(`Pag. ${i} / ${totalPages}`, W - M, H - 4, { align: 'right' });
  }

  return doc.output('blob');
}

export async function downloadDvr(dvr: Dvr, format: 'docx' | 'pdf'): Promise<void> {
  const filename = dvrFilename(dvr, format);
  if (format === 'docx') {
    const blob = await generateDocx(dvr);
    saveAs(blob, filename);
  } else {
    const blob = generatePdf(dvr);
    saveAs(blob, filename);
  }
}

function dvrFilename(dvr: Dvr, format: 'docx' | 'pdf'): string {
  const slug = dvr.azienda.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `dvr-${slug}-v${dvr.versione}.${format}`;
}

/**
 * Scarica il file REALE generato dal backend AI da un URL protetto da JWT.
 * Esegue una fetch con Authorization, crea un blob URL e lo salva col nome del DVR.
 * Lancia in caso di errore: il chiamante decide se fare fallback al generatore client-side.
 */
export async function downloadDvrFromUrl(
  dvr: Dvr,
  format: 'docx' | 'pdf',
  url: string,
  token: string | null
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetchConTempo(url, { headers });
  if (!res.ok) {
    throw new Error(`Download non riuscito (${res.status})`);
  }
  const blob = await res.blob();
  saveAs(blob, dvrFilename(dvr, format));
}
