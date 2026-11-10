import { ACCEPT_ARCHIVIO, controlloCaricamento, tipoDaFile, videoDaAnalizzareNelBrowser } from './ingresso-file';

const f = (name: string, type = '', size = 1000) => ({ name, type, size });

describe('ingresso dei file', () => {
  it('riconosce il tipo dal MIME o, se manca, dal nome', () => {
    expect(tipoDaFile(f('IMG_0001.HEIC'))).toBe('foto');
    expect(tipoDaFile(f('scansione.tif'))).toBe('foto');
    expect(tipoDaFile(f('memo.m4a', 'audio/x-m4a'))).toBe('audio');
    expect(tipoDaFile(f('registrazione.webm', 'audio/webm'))).toBe('audio');
    expect(tipoDaFile(f('sopralluogo.webm', 'video/webm'))).toBe('video');
    expect(tipoDaFile(f('IMG_0002.MOV'))).toBe('video');
    expect(tipoDaFile(f('verbale.doc', 'application/msword'))).toBe('documento');
    expect(tipoDaFile(f('pianta.dxf'))).toBe('documento');
    expect(tipoDaFile(f('materiale.zip', 'application/zip'))).toBe('documento');
  });

  it('blocca prima del caricamento i file troppo grandi, tranne i video', () => {
    expect(controlloCaricamento(f('dvr.pdf', 'application/pdf', 30 * 1048576))).toContain('30 MB');
    expect(controlloCaricamento(f('girato.mp4', 'video/mp4', 300 * 1048576))).toBeNull();
    expect(controlloCaricamento(f('programma.exe', 'application/x-msdownload'))).toContain('non è accettato');
    expect(controlloCaricamento(f('verbale.msg'))).toBeNull();
  });

  it('i video oltre il limite si analizzano nel browser', () => {
    expect(videoDaAnalizzareNelBrowser(f('girato.mp4', 'video/mp4', 300 * 1048576))).toBe(true);
    expect(videoDaAnalizzareNelBrowser(f('breve.mp4', 'video/mp4', 5 * 1048576))).toBe(false);
  });

  it('accetta anche formati che il browser non sa nominare', () => {
    expect(ACCEPT_ARCHIVIO).toContain('.heic');
    expect(ACCEPT_ARCHIVIO).toContain('.msg');
    expect(ACCEPT_ARCHIVIO).toContain('.dxf');
    expect(ACCEPT_ARCHIVIO).not.toContain('—');
  });
});
