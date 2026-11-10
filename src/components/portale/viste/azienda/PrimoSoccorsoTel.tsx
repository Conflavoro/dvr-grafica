'use client';

import Link from 'next/link';

import { useEffect, useState, type ReactNode } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, dataIt, traGiorni } from '../../kit';
import { Valigetta } from '@/components/portale/telefono/icone';
import { RigaTrascinabile, SuggerimentoGesto } from '@/components/portale/telefono/RigaTrascinabile';
import { impostaContatori, toast } from '@/components/portale/telefono/stato';
import { Avviso, CerchioSpunta, Corso, Elenco, Invia, Sirena, Spunta, type IconaComponente } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { ps, type Cassetta, type PrimoSoccorso as Dati, type ProdottoCassetta, type RispostaVerifica, type VoceDaFare } from '@/lib/portale/luoghi-api';
import { traMesi } from '@/lib/portale/luoghi-logica';
import { Fatto, useCarica } from './comuni';
import { FoglioAggiungi, FoglioNomina, FoglioSostituito } from './PrimoSoccorso';
import { DaFareTel, ElencoTel, FisarmonicaTel, FisarmonicheTel, GrandeTel, NumeriTel, Segmenti, TestataTel } from './luoghiTelefono';

type SchedaPs = 'sintesi' | 'cassette' | 'verifiche' | 'addetti';
type FoglioPs = null | { verifica: number | null } | { prodotto: { k: Cassetta; p: ProdottoCassetta } } | { sostituito: { k: Cassetta; p: ProdottoCassetta } } | 'aggiungi' | { nomina: number | null };

const maiusc = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Primo soccorso sul telefono (mobile/viste/primosoccorso.js): carosello delle cose da fare, cassette con azioni a scorrimento, verifica guidata. */
export default function PrimoSoccorsoTel() {
  const { azienda, versione, sede, sedi } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati: d, errore, carica, caricando } = useCarica(() => ps.vista(aid, sede), [aid, versione, sede]);
  const [scheda, setScheda] = useState<SchedaPs>('sintesi');
  const [foglio, setFoglio] = useState<FoglioPs>(null);
  useEffect(() => {
    if (d) impostaContatori({ primosoccorso: d.da_fare.length });
  }, [d]);
  if (!azienda) return null;
  if (!d) return <div className="space-y-4">{errore && <Errore testo={errore} onRiprova={carica} />}{caricando && <Caricamento />}</div>;
  const modifica = d.permessi.modifica;
  const pacchetto = d.gruppo.g === 'C';
  const ind = d.indicatori;
  const contenitore = maiusc(d.gruppo.contenitore);
  const verifica = (id: number | null = null) => {
    if (!modifica) return toast('Il tuo ruolo non può registrare verifiche', 'info');
    if (d.cassette.length === 0) return toast('Aggiungi prima una cassetta', 'info');
    setFoglio({ verifica: id ?? (d.cassette.length === 1 ? d.cassette[0].id : null) });
  };
  const voce = (x: VoceDaFare) => () => {
    if (x.azione === 'verifica') verifica(x.id);
    else if (x.azione === 'nomina') setFoglio({ nomina: x.id });
    else if (x.scheda) setScheda(x.scheda as SchedaPs);
  };
  const sostituisci = (k: Cassetta, p: ProdottoCassetta) => {
    if (!modifica) return toast('Il tuo ruolo non può modificare le cassette', 'info');
    if (!p.dura) {
      ps.sostituito(aid, k.id, p.codice, null).then((r) => { toast(r.testo); carica(); }).catch((e: Error) => toast(e.message, 'info'));
      return;
    }
    setFoglio({ sostituito: { k, p } });
  };
  const nomeCassette = pacchetto ? (ind.cassette === 1 ? 'pacchetto' : 'pacchetti') : ind.cassette === 1 ? 'cassetta' : 'cassette';
  const sotto = scheda === 'sintesi' ? `${ind.cassette_ok} su ${ind.cassette} ${nomeCassette} in regola`
    : `Gruppo ${d.gruppo.g} · ${d.da_fare.length > 0 ? `${d.da_fare.length} da fare` : 'tutto in regola'}`;

  const rigaProdotto = (k: Cassetta, p: ProdottoCassetta) => (
    <RigaTrascinabile key={p.codice} titolo={p.breve}
      sotto={`${p.presenti} su ${p.richiesti}${p.scadenza ? ` · ${p.stato === 'scaduto' ? 'scaduto il' : 'scade il'} ${dataIt(p.scadenza)}` : ''}`}
      stato={<Chip stato={p.chip}>{p.etichetta}</Chip>}
      onClick={() => setFoglio({ prodotto: { k, p } })}
      azioni={modifica && p.stato !== 'ok' ? [{ etichetta: 'Sostituito', icona: Spunta, tono: 'bg-acid-400 text-acid-950', onAzione: () => sostituisci(k, p) }] : []} />
  );

  return (
    <div className="space-y-5">
      <TestataTel categoria="primosoccorso" icona={Valigetta} titolo="Primo soccorso" sotto={sotto}
        numero={scheda === 'sintesi' ? d.gruppo.g : undefined} etichetta={scheda === 'sintesi' ? `Gruppo ${d.gruppo.g} · ${d.gruppo.contenitore} (Allegato ${d.gruppo.allegato})` : undefined} />
      <Segmenti<SchedaPs> etichetta="Primo soccorso" attiva={scheda} onCambia={setScheda} voci={[
        { k: 'sintesi', t: 'Sintesi', n: d.da_fare.length },
        { k: 'cassette', t: pacchetto ? 'Pacchetti' : 'Cassette', n: d.cassette.filter((k) => k.problemi > 0).length },
        { k: 'verifiche', t: 'Verifiche', n: ind.da_verificare },
        { k: 'addetti', t: 'Addetti', n: ind.sedi_senza_addetti },
      ]} />

      {scheda === 'sintesi' && (
        <>
          <DaFareTel categoria="primosoccorso" icona={Valigetta} vuotoTitolo="Tutto in regola" vuotoTesto="Cassette complete, verifiche fatte e addetti nominati."
            voci={d.da_fare.map((x) => ({ testo: x.testo, extra: x.extra, pulsante: x.pulsante, onClick: voce(x) }))} />
          <NumeriTel punto="bg-cat-primosoccorso-mark" voci={[
            { etichetta: pacchetto ? 'Pacchetti in regola' : 'Cassette in regola', valore: ind.cassette_ok, unita: `/${ind.cassette}`, nota: ind.cassette_ok < ind.cassette ? `${ind.cassette - ind.cassette_ok} da sistemare` : 'Tutto valido', onClick: () => setScheda('cassette') },
            { etichetta: 'Da sostituire', valore: ind.da_sostituire, nota: ind.da_sostituire > 0 ? 'Scaduti o mancanti' : 'Nessuno', onClick: () => setScheda('cassette') },
            { etichetta: 'Prossima scadenza', valore: ind.prossima_scadenza ? dataIt(ind.prossima_scadenza, true) : 'n.d.', nota: ind.prossima_scadenza ? traGiorni(ind.prossima_scadenza) : undefined, onClick: () => setScheda('cassette') },
            { etichetta: 'Addetti', valore: ind.addetti, nota: ind.addetti > 0 ? `Corso di ${d.gruppo.ore} ore` : 'Nessun addetto', onClick: () => setScheda('addetti') },
          ]} />
          <section>
            <h2 className="mb-2 text-h3">Cosa comporta il gruppo {d.gruppo.g}</h2>
            <div className="rounded-[1.75rem] bg-surface px-4 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              {([
                [Valigetta as IconaComponente, contenitore, `Contenuto minimo dell’Allegato ${d.gruppo.allegato} · DM 388/2003`],
                [CerchioSpunta, 'Verifica ogni mese', 'Tutto presente, integro e non scaduto'],
                [Corso, `Addetti con corso di ${d.gruppo.ore} ore`, 'Aggiornamento ogni 3 anni · DM 388/2003'],
                [Sirena, 'Un mezzo per chiamare il 112', 'Sempre a portata di mano'],
                ...(d.gruppo.g === 'A' ? [[Invia, 'Comunicazione all’ASL', 'La prepara il tuo referente ISFOR']] : []),
              ] as Array<[IconaComponente, string, string]>).map(([I, t, s]) => (
                <div key={t} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-cat-primosoccorso-mark"><I size={18} /></span>
                  <span><span className="block text-[15px] font-medium">{t}</span><span className="block text-small text-fg-muted">{s}</span></span>
                </div>
              ))}
            </div>
          </section>
          <FisarmonicheTel><FisarmonicaTel titolo={`Perché il gruppo ${d.gruppo.g}`} sotto={d.gruppo.motivo} icona={Avviso}>
            <p>{d.gruppo.motivo}</p>
            <p className="mt-2 text-fg-muted">Gruppo C con meno di 3 lavoratori; gruppo A se l’attività (codice ATECO) è a rischio alto e i lavoratori sono più di 5; gruppo B negli altri casi.</p>
          </FisarmonicaTel></FisarmonicheTel>
        </>
      )}

      {scheda === 'cassette' && (
        <div className="space-y-6">
          {d.cassette.length === 0 && (
            <div className="rounded-[1.75rem] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <p className="text-title">{pacchetto ? 'Nessun pacchetto registrato' : 'Nessuna cassetta registrata'}</p>
              <p className="mt-1 text-small text-fg-muted">Aggiungi dove si trova: poi tieni d’occhio scadenze e verifiche.</p>
            </div>
          )}
          {d.cassette.map((k) => {
            const problemi = k.prodotti.filter((p) => p.stato !== 'ok');
            return (
              <div key={k.id} className="space-y-3">
                <div className="rounded-[1.75rem] bg-grafite-900 p-5 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-small text-grafite-400">{contenitore}{d.piu_sedi && k.sede ? ` · ${k.sede}` : ''}</span>
                    {k.problemi > 0 ? <Chip stato="sign">{k.problemi} da sistemare</Chip> : <Chip stato="ok">Completa</Chip>}
                  </div>
                  <p className="mt-2 text-h3">{k.posizione}</p>
                  <p className="mt-1 text-small text-grafite-400">
                    {k.verificata_mese ? `Verificata il ${dataIt(k.ultima_verifica)}` : k.ultima_verifica ? `Ultima verifica il ${dataIt(k.ultima_verifica)} · da rifare a ${d.mese}` : 'Mai verificata'}
                  </p>
                  {modifica && (
                    <div className="mt-4"><GrandeTel tono={k.verificata_mese ? 'secondario' : 'accento'} onClick={() => verifica(k.id)}>{k.verificata_mese ? 'Rifai la verifica' : 'Verifica questa cassetta'}</GrandeTel></div>
                  )}
                </div>
                {problemi.length > 0 && (
                  <>
                    {modifica && <SuggerimentoGesto chiave="ps-sostituito">Trascina a sinistra per segnare “Sostituito”</SuggerimentoGesto>}
                    <ElencoTel titolo="Da sistemare">{problemi.map((p) => rigaProdotto(k, p))}</ElencoTel>
                  </>
                )}
                <FisarmonicheTel><FisarmonicaTel titolo="Contenuto completo" icona={Elenco} sotto={`${k.prodotti.length} prodotti · Allegato ${d.gruppo.allegato} del DM 388/2003`}>
                  <div className="-mx-4">{k.prodotti.map((p) => rigaProdotto(k, p))}</div>
                </FisarmonicaTel></FisarmonicheTel>
              </div>
            );
          })}
          {modifica && <GrandeTel tono="secondario" onClick={() => setFoglio('aggiungi')}>{pacchetto ? 'Aggiungi pacchetto' : 'Aggiungi cassetta'}</GrandeTel>}
        </div>
      )}

      {scheda === 'verifiche' && (() => {
        const daFare = d.cassette.filter((k) => !k.verificata_mese);
        return (
          <div className="space-y-5">
            <div className="rounded-[1.75rem] bg-grafite-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-small text-grafite-400">Verifica mensile</span>
                {d.cassette.length > 0 && (daFare.length > 0 ? <Chip stato="sign">Da fare</Chip> : <Chip stato="ok">Fatta</Chip>)}
              </div>
              <p className="mt-2 text-[48px] font-light leading-none">{maiusc(d.mese)}</p>
              <p className="mt-3 text-small text-grafite-400">
                {d.cassette.length === 0 ? 'Aggiungi una cassetta per poterla verificare.'
                  : daFare.length === 0 ? `Tutte verificate. La prossima a ${d.mese_prossimo}.`
                    : `Da verificare: ${daFare.map((k) => k.nome).join(', ')}. Apri la cassetta e rispondi un prodotto alla volta.`}
              </p>
              <div className="mt-4">
                {modifica ? (d.cassette.length > 0 && <GrandeTel tono="accento" onClick={() => verifica()}>{daFare.length > 0 ? 'Fai la verifica' : 'Rifai la verifica'}</GrandeTel>)
                  : <Blocco>Il tuo ruolo non può registrare verifiche</Blocco>}
              </div>
            </div>
            {d.verifiche.length === 0 ? (
              <div className="rounded-[1.75rem] bg-sunken p-5 text-center"><p className="font-medium">Nessuna verifica</p><p className="text-small text-fg-muted">Qui trovi le verifiche mensili delle cassette.</p></div>
            ) : (
              <ElencoTel titolo={`Verifiche registrate · ${d.verifiche.length}`}>
                {d.verifiche.map((v) => (
                  <RigaTrascinabile key={v.id}
                    inizio={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sunken text-center text-caption leading-tight"><span><b className="block text-body">{v.data.slice(8, 10)}</b>{new Date(v.data).toLocaleDateString('it-IT', { month: 'short' })}</span></span>}
                    titolo={v.cassetta} sotto={[v.chi, v.note].filter(Boolean).join(' · ')}
                    stato={v.esito === 'ok' ? <Chip stato="ok">In regola</Chip> : <Chip stato="warn">Con note</Chip>} />
                ))}
              </ElencoTel>
            )}
          </div>
        );
      })()}

      {scheda === 'addetti' && (
        <div className="space-y-5">
          <div className="rounded-[1.75rem] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
            <p className="text-small text-fg-muted">Corso per gli addetti · DM 388/2003</p>
            <p className="mt-1 text-[48px] font-light leading-none">{d.gruppo.ore} ore</p>
            <p className="mt-2 font-medium">Addetto primo soccorso</p>
            <p className="text-small text-fg-muted">{d.gruppo.ore} ore perché sei nel gruppo {d.gruppo.g}. Aggiornamento ogni 3 anni.</p>
          </div>
          {d.addetti.map((b) => (b.addetti.length === 0 ? (
            <div key={b.sede_id ?? 0} className="rounded-[1.75rem] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <p className="text-title">Nessun addetto</p>
              <p className="mt-1 text-small text-fg-muted">Nessun lavoratore ha il corso di primo soccorso{d.piu_sedi ? ' in questa sede' : ''}.</p>
              <Link className="mt-2 inline-block text-small font-medium underline" href="/azienda/formazione/">Vai a Formazione</Link>
            </div>
          ) : (
            <ElencoTel key={b.sede_id ?? 0} titolo={`${b.sede ? `${b.sede} · ` : ''}${b.addetti.length === 1 ? '1 addetto' : `${b.addetti.length} addetti`}`}>
              {b.addetti.map((a) => (
                <RigaTrascinabile key={a.lavoratore_id}
                  inizio={<span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-small font-medium">{a.nome.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>}
                  titolo={a.nome} sotto={a.corso.scade_il ? `Valido fino al ${dataIt(a.corso.scade_il)}` : `${a.mansione ?? ''}${a.corso.conseguito_il ? '' : ' · mai fatto'}`}
                  stato={<Chip stato={a.corso.stato}>{({ ok: 'Corso valido', warn: 'In scadenza', danger: 'Corso scaduto', todo: 'Corso da fare', info: 'Iscritto' } as Record<string, string>)[a.corso.stato] ?? ''}</Chip>} />
              ))}
            </ElencoTel>
          )))}
          {modifica && <GrandeTel tono={ind.addetti === 0 ? 'primario' : 'secondario'} onClick={() => setFoglio({ nomina: null })}>Nomina un addetto</GrandeTel>}
        </div>
      )}

      {foglio !== null && typeof foglio === 'object' && 'prodotto' in foglio && (
        <Foglio aperto categoria="primosoccorso" icona={Valigetta} sopra={foglio.prodotto.k.nome} titolo={foglio.prodotto.p.breve} onChiudi={() => setFoglio(null)}
          piede={<>
            <button type="button" className="btn btn-ghost" onClick={() => setFoglio(null)}>Chiudi</button>
            {modifica && foglio.prodotto.p.stato !== 'ok' && <button type="button" className="btn btn-accent" onClick={() => sostituisci(foglio.prodotto.k, foglio.prodotto.p)}>Sostituito</button>}
          </>}>
          <Chip stato={foglio.prodotto.p.chip}>{foglio.prodotto.p.etichetta}</Chip>
          <p className="text-[15px]">{foglio.prodotto.p.nome}</p>
          <dl className="divide-y divide-line text-small">
            <div className="flex justify-between py-2.5"><dt className="text-fg-muted">Richiesti</dt><dd>{foglio.prodotto.p.richiesti}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-fg-muted">Presenti</dt><dd>{foglio.prodotto.p.presenti}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-fg-muted">Scadenza</dt><dd>{foglio.prodotto.p.scadenza ? `${dataIt(foglio.prodotto.p.scadenza)} · ${traGiorni(foglio.prodotto.p.scadenza)}` : 'Non scade'}</dd></div>
          </dl>
        </Foglio>
      )}
      {foglio !== null && typeof foglio === 'object' && 'sostituito' in foglio && (
        <FoglioSostituito aid={aid} cassetta={foglio.sostituito.k} prodotto={foglio.sostituito.p} onChiudi={() => setFoglio(null)} onFatto={carica} />
      )}
      {foglio === 'aggiungi' && <FoglioAggiungi aid={aid} d={d} sedi={sedi} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {foglio !== null && typeof foglio === 'object' && 'nomina' in foglio && <FoglioNomina aid={aid} d={d} sedeId={foglio.nomina} onChiudi={() => setFoglio(null)} onFatto={carica} />}
      {foglio !== null && typeof foglio === 'object' && 'verifica' in foglio && (
        <VerificaGuidata aid={aid} d={d} cassettaId={foglio.verifica} onChiudi={() => setFoglio(null)} onFatto={carica} />
      )}
    </div>
  );
}

/** Flusso "Verifica di <mese>" a passi, un prodotto alla volta (solo telefono). */
function VerificaGuidata({ aid, d, cassettaId, onChiudi, onFatto }: { aid: number; d: Dati; cassettaId: number | null; onChiudi: () => void; onFatto: () => void }) {
  const [id, setId] = useState<number | null>(cassettaId);
  const [i, setI] = useState(0);
  const [verso, setVerso] = useState(1);
  const [risposte, setRisposte] = useState<Record<string, RispostaVerifica>>({});
  const [data, setData] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const k = d.cassette.find((x) => x.id === id) ?? null;
  const n = k?.prodotti.length ?? 0;
  const riepilogo = k !== null && i >= n;
  const p = k && !riepilogo ? k.prodotti[i] : null;
  const vai = (dir: number) => { setVerso(dir); setI((x) => x + dir); setData(null); setErrore(null); };
  const rispondi = (r: RispostaVerifica) => { if (p) { setRisposte({ ...risposte, [p.codice]: r }); vai(1); } };
  const sostituito = () => {
    if (!p) return;
    if (!p.dura) return rispondi({ esito: 'sostituito' });
    setData(traMesi(24));
  };
  const avanti = () => {
    if (!data) return setErrore('Indica la data di scadenza.');
    if (data < new Date().toISOString().slice(0, 10)) return setErrore('La nuova scadenza non può essere già passata.');
    rispondi({ esito: 'sostituito', scadenza: data });
  };
  const registra = async () => {
    if (!k) return;
    try {
      setEsito(await ps.verifica(aid, k.id, risposte));
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  const testoRisposta = { si: 'c’è ed è integro', sostituito: 'sostituito', manca: 'manca o è rovinato' };
  const ok = k ? k.prodotti.filter((x) => risposte[x.codice]?.esito !== 'manca').length : 0;

  let piede;
  if (esito) piede = <button type="button" className="btn btn-primary w-full" onClick={onChiudi}>Fatto</button>;
  else if (!k) piede = <button type="button" className="btn btn-ghost w-full" onClick={onChiudi}>Annulla</button>;
  else if (riepilogo) piede = (
    <div className="flex w-full flex-col gap-2">
      <button type="button" className="h-16 w-full rounded-full bg-acid-400 text-[17px] font-medium text-acid-950" onClick={registra}>Registra la verifica</button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => vai(-1)}>Torna all’ultimo prodotto</button>
    </div>
  );
  else if (data !== null) piede = (
    <div className="flex w-full flex-col gap-2">
      <button type="button" className="btn btn-lg btn-accent w-full" onClick={avanti}>Avanti</button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => { setData(null); setErrore(null); }}>Annulla</button>
    </div>
  );
  else if (p) {
    const scaduto = p.stato === 'scaduto';
    piede = (
      <div className="flex w-full flex-col gap-2">
        {!scaduto && <button type="button" className="h-16 w-full rounded-full bg-acid-400 text-[17px] font-medium text-acid-950" onClick={() => rispondi({ esito: 'si' })}>Sì, c’è ed è integro</button>}
        <button type="button" className={clsx('w-full rounded-full font-medium', scaduto ? 'h-16 bg-acid-400 text-[17px] text-acid-950' : 'h-12 bg-surface shadow-[inset_0_0_0_1.5px_var(--hse-line)]')} onClick={sostituito}>Sostituito</button>
        <button type="button" className="h-12 w-full rounded-full font-medium text-danger-mark shadow-[inset_0_0_0_1.5px_var(--hse-line)]" onClick={() => rispondi({ esito: 'manca' })}>Manca o è rovinato</button>
        {i > 0 && <button type="button" className="btn btn-ghost w-full" onClick={() => vai(-1)}>Prodotto precedente</button>}
      </div>
    );
  }

  return (
    <Foglio aperto categoria="primosoccorso" icona={Valigetta} titolo={`Verifica di ${d.mese}`} sopra={`${maiusc(d.gruppo.contenitore)} · DM 388/2003`} onChiudi={onChiudi} piede={piede}>
      {esito ? <Fatto titolo={esito.titolo ?? 'Verifica registrata'}>{esito.testo}</Fatto> : !k ? (
        <div className="space-y-2">
          <p className="text-title">Quale cassetta verifichi?</p>
          {d.cassette.map((x) => (
            <button key={x.id} type="button" onClick={() => setId(x.id)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--hse-line)]">
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-sunken"><Valigetta size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{x.posizione}</span><span className="block text-small text-fg-muted">{d.piu_sedi && x.sede ? `${x.sede} · ` : ''}{x.prodotti.length} prodotti</span></span>
              {x.verificata_mese ? <Chip stato="ok">Già fatta</Chip> : <Chip stato="sign">Da fare</Chip>}
            </button>
          ))}
        </div>
      ) : riepilogo ? (
        <div className="space-y-4">
          <p><span className="text-[64px] font-light leading-none">{ok}/{n}</span><span className="block text-small text-fg-muted">prodotti a posto</span></p>
          {(() => {
            const sost = k.prodotti.filter((x) => risposte[x.codice]?.esito === 'sostituito');
            const manca = k.prodotti.filter((x) => risposte[x.codice]?.esito === 'manca');
            return (
              <>
                {sost.length > 0 && <div className="rounded-2xl bg-sunken p-4 text-small"><p className="font-medium">Sostituiti</p>{sost.map((x) => <p key={x.codice}>{x.breve}</p>)}</div>}
                {manca.length > 0 ? <div className="rounded-2xl bg-cat-primosoccorso p-4 text-small"><p className="font-medium">Da ricomprare</p>{manca.map((x) => <p key={x.codice}>{x.breve}</p>)}</div>
                  : <div className="rounded-2xl bg-ok p-4 text-small text-ok-ink">Tutto presente e integro.</div>}
              </>
            );
          })()}
          <p className="text-small text-fg-muted">Registrata a nome tuo, con la data di oggi.</p>
          {errore && <p role="alert" className="text-small text-danger-mark">{errore}</p>}
        </div>
      ) : p && (
        <Entra key={`${p.codice}-${data !== null}`} da={verso * 28}>
          <div>
            <div className="flex justify-between text-small text-fg-muted"><span>Prodotto {i + 1} di {n}</span><span>{k.posizione}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-sunken"><div className="h-1.5 rounded-full bg-grafite-900 transition-[width] duration-300" style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
          </div>
          <span aria-hidden className="grid h-20 w-20 place-items-center rounded-full bg-cat-primosoccorso text-cat-primosoccorso-ink"><Valigetta size={32} /></span>
          <div>
            <p className="text-h2">{p.breve}</p>
            <p className="text-[15px] text-fg-muted">{p.nome}</p>
            <p className="mt-1 text-small">Ne servono {p.richiesti}{p.scadenza && <> · <span className={clsx(p.stato === 'scaduto' && 'text-danger-mark')}>{p.stato === 'scaduto' ? 'scaduto il' : 'scade il'} {dataIt(p.scadenza)}</span></>}</p>
          </div>
          {data !== null ? (
            <label className="block">
              <span className="mb-1.5 block text-small font-medium">Nuova scadenza</span>
              <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={data} onChange={(e) => setData(e.target.value)} />
              <span className="mt-1 block text-small text-fg-muted">La trovi stampata sulla confezione.</span>
              {errore && <span className="mt-1 block text-small text-danger-mark">{errore}</span>}
            </label>
          ) : p.stato === 'scaduto' ? (
            <p className="rounded-2xl bg-cat-primosoccorso p-4 text-small">È scaduto: sostituiscilo o segnalo da ricomprare.</p>
          ) : (
            <p className="text-h3">C’è ed è integro?</p>
          )}
          {risposte[p.codice] && data === null && <p className="text-small text-fg-muted">Hai risposto: {testoRisposta[risposte[p.codice].esito]}</p>}
        </Entra>
      )}
    </Foglio>
  );
}

/** Il passo entra di lato (28 px, 280 ms): da destra avanzando, da sinistra tornando. */
function Entra({ da, children }: { da: number; children: ReactNode }) {
  const [dentro, setDentro] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setDentro(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div className="space-y-4 transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
      style={{ transform: dentro ? 'none' : `translateX(${da}px)`, opacity: dentro ? 1 : 0 }}>
      {children}
    </div>
  );
}

