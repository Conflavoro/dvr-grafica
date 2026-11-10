// Normalizzazione difensiva dei pannelli dei moduli nuovi e delle righe del
// tavolo "Documenti". Stesse regole di agente-mappers.ts: si accetta `unknown`,
// si scarta cio' che non si riconosce, si ritorna sempre un oggetto completo.
// I link accettati sono solo http(s).

import type {
  AllarmeCoda,
  ColoreEsito,
  CondivisioneVoce,
  ConteggiControllo,
  DocumentoAzienda,
  DocumentoDaAggiornare,
  DocumentoHseVoce,
  EsitoValutazione,
  IndicatoreCruscotto,
  NominaVoce,
  PannelloModuli,
  PassoAvvio,
  PassoPromemoria,
  PropostaAgenteVoce,
  QualitaComponente,
  RiferimentoSuperato,
  RigaValutazione,
  SegnalazioneDocumento,
  StatoPasso,
  StatoProposta,
  ValutazioneVoce,
  VoceDaFare,
} from './moduli-types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, riserva = ''): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : riserva);
const strN = (v: unknown): string | null => {
  const s = str(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};
const intPos = (v: unknown): number | null => {
  const n = num(v);
  return n != null && n > 0 ? Math.round(n) : null;
};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const testi = (v: unknown): string[] =>
  lista(v)
    .map((x) => (typeof x === 'string' ? x : isRec(x) ? str(x.messaggio) || str(x.motivo) || str(x.testo) : ''))
    .map((x) => x.trim())
    .filter(Boolean);

function urlSicuro(v: unknown): string | null {
  const s = strN(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? s : null;
  } catch {
    return null;
  }
}

const COLORI: ColoreEsito[] = ['verde', 'giallo', 'arancio', 'rosso', 'viola', 'grigio'];
export function colore(v: unknown): ColoreEsito {
  const s = str(v).toLowerCase();
  if (s === 'arancione' || s === 'ambra') return 'arancio';
  return (COLORI as string[]).includes(s) ? (s as ColoreEsito) : 'grigio';
}

export function conteggiControllo(v: unknown): ConteggiControllo | null {
  if (!isRec(v)) return null;
  return { blocca: Math.max(0, num(v.blocca) ?? 0), corregge: Math.max(0, num(v.corregge) ?? 0), avvisa: Math.max(0, num(v.avvisa) ?? 0) };
}

const ORDINE_ESITO = { blocca: 0, corregge: 1, avvisa: 2 } as const;

export function segnalazioni(v: unknown): SegnalazioneDocumento[] {
  return lista(v)
    .filter(isRec)
    .map((x) => {
      const e = str(x.esito);
      return {
        chiave: str(x.chiave),
        esito: (e === 'blocca' || e === 'corregge' ? e : 'avvisa') as SegnalazioneDocumento['esito'],
        messaggio: str(x.messaggio).trim(),
        riferimento: str(x.riferimento).trim(),
        accettabile: x.accettabile === true,
        accettata: x.accettata === true,
      };
    })
    .filter((x) => x.messaggio !== '')
    .sort((a, b) => ORDINE_ESITO[a.esito] - ORDINE_ESITO[b.esito]);
}

function esitoValutazione(v: unknown): EsitoValutazione | null {
  if (typeof v === 'string' && v.trim()) return { testo: v.trim(), colore: 'grigio', livello: null };
  if (!isRec(v)) return null;
  const testo = str(v.testo).trim();
  if (!testo) return null;
  return { testo, colore: colore(v.colore), livello: num(v.livello) };
}

function righeValutazione(v: unknown): RigaValutazione[] {
  return lista(v)
    .filter(isRec)
    .map((r) => ({ voce: str(r.voce).trim(), valore: str(r.valore).trim(), esito: str(r.esito).trim(), colore: colore(r.colore) }))
    .filter((r) => r.voce !== '' || r.valore !== '');
}

function riferimenti(v: unknown): RiferimentoSuperato[] {
  return lista(v)
    .filter(isRec)
    .map((r) => ({
      titolo: str(r.titolo).trim(),
      trovato: str(r.trovato).trim(),
      sostituito_da: str(r.sostituito_da).trim(),
      messaggio: str(r.messaggio).trim(),
      esito: str(r.esito).trim(),
    }))
    .filter((r) => r.titolo || r.trovato || r.messaggio);
}

function statoPasso(v: unknown): StatoPasso {
  const s = str(v);
  if (s === 'fatto' || s === 'in_corso' || s === 'da_fare') return s;
  return 'in_attesa';
}

/** Righe di dettaglio leggibili per ogni passo della scheda di avvio. */
function dettagliPasso(p: Rec): string[] {
  const out: string[] = [];
  const n = num(p.documenti);
  if (n != null) {
    const letti = num(p.letti) ?? 0;
    const inLettura = num(p.in_lettura) ?? 0;
    out.push(`${n} ${n === 1 ? 'documento caricato' : 'documenti caricati'}, ${letti} ${letti === 1 ? 'letto' : 'letti'}${inLettura ? `, ${inLettura} in lettura` : ''}`);
    const san = num(p.sanitari_bloccati);
    if (san) out.push(`${san} ${san === 1 ? 'documento sanitario fermato' : 'documenti sanitari fermati'}: restano al medico competente`);
  }
  const conf = num(p.confermati);
  if (conf) out.push(`${conf} ${conf === 1 ? 'dato confermato' : 'dati confermati'}`);
  for (const m of lista(p.mancanti)) {
    const t = typeof m === 'string' ? m : isRec(m) ? str(m.testo) || str(m.voce) || str(m.nome) || str(m.motivo) : '';
    if (t.trim()) out.push(t.trim());
  }
  for (const u of lista(p.utenti)) {
    if (!isRec(u)) continue;
    const chi = str(u.nome) || str(u.email);
    const ruolo = (str(u.etichetta) || str(u.ruolo).replace(/_/g, ' ')).toLowerCase();
    if (chi) out.push(ruolo ? `${chi}, ${ruolo}` : chi);
  }
  return out;
}

const STATI_PROPOSTA: StatoProposta[] = ['in_attesa', 'approvata', 'respinta', 'errore'];

const ETICHETTE_CAMPI: Record<string, string> = {
  ragione_sociale: 'Ragione sociale',
  vat: 'Partita IVA',
  ateco: 'ATECO',
  pec: 'PEC',
  email: 'Email',
  telefono: 'Telefono',
  sede: 'Sede',
  rspp: 'RSPP',
  medico_competente: 'Medico competente',
};

function dettaglioProposta(tipo: string, payload: unknown): string[] {
  if (!isRec(payload)) return [];
  const out: string[] = [];
  if (tipo === 'dati_azienda' && isRec(payload.campi)) {
    for (const [k, v] of Object.entries(payload.campi)) {
      const val = isRec(v) ? [str(v.indirizzo), str(v.comune)].filter(Boolean).join(', ') : str(v);
      if (val.trim()) out.push(`${ETICHETTE_CAMPI[k] ?? k.replace(/_/g, ' ')}: ${val.trim()}`);
    }
    const fonte = strN(payload.fonte);
    if (fonte) out.push(`Fonte: ${fonte}`);
  } else if (tipo === 'scadenza') {
    const d = strN(payload.data_prevista);
    if (d) out.push(`Entro il ${d.split('-').reverse().join('/')}`);
    const p = strN(payload.priorita);
    if (p) out.push(`Priorità ${p}`);
  } else if (tipo === 'lavoratore') {
    const m = strN(payload.mansione);
    if (m) out.push(`Mansione: ${m}`);
    const d = strN(payload.data_assunzione);
    if (d) out.push(`Assunto il ${d.split('-').reverse().join('/')}`);
  } else if (tipo === 'servizio') {
    const q = num(payload.quantita);
    const imp = strN(payload.importo);
    if (q != null) out.push(`Quantità ${q}`);
    if (imp) out.push(`Importo ${imp}`);
    const note = strN(payload.note);
    if (note) out.push(note);
  } else {
    const d = strN(payload.descrizione);
    if (d) out.push(d);
  }
  return out;
}

export function mapProposta(raw: unknown): PropostaAgenteVoce | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  const tipo = str(raw.tipo) || 'attivita';
  const stato = str(raw.stato);
  const esito = isRec(raw.esito) ? raw.esito : null;
  return {
    id,
    azienda_id: intPos(raw.azienda_id),
    tipo,
    titolo: str(raw.titolo).trim() || 'Proposta senza titolo',
    motivo: strN(raw.motivo),
    origine: str(raw.origine) || 'agente',
    stato: (STATI_PROPOSTA as string[]).includes(stato) ? (stato as StatoProposta) : 'in_attesa',
    creata_il: strN(raw.creata_il),
    dettaglio: dettaglioProposta(tipo, raw.payload),
    errore: esito ? strN(esito.errore) : null,
  };
}

function indicatore(raw: unknown): IndicatoreCruscotto | null {
  if (!isRec(raw)) return null;
  const codice = str(raw.codice);
  const nome = str(raw.nome).trim();
  if (!codice || !nome) return null;
  const s = str(raw.stato);
  return {
    codice,
    nome,
    valore: num(raw.valore),
    unita: str(raw.unita) || 'n',
    base: num(raw.base),
    obiettivo: num(raw.obiettivo),
    soglia: num(raw.soglia),
    stato: s === 'verde' || s === 'ambra' || s === 'rosso' ? s : 'n_d',
    come: str(raw.come).trim(),
  };
}

function passoPromemoria(raw: unknown): PassoPromemoria | null {
  if (!isRec(raw)) return null;
  const nome = str(raw.nome).trim();
  if (!nome) return null;
  return {
    passo: str(raw.passo),
    nome,
    previsto_il: strN(raw.previsto_il),
    esito: str(raw.esito) || 'da_inviare',
    canale: strN(raw.canale),
    errore: strN(raw.errore),
    testo: strN(raw.testo),
  };
}

function condivisione(raw: unknown): CondivisioneVoce | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  return {
    id,
    destinatario: str(raw.destinatario).trim() || 'Destinatario non indicato',
    motivo: strN(raw.motivo),
    cartelle: lista(raw.cartelle).filter((x): x is string => typeof x === 'string'),
    scade_il: strN(raw.scade_il),
    valida: raw.valida === true,
    revocata: strN(raw.revocata_il) !== null,
    accessi: lista(raw.accessi).length,
  };
}

function voceDaFare(raw: unknown): VoceDaFare | null {
  if (!isRec(raw)) return null;
  const testo = str(raw.testo).trim();
  if (!testo) return null;
  return {
    tipo: str(raw.tipo) || 'altro',
    id: num(raw.id) ?? 0,
    testo,
    azione: strN(raw.azione),
    quando: strN(raw.appuntamento_il) ?? strN(raw.data),
    importo: strN(raw.importo),
  };
}

function scadenzeRadon(v: unknown): Array<{ voce: string; data: string }> {
  const NOMI: Record<string, string> = {
    ripetizione: 'Nuova misura',
    comunicazione: 'Comunicazione agli enti',
    risanamento: 'Misure correttive',
    conservazione: 'Conservazione dei documenti',
  };
  if (Array.isArray(v)) return testi(v).map((t) => ({ voce: t, data: '' }));
  if (!isRec(v)) return [];
  return Object.entries(v)
    .map(([k, d]) => ({ voce: NOMI[k] ?? k.replace(/_/g, ' '), data: str(d) }))
    .filter((x) => x.data !== '');
}

/** Pannelli dei moduli nuovi; null se il tipo non e' di questo gruppo o i dati sono inutilizzabili. */
export function mapPannelloModuli(raw: unknown): PannelloModuli | null {
  if (!isRec(raw)) return null;
  const tipo = str(raw.tipo);
  const chiave = str(raw.chiave) || tipo;
  switch (tipo) {
    case 'valutazione': {
      const valutazione_id = intPos(raw.valutazione_id);
      if (valutazione_id == null) return null;
      const tv = str(raw.tipo_valutazione);
      return {
        tipo,
        chiave,
        valutazione_id,
        azienda_id: intPos(raw.azienda_id),
        tipo_valutazione: tv,
        nome: str(raw.nome).trim() || tv || 'Valutazione',
        stato: strN(raw.stato),
        revisione: num(raw.revisione),
        esito: esitoValutazione(raw.esito),
        righe: righeValutazione(raw.righe),
        puo_emettere: bool(raw.puo_emettere),
        conteggi: conteggiControllo(raw.conteggi),
        segnalazioni: segnalazioni(raw.segnalazioni),
      };
    }
    case 'valutazioni': {
      const valutazioni: ValutazioneVoce[] = lista(raw.valutazioni)
        .filter(isRec)
        .map((v) => ({
          valutazione_id: intPos(v.valutazione_id) ?? intPos(v.id) ?? 0,
          azienda_id: intPos(v.azienda_id),
          azienda: strN(v.azienda),
          tipo: str(v.tipo),
          nome: str(v.nome).trim() || str(v.tipo),
          stato: strN(v.stato),
          revisione: num(v.revisione),
          esito: strN(v.esito),
          colore: v.colore == null ? null : colore(v.colore),
          puo_emettere: bool(v.puo_emettere),
        }))
        .filter((v) => v.valutazione_id > 0);
      return { tipo, chiave, azienda_id: intPos(raw.azienda_id), valutazioni };
    }
    case 'documento_hse': {
      const documento_id = intPos(raw.documento_id);
      if (documento_id == null) return null;
      return {
        tipo,
        chiave,
        documento_id,
        tipo_documento: str(raw.tipo_documento),
        titolo: strN(raw.titolo),
        stato: strN(raw.stato),
        revisione: num(raw.revisione),
        puo_emettere: bool(raw.puo_emettere),
        conteggi: conteggiControllo(raw.conteggi),
        segnalazioni: segnalazioni(raw.segnalazioni),
      };
    }
    case 'documenti_hse': {
      const documenti: DocumentoHseVoce[] = lista(raw.documenti)
        .filter(isRec)
        .map((d) => ({
          documento_id: intPos(d.documento_id) ?? intPos(d.id) ?? 0,
          tipo: str(d.tipo),
          titolo: strN(d.titolo),
          azienda: strN(d.azienda),
          stato: strN(d.stato),
          revisione: num(d.revisione),
          puo_emettere: bool(d.puo_emettere),
          conteggi: conteggiControllo(d.conteggi),
        }))
        .filter((d) => d.documento_id > 0);
      return { tipo, chiave, documenti };
    }
    case 'qualita': {
      const componenti: QualitaComponente[] = lista(raw.componenti)
        .filter(isRec)
        .map((c) => ({ chiave: str(c.chiave), nome: str(c.nome).trim() || str(c.chiave), punti: num(c.punti), max: num(c.max) ?? 0, dettaglio: str(c.dettaglio).trim() }))
        .filter((c) => c.nome !== '' && c.max > 0);
      const col = str(raw.colore);
      const punteggio = num(raw.punteggio);
      return {
        tipo,
        chiave,
        documento_id: intPos(raw.documento_id),
        tipo_documento: strN(raw.tipo_documento),
        titolo: strN(raw.titolo),
        punteggio: punteggio == null ? null : Math.max(0, Math.min(100, Math.round(punteggio * 10) / 10)),
        livello: strN(raw.livello),
        pronto_per_revisione: bool(raw.pronto_per_revisione),
        colore: col === 'verde' || col === 'rosso' ? col : 'giallo',
        componenti,
        riferimenti_superati: riferimenti(raw.riferimenti_superati),
        miglioramenti: lista(raw.miglioramenti)
          .map((m) => (typeof m === 'string' ? { azione: m.trim(), guadagno: null } : isRec(m) ? { azione: str(m.azione).trim(), guadagno: num(m.guadagno) } : { azione: '', guadagno: null }))
          .filter((m) => m.azione !== ''),
      };
    }
    case 'riferimenti':
      return { tipo, chiave, riferimenti: riferimenti(raw.riferimenti) };
    case 'aggiornamenti': {
      const documenti: DocumentoDaAggiornare[] = lista(raw.documenti)
        .filter(isRec)
        .map((d) => ({
          tipo: str(d.tipo),
          documento_id: intPos(d.documento_id) ?? 0,
          revisione: num(d.revisione),
          azienda: strN(d.azienda),
          emesso_il: strN(d.emesso_il),
          motivi: testi(d.motivi),
        }))
        .filter((d) => d.documento_id > 0);
      return { tipo, chiave, azienda_id: intPos(raw.azienda_id), documenti };
    }
    case 'nube81': {
      const n = isRec(raw.nube81) ? raw.nube81 : {};
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        modello: strN(raw.modello),
        compilati: Math.max(0, num(raw.compilati) ?? 0),
        mancanti: lista(raw.mancanti).filter((x): x is string => typeof x === 'string' && x.trim() !== ''),
        da_aggiungere_a_nube: lista(n.da_aggiungere_a_nube).filter((x): x is string => typeof x === 'string'),
        riferimenti_superati: Math.max(0, num(raw.riferimenti_superati) ?? 0),
        link: urlSicuro(raw.link),
        avvisi: testi(raw.avvisi),
      };
    }
    case 'nomine': {
      const nomine: NominaVoce[] = lista(raw.nomine)
        .filter(isRec)
        .map((x) => ({
          documento_id: intPos(x.documento_id),
          atto: str(x.atto),
          nome: str(x.nome_atto).trim() || str(x.titolo).trim() || str(x.atto),
          attiva: x.attiva === true,
          stato: strN(x.stato),
          revisione: num(x.revisione),
        }))
        .filter((x) => x.nome !== '');
      return { tipo, chiave, azienda_id: intPos(raw.azienda_id), nomine, mancanti: testi(raw.mancanti) };
    }
    case 'radon_calcolo': {
      const media = num(raw.media);
      const e = str(raw.esito);
      return {
        tipo,
        chiave,
        media,
        incertezza: num(raw.incertezza),
        sopra: e === 'sopra' ? true : e === 'sotto' ? false : null,
        giorni: num(raw.giorni),
        scadenze: scadenzeRadon(raw.scadenze),
      };
    }
    case 'scheda_avvio': {
      const passi: PassoAvvio[] = lista(raw.passi)
        .filter(isRec)
        .map((p, i) => ({
          numero: num(p.numero) ?? i + 1,
          nome: str(p.nome).trim(),
          stato: statoPasso(p.stato),
          dettagli: dettagliPasso(p),
          nota: strN(p.nota),
          da_confermare: lista(p.da_confermare)
            .filter(isRec)
            .map((x) => ({ proposta_id: intPos(x.proposta_id) ?? 0, titolo: str(x.titolo).trim() }))
            .filter((x) => x.proposta_id > 0 && x.titolo !== ''),
        }))
        .filter((p) => p.nome !== '');
      return { tipo, chiave, azienda_id: intPos(raw.azienda_id), passi, in_ritardo: raw.in_ritardo === true, note: testi(raw.note) };
    }
    case 'coda_lavoro': {
      const f = isRec(raw.fatto_oggi) ? raw.fatto_oggi : null;
      const allarmi: AllarmeCoda[] = lista(raw.allarmi)
        .filter(isRec)
        .map((a) => ({ chiave: str(a.chiave), testo: str(a.testo).trim(), numero: num(a.numero) ?? 0, livello: (a.livello === 'rosso' ? 'rosso' : 'ambra') as AllarmeCoda['livello'] }))
        .filter((a) => a.testo !== '' && a.numero > 0);
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        proposte: lista(raw.proposte).map(mapProposta).filter((p): p is PropostaAgenteVoce => p !== null),
        fatto_oggi: f ? { approvate: num(f.approvate) ?? 0, respinte: num(f.respinte) ?? 0 } : null,
        allarmi,
      };
    }
    case 'cruscotto': {
      const a = isRec(raw.agenti) ? raw.agenti : null;
      return {
        tipo,
        chiave,
        indicatori: lista(raw.indicatori).map(indicatore).filter((x): x is IndicatoreCruscotto => x !== null),
        agenti: a ? { proposte_oggi: num(a.proposte_oggi), in_attesa: num(a.in_attesa), approvate_su_decise: num(a.approvate_su_decise), costo_ai_mese_eur: num(a.costo_ai_mese_eur) } : null,
      };
    }
    case 'nuovo_assunto': {
      const l = isRec(raw.lavoratore) ? raw.lavoratore : null;
      const q = isRec(raw.quota) ? raw.quota : null;
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        lavoratore: l
          ? { nome: str(l.nome).trim() || 'Nuovo lavoratore', mansione: str(l.mansione).trim(), data_assunzione: strN(l.data_assunzione), rischio: strN(l.rischio), sorveglianza: l.sorveglianza === true }
          : null,
        quota: q ? { importo: strN(q.importo), stato: strN(q.stato), descrizione: strN(q.descrizione) } : null,
        scadenze: lista(raw.scadenze)
          .filter(isRec)
          .map((s) => ({ id: intPos(s.id) ?? 0, descrizione: str(s.descrizione).trim() || str(s.tipo), stato_prenotazione: strN(s.stato_prenotazione) }))
          .filter((s) => s.descrizione !== ''),
      };
    }
    case 'promemoria': {
      const s = isRec(raw.scadenza) ? raw.scadenza : null;
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        visita: s
          ? { descrizione: str(s.descrizione).trim() || 'Visita medica', appuntamento_il: strN(s.appuntamento_il), luogo: strN(s.luogo), confermata: strN(s.confermata_il) !== null }
          : null,
        passi: lista(raw.passi).map(passoPromemoria).filter((p): p is PassoPromemoria => p !== null),
      };
    }
    case 'condivisioni':
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        condivisioni: lista(raw.condivisioni).map(condivisione).filter((c): c is CondivisioneVoce => c !== null),
      };
    case 'da_fare': {
      const c = isRec(raw.conteggi) ? raw.conteggi : {};
      const conteggi: Record<string, number> = {};
      for (const [k, v] of Object.entries(c)) {
        const n = num(v);
        if (n != null && k !== 'totale_da_pagare') conteggi[k] = n;
      }
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        conteggi,
        totale_da_pagare: strN(c.totale_da_pagare),
        voci: lista(raw.voci).map(voceDaFare).filter((v): v is VoceDaFare => v !== null),
      };
    }
    case 'cartelle':
      return {
        tipo,
        chiave,
        azienda_id: intPos(raw.azienda_id),
        cartelle: lista(raw.cartelle)
          .filter(isRec)
          .map((k) => ({ chiave: str(k.chiave), nome: str(k.nome).trim(), documenti: Array.isArray(k.documenti) ? k.documenti.length : Math.max(0, num(k.documenti) ?? 0) }))
          .filter((k) => k.nome !== ''),
        da_classificare: Math.max(0, num(raw.da_classificare) ?? 0),
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- tavolo: righe dell'elenco unico

export const NOMI_TIPO_DOCUMENTO: Record<string, string> = {
  dvr: 'DVR',
  pos: 'POS',
  rumore: 'Rumore',
  vibrazioni: 'Vibrazioni',
  mmc: 'Movimentazione manuale dei carichi',
  chimico: 'Agenti chimici',
  stress: 'Stress lavoro correlato',
  legionella: 'Legionella',
  solitudine: 'Lavoro in solitudine',
  duvri: 'DUVRI',
  pimus: 'PiMUS',
  haccp: 'Manuale HACCP',
  emergenza: 'Piano di emergenza',
  sopralluogo: 'Verbale di sopralluogo',
  riunione: 'Verbale di riunione periodica',
  nomina: 'Nomina',
  procedura: 'Procedura di sicurezza',
  radon: 'Relazione radon',
};

export function nomeTipoDocumento(tipo: string): string {
  return NOMI_TIPO_DOCUMENTO[tipo] ?? (tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, ' ') : 'Documento');
}

/** Riga di GET /documenti-hse. */
export function mapRigaDocumentoHse(raw: unknown): DocumentoAzienda | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  const tipo = str(raw.tipo);
  const uc = isRec(raw.ultimo_controllo) ? raw.ultimo_controllo : null;
  return {
    chiave: `hse:${id}`,
    origine: 'hse',
    id,
    tipo,
    titolo: str(raw.titolo).trim() || nomeTipoDocumento(tipo),
    stato: strN(raw.stato),
    revisione: num(raw.revisione_corrente),
    aggiornato: strN(raw.updated_at) ?? strN(raw.emesso_il),
    puo_emettere: uc ? bool(uc.puo_emettere) : null,
    conteggi: uc ? conteggiControllo(uc.conteggi) : null,
    esito: null,
  };
}

/** Riga di GET /valutazioni. */
export function mapRigaValutazione(raw: unknown): DocumentoAzienda | null {
  if (!isRec(raw)) return null;
  const id = intPos(raw.id);
  if (id == null) return null;
  const tipo = str(raw.tipo);
  const uc = isRec(raw.ultimo_controllo) ? raw.ultimo_controllo : null;
  return {
    chiave: `valutazione:${id}`,
    origine: 'valutazione',
    id,
    tipo,
    titolo: str(raw.titolo).trim() || `Valutazione ${(str(raw.nome) || nomeTipoDocumento(tipo)).toLowerCase()}`,
    stato: strN(raw.stato),
    revisione: num(raw.revisione_corrente),
    aggiornato: strN(raw.updated_at) ?? strN(raw.emessa_il),
    puo_emettere: uc ? bool(uc.puo_emettere) : null,
    conteggi: uc ? conteggiControllo(uc.conteggi) : null,
    esito: esitoValutazione(raw.esito),
  };
}
