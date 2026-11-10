import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  HardHat,
  Handshake,
  Network,
  Scale,
  Siren,
  UserCheck,
  type LucideIcon,
} from '@/components/icone';

/**
 * Temi principali dell'Agente HSE ("main points" della scena d'apertura).
 *
 * - `domande`: tre richieste rapide; un clic le invia subito all'agente.
 * - `avvio`: messaggio mandato quando l'utente chiede all'agente di partire
 *   lui sul tema. Dice il tema e chiede di cominciare con le domande giuste.
 * - `spazio`: scheda dello spazio di lavoro che conviene mostrare per il tema.
 */
export type SchedaSpazio =
  | 'azienda'
  | 'persone'
  | 'formazione'
  | 'documenti'
  /** Documenti HSE dell'azienda (DVR, POS, valutazioni, DUVRI, PiMUS, HACCP, PEE, verbali, nomine, procedure, radon). */
  | 'documenti_hse'
  | 'cantieri'
  // Safety Control Room (components/agente/controlroom, SCHEDE_CONTROL_ROOM)
  | 'control_room'
  | 'scadenzario'
  | 'fascicolo'
  | 'report'
  | 'passaporto'
  | 'pronto_controllo';

export interface AgenteTema {
  id: string;
  titolo: string;
  descrizione: string;
  icona: LucideIcon;
  domande: [string, string, string];
  avvio: string;
  spazio: SchedaSpazio;
  /**
   * Versione per il datore di lavoro, che consulta soltanto: domande
   * informative al posto di quelle che fanno redigere documenti.
   */
  datore?: { domande: [string, string, string]; avvio: string };
}

const avvio = (tema: string, cosa: string) =>
  `Lavoriamo sul tema ${tema}. ${cosa} Prima di partire fammi le domande che ti servono, una alla volta e solo quelle davvero necessarie, usando quello che sai già dell'azienda.`;

export const AGENTE_TEMI: AgenteTema[] = [
  {
    id: 'dvr',
    titolo: 'DVR',
    descrizione: 'Valutazione dei rischi, matrice e revisioni del documento',
    icona: FileText,
    domande: ["Prepara il DVR di un'azienda", "Com'è messo il DVR delle mie aziende", 'Quali rischi vanno rivalutati dopo un cambio di lavorazione'],
    avvio: avvio('DVR', "Voglio preparare o aggiornare il Documento di Valutazione dei Rischi secondo l'art. 28 del D.Lgs. 81/08."),
    spazio: 'documenti_hse',
    datore: {
      domande: ["Com'è messo il DVR della mia azienda", 'Cosa deve contenere il DVR', 'Ogni quanto va aggiornato il DVR'],
      avvio: `Voglio capire a che punto è il Documento di Valutazione dei Rischi della mia azienda e cosa comporta per me. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'pos',
    titolo: 'POS e cantieri',
    descrizione: 'Piano operativo di sicurezza per ogni cantiere aperto',
    icona: HardHat,
    domande: ['Prepara il POS per un nuovo cantiere', 'Cosa deve contenere un POS secondo l’Allegato XV', 'Quali lavorazioni del cantiere hanno rischi interferenti'],
    avvio: avvio('POS e cantieri', "Devo redigere il Piano Operativo di Sicurezza di un'impresa esecutrice (Allegato XV del D.Lgs. 81/08)."),
    spazio: 'cantieri',
    datore: {
      domande: ['Quando serve il POS di un’impresa', 'Cosa controllo nel POS di chi lavora da me', 'Chi firma il POS'],
      avvio: `Voglio capire come funziona il POS nei cantieri che riguardano la mia azienda. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'psc',
    titolo: 'PSC e coordinamento',
    descrizione: 'Piano di sicurezza e coordinamento, ruolo di CSP e CSE',
    icona: Network,
    domande: ['Imposta il PSC di un cantiere con più imprese', 'Come stimo i costi della sicurezza nel PSC', 'Quando serve il coordinatore per la sicurezza'],
    avvio: avvio('PSC e coordinamento', 'Mi occupo del coordinamento della sicurezza in cantiere (articoli da 89 a 100 e Allegato XV).'),
    spazio: 'cantieri',
    datore: {
      domande: ['Quando serve il PSC', 'Chi nomina il coordinatore per la sicurezza', 'Cosa cambia per me con più imprese in cantiere'],
      avvio: `Voglio capire cosa prevede il coordinamento della sicurezza nei cantieri e cosa tocca a me. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'duvri',
    titolo: 'DUVRI e appalti',
    descrizione: 'Rischi da interferenza e verifica dei fornitori',
    icona: Handshake,
    domande: ['Prepara il DUVRI per un appalto di manutenzione', 'Quali documenti chiedo a un appaltatore', 'Quando il DUVRI non è obbligatorio'],
    avvio: avvio('DUVRI e appalti', "Devo gestire un appalto con rischi da interferenza secondo l'art. 26 del D.Lgs. 81/08."),
    spazio: 'documenti_hse',
    datore: {
      domande: ['Quando serve il DUVRI nella mia azienda', 'Cosa devo chiedere a un appaltatore', 'Chi è responsabile dei rischi da interferenza'],
      avvio: `Voglio capire cosa devo fare quando affido lavori a imprese esterne. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'formazione',
    titolo: 'Formazione e scadenze',
    descrizione: 'Corsi, aggiornamenti, visite e verifiche in arrivo',
    icona: CalendarClock,
    domande: ['Quali corsi scadono nei prossimi 60 giorni', 'Che formazione serve a un nuovo assunto', 'Organizza gli aggiornamenti dei preposti'],
    avvio: avvio('Formazione e scadenze', "Voglio mettere in ordine formazione e scadenze secondo l'Accordo Stato Regioni del 17/04/2025."),
    spazio: 'formazione',
    datore: {
      domande: ['Quali corsi della mia azienda scadono presto', 'Che formazione serve a un nuovo assunto', 'Ogni quanto si aggiorna la formazione'],
      avvio: `Voglio sapere come sono messi formazione e scadenze della mia azienda. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'sopralluogo',
    titolo: 'Sopralluogo',
    descrizione: 'Rilievi in campo con foto, voce e note',
    icona: ClipboardCheck,
    domande: ['Registra un rilievo di sopralluogo', 'Fammi la lista di controllo per un capannone', 'Riassumi i rilievi dell’ultimo sopralluogo'],
    avvio: avvio('Sopralluogo', 'Sto per fare un sopralluogo e voglio raccogliere i rilievi che servono al DVR.'),
    spazio: 'documenti',
    datore: {
      domande: ['Cosa succede durante un sopralluogo', 'Cosa è emerso dall’ultimo sopralluogo', 'Come mi preparo alla visita del consulente'],
      avvio: `Voglio capire come si svolgono i sopralluoghi nella mia azienda e cosa è emerso. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'nomine',
    titolo: 'Nomine e organigramma',
    descrizione: 'RSPP, medico competente, RLS, preposti e addetti',
    icona: UserCheck,
    domande: ["Chi manca nell'organigramma della sicurezza", 'Prepara la nomina del preposto', 'Il datore di lavoro può fare da RSPP'],
    avvio: avvio('Nomine e organigramma', "Voglio completare l'organigramma della sicurezza e le nomine obbligatorie."),
    spazio: 'persone',
    datore: {
      domande: ["Chi manca nell'organigramma della mia azienda", 'Il datore di lavoro può fare da RSPP', 'Quali nomine sono obbligatorie per me'],
      avvio: `Voglio sapere quali figure della sicurezza servono alla mia azienda e chi manca. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'normativa',
    titolo: 'Normativa e aggiornamenti',
    descrizione: 'D.Lgs. 81/08, decreti, accordi e linee guida INAIL',
    icona: Scale,
    domande: ['Cosa è cambiato nella normativa questo mese', 'Cosa dice la norma sul rumore', 'Quali obblighi ho come datore di lavoro'],
    avvio: avvio('Normativa e aggiornamenti', 'Ho bisogno di capire cosa dice la norma e cosa è cambiato di recente.'),
    spazio: 'azienda',
  },
  {
    id: 'emergenze',
    titolo: 'Emergenze e primo soccorso',
    descrizione: 'Piano di emergenza, antincendio, addetti e presidi',
    icona: Siren,
    domande: ['Prepara il piano di emergenza ed evacuazione', 'Quanti addetti antincendio servono', 'Cosa va nella cassetta di primo soccorso'],
    avvio: avvio('Emergenze e primo soccorso', 'Voglio impostare la gestione delle emergenze (DM 02/09/2021 e DM 388/2003).'),
    spazio: 'persone',
    datore: {
      domande: ['Quanti addetti antincendio servono alla mia azienda', 'Cosa va nella cassetta di primo soccorso', 'Ogni quanto si fa la prova di evacuazione'],
      avvio: `Voglio capire come è organizzata la gestione delle emergenze nella mia azienda. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
  {
    id: 'aziende',
    titolo: 'Aziende e anagrafiche',
    descrizione: 'Schede, sedi, lavoratori e mansioni dei clienti',
    icona: Building2,
    domande: ['Aggiungi una nuova azienda', 'Aggiorna i lavoratori e le mansioni', "Cosa manca nell'anagrafica delle mie aziende"],
    avvio: avvio('Aziende e anagrafiche', "Voglio sistemare l'anagrafica delle aziende che seguo."),
    spazio: 'azienda',
    datore: {
      domande: ['Quali dati della mia azienda risultano', 'Cosa manca nella scheda della mia azienda', 'Come aggiorno lavoratori e mansioni'],
      avvio: `Voglio controllare i dati della mia azienda. Rispondimi in modo semplice, io consulto e non redigo documenti.`,
    },
  },
];

export function temaPerId(id: string | null | undefined): AgenteTema | null {
  return AGENTE_TEMI.find((t) => t.id === id) ?? null;
}

/** Versione del tema adatta al ruolo: il datore di lavoro consulta soltanto. */
export function temaPerRuolo(t: AgenteTema, isDatore: boolean): AgenteTema {
  return isDatore && t.datore ? { ...t, domande: t.datore.domande, avvio: t.datore.avvio } : t;
}

/**
 * Contesto del tema nascosto in testa al messaggio: l'agente lo legge, a
 * schermo non si vede (vedi senzaTema).
 */
const PREFISSO_TEMA = /^\[Tema: ([^\]\n]{1,60})\]\s*/;

export function conTema(testo: string, tema: AgenteTema | null): string {
  return tema ? `[Tema: ${tema.titolo}] ${senzaTema(testo)}` : testo;
}

export function senzaTema(testo: string): string {
  return testo.replace(PREFISSO_TEMA, '');
}

export function temaDelTesto(testo: string): AgenteTema | null {
  const m = PREFISSO_TEMA.exec(testo);
  return m ? AGENTE_TEMI.find((t) => t.titolo === m[1]) ?? null : null;
}
