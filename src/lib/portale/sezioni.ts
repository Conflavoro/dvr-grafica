/**
 * Mappa delle sezioni delle due app (ADR-009), presa dal prototipo del Portale HSE:
 * gruppi e voci del menu, colore di categoria, icona, sezione del Falco, permesso
 * richiesto sull'azienda (RuoliAzienda::MATRICE) e posto nel menu del telefono.
 * E' l'unica fonte: menu del computer, menu in basso del telefono, pagina "Tutto",
 * briciole e Falco di sezione leggono da qui.
 */

import type { IconaComponente } from '@/components/icone';
import { Cerotto, Posate, Valigetta } from '@/components/portale/telefono/icone';
import {
  Allerta,
  Azienda,
  Borsa,
  Calendario,
  Cartella,
  Casa,
  Casco,
  Corso,
  Documento,
  Elenco,
  Fiamma,
  Firma,
  Fumetto,
  Nota,
  Orologio,
  Persone,
  Portafoglio,
  Provetta,
  Punteggio,
  Razzo,
  Regolazioni,
  ScudoAllerta,
  Sopralluogo,
  Storico,
  Visita,
} from '@/components/icone';

export type AppPortale = 'gestionale' | 'azienda';

export type Categoria =
  | 'documenti'
  | 'formazione'
  | 'visite'
  | 'scadenze'
  | 'persone'
  | 'contratto'
  | 'pagamenti'
  | 'servizi'
  | 'assistenza'
  | 'antincendio'
  | 'primosoccorso'
  | 'haccp'
  | 'infortuni'
  | 'utenti'
  | 'ispezioni'
  | 'avvio'
  | 'home';

export interface Sezione {
  /** Chiave della rotta: /<app>/<chiave>. */
  chiave: string;
  titolo: string;
  /** Titolo breve per il menu in basso del telefono. */
  breve?: string;
  gruppo: string | null;
  icona: IconaComponente;
  categoria: Categoria;
  /** Sezione del Falco (App\Services\Agent\Sezioni), se esiste. */
  falco?: string;
  /** Azione della matrice dell'azienda necessaria per vederla (solo area azienda). */
  permesso?: string;
  /** Posizione nel menu in basso del telefono (1-4); le altre vanno in "Tutto". */
  tab?: number;
  /** Ruoli dello studio che la vedono (solo gestionale); assente = tutti. */
  ruoliStudio?: string[];
  /** Portale di un partner esterno (es. medico_competente): l'unica voce del gestionale per quell'utente. */
  partner?: string;
  /**
   * Condizione sull'azienda oltre al permesso (06 §3): 'sedeAlimentare' = solo con almeno una
   * sede alimentare (HACCP); 'fascicoloAperto' = solo finche' il fascicolo non e' completo.
   */
  condizione?: 'sedeAlimentare' | 'fascicoloAperto';
  /** Solo sul computer: sul telefono non compare (09: HACCP sul telefono da decidere col designer). */
  soloComputer?: boolean;
  /** Il suo contatore entra nella somma della voce Tutto della barra del telefono (03 §2). */
  contaInTutto?: boolean;
}

/** Colori della pastiglia per categoria: il colore va solo li', mai sul fondo. */
export const PASTIGLIA: Record<Categoria, string> = {
  primosoccorso: 'bg-cat-primosoccorso text-grafite-950',
  haccp: 'bg-cat-haccp text-grafite-950',
  infortuni: 'bg-cat-infortuni text-grafite-950',
  documenti: 'bg-cat-documenti text-cat-documenti-ink',
  formazione: 'bg-cat-formazione text-cat-formazione-ink',
  visite: 'bg-cat-visite text-cat-visite-ink',
  scadenze: 'bg-cat-scadenze text-cat-scadenze-ink',
  persone: 'bg-cat-persone text-cat-persone-ink',
  contratto: 'bg-cat-contratto text-cat-contratto-ink',
  pagamenti: 'bg-cat-pagamenti text-cat-pagamenti-ink',
  servizi: 'bg-cat-servizi text-cat-servizi-ink',
  assistenza: 'bg-cat-assistenza text-cat-assistenza-ink',
  antincendio: 'bg-cat-antincendio text-cat-antincendio-ink',
  utenti: 'bg-cat-utenti text-cat-utenti-ink',
  ispezioni: 'bg-cat-ispezioni text-cat-ispezioni-ink',
  avvio: 'bg-acid-400 text-acid-950',
  home: 'bg-grafite-800 text-white',
};

/** Fondo della testata della sezione (l'unico punto in cui il colore fa da fondo). */
export const TESTATA: Record<Categoria, string> = {
  primosoccorso: 'bg-cat-primosoccorso text-cat-primosoccorso-ink',
  haccp: 'bg-cat-haccp text-cat-haccp-ink',
  infortuni: 'bg-cat-infortuni text-cat-infortuni-ink',
  documenti: 'bg-cat-documenti text-cat-documenti-ink',
  formazione: 'bg-cat-formazione text-cat-formazione-ink',
  visite: 'bg-cat-visite text-cat-visite-ink',
  scadenze: 'bg-cat-scadenze text-cat-scadenze-ink',
  persone: 'bg-cat-persone text-cat-persone-ink',
  contratto: 'bg-cat-contratto text-cat-contratto-ink',
  pagamenti: 'bg-cat-pagamenti text-cat-pagamenti-ink',
  servizi: 'bg-cat-servizi text-cat-servizi-ink',
  assistenza: 'bg-cat-assistenza text-cat-assistenza-ink',
  antincendio: 'bg-cat-antincendio text-cat-antincendio-ink',
  utenti: 'bg-cat-utenti text-cat-utenti-ink',
  ispezioni: 'bg-cat-ispezioni text-white',
  avvio: 'bg-acid-400 text-acid-950',
  home: 'bg-sunken text-fg',
};

export const SEZIONI_GESTIONALE: Sezione[] = [
  { chiave: 'coda', titolo: 'Coda di lavoro', breve: 'Coda', gruppo: null, icona: Elenco, categoria: 'avvio', falco: 'gestionale.coda', tab: 1 },
  { chiave: 'aziende', titolo: 'Aziende', gruppo: 'Clienti', icona: Azienda, categoria: 'utenti', falco: 'gestionale.aziende', tab: 2 },
  { chiave: 'preventivi', titolo: 'Preventivi e ordini', gruppo: 'Clienti', icona: Nota, categoria: 'contratto', falco: 'gestionale.preventivi' },
  { chiave: 'avvio', titolo: 'Avvio dei clienti', gruppo: 'Clienti', icona: Razzo, categoria: 'persone', falco: 'gestionale.avvio' },
  { chiave: 'aggiornamenti', titolo: 'Aggiornamenti', gruppo: 'Clienti', icona: Storico, categoria: 'documenti', falco: 'gestionale.aggiornamenti' },
  // Fuori dalla specifica dell'app del cliente: restano solo nel gestionale (decisione del 30/10/2026).
  { chiave: 'importa', titolo: 'Importa dati', gruppo: 'Clienti', icona: Cartella, categoria: 'persone', falco: 'azienda.importa' },
  // Prima il sopralluogo, che raccoglie il materiale, poi i documenti che lo usano (Rocco 10/11).
  { chiave: 'sopralluoghi', titolo: 'Sopralluoghi', breve: 'Sopralluogo', gruppo: 'Sicurezza', icona: Sopralluogo, categoria: 'scadenze', falco: 'gestionale.sopralluoghi', tab: 3 },
  { chiave: 'dvr', titolo: 'Scrivania del DVR', breve: 'DVR', gruppo: 'Sicurezza', icona: Documento, categoria: 'documenti', falco: 'gestionale.dvr', tab: 4 },
  { chiave: 'pos', titolo: 'POS e PiMUS', gruppo: 'Sicurezza', icona: Casco, categoria: 'servizi', falco: 'gestionale.pos' },
  { chiave: 'ispezioni', titolo: 'Pronto Ispezioni', gruppo: 'Sicurezza', icona: ScudoAllerta, categoria: 'ispezioni', falco: 'gestionale.ispezioni' },
  { chiave: 'nearmiss', titolo: 'Near miss', gruppo: 'Sicurezza', icona: Allerta, categoria: 'antincendio', falco: 'azienda.nearmiss' },
  { chiave: 'prenotazioni', titolo: 'Prenotazioni', gruppo: 'Formazione e visite', icona: Calendario, categoria: 'visite', falco: 'gestionale.prenotazioni' },
  { chiave: 'classi', titolo: 'Classi di formazione', gruppo: 'Formazione e visite', icona: Corso, categoria: 'formazione', falco: 'gestionale.classi' },
  { chiave: 'promemoria', titolo: 'Promemoria e presenze', gruppo: 'Formazione e visite', icona: Fumetto, categoria: 'assistenza', falco: 'gestionale.promemoria' },
  { chiave: 'crediti', titolo: 'Crediti e wallet', gruppo: 'Amministrazione', icona: Portafoglio, categoria: 'pagamenti', falco: 'gestionale.crediti', ruoliStudio: ['titolare_studio', 'admin_conflavoro'] },
  { chiave: 'ore', titolo: 'Registro ore', gruppo: 'Amministrazione', icona: Orologio, categoria: 'utenti', falco: 'gestionale.ore' },
  { chiave: 'cruscotto', titolo: 'Cruscotto', gruppo: 'Amministrazione', icona: Punteggio, categoria: 'utenti', falco: 'gestionale.cruscotto', ruoliStudio: ['titolare_studio', 'admin_conflavoro'] },
  { chiave: 'medico', titolo: 'Portale del medico', breve: 'Medico', gruppo: 'Portali dei partner', icona: Visita, categoria: 'visite', falco: 'gestionale.medico', partner: 'medico_competente' },
  { chiave: 'giornata', titolo: 'Giornata delle visite', gruppo: 'Portali dei partner', icona: Visita, categoria: 'visite', falco: 'gestionale.giornata' },
  { chiave: 'laboratorio', titolo: 'Portale del laboratorio', gruppo: 'Portali dei partner', icona: Provetta, categoria: 'servizi', falco: 'gestionale.laboratorio' },
];

/**
 * Area azienda, nell'ordine del menu della specifica (03 §3). Sul telefono la barra in basso ha
 * Home (tab 1), Scadenze (tab 2), l'assistente al centro, Persone (tab 3) e Tutto; le altre
 * sezioni si aprono da Tutto. Primo soccorso, HACCP e Infortuni hanno le azioni dedicate della
 * matrice (stessi ruoli di RuoliAzienda::sezioni, 06 §3); quando il server manda le sezioni del
 * ruolo, le sezioni dei luoghi seguono quelle (SEZIONI_DAL_SERVER).
 */
export const SEZIONI_AZIENDA: Sezione[] = [
  { chiave: 'dashboard', titolo: 'Dashboard', breve: 'Home', gruppo: null, icona: Casa, categoria: 'home', falco: 'azienda.dashboard', permesso: 'dashboard', tab: 1 },
  { chiave: 'scadenze', titolo: 'Scadenziario', breve: 'Scadenze', gruppo: 'Operatività', icona: Calendario, categoria: 'scadenze', falco: 'azienda.scadenze', permesso: 'scadenziario', tab: 2 },
  { chiave: 'persone', titolo: 'Dipendenti', breve: 'Persone', gruppo: 'Operatività', icona: Persone, categoria: 'persone', falco: 'azienda.persone', permesso: 'dipendenti_vedi', tab: 3 },
  { chiave: 'formazione', titolo: 'Formazione', gruppo: 'Operatività', icona: Corso, categoria: 'formazione', falco: 'azienda.formazione', permesso: 'formazione_vedi' },
  { chiave: 'visite', titolo: 'Visite mediche', gruppo: 'Operatività', icona: Visita, categoria: 'visite', falco: 'azienda.visite', permesso: 'visite_vedi' },
  { chiave: 'antincendio', titolo: 'Antincendio', gruppo: 'Operatività', icona: Fiamma, categoria: 'antincendio', falco: 'azienda.antincendio', permesso: 'scadenziario', contaInTutto: true },
  { chiave: 'primosoccorso', titolo: 'Primo soccorso', gruppo: 'Operatività', icona: Valigetta, categoria: 'primosoccorso', falco: 'azienda.primosoccorso', permesso: 'primosoccorso_modifica', contaInTutto: true },
  { chiave: 'haccp', titolo: 'HACCP', gruppo: 'Operatività', icona: Posate, categoria: 'haccp', falco: 'azienda.haccp', permesso: 'haccp_gestisci', condizione: 'sedeAlimentare' },
  { chiave: 'infortuni', titolo: 'Infortuni', gruppo: 'Operatività', icona: Cerotto, categoria: 'infortuni', falco: 'azienda.infortuni', permesso: 'infortuni_denuncia', contaInTutto: true },
  { chiave: 'documenti', titolo: 'Documenti e DVR', breve: 'Documenti', gruppo: 'Documenti e servizi', icona: Cartella, categoria: 'documenti', falco: 'azienda.documenti', permesso: 'documenti_vedi', contaInTutto: true },
  { chiave: 'servizi', titolo: 'Servizi e ordini', gruppo: 'Documenti e servizi', icona: Borsa, categoria: 'servizi', falco: 'azienda.servizi', permesso: 'ordini_richiedi', contaInTutto: true },
  { chiave: 'contratto', titolo: 'Contratto e fatture', gruppo: 'Account', icona: Firma, categoria: 'contratto', falco: 'azienda.contratto', permesso: 'contratto_fatture' },
  { chiave: 'wallet', titolo: 'Wallet e pagamenti', gruppo: 'Account', icona: Portafoglio, categoria: 'pagamenti', falco: 'azienda.wallet', permesso: 'wallet_saldo' },
  { chiave: 'utenti', titolo: 'Utenti e permessi', gruppo: 'Account', icona: Regolazioni, categoria: 'utenti', falco: 'azienda.utenti', permesso: 'utenti_invita_dipendenti' },
  { chiave: 'avvio', titolo: 'Completa il fascicolo', gruppo: 'Account', icona: Razzo, categoria: 'avvio', falco: 'azienda.avvio', permesso: 'avvio', condizione: 'fascicoloAperto', contaInTutto: true },
  { chiave: 'messaggi', titolo: 'Messaggi', gruppo: null, icona: Fumetto, categoria: 'assistenza', falco: 'azienda.messaggi', permesso: 'messaggi', contaInTutto: true },
];

/**
 * Sezioni dell'area azienda tolte dall'app del cliente (Near miss, Importa dati): le viste restano
 * e si aprono dal gestionale sull'azienda scelta. Servono solo a trovarne titolo e categoria.
 */
export const SEZIONI_AZIENDA_RITIRATE: Sezione[] = [
  { chiave: 'nearmiss', titolo: 'Near miss', gruppo: null, icona: Allerta, categoria: 'antincendio', falco: 'azienda.nearmiss', permesso: 'nearmiss_vedi' },
  { chiave: 'importa', titolo: 'Importa dati', gruppo: null, icona: Cartella, categoria: 'persone', falco: 'azienda.importa', permesso: 'dipendenti_modifica' },
];

/** Pronto Ispezioni dell'area azienda: pulsante acido in fondo al menu, non una voce. */
export const ISPEZIONI_AZIENDA: Sezione = {
  chiave: 'ispezioni',
  // Titolo della barra della sezione (04, Pronto Ispezioni); il pulsante del menu dice "Ho un controllo in corso".
  titolo: 'Pronto Ispezioni',
  gruppo: null,
  icona: ScudoAllerta,
  categoria: 'ispezioni',
  falco: 'azienda.ispezioni',
  permesso: 'pronto_ispezioni',
};

/** Attivazione del cliente nuovo: finché l'azienda non è attiva è l'unica schermata, senza menu. */
export const ATTIVAZIONE_AZIENDA: Sezione = {
  chiave: 'attivazione',
  titolo: 'Attivazione del servizio',
  gruppo: null,
  icona: Razzo,
  categoria: 'avvio',
  falco: 'azienda.attivazione',
  permesso: 'avvio',
};

export function sezioniDi(app: AppPortale): Sezione[] {
  return app === 'gestionale' ? SEZIONI_GESTIONALE : SEZIONI_AZIENDA;
}

export interface OpzioniVisibili {
  ruolo?: string | null;
  permessi?: string[] | null;
  /** Numero di sedi alimentari dell'azienda (dato di S2); assente o null = HACCP nascosto. */
  sediAlimentari?: number | null;
  /** Fascicolo completo (chiuse anche le voci ISFOR, 09): "Completa il fascicolo" sparisce. */
  fascicoloCompleto?: boolean | null;
  /** App per telefono: le voci soloComputer non compaiono. */
  telefono?: boolean;
  /** Sezioni del ruolo calcolate dal server (RuoliAzienda::sezioni); assente = solo permessi. */
  sezioni?: string[] | null;
  /** Gestionale: sezioni del ruolo dello staff dal server (PermessiGestionale::sezioni); assente = nessun filtro. */
  sezioniStaff?: string[] | null;
}

/**
 * Voci del gestionale e sezioni della matrice del server (PermessiGestionale::SEZIONI): con il ruolo
 * dello staff noto, la voce compare solo se il server la apre (il tecnico non vede giornate e laboratorio).
 */
const SEZIONE_STAFF: Record<string, string> = {
  coda: 'home', aziende: 'aziende', preventivi: 'vendite', avvio: 'avvii', dvr: 'dvr', sopralluoghi: 'sopralluoghi',
  pos: 'cantieri', ispezioni: 'ispezioni', prenotazioni: 'prenotazioni', classi: 'classi', promemoria: 'promemoria',
  crediti: 'crediti', ore: 'ore', cruscotto: 'cruscotto', medico: 'medico', giornata: 'giornata', laboratorio: 'laboratorio',
};

/** Sezioni che il server decide per ruolo e azienda (06 §3): qui vale la sua lista quando c'è. */
const SEZIONI_DAL_SERVER = ['antincendio', 'primosoccorso', 'haccp', 'infortuni'];

/** Opzioni dell'azienda scelta (dati del server in aziendePortale): sedi alimentari, fascicolo, sezioni del ruolo. */
export function opzioniAzienda(azienda: unknown): Pick<OpzioniVisibili, 'sediAlimentari' | 'fascicoloCompleto' | 'sezioni'> {
  const a = (azienda ?? {}) as { sedi_alimentari?: unknown; fascicolo_completo?: unknown; sezioni?: unknown; sedi?: unknown };
  const sedi = Array.isArray(a.sedi) ? (a.sedi as Array<{ alimentare?: unknown }>) : [];
  return {
    sediAlimentari: typeof a.sedi_alimentari === 'number' ? a.sedi_alimentari : sedi.length ? sedi.filter((x) => x?.alimentare === true).length : null,
    fascicoloCompleto: typeof a.fascicolo_completo === 'boolean' ? a.fascicolo_completo : null,
    sezioni: Array.isArray(a.sezioni) ? a.sezioni.map(String) : null,
  };
}

/** Sezioni visibili: nel gestionale per ruolo dello studio, nell'area azienda per permesso e condizione. */
export function sezioniVisibili(app: AppPortale, opz: OpzioniVisibili): Sezione[] {
  const tutte = sezioniDi(app);
  // Il medico competente esterno (utente_azienda) nel gestionale vede solo il suo portale.
  if (app === 'gestionale' && opz.ruolo === 'utente_azienda') return tutte.filter((s) => s.partner === 'medico_competente').map((s) => ({ ...s, tab: 1 }));
  if (app === 'gestionale')
    return tutte.filter((s) => {
      if (s.ruoliStudio && !(opz.ruolo != null && s.ruoliStudio.includes(opz.ruolo))) return false;
      const staff = SEZIONE_STAFF[s.chiave];
      return !(opz.sezioniStaff && staff && !opz.sezioniStaff.includes(staff));
    });
  const p = opz.permessi ?? [];
  return tutte.filter((s) => {
    if (s.permesso && !p.includes(s.permesso)) return false;
    if (opz.sezioni && SEZIONI_DAL_SERVER.includes(s.chiave) && !opz.sezioni.includes(s.chiave)) return false;
    if (s.condizione === 'sedeAlimentare' && !((opz.sediAlimentari ?? 0) > 0)) return false;
    if (s.condizione === 'fascicoloAperto' && opz.fascicoloCompleto === true) return false;
    if (s.soloComputer && opz.telefono) return false;
    return true;
  });
}

export function trovaSezione(app: AppPortale, chiave: string | null | undefined): Sezione | undefined {
  if (app === 'azienda' && chiave === 'ispezioni') return ISPEZIONI_AZIENDA;
  if (app === 'azienda' && chiave === 'attivazione') return ATTIVAZIONE_AZIENDA;
  return sezioniDi(app).find((s) => s.chiave === chiave) ?? (app === 'azienda' ? SEZIONI_AZIENDA_RITIRATE.find((s) => s.chiave === chiave) : undefined);
}

/** Gruppi del menu nell'ordine del prototipo. */
export function gruppi(sezioni: Sezione[]): Array<{ titolo: string | null; voci: Sezione[] }> {
  const out: Array<{ titolo: string | null; voci: Sezione[] }> = [];
  for (const s of sezioni) {
    const g = out[out.length - 1];
    if (g && g.titolo === s.gruppo) g.voci.push(s);
    else out.push({ titolo: s.gruppo, voci: [s] });
  }
  return out;
}

export function percorso(app: AppPortale, chiave: string): string {
  return `/${app}/${chiave}/`;
}

/**
 * Voci della barra in basso del telefono (03 §2): cinque colonne fisse, [tab 1, tab 2, assistente,
 * tab 3, Tutto]. Una voce che il ruolo non vede lascia la sua colonna vuota, cosi' l'assistente
 * resta sempre al centro (09, consulente).
 */
export function vociBarra(visibili: Sezione[]): Array<Sezione | null> {
  const per = (n: number) => visibili.find((s) => s.tab === n) ?? null;
  return [per(1), per(2), per(3)];
}
