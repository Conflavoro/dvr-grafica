// Coda dei file della chat: controlli d'ingresso, riassunto per l'agente.

import { MAX_FILE_PER_VOLTA, pesoLeggibile, preparaCaricamenti, riassuntoPerAgente, trascinaFile, type VoceCaricamento } from './caricamenti';

const MB = 1024 * 1024;
const finto = (name: string, size: number, type = ''): File => ({ name, size, type }) as unknown as File;

test('ogni tipo accettato dal server entra in coda, anche senza MIME (HEIC, MSG, P7M, DXF)', () => {
  const voci = preparaCaricamenti([
    finto('verbale.pdf', 2 * MB, 'application/pdf'),
    finto('IMG_0001.HEIC', 3 * MB),
    finto('mail.msg', 1 * MB),
    finto('visura.pdf.p7m', 1 * MB),
    finto('pianta.dxf', 4 * MB),
    finto('presenze.xlsx', MB),
    finto('corso.pptx', MB),
    finto('nota.m4a', MB, 'audio/mp4'),
    finto('archivio.zip', 10 * MB),
  ]);
  expect(voci.every((v) => v.stato === 'in_coda')).toBe(true);
  expect(voci.map((v) => v.tipo)).toEqual(['documento', 'foto', 'documento', 'documento', 'documento', 'documento', 'documento', 'audio', 'documento']);
});

test('errore chiaro per riga: estensione non accettata, oltre 24 MB, troppi file', () => {
  const voci = preparaCaricamenti([finto('installer.exe', MB), finto('scansione.pdf', 40 * MB, 'application/pdf'), finto('video.mp4', 300 * MB, 'video/mp4')]);
  expect(voci[0]).toMatchObject({ stato: 'errore', definitivo: true });
  expect(voci[0].errore).toContain('.exe');
  expect(voci[1].errore).toContain('24 MB');
  // i video grandi passano: fotogrammi e audio dal browser
  expect(voci[2].stato).toBe('in_coda');
  const tanti = preparaCaricamenti(Array.from({ length: MAX_FILE_PER_VOLTA + 2 }, (_, i) => finto(`f${i}.pdf`, MB)));
  expect(tanti.filter((v) => v.stato === 'errore')).toHaveLength(2);
  for (const v of [...voci, ...tanti]) if (v.errore) expect(/[–—]/.test(v.errore)).toBe(false);
});

const fatto = (nome: string, analisi = '', analisiErrore: string | null = null, tipo: VoceCaricamento['tipo'] = 'documento'): VoceCaricamento => ({
  ...preparaCaricamenti([finto(nome, MB)])[0],
  tipo,
  stato: 'fatto',
  analisi,
  analisiErrore,
});

test('riassunto per un file: la frase di sempre', () => {
  expect(riassuntoPerAgente([fatto('IMG_1.jpg', 'Scaffalatura senza ancoraggio.', null, 'foto')], '')).toBe('Ho caricato una foto di sopralluogo: IMG_1.jpg. Analisi: Scaffalatura senza ancoraggio.');
  expect(riassuntoPerAgente([fatto('nomina.pdf', '', 'documento cifrato')], ' per Officina Esempio Srl')).toBe(
    "Ho caricato un documento per Officina Esempio Srl: nomina.pdf. L'analisi automatica non è riuscita: documento cifrato."
  );
});

test('riassunto per più file: elenco numerato, non caricati in coda, entro il limite', () => {
  const lunga = 'x'.repeat(5000);
  const errore = { ...preparaCaricamenti([finto('rotto.exe', MB)])[0] };
  const msg = riassuntoPerAgente([fatto('a.pdf', lunga), fatto('b.docx', lunga), fatto('c.jpg', '', null, 'foto'), errore], '')!;
  expect(msg.startsWith('Ho caricato 3 file.')).toBe(true);
  expect(msg).toContain('1. a.pdf. Analisi: ');
  expect(msg).toContain("3. c.jpg. L'analisi è ancora in corso");
  expect(msg).toContain('Non caricati (1): rotto.exe.');
  expect(msg.length).toBeLessThan(7801);
});

test('nessun file arrivato: niente messaggio all’agente', () => {
  expect(riassuntoPerAgente(preparaCaricamenti([finto('a.exe', 1)]), '')).toBeNull();
});

test('peso leggibile e riconoscimento del trascinamento di file', () => {
  expect(pesoLeggibile(820 * 1024)).toBe('820 KB');
  expect(pesoLeggibile(3.4 * MB)).toBe('3,4 MB');
  expect(trascinaFile(['Files'])).toBe(true);
  expect(trascinaFile(['text/plain'])).toBe(false);
  expect(trascinaFile(null)).toBe(false);
});
