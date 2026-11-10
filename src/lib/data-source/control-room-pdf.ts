// PDF del report mensile in modalita' dimostrativa: un foglio semplice
// preparato nel browser (jsPDF, caricato solo al clic). Con il server
// collegato il PDF vero lo prepara il backend.

import type { ReportMensile } from './types';

const ETICHETTE: Record<string, string> = {
  dvr_generati: 'DVR generati',
  dvr_approvati: 'DVR approvati',
  rilievi_sopralluogo: 'Rilievi di sopralluogo',
  documenti_caricati: 'Documenti caricati',
  attestati_registrati: 'Attestati registrati',
  consegne_dpi: 'Consegne DPI',
  ispezioni: 'Ispezioni',
  richieste_assistenza: 'Richieste di assistenza',
};

export async function scaricaReportDemo(r: ReportMensile): Promise<void> {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  const riga = (testo: string, dim = 10, grassetto = false) => {
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal');
    doc.setFontSize(dim);
    for (const r2 of doc.splitTextToSize(testo, 175) as string[]) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(r2, 18, y);
      y += dim * 0.5;
    }
    y += 1.5;
  };
  riga(`Report sicurezza ${r.mese}`, 16, true);
  riga(r.ragione_sociale, 12);
  riga('Versione dimostrativa preparata nel browser.', 9);
  y += 3;
  const ss = r.dati.safety_score;
  riga(`Safety Score: ${ss?.totale ?? 'non calcolabile'}${ss?.totale != null ? ' su 100' : ''}`, 12, true);
  for (const [k, v] of Object.entries(ss?.aree ?? {})) riga(`${k}: ${v ?? 'non applicabile'}`);
  y += 2;
  riga('Attività svolte', 12, true);
  for (const [k, v] of Object.entries(r.dati.attivita)) riga(`${ETICHETTE[k] ?? k}: ${v}`);
  y += 2;
  riga('Criticità aperte', 12, true);
  if (r.dati.criticita_aperte.length === 0) riga('Nessuna criticità aperta.');
  for (const c of r.dati.criticita_aperte.slice(0, 15)) riga(`${c.titolo}. ${c.messaggio}`);
  if (r.osservazioni) {
    y += 2;
    riga('Osservazioni del referente', 12, true);
    riga(r.osservazioni);
    if (r.osservazioni_ai) riga('Testo preparato con assistenza AI e rivisto dal referente.', 8);
  }
  y += 4;
  riga(
    'Documento generato con assistenza AI. La validità è subordinata alla verifica e sottoscrizione da parte delle figure competenti ai sensi del D.Lgs. 81/08.',
    8
  );
  doc.save(`Report_sicurezza_${r.mese}.pdf`);
}
