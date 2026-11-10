'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { AvatarFalco } from '../../FalcoSezione';
import { Caricamento, Errore } from '../../kit';
import { clsx } from '@/lib/clsx';
import { Cestino, Microfono, Piu, Rotore, Spunta } from '@/components/icone';
import {
  annullaSepaAttivazione,
  anteprimaAttivita,
  benvenutoVisto,
  caricaDocumentoAttivazione,
  cercaAteco,
  codiceFirmaAttivazione,
  compilaAttivazione,
  firmaAttivazione,
  pagamentoAttivazione,
  segnalaAttivazione,
  statoAttivazione,
  type EsitoAttivita,
  type LavoratoreAttivazione,
  type RisultatoAteco,
  type StatoAttivazione,
} from '@/lib/portale/simulatore-api';
import { euroC } from '@/lib/portale/simulatore-logica';
import { controllaCarta, controllaSepa, erroriServer, type Errori } from '@/lib/portale/amministrazione-pagamenti';
import FoglioFirma from '../condivisi/FoglioFirma';

/**
 * Attivazione del cliente nuovo (regole di business 2): cinque passi senza menu,
 * un solo pulsante principale per passo (conferma finché il passo non è fatto,
 * poi Continua), la card del canone e il Falco che guida. Rischio, visita e
 * livello incendio si calcolano; il cliente segnala al tecnico se non è giusto.
 * Firma con codice SMS, primo mese con carta (servizio subito) o SEPA (al primo incasso).
 */
export default function Attivazione() {
  const { azienda, user, versione, chiedi } = usePortale();
  const id = azienda?.id ?? 0;
  const [st, setSt] = useState<StatoAttivazione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [passo, setPasso] = useState<number | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  const carica = useCallback(() => {
    if (!id) return;
    statoAttivazione(id)
      .then((s) => {
        setSt(s);
        setErrore(null);
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Non riesco a leggere l\'attivazione.'));
  }, [id]);
  useEffect(carica, [carica, versione]);
  // Il passo si fissa al primo caricamento: quando un passo si completa si resta lì, si va avanti con Continua.
  useEffect(() => {
    if (st && passo === null) setPasso(st.passo);
  }, [st, passo]);

  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!st) return <Caricamento testo="Preparo l'attivazione" />;
  if (st.benvenuto || st.attiva) return <Benvenuto st={st} nome={user.name.split(' ')[0]} />;

  const attuale = Math.min(passo ?? st.passo, st.passo);
  const aggiorna = async (f: () => Promise<StatoAttivazione | null>, ok?: string) => {
    setAvviso(null);
    try {
      const s = await f();
      if (s) setSt(s);
      const msg = s?.messaggio ?? ok;
      if (msg) setAvviso(msg);
    } catch (e) {
      setAvviso(e instanceof Error ? e.message : 'Operazione non riuscita.');
      throw e;
    }
  };
  const prova: Aggiorna = (f, ok) => aggiorna(f, ok).catch(() => undefined);
  const vai = (n: number) => {
    setAvviso(null);
    setPasso(n);
    // Schermata nuova: si riparte dall'inizio della pagina.
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      <div>
        <p className="text-[13px] text-ink-muted">Passo {attuale} di 5</p>
        <h1 className="mt-1 text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[36px]">Ciao {user.name.split(' ')[0]}, attiviamo il servizio</h1>
      </div>
      <Barra st={st} attuale={attuale} onVai={vai} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <FalcoGuida st={st} attuale={attuale} onChiedi={chiedi} />
          {st.schermata === 'attesa_sepa' ? (
            <InAttesa st={st} aggiorna={prova} />
          ) : (
            <div className="rounded-[1.75rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5] sm:p-6">
              {attuale === 1 && <PassoDocumenti st={st} aggiorna={prova} />}
              {attuale === 2 && <PassoDati st={st} aggiorna={prova} />}
              {attuale === 3 && <PassoLavoratori st={st} aggiorna={prova} />}
              {attuale === 4 && <PassoFirma st={st} aggiorna={prova} onFirmato={() => vai(5)} />}
              {attuale === 5 && <PassoPagamento st={st} aggiorna={aggiorna} />}
              {avviso && <p className="mt-4 rounded-[1rem] bg-perla-velo px-3 py-2 text-[13.5px] text-ink-soft" role="status">{avviso}</p>}
              <div className="mt-5 flex items-center gap-2 border-t border-perla-linea pt-4">
                {attuale > 1 && (
                  <button type="button" className="btn-ghost" onClick={() => vai(attuale - 1)}>
                    Indietro
                  </button>
                )}
                <span className="flex-1" />
                {attuale < 5 && st.passi[attuale - 1]?.fatto && (
                  <button type="button" className="btn-primary" onClick={() => vai(attuale + 1)}>
                    Continua
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <CardCanone st={st} />
          <div className="rounded-[1.5rem] bg-perla-velo p-4">
            <p className="text-[14px] font-medium text-ink">Cosa succede dopo</p>
            <ol className="mt-2 space-y-2">
              {st.dopo.map((d, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-ink-soft">
                  <span className="cifre grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] text-ink">{i + 1}</span>
                  {d}
                </li>
              ))}
            </ol>
          </div>
          {st.referente && (
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grafite-900 text-[13px] font-medium text-white">
                {st.referente.nome
                  .split(' ')
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">{st.referente.nome}</span>
                <span className="block truncate text-[12.5px] text-ink-muted">Il tuo referente · {st.referente.email}</span>
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- guscio dei passi

function Barra({ st, attuale, onVai }: { st: StatoAttivazione; attuale: number; onVai: (n: number) => void }) {
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Passi dell'attivazione">
      {st.passi.map((p, i) => {
        const n = i + 1;
        const raggiunto = n <= st.passo;
        return (
          <li key={p.chiave}>
            <button type="button" disabled={!raggiunto} onClick={() => onVai(n)} aria-current={n === attuale ? 'step' : undefined} className="block w-full text-left disabled:cursor-default">
              <span className={clsx('block h-1.5 rounded-full', n === attuale ? 'bg-oro-500 shadow-[0_0_0_1px_#677f02]' : p.fatto ? 'bg-grafite-950' : 'bg-perla-linea')} />
              <span className={clsx('mt-1.5 block truncate text-[11.5px] sm:text-[12.5px]', n === attuale ? 'font-medium text-ink' : 'text-ink-muted')}>{p.nome}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Il Falco commerciale in testa a ogni passo: dice la prossima cosa e ascolta. */
function FalcoGuida({ st, attuale, onChiedi }: { st: StatoAttivazione; attuale: number; onChiedi: (t: string) => void }) {
  const { ascolta } = usePortale();
  const [t, setT] = useState('');
  const frase =
    st.stato === 'richiesta'
      ? 'Abbiamo il mandato SEPA. Appena arriva il primo incasso il servizio parte e il fascicolo si apre entro 48 ore.'
      : st.mancano[0]
        ? `${st.mancano[0]} Se preferisci, dimmelo a voce e lo compilo io.`
        : 'Tutto pronto per questo passo. Chiedimi pure quello che vuoi sul canone o su cosa comprende.';
  const proposte: Record<number, string[]> = {
    1: ['Non ho la visura a portata di mano', 'Cosa devo caricare?'],
    2: ['Conviene associarmi a Conflavoro?', 'Ho già un consulente, perché cambiare?'],
    3: ['Ho 3 dipendenti: un cuoco, un cameriere e un lavapiatti', 'Cosa sono EBIASP e FondoFormazione?'],
    4: ['Cosa comprende il canone?', 'Posso disdire?'],
    5: ['Quando parte il servizio?', 'Costa troppo per me'],
  };
  return (
    <section aria-label="Falco" className="rounded-[1.75rem] bg-grafite-950 p-4 text-white sm:p-5">
      <div className="flex items-start gap-3">
        <AvatarFalco size={48} parla />
        <p className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed text-grafite-100">{frase}</p>
      </div>
      <form
        className="mt-3 flex items-center gap-2 rounded-full bg-white p-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!t.trim()) return ascolta();
          onChiedi(t.trim());
          setT('');
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Scrivi a Falco</span>
          <input value={t} onChange={(e) => setT(e.target.value.slice(0, 2000))} placeholder="Scrivi o detta a Falco" className="h-11 w-full bg-transparent px-4 text-base text-ink placeholder:text-grafite-400 focus:outline-none focus-visible:shadow-none" />
        </label>
        <button type="submit" aria-label={t.trim() ? 'Invia a Falco' : 'Parla con Falco'} className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full bg-oro-500 text-acido-950">
          {t.trim() ? <Spunta size={18} aria-hidden /> : <Microfono size={18} aria-hidden />}
        </button>
      </form>
      {st.stato !== 'richiesta' && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(proposte[attuale] ?? []).map((p) => (
            <button key={p} type="button" onClick={() => onChiedi(p)} className="min-h-[44px] lg:min-h-[40px] rounded-full px-3.5 text-[13px] text-grafite-200 shadow-[inset_0_0_0_1px_#4a4a52] hover:text-white">
              {p}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CardCanone({ st }: { st: StatoAttivazione }) {
  const c = st.canone;
  return (
    <section aria-label="Il tuo canone" className="rounded-[1.75rem] bg-grafite-950 p-5 text-white">
      <p className="text-[13px] text-grafite-400">Il tuo canone</p>
      {c.vuoto ? (
        <p className="mt-2 text-[15px] leading-relaxed text-grafite-100">{c.testo}</p>
      ) : (
        <>
          <p className="mt-1 text-oro-500">
            <span className="cifre text-[40px] font-light leading-none tracking-[-0.03em]">{euroC(c.mensile)}</span>
            <span className="ml-1 text-[14px]">al mese</span>
          </p>
          <p className="mt-1.5 text-[12.5px] text-grafite-400">
            {c.durata ?? 'Contratto di 12 mesi'} · {euroC(c.annuo)} in tutto, IVA esclusa
          </p>
          <ul className="mt-4 space-y-2 border-t border-grafite-800 pt-3">
            {c.righe.map((r) => (
              <li key={r.voce} className="flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 text-grafite-200">
                  {r.voce}
                  {r.quantita > 1 ? ` × ${r.quantita}` : ''}
                </span>
                <span className="cifre text-white">{euroC(r.mensile)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type Aggiorna = (f: () => Promise<StatoAttivazione | null>, ok?: string) => Promise<void>;

// ---------------------------------------------------------------- passo 1: documenti

function PassoDocumenti({ st, aggiorna }: { st: StatoAttivazione; aggiorna: Aggiorna }) {
  const input = useRef<HTMLInputElement>(null);
  const [occupato, setOccupato] = useState(false);
  const carica = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOccupato(true);
    for (const f of Array.from(files)) {
      // eslint-disable-next-line no-await-in-loop
      await aggiorna(async () => (await caricaDocumentoAttivazione(st.aziendaId, f)).stato);
    }
    setOccupato(false);
    if (input.current) input.current.value = '';
  };
  const visura = st.documenti.some((d) => d.tipo === 'visura' && d.stato === 'letto');
  const elenco = st.documenti.some((d) => d.tipo === 'elenco' && d.stato === 'letto');
  return (
    <div>
      <h2 className="text-[19px] font-medium text-ink">Carica i documenti</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
        Carica <b className="font-medium text-ink">tutti i documenti che hai</b>, anche quelli della sicurezza già fatti: DVR, nomine di RSPP e addetti, attestati dei corsi, verbali, piano di emergenza, registri. Ci
        servono per capire da dove partiamo. L&apos;assistente li legge e ti propone i dati da confermare.
      </p>
      <ul className="mt-4 divide-y divide-perla-linea rounded-[1.25rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
        {(
          [
            [visura, 'Visura camerale', 'L\'unico documento che serve per andare avanti. Se l\'azienda è appena nata, basta questa.', 'Obbligatoria'],
            [elenco, 'Elenco dei dipendenti', 'Utile: se lo carichi facciamo prima. Altrimenti aggiungi i lavoratori al passo 3.', 'Utile'],
          ] as const
        ).map(([ok, t, s, chip]) => (
          <li key={t} className="flex items-start gap-3 px-4 py-3">
            <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full', ok ? 'bg-grafite-950 text-white' : 'shadow-[inset_0_0_0_1.5px_#e2e2e5]')}>{ok && <Spunta size={12} aria-hidden />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink">{t}</span>
              <span className="block text-[12.5px] text-ink-muted">{s}</span>
            </span>
            <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium', chip === 'Obbligatoria' ? 'bg-grafite-950 text-white' : 'bg-perla-velo text-ink-muted')}>{chip}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={occupato}
        className="premi mt-4 flex min-h-[112px] w-full flex-col items-center justify-center gap-1.5 rounded-[1.5rem] bg-perla-velo px-4 text-center shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
      >
        {occupato ? <Rotore size={20} aria-hidden className="animate-spin" /> : <Piu size={20} aria-hidden />}
        <span className="text-[15px] font-medium text-ink">{occupato ? 'L\'assistente sta leggendo…' : 'Scegli i file'}</span>
        <span className="text-[12.5px] text-ink-muted">PDF, Excel, immagini o ZIP · anche più file insieme</span>
      </button>
      <input ref={input} type="file" multiple className="sr-only" onChange={(e) => void carica(e.target.files)} />
      <p className="mt-2 text-[12.5px] text-ink-muted">Non caricare documenti sanitari (giudizi, esiti, esami): vengono bloccati e cancellati senza essere letti.</p>
      {st.documenti.length > 0 && (
        <ul className="mt-4 space-y-2">
          {st.documenti.map((d, i) => (
            <li key={i} className="flex items-start gap-3 rounded-[1rem] bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <span className={clsx('mt-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium', d.stato === 'bloccato' ? 'bg-stato-danger text-stato-danger-ink' : 'bg-stato-ok text-stato-ok-ink')}>
                {d.stato === 'bloccato' ? 'Bloccato e cancellato' : 'Letto'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{d.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">{d.letto}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!st.passi[0].fatto && st.mancano[0] && <p className="mt-3 text-[13px] text-ink-muted">{st.mancano[0]}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- passo 2: dati e attività

function Tendina({ id, etichetta, valore, opzioni, vuota, onCambia, disabilitata, obbligatoria = true }: {
  id: string;
  etichetta: string;
  valore: string;
  opzioni: Array<{ id: string; nome: string }>;
  vuota: string;
  onCambia: (v: string) => void;
  disabilitata?: boolean;
  obbligatoria?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] text-ink-muted">
        {etichetta}
        {obbligatoria && <span className="text-stato-danger-ink"> *</span>}
      </label>
      <select id={id} className="input-field mt-1" value={valore} disabled={disabilitata} onChange={(e) => onCambia(e.target.value)}>
        <option value="">{vuota}</option>
        {opzioni.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

function PassoDati({ st, aggiorna }: { st: StatoAttivazione; aggiorna: Aggiorna }) {
  const d = st.dati;
  const scelta = d.attivita?.scelta ?? null;
  const [cat, setCat] = useState(scelta?.categoria ?? '');
  const [sotto, setSotto] = useState(scelta?.sotto ?? '');
  const [spec, setSpec] = useState(scelta?.spec ?? '');
  const [q, setQ] = useState('');
  const [trovate, setTrovate] = useState<{ risultati: RisultatoAteco[]; vuoto: string | null }>({ risultati: [], vuoto: null });
  const [anteprima, setAnteprima] = useState<EsitoAttivita | null>(null);
  const [modifica, setModifica] = useState<string | null>(null);
  const [valore, setValore] = useState('');
  const [segnalato, setSegnalato] = useState<string | null>(null);
  useEffect(() => {
    const h = setTimeout(() => {
      cercaAteco(st.aziendaId, q)
        .then(setTrovate)
        .catch(() => setTrovate({ risultati: [], vuoto: null }));
    }, 250);
    return () => clearTimeout(h);
  }, [q, st.aziendaId]);
  useEffect(() => {
    if (!sotto) return setAnteprima(null);
    anteprimaAttivita(st.aziendaId, sotto, spec || null)
      .then(setAnteprima)
      .catch(() => setAnteprima(null));
  }, [st.aziendaId, sotto, spec]);

  const categoria = st.albero.find((c) => c.id === cat) ?? null;
  const sottoSel = categoria?.sotto.find((x) => x.id === sotto) ?? null;
  const salvaAttivita = (so: string, sp: string) => void aggiorna(() => compilaAttivazione(st.aziendaId, { attivita: { sotto: so, spec: sp || null } }));
  const esito = anteprima ?? d.attivita;
  const motivo = !esito ? 'Scegli l\'attività per continuare.' : d.socio === null ? 'Dicci se sei socio Conflavoro per continuare.' : null;
  const campi: Array<[string, string, string | null]> = [
    ['ragione_sociale', 'Ragione sociale', d.ragioneSociale],
    ['partita_iva', 'Partita IVA', d.partitaIva],
    ['sede', 'Sede', d.sede],
    ['legale_rappresentante', 'Legale rappresentante', d.legaleRappresentante],
  ];
  const q12 = euroC(st.quota.mese);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-medium text-ink">Conferma i dati e l&apos;attività</h2>
        <ul className="mt-3 divide-y divide-perla-linea rounded-[1.25rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
          {campi.map(([k, et, v]) => (
            <li key={k} className="px-4 py-2.5">
              {modifica === k ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!valore.trim()) return setModifica(null);
                    void aggiorna(() => compilaAttivazione(st.aziendaId, { [k]: valore })).then(() => setModifica(null));
                  }}
                >
                  <input className="input-field" aria-label={`Correggi il dato: ${et}`} value={valore} onChange={(e) => setValore(e.target.value)} autoFocus />
                  <button type="submit" className="btn-primary">
                    Salva
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-ink-muted">{et}</span>
                    <span className={clsx('block truncate text-[14px]', v ? 'text-ink' : 'text-ink-subtle')}>{v ?? 'Da inserire'}</span>
                  </span>
                  <button type="button" className="min-h-[44px] px-2 text-[13px] font-medium text-ink underline underline-offset-4" onClick={() => { setModifica(k); setValore(v ?? ''); }}>
                    Modifica
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[15px] font-medium text-ink">Attività dell&apos;azienda</p>
        {scelta?.fonte === 'visura' && !d.confermati && <p className="mt-0.5 text-[12.5px] text-ink-muted">Proposta dalla visura</p>}
        <input className="input-field mt-2" placeholder="Cerca per codice o parola, es. 56.10 o pizzeria" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca l'attività" />
        {trovate.risultati.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {trovate.risultati.map((a) => (
              <li key={`${a.sotto}-${a.spec ?? ''}`}>
                <button
                  type="button"
                  className="premi flex min-h-[48px] w-full items-center gap-3 rounded-[1rem] bg-white px-3 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
                  onClick={() => {
                    setQ('');
                    setCat(a.categoria);
                    setSotto(a.sotto);
                    setSpec(a.spec ?? '');
                    salvaAttivita(a.sotto, a.spec ?? '');
                  }}
                >
                  <span className="cifre w-16 shrink-0 text-[13px] text-ink-muted">{a.codice}</span>
                  <span className="min-w-0 flex-1 text-[14px] text-ink">{a.percorso}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {trovate.vuoto && <p className="mt-2 text-[13px] text-ink-muted">{trovate.vuoto}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Tendina id="att-cat" etichetta="Categoria" vuota="Scegli" valore={cat} opzioni={st.albero} onCambia={(v) => { setCat(v); setSotto(''); setSpec(''); }} />
          <Tendina id="att-sotto" etichetta="Sottocategoria" vuota="Scegli" valore={sotto} opzioni={categoria?.sotto ?? []} disabilitata={!categoria}
            onCambia={(v) => { setSotto(v); setSpec(''); if (v) salvaAttivita(v, ''); }} />
          <Tendina id="att-spec" etichetta="Specifica" obbligatoria={false} vuota={sottoSel && sottoSel.specifiche.length === 0 ? 'Non serve per questa attività' : 'Nessuna specifica'} valore={spec}
            opzioni={sottoSel?.specifiche ?? []} disabilitata={!sottoSel || sottoSel.specifiche.length === 0} onCambia={(v) => { setSpec(v); salvaAttivita(sotto, v); }} />
        </div>
        {esito && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-[1.25rem] bg-grafite-950 p-4 text-white">
              <p className="text-[12.5px] text-grafite-400">Classe di rischio dell&apos;attività</p>
              <p className="mt-0.5 text-[24px] font-medium capitalize text-oro-500">{esito.rischio}</p>
              <p className="mt-0.5 text-[12.5px] text-grafite-400">
                ATECO {esito.codice} · {esito.nome}
              </p>
              <div className="mt-3 border-t border-grafite-800 pt-3">
                <p className="text-[12.5px] text-grafite-400">Rischio incendio</p>
                <p className="text-[16px] font-medium">
                  Livello {esito.incendio.livello} · {esito.incendio.nome}
                </p>
                <p className="text-[12.5px] text-grafite-400">{esito.incendio.testo}</p>
                {segnalato ? (
                  <p className="mt-1 text-[12.5px] text-grafite-200">{segnalato}</p>
                ) : (
                  <button
                    type="button"
                    className="mt-1 min-h-[44px] text-[12.5px] font-medium text-grafite-400 underline-offset-2 hover:text-white hover:underline"
                    onClick={() => segnalaAttivazione(st.aziendaId, 'incendio').then((r) => setSegnalato(r.messaggio)).catch(() => setSegnalato('Non sono riuscito a mandare la segnalazione.'))}
                  >
                    Non è giusto?
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[14px] font-medium text-ink">Cosa vuol dire</p>
              {(anteprima?.reparti ?? []).length > 0 && (
                <ul className="divide-y divide-perla-linea rounded-[1rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
                  {anteprima!.reparti!.map((r) => (
                    <li key={r.reparto} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-ink">{r.reparto}</span>
                        <span className="text-ink-muted"> · {r.lavoratori} {r.lavoratori === 1 ? 'lavoratore' : 'lavoratori'}</span>
                      </span>
                      <span className="text-ink-soft">
                        Rischio specifico <b className="font-medium">{r.rischio}</b> · {r.ore} ore
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{esito.nota}</p>
              {anteprima?.avviso && (
                <div className="rounded-[1rem] bg-stato-warn px-3 py-2 text-[12.5px] text-stato-warn-ink" role="status">
                  <p className="font-medium">{anteprima.avviso.titolo}</p>
                  <p>{anteprima.avviso.testo}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-[15px] font-medium text-ink">Sei socio Conflavoro?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(
            [
              ['socio', 'Sì, sono già socio', 'La quota la paghi già a Conflavoro'],
              ['associarsi', 'Voglio associarmi', `${euroC(st.quota.importo)} l'anno per l'azienda, ${st.quota.testo.toLowerCase()}`],
              ['no', 'No, non mi associo', `Il canone aumenta di ${q12} al mese, la quota divisa per 12`],
            ] as const
          ).map(([k, t, s]) => (
            <button
              key={k}
              type="button"
              aria-pressed={d.socio === k}
              onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { socio: k }))}
              className={clsx('premi min-h-[64px] rounded-[1rem] px-3 py-2 text-left', d.socio === k ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}
            >
              <span className="block text-[14px] font-medium">{t}</span>
              <span className={clsx('block text-[12px]', d.socio === k ? 'text-grafite-300' : 'text-ink-muted')}>{s}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          Associarsi è facoltativo. La quota associativa è una cifra annua dell&apos;azienda, non a lavoratore, e si paga a Conflavoro a parte. Se sei già socio non serve nessun documento: lo verifichiamo noi entro 4 mesi.
        </p>
      </div>
      {!d.confermati && (
        <div>
          <button type="button" className="btn-primary w-full sm:w-auto" disabled={motivo !== null} onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { conferma: 'dati' }))}>
            Conferma e continua
          </button>
          {motivo && <p className="mt-2 text-[13px] text-ink-muted">{motivo}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- passo 3: lavoratori

function SiNo({ etichetta, valore, onCambia }: { etichetta: string; valore: boolean | null; onCambia: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 basis-48 text-[13.5px] text-ink">{etichetta}</span>
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={valore === v}
          onClick={() => onCambia(v)}
          className={clsx('min-h-[44px] min-w-[64px] rounded-full px-4 text-[13.5px] font-medium', valore === v ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}
        >
          {v ? 'Sì' : 'No'}
        </button>
      ))}
    </div>
  );
}

function Segnala({ st, l, aggiorna }: { st: StatoAttivazione; l: LavoratoreAttivazione; aggiorna: Aggiorna }) {
  const [aperto, setAperto] = useState(false);
  const [t, setT] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (l.segnalazione) return <p className="mt-1.5 pl-[52px] text-[12px] text-ink-muted">Segnalato al tecnico: «{l.segnalazione}»</p>;
  if (!aperto)
    return (
      <button type="button" className="ml-[52px] mt-1 min-h-[44px] text-[12.5px] font-medium text-ink-muted underline underline-offset-4" onClick={() => setAperto(true)}>
        Non è giusto?
      </button>
    );
  return (
    <form
      className="mt-2 space-y-2 pl-[52px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!t.trim()) return setErr('Scrivi in breve cosa fa: ci serve per la verifica.');
        void aggiorna(async () => (await segnalaAttivazione(st.aziendaId, 'lavoratore', l.id, t.trim())).stato);
      }}
    >
      <label className="block text-[12.5px] text-ink-muted" htmlFor={`segnala-${l.id}`}>
        Cosa fa davvero {l.nome}?
      </label>
      <input id={`segnala-${l.id}`} className="input-field" value={t} onChange={(e) => setT(e.target.value.slice(0, 300))} />
      {err && <p className="text-[12.5px] text-stato-danger-ink">{err}</p>}
      <button type="submit" className="btn-ghost">
        Segnala al tecnico
      </button>
    </form>
  );
}

function PassoLavoratori({ st, aggiorna }: { st: StatoAttivazione; aggiorna: Aggiorna }) {
  const [nuovo, setNuovo] = useState({ nome: '', mansione: '', reparto: '' });
  const [errNuovo, setErrNuovo] = useState<string | null>(null);
  const elenco = useRef<HTMLInputElement>(null);
  const fatto = st.passi[2]?.fatto;
  const domanda = (l: LavoratoreAttivazione, chiave: string, v: boolean) =>
    void aggiorna(() => compilaAttivazione(st.aziendaId, { lavoratori: [{ id: l.id, nome: l.nome, mansione: l.mansione, reparto: l.reparto, risposte: { [chiave]: v } }] }));
  const n = st.lavoratori.length;
  const r = st.enti.risparmio;
  const risparmio = [st.enti.ebiasp === false ? `versando a EBIASP risparmi ${euroC(r.ebiasp)}` : '', st.enti.fondo === false ? `aderendo a FondoFormazione risparmi ${euroC(r.fondo)}` : '']
    .filter(Boolean)
    .join(', ');
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-medium text-ink">Conferma i lavoratori</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">Rischio e visita si calcolano da attività, reparto e mansione: rispondi solo alle domande che servono.</p>
      </div>
      {n === 0 ? (
        <div className="rounded-[1.25rem] bg-perla-velo p-4">
          <p className="text-[15px] font-medium text-ink">Ancora nessun lavoratore</p>
          <p className="mt-1 text-[13px] text-ink-muted">Carica un elenco: va bene qualsiasi file, Excel, PDF, Word o una foto. Lo legge l&apos;assistente. Oppure aggiungi i lavoratori uno alla volta.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {st.lavoratori.map((l) => (
            <li key={l.id} className="rounded-[1.25rem] bg-white p-3 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-perla-velo text-[13px] font-medium text-ink">
                  {l.nome
                    .split(' ')
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium text-ink">{l.nome}</span>
                  <span className="block text-[12.5px] text-ink-muted">
                    {l.mansione}
                    {l.reparto ? ` · ${l.reparto}` : ''} · rischio {l.rischio}
                  </span>
                </span>
                <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium', l.daCalcolare ? 'bg-stato-warn text-stato-warn-ink' : l.visita ? 'bg-cat-visite text-cat-visite-ink' : 'bg-perla-velo text-ink-muted')}>
                  {l.daCalcolare ? 'Da calcolare' : l.visita ? 'Con visita' : 'Senza visita'}
                </span>
                <button type="button" aria-label={`Togli ${l.nome}`} className="btn-icon" onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { togli: [l.id] }))}>
                  <Cestino size={16} aria-hidden />
                </button>
              </div>
              <p className="mt-1.5 pl-[52px] text-[12px] text-ink-muted">{l.motivo}</p>
              {l.domande.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-perla-linea pt-2 pl-[52px]">
                  {l.domande.map((dm) => (
                    <SiNo key={dm.chiave} etichetta={dm.testo} valore={dm.risposta} onCambia={(v) => domanda(l, dm.chiave, v)} />
                  ))}
                </div>
              )}
              <Segnala st={st} l={l} aggiorna={aggiorna} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => elenco.current?.click()}>
          Carica un elenco
        </button>
        <input
          ref={elenco}
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void aggiorna(async () => (await caricaDocumentoAttivazione(st.aziendaId, f, 'elenco')).stato);
            e.target.value = '';
          }}
        />
      </div>
      <form
        className="grid gap-2 rounded-[1.25rem] bg-perla-velo p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nuovo.nome.trim() || !nuovo.mansione.trim()) return setErrNuovo('Scrivi nome e mansione.');
          setErrNuovo(null);
          void aggiorna(() => compilaAttivazione(st.aziendaId, { lavoratori: [{ nome: nuovo.nome, mansione: nuovo.mansione, reparto: nuovo.reparto || null }] })).then(() => setNuovo({ nome: '', mansione: '', reparto: '' }));
        }}
      >
        <input className="input-field" placeholder="Nome e cognome" aria-label="Nome e cognome" value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
        <input className="input-field" placeholder="Mansione" aria-label="Mansione" value={nuovo.mansione} onChange={(e) => setNuovo({ ...nuovo, mansione: e.target.value })} />
        <select className="input-field" aria-label="Reparto" value={nuovo.reparto} onChange={(e) => setNuovo({ ...nuovo, reparto: e.target.value })}>
          <option value="">Reparto</option>
          {st.reparti.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          <Piu size={16} aria-hidden /> Aggiungi un lavoratore
        </button>
        {errNuovo && <p className="text-[12.5px] text-stato-danger-ink sm:col-span-4">{errNuovo}</p>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 basis-48 text-[14px] font-medium text-ink">Sedi con alimenti</span>
        <button type="button" aria-label="Una sede in meno" className="btn-icon" onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { sedi_alimentari: Math.max(0, st.enti.sediAlimentari - 1) }))}>
          −
        </button>
        <span className="cifre w-6 text-center text-[16px]">{st.enti.sediAlimentari}</span>
        <button type="button" aria-label="Una sede in più" className="btn-icon" onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { sedi_alimentari: st.enti.sediAlimentari + 1 }))}>
          <Piu size={16} aria-hidden />
        </button>
        <p className="w-full text-[12.5px] text-ink-muted">Per ogni sede dove si preparano o vendono alimenti c&apos;è il supplemento HACCP di € 29,90 al mese.</p>
      </div>

      <div className="space-y-3 rounded-[1.25rem] bg-perla-velo p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
        <p className="text-[14px] font-medium text-ink">Enti bilaterali e fondi</p>
        <SiNo etichetta="Versi a EBIASP?" valore={st.enti.ebiasp} onCambia={(v) => void aggiorna(() => compilaAttivazione(st.aziendaId, { ebiasp: v }))} />
        <SiNo etichetta="Aderisci a FondoFormazione?" valore={st.enti.fondo} onCambia={(v) => void aggiorna(() => compilaAttivazione(st.aziendaId, { fondo: v }))} />
        {risparmio && <p className="text-[13px] font-medium text-ink">{risparmio.charAt(0).toUpperCase() + risparmio.slice(1)} al mese.</p>}
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Le accettiamo subito, come dichiarazione. Entro 4 mesi verifichiamo i versamenti agli enti e l&apos;adesione a Conflavoro: se qualcosa non risulta, ti avvisiamo e il canone si aggiorna con la maggiorazione prevista.
        </p>
      </div>
      {!fatto && (
        <div>
          <button type="button" className="btn-primary w-full sm:w-auto" disabled={n === 0} onClick={() => void aggiorna(() => compilaAttivazione(st.aziendaId, { conferma: 'lavoratori' }))}>
            Conferma {n} {n === 1 ? 'lavoratore' : 'lavoratori'} · {euroC(st.canone.mensile)} al mese
          </button>
          {n === 0 && <p className="mt-2 text-[13px] text-ink-muted">Aggiungi almeno un lavoratore per continuare.</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- passo 4: firma

function PassoFirma({ st, aggiorna, onFirmato }: { st: StatoAttivazione; aggiorna: Aggiorna; onFirmato: () => void }) {
  const [foglio, setFoglio] = useState(false);
  return (
    <div className="space-y-4">
      <h2 className="text-[19px] font-medium text-ink">Firma il contratto</h2>
      <div className="rounded-[1.25rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
        <p className="border-b border-perla-linea px-4 py-3 text-[15px] font-medium text-ink">{st.contratto.titolo}</p>
        <dl className="divide-y divide-perla-linea">
          {st.contratto.voci.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-2.5 text-[13.5px]">
              <dt className="w-28 shrink-0 text-ink-muted">{k}</dt>
              <dd className="min-w-0 flex-1 text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="px-4 pb-3 pt-1 text-[12.5px] leading-relaxed text-ink-muted">Comprende: {st.contratto.comprende}</p>
      </div>
      {st.contratto.socio && <p className="rounded-[1rem] bg-perla-velo px-3 py-2 text-[13px] text-ink-soft">{st.contratto.socio}</p>}
      {st.firma ? (
        <p className="flex items-center gap-2 rounded-[1rem] bg-stato-ok px-3 py-2 text-[13.5px] text-stato-ok-ink">
          <Spunta size={16} aria-hidden /> Firmato il {new Date(st.firma.firmatoIl).toLocaleDateString('it-IT')}
          {st.firma.da ? ` da ${st.firma.da}` : ''}
        </p>
      ) : (
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setFoglio(true)}>
          Firma con il codice
        </button>
      )}
      <FoglioFirma
        aperto={foglio}
        onChiudi={() => setFoglio(false)}
        titolo={st.contratto.titolo}
        sotto={`${st.dati.ragioneSociale} · ${euroC(st.canone.mensile)} al mese`}
        avvia={() => codiceFirmaAttivazione(st.aziendaId)}
        firma={async (token, codice, letto) => {
          await aggiorna(() => firmaAttivazione(st.aziendaId, token, codice, letto));
        }}
        onFirmato={onFirmato}
      />
    </div>
  );
}

// ---------------------------------------------------------------- passo 5: pagamento

function Campo({ id, etichetta, errore, children }: { id: string; etichetta: string; errore?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] text-ink-muted">
        {etichetta}
      </label>
      {children}
      {errore && <p className="mt-1 text-[12.5px] text-stato-danger-ink">{errore}</p>}
    </div>
  );
}

function PassoPagamento({ st, aggiorna }: { st: StatoAttivazione; aggiorna: Aggiorna }) {
  const [metodo, setMetodo] = useState<'carta' | 'sepa'>('carta');
  const [carta, setCarta] = useState({ numero: '', scadenza: '', cvc: '' });
  const [sepa, setSepa] = useState({ intestatario: '', iban: '', mandato: false });
  const [err, setErr] = useState<Errori>({});
  const [occupato, setOccupato] = useState(false);
  const invia = async () => {
    const e = metodo === 'carta' ? controllaCarta(carta) : controllaSepa(sepa);
    setErr(e);
    if (Object.keys(e).length) return;
    setOccupato(true);
    try {
      await aggiorna(() => pagamentoAttivazione(st.aziendaId, metodo, metodo === 'carta' ? carta : { ...sepa, iban: sepa.iban.replace(/\s+/g, '').toUpperCase() }));
    } catch (x) {
      setErr(erroriServer(x) ?? {});
    } finally {
      setOccupato(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] bg-oro-500 p-4 text-acido-950">
        <p className="text-[13px]">Da pagare oggi · primo mese</p>
        <p className="cifre text-[34px] font-light leading-none">{euroC(st.canone.mensile)}</p>
        <p className="mt-1.5 text-[12.5px]">Poi {euroC(st.canone.mensile)} il 15 di ogni mese, in automatico, per 12 mesi · fattura di ISFOR ogni mese</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Come vuoi pagare">
        {(
          [
            ['carta', 'Carta', 'Il servizio parte subito'],
            ['sepa', 'Addebito sul conto (SEPA)', 'Parte al primo incasso, 2 o 3 giorni'],
          ] as const
        ).map(([k, t, s]) => (
          <button key={k} type="button" role="radio" aria-checked={metodo === k} onClick={() => { setMetodo(k); setErr({}); }}
            className={clsx('premi rounded-[1.25rem] p-3.5 text-left', metodo === k ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}>
            <span className="block text-[14.5px] font-medium">{t}</span>
            <span className={clsx('block text-[12.5px]', metodo === k ? 'text-grafite-300' : 'text-ink-muted')}>{s}</span>
          </button>
        ))}
      </div>
      {metodo === 'carta' ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_100px]">
          <Campo id="att-carta" etichetta="Numero della carta" errore={err.numero}>
            <input id="att-carta" className="input-field cifre mt-1" inputMode="numeric" autoComplete="cc-number" aria-invalid={!!err.numero} value={carta.numero} onChange={(e) => setCarta({ ...carta, numero: e.target.value })} />
          </Campo>
          <Campo id="att-scad" etichetta="Scadenza" errore={err.scadenza}>
            <input id="att-scad" className="input-field cifre mt-1" placeholder="MM/AA" autoComplete="cc-exp" aria-invalid={!!err.scadenza} value={carta.scadenza} onChange={(e) => setCarta({ ...carta, scadenza: e.target.value })} />
          </Campo>
          <Campo id="att-cvc" etichetta="CVC" errore={err.cvc}>
            <input id="att-cvc" className="input-field cifre mt-1" inputMode="numeric" autoComplete="cc-csc" aria-invalid={!!err.cvc} value={carta.cvc} onChange={(e) => setCarta({ ...carta, cvc: e.target.value })} />
          </Campo>
          <p className="text-[12px] text-ink-muted sm:col-span-3">Nel servizio vero il pagamento passa da Stripe: noi teniamo solo marca, ultime 4 cifre e scadenza.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Campo id="att-sepa-nome" etichetta="Intestatario del conto" errore={err.intestatario}>
            <input id="att-sepa-nome" className="input-field mt-1" aria-invalid={!!err.intestatario} value={sepa.intestatario} onChange={(e) => setSepa({ ...sepa, intestatario: e.target.value })} />
          </Campo>
          <Campo id="att-sepa-iban" etichetta="IBAN" errore={err.iban}>
            <input id="att-sepa-iban" className="input-field cifre mt-1" autoComplete="off" aria-invalid={!!err.iban} value={sepa.iban} onChange={(e) => setSepa({ ...sepa, iban: e.target.value.toUpperCase() })} />
          </Campo>
          <label className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-soft">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#18181B]" checked={sepa.mandato} onChange={(e) => setSepa({ ...sepa, mandato: e.target.checked })} />
            Autorizzo ISFOR ad addebitare il canone sul conto ogni mese (mandato SEPA)
          </label>
          {err.mandato && <p className="text-[12.5px] text-stato-danger-ink">{err.mandato}</p>}
        </div>
      )}
      <button type="button" className="btn-acido w-full" disabled={occupato} onClick={() => void invia()}>
        {metodo === 'carta' ? `Paga ${euroC(st.canone.mensile)} e attiva` : 'Autorizza l\'addebito'}
      </button>
    </div>
  );
}

function InAttesa({ st, aggiorna }: { st: StatoAttivazione; aggiorna: Aggiorna }) {
  return (
    <div className="rounded-[1.75rem] bg-white p-5 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <p className="text-[19px] font-medium text-ink">Aspettiamo il primo addebito</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
        Abbiamo il mandato SEPA. Addebitiamo {euroC(st.canone.mensile)} sul conto {st.pagamento?.iban ?? ''}: di solito l&apos;incasso arriva in 2 o 3 giorni lavorativi. Appena c&apos;è, attiviamo il servizio e ti
        avvisiamo per email.
      </p>
      <button type="button" className="btn-ghost mt-4" onClick={() => void aggiorna(() => annullaSepaAttivazione(st.aziendaId))}>
        Preferisco pagare con carta
      </button>
    </div>
  );
}

function Benvenuto({ st, nome }: { st: StatoAttivazione; nome: string }) {
  const [esco, setEsco] = useState(false);
  return (
    <div className="mx-auto max-w-[760px] rounded-[2.25rem] bg-grafite-950 p-6 text-white sm:p-10">
      <AvatarFalco size={64} parla />
      <h1 className="mt-5 text-[30px] font-medium leading-tight tracking-[-0.03em] sm:text-[40px]">Benvenuto, {nome}. Il servizio è attivo.</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-grafite-200">Pagamento ricevuto. Entro 48 ore un tecnico controlla i tuoi dati e apre il fascicolo.</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          [String(st.lavoratori.length), 'lavoratori seguiti'],
          [euroC(st.canone.mensile), 'al mese'],
          ['48 h', 'per il fascicolo'],
        ].map(([v, t]) => (
          <div key={t} className="rounded-[1.25rem] bg-grafite-900 p-3">
            <p className="cifre text-[20px] font-light text-oro-500 sm:text-[26px]">{v}</p>
            <p className="mt-0.5 text-[12px] text-grafite-400">{t}</p>
          </div>
        ))}
      </div>
      <ul className="mt-6 space-y-2 text-[14px] text-grafite-200">
        <li>In &quot;Da fare adesso&quot; trovi la prima visita e i corsi da prenotare.</li>
        <li>&quot;Completa il fascicolo&quot; ti dice quali documenti caricare.</li>
        <li>Pronto Ispezioni è attivo da subito.</li>
      </ul>
      <button
        type="button"
        className="btn-acido mt-7 w-full sm:w-auto"
        disabled={esco}
        onClick={async () => {
          setEsco(true);
          try {
            await benvenutoVisto(st.aziendaId);
          } finally {
            window.location.assign('/azienda/dashboard/');
          }
        }}
      >
        Entra nell&apos;app
      </button>
    </div>
  );
}
