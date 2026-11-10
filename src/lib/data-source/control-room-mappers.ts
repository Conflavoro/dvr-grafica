// Normalizzazione difensiva delle risposte della Safety Control Room.
//
// Come per l'agente, ogni mapper accetta `unknown` e ritorna un oggetto sempre
// completo: un campo mancante o di tipo inatteso non rompe mai la schermata.
// I link (passaporto pubblico, PDF del report) passano solo se http(s).

import type {
  AssistenzaEsito,
  ControlRoomPanoramica,
  CrArea,
  CrAreaChiave,
  CrContatori,
  CrConformita,
  CrControllo,
  CrCriticita,
  CrEsito,
  CrLivello,
  CrPriorita,
  CrReferente,
  CrScadenzaPriorita,
  CrTendenza,
  CrVoceScadenza,
  FascicoloAzienda,
  FascicoloCategoriaStato,
  FascicoloEssenziale,
  FascicoloVoce,
  Ispezione,
  IspezioneEsito,
  Pannello,
  PassaportoAccesso,
  PassaportoConsultazione,
  PassaportoCreato,
  PassaportoPubblicoDocumento,
  PassaportoPubblicoInfo,
  PassaportoStato,
  PassaportoVista,
  ProntoControllo,
  ProntoControlloVoce,
  ReportDati,
  ReportMensile,
  SafetyScoreCompleto,
  ScadenzarioAzienda,
} from './types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const rec = (v: unknown): Rec => (isRec(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, riserva = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : riserva);
const strN = (v: unknown): string | null => {
  const s = str(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const int0 = (v: unknown): number => Math.max(0, Math.round(num(v) ?? 0));
const intPos = (v: unknown): number | null => {
  const n = num(v);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
};
const punteggio = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.max(0, Math.min(100, Math.round(n)));
};
const stringhe = (v: unknown): string[] => lista(v).map((x) => str(x).trim()).filter(Boolean);

/** Solo URL assoluti http(s). */
export function linkSicuro(v: unknown): string | null {
  const s = str(v).trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const ESITI: CrEsito[] = ['conforme', 'in_scadenza', 'da_verificare', 'non_conforme', 'non_applicabile'];
const LIVELLI: CrLivello[] = ['buono', 'discreto', 'critico', 'grave', 'nd'];
export const AREE: Array<{ chiave: CrAreaChiave; nome: string }> = [
  { chiave: 'sicurezza', nome: 'Sicurezza' },
  { chiave: 'formazione', nome: 'Formazione' },
  { chiave: 'sorveglianza', nome: 'Sorveglianza sanitaria' },
  { chiave: 'documenti', nome: 'Documenti' },
];

export const esito = (v: unknown): CrEsito => (ESITI.includes(v as CrEsito) ? (v as CrEsito) : 'da_verificare');
export const livello = (v: unknown): CrLivello => (LIVELLI.includes(v as CrLivello) ? (v as CrLivello) : 'nd');
const priorita = (v: unknown): CrPriorita => (v === 'alta' || v === 'bassa' ? v : 'media');
const prioritaScad = (v: unknown): CrScadenzaPriorita => (v === 'bassa' || v === 'alta' || v === 'critica' ? v : 'media');

/** Livello dal punteggio, con le stesse soglie del backend. */
export function livelloDa(totale: number | null): CrLivello {
  if (totale == null) return 'nd';
  if (totale >= 85) return 'buono';
  if (totale >= 65) return 'discreto';
  if (totale >= 40) return 'critico';
  return 'grave';
}

function mapControllo(raw: unknown): CrControllo | null {
  if (!isRec(raw)) return null;
  const chiave = str(raw.chiave);
  if (!chiave) return null;
  const credito = num(raw.credito);
  return {
    chiave,
    titolo: str(raw.titolo) || chiave,
    peso: num(raw.peso) ?? 0,
    esito: esito(raw.esito),
    priorita: priorita(raw.priorita),
    messaggio: str(raw.messaggio),
    azione: str(raw.azione),
    riferimento: str(raw.riferimento),
    credito: credito == null ? null : Math.max(0, Math.min(1, credito)),
  };
}

/** Aree dall'oggetto { sicurezza: {...}, ... } (o da un elenco), sempre nelle 4 chiavi e in ordine. */
export function mapAree(raw: unknown): CrArea[] {
  const perChiave: Rec = {};
  if (Array.isArray(raw)) {
    for (const a of raw) if (isRec(a) && typeof a.chiave === 'string') perChiave[a.chiave] = a;
  } else if (isRec(raw)) {
    Object.assign(perChiave, raw);
  }
  return AREE.map(({ chiave, nome }) => {
    const v = perChiave[chiave];
    // Il report espone le aree come numeri semplici.
    if (typeof v === 'number' || v === null) {
      return { chiave, nome, punteggio: punteggio(v), stato: v === null ? 'non_applicabile' : 'applicabile', controlli: [] } as CrArea;
    }
    const a = rec(v);
    const p = punteggio(a.punteggio);
    const stato = a.stato === 'non_applicabile' || (a.stato == null && p == null) ? 'non_applicabile' : 'applicabile';
    return {
      chiave,
      nome: str(a.nome) || nome,
      punteggio: p,
      stato,
      controlli: lista(a.controlli).map(mapControllo).filter((c): c is CrControllo => c !== null),
    };
  });
}

const ORDINE_PRIORITA: Record<CrPriorita, number> = { alta: 0, media: 1, bassa: 2 };

export function mapCriticita(raw: unknown): CrCriticita[] {
  return lista(raw)
    .filter(isRec)
    .map((c) => ({
      area: str(c.area),
      chiave: str(c.chiave) || str(c.titolo),
      titolo: str(c.titolo).trim(),
      esito: esito(c.esito ?? 'non_conforme'),
      priorita: priorita(c.priorita),
      peso: num(c.peso) ?? 0,
      messaggio: str(c.messaggio).trim(),
      azione: str(c.azione).trim(),
      riferimento: str(c.riferimento).trim(),
    }))
    .filter((c) => c.titolo !== '' || c.messaggio !== '')
    .sort((a, b) => ORDINE_PRIORITA[a.priorita] - ORDINE_PRIORITA[b.priorita]);
}

export function mapConformita(raw: unknown): CrConformita {
  const c = rec(raw);
  return {
    conformi: int0(c.conformi),
    in_scadenza: int0(c.in_scadenza),
    non_conformi: int0(c.non_conformi),
    da_verificare: int0(c.da_verificare),
    non_applicabili: int0(c.non_applicabili),
  };
}

export function mapTendenza(raw: unknown): CrTendenza {
  const t = rec(raw);
  const d = t.direzione;
  return {
    mese: strN(t.mese),
    mese_precedente: strN(t.mese_precedente),
    totale_precedente: punteggio(t.totale_precedente),
    delta: num(t.delta),
    direzione: d === 'su' || d === 'giu' || d === 'stabile' ? d : 'nd',
  };
}

export function mapContatori(raw: unknown): CrContatori {
  const c = rec(raw);
  return {
    entro_30: int0(c.entro_30),
    scadute: int0(c.scadute),
    visite_da_pianificare: int0(c.visite_da_pianificare),
    corsi_in_scadenza: int0(c.corsi_in_scadenza),
    alert_aperti: int0(c.alert_aperti),
  };
}

export function mapVoceScadenza(raw: unknown): CrVoceScadenza | null {
  if (!isRec(raw)) return null;
  const titolo = str(raw.titolo).trim() || str(raw.descrizione).trim();
  if (!titolo) return null;
  const giorni = num(raw.giorni);
  const s = raw.stato;
  return {
    chiave: str(raw.chiave) || `${str(raw.fonte)}:${str(raw.id)}:${titolo}`,
    fonte: str(raw.fonte),
    id: intPos(raw.id),
    data: strN(raw.data),
    giorni: giorni == null ? null : Math.round(giorni),
    stato: s === 'scaduta' || s === 'in_scadenza' ? s : giorni != null && giorni < 0 ? 'scaduta' : 'programmata',
    azienda_id: intPos(raw.azienda_id),
    azienda: strN(raw.azienda),
    titolo,
    descrizione: str(raw.descrizione).trim(),
    categoria: str(raw.categoria) || 'altro',
    priorita: prioritaScad(raw.priorita),
  };
}

const voci = (raw: unknown): CrVoceScadenza[] =>
  lista(raw)
    .map(mapVoceScadenza)
    .filter((v): v is CrVoceScadenza => v !== null)
    .sort((a, b) => String(a.data ?? '9999').localeCompare(String(b.data ?? '9999')));

export function mapControlRoom(raw: unknown): ControlRoomPanoramica {
  const d = rec(raw);
  const totale = punteggio(d.totale);
  const criticita = mapCriticita(d.criticita);
  const sc = rec(d.scadenze);
  return {
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    calcolato_il: strN(d.calcolato_il),
    totale,
    livello: d.livello != null ? livello(d.livello) : livelloDa(totale),
    aree: mapAree(d.aree),
    criticita,
    criticita_totali: Math.max(int0(d.criticita_totali), criticita.length),
    conformita: mapConformita(d.conformita),
    tendenza: mapTendenza(d.tendenza),
    scadenze: { contatori: mapContatori(sc.contatori), prossime: voci(sc.prossime) },
  };
}

export function mapSafetyScore(raw: unknown): SafetyScoreCompleto {
  const d = rec(raw);
  const base = mapControlRoom(raw);
  return {
    azienda_id: base.azienda_id,
    ragione_sociale: base.ragione_sociale,
    calcolato_il: base.calcolato_il,
    totale: base.totale,
    livello: base.livello,
    aree: base.aree,
    criticita: base.criticita,
    conformita: base.conformita,
    tendenza: base.tendenza,
    lavoratori_considerati: num(d.lavoratori_considerati),
    formula: strN(d.formula),
  };
}

export function mapScadenzario(raw: unknown): ScadenzarioAzienda {
  const d = rec(raw);
  return {
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    periodo: strN(d.periodo),
    priorita_minima: strN(d.priorita_minima),
    contatori: mapContatori(d.contatori),
    voci: voci(d.voci),
  };
}

export function mapFascicoloVoce(raw: unknown): FascicoloVoce | null {
  if (!isRec(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const virtuale = raw.virtuale === true || !/^\d+$/.test(id);
  const dvr = intPos(raw.dvr_id) ?? (id.startsWith('dvr:') ? intPos(id.slice(4)) : null);
  const pos = intPos(raw.pos_id) ?? (id.startsWith('pos:') ? intPos(id.slice(4)) : null);
  return {
    id,
    documento_id: virtuale ? null : intPos(id),
    virtuale,
    tipo: str(raw.tipo) || (dvr ? 'dvr' : pos ? 'pos' : 'documento'),
    dvr_id: dvr,
    pos_id: pos,
    titolo: str(raw.titolo).trim() || 'Documento senza titolo',
    categoria: str(raw.categoria) || 'altro',
    categoria_manuale: raw.categoria_manuale === true,
    versione: strN(raw.versione),
    stato_documento: strN(raw.stato_documento),
    data: strN(raw.data),
    scadenza: strN(raw.scadenza),
    essenziale: raw.essenziale === true,
    esito: raw.esito == null ? null : esito(raw.esito),
    ha_file: raw.ha_file !== false,
    stato_piattaforma: strN(raw.stato_piattaforma),
  };
}

const vociFascicolo = (raw: unknown): FascicoloVoce[] => lista(raw).map(mapFascicoloVoce).filter((v): v is FascicoloVoce => v !== null);

function mapCategoria(raw: unknown): FascicoloCategoriaStato | null {
  if (!isRec(raw)) return null;
  const chiave = str(raw.chiave);
  if (!chiave) return null;
  const s = raw.stato;
  return {
    chiave,
    nome: str(raw.nome) || chiave,
    documenti: int0(raw.documenti),
    stato: s === 'aggiornato' || s === 'in_revisione' || s === 'da_aggiornare' ? s : 'vuota',
  };
}

export function mapFascicolo(raw: unknown): FascicoloAzienda {
  const d = rec(raw);
  return {
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    totale: int0(d.totale),
    cerca: strN(d.cerca),
    categoria: strN(d.categoria),
    categorie: lista(d.categorie).map(mapCategoria).filter((c): c is FascicoloCategoriaStato => c !== null),
    recenti: vociFascicolo(d.recenti),
    essenziali: lista(d.essenziali)
      .filter(isRec)
      .map(
        (e): FascicoloEssenziale => ({
          chiave: str(e.chiave),
          voce: str(e.voce).trim() || str(e.chiave),
          riferimento: str(e.riferimento),
          sezione: strN(e.sezione),
          esito: esito(e.esito),
          messaggio: str(e.messaggio),
          documenti: vociFascicolo(e.documenti),
        })
      )
      .filter((e) => e.chiave !== '' && e.esito !== 'non_applicabile'),
  };
}

function mapReportDati(raw: unknown): ReportDati {
  const d = rec(raw);
  const att: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(d.attivita))) {
    const n = num(v);
    if (n != null) att[k] = n;
  }
  const ss = isRec(d.safety_score) ? d.safety_score : null;
  const pms = rec(d.priorita_mese_successivo);
  return {
    periodo: { dal: strN(rec(d.periodo).dal), al: strN(rec(d.periodo).al) },
    attivita: att,
    visite_svolte: int0(d.visite_svolte),
    corsi_erogati: lista(d.corsi_erogati)
      .filter(isRec)
      .map((c) => ({ corso: str(c.corso).trim(), attestati: int0(c.attestati) }))
      .filter((c) => c.corso !== ''),
    ispezioni: lista(d.ispezioni)
      .filter(isRec)
      .map((i) => ({ data: strN(i.data), ente: str(i.ente) || 'altro', tipo: strN(i.tipo), esito: strN(i.esito) })),
    safety_score: ss
      ? {
          totale: punteggio(ss.totale),
          livello: ss.livello != null ? livello(ss.livello) : livelloDa(punteggio(ss.totale)),
          aree: Object.fromEntries(AREE.map(({ chiave }) => [chiave, punteggio(rec(ss.aree)[chiave])])),
          al: strN(ss.al),
        }
      : null,
    criticita_aperte: mapCriticitaReport(d.criticita_aperte),
    andamento: mapAndamento(d.andamento),
    priorita_mese_successivo: {
      mese: strN(pms.mese),
      scadenze: lista(pms.scadenze)
        .filter(isRec)
        .map((s) => ({ data: strN(s.data), titolo: str(s.titolo).trim(), categoria: str(s.categoria) || 'altro', priorita: str(s.priorita) || 'media', scaduta: s.scaduta === true }))
        .filter((s) => s.titolo !== ''),
      criticita: stringhe(pms.criticita),
    },
  };
}

function mapCriticitaReport(raw: unknown): ReportDati['criticita_aperte'] {
  return lista(raw)
    .filter(isRec)
    .map((c) => ({
      area: str(c.area),
      priorita: str(c.priorita) || 'media',
      titolo: str(c.titolo).trim(),
      messaggio: str(c.messaggio).trim(),
      azione: str(c.azione).trim(),
      riferimento: str(c.riferimento).trim(),
    }))
    .filter((c) => c.titolo !== '' || c.messaggio !== '');
}

function mapAndamento(raw: unknown): ReportDati['andamento'] {
  return lista(raw)
    .filter(isRec)
    .map((a) => ({ mese: str(a.mese), totale: punteggio(a.totale) }))
    .filter((a) => /^\d{4}-\d{2}$/.test(a.mese))
    .slice(-6);
}

export function mapReport(raw: unknown): ReportMensile {
  const d = rec(raw);
  return {
    report_id: intPos(d.report_id),
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    mese: str(d.mese),
    osservazioni: strN(d.osservazioni),
    osservazioni_ai: d.osservazioni_ai === true,
    osservazioni_il: strN(d.osservazioni_il),
    pdf_disponibile: d.pdf_disponibile === true,
    aggiornato_il: strN(d.aggiornato_il),
    dati: mapReportDati(d.dati),
  };
}

export function mapPassaportoVista(raw: unknown): PassaportoVista | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  return {
    id,
    azienda_id: intPos(raw.azienda_id) ?? 0,
    attivo: raw.attivo === true,
    valido: raw.valido === true,
    scade_il: strN(raw.scade_il),
    sezioni: stringhe(raw.sezioni),
    creato_il: strN(raw.creato_il),
    revocato_il: strN(raw.revocato_il),
    qr_disponibile: raw.qr_disponibile === true,
    accessi_totali: int0(raw.accessi_totali),
    ultimo_accesso: strN(raw.ultimo_accesso),
  };
}

export function mapAccessi(raw: unknown): PassaportoAccesso[] {
  return lista(raw)
    .filter(isRec)
    .map((a) => ({ quando: strN(a.quando), ente: strN(a.ente), nome: strN(a.nome), esito: str(a.esito) || 'ok', aperto: strN(a.aperto) }));
}

export function mapPassaportoStato(raw: unknown): PassaportoStato {
  const d = rec(raw);
  return {
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    attivo: mapPassaportoVista(d.attivo),
    storico: lista(d.storico).map(mapPassaportoVista).filter((p): p is PassaportoVista => p !== null),
    accessi: mapAccessi(d.accessi),
    nota: strN(d.nota),
  };
}

export function mapPassaportoCreato(raw: unknown): PassaportoCreato {
  const d = rec(raw);
  const passaporto = mapPassaportoVista(d.passaporto);
  const token = str(d.token);
  const pin = str(d.pin);
  if (!passaporto || !token || !pin) throw new Error('Risposta del server non valida.');
  return { passaporto, token, pin, link: linkSicuro(d.link) ?? '' };
}

const ESITI_ISP: IspezioneEsito[] = ['nessuna_criticita', 'note_informative', 'prescrizioni', 'sanzione'];

export function mapIspezione(raw: unknown): Ispezione | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  return {
    id,
    azienda_id: intPos(raw.azienda_id) ?? 0,
    ente: str(raw.ente) || 'altro',
    data: strN(raw.data),
    tipo: strN(raw.tipo),
    esito: ESITI_ISP.includes(raw.esito as IspezioneEsito) ? (raw.esito as IspezioneEsito) : null,
    note: strN(raw.note),
    prescrizioni: lista(raw.prescrizioni)
      .filter(isRec)
      .map((p) => ({ descrizione: str(p.descrizione).trim(), termine: strN(p.termine), scadenza_id: intPos(p.scadenza_id) }))
      .filter((p) => p.descrizione !== ''),
    creato_il: strN(raw.creato_il),
  };
}

export const mapIspezioni = (raw: unknown): Ispezione[] => lista(raw).map(mapIspezione).filter((i): i is Ispezione => i !== null);

export function mapReferente(raw: unknown): CrReferente | null {
  if (!isRec(raw)) return null;
  const nome = str(raw.nome).trim();
  if (!nome) return null;
  return { nome, email: strN(raw.email), ruolo: strN(raw.ruolo) };
}

export function mapPronto(raw: unknown): ProntoControllo {
  const d = rec(raw);
  const mostra = lista(d.mostra_subito)
    .filter(isRec)
    .map(
      (v): ProntoControlloVoce => ({
        chiave: str(v.chiave) || str(v.voce),
        voce: str(v.voce).trim(),
        esito: esito(v.esito),
        messaggio: str(v.messaggio),
        riferimento: str(v.riferimento),
        documenti: lista(v.documenti)
          .filter(isRec)
          .map((x) => ({ id: str(x.id), titolo: str(x.titolo).trim() || 'Documento', virtuale: x.virtuale === true, tipo: str(x.tipo) || 'documento', ha_file: x.ha_file !== false }))
          .filter((x) => x.id !== ''),
      })
    )
    .filter((v) => v.voce !== '' && v.esito !== 'non_applicabile');
  return {
    azienda_id: intPos(d.azienda_id) ?? 0,
    ragione_sociale: str(d.ragione_sociale),
    mostra_subito: mostra,
    pronti: num(d.pronti) != null ? int0(d.pronti) : mostra.filter((v) => v.esito === 'conforme').length,
    totale: num(d.totale) != null ? int0(d.totale) : mostra.length,
    referente: mapReferente(d.referente),
    passaporto_attivo: d.passaporto_attivo === true,
    ultime_ispezioni: mapIspezioni(d.ultime_ispezioni),
    consigli: stringhe(d.consigli),
  };
}

export function mapAssistenza(raw: unknown): AssistenzaEsito {
  const d = rec(raw);
  return {
    richiesta_id: intPos(d.richiesta_id),
    azienda_id: intPos(d.azienda_id) ?? 0,
    avvisati: int0(d.avvisati),
    email: int0(d.email),
    canali: int0(d.canali),
    referente: mapReferente(d.referente),
    nota: strN(d.nota),
  };
}

export function mapPassaportoInfo(raw: unknown): PassaportoPubblicoInfo {
  const d = rec(raw);
  const enti = stringhe(d.enti);
  return {
    richiede: stringhe(d.richiede).length ? stringhe(d.richiede) : ['pin', 'ente', 'nome'],
    enti: enti.length ? enti : ['ASL', 'INL', 'VVF', 'NAS', 'ARPA', 'consulente', 'altro'],
    informativa: str(d.informativa).trim(),
  };
}

function mapDocPubblico(raw: unknown): PassaportoPubblicoDocumento | null {
  if (!isRec(raw)) return null;
  const titolo = str(raw.titolo).trim();
  if (!titolo) return null;
  return { titolo, data: strN(raw.data), versione: strN(raw.versione), stato: strN(raw.stato), link: linkSicuro(raw.link) };
}
const docsPubblici = (raw: unknown) => lista(raw).map(mapDocPubblico).filter((x): x is PassaportoPubblicoDocumento => x !== null);

const RUOLI_PUBBLICI: Array<[string, string]> = [
  ['datore_lavoro', 'Datore di lavoro'],
  ['rspp', 'RSPP'],
  ['medico_competente', 'Medico competente'],
  ['rappresentante', 'Rappresentante dei lavoratori'],
  ['preposti', 'Preposti'],
  ['addetti_antincendio', 'Addetti antincendio'],
  ['addetti_primo_soccorso', 'Addetti primo soccorso'],
];

export function mapConsultazione(raw: unknown): PassaportoConsultazione {
  const d = rec(raw);
  const az = rec(d.azienda);
  const org = rec(d.organigramma);
  return {
    azienda: { ragione_sociale: str(az.ragione_sociale).trim() || 'Azienda', ateco: strN(az.ateco), lavoratori: num(az.lavoratori), sede: strN(az.sede) },
    consultato_il: strN(d.consultato_il),
    link_validi_minuti: num(d.link_validi_minuti),
    avviso: str(d.avviso).trim() || 'Accesso registrato.',
    organigramma: RUOLI_PUBBLICI.map(([k, ruolo]) => ({ ruolo, nomi: Array.isArray(org[k]) ? stringhe(org[k]) : strN(org[k]) ? [str(org[k]).trim()] : [] })).filter(
      (r) => r.nomi.length > 0
    ),
    documenti_essenziali: lista(d.documenti_essenziali)
      .filter(isRec)
      .map((e) => ({ voce: str(e.voce).trim(), esito: esito(e.esito), riferimento: str(e.riferimento), messaggio: str(e.messaggio), documenti: docsPubblici(e.documenti) }))
      .filter((e) => e.voce !== '' && e.esito !== 'non_applicabile'),
    altri_documenti: docsPubblici(d.altri_documenti),
    formazione: strN(d.formazione),
    sorveglianza: strN(d.sorveglianza),
  };
}

/** Pannelli della chat prodotti dagli strumenti della Control Room; null per gli altri tipi. */
export function mapPannelloControlRoom(raw: unknown): Pannello | null {
  if (!isRec(raw)) return null;
  const tipo = str(raw.tipo);
  const azienda_id = intPos(raw.azienda_id);
  const chiave = str(raw.chiave) || `${tipo}:${azienda_id ?? 0}`;
  if (azienda_id == null) return null;
  switch (tipo) {
    case 'safety_score': {
      const totale = punteggio(raw.totale);
      return {
        tipo,
        chiave,
        azienda_id,
        ragione_sociale: strN(raw.ragione_sociale),
        totale,
        livello: raw.livello != null ? livello(raw.livello) : livelloDa(totale),
        aree: mapAree(raw.aree),
        criticita: mapCriticita(raw.criticita),
        conformita: mapConformita(raw.conformita),
        tendenza: mapTendenza(raw.tendenza),
      };
    }
    case 'scadenzario':
      return { tipo, chiave, azienda_id, periodo: strN(raw.periodo), contatori: mapContatori(raw.contatori), voci: voci(raw.voci) };
    case 'fascicolo':
      return {
        tipo,
        chiave,
        azienda_id,
        categorie: lista(raw.categorie).map(mapCategoria).filter((c): c is FascicoloCategoriaStato => c !== null),
        documenti: vociFascicolo(raw.documenti),
        essenziali: lista(raw.essenziali)
          .filter(isRec)
          .map((e) => ({ chiave: str(e.chiave), voce: str(e.voce).trim(), esito: esito(e.esito), messaggio: str(e.messaggio) }))
          .filter((e) => e.voce !== '' && e.esito !== 'non_applicabile'),
        aggiornato: raw.aggiornato === true,
      };
    case 'report': {
      const dati = mapReportDati({ safety_score: raw.safety_score, attivita: raw.attivita, criticita_aperte: raw.criticita, andamento: raw.andamento });
      return {
        tipo,
        chiave,
        azienda_id,
        mese: strN(raw.mese),
        safety_score: dati.safety_score,
        attivita: dati.attivita,
        criticita: dati.criticita_aperte,
        andamento: dati.andamento,
        osservazioni: strN(raw.osservazioni),
        osservazioni_ai: raw.osservazioni_ai === true,
        link_pdf: linkSicuro(raw.link_pdf),
      };
    }
    case 'passaporto':
      return {
        tipo,
        chiave,
        azienda_id,
        attivo: mapPassaportoVista(raw.attivo),
        accessi: mapAccessi(raw.accessi),
        link_foglio_qr: linkSicuro(raw.link_foglio_qr),
        creato: raw.creato === true,
        pin_inviato_a: strN(raw.pin_inviato_a),
      };
    case 'ispezioni':
      return { tipo, chiave, azienda_id, ispezioni: mapIspezioni(raw.ispezioni), nuova: intPos(raw.nuova) };
    case 'pronto_controllo':
      return {
        tipo,
        chiave,
        azienda_id,
        mostra_subito: lista(raw.mostra_subito)
          .filter(isRec)
          .map((v) => ({ voce: str(v.voce).trim(), esito: esito(v.esito), documenti: int0(v.documenti) }))
          .filter((v) => v.voce !== '' && v.esito !== 'non_applicabile'),
        referente: mapReferente(raw.referente),
        consigli: stringhe(raw.consigli),
        richiesta: isRec(raw.richiesta) ? mapAssistenza(raw.richiesta) : null,
      };
    default:
      return null;
  }
}
