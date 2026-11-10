'use client';

import { useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, ChipStato, Pillole, Voce, useAziendeStudio, useAzione, useCarico } from '../amministrazione-kit';
import { DettaglioPreventivo } from '../azienda/Servizi';
import {
  azioneOrdineStudio,
  azionePreventivo,
  calcolaPreventivo,
  creaPreventivo,
  ordiniStudio,
  preventivi,
  scaricaPreventivo,
  type Ordine,
  type Preventivo,
} from '@/lib/portale/amministrazione-api';
import { STATI_ORDINE, STATI_PREVENTIVO, chip, euro, importoDaTesto } from '@/lib/portale/amministrazione-logica';
import { numero, rec } from '@/lib/portale/api';
import { Nota, Piu, Scarica } from '@/components/icone';
import { COLONNE_AVANZAMENTO, LISTINO_CANONE, LISTINO_QUOTE, LISTINO_UNA_TANTUM, cifra, colonnaDi, etaNelloStato, usePermessiStaff } from '@/lib/portale/gestionale-permessi';
import { clsx } from '@/lib/clsx';
import { ConfrontoVenditore } from '@/components/simulatore/ConfrontoVenditore';

type Scheda = 'preventivi' | 'pipeline' | 'listino' | 'ordini';

const MOTIVI: Array<{ k: string; t: string }> = [
  { k: 'prezzo', t: 'Prezzo troppo alto' },
  { k: 'consulente_esterno', t: 'Ha scelto un consulente esterno' },
  { k: 'fornitore_attuale', t: 'Resta con il fornitore attuale' },
  { k: 'non_risponde', t: 'Non risponde più' },
  { k: 'fuori_target', t: 'Fuori target, oltre 100 dipendenti' },
  { k: 'altro', t: 'Altro' },
];

/** Preventivi e ordini del gestionale (SPEC_GESTIONALE 7): calcolo dal listino, invio all'azienda, incasso registrato. */
export default function Preventivi() {
  const { user, versione, ricarica, apri, aziendaScelta } = usePortale();
  const azId = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<Scheda>('preventivi');
  const [nuovo, setNuovo] = useState(false);
  const [aperto, setAperto] = useState<Preventivo | null>(null);
  const [ordine, setOrdine] = useState<Ordine | null>(null);
  const p = useCarico(() => preventivi(azId), [versione, azId]);
  const o = useCarico(() => ordiniStudio(azId), [versione, azId]);
  // Azioni secondo il ruolo dello staff (06 par. 6): crea chi ha creaPreventivo, incassa l'amministrazione.
  const { puo } = usePermessiStaff();
  void user;
  const kpi = p.dati?.kpi ?? {};
  const aggiorna = () => {
    p.carica();
    o.carica();
    ricarica();
  };

  return (
    <div className="space-y-5">
      <Testata
        categoria="contratto"
        icona={Nota}
        sopra={aziendaScelta?.ragione_sociale ?? 'Clienti'}
        titolo="Preventivi e ordini"
        sotto={p.dati ? `${p.dati.voci.filter((x) => ['bozza', 'inviato'].includes(x.stato)).length} preventivi aperti · ${numero(kpi.accettati_attesa_incasso) ?? 0} accettati in attesa dell'incasso` : undefined}
        azioni={
          puo('creaPreventivo') ? (
            <button type="button" className="btn-acido" onClick={() => setNuovo(true)}>
              <Piu size={16} aria-hidden /> Nuovo preventivo
            </button>
          ) : undefined
        }
      />
      <Schede<Scheda>
        etichetta="Preventivi e ordini"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'preventivi', t: 'Preventivi', n: numero(kpi.accettati_attesa_incasso) ?? 0 },
          { k: 'pipeline', t: 'Avanzamento' },
          { k: 'listino', t: 'Listino' },
          { k: 'ordini', t: 'Ordini', n: (numero(o.dati?.conteggi.in_corso) ?? 0) + (numero(o.dati?.conteggi.preventivi_richiesti) ?? 0) },
        ]}
      />

      {scheda === 'preventivi' && (
        <>
          {p.errore && <Errore testo={p.errore} onRiprova={p.carica} />}
          {!p.dati && !p.errore && <Caricamento />}
          {p.dati && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Riquadro etichetta="Aperti, al mese" valore={euro(numero(kpi.aperti_mese)).replace(' €', '')} unita="€" sotto="Bozze e inviati" />
                <Riquadro etichetta="Accettati" valore={numero(kpi.accettati_attesa_incasso) ?? 0} sotto="Il servizio parte all'incasso" />
                <Riquadro etichetta="Canoni attivati" valore={euro(numero(kpi.attivati_mese)).replace(' €', '')} unita="€" sotto="Al mese" />
                <Riquadro etichetta="Chiusi con la firma" valore={numero(kpi.conversione)} unita="%" />
              </div>
              <Scheda titolo="Preventivi">
                {p.dati.voci.length === 0 ? (
                  <Vuoto titolo="Nessun preventivo" azione={<button type="button" className="btn-ghost" onClick={() => setNuovo(true)}>Nuovo preventivo</button>}>
                    Il calcolo usa il listino del portale: canone per lavoratore, sedi alimentari, enti e servizi una tantum.
                  </Vuoto>
                ) : (
                  p.dati.voci.map((v) => (
                    <Riga
                      key={v.id}
                      onClick={() => setAperto(v)}
                      titolo={v.ragione_sociale}
                      sotto={`${v.numero} · ${v.dipendenti_con_sorveglianza + v.dipendenti_senza_sorveglianza} lavoratori · ${dataIt(v.creato)}`}
                      fine={
                        <span className="flex flex-col items-end gap-1">
                          <ChipStato c={chip(STATI_PREVENTIVO, v.stato)} />
                          <span className="cifre text-[13px] text-ink-muted">{euro(v.canone_mensile)} al mese</span>
                        </span>
                      }
                    />
                  ))
                )}
              </Scheda>
            </>
          )}
        </>
      )}

      {scheda === 'pipeline' && p.dati && <Avanzamento voci={p.dati.voci} onApri={setAperto} />}
      {scheda === 'listino' && <Listino />}

      {scheda === 'ordini' && (
        <>
          {o.errore && <Errore testo={o.errore} onRiprova={o.carica} />}
          {!o.dati && !o.errore && <Caricamento />}
          {o.dati && (
            <Scheda titolo="Ordini delle aziende" sotto="Un ordine pagato mette il lavoro nella coda; alla consegna ti proponiamo le ore.">
              {o.dati.ordini.length === 0 ? (
                <Vuoto titolo="Nessun ordine">Gli ordini nascono dall&apos;area azienda o dai preventivi accettati.</Vuoto>
              ) : (
                o.dati.ordini.map((x) => (
                  <Riga
                    key={x.id}
                    onClick={() => {
                      setOrdine(x);
                      apri({ tipo: 'ordine', id: x.id }, x.azienda_id);
                    }}
                    titolo={x.titolo}
                    sotto={`${x.azienda} · ${x.numero} · ${dataIt(x.creato)}`}
                    fine={
                      <span className="flex flex-col items-end gap-1">
                        <ChipStato c={chip(STATI_ORDINE, x.stato)} />
                        <span className="cifre text-[13px] text-ink-muted">{x.importo !== null ? euro(x.importo) : ''}</span>
                      </span>
                    }
                  />
                ))
              )}
            </Scheda>
          )}
        </>
      )}

      <FoglioNuovo aperto={nuovo} onChiudi={() => setNuovo(false)} onFatto={(v) => { aggiorna(); setAperto(v); }} />
      <FoglioPreventivo p={aperto} crea={puo('creaPreventivo')} incasso={puo('registraIncasso')} onChiudi={() => setAperto(null)} onFatto={(v) => { aggiorna(); setAperto(v); }} />
      <FoglioOrdineStudio o={ordine} amm={puo('registraIncasso') || puo('riconcilia')} onChiudi={() => setOrdine(null)} onFatto={() => { setOrdine(null); aggiorna(); }} />
    </div>
  );
}

function FoglioNuovo({ aperto, onChiudi, onFatto }: { aperto: boolean; onChiudi: () => void; onFatto: (p: Preventivo) => void }) {
  const aziende = useAziendeStudio();
  const { aziendaScelta } = usePortale();
  const [f, setF] = useState({ azienda_id: aziendaScelta?.id ?? 0, ragione_sociale: '', referente: '', email: '', comune: '', con: 1, senza: 0, sedi: 0, ebiasp: false, fondo: false, pos: 0, pimus: 0, drug: 0, fascia: 0 });
  const [calcolo, setCalcolo] = useState<Record<string, unknown> | null>(null);
  const az = useAzione();
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const corpo = {
    azienda_id: f.azienda_id || undefined,
    ragione_sociale: f.azienda_id ? undefined : f.ragione_sociale,
    referente: f.referente || undefined,
    email: f.email || undefined,
    comune: f.comune || undefined,
    dipendenti_con_sorveglianza: f.con,
    dipendenti_senza_sorveglianza: f.senza,
    sedi_alimentari: f.sedi,
    ebiasp: f.ebiasp,
    fondo_formazione: f.fondo,
    servizi: { pos: f.pos, pimus: f.pimus, drug_test: f.drug },
    fascia_associativa: f.fascia || undefined,
  };
  const chiave = JSON.stringify(corpo);
  useEffect(() => {
    if (!aperto) return;
    const id = setTimeout(() => {
      calcolaPreventivo(JSON.parse(chiave))
        .then(setCalcolo)
        .catch(() => setCalcolo(null));
    }, 300);
    return () => clearTimeout(id);
  }, [chiave, aperto]);
  const canone = rec(calcolo?.canone);
  const n = (k: keyof typeof f, etichetta: string) => (
    <Campo etichetta={etichetta}>
      <input className="input-field" type="number" min={0} inputMode="numeric" value={Number(f[k])} onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))} />
    </Campo>
  );
  return (
    <Foglio
      largo
      aperto={aperto}
      titolo="Nuovo preventivo"
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          disabled={az.occupato || (!f.azienda_id && f.ragione_sociale.trim() === '') || f.con + f.senza < 1}
          onClick={() => az.esegui(async () => { const v = await creaPreventivo(corpo); onChiudi(); onFatto(v); }, 'Preventivo salvato come bozza.')}
        >
          Salva come bozza
        </button>
      }
    >
      <div className="space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-[15px] font-medium text-ink">Azienda</legend>
          <Campo etichetta="Azienda già cliente" aiuto="Collegala per inviare il preventivo nella sua area.">
            <select className="input-field" value={f.azienda_id} onChange={(e) => set('azienda_id', Number(e.target.value))}>
              <option value={0}>Nuovo contatto</option>
              {aziende.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ragione_sociale}
                </option>
              ))}
            </select>
          </Campo>
          {!f.azienda_id && (
            <Campo etichetta="Ragione sociale">
              <input className="input-field" value={f.ragione_sociale} onChange={(e) => set('ragione_sociale', e.target.value)} />
            </Campo>
          )}
          <Campo etichetta="Referente">
            <input className="input-field" value={f.referente} onChange={(e) => set('referente', e.target.value)} />
          </Campo>
          <Campo etichetta="Email">
            <input className="input-field" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          </Campo>
          <Campo etichetta="Comune">
            <input className="input-field" value={f.comune} onChange={(e) => set('comune', e.target.value)} />
          </Campo>
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-[15px] font-medium text-ink">Lavoratori e sedi</legend>
          {n('con', 'Con visita')}
          {n('senza', 'Senza visita')}
          {n('sedi', 'Sedi alimentari')}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-[15px] font-medium text-ink">Enti e associazione</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
              <input type="checkbox" checked={f.ebiasp} onChange={(e) => set('ebiasp', e.target.checked)} className="h-5 w-5" /> Versa a EBIASP
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
              <input type="checkbox" checked={f.fondo} onChange={(e) => set('fondo', e.target.checked)} className="h-5 w-5" /> Aderisce a FondoFormazione
            </label>
          </div>
          <Campo etichetta="Fascia associativa Conflavoro" aiuto="Quota a parte, pagata a Conflavoro.">
            <Pillole etichetta="Fascia" attiva={f.fascia} onCambia={(v) => set('fascia', v)} voci={[{ k: 0, t: 'Non indicata' }, { k: 1, t: 'Fino a 10' }, { k: 2, t: '11-20' }, { k: 3, t: '21-50' }, { k: 4, t: '51-100' }]} />
          </Campo>
        </fieldset>
        <fieldset className="grid grid-cols-3 gap-3">
          <legend className="mb-2 text-[15px] font-medium text-ink">Servizi una tantum</legend>
          {n('pos', 'POS')}
          {n('pimus', 'PiMUS')}
          {n('drug', 'Drug test')}
        </fieldset>
        {calcolo && calcolo.offerta_standard === false && <Avviso tono="warn">{String(calcolo.nota)}</Avviso>}
        {calcolo && calcolo.offerta_standard === true && (
          <div className="rounded-[1.25rem] bg-black p-4 text-white">
            <p className="text-[13px] text-grafite-300">Canone al mese</p>
            <p className="cifre text-[38px] font-light leading-none tracking-[-0.04em]">{euro(numero(canone.mensile))}</p>
            <p className="mt-1 text-[13px] text-grafite-400">
              {euro(numero(canone.annuo))} l&apos;anno{numero(rec(calcolo.una_tantum).totale) ? ` · servizi una tantum ${euro(numero(rec(calcolo.una_tantum).totale))}` : ''}
            </p>
          </div>
        )}
      </div>
      {az.messaggio}
    </Foglio>
  );
}

function FoglioPreventivo({ p, crea, incasso, onChiudi, onFatto }: { p: Preventivo | null; crea: boolean; incasso: boolean; onChiudi: () => void; onFatto: (p: Preventivo) => void }) {
  const [perso, setPerso] = useState(false);
  const [motivo, setMotivo] = useState('prezzo');
  const [rif, setRif] = useState('');
  const [scheda, setScheda] = useState<'preventivo' | 'confronto'>('preventivo');
  const az = useAzione();
  const chiudi = () => {
    setPerso(false);
    setRif('');
    setScheda('preventivo');
    onChiudi();
  };
  const fai = (azione: 'invia' | 'incasso' | 'perso' | 'riapri', body?: Record<string, unknown>, ok?: string) =>
    p && az.esegui(async () => { const v = await azionePreventivo(p.id, azione, body); setPerso(false); onFatto(v); }, ok);
  return (
    <Foglio
      largo
      aperto={p !== null}
      titolo={p ? `${p.ragione_sociale}` : ''}
      onChiudi={chiudi}
      piede={
        p && (
          <>
            <button type="button" className="btn-ghost" onClick={() => az.esegui(() => scaricaPreventivo(p.id, p.numero))}>
              <Scarica size={16} aria-hidden /> PDF
            </button>
            {crea && ['bozza', 'inviato'].includes(p.stato) && (
              <button type="button" className="btn-ghost" onClick={() => setPerso(true)}>
                Segna come perso
              </button>
            )}
            {!crea && ['bozza', 'inviato'].includes(p.stato) && <Blocco>Lo invia chi crea i preventivi: vendite, coordinatore o segreteria</Blocco>}
            {crea && p.stato === 'perso' && (
              <button type="button" className="btn-ghost" onClick={() => fai('riapri', undefined, 'Riaperto come bozza.')}>
                Riapri come bozza
              </button>
            )}
            {crea && ['bozza', 'inviato'].includes(p.stato) && (
              <button type="button" className="btn-primary" disabled={az.occupato || p.azienda_id === null} onClick={() => fai('invia', undefined, 'Preventivo inviato all\'azienda.')}>
                {p.stato === 'inviato' ? 'Invia di nuovo' : 'Invia all\'azienda'}
              </button>
            )}
          </>
        )
      }
    >
      {p && (
        <div className="mb-4">
          <Schede<'preventivo' | 'confronto'>
            etichetta="Scheda del preventivo"
            voci={[
              { k: 'preventivo', t: 'Preventivo' },
              { k: 'confronto', t: 'Confronto' },
            ]}
            attiva={scheda}
            onCambia={setScheda}
          />
        </div>
      )}
      {p && scheda === 'confronto' && <ConfrontoVenditore preventivoId={p.id} />}
      {p && scheda === 'preventivo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipStato c={chip(STATI_PREVENTIVO, p.stato)} />
            <span className="text-[13px] text-ink-muted">
              {p.numero} · creato il {dataIt(p.creato)}
              {p.referente ? ` · ${p.referente}` : ''}
            </span>
          </div>
          {p.azienda_id === null && <Avviso tono="warn">Contatto non ancora cliente: collega il preventivo a un&apos;azienda per inviarlo nella sua area.</Avviso>}
          {p.stato === 'inviato' && <Avviso>In attesa dell&apos;accettazione del titolare · inviato {p.giorni_nello_stato} giorni fa.</Avviso>}
          {p.stato === 'perso' && p.motivo_perso && <Avviso>Perso: {p.motivo_perso.replace(/_/g, ' ')}</Avviso>}
          {p.stato === 'accettato' && (
            <div className="space-y-2 rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <p className="text-[15px] font-medium text-ink">Incasso del primo canone</p>
              <p className="text-[13px] text-ink-muted">Il servizio parte all&apos;incasso: registralo quando arriva il bonifico. Si apre l&apos;avvio del cliente.</p>
              {incasso ? (
                <div className="flex flex-wrap gap-2">
                  <input className="input-field max-w-[18rem]" placeholder="Riferimento del bonifico" value={rif} onChange={(e) => setRif(e.target.value)} />
                  <button type="button" className="btn-acido" disabled={az.occupato || rif.trim() === ''} onClick={() => fai('incasso', { riferimento: rif }, 'Incasso registrato: avvio aperto.')}>
                    Registra l&apos;incasso
                  </button>
                </div>
              ) : (
                <Blocco>Lo registra l&apos;amministrazione</Blocco>
              )}
            </div>
          )}
          <DettaglioPreventivo p={p} />
          {perso && (
            <div className="space-y-3">
              <Campo etichetta="Motivo">
                <select className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  {MOTIVI.map((m) => (
                    <option key={m.k} value={m.k}>
                      {m.t}
                    </option>
                  ))}
                </select>
              </Campo>
              <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => fai('perso', { motivo }, 'Segnato come perso.')}>
                Conferma
              </button>
            </div>
          )}
        </div>
      )}
      {az.messaggio}
    </Foglio>
  );
}

function FoglioOrdineStudio({ o, amm, onChiudi, onFatto }: { o: Ordine | null; amm: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [valore, setValore] = useState('');
  const az = useAzione();
  const fatto = (ok: boolean) => {
    if (ok) {
      setValore('');
      onFatto();
    }
  };
  return (
    <Foglio aperto={o !== null} titolo={o?.titolo ?? ''} onChiudi={onChiudi}>
      {o && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChipStato c={chip(STATI_ORDINE, o.stato)} />
            <span className="text-[13px] text-ink-muted">
              {o.azienda} · {o.numero}
            </span>
          </div>
          <div>
            <Voce k="Importo" v={o.importo !== null ? euro(o.importo) : 'Da definire'} />
            {o.tempi && <Voce k="Tempi" v={o.tempi} />}
            {o.richiesto_da && <Voce k="Richiesto da" v={o.richiesto_da} />}
          </div>
          {o.stato === 'preventivo_richiesto' && (
            <div className="flex flex-wrap gap-2">
              <input className="input-field max-w-[12rem]" inputMode="decimal" placeholder="Prezzo in euro" value={valore} onChange={(e) => setValore(e.target.value)} />
              <button type="button" className="btn-primary" disabled={az.occupato || importoDaTesto(valore) === null} onClick={() => az.esegui(() => azioneOrdineStudio(o.id, 'prezzo', { importo: importoDaTesto(valore) }), 'Prezzo inviato al titolare.').then(fatto)}>
                Indica il prezzo
              </button>
            </div>
          )}
          {o.stato === 'attesa_pagamento' && amm && (
            <div className="flex flex-wrap gap-2">
              <input className="input-field max-w-[16rem]" placeholder="Riferimento del bonifico" value={valore} onChange={(e) => setValore(e.target.value)} />
              <button type="button" className="btn-primary" disabled={az.occupato || valore.trim() === ''} onClick={() => az.esegui(() => azioneOrdineStudio(o.id, 'pagamento', { riferimento: valore }), 'Pagamento registrato: il lavoro è in coda.').then(fatto)}>
                Registra il pagamento
              </button>
            </div>
          )}
          {o.stato === 'in_corso' && (
            <button type="button" className="btn-acido" disabled={az.occupato} onClick={() => az.esegui(() => azioneOrdineStudio(o.id, 'consegna', {}), 'Consegnato: l\'azienda riceve la novità.').then(fatto)}>
              Segna consegnato
            </button>
          )}
          <ol className="space-y-2 border-l-2 border-perla-linea pl-4">
            {o.cronologia.map((c, i) => (
              <li key={i} className="text-[13.5px]">
                {c.testo}
                <span className="block text-[12px] text-ink-muted">{dataIt(c.data)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {az.messaggio}
    </Foglio>
  );
}

/** Avanzamento (3.2): quattro colonne per stato, sotto i persi. */
function Avanzamento({ voci, onApri }: { voci: Preventivo[]; onApri: (p: Preventivo) => void }) {
  const persi = voci.filter((v) => v.stato === 'perso');
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLONNE_AVANZAMENTO.map((col) => {
          const qui = voci.filter((v) => colonnaDi(v.stato) === col.k);
          const totale = qui.reduce((t, v) => t + v.canone_mensile, 0);
          return (
            <section key={col.k} aria-label={col.t} className="space-y-2 rounded-[1.25rem] bg-perla-velo p-3">
              <header className="flex items-baseline justify-between gap-2 px-1">
                <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                  <span aria-hidden className={clsx('h-2 w-2 rounded-full', col.tono === 'info' ? 'bg-stato-info-segno' : col.tono === 'warn' ? 'bg-stato-warn-segno' : col.tono === 'ok' ? 'bg-stato-ok-segno' : 'bg-grafite-500')} />
                  {col.t} <span className="cifre text-ink-muted">{qui.length}</span>
                </span>
                <span className="cifre text-[12.5px] text-ink-muted">{cifra(totale)} € al mese</span>
              </header>
              {qui.length === 0 ? (
                <p className="rounded-[1rem] border border-dashed border-perla-linea px-3 py-4 text-center text-[13px] text-ink-muted">Nessuno</p>
              ) : (
                qui.map((v) => {
                  const eta = etaNelloStato(col.k, v.giorni_nello_stato);
                  return (
                    <button key={v.id} type="button" onClick={() => onApri(v)} className="block w-full rounded-[1rem] bg-white p-3 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1px_#c4c4c9]">
                      <span className="block text-[14px] font-medium text-ink">{v.ragione_sociale}</span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {v.referente ? `${v.referente} · ` : ''}
                        {v.dipendenti_con_sorveglianza + v.dipendenti_senza_sorveglianza} lavoratori
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="cifre text-ink">{cifra(v.canone_mensile)} €/mese</span>
                        <span className={eta.rosso ? 'text-stato-danger-segno' : 'text-ink-muted'}>{eta.testo}</span>
                      </span>
                      {v.fonte === 'Business Call AI' && <span className="mt-1.5 inline-block rounded-full bg-grafite-900 px-2 py-0.5 text-[11.5px] text-white">Arrivato in automatico</span>}
                    </button>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
      {persi.length > 0 && (
        <Scheda titolo="Persi">
          {persi.map((v) => (
            <Riga
              key={v.id}
              onClick={() => onApri(v)}
              titolo={v.ragione_sociale}
              sotto={`${v.motivo_perso ? v.motivo_perso.replace(/_/g, ' ') : 'Motivo non indicato'} · ${dataIt(v.creato)}`}
              fine={<span className="cifre text-[13px] text-ink-muted">{cifra(v.canone_mensile)} € al mese</span>}
            />
          ))}
        </Scheda>
      )}
    </div>
  );
}

/** Listino (3.3), sola lettura. */
function Listino() {
  const th = 'px-3 py-2 text-left text-[12.5px] font-medium text-ink-muted';
  const td = 'px-3 py-2 text-[13.5px] text-ink';
  return (
    <div className="space-y-5">
      <Avviso>
        <strong className="font-medium">Listino 2026-10, in vigore dal 1° ottobre 2026</strong>
        <br />
        Importi prima dell&apos;IVA. Ogni abbonamento conserva il listino della data di ingresso; i prezzi restano bloccati per 36 mesi.
      </Avviso>
      <Scheda titolo="Canone">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem]">
            <thead>
              <tr className="border-b border-perla-linea">
                <th className={th}>Codice</th>
                <th className={th}>Voce</th>
                <th className={th}>Unità</th>
                <th className={clsx(th, 'text-right')}>Al mese</th>
                <th className={clsx(th, 'text-right')}>All&apos;anno</th>
              </tr>
            </thead>
            <tbody>
              {LISTINO_CANONE.map(([k, v, u, m]) => (
                <tr key={k} className="border-b border-perla-linea last:border-b-0">
                  <td className={clsx(td, 'font-mono text-[12.5px]')}>{k}</td>
                  <td className={td}>{v}</td>
                  <td className={clsx(td, 'text-ink-muted')}>{u}</td>
                  <td className={clsx(td, 'cifre text-right')}>{cifra(m)} €</td>
                  <td className={clsx(td, 'cifre text-right')}>{cifra(m * 12)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Scheda>
      <Scheda titolo="Quote d’ingresso e servizi a richiesta" sotto="Una tantum">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem]">
            <tbody>
              {LISTINO_UNA_TANTUM.map(([k, v, m]) => (
                <tr key={k} className="border-b border-perla-linea last:border-b-0">
                  <td className={clsx(td, 'font-mono text-[12.5px]')}>{k}</td>
                  <td className={td}>{v}</td>
                  <td className={clsx(td, 'cifre text-right')}>{cifra(m)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Scheda>
      <Scheda titolo="Quota associativa Conflavoro" sotto="Pagata a Conflavoro, non fatturata da ISFOR. Oltre 100 dipendenti l’offerta standard non si applica: serve un preventivo su misura.">
        {LISTINO_QUOTE.map(([f, d, q]) => (
          <Riga key={f} titolo={`Fascia ${f}`} sotto={d} fine={<span className="cifre text-[13.5px] text-ink">{cifra(q)} € l&apos;anno</span>} />
        ))}
      </Scheda>
    </div>
  );
}
