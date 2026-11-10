'use client';

import { useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riga, Riquadro, Scheda, Vuoto, dataIt, type StatoChip } from '../../kit';
import { Avviso, Campo, useAzione, useCarico } from '../amministrazione-kit';
import { crediti, euro, type R } from '@/lib/portale/amministrazione-pagamenti';
import { lista, numero, rec, testo } from '@/lib/portale/api';

/**
 * Schede del gestionale Crediti e wallet (schermate del gestionale, 12):
 * crediti regalati con approvazione oltre 100 euro, campagne, budget degli
 * omaggi, bonifici da abbinare.
 */
const AMBITI: Array<[string, string]> = [
  ['servizi', 'Servizi aggiuntivi'],
  ['canone', 'Canone e rinnovo'],
  ['quota_ingresso', 'Quota d\'ingresso'],
];

const STATI: Record<string, [StatoChip, string]> = {
  attivo: ['ok', 'Attivo'], da_approvare: ['approve', 'Da approvare'], rifiutato: ['neutral', 'Rifiutato'], revocato: ['neutral', 'Revocato'],
  attiva: ['ok', 'Attiva'], bozza: ['neutral', 'Bozza'], chiusa: ['neutral', 'Chiusa'], rifiutata: ['neutral', 'Rifiutata'],
};

const ambitiTesto = (a: unknown) => lista(a).map((x) => AMBITI.find(([k]) => k === x)?.[1] ?? String(x)).join(', ');

function StatoC({ s }: { s: string }) {
  const [c, t] = STATI[s] ?? ['neutral', s];
  return <Chip stato={c}>{t}</Chip>;
}

export function Regalati({ aziende }: { aziende: Array<{ id: number; ragione_sociale: string }> }) {
  const q = useCarico(() => crediti.regalati(), []);
  const az = useAzione();
  const [aperto, setAperto] = useState(false);
  const [rifiuta, setRifiuta] = useState<{ tipo: 'credito' | 'campagna'; id: number } | null>(null);
  const [motivo, setMotivo] = useState('');
  if (q.errore) return <Errore testo={q.errore} onRiprova={q.carica} />;
  if (!q.dati) return <Caricamento />;
  const d = q.dati;
  const puoA = d.puo_approvare === true;
  const decidi = (tipo: 'credito' | 'campagna', id: number) =>
    az.esegui(async () => testo((await crediti.decidi(tipo, id, 'approva')).messaggio)).then((ok) => ok && q.carica());
  const daApprovare = lista(d.da_approvare).map(rec);
  const campagne = lista(d.campagne_da_approvare).map(rec);
  return (
    <div className="space-y-4">
      {d.puo_regalare === true ? (
        <button type="button" className="btn-acido" onClick={() => setAperto(true)}>
          Regala crediti
        </button>
      ) : (
        <Blocco>Regalare crediti è dell&apos;amministrazione, della segreteria e del coordinatore</Blocco>
      )}
      {(daApprovare.length > 0 || campagne.length > 0) && (
        <Scheda titolo="Da approvare" sotto={`Oltre ${euro(numero(d.soglia) ?? 100)} per azienda o per una campagna decide l'amministrazione${puoA ? '' : ': tu vedi solo lo stato'}`}>
          {daApprovare.map((r) => (
            <Riga
              key={`c${numero(r.id)}`}
              titolo={`${euro(numero(r.importo) ?? 0)} a ${testo(r.azienda)}`}
              sotto={`${testo(r.motivo)} · ${ambitiTesto(r.ambiti)} · scade il ${dataIt(testo(r.scadenza))} · già regalati quest'anno ${euro(numero(r.gia_regalati) ?? 0)}`}
              fine={puoA ? (
                <span className="flex gap-2">
                  <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => void decidi('credito', numero(r.id) ?? 0)}>Approva</button>
                  <button type="button" className="btn-ghost" onClick={() => setRifiuta({ tipo: 'credito', id: numero(r.id) ?? 0 })}>Rifiuta</button>
                </span>
              ) : <Chip stato="approve">Attende l&apos;amministrazione</Chip>}
            />
          ))}
          {campagne.map((k) => (
            <Riga
              key={`k${numero(k.id)}`}
              titolo={`Campagna: ${testo(k.nome)}`}
              sotto={`${numero(k.aziende)} aziende × ${euro(numero(k.per_azienda) ?? 0)} = ${euro(numero(k.costo) ?? 0)} · ${testo(k.segmento)} · Ogni campagna su più aziende passa dall'amministrazione.`}
              fine={puoA ? (
                <span className="flex gap-2">
                  <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => void decidi('campagna', numero(k.id) ?? 0)}>Approva</button>
                  <button type="button" className="btn-ghost" onClick={() => setRifiuta({ tipo: 'campagna', id: numero(k.id) ?? 0 })}>Rifiuta</button>
                </span>
              ) : <Chip stato="approve">Attende l&apos;amministrazione</Chip>}
            />
          ))}
        </Scheda>
      )}
      <Scheda titolo={`Tutti i crediti regalati nel ${new Date().getFullYear()}`}>
        {lista(d.anno).length === 0 ? (
          <Vuoto titolo="Nessun credito regalato quest'anno" />
        ) : (
          lista(d.anno).map(rec).map((r) => (
            <Riga
              key={numero(r.id) ?? 0}
              titolo={`${euro(numero(r.importo) ?? 0)} a ${testo(r.azienda)}`}
              sotto={`${dataIt(testo(r.creato))} · ${testo(r.motivo)} · usati ${euro(numero(r.usato) ?? 0)} · ${ambitiTesto(r.ambiti)} · scade il ${dataIt(testo(r.scadenza))}`}
              fine={<StatoC s={testo(r.stato) ?? ''} />}
            />
          ))
        )}
        <p className="mt-2 text-[12.5px] text-ink-muted">Ogni credito ha un motivo, un autore, una scadenza e un ambito di spesa. Non si converte in denaro, non si trasferisce ad altre aziende e alla scadenza si azzera.</p>
      </Scheda>
      {az.messaggio}
      <FoglioRegala aperto={aperto} aziende={aziende} motivi={lista(d.motivi).map(String)} onChiudi={() => setAperto(false)} onFatto={q.carica} />
      <Foglio
        aperto={rifiuta !== null}
        titolo="Rifiuta la richiesta"
        onChiudi={() => setRifiuta(null)}
        piede={
          <button type="button" className="btn-primary" disabled={!motivo.trim()} onClick={() => rifiuta && void az.esegui(() => crediti.decidi(rifiuta.tipo, rifiuta.id, 'rifiuta', motivo), 'Richiesta rifiutata, l\'autore è stato avvisato').then(() => { setRifiuta(null); setMotivo(''); q.carica(); })}>
            Rifiuta
          </button>
        }
      >
        <Campo etichetta="Motivo" aiuto="Lo legge chi ha fatto la richiesta.">
          <input className="input-field" placeholder="Es. budget quasi esaurito, proponi 50 €" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </Foglio>
    </div>
  );
}

function FoglioRegala({ aperto, aziende, motivi, onChiudi, onFatto }: { aperto: boolean; aziende: Array<{ id: number; ragione_sociale: string }>; motivi: string[]; onChiudi: () => void; onFatto: () => void }) {
  const [f, setF] = useState({ azienda: 0, importo: '50', scadenza: `${new Date().getFullYear()}-12-31`, motivo: motivi[0] ?? 'Benvenuto', ambiti: ['servizi'], messaggio: '' });
  const [esito, setEsito] = useState<R | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const invia = async () => {
    setErr(null);
    if (!f.azienda) return setErr('Scegli l\'azienda.');
    try {
      setEsito(await crediti.regala(f.azienda, { importo: Number(f.importo.replace(',', '.')), scadenza: f.scadenza, motivo: f.motivo, ambiti: f.ambiti, messaggio: f.messaggio || null }));
      onFatto();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
    }
  };
  return (
    <Foglio aperto={aperto} titolo="Regala crediti" onChiudi={() => { setEsito(null); onChiudi(); }} piede={esito ? undefined : <button type="button" className="btn-primary" onClick={() => void invia()}>Regala {euro(Number(f.importo.replace(',', '.')) || 0)}</button>}>
      {esito ? (
        <div role="status">
          <p className="text-[16px] font-medium text-ink">{testo(esito.titolo)}</p>
          <p className="mt-1 text-[13.5px] text-ink-muted">{testo(esito.testo)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">Credito omaggio a una singola azienda</p>
          <Campo etichetta="Azienda">
            <select className="input-field" value={f.azienda} onChange={(e) => setF({ ...f, azienda: Number(e.target.value) })}>
              <option value={0}>Scegli</option>
              {aziende.map((a) => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Importo" aiuto="In euro"><input className="input-field" inputMode="decimal" value={f.importo} onChange={(e) => setF({ ...f, importo: e.target.value })} /></Campo>
          <Campo etichetta="Scadenza"><input type="date" className="input-field" value={f.scadenza} onChange={(e) => setF({ ...f, scadenza: e.target.value })} /></Campo>
          <Campo etichetta="Motivo">
            <select className="input-field" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>
              {motivi.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Campo>
          <fieldset className="space-y-1.5">
            <legend className="text-[12.5px] text-ink-muted">Spendibile su</legend>
            {AMBITI.map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-5 w-5 accent-[#18181B]" checked={f.ambiti.includes(k)} onChange={(e) => setF({ ...f, ambiti: e.target.checked ? [...f.ambiti, k] : f.ambiti.filter((x) => x !== k) })} />
                {t}
              </label>
            ))}
            <label className="flex items-center gap-2 text-[14px] text-ink-subtle">
              <input type="checkbox" disabled className="h-5 w-5" /> Quota associativa Conflavoro
            </label>
            <p className="text-[12px] text-ink-muted">Non ammessa: si versa a Conflavoro e non passa dal wallet.</p>
          </fieldset>
          <Campo etichetta="Messaggio al cliente"><textarea className="input-field" rows={2} value={f.messaggio} onChange={(e) => setF({ ...f, messaggio: e.target.value })} /></Campo>
          {err && <p className="text-[13px] text-stato-danger-ink">{err}</p>}
        </div>
      )}
    </Foglio>
  );
}

export function Campagne() {
  const q = useCarico(() => crediti.campagne(), []);
  const az = useAzione();
  const [nuova, setNuova] = useState(false);
  const [f, setF] = useState({ nome: '', segmento: 'tutte', importo: '30', scadenza: `${new Date().getFullYear() + 1}-03-31`, motivo: 'Campagna commerciale', ambiti: ['servizi'], messaggio: '' });
  const [stima, setStima] = useState<R | null>(null);
  if (q.errore) return <Errore testo={q.errore} onRiprova={q.carica} />;
  if (!q.dati) return <Caricamento />;
  const segmenti = rec(q.dati.segmenti);
  return (
    <div className="space-y-4">
      <button type="button" className="btn-primary" onClick={() => { setNuova(true); void crediti.stima(f.segmento, Number(f.importo)).then(setStima).catch(() => setStima(null)); }}>
        Nuova campagna
      </button>
      <Scheda titolo="Campagne di crediti omaggio" sotto="Crediti a un gruppo di aziende con una regola. Ogni campagna serve l'approvazione dell'amministrazione.">
        {lista(q.dati.campagne).length === 0 ? (
          <Vuoto titolo="Nessuna campagna" />
        ) : (
          lista(q.dati.campagne).map(rec).map((k) => (
            <Riga
              key={numero(k.id) ?? 0}
              titolo={testo(k.nome) ?? ''}
              sotto={`${testo(k.motivo)} · ${ambitiTesto(k.ambiti)} · ${numero(k.aziende)} aziende, ${testo(k.segmento)} · ${euro(numero(k.per_azienda) ?? 0)} per azienda · costo ${euro(numero(k.costo) ?? 0)}${k.stima ? ' stima' : ''} · usati ${euro(numero(k.usato) ?? 0)} · scade il ${dataIt(testo(k.scadenza))}`}
              fine={
                <span className="flex items-center gap-2">
                  <StatoC s={testo(k.stato) ?? ''} />
                  {k.stato === 'attiva' && (
                    <button type="button" className="btn-ghost" disabled={az.occupato} onClick={() => void az.esegui(() => crediti.chiudi(numero(k.id) ?? 0), 'Campagna chiusa: i crediti non usati tornano nel budget').then(() => q.carica())}>
                      Chiudi la campagna
                    </button>
                  )}
                </span>
              }
            />
          ))
        )}
      </Scheda>
      {az.messaggio}
      <Foglio
        aperto={nuova}
        largo
        titolo="Nuova campagna"
        onChiudi={() => setNuova(false)}
        piede={
          <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => void az.esegui(async () => testo((await crediti.nuovaCampagna({ ...f, importo: Number(f.importo.replace(',', '.')) })).messaggio)).then((ok) => { if (ok) { setNuova(false); q.carica(); } })}>
            Salva la campagna
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">Crediti omaggio a un gruppo di aziende</p>
          <Campo etichetta="Nome della campagna"><input className="input-field" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
          <Campo etichetta="Aziende">
            <select className="input-field" value={f.segmento} onChange={(e) => { setF({ ...f, segmento: e.target.value }); void crediti.stima(e.target.value, Number(f.importo)).then(setStima).catch(() => setStima(null)); }}>
              {Object.entries(segmenti).map(([k, t]) => <option key={k} value={k}>{String(t)}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Importo per azienda"><input className="input-field" inputMode="decimal" value={f.importo} onChange={(e) => setF({ ...f, importo: e.target.value })} onBlur={() => void crediti.stima(f.segmento, Number(f.importo.replace(',', '.'))).then(setStima).catch(() => setStima(null))} /></Campo>
          <Campo etichetta="Scadenza dei crediti"><input type="date" className="input-field" value={f.scadenza} onChange={(e) => setF({ ...f, scadenza: e.target.value })} /></Campo>
          {stima && (
            <div className={clsx('rounded-[1.25rem] p-4', stima.oltre_80 ? 'bg-oro-500 text-acido-950' : 'bg-grafite-950 text-white')}>
              <p className="text-[12.5px]">Stima del costo</p>
              <p className="cifre text-[24px] font-light">
                {euro(numero(stima.costo) ?? 0)} · {numero(stima.aziende)} aziende × {euro(Number(f.importo.replace(',', '.')) || 0)}
              </p>
              <p className="text-[12.5px]">
                Il budget omaggi arriverebbe al {numero(stima.budget_dopo_pct)}%{stima.oltre_80 ? ': oltre l\'80%, la direzione riceve un avviso' : ''}.
              </p>
            </div>
          )}
        </div>
      </Foglio>
    </div>
  );
}

export function Budget() {
  const q = useCarico(() => crediti.budget(), []);
  if (q.errore) return <Errore testo={q.errore} onRiprova={q.carica} />;
  if (!q.dati) return <Caricamento />;
  const b = q.dati;
  const p = numero(b.percentuale) ?? 0;
  const tot = numero(b.totale) ?? 1;
  const w = (v: unknown) => `${Math.min(100, ((numero(v) ?? 0) / tot) * 100)}%`;
  return (
    <div className="space-y-4">
      {b.avviso === 'oltre' ? (
        <Avviso tono="danger">Budget omaggi oltre l&apos;80%: {p}%. La direzione è stata avvisata. Le nuove richieste passano tutte dall&apos;amministrazione.</Avviso>
      ) : b.avviso === 'con_richieste' ? (
        <Avviso tono="warn">Con le richieste in approvazione si supera l&apos;80% ({numero(b.percentuale_con_richieste)}%). Superato l&apos;80% la direzione riceve un avviso.</Avviso>
      ) : (
        <Avviso tono="ok">Budget sotto controllo: {p}% usato o impegnato. Avviso automatico alla direzione oltre l&apos;80%.</Avviso>
      )}
      <Scheda titolo={`Budget annuo degli omaggi ${new Date().getFullYear()}`} sotto={`${euro(numero(b.residuo) ?? 0)} residui su ${euro(tot)}`}>
        <div className="relative flex h-4 overflow-hidden rounded-full bg-perla-velo" aria-label={`${p}% usato o impegnato`}>
          <span className="bg-grafite-950" style={{ width: w(b.speso) }} />
          <span className="bg-cat-pagamenti-segno" style={{ width: w(b.impegnato) }} />
          <span className="bg-[repeating-linear-gradient(45deg,#d4d4d8_0_4px,transparent_4px_8px)]" style={{ width: w(b.in_approvazione) }} />
          <span aria-hidden className="absolute inset-y-0 left-[80%] w-0.5 bg-stato-danger-segno" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Riquadro etichetta="Speso" valore={euro(numero(b.speso) ?? 0)} sotto="Usato dai clienti" />
          <Riquadro etichetta="Impegnato" valore={euro(numero(b.impegnato) ?? 0)} sotto="Crediti attivi non ancora usati" />
          <Riquadro etichetta="In approvazione" valore={euro(numero(b.in_approvazione) ?? 0)} sotto="Richieste oltre soglia e campagne" />
          <Riquadro etichetta="Tornati al budget" valore={euro(numero(b.tornati) ?? 0)} sotto="Scaduti o revocati" />
        </div>
      </Scheda>
      <Scheda titolo="Per motivo" sotto={`Crediti dati nel ${new Date().getFullYear()}`}>
        {Object.entries(rec(b.per_motivo)).map(([k, v]) => <Riga key={k} titolo={k} fine={<span className="cifre">{euro(numero(v) ?? 0)}</span>} />)}
      </Scheda>
    </div>
  );
}

export function Bonifici({ aziende }: { aziende: Array<{ id: number; ragione_sociale: string }> }) {
  const q = useCarico(() => crediti.bonifici(), []);
  const az = useAzione();
  const [abbina, setAbbina] = useState<R | null>(null);
  const [dest, setDest] = useState<{ destinazione: 'fattura' | 'fondi'; fattura_id: string; azienda_id: number }>({ destinazione: 'fondi', fattura_id: '', azienda_id: 0 });
  if (q.errore) return <Errore testo={q.errore} onRiprova={q.carica} />;
  if (!q.dati) return <Caricamento />;
  const d = q.dati;
  const da = lista(d.da_riconciliare).map(rec);
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-ink-muted">{testo(d.nota)}</p>
      <Scheda titolo={`Da riconciliare ${da.length}`}>
        {da.length === 0 ? (
          <Vuoto titolo="Tutti i bonifici sono abbinati" />
        ) : (
          da.map((b) => (
            <Riga
              key={numero(b.id) ?? 0}
              titolo={`${euro(numero(b.importo) ?? 0)} da ${testo(b.azienda) ?? testo(b.ordinante)}`}
              sotto={`${dataIt(testo(b.arrivato_il))} · ${testo(b.conto) === 'dedicato' ? 'IBAN dedicato' : `Conto generale · causale «${testo(b.causale) ?? ''}»`} · ${testo(b.perche)}`}
              fine={d.puo_riconciliare === true ? <button type="button" className="btn-primary" onClick={() => setAbbina(b)}>Abbina</button> : <Blocco>Solo l&apos;amministrazione</Blocco>}
            />
          ))
        )}
      </Scheda>
      <Scheda titolo={`In attesa di accredito ${lista(d.in_attesa).length}`} sotto="Un servizio pagato con bonifico parte all'accredito.">
        {lista(d.in_attesa).map(rec).map((p) => (
          <Riga key={numero(p.id) ?? 0} titolo={`${testo(p.azienda)} · ${testo(p.per)}`} sotto={`Scelto il ${dataIt(testo(p.scelto_il))} · ${numero(p.giorni)} giorni, di solito 1–2 lavorativi`} fine={<span className="cifre">{euro(numero(p.atteso) ?? 0)}</span>} />
        ))}
      </Scheda>
      <Scheda titolo="Accreditati">
        {lista(d.accreditati).map(rec).map((b) => (
          <Riga key={numero(b.id) ?? 0} titolo={`${testo(b.azienda) ?? ''} · ${euro(numero(b.importo) ?? 0)}`} sotto={`${dataIt(testo(b.abbinato_il))} · ${testo(b.destinazione) === 'fattura' ? 'Su fattura' : 'Nei fondi ricaricati'}`} />
        ))}
      </Scheda>
      {az.messaggio}
      <Foglio
        aperto={abbina !== null}
        largo
        titolo="Abbina il bonifico"
        onChiudi={() => setAbbina(null)}
        piede={
          <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => abbina && void az.esegui(async () => testo((await crediti.abbina(numero(abbina.id) ?? 0, dest.destinazione === 'fattura' ? { destinazione: 'fattura', fattura_id: Number(dest.fattura_id) } : { destinazione: 'fondi', azienda_id: dest.azienda_id })).titolo)).then((ok) => { if (ok) { setAbbina(null); q.carica(); } })}>
            Abbina
          </button>
        }
      >
        {abbina && (
          <div className="space-y-3">
            <p className="text-[13.5px] text-ink-muted">{euro(numero(abbina.importo) ?? 0)} del {dataIt(testo(abbina.arrivato_il))} · {testo(abbina.ordinante)}</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Dove va il bonifico">
              {(['fattura', 'fondi'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={dest.destinazione === k} onClick={() => setDest({ ...dest, destinazione: k })}
                  className={clsx('premi rounded-[1rem] px-3 py-2.5 text-[14px]', dest.destinazione === k ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}>
                  {k === 'fattura' ? 'Su una fattura aperta' : 'Nei fondi ricaricati di un\'azienda'}
                </button>
              ))}
            </div>
            {dest.destinazione === 'fattura' ? (
              <Campo etichetta="Numero interno della fattura"><input className="input-field" inputMode="numeric" value={dest.fattura_id} onChange={(e) => setDest({ ...dest, fattura_id: e.target.value })} /></Campo>
            ) : (
              <Campo etichetta="Azienda (solo per i fondi ricaricati)">
                <select className="input-field" value={dest.azienda_id} onChange={(e) => setDest({ ...dest, azienda_id: Number(e.target.value) })}>
                  <option value={0}>Scegli</option>
                  {aziende.map((a) => <option key={a.id} value={a.id}>{a.ragione_sociale}</option>)}
                </select>
              </Campo>
            )}
            <p className="text-[12.5px] text-ink-muted">L&apos;abbinamento resta nel registro con il tuo nome. Suggerisci al cliente di usare il suo IBAN dedicato: così lo riconosciamo da solo.</p>
          </div>
        )}
      </Foglio>
    </div>
  );
}
