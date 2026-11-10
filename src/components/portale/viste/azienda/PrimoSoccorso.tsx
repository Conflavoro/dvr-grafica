'use client';

import { useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riquadro, Schede, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Valigetta } from '@/components/portale/telefono/icone';
import { CerchioSpunta, Corso, Invia, Sirena, type IconaComponente } from '@/components/icone';
import { useLargo } from '../gestionale/comune';
import PrimoSoccorsoTel from './PrimoSoccorsoTel';
import { impostaContatori, toast } from '@/components/portale/telefono/stato';
import { clsx } from '@/lib/clsx';
import { ps, type Cassetta, type PrimoSoccorso as Dati, type ProdottoCassetta, type RispostaVerifica, type VoceDaFare } from '@/lib/portale/luoghi-api';
import { barretteGruppo, coseDaFare, erroriVerifica, traMesi, tuttiSi } from '@/lib/portale/luoghi-logica';
import { Avviso, Campo, Fatto, useCarica } from './comuni';

type SchedaPs = 'sintesi' | 'cassette' | 'verifiche' | 'addetti';
type FoglioPs = null | { verifica: number | null } | { sostituito: { cassetta: Cassetta; prodotto: ProdottoCassetta } } | 'aggiungi' | { nomina: number | null };

/** Primo soccorso (regole di business 17, DM 388/2003): gruppo, cassette, verifiche del mese, addetti. */
export default function PrimoSoccorso() {
  return useLargo() ? <PrimoSoccorsoComputer /> : <PrimoSoccorsoTel />;
}

/** Righe di "Cosa comporta" (icona, testo, fonte), uguali su computer e telefono. */
export function cosaComporta(d: Dati): Array<[IconaComponente, string, string]> {
  const cont = d.gruppo.contenitore.charAt(0).toUpperCase() + d.gruppo.contenitore.slice(1);
  return [
    [Valigetta as IconaComponente, `${cont} in ogni luogo di lavoro, con il contenuto minimo dell’Allegato ${d.gruppo.allegato}`, 'DM 388/2003, art. 2'],
    [CerchioSpunta, 'Contenuto sempre completo e in efficienza: lo verifichi ogni mese, prodotto per prodotto', 'DM 388/2003, art. 2'],
    [Corso, `Addetti al primo soccorso con il corso di ${d.gruppo.ore} ore, aggiornamento ogni 3 anni`, 'DM 388/2003, art. 3'],
    [Sirena, 'Un mezzo per chiamare subito il 112', 'DM 388/2003, art. 2'],
    ...(d.gruppo.g === 'A' ? [[Invia, 'Comunicazione all’ASL del gruppo di appartenenza: la prepara il tuo referente ISFOR', 'DM 388/2003, art. 1'] as [IconaComponente, string, string]] : []),
  ];
}

function PrimoSoccorsoComputer() {
  const { azienda, versione, sede, sedi } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: d, errore, carica, caricando } = useCarica(() => ps.vista(aid, sede), [aid, versione, sede]);
  const [scheda, setScheda] = useState<SchedaPs>('sintesi');
  const [foglio, setFoglio] = useState<FoglioPs>(null);
  useEffect(() => {
    if (d) impostaContatori({ primosoccorso: d.da_fare.length });
  }, [d]);
  if (!azienda) return null;
  const pacchetto = d?.gruppo.g === 'C';
  const Contenitore = pacchetto ? 'Pacchetti' : 'Cassette';
  const modifica = d?.permessi.modifica ?? false;
  const apriVerifica = (id: number | null = null) => {
    if (!d || d.cassette.length === 0) return toast('Aggiungi prima una cassetta', 'info');
    setFoglio({ verifica: id ?? d.cassette.find((k) => !k.verificata_mese)?.id ?? d.cassette[0].id });
  };
  const azioneTestata: Record<SchedaPs, { t: string; f: () => void } | null> = {
    sintesi: modifica && (d?.cassette.length ?? 0) > 0 ? { t: 'Fai la verifica del mese', f: () => apriVerifica() } : null,
    cassette: modifica ? { t: pacchetto ? 'Aggiungi pacchetto' : 'Aggiungi cassetta', f: () => setFoglio('aggiungi') } : null,
    verifiche: modifica && (d?.cassette.length ?? 0) > 0 ? { t: 'Fai la verifica', f: () => apriVerifica() } : null,
    addetti: modifica ? { t: 'Nomina un addetto', f: () => setFoglio({ nomina: null }) } : null,
  };
  const az = azioneTestata[scheda];
  const voce = (x: VoceDaFare) => {
    if (x.azione === 'verifica') apriVerifica(x.id);
    else if (x.azione === 'nomina') setFoglio({ nomina: x.id });
    else if (x.scheda) setScheda(x.scheda as SchedaPs);
  };
  const ind = d?.indicatori;

  return (
    <div className="space-y-5">
      <Testata
        categoria="primosoccorso"
        icona={Valigetta}
        titolo="Primo soccorso"
        sotto={d ? `Gruppo ${d.gruppo.g} · ${d.gruppo.contenitore} · ${d.da_fare.length > 0 ? coseDaFare(d.da_fare.length) : 'tutto in regola'}` : undefined}
        azioni={az ? <button type="button" className="btn btn-primary" onClick={az.f}>{az.t}</button> : undefined}
      />
      <Schede<SchedaPs>
        etichetta="Primo soccorso"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'sintesi', t: 'Sintesi', n: d?.da_fare.length },
          { k: 'cassette', t: Contenitore, n: d ? d.cassette.filter((k) => k.problemi > 0).length : undefined },
          { k: 'verifiche', t: 'Verifiche', n: ind?.da_verificare },
          { k: 'addetti', t: 'Addetti', n: ind?.sedi_senza_addetti },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !d && <Caricamento />}

      {d && scheda === 'sintesi' && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-caption uppercase text-fg-muted">Gruppo dell’azienda · DM 388/2003</p>
                  <p className="mt-1">
                    <span className="text-display">Gruppo {d.gruppo.g}</span> <span className="text-h3 text-fg-muted">· {d.gruppo.contenitore}</span>
                  </p>
                  <p className="mt-1 text-small text-fg-muted">{d.gruppo.motivo}</p>
                </div>
                <div className="flex items-end gap-1.5" aria-hidden>
                  {barretteGruppo(d.gruppo.g).map((acceso, i) => (
                    <span key={i} className={clsx('h-10 w-2.5 rounded-full', acceso ? 'bg-cat-primosoccorso-mark' : 'bg-sunken')} />
                  ))}
                </div>
              </div>
              <p className="mt-5 text-title">Cosa comporta</p>
              <ul className="mt-2 space-y-2.5">
                {cosaComporta(d).map(([I, t, f]) => (
                  <li key={t} className="flex gap-3">
                    <I size={20} aria-hidden className="mt-0.5 shrink-0 text-cat-primosoccorso-mark" />
                    <span>
                      <span className="block text-small">{t}</span>
                      <span className="block text-caption text-fg-muted">{f}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-caption text-fg-muted">
                Come lo calcoliamo: gruppo C con meno di 3 lavoratori; gruppo A se l’attività (codice ATECO) è a rischio alto e i lavoratori sono più di 5; gruppo B negli altri casi.
              </p>
            </section>
            <section className="rounded-hse-xl bg-acid-400 p-5 text-acid-950">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3">Da fare per il primo soccorso</h2>
                <span className="cifre grid h-7 min-w-7 place-items-center rounded-full bg-black px-2 text-[13px] text-acid-400">{d.da_fare.length}</span>
              </div>
              {d.da_fare.length === 0 ? (
                <p className="mt-3 rounded-hse-lg bg-white px-4 py-4 text-small text-fg">Niente da fare: cassette complete, verifiche fatte e addetti nominati.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {d.da_fare.map((x, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-hse-lg bg-white px-3 py-2.5">
                      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cat-primosoccorso text-cat-primosoccorso-ink"><Valigetta size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-small font-medium text-fg">{x.testo}</span>
                        {x.extra && <span className="block text-caption text-grafite-500">{x.extra}</span>}
                      </span>
                      <button type="button" className="btn btn-sm bg-grafite-900 text-white" onClick={() => voce(x)}>{x.pulsante}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Riquadro punto="bg-cat-primosoccorso-mark" etichetta={pacchetto ? 'Pacchetti in regola' : 'Cassette in regola'} valore={ind!.cassette_ok} unita={`/${ind!.cassette}`}
              sotto={ind!.cassette === 0 ? 'Nessuna registrata' : ind!.cassette_ok < ind!.cassette ? `${ind!.cassette - ind!.cassette_ok} con prodotti da sistemare` : 'Tutto presente e valido'} onClick={() => setScheda('cassette')} />
            <Riquadro punto="bg-cat-primosoccorso-mark" etichetta="Prodotti da sostituire" valore={ind!.da_sostituire} sotto={ind!.da_sostituire > 0 ? 'Scaduti o da ricomprare' : 'Nessuno'} onClick={() => setScheda('cassette')} />
            <Riquadro punto="bg-cat-primosoccorso-mark" etichetta="Prossima scadenza" valore={ind!.prossima_scadenza ? dataIt(ind!.prossima_scadenza, true) : 'n.d.'}
              unita={ind!.prossima_scadenza ? `/${ind!.prossima_scadenza.slice(0, 4)}` : undefined}
              sotto={ind!.prossima_scadenza ? traGiorni(ind!.prossima_scadenza) : 'Nessun prodotto con scadenza'} onClick={() => setScheda('cassette')} />
            <Riquadro punto="bg-cat-primosoccorso-mark" etichetta="Addetti al primo soccorso" valore={ind!.addetti} sotto={ind!.addetti > 0 ? `Corso di ${d.gruppo.ore} ore` : 'Nessun addetto nominato'} onClick={() => setScheda('addetti')} />
          </div>
        </>
      )}

      {d && scheda === 'cassette' && (
        <div className="space-y-5">
          <Avviso titolo={`Contenuto minimo: Allegato ${d.gruppo.allegato} del DM 388/2003`}>
            Il gruppo {d.gruppo.g} vuole {pacchetto ? 'il pacchetto di medicazione' : 'la cassetta di pronto soccorso'}. Tieni il contenuto completo e sostituisci i prodotti prima della scadenza: ti avvisiamo 30 giorni prima.
          </Avviso>
          {d.cassette.length === 0 ? (
            <Vuoto titolo={pacchetto ? 'Nessun pacchetto registrato' : 'Nessuna cassetta registrata'}
              azione={modifica ? <button type="button" className="btn btn-primary" onClick={() => setFoglio('aggiungi')}>Aggiungi</button> : undefined}>
              Aggiungi dove si trova: poi tieni d’occhio scadenze e verifiche da qui.
            </Vuoto>
          ) : (
            d.cassette.map((k) => (
              <section key={k.id} className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-cat-primosoccorso text-cat-primosoccorso-ink"><Valigetta size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-title">{k.posizione}</p>
                    <p className="text-small text-fg-muted">
                      {d.gruppo.contenitore.charAt(0).toUpperCase() + d.gruppo.contenitore.slice(1)}
                      {d.piu_sedi && k.sede ? ` · ${k.sede}` : ''} · {k.ultima_verifica ? `ultima verifica il ${dataIt(k.ultima_verifica)}` : 'mai verificata'}
                    </p>
                  </div>
                  {k.problemi > 0 ? <Chip stato="danger">{k.problemi} da sistemare</Chip> : <Chip stato="ok">Completa</Chip>}
                  {k.verificata_mese ? <Chip stato="ok">Verificata a {d.mese}</Chip> : <Chip stato="sign">Verifica da fare</Chip>}
                  {modifica && <button type="button" className="btn btn-secondary btn-sm" onClick={() => apriVerifica(k.id)}>Verifica</button>}
                </div>
                {k.problemi > 0 && (
                  <>
                    <p className="mt-4 text-small font-medium">Da sistemare</p>
                    <TabellaProdotti prodotti={k.prodotti.filter((p) => p.stato !== 'ok')} modifica={modifica} onSostituito={(p) => setFoglio({ sostituito: { cassetta: k, prodotto: p } })} />
                  </>
                )}
                <details className="mt-4" open={k.problemi === 0}>
                  <summary className="cursor-pointer text-small font-medium">Contenuto completo · {k.prodotti.length} prodotti (Allegato {d.gruppo.allegato} del DM 388/2003)</summary>
                  <TabellaProdotti prodotti={k.prodotti} modifica={modifica} onSostituito={(p) => setFoglio({ sostituito: { cassetta: k, prodotto: p } })} />
                </details>
              </section>
            ))
          )}
        </div>
      )}

      {d && scheda === 'verifiche' && <SchedaVerifiche d={d} modifica={modifica} onVerifica={() => apriVerifica()} />}

      {d && scheda === 'addetti' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <p className="text-small text-fg-muted">Corso per gli addetti · DM 388/2003</p>
              <p><span className="text-h1 font-light">{d.gruppo.ore}</span> ore</p>
              <p className="text-small">
                Addetto al primo soccorso: {d.gruppo.ore} ore per il gruppo {d.gruppo.g} {d.gruppo.g === 'A' ? '(12 per i gruppi B e C)' : '(16 per il gruppo A)'}. Aggiornamento ogni 3 anni.
              </p>
            </section>
            <Avviso titolo="Chi può essere addetto">
              Un lavoratore della sede, presente durante l’orario di lavoro. Dopo la nomina lo iscrivi al corso; la nomina firmata va nel fascicolo, nella cartella delle nomine.
            </Avviso>
          </div>
          {d.addetti.map((b) => (
            <section key={b.sede_id ?? 0} className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 flex-1 text-h3">{b.sede ?? 'Addetti al primo soccorso'}</h3>
                {b.addetti.length > 0 ? <Chip stato="ok">{b.addetti.length === 1 ? '1 addetto' : `${b.addetti.length} addetti`}</Chip> : <Chip stato="danger">Nessun addetto</Chip>}
                {modifica && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFoglio({ nomina: b.sede_id })}>Nomina un addetto</button>}
              </div>
              {b.addetti.length === 0 ? (
                <div className="mt-3">
                  <Vuoto titolo="Nessun addetto">Nessun lavoratore ha il corso di primo soccorso{d.piu_sedi ? ' in questa sede' : ''}. Nominane almeno uno, presente durante l’orario di lavoro.</Vuoto>
                </div>
              ) : (
                <table className="mt-3 w-full text-small">
                  <thead><tr className="text-left text-fg-muted"><th className="py-2 font-medium">Addetto</th><th className="font-medium">Mansione</th><th className="font-medium">Corso</th><th className="font-medium">Stato</th></tr></thead>
                  <tbody>
                    {b.addetti.map((a) => (
                      <tr key={a.lavoratore_id} className="border-t border-line">
                        <td className="py-2.5"><span className="font-medium">{a.nome}</span>{a.reparto && <span className="block text-caption text-fg-muted">{a.reparto}</span>}</td>
                        <td>{a.mansione ?? 'n.d.'}</td>
                        <td>{a.corso.scade_il ? `Valido fino al ${dataIt(a.corso.scade_il)} · ${traGiorni(a.corso.scade_il)}` : a.corso.conseguito_il ? 'Valido' : 'Mai fatto'}</td>
                        <td><Chip stato={a.corso.stato}>{({ ok: 'Corso valido', warn: 'Corso in scadenza', danger: 'Corso scaduto', todo: 'Corso da fare', info: 'Iscritto al corso' } as Record<string, string>)[a.corso.stato] ?? ''}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </div>
      )}

      {d && foglio !== null && typeof foglio === 'object' && 'verifica' in foglio && (
        <FoglioVerifica d={d} cassettaId={foglio.verifica} onChiudi={() => setFoglio(null)} onFatto={carica} aid={aid} />
      )}
      {d && foglio !== null && typeof foglio === 'object' && 'sostituito' in foglio && (
        <FoglioSostituito aid={aid} cassetta={foglio.sostituito.cassetta} prodotto={foglio.sostituito.prodotto} onChiudi={() => setFoglio(null)} onFatto={carica} />
      )}
      {d && foglio === 'aggiungi' && <FoglioAggiungi aid={aid} d={d} sedi={sedi} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {d && foglio !== null && typeof foglio === 'object' && 'nomina' in foglio && (
        <FoglioNomina aid={aid} d={d} sedeId={foglio.nomina} onChiudi={() => setFoglio(null)} onFatto={carica} />
      )}
          </div>
  );
}

function TabellaProdotti({ prodotti, modifica, onSostituito }: { prodotti: ProdottoCassetta[]; modifica: boolean; onSostituito: (p: ProdottoCassetta) => void }) {
  if (prodotti.length === 0) return <p className="py-3 text-small text-fg-muted">Nessun prodotto</p>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-small">
        <thead><tr className="text-left text-fg-muted"><th className="py-2 font-medium">Prodotto</th><th className="font-medium">Richiesti</th><th className="font-medium">Presenti</th><th className="font-medium">Scadenza</th><th className="font-medium">Stato</th><th /></tr></thead>
        <tbody>
          {prodotti.map((p) => (
            <tr key={p.codice} className="border-t border-line">
              <td className="min-w-[13rem] py-2.5"><span className="font-medium">{p.breve}</span><span className="block text-caption text-fg-muted">{p.nome}</span></td>
              <td>{p.richiesti}</td>
              <td className={clsx(p.presenti < p.richiesti && 'font-medium text-danger-mark')}>{p.presenti}</td>
              <td className={clsx(p.stato === 'scaduto' && 'text-danger-mark')}>{p.scadenza ? `${dataIt(p.scadenza)} · ${traGiorni(p.scadenza)}` : <span className="text-fg-faint">Non scade</span>}</td>
              <td><Chip stato={p.chip}>{p.etichetta}</Chip></td>
              <td className="text-right">{modifica && p.stato !== 'ok' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSostituito(p)}>Sostituito</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedaVerifiche({ d, modifica, onVerifica }: { d: Dati; modifica: boolean; onVerifica: () => void }) {
  const daFare = d.cassette.filter((k) => !k.verificata_mese);
  const mese = d.mese.charAt(0).toUpperCase() + d.mese.slice(1);
  const testo = d.cassette.length === 0 ? 'Aggiungi una cassetta per poterla verificare.'
    : daFare.length === 0 ? `Tutte verificate. La prossima a ${d.mese_prossimo}.`
      : `${daFare.length === 1 ? `Da verificare: ${daFare[0].nome}` : `${daFare.length} da verificare: ${daFare.map((k) => k.nome).join(', ')}`}. Apri la cassetta e per ogni prodotto spunta se c’è ed è integro.`;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-hse-xl bg-grafite-900 p-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-grafite-400">Verifica mensile del contenuto</p>
            {d.cassette.length > 0 && (daFare.length > 0 ? <Chip stato="sign">Da fare</Chip> : <Chip stato="ok">Fatta</Chip>)}
          </div>
          <p className="mt-2 text-display">{mese}</p>
          <p className="mt-2 text-body text-grafite-400">{testo}</p>
          <div className="mt-5">
            {modifica ? (
              d.cassette.length > 0 && <button type="button" className="btn btn-lg btn-accent" onClick={onVerifica}>{daFare.length > 0 ? 'Fai la verifica' : 'Rifai la verifica'}</button>
            ) : (
              <Blocco>Il tuo ruolo non può registrare verifiche</Blocco>
            )}
          </div>
        </section>
        <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
          <p className="text-title">Come si fa</p>
          {[
            ['C’è ed è integro?', 'Per ogni prodotto controlla quantità, confezione chiusa e data di scadenza'],
            ['Sostituito', 'Se lo cambi sul momento, indica la nuova scadenza'],
            ['Manca o è rovinato', 'Resta da ricomprare finché non lo sostituisci'],
          ].map(([t, s]) => (
            <div key={t} className="mt-3 flex gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cat-primosoccorso-mark" />
              <span><span className="block text-small font-medium">{t}</span><span className="block text-small text-fg-muted">{s}</span></span>
            </div>
          ))}
        </section>
      </div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-h3">Verifiche registrate</h3>
        <span className="text-small text-fg-muted">{d.verifiche.length} voci</span>
      </div>
      {d.verifiche.length === 0 ? (
        <p className="text-small text-fg-muted">Ancora nessuna verifica registrata</p>
      ) : (
        <table className="w-full text-small">
          <thead><tr className="text-left text-fg-muted"><th className="py-2 font-medium">Data</th><th className="font-medium">{d.gruppo.g === 'C' ? 'Pacchetto' : 'Cassetta'}</th><th className="font-medium">Chi</th><th className="font-medium">Esito</th><th className="font-medium">Note</th></tr></thead>
          <tbody>
            {d.verifiche.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <td className="py-2.5">{dataIt(v.data)}</td><td>{v.cassetta}</td><td>{v.chi ?? 'n.d.'}</td>
                <td>{v.esito === 'ok' ? <Chip stato="ok">Tutto in regola</Chip> : <Chip stato="warn">Con note</Chip>}</td>
                <td className="text-fg-muted">{v.note ?? 'n.d.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FoglioVerifica({ d, cassettaId, aid, onChiudi, onFatto }: { d: Dati; cassettaId: number | null; aid: number; onChiudi: () => void; onFatto: () => void }) {
  const [id, setId] = useState<number>(cassettaId ?? d.cassette[0].id);
  const [risposte, setRisposte] = useState<Record<string, RispostaVerifica>>({});
  const [errore, setErrore] = useState<{ testo: string; righe: string[] } | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const [invio, setInvio] = useState(false);
  const k = d.cassette.find((x) => x.id === id) ?? d.cassette[0];
  const nuova = traMesi(24);
  const registra = async () => {
    const e = erroriVerifica(k.prodotti, risposte);
    setErrore(e);
    if (e) {
      document.getElementById(`ps-${e.righe[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setInvio(true);
    try {
      setEsito(await ps.verifica(aid, k.id, risposte));
      onFatto();
    } catch (x) {
      setErrore({ testo: x instanceof Error ? x.message : 'Non riuscito.', righe: [] });
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio aperto largo categoria="primosoccorso" icona={Valigetta} sopra={`${d.gruppo.contenitore.charAt(0).toUpperCase() + d.gruppo.contenitore.slice(1)} · Allegato ${d.gruppo.allegato} del DM 388/2003`}
      titolo={`Verifica di ${d.mese}`} onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button> : (
        <>
          <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>
          <button type="button" className="btn btn-lg btn-accent" disabled={invio} onClick={registra}>Registra la verifica</button>
        </>
      )}>
      {esito ? <Fatto titolo={esito.titolo ?? 'Verifica registrata'}>{esito.testo}</Fatto> : (
        <>
          {d.cassette.length > 1 && (
            <Campo etichetta={d.gruppo.g === 'C' ? 'Pacchetto' : 'Cassetta'}>
              <select className="input" value={id} onChange={(e) => { setId(Number(e.target.value)); setRisposte({}); setErrore(null); }}>
                {d.cassette.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.verificata_mese ? ', già verificata questo mese' : ''}</option>)}
              </select>
            </Campo>
          )}
          {errore && <p role="alert" className="rounded-hse-lg bg-danger px-4 py-3 text-small text-danger-ink">{errore.testo}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-fg-muted">{k.prodotti.length} prodotti. Per ognuno: c’è ed è integro?</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRisposte(tuttiSi(k.prodotti, risposte))}>Segna tutti sì</button>
          </div>
          <ul className="divide-y divide-line rounded-hse-lg shadow-[inset_0_0_0_1px_var(--hse-line)]">
            {k.prodotti.map((p) => {
              const r = risposte[p.codice];
              const sbagliata = errore?.righe.includes(p.codice);
              return (
                <li key={p.codice} id={`ps-${p.codice}`} className={clsx('flex flex-wrap items-center gap-3 px-4 py-3', sbagliata && 'bg-danger')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-small"><span className="font-medium">{p.breve}</span> <span className="text-fg-muted">· {p.richiesti} {p.richiesti === 1 ? 'richiesto' : 'richiesti'}, {p.presenti} {p.presenti === 1 ? 'presente' : 'presenti'}</span></p>
                    <p className={clsx('text-caption', p.stato === 'scaduto' || p.stato === 'manca' ? 'text-danger-mark' : p.stato === 'in_scadenza' ? 'text-warn-ink' : 'text-fg-muted')}>
                      {p.scadenza ? `${p.stato === 'scaduto' ? 'Scaduto il' : 'Scade il'} ${dataIt(p.scadenza)}` : 'Non scade'}{p.ricomprare ? ' · da ricomprare' : ''}
                    </p>
                    {r?.esito === 'sostituito' && p.dura && (
                      <input type="date" className="input mt-2 max-w-[20rem]" aria-label="Nuova scadenza" min={new Date().toISOString().slice(0, 10)} value={r.scadenza ?? nuova}
                        onChange={(e) => setRisposte({ ...risposte, [p.codice]: { esito: 'sostituito', scadenza: e.target.value } })} />
                    )}
                  </div>
                  <div className="flex gap-1.5" role="radiogroup" aria-label={p.breve}>
                    {([['si', 'Sì', 'bg-grafite-900 text-white'], ['sostituito', 'Sostituito', 'bg-acid-400 text-acid-950'], ['manca', 'Manca o rovinato', 'bg-danger-mark text-white']] as const).map(([v, t, cls]) => (
                      <button key={v} type="button" role="radio" aria-checked={r?.esito === v}
                        className={clsx('h-10 rounded-full px-3.5 text-small shadow-[inset_0_0_0_1px_var(--hse-line)]', r?.esito === v && cls)}
                        onClick={() => setRisposte({ ...risposte, [p.codice]: v === 'sostituito' ? { esito: v, scadenza: p.dura ? nuova : undefined } : { esito: v } })}>
                        {t}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Foglio>
  );
}

export function FoglioSostituito({ aid, cassetta, prodotto, onChiudi, onFatto }: { aid: number; cassetta: Cassetta; prodotto: ProdottoCassetta; onChiudi: () => void; onFatto: () => void }) {
  const [data, setData] = useState(traMesi(24));
  const [errore, setErrore] = useState<string | null>(null);
  const salva = async () => {
    try {
      const r = await ps.sostituito(aid, cassetta.id, prodotto.codice, prodotto.dura ? data : null);
      toast(r.testo);
      onFatto();
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra={cassetta.nome} titolo={`${prodotto.breve}: sostituito`} onChiudi={onChiudi}
      piede={<><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-primary" onClick={salva}>Salva</button></>}>
      <p className="text-small">{prodotto.nome}. Quantità richiesta: <strong>{prodotto.richiesti}</strong>.</p>
      {prodotto.dura && (
        <Campo etichetta="Nuova scadenza" aiuto="La trovi stampata sulla confezione." errore={errore ?? undefined}>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      )}
      {!prodotto.dura && errore && <p className="text-small text-danger-mark">{errore}</p>}
    </Foglio>
  );
}

export function FoglioAggiungi({ aid, d, sedi, onChiudi, onFatto }: { aid: number; d: Dati; sedi: Array<{ id: number; nome: string }>; onChiudi: () => void; onFatto: () => void }) {
  const [pos, setPos] = useState('');
  const [sede, setSede] = useState<number | null>(sedi.length > 1 ? null : sedi[0]?.id ?? null);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const pacchetto = d.gruppo.g === 'C';
  const aggiungi = async () => {
    if (pos.trim() === '') return setErrore('Indica dove si trova.');
    try {
      setEsito(await ps.aggiungi(aid, pos.trim(), sede));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra="Primo soccorso" titolo={pacchetto ? 'Aggiungi pacchetto di medicazione' : 'Aggiungi cassetta di pronto soccorso'} onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button> : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-primary" onClick={aggiungi}>Aggiungi</button></>}>
      {esito ? <Fatto titolo={esito.titolo ?? 'Aggiunta'}>{esito.testo}</Fatto> : (
        <>
          <Campo etichetta="Dove si trova" errore={errore ?? undefined}>
            <input className="input" placeholder="Es. Magazzino, vicino al portone" value={pos} onChange={(e) => setPos(e.target.value)} />
          </Campo>
          {sedi.length > 1 && (
            <Campo etichetta="Sede">
              <select className="input" value={sede ?? ''} onChange={(e) => setSede(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Scegli la sede</option>
                {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Campo>
          )}
          <Avviso titolo="Nuova e completa">La registriamo con tutto il contenuto dell’Allegato {d.gruppo.allegato} e le scadenze tra 2 anni. Se non è così, correggi dalla verifica.</Avviso>
        </>
      )}
    </Foglio>
  );
}

export function FoglioNomina({ aid, d, sedeId, onChiudi, onFatto }: { aid: number; d: Dati; sedeId: number | null; onChiudi: () => void; onFatto: () => void }) {
  const { chiedi } = usePortale();
  const [candidati, setCandidati] = useState<Array<{ id: number; nome: string; mansione: string | null; reparto: string | null; sede_id: number | null }> | null>(null);
  const [scelto, setScelto] = useState<number | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string; puo_iscrivere: boolean } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  useEffect(() => {
    const c = d.candidati.filter((l) => sedeId === null || l.sede_id === sedeId);
    setCandidati(c);
    setScelto(c[0]?.id ?? null);
  }, [d, sedeId]);
  const nomina = async () => {
    if (scelto === null) return onChiudi();
    try {
      setEsito(await ps.nomina(aid, scelto));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra="Primo soccorso" titolo="Nomina un addetto al primo soccorso" onChiudi={onChiudi}
      piede={esito ? (esito.puo_iscrivere
        ? <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Più tardi</button><button type="button" className="btn btn-accent" onClick={() => { chiedi('Iscrivi al corso di primo soccorso il nuovo addetto'); onChiudi(); }}>Iscrivilo al corso</button></>
        : <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button>)
        : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-primary" onClick={nomina}>Nomina</button></>}>
      {esito ? <Fatto titolo={esito.titolo ?? ''}>{esito.testo}</Fatto> : (
        <>
          <p className="text-small font-medium">Chi nomini</p>
          {candidati === null ? <Caricamento /> : candidati.length === 0 ? (
            <p className="rounded-hse-lg bg-sunken px-4 py-3 text-small">Nessun lavoratore in questa sede.</p>
          ) : (
            <div className="rounded-hse-lg shadow-[inset_0_0_0_1px_var(--hse-line)]">
              {candidati.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <input type="radio" name="ps-nomina" checked={scelto === l.id} onChange={() => setScelto(l.id)} />
                  <span><span className="block text-small font-medium">{l.nome}</span><span className="block text-caption text-fg-muted">{[l.mansione, l.reparto].filter(Boolean).join(' · ')}</span></span>
                </label>
              ))}
            </div>
          )}
          {errore && <p className="text-small text-danger-mark">{errore}</p>}
          <Avviso titolo={`Poi fa il corso di ${d.gruppo.ore} ore`}>Dopo la nomina puoi iscriverlo subito al corso di primo soccorso.</Avviso>
        </>
      )}
    </Foglio>
  );
}
