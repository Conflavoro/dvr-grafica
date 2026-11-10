/**
 * Demo dal vivo sullo stesso dominio della produzione (dvr.conflavoro.it/demo/):
 * localStorage e sessionStorage sono condivisi per origine, quindi le chiavi della
 * demo prendono un prefisso. Così l'accesso alla demo non tocca mai la sessione
 * della produzione e viceversa. Si installa una volta sola, prima di ogni lettura,
 * correggendo i metodi di Storage: il resto del codice resta identico.
 */

export const PREFISSO_DEMO = 'demo-vera:';

const SEGNO = '__prefissoDemo';

export function chiaveDemo(k: string, prefisso: string = PREFISSO_DEMO): string {
  return k.startsWith(prefisso) ? k : `${prefisso}${k}`;
}

interface ArchivioProto {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  clear(): void;
  readonly length: number;
}

/** Corregge il prototipo di Storage (o di un archivio di prova) perché usi solo chiavi con il prefisso. */
export function installaPrefisso(proto: ArchivioProto, prefisso: string = PREFISSO_DEMO): void {
  const p = proto as ArchivioProto & Record<string, unknown>;
  if (p[SEGNO]) return;
  const leggi = proto.getItem;
  const scrivi = proto.setItem;
  const togli = proto.removeItem;
  const chiave = proto.key;
  let lunghezza: (() => unknown) | undefined;
  for (let o: object | null = proto; o && !lunghezza; o = Object.getPrototypeOf(o)) {
    lunghezza = Object.getOwnPropertyDescriptor(o, 'length')?.get;
  }

  function proprie(s: ArchivioProto): string[] {
    const n = lunghezza ? (lunghezza.call(s) as number) : 0;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = chiave.call(s, i);
      if (k !== null && k.startsWith(prefisso)) out.push(k);
    }
    return out;
  }

  p.getItem = function (this: ArchivioProto, k: string) {
    return leggi.call(this, chiaveDemo(String(k), prefisso));
  };
  p.setItem = function (this: ArchivioProto, k: string, v: string) {
    scrivi.call(this, chiaveDemo(String(k), prefisso), v);
  };
  p.removeItem = function (this: ArchivioProto, k: string) {
    togli.call(this, chiaveDemo(String(k), prefisso));
  };
  p.key = function (this: ArchivioProto, i: number) {
    const k = proprie(this)[i];
    return k === undefined ? null : k.slice(prefisso.length);
  };
  p.clear = function (this: ArchivioProto) {
    for (const k of proprie(this)) togli.call(this, k);
  };
  Object.defineProperty(proto, 'length', {
    configurable: true,
    get(this: ArchivioProto) {
      return proprie(this).length;
    },
  });
  Object.defineProperty(proto, SEGNO, { value: true });
}

/** Nella build della demo dal vivo: prefisso su localStorage e sessionStorage del browser. */
export function installaArchivioDemo(prefisso: string = PREFISSO_DEMO): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return;
  try {
    installaPrefisso(Storage.prototype as unknown as ArchivioProto, prefisso || PREFISSO_DEMO);
  } catch {
    /* archivio del browser non disponibile: niente da separare */
  }
}
