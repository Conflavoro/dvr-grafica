// KB inline per arricchire il DVR generato — schede dettaglio per ogni rischio
// (D.Lgs. 81/08): misure standard, DPI con norme EN, formazione richiesta,
// estratti normativi citati per esteso. Usata dal generatore DOCX/PDF per
// produrre DVR di 30-80 pagine, conformi e con citazioni precise.

export interface SchedaRischio {
  id: string; // match con RISCHI_TIPICI.id
  descrizione_rischio: string;
  effetti_salute: string;
  misure_eliminazione: string[];
  misure_sostituzione: string[];
  misure_collettive: string[];
  dpi: Array<{ tipo: string; norma_en: string }>;
  formazione: string;
  sorveglianza_sanitaria: string;
  riferimento_normativo: string;
  estratto_norma: string;
}

export const SCHEDE_RISCHIO: Record<string, SchedaRischio> = {
  rumore: {
    id: 'rumore',
    descrizione_rischio:
      'Esposizione professionale a rumore continuo o impulsivo, durante lavorazioni con utensili pneumatici, motoseghe, smerigliatrici, impianti di produzione, attivita\' di cantiere.',
    effetti_salute:
      'Ipoacusia da rumore (ICD-10 H83.3), tinnito, alterazioni del sistema cardiovascolare, disturbi del sonno, riduzione capacita\' attenzionale.',
    misure_eliminazione: [
      'Riprogettazione del processo per eliminare la sorgente sonora',
      'Acquisto di attrezzature low-noise (etichetta CE direttiva macchine)',
    ],
    misure_sostituzione: [
      'Sostituzione macchine ad alta emissione con modelli a basso rumore',
      'Sostituzione lavorazioni rumorose con processi alternativi (es. saldatura laser vs molatura)',
    ],
    misure_collettive: [
      'Schermature acustiche perimetrali alle macchine rumorose',
      'Cabine insonorizzate per posti di lavoro fissi',
      'Pannelli fonoassorbenti su soffitti e pareti',
      'Segregazione zone rumorose dalle aree comuni',
    ],
    dpi: [
      { tipo: 'Inserti auricolari modellabili', norma_en: 'EN 352-2' },
      { tipo: 'Cuffie auricolari passive (SNR ≥ 27 dB)', norma_en: 'EN 352-1' },
      { tipo: 'Cuffie con archetto attive elettroniche', norma_en: 'EN 352-3' },
    ],
    formazione:
      'Informazione e formazione specifica art. 195 D.Lgs. 81/08 sui rischi del rumore, uso corretto otoprotettori, periodicita\' sorveglianza sanitaria.',
    sorveglianza_sanitaria:
      'Obbligatoria per LEX,8h ≥ 85 dB(A) o ppeak ≥ 137 dB(C) (art. 196 D.Lgs. 81/08). Visita medica preventiva e periodica annuale con audiometria tonale.',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo VIII Capo II (art. 187-198) · UNI EN ISO 9612:2011',
    estratto_norma:
      'Art. 189: Valori limite di esposizione e valori di azione: a) valori limite di esposizione: LEX,8h = 87 dB(A) e ppeak = 200 Pa (140 dB(C)); b) valori superiori di azione: LEX,8h = 85 dB(A) e ppeak = 140 Pa (137 dB(C)); c) valori inferiori di azione: LEX,8h = 80 dB(A) e ppeak = 112 Pa (135 dB(C)).',
  },
  mmc: {
    id: 'mmc',
    descrizione_rischio:
      'Movimentazione manuale di carichi (sollevamento, trasporto, spinta, traino) che possono comportare rischi dorso-lombari per i lavoratori.',
    effetti_salute:
      'Lombalgia, ernia discale, patologie tendinee dell\'arto superiore, sindrome del tunnel carpale.',
    misure_eliminazione: ['Automazione operazioni di sollevamento (paranchi, carrelli motorizzati)'],
    misure_sostituzione: ['Suddivisione carichi pesanti in pacchi piu\' leggeri', 'Utilizzo ausili meccanici (carrelli, transpallet, sollevatori)'],
    misure_collettive: [
      'Riprogettazione del posto di lavoro per ridurre dislivelli',
      'Pavimentazione regolare e antiscivolo',
      'Illuminazione adeguata aree movimentazione',
    ],
    dpi: [
      { tipo: 'Cintura lombare di sostegno', norma_en: 'non normata, dispositivo non sostituisce misure tecniche' },
      { tipo: 'Guanti antiscivolo', norma_en: 'EN 388' },
      { tipo: 'Scarpe antinfortunistiche S3', norma_en: 'EN ISO 20345' },
    ],
    formazione:
      'Formazione specifica sulle tecniche di sollevamento (gambe piegate, schiena dritta), pause posturali, ergonomia del posto di lavoro. Allegato XXXIII D.Lgs. 81/08.',
    sorveglianza_sanitaria:
      'Visita medica preventiva e periodica per lavoratori esposti a MMC con rischio significativo (NIOSH LI ≥ 1 o Snook-Ciriello fuori soglia). Esami clinici e radiografici colonna vertebrale a discrezione del MC.',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo VI (art. 167-171) · UNI ISO 11228 parti 1-2-3 · NIOSH 1991/1994 · Snook-Ciriello',
    estratto_norma:
      'Art. 168: Obblighi del datore di lavoro: il datore di lavoro adotta le misure organizzative necessarie e ricorre ai mezzi appropriati, in particolare attrezzature meccaniche, per evitare la necessita\' di una movimentazione manuale dei carichi da parte dei lavoratori. Qualora non sia possibile evitare la movimentazione manuale, il datore di lavoro fornisce ai lavoratori i mezzi adeguati allo scopo di ridurre il rischio.',
  },
  'caduta-alto': {
    id: 'caduta-alto',
    descrizione_rischio:
      'Caduta dall\'alto durante lavorazioni in quota (>2m): copertura tetti, ponteggi, scale, piattaforme, manutenzioni in altezza.',
    effetti_salute: 'Trauma cranico, fratture multiple, lesioni colonna vertebrale, decesso.',
    misure_eliminazione: ['Pianificazione lavorazioni da terra con piattaforma elevatrice mobile (PLE)'],
    misure_sostituzione: ['Lavorazioni prefabbricate al suolo poi sollevate in posizione finale'],
    misure_collettive: [
      'Parapetti permanenti perimetrali h ≥ 1m con corrente intermedio e tavola fermapiede (UNI EN 13374)',
      'Reti di sicurezza (UNI EN 1263)',
      'Impalcati di sicurezza sotto la zona di caduta',
      'Linee vita orizzontali e verticali (UNI EN 795)',
    ],
    dpi: [
      { tipo: 'Imbragatura anticaduta a corpo intero', norma_en: 'UNI EN 361' },
      { tipo: 'Cordino con assorbitore di energia', norma_en: 'UNI EN 354 + EN 355' },
      { tipo: 'Dispositivo retrattile anticaduta', norma_en: 'UNI EN 360' },
      { tipo: 'Casco di protezione con sottogola', norma_en: 'EN 397' },
    ],
    formazione:
      'Formazione specifica lavori in quota 8 ore minime (Allegato XXI D.Lgs. 81/08 art. 116). Aggiornamento ogni 5 anni 4 ore. Addestramento pratico uso DPI di III categoria.',
    sorveglianza_sanitaria:
      'Visita medica preventiva e periodica annuale con valutazione dell\'idoneita\' al lavoro in quota (esami: visus, equilibrio, pressione, ECG).',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo IV (art. 105-119, Allegato XV-XXI) · UNI EN 363 · DM 22/05/1992',
    estratto_norma:
      'Art. 111: Obblighi del datore di lavoro nell\'uso di attrezzature per lavori in quota: il datore di lavoro, nei casi in cui i lavori temporanei in quota non possono essere eseguiti in condizioni di sicurezza dal suolo, sceglie le attrezzature di lavoro piu\' idonee a garantire e mantenere condizioni di lavoro sicure. Le misure di protezione collettiva hanno priorita\' rispetto alle misure di protezione individuale.',
  },
  elettrico: {
    id: 'elettrico',
    descrizione_rischio:
      'Rischio di folgorazione, ustione, arco elettrico durante uso di apparecchi elettrici, manutenzione impianti, lavori in tensione.',
    effetti_salute: 'Folgorazione, ustioni, arresto cardiaco, fibrillazione ventricolare, decesso.',
    misure_eliminazione: ['Lavori sempre fuori tensione con messa in sicurezza (PES/PAV/PEI)'],
    misure_sostituzione: ['Tensione di sicurezza SELV/PELV per circuiti accessibili'],
    misure_collettive: [
      'Impianto di terra a norma CEI 64-8 con verifica biennale',
      'Interruttori differenziali Idn ≤ 30 mA su tutti i circuiti utilizzatori',
      'Quadri elettrici a norma con grado IP appropriato',
      'Segregazione parti attive (IPxxB minimo)',
    ],
    dpi: [
      { tipo: 'Guanti isolanti classe 0/00 (1000V/500V)', norma_en: 'EN 60903' },
      { tipo: 'Calzature isolanti', norma_en: 'EN 50321' },
      { tipo: 'Visiera di protezione', norma_en: 'EN 166' },
      { tipo: 'Tappetino isolante', norma_en: 'EN 61111' },
    ],
    formazione:
      'Formazione PES/PAV/PEI (CEI 11-27) per personale che esegue lavori elettrici. Aggiornamento quinquennale. Idoneita\' rilasciata da datore di lavoro su attestato corso.',
    sorveglianza_sanitaria: 'Visita medica preventiva e periodica per addetti lavori elettrici (esami specifici per certificazione PES/PAV).',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo III Capo III (art. 80-87) · CEI 64-8 · CEI 11-27 · DM 37/2008',
    estratto_norma:
      'Art. 80: Il datore di lavoro prende le misure necessarie affinche\' i lavoratori siano salvaguardati dai tutti i rischi di natura elettrica connessi all\'impiego dei materiali, delle apparecchiature e degli impianti elettrici messi a loro disposizione, ed in particolare quelli derivanti da: a) contatti elettrici diretti; b) contatti elettrici indiretti; c) innesco e propagazione di incendi e di ustioni dovuti a sovratemperature pericolose, archi elettrici e radiazioni.',
  },
  chimico: {
    id: 'chimico',
    descrizione_rischio:
      'Esposizione ad agenti chimici pericolosi (solventi, vernici, oli, detergenti industriali) per inalazione, contatto cutaneo, ingestione accidentale.',
    effetti_salute: 'Intossicazione acuta, dermatiti irritative/allergiche, neuropatie, epatopatie, cancerogenicita\' per agenti CMR.',
    misure_eliminazione: ['Eliminazione uso agenti CMR (categoria 1A/1B) ove tecnicamente possibile'],
    misure_sostituzione: [
      'Sostituzione con agenti meno pericolosi (acqua vs solventi)',
      'Sistemi a circuito chiuso per evitare emissioni',
    ],
    misure_collettive: [
      'Cappe aspiranti localizzate alle sorgenti (LEV)',
      'Ventilazione generale ambienti',
      'Doccia di emergenza e lavaocchi',
      'Stoccaggio in armadi ventilati con vasca di contenimento',
    ],
    dpi: [
      { tipo: 'Guanti resistenti agli agenti chimici', norma_en: 'EN 374' },
      { tipo: 'Maschera con filtri ABEK / ABEKP3', norma_en: 'EN 14387' },
      { tipo: 'Tuta protezione chimica tipo 3/4', norma_en: 'EN 14605 / EN 13034' },
      { tipo: 'Occhiali a tenuta', norma_en: 'EN 166' },
    ],
    formazione:
      'Informazione e formazione specifica art. 227 D.Lgs. 81/08 su pericoli, etichettatura CLP, schede di sicurezza (SDS), procedure di emergenza.',
    sorveglianza_sanitaria:
      'Visita medica preventiva e periodica con esami biologici specifici (es. piombemia, fenoli urinari) in base agli agenti utilizzati. Frequenza in base al rischio.',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo IX Capo I (art. 221-232) · Reg. CE 1907/2006 (REACH) · Reg. CE 1272/2008 (CLP) · MoVaRisCh / AlPiRisCh',
    estratto_norma:
      'Art. 223: Valutazione dei rischi: il datore di lavoro determina, preliminarmente, l\'eventuale presenza di agenti chimici pericolosi sul luogo di lavoro e valuta anche i rischi per la sicurezza e la salute dei lavoratori derivanti dalla presenza di tali agenti, prendendo in considerazione in particolare: a) le loro proprieta\' pericolose; b) le informazioni sulla salute e sicurezza comunicate dal responsabile dell\'immissione sul mercato; c) il livello, il tipo e la durata dell\'esposizione.',
  },
  incendio: {
    id: 'incendio',
    descrizione_rischio:
      'Innesco e propagazione di incendio nei luoghi di lavoro per presenza materiali combustibili, sorgenti di ignizione, impianti elettrici difettosi.',
    effetti_salute: 'Ustioni, intossicazione da fumi (CO, HCN), asfissia, decesso.',
    misure_eliminazione: ['Eliminazione sorgenti di ignizione in zone con materiali combustibili'],
    misure_sostituzione: ['Sostituzione materiali combustibili con incombustibili o autoestinguenti'],
    misure_collettive: [
      'Compartimentazione antincendio (REI 60/120)',
      'Vie di esodo e uscite di emergenza dimensionate',
      'Sistemi di rivelazione fumi (UNI 9795)',
      'Estintori portatili (UNI 9994-1) e idranti UNI 45/UNI 70',
      'Illuminazione di sicurezza (UNI EN 1838)',
      'Impianti spegnimento automatico (sprinkler, gas inerti)',
    ],
    dpi: [
      { tipo: 'Maschera autorespiratore', norma_en: 'EN 137' },
      { tipo: 'Indumenti antincendio', norma_en: 'EN ISO 11612' },
      { tipo: 'Casco da pompiere', norma_en: 'EN 443' },
    ],
    formazione:
      'Formazione addetti antincendio livello 1/2/3 secondo rischio attivita\' (DM 02/09/2021). Esercitazione pratica annuale con prove di evacuazione.',
    sorveglianza_sanitaria: 'Idoneita\' specifica per addetti antincendio (visus, capacita\' cardiorespiratoria, equilibrio).',
    riferimento_normativo: 'DM 03/09/2021 (Codice prevenzione incendi luoghi di lavoro) · DM 02/09/2021 (formazione addetti) · D.Lgs. 81/08 art. 46',
    estratto_norma:
      'DM 03/09/2021 art. 1: Il presente decreto disciplina i criteri per la gestione della sicurezza antincendio nei luoghi di lavoro ai sensi dell\'articolo 46, comma 3, lettera a-bis) e a-ter) del decreto legislativo 9 aprile 2008, n. 81. La gestione della sicurezza antincendio si articola in: a) progettazione antincendio; b) misure organizzative e gestionali; c) misure di esercizio; d) controllo e manutenzione.',
  },
  vibrazioni: {
    id: 'vibrazioni',
    descrizione_rischio:
      'Esposizione a vibrazioni meccaniche trasmesse mano-braccio (HAV) da utensili portatili o corpo intero (WBV) da mezzi di trasporto/macchine.',
    effetti_salute: 'Sindrome di Raynaud (HAV), lombosciatalgia (WBV), neuropatie periferiche, alterazioni circolatorie.',
    misure_eliminazione: ['Eliminazione utensili vibranti tramite automazione/robotica'],
    misure_sostituzione: ['Sostituzione utensili pneumatici con elettrici a bassa vibrazione', 'Sedili antivibranti su mezzi'],
    misure_collettive: [
      'Manutenzione periodica utensili (riduce vibrazione)',
      'Limitazione tempi esposizione (rotazione mansioni)',
      'Riduzione velocita\' utensili',
    ],
    dpi: [
      { tipo: 'Guanti antivibrazione', norma_en: 'EN ISO 10819' },
      { tipo: 'Cuscini antivibrazione per sedili', norma_en: 'ISO 10326' },
    ],
    formazione: 'Informazione e formazione specifica sull\'uso corretto utensili vibranti, riconoscimento sintomi precoci, importanza pause.',
    sorveglianza_sanitaria:
      'Obbligatoria per A(8) ≥ 2.5 m/s² (HAV) o A(8) ≥ 0.5 m/s² (WBV) ai sensi dell\'art. 204 D.Lgs. 81/08. Esami specifici: capillaroscopia, EMG arti superiori, RX lombare.',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo VIII Capo III (art. 199-205) · UNI EN ISO 5349 (HAV) · UNI EN ISO 2631 (WBV)',
    estratto_norma:
      'Art. 201: Valori limite di esposizione e valori di azione: per le vibrazioni mano-braccio: a) valore limite di esposizione su 8 ore: 5 m/s²; b) valore d\'azione su 8 ore: 2.5 m/s². Per le vibrazioni corpo intero: a) valore limite: 1.0 m/s²; b) valore d\'azione: 0.5 m/s².',
  },
  vdt: {
    id: 'vdt',
    descrizione_rischio:
      'Esposizione prolungata a videoterminali (≥ 20 ore settimanali continuative) in uffici, sale operative, attivita\' impiegatizie.',
    effetti_salute: 'Astenopia, cefalea, dolori cervicali e dorso-lombari, sindrome del tunnel carpale.',
    misure_eliminazione: [],
    misure_sostituzione: ['Postazioni regolabili in altezza (sit-stand desk)'],
    misure_collettive: [
      'Pause obbligatorie 15 min ogni 2 ore continuative (art. 175 D.Lgs. 81/08)',
      'Illuminazione 300-500 lux senza riflessi',
      'Schermo a distanza 50-70 cm dagli occhi',
      'Sedile ergonomico con regolazione lombare',
    ],
    dpi: [{ tipo: 'Lenti a graduazione specifica per VDT', norma_en: 'fornite a carico datore se prescritte da MC' }],
    formazione: 'Informazione su rischi VDT, ergonomia postura, esercizi di rilassamento muscolare e visivo.',
    sorveglianza_sanitaria:
      'Visita medica preventiva con visus + visita oculistica. Periodicita\' biennale (sotto 50 anni) o annuale (≥ 50 anni o classificazione idoneita\' con prescrizioni).',
    riferimento_normativo: 'D.Lgs. 81/08 Titolo VII (art. 172-179, Allegato XXXIV) · DM 02/10/2000',
    estratto_norma:
      'Art. 173: Definizioni: lavoratore VDT, colui che utilizza un\'attrezzatura munita di videoterminali, in modo sistematico o abituale, per venti ore settimanali, dedotte le interruzioni di cui all\'articolo 175. Pausa, l\'interruzione dell\'attivita\' lavorativa al VDT.',
  },
  stress: {
    id: 'stress',
    descrizione_rischio:
      'Stress lavoro-correlato derivante da carico di lavoro eccessivo, mancanza di controllo, scarso supporto sociale, conflitti, ambiguita\' di ruolo.',
    effetti_salute: 'Burnout, depressione, ansia, disturbi cardiovascolari, alterazioni gastrointestinali, abuso sostanze.',
    misure_eliminazione: ['Eliminazione cause organizzative dello stress (turni eccessivi, sotto-organico)'],
    misure_sostituzione: ['Job rotation per ridurre monotonia', 'Smartworking per autonomia'],
    misure_collettive: [
      'Flessibilita\' oraria',
      'Gruppi di supporto / sportello psicologico aziendale',
      'Comunicazione organizzativa chiara (deleghe, procedure)',
      'Formazione middle management su gestione team',
    ],
    dpi: [],
    formazione: 'Informazione e formazione su gestione stress, riconoscimento sintomi, risorse aziendali disponibili. Formazione preposti su gestione conflitti.',
    sorveglianza_sanitaria: 'Sorveglianza non obbligatoria per stress L-C ma raccomandata in presenza di rischio medio/alto. Colloqui psicologici se richiesti.',
    riferimento_normativo: 'D.Lgs. 81/08 art. 28 c.1-bis · INAIL "La metodologia per la valutazione e gestione del rischio stress lavoro-correlato" 2017 · Accordo Europeo 8 ottobre 2004',
    estratto_norma:
      'Art. 28 c.1-bis: La valutazione (...) deve riguardare anche i rischi collegati allo stress lavoro-correlato, secondo i contenuti dell\'accordo europeo dell\'8 ottobre 2004. Le metodologie INAIL prevedono valutazione preliminare in 2 fasi: indicatori oggettivi (eventi sentinella, contesto e contenuto del lavoro) e valutazione approfondita con questionari ai lavoratori (HSE Indicator Tool).',
  },
};

// Norme tecniche citate negli allegati DVR
export const ALLEGATO_NORMATIVO = [
  { norma: 'D.Lgs. 9 aprile 2008, n. 81', titolo: 'Testo Unico Sicurezza sul Lavoro' },
  { norma: 'D.Lgs. 106/2009', titolo: 'Disposizioni integrative e correttive del D.Lgs. 81/08' },
  { norma: 'DM 03/09/2021', titolo: 'Criteri generali di progettazione, realizzazione ed esercizio della sicurezza antincendio nei luoghi di lavoro' },
  { norma: 'DM 02/09/2021', titolo: 'Criteri per la gestione dei luoghi di lavoro in esercizio ed emergenza e caratteristiche dello specifico servizio di prevenzione e protezione antincendio' },
  { norma: 'Accordo Stato-Regioni 21/12/2011', titolo: 'Formazione lavoratori, preposti, dirigenti, datori di lavoro RSPP' },
  { norma: 'D.Lgs. 151/2001', titolo: 'Tutela e sostegno della maternita\' e della paternita\'' },
  { norma: 'D.Lgs. 345/1999', titolo: 'Protezione dei giovani sul lavoro' },
  { norma: 'D.Lgs. 101/2020', titolo: 'Attuazione direttiva 2013/59/Euratom radiazioni ionizzanti' },
  { norma: 'UNI EN ISO 9612:2011', titolo: 'Determinazione dell\'esposizione al rumore negli ambienti di lavoro' },
  { norma: 'UNI EN ISO 5349:2004', titolo: 'Misurazione e valutazione delle vibrazioni mano-braccio' },
  { norma: 'UNI EN ISO 2631:2008', titolo: 'Vibrazioni trasmesse al corpo intero' },
  { norma: 'UNI ISO 11228 parti 1-2-3', titolo: 'Movimentazione manuale dei carichi (sollevamento, spinta/traino, movimentazioni ripetute)' },
  { norma: 'CEI 64-8', titolo: 'Impianti elettrici utilizzatori a tensione nominale ≤ 1000 V' },
  { norma: 'CEI 11-27', titolo: 'Lavori su impianti elettrici (PES/PAV/PEI)' },
];

// Schema corsi formazione richiesti per mansione (Accordo Stato-Regioni 21/12/2011)
export const SCHEMA_FORMAZIONE = [
  { corso: 'Formazione generale', durata: '4 ore', destinatari: 'Tutti i lavoratori', aggiornamento: '5 anni · 6 ore' },
  { corso: 'Formazione specifica rischio basso', durata: '4 ore', destinatari: 'Lavoratori in attivita\' classificate basso rischio (es. uffici)', aggiornamento: '5 anni · 6 ore' },
  { corso: 'Formazione specifica rischio medio', durata: '8 ore', destinatari: 'Lavoratori in attivita\' classificate medio rischio', aggiornamento: '5 anni · 6 ore' },
  { corso: 'Formazione specifica rischio alto', durata: '12 ore', destinatari: 'Lavoratori in attivita\' classificate alto rischio (es. costruzioni, metalmeccanica)', aggiornamento: '5 anni · 6 ore' },
  { corso: 'Preposti', durata: '8 ore', destinatari: 'Lavoratori con funzione di preposto', aggiornamento: '2 anni · 6 ore' },
  { corso: 'Dirigenti', durata: '16 ore', destinatari: 'Dirigenti con funzioni delegate art. 16', aggiornamento: '5 anni · 6 ore' },
  { corso: 'Antincendio livello 1 (rischio basso)', durata: '4 ore', destinatari: 'Addetti antincendio basso rischio', aggiornamento: '5 anni · 2 ore' },
  { corso: 'Antincendio livello 2 (rischio medio)', durata: '8 ore', destinatari: 'Addetti antincendio medio rischio', aggiornamento: '5 anni · 5 ore' },
  { corso: 'Antincendio livello 3 (rischio alto)', durata: '16 ore', destinatari: 'Addetti antincendio alto rischio', aggiornamento: '5 anni · 8 ore' },
  { corso: 'Primo soccorso gruppo A', durata: '16 ore', destinatari: 'Addetti primo soccorso aziende gruppo A (alto rischio)', aggiornamento: '3 anni · 6 ore' },
  { corso: 'Primo soccorso gruppi B/C', durata: '12 ore', destinatari: 'Addetti primo soccorso aziende gruppi B/C', aggiornamento: '3 anni · 4 ore' },
  { corso: 'RLS · formazione iniziale', durata: '32 ore', destinatari: 'Rappresentanti dei Lavoratori per la Sicurezza', aggiornamento: '1 anno · 4-8 ore' },
  { corso: 'RSPP modulo A', durata: '28 ore', destinatari: 'Aspiranti RSPP/ASPP (modulo base)', aggiornamento: 'una tantum' },
  { corso: 'RSPP modulo B', durata: '24-48 ore (per ATECO)', destinatari: 'Aspiranti RSPP/ASPP (modulo specialistico)', aggiornamento: '5 anni · 20-40 ore' },
  { corso: 'RSPP modulo C', durata: '24 ore', destinatari: 'Aspiranti RSPP (modulo direzionale)', aggiornamento: 'incluso in modulo B' },
];
