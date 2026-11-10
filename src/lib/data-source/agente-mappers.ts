// Normalizzazione difensiva delle risposte /agente/* del backend Laravel.
//
// Il frontend non deve mai rompersi per un campo mancante o di tipo inatteso:
// ogni mapper accetta `unknown`, scarta cio' che non riconosce e ritorna un
// oggetto sempre completo. Le azioni di download accettano solo URL http(s)
// (niente javascript: o data:), quelle di navigazione solo id numerici.

import type {
  AgenteAzione,
  AgenteConversazione,
  AgenteConversazioneDettaglio,
  AgenteMessaggio,
  AgentePasso,
  AgenteProfilo,
  AgenteEvento,
  AgentePianoVoce,
  AgenteProgresso,
  AgenteStrumento,
  Pannello,
  PannelloArchivioElemento,
  PannelloAziendaScheda,
  PannelloAziendaVoce,
  PannelloDvrVoce,
  PannelloIndiceVoce,
  PannelloRevisione,
  PannelloRischio,
  PannelloScadenza,
  PannelloNovita,
  PannelloSegnalazione,
  Cantiere,
  PosDocumento,
} from './types';
import { mapPannelloControlRoom } from './control-room-mappers';
import { mapPannelloModuli } from './moduli-mappers';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function mapPiano(raw: unknown): AgentePianoVoce[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRec)
    .map((v) => ({
      testo: str(v.testo).trim(),
      stato: (v.stato === 'fatto' || v.stato === 'in_corso' ? v.stato : 'da_fare') as AgentePianoVoce['stato'],
    }))
    .filter((v) => v.testo !== '');
}

function mapPasso(raw: unknown): AgentePasso | null {
  if (!isRec(raw)) return null;
  if (raw.tipo === 'autocorrezione') {
    const problemi = Array.isArray(raw.problemi) ? raw.problemi.filter((p): p is string => typeof p === 'string') : [];
    return { tipo: 'autocorrezione', problemi };
  }
  if (raw.tipo === 'piano') {
    const passi = mapPiano(raw.passi);
    return passi.length ? { tipo: 'piano', passi } : null;
  }
  if (raw.tipo === 'strumento') {
    const strumento = str(raw.strumento);
    return {
      tipo: 'strumento',
      strumento,
      titolo: str(raw.titolo) || strumento,
      ok: raw.ok !== false,
      errore: typeof raw.errore === 'string' && raw.errore.trim() ? raw.errore : null,
    };
  }
  return null;
}

/** true per URL assoluti http(s): unici ammessi per i download proposti dall'agente. */
export function isUrlSicuro(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function mapAzione(raw: unknown): AgenteAzione | null {
  if (!isRec(raw)) return null;
  const etichetta = str(raw.etichetta);
  if (raw.tipo === 'download') {
    const url = str(raw.url);
    if (!isUrlSicuro(url)) return null;
    const formato = str(raw.formato).toLowerCase();
    return { tipo: 'download', formato, url, etichetta: etichetta || `Scarica ${formato.toUpperCase()}`.trim() };
  }
  if (raw.tipo === 'dvr') {
    const id = num(raw.dvr_id);
    return id != null && id > 0 ? { tipo: 'dvr', dvr_id: id, etichetta: etichetta || 'Apri il DVR' } : null;
  }
  if (raw.tipo === 'azienda') {
    const id = num(raw.azienda_id);
    return id != null && id > 0 ? { tipo: 'azienda', azienda_id: id, etichetta: etichetta || "Apri l'azienda" } : null;
  }
  return null;
}

export function mapAgenteMessaggio(raw: unknown): AgenteMessaggio {
  const r = isRec(raw) ? raw : {};
  return {
    id: num(r.id) ?? 0,
    ruolo: r.ruolo === 'utente' ? 'utente' : 'agente',
    testo: str(r.testo),
    passi: (Array.isArray(r.passi) ? r.passi : []).map(mapPasso).filter((p): p is AgentePasso => p !== null),
    azioni: (Array.isArray(r.azioni) ? r.azioni : []).map(mapAzione).filter((a): a is AgenteAzione => a !== null),
    pannelli: (Array.isArray(r.pannelli) ? r.pannelli : []).map(mapPannello).filter((p): p is Pannello => p !== null),
    creato: typeof r.creato === 'string' ? r.creato : null,
  };
}

export function mapAgenteConversazione(raw: unknown): AgenteConversazione {
  const r = isRec(raw) ? raw : {};
  const az = isRec(r.azienda) ? r.azienda : null;
  const azId = az ? num(az.id) : null;
  return {
    id: num(r.id) ?? 0,
    titolo: str(r.titolo).trim() || 'Nuova conversazione',
    azienda: az && azId != null ? { id: azId, ragione_sociale: str(az.ragione_sociale) || `Azienda ${azId}` } : null,
    aggiornata: typeof r.aggiornata === 'string' ? r.aggiornata : null,
    sezione: typeof r.sezione === 'string' && r.sezione ? r.sezione : null,
  };
}

export function mapAgenteDettaglio(raw: unknown): AgenteConversazioneDettaglio {
  const r = isRec(raw) ? raw : {};
  return {
    ...mapAgenteConversazione(r),
    messaggi: (Array.isArray(r.messaggi) ? r.messaggi : []).map(mapAgenteMessaggio),
  };
}

export function mapAgenteProfilo(raw: unknown): AgenteProfilo {
  const r = isRec(raw) ? raw : {};
  const strumenti: AgenteStrumento[] = (Array.isArray(r.strumenti) ? r.strumenti : [])
    .filter(isRec)
    .map((s) => ({ nome: str(s.nome), titolo: str(s.titolo) || str(s.nome), scrive: s.scrive === true }))
    .filter((s) => s.nome !== '');
  return {
    nome: str(r.nome).trim() || 'Falco',
    tono: r.tono === 'semplice' ? 'semplice' : 'autorevole',
    istruzioni_studio: str(r.istruzioni_studio),
    strumenti_disattivati: Array.isArray(r.strumenti_disattivati)
      ? r.strumenti_disattivati.filter((x): x is string => typeof x === 'string')
      : [],
    strumenti,
    modificabile: r.modificabile === true,
    voce: r.voce === true,
  };
}

// ============================================================
// PANNELLI
// ============================================================

const strN = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const intPos = (v: unknown): number | null => {
  const n = num(v);
  return n != null && n > 0 ? Math.round(n) : null;
};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Mappa {chiave: numero} (anche se arriva come oggetto di stringhe). */
const conteggi = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isRec(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    const n = num(x);
    if (k.trim() && n != null) out[k] = n;
  }
  return out;
};
const testoMisure = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').join('; ') : str(v);
/** P e G sono interi 1..4: fuori scala vengono riportati nei limiti. */
const scala4 = (v: unknown): number => Math.min(4, Math.max(1, Math.round(num(v) ?? 1)));

function figureDaOrganigramma(v: unknown): Array<{ ruolo: string; nome: string }> {
  if (!isRec(v)) return [];
  const out: Array<{ ruolo: string; nome: string }> = [];
  const uno = (ruolo: string, x: unknown) => {
    const n = strN(x);
    if (n) out.push({ ruolo, nome: n.trim() });
  };
  const molti = (ruolo: string, x: unknown) => {
    const nomi = lista(x).filter((y): y is string => typeof y === 'string' && y.trim() !== '');
    if (nomi.length) out.push({ ruolo, nome: nomi.join(', ') });
  };
  uno('Datore di lavoro', v.datore_lavoro);
  if (v.datore_svolge_rspp === true) out.push({ ruolo: 'RSPP', nome: 'Svolto dal datore di lavoro' });
  else uno('RSPP', v.rspp);
  if (v.medico_non_necessario === true) out.push({ ruolo: 'Medico competente', nome: 'Non previsto' });
  else uno('Medico competente', v.medico_competente);
  const rt = str(v.rappresentante_tipo);
  if (rt === 'non_presente' || rt === 'assente') out.push({ ruolo: 'RLS', nome: 'Non presente' });
  else if (rt) uno(rt.toUpperCase(), v.rappresentante_nominativo);
  molti('Preposti', v.preposti);
  molti('Addetti antincendio', v.addetti_antincendio);
  molti('Addetti primo soccorso', v.addetti_primo_soccorso);
  return out;
}

function mapAziendaScheda(raw: unknown): PannelloAziendaScheda | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  return {
    id,
    ragione_sociale: str(raw.ragione_sociale) || `Azienda ${id}`,
    ateco: strN(raw.ateco),
    dimensione: strN(raw.dimensione),
    lavoratori_totali: num(raw.lavoratori_totali),
    sedi: lista(raw.sedi)
      .filter(isRec)
      .map((x) => ({ tipo: str(x.tipo), indirizzo: str(x.indirizzo), comune: str(x.comune), provincia: str(x.provincia) }))
      .filter((x) => x.indirizzo || x.comune),
    figure: figureDaOrganigramma(raw.organigramma),
    mansioni: conteggi(raw.mansioni),
    archivio: conteggi(raw.archivio),
  };
}

/** Converte un pannello grezzo; null per tipi sconosciuti o dati inutilizzabili. */
export function mapPannello(raw: unknown): Pannello | null {
  if (!isRec(raw)) return null;
  const tipo = str(raw.tipo);
  const chiave = str(raw.chiave) || tipo;
  switch (tipo) {
    case 'aziende': {
      const aziende: PannelloAziendaVoce[] = lista(raw.aziende)
        .filter(isRec)
        .map((a) => ({
          id: intPos(a.id) ?? 0,
          ragione_sociale: str(a.ragione_sociale),
          ateco: strN(a.ateco),
          dimensione: strN(a.dimensione),
          lavoratori: num(a.lavoratori),
          ultimo_dvr: strN(a.ultimo_dvr),
        }))
        .filter((a) => a.id > 0 && a.ragione_sociale !== '');
      return { tipo, chiave, aziende };
    }
    case 'azienda': {
      const azienda = mapAziendaScheda(raw.azienda);
      return azienda ? { tipo, chiave, azienda, nuova: raw.nuova === true } : null;
    }
    case 'archivio': {
      const azienda_id = intPos(raw.azienda_id);
      if (azienda_id == null) return null;
      const elementi: PannelloArchivioElemento[] = lista(raw.elementi)
        .filter(isRec)
        .map((e) => ({
          id: intPos(e.id) ?? 0,
          tipo: str(e.tipo) || 'documento',
          titolo: strN(e.titolo),
          analisi: str(e.analisi),
          errore_analisi: strN(e.errore_analisi),
          creato: strN(e.creato),
        }))
        .filter((e) => e.id > 0);
      return { tipo, chiave, azienda_id, elementi, ricerca: raw.ricerca === true };
    }
    case 'lavoratori': {
      const azienda_id = intPos(raw.azienda_id);
      if (azienda_id == null) return null;
      const lavoratori = lista(raw.lavoratori)
        .filter(isRec)
        .map((l) => ({ id: intPos(l.id) ?? 0, nome: str(l.nome).trim(), mansione: str(l.mansione).trim() }))
        .filter((l) => l.id > 0);
      return { tipo, chiave, azienda_id, lavoratori };
    }
    case 'rischi': {
      const rischi: PannelloRischio[] = lista(raw.rischi)
        .filter(isRec)
        .map((r) => ({
          categoria: str(r.categoria),
          pericolo: str(r.pericolo),
          probabilita: scala4(r.probabilita),
          gravita: scala4(r.gravita),
          fonte_norma: str(r.fonte_norma),
          misure_tecniche: testoMisure(r.misure_tecniche),
          misure_organizzative: testoMisure(r.misure_organizzative),
        }))
        .filter((r) => r.pericolo !== '' || r.categoria !== '');
      return { tipo, chiave, azienda_id: intPos(raw.azienda_id) ?? 0, rischi };
    }
    case 'dvr': {
      const dvr_id = intPos(raw.dvr_id);
      if (dvr_id == null) return null;
      const d = isRec(raw.dati) ? raw.dati : {};
      return {
        tipo,
        chiave,
        dvr_id,
        dati: {
          stato_documento: strN(d.stato_documento),
          generazione: strN(d.generazione) ?? (str(d.stato).includes('avviata') ? 'pending' : null),
          revisione_corrente: num(d.revisione_corrente) ?? num(d.revisione),
          errore: strN(d.errore),
        },
      };
    }
    case 'dvr_elenco': {
      const dvr: PannelloDvrVoce[] = lista(raw.dvr)
        .filter(isRec)
        .map((d) => ({
          id: intPos(d.id) ?? 0,
          azienda_id: intPos(d.azienda_id),
          versione: num(d.versione),
          stato: strN(d.stato),
          generazione: strN(d.generazione),
          revisione_corrente: num(d.revisione_corrente),
        }))
        .filter((d) => d.id > 0);
      return { tipo, chiave, dvr };
    }
    case 'indice': {
      const dvr_id = intPos(raw.dvr_id);
      if (dvr_id == null) return null;
      const indice: PannelloIndiceVoce[] = lista(raw.indice)
        .filter(isRec)
        .map((x) => ({
          sezione: str(x.sezione),
          titolo: str(x.titolo),
          caratteri: num(x.caratteri) ?? 0,
          scritta_da: str(x.scritta_da) || 'AI',
        }))
        .filter((x) => x.sezione !== '');
      return { tipo, chiave, dvr_id, revisione: num(raw.revisione), indice };
    }
    case 'sezione': {
      const dvr_id = intPos(raw.dvr_id);
      const sz = isRec(raw.sezione) ? raw.sezione : null;
      if (dvr_id == null || !sz || !str(sz.chiave)) return null;
      return {
        tipo,
        chiave,
        dvr_id,
        revisione: num(raw.revisione),
        sezione: { chiave: str(sz.chiave), titolo: str(sz.titolo), testo: str(sz.testo) },
      };
    }
    case 'revisioni': {
      const dvr_id = intPos(raw.dvr_id);
      if (dvr_id == null) return null;
      const revisioni: PannelloRevisione[] = lista(raw.revisioni)
        .filter(isRec)
        .map((r) => ({
          numero: num(r.numero) ?? 0,
          data: strN(r.data),
          redazione: str(r.redazione).trim() || 'AI',
          motivo: strN(r.motivo),
          sezioni_modificate: lista(r.sezioni_modificate).filter((x): x is string => typeof x === 'string'),
        }))
        .filter((r) => r.numero > 0);
      return { tipo, chiave, dvr_id, revisioni };
    }
    case 'scadenze': {
      const scadenze: PannelloScadenza[] = lista(raw.scadenze)
        .filter(isRec)
        .map((x) => ({
          id: intPos(x.id) ?? 0,
          azienda: strN(x.azienda),
          azienda_id: intPos(x.azienda_id),
          tipo: str(x.tipo),
          descrizione: str(x.descrizione),
          data: strN(x.data),
          priorita: strN(x.priorita),
          scaduta: x.scaduta === true,
        }))
        .filter((x) => x.id > 0)
        .sort((a, b) => String(a.data ?? '9999').localeCompare(String(b.data ?? '9999')));
      return { tipo, chiave, scadenze };
    }
    case 'novita': {
      const novita: PannelloNovita[] = lista(raw.novita)
        .filter(isRec)
        .map((n) => {
          const url = str(n.url);
          const ril = num(n.rilevanza);
          return {
            fonte: str(n.fonte).trim() || 'Fonte ufficiale',
            data: strN(n.data),
            tipo: str(n.tipo).trim(),
            titolo: str(n.titolo).trim(),
            sintesi: str(n.sintesi).trim(),
            url: url && isUrlSicuro(url) ? url : null,
            rilevanza: ril == null ? null : Math.max(0, Math.min(100, Math.round(ril))),
          };
        })
        .filter((n) => n.titolo !== '' || n.sintesi !== '');
      return { tipo, chiave, giorni: num(raw.giorni), argomento: strN(raw.argomento), novita };
    }
    case 'cantiere': {
      const c = isRec(raw.cantiere) ? raw.cantiere : {};
      const cantiere_id = intPos(raw.cantiere_id) ?? intPos(c.cantiere_id) ?? intPos(c.id);
      if (cantiere_id == null) return null;
      const committente = isRec(c.committente) ? strN(c.committente.nome) : strN(c.committente);
      return {
        tipo,
        chiave,
        cantiere_id,
        azienda_id: intPos(raw.azienda_id) ?? intPos(c.azienda_id),
        cantiere: {
          denominazione: str(c.denominazione).trim() || `Cantiere ${cantiere_id}`,
          indirizzo: str(c.indirizzo).trim(),
          impresa: strN(c.impresa),
          committente,
          data_inizio: strN(c.data_inizio),
          data_fine: strN(c.data_fine),
          pos: lista(c.pos)
            .filter(isRec)
            .map((p) => ({ pos_id: intPos(p.pos_id) ?? intPos(p.id) ?? 0, stato: strN(p.stato), revisione: num(p.revisione) }))
            .filter((p) => p.pos_id > 0),
          subappalti: lista(c.subappalti).length,
        },
      };
    }
    case 'pos': {
      const d = isRec(raw.dati) ? raw.dati : {};
      const pos_id = intPos(raw.pos_id) ?? intPos(d.pos_id);
      if (pos_id == null) return null;
      const fasi = lista(raw.fasi).length ? lista(raw.fasi) : lista(d.fasi);
      return {
        tipo,
        chiave,
        pos_id,
        stato: strN(raw.stato) ?? strN(d.stato),
        revisione: num(raw.revisione) ?? num(d.revisione) ?? num(d.revisione_corrente),
        puo_emettere: typeof raw.puo_emettere === 'boolean' ? raw.puo_emettere : null,
        conteggi: conteggi(raw.conteggi),
        fasi: fasi.map((f) => (typeof f === 'string' ? f : isRec(f) ? str(f.codice) || str(f.nome) : '')).filter(Boolean),
        prossimo_passo: strN(d.prossimo_passo),
        nota: strN(d.nota) ?? strN(d.motivo_revisione),
      };
    }
    case 'segnalazioni': {
      const pos_id = intPos(raw.pos_id);
      if (pos_id == null) return null;
      const segnalazioni: PannelloSegnalazione[] = lista(raw.segnalazioni)
        .filter(isRec)
        .map((x) => {
          const e = str(x.esito);
          return {
            chiave: str(x.chiave),
            esito: (e === 'blocca' || e === 'corregge' ? e : 'avvisa') as PannelloSegnalazione['esito'],
            messaggio: str(x.messaggio).trim(),
            riferimento: str(x.riferimento).trim(),
            accettata: x.accettata === true,
          };
        })
        .filter((x) => x.messaggio !== '');
      const ordine = { blocca: 0, corregge: 1, avvisa: 2 } as const;
      segnalazioni.sort((a, b) => ordine[a.esito] - ordine[b.esito]);
      return { tipo, chiave, pos_id, conteggi: conteggi(raw.conteggi), segnalazioni };
    }
    case 'fonti': {
      const passaggi = lista(raw.passaggi)
        .filter(isRec)
        .map((x) => ({ fonte: str(x.fonte).trim() || 'Fonte normativa', testo: str(x.testo) }))
        .filter((x) => x.testo.trim() !== '');
      return { tipo, chiave, passaggi };
    }
    default:
      // Moduli nuovi (valutazioni, documenti HSE, qualita', Nube 81, Portale HSE), poi
      // Safety Control Room (safety_score, scadenzario, fascicolo, report, passaporto, ispezioni, pronto_controllo).
      return mapPannelloModuli(raw) ?? mapPannelloControlRoom(raw);
  }
}

// ============================================================
// AVANZAMENTO DAL VIVO
// ============================================================

/** Normalizza GET /agente/progresso/{id}: eventi sconosciuti scartati. */
export function mapAgenteProgresso(raw: unknown): AgenteProgresso {
  const r = isRec(raw) ? raw : {};
  const eventi: AgenteEvento[] = [];
  for (const e of Array.isArray(r.eventi) ? r.eventi : []) {
    if (!isRec(e)) continue;
    if (e.t === 'fase' && str(e.testo).trim()) eventi.push({ t: 'fase', testo: str(e.testo).trim() });
    else if (e.t === 'passo' && str(e.strumento)) {
      const stato = e.stato === 'ok' || e.stato === 'errore' ? e.stato : 'in_corso';
      eventi.push({ t: 'passo', strumento: str(e.strumento), titolo: str(e.titolo) || str(e.strumento), stato });
    } else if (e.t === 'fine') eventi.push({ t: 'fine' });
  }
  const piano = Array.isArray(r.piano) ? mapPiano(r.piano) : null;
  const out: AgenteProgresso = { eventi, piano: piano && piano.length ? piano : null, fine: r.fine === true };
  if (typeof r.conversazione_id === 'number' && r.conversazione_id > 0) out.conversazioneId = r.conversazione_id;
  if (typeof r.risposta_id === 'number' && r.risposta_id > 0) out.rispostaId = r.risposta_id;
  return out;
}

/** Id casuale valido per richiesta_id ([A-Za-z0-9_-], 8..64). */
export function nuovoIdRichiesta(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '');
  } catch {
    /* ricado sotto */
  }
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// ============================================================
// CANTIERI E POS
// ============================================================

export function mapCantiere(raw: unknown): Cantiere | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  const company_id = intPos(raw.company_id);
  if (id == null || company_id == null) return null;
  return {
    id,
    company_id,
    denominazione: str(raw.denominazione).trim() || `Cantiere ${id}`,
    indirizzo: str(raw.indirizzo).trim(),
    comune: str(raw.comune).trim(),
    provincia: strN(raw.provincia),
    impresa_affidataria: strN(raw.impresa_affidataria),
    data_inizio: strN(raw.data_inizio),
    data_fine: strN(raw.data_fine),
    durata_giorni: num(raw.durata_giorni),
    note: strN(raw.note),
  };
}

export function mapPos(raw: unknown): PosDocumento | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  const company_id = intPos(raw.company_id);
  const cantiere_id = intPos(raw.cantiere_id);
  if (id == null || company_id == null || cantiere_id == null) return null;
  return {
    id,
    company_id,
    cantiere_id,
    stato: str(raw.stato) || 'bozza',
    revisione_corrente: num(raw.revisione_corrente),
    motivo_revisione: strN(raw.motivo_revisione),
    emesso_il: strN(raw.emesso_il),
    fasi: lista(raw.fasi).map((f) => (typeof f === 'string' ? f : isRec(f) ? str(f.codice) || str(f.nome) : '')).filter(Boolean),
    aggiornato: strN(raw.updated_at),
  };
}
