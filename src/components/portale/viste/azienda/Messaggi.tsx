'use client';

import { clearApiCache } from '@/lib/api';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Errore, Foglio, Testata, Vuoto } from '../../kit';
import { Avviso, Campo, Riquadri, SceltaFile, useDati } from './comuniAccount';
import { Chiudi, Fumetto, Indietro, Invia, Nota } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { FoglioReferente, SchedaReferente } from './Referente';
import {
  apriConversazione,
  conversazioni as caricaConversazioni,
  giornoChat,
  nuovaConversazione,
  rispondi,
  scaricaFile,
  sembraSanitario,
  type Conversazione,
  type VistaConversazione,
} from '@/lib/portale/azienda-account-api';

const RAPIDE: Record<string, string[]> = {
  generale: ['Mi potete richiamare?', 'Ho caricato il documento'],
  documenti: ['Ho caricato il documento', 'Quando è pronto?'],
  revisione: ['Grazie, aspetto la nuova versione', 'Mi potete richiamare?'],
  visite: ['Serve un cambio di data', 'Il lavoratore è stato avvisato', 'Che documenti deve portare?'],
  formazione: ['Quando c\'è il prossimo corso?', 'Il lavoratore ha finito il corso'],
  scadenze: ['Ci pensate voi a prenotare?', 'Mi potete richiamare?'],
  ispezioni: ['Ho caricato il verbale', 'Mi potete richiamare?'],
  amministrazione: ['Mi mandate la fattura?', 'Mi potete richiamare?'],
};

function ora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const oggi = new Date();
  return d.toDateString() === oggi.toDateString() ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * Messaggi tra l'azienda e lo studio, per argomento: elenco delle
 * conversazioni con i non letti, chat con allegati (filtro sanitario), risposte
 * rapide. Telefono: elenco o conversazione a tutta pagina; computer: due colonne.
 */
export default function Messaggi() {
  const { azienda, versione, chiedi } = usePortale();
  const id = azienda?.id ?? 0;
  const [giro, setGiro] = useState(0);
  const elenco = useDati(() => caricaConversazioni(id), [id, versione, giro]);
  const [apertaId, setApertaId] = useState<number | null>(null);
  const [nuova, setNuova] = useState(false);
  const [ref, setReferente] = useState(false);

  // Nuovi messaggi dallo studio: l'elenco si aggiorna ogni 30 secondi.
  useEffect(() => {
    const t = setInterval(() => setGiro((g) => g + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (!azienda) return null;
  const voci = elenco.dati?.voci ?? [];
  const nonLetti = elenco.dati?.nonLetti ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={clsx('min-w-0', apertaId !== null && 'hidden lg:block')}>
        <Testata
          categoria="assistenza"
          icona={Fumetto}
          sopra={azienda.ragione_sociale}
          titolo="Messaggi"
          sotto={nonLetti > 0 ? (nonLetti === 1 ? '1 messaggio nuovo dallo studio' : `${nonLetti} messaggi nuovi dallo studio`) : 'Scrivi allo studio: ti risponde il tecnico che segue la tua azienda, nei giorni lavorativi.'}
          azioni={
            <span className="flex w-full gap-2 sm:w-auto">
              <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setReferente(true)} aria-label="Contatti e domande frequenti">
                Il tuo referente
              </button>
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setNuova(true)}>
                Nuovo messaggio
              </button>
            </span>
          }
        />
      </div>

      {elenco.carico && !elenco.dati ? (
        <Caricamento testo="Carico i messaggi" />
      ) : elenco.errore ? (
        <Errore testo={elenco.errore} onRiprova={elenco.ricarica} />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          <section className={clsx('min-w-0 rounded-[1.25rem] bg-white p-2 shadow-[inset_0_0_0_1px_#e2e2e5]', apertaId !== null && 'hidden lg:block')} aria-label="Conversazioni">
            {voci.length === 0 ? (
              <div className="p-3">
                <Vuoto titolo="Nessuna conversazione">Scrivi la prima domanda allo studio: una visita da spostare, un documento da chiedere, un dubbio.</Vuoto>
              </div>
            ) : (
              <ul>
                {voci.map((c) => (
                  <li key={c.id}>
                    <RigaConversazione c={c} attiva={c.id === apertaId} onApri={() => setApertaId(c.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className={clsx('min-w-0', apertaId === null && 'hidden lg:block')}>
            {apertaId === null ? (
              <div className="rounded-[1.25rem] bg-perla-velo p-8 text-center text-[14px] text-ink-muted">Scegli una conversazione o scrivi un nuovo messaggio.</div>
            ) : (
              <Chat key={apertaId} convId={apertaId} onIndietro={() => setApertaId(null)} onCambiato={() => setGiro((g) => g + 1)} chiedi={chiedi} />
            )}
          </div>
          <aside className="hidden min-w-0 lg:block" aria-label="Il tuo referente">
            <SchedaReferente aziendaId={id} />
          </aside>
        </div>
      )}
      <FoglioReferente aperto={ref} aziendaId={id} onChiudi={() => setReferente(false)} />

      <FoglioNuova
        aperto={nuova}
        aziendaId={id}
        argomenti={elenco.dati?.argomenti ?? {}}
        onChiudi={() => setNuova(false)}
        onCreata={(v) => {
          setNuova(false);
          setGiro((g) => g + 1);
          setApertaId(v.conversazione.id);
        }}
      />
    </div>
  );
}

function RigaConversazione({ c, attiva, onApri }: { c: Conversazione; attiva: boolean; onApri: () => void }) {
  return (
    <button
      type="button"
      onClick={onApri}
      className={clsx('flex min-h-[64px] w-full items-start gap-3 rounded-[1rem] px-3 py-2.5 text-left', attiva ? 'bg-grafite-900 text-white' : 'hover:bg-perla-velo')}
    >
      <span aria-hidden className={clsx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', attiva ? 'bg-white/15' : 'bg-cat-assistenza text-cat-assistenza-ink')}>
        <Fumetto size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={clsx('truncate text-[14.5px]', c.nonLetti > 0 ? 'font-semibold' : 'font-medium')}>{c.titolo}</span>
          <span className={clsx('shrink-0 text-[12px]', attiva ? 'text-grafite-300' : 'text-ink-subtle')}>{ora(c.ultimoIl)}</span>
        </span>
        <span className={clsx('mt-0.5 block text-[12.5px]', attiva ? 'text-grafite-300' : 'text-ink-muted')}>{c.etichetta}</span>
        {c.anteprima && <span className={clsx('mt-0.5 line-clamp-1 text-[13px]', attiva ? 'text-grafite-200' : 'text-ink-soft')}>{c.ultimoLato === 'studio' ? 'Studio: ' : 'Tu: '}{c.anteprima}</span>}
      </span>
      {c.nonLetti > 0 && <span className="mt-1 grid h-6 min-w-6 place-items-center rounded-full bg-oro-500 px-1.5 text-[12px] font-medium text-acido-950">{c.nonLetti}</span>}
    </button>
  );
}

function Chat({ convId, onIndietro, onCambiato, chiedi }: { convId: number; onIndietro: () => void; onCambiato: () => void; chiedi: (t: string) => void }) {
  const [vista, setVista] = useState<VistaConversazione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [invio, setInvio] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);
  const fileRif = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    const carica = () =>
      apriConversazione(convId)
        .then((v) => {
          if (!vivo) return;
          setVista(v);
          onCambiato();
        })
        .catch((e: unknown) => vivo && setErrore(e instanceof Error ? e.message : 'Conversazione non disponibile.'));
    carica();
    const t = setInterval(() => {
      clearApiCache();
      carica();
    }, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: 'end' });
  }, [vista?.messaggi.length]);

  const invia = async (t: string = testo) => {
    if (!t.trim() && !file) return;
    if (file && sembraSanitario(file.name)) return setErrore('Il file sembra un documento sanitario: non allegarlo. Giudizi ed esami restano al medico competente.');
    setInvio(true);
    setErrore(null);
    try {
      const v = await rispondi(convId, t.trim(), file);
      setVista(v);
      setTesto('');
      setFile(null);
      onCambiato();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Messaggio non inviato.');
    } finally {
      setInvio(false);
    }
  };
  const tasto = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void invia();
    }
  };

  if (!vista) return errore ? <Errore testo={errore} /> : <Caricamento testo="Apro la conversazione" />;
  const c = vista.conversazione;
  let giorno = '';

  return (
    <section className="flex min-h-[60dvh] min-w-0 flex-col rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]" aria-label={c.titolo}>
      <header className="flex items-center gap-2 border-b border-perla-linea px-2 py-2 sm:px-4">
        <button type="button" className="btn-icon lg:hidden" aria-label="Torna alle conversazioni" onClick={onIndietro}>
          <Indietro size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-[15.5px] font-medium text-ink">{c.titolo}</p>
          <p className="truncate text-[12.5px] text-ink-muted">
            {c.etichetta}
            {vista.referente ? ` · ${vista.referente.nome}, risponde nei giorni lavorativi dalle 9 alle 18` : ''}
          </p>
        </div>
        <button type="button" className="btn-ghost hidden min-h-[44px] lg:min-h-[40px] px-3 text-[13px] sm:inline-flex" onClick={() => chiedi(`Riassumimi la conversazione con lo studio "${c.titolo}" e dimmi se aspettano una mia risposta.`)}>
          Riassumi con il Falco
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
        {vista.messaggi.map((m) => {
          const g = giornoChat(m.quando);
          const sep = g !== giorno;
          giorno = g;
          return (
            <div key={m.id}>
              {sep && <p className="py-2 text-center text-[12px] text-ink-subtle first-letter:uppercase">{g}</p>}
              <div className={clsx('flex', m.dallaMiaParte ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[85%] rounded-[1.25rem] px-4 py-2.5 text-[14.5px] leading-relaxed sm:max-w-[70%]', m.dallaMiaParte ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink')}>
                  <p className={clsx('mb-0.5 text-[12px]', m.dallaMiaParte ? 'text-grafite-300' : 'text-ink-muted')}>
                    {m.mio ? 'Tu' : m.autore || (m.lato === 'studio' ? 'Studio' : 'Azienda')} · {new Date(m.quando ?? '').toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {m.nuovo && <span className="ml-1.5 rounded-full bg-oro-500 px-1.5 py-0.5 text-[11px] text-acido-950">Nuovo</span>}
                  </p>
                  {m.testo && <p className="whitespace-pre-wrap break-words">{m.testo}</p>}
                  {m.allegato && (
                    <button
                      type="button"
                      onClick={() => scaricaFile(m.allegato!.url, m.allegato!.nome).catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Allegato non disponibile.'))}
                      className={clsx('mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-[0.875rem] px-3 text-left text-[13px] underline-offset-2 hover:underline', m.dallaMiaParte ? 'bg-white/10' : 'bg-white')}
                    >
                      <Nota size={16} aria-hidden className="shrink-0" />
                      <span className="truncate">{m.allegato.nome}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fondo} />
      </div>

      <footer className="border-t border-perla-linea px-3 pb-3 pt-2 sm:px-4">
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(RAPIDE[c.argomento] ?? RAPIDE.generale).map((r) => (
            <button key={r} type="button" disabled={invio} onClick={() => invia(r)} className="h-9 shrink-0 rounded-full bg-perla-velo px-3.5 text-[13px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
              {r}
            </button>
          ))}
        </div>
        {file && (
          <span className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-perla-velo px-3 py-1.5 text-[12.5px] text-ink">
            <span className="truncate">{file.name}</span>
            <button type="button" aria-label="Togli l'allegato" onClick={() => setFile(null)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white">
              <Chiudi size={12} aria-hidden />
            </button>
          </span>
        )}
        {errore && <div className="mb-2"><Avviso tono="danger">{errore}</Avviso></div>}
        <div className="flex items-end gap-2">
          <input ref={fileRif} type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn-icon shrink-0" aria-label="Allega un file" onClick={() => fileRif.current?.click()}>
            <Nota size={18} aria-hidden />
          </button>
          <label className="sr-only" htmlFor={`msg-${convId}`}>Scrivi un messaggio</label>
          <textarea
            id={`msg-${convId}`}
            rows={1}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={tasto}
            maxLength={4000}
            placeholder="Scrivi allo studio"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-[1.25rem] bg-perla-velo px-4 py-2.5 text-base text-ink placeholder:text-grafite-400 focus:bg-white focus:shadow-[inset_0_0_0_2px_#111113] focus:outline-none sm:text-[14px]"
          />
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grafite-900 text-white disabled:opacity-40" aria-label="Invia" disabled={invio || (!testo.trim() && !file)} onClick={() => invia()}>
            <Invia size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-subtle">Non allegare documenti sanitari: giudizi ed esami restano al medico competente.</p>
      </footer>
    </section>
  );
}

function FoglioNuova({ aperto, aziendaId, argomenti, onChiudi, onCreata }: { aperto: boolean; aziendaId: number; argomenti: Record<string, string>; onChiudi: () => void; onCreata: (v: VistaConversazione) => void }) {
  const [arg, setArg] = useState<string[]>(['generale']);
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  useEffect(() => {
    if (!aperto) return;
    setArg(['generale']);
    setTitolo('');
    setTesto('');
    setFile(null);
    setErrore(null);
  }, [aperto]);
  const voci = Object.entries(argomenti)
    .filter(([k]) => k !== 'revisione')
    .map(([k, t]) => ({ k, t }));

  const invia = async () => {
    if (!testo.trim() && !file) return setErrore('Scrivi il messaggio o allega un file.');
    if (file && sembraSanitario(file.name)) return setErrore('Il file sembra un documento sanitario: non allegarlo.');
    setInvio(true);
    setErrore(null);
    try {
      onCreata(await nuovaConversazione(aziendaId, { argomento: arg[0] ?? 'generale', titolo: titolo.trim() || undefined, testo: testo.trim() || undefined }, file));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Messaggio non inviato.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Nuovo messaggio allo studio"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" disabled={invio} onClick={invia}>
            {invio ? 'Invio' : 'Invia'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[13.5px] font-medium text-ink">Di cosa si tratta</p>
          <Riquadri etichetta="Argomento" voci={voci.length ? voci : [{ k: 'generale', t: 'Domanda generale' }]} scelti={arg} onCambia={setArg} />
        </div>
        <Campo etichetta="Oggetto (facoltativo)">
          <input className="input-field" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={200} placeholder="Es. Spostare la visita di Mario" />
        </Campo>
        <Campo etichetta="Messaggio">
          <textarea className="input-field h-32 py-3" value={testo} onChange={(e) => setTesto(e.target.value)} maxLength={4000} />
        </Campo>
        <Campo etichetta="Allegato (facoltativo)">
          <SceltaFile file={file} onFile={setFile} accetta=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" testo="Allega un file" />
        </Campo>
        <p className="text-[12.5px] text-ink-muted">Non allegare documenti sanitari: giudizi, esiti ed esami restano al medico competente.</p>
        {errore && <Avviso tono="danger">{errore}</Avviso>}
      </div>
    </Foglio>
  );
}
