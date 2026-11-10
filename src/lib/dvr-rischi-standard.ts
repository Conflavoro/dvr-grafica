// Catalogo rischi tipici D.Lgs. 81/08 (per popolare la matrice E del wizard).
// Selezionabili dall'utente, ognuno con citazione normativa.

export interface RischioTipico {
  id: string;
  categoria: string;
  fonte_norma: string;
  /** P × G consigliati come default; l'utente può modificarli. */
  p_default: 1 | 2 | 3 | 4;
  g_default: 1 | 2 | 3 | 4;
}

export const RISCHI_TIPICI: RischioTipico[] = [
  { id: 'rumore', categoria: 'Rumore (Tit. VIII Capo II)', fonte_norma: 'D.Lgs. 81/08 art. 187-198 · UNI EN ISO 9612', p_default: 3, g_default: 2 },
  { id: 'mmc', categoria: 'Movimentazione manuale carichi', fonte_norma: 'D.Lgs. 81/08 Tit. VI · NIOSH / Snook-Ciriello', p_default: 3, g_default: 3 },
  { id: 'caduta-alto', categoria: "Caduta dall'alto", fonte_norma: 'D.Lgs. 81/08 art. 111-115 · UNI EN 363', p_default: 2, g_default: 4 },
  { id: 'elettrico', categoria: 'Rischio elettrico', fonte_norma: 'D.Lgs. 81/08 Tit. III Capo III · CEI 64-8', p_default: 2, g_default: 4 },
  { id: 'chimico', categoria: 'Agenti chimici (Tit. IX Capo I)', fonte_norma: 'MoVaRisCh / AlPiRisCh · REACH+CLP', p_default: 2, g_default: 2 },
  { id: 'incendio', categoria: 'Rischio incendio', fonte_norma: 'DM 03/09/2021 · UNI 9994 / 10779', p_default: 1, g_default: 3 },
  { id: 'biologico', categoria: 'Agenti biologici (Tit. X)', fonte_norma: 'D.Lgs. 81/08 art. 266-286', p_default: 1, g_default: 2 },
  { id: 'stress', categoria: 'Stress lavoro-correlato', fonte_norma: 'Art. 28 c.1-bis · INAIL check-list 2017', p_default: 2, g_default: 2 },
  { id: 'vibrazioni', categoria: 'Vibrazioni HAV/WBV', fonte_norma: 'D.Lgs. 81/08 Tit. VIII Capo III · UNI EN ISO 5349 / 2631', p_default: 2, g_default: 3 },
  { id: 'vdt', categoria: 'Videoterminali', fonte_norma: 'D.Lgs. 81/08 Tit. VII art. 172-179', p_default: 3, g_default: 1 },
  { id: 'investimento', categoria: 'Investimento mezzi (cantieri)', fonte_norma: 'D.Lgs. 81/08 Tit. IV', p_default: 2, g_default: 4 },
  { id: 'caduta-materiali', categoria: "Caduta materiali dall'alto", fonte_norma: 'D.Lgs. 81/08 Tit. IV', p_default: 3, g_default: 3 },
  { id: 'polveri', categoria: 'Polveri (silice, legno, metalli)', fonte_norma: 'D.Lgs. 81/08 Tit. IX Cap. II', p_default: 2, g_default: 3 },
  { id: 'temperatura', categoria: 'Microclima estremo (caldo/freddo)', fonte_norma: 'UNI EN ISO 7730 / 27243', p_default: 2, g_default: 2 },
  { id: 'atex', categoria: 'Atmosfere esplosive (ATEX)', fonte_norma: 'D.Lgs. 81/08 Tit. XI', p_default: 1, g_default: 4 },
];

export const PERICOLI_DLGS_81 = [
  'Luoghi di lavoro (Tit. II · Allegato IV)',
  'Attrezzature di lavoro (Tit. III)',
  'Rischio elettrico (Tit. III Capo III)',
  'Rischio incendio (DM 03/09/2021)',
  'Rischio chimico (Tit. IX Capo I)',
  'Rischio biologico (Tit. X)',
  'Rumore (Tit. VIII Capo II · UNI 9612)',
  'Vibrazioni HAV/WBV (Tit. VIII Capo III)',
  'Movimentazione manuale carichi (Tit. VI)',
  'Videoterminali (Tit. VII)',
  'Stress lavoro-correlato (art. 28 c.1-bis)',
  'Lavoratrici madri (D.Lgs. 151/2001)',
  'Lavoratori minori (D.Lgs. 345/1999)',
  "Caduta dall'alto (Tit. IV)",
  'ATEX, atmosfere esplosive (Tit. XI)',
  'Radon (D.Lgs. 101/2020)',
  'Cancerogeno/mutageno (Tit. IX Cap. II)',
  'Amianto (Tit. IX Cap. III)',
];
