'use client';

import { percorso } from '@/lib/percorso';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { useDataSource } from '@/lib/use-data-source';
import { ROLES } from '@/lib/mock-auth';
import { isApiMode, type Role } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { Avviso, Campo, SceltaFile } from '@/components/portale/viste/azienda/comuniAccount';
import {
  AZIENDA_VUOTA,
  annullaRichiesta,
  cercaOrganizzazioni,
  cercaStudi,
  chiediAccesso,
  organizzazioneDaCodice,
  testoPasso,
  iscrivi,
  leggiVisura,
  statoIscrizione,
  studioDaCodice,
  validaAzienda,
  type DatiAzienda,
  type Scelta,
  type StatoIscrizione,
  type Studio,
} from '@/lib/iscrizione';

/**
 * Onboarding in tre passi. Primo passo, due strade chiare: "Lavoro in
 * un'azienda o studio gia' iscritto" (richiesta di accesso, proposta dal
 * dominio della mail, ricerca o codice di invito) oppure "Iscrivo la mia
 * azienda" (dati dell'azienda, poi chi segue la sicurezza). Chi aspetta una
 * decisione vede una schermata chiara e puo' annullare. In fondo a ogni
 * schermata il contatto di assistenza.
 */

type Passo = 'strada' | 'azienda' | 'scelta' | 'attesa' | 'organizzazione' | 'richiesta' | 'codice';

const NUMERO: Record<Passo, number> = { strada: 1, azienda: 2, scelta: 3, attesa: 3, organizzazione: 2, codice: 2, richiesta: 3 };

const TITOLO: Record<Passo, string> = {
  strada: 'Come entri in piattaforma?',
  azienda: 'Registra la tua azienda',
  scelta: 'Chi segue la sicurezza',
  attesa: 'In attesa dello studio',
  organizzazione: 'Dove lavori',
  codice: 'Entra con un codice',
  richiesta: 'Richiesta inviata',
};

const SCELTE: Array<{ k: Scelta; t: string; sotto: string }> = [
  { k: 'conflavoro', t: 'Conflavoro', sotto: 'I tecnici di Conflavoro seguono la sicurezza della tua azienda: DVR, formazione, visite e scadenze. Entri subito.' },
  { k: 'studio', t: 'Un altro studio HSE della piattaforma', sotto: 'Cerchi il tuo studio per nome o con il suo codice. Entri quando lo studio accetta.' },
  { k: 'interno', t: 'Un HSE nostro, interno o esterno', sotto: 'Gestisci tu la piattaforma e inviti il tuo RSPP, il medico competente, il referente e il consulente del lavoro.' },
  { k: 'studio_hse', t: 'Siamo uno studio HSE', sotto: 'Offriamo il servizio ad altre aziende. La vostra azienda è la prima del vostro studio.' },
];

function destinazione(app: StatoIscrizione['app']): string {
  return app === 'gestionale' ? '/gestionale/coda/' : '/azienda/dashboard/';
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [passo, setPasso] = useState<Passo>('strada');
  const [azienda, setAzienda] = useState<DatiAzienda>(AZIENDA_VUOTA);
  const [stato, setStato] = useState<StatoIscrizione | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/');
    else if (user.needs_onboarding === false) router.replace(ROLES[user.role].homePath);
  }, [user, loading, router]);

  // Iscrizione gia' iniziata: in attesa dello studio o rifiutata (si torna alla scelta con i dati).
  useEffect(() => {
    if (loading || !user || user.needs_onboarding === false) return;
    if (!isApiMode()) {
      setPronto(true);
      return;
    }
    statoIscrizione()
      .then((s) => {
        if (s?.stato === 'attivo') return router.replace(destinazione(s.app));
        if (s?.azienda) setAzienda(s.azienda);
        if (s?.stato === 'in_attesa') setPasso('attesa');
        if (s?.stato === 'rifiutata') setPasso('scelta');
        if (s?.stato === 'richiesta') setPasso('richiesta');
        if (s?.stato === 'richiesta_rifiutata') setPasso('organizzazione');
        setStato(s);
      })
      .catch(() => undefined)
      .finally(() => setPronto(true));
  }, [loading, user, router]);

  if (loading || !user || user.needs_onboarding === false || !pronto) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <p className="text-[14px] text-ink-muted">Caricamento</p>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-perla-velo">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/falco-mark.svg')} alt="" width={40} height={40} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted" aria-live="polite">
              {testoPasso(NUMERO[passo])}
            </p>
            <h1 className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">{TITOLO[passo]}</h1>
          </div>
        </div>
        <div className="mb-5 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={clsx('h-1.5 flex-1 rounded-full', n <= NUMERO[passo] ? 'bg-grafite-900' : 'bg-white shadow-[inset_0_0_0_1px_#e2e2e5]')} />
          ))}
        </div>

        <section className="rounded-[1.5rem] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-7">
          {passo === 'strada' && <PassoStrada proposta={stato?.proposta ?? null} onLavoro={() => setPasso('organizzazione')} onIscrivo={() => setPasso('azienda')} />}
          {passo === 'organizzazione' && (
            <PassoOrganizzazione
              proposta={stato?.proposta ?? null}
              rifiutata={stato?.stato === 'richiesta_rifiutata' ? stato : null}
              onIndietro={() => setPasso('strada')}
              onCodice={() => setPasso('codice')}
              onInviata={(s) => {
                setStato((x) => ({ ...s, proposta: x?.proposta ?? null, assistenza: x?.assistenza ?? null }));
                setPasso('richiesta');
              }}
            />
          )}
          {passo === 'richiesta' && (
            <PassoRichiesta
              stato={stato}
              onAccettata={(s) => router.replace(destinazione(s.app))}
              onRifiutata={(s) => {
                setStato((x) => ({ ...s, proposta: x?.proposta ?? null, assistenza: x?.assistenza ?? null }));
                setPasso('organizzazione');
              }}
              onAnnullata={() => {
                setStato((x) => (x ? { ...x, stato: 'nuovo', organizzazione: null } : x));
                setPasso('strada');
              }}
            />
          )}
          {passo === 'azienda' && <PassoAzienda iniziali={azienda} onIndietro={() => setPasso('strada')} onAvanti={(d) => { setAzienda(d); setPasso('scelta'); }} />}
          {passo === 'scelta' && (
            <PassoScelta
              azienda={azienda}
              rifiutata={stato?.stato === 'rifiutata' ? stato : null}
              onIndietro={() => setPasso('azienda')}
              onFatto={(s) => {
                if (s.stato === 'in_attesa') {
                  setStato(s);
                  setPasso('attesa');
                } else router.replace(destinazione(s.app));
              }}
            />
          )}
          {passo === 'attesa' && (
            <PassoAttesa
              stato={stato}
              onAccettata={(s) => router.replace(destinazione(s.app))}
              onRifiutata={(s) => {
                setStato(s);
                if (s.azienda) setAzienda(s.azienda);
                setPasso('scelta');
              }}
            />
          )}
          {passo === 'codice' && <PassoCodice onIndietro={() => setPasso('organizzazione')} />}
        </section>

        <div className="mt-4 space-y-2 px-1">
          <p className="text-[13.5px] text-ink-soft">
            Hai bisogno di aiuto?{' '}
            {stato?.assistenza ? (
              <>
                Scrivi a{' '}
                <a href={`mailto:${stato.assistenza}`} className="break-all text-ink underline decoration-grafite-300 underline-offset-4">
                  {stato.assistenza}
                </a>
                : ti rispondiamo noi.
              </>
            ) : (
              'Scrivi allo staff Conflavoro che ti ha parlato della piattaforma.'
            )}
          </p>
          <p className="text-[12px] leading-relaxed text-ink-muted">I dati servono solo a gestire il servizio (GDPR, Reg. UE 2016/679). La partita IVA è cifrata nel database.</p>
        </div>
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ passo 1: la strada

function PassoStrada({ proposta, onLavoro, onIscrivo }: { proposta: Studio | null; onLavoro: () => void; onIscrivo: () => void }) {
  const voci = [
    {
      k: 'lavoro',
      t: 'Lavoro in un’azienda o studio già iscritto',
      sotto: proposta
        ? `Per esempio ${proposta.nome}: chiedi l’accesso e chi la gestisce ti dà il tuo ruolo.`
        : 'Chiedi l’accesso alla tua organizzazione: chi la gestisce ti dà il tuo ruolo. Vale anche se hai un codice di invito.',
      fai: onLavoro,
    },
    {
      k: 'iscrivo',
      t: 'Iscrivo la mia azienda',
      sotto: 'Registri la tua azienda, scegli chi ne segue la sicurezza e poi inviti le altre persone.',
      fai: onIscrivo,
    },
  ];
  return (
    <div className="space-y-3">
      {voci.map((v) => (
        <button
          key={v.k}
          type="button"
          onClick={v.fai}
          className="flex w-full min-h-[72px] flex-col justify-center rounded-[1.1rem] bg-white px-4 py-3.5 text-left shadow-[inset_0_0_0_1.5px_#e2e2e5] transition-colors hover:shadow-[inset_0_0_0_1.5px_#18181b]"
        >
          <span className="text-[16px] font-medium text-ink">{v.t}</span>
          <span className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{v.sotto}</span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ lavoro in un'organizzazione gia' iscritta

function PassoOrganizzazione({
  proposta,
  rifiutata,
  onIndietro,
  onCodice,
  onInviata,
}: {
  proposta: Studio | null;
  rifiutata: StatoIscrizione | null;
  onIndietro: () => void;
  onCodice: () => void;
  onInviata: (s: StatoIscrizione) => void;
}) {
  const [q, setQ] = useState('');
  const [trovati, setTrovati] = useState<Studio[]>([]);
  const [cerco, setCerco] = useState(false);
  const [scelta, setScelta] = useState<Studio | null>(null);
  const [codice, setCodice] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const giro = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setTrovati([]);
      return;
    }
    const n = ++giro.current;
    setCerco(true);
    const t = window.setTimeout(() => {
      cercaOrganizzazioni(q)
        .then((l) => n === giro.current && setTrovati(l))
        .catch(() => n === giro.current && setTrovati([]))
        .finally(() => n === giro.current && setCerco(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const invia = async (o: Studio) => {
    setErrore(null);
    if (!isApiMode()) return setErrore('La richiesta funziona solo con il servizio attivo.');
    setInvio(true);
    try {
      const s = await chiediAccesso(o.id, messaggio);
      if (s) onInviata(s);
    } catch (e) {
      setErrore((e as Error).message);
      setInvio(false);
    }
  };

  const conCodice = async () => {
    setErrore(null);
    try {
      const o = await organizzazioneDaCodice(codice);
      if (o) setScelta(o);
      else setErrore('Nessuna organizzazione con questo codice. Se è un codice di invito dell’azienda o dello staff, usa “Ho un codice di invito”.');
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const daInviare = scelta ?? null;

  return (
    <div className="space-y-5">
      {rifiutata && (
        <Avviso tono="warn" titolo={`${rifiutata.organizzazione?.nome ?? 'L’organizzazione'} non ha accettato la richiesta`}>
          {rifiutata.motivo ? `Motivo: ${rifiutata.motivo} ` : ''}Puoi chiedere a un’altra organizzazione o iscrivere la tua azienda.
        </Avviso>
      )}
      {proposta && !daInviare && (
        <div className="rounded-[1.1rem] bg-grafite-900 p-4 text-white">
          <p className="text-[13.5px] text-white/75">La tua email è di {proposta.nome}.</p>
          <button type="button" className="btn-acido mt-3 w-full sm:w-auto" disabled={invio} onClick={() => void invia(proposta)}>
            {invio ? 'Invio la richiesta' : `Entra in ${proposta.nome}`}
          </button>
          <p className="mt-2 text-[12.5px] text-white/70">Mandiamo la richiesta allo staff: ti avvisiamo appena ti danno il ruolo.</p>
        </div>
      )}

      {daInviare ? (
        <div className="space-y-3 rounded-[1.1rem] bg-perla-velo p-4">
          <p className="text-[14px] text-ink">
            Chiedi l’accesso a <span className="font-medium">{daInviare.nome}</span>
            {daInviare.comune ? `, ${daInviare.comune}` : ''}.
          </p>
          <Campo etichetta="Un messaggio per chi decide (facoltativo)" aiuto="Per esempio il tuo ruolo: tecnico HSE, referente, consulente del lavoro.">
            <input className="input-field" value={messaggio} onChange={(e) => setMessaggio(e.target.value)} maxLength={300} />
          </Campo>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={() => setScelta(null)}>
              Cambia
            </button>
            <button type="button" className="btn-acido w-full sm:w-auto" disabled={invio} onClick={() => void invia(daInviare)}>
              {invio ? 'Invio la richiesta' : 'Manda la richiesta'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo etichetta={proposta ? 'Oppure cerca un’altra azienda o studio' : 'Cerca la tua azienda o il tuo studio'}>
            <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} autoComplete="off" placeholder="Almeno due lettere del nome" />
          </Campo>
          {cerco && <p className="text-[13px] text-ink-muted">Cerco</p>}
          {!cerco && q.trim().length >= 2 && trovati.length === 0 && <p className="text-[13px] text-ink-muted">Nessuna organizzazione con questo nome. Chiedi il codice a chi ti ha invitato.</p>}
          {trovati.length > 0 && (
            <ul className="space-y-1.5">
              {trovati.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setScelta(o)} className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[0.9rem] bg-white px-3.5 text-left text-[14px] shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]">
                    <span className="min-w-0 truncate text-ink">{o.nome}</span>
                    <span className="shrink-0 text-[12.5px] text-ink-muted">{o.comune ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Campo etichetta="Oppure il codice dello studio">
                <input className="input-field" value={codice} onChange={(e) => setCodice(e.target.value.trim())} maxLength={64} autoComplete="off" />
              </Campo>
            </div>
            <button type="button" className="btn-ghost min-h-[44px]" disabled={!codice} onClick={() => void conCodice()}>
              Trova
            </button>
          </div>
        </div>
      )}

      {errore && <Avviso tono="danger">{errore}</Avviso>}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={onIndietro}>
          Indietro
        </button>
        <button type="button" onClick={onCodice} className="min-h-[44px] text-left text-[14px] text-ink-muted underline decoration-grafite-300 underline-offset-4 hover:text-ink">
          Ho un codice di invito
        </button>
      </div>
    </div>
  );
}

function PassoRichiesta({
  stato,
  onAccettata,
  onRifiutata,
  onAnnullata,
}: {
  stato: StatoIscrizione | null;
  onAccettata: (s: StatoIscrizione) => void;
  onRifiutata: (s: StatoIscrizione) => void;
  onAnnullata: () => void;
}) {
  const [lavoro, setLavoro] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const nome = stato?.organizzazione?.nome ?? 'l’organizzazione';

  const verifica = useCallback(
    async (aMano: boolean) => {
      if (aMano) setLavoro(true);
      try {
        const s = await statoIscrizione();
        if (s?.stato === 'attivo') onAccettata(s);
        else if (s?.stato === 'richiesta_rifiutata') onRifiutata(s);
        else if (aMano) setNota('Non hanno ancora deciso. Ti mandiamo un’email appena ti accettano.');
      } catch {
        if (aMano) setNota('Non riesco a controllare adesso. Riprova tra poco.');
      } finally {
        if (aMano) setLavoro(false);
      }
    },
    [onAccettata, onRifiutata]
  );

  useEffect(() => {
    const t = window.setInterval(() => void verifica(false), 30_000);
    return () => window.clearInterval(t);
  }, [verifica]);

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink">
        Richiesta inviata a <span className="font-medium">{nome}</span>. Ti avvisiamo appena ti accettano.
      </p>
      <p className="text-[14px] leading-relaxed text-ink-muted">
        Il titolare o lo staff la vede nella coda di lavoro e ti assegna il ruolo. Quando ti accettano ricevi un’email e, al prossimo accesso, entri direttamente nella tua pagina.
      </p>
      {nota && <Avviso tono="info">{nota}</Avviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          className="btn-ghost min-h-[44px]"
          disabled={lavoro}
          onClick={async () => {
            setLavoro(true);
            try {
              await annullaRichiesta();
              onAnnullata();
            } catch (e) {
              setNota((e as Error).message);
              setLavoro(false);
            }
          }}
        >
          Annulla e scegli un’altra strada
        </button>
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={lavoro} onClick={() => void verifica(true)}>
          {lavoro ? 'Controllo' : 'Controlla adesso'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ passo 2: la tua azienda

function PassoAzienda({ iniziali, onAvanti, onIndietro }: { iniziali: DatiAzienda; onAvanti: (d: DatiAzienda) => void; onIndietro: () => void }) {
  const [d, setD] = useState<DatiAzienda>(iniziali);
  const [errori, setErrori] = useState<Partial<Record<keyof DatiAzienda, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [leggo, setLeggo] = useState(false);
  const [nota, setNota] = useState<{ tono: 'ok' | 'danger'; testo: string } | null>(null);

  const cambia = (k: keyof DatiAzienda, v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrori((e) => ({ ...e, [k]: undefined }));
  };

  const visura = async (f: File | null) => {
    setFile(f);
    setNota(null);
    if (!f) return;
    setLeggo(true);
    try {
      const letti = await leggiVisura(f);
      const n = Object.keys(letti).length;
      setD((x) => ({ ...x, ...letti }));
      setNota(n > 0 ? { tono: 'ok', testo: 'Ho compilato i campi dalla visura. Controllali prima di andare avanti.' } : { tono: 'danger', testo: 'Dalla visura non ho letto nulla di utile. Scrivi i dati a mano.' });
    } catch (e) {
      setNota({ tono: 'danger', testo: (e as Error).message });
    } finally {
      setLeggo(false);
    }
  };

  const avanti = () => {
    const e = validaAzienda(d);
    setErrori(e);
    if (Object.keys(e).length === 0) onAvanti(d);
  };

  return (
    <div className="space-y-5">
      <p className="text-[14px] leading-relaxed text-ink-soft">
        Chi si iscrive diventa il titolare dell’azienda in piattaforma. Poi assegni i ruoli: RSPP, medico competente, referente, consulente del lavoro.
      </p>
      {isApiMode() && (
        <div>
          <p className="mb-1.5 text-[13.5px] font-medium text-ink">Hai la visura camerale?</p>
          <SceltaFile file={file} onFile={(f) => void visura(f)} accetta=".pdf,.p7m,image/*" testo={leggo ? 'Leggo la visura' : 'Carica la visura e compilo io i campi'} />
          {nota && <div className="mt-2"><Avviso tono={nota.tono}>{nota.testo}</Avviso></div>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo etichetta="Ragione sociale" errore={errori.ragione_sociale}>
            <input className="input-field" value={d.ragione_sociale} onChange={(e) => cambia('ragione_sociale', e.target.value)} maxLength={191} autoComplete="organization" />
          </Campo>
        </div>
        <Campo etichetta="Partita IVA" errore={errori.partita_iva}>
          <input className="input-field" inputMode="numeric" value={d.partita_iva} onChange={(e) => cambia('partita_iva', e.target.value.toUpperCase())} maxLength={13} autoComplete="off" />
        </Campo>
        <Campo etichetta="Codice ATECO" errore={errori.ateco} aiuto="Lo trovi nella visura, per esempio 56.10.11.">
          <input className="input-field" inputMode="decimal" value={d.ateco} onChange={(e) => cambia('ateco', e.target.value)} maxLength={10} autoComplete="off" />
        </Campo>
        <Campo etichetta="Comune della sede" errore={errori.comune}>
          <input className="input-field" value={d.comune} onChange={(e) => cambia('comune', e.target.value)} maxLength={100} autoComplete="address-level2" />
        </Campo>
        <Campo etichetta="Lavoratori, anche a grandi linee" errore={errori.lavoratori}>
          <input className="input-field" inputMode="numeric" value={d.lavoratori} onChange={(e) => cambia('lavoratori', e.target.value.replace(/\D/g, ''))} maxLength={6} autoComplete="off" />
        </Campo>
      </div>
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="btn-ghost min-h-[44px]" disabled={leggo} onClick={onIndietro}>
          Indietro
        </button>
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={leggo} onClick={avanti}>
          Avanti
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ passo 3: chi segue la sicurezza

function PassoScelta({ azienda, rifiutata, onIndietro, onFatto }: { azienda: DatiAzienda; rifiutata: StatoIscrizione | null; onIndietro: () => void; onFatto: (s: StatoIscrizione) => void }) {
  const [scelta, setScelta] = useState<Scelta>('conflavoro');
  const [q, setQ] = useState('');
  const [trovati, setTrovati] = useState<Studio[]>([]);
  const [cerco, setCerco] = useState(false);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const giro = useRef(0);

  useEffect(() => {
    if (scelta !== 'studio' || q.trim().length < 2) {
      setTrovati([]);
      return;
    }
    const n = ++giro.current;
    setCerco(true);
    const t = window.setTimeout(() => {
      cercaStudi(q)
        .then((l) => n === giro.current && setTrovati(l))
        .catch(() => n === giro.current && setTrovati([]))
        .finally(() => n === giro.current && setCerco(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, scelta]);

  const conCodice = async () => {
    setErrore(null);
    try {
      const s = await studioDaCodice(codice);
      if (s) setStudio(s);
      else setErrore('Nessuno studio con questo codice. Controllalo con lo studio.');
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const conferma = async () => {
    setErrore(null);
    if (!isApiMode()) return setErrore('L’iscrizione funziona solo con il servizio attivo.');
    if (scelta === 'studio' && !studio) return setErrore('Scegli lo studio dall’elenco o inserisci il suo codice.');
    setInvio(true);
    try {
      onFatto(await iscrivi(azienda, scelta, scelta === 'studio' ? { id: studio?.id, codice: codice && studio ? codice : undefined } : undefined));
    } catch (e) {
      setErrore((e as Error).message);
      setInvio(false);
    }
  };

  return (
    <div className="space-y-5">
      {rifiutata && (
        <Avviso tono="warn" titolo={`${rifiutata.studio?.nome ?? 'Lo studio'} non ha accettato l’iscrizione`}>
          {rifiutata.motivo ? `Motivo: ${rifiutata.motivo} ` : ''}Puoi scegliere un’altra strada: i dati della tua azienda restano qui.
        </Avviso>
      )}
      <div>
        <h2 className="text-[18px] font-medium text-ink">Chi segue la sicurezza della tua azienda?</h2>
        <p className="mt-1 text-[13.5px] text-ink-muted">{azienda.ragione_sociale} · {azienda.comune}</p>
      </div>
      <div role="radiogroup" aria-label="Chi segue la sicurezza" className="space-y-2">
        {SCELTE.map((v) => {
          const on = scelta === v.k;
          return (
            <button
              key={v.k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setScelta(v.k);
                setErrore(null);
              }}
              className={clsx(
                'flex w-full min-h-[64px] gap-3 rounded-[1.1rem] px-4 py-3 text-left transition-colors',
                on ? 'bg-grafite-900 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]'
              )}
            >
              <span aria-hidden className={clsx('mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full', on ? 'bg-oro-500' : 'shadow-[inset_0_0_0_1.5px_#9a9aa2]')}>
                {on && <span className="h-2 w-2 rounded-full bg-acido-950" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">
                  {v.t}
                  {v.k === 'conflavoro' && <span className={clsx('ml-2 text-[12px] font-normal', on ? 'text-white/70' : 'text-ink-muted')}>consigliato</span>}
                </span>
                <span className={clsx('mt-0.5 block text-[13px] leading-snug', on ? 'text-white/75' : 'text-ink-muted')}>{v.sotto}</span>
              </span>
            </button>
          );
        })}
      </div>

      {scelta === 'studio' && (
        <div className="space-y-3 rounded-[1.1rem] bg-perla-velo p-4">
          {studio ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-[14px] text-ink">
                Studio scelto: <span className="font-medium">{studio.nome}</span>
                {studio.comune ? `, ${studio.comune}` : ''}
              </p>
              <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { setStudio(null); setCodice(''); }}>
                Cambia
              </button>
            </div>
          ) : (
            <>
              <Campo etichetta="Cerca lo studio per nome">
                <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} autoComplete="off" placeholder="Almeno due lettere" />
              </Campo>
              {cerco && <p className="text-[13px] text-ink-muted">Cerco</p>}
              {!cerco && q.trim().length >= 2 && trovati.length === 0 && <p className="text-[13px] text-ink-muted">Nessuno studio con questo nome. Chiedi allo studio il suo codice.</p>}
              {trovati.length > 0 && (
                <ul className="space-y-1.5">
                  {trovati.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setStudio(s)} className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[0.9rem] bg-white px-3.5 text-left text-[14px] shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]">
                        <span className="min-w-0 truncate text-ink">{s.nome}</span>
                        <span className="shrink-0 text-[12.5px] text-ink-muted">{s.comune ?? ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Campo etichetta="Oppure il codice dello studio">
                    <input className="input-field" value={codice} onChange={(e) => setCodice(e.target.value.trim())} maxLength={64} autoComplete="off" />
                  </Campo>
                </div>
                <button type="button" className="btn-ghost min-h-[44px]" disabled={!codice} onClick={() => void conCodice()}>
                  Trova
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {errore && <Avviso tono="danger">{errore}</Avviso>}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
        <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={onIndietro}>
          Indietro
        </button>
        <button type="button" className="btn-acido w-full sm:w-auto" disabled={invio} onClick={() => void conferma()}>
          {invio ? 'Registro l’azienda' : scelta === 'studio' ? 'Chiedi allo studio' : 'Registra l’azienda'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ attesa

function PassoAttesa({ stato, onAccettata, onRifiutata }: { stato: StatoIscrizione | null; onAccettata: (s: StatoIscrizione) => void; onRifiutata: (s: StatoIscrizione) => void }) {
  const ds = useDataSource();
  const router = useRouter();
  const [controllo, setControllo] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  const verifica = useCallback(
    async (aMano: boolean) => {
      if (aMano) setControllo(true);
      try {
        const s = await statoIscrizione();
        if (s?.stato === 'attivo') onAccettata(s);
        else if (s?.stato === 'rifiutata') onRifiutata(s);
        else if (aMano) setNota('Lo studio non ha ancora deciso. Ti avvisiamo appena accetta.');
      } catch {
        if (aMano) setNota('Non riesco a controllare adesso. Riprova tra poco.');
      } finally {
        if (aMano) setControllo(false);
      }
    },
    [onAccettata, onRifiutata]
  );

  // Controllo da solo ogni 30 secondi mentre la pagina e' aperta.
  useEffect(() => {
    const t = window.setInterval(() => void verifica(false), 30_000);
    return () => window.clearInterval(t);
  }, [verifica]);

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink">
        Hai chiesto a <span className="font-medium">{stato?.studio?.nome ?? 'lo studio'}</span>
        {stato?.studio?.comune ? ` (${stato.studio.comune})` : ''} di seguire la sicurezza di{' '}
        <span className="font-medium">{stato?.azienda?.ragione_sociale ?? 'la tua azienda'}</span>.
      </p>
      <p className="text-[14px] leading-relaxed text-ink-muted">
        Il titolare dello studio vede la richiesta nella sua coda di lavoro. Quando accetta entri nell’area della tua azienda. Se non accetta, torni alla scelta con i dati già compilati.
      </p>
      {nota && <Avviso tono="info">{nota}</Avviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          className="btn-ghost min-h-[44px]"
          onClick={async () => {
            await ds.auth.logout();
            router.replace('/');
          }}
        >
          Esci
        </button>
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={controllo} onClick={() => void verifica(true)}>
          {controllo ? 'Controllo' : 'Controlla adesso'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ codice di invito

type TipoCodice = 'azienda' | 'studio' | 'staff';

const CODICI: Array<{ k: TipoCodice; t: string; sotto: string; ruolo: Role }> = [
  { k: 'azienda', t: 'Codice dell’azienda', sotto: 'Te lo ha dato il tuo consulente: entri come titolare della tua azienda.', ruolo: 'datore_lavoro' },
  { k: 'studio', t: 'Codice dello studio', sotto: 'Lavori in uno studio HSE: te lo dà il titolare dello studio.', ruolo: 'consulente' },
  { k: 'staff', t: 'Codice dello staff Conflavoro', sotto: 'Riservato a chi lavora in Conflavoro.', ruolo: 'admin_conflavoro' },
];

function PassoCodice({ onIndietro }: { onIndietro: () => void }) {
  const ds = useDataSource();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoCodice>('azienda');
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const voce = CODICI.find((c) => c.k === tipo)!;

  const entra = async () => {
    if (!codice.trim()) return setErrore('Scrivi il codice che hai ricevuto.');
    setErrore(null);
    setInvio(true);
    try {
      const u = await ds.auth.completeOnboarding({
        role: voce.ruolo,
        ...(tipo === 'azienda' ? { azienda_invite_code: codice.trim().toUpperCase() } : tipo === 'studio' ? { studio_codice_invito: codice.trim() } : { admin_invite_code: codice.trim() }),
      });
      router.replace(ROLES[u.role].homePath);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Codice non valido.');
      setInvio(false);
    }
  };

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Tipo di codice" className="space-y-2">
        {CODICI.map((c) => {
          const on = tipo === c.k;
          return (
            <button
              key={c.k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setTipo(c.k);
                setErrore(null);
              }}
              className={clsx(
                'flex w-full min-h-[56px] flex-col justify-center rounded-[1.1rem] px-4 py-2.5 text-left transition-colors',
                on ? 'bg-grafite-900 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]'
              )}
            >
              <span className="text-[15px] font-medium">{c.t}</span>
              <span className={clsx('text-[13px]', on ? 'text-white/75' : 'text-ink-muted')}>{c.sotto}</span>
            </button>
          );
        })}
      </div>
      <Campo etichetta="Codice">
        <input className="input-field" value={codice} onChange={(e) => setCodice(e.target.value)} maxLength={191} autoComplete="off" />
      </Campo>
      {errore && <Avviso tono="danger">{errore}</Avviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={onIndietro}>
          Indietro
        </button>
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={invio} onClick={() => void entra()}>
          {invio ? 'Controllo il codice' : 'Entra'}
        </button>
      </div>
    </div>
  );
}
