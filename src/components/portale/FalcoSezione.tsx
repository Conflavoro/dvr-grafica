'use client';

import Link from 'next/link';

import { percorso } from '@/lib/percorso';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Avviso, Chiudi, Conversazioni, Documento, Ferma, Invia, Microfono, NuovaConversazione, Rotore, Scarica, Spunta } from '@/components/icone';
import { AgenteMarkdown, markdownInTestoSemplice } from '@/components/agente/AgenteMarkdown';
import { AzioniPannelliProvider, type AzioniPannelli } from '@/components/agente/pannelli/contesto';
import { PannelloVista } from '@/components/agente/pannelli/Pannelli';
import { eseguiPassi } from '@/lib/falco/esecutore';
import type { RicercaDocumenti } from '@/lib/falco/interfaccia';
import { CercaDocumenti } from './CercaDocumenti';
import { ascoltaTempoReale, riguarda } from '@/lib/tempo-reale';
import { nuovoIdRichiesta, type AgenteAzione, type AgenteConversazione, type AgenteMessaggio, type AgenteProgresso } from '@/lib/data-source';
import { connessioneCaduta, faseCorrente, recuperaRisposta } from '@/lib/agente-recupero';
import { useDataSource } from '@/lib/use-data-source';
import { useWavRecorder } from '@/lib/use-wav-recorder';
import { clearApiCache } from '@/lib/api';
import { ascoltaLettura, interrompiVoce, leggiAdAltaVoce, leggiConVoceAgente, letturaInCorso, sintesiDisponibile } from '@/lib/agente-voce';
import { sbloccaAudio } from '@/lib/falco-bocca';
import { suggerimenti as caricaSuggerimenti, type OggettoAperto, type Suggerimento } from '@/lib/portale/api';
import { cosaHaFatto, filtraStorico, quandoStorico, titoloSezioneFalco } from '@/lib/portale/scelta-azienda';
import { clsx } from '@/lib/clsx';
import { useAuth } from '@/lib/use-auth';
import { TestoAVoce } from '@/components/agente/TestoAVoce';
import { referente } from '@/lib/portale/referente-api';

/**
 * Falco di sezione (ADR-009): lo stesso agente, gia' dentro la sezione. Sa dove
 * sei, l'azienda e l'oggetto aperto; propone le azioni di quella sezione
 * (calcolate dal backend, non dal modello) e la conversazione resta legata li'.
 * Scritto = risposta scritta; a voce = voce e testo insieme.
 * Quando una risposta cambia dei dati la sezione si ricarica (onDatiCambiati).
 */
export interface FalcoSezioneProps {
  sezione: string;
  titolo: string;
  aziendaId: number | null;
  oggetto?: OggettoAperto | null;
  /** Testo d'aiuto sotto il nome, es. "Ti aiuto con i sopralluoghi". */
  sottotitolo?: string;
  onChiudi?: () => void;
  /** Apre il pannello del Falco (sul telefono e' un foglio dal basso): serve quando il Falco chiede una ricerca. */
  onApri?: () => void;
  onDatiCambiati?: () => void;
  /** Domanda da mandare subito (es. dal pulsante di una riga della sezione). */
  domanda?: { testo: string; n: number } | null;
  /** Ogni volta che cambia, Falco si mette in ascolto (microfono della barra o della home). */
  ascolta?: number;
  /**
   * Storico delle conversazioni dell'utente: di default quelle di questa azienda;
   * con l'interruttore (gestionale) tutte le proprie.
   */
  storico?: { aziendaId: number | null; nomeAzienda: string | null; interruttore: boolean };
  /** Testo da mettere nella casella, pronto da completare (es. "Chiedi una modifica" di un documento). */
  bozza?: { testo: string; n: number } | null;
  /** Area azienda: apre il pannello dei documenti (azioni "Apri il DVR"). */
  onApriDocumento?: () => void;
  /** Contenuto della conversazione vuota al posto dell'invito (es. la home dell'azienda). */
  vuoto?: ReactNode;
  /** Falco al centro della pagina (area azienda): senza tasto di chiusura. */
  centrale?: boolean;
  /** Conversazione da riaprire (es. dopo che il Falco ha lavorato su un'altra schermata). */
  riprendi?: { id: number; n: number } | null;
  /** Area azienda: il ruolo vede il referente (permesso messaggi). Senza, niente richiesta al server. */
  referenteVisibile?: boolean;
}

const AVATAR = percorso('/brand/falco-acido/avatar.webp');

function Avatar({ size = 40, parla = false }: { size?: number; parla?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx('relative block shrink-0 overflow-hidden rounded-full bg-white', parla ? 'shadow-[0_0_0_3px_#d4ff3a]' : 'shadow-[inset_0_0_0_1px_#e2e2e5]')}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AVATAR} alt="" width={size} height={size} className="h-full w-full object-cover" style={{ transform: 'scale(2.6)', transformOrigin: '50% 20%' }} />
    </span>
  );
}

export function FalcoSezione({
  sezione,
  titolo,
  aziendaId,
  oggetto = null,
  sottotitolo,
  onChiudi,
  onApri,
  onDatiCambiati,
  domanda,
  ascolta = 0,
  storico,
  bozza,
  onApriDocumento,
  vuoto,
  centrale = false,
  riprendi = null,
  referenteVisibile = true,
}: FalcoSezioneProps) {
  const ds = useDataSource();
  const router = useRouter();
  const rec = useWavRecorder();
  const microfonoRef = useRef<(() => Promise<void>) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [caricoFile, setCaricoFile] = useState<string | null>(null);
  // Ricerca dei documenti sul dispositivo chiesta dal Falco (cerca_documenti, 09/11).
  const [ricerca, setRicerca] = useState<RicercaDocumenti | null>(null);
  const inCoda = useRef<string | null>(null);
  const occupatoRef = useRef(false);
  const inviaRef = useRef<((t: string, vocale?: boolean) => Promise<void>) | null>(null);
  const [convId, setConvId] = useState<number | null>(null);
  const [messaggi, setMessaggi] = useState<AgenteMessaggio[]>([]);
  const [proposte, setProposte] = useState<Suggerimento[]>([]);
  const [testo, setTesto] = useState('');
  const [inAttesa, setInAttesa] = useState<string | null>(null);
  // Avanzamento dal vivo del turno; recupero = connessione caduta, la risposta arriva dal server.
  const [progresso, setProgresso] = useState<AgenteProgresso | null>(null);
  const [recupero, setRecupero] = useState(false);
  const [trascrivo, setTrascrivo] = useState(false);
  const [parla, setParla] = useState(false);
  // Risposta letta a voce: le parole si scuriscono a tempo con la voce (anche dopo un cambio di schermata).
  const aVoce = useSyncExternalStore(ascoltaLettura, letturaInCorso, () => null);
  const [errore, setErrore] = useState<string | null>(null);
  const [voceAgente, setVoceAgente] = useState(false);
  const [vista, setVista] = useState<'chat' | 'storico'>('chat');
  const [titoloConv, setTitoloConv] = useState<string | null>(null);
  // Falco al centro: si parte dalla pagina d'ingresso e l'ultima conversazione si riprende a richiesta.
  const [ultima, setUltima] = useState<AgenteConversazione | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const casella = useRef<HTMLTextAreaElement>(null);
  const chiave = `${sezione}|${aziendaId ?? ''}|${oggetto?.tipo ?? ''}${oggetto?.id ?? ''}`;
  // Area azienda (05 par. 21): è l'assistente, risponde con i dati che il ruolo vede (filtrati sul server).
  const areaAzienda = sezione.startsWith('azienda.');
  const { user } = useAuth();
  const [nomeReferente, setNomeReferente] = useState<string | null>(null);
  useEffect(() => {
    if (!areaAzienda || !aziendaId || !referenteVisibile) {
      setNomeReferente(null);
      return;
    }
    let vivo = true;
    referente(aziendaId)
      .then((r) => vivo && setNomeReferente(r.nome))
      .catch(() => vivo && setNomeReferente(null));
    return () => {
      vivo = false;
    };
  }, [areaAzienda, aziendaId, referenteVisibile]);

  // Conversazione: l'ultima della sezione e dell'azienda, a ogni cambio di sezione o azienda.
  useEffect(() => {
    let vivo = true;
    setErrore(null);
    setMessaggi([]);
    setConvId(null);
    setTitoloConv(null);
    setUltima(null);
    setVista('chat');
    void ds.agente
      .profilo()
      .then((p) => vivo && setVoceAgente(p.voce))
      .catch(() => undefined);
    ds.agente
      .conversazioni({ sezione, aziendaId })
      .then(async (l) => {
        const ultima = l[0];
        if (!ultima || !vivo) return;
        if (centrale) {
          setUltima(ultima);
          return;
        }
        const d = await ds.agente.conversazione(ultima.id);
        if (!vivo) return;
        setConvId(d.id);
        setTitoloConv(d.titolo);
        setMessaggi(d.messaggi);
      })
      .catch(() => undefined);
    // La voce non si ferma al cambio di schermata: il Falco può spostarsi mentre risponde.
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sezione, aziendaId]);

  // Proposte della sezione: cambiano anche con l'oggetto aperto e con gli eventi
  // del tempo reale sull'azienda in vista (ADR-013).
  const [giroEventi, setGiroEventi] = useState(0);
  useEffect(() => ascoltaTempoReale((l) => {
    if (l.eventi.some((e) => riguarda(e, aziendaId))) setGiroEventi((n) => n + 1);
  }), [aziendaId]);
  useEffect(() => {
    // Area azienda: finche' l'azienda non e' caricata non si sa quali sezioni vede il ruolo.
    if (areaAzienda && !aziendaId) return;
    let vivo = true;
    caricaSuggerimenti(sezione, aziendaId, oggetto)
      .then((s) => vivo && setProposte(s))
      .catch(() => vivo && setProposte((p) => (giroEventi > 0 ? p : [])));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, giroEventi]);

  const apriConversazione = useCallback(
    async (c: AgenteConversazione) => {
      interrompiVoce();
      setErrore(null);
      try {
        const d = await ds.agente.conversazione(c.id);
        setConvId(d.id);
        setTitoloConv(d.titolo);
        setMessaggi(d.messaggi);
        setVista('chat');
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Conversazione non disponibile.');
      }
    },
    [ds]
  );

  // Conversazione indicata dal guscio (striscia del Falco: "Apri la conversazione").
  const ultimaRipresa = useRef(0);
  useEffect(() => {
    if (riprendi && riprendi.n !== ultimaRipresa.current) {
      ultimaRipresa.current = riprendi.n;
      void apriConversazione({ id: riprendi.id, titolo: '', azienda: null, aggiornata: null });
    }
  }, [riprendi, apriConversazione]);

  const nuova = () => {
    interrompiVoce();
    setConvId(null);
    setTitoloConv(null);
    setMessaggi([]);
    setErrore(null);
    setVista('chat');
    casella.current?.focus();
  };

  // Testo pronto da completare (es. "Chiedi una modifica" dal pannello dei documenti).
  const ultimaBozza = useRef(0);
  useEffect(() => {
    if (bozza && bozza.n !== ultimaBozza.current) {
      ultimaBozza.current = bozza.n;
      setVista('chat');
      setTesto(bozza.testo);
      setTimeout(() => {
        const t = casella.current;
        if (t) {
          t.focus();
          t.setSelectionRange(t.value.length, t.value.length);
        }
      }, 60);
    }
  }, [bozza]);

  // Mentre il Falco parla si legge dall'inizio della sua risposta, non dal fondo (pannelli e proposte).
  const idAVoce = aVoce?.id ?? null;
  useEffect(() => {
    const el = idAVoce != null ? document.querySelector<HTMLElement>(`[data-falco-msg="${idAVoce}"]`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else fondo.current?.scrollIntoView({ block: 'end' });
  }, [messaggi, inAttesa, idAVoce]);

  const invia = useCallback(
    async (t: string, vocale = false) => {
      const richiesta = t.trim();
      if (!richiesta || inAttesa) return;
      interrompiVoce();
      sbloccaAudio();
      setErrore(null);
      setTesto('');
      setInAttesa(richiesta);
      setProgresso(null);
      setRecupero(false);
      const richiestaId = nuovoIdRichiesta();
      // Cosa sta facendo il Falco, letto ogni secondo e mezzo mentre lavora.
      const giro = setInterval(() => {
        ds.agente
          .progresso(richiestaId)
          .then(setProgresso)
          .catch(() => undefined);
      }, 1500);
      try {
        // Conversazione gia' aperta (anche dallo storico): resta nella sua sezione.
        const r = await ds.agente.invia({
          testo: richiesta,
          conversazioneId: convId,
          aziendaId: convId ? undefined : aziendaId,
          vocale,
          richiestaId,
          sezione: convId ? undefined : sezione,
          oggetto,
        });
        setConvId(r.conversazione.id);
        setTitoloConv(r.conversazione.titolo);
        // Falco principale: muove l'interfaccia davanti all'utente (cursore, evidenza, compilazione).
        if (r.interfaccia && r.interfaccia.length > 0) void eseguiPassi(r.interfaccia, { testo: r.risposta.testo, conversazioneId: r.conversazione.id });
        if (r.ricerca) {
          setRicerca(r.ricerca);
          onApri?.();
        }
        const mostra = () => setMessaggi((m) => [...m, r.messaggio_utente, r.risposta]);
        if (r.risposta.passi.some((p) => p.tipo === 'strumento' && p.ok)) {
          clearApiCache();
          onDatiCambiati?.();
          caricaSuggerimenti(sezione, aziendaId, oggetto)
            .then(setProposte)
            .catch(() => undefined);
        }
        // Scritto: solo testo. A voce: testo e voce partono insieme.
        if (vocale && sintesiDisponibile()) {
          const piano = markdownInTestoSemplice(r.risposta.testo);
          let fatto = false;
          const via = () => {
            if (!fatto) {
              fatto = true;
              mostra();
              setInAttesa(null);
            }
          };
          const riserva = setTimeout(via, 6000);
          const idRisposta = r.risposta.id;
          const cb = {
            onInizio: () => {
              clearTimeout(riserva);
              setParla(true);
              via();
            },
            onFine: () => {
              clearTimeout(riserva);
              setParla(false);
              via();
            },
          };
          if (voceAgente) leggiConVoceAgente(piano, (x) => ds.agente.voce(x), cb, idRisposta);
          else if (!leggiAdAltaVoce(piano, cb)) via();
          return;
        }
        mostra();
        setInAttesa(null);
      } catch (e) {
        clearInterval(giro);
        // Connessione caduta per un turno lungo: il server continua e salva la
        // risposta, che si ritrova dall'avanzamento invece di mostrare un errore.
        if (connessioneCaduta(e)) {
          setRecupero(true);
          try {
            const trovata = await recuperaRisposta((id) => ds.agente.progresso(id), richiestaId, { onProgresso: setProgresso });
            if (trovata) {
              const d = await ds.agente.conversazione(trovata.conversazioneId);
              setConvId(d.id);
              setTitoloConv(d.titolo);
              setMessaggi(d.messaggi);
              clearApiCache();
              onDatiCambiati?.();
              setInAttesa(null);
              return;
            }
          } catch {
            // Sotto: messaggio d'errore.
          } finally {
            setRecupero(false);
          }
          setErrore('Falco ci sta mettendo più del solito: la risposta comparirà nelle tue conversazioni appena è pronta.');
          setInAttesa(null);
          return;
        }
        setErrore(e instanceof Error ? e.message : 'Falco non ha risposto. Riprova.');
        setInAttesa(null);
      } finally {
        clearInterval(giro);
      }
    },
    [aziendaId, convId, ds, inAttesa, oggetto, onDatiCambiati, sezione, voceAgente]
  );

  // Domanda arrivata dalla sezione (pulsante di una riga).
  const ultimaDomanda = useRef(0);
  useEffect(() => {
    if (domanda && domanda.n !== ultimaDomanda.current) {
      ultimaDomanda.current = domanda.n;
      void invia(domanda.testo);
    }
  }, [domanda, invia]);

  const microfono = async () => {
    if (rec.registrando) {
      const file = rec.ferma();
      if (!file) return;
      setTrascrivo(true);
      try {
        const r = await ds.ai.transcribe(file, { companyId: aziendaId ?? undefined, contesto: `Richiesta a voce per Falco nella sezione ${titolo}` });
        const t = r.testo.trim();
        if (!t) {
          setErrore(r.errore || 'Non ho capito la registrazione. Riprova parlando vicino al microfono.');
          return;
        }
        setTrascrivo(false);
        await invia(t, true);
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Trascrizione non riuscita.');
      } finally {
        setTrascrivo(false);
      }
      return;
    }
    if (inAttesa) return;
    interrompiVoce();
    sbloccaAudio();
    // Finita la frase, dopo un attimo di silenzio la richiesta parte da sola.
    await rec.avvia({ onSilenzio: () => void microfonoRef.current?.() });
  };
  microfonoRef.current = microfono;

  // Documenti in chat (06/11): vanno nell'archivio dell'azienda, l'AI li legge, poi il Falco dice
  // cosa contengono, cosa registra e cosa manca ancora.
  const allega = async (files: FileList | File[] | null, verificati?: string, azienda?: number) => {
    const lista = Array.from(files ?? []).slice(0, 20);
    if (fileRef.current) fileRef.current.value = '';
    if (lista.length === 0) return;
    const az = azienda ?? aziendaId;
    if (!az) {
      setErrore('Scegli prima l’azienda dal menu in alto: i documenti vanno nel suo archivio.');
      return;
    }
    setErrore(null);
    const ids: number[] = [];
    try {
      for (let i = 0; i < lista.length; i++) {
        const f = lista[i];
        setCaricoFile(`Carico ${i + 1} di ${lista.length}: ${f.name}`);
        const tipo = f.type.startsWith('image/') ? 'foto' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : 'documento';
        const d = await ds.companyDocuments.addFile(az, tipo, f, { titolo: f.name, origine: 'Falco' });
        ids.push(d.id);
      }
      setCaricoFile('Leggo i documenti');
      const fine = Date.now() + 120_000;
      while (Date.now() < fine) {
        clearApiCache();
        const elenco = await ds.companyDocuments.list(az).catch(() => []);
        const pronti = elenco.filter((d) => ids.includes(d.id) && (!!d.testo_analisi || !!d.analisi_errore));
        if (pronti.length >= ids.length) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.');
      setCaricoFile(null);
      if (ids.length === 0) return;
    }
    setCaricoFile(null);
    clearApiCache();
    onDatiCambiati?.();
    const nomi = lista.map((f) => f.name).join(', ');
    const msg = verificati
      ? `Ho cercato sul mio dispositivo e caricato nell’archivio dell’azienda: ${nomi}. Quello che il contenuto confermava già:\n${verificati}\nLeggili, registra tu i dati che servono e dimmi cosa manca ancora.`
      : `Ho caricato nell’archivio dell’azienda: ${nomi}. Leggili, dimmi in breve cosa contengono, registra tu i dati che servono e dimmi cosa manca ancora.`;
    // Se il Falco sta gia' rispondendo, la richiesta parte appena ha finito (prima si perdeva).
    if (occupatoRef.current) inCoda.current = msg;
    else await inviaRef.current?.(msg);
  };

  // Ascolto chiesto da fuori (barra in alto, home): parte il microfono del pannello.
  const ultimoAscolto = useRef(ascolta);
  useEffect(() => {
    if (ascolta !== ultimoAscolto.current) {
      ultimoAscolto.current = ascolta;
      if (!rec.registrando) void microfono();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ascolta]);

  const onTasto = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void invia(testo);
    }
  };

  const azioneMessaggio = (a: AgenteAzione) => {
    if (a.tipo === 'download') {
      window.open(a.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (a.tipo === 'dvr') {
      if (onApriDocumento) onApriDocumento();
      else router.push(`/gestionale/dvr/?doc=dvr:${a.dvr_id}`);
      return;
    }
    router.push(`/gestionale/aziende/?id=${a.azienda_id}`);
  };

  const azioni: AzioniPannelli = {
    ruolo: null,
    occupato: inAttesa !== null,
    invia: (t) => void invia(t),
    apriAzienda: (a) => router.push(`/gestionale/aziende/?id=${a.id}`),
    scegliFoto: () => undefined,
    caricaAudio: async () => undefined,
    nomeAzienda: () => null,
  };

  const occupato = inAttesa !== null || trascrivo;
  occupatoRef.current = occupato;
  inviaRef.current = invia;
  useEffect(() => {
    if (!occupato && inCoda.current) {
      const m = inCoda.current;
      inCoda.current = null;
      void invia(m);
    }
  }, [occupato, invia]);
  const stato = rec.registrando ? 'ti ascolta' : trascrivo ? 'trascrive' : inAttesa ? 'al lavoro' : parla ? 'ti risponde' : 'pronto';

  return (
    <AzioniPannelliProvider value={azioni}>
      <section aria-label={`Falco, ${titolo}`} className="flex h-full min-h-0 flex-col bg-white">
        <header className="flex shrink-0 items-center gap-2 border-b border-perla-linea px-4 py-3">
          <Avatar parla={parla || rec.registrando} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-ink">{areaAzienda ? 'Assistente' : 'Falco'}</p>
            <p className="truncate text-[12.5px] text-ink-muted">
              {stato === 'pronto' ? (vista === 'storico' ? 'Le tue conversazioni' : titoloConv && messaggi.length > 0 ? titoloConv : areaAzienda ? 'Risponde con i dati della tua azienda' : sottotitolo ?? `Sono nella sezione ${titolo}`) : stato}
            </p>
          </div>
          {storico && (
            <>
              <button
                type="button"
                onClick={() => setVista((v) => (v === 'storico' ? 'chat' : 'storico'))}
                aria-pressed={vista === 'storico'}
                aria-label="Storico delle conversazioni"
                title="Storico"
                className={clsx('flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium', vista === 'storico' ? 'bg-grafite-900 text-white' : 'text-ink-muted hover:bg-perla-velo hover:text-ink')}
              >
                <Conversazioni size={17} aria-hidden />
                <span className={centrale ? 'hidden sm:inline' : 'hidden xl:inline'}>Storico</span>
              </button>
              <button type="button" onClick={nuova} disabled={occupato} aria-label="Nuova conversazione" title="Nuova conversazione" className="btn-icon disabled:opacity-40">
                <NuovaConversazione size={18} aria-hidden />
              </button>
            </>
          )}
          {onChiudi && !centrale && (
            <button type="button" onClick={onChiudi} aria-label="Chiudi Falco" className="btn-icon">
              <Chiudi size={18} aria-hidden />
            </button>
          )}
        </header>

        {vista === 'storico' && storico ? (
          <Storico
            aziendaId={storico.aziendaId}
            nomeAzienda={storico.nomeAzienda}
            interruttore={storico.interruttore}
            attiva={convId}
            onApri={(c) => void apriConversazione(c)}
            onNuova={nuova}
          />
        ) : (
        <div className={clsx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4', centrale && 'sm:px-6')} aria-live="polite">
          {messaggi.length === 0 && !inAttesa && ultima && (
            <button
              type="button"
              onClick={() => void apriConversazione(ultima)}
              className="mb-4 flex min-h-[48px] w-full items-center gap-3 rounded-[1rem] bg-perla-velo px-4 text-left text-[14px] text-ink hover:bg-grafite-100"
            >
              <Conversazioni size={17} aria-hidden className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate">
                Riprendi: <span className="font-medium">{ultima.titolo}</span>
              </span>
              <span className="shrink-0 text-[12px] text-ink-muted">{quandoStorico(ultima.aggiornata)}</span>
            </button>
          )}
          {messaggi.length === 0 && !inAttesa && (vuoto ?? (areaAzienda ? (
            <div>
              <p className="text-h3 text-fg">Ciao {(user?.name ?? '').split(' ')[0]}, cosa ti serve?</p>
              <p className="mt-1 text-small text-fg-muted">Scrivi o parla. Ti trovo documenti, scadenze, visite, corsi e dati di {storico?.nomeAzienda ?? 'la tua azienda'}.</p>
            </div>
          ) : (
            <div>
              <p className="text-[14px] leading-relaxed text-ink-soft">Dimmi cosa ti serve qui, a voce o per scritto. Oppure parti da una di queste:</p>
            </div>
          )))}
          <ul className="space-y-4">
            {messaggi.map((m) => (
              <li key={m.id} data-falco-msg={m.id} className="scroll-mt-3">
                {m.ruolo === 'utente' ? (
                  <p className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-[1.25rem] rounded-br-[6px] bg-grafite-900 px-3.5 py-2 text-[14px] leading-relaxed text-white">{m.testo}</p>
                ) : (
                  <div className="text-[14px] leading-relaxed text-ink-soft">
                    <FattoDaFalco passi={m.passi} />
                    {aVoce && aVoce.id === m.id ? <TestoAVoce pezzi={aVoce.pezzi} pezzo={aVoce.pezzo} parola={aVoce.parola} /> : <AgenteMarkdown testo={m.testo} />}
                    {m.pannelli.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {m.pannelli.map((p, i) => (
                          <PannelloVista key={i} p={p} />
                        ))}
                      </div>
                    )}
                    {m.azioni.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.azioni.map((a, i) => (
                          <button
                            key={`${a.tipo}-${i}`}
                            type="button"
                            onClick={() => azioneMessaggio(a)}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-[0.875rem] bg-white px-3.5 text-[13.5px] font-medium text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
                          >
                            {a.tipo === 'download' ? <Scarica size={15} aria-hidden /> : <Documento size={15} aria-hidden />}
                            {a.etichetta}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {inAttesa && (
              <li>
                <p className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-[1.25rem] rounded-br-[6px] bg-grafite-900 px-3.5 py-2 text-[14px] text-white">{inAttesa}</p>
                <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted" role="status">
                  <Rotore size={14} aria-hidden className="animate-spin text-acido-700 motion-reduce:animate-none" />{' '}
                  {recupero ? 'La connessione è lenta: la risposta arriva appena è pronta' : (faseCorrente(progresso) ?? 'Ci lavoro')}
                </p>
              </li>
            )}
          </ul>
          {proposte.length > 0 && !inAttesa && !(vuoto && messaggi.length === 0) && (
            <ul className="mt-4 space-y-2" aria-label="Azioni proposte">
              {proposte.map((s) => (
                <li key={s.etichetta}>
                  <button
                    type="button"
                    onClick={() => void invia(s.richiesta)}
                    disabled={occupato}
                    className="premi flex min-h-[48px] w-full items-center gap-2.5 rounded-[1rem] bg-white px-3.5 py-2 text-left text-[14px] font-medium text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b] disabled:opacity-50"
                  >
                    <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', s.cambiaDati ? 'bg-oro-500 shadow-[0_0_0_1px_#677f02]' : 'bg-grafite-300')} />
                    <span className="min-w-0 flex-1">{s.etichetta}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div ref={fondo} />
        </div>
        )}

        <footer className="shrink-0 border-t border-perla-linea p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {areaAzienda && nomeReferente && (
            <Link href="/azienda/messaggi/" className="mb-2 flex min-h-[32px] items-center gap-1.5 px-1 text-small text-fg-muted hover:text-fg">
              <Conversazioni size={14} aria-hidden /> Preferisci una persona? Scrivi a {nomeReferente}
            </Link>
          )}
          {ricerca && (
            <div className="mb-2">
              <CercaDocumenti
                ricerca={ricerca}
                onChiudi={() => setRicerca(null)}
                onConferma={(files, nota, logo) => {
                  const az = ricerca.aziendaId;
                  setRicerca(null);
                  void (async () => {
                    let notaLogo = '';
                    if (logo) {
                      try {
                        setCaricoFile('Metto il logo nella scheda');
                        await ds.loghi.caricaAzienda(az, logo);
                        notaLogo = `Ho messo come logo dell’azienda ${logo.name}.`;
                      } catch (e) {
                        notaLogo = `Il logo ${logo.name} non è stato caricato: ${e instanceof Error ? e.message : 'errore'}.`;
                      } finally {
                        setCaricoFile(null);
                      }
                    }
                    if (files.length) await allega(files, [notaLogo, nota].filter(Boolean).join('\n'), az);
                    else if (notaLogo) {
                      clearApiCache();
                      onDatiCambiati?.();
                      if (occupatoRef.current) inCoda.current = notaLogo;
                      else await inviaRef.current?.(notaLogo);
                    }
                  })();
                }}
              />
            </div>
          )}
          {(errore || rec.errore) && (
            <p role="alert" className="mb-2 rounded-[0.875rem] bg-stato-warn px-3 py-2 text-[13px] text-stato-warn-ink">
              {errore || rec.errore}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-[1.5rem] bg-perla-velo p-1.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_#111113]">
            <input ref={fileRef} type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.p7m,audio/*,video/*" onChange={(e) => void allega(e.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={occupato || !!caricoFile || rec.registrando}
              aria-label="Allega documenti"
              title="Allega documenti"
              className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-perla-velo hover:text-ink disabled:opacity-40"
            >
              {caricoFile ? <Rotore size={17} aria-hidden className="animate-spin" /> : <Documento size={18} aria-hidden />}
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Messaggio per Falco</span>
              <textarea
                ref={casella}
                value={testo}
                onChange={(e) => setTesto(e.target.value.slice(0, 4000))}
                onKeyDown={onTasto}
                rows={1}
                disabled={rec.registrando}
                placeholder={rec.registrando ? `Ti ascolto, ${rec.secondi} s` : areaAzienda ? 'Scrivi una domanda…' : `Chiedi a Falco su ${titolo.toLowerCase()}`}
                className="block max-h-36 min-h-[44px] w-full resize-none bg-transparent px-2.5 py-[11px] text-base text-ink placeholder:text-grafite-400 focus:outline-none focus-visible:shadow-none sm:text-[14px]"
              />
            </label>
            {testo.trim() ? (
              <button type="button" onClick={() => void invia(testo)} disabled={occupato} aria-label="Invia a Falco" className="premi grid h-11 w-11 shrink-0 place-items-center rounded-full bg-grafite-900 text-white disabled:opacity-40">
                {inAttesa ? <Rotore size={17} aria-hidden className="animate-spin" /> : <Invia size={17} aria-hidden />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void microfono()}
                disabled={!rec.registrando && occupato}
                aria-pressed={rec.registrando}
                aria-label={rec.registrando ? 'Interrompi' : areaAzienda ? 'Parla con l\'assistente' : 'Parla con Falco'}
                className={clsx('premi grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40', rec.registrando ? 'bg-[#d63d3e] text-white' : 'bg-oro-500 text-acido-950')}
              >
                {rec.registrando ? <Ferma size={16} aria-hidden /> : trascrivo ? <Rotore size={17} aria-hidden className="animate-spin" /> : <Microfono size={18} aria-hidden />}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-ink-subtle">Risposte con assistenza AI: verificale prima di usarle nei documenti.</p>
        </footer>
      </section>
    </AzioniPannelliProvider>
  );
}

/** Cosa ha fatto il Falco per arrivare alla risposta: gli strumenti usati, in una riga sobria. */
function FattoDaFalco({ passi }: { passi: AgenteMessaggio['passi'] }) {
  const fatti = cosaHaFatto(passi);
  if (fatti.length === 0) return null;
  return (
    <details className="group mb-2 rounded-[0.875rem] bg-perla-velo px-3 py-2 text-[12.5px] text-ink-muted">
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <Spunta size={13} aria-hidden className="shrink-0 text-acido-700" />
        <span className="min-w-0 flex-1 truncate">
          {fatti.length === 1 ? `Ha fatto: ${fatti[0].testo}` : `Ha fatto ${fatti.length} passi: ${fatti[0].testo} e altro`}
        </span>
        <span className="shrink-0 text-[12px] underline underline-offset-2 group-open:hidden">Dettagli</span>
      </summary>
      <ul className="mt-1.5 space-y-1 pl-5">
        {fatti.map((f) => (
          <li key={f.testo} className="flex items-start gap-2">
            {f.ok ? <Spunta size={12} aria-hidden className="mt-0.5 shrink-0 text-acido-700" /> : <Avviso size={12} aria-hidden className="mt-0.5 shrink-0 text-stato-danger-ink" />}
            <span className={f.ok ? '' : 'text-stato-danger-ink'}>
              {f.testo}
              {!f.ok && ' (non riuscito)'}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Storico delle conversazioni dell'utente (solo le sue: lo garantisce il backend). */
function Storico({
  aziendaId,
  nomeAzienda,
  interruttore,
  attiva,
  onApri,
  onNuova,
}: {
  aziendaId: number | null;
  nomeAzienda: string | null;
  interruttore: boolean;
  attiva: number | null;
  onApri: (c: AgenteConversazione) => void;
  onNuova: () => void;
}) {
  const ds = useDataSource();
  const [tutte, setTutte] = useState(!aziendaId);
  const [voci, setVoci] = useState<AgenteConversazione[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setVoci(null);
    setErrore(null);
    ds.agente
      .conversazioni(tutte || !aziendaId ? undefined : { aziendaId })
      .then((l) => vivo && setVoci(filtraStorico(l, { aziendaId, tutte })))
      .catch((e: unknown) => vivo && setErrore(e instanceof Error ? e.message : 'Storico non disponibile.'));
    return () => {
      vivo = false;
    };
  }, [ds, aziendaId, tutte]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
      <button type="button" onClick={onNuova} className="flex min-h-[48px] w-full items-center gap-2.5 rounded-[1rem] bg-grafite-900 px-4 text-[14px] font-medium text-white">
        <NuovaConversazione size={17} aria-hidden /> Nuova conversazione
      </button>
      {interruttore && aziendaId && (
        <div role="group" aria-label="Quali conversazioni" className="mt-3 flex gap-1 rounded-full bg-perla-velo p-1">
          {[
            { v: false, t: nomeAzienda ? `Solo ${nomeAzienda}` : 'Questa azienda' },
            { v: true, t: 'Tutte le mie' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              aria-pressed={tutte === o.v}
              onClick={() => setTutte(o.v)}
              className={clsx('min-h-[44px] lg:min-h-[40px] min-w-0 flex-1 truncate rounded-full px-3 text-[13px] font-medium', tutte === o.v ? 'bg-white text-ink shadow-[0_1px_2px_rgba(14,14,16,0.12)]' : 'text-ink-muted')}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}
      {errore && (
        <p role="alert" className="mt-3 rounded-[0.875rem] bg-stato-warn px-3 py-2 text-[13px] text-stato-warn-ink">
          {errore}
        </p>
      )}
      {!voci && !errore && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-muted" role="status">
          <Rotore size={14} aria-hidden className="animate-spin motion-reduce:animate-none" /> Carico lo storico
        </p>
      )}
      {voci && voci.length === 0 && <p className="mt-4 text-[14px] text-ink-muted">{tutte || !aziendaId ? 'Non hai ancora conversazioni con Falco.' : 'Nessuna conversazione su questa azienda.'}</p>}
      {voci && voci.length > 0 && (
        <ul className="mt-3 space-y-1">
          {voci.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onApri(c)}
                aria-current={c.id === attiva ? 'true' : undefined}
                className={clsx('flex min-h-[56px] w-full flex-col justify-center rounded-[0.875rem] px-3 py-2 text-left', c.id === attiva ? 'bg-perla-velo' : 'hover:bg-perla-velo/70')}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{c.titolo}</span>
                  <span className="shrink-0 text-[12px] text-ink-subtle">{quandoStorico(c.aggiornata)}</span>
                </span>
                <span className="mt-0.5 block w-full truncate text-[12.5px] text-ink-muted">
                  {[titoloSezioneFalco(c.sezione), (tutte || !aziendaId) && c.azienda?.ragione_sociale].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { Avatar as AvatarFalco };
