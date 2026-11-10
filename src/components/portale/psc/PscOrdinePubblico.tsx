'use client';

import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { clsx } from '@/lib/clsx';
import { CerchioSpunta, Invia, Rotore, Scarica } from '@/components/icone';
import { caricaPscOrdinePubblico, controllaFilePscOrdine, type PscOrdinePubblico } from '@/lib/portale/psc-api';

const lunga = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

/** Pagina del coordinatore per la sicurezza: senza account, Stato A da caricare e Stato B inviato (pagine esterne). */
export default function PscOrdinePubblicoVista({ token, o }: { token: string; o: PscOrdinePubblico }) {
  const [stato, setStato] = useState<'a' | 'b'>(o.stato === 'caricato' ? 'b' : 'a');
  const [mio, setMio] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sopra, setSopra] = useState(false);
  const [invio, setInvio] = useState(false);
  const [caricato, setCaricato] = useState<{ nome: string | null; il: string | null }>({ nome: o.file, il: o.caricatoIl });
  const input = useRef<HTMLInputElement>(null);
  const servizio = o.servizio ?? 'POS';
  const scegli = (f: File | null) => {
    setErr(f ? controllaFilePscOrdine(f.name, f.size) : null);
    setFile(f);
  };
  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const c = controllaFilePscOrdine(file.name, file.size);
    if (c) return setErr(c);
    setInvio(true);
    try {
      await caricaPscOrdinePubblico(token, file, nota);
      setCaricato({ nome: file.name, il: new Date().toISOString() });
      setMio(true);
      setStato('b');
      window.scrollTo({ top: 0 });
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Caricamento non riuscito. Riprova.');
    } finally {
      setInvio(false);
    }
  };
  const lascia = (e: DragEvent) => {
    e.preventDefault();
    setSopra(false);
    scegli(e.dataTransfer.files?.[0] ?? null);
  };
  return (
    <main className="space-y-6">
      <p className="text-small text-fg-muted">Portale HSE · ISFOR</p>
      {stato === 'a' ? (
        <>
          <h1 className="text-[32px] font-medium leading-tight text-fg sm:text-h1">Carica il PSC del cantiere</h1>
          <p className="text-body text-fg">
            <strong>{o.azienda}</strong> lavora in questo cantiere e deve preparare il {servizio}. Ci serve il Piano di sicurezza e coordinamento.
          </p>
          <section className="divide-y divide-line rounded-xl bg-surface ring-1 ring-line">
            <h2 className="px-5 py-3 text-title text-fg">Il cantiere</h2>
            {[
              ['Indirizzo', o.indirizzo],
              ['Committente', o.committente],
              ['Lavori', o.inizio && o.fine ? `dal ${lunga(o.inizio)} al ${lunga(o.fine)}` : null],
              ['Impresa esecutrice', o.azienda ? `${o.azienda}${o.piva ? ` · P.IVA ${o.piva}` : ''}` : null],
              ['Lo chiede', o.richiedente],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-5 py-3 text-small">
                  <span className="text-fg-muted">{k}</span>
                  <span className="text-right font-medium text-fg">{v}</span>
                </div>
              ))}
          </section>
          <form onSubmit={(e) => void invia(e)} className="space-y-4" noValidate>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Piano di sicurezza e coordinamento (PSC)</span>
              <input ref={input} type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => scegli(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setSopra(true); }}
                onDragLeave={() => setSopra(false)}
                onDrop={lascia}
                className={clsx('flex w-full flex-col items-center gap-2 rounded-[20px] border-2 border-dashed p-6 text-center', file || sopra ? 'border-black bg-grafite-50' : 'border-line')}
              >
                <span className={clsx('grid size-12 place-items-center rounded-full', file ? 'bg-black text-acid-400' : 'bg-sunken text-fg')}>
                  {file ? <CerchioSpunta size={20} aria-hidden /> : <Scarica size={20} aria-hidden className="rotate-180" />}
                </span>
                <span className="text-[15px] font-medium text-fg">{file ? file.name : 'Scegli il file o trascinalo qui'}</span>
                <span className="text-caption text-fg-muted">{file ? 'Tocca per cambiarlo' : 'PDF · fino a 50 MB'}</span>
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Note per l&apos;impresa (facoltative)</span>
              <textarea className="block min-h-[96px] w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-base" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Es. allegati e cronoprogramma nel capitolo 4" maxLength={1000} />
            </label>
            {err && <p role="alert" className="text-small text-[#d63d3e]">{err}</p>}
            <button type="submit" disabled={!file || invio} className="btn btn-accent btn-lg w-full">
              {invio ? <Rotore size={18} aria-hidden className="animate-spin" /> : <Invia size={18} aria-hidden />} Invia il PSC
            </button>
          </form>
          <p className="text-small text-fg-muted">
            Non serve registrarsi. Il PSC lo vedono solo {o.azienda} e il tecnico ISFOR che prepara il {servizio}. Il link vale fino al {lunga(o.scadeIl)}.
          </p>
        </>
      ) : (
        <>
          <section className="rounded-[28px] bg-acid-400 p-6 text-acid-950">
            <span className="grid size-12 place-items-center rounded-full bg-black text-acid-400"><CerchioSpunta size={22} aria-hidden /></span>
            <h1 className="mt-3 text-[32px] font-medium leading-tight">{mio || !o.caricatoDaAzienda ? 'PSC inviato, grazie' : 'Il PSC è già arrivato'}</h1>
            <p className="mt-2 text-body">
              {mio || !o.caricatoDaAzienda
                ? `L'abbiamo girato a ${o.azienda} e al tecnico ISFOR che prepara il ${servizio}. Non devi fare altro.`
                : `L'ha caricato ${o.azienda}. Se hai una versione più recente, caricala qui sotto.`}
            </p>
          </section>
          <section className="card flex items-center gap-3 p-5">
            <CerchioSpunta size={20} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-fg">{caricato.nome}</span>
              <span className="block text-small text-fg-muted">Caricato il {lunga(caricato.il)}</span>
            </span>
          </section>
          <button type="button" className="btn btn-secondary btn-lg w-full" onClick={() => { setFile(null); setNota(''); setErr(null); setStato('a'); }}>
            Carica una versione aggiornata
          </button>
          <p className="text-small text-fg-muted">Se il PSC cambia durante i lavori puoi usare di nuovo questo link fino al {lunga(o.scadeIl)}.</p>
        </>
      )}
    </main>
  );
}
