import { renderToStaticMarkup } from 'react-dom/server';
import { preparaCaricamenti, type VoceCaricamento } from '@/lib/caricamenti';
import { CodaCaricamenti } from './CodaCaricamenti';

const finto = (name: string, size: number, type = ''): File => ({ name, size, type }) as unknown as File;
const noop = () => undefined;

test('coda: avanzamento per file, errore definitivo senza Riprova, errore di rete con Riprova', () => {
  const [a, b, c] = preparaCaricamenti([finto('verbale.pdf', 2_000_000, 'application/pdf'), finto('setup.exe', 1000), finto('foto.jpg', 900_000, 'image/jpeg')]);
  const voci: VoceCaricamento[] = [
    { ...a, stato: 'carico', percento: 42, fase: 'invio al server' },
    b,
    { ...c, stato: 'errore', errore: 'Connessione assente o interrotta. Controlla la rete e riprova.', definitivo: false },
  ];
  const h = renderToStaticMarkup(<CodaCaricamenti voci={voci} azienda="Officina Esempio Srl" onRiprova={noop} onRimuovi={noop} onChiudi={noop} />);
  expect(h).toContain('Carico 3 file nell’archivio di Officina Esempio Srl');
  expect(h).toContain('role="progressbar"');
  expect(h).toContain('aria-valuenow="42"');
  expect(h).toContain('width:42%');
  expect(h).toContain('.exe');
  expect((h.match(/>Riprova</g) ?? []).length).toBe(1);
  expect(h).not.toContain('Chiudi l’elenco');
});

test('coda finita: riepilogo e chiusura', () => {
  const [a] = preparaCaricamenti([finto('verbale.pdf', 2_000_000, 'application/pdf')]);
  const h = renderToStaticMarkup(<CodaCaricamenti voci={[{ ...a, stato: 'fatto', fase: 'caricato e analizzato', analisi: 'ok' }]} azienda={null} onRiprova={noop} onRimuovi={noop} onChiudi={noop} />);
  expect(h).toContain('1 di 1 file caricato');
  expect(h).toContain('Chiudi l’elenco dei caricamenti');
  expect(renderToStaticMarkup(<CodaCaricamenti voci={[]} azienda={null} onRiprova={noop} onRimuovi={noop} onChiudi={noop} />)).toBe('');
});

test('coda finita senza problemi: elenco raccolto, si riapre con Mostra i file', () => {
  const [a, b] = preparaCaricamenti([finto('verbale.pdf', 2_000_000, 'application/pdf'), finto('foto.jpg', 900_000, 'image/jpeg')]);
  const h = renderToStaticMarkup(
    <CodaCaricamenti
      voci={[
        { ...a, stato: 'fatto', fase: 'caricato e analizzato', analisi: 'ok' },
        { ...b, stato: 'fatto', fase: 'caricato e analizzato', analisi: 'ok' },
      ]}
      azienda={null}
      onRiprova={noop}
      onRimuovi={noop}
      onChiudi={noop}
    />
  );
  expect(h).toContain('2 di 2 file caricati');
  expect(h).toContain('Mostra i file');
  expect(h).not.toContain('verbale.pdf');
});

test('coda finita con un errore: elenco aperto', () => {
  const [a] = preparaCaricamenti([finto('verbale.pdf', 2_000_000, 'application/pdf')]);
  const h = renderToStaticMarkup(
    <CodaCaricamenti voci={[{ ...a, stato: 'errore', errore: 'Rete assente.', definitivo: false }]} azienda={null} onRiprova={noop} onRimuovi={noop} onChiudi={noop} />
  );
  expect(h).toContain('verbale.pdf');
});
