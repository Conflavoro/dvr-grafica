"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Avanti,
  Campanella as IconaCampanella,
  Cartella,
  Chiudi,
  Cerca,
  Esci,
  Giu,
  Invia,
  Menu,
  Microfono,
} from "@/components/icone";
import { useRequireAuth } from "@/lib/use-auth";
import { useDataSource } from "@/lib/use-data-source";
import type { User } from "@/lib/data-source";
import { roleLabel } from "@/lib/permissions";
import {
  ISPEZIONI_AZIENDA,
  PASTIGLIA,
  gruppi,
  opzioniAzienda,
  percorso,
  sezioniDi,
  sezioniVisibili,
  trovaSezione,
  vociBarra,
  type AppPortale,
  type Sezione,
} from "@/lib/portale/sezioni";
import {
  aziendePortale,
  type AziendaPortale,
  type OggettoAperto,
} from "@/lib/portale/api";
import { clsx } from "@/lib/clsx";
import { isApiMode } from "@/lib/data-source";
import {
  conRecente,
  indiceAziende,
  leggiPreferenze,
  salvaPreferenze,
  type AziendaIndice,
} from "@/lib/agente-aziende";
import { caricaAziende } from "@/lib/portale/gestionale-api";
import { indiceDaRighe } from "@/lib/portale/gestionale-logica";
import {
  aziendaDaUrl,
  leggiScelta,
  sceglieCliente,
  scriviScelta,
  senzaAziendaUrl,
  tipoSezione,
} from "@/lib/portale/scelta-azienda";
import { FalcoSezione, AvatarFalco } from "./FalcoSezione";
import {
  ascoltaFalco,
  chiudiStriscia,
  registraAmbiente,
  statoFalco,
  type StatoFalco,
} from "@/lib/falco/esecutore";
import { BASE_PATH } from "@/lib/percorso";
import { ascoltaLettura, interrompiVoce, letturaInCorso } from "@/lib/agente-voce";
import { TestoAVoce } from "@/components/agente/TestoAVoce";
import {
  FiltroSoloCliente,
  ScegliIlCliente,
  SelettoreCliente,
} from "./SceltaCliente";
import {
  PannelloDocumenti,
  type RichiestaModifica,
} from "./PannelloDocumenti";
import { Campanella, useNovita } from "./Campanella";
import { Foglio } from "./kit";
import { TabbarTelefono, TopbarTelefono } from "./telefono/BarraTelefono";
import { FalcoTondo } from "./telefono/FalcoTondo";
import { Toasts } from "./telefono/Toasts";
import {
  DoveLavorare,
  SelettoreSede,
  fascicoloCompletoDi,
  sediAlimentariDi,
  sediDi,
  type SedePortale,
} from "./telefono/SceltaSede";
import { azzeraContatori, impostaContatori, useContatori } from "./telefono/stato";
import {
  cePrecedente,
  contatoriBarra,
  entraIn,
  indietroDi,
  interna as paginaInterna,
  livello,
} from "./telefono/navigazione";
import { useIndietroBordo, useManiglia } from "./telefono/gesti";
import { daFareAzienda } from "@/lib/data-source";
import { ascoltaFogli, fogliAperti } from "@/lib/portale/fogli";
import { ascoltaTempoReale, avviaTempoReale, riguarda } from "@/lib/tempo-reale";
import { impostaUtenteFileRecenti } from "@/lib/app/file-recenti";
import { Ricerca } from "./Ricerca";
import { usePermessiStaff } from "@/lib/portale/gestionale-permessi";

/**
 * Guscio comune delle due app (ADR-009), telefono prima:
 * - telefono: barra in alto, menu in basso a cinque voci (quattro sezioni e Tutto),
 *   Falco sempre a portata con il pulsante tondo;
 * - computer: menu nero a gruppi, briciole, ricerca, campanella, Falco a destra.
 * Le sezioni parlano al Falco con useFalco().chiedi(...) e gli dicono cosa e' aperto
 * con useFalco().apri(oggetto).
 */

interface PortaleCtx {
  app: AppPortale;
  user: User;
  /** Area azienda: l'azienda su cui si lavora. Gestionale: l'azienda aperta (se c'e'). */
  azienda: AziendaPortale | null;
  aziende: AziendaPortale[];
  setAzienda: (id: number) => void;
  /** Permesso sull'azienda attiva (RuoliAzienda::MATRICE); nel gestionale lo studio puo' tutto. */
  puo: (azione: string) => boolean;
  /** Fa una domanda al Falco della sezione (apre il pannello se chiuso). */
  chiedi: (testo: string) => void;
  /** Apre Falco e lo mette in ascolto (microfono). */
  ascolta: () => void;
  /** Oggetto aperto nella sezione, perche' il Falco sappia di cosa si parla. */
  apri: (o: OggettoAperto | null, aziendaId?: number | null) => void;
  /** Contatore per ricaricare la sezione quando il Falco cambia dei dati. */
  versione: number;
  ricarica: () => void;
  /** Gestionale: cliente scelto in cima al menu (null = tutte le aziende). */
  aziendaScelta: AziendaIndice | null;
  /** Sceglie il cliente (null = tutte le aziende); si ricorda per utente. */
  scegliAzienda: (id: number | null) => void;
  /** Clienti che lo staff puo' scegliere (null mentre carica; vuoto fuori dal gestionale). */
  clienti: AziendaIndice[] | null;
  /**
   * Azienda su cui filtrare i dati della schermata: nelle sezioni per azienda e' il
   * cliente scelto; in quelle di studio solo se il filtro "Solo <azienda>" e' attivo.
   */
  filtroCliente: number | null;
  /** Area azienda: apre il pannello dei documenti (foglio). */
  apriDocumenti: () => void;
  /** Sedi dell'azienda (dato di S2, vuoto finche' non c'e'). */
  sedi: SedePortale[];
  /** Sede scelta nel selettore: null = Tutte le sedi. Vale in tutte le sezioni con dati per sede. */
  sede: number | null;
  scegliSede: (id: number | null) => void;
}

/**
 * Viste dell'area azienda che restano solo nel gestionale (decisione del 30/10/2026): si aprono
 * sul cliente scelto con questi permessi.
 */
const VISTE_AZIENDA_NEL_GESTIONALE: Record<string, string[]> = {
  nearmiss: ["nearmiss_vedi", "nearmiss_gestisci", "nearmiss_segnala", "documenti_vedi"],
  importa: ["dipendenti_vedi", "dipendenti_modifica", "documenti_vedi"],
};

const Ctx = createContext<PortaleCtx | null>(null);

export function usePortale(): PortaleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortale fuori da PortaleShell");
  return v;
}

const AZIENDA_KEY = "crm_dvr_portale_azienda";
const FALCO_KEY = "crm_dvr_portale_falco_aperto";
/** Posizione del menu laterale tra un cambio di sezione e l'altro. */
let scrollMenu = 0;

function iniziali(nome: string): string {
  return (
    nome
      .replace(/^(dott\.?ssa|dott\.|ing\.|geom\.|avv\.)\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "U"
  );
}

function useLargo(query = "(min-width: 1024px)"): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia(query);
      setV(mq.matches);
      const f = (e: MediaQueryListEvent) => setV(e.matches);
      mq.addEventListener?.("change", f);
      return () => mq.removeEventListener?.("change", f);
    } catch {
      return undefined;
    }
  }, [query]);
  return v;
}

export interface Briciola {
  testo: string;
  href?: string;
}

export function PortaleShell({
  app,
  sezione,
  briciole = [],
  children,
  badge = {},
}: {
  app: AppPortale;
  /** Chiave della sezione aperta (registro in lib/portale/sezioni.ts) o 'tutto'. */
  sezione: string;
  briciole?: Briciola[];
  children: ReactNode;
  /** Numeri accanto alle voci del menu, per chiave di sezione. */
  badge?: Record<string, number>;
}) {
  const { user, loading } = useRequireAuth();
  const ds = useDataSource();
  const router = useRouter();
  const largo = useLargo();
  const [aziende, setAziende] = useState<AziendaPortale[]>([]);
  const [aziendaId, setAziendaId] = useState<number | null>(null);
  const [oggetto, setOggetto] = useState<OggettoAperto | null>(null);
  const [aziendaOggetto, setAziendaOggetto] = useState<number | null>(null);
  const [falcoAperto, setFalcoAperto] = useState(false);
  const [domanda, setDomanda] = useState<{ testo: string; n: number } | null>(
    null,
  );
  const [ascolto, setAscolto] = useState(0);
  const [versione, setVersione] = useState(0);
  const [cerca, setCerca] = useState(false);
  const [menuAzienda, setMenuAzienda] = useState(false);
  const [clienti, setClienti] = useState<AziendaIndice[] | null>(null);
  const [sceltaId, setSceltaId] = useState<number | null>(null);
  const [soloScelta, setSoloScelta] = useState(true);
  const [ricaricaClienti, setRicaricaClienti] = useState(0);
  const [cercatoPer, setCercatoPer] = useState<number | null>(null);
  const [nuovaAzienda, setNuovaAzienda] = useState(false);
  const [documenti, setDocumenti] = useState(false);
  const [bozza, setBozza] = useState<{ testo: string; n: number } | null>(
    null,
  );
  const [dove, setDove] = useState(false);
  const [sede, setSede] = useState<number | null>(null);
  const [haId, setHaId] = useState(false);
  const [compatta, setCompatta] = useState(false);
  const scroller = useRef<HTMLElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const foglioFalco = useRef<HTMLDivElement>(null);
  const contatori = useContatori();
  const { nonLette } = useNovita();

  const lato = app === "azienda";
  const staff = !lato && sceglieCliente(user?.role);

  // L'utente dello studio sta nel gestionale, quello dell'azienda nella sua area.
  useEffect(() => {
    if (!user) return;
    // Accesso ancora da configurare (ruolo o studio mancanti): si torna all'onboarding.
    if (user.needs_onboarding) {
      router.replace("/onboarding");
      return;
    }
    const suo: AppPortale =
      user.app ??
      (user.role === "datore_lavoro" || user.role === "utente_azienda"
        ? "azienda"
        : "gestionale");
    // Il medico competente esterno entra nel gestionale solo dal suo portale.
    const partner = suo === "gestionale" && user.role === "utente_azienda";
    if (suo !== app)
      router.replace(
        suo === "azienda"
          ? "/azienda/dashboard/"
          : partner
            ? "/gestionale/medico/"
            : "/gestionale/coda/",
      );
    else if (partner && sezione !== "medico" && sezione !== "account")
      router.replace("/gestionale/medico/");
  }, [user, app, router, sezione]);

  // Aziende dell'utente (area azienda): da /auth/me, aggiornate da /portale/aziende.
  useEffect(() => {
    if (!user || !lato) return;
    const daMe = (user.aziende ?? []).map((a) => ({ ...a }));
    setAziende(daMe);
    aziendePortale()
      .then((l) => l.length > 0 && setAziende(l))
      .catch(() => undefined);
  }, [user, lato]);

  // Gestionale: clienti che lo staff puo' scegliere (gli stessi che vede oggi).
  useEffect(() => {
    if (!user || !staff) return;
    let vivo = true;
    const carica = isApiMode()
      ? caricaAziende().then((d) => indiceDaRighe(d.aziende))
      : ds.companies.list().then((l) => indiceAziende(l, [], []));
    carica
      .then((l) => vivo && setClienti(l))
      .catch(() => vivo && setClienti((c) => c ?? []));
    return () => {
      vivo = false;
    };
  }, [user, staff, ds, versione, ricaricaClienti]);

  // Scelta iniziale: dal link (?azienda=) o dall'ultima volta.
  useEffect(() => {
    if (!user || !staff) return;
    let daLink: number | null = null;
    try {
      daLink = aziendaDaUrl(window.location.search);
      setNuovaAzienda(new URLSearchParams(window.location.search).get("nuova") === "1");
      if (daLink)
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${senzaAziendaUrl(window.location.search)}`,
        );
    } catch {
      /* comodita' del browser */
    }
    const id = daLink ?? leggiScelta(user.id);
    setSceltaId(id);
    if (daLink) scriviScelta(user.id, daLink);
  }, [user, staff, sezione]);

  // Scelta non (piu') tra i clienti visibili: si ricarica una volta, poi si toglie.
  useEffect(() => {
    if (!user || !staff || clienti === null || !sceltaId) return;
    if (clienti.some((c) => c.id === sceltaId)) return;
    if (cercatoPer !== sceltaId) {
      setCercatoPer(sceltaId);
      setRicaricaClienti((n) => n + 1);
      return;
    }
    setSceltaId(null);
    scriviScelta(user.id, null);
  }, [user, staff, clienti, sceltaId, cercatoPer]);

  useEffect(() => {
    if (!lato || aziende.length === 0) return;
    let scelta: number | null = null;
    try {
      const v = Number(window.localStorage.getItem(AZIENDA_KEY));
      if (aziende.some((a) => a.id === v)) scelta = v;
    } catch {
      /* comodita' del browser */
    }
    setAziendaId((prev) =>
      prev && aziende.some((a) => a.id === prev)
        ? prev
        : (scelta ?? aziende[0].id),
    );
  }, [aziende, lato]);

  useEffect(() => {
    try {
      setFalcoAperto(
        window.localStorage.getItem(FALCO_KEY) === "1" &&
          window.matchMedia("(min-width: 1280px)").matches,
      );
    } catch {
      /* comodita' del browser */
    }
  }, []);

  useEffect(() => {
    if (!documenti) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDocumenti(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [documenti]);

  useEffect(() => {
    const f = () => setCerca(true);
    document.addEventListener("portale-cerca", f);
    return () => document.removeEventListener("portale-cerca", f);
  }, []);
  // "Dove vuoi lavorare?" si apre anche dalla riga dell'azienda in Tutto.
  useEffect(() => {
    const f = () => setDove(true);
    document.addEventListener("portale-dove", f);
    return () => document.removeEventListener("portale-dove", f);
  }, []);

  const azienda = useMemo(
    () => aziende.find((a) => a.id === aziendaId) ?? null,
    [aziende, aziendaId],
  );
  // Cliente nuovo non ancora attivo: solo il percorso di attivazione, senza menu.
  const modoAttivazione = lato && !!azienda?.attivazione;
  useEffect(() => {
    if (modoAttivazione && sezione !== "attivazione" && sezione !== "account")
      router.replace("/azienda/attivazione/");
  }, [modoAttivazione, sezione, router]);
  const { permessi: permessiStaff } = usePermessiStaff(!lato && !!user && user.role !== "utente_azienda");
  const visibili = useMemo(
    () =>
      user
        ? sezioniVisibili(app, {
            ruolo: user.role,
            permessi: lato ? (azienda?.permessi ?? []) : null,
            sediAlimentari: lato ? sediAlimentariDi(azienda) : null,
            fascicoloCompleto: lato ? fascicoloCompletoDi(azienda) : null,
            sezioni: lato ? opzioniAzienda(azienda).sezioni : null,
            sezioniStaff: !lato && permessiStaff.ruolo ? permessiStaff.sezioni : null,
            telefono: !largo,
          })
        : [],
    [user, app, lato, azienda, largo, permessiStaff],
  );
  // La ricerca vede le stesse sezioni del menu (HACCP compreso, con la sede alimentare).
  const visibiliRicerca = visibili;
  const sedi = useMemo(() => (lato ? sediDi(azienda) : []), [lato, azienda]);
  const barra = contatoriBarra(contatori, visibili);

  // Sede scelta: per azienda, ricordata nel browser; una sola sede = nessuna scelta.
  const chiaveSede = azienda ? `crm_dvr_portale_sede_${azienda.id}` : null;
  useEffect(() => {
    if (!chiaveSede) return;
    let v: number | null = null;
    try {
      const r = Number(window.localStorage.getItem(chiaveSede));
      v = r > 0 ? r : null;
    } catch {
      /* comodita' del browser */
    }
    setSede(sedi.length === 1 ? sedi[0].id : v && sedi.some((x) => x.id === v) ? v : null);
  }, [chiaveSede, sedi]);
  const scegliSede = useCallback(
    (id: number | null) => {
      setSede(id);
      try {
        if (chiaveSede) window.localStorage.setItem(chiaveSede, id ? String(id) : "");
      } catch {
        /* comodita' del browser */
      }
    },
    [chiaveSede],
  );

  // Contatore di Home = "Da fare adesso" (03 §2); le altre sezioni li scrivono con impostaContatori.
  useEffect(() => {
    azzeraContatori();
    // Solo se il ruolo vede la Home: medico e consulente del lavoro non hanno "Da fare".
    if (!lato || !azienda || !isApiMode() || modoAttivazione || !visibili.some((s) => s.chiave === "dashboard")) return;
    let vivo = true;
    daFareAzienda(azienda.id)
      .then((d) => vivo && impostaContatori({ dashboard: d.voci.length }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lato, azienda, modoAttivazione, versione, visibili]);

  // Telefono: profondita' della pagina, transizione d'ingresso e Indietro (03 §2).
  const tutteSezioni = sezioniDi(app);
  const pInterna = paginaInterna(sezione, haId, tutteSezioni);
  const [transizioneIniziale] = useState(() =>
    typeof window === "undefined"
      ? ""
      : entraIn({
          chiave: `${app}/${sezione}${new URLSearchParams(window.location.search).get("id") ? "#id" : ""}`,
          livello: livello(sezione, !!new URLSearchParams(window.location.search).get("id"), tutteSezioni),
        }),
  );
  const indietro = useCallback(() => {
    if (cePrecedente() && window.history.length > 1) router.back();
    else router.push(indietroDi(app, visibili));
  }, [router, app, visibili]);
  useIndietroBordo(pagina, !largo && pInterna, indietro);
  const manigliaFalco = useManiglia(foglioFalco, () => cambiaFalco(false));
  const corrente: Sezione | undefined = trovaSezione(app, sezione);

  const cambiaFalco = (v: boolean) => {
    setFalcoAperto(v);
    try {
      window.localStorage.setItem(FALCO_KEY, v ? "1" : "0");
    } catch {
      /* comodita' del browser */
    }
  };

  const chiedi = useCallback((testo: string) => {
    setFalcoAperto(true);
    setDomanda((d) => ({ testo, n: (d?.n ?? 0) + 1 }));
  }, []);

  const ascolta = useCallback(() => {
    setFalcoAperto(true);
    setAscolto((n) => n + 1);
  }, []);

  const apri = useCallback((o: OggettoAperto | null, aid?: number | null) => {
    setOggetto(o);
    setAziendaOggetto(aid ?? null);
  }, []);

  const ricarica = useCallback(() => setVersione((v) => v + 1), []);

  const scegliAzienda = useCallback(
    (id: number | null) => {
      setSceltaId(id);
      setSoloScelta(true);
      setOggetto(null);
      setAziendaOggetto(null);
      if (!user) return;
      scriviScelta(user.id, id);
      if (id) salvaPreferenze(user.id, conRecente(leggiPreferenze(user.id), id));
    },
    [user],
  );

  const setAzienda = useCallback((id: number) => {
    setAziendaId(id);
    setMenuAzienda(false);
    try {
      window.localStorage.setItem(AZIENDA_KEY, String(id));
    } catch {
      /* comodita' del browser */
    }
  }, []);

  // Tempo reale (ADR-013): un motore per sessione, sospeso in background. Gli eventi
  // dell'azienda in vista (o generali) ricaricano le liste aperte.
  useEffect(() => {
    if (!user || user.needs_onboarding || !isApiMode()) return;
    avviaTempoReale(user.id);
    // App: i file recenti sono di questo utente (un altro utente li trova vuoti).
    impostaUtenteFileRecenti(user.id);
  }, [user]);
  useEffect(() => {
    const inVista = lato ? aziendaId : sceltaId;
    return ascoltaTempoReale((l) => {
      if (l.eventi.some((e) => riguarda(e, inVista))) ricarica();
    });
  }, [lato, aziendaId, sceltaId, ricarica]);

  // Falco principale: l'esecutore dei passi d'interfaccia usa questo guscio per navigare,
  // scegliere l'azienda e aprire l'oggetto. Si registra a ogni cambio (il guscio si
  // rimonta a ogni schermata, l'esecutore no).
  useEffect(() => {
    registraAmbiente({
      naviga: (rotta) => router.push(rotta),
      percorso: () => window.location.pathname,
      basePath: BASE_PATH,
      aziendaId: () => (lato ? aziendaId : sceltaId),
      scegliAzienda: (id) => (lato ? setAzienda(id) : scegliAzienda(id)),
      apriOggetto: (o, aid) => apri(o as OggettoAperto, aid),
    });
    return () => registraAmbiente(null);
  }, [router, lato, aziendaId, sceltaId, setAzienda, scegliAzienda, apri]);

  // Menu laterale: a ogni cambio di sezione il guscio si rimonta e il menu tornava in cima.
  // Si riprende la posizione di prima e la voce scelta resta in vista.
  const menuRef = useRef<HTMLDivElement>(null);
  const ripristino = useRef(false);
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    ripristino.current = true;
    el.scrollTop = scrollMenu;
    requestAnimationFrame(() => {
      ripristino.current = false;
    });
    const attiva = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (attiva) {
      const r = attiva.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      // Margine sopra la sfumatura del bordo basso: la voce scelta si vede intera.
      if (r.bottom > c.bottom - 40) el.scrollTop += r.bottom - (c.bottom - 48);
      else if (r.top < c.top + 8) el.scrollTop -= c.top + 8 - r.top;
      scrollMenu = el.scrollTop;
    }
    // Il menu si riempie quando arrivano utente e permessi: si ripristina anche allora.
  }, [sezione, visibili.length]);

  // Mentre il Falco lavora sull'interfaccia il pannello si riduce alla striscia in basso.
  const [lavoroFalco, setLavoroFalco] = useState<StatoFalco>(() => statoFalco());
  const [riprendi, setRiprendi] = useState<{ id: number; n: number } | null>(null);
  useEffect(
    () =>
      ascoltaFalco((s) => {
        setLavoroFalco(s);
        if (s.fase === "lavoro") setFalcoAperto(false);
      }),
    [],
  );
  useEffect(() => {
    if (statoFalco().fase === "lavoro") setFalcoAperto(false);
  }, []);
  const riapriConversazione = useCallback(() => {
    const id = statoFalco().conversazioneId;
    chiudiStriscia();
    if (id) setRiprendi((r) => ({ id, n: (r?.n ?? 0) + 1 }));
    setFalcoAperto(true);
  }, []);

  // Medico competente esterno fuori dal suo portale: si aspetta il reindirizzamento senza chiamare altre sezioni.
  const fuoriPortale =
    !!user &&
    app === "gestionale" &&
    user.role === "utente_azienda" &&
    sezione !== "medico";
  if (loading || !user || fuoriPortale || user.needs_onboarding) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <p className="text-[14px] text-ink-muted">Caricamento</p>
      </div>
    );
  }

  const puo = (azione: string) =>
    lato ? (azienda?.permessi ?? []).includes(azione) : true;
  const chiediModifica = (r: RichiestaModifica) => {
    setOggetto(r.oggetto);
    setAziendaOggetto(azienda?.id ?? null);
    setDocumenti(false);
    setBozza((b) => ({
      testo: r.oggetto
        ? `Vorrei una modifica a «${r.titolo}»: `
        : `Vorrei una modifica al documento caricato «${r.titolo}»${r.cartella ? ` (cartella ${r.cartella})` : ""}: `,
      n: (b?.n ?? 0) + 1,
    }));
    cambiaFalco(true);
  };
  const aziendaScelta = staff
    ? ((clienti ?? []).find((c) => c.id === sceltaId) ?? null)
    : null;
  const tipo = tipoSezione(app, sezione);
  const filtroCliente = !aziendaScelta
    ? null
    : tipo === "azienda" || (tipo === "studio" && soloScelta)
      ? aziendaScelta.id
      : null;
  const ctx: PortaleCtx = {
    app,
    user,
    azienda: lato ? azienda : null,
    aziende,
    setAzienda,
    puo,
    chiedi,
    ascolta,
    apri,
    versione,
    ricarica,
    aziendaScelta,
    scegliAzienda,
    clienti: staff ? clienti : [],
    filtroCliente,
    apriDocumenti: () => setDocumenti(true),
    sedi,
    sede,
    scegliSede,
  };
  // Sezione che il ruolo non vede (si sta passando alla prima del ruolo): il Falco parte
  // dalla prima sezione visibile, cosi' non chiede al server una sezione vietata.
  const correnteVisibile = !lato || !corrente || visibili.some((s) => s.chiave === corrente.chiave);
  const falcoSezione =
    (correnteVisibile ? corrente?.falco : undefined) ??
    (lato ? (visibili.find((s) => s.falco)?.falco ?? "azienda.dashboard") : "gestionale.coda");
  const aziendaFalco = lato
    ? (azienda?.id ?? null)
    : (aziendaOggetto ?? aziendaScelta?.id ?? null);
  const nomeFalco = lato
    ? azienda?.ragione_sociale
    : aziendaOggetto && aziendaOggetto !== aziendaScelta?.id
      ? null
      : aziendaScelta?.ragione_sociale;
  const titoloSezione =
    corrente?.titolo ?? (sezione === "account" ? "Account" : sezione === "notifiche" ? "Notifiche" : "Tutto");
  const esci = async () => {
    try {
      await ds.auth.logout();
    } finally {
      router.push("/");
    }
  };

  const falco = (
    <FalcoSezione
      sezione={falcoSezione}
      titolo={titoloSezione}
      aziendaId={aziendaFalco}
      oggetto={oggetto}
      domanda={domanda}
      ascolta={ascolto}
      onDatiCambiati={ricarica}
      onChiudi={() => cambiaFalco(false)}
      onApri={() => cambiaFalco(true)}
      sottotitolo={
        nomeFalco
          ? `Ti aiuto con ${titoloSezione.toLowerCase()} di ${nomeFalco}`
          : `Ti aiuto con ${titoloSezione.toLowerCase()}`
      }
      storico={{
        aziendaId: lato ? (azienda?.id ?? null) : (aziendaScelta?.id ?? null),
        nomeAzienda: lato
          ? (azienda?.ragione_sociale ?? null)
          : (aziendaScelta?.ragione_sociale ?? null),
        interruttore: !lato,
      }}
      onApriDocumento={lato ? () => setDocumenti(true) : undefined}
      bozza={bozza}
      riprendi={riprendi}
      referenteVisibile={puo("messaggi")}
    />
  );

  const voci = vociBarra(visibili);
  const vocePhone = voci.some((v) => v?.chiave === sezione) ? sezione : "tutto";
  const titoloFinestra = briciole.length > 0 ? briciole[briciole.length - 1].testo : titoloSezione;

  const contenuto =
    lato && aziende.length === 0 ? (
      <SenzaAzienda />
    ) : staff && tipo === "azienda" && !(sezione === "avvio" && nuovaAzienda) ? (
      aziendaScelta ? (
        <div key={aziendaScelta.id}>{children}</div>
      ) : sceltaId && clienti === null ? (
        <p className="py-6 text-small text-fg-muted" role="status">
          Carico il cliente
        </p>
      ) : (
        <ScegliIlCliente
          userId={user.id}
          clienti={clienti}
          onScegli={scegliAzienda}
          titoloSezione={titoloSezione}
          extra={
            sezione === "avvio" ? (
              <Link
                href="/gestionale/avvio/?nuova=1"
                onClick={() => setNuovaAzienda(true)}
                className="btn-ghost"
              >
                Nuova azienda
              </Link>
            ) : undefined
          }
        />
      )
    ) : staff && tipo === "studio" && aziendaScelta ? (
      <>
        <FiltroSoloCliente
          nome={aziendaScelta.ragione_sociale}
          attivo={soloScelta}
          onCambia={setSoloScelta}
        />
        <div key={`${aziendaScelta.id}-${soloScelta ? 1 : 0}`}>{children}</div>
      </>
    ) : (
      children
    );

  // Viste dell'area azienda aperte dal gestionale (Near miss, Importa dati): l'azienda e' il cliente scelto.
  const contenutoGestionale =
    !lato && aziendaScelta && sezione in VISTE_AZIENDA_NEL_GESTIONALE ? (
      <Ctx.Provider
        value={{
          ...ctx,
          azienda: {
            id: aziendaScelta.id,
            ragione_sociale: aziendaScelta.ragione_sociale,
            ruoli: ["studio"],
            permessi: VISTE_AZIENDA_NEL_GESTIONALE[sezione],
          },
        }}
      >
        {contenuto}
      </Ctx.Provider>
    ) : (
      contenuto
    );

  const telefono = !largo;
  const nomeIniziali = lato
    ? iniziali(azienda?.ragione_sociale ?? "")
    : iniziali(aziendaScelta?.ragione_sociale ?? user.name);

  return (
    <Ctx.Provider value={ctx}>
      <Suspense fallback={null}>
        <LeggiId onId={setHaId} />
      </Suspense>
      <TitoloFinestra testo={`${titoloFinestra} · ${lato ? (largo ? "Area azienda" : "App azienda") : "Gestionale"}`} />
      {telefono ? (
        /* ---------------- Telefono (03 §2) ---------------- */
        <div
          className="app"
          data-compatta={compatta ? "1" : undefined}
          data-interna={pInterna ? "1" : undefined}
          style={{
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
          }}
        >
          <TopbarTelefono
            titolo={titoloFinestra}
            interna={pInterna}
            iniziali={nomeIniziali}
            nomeAzienda={lato ? (azienda?.ragione_sociale ?? "") : (aziendaScelta?.ragione_sociale ?? "Tutte le aziende")}
            cambiaAzienda={lato ? aziende.length > 1 || sedi.length > 1 : staff}
            onCambiaAzienda={() => (lato ? setDove(true) : setMenuAzienda((v) => !v))}
            onIndietro={indietro}
            onCerca={() => setCerca(true)}
            notifiche={`/${app}/notifiche/`}
            nonLette={nonLette}
            nascondiAzioni={modoAttivazione}
            destra={
              modoAttivazione ? (
                <button type="button" onClick={() => void esci()} aria-label="Esci" className="tb-btn">
                  <Esci size={19} aria-hidden />
                </button>
              ) : undefined
            }
          />
          {!lato && staff && menuAzienda && (
            <div className="absolute inset-x-3 z-[31] rounded-hse-lg bg-surface p-2 shadow-pop" style={{ top: "calc(56px + env(safe-area-inset-top, 0px))" }}>
              <SelettoreCliente
                userId={user.id}
                clienti={clienti}
                scelta={aziendaScelta}
                onScegli={(id) => {
                  scegliAzienda(id);
                  setMenuAzienda(false);
                }}
                largo={false}
              />
            </div>
          )}
          <main
            ref={scroller}
            className="scroller"
            onScroll={(e) => setCompatta(e.currentTarget.scrollTop > 46)}
            style={modoAttivazione ? { paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" } : undefined}
          >
            <div ref={pagina} className={clsx("pagina cascata", transizioneIniziale)}>
              {contenutoGestionale}
            </div>
          </main>
          {!modoAttivazione && (
            <TabbarTelefono
              app={app}
              voci={voci}
              attiva={vocePhone}
              contatori={barra}
              onAssistente={() => cambiaFalco(true)}
            />
          )}
          {modoAttivazione && (
            <button
              type="button"
              onClick={() => cambiaFalco(true)}
              className="premi fixed right-3 z-40 flex h-14 items-center gap-2 rounded-full bg-black py-1.5 pl-1.5 pr-5 text-small font-medium text-white shadow-pop"
              style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <AvatarFalco size={44} />
              Parla con Falco
            </button>
          )}
          <div
            aria-hidden={!falcoAperto}
            className={clsx("sheet-backdrop", falcoAperto && "open")}
            onClick={() => cambiaFalco(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Assistente"
            aria-hidden={!falcoAperto}
            className={clsx("sheet h-[92dvh] max-h-[92dvh] overflow-hidden", falcoAperto && "open")}
            ref={foglioFalco}
          >
            <div className="sheet-maniglia" aria-hidden {...manigliaFalco}>
              <i />
            </div>
            <div className="min-h-0 flex-1">{falco}</div>
          </div>
        </div>
      ) : (
      <div
        className="flex h-[100dvh] bg-canvas"
        data-density={lato ? undefined : "compact"}
        style={{
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {/* ---------------- Menu nero (computer) ---------------- */}
        {!modoAttivazione && (
          <nav
            aria-label="Menu"
            className={clsx(
              "flex shrink-0 flex-col bg-black text-white",
              lato ? "w-[17rem]" : "w-[16rem]",
            )}
          >
            <div className="relative shrink-0 px-3 pb-3 pt-4">
              {lato ? (
                <>
                  <p className="px-2 pb-2 text-[11px] font-medium tracking-[0.08em] text-grafite-500">
                    AREA AZIENDA
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      aziende.length > 1 && setMenuAzienda((v) => !v)
                    }
                    aria-expanded={menuAzienda}
                    className="flex w-full items-center gap-3 rounded-[1rem] px-2 py-2 text-left hover:bg-grafite-800"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.75rem] bg-grafite-800 text-[13px] font-medium"
                    >
                      {iniziali(azienda?.ragione_sociale ?? "")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {azienda?.ragione_sociale ?? "Nessuna azienda"}
                      </span>
                      <span className="block truncate text-[12px] text-grafite-400">
                        {azienda
                          ? azienda.ruoli.map(etichettaRuolo).join(", ")
                          : ""}
                      </span>
                    </span>
                    {aziende.length > 1 && (
                      <Giu size={16} aria-hidden className="text-grafite-400" />
                    )}
                  </button>
                  {menuAzienda && (
                    <ul className="absolute inset-x-3 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-[1.25rem] bg-white p-1.5 text-ink shadow-[0_20px_40px_-16px_rgba(14,14,16,0.4)]">
                      {aziende.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => setAzienda(a.id)}
                            className={clsx(
                              "flex min-h-[44px] w-full items-center rounded-[0.875rem] px-3 text-left text-[14px]",
                              a.id === azienda?.id
                                ? "bg-perla-velo font-medium"
                                : "hover:bg-perla-velo",
                            )}
                          >
                            {a.ragione_sociale}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : staff ? (
                <SelettoreCliente
                  userId={user.id}
                  clienti={clienti}
                  scelta={aziendaScelta}
                  onScegli={scegliAzienda}
                  largo
                />
              ) : (
                <Link
                  href="/gestionale/coda/"
                  className="flex items-center gap-3 rounded-[1rem] px-2 py-2 hover:bg-grafite-800"
                >
                  <AvatarFalco size={40} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">
                      Conflavoro
                    </span>
                    <span className="block text-[12px] text-grafite-400">
                      Gestionale HSE
                    </span>
                  </span>
                </Link>
              )}
            </div>
            <div ref={menuRef} onScroll={(e) => {
                if (!ripristino.current) scrollMenu = e.currentTarget.scrollTop;
              }} className="min-h-0 flex-1 overflow-y-auto px-3 pb-10 [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)]">
              {gruppi(visibili).map((g, i) => (
                <div
                  key={`${g.titolo}-${i}`}
                  className={g.titolo ? "mt-4" : "mt-1"}
                >
                  {g.titolo && (
                    <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-grafite-500">
                      {g.titolo}
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {g.voci.map((s) => (
                      <VoceMenu
                        key={s.chiave}
                        app={app}
                        s={s}
                        attiva={s.chiave === sezione}
                        n={badge[s.chiave] ?? contatori[s.chiave]}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {lato && puo(ISPEZIONI_AZIENDA.permesso!) && (
              <div className="shrink-0 px-3 pb-2">
                <Link
                  href="/azienda/ispezioni/"
                  className="premi flex items-center gap-3 rounded-hse-lg bg-acid-400 px-3 py-3 text-acid-950 hover:bg-acid-500"
                >
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-acid-400"
                  >
                    <ISPEZIONI_AZIENDA.icona size={17} />
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] font-medium leading-tight">
                    Ho un controllo in corso
                  </span>
                  <Avanti size={16} aria-hidden />
                </Link>
              </div>
            )}
            <div className="flex shrink-0 items-center gap-3 border-t border-grafite-800 px-4 py-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grafite-800 text-[12px] font-medium"
              >
                {iniziali(user.name)}
              </span>
              <Link
                href={`/${app}/account/`}
                className="min-w-0 flex-1 rounded-lg hover:text-white"
                title="Il tuo account"
              >
                <span className="block truncate text-[13.5px] font-medium">
                  {user.name}
                </span>
                <span className="block truncate text-[12px] text-grafite-400">
                  {lato
                    ? azienda?.ruoli.map(etichettaRuolo).join(", ") ||
                      roleLabel(user.role)
                    : roleLabel(user.role)}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void esci()}
                aria-label="Esci"
                title="Esci"
                className="grid h-10 w-10 place-items-center rounded-full text-grafite-400 hover:bg-grafite-800 hover:text-white"
              >
                <Esci size={17} aria-hidden />
              </button>
            </div>
          </nav>
        )}

        {/* ---------------- Contenuto (computer) ---------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-line bg-canvas/90 px-8 py-3 backdrop-blur-[14px]">
            {modoAttivazione ? (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AvatarFalco size={36} />
                <p className="min-w-0 flex-1 truncate text-body text-fg">
                  <span className="text-fg-muted">Attivazione</span> ·{" "}
                  <span className="font-medium">{azienda?.ragione_sociale}</span>
                </p>
                <button type="button" onClick={() => void esci()} aria-label="Esci" title="Esci" className="btn btn-icon btn-ghost">
                  <Esci size={17} aria-hidden />
                </button>
              </div>
            ) : (
              <nav aria-label="Percorso" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-1.5 text-small">
                  <li className="shrink-0">
                    <Link href={lato ? "/azienda/dashboard/" : "/gestionale/coda/"} className="text-fg-muted hover:text-fg">
                      {lato ? "Dashboard" : "Coda di lavoro"}
                    </Link>
                  </li>
                  {[
                    ...(corrente && corrente.chiave !== (lato ? "dashboard" : "coda")
                      ? [{ testo: corrente.titolo, href: percorso(app, corrente.chiave) }]
                      : sezione === "notifiche"
                        ? [{ testo: "Notifiche" }]
                        : []),
                    ...briciole,
                  ].map((b: Briciola, i, arr) => (
                    <li key={`${b.testo}-${i}`} className="flex min-w-0 items-center gap-1.5">
                      <Avanti size={14} aria-hidden className="shrink-0 text-fg-faint" />
                      {b.href && i < arr.length - 1 ? (
                        <Link href={b.href} className="truncate text-fg-muted hover:text-fg">
                          {b.testo}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-fg">{b.testo}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {!lato && !modoAttivazione && !falcoAperto && !["dashboard", "coda"].includes(sezione) && (
              <BarraFalco titolo={titoloSezione} onChiedi={chiedi} onAscolta={ascolta} onApri={() => cambiaFalco(true)} />
            )}
            {!modoAttivazione && (
              <>
                {lato && <SelettoreSede sedi={sedi} scelta={sede} onScegli={scegliSede} />}
                <button
                  type="button"
                  onClick={() => setCerca(true)}
                  aria-label="Cerca (Ctrl K)"
                  className="flex h-11 w-[15rem] shrink-0 items-center gap-2.5 rounded-full px-4 text-left text-small text-fg-faint shadow-[inset_0_0_0_1.5px_var(--hse-line)] hover:shadow-[inset_0_0_0_1.5px_var(--hse-fg-faint)] xl:w-[18rem]"
                >
                  <Cerca size={17} aria-hidden className="text-fg-muted" />
                  <span className="min-w-0 flex-1 truncate">Cerca…</span>
                  <kbd className="tasto tasto-chiaro">⌘K</kbd>
                </button>
                <Campanella app={app} />
              </>
            )}
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={clsx(
                "mx-auto w-full",
                lato ? "max-w-[1360px] px-8 pb-28 pt-8" : "max-w-[1520px] px-6 py-6",
              )}
            >
              {contenutoGestionale}
            </div>
          </main>
        </div>

        {/* ---------------- Assistente (computer) ---------------- */}
        <aside
          aria-label="Assistente"
          className={clsx(
            "shrink-0 border-l border-line",
            lato ? "w-[30rem]" : "w-[420px]",
            !falcoAperto && !modoAttivazione && "hidden",
          )}
        >
          {falco}
        </aside>
        {lato && !modoAttivazione && !falcoAperto && (
          <button type="button" className="ai-fab" onClick={() => cambiaFalco(true)} data-falco="falco.chiedi">
            <span className="ai-fab-cerchio" aria-hidden>
              <FalcoTondo size={36} suNero />
            </span>
            Chiedi all&apos;assistente
          </button>
        )}
      </div>
      )}
      {lato && azienda && (
        <Foglio aperto={documenti} titolo="Documenti dell'azienda" onChiudi={() => setDocumenti(false)}>
          {documenti && (
            <PannelloDocumenti
              aziendaId={azienda.id}
              nomeAzienda={azienda.ragione_sociale}
              puoVedere={puo("documenti_vedi")}
              versione={versione}
              onChiediModifica={chiediModifica}
            />
          )}
        </Foglio>
      )}
      {lato && (
        <Foglio aperto={dove} titolo="Dove vuoi lavorare?" sopra={azienda?.ruoli.map(etichettaRuolo).join(", ")} onChiudi={() => setDove(false)}>
          <DoveLavorare
            aziende={aziende}
            aziendaId={azienda?.id ?? null}
            onAzienda={(id) => {
              setAzienda(id);
              setDove(false);
            }}
            sedi={sedi}
            sede={sede}
            onSede={(id) => {
              scegliSede(id);
              setDove(false);
            }}
          />
        </Foglio>
      )}
      <Ricerca
        aperto={cerca}
        onChiudi={() => setCerca(false)}
        app={app}
        sezioni={visibiliRicerca}
        aziendaId={lato ? (azienda?.id ?? null) : null}
        schermoIntero={telefono}
      />
      <Toasts sopraBarra={telefono && !modoAttivazione} />
      {lavoroFalco.fase !== "fermo" && (
        <StrisciaFalco
          stato={lavoroFalco}
          largo={largo}
          sopraMenu={telefono && !modoAttivazione}
          onApri={riapriConversazione}
          onChiudi={chiudiStriscia}
        />
      )}
    </Ctx.Provider>
  );
}

/** Titolo della finestra (03 §1): "<Sezione> · Area azienda" o "· App azienda". */
function TitoloFinestra({ testo }: { testo: string }) {
  useEffect(() => {
    document.title = testo;
  }, [testo]);
  return null;
}

/** Legge ?id= dall'indirizzo: un dettaglio con id e' due livelli piu' in profondita'. */
function LeggiId({ onId }: { onId: (v: boolean) => void }) {
  const p = useSearchParams();
  const id = p?.get("id");
  useEffect(() => onId(!!id), [id, onId]);
  return null;
}

/**
 * Striscia del Falco principale: mentre lavora sull'interfaccia dice cosa sta facendo,
 * alla fine riassume la risposta e riapre la conversazione. Sobria, senza animazioni di fondo.
 */
function StrisciaFalco({
  stato,
  largo,
  sopraMenu,
  onApri,
  onChiudi,
}: {
  stato: StatoFalco;
  largo: boolean;
  sopraMenu: boolean;
  onApri: () => void;
  onChiudi: () => void;
}) {
  const lavora = stato.fase === "lavoro";
  // Mentre il Falco parla, la striscia fa da sottotitolo: il pezzo letto si scurisce a tempo.
  const lettura = useSyncExternalStore(ascoltaLettura, letturaInCorso, () => null);
  // Con un foglio aperto (il menu e' sotto lo sfondo scuro) la striscia scende in fondo
  // e il foglio si accorcia di quanto serve: niente piede coperto, anche con la safe area.
  const foglio = useSyncExternalStore(ascoltaFogli, () => fogliAperti() > 0, () => false);
  const sopra = sopraMenu && !foglio;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const radice = document.documentElement;
    const misura = () => {
      const r = el.getBoundingClientRect();
      radice.style.setProperty("--falco-riserva", `${Math.max(0, Math.round(window.innerHeight - r.top + 8))}px`);
    };
    misura();
    window.addEventListener("resize", misura);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(misura) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener("resize", misura);
      ro?.disconnect();
      radice.style.removeProperty("--falco-riserva");
    };
  }, [sopra, largo, stato.fase]);
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-falco-striscia={stato.fase}
      className={clsx(
        "fixed z-[70] flex items-center gap-3 rounded-[1.25rem] bg-grafite-950 py-2 pl-2 pr-2 text-white shadow-[0_12px_32px_-12px_rgba(14,14,16,0.7)]",
        largo ? "bottom-4 left-1/2 w-[min(40rem,calc(100%-2rem))] -translate-x-1/2" : "inset-x-3",
      )}
      style={
        largo
          ? undefined
          : {
              bottom: sopra
                ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
                : "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
            }
      }
    >
      <AvatarFalco size={36} />
      <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
        {lettura ? (
          <TestoAVoce
            className="max-h-[4.2em] overflow-hidden"
            pezzi={[lettura.pezzi[Math.max(0, lettura.pezzo)] ?? ""]}
            pezzo={0}
            parola={lettura.parola}
          />
        ) : lavora ? (
          <>
            <span className="text-grafite-400">Falco sta lavorando: </span>
            <span className="font-medium">{stato.riga || "preparo la schermata"}</span>
          </>
        ) : (
          <span className="line-clamp-2">{stato.riepilogo || "Fatto."}</span>
        )}
      </div>
      {lettura && !lavora ? (
        <button
          type="button"
          onClick={() => interrompiVoce()}
          className="shrink-0 rounded-[0.75rem] px-3 py-2 text-[13px] font-medium text-grafite-300 hover:bg-grafite-800 hover:text-white"
        >
          Basta
        </button>
      ) : lavora ? (
        <button
          type="button"
          onClick={onChiudi}
          className="shrink-0 rounded-[0.75rem] px-3 py-2 text-[13px] font-medium text-grafite-300 hover:bg-grafite-800 hover:text-white"
        >
          Ferma
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onApri}
            className="shrink-0 rounded-[0.75rem] bg-white px-3 py-2 text-[13px] font-medium text-ink"
          >
            {largo ? "Apri la conversazione" : "Conversazione"}
          </button>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.75rem] text-grafite-300 hover:bg-grafite-800 hover:text-white"
          >
            <Chiudi size={16} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

/** Barra del Falco in alto (computer): scrivi o parla, la risposta si apre nel pannello a destra. */
function BarraFalco({
  titolo,
  onChiedi,
  onAscolta,
  onApri,
}: {
  titolo: string;
  onChiedi: (t: string) => void;
  onAscolta: () => void;
  onApri: () => void;
}) {
  const [t, setT] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (t.trim()) {
          onChiedi(t.trim());
          setT("");
        } else onApri();
      }}
      data-falco="falco.chiedi"
      className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-grafite-900 py-1 pl-1 pr-1 lg:max-w-[40rem]"
    >
      <button
        type="button"
        onClick={onApri}
        aria-label="Apri Falco"
        className="shrink-0 rounded-full"
      >
        <AvatarFalco size={40} />
      </button>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Chiedi a Falco</span>
        <input
          value={t}
          onChange={(e) => setT(e.target.value.slice(0, 4000))}
          placeholder={`Chiedi a Falco su ${titolo.toLowerCase()}`}
          className="h-10 w-full bg-transparent px-1 text-[14.5px] text-white placeholder:text-grafite-400 focus:outline-none focus-visible:shadow-none"
        />
      </label>
      {t.trim() ? (
        <button
          type="submit"
          aria-label="Invia a Falco"
          className="premi grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink"
        >
          <Invia size={16} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={onAscolta}
          aria-label="Parla con Falco"
          className="premi grid h-10 w-10 shrink-0 place-items-center rounded-full bg-oro-500 text-acido-950"
        >
          <Microfono size={17} aria-hidden />
        </button>
      )}
    </form>
  );
}

function VoceMenu({
  app,
  s,
  attiva,
  n,
}: {
  app: AppPortale;
  s: Sezione;
  attiva: boolean;
  n?: number;
}) {
  const I = s.icona;
  return (
    <li>
      <Link
        href={percorso(app, s.chiave)}
        data-falco={`menu.${s.falco ?? `${app}.${s.chiave}`}`}
        aria-current={attiva ? "page" : undefined}
        className="nav-item transition-colors"
      >
        <span aria-hidden className={clsx("nav-dot", PASTIGLIA[s.categoria])}>
          <I size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate">{s.titolo}</span>
        {(n ?? 0) > 0 && (
          // Sul menu nero il contatore e' acido con il numero nero (come il prototipo):
          // il grafite indicato in 02 non si vedrebbe sul fondo nero.
          <span className="cifre grid h-5 min-w-5 place-items-center rounded-full bg-acid-400 px-1.5 text-[11px] font-semibold text-acid-950">
            {n}
            <span className="sr-only"> da vedere</span>
          </span>
        )}
      </Link>
    </li>
  );
}

function SenzaAzienda() {
  return (
    <div className="mx-auto max-w-lg rounded-[1.75rem] bg-perla-velo p-6 text-center">
      <p className="text-[20px] font-medium text-ink">
        Nessuna azienda collegata
      </p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
        Il tuo accesso non è ancora collegato a un&apos;azienda. Chiedi al
        titolare o allo studio di invitarti con la tua email.
      </p>
    </div>
  );
}

const RUOLI_AZIENDA: Record<string, string> = {
  titolare: "Titolare",
  referente: "Referente interno",
  consulente_lavoro: "Consulente del lavoro",
  medico_competente: "Medico competente",
  studio: "Studio",
};

export function etichettaRuolo(r: string): string {
  return RUOLI_AZIENDA[r] ?? r;
}

export { IconaCampanella };
