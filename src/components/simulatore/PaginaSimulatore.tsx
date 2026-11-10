'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { percorso } from '@/lib/percorso';
import { clsx } from '@/lib/clsx';
import { AvatarFalco } from '@/components/portale/FalcoSezione';
import { Chiudi, Ferma, Invia, Microfono, Piu, Rotore } from '@/components/icone';
import { PannelloConfronto } from './PannelloConfronto';
import { Presentazione } from '@/components/ingresso/Presentazione';
import { DEMO_LIVE } from '@/lib/demo/attivo';
import type { ModoAccesso } from '@/components/auth/Accesso';
import { BloccoFatture } from './BloccoFatture';
import { usaDettatura } from './dettatura';
import {
  aggiornaSimulazione,
  caricaFatturaPubblica,
  chiediFalco,
  confermaFatturaPubblica,
  configurazioneSimulatore,
  eliminaFatturaPubblica,
  inviaContatto,
  nuovaSimulazione,
  simulazione as apriSimulazione,
} from '@/lib/portale/simulatore-api';
import { euroC, telefonoValido, type Domanda, type Risultato, type Simulazione, type Vista } from '@/lib/portale/simulatore-logica';
import { leggiAdAltaVoce } from '@/lib/agente-voce';

/**
 * Il simulatore di costo come banco di lavoro del Falco. Il visitatore scrive o
 * detta una riga sull'azienda; il Falco compila il simulatore davanti a lui,
 * casella per casella, dicendo in una riga da dove prende ogni dato, e il conto
 * si ricalcola. Ogni casella resta un comando vero: si corregge a mano e il
 * conto si aggiorna. Le domande che mancano compaiono nel riquadro del Falco,
 * una alla volta, con la casella interessata evidenziata.
 */

/**
 * La simulazione resta solo nella scheda aperta di questo browser: chi riceve
 * il link parte da zero, e chiudendo la scheda si riparte puliti.
 */
const TOKEN_KEY = 'crm_dvr_simulatore_token';

const SALUTO = 'Dimmi cosa fa la tua azienda e quanti siete. Il simulatore lo compilo io.';

function leggiToken(): string | null {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function scriviToken(t: string | null): void {
  try {
    if (t) window.sessionStorage.setItem(TOKEN_KEY, t);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* comodità del browser */
  }
}
const ESEMPI = ['Ho una trattoria con 12 dipendenti', 'Officina meccanica con 6 operai', 'Studio con 4 impiegati'];

type Casella = 'attivita' | 'lavoratori' | 'visita' | 'alimenti' | 'enti';
const ORDINE: Casella[] = ['attivita', 'lavoratori', 'visita', 'alimenti', 'enti'];
const CASELLA_DI: Record<string, Casella> = { attivita: 'attivita', rischio: 'attivita', lavoratori: 'lavoratori', con_visita: 'visita', sedi_alimentari: 'alimenti', ebiasp: 'enti', fondo: 'enti', socio: 'enti' };
const RISCHIO: Record<string, string> = { basso: 'Rischio basso', medio: 'Rischio medio', alto: 'Rischio alto' };

function senzaMovimento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const attesa = (ms: number) => new Promise((r) => setTimeout(r, senzaMovimento() ? 0 : ms));

/** Numero che sale fino al valore (si muove solo il testo). */
function useConta(valore: number | null): number | null {
  const [v, setV] = useState<number | null>(valore);
  const da = useRef<number>(0);
  useEffect(() => {
    if (valore === null) {
      setV(null);
      return undefined;
    }
    if (senzaMovimento()) {
      setV(valore);
      da.current = valore;
      return undefined;
    }
    const inizio = performance.now();
    const partenza = da.current;
    let id = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inizio) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(partenza + (valore - partenza) * e));
      if (k < 1) id = requestAnimationFrame(passo);
      else da.current = valore;
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [valore]);
  return v;
}

function useLargo(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setV(mq.matches);
    const f = (e: MediaQueryListEvent) => setV(e.matches);
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  return v;
}

/** La riga che il Falco dice mentre compila una casella. */
export function fraseCasella(c: Casella, r: Risultato): string {
  const p = r.profilo;
  const perche = (k: string): string | undefined => p.presunti[k];
  switch (c) {
    case 'attivita':
      return perche('rischio') ?? `${p.attivita ?? 'Attività'}: ${(RISCHIO[p.rischio] ?? 'rischio da verificare').toLowerCase()}.`;
    case 'lavoratori':
      return `${p.lavoratori} lavoratori: il conto lo faccio per ciascuno di loro.`;
    case 'visita':
      return perche('con_visita') ?? `${p.conVisita} con visita medica, ${p.senzaVisita} senza.`;
    case 'alimenti':
      return perche('sedi_alimentari') ?? (p.sediAlimentari > 0 ? 'Si trattano alimenti: aggiungo il piano HACCP.' : 'Niente alimenti: nessun piano HACCP.');
    case 'enti':
      return 'Parto dal caso più caro, senza adesioni. Se aderisci, il canone scende.';
  }
}

/**
 * `accesso` riceve la strada da aprire: "crea" per il cliente nuovo, "accedi" per chi ha gia' un account.
 * Senza `accesso` (pagina /simulatore) i pulsanti portano all'ingresso dell'app.
 */
export function PaginaSimulatore({
  accesso,
  accessoAperto = false,
  modoAperto = 'accedi',
}: { accesso?: (modo: ModoAccesso) => ReactNode; accessoAperto?: boolean; modoAperto?: ModoAccesso } = {}) {
  const largo = useLargo();
  const [entra, setEntra] = useState(accessoAperto);
  const [modoAccesso, setModoAccesso] = useState<ModoAccesso>('accedi');
  const apriAccesso = (m: ModoAccesso) => {
    setModoAccesso(m);
    setEntra(true);
  };
  const [sim, setSim] = useState<Simulazione | null>(null);
  const [visto, setVisto] = useState<Set<Casella>>(new Set());
  const [attiva, setAttiva] = useState<Casella | null>(null);
  const [pensiero, setPensiero] = useState(SALUTO);
  const [testo, setTesto] = useState('');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('regime');
  const [contatto, setContatto] = useState(false);
  const [dettaglio, setDettaglio] = useState(false);
  const [informativa, setInformativa] = useState('');
  const apriFattura = useRef<(() => void) | null>(null);
  const banco = useRef<HTMLElement>(null);

  useEffect(() => {
    if (accessoAperto) apriAccesso(modoAperto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessoAperto, modoAperto]);

  useEffect(() => {
    configurazioneSimulatore()
      .then((c) => setInformativa(c.informativa))
      .catch(() => undefined);
    const t = leggiToken();
    if (t) {
      apriSimulazione(t)
        .then((s) => {
          if (!s.risultato) return;
          setSim(s);
          setVisto(new Set(ORDINE));
          setPensiero('Ho ripreso la tua simulazione. Scrivimi altro qui sotto o cambia le caselle; per un caso diverso premi Nuova simulazione.');
        })
        .catch(() => undefined);
    }
  }, []);

  const salvaToken = (s: Simulazione) => scriviToken(s.token);

  /** Nuova prova: si dimentica la simulazione di questa scheda e si riparte. */
  const nuova = () => {
    scriviToken(null);
    setSim(null);
    setVisto(new Set());
    setAttiva(null);
    setContatto(false);
    setDettaglio(false);
    setErrore(null);
    setTesto('');
    setPensiero(SALUTO);
  };

  /** Il Falco compila le caselle una alla volta, poi compare il conto. */
  const compila = useCallback(
    async (s: Simulazione, chiusura: string | null) => {
      const r = s.risultato;
      if (!r) return;
      setSim(s);
      setVisto(new Set());
      if (!largo) banco.current?.scrollIntoView({ behavior: senzaMovimento() ? 'auto' : 'smooth', block: 'start' });
      for (const c of ORDINE) {
        setAttiva(c);
        setPensiero(fraseCasella(c, r));
        await attesa(c === 'attivita' ? 800 : 650);
        setVisto((v) => new Set(v).add(c));
        await attesa(250);
      }
      setAttiva(null);
      setPensiero(chiusura ?? 'Ecco il conto. Correggi pure le caselle: ricalcolo subito.');
      if (!largo) banco.current?.scrollIntoView({ behavior: senzaMovimento() ? 'auto' : 'smooth', block: 'start' });
    },
    [largo]
  );

  const invia = useCallback(
    async (t: string, vocale = false) => {
      const riga = t.trim();
      if (!riga || occupato) return;
      setErrore(null);
      setTesto('');
      setOccupato(true);
      setPensiero('Leggo quello che mi hai scritto.');
      try {
        let tok = sim?.token;
        if (!tok) {
          const nuova = await nuovaSimulazione({});
          salvaToken(nuova);
          tok = nuova.token;
        }
        const r = await chiediFalco(tok, riga, [], vocale);
        salvaToken(r.simulazione);
        if (vocale) leggiAdAltaVoce(r.testo);
        setOccupato(false);
        if (r.simulazione.risultato) await compila(r.simulazione, chiusuraBreve(r.simulazione.risultato));
        else setPensiero(r.testo);
        if (r.mostraContatto) setContatto(true);
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Non ho capito. Riprova con una riga, per esempio: officina con 6 operai.');
        setPensiero('Qualcosa non è andato. Riprova.');
      } finally {
        setOccupato(false);
      }
    },
    [occupato, sim, compila]
  );

  const dettatura = usaDettatura((t) => void invia(t, true));

  /** Correzione a mano: si ricalcola subito, senza passare dal modello. */
  const cambia = useCallback(
    async (ingressi: Record<string, unknown>, cosa: string) => {
      if (!sim) return;
      setErrore(null);
      setPensiero(`Ricalcolo con ${cosa}.`);
      try {
        const s = await aggiornaSimulazione(sim.token, ingressi);
        setSim(s);
        const n = s.risultato?.mancano.filter((x) => x.scelte.length > 0).length ?? 0;
        setPensiero(n > 1 ? `Fatto. Ancora ${n} domande veloci e il conto è preciso.` : n === 1 ? 'Fatto. Un’ultima domanda e il conto è preciso.' : 'Fatto, il conto adesso è preciso.');
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Non riesco a ricalcolare.');
      }
    },
    [sim]
  );

  const r = sim?.risultato ?? null;
  const pronto = !!r && visto.size === ORDINE.length && attiva === null;
  const domanda: Domanda | null = pronto && r ? (r.mancano.find((d) => d.scelte.length > 0) ?? null) : null;
  const casellaDomanda = domanda ? (CASELLA_DI[domanda.campo] ?? null) : null;

  const fatture = sim && (
    <BloccoFatture
      apriRef={apriFattura}
      fatture={sim.fatture}
      informativa={informativa}
      onCarica={async (f) => {
        const s = await caricaFatturaPubblica(sim.token, f);
        setSim(s);
        const ult = s.fatture[s.fatture.length - 1];
        setPensiero(
          ult?.stato === 'bloccata'
            ? 'Quel documento sembra sanitario: non l’ho letto e non l’ho conservato.'
            : ult?.stato === 'da_confermare'
              ? 'Ho letto la fattura: in “Tutte le voci” controlla le righe e conferma.'
              : 'Fattura letta: in “Tutte le voci” vedi cosa risulta già pagato.'
        );
      }}
      onConferma={async (id) => setSim(await confermaFatturaPubblica(sim.token, id))}
      onElimina={async (id) => setSim(await eliminaFatturaPubblica(sim.token, id))}
    />
  );

  return (
    <div className="min-h-[100dvh] bg-white text-ink">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-perla-linea bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro, Piccole Medie Imprese" width={140} height={36} className="h-8 w-auto" />
        <span className="min-w-0 flex-1" />
        {accesso ? (
          <button type="button" className="btn-ghost shrink-0" onClick={() => apriAccesso('accedi')}>
            Accedi
          </button>
        ) : (
          <Link href="/?entra=1" className="btn-ghost shrink-0">
            Accedi
          </Link>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        {/* Il Falco: cosa pensa, cosa chiede, dove gli si scrive */}
        <section className="lg:sticky lg:top-[84px] lg:self-start" aria-label="Falco">
          <div className="rounded-[1.75rem] bg-grafite-950 p-5 text-white">
            <div className="flex items-center gap-3">
              <AvatarFalco size={52} parla={occupato || attiva !== null} />
              <div className="min-w-0">
                <p className="text-[15px] font-medium">Falco</p>
                <p className="text-[12.5px] text-grafite-400">{occupato ? 'Sta leggendo' : attiva ? 'Sta compilando il simulatore' : 'Il tuo consulente per la sicurezza'}</p>
              </div>
            </div>
            {!r && <h1 className="mt-5 text-[28px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[34px]">Quanto ti costa davvero la sicurezza sul lavoro?</h1>}
            <p key={pensiero} aria-live="polite" className="mt-4 min-h-[3rem] animate-comparsa text-[16px] leading-relaxed text-grafite-100">
              {pensiero}
            </p>

            {domanda && (
              <div className="hidden lg:block">
                <DomandaFalco d={domanda} onScegli={(campo, v, t) => void cambia({ [campo]: v }, t)} />
              </div>
            )}

            <BarraScrivi testo={testo} setTesto={setTesto} onInvia={() => void invia(testo)} dettatura={dettatura} occupato={occupato} />
            {!r && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ESEMPI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    disabled={occupato}
                    onClick={() => void invia(e)}
                    className="min-h-[40px] rounded-full px-3.5 text-[13.5px] text-grafite-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] hover:shadow-[inset_0_0_0_1.5px_#ffffff] disabled:opacity-50"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            {errore && (
              <p role="alert" className="mt-3 text-[13.5px] text-[#ffc6ac]">
                {errore}
              </p>
            )}
          </div>
          {!r && (
            <p className="mt-4 px-1 text-[14px] leading-relaxed text-ink-muted">
              Abbonamento a 9,90 € al mese per lavoratore con visita medica, 5,90 € senza. Dentro c’è tutto: DVR e documenti, corsi, visite, scadenze e sopralluoghi. Io preparo, i tecnici dello studio controllano e firmano.
              {accesso && !DEMO_LIVE && (
                <>
                  {' '}
                  <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => apriAccesso('crea')}>
                    Attivalo adesso
                  </button>
                </>
              )}
            </p>
          )}
        </section>

        {/* Il simulatore che il Falco compila */}
        <section ref={banco} className="scroll-mt-[60px] space-y-4" aria-label="Simulatore di costo">
          {r && (
            <div className={clsx('z-20 -mx-1 rounded-[1.5rem] bg-grafite-950 p-3.5 text-white lg:hidden', attiva !== null && 'sticky top-[60px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]')}>
              <div className="flex items-start gap-3">
                <AvatarFalco size={36} parla={attiva !== null} />
                <p key={pensiero} aria-live="polite" className="min-w-0 flex-1 animate-comparsa text-[14.5px] leading-snug text-grafite-100">
                  {pensiero}
                </p>
              </div>
              {domanda && <DomandaFalco d={domanda} onScegli={(campo, v, t) => void cambia({ [campo]: v }, t)} />}
            </div>
          )}
          <Conto r={pronto ? r : null} vista={vista} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CasellaBanco nome="attivita" titolo="Attività" attiva={attiva} visto={visto} domanda={casellaDomanda} stimato={!!r?.profilo.presunti.rischio} largo>
              {r && (
                <>
                  <p className="text-[17px] font-medium leading-snug text-ink">{r.profilo.attivita ?? 'Da definire'}</p>
                  <p className="mt-1 text-[13px] text-ink-muted">{[r.profilo.ateco ? `ATECO ${r.profilo.ateco}` : null, RISCHIO[r.profilo.rischio]].filter(Boolean).join(' · ')}</p>
                </>
              )}
            </CasellaBanco>

            <CasellaBanco nome="lavoratori" titolo="Lavoratori" attiva={attiva} visto={visto} domanda={casellaDomanda}>
              {r && <Contatore valore={r.profilo.lavoratori} min={1} onCambia={(n) => void cambia({ lavoratori: n, con_visita: null, senza_visita: null }, `${n} lavoratori`)} />}
            </CasellaBanco>

            <CasellaBanco nome="visita" titolo="Con visita medica" attiva={attiva} visto={visto} domanda={casellaDomanda} stimato={!!r?.profilo.presunti.con_visita}>
              {r && (
                <>
                  <Contatore
                    valore={r.profilo.conVisita}
                    min={0}
                    max={r.profilo.lavoratori}
                    onCambia={(n) => void cambia({ lavoratori: r.profilo.lavoratori, con_visita: n, senza_visita: r.profilo.lavoratori - n }, `${n} con visita`)}
                  />
                  <Barra con={r.profilo.conVisita} tot={r.profilo.lavoratori} />
                </>
              )}
            </CasellaBanco>

            <CasellaBanco nome="alimenti" titolo="Sedi con alimenti" attiva={attiva} visto={visto} domanda={casellaDomanda} stimato={!!r?.profilo.presunti.sedi_alimentari}>
              {r && (
                <Contatore
                  valore={r.profilo.sediAlimentari}
                  min={0}
                  max={9}
                  onCambia={(n) => void cambia({ sedi_alimentari: n, sedi: Math.max(1, n) }, n === 1 ? 'una sede con alimenti' : `${n} sedi con alimenti`)}
                />
              )}
            </CasellaBanco>

            <CasellaBanco nome="enti" titolo="Adesioni" attiva={attiva} visto={visto} domanda={casellaDomanda} largo>
              {r && (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['ebiasp', 'EBIASP', r.profilo.ebiasp],
                      ['fondo', 'FondoFormazione', r.profilo.fondo],
                      ['socio', 'Socio Conflavoro', r.profilo.socio],
                    ] as const
                  ).map(([k, t, on]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => void cambia({ [k]: !on }, on ? `${t} tolto` : `${t} aggiunto`)}
                      className={clsx('premi min-h-[44px] rounded-full px-3.5 text-[13.5px] font-medium', on ? 'bg-grafite-950 text-white' : 'bg-white text-ink-soft shadow-[inset_0_0_0_1px_#e2e2e5]')}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </CasellaBanco>
          </div>

          {pronto && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!sim?.contattoRichiesto ? (
                <button type="button" className="btn-acido w-full sm:w-auto" onClick={() => setContatto(true)}>
                  Ricevi il preventivo
                </button>
              ) : (
                <p className="self-center text-[14px] text-ink-muted">Contatto inviato: ti richiamiamo con il preventivo.</p>
              )}
              <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setDettaglio(true)}>
                Tutte le voci
              </button>
              <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => apriFattura.current?.()}>
                Confronta con una fattura
              </button>
              <button type="button" className="btn-ghost w-full sm:w-auto" onClick={nuova}>
                Nuova simulazione
              </button>
            </div>
          )}
          {pronto && r?.notaStime && <p className="text-[12px] leading-relaxed text-ink-subtle">{r.notaStime}</p>}
          <p className="text-[11.5px] text-ink-subtle">Calcolo con assistenza AI. Il preventivo vero lo conferma lo studio.</p>
        </section>
      </div>

      {accesso ? (
        <Presentazione onAttiva={() => apriAccesso('crea')} onAccedi={() => apriAccesso('accedi')} />
      ) : (
        <Presentazione onAttiva={() => window.location.assign(percorso('/?crea=1'))} onAccedi={() => window.location.assign(percorso('/?entra=1'))} />
      )}

      {/* Il blocco delle fatture resta montato (serve il suo selettore di file), si vede in "Tutte le voci". */}
      {!dettaglio && <div className="hidden">{fatture}</div>}

      {dettaglio && r && (
        <Foglio titolo="Tutte le voci" onChiudi={() => setDettaglio(false)}>
          <PannelloConfronto r={r} vista={vista} onVista={setVista} />
          <div className="mt-4">{fatture}</div>
        </Foglio>
      )}

      {contatto && sim && !sim.contattoRichiesto && (
        <Foglio titolo="Ricevi il preventivo" onChiudi={() => setContatto(false)}>
          <ModuloContatto
            onInvia={async (d) => {
              const s = await inviaContatto(sim.token, d);
              setSim(s);
              setContatto(false);
              setPensiero(`Grazie ${d.nome.split(' ')[0]}: ti richiamiamo a breve, i numeri li abbiamo già.`);
            }}
          />
        </Foglio>
      )}

      {accesso && entra && (
        <Foglio titolo={modoAccesso === 'crea' ? 'Crea il tuo accesso' : 'Accedi'} onChiudi={() => setEntra(false)} lato>
          {accesso(modoAccesso)}
        </Foglio>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ pezzi

/** Riga finale del Falco: corta, con i numeri del conto. */
function chiusuraBreve(r: Risultato): string {
  const v = r.viste.regime;
  const n = r.mancano.filter((d) => d.scelte.length > 0).length;
  const base =
    v.risparmio !== null && v.risparmio >= 0
      ? `Fatto: con noi risparmi ${euroC(v.risparmio)} l’anno.`
      : 'Fatto. Qui l’abbonamento costa un po’ di più: ti spiego perché nel dettaglio.';
  return n > 0 ? `${base} Con ${n === 1 ? 'una risposta' : `${n} risposte veloci`} il conto diventa preciso.` : `${base} Correggi pure le caselle, ricalcolo subito.`;
}

function DomandaFalco({ d, onScegli }: { d: Domanda; onScegli: (campo: string, valore: unknown, testo: string) => void }) {
  return (
    <div className="mt-3 rounded-[1.25rem] bg-white/10 p-3.5">
      <p className="text-[15px] font-medium">{d.domanda}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {d.scelte.map((s) => (
          <button key={String(s.valore)} type="button" onClick={() => onScegli(d.campo, s.valore, s.testo.toLowerCase())} className="premi min-h-[44px] rounded-full bg-white px-4 text-[14px] font-medium text-ink">
            {s.testo}
          </button>
        ))}
      </div>
    </div>
  );
}

function Conto({ r, vista }: { r: Risultato | null; vista: Vista }) {
  const v = r?.viste[vista] ?? null;
  const vecchio = useConta(v ? v.vecchioLavoratoreMese : null);
  const nuovo = useConta(v?.abbonamentoLavoratoreMese ?? null);
  const risp = useConta(v?.risparmio ?? null);
  const piuCaro = (v?.risparmio ?? 0) < 0;
  return (
    <div className={clsx('rounded-[1.75rem] p-5 transition-colors duration-500', r ? 'bg-grafite-950 text-white' : 'bg-perla-velo text-ink-muted')}>
      <p className={clsx('text-[12.5px] font-medium', r ? 'text-grafite-400' : 'text-ink-subtle')}>Al mese, per lavoratore</p>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <p className={clsx('text-[13px]', r ? 'text-grafite-300' : '')}>A preventivo</p>
          <p className={clsx('mt-0.5 text-[28px] font-medium tabular-nums tracking-[-0.03em] sm:text-[38px]', r ? 'text-grafite-300 line-through decoration-2' : 'text-ink-subtle')}>{vecchio !== null ? euroC(vecchio) : '0,00 €'}</p>
        </div>
        <div>
          <p className={clsx('text-[13px]', r ? 'text-grafite-300' : '')}>Con l’abbonamento</p>
          <p className={clsx('mt-0.5 text-[28px] font-medium tabular-nums tracking-[-0.03em] sm:text-[38px]', r ? 'text-oro-500' : 'text-ink-subtle')}>{nuovo !== null ? euroC(nuovo) : '0,00 €'}</p>
        </div>
      </div>
      <p className={clsx('mt-3 text-[15px] leading-snug', r ? 'text-white' : '')}>
        {r && risp !== null
          ? piuCaro
            ? `Qui l’abbonamento costa ${euroC(Math.abs(risp))} l’anno più del preventivo. ${r.contoOnesto ?? ''}`
            : `Risparmi ${euroC(risp)} l’anno${v?.risparmioPct ? ` (${v.risparmioPct}%)` : ''}, con tutto dentro.`
          : 'Il conto compare qui appena Falco ha compilato il simulatore.'}
      </p>
    </div>
  );
}

function CasellaBanco({
  nome,
  titolo,
  attiva,
  visto,
  domanda,
  stimato = false,
  largo = false,
  children,
}: {
  nome: Casella;
  titolo: string;
  attiva: Casella | null;
  visto: Set<Casella>;
  domanda: Casella | null;
  stimato?: boolean;
  largo?: boolean;
  children: ReactNode;
}) {
  const ora = attiva === nome;
  const piena = visto.has(nome);
  const chiede = domanda === nome;
  return (
    <div
      className={clsx(
        'relative rounded-[1.5rem] bg-white p-4 transition-shadow duration-300 sm:min-h-[8.25rem]',
        largo && 'sm:col-span-2 xl:col-span-1',
        ora || chiede ? 'shadow-[inset_0_0_0_2px_#18181b,0_0_0_4px_#d4ff3a]' : 'shadow-[inset_0_0_0_1px_#e2e2e5]'
      )}
    >
      <div className="mb-2 flex min-h-[24px] items-center gap-2">
        <p className="flex-1 text-[13px] font-medium text-ink-muted">{titolo}</p>
        {ora ? (
          <span className="flex items-center gap-1.5 rounded-full bg-grafite-950 py-0.5 pl-0.5 pr-2.5 text-[11.5px] text-white">
            <AvatarFalco size={20} parla />
            scrive qui
          </span>
        ) : (
          piena && stimato && <span className="rounded-full bg-perla-velo px-2 py-0.5 text-[11.5px] text-ink-muted">stima di Falco</span>
        )}
      </div>
      {piena ? (
        <div className="animate-comparsa">{children}</div>
      ) : (
        <div className="space-y-2 pt-1" aria-hidden>
          <span className={clsx('block h-6 w-2/3 rounded-full', ora ? 'bg-acido-300' : 'bg-perla-velo')} />
          <span className="block h-3.5 w-1/3 rounded-full bg-perla-velo" />
        </div>
      )}
    </div>
  );
}

function Contatore({ valore, min, max, onCambia }: { valore: number; min: number; max?: number; onCambia: (n: number) => void }) {
  const v = useConta(valore) ?? valore;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Diminuisci"
        disabled={valore <= min}
        onClick={() => onCambia(valore - 1)}
        className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full text-[22px] leading-none text-ink shadow-[inset_0_0_0_1px_#e2e2e5] disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[2.5ch] flex-1 text-center text-[34px] font-medium tabular-nums tracking-[-0.03em] text-ink">{v}</span>
      <button
        type="button"
        aria-label="Aumenta"
        disabled={max !== undefined && valore >= max}
        onClick={() => onCambia(valore + 1)}
        className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink shadow-[inset_0_0_0_1px_#e2e2e5] disabled:opacity-30"
      >
        <Piu size={16} aria-hidden />
      </button>
    </div>
  );
}

function Barra({ con, tot }: { con: number; tot: number }) {
  const pct = tot > 0 ? Math.round((con / tot) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-perla-velo" aria-hidden>
        <div className="h-full rounded-full bg-grafite-950 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-muted">
        {con} con visita · {tot - con} senza
      </p>
    </div>
  );
}

function Foglio({ titolo, onChiudi, lato = false, children }: { titolo: string; onChiudi: () => void; lato?: boolean; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titolo} className={clsx('fixed inset-0 z-50 flex bg-black/45', lato && 'lg:justify-end')} onClick={onChiudi}>
      <div
        className={clsx(
          'mt-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-6 pt-4',
          lato ? 'lg:mt-0 lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-none lg:px-10 lg:pt-10' : 'lg:mx-auto lg:mb-auto lg:mt-[6vh] lg:max-w-[720px] lg:rounded-[2rem] lg:p-8'
        )}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <p className="flex-1 text-[17px] font-medium">{lato ? '' : titolo}</p>
          <button type="button" className="btn-icon" aria-label="Chiudi" onClick={onChiudi}>
            <Chiudi size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BarraScrivi({
  testo,
  setTesto,
  onInvia,
  dettatura,
  occupato,
}: {
  testo: string;
  setTesto: (t: string) => void;
  onInvia: () => void;
  dettatura: ReturnType<typeof usaDettatura>;
  occupato: boolean;
}) {
  const invio = (e: FormEvent) => {
    e.preventDefault();
    onInvia();
  };
  return (
    <form onSubmit={invio} className="mt-5 flex items-center gap-2 rounded-full bg-white p-1.5">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Scrivi a Falco</span>
        <input
          value={dettatura.ascolta ? dettatura.parziale : testo}
          onChange={(e) => setTesto(e.target.value.slice(0, 1500))}
          disabled={dettatura.ascolta}
          placeholder={dettatura.ascolta ? 'Ti ascolto' : 'Es. ristorante con 12 dipendenti'}
          className="h-11 w-full bg-transparent px-4 text-base text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:shadow-none"
        />
      </label>
      {occupato ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center" role="status" aria-label="Falco sta lavorando">
          <Rotore size={18} aria-hidden className="animate-spin text-ink motion-reduce:animate-none" />
        </span>
      ) : testo.trim() ? (
        <button type="submit" aria-label="Invia a Falco" className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grafite-950 text-white">
          <Invia size={17} aria-hidden />
        </button>
      ) : dettatura.disponibile ? (
        <button
          type="button"
          onClick={dettatura.ascolta ? dettatura.ferma : dettatura.avvia}
          aria-pressed={dettatura.ascolta}
          aria-label={dettatura.ascolta ? 'Ferma e invia' : 'Detta a Falco'}
          className={clsx('premi grid h-11 w-11 shrink-0 place-items-center rounded-full', dettatura.ascolta ? 'bg-[#d63d3e] text-white' : 'bg-oro-500 text-acido-950')}
        >
          {dettatura.ascolta ? <Ferma size={16} aria-hidden /> : <Microfono size={18} aria-hidden />}
        </button>
      ) : (
        <button type="submit" disabled aria-label="Invia a Falco" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-perla-velo text-ink-subtle">
          <Invia size={17} aria-hidden />
        </button>
      )}
    </form>
  );
}

function ModuloContatto({ onInvia }: { onInvia: (d: { nome: string; azienda: string; telefono: string; consenso: boolean }) => Promise<void> }) {
  const [d, setD] = useState({ nome: '', azienda: '', telefono: '', consenso: false });
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const ok = d.nome.trim().length > 1 && d.azienda.trim().length > 1 && telefonoValido(d.telefono) && d.consenso;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return setErrore(!telefonoValido(d.telefono) ? 'Controlla il telefono: un cellulare inizia con 3 e ha 9 o 10 cifre.' : 'Compila i campi e dai il consenso.');
        setInvio(true);
        try {
          await onInvia(d);
        } catch (er) {
          setErrore(er instanceof Error ? er.message : 'Invio non riuscito.');
        } finally {
          setInvio(false);
        }
      }}
    >
      <p className="text-[14px] leading-relaxed text-ink-soft">Ti richiama una persona dello studio con il preventivo. I numeri del simulatore li ha già.</p>
      <input className="input-field" autoComplete="name" placeholder="Nome e cognome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
      <input className="input-field" autoComplete="organization" placeholder="Azienda" value={d.azienda} onChange={(e) => setD({ ...d, azienda: e.target.value })} />
      <input className="input-field" autoComplete="tel" inputMode="tel" placeholder="Telefono" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} />
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-soft">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#18181B]" checked={d.consenso} onChange={(e) => setD({ ...d, consenso: e.target.checked })} />
        Voglio essere richiamato per il preventivo. I dati servono solo a questo: la simulazione contiene numeri, non dati dei lavoratori.
      </label>
      {errore && (
        <p role="alert" className="text-[13px] text-stato-danger-ink">
          {errore}
        </p>
      )}
      <button type="submit" className="btn-acido w-full" disabled={invio}>
        {invio ? 'Invio' : 'Ricevi il preventivo'}
      </button>
    </form>
  );
}
