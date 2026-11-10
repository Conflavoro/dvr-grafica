'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ChevronLeft, LayoutPanelLeft, Menu, PanelRightClose, PanelRightOpen, Search } from '@/components/icone';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { FalcoStato } from '@/components/agente/FalcoMascot';
import { RegiaFalco, type DaFare } from '@/components/agente/regia/RegiaFalco';
import { Briefing, TemaVista } from '@/components/agente/regia/Briefing';
import { boccaSuTesto, chiudiBocca, sbloccaAudio } from '@/lib/falco-bocca';
import { LavoroInCorso } from '@/components/agente/LavoroInCorso';
import { MessaggioAgente } from '@/components/agente/MessaggioAgente';
import { AgenteRail } from '@/components/agente/AgenteRail';
import { AziendaSelettore, type AziendaBreve } from '@/components/agente/AziendaSelettore';
import { Compositore, MAX_TESTO } from '@/components/agente/Compositore';
import { SpazioLavoro } from '@/components/agente/spazio/SpazioLavoro';
import { markdownInTestoSemplice } from '@/components/agente/AgenteMarkdown';
import { AzioniPannelliProvider, type AzioniPannelli } from '@/components/agente/pannelli/contesto';
import { PannelloVista, titoloPannello } from '@/components/agente/pannelli/Pannelli';
import { conTema, temaPerRuolo, type AgenteTema, type SchedaSpazio } from '@/lib/agente-temi';
import {
  conPreferita,
  conRecente,
  indiceAziende,
  leggiPreferenze,
  salvaPreferenze,
  type AziendaIndice,
  type PreferenzeAziende,
} from '@/lib/agente-aziende';
import { PaletteComandi, type DocumentoIndice, type PersonaIndice } from '@/components/agente/PaletteComandi';
import { VistaAzienda } from '@/components/agente/VistaAzienda';
import type { Company, ControlRoomPanoramica, Dvr, Scadenza } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { useDataSource } from '@/lib/use-data-source';
import { useWavRecorder } from '@/lib/use-wav-recorder';
import { clearApiCache } from '@/lib/api';
import { extractKeyframes } from '@/lib/video-frames';
import { audioComeWav, videoDaAnalizzareNelBrowser } from '@/lib/ingresso-file';
import { preparaCaricamenti, riassuntoPerAgente, trascinaFile, type VoceCaricamento } from '@/lib/caricamenti';
import { conTempoMassimo, TEMPI } from '@/lib/attesa';
import { CodaCaricamenti } from '@/components/agente/CodaCaricamenti';
import {
  interrompiVoce,
  leggiAdAltaVoce,
  leggiConVoceAgente,
  letturaVoceAttiva,
  salvaLetturaVoce,
  sintesiDisponibile,
} from '@/lib/agente-voce';
import type { AgenteConversazione, AgenteConversazioneDettaglio, AgenteMessaggio, AgenteProgresso, CompanyDocumentTipo } from '@/lib/data-source';
import { nuovoIdRichiesta } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';


const RAIL_KEY = 'crm_dvr_agente_rail_ridotta';
const SPAZIO_KEY = 'crm_dvr_agente_spazio_chiuso';

function leggiFlag(k: string): boolean | null {
  try {
    const v = window.localStorage.getItem(k);
    return v == null ? null : v === '1';
  } catch {
    return null;
  }
}
function scriviFlag(k: string, v: boolean) {
  try {
    window.localStorage.setItem(k, v ? '1' : '0');
  } catch {
    /* preferenza solo di comodo */
  }
}

/** true se la risposta ha usato strumenti andati a buon fine: lo spazio di lavoro va riletto. */
function haLavorato(m: AgenteMessaggio): boolean {
  return m.passi.some((p) => p.tipo === 'strumento' && p.ok);
}

/** Massima attesa della voce prima di mostrare comunque la risposta scritta. */
const ATTESA_VOCE_MS = 6000;
const PROGRESSO_MS = 1200;
const DIGITAZIONE_MS = 2000;

/** Reazione del falco a una risposta: allerta se c'e' qualcosa da controllare, altrimenti soddisfatto. */
function reazioneA(m: AgenteMessaggio): 'attenzione' | 'fatto' {
  const problemi =
    m.passi.some((p) => p.tipo === 'autocorrezione' || (p.tipo === 'strumento' && !p.ok)) ||
    m.pannelli.some(
      (p) =>
        (p.tipo === 'rischi' && p.rischi.some((r) => r.probabilita * r.gravita >= 9)) ||
        (p.tipo === 'scadenze' && p.scadenze.some((x) => x.scaduta))
    );
  return problemi ? 'attenzione' : 'fatto';
}

/** true se il tasto arriva da un campo o da un controllo (li' lo spazio ha gia' un significato). */
function daCampo(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT|BUTTON|A|VIDEO)$/.test(el.tagName) || el.isContentEditable || !!el.closest('[role=button],[role=menuitem],[role=option],[role=dialog]');
}

/** Nome di battesimo senza titoli professionali (Ing., Avv., Geom., Dott. ...). */
function nomeProprio(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter((p) => !/^(ing|avv|geom|dott|dott\.ssa|dr|arch|per|p\.i|rag|prof)\.?$/i.test(p));
  return parti[0] ?? nome;
}

function errMsg(e: unknown, riserva: string): string {
  return e instanceof Error && e.message ? e.message : riserva;
}

/**
 * 'mobile' sotto 1024 px, 'medio' fino a 1279, 'ampio' oltre. Decide quale
 * disposizione montare (una sola, cosi' video e polling non si duplicano).
 */
function useLarghezza(): 'mobile' | 'medio' | 'ampio' {
  const [l, setL] = useState<'mobile' | 'medio' | 'ampio'>('mobile');
  useEffect(() => {
    try {
      const desk = window.matchMedia('(min-width: 1024px)');
      const ampio = window.matchMedia('(min-width: 1280px)');
      const f = () => setL(ampio.matches ? 'ampio' : desk.matches ? 'medio' : 'mobile');
      f();
      desk.addEventListener?.('change', f);
      ampio.addEventListener?.('change', f);
      return () => {
        desk.removeEventListener?.('change', f);
        ampio.removeEventListener?.('change', f);
      };
    } catch {
      return undefined;
    }
  }, []);
  return l;
}

export default function AgentePage() {
  const { user } = useAuth();
  const ds = useDataSource();
  const rec = useWavRecorder();
  const larghezza = useLarghezza();
  const desktop = larghezza !== 'mobile';
  const ruolo = user?.role ?? null;
  const isDatore = ruolo === 'datore_lavoro';

  const [nomeAgente, setNomeAgente] = useState('Falco');
  /** Voce clonata dell'agente disponibile sul backend (altrimenti voce del dispositivo). */
  const [voceAgente, setVoceAgente] = useState(false);
  const [palette, setPalette] = useState(false);
  const [datiAziende, setDatiAziende] = useState<{ aziende: Company[]; scadenze: Scadenza[]; dvr: Dvr[] } | null>(null);
  const [aziendeCarica, setAziendeCarica] = useState(true);
  const [aziendeErrore, setAziendeErrore] = useState<string | null>(null);
  const [preferenze, setPreferenze] = useState<PreferenzeAziende>({ preferite: [], recenti: [] });
  const [persone, setPersone] = useState<PersonaIndice[] | null>(null);
  const [documenti, setDocumenti] = useState<DocumentoIndice[] | null>(null);
  const [conversazioni, setConversazioni] = useState<AgenteConversazione[]>([]);
  const [convCarica, setConvCarica] = useState(true);
  const [convErrore, setConvErrore] = useState<string | null>(null);
  const [attiva, setAttiva] = useState<AgenteConversazioneDettaglio | null>(null);
  const [aprendo, setAprendo] = useState(false);
  const [aziendaNuova, setAziendaNuova] = useState<AziendaBreve | null>(null);
  const [selettoreAperto, setSelettoreAperto] = useState(false);

  const [testo, setTesto] = useState('');
  const [inAttesa, setInAttesa] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<AgenteProgresso | null>(null);
  /** Id dell'ultima risposta arrivata in questa sessione: compare con la scrittura progressiva. */
  const [daScrivere, setDaScrivere] = useState<number | null>(null);
  const [scrivendo, setScrivendo] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [reazione, setReazione] = useState<'attenzione' | 'fatto' | null>(null);
  /** Ultimo messaggio non andato a buon fine, per "Riprova". */
  const [fallito, setFallito] = useState<{ testo: string; vocale: boolean; ricarica?: boolean } | null>(null);
  /** File caricati dalla chat, uno per riga con avanzamento ed errore. */
  const [codaFile, setCodaFile] = useState<VoceCaricamento[]>([]);
  const [codaAzienda, setCodaAzienda] = useState<AziendaBreve | null>(null);
  /** File trascinati sopra la conversazione. */
  const [trascinando, setTrascinando] = useState(false);
  const [trascrivendo, setTrascrivendo] = useState(false);
  const [caricamento, setCaricamento] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [parlando, setParlando] = useState(false);
  /** La bocca recita la risposta anche senza voce (voce spenta o non disponibile). */
  const [recita, setRecita] = useState(false);
  const [altezza, setAltezza] = useState(800);
  const [cr, setCr] = useState<ControlRoomPanoramica | null>(null);
  const [voceOn, setVoceOn] = useState(true);
  const [railMobile, setRailMobile] = useState(false);
  const [railRidotta, setRailRidotta] = useState<boolean | null>(null);
  const [spazioChiuso, setSpazioChiuso] = useState(false);
  /** Tavolo aperto a mano anche senza azienda: mostra la scelta dell'azienda. */
  const [tavoloChiesto, setTavoloChiesto] = useState(false);
  const [foglio, setFoglio] = useState(false);
  const [tema, setTema] = useState<AgenteTema | null>(null);
  const [scheda, setScheda] = useState<SchedaSpazio>('azienda');
  /** Cresce quando l'agente scrive dati: lo spazio di lavoro rilegge. */
  const [versioneDati, setVersioneDati] = useState(0);
  /** Pannelli nuovi non ancora visti nel foglio (mobile). */
  const [nuoviPannelli, setNuoviPannelli] = useState(false);
  const [daEliminare, setDaEliminare] = useState<AgenteConversazione | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errElimina, setErrElimina] = useState<string | null>(null);
  /** Messaggio di cui l'area Pannelli mostra i pannelli (null = il piu' recente). */
  const [pannelliDi, setPannelliDi] = useState<number | null>(null);

  const fineRef = useRef<HTMLDivElement>(null);
  // Stato e non ref: la conversazione compare dopo il caricamento dell'utente e
  // l'osservatore va agganciato quando c'e' davvero.
  const [scorrevole, setScorrevole] = useState<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const timerDigita = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reazioneInAttesa = useRef<'attenzione' | 'fatto' | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const fotoPerRef = useRef<AziendaBreve | null>(null);
  // Conversazione mostrata ('nuova' o id): non sovrascrivo la vista se l'utente
  // cambia conversazione mentre l'agente sta ancora rispondendo.
  const vistaRef = useRef<number | 'nuova'>('nuova');
  const attivaRef = useRef<AgenteConversazioneDettaglio | null>(null);
  const aziendaNuovaRef = useRef<AziendaBreve | null>(null);
  const voceOnRef = useRef(true);
  const voceAgenteRef = useRef(false);
  const temaRef = useRef<AgenteTema | null>(null);
  attivaRef.current = attiva;
  aziendaNuovaRef.current = aziendaNuova;
  voceOnRef.current = voceOn;
  voceAgenteRef.current = voceAgente;
  temaRef.current = tema;

  const occupato = inAttesa !== null || trascrivendo || caricamento !== null;
  const azienda: AziendaBreve | null = attiva ? attiva.azienda : aziendaNuova;
  const messaggi: AgenteMessaggio[] = useMemo(() => attiva?.messaggi ?? [], [attiva]);
  const vuota = messaggi.length === 0 && inAttesa === null;
  const vuotaRef = useRef(vuota);
  vuotaRef.current = vuota;
  const statoFalco: FalcoStato = rec.registrando
    ? 'ascolta'
    : occupato || aprendo
      ? 'pensa'
      : parlando || scrivendo || recita
        ? 'parla'
        : digitando
          ? 'ascolta'
          : reazione ?? (tema && vuota ? 'ascolta' : 'riposo');

  // La reazione parte quando la risposta e' tutta a schermo e la voce ha finito.
  useEffect(() => {
    if (!scrivendo && !parlando && reazioneInAttesa.current) {
      setReazione(reazioneInAttesa.current);
      reazioneInAttesa.current = null;
    }
  }, [scrivendo, parlando]);

  useEffect(
    () => () => {
      if (timerDigita.current) clearTimeout(timerDigita.current);
    },
    []
  );

  const onTesto = (t: string) => {
    setTesto(t);
    // Chi scrive interrompe la lettura ad alta voce.
    if (t) interrompiVoce();
    setReazione(null);
    setDigitando(true);
    if (timerDigita.current) clearTimeout(timerDigita.current);
    timerDigita.current = setTimeout(() => setDigitando(false), DIGITAZIONE_MS);
  };

  const conPannelli = useMemo(() => messaggi.filter((m) => m.ruolo === 'agente' && m.pannelli.length > 0), [messaggi]);
  const mostrati = useMemo(
    () => (pannelliDi != null ? conPannelli.find((m) => m.id === pannelliDi) : undefined) ?? conPannelli[conPannelli.length - 1] ?? null,
    [conPannelli, pannelliDi]
  );

  // Nomi delle aziende noti alla console (per i pannelli che portano solo l'id).
  const nomiAziende = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of conversazioni) if (c.azienda) m.set(c.azienda.id, c.azienda.ragione_sociale);
    for (const msg of messaggi)
      for (const p of msg.pannelli) {
        if (p.tipo === 'aziende') for (const a of p.aziende) m.set(a.id, a.ragione_sociale);
        if (p.tipo === 'azienda') m.set(p.azienda.id, p.azienda.ragione_sociale);
        if (p.tipo === 'scadenze') for (const s of p.scadenze) if (s.azienda_id && s.azienda) m.set(s.azienda_id, s.azienda);
      }
    if (azienda) m.set(azienda.id, azienda.ragione_sociale);
    return m;
  }, [conversazioni, messaggi, azienda]);

  useEffect(() => {
    setVoceOn(letturaVoceAttiva());
    setRailRidotta(leggiFlag(RAIL_KEY));
    setSpazioChiuso(leggiFlag(SPAZIO_KEY) === true);
    return () => interrompiVoce();
  }, []);

  const caricaConversazioni = useCallback(async () => {
    setConvCarica(true);
    setConvErrore(null);
    try {
      setConversazioni(await ds.agente.conversazioni());
    } catch (e) {
      setConvErrore(errMsg(e, 'Conversazioni non disponibili.'));
    } finally {
      setConvCarica(false);
    }
  }, [ds]);

  useEffect(() => {
    void caricaConversazioni();
    ds.agente
      .profilo()
      .then((p) => {
        setNomeAgente(p.nome);
        setVoceAgente(p.voce);
      })
      .catch(() => {
        /* nome di riserva: Falco */
      });
  }, [ds, caricaConversazioni]);

  useEffect(() => {
    // Conversazione vuota (benvenuto, tema, vista azienda): si legge dall'inizio.
    if (messaggi.length === 0 && inAttesa === null && !caricamento && !trascrivendo) {
      if (scorrevole) scorrevole.scrollTop = 0;
      return;
    }
    const ridotto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    fineRef.current?.scrollIntoView({ behavior: ridotto ? 'auto' : 'smooth', block: 'end' });
  }, [messaggi.length, inAttesa, caricamento, trascrivendo, scorrevole]);

  // La risposta si scrive un poco alla volta e i pannelli preparati compaiono
  // alla fine: se si era in fondo alla conversazione si resta in fondo, cosi'
  // l'ultima riga non finisce sotto la casella del messaggio.
  useEffect(() => {
    const scorre = scorrevole;
    const dentro = scorre?.firstElementChild;
    if (!scorre || !dentro || typeof ResizeObserver === 'undefined') return;
    let inFondo = true;
    const suScorri = () => {
      inFondo = scorre.scrollHeight - scorre.scrollTop - scorre.clientHeight < 160;
    };
    const osservatore = new ResizeObserver(() => {
      if (inFondo && !vuotaRef.current) scorre.scrollTop = scorre.scrollHeight;
    });
    scorre.addEventListener('scroll', suScorri, { passive: true });
    osservatore.observe(dentro);
    return () => {
      scorre.removeEventListener('scroll', suScorri);
      osservatore.disconnect();
    };
  }, [scorrevole]);

  const fermaVoce = () => {
    interrompiVoce();
    chiudiBocca();
    setParlando(false);
    setRecita(false);
  };

  /**
   * Lettura ad alta voce della risposta: con la voce dell'agente se il backend
   * l'ha configurata (paragrafo per paragrafo, il primo parte subito), altrimenti
   * o se fallisce con la voce italiana del dispositivo.
   */
  const leggiRisposta = (markdown: string, alVia?: () => void) => {
    const testo = markdownInTestoSemplice(markdown);
    const cb = {
      onInizio: () => {
        setParlando(true);
        alVia?.();
      },
      onFine: () => {
        setParlando(false);
        alVia?.();
      },
    };
    if (voceAgenteRef.current) leggiConVoceAgente(testo, (x) => ds.agente.voce(x), cb);
    else leggiAdAltaVoce(testo, cb);
  };

  const nuova = () => {
    fermaVoce();
    vistaRef.current = 'nuova';
    attivaRef.current = null;
    aziendaNuovaRef.current = null;
    temaRef.current = null;
    setAttiva(null);
    setAziendaNuova(null);
    setPannelliDi(null);
    setErrore(null);
    setFallito(null);
    setReazione(null);
    setScrivendo(false);
    setDaScrivere(null);
    setRailMobile(false);
    setTema(null);
    setNuoviPannelli(false);
    setTimeout(() => areaRef.current?.focus(), 0);
  };

  const apri = async (id: number) => {
    setRailMobile(false);
    if (attiva?.id !== id) setTema(null);
    if (attiva?.id === id) return;
    fermaVoce();
    setErrore(null);
    setPannelliDi(null);
    setScrivendo(false);
    setDaScrivere(null);
    setReazione(null);
    vistaRef.current = id;
    setAprendo(true);
    try {
      const d = await ds.agente.conversazione(id);
      if (vistaRef.current === id) setAttiva(d);
    } catch (e) {
      if (vistaRef.current === id) setErrore(errMsg(e, 'Conversazione non disponibile.'));
    } finally {
      setAprendo(false);
    }
  };

  /**
   * Invia un messaggio. Con `azienda`: la conversazione deve riguardare quell'azienda;
   * se quella aperta e' gia' legata ad altro (il backend la fissa alla creazione) ne apro una nuova.
   */
  const invia = async (contenuto: string, opz: { vocale?: boolean; azienda?: AziendaBreve } = {}) => {
    const t = contenuto.trim().slice(0, MAX_TESTO);
    // Il contesto del tema viaggia nascosto in testa al messaggio (a schermo non si vede).
    const daInviare = conTema(t, temaRef.current);
    if (!t || inAttesa !== null) return;
    fermaVoce();
    sbloccaAudio();
    setErrore(null);
    setFallito(null);
    setReazione(null);
    reazioneInAttesa.current = null;
    setDigitando(false);
    let conv = attivaRef.current;
    let aziendaId = aziendaNuovaRef.current?.id ?? null;
    if (opz.azienda && conv?.azienda?.id !== opz.azienda.id) {
      if (conv) {
        vistaRef.current = 'nuova';
        attivaRef.current = null;
        setAttiva(null);
        setPannelliDi(null);
        conv = null;
      }
      setAziendaNuova(opz.azienda);
      aziendaId = opz.azienda.id;
    }
    setInAttesa(daInviare);
    setTesto('');
    setProgresso(null);
    const chiave = vistaRef.current;
    const richiestaId = nuovoIdRichiesta();
    // Avanzamento dal vivo: interrogo finche' la risposta non torna.
    let attivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const leggi = async () => {
      if (!attivo) return;
      try {
        const pr = await ds.agente.progresso(richiestaId);
        if (attivo && vistaRef.current === chiave) setProgresso(pr);
      } catch {
        /* l'avanzamento e' un di piu': un errore non ferma la risposta */
      }
      if (attivo) timer = setTimeout(() => void leggi(), PROGRESSO_MS);
    };
    timer = setTimeout(() => void leggi(), 400);
    // Richiesta a voce: la risposta compare quando parte la voce (testo e voce insieme).
    let attesaVoce = false;
    try {
      const r = await ds.agente.invia({
        testo: daInviare,
        conversazioneId: conv?.id ?? null,
        aziendaId: conv ? undefined : aziendaId,
        vocale: opz.vocale === true,
        richiestaId,
      });
      attivo = false;
      if (timer) clearTimeout(timer);
      setConversazioni((l) => [r.conversazione, ...l.filter((c) => c.id !== r.conversazione.id)]);
      if (haLavorato(r.risposta)) {
        clearApiCache();
        setVersioneDati((v) => v + 1);
      }
      if (vistaRef.current === chiave) {
        const convId = r.conversazione.id;
        vistaRef.current = convId;
        setPannelliDi(null);
        reazioneInAttesa.current = reazioneA(r.risposta);
        let mostrata = false;
        const mostra = () => {
          if (mostrata) return;
          mostrata = true;
          setInAttesa(null);
          setProgresso(null);
          if (vistaRef.current !== convId) return;
          setAttiva((prec) => ({
            ...r.conversazione,
            messaggi: [...(prec && prec.id === convId ? prec.messaggi : []), r.messaggio_utente, r.risposta],
          }));
          setDaScrivere(r.risposta.id);
          setScrivendo(true);
          if (r.risposta.pannelli.length > 0) setNuoviPannelli(true);
        };
        // Richiesta scritta: risposta solo scritta. Richiesta a voce: voce e testo insieme.
        if (opz.vocale === true && voceOnRef.current && sintesiDisponibile()) {
          attesaVoce = true;
          const riserva = setTimeout(mostra, ATTESA_VOCE_MS);
          leggiRisposta(r.risposta.testo, () => {
            clearTimeout(riserva);
            mostra();
          });
        } else {
          mostra();
          const inizio = markdownInTestoSemplice(r.risposta.testo).slice(0, 320);
          setRecita(true);
          boccaSuTesto(inizio, undefined, () => setRecita(false));
        }
      }
    } catch (e) {
      if (vistaRef.current === chiave) {
        // Tempo scaduto: l'agente puo' aver finito comunque. Riprova rilegge invece di rimandare (niente doppioni).
        const scaduto = (e as { code?: string }).code === 'TIMEOUT';
        setErrore(
          scaduto
            ? `${nomeAgente} ci sta mettendo più del previsto. La risposta potrebbe arrivare comunque: tocca Riprova per ricaricare la conversazione.`
            : errMsg(e, "L'agente non ha risposto.")
        );
        setFallito({ testo: t, vocale: opz.vocale === true, ricarica: scaduto });
        setReazione('attenzione');
      }
    } finally {
      attivo = false;
      if (timer) clearTimeout(timer);
      if (!attesaVoce) {
        setInAttesa(null);
        setProgresso(null);
      }
    }
  };

  const riprova = () => {
    if (!fallito) return;
    const f = fallito;
    setFallito(null);
    if (f.ricarica) {
      setErrore(null);
      clearApiCache();
      const id = attivaRef.current?.id;
      if (id != null) {
        vistaRef.current = id;
        setAprendo(true);
        ds.agente
          .conversazione(id)
          .then((d) => {
            if (vistaRef.current === id) setAttiva(d);
          })
          .catch((e: unknown) => setErrore(errMsg(e, 'Conversazione non disponibile.')))
          .finally(() => setAprendo(false));
      } else {
        void caricaConversazioni();
        setErrore('Ho aggiornato l’elenco delle conversazioni: se la risposta è arrivata la trovi nella più recente.');
      }
      return;
    }
    void invia(f.testo, { vocale: f.vocale });
  };

  // ----- Voce -----
  const microfono = async () => {
    if (rec.registrando) {
      const file = rec.ferma();
      if (!file) return;
      setTrascrivendo(true);
      setErrore(null);
      try {
        const r = await ds.ai.transcribe(file, { companyId: azienda?.id, contesto: 'Messaggio vocale per il Super Agente HSE' });
        const trascritto = r.testo.trim();
        if (!trascritto) {
          setErrore(
            r.errore ||
              (ds.mode === 'local'
                ? 'In modalità dimostrativa la dettatura non è disponibile.'
                : 'Non sono riuscito a capire la registrazione. Riprova parlando vicino al microfono.')
          );
          return;
        }
        setTrascrivendo(false);
        await invia(trascritto, { vocale: true });
      } catch (e) {
        setErrore(errMsg(e, 'Trascrizione non riuscita.'));
      } finally {
        setTrascrivendo(false);
      }
      return;
    }
    if (occupato) return;
    fermaVoce();
    setErrore(null);
    await rec.avvia();
  };

  // ----- Materiale di sopralluogo nell'archivio dell'azienda -----
  const scegliFoto = (perAzienda: AziendaBreve | null) => {
    if (occupato) return;
    const az = perAzienda ?? azienda;
    if (!az) {
      if (attiva) {
        setErrore("Questa conversazione non è legata a un'azienda. Avvia una nuova conversazione e scegli l'azienda per caricare foto.");
      } else {
        setErrore("Scegli prima l'azienda della conversazione: la foto finisce nel suo archivio.");
        setSelettoreAperto(true);
      }
      return;
    }
    fotoPerRef.current = az;
    fotoRef.current?.click();
  };

  /** Aggiorna una riga della coda dei file. */
  const aggiornaFile = (id: string, patch: Partial<VoceCaricamento>) => setCodaFile((c) => c.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  /**
   * Un file nell'archivio dell'azienda: invio con avanzamento, poi attesa
   * dell'analisi del server (con tempo massimo). I video oltre il limite di
   * caricamento non partono: il browser ne estrae fotogrammi e audio e manda
   * solo quelli. Lancia un errore se il file non arriva nell'archivio.
   */
  const elaboraFile = async (v: VoceCaricamento, az: AziendaBreve): Promise<Pick<VoceCaricamento, 'analisi' | 'analisiErrore'>> => {
    const imposta = (patch: Partial<VoceCaricamento>) => aggiornaFile(v.id, patch);
    const file = v.file;
    if (videoDaAnalizzareNelBrowser(file)) {
      imposta({ stato: 'analizzo', fase: 'estraggo i fotogrammi del video', percento: null });
      const frames = await conTempoMassimo(
        extractKeyframes(file, 8, 1024, 60000),
        90_000,
        'Il browser non ha letto il video in tempo: salvalo in MP4 o caricalo da un altro dispositivo.'
      );
      imposta({ fase: 'estraggo l’audio del video' });
      const wav = await conTempoMassimo(audioComeWav(file), 120_000, 'audio').catch(() => null);
      if (wav && wav.size > 4096) {
        const audioFile = new File([wav], `${file.name.replace(/\.[^.]+$/, '')}_audio.wav`, { type: 'audio/wav' });
        await ds.companyDocuments.addFile(az.id, 'audio', audioFile, { origine: 'audio del video', titolo: `Audio del video ${file.name}` });
      }
      if (frames.length === 0) {
        return { analisi: '', analisiErrore: 'questo browser non riesce a leggere i fotogrammi del video: salvalo in MP4 o caricalo da un altro dispositivo' };
      }
      imposta({ fase: 'analizzo il video' });
      const res = await ds.ai.describeVideo({ companyId: az.id, frames });
      const analisi = (res.testo ?? '').trim();
      if (analisi) {
        await ds.companyDocuments.addNote(az.id, analisi, `Video ${file.name} (fotogrammi)`, 'video', 'video');
        return { analisi, analisiErrore: null };
      }
      return { analisi: '', analisiErrore: res.errore ?? 'analisi del video non riuscita' };
    }
    imposta({ stato: 'carico', fase: 'invio al server', percento: 0 });
    const doc = await ds.companyDocuments.addFile(az.id, v.tipo, file, {
      origine: v.tipo === 'audio' ? 'registrazione' : v.tipo === 'foto' ? 'foto' : 'upload',
      onProgress: (pc) => imposta({ percento: pc }),
    });
    let analisi = (doc.testo_analisi ?? '').trim();
    let analisiErrore = doc.analisi_errore ?? null;
    // Modalita' dimostrativa: il file resta nel browser, nessuna analisi da aspettare.
    if (ds.mode === 'local' && !analisi) return { analisi: '', analisiErrore: 'in modalità dimostrativa i file si conservano ma non vengono analizzati' };
    const frase: Record<string, string> = { foto: 'analizzo la foto', audio: 'trascrivo la registrazione', video: 'analizzo il video', documento: 'leggo il file' };
    imposta({ stato: 'analizzo', fase: frase[v.tipo] ?? frase.documento, percento: null });
    // Documenti lunghi, ZIP e video richiedono piu' tempo; oltre il tempo massimo l'analisi continua nell'archivio.
    const scadenza = Date.now() + (v.tipo === 'foto' ? 45_000 : TEMPI.analisi);
    while (!analisi && !analisiErrore && Date.now() < scadenza) {
      await new Promise((r) => setTimeout(r, 3000));
      clearApiCache(); // l'elenco va riletto davvero, non dalla cache breve delle GET
      const agg = (await ds.companyDocuments.list(az.id).catch(() => [])).find((d) => d.id === doc.id);
      analisi = (agg?.testo_analisi ?? '').trim();
      analisiErrore = agg?.analisi_errore ?? null;
    }
    return { analisi, analisiErrore };
  };

  const caricandoRef = useRef(false);

  /** Carica in sequenza le righe in coda, poi manda all'agente un solo riassunto. */
  const eseguiCoda = async (voci: VoceCaricamento[], az: AziendaBreve) => {
    caricandoRef.current = true;
    const finali = new Map(voci.map((v) => [v.id, v] as const));
    const daFare = voci.filter((v) => v.stato === 'in_coda');
    try {
      for (let i = 0; i < daFare.length; i++) {
        const v = daFare[i];
        setCaricamento(daFare.length > 1 ? `Carico il file ${i + 1} di ${daFare.length}: ${v.nome}` : `Carico ${v.nome}`);
        let fine: VoceCaricamento;
        try {
          const esito = await elaboraFile(v, az);
          fine = {
            ...v,
            ...esito,
            stato: 'fatto',
            percento: 100,
            errore: null,
            fase: esito.analisi ? 'caricato e analizzato' : esito.analisiErrore ? 'caricato' : 'caricato, analisi in corso',
          };
        } catch (e) {
          fine = { ...v, stato: 'errore', percento: null, fase: 'non caricato', errore: errMsg(e, 'Caricamento non riuscito.') };
        }
        finali.set(v.id, fine);
        aggiornaFile(v.id, fine);
      }
    } finally {
      caricandoRef.current = false;
      setCaricamento(null);
    }
    clearApiCache();
    setVersioneDati((n) => n + 1);
    const perChi = azienda?.id === az.id ? '' : ` per ${az.ragione_sociale}`;
    const msg = riassuntoPerAgente(
      voci.map((v) => finali.get(v.id) ?? v),
      perChi
    );
    if (msg) await invia(msg);
  };

  /** File scelti o trascinati: controlli, coda visibile, caricamento. */
  const caricaFile = async (files: File[], az: AziendaBreve, tipo?: CompanyDocumentTipo) => {
    if (files.length === 0) return;
    if (caricandoRef.current || inAttesa !== null) {
      setErrore('Aspetta che finisca il lavoro in corso, poi carica di nuovo i file.');
      return;
    }
    setErrore(null);
    const voci = preparaCaricamenti(files).map((v) => (tipo ? { ...v, tipo } : v));
    setCodaFile(voci);
    setCodaAzienda(az);
    await eseguiCoda(voci, az);
  };

  const riprovaFile = (id: string) => {
    const v = codaFile.find((x) => x.id === id);
    if (!v || !codaAzienda || caricandoRef.current || inAttesa !== null) return;
    const pronta: VoceCaricamento = { ...v, stato: 'in_coda', errore: null, analisiErrore: null, fase: 'in coda', percento: null };
    aggiornaFile(id, pronta);
    void eseguiCoda([pronta], codaAzienda);
  };

  /** Ingresso unico dei file (selettore e trascinamento): chi puo', per quale azienda. */
  const riceviFile = (files: File[], perAzienda: AziendaBreve | null) => {
    if (files.length === 0) return;
    if (isDatore) {
      setErrore('Con il tuo profilo i documenti si consultano: per inviarne uno nuovo chiedi allo studio.');
      return;
    }
    const az = perAzienda ?? azienda;
    if (!az) {
      if (attiva) {
        setErrore("Questa conversazione non è legata a un'azienda. Avvia una nuova conversazione e scegli l'azienda per caricare file.");
      } else {
        setErrore("Scegli prima l'azienda della conversazione: i file finiscono nel suo archivio.");
        setSelettoreAperto(true);
      }
      return;
    }
    void caricaFile(files, az);
  };

  // ----- Trascinamento dei file sulla conversazione e sulla barra di scrittura -----
  const contaTrascina = useRef(0);
  const suTrascinaEntra = (e: DragEvent<HTMLElement>) => {
    if (!trascinaFile(e.dataTransfer?.types)) return;
    e.preventDefault();
    contaTrascina.current += 1;
    setTrascinando(true);
  };
  const suTrascinaSopra = (e: DragEvent<HTMLElement>) => {
    if (!trascinaFile(e.dataTransfer?.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isDatore ? 'none' : 'copy';
  };
  const suTrascinaEsce = (e: DragEvent<HTMLElement>) => {
    if (!trascinaFile(e.dataTransfer?.types)) return;
    contaTrascina.current = Math.max(0, contaTrascina.current - 1);
    if (contaTrascina.current === 0) setTrascinando(false);
  };
  const suRilascia = (e: DragEvent<HTMLElement>) => {
    if (!trascinaFile(e.dataTransfer?.types)) return;
    e.preventDefault();
    contaTrascina.current = 0;
    setTrascinando(false);
    riceviFile(Array.from(e.dataTransfer.files ?? []), null);
  };
  // Un file lasciato fuori dalla conversazione non deve aprirsi al posto dell'app.
  useEffect(() => {
    const blocca = (e: globalThis.DragEvent) => {
      if (trascinaFile(e.dataTransfer?.types)) e.preventDefault();
    };
    window.addEventListener('dragover', blocca);
    window.addEventListener('drop', blocca);
    return () => {
      window.removeEventListener('dragover', blocca);
      window.removeEventListener('drop', blocca);
    };
  }, []);

  const cambiaVoce = () => {
    const v = !voceOn;
    setVoceOn(v);
    salvaLetturaVoce(v);
    if (!v) fermaVoce();
  };

  const confermaElimina = async () => {
    if (!daEliminare) return;
    setEliminando(true);
    setErrElimina(null);
    try {
      await ds.agente.eliminaConversazione(daEliminare.id);
      setConversazioni((l) => l.filter((c) => c.id !== daEliminare.id));
      if (attiva?.id === daEliminare.id) nuova();
      setDaEliminare(null);
    } catch (e) {
      setErrElimina(errMsg(e, 'Eliminazione non riuscita.'));
    } finally {
      setEliminando(false);
    }
  };

  const azioniPannelli: AzioniPannelli = {
    ruolo,
    occupato,
    invia: (t) => void invia(t),
    apriAzienda: (az) => void invia(`Apri la scheda di ${az.ragione_sociale}`, { azienda: az }),
    scegliFoto: (az) => scegliFoto(az),
    caricaAudio: (az, file) => caricaFile([file], az, 'audio'),
    nomeAzienda: (id) => nomiAziende.get(id) ?? null,
  };

  const vocePossibile = sintesiDisponibile();

  // Click o tap sul falco = stesso comando del microfono.
  const propsFalco = {
    onAttiva: () => void microfono(),
    etichettaAttiva: rec.registrando ? `Ferma e invia a ${nomeAgente}` : `Parla con ${nomeAgente}`,
    onReazioneFinita: () => setReazione(null),
  };

  // Scorciatoie: Ctrl/Cmd+K cerca, Ctrl/Cmd+Maiusc+O nuova conversazione; spazio tenuto premuto fuori dai campi = parla.
  const microfonoRef = useRef(microfono);
  microfonoRef.current = microfono;
  const nuovaRef = useRef(nuova);
  nuovaRef.current = nuova;
  const statoRef = useRef({ registrando: rec.registrando, occupato });
  statoRef.current = { registrando: rec.registrando, occupato };
  const fermaAppenaParte = useRef(false);
  useEffect(() => {
    if (rec.registrando && fermaAppenaParte.current) {
      fermaAppenaParte.current = false;
      void microfonoRef.current();
    }
  }, [rec.registrando]);
  useEffect(() => {
    let daSpazio = false;
    const giu = (e: globalThis.KeyboardEvent) => {
      // Ctrl o Cmd + K: cerca e comandi. Ctrl o Cmd + Maiusc + O: nuova conversazione.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        nuovaRef.current();
        return;
      }
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || daCampo(e.target)) return;
      if (statoRef.current.registrando || statoRef.current.occupato) return;
      e.preventDefault();
      daSpazio = true;
      fermaAppenaParte.current = false;
      void microfonoRef.current();
    };
    const su = (e: globalThis.KeyboardEvent) => {
      if (e.code !== 'Space' || !daSpazio) return;
      e.preventDefault();
      daSpazio = false;
      // Rilasciato prima che il microfono fosse pronto: si ferma appena parte.
      if (statoRef.current.registrando) void microfonoRef.current();
      else fermaAppenaParte.current = true;
    };
    window.addEventListener('keydown', giu);
    window.addEventListener('keyup', su);
    return () => {
      window.removeEventListener('keydown', giu);
      window.removeEventListener('keyup', su);
    };
  }, []);

  // ----- Aziende: indice, stato, preferite e recenti -----
  useEffect(() => {
    let vivo = true;
    setAziendeErrore(null);
    Promise.all([ds.companies.list(), ds.scadenze.list().catch(() => [] as Scadenza[]), ds.dvr.list().catch(() => [] as Dvr[])])
      .then(([aziende, scadenze, dvr]) => vivo && setDatiAziende({ aziende, scadenze, dvr }))
      .catch((e: unknown) => vivo && setAziendeErrore(errMsg(e, 'Elenco aziende non disponibile.')))
      .finally(() => vivo && setAziendeCarica(false));
    return () => {
      vivo = false;
    };
  }, [ds, versioneDati]);

  const indice: AziendaIndice[] = useMemo(
    () => (datiAziende ? indiceAziende(datiAziende.aziende, datiAziende.scadenze, datiAziende.dvr) : []),
    [datiAziende]
  );

  useEffect(() => {
    if (user) setPreferenze(leggiPreferenze(user.id));
  }, [user]);

  // Ogni azienda aperta finisce tra le recenti.
  const idAzienda = azienda?.id ?? null;
  useEffect(() => {
    if (!user || idAzienda == null) return;
    setPreferenze((p) => {
      const n = conRecente(p, idAzienda);
      salvaPreferenze(user.id, n);
      return n;
    });
  }, [user, idAzienda]);

  const cambiaPreferita = (id: number) => {
    if (!user) return;
    setPreferenze((p) => {
      const n = conPreferita(p, id);
      salvaPreferenze(user.id, n);
      return n;
    });
  };

  // Persone e documenti per la ricerca: li leggo alla prima apertura della palette.
  const extraLetti = useRef(false);
  useEffect(() => {
    if (!palette || extraLetti.current || !datiAziende) return;
    extraLetti.current = true;
    ds.lavoratori
      .list()
      .then((l) => setPersone(l.map((x) => ({ id: x.id, nome: `${x.nome} ${x.cognome}`.trim(), mansione: x.mansione, aziendaId: x.company_id }))))
      .catch(() => setPersone([]));
    const docDvr: DocumentoIndice[] = datiAziende.dvr.map((d) => ({ chiave: `dvr${d.id}`, titolo: `DVR versione ${d.versione}`, tipo: 'DVR', aziendaId: d.company_id }));
    Promise.all(
      datiAziende.aziende.slice(0, 40).map((c) =>
        ds.companyDocuments
          .list(c.id)
          .then((l) => l.map((d) => ({ chiave: `doc${d.id}`, titolo: d.titolo || d.filename || 'Documento', tipo: d.tipo, aziendaId: c.id })))
          .catch(() => [] as DocumentoIndice[])
      )
    ).then((liste) => setDocumenti([...docDvr, ...liste.flat()]));
  }, [palette, datiAziende, ds]);
  useEffect(() => {
    extraLetti.current = false;
  }, [versioneDati]);

  /** Apre la vista azienda: identita', le sue conversazioni, spazio di lavoro su di lei. */
  const apriAzienda = (a: { id: number; ragione_sociale: string }, sch: SchedaSpazio = 'control_room') => {
    if (attivaRef.current || inAttesa !== null || temaRef.current) nuova();
    setAziendaNuova({ id: a.id, ragione_sociale: a.ragione_sociale });
    setScheda(sch);
    setRailMobile(false);
    if (!desktop && sch !== 'control_room') setFoglio(true);
  };

  const nuovaAzienda = () => {
    nuova();
    void invia("Aggiungi una nuova azienda: chiedimi i dati che servono, uno alla volta, oppure partiamo dalla visura camerale.");
  };

  const scadenzeSettimana = () => {
    nuova();
    void invia('Quali scadenze delle mie aziende cadono in questa settimana o sono già superate?');
  };

  const conversazioniAzienda = useMemo(
    () => (azienda ? conversazioni.filter((c) => c.azienda?.id === azienda.id) : []),
    [conversazioni, azienda]
  );
  const aziendaVista: AziendaIndice | null = azienda
    ? indice.find((a) => a.id === azienda.id) ?? { id: azienda.id, ragione_sociale: azienda.ragione_sociale, partita_iva: '', ateco: '', ateco_label: '', comune: '', lavoratori: 0, stato: 'ok', motivo: 'Dati in caricamento' }
    : null;
  const temaVisto = tema ? temaPerRuolo(tema, isDatore) : null;
  const inVistaAzienda = vuota && !tema && aziendaVista !== null;

  // ----- Temi e spazio di lavoro -----
  const apriTema = (t: AgenteTema) => {
    if (attivaRef.current || inAttesa !== null) {
      const az = aziendaNuovaRef.current ?? attivaRef.current?.azienda ?? null;
      nuova();
      setAziendaNuova(az);
    }
    setTema(t);
    setScheda(t.spazio);
    setRailMobile(false);
    setReazione(null);
    setTimeout(() => areaRef.current?.focus(), 0);
  };

  const scegliAzienda = (az: AziendaBreve) => {
    if (attivaRef.current) {
      const t = tema;
      nuova();
      setTema(t);
    }
    setAziendaNuova(az);
  };

  const cambiaSpazio = () => {
    if (!desktop) {
      setFoglio(true);
      setNuoviPannelli(false);
      return;
    }
    // Si decide da cio' che si vede: senza azienda ne' lavoro il tavolo e' chiuso
    // anche se la preferenza dice aperto, e il tasto deve aprirlo davvero.
    const chiudi = tavoloAperto;
    setSpazioChiuso(chiudi);
    setTavoloChiesto(!chiudi);
    scriviFlag(SPAZIO_KEY, chiudi);
  };

  const spazio = (onChiudi?: () => void) => (
    <SpazioLavoro
      azienda={azienda}
      fissata={attiva !== null || inAttesa !== null}
      onScegliAzienda={(az) => {
        scegliAzienda(az);
      }}
      scheda={scheda}
      onScheda={setScheda}
      conPannelli={conPannelli}
      mostrato={mostrati}
      onMostra={setPannelliDi}
      versione={versioneDati}
      ruolo={ruolo}
      occupato={occupato}
      chiedi={(t) => {
        setFoglio(false);
        void invia(t);
      }}
      nomeAgente={nomeAgente}
      onChiudi={onChiudi}
    />
  );

  // Altezza utile: il falco in regia si dimensiona per non far mai scorrere la colonna.
  useEffect(() => {
    const f = () => setAltezza(window.innerHeight);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // Control Room dell'azienda aperta: alimenta cosa il falco ha notato e il punteggio in testata.
  useEffect(() => {
    if (!idAzienda) {
      setCr(null);
      return;
    }
    let vivo = true;
    ds.controlRoom
      .controlRoom(idAzienda)
      .then((x) => vivo && setCr(x))
      .catch(() => vivo && setCr(null));
    return () => {
      vivo = false;
    };
  }, [ds, idAzienda, versioneDati]);

  const daFare: DaFare[] = useMemo(() => {
    if (azienda && cr && cr.azienda_id === azienda.id) {
      return cr.criticita.slice(0, 4).map((c) => ({
        chiave: `c-${c.chiave}`,
        titolo: c.titolo,
        dettaglio: c.messaggio,
        tono: c.priorita === 'alta' ? 'rosso' : c.priorita === 'media' ? 'oro' : 'neutro',
        onClick: () => void invia(`Sistemiamo questa criticità di ${azienda.ragione_sociale}: ${c.titolo}. ${c.azione}`),
      }));
    }
    return indice
      .filter((a) => a.stato !== 'ok')
      .sort((a, b) => (a.stato === b.stato ? 0 : a.stato === 'scaduto' ? -1 : 1))
      .slice(0, 4)
      .map((a) => ({ chiave: `a-${a.id}`, titolo: a.ragione_sociale, dettaglio: a.motivo, tono: a.stato === 'scaduto' ? 'rosso' : 'oro', onClick: () => apriAzienda(a, 'control_room') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azienda, cr, indice]);

  const ultimaRisposta = useMemo(() => [...messaggi].reverse().find((m) => m.ruolo === 'agente') ?? null, [messaggi]);
  const sottotitolo = statoFalco === 'parla' && ultimaRisposta ? markdownInTestoSemplice(ultimaRisposta.testo).slice(0, 260) : null;
  const lavorando = inAttesa !== null || trascrivendo || caricamento !== null || aprendo;

  const regia = {
    nomeAgente,
    stato: statoFalco,
    propsFalco,
    progresso,
    dettaglio: trascrivendo ? 'Trascrivo il messaggio vocale' : caricamento ?? (aprendo ? 'Apro la conversazione' : null),
    lavorando,
    sottotitolo,
    daFare,
    registrando: rec.registrando,
    secondi: rec.secondi,
    onParla: () => {
      sbloccaAudio();
      void microfono();
    },
    voce: { possibile: vocePossibile, attiva: voceOn, parlando, onCambia: cambiaVoce, onFerma: fermaVoce },
  };

  // Il tavolo a destra compare quando c'e' qualcosa da mostrare: un'azienda, un tema o un lavoro fatto.
  const tavoloUtile = azienda !== null || conPannelli.length > 0 || tema !== null;
  const tavoloAperto = desktop && !spazioChiuso && (tavoloUtile || tavoloChiesto);
  const larghezzaRegia = larghezza === 'ampio' ? 340 : 300;

  const conversazione = (
    <div className="mx-auto w-full max-w-[46rem] space-y-6 px-4 py-6 sm:px-8">
      {azienda && (
        <button
          type="button"
          onClick={() => apriAzienda(azienda)}
          className="-ml-2 -mt-2 inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full px-2 text-[13px] lg:min-h-[40px] font-medium text-ink-muted hover:text-brand-900"
        >
          <ChevronLeft size={15} aria-hidden className="shrink-0" />
          <span className="truncate">Tutte le conversazioni su {azienda.ragione_sociale}</span>
        </button>
      )}
      {messaggi.map((m) => (
        <div key={`${m.ruolo}-${m.id}`}>
          <MessaggioAgente
            m={m}
            nomeAgente={nomeAgente}
            animato={m.id === daScrivere && m.ruolo === 'agente'}
            onFineScrittura={() => {
              setScrivendo(false);
              setDaScrivere(null);
            }}
          />
          {m.ruolo === 'agente' &&
            m.pannelli.length > 0 &&
            (tavoloAperto ? (
              <button
                type="button"
                onClick={() => setPannelliDi(m.id)}
                aria-pressed={mostrati?.id === m.id}
                className={clsx(
                  'ml-0 mt-3 inline-flex min-h-[36px] max-w-full items-center gap-2 rounded-full border px-2.5 text-left text-[12.5px] sm:ml-12',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                  mostrati?.id === m.id ? 'border-transparent bg-oro-500 text-acido-950' : 'border-perla-linea text-ink-muted hover:border-grafite-400 hover:text-ink'
                )}
              >
                <LayoutPanelLeft size={14} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate">
                  {mostrati?.id === m.id ? 'Sul tavolo: ' : 'Rimetti sul tavolo: '}
                  {m.pannelli.map(titoloPannello).join(', ')}
                </span>
              </button>
            ) : desktop ? (
              <button
                type="button"
                onClick={() => {
                  setPannelliDi(m.id);
                  setSpazioChiuso(false);
                  scriviFlag(SPAZIO_KEY, false);
                }}
                className="ml-0 mt-3 inline-flex min-h-[36px] max-w-full items-center gap-2 rounded-full border border-perla-linea px-2.5 text-left text-[12.5px] text-ink-muted hover:text-ink sm:ml-12"
              >
                <LayoutPanelLeft size={14} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate">Apri sul tavolo: {m.pannelli.map(titoloPannello).join(', ')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPannelliDi(m.id);
                  setFoglio(true);
                  setNuoviPannelli(false);
                }}
                className="mt-3 flex min-h-[48px] w-full items-center gap-2.5 rounded-[0.875rem] bg-perla-carta px-3.5 text-left text-[13.5px] font-medium text-brand-900 shadow-[0_0_0_1px_rgba(103,127,2,0.4)]"
              >
                <LayoutPanelLeft size={16} aria-hidden className="shrink-0 text-oro-600" />
                <span className="min-w-0 flex-1 truncate">Ti ho preparato: {m.pannelli.map(titoloPannello).join(', ')}</span>
              </button>
            ))}
        </div>
      ))}
      {inAttesa !== null && (
        <>
          <MessaggioAgente m={{ id: -1, ruolo: 'utente', testo: inAttesa, passi: [], azioni: [], pannelli: [], creato: null }} nomeAgente={nomeAgente} />
          {/* Su schermo largo il lavoro dal vivo e' nella regia del falco. */}
          {!desktop && <LavoroInCorso progresso={progresso} />}
        </>
      )}
      {(trascrivendo || caricamento) && inAttesa === null && !desktop && <LavoroInCorso progresso={null} dettaglio={trascrivendo ? 'Trascrivo il messaggio vocale' : caricamento} />}
    </div>
  );

  const centro = vuota ? (
    inVistaAzienda && aziendaVista ? (
      <VistaAzienda
        azienda={aziendaVista}
        conversazioni={conversazioniAzienda}
        preferita={preferenze.preferite.includes(aziendaVista.id)}
        isDatore={isDatore}
        disabled={occupato || aprendo}
        onPreferita={() => cambiaPreferita(aziendaVista.id)}
        onNuova={() => areaRef.current?.focus()}
        onApri={(id) => void apri(id)}
        onElimina={(c) => {
          setErrElimina(null);
          setDaEliminare(c);
        }}
        onChiedi={(q) => void invia(q)}
      />
    ) : temaVisto ? (
      <TemaVista tema={temaVisto} disabled={occupato || aprendo} onIndietro={() => setTema(null)} onDomanda={(q) => void invia(q)} onAvvio={() => void invia(temaVisto.avvio)} />
    ) : (
      <Briefing
        nomeUtente={user ? nomeProprio(user.name) : ''}
        nomeAgente={nomeAgente}
        isDatore={isDatore}
        disabled={occupato || aprendo}
        daFare={daFare}
        mostraDaFare={!desktop}
        onTema={apriTema}
      />
    )
  ) : (
    conversazione
  );

  const punteggio = cr && azienda && cr.azienda_id === azienda.id && cr.totale != null ? cr.totale : null;
  const chipPunteggio = punteggio != null && (
    <button
      type="button"
      onClick={() => {
        setScheda('control_room');
        if (desktop) {
          setSpazioChiuso(false);
          scriviFlag(SPAZIO_KEY, false);
        } else setFoglio(true);
      }}
      title="Safety Score dell'azienda"
      className={clsx(
        'premi inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] lg:h-9 font-semibold shadow-[0_0_0_1px_rgba(14,14,16,0.09)]',
        punteggio >= 85 ? 'text-ok-ink' : punteggio >= 65 ? 'text-oro-700' : 'text-[#d63d3e]'
      )}
    >
      <span className="cifre">{punteggio}</span>
      <span className="text-[11.5px] font-normal text-ink-muted">su 100</span>
    </button>
  );

  return (
    <AppShell pageTitle="Agente" modalita="agente">
      <AzioniPannelliProvider value={azioniPannelli}>
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {/* ---------- Testata ---------- */}
          <header
            className="flex shrink-0 items-center gap-1.5 border-b border-perla-linea px-2 sm:gap-2 sm:px-4"
            style={{ paddingTop: desktop ? '0.75rem' : 'max(0.375rem, env(safe-area-inset-top, 0px))', paddingBottom: desktop ? '0.75rem' : '0.5rem' }}
          >
            <button type="button" onClick={() => setRailMobile(true)} aria-label="Aziende e conversazioni" title="Aziende e conversazioni" className="btn-icon h-11 w-11 shrink-0">
              <Menu size={20} aria-hidden />
            </button>
            {desktop && (
              <span className="mr-2 hidden shrink-0 select-none leading-none lg:block">
                <span className="block text-[15px] font-medium tracking-[-0.01em] text-ink">Agente HSE</span>
                <span className="mt-1 block text-[12px] text-ink-muted">Conflavoro</span>
              </span>
            )}
            <AziendaSelettore valore={azienda} fissata={attiva !== null || inAttesa !== null} aperto={selettoreAperto} onAperto={setSelettoreAperto} onCambia={setAziendaNuova} />
            {chipPunteggio}
            {desktop && tema && <span className="hidden min-w-0 truncate border-l border-perla-linea pl-3 text-[12.5px] text-ink-muted xl:block">{tema.titolo}</span>}
            <div className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => setPalette(true)}
              data-origine-ricerca=""
              aria-label="Cerca azienda, persona, documento"
              className={clsx(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-full text-ink-muted transition-shadow',
                desktop ? 'min-w-[15rem] px-4 shadow-[inset_0_0_0_1.5px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]' : 'w-11 justify-center hover:bg-perla-velo'
              )}
            >
              <Search size={18} aria-hidden />
              {desktop && (
                <>
                  <span className="flex-1 text-left text-[14px]">Cerca…</span>
                  <span className="tasto tasto-chiaro">Ctrl K</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={cambiaSpazio}
              aria-label={desktop ? (tavoloAperto ? 'Chiudi il tavolo' : 'Apri il tavolo') : 'Apri il tavolo'}
              aria-pressed={desktop ? tavoloAperto : undefined}
              title="Il tavolo: quello che il falco ti prepara"
              className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#9a9aa2]"
            >
              {desktop ? tavoloAperto ? <PanelRightClose size={18} aria-hidden /> : <PanelRightOpen size={18} aria-hidden /> : <LayoutPanelLeft size={18} aria-hidden />}
              {!desktop && nuoviPannelli && <span aria-hidden className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#d63d3e] ring-2 ring-white" />}
            </button>
          </header>

          {/* ---------- Telefono: il falco sempre in vista, in una striscia ---------- */}
          {!desktop && (
            <div className="shrink-0 border-b border-perla-linea px-3 py-1.5">
              <RegiaFalco {...regia} variante="striscia" />
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            {/* ---------- Regia: il falco protagonista ---------- */}
            {desktop && (
              <aside className="shrink-0 bg-black" style={{ width: larghezzaRegia }} aria-label={`${nomeAgente}, il tuo agente`}>
                <RegiaFalco {...regia} variante="colonna" altezza={altezza - 64} />
              </aside>
            )}

            {/* ---------- Conversazione ---------- */}
            <section
              className="relative flex min-w-0 flex-1 flex-col"
              aria-label={`Conversazione con ${nomeAgente}`}
              onDragEnter={suTrascinaEntra}
              onDragOver={suTrascinaSopra}
              onDragLeave={suTrascinaEsce}
              onDrop={suRilascia}
            >
              {trascinando && (
                <div aria-hidden className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-[1.25rem] bg-perla-carta/90 shadow-[inset_0_0_0_2px_rgba(103,127,2,0.75)]">
                  <p className="max-w-[30ch] px-6 text-center text-[15px] font-semibold leading-snug text-brand-900">
                    {isDatore
                      ? 'Con il tuo profilo i documenti si consultano soltanto'
                      : azienda
                        ? `Rilascia i file: vanno nell’archivio di ${azienda.ragione_sociale} e ${nomeAgente} li legge`
                        : 'Rilascia i file, poi scegli l’azienda a cui appartengono'}
                  </p>
                </div>
              )}
              <div ref={setScorrevole} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" aria-busy={occupato}>
                <div>
                  {centro}
                  <div ref={fineRef} />
                </div>
              </div>
              <Compositore
                testo={testo}
                onTesto={onTesto}
                areaRef={areaRef}
                onRiprova={fallito && !occupato ? riprova : undefined}
                onInvia={() => void invia(testo)}
                nomeAgente={nomeAgente}
                occupato={occupato}
                inAttesa={inAttesa !== null}
                registrando={rec.registrando}
                secondi={rec.secondi}
                conFoto={!isDatore}
                onFoto={() => scegliFoto(null)}
                onMicrofono={() => {
                  sbloccaAudio();
                  void microfono();
                }}
                errore={errore || rec.errore}
                onChiudiErrore={() => {
                  setErrore(null);
                  setFallito(null);
                  rec.setErrore(null);
                }}
                segnaposto={tema && vuota ? `Scrivi a ${nomeAgente} sul tema ${tema.titolo}` : inVistaAzienda && azienda ? `Scrivi a ${nomeAgente} su questa azienda` : undefined}
                sopra={
                  codaFile.length > 0 ? (
                    <CodaCaricamenti
                      voci={codaFile}
                      azienda={codaAzienda?.ragione_sociale ?? null}
                      onRiprova={riprovaFile}
                      onRimuovi={(id) => setCodaFile((c) => c.filter((v) => v.id !== id))}
                      onChiudi={() => setCodaFile([])}
                    />
                  ) : null
                }
              />
            </section>

            {/* ---------- Il tavolo ---------- */}
            {tavoloAperto && (
              <aside className="vetro shrink-0 border-l border-[rgba(14,14,16,0.08)]" style={{ width: larghezza === 'ampio' ? 'clamp(400px, 30vw, 500px)' : 360 }} aria-label="Il tavolo">
                {spazio()}
              </aside>
            )}
          </div>
        </div>
      </AzioniPannelliProvider>

      {!isDatore && (
        <input
          ref={fotoRef}
          type="file"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            // Nessun filtro nel selettore: ogni file passa dai controlli con un errore chiaro per riga.
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            riceviFile(files, fotoPerRef.current);
          }}
        />
      )}

      {/* Aziende, temi e conversazioni in un cassetto da sinistra */}
      {user && (
        <div className={clsx('fixed inset-0 z-40 transition-[visibility]', railMobile ? 'pointer-events-auto visible' : 'pointer-events-none invisible delay-300 motion-reduce:delay-0')} aria-hidden={!railMobile}>
          <div
            className={clsx('absolute inset-0 bg-brand-950/30 transition-opacity duration-300 motion-reduce:transition-none', railMobile ? 'opacity-100' : 'opacity-0')}
            onClick={() => setRailMobile(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Temi e conversazioni"
            className={clsx(
              'absolute left-0 top-0 h-full w-[min(20rem,86vw)] shadow-luxury-lg transition-transform duration-300 ease-out motion-reduce:transition-none',
              railMobile ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <AgenteRail
              user={user}
              conversazioni={conversazioni}
              attivaId={attiva?.id ?? null}
              caricamento={convCarica}
              errore={convErrore}
              temaAttivo={tema?.id ?? null}
              ridotta={false}
              mobile
              onRiduci={() => undefined}
              onChiudi={() => setRailMobile(false)}
              onNuova={nuova}
              onTema={apriTema}
              onApri={(id) => void apri(id)}
              onElimina={(c) => {
                setErrElimina(null);
                setDaEliminare(c);
              }}
              onRiprova={() => void caricaConversazioni()}
              aziende={indice}
              aziendeCarica={aziendeCarica}
              aziendeErrore={aziendeErrore}
              preferenze={preferenze}
              aziendaAttivaId={azienda?.id ?? null}
              onApriAzienda={(a) => apriAzienda(a)}
              onPreferita={cambiaPreferita}
              onCerca={() => {
                setRailMobile(false);
                setPalette(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile: spazio di lavoro come foglio che sale dal basso */}
      {!desktop && (
        <AzioniPannelliProvider value={azioniPannelli}>
          <div className={clsx('fixed inset-0 z-40 transition-[visibility]', foglio ? 'pointer-events-auto visible' : 'pointer-events-none invisible delay-300 motion-reduce:delay-0')} aria-hidden={!foglio}>
            <div
              className={clsx('absolute inset-0 bg-brand-950/30 transition-opacity duration-300 motion-reduce:transition-none', foglio ? 'opacity-100' : 'opacity-0')}
              onClick={() => setFoglio(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Spazio di lavoro"
              className={clsx(
                'absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-perla-linea bg-perla-superficie shadow-luxury-lg transition-transform duration-300 ease-out motion-reduce:transition-none',
                foglio ? 'translate-y-0' : 'translate-y-full'
              )}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <span aria-hidden className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-brand-200" />
              <div className="min-h-0 flex-1">{foglio && spazio(() => setFoglio(false))}</div>
            </div>
          </div>
        </AzioniPannelliProvider>
      )}

      <PaletteComandi
        aperta={palette}
        onChiudi={() => setPalette(false)}
        aziende={indice}
        preferite={preferenze.preferite}
        recenti={preferenze.recenti}
        persone={persone}
        documenti={documenti}
        conversazioni={conversazioni}
        isDatore={isDatore}
        onApriAzienda={(a, sch) => apriAzienda(a, sch)}
        onApriConversazione={(id) => void apri(id)}
        onNuovaConversazione={nuova}
        onNuovaAzienda={nuovaAzienda}
        onScadenzeSettimana={scadenzeSettimana}
        onTema={apriTema}
      />

      <ConfirmDialog
        open={daEliminare !== null}
        title="Eliminare la conversazione?"
        message={daEliminare ? `"${daEliminare.titolo}" verrà eliminata definitivamente.` : ''}
        confirmLabel="Elimina"
        destructive
        busy={eliminando}
        error={errElimina}
        onConfirm={() => void confermaElimina()}
        onCancel={() => setDaEliminare(null)}
      />
    </AppShell>
  );
}
