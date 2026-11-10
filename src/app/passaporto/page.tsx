'use client';

/**
 * QR Safety Passport, pagina pubblica (senza login).
 *
 * Il QR apre /passaporto/?t=<token>: la pagina chiede PIN, ente e nome e
 * mostra i documenti essenziali dell'azienda con link temporanei. Solo query
 * string, nessuna rotta dinamica: funziona con l'export statico su cPanel.
 * Pensata per il telefono di un ispettore.
 */

import { percorso } from '@/lib/percorso';
import { useEffect, useState, type FormEvent } from 'react';
import { Avviso, Documento, Scudo } from '@/components/icone';
import type { PassaportoConsultazione, PassaportoPubblicoInfo, CrEsito } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { avvisoPassaporto } from '@/lib/passaporto-testo';

const ENTI: Record<string, string> = {
  ASL: 'ASL, servizio prevenzione',
  INL: 'Ispettorato del lavoro',
  VVF: 'Vigili del fuoco',
  NAS: 'Carabinieri NAS',
  ARPA: 'ARPA',
  consulente: 'Consulente o tecnico',
  altro: 'Altro ente',
};

const ESITO: Record<CrEsito, { l: string; cls: string }> = {
  conforme: { l: 'Presente', cls: 'bg-ok text-ok-ink' },
  in_scadenza: { l: 'In revisione', cls: 'bg-oro-50 text-oro-700' },
  da_verificare: { l: 'Da verificare', cls: 'bg-grafite-100 text-grafite-700' },
  non_conforme: { l: 'Non presente', cls: 'bg-danger text-danger-ink' },
  non_applicabile: { l: 'Non richiesto', cls: 'bg-perla-velo text-ink-muted' },
};

const CAMPO =
  'block h-12 w-full rounded-[12px] border border-[#e2e2e5] bg-perla-carta px-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const data = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d);
};

type Stato = { fase: 'carico' } | { fase: 'errore'; testo: string } | { fase: 'accesso'; info: PassaportoPubblicoInfo } | { fase: 'aperto'; c: PassaportoConsultazione };

function Intestazione() {
  return (
    <header className="flex items-center justify-between gap-3 pb-6 pt-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro" className="h-7 w-auto" />
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-800 [--icona-lame:#677f02] [--icona-lame-opacita:1]">
        <Scudo size={16} aria-hidden /> Safety Passport
      </span>
    </header>
  );
}

function Accesso({ token, info, onAperto }: { token: string; info: PassaportoPubblicoInfo; onAperto: (c: PassaportoConsultazione) => void }) {
  const ds = useDataSource();
  const [pin, setPin] = useState('');
  const [ente, setEnte] = useState(info.enti[0] ?? 'ASL');
  const [nome, setNome] = useState('');
  const [invio, setInvio] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apri = async (e: FormEvent) => {
    e.preventDefault();
    setInvio(true);
    setErr(null);
    try {
      onAperto(await ds.controlRoom.apriPassaportoPubblico(token, { pin: pin.trim(), ente, nome: nome.trim() }));
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : 'Accesso non riuscito.');
      setPin('');
    } finally {
      setInvio(false);
    }
  };
  return (
    <main>
      <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-brand-900">Documenti di sicurezza dell’azienda</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{info.informativa || 'Inserisci il PIN che ti ha dato l’azienda, l’ente che rappresenti e il tuo nome.'}</p>
      <form onSubmit={(e) => void apri(e)} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="p-pin" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            PIN
          </label>
          <input
            id="p-pin"
            className={clsx(CAMPO, 'cifre text-center text-[22px] tracking-[0.3em]')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            aria-describedby={err ? 'p-err' : undefined}
            aria-invalid={!!err || undefined}
          />
        </div>
        <div>
          <label htmlFor="p-ente" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Ente
          </label>
          <select id="p-ente" className={CAMPO} value={ente} onChange={(e) => setEnte(e.target.value)}>
            {info.enti.map((x) => (
              <option key={x} value={x}>
                {ENTI[x] ?? x}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-nome" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Nome e cognome
          </label>
          <input id="p-nome" className={CAMPO} autoComplete="name" required minLength={2} maxLength={150} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {err && (
          <p id="p-err" role="alert" className="flex items-start gap-2 rounded-[12px] bg-danger px-3.5 py-3 text-[14px] text-danger-ink">
            <Avviso size={18} aria-hidden className="mt-0.5 shrink-0" />
            {err}
          </p>
        )}
        <button type="submit" disabled={invio || pin.length < 4 || nome.trim().length < 2} className="btn-primary min-h-[52px] w-full text-[15px]">
          {invio ? 'Verifico' : 'Apri i documenti'}
        </button>
      </form>
      <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
        <Avviso size={16} aria-hidden className="mt-0.5 shrink-0 text-oro-600" />
        L’accesso viene registrato con data, ora, ente e nome, ed è visibile all’azienda e al suo consulente. I dati sanitari dei lavoratori non sono consultabili.
      </p>
    </main>
  );
}

function Doc({ titolo, data: d, versione, link }: { titolo: string; data: string | null; versione: string | null; link: string | null }) {
  const meta = [versione && `versione ${versione}`, data(d)].filter(Boolean).join(', ');
  const corpo = (
    <>
      <Documento size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-[14.5px] font-medium leading-snug', link ? 'text-brand-800 underline underline-offset-2' : 'text-ink')}>{titolo}</span>
        {meta && <span className="block text-[12.5px] text-ink-muted">{meta}</span>}
      </span>
    </>
  );
  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-start gap-2.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
      {corpo}
    </a>
  ) : (
    <div className="flex min-h-[48px] items-start gap-2.5 py-2">{corpo}</div>
  );
}

function Consultazione({ c, onEsci }: { c: PassaportoConsultazione; onEsci: () => void }) {
  const scade = c.consultato_il && c.link_validi_minuti ? new Date(new Date(c.consultato_il).getTime() + c.link_validi_minuti * 60_000) : null;
  const a = c.azienda;
  return (
    <main>
      <p role="status" className="flex items-start gap-2 rounded-[12px] bg-oro-50 px-3.5 py-3 text-[13.5px] leading-relaxed text-oro-700 shadow-[inset_0_0_0_1px_rgba(103,127,2,0.45)]">
        <Avviso size={17} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          {avvisoPassaporto(c.avviso, scade ? fmtOra.format(scade) : null)}
        </span>
      </p>
      <h1 className="mt-5 text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-brand-900">{a.ragione_sociale}</h1>
      <p className="mt-1.5 text-[14px] text-ink-muted">{[a.ateco && `ATECO ${a.ateco}`, a.lavoratori != null && `${a.lavoratori} lavoratori`, a.sede].filter(Boolean).join(', ')}</p>

      {c.organigramma.length > 0 && (
        <section className="mt-7" aria-labelledby="p-org">
          <h2 id="p-org" className="text-[17px] font-bold tracking-[-0.01em] text-brand-900">
            Organigramma della sicurezza
          </h2>
          <dl className="mt-2 divide-y divide-perla-linea border-y border-perla-linea">
            {c.organigramma.map((r) => (
              <div key={r.ruolo} className="py-2.5">
                <dt className="text-[12.5px] text-ink-muted">{r.ruolo}</dt>
                <dd className="text-[15px] font-medium text-ink">{r.nomi.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-7" aria-labelledby="p-doc">
        <h2 id="p-doc" className="text-[17px] font-bold tracking-[-0.01em] text-brand-900">
          Documenti essenziali
        </h2>
        {c.documenti_essenziali.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-muted">Nessun documento consultabile con questo passaporto.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {c.documenti_essenziali.map((v) => (
              <li key={v.voce} className="rounded-[14px] bg-perla-carta px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]">
                <p className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold leading-snug text-ink">{v.voce}</span>
                  <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium', ESITO[v.esito].cls)}>{ESITO[v.esito].l}</span>
                </p>
                {v.riferimento && <p className="mt-0.5 text-[12px] text-ink-subtle">{v.riferimento}</p>}
                {v.documenti.length > 0 ? (
                  <div className="mt-1 divide-y divide-perla-linea">
                    {v.documenti.map((d, i) => (
                      <Doc key={`${d.titolo}-${i}`} {...d} />
                    ))}
                  </div>
                ) : (
                  v.messaggio && <p className="mt-1 text-[13px] text-ink-muted">{v.messaggio}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {c.altri_documenti.length > 0 && (
        <section className="mt-7" aria-labelledby="p-altri">
          <h2 id="p-altri" className="text-[17px] font-bold tracking-[-0.01em] text-brand-900">
            Verbali, impianti ed emergenza
          </h2>
          <div className="mt-1 divide-y divide-perla-linea">
            {c.altri_documenti.map((d, i) => (
              <Doc key={`${d.titolo}-${i}`} {...d} />
            ))}
          </div>
        </section>
      )}

      {(c.formazione || c.sorveglianza) && (
        <section className="mt-7 space-y-2" aria-labelledby="p-lav">
          <h2 id="p-lav" className="text-[17px] font-bold tracking-[-0.01em] text-brand-900">
            Lavoratori
          </h2>
          {c.formazione && <p className="text-[14.5px] leading-relaxed text-ink-soft">{c.formazione}</p>}
          {c.sorveglianza && <p className="text-[14.5px] leading-relaxed text-ink-soft">{c.sorveglianza}</p>}
        </section>
      )}

      <button type="button" onClick={onEsci} className="btn-ghost mt-8 min-h-[48px] w-full">
        Chiudi la consultazione
      </button>
    </main>
  );
}

export default function PassaportoPubblicoPage() {
  const ds = useDataSource();
  const [token, setToken] = useState<string | null>(null);
  const [stato, setStato] = useState<Stato>({ fase: 'carico' });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
    setToken(t);
    if (!t) {
      setStato({ fase: 'errore', testo: 'Il link è incompleto: inquadra di nuovo il QR del Safety Passport.' });
      return;
    }
    let vivo = true;
    ds.controlRoom
      .passaportoPubblico(t)
      .then((info) => vivo && setStato({ fase: 'accesso', info }))
      .catch((e: unknown) => vivo && setStato({ fase: 'errore', testo: e instanceof Error && e.message ? e.message : 'Passaporto non disponibile.' }));
    return () => {
      vivo = false;
    };
  }, [ds]);

  return (
    <div className="min-h-[100dvh] bg-perla-fondo">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <Intestazione />
        {stato.fase === 'carico' && (
          <p role="status" className="py-10 text-center text-[14px] text-ink-muted">
            Verifico il passaporto
          </p>
        )}
        {stato.fase === 'errore' && (
          <main>
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-brand-900">Passaporto non disponibile</h1>
            <p role="alert" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {stato.testo} Se il problema resta, chiedi all’azienda un QR aggiornato.
            </p>
          </main>
        )}
        {stato.fase === 'accesso' && token && <Accesso token={token} info={stato.info} onAperto={(c) => setStato({ fase: 'aperto', c })} />}
        {stato.fase === 'aperto' && (
          <Consultazione
            c={stato.c}
            onEsci={() => {
              if (token) {
                ds.controlRoom
                  .passaportoPubblico(token)
                  .then((info) => setStato({ fase: 'accesso', info }))
                  .catch(() => setStato({ fase: 'errore', testo: 'Consultazione chiusa.' }));
              }
            }}
          />
        )}
        <footer className="mt-10 border-t border-perla-linea pt-4 text-[12px] leading-relaxed text-ink-subtle">
          Servizio della piattaforma Conflavoro Agente HSE. I documenti sono quelli caricati dall’azienda e dal suo consulente.
        </footer>
      </div>
    </div>
  );
}
