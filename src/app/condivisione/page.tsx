'use client';

/**
 * Condivisione del fascicolo, pagina pubblica (senza login).
 *
 * L'azienda crea il link dall'area Documenti (/condivisione/?t=cond_...): chi
 * lo riceve vede le cartelle scelte, in sola lettura, fino alla scadenza. I
 * link ai file sono firmati e durano pochi minuti; ogni apertura è registrata
 * e visibile all'azienda. Solo query string: funziona con l'export statico.
 */

import { percorso } from '@/lib/percorso';
import { useCallback, useEffect, useState } from 'react';
import { Avviso, Cartella, Documento } from '@/components/icone';
import { Caricamento } from '@/components/portale/kit';
import { apriCondivisione, giorniAllaScadenza, totaleDocumenti, type Condivisione, type DocumentoCondiviso } from '@/lib/portale/condivisione-api';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const data = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d);
};

type Stato = { fase: 'carico' } | { fase: 'errore'; testo: string } | { fase: 'aperta'; c: Condivisione; aperta: number };

function Doc({ d, scaduti }: { d: DocumentoCondiviso; scaduti: boolean }) {
  const meta = [d.versione && `versione ${d.versione}`, data(d.data), d.stato].filter(Boolean).join(', ');
  const link = scaduti ? null : d.link;
  const corpo = (
    <>
      <Documento size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
      <span className="min-w-0 flex-1">
        <span className={link ? 'block text-[14.5px] font-medium leading-snug text-brand-800 underline underline-offset-2' : 'block text-[14.5px] font-medium leading-snug text-ink'}>{d.titolo}</span>
        {meta && <span className="block text-[12.5px] text-ink-muted">{meta}</span>}
        {!d.link && <span className="block text-[12.5px] text-ink-subtle">Solo l’indicazione, senza file da scaricare.</span>}
      </span>
    </>
  );
  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" data-falco="condivisione.documento" className="flex min-h-[48px] items-start gap-2.5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
      {corpo}
    </a>
  ) : (
    <div className="flex min-h-[48px] items-start gap-2.5 py-2.5">{corpo}</div>
  );
}

function Consultazione({ c, aperta, onAggiorna }: { c: Condivisione; aperta: number; onAggiorna: () => void }) {
  // I link firmati scadono dopo pochi minuti: oltre quel tempo si chiede di aggiornare la pagina.
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setOra(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const scaduti = ora - aperta > c.linkValidiMinuti * 60_000;
  const giorni = giorniAllaScadenza(c.scadeIl);
  const totale = totaleDocumenti(c);
  return (
    <main>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Documenti condivisi da</p>
      <h1 className="mt-1 text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-brand-900">{c.azienda}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
        {[c.destinatario && `Per ${c.destinatario}`, c.scadeIl && `consultabile fino al ${data(c.scadeIl)}`, giorni === 0 ? 'scade oggi' : giorni != null && giorni <= 3 ? `mancano ${giorni} giorni` : null]
          .filter(Boolean)
          .join(', ')}
      </p>

      {scaduti && (
        <div role="status" className="mt-5 flex flex-col gap-3 rounded-[12px] bg-oro-50 px-3.5 py-3 text-[14px] text-oro-700 shadow-[inset_0_0_0_1px_rgba(103,127,2,0.45)] sm:flex-row sm:items-center sm:justify-between">
          <span>Per sicurezza i link ai file durano {c.linkValidiMinuti} minuti. Aggiorna per scaricarli di nuovo.</span>
          <button type="button" onClick={onAggiorna} data-falco="condivisione.aggiorna" className="btn-primary min-h-[44px] shrink-0 px-4">
            Aggiorna i link
          </button>
        </div>
      )}

      {totale === 0 ? (
        <p className="mt-8 text-[15px] text-ink-muted">In questo momento non ci sono documenti nelle cartelle condivise.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {c.cartelle
            .filter((x) => x.documenti.length > 0)
            .map((x) => (
              <section key={x.chiave} aria-labelledby={`c-${x.chiave}`} data-falco={`condivisione.cartella.${x.chiave}`} className="rounded-[14px] bg-perla-carta px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)] sm:px-5">
                <h2 id={`c-${x.chiave}`} className="flex items-center gap-2 text-[16px] font-bold tracking-[-0.01em] text-brand-900">
                  <Cartella size={18} aria-hidden className="text-brand-700" />
                  {x.nome}
                  <span className="ml-auto text-[12.5px] font-medium text-ink-muted">{x.documenti.length}</span>
                </h2>
                <div className="mt-1 divide-y divide-perla-linea">
                  {x.documenti.map((d, i) => (
                    <Doc key={`${d.titolo}-${i}`} d={d} scaduti={scaduti} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
        <Avviso size={16} aria-hidden className="mt-0.5 shrink-0 text-oro-600" />
        {c.avviso ?? 'Condivisione in sola lettura, a scadenza. Ogni apertura viene registrata.'} I dati sanitari dei lavoratori non sono mai condivisi.
      </p>
    </main>
  );
}

export default function CondivisionePubblicaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stato, setStato] = useState<Stato>({ fase: 'carico' });

  const carica = useCallback((t: string) => {
    setStato({ fase: 'carico' });
    return apriCondivisione(t)
      .then((c) => setStato({ fase: 'aperta', c, aperta: Date.now() }))
      .catch((e: unknown) => setStato({ fase: 'errore', testo: e instanceof Error && e.message ? e.message : 'Condivisione non disponibile.' }));
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
    setToken(t);
    if (!t) {
      setStato({ fase: 'errore', testo: 'Il link è incompleto: aprilo di nuovo dal messaggio che hai ricevuto.' });
      return;
    }
    void carica(t);
  }, [carica]);

  return (
    <div className="min-h-[100dvh] bg-perla-fondo">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="flex items-center justify-between gap-3 pb-6 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro" className="h-7 w-auto" />
          <span className="text-[12.5px] font-semibold text-brand-800">Sola lettura</span>
        </header>
        {stato.fase === 'carico' && <Caricamento testo="Apro i documenti condivisi" />}
        {stato.fase === 'errore' && (
          <main>
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-brand-900">Condivisione non disponibile</h1>
            <p role="alert" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {stato.testo}
            </p>
          </main>
        )}
        {stato.fase === 'aperta' && token && <Consultazione c={stato.c} aperta={stato.aperta} onAggiorna={() => void carica(token)} />}
        <footer className="mt-10 border-t border-perla-linea pt-4 text-[12px] leading-relaxed text-ink-subtle">
          Servizio della piattaforma Conflavoro. I documenti sono quelli caricati dall’azienda e dal suo consulente.
        </footer>
      </div>
    </div>
  );
}
