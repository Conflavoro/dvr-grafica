'use client';

/**
 * "Carica il PSC", pagina pubblica (senza login).
 *
 * Il tecnico manda /psc/?t=psc_... al committente o al coordinatore: la pagina
 * mostra cantiere e impresa e riceve il Piano di sicurezza e coordinamento una
 * volta sola, entro la scadenza. Solo query string: export statico.
 */

import { percorso } from '@/lib/percorso';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avviso, Documento } from '@/components/icone';
import { Caricamento } from '@/components/portale/kit';
import PscOrdinePubblicoVista from '@/components/portale/psc/PscOrdinePubblico';
import { apriLinkPsc, caricaPsc, controllaFilePsc, type PscPubblico } from '@/lib/portale/psc-api';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const data = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d);
};

type Stato = { fase: 'carico' } | { fase: 'errore'; testo: string } | { fase: 'pronto'; p: PscPubblico } | { fase: 'fatto'; p: PscPubblico };

const CAMPO =
  'block h-12 w-full rounded-[12px] border border-[#e2e2e5] bg-perla-carta px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function Modulo({ token, p, onFatto }: { token: string; p: PscPubblico; onFatto: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scegli = (f: File | null) => {
    setErr(f ? controllaFilePsc(f.name, f.size) : null);
    setFile(f);
  };
  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const c = controllaFilePsc(file.name, file.size);
    if (c) {
      setErr(c);
      return;
    }
    setErr(null);
    setProgresso(0);
    try {
      await caricaPsc(token, file, nome, setProgresso);
      onFatto();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Caricamento non riuscito. Riprova.');
      setProgresso(null);
    }
  };
  const invio = progresso !== null;
  return (
    <form onSubmit={(e) => void invia(e)} className="mt-6 space-y-4" noValidate>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Piano di sicurezza e coordinamento</span>
        <input ref={input} id="psc-file" type="file" accept=".pdf,.doc,.docx,application/pdf" className="sr-only" onChange={(e) => scegli(e.target.files?.[0] ?? null)} data-falco-campo="psc_file" />
        <label
          htmlFor="psc-file"
          className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[14px] bg-perla-carta px-4 py-3 shadow-[inset_0_0_0_1.5px_#c4c4c9] hover:shadow-[inset_0_0_0_1.5px_#18181b] focus-within:outline focus-within:outline-2 focus-within:outline-brand-500"
        >
          <Documento size={20} aria-hidden className="shrink-0 text-brand-700" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">{file ? file.name : 'Scegli il file'}</span>
            <span className="block text-[12.5px] text-ink-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'PDF o Word, fino a 20 MB'}</span>
          </span>
        </label>
      </div>
      <div>
        <label htmlFor="psc-nome" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          Chi lo carica
        </label>
        <input id="psc-nome" className={CAMPO} autoComplete="name" maxLength={150} placeholder={p.destinatario ?? 'Nome e cognome o studio'} value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      {err && (
        <p role="alert" className="flex items-start gap-2 rounded-[12px] bg-danger px-3.5 py-3 text-[14px] text-danger-ink">
          <Avviso size={18} aria-hidden className="mt-0.5 shrink-0" />
          {err}
        </p>
      )}
      {invio && (
        <div role="status" aria-label={`Caricamento ${progresso} per cento`} className="h-2 overflow-hidden rounded-full bg-perla-velo">
          <span className="block h-full rounded-full bg-grafite-900 transition-[width]" style={{ width: `${progresso}%` }} />
        </div>
      )}
      <button type="submit" data-falco="psc_invia" disabled={!file || !!controllaFilePsc(file.name, file.size) || invio} className="btn-primary min-h-[52px] w-full text-[15px]">
        {invio ? 'Carico il PSC' : 'Invia il PSC'}
      </button>
    </form>
  );
}

export default function PscPubblicoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stato, setStato] = useState<Stato>({ fase: 'carico' });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
    setToken(t);
    if (!t) {
      setStato({ fase: 'errore', testo: 'Il link è incompleto: aprilo di nuovo dal messaggio che hai ricevuto.' });
      return;
    }
    let vivo = true;
    apriLinkPsc(t)
      .then((p) => vivo && setStato({ fase: 'pronto', p }))
      .catch((e: unknown) => vivo && setStato({ fase: 'errore', testo: e instanceof Error && e.message ? e.message : 'Link non disponibile.' }));
    return () => {
      vivo = false;
    };
  }, []);

  const p = stato.fase === 'pronto' || stato.fase === 'fatto' ? stato.p : null;
  return (
    <div className="min-h-[100dvh] bg-perla-fondo">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="flex items-center justify-between gap-3 pb-6 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro" className="h-7 w-auto" />
          <span className="text-[12.5px] font-semibold text-brand-800">Carica il PSC</span>
        </header>
        {stato.fase === 'carico' && <Caricamento testo="Apro il link" />}
        {stato.fase === 'errore' && (
          <main>
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-brand-900">Link non disponibile</h1>
            <p role="alert" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {stato.testo}
            </p>
          </main>
        )}
        {p && p.ordine && token && <PscOrdinePubblicoVista token={token} o={p.ordine} />}
        {p && !p.ordine && (
          <main>
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Piano di sicurezza e coordinamento</p>
            <h1 className="mt-1 text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-brand-900">{p.cantiere ?? 'Cantiere'}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
              {[p.indirizzo, p.impresa && `impresa ${p.impresa}`].filter(Boolean).join(', ')}
            </p>
            {stato.fase === 'fatto' ? (
              <p role="status" className="mt-6 rounded-[14px] bg-ok px-4 py-4 text-[15px] leading-relaxed text-ok-ink">
                Grazie, il PSC è arrivato al tecnico che segue la sicurezza dell’impresa. Puoi chiudere la pagina.
              </p>
            ) : p.aperta && token ? (
              <>
                <p className="mt-4 text-[14.5px] leading-relaxed text-ink">
                  Il tecnico che prepara il POS dell’impresa ti chiede il PSC del cantiere{p.scadeIl ? `, entro il ${data(p.scadeIl)}` : ''}.
                </p>
                <Modulo token={token} p={p} onFatto={() => setStato({ fase: 'fatto', p })} />
              </>
            ) : (
              <p role="status" className="mt-6 rounded-[14px] bg-perla-velo px-4 py-4 text-[15px] leading-relaxed text-ink">
                {p.caricatoIl ? `Il PSC è già stato caricato il ${data(p.caricatoIl)}. Per mandarne una versione nuova chiedi un altro link.` : 'Il link è scaduto: chiedi un nuovo link al tecnico.'}
              </p>
            )}
            <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
              <Avviso size={16} aria-hidden className="mt-0.5 shrink-0 text-oro-600" />
              {p.avviso ?? 'Il file arriva solo al tecnico che segue la sicurezza dell’impresa.'}
            </p>
          </main>
        )}
        <footer className="mt-10 border-t border-perla-linea pt-4 text-[12px] leading-relaxed text-ink-subtle">Servizio della piattaforma Conflavoro.</footer>
      </div>
    </div>
  );
}
