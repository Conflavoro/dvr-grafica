/**
 * Tempo reale (ADR-013): motore del client, logica pura provata con Jest.
 *
 * Legge il feed GET /api/eventi con il cursore, ogni `attesa` secondi indicati dal
 * backend; si sospende quando l'app va in background e rilegge subito al ritorno.
 * Il driver (oggi "ricarica") puo' solo anticipare la lettura con una sveglia:
 * i dati arrivano sempre dal feed, che applica l'isolamento lato server.
 */

export interface EventoTempoReale {
  chiave: string;
  tipo: 'novita' | 'cambiamento';
  aziendaId: number | null;
  quando: string | null;
  /** Tipo del cambiamento (lavoratore_aggiunto, ...) o evento della novita'. */
  cosa: string;
  etichetta: string;
}

export interface Lettura {
  eventi: EventoTempoReale[];
  cursore: string;
  nonLette: number;
  altri: boolean;
  canale: { driver: string; attesa: number };
}

/** Driver sostituibile: collega una sveglia e restituisce come scollegarla. */
export interface DriverTempoReale {
  nome: string;
  collega(sveglia: () => void): () => void;
}

/** Driver di base: nessuna connessione, il motore rilegge a intervalli. */
export const driverRicarica: DriverTempoReale = { nome: 'ricarica', collega: () => () => undefined };

export interface Orologio {
  imposta(f: () => void, ms: number): unknown;
  annulla(h: unknown): void;
}

const orologioVero: Orologio = {
  imposta: (f, ms) => setTimeout(f, ms),
  annulla: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const ATTESA_PREDEFINITA = 30;
const ATTESA_MINIMA = 10;
const ATTESA_MASSIMA_ERRORE = 300;
const LETTURE_DI_FILA = 5;

export interface OpzioniMotore {
  leggi: (cursore: string | null) => Promise<Lettura>;
  consegna: (l: Lettura) => void;
  orologio?: Orologio;
  driver?: (nome: string) => DriverTempoReale;
}

export interface Motore {
  avvia(): void;
  sospendi(): void;
  riprendi(): void;
  ferma(): void;
  /** Lettura subito (sveglia del driver, ritorno in primo piano, azione dell'utente). */
  leggiOra(): Promise<void>;
  stato(): { attivo: boolean; sospeso: boolean; cursore: string | null; attesa: number; errori: number };
}

export function creaMotore(o: OpzioniMotore): Motore {
  const orologio = o.orologio ?? orologioVero;
  const scegliDriver = o.driver ?? (() => driverRicarica);
  let attivo = false;
  let sospeso = false;
  let cursore: string | null = null;
  let attesa = ATTESA_PREDEFINITA;
  let errori = 0;
  let timer: unknown = null;
  let inCorso: Promise<void> | null = null;
  let driver: { nome: string; scollega: () => void } | null = null;

  const pulisciTimer = () => {
    if (timer !== null) orologio.annulla(timer);
    timer = null;
  };

  const programma = () => {
    pulisciTimer();
    if (!attivo || sospeso) return;
    const s = errori > 0 ? Math.min(attesa * 2 ** (errori - 1), ATTESA_MASSIMA_ERRORE) : attesa;
    timer = orologio.imposta(() => {
      timer = null;
      void leggiOra();
    }, s * 1000);
  };

  const collegaDriver = (nome: string) => {
    if (driver?.nome === nome) return;
    driver?.scollega();
    const d = scegliDriver(nome);
    driver = { nome, scollega: d.collega(() => void leggiOra()) };
  };

  async function giro(): Promise<void> {
    for (let i = 0; i < LETTURE_DI_FILA && attivo; i++) {
      const l = await o.leggi(cursore);
      if (!attivo) return;
      cursore = l.cursore || cursore;
      attesa = Math.max(ATTESA_MINIMA, Number.isFinite(l.canale?.attesa) ? l.canale.attesa : ATTESA_PREDEFINITA);
      collegaDriver(l.canale?.driver || 'ricarica');
      o.consegna(l);
      if (!l.altri) break;
    }
  }

  function leggiOra(): Promise<void> {
    if (!attivo) return Promise.resolve();
    if (inCorso) return inCorso;
    pulisciTimer();
    inCorso = giro()
      .then(() => {
        errori = 0;
      })
      .catch(() => {
        errori++;
      })
      .finally(() => {
        inCorso = null;
        programma();
      });
    return inCorso;
  }

  return {
    avvia() {
      if (attivo) return;
      attivo = true;
      sospeso = false;
      void leggiOra();
    },
    sospendi() {
      if (!attivo) return;
      sospeso = true;
      pulisciTimer();
    },
    riprendi() {
      if (!attivo || !sospeso) return;
      sospeso = false;
      void leggiOra();
    },
    ferma() {
      attivo = false;
      sospeso = false;
      pulisciTimer();
      driver?.scollega();
      driver = null;
      cursore = null;
      errori = 0;
    },
    leggiOra,
    stato: () => ({ attivo, sospeso, cursore, attesa, errori }),
  };
}

// ---------------------------------------------------------------- risposta del backend

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const intero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** Mappa tollerante della risposta GET /eventi (campo data). */
export function mappaLettura(raw: unknown): Lettura {
  const d = rec(rec(raw).data);
  const can = rec(d.canale);
  const eventi: EventoTempoReale[] = [];
  for (const x of Array.isArray(d.eventi) ? d.eventi : []) {
    const e = rec(x);
    const tipo = e.tipo === 'novita' || e.tipo === 'cambiamento' ? e.tipo : null;
    if (!tipo || typeof e.chiave !== 'string') continue;
    const dett = rec(tipo === 'novita' ? e.novita : e.cambiamento);
    eventi.push({
      chiave: e.chiave,
      tipo,
      aziendaId: intero(e.azienda_id),
      quando: typeof e.quando === 'string' ? e.quando : null,
      cosa: String((tipo === 'novita' ? dett.evento : dett.tipo) ?? ''),
      etichetta: String((tipo === 'novita' ? dett.titolo : dett.etichetta) ?? ''),
    });
  }
  return {
    eventi,
    cursore: typeof d.cursore === 'string' ? d.cursore : '',
    nonLette: intero(d.non_lette) ?? 0,
    altri: d.altri === true,
    canale: { driver: typeof can.driver === 'string' ? can.driver : 'ricarica', attesa: intero(can.attesa) ?? ATTESA_PREDEFINITA },
  };
}

/** L'evento riguarda la schermata aperta? (azienda scelta, o nessuna azienda in vista). */
export function riguarda(e: EventoTempoReale, aziendaInVista: number | null): boolean {
  return aziendaInVista === null || e.aziendaId === null || e.aziendaId === aziendaInVista;
}
