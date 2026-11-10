'use client';

import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, ChipStato, Pillole, useAziendeStudio, useAzione, useCarico } from '../amministrazione-kit';
import { RiquadroSaldo } from '../azienda/Wallet';
import { caricaFattura, contrattoAzienda, movimentoWallet, quadroWallet, salvaContratto, walletAzienda } from '@/lib/portale/amministrazione-api';
import { STATI_FATTURA, TIPI_MOVIMENTO, chip, euro, euroSegno, importoDaTesto } from '@/lib/portale/amministrazione-logica';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { Portafoglio } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { Bonifici, Budget, Campagne, Regalati } from './CreditiSchede';

type SchedaCrediti = 'aziende' | 'regalati' | 'campagne' | 'budget' | 'bonifici';

type Azione = 'ricarica' | 'omaggio' | 'rettifica';

/** Crediti e wallet (SPEC_GESTIONALE 16): solo titolare dello studio e staff Conflavoro. Registro interno, nessun incasso. */
export default function Crediti() {
  const { user, versione, ricarica, aziendaScelta } = usePortale();
  const azId = aziendaScelta?.id ?? null;
  const amm = user.role === 'titolare_studio' || user.role === 'admin_conflavoro';
  const aziende = useAziendeStudio();
  const [aperta, setAperta] = useState<number | null>(null);
  const [scheda, setScheda] = useState<SchedaCrediti>('aziende');
  const q = useCarico(() => (amm ? quadroWallet() : Promise.resolve(null)), [amm, versione]);

  if (!amm) {
    return (
      <div className="space-y-5">
        <Testata categoria="pagamenti" icona={Portafoglio} sopra={aziendaScelta?.ragione_sociale ?? 'Amministrazione'} titolo="Crediti e wallet" />
        <Blocco>Wallet e crediti li gestiscono il titolare dello studio e lo staff Conflavoro.</Blocco>
      </div>
    );
  }
  // Con il cliente scelto: solo la sua riga e i suoi movimenti.
  const righe = (q.dati?.aziende ?? []).filter((a) => !azId || numero(a.azienda_id) === azId);
  const recenti = (q.dati?.recenti ?? []).filter((m) => !azId || m.ragione_sociale === aziendaScelta?.ragione_sociale);
  return (
    <div className="space-y-5">
      <Testata categoria="pagamenti" icona={Portafoglio} sopra={aziendaScelta?.ragione_sociale ?? 'Amministrazione'} titolo="Crediti e wallet" sotto={q.dati?.nota ?? undefined} />
      {q.errore && <Errore testo={q.errore} onRiprova={q.carica} />}
      <Schede<SchedaCrediti>
        etichetta="Sezioni di crediti e wallet"
        attiva={scheda}
        onCambia={setScheda}
        voci={[{ k: 'aziende', t: 'Wallet delle aziende' }, { k: 'regalati', t: 'Crediti regalati' }, { k: 'campagne', t: 'Campagne' }, { k: 'budget', t: 'Budget omaggi' }, { k: 'bonifici', t: 'Bonifici' }]}
      />
      {scheda === 'regalati' && <Regalati aziende={aziende} />}
      {scheda === 'campagne' && <Campagne />}
      {scheda === 'budget' && <Budget />}
      {scheda === 'bonifici' && <Bonifici aziende={aziende} />}
      {scheda === 'aziende' && !q.dati && !q.errore && <Caricamento />}
      {scheda === 'aziende' && q.dati && (
        <>
          {!azId && (
          <div className="grid grid-cols-2 gap-3">
            <Riquadro nero etichetta="Fondi dei clienti nei wallet" valore={euro(q.dati.fondi).replace(' €', '')} unita="€" sotto="Da erogare: debito verso i clienti finché non si consuma" />
            <Riquadro etichetta="Crediti omaggio attivi" valore={euro(q.dati.omaggio).replace(' €', '')} unita="€" />
          </div>
          )}
          {azId ? (
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setAperta(azId)}>
              Apri il wallet di {aziendaScelta?.ragione_sociale}
            </button>
          ) : (
          <Scheda titolo="Apri il wallet di un'azienda">
            <select className="input-field" value={aperta ?? 0} onChange={(e) => setAperta(Number(e.target.value) || null)}>
              <option value={0}>Scegli l&apos;azienda</option>
              {aziende.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ragione_sociale}
                </option>
              ))}
            </select>
          </Scheda>
          )}
          <Scheda titolo={azId ? 'Wallet' : 'Wallet delle aziende'}>
            {righe.length === 0 ? (
              <Vuoto titolo="Nessun movimento">Registra la prima ricarica quando arriva un bonifico.</Vuoto>
            ) : (
              righe.map((a) => (
                <Riga
                  key={numero(a.azienda_id) ?? 0}
                  onClick={() => setAperta(numero(a.azienda_id))}
                  titolo={testo(a.ragione_sociale) ?? ''}
                  sotto={`Fondi ${euro(numero(a.fondi))} · omaggio ${euro(numero(a.omaggio))}${(numero(a.in_scadenza_30) ?? 0) > 0 ? ` · ${euro(numero(a.in_scadenza_30))} in scadenza` : ''}`}
                  fine={<span className="cifre text-[15px]">{euro(numero(a.totale))}</span>}
                />
              ))
            )}
          </Scheda>
          <Scheda titolo="Movimenti recenti">
            {recenti.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessun movimento.</p>
            ) : (
              recenti.map((m) => (
                <Riga key={m.id} titolo={m.causale} sotto={`${m.ragione_sociale ?? ''} · ${dataIt(m.creato)} · ${TIPI_MOVIMENTO[m.tipo] ?? m.tipo}`} fine={<span className={clsx('cifre text-[15px]', m.importo > 0 && 'text-stato-ok-segno')}>{euroSegno(m.importo)}</span>} />
              ))
            )}
          </Scheda>
        </>
      )}
      <FoglioAzienda id={aperta} nome={aziende.find((a) => a.id === aperta)?.ragione_sociale ?? (aperta === azId ? aziendaScelta?.ragione_sociale ?? '' : '')} onChiudi={() => setAperta(null)} onFatto={() => { q.carica(); ricarica(); }} />
    </div>
  );
}

function FoglioAzienda({ id, nome, onChiudi, onFatto }: { id: number | null; nome: string; onChiudi: () => void; onFatto: () => void }) {
  const [scheda, setScheda] = useState<'wallet' | 'contratto'>('wallet');
  const [azione, setAzione] = useState<Azione>('ricarica');
  const [f, setF] = useState({ importo: '', riferimento: '', motivo: '', scade_il: '', negativo: false });
  const w = useCarico(() => (id ? walletAzienda(id) : Promise.resolve(null)), [id]);
  const k = useCarico(() => (id ? contrattoAzienda(id) : Promise.resolve(null)), [id]);
  const az = useAzione();
  const importo = importoDaTesto(f.importo);
  const registra = () =>
    id &&
    importo !== null &&
    az
      .esegui(
        () =>
          movimentoWallet(id, azione, azione === 'ricarica' ? { importo, riferimento: f.riferimento } : azione === 'omaggio' ? { importo, scade_il: f.scade_il, motivo: f.motivo, ambiti: ['servizi', 'canone', 'quota_ingresso'] } : { importo, motivo: f.motivo, consenti_negativo: f.negativo }),
        'Movimento registrato.'
      )
      .then((ok) => {
        if (ok) {
          setF({ importo: '', riferimento: '', motivo: '', scade_il: '', negativo: false });
          w.carica();
          onFatto();
        }
      });
  return (
    <Foglio largo aperto={id !== null} titolo={nome || 'Wallet'} onChiudi={onChiudi}>
      <div className="space-y-4">
        <Schede etichetta="Wallet e contratto" attiva={scheda} onCambia={setScheda} voci={[{ k: 'wallet', t: 'Wallet' }, { k: 'contratto', t: 'Contratto e fatture' }]} />
        {scheda === 'wallet' && (
          <>
            {w.errore && <Errore testo={w.errore} onRiprova={w.carica} />}
            {w.dati && <RiquadroSaldo saldo={w.dati.saldo} />}
            <Scheda titolo="Registra un movimento" sotto="Le ricariche si registrano quando arriva il bonifico. Un errore si corregge con una rettifica.">
              <div className="space-y-3">
                <Pillole etichetta="Tipo di movimento" attiva={azione} onCambia={setAzione} voci={[{ k: 'ricarica', t: 'Ricarica' }, { k: 'omaggio', t: 'Regala crediti' }, { k: 'rettifica', t: 'Rettifica' }]} />
                <Campo etichetta={azione === 'rettifica' ? 'Importo con il segno (es. -12,50)' : 'Importo in euro'}>
                  <input className="input-field" inputMode="decimal" value={f.importo} onChange={(e) => setF({ ...f, importo: e.target.value })} />
                </Campo>
                {azione === 'ricarica' && (
                  <Campo etichetta="Riferimento" aiuto="Numero o data del bonifico ricevuto.">
                    <input className="input-field" value={f.riferimento} onChange={(e) => setF({ ...f, riferimento: e.target.value })} />
                  </Campo>
                )}
                {azione !== 'ricarica' && (
                  <Campo etichetta="Motivo">
                    <input className="input-field" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
                  </Campo>
                )}
                {azione === 'omaggio' && (
                  <Campo etichetta="Scadenza" aiuto="Al massimo 1.000 euro per volta. Non pagano mai la quota associativa.">
                    <input className="input-field" type="date" value={f.scade_il} onChange={(e) => setF({ ...f, scade_il: e.target.value })} />
                  </Campo>
                )}
                {azione === 'rettifica' && (
                  <label className="flex min-h-[44px] items-center gap-3 text-[14px]">
                    <input type="checkbox" className="h-5 w-5" checked={f.negativo} onChange={(e) => setF({ ...f, negativo: e.target.checked })} />
                    Autorizzo il saldo negativo dei fondi
                  </label>
                )}
                <button type="button" className="btn-primary" disabled={az.occupato || importo === null} onClick={registra}>
                  Registra
                </button>
              </div>
            </Scheda>
            {w.dati && (
              <Scheda titolo="Registro del wallet">
                {w.dati.movimenti.length === 0 ? (
                  <p className="text-[14px] text-ink-muted">Nessun movimento.</p>
                ) : (
                  w.dati.movimenti.map((m) => (
                    <Riga key={m.id} titolo={m.causale} sotto={`${dataIt(m.creato)} · ${TIPI_MOVIMENTO[m.tipo] ?? m.tipo}${m.riferimento ? ` · ${m.riferimento}` : ''}`} fine={<span className={clsx('cifre text-[15px]', m.importo > 0 && 'text-stato-ok-segno')}>{euroSegno(m.importo)}</span>} />
                  ))
                )}
              </Scheda>
            )}
          </>
        )}
        {scheda === 'contratto' && id && (k.dati ? <ContrattoFatture key={`${id}-${k.dati.contratto ? 'c' : 'n'}`} id={id} dati={k.dati} onFatto={() => { k.carica(); onFatto(); }} /> : <Caricamento />)}
      </div>
      {az.messaggio}
    </Foglio>
  );
}

function ContrattoFatture({ id, dati, onFatto }: { id: number; dati: Record<string, unknown> | null; onFatto: () => void }) {
  const c = dati ? rec(dati.contratto) : {};
  const [righe, setRighe] = useState<Array<{ voce: string; quantita: string; mensile: string }>>(() =>
    lista(c.righe).length ? lista(c.righe).map((r) => ({ voce: testo(rec(r).voce) ?? '', quantita: String(numero(rec(r).quantita) ?? 1), mensile: String(numero(rec(r).mensile) ?? 0).replace('.', ',') })) : [{ voce: 'Canone sicurezza e medicina', quantita: '1', mensile: '9,90' }]
  );
  const [periodo, setPeriodo] = useState({ inizio: testo(c.inizio) ?? '', fine: testo(c.fine) ?? '' });
  const [fatt, setFatt] = useState({ numero: '', data: '', voce: '', importo: '' });
  const [file, setFile] = useState<File | null>(null);
  const az = useAzione();
  return (
    <div className="space-y-4">
      <Scheda titolo="Contratto" sotto={testo(c.numero) ? `Contratto ${testo(c.numero)} · ${testo(c.stato)?.replace(/_/g, ' ')}` : 'Nessun contratto: compila le righe del canone.'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Dal">
              <input className="input-field" type="date" value={periodo.inizio} onChange={(e) => setPeriodo({ ...periodo, inizio: e.target.value })} />
            </Campo>
            <Campo etichetta="Al">
              <input className="input-field" type="date" value={periodo.fine} onChange={(e) => setPeriodo({ ...periodo, fine: e.target.value })} />
            </Campo>
          </div>
          {righe.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_4rem_5.5rem] gap-2">
              <input className="input-field" aria-label="Voce" value={r.voce} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, voce: e.target.value } : y)))} />
              <input className="input-field" aria-label="Quantità" inputMode="numeric" value={r.quantita} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, quantita: e.target.value } : y)))} />
              <input className="input-field" aria-label="Prezzo al mese" inputMode="decimal" value={r.mensile} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, mensile: e.target.value } : y)))} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setRighe((x) => [...x, { voce: '', quantita: '1', mensile: '' }])}>
              Aggiungi una riga
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={az.occupato || !periodo.inizio || !periodo.fine}
              onClick={() => az.esegui(() => salvaContratto(id, { inizio: periodo.inizio, fine: periodo.fine, righe: righe.map((r) => ({ voce: r.voce, quantita: Number(r.quantita) || 0, mensile: importoDaTesto(r.mensile) ?? 0 })) }), 'Contratto salvato.').then((ok) => ok && onFatto())}
            >
              Salva il contratto
            </button>
          </div>
        </div>
      </Scheda>
      <Scheda titolo="Carica una fattura" sotto="Il PDF va nella cartella Contratto del fascicolo. La fatturazione elettronica resta al vostro gestionale contabile.">
        <div className="space-y-3">
          <input type="file" accept="application/pdf" className="block w-full text-[14px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Numero">
              <input className="input-field" value={fatt.numero} onChange={(e) => setFatt({ ...fatt, numero: e.target.value })} />
            </Campo>
            <Campo etichetta="Data">
              <input className="input-field" type="date" value={fatt.data} onChange={(e) => setFatt({ ...fatt, data: e.target.value })} />
            </Campo>
            <Campo etichetta="Voce">
              <input className="input-field" value={fatt.voce} onChange={(e) => setFatt({ ...fatt, voce: e.target.value })} />
            </Campo>
            <Campo etichetta="Importo">
              <input className="input-field" inputMode="decimal" value={fatt.importo} onChange={(e) => setFatt({ ...fatt, importo: e.target.value })} />
            </Campo>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={az.occupato || !file || !fatt.numero || !fatt.data || importoDaTesto(fatt.importo) === null}
            onClick={() => file && az.esegui(() => caricaFattura(id, file, { ...fatt, importo: String(importoDaTesto(fatt.importo)) }), 'Fattura caricata: l\'azienda riceve la novità.').then((ok) => ok && onFatto())}
          >
            Carica la fattura
          </button>
        </div>
      </Scheda>
      {dati && (
        <Scheda titolo="Fatture">
          {lista(dati.fatture).length === 0 ? (
            <p className="text-[14px] text-ink-muted">Nessuna fattura.</p>
          ) : (
            lista(dati.fatture).map((x) => {
              const r = rec(x);
              return <Riga key={numero(r.id) ?? 0} titolo={testo(r.numero) ?? ''} sotto={`${dataIt(testo(r.data))} · ${testo(r.voce)} · ${euro(numero(r.importo))}`} fine={<ChipStato c={chip(STATI_FATTURA, testo(r.stato))} />} />;
            })
          )}
        </Scheda>
      )}
      <Avviso>Punto di aggancio per i pagamenti con carta e SEPA: quando sarà attivo, gli incassi arriveranno da soli in questo registro.</Avviso>
      {az.messaggio}
    </div>
  );
}
