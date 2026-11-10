'use client';

import { clearApiCache } from '@/lib/api';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Schede, Testata, Vuoto, dataIt, traGiorni, type StatoChip } from '../../kit';
import { Avviso, Campo, useCarico } from '../amministrazione-kit';
import { toast } from '../../telefono/stato';
import { clsx } from '@/lib/clsx';
import { scaricaFile } from '@/lib/data-source/moduli-api';
import { ErroreCampi } from '@/lib/portale/servizi-api';
import {
  ENTI,
  ESITI,
  FASI,
  TIPI_APPUNTO,
  chiediRichiamata,
  cifre,
  dettaglioVerbale,
  leggiVerbale,
  mmss,
  nomeEnte,
  percorsoFileVerbale,
  salvaVerbale,
  secondiRimasti,
  segnaSistemata,
  sezioneIspezioni,
  type Appunti,
  type Esito,
  type IspezioneStorico,
  type Lettura,
  type SezioneIspezioni,
} from '@/lib/portale/ispezioni-api';
import { Avanti, CerchioSpunta, Cerchio, Documento, Fotocamera, Indietro, Microfono, Rotore, Scarica, ScudoAllerta, Spunta } from '@/components/icone';

type Tab = 'adesso' | 'documenti' | 'dopo';

const CAMPO = 'block h-12 w-full rounded-[12px] border border-line bg-surface px-3.5 text-base text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-acid-400';

const COSA_FARE = [
  'Accogli l\'ispettore con calma e chiedi il tesserino',
  'Mostra i documenti richiesti, uno alla volta',
  'Segui cosa guarda e cosa chiede: gli appunti li prende l\'assistente',
  'Firma il verbale solo dopo averlo letto: puoi aggiungere osservazioni',
  'Chiedi una copia del verbale e caricala qui',
];
const COSA_NON_FARE = (largo: boolean) => [
  `Non consegnare originali: mostra le copie o ${largo ? 'il portale' : 'il telefono'}`,
  'Non fare ipotesi o promesse: aspetta il tecnico',
  'Non mostrare esiti o giudizi sanitari: bastano le date delle visite',
  'Non spostare lavoratori o attrezzature durante il controllo',
];

function useLargo(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setV(mq.matches);
    const f = (e: MediaQueryListEvent) => setV(e.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return v;
}

const chipEsito = (e: Esito): StatoChip => (ESITI.find((x) => x.k === e)?.chip ?? 'neutral') as StatoChip;

/** Pronto Ispezioni dell'area azienda (regole 12, schermate telefono e computer). */
export default function Ispezioni() {
  const { azienda, puo, versione } = usePortale();
  const largo = useLargo();
  const [tab, setTab] = useState<Tab>('adesso');
  const [conferma, setConferma] = useState(false);
  const [richiesta, setRichiesta] = useState(false);
  const [verbale, setVerbale] = useState(false);
  const [dettaglio, setDettaglio] = useState<number | null>(null);
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica } = useCarico(() => sezioneIspezioni(aid), [aid, versione]);
  // Le fasi della richiamata cambiano lato studio: si rilegge ogni 15 secondi finché la chiamata non è finita.
  useEffect(() => {
    if (!dati?.attiva || dati.attiva.finita) return;
    const t = setInterval(() => {
      clearApiCache();
      carica();
    }, 15_000);
    return () => clearInterval(t);
  }, [dati?.attiva, carica]);
  if (!azienda) return null;
  if (!puo('pronto_ispezioni')) return <Blocco>Solo il titolare e il referente possono attivare Pronto Ispezioni</Blocco>;
  const daSistemare = (dati?.documenti.voci ?? []).filter((v) => !['conforme', 'in_scadenza'].includes(v.esito)).length;
  const a = dati?.attiva ?? null;

  return (
    <div className="space-y-5">
      {largo && <Testata categoria="ispezioni" icona={ScudoAllerta} titolo="Pronto Ispezioni" sotto="Un controllo in azienda? Ti aiutiamo subito." />}
      <Schede<Tab>
        etichetta="Pronto Ispezioni"
        attiva={tab}
        onCambia={setTab}
        voci={[
          { k: 'adesso', t: a ? (largo ? 'Ispezione in corso' : 'In corso') : 'Adesso' },
          { k: 'documenti', t: largo ? 'Documenti da mostrare' : 'Documenti', n: daSistemare },
          { k: 'dopo', t: largo ? 'Dopo l\'ispezione' : 'Dopo' },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}
      {dati && tab === 'adesso' && !a && (
        <Adesso largo={largo} dati={dati} onTocco={() => (largo ? setRichiesta(true) : setConferma(true))} onLungo={() => setRichiesta(true)} onDocumenti={() => setTab('documenti')} onDopo={() => setTab('dopo')} />
      )}
      {dati && tab === 'adesso' && a && <InCorso largo={largo} dati={dati} onDocumenti={() => setTab('documenti')} onFine={() => setVerbale(true)} />}
      {dati && tab === 'documenti' && <Documenti dati={dati} />}
      {dati && tab === 'dopo' && <Dopo dati={dati} onCarica={() => setVerbale(true)} onApri={setDettaglio} />}

      <Foglio aperto={conferma} onChiudi={() => setConferma(false)} titolo="Attivi Pronto Ispezioni?" sopra="Pronto Ispezioni"
        piede={<button type="button" className="btn btn-accent btn-lg h-16 w-full" onClick={() => { setConferma(false); setRichiesta(true); }}><ScudoAllerta size={20} aria-hidden /> Sì, ho un controllo in corso</button>}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-black text-acid-400"><ScudoAllerta size={32} aria-hidden /></span>
          <p className="text-[15px] text-fg-muted">Un tecnico di ISFOR ti richiama entro {dati?.minuti ?? 15} minuti e ti guida al telefono durante il controllo.</p>
        </div>
      </Foglio>
      {dati && <FoglioRichiesta aperto={richiesta} largo={largo} dati={dati} aziendaId={aid} onChiudi={() => setRichiesta(false)} onFatto={() => { setRichiesta(false); setTab('adesso'); carica(); }} />}
      {dati && <FoglioVerbale aperto={verbale} largo={largo} dati={dati} aziendaId={aid} onChiudi={() => setVerbale(false)} onFatto={() => { setVerbale(false); if (!largo) setTab('dopo'); carica(); }} />}
      <FoglioDettaglio id={dettaglio} onChiudi={() => setDettaglio(null)} onCambio={carica} />
    </div>
  );
}

// ---------------------------------------------------------------- adesso

function Adesso({ largo, dati, onTocco, onLungo, onDocumenti, onDopo }: { largo: boolean; dati: SezioneIspezioni; onTocco: () => void; onLungo: () => void; onDocumenti: () => void; onDopo: () => void }) {
  const [offline, setOffline] = useState(false);
  const ultima = dati.storico[0];
  const passi: Array<[string, string]> = largo
    ? [
        ['Dicci chi è in azienda', 'ASL, Ispettorato, Vigili del fuoco o Carabinieri. Bastano due tocchi.'],
        ['Ti richiama un tecnico', `Entro ${dati.minuti} minuti, sul numero che scegli. Ti guida al telefono.`],
        ['Mostra i documenti', 'DVR, nomine, attestati e visite sono pronti, anche senza rete.'],
      ]
    : [
        ['Dicci chi è in azienda', 'ASL, Ispettorato, Vigili del fuoco o Carabinieri.'],
        ['Ti richiama un tecnico', `Entro ${dati.minuti} minuti, sul numero che scegli.`],
        ['Mostra i documenti', 'Sono pronti nel telefono, anche senza rete.'],
      ];
  const daSistemare = dati.documenti.totale - dati.documenti.pronti;
  const elencoPassi = (
    <ol className="space-y-4">
      {passi.map(([t, s], i) => (
        <li key={t} className="flex items-center gap-3">
          <span className={clsx('grid size-10 shrink-0 place-items-center rounded-full text-title text-acid-400', largo ? 'bg-grafite-800' : 'bg-grafite-900')}>{i + 1}</span>
          <span>
            <span className={clsx('block font-medium', largo ? 'text-title text-white' : 'text-[15px] text-fg')}>{t}</span>
            <span className={clsx('block text-small', largo ? 'text-grafite-400' : 'text-fg-muted')}>{s}</span>
          </span>
        </li>
      ))}
    </ol>
  );
  if (largo) {
    return (
      <div className="space-y-4">
        <section className="grid gap-8 rounded-xl bg-black p-8 text-white lg:grid-cols-[1.2fr_1fr] lg:p-12">
          <div>
            <p className="text-h3 font-light text-grafite-400">Hai un controllo in azienda adesso?</p>
            <p className="mt-2 text-display text-white">
              Ti richiamiamo entro <span className="text-acid-400">{dati.minuti} minuti</span>.
            </p>
            <button type="button" className="mt-8 flex h-24 w-full max-w-xl items-center justify-center gap-3 rounded-full bg-acid-400 text-h2 text-acid-950 hover:bg-acid-500" onClick={onTocco}>
              <ScudoAllerta size={32} aria-hidden /> Ho un controllo in corso
            </button>
          </div>
          <div className="self-center">{elencoPassi}</div>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={onDocumenti} className="card p-5 text-left hover:ring-1 hover:ring-grafite-900">
            <p className="text-small text-fg-muted">Documenti pronti da mostrare</p>
            <p className="mt-2 text-display font-light text-fg">{dati.documenti.pronti}<span className="text-h3 text-fg-muted">/{dati.documenti.totale}</span></p>
            <p className="mt-2 text-small text-fg-muted">{daSistemare > 0 ? `${daSistemare === 1 ? '1 cosa' : `${daSistemare} cose`} da sistemare, nessuna grave` : 'Tutto in ordine'}</p>
          </button>
          <div className="card p-5">
            <p className="text-small text-fg-muted">Senza rete</p>
            <p className="mt-2 text-h2 font-light text-fg">{offline ? 'Scaricati' : 'Non ancora scaricati'}</p>
            {offline ? (
              <span className="mt-3 inline-block"><Chip stato="ok">Disponibili offline</Chip></span>
            ) : (
              <button type="button" className="btn btn-secondary mt-3" onClick={() => { setOffline(true); toast(`${dati.documenti.totale} documenti scaricati per l'uso offline`); }}>
                <Scarica size={16} aria-hidden /> Scarica tutto
              </button>
            )}
          </div>
          <div className="card p-5">
            <p className="text-small text-fg-muted">Ultima ispezione</p>
            <p className="mt-2 text-h2 font-light text-fg">{ultima ? dataIt(ultima.data) : 'Nessuna'}</p>
            {ultima && <p className="mt-2 text-small text-fg-muted">{ultima.ente} · {ultima.esitoTesto.toLowerCase()}</p>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-black px-5 py-6 text-white">
        <p className="text-title text-grafite-400">Hai un controllo in azienda adesso?</p>
        <p className="mt-1 text-[32px] font-medium leading-[1.1]">
          Ti richiamiamo entro <span className="text-acid-400">{dati.minuti} minuti</span>.
        </p>
        <PulsanteLungo onTocco={onTocco} onLungo={onLungo} />
      </section>
      {elencoPassi}
      <section>
        <h2 className="text-h3 text-fg">Sei pronto?</h2>
        <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
          <button type="button" onClick={onDocumenti} className="card h-44 w-[62%] shrink-0 snap-start p-4 text-left">
            <p className="text-h1 font-light text-fg">{dati.documenti.pronti}<span className="text-fg-faint">/{dati.documenti.totale}</span></p>
            <p className="text-small text-fg">Documenti pronti</p>
            <p className="mt-2 text-caption text-fg-muted">{daSistemare > 0 ? `${daSistemare} da sistemare, niente di grave` : 'Tutto in ordine'}</p>
          </button>
          <div className="card h-44 w-[62%] shrink-0 snap-start p-4">
            <p className="text-small text-fg-muted">Senza rete</p>
            <p className="mt-1 text-h2 font-light text-fg">{offline ? 'Scaricati' : 'Non scaricati'}</p>
            {offline ? <Chip stato="ok">Pronti offline</Chip> : <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => { setOffline(true); toast(`${dati.documenti.totale} documenti scaricati per l'uso senza rete`); }}><Scarica size={14} aria-hidden /> Scarica</button>}
          </div>
          <button type="button" onClick={onDopo} className="card h-44 w-[62%] shrink-0 snap-start p-4 text-left">
            <p className="text-small text-fg-muted">Ultima ispezione</p>
            <p className="text-h2 font-light text-fg">{ultima ? dataIt(ultima.data, true) : 'Nessuna'}</p>
            <p className="mt-2 text-caption text-fg-muted">{ultima ? `${ultima.ente} · ${ultima.esitoTesto.toLowerCase()}` : 'Qui trovi lo storico'}</p>
          </button>
        </div>
      </section>
    </div>
  );
}

/** Pulsante grande: tenere premuto 1 secondo apre la richiesta, il tocco breve la conferma (regole 12.1). */
function PulsanteLungo({ onTocco, onLungo }: { onTocco: () => void; onLungo: () => void }) {
  const anello = useRef<SVGCircleElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scattato = useRef(false);
  const C = 2 * Math.PI * 128;
  const anima = (da: number, a: number, ms: number) => {
    const el = anello.current;
    if (!el?.animate) return;
    el.animate([{ strokeDashoffset: da }, { strokeDashoffset: a }], { duration: ms, easing: ms > 500 ? 'linear' : 'ease-out', fill: 'forwards' });
  };
  const giu = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scattato.current = false;
    anima(C, 0, 1000);
    timer.current = setTimeout(() => {
      scattato.current = true;
      navigator.vibrate?.(40);
      setTimeout(() => anima(0, C, 1), 400);
      onLungo();
    }, 1000);
  };
  const su = (apri: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (scattato.current) return;
    anima(C / 2, C, 220);
    if (apri) onTocco();
  };
  return (
    <div className="flex flex-col items-center">
      <div className="relative mt-7 grid size-[17rem] place-items-center">
        <svg viewBox="0 0 272 272" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="136" cy="136" r="128" fill="none" stroke="#232326" strokeWidth="6" />
          <circle ref={anello} cx="136" cy="136" r="128" fill="none" stroke="#d4ff3a" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
        </svg>
        <button
          type="button"
          aria-label="Ho un controllo in corso: tieni premuto un secondo, oppure tocca e conferma"
          className="relative grid size-60 touch-none select-none place-items-center rounded-full bg-acid-400 text-acid-950 shadow-[0_0_0_10px_#000,0_0_60px_#d4ff3a] transition-transform active:scale-[.97]"
          style={{ WebkitTouchCallout: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={giu}
          onPointerUp={() => su(true)}
          onPointerCancel={() => su(false)}
          onClick={(e) => {
            if (e.detail === 0) onTocco();
          }}
        >
          <span className="flex flex-col items-center gap-2 px-6 text-center">
            <ScudoAllerta size={40} aria-hidden />
            <span className="text-h2">Ho un controllo in corso</span>
          </span>
        </button>
      </div>
      <p className="mt-4 text-center text-small text-grafite-400">Tieni premuto 1 secondo, oppure tocca e conferma</p>
    </div>
  );
}

function FoglioRichiesta({ aperto, largo, dati, aziendaId, onChiudi, onFatto }: { aperto: boolean; largo: boolean; dati: SezioneIspezioni; aziendaId: number; onChiudi: () => void; onFatto: () => void }) {
  const [passo, setPasso] = useState(0);
  const [enti, setEnti] = useState<string[]>([]);
  const [tel, setTel] = useState(dati.ultimoTelefono ?? '');
  const [ispettore, setIspettore] = useState('');
  const [nota, setNota] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [occupato, setOccupato] = useState(false);
  useEffect(() => {
    if (!aperto) return;
    setPasso(0);
    setEnti([]);
    setErr({});
    setTel(dati.ultimoTelefono ?? '');
  }, [aperto, dati.ultimoTelefono]);
  const erroreEnti = largo ? 'Scegli almeno un ente.' : 'Scegli chi è in azienda.';
  const invia = async () => {
    const e: Record<string, string> = {};
    if (enti.length === 0) e.enti = erroreEnti;
    if (cifre(tel) < 9) e.telefono = 'Serve un numero di telefono per richiamarti, almeno 9 cifre.';
    setErr(e);
    if (e.enti && !largo) return setPasso(0);
    if (Object.keys(e).length) return;
    setOccupato(true);
    try {
      const r = await chiediRichiamata(aziendaId, { enti, telefono: tel, ispettore, nota });
      toast(r.messaggio || 'Richiesta inviata: ti richiamiamo entro 15 minuti');
      onFatto();
    } catch (x) {
      setErr(x instanceof ErroreCampi ? x.campi : { generale: x instanceof Error ? x.message : 'Non riuscito' });
    } finally {
      setOccupato(false);
    }
  };
  const sceltaEnti = (
    <div>
      {!largo && <p className="mb-3 text-[15px] text-fg-muted">Tocca uno o più enti: a volte arrivano insieme. Se non lo sai, scegli &quot;Altro ente&quot;.</p>}
      <div className="grid grid-cols-2 gap-2">
        {ENTI.map((x, i) => {
          const on = enti.includes(x.k);
          return (
            <button key={x.k} type="button" role="checkbox" aria-checked={on} onClick={() => setEnti(on ? enti.filter((k) => k !== x.k) : [...enti, x.k])}
              className={clsx('slot min-h-[5.5rem] flex-col items-start p-3.5 text-left', i === 4 && 'col-span-2', on && 'ring-2 ring-black')}>
              <span className="flex flex-col items-start">
                <span className="text-[15px] font-medium text-fg">{x.t}</span>
                <span className="text-caption text-fg-muted">{x.sotto}</span>
              </span>
            </button>
          );
        })}
      </div>
      {err.enti && <p className="mt-2 text-[12.5px] text-[#d63d3e]">{err.enti}</p>}
    </div>
  );
  const richiamata = (
    <div className="space-y-4">
      {!largo && <h3 className="text-h3 text-fg">Come ti richiamiamo</h3>}
      <Campo etichetta="Numero per la richiamata" aiuto="Ti chiama un tecnico entro 15 minuti." errore={err.telefono}>
        <input className={CAMPO} type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
      </Campo>
      <Campo etichetta="Nome dell'ispettore (facoltativo)">
        <input className={CAMPO} value={ispettore} onChange={(e) => setIspettore(e.target.value)} placeholder="Se lo sai" />
      </Campo>
      <Campo etichetta="Nota (facoltativa)">
        <textarea className="block min-h-[64px] w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-base" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Es. controllano il reparto saldatura" />
      </Campo>
      <AvvisoRegistrazione />
    </div>
  );
  return (
    <Foglio
      aperto={aperto}
      onChiudi={onChiudi}
      titolo="Chi è in azienda?"
      sopra={largo ? 'Pronto Ispezioni' : `Pronto Ispezioni · passo ${passo + 1} di 2`}
      piede={
        largo ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>
            <button type="button" className="btn btn-accent" disabled={occupato} onClick={() => void invia()}>Chiedi la richiamata</button>
          </>
        ) : passo === 0 ? (
          <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => (enti.length ? (setErr({}), setPasso(1)) : setErr({ enti: erroreEnti }))}>Avanti <Avanti size={16} aria-hidden /></button>
        ) : (
          <>
            <button type="button" aria-label="Indietro" className="btn btn-secondary btn-lg w-[52px] px-0" onClick={() => setPasso(0)}><Indietro size={18} aria-hidden /></button>
            <button type="button" className="btn btn-accent btn-lg flex-1" disabled={occupato} onClick={() => void invia()}>Chiedi la richiamata</button>
          </>
        )
      }
    >
      {!largo && (
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1].map((i) => <span key={i} className={clsx('h-1.5 flex-1 rounded-full', i <= passo ? 'bg-grafite-900' : 'bg-sunken')} />)}
        </div>
      )}
      {err.generale && <Avviso tono="danger">{err.generale}</Avviso>}
      {largo ? (
        <>
          {sceltaEnti}
          {richiamata}
        </>
      ) : passo === 0 ? (
        sceltaEnti
      ) : (
        richiamata
      )}
    </Foglio>
  );
}

function AvvisoRegistrazione() {
  return (
    <div className="flex gap-3 rounded-[1rem] bg-sunken p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-black text-acid-400"><Microfono size={16} aria-hidden /></span>
      <div className="space-y-1 text-small">
        <p className="font-medium text-fg">La chiamata con il tecnico viene registrata</p>
        <p className="text-fg-muted">L&apos;assistente prende appunti al posto tuo: cosa chiede l&apos;ispettore, cosa hai mostrato, cosa resta da fare. Così non devi scrivere niente e il tecnico ha tutto per aiutarti con il verbale.</p>
        <p className="text-fg-muted">La registrazione resta nel fascicolo e la vede solo ISFOR.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- in corso

function InCorso({ largo, dati, onDocumenti, onFine }: { largo: boolean; dati: SezioneIspezioni; onDocumenti: () => void; onFine: () => void }) {
  const a = dati.attiva!;
  const [ora, setOra] = useState(Date.now());
  useEffect(() => {
    if (a.fase >= 2) return;
    const t = setInterval(() => setOra(Date.now()), 1000);
    return () => clearInterval(t);
  }, [a.fase]);
  const resto = secondiRimasti(a.inizio, dati.minuti, ora);
  const cognome = (a.tecnico ?? '').replace(/^(ing\.|dott\.?|geom\.)\s+/i, '');
  const fasi = a.fase >= 2 ? 3 : a.fase;
  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] bg-black p-5 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-acid-400 px-3 py-1 text-small text-acid-950">
            <span className="size-2 animate-pulse rounded-full bg-acid-950" /> Ispezione in corso
          </span>
          <span className="text-small text-grafite-400">dalle {a.inizio ? new Date(a.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <p className="mt-2 text-small text-grafite-400">{a.entiNomi}{a.ispettore ? ` · ${a.ispettore}` : ''}</p>
        <p className="mt-4 text-title text-grafite-400">{a.finita ? 'Chiamata finita con' : a.fase >= 2 ? (largo ? 'Sei in chiamata con il tecnico' : 'Sei in chiamata con') : 'Ti richiama un tecnico entro'}</p>
        {a.fase < 2 ? (
          <>
            <p className="cifre text-[6.5rem] font-light leading-none text-acid-400">{mmss(resto)}</p>
            {!largo && <div className="mt-3 h-1.5 rounded-full bg-grafite-800"><div className="h-full rounded-full bg-acid-400" style={{ width: `${Math.min(100, ((dati.minuti * 60 - resto) / (dati.minuti * 60)) * 100)}%` }} /></div>}
          </>
        ) : (
          <p className="text-[44px] leading-tight text-acid-400">{cognome || 'il tecnico'}</p>
        )}
        {a.fase >= 2 && !a.finita && dati.attiva && (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-grafite-800 px-3 py-1 text-small">
            <span className="size-2 animate-pulse rounded-full bg-[#ef4444]" /> <Microfono size={14} aria-hidden /> Registrazione e appunti attivi
          </span>
        )}
        <p className="mt-3 text-small text-grafite-400">
          {a.finita ? `${a.durata ?? 0} minuti al numero ${a.telefono ?? ''}. Gli appunti della chiamata sono qui sotto.` : `Al numero ${a.telefono ?? ''}. Tieni il telefono a portata di mano.`}
        </p>
        <ol className="mt-4 space-y-3 border-t border-grafite-800 pt-4">
          {FASI.map((f, i) => (
            <li key={f} className="flex items-center gap-3">
              <span className={clsx('grid size-9 place-items-center rounded-full', i < fasi ? 'bg-acid-400 text-acid-950' : i === fasi ? 'bg-white text-black' : 'bg-grafite-800 text-grafite-500')}>
                {i < fasi ? <Spunta size={16} aria-hidden /> : i === fasi ? <Rotore size={16} aria-hidden className="animate-spin" /> : i + 1}
              </span>
              <span>
                <span className={clsx('block text-[15px]', i > fasi && 'text-grafite-500')}>{f}</span>
                {i === 1 && a.fase >= 1 && a.tecnico && <span className="block text-caption text-grafite-400">{a.tecnico}, tecnico di turno</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {a.finita && a.appunti && <RiquadroAppunti a={a.appunti} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onDocumenti} className="flex h-16 items-center justify-between rounded-[1.5rem] bg-acid-400 px-5 text-acid-950">
          <span className="flex items-center gap-2 font-medium"><Documento size={18} aria-hidden /> Documenti da mostrare</span>
          <span className="text-small">{dati.documenti.pronti}/{dati.documenti.totale} pronti</span>
        </button>
        <button type="button" className="btn btn-secondary btn-lg h-16" onClick={onFine}>L&apos;ispezione è finita</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Elenco titolo="Cosa fare" voci={COSA_FARE} icona={<CerchioSpunta size={18} aria-hidden className="text-ok-mark" />} />
        <Elenco titolo="Cosa non fare" voci={COSA_NON_FARE(largo)} icona={<Cerchio size={18} aria-hidden className="text-danger-mark" />} />
      </div>
      {!largo && a.nota && <Elenco titolo="La tua nota" voci={[a.nota]} icona={<Documento size={18} aria-hidden />} />}
    </div>
  );
}

function Elenco({ titolo, voci, icona }: { titolo: string; voci: string[]; icona: ReactNode }) {
  return (
    <details className="card p-5" open={titolo === 'Cosa fare'}>
      <summary className="cursor-pointer text-title text-fg">{titolo} <span className="text-small font-normal text-fg-muted">· {voci.length} cose</span></summary>
      <ul className="mt-3 space-y-2">
        {voci.map((v) => (
          <li key={v} className="flex gap-2 text-[15px] text-fg">{icona}<span>{v}</span></li>
        ))}
      </ul>
    </details>
  );
}

function RiquadroAppunti({ a }: { a: Appunti }) {
  return (
    <section className="card space-y-3 p-5">
      <h3 className="text-title text-fg">Appunti della chiamata</h3>
      <p className="text-small text-fg-muted">Con {a.tecnico} alle {a.ora} · {a.durata} minuti · {a.enti}</p>
      <ul className="space-y-2">
        {a.punti.map((p, i) => (
          <li key={i} className="flex gap-3 rounded-[1rem] p-3 ring-1 ring-line">
            <span className={clsx('mt-0.5 size-7 shrink-0 rounded-full', p.tipo === 'fare' ? 'bg-acid-400' : 'bg-sunken')} aria-hidden />
            <span>
              <span className="block text-caption text-fg-muted">{TIPI_APPUNTO[p.tipo] ?? p.tipo}</span>
              <span className="block text-[15px] text-fg">{p.testo}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-fg-muted">Scritti dall&apos;assistente dalla registrazione. La registrazione resta nel fascicolo e la vede solo ISFOR.</p>
    </section>
  );
}

// ---------------------------------------------------------------- documenti

function Documenti({ dati }: { dati: SezioneIspezioni }) {
  const [offline, setOffline] = useState(false);
  const mancanze = dati.documenti.voci.filter((v) => !['conforme', 'in_scadenza'].includes(v.esito));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-small text-fg-muted">Documenti pronti da mostrare</p>
        <p className="text-[34px] font-light text-fg">{dati.documenti.pronti}<span className="text-fg-faint">/{dati.documenti.totale}</span></p>
        <p className="text-small text-fg-muted">{offline ? 'Scaricati su questo telefono: li apri anche senza rete.' : 'Scaricali prima: nei capannoni spesso la rete non prende.'}</p>
      </div>
      {offline ? (
        <div className="flex items-center justify-between rounded-[1.5rem] p-4 ring-1 ring-line"><span className="text-[15px] text-fg">Disponibili senza rete</span><Chip stato="ok">Scaricati</Chip></div>
      ) : (
        <button type="button" className="flex h-16 w-full items-center justify-center gap-2 rounded-[1.5rem] bg-acid-400 font-medium text-acid-950" onClick={() => { setOffline(true); toast(`${dati.documenti.totale} documenti scaricati per l'uso senza rete`); }}>
          <Scarica size={18} aria-hidden /> Scarica tutto per l&apos;uso senza rete
        </button>
      )}
      {mancanze.length > 0 && (
        <section>
          <p className="text-caption uppercase text-fg-muted">Da sistemare · {mancanze.length}</p>
          <ul className="card mt-2 divide-y divide-line">
            {mancanze.map((m) => (
              <li key={m.voce} className="p-4">
                <p className="text-[15px] font-medium text-fg">{m.voce}</p>
                {m.messaggio && <p className="text-small text-fg-muted">{m.messaggio}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-title text-fg">Tutti i documenti</h2>
        <ul className="card mt-2 divide-y divide-line">
          {dati.documenti.voci.map((v) => {
            const ok = ['conforme', 'in_scadenza'].includes(v.esito);
            return (
              <li key={v.voce} className="flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-full bg-sunken"><Documento size={18} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-fg">{v.voce}</span>
                  {offline && <span className="block text-caption text-fg-muted">Offline</span>}
                </span>
                <Chip stato={ok ? 'ok' : 'warn'}>{ok ? 'Pronto' : 'Da aggiornare'}</Chip>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="card p-4">
        <p className="text-[15px] font-medium text-fg">Le visite: solo date</p>
        <p className="text-small text-fg-muted">All&apos;ispettore mostri che la visita è valida e fino a quando. Esiti e giudizi li ha il medico competente.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dopo l'ispezione

function Dopo({ dati, onCarica, onApri }: { dati: SezioneIspezioni; onCarica: () => void; onApri: (id: number) => void }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] bg-acid-400 p-5 text-acid-950">
        <span className="grid size-12 place-items-center rounded-full bg-black text-acid-400"><Documento size={20} aria-hidden /></span>
        <h2 className="mt-3 text-h2">Carica il verbale</h2>
        <p className="mt-1 text-[15px] opacity-80">Fotografa il verbale che ti ha lasciato l&apos;ispettore. L&apos;assistente lo trascrive subito e ti dice cosa va sistemato; il tecnico lo rilegge entro 2 giorni lavorativi.</p>
        {dati.puoAttivare && (
          <button type="button" className="btn btn-lg mt-4 w-full bg-black text-acid-400" onClick={onCarica}>
            <Fotocamera size={18} aria-hidden /> Carica il verbale
          </button>
        )}
      </section>
      {dati.storico.length === 0 ? (
        <Vuoto titolo="Nessuna ispezione registrata" />
      ) : (
        <section>
          <h2 className="text-title text-fg">Storico delle ispezioni</h2>
          <ul className="card mt-2 divide-y divide-line">
            {dati.storico.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => onApri(i.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-sunken">
                  <span className="grid size-10 place-items-center rounded-full bg-sunken">{i.verbale ? <CerchioSpunta size={18} aria-hidden /> : <Documento size={18} aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-fg">{i.ente}</span>
                    <span className="block text-caption text-fg-muted">{dataIt(i.data)}{i.daSistemare > 0 ? ` · ${i.daSistemare} da sistemare` : i.nota ? ` · ${i.nota}` : ''}</span>
                  </span>
                  <Chip stato={chipEsito(i.esito)}>{i.esitoTesto}</Chip>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-caption text-fg-muted">I verbali restano nel fascicolo, cartella Valutazione dei rischi.</p>
    </div>
  );
}

function FoglioVerbale({ aperto, largo, dati, aziendaId, onChiudi, onFatto }: { aperto: boolean; largo: boolean; dati: SezioneIspezioni; aziendaId: number; onChiudi: () => void; onFatto: () => void }) {
  const iniziali = dati.attiva?.enti.length ? dati.attiva.enti : ['ASL'];
  const oggi = new Date().toISOString().slice(0, 10);
  const [passo, setPasso] = useState(0);
  const [file, setFile] = useState<string | null>(null);
  const [bozza, setBozza] = useState<string | null>(null);
  const [lettura, setLettura] = useState<Lettura | null>(null);
  const [leggendo, setLeggendo] = useState(false);
  const [compilato, setCompilato] = useState(false);
  const [esito, setEsito] = useState<Esito>('nessuna');
  const [enti, setEnti] = useState<string[]>(iniziali);
  const [data, setData] = useState(oggi);
  const [nota, setNota] = useState(dati.attiva?.nota ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const [fatto, setFatto] = useState<{ titolo: string; messaggio: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!aperto) return;
    setPasso(0); setFile(null); setBozza(null); setLettura(null); setCompilato(false); setEsito('nessuna'); setEnti(dati.attiva?.enti.length ? dati.attiva.enti : ['ASL']); setData(oggi); setNota(dati.attiva?.nota ?? ''); setErr({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);
  const scegli = async (f: File | null) => {
    if (!f) return;
    setFile(f.name);
    setLeggendo(true);
    setErr({});
    try {
      const r = await leggiVerbale(aziendaId, f, enti);
      setBozza(r.bozza);
      setLettura(r.lettura);
      if (r.lettura) {
        setEsito(r.lettura.esito);
        // Telefono: compila esito ed enti; computer: solo l'esito (la data mai).
        if (!largo && r.lettura.enti.length) setEnti(r.lettura.enti);
        setCompilato(true);
      }
    } catch (x) {
      setFile(null);
      setErr({ verbale: x instanceof Error ? x.message : 'Caricamento non riuscito' });
    } finally {
      setLeggendo(false);
    }
  };
  const salva = async () => {
    const e: Record<string, string> = {};
    if (enti.length === 0) e.enti = 'Scegli almeno un ente.';
    if (!bozza && esito !== 'in_attesa') e.verbale = 'Carica il verbale, oppure scegli «In attesa del verbale» se non te l\'hanno ancora lasciato.';
    setErr(e);
    if (e.verbale && !largo) setPasso(0);
    if (Object.keys(e).length) return;
    try {
      setFatto(await salvaVerbale(aziendaId, { enti, esito, data, nota, bozza }));
    } catch (x) {
      setErr(x instanceof ErroreCampi ? x.campi : { generale: x instanceof Error ? x.message : 'Non riuscito' });
    }
  };
  const caricaFile = (
    <div className="space-y-3">
      <input ref={input} type="file" accept=".pdf,image/*" capture="environment" className="sr-only" onChange={(e) => void scegli(e.target.files?.[0] ?? null)} />
      <div className="rounded-[1.5rem] border-2 border-dashed border-line p-6 text-center">
        <span className={clsx('mx-auto grid size-14 place-items-center rounded-full', file ? 'bg-black text-acid-400' : 'bg-acid-400 text-acid-950')}>{file ? <Spunta size={22} aria-hidden /> : <Fotocamera size={22} aria-hidden />}</span>
        <p className="mt-3 text-[15px] font-medium text-fg">{file ?? 'Fai una foto o scegli il PDF'}</p>
        <p className="text-small text-fg-muted">{file ? 'Pronto da salvare' : 'Lo legge l\'assistente e compila il resto.'}</p>
        {!file && <button type="button" className="btn btn-primary mt-4" onClick={() => input.current?.click()}><Scarica size={16} aria-hidden className="rotate-180" /> Scegli il file</button>}
      </div>
      {err.verbale && <p className="text-[12.5px] text-[#d63d3e]">{err.verbale}</p>}
      {leggendo && (
        <div className="flex items-center gap-3 rounded-[1rem] bg-sunken p-4" aria-live="polite">
          <span className="grid size-9 place-items-center rounded-full bg-black text-acid-400"><Rotore size={16} aria-hidden className="animate-spin" /></span>
          <span>
            <span className="block text-small font-medium text-fg">Sto leggendo il verbale…</span>
            <span className="block text-caption text-fg-muted">Ente, ispettori, cosa hanno controllato e cosa va sistemato</span>
          </span>
        </div>
      )}
      {lettura && <RiquadroLettura l={lettura} />}
      {file && !leggendo && !lettura && <p className="text-small text-fg-muted">Non sono riuscito a leggerlo: salvalo lo stesso, il tecnico lo rilegge entro 2 giorni lavorativi.</p>}
      {!largo && !file && (
        <button type="button" className="text-small text-fg-muted underline" onClick={() => { setEsito('in_attesa'); setPasso(1); }}>Non me l&apos;hanno ancora lasciato</button>
      )}
    </div>
  );
  const controlla = (
    <div className="space-y-4">
      {compilato && <p className="text-small text-fg-muted">{largo ? 'Esito letto dal verbale, controlla.' : 'Compilato dal verbale: cambia solo se qualcosa non torna.'}</p>}
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-fg">{largo && compilato ? 'Esito · letto dal verbale, controlla' : 'Esito'}</legend>
        <div className="grid grid-cols-2 gap-2">
          {ESITI.map((x) => (
            <button key={x.k} type="button" role="radio" aria-checked={esito === x.k} onClick={() => setEsito(x.k)} className={clsx('slot min-h-14 p-3 text-left text-small', esito === x.k && 'ring-2 ring-black')}>{x.t}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-fg">Enti</legend>
        <div className="grid grid-cols-2 gap-2">
          {ENTI.map((x, i) => {
            const on = enti.includes(x.k);
            return (
              <button key={x.k} type="button" role="checkbox" aria-checked={on} onClick={() => setEnti(on ? enti.filter((k) => k !== x.k) : [...enti, x.k])} className={clsx('slot min-h-12 p-3 text-left text-small', i === 4 && 'col-span-2', on && 'ring-2 ring-black')}>{x.t}</button>
            );
          })}
        </div>
        {err.enti && <p className="mt-1 text-[12.5px] text-[#d63d3e]">{err.enti}</p>}
      </fieldset>
      <Campo etichetta="Data dell'ispezione" errore={err.data}>
        <input type="date" max={oggi} className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Campo etichetta="Cosa è successo (facoltativo)">
        <textarea className="block min-h-[80px] w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-base" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Es. hanno controllato estintori e attestati" />
      </Campo>
    </div>
  );
  return (
    <>
      <Foglio
        aperto={aperto && !fatto}
        largo={largo}
        onChiudi={onChiudi}
        titolo="Carica il verbale"
        sopra={largo ? 'Dopo l\'ispezione' : `Dopo l'ispezione · passo ${passo + 1} di 2`}
        piede={
          largo || passo === 1 ? (
            <>
              {largo ? <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button> : <button type="button" aria-label="Indietro" className="btn btn-secondary btn-lg w-[52px] px-0" onClick={() => setPasso(0)}><Indietro size={18} aria-hidden /></button>}
              <button type="button" className="btn btn-primary btn-lg" disabled={leggendo} onClick={() => void salva()}><Spunta size={16} aria-hidden /> Salva</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-lg w-full" disabled={leggendo} onClick={() => setPasso(1)}>Avanti <Avanti size={16} aria-hidden /></button>
          )
        }
      >
        {err.generale && <Avviso tono="danger">{err.generale}</Avviso>}
        {largo ? <>{caricaFile}{controlla}</> : passo === 0 ? caricaFile : controlla}
      </Foglio>
      <Foglio aperto={fatto !== null} onChiudi={() => { setFatto(null); onFatto(); }} titolo={fatto?.titolo ?? ''} piede={<button type="button" className="btn btn-primary" onClick={() => { setFatto(null); onFatto(); }}>Fatto</button>}>
        <p className="text-body text-fg-muted">{fatto?.messaggio}</p>
      </Foglio>
    </>
  );
}

function RiquadroLettura({ l, idIspezione, puoSistemare, onSistemata }: { l: Lettura; idIspezione?: number; puoSistemare?: boolean; onSistemata?: () => void }) {
  return (
    <section className="space-y-3 rounded-[1rem] p-4 ring-1 ring-line">
      <p className="text-small font-medium text-fg">Letto dal verbale</p>
      <div className="divide-y divide-line text-small">
        {l.numero && <Riga k="Verbale" v={`n. ${l.numero}`} />}
        {l.data && <Riga k="Data" v={`${dataIt(l.data)}${l.ore ? ` · ${l.ore}` : ''}`} />}
        {l.ispettori.length > 0 && <Riga k="Ispettori" v={<>{l.ispettori.map((x) => <span key={x} className="block">{x}</span>)}</>} />}
        {l.firmatoDa && <Riga k="Firmato da" v={l.firmatoDa} />}
      </div>
      {l.guardato.length > 0 && (
        <div>
          <p className="text-small text-fg-muted">Cosa hanno controllato</p>
          <ul className="mt-1 space-y-1">{l.guardato.map((g) => <li key={g} className="flex gap-2 text-small text-fg"><Spunta size={14} aria-hidden className="mt-0.5 text-fg-faint" />{g}</li>)}</ul>
        </div>
      )}
      {l.rilievi.length > 0 ? (
        <div className="space-y-2">
          <p className="text-small font-medium text-fg">{l.rilievi.length === 1 ? 'Cosa va sistemato' : `Cosa va sistemato · ${l.rilievi.length} punti`}</p>
          {l.rilievi.map((r, i) => (
            <div key={i} className={clsx('flex gap-3 rounded-[1rem] p-3 ring-1 ring-line', r.fatto && 'opacity-60')}>
              <span className={clsx('grid size-7 shrink-0 place-items-center rounded-full text-caption', r.fatto ? 'bg-grafite-900 text-white' : 'bg-stato-warn text-stato-warn-ink')}>{r.fatto ? <Spunta size={14} aria-hidden /> : i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-fg">{r.testo}</p>
                <p className="text-caption text-fg-muted">{nomeEnte(r.ente)}{r.norma ? ` · ${r.norma}` : ''}</p>
                <p className="text-small font-medium text-fg">{r.fatto ? 'Sistemato' : r.entro ? `Entro il ${dataIt(r.entro)} · ${traGiorni(r.entro)}` : 'Termine da leggere sul verbale'}</p>
                {idIspezione && puoSistemare && !r.fatto && (
                  <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={async () => { try { const x = await segnaSistemata(idIspezione, i); toast(x.messaggio); onSistemata?.(); } catch (e) { toast(e instanceof Error ? e.message : 'Non riuscito', 'avviso'); } }}>
                    <Spunta size={14} aria-hidden /> Segna come sistemato
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-[1rem] bg-sunken p-3 text-small text-fg"><CerchioSpunta size={16} aria-hidden /> Nessuna irregolarità scritta nel verbale.</p>
      )}
      {l.testo.length > 0 && (
        <details className="rounded-[1rem] bg-sunken p-3">
          <summary className="cursor-pointer text-small font-medium text-fg">Testo trascritto</summary>
          <div className="mt-2 space-y-2 text-small text-fg">{l.testo.map((p, i) => <p key={i}>{p}</p>)}</div>
        </details>
      )}
      <p className="text-caption text-fg-muted">Trascritto dall&apos;assistente: controlla che corrisponda al foglio. Il tecnico ISFOR lo rilegge e ti dice cosa fare entro 2 giorni lavorativi.</p>
    </section>
  );
}

function Riga({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-fg-muted">{k}</span>
      <span className="text-right font-medium text-fg">{v}</span>
    </div>
  );
}

function FoglioDettaglio({ id, onChiudi, onCambio }: { id: number | null; onChiudi: () => void; onCambio: () => void }) {
  const [i, setI] = useState<IspezioneStorico | null>(null);
  const carica = useCallback(() => {
    if (id !== null) dettaglioVerbale(id).then(setI).catch(() => setI(null));
  }, [id]);
  useEffect(() => {
    setI(null);
    carica();
  }, [carica]);
  return (
    <Foglio aperto={id !== null} largo onChiudi={onChiudi} titolo={i ? `Verbale del ${dataIt(i.data)}` : 'Verbale'} sopra={i?.ente}
      piede={
        <>
          {i?.verbale && <button type="button" className="btn btn-secondary btn-lg" onClick={() => void scaricaFile(percorsoFileVerbale(i.id), `Verbale ${dataIt(i.data)}.pdf`, 'Il verbale non è più disponibile.')}><Scarica size={16} aria-hidden /> Scarica il verbale</button>}
          <button type="button" className="btn btn-ghost" onClick={onChiudi}>Chiudi</button>
        </>
      }>
      {!i && <Caricamento />}
      {i && (i.trascrizione ? <RiquadroLettura l={i.trascrizione} idIspezione={i.id} puoSistemare={i.puoSistemare} onSistemata={() => { carica(); onCambio(); }} /> : <p className="text-small text-fg-muted">Il verbale non è ancora stato caricato.</p>)}
      {i?.appunti && (
        <div className="border-t border-line pt-4">
          <RiquadroAppunti a={i.appunti} />
        </div>
      )}
    </Foglio>
  );
}
