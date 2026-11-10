'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Documento, Indietro, Piu, Razzo, Spunta } from '@/components/icone';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Pastiglia, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { getDataSource, isApiMode, type Company, type CompanyDimensione } from '@/lib/data-source';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import {
  apriFascicolo,
  caricaAvvii,
  caricaPratica,
  iniziaAvvio,
  invitaTitolare,
  mappaTitolare,
  registraPagamento,
  type PraticaAvvio,
  type VistaAvvio,
} from '@/lib/portale/gestionale-api';
import { contoOre } from '@/lib/portale/gestionale-logica';
import { Barra, Campo, ChipTono, Fatto } from './comune';

/**
 * Avvio dei clienti (spec 8): pratiche aperte con il conto delle 48 ore dal
 * pagamento, completate, scheda della pratica con ?id= (i passi della scheda
 * di avvio, i dati letti da confermare in coda, l'invito del titolare) e
 * nuova azienda con ?nuova=1 (dati letti dalla visura, da verificare).
 */
export default function Avvio() {
  return (
    <Suspense fallback={<Caricamento />}>
      <AvvioVista />
    </Suspense>
  );
}

function AvvioVista() {
  const p = useSearchParams();
  const { aziendaScelta } = usePortale();
  const id = Number(p.get('id'));
  if (p.get('nuova') === '1') return <NuovaAzienda />;
  if (Number.isInteger(id) && id > 0) return <Pratica id={id} />;
  // Con il cliente scelto in cima al menu: direttamente la sua pratica di avvio.
  return aziendaScelta ? <Pratica id={aziendaScelta.id} /> : <Pratiche />;
}

// ---------------------------------------------------------------- elenco

function Pratiche() {
  const { versione } = usePortale();
  const [v, setV] = useState<VistaAvvio | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [tab, setTab] = useState<'aperte' | 'completati'>('aperte');

  useEffect(() => {
    caricaAvvii()
      .then(setV)
      .catch((e: Error) => setErrore(e.message));
  }, [versione]);

  if (!isApiMode()) return <Vuoto titolo="Avvio dei clienti">Con il backend collegato qui compaiono le pratiche di avvio.</Vuoto>;

  return (
    <div className="space-y-5">
      <Testata
        categoria="persone"
        icona={Razzo}
        sopra="Clienti"
        titolo="Avvio dei clienti"
        sotto="Fascicolo aperto entro 48 ore dal pagamento: l’assistente legge i documenti, il tecnico conferma."
        azioni={
          <Link href="/gestionale/avvio/?nuova=1" className="btn-primary">
            <Piu size={16} aria-hidden /> Nuova azienda
          </Link>
        }
      />
      {errore && <Errore testo={errore} />}
      {!v && !errore && <Caricamento />}
      {v && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Riquadro nero etichetta="Pratiche aperte" valore={v.kpi.aperte} sotto={`${v.kpi.senzaPagamento} senza pagamento registrato`} />
            <Riquadro etichetta="Oltre le 48 ore" valore={v.kpi.oltre48} tono={v.kpi.oltre48 > 0 ? 'danger' : undefined} sotto="Allarme nella coda del tecnico" />
            <Riquadro etichetta="Dati da confermare" valore={v.kpi.datiDaConfermare} tono={v.kpi.datiDaConfermare > 0 ? 'warn' : undefined} sotto="Letti dai documenti, in coda" />
            <Riquadro
              etichetta="Tempo medio di apertura"
              valore={v.kpi.tempoMedioOre}
              unita="h"
              sotto={v.kpi.entro48Pct !== null ? `${v.kpi.entro48Pct}% entro 48 ore negli ultimi ${v.kpi.baseMedia}` : 'Nessun avvio completato'}
            />
          </div>
          <Schede
            etichetta="Pratiche"
            attiva={tab}
            onCambia={setTab}
            voci={[
              { k: 'aperte', t: 'Pratiche aperte', n: v.aperte.length },
              { k: 'completati', t: 'Completati', n: v.completate.length },
            ]}
          />
          {tab === 'aperte' ? (
            <Scheda titolo="Pratiche aperte" sotto="Prima quelle oltre le 48 ore, poi il termine più vicino.">
              {v.aperte.length === 0 ? (
                <Vuoto titolo="Nessuna pratica aperta" azione={<Link href="/gestionale/avvio/?nuova=1" className="btn-primary">Nuova azienda</Link>}>
                  Quando arriva un cliente nuovo, aprilo da qui: leggiamo la visura e partono i passi dell’avvio.
                </Vuoto>
              ) : (
                <ul>
                  {v.aperte.map((p) => (
                    <li key={p.azienda.id}>
                      <RigaPratica p={p} ore={v.oreObiettivo} />
                    </li>
                  ))}
                </ul>
              )}
            </Scheda>
          ) : (
            <Scheda titolo="Completati" sotto="Fascicoli aperti, dal più recente.">
              {v.completate.length === 0 ? (
                <Vuoto titolo="Ancora nessun avvio completato" />
              ) : (
                <ul>
                  {v.completate.map((c) => (
                    <li key={c.azienda.id}>
                      <Riga
                        titolo={<Link href={`/gestionale/aziende/?id=${c.azienda.id}`}>{c.azienda.nome}</Link>}
                        sotto={[c.validataIl && `Fascicolo aperto il ${dataIt(c.validataIl)}`, c.tecnico?.nome].filter(Boolean).join(' · ')}
                        fine={c.ore !== null ? <Chip stato={c.neiTempi ? 'ok' : 'danger'}>{`${Math.round(c.ore)} ore · ${c.neiTempi ? 'nei tempi' : 'oltre'}`}</Chip> : undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Scheda>
          )}
        </>
      )}
    </div>
  );
}

function RigaPratica({ p, ore }: { p: PraticaAvvio; ore: number }) {
  const router = useRouter();
  const c = contoOre(p.oreDalPagamento, ore);
  return (
    <button type="button" onClick={() => router.push(`/gestionale/avvio/?id=${p.azienda.id}`)} className="flex w-full items-center gap-3 border-b border-perla-linea py-3 text-left last:border-b-0 hover:bg-perla-velo/50">
      <Pastiglia categoria="persone" icona={Razzo} />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-[14.5px] font-medium text-ink">{p.azienda.nome}</span>
        <span className="block text-[12.5px] text-ink-muted">
          {`${p.passiFatti} di ${p.passiTotali} passi`}
          {p.daConfermare > 0 && ` · ${p.daConfermare} dati da confermare`}
          {p.mancantiEssenziali > 0 && ` · mancano ${p.mancantiEssenziali} dati essenziali`}
          {p.tecnico && ` · ${p.tecnico.nome}`}
        </span>
        {p.pagatoIl && <Barra pct={c.pct} tono={c.tono} />}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <ChipTono tono={c.tono}>{c.testo}</ChipTono>
        <Chip stato={p.titolare.stato === 'attivo' ? 'ok' : p.titolare.stato === 'invitato' ? 'info' : 'neutral'}>
          {p.titolare.stato === 'attivo' ? 'Titolare attivo' : p.titolare.stato === 'invitato' ? 'Titolare invitato' : 'Titolare da invitare'}
        </Chip>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- pratica

function Pratica({ id }: { id: number }) {
  const { versione, apri, chiedi, ricarica } = usePortale();
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [esito, setEsito] = useState<string | null>(null);

  const carica = () =>
    caricaPratica(id)
      .then(setD)
      .catch((e: Error) => setErrore(e.message));
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, versione]);
  useEffect(() => {
    apri(null, id);
    return () => apri(null, null);
  }, [id, apri]);

  const esegui = async (fn: () => Promise<void>, ok: string) => {
    setLavoro(true);
    setErrore(null);
    setEsito(null);
    try {
      await fn();
      setEsito(ok);
      await carica();
      ricarica();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(false);
    }
  };

  if (!d && errore) return <Errore testo={errore} />;
  if (!d) return <Caricamento testo="Carico la pratica" />;

  const nomeAz = testo(d.ragione_sociale) ?? 'Azienda';
  const passi = lista(d.passi).map(rec);
  const p1 = passi[0] ?? {};
  const p2 = passi[1] ?? {};
  const p3 = passi[2] ?? {};
  const p4 = passi[3] ?? {};
  const mancanti = lista(p3.mancanti).map(rec);
  const essenziali = mancanti.filter((m) => m.essenziale === true);
  const titolare = mappaTitolare(d.titolare);
  const pagato = testo(d.pagato_il);
  const validata = testo(d.validata_il);
  const ore = pagato ? (Date.now() - new Date(pagato).getTime()) / 3600000 : null;
  const c = contoOre(validata ? null : ore);

  return (
    <div className="space-y-5">
      <Link href="/gestionale/avvio/" className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] text-ink-muted hover:text-ink">
        <Indietro size={16} aria-hidden /> Tutte le pratiche
      </Link>
      <Testata
        categoria="persone"
        icona={Razzo}
        sopra="Avvio del cliente"
        titolo={nomeAz}
        sotto={validata ? `Fascicolo aperto il ${dataIt(validata)}` : pagato ? `Pagamento registrato il ${dataIt(pagato)}` : 'Pagamento non ancora registrato'}
        azioni={
          <>
            <button type="button" className="btn-primary" onClick={() => chiedi(`A che punto è l’avvio di ${nomeAz}? Dimmi cosa manca e cosa posso chiedere al cliente.`)}>
              Chiedi a Falco
            </button>
            <Link href={`/gestionale/aziende/?id=${id}`} className="btn-ghost">
              Scheda azienda
            </Link>
          </>
        }
      />
      {errore && <Errore testo={errore} />}
      {esito && <p role="status" className="rounded-[1.25rem] bg-stato-ok px-4 py-3 text-[14px] text-stato-ok-ink">{esito}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Scheda titolo="Conto delle 48 ore" sotto="Il conto parte dal pagamento registrato.">
          {validata ? (
            <p className="text-[14.5px] text-ink">Fascicolo aperto. Obiettivo {pagato && new Date(validata).getTime() - new Date(pagato).getTime() <= 48 * 3600000 ? 'rispettato' : 'superato'}.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ChipTono tono={c.tono}>{c.testo}</ChipTono>
                {d.in_ritardo === true && <Chip stato="danger">Allarme in coda</Chip>}
              </div>
              {pagato && <Barra pct={c.pct} tono={c.tono} />}
              {!pagato && (
                <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => void esegui(() => registraPagamento(id), 'Pagamento registrato: parte il conto delle 48 ore.')}>
                  Registra il pagamento
                </button>
              )}
            </div>
          )}
        </Scheda>

        <Scheda titolo="Titolare nel portale" sotto="Il titolare entra nell’area dell’azienda e invita referente, consulente del lavoro e medico.">
          {titolare.stato === 'mancante' ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void esegui(() => invitaTitolare(id, email.trim(), nome.trim()), 'Invito mandato: il titolare riceve il link per impostare la password, valido 7 giorni.');
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etichetta="Nome e cognome">
                  <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} autoComplete="off" />
                </Campo>
                <Campo etichetta="Email">
                  <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={191} autoComplete="off" />
                </Campo>
              </div>
              <button type="submit" className="btn-acido" disabled={lavoro || email.trim() === ''}>
                Invita il titolare
              </button>
            </form>
          ) : (
            <div className="space-y-2">
              <Chip stato={titolare.stato === 'attivo' ? 'ok' : 'info'}>{titolare.stato === 'attivo' ? 'Accesso attivo' : 'Invitato'}</Chip>
              <p className="text-[14.5px] text-ink">
                {titolare.nome} {titolare.email && <span className="text-ink-muted">· {titolare.email}</span>}
              </p>
              {titolare.invitoScade && <p className="text-[13px] text-ink-muted">Il link scade il {dataIt(titolare.invitoScade)}.</p>}
            </div>
          )}
        </Scheda>
      </div>

      <Scheda titolo="Passi della scheda di avvio">
        <ol className="space-y-4">
          <Passo n={1} nome="Documenti caricati" stato={testo(p1.stato)}>
            <p className="text-[14px] text-ink-soft">
              {numero(p1.documenti) ?? 0} caricati, {numero(p1.letti) ?? 0} letti
              {(numero(p1.in_lettura) ?? 0) > 0 && `, ${numero(p1.in_lettura)} in lettura`}
              {(numero(p1.sanitari_bloccati) ?? 0) > 0 && `, ${numero(p1.sanitari_bloccati)} sanitari bloccati e tolti`}.
            </p>
            {lista(p1.ultimi).length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {lista(p1.ultimi).map((x, i) => (
                  <li key={i}>
                    <Chip stato={rec(x).letto ? 'ok' : 'run'}>
                      <Documento size={13} aria-hidden /> {testo(rec(x).titolo)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/gestionale/aziende/?id=${id}&tab=archivio`} className="mt-2 inline-flex min-h-[44px] items-center text-[14px] text-ink underline decoration-grafite-300 underline-offset-2">
              Carica altri documenti nell’archivio
            </Link>
          </Passo>
          <Passo n={2} nome="Dati letti da confermare" stato={testo(p2.stato)}>
            {lista(p2.da_confermare).length === 0 ? (
              <p className="text-[14px] text-ink-soft">{(numero(p2.confermati) ?? 0) > 0 ? `${numero(p2.confermati)} proposte già confermate.` : 'Ancora nessun dato letto dai documenti.'}</p>
            ) : (
              <ul>
                {lista(p2.da_confermare).map((x, i) => {
                  const r = rec(x);
                  return (
                    <li key={i}>
                      <Riga
                        titolo={testo(r.titolo) ?? 'Dati letti'}
                        sotto={[Object.keys(rec(r.campi)).length + ' campi', testo(r.fonte)].filter(Boolean).join(' · ')}
                        fine={
                          <Link href={`/gestionale/coda/?el=p${numero(r.proposta_id)}`} className="btn-ghost">
                            Conferma
                          </Link>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1 text-[12.5px] text-ink-muted">Nessun dato entra in anagrafica senza la conferma di una persona.</p>
          </Passo>
          <Passo n={3} nome="Cosa manca" stato={testo(p3.stato)}>
            {mancanti.length === 0 ? (
              <p className="text-[14px] text-ink-soft">Anagrafica e organigramma completi.</p>
            ) : (
              <ul className="space-y-2">
                {mancanti.map((m, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Chip stato={m.essenziale ? 'danger' : 'neutral'}>{m.essenziale ? 'Essenziale' : 'Utile'}</Chip>
                    <span className="min-w-0 flex-1 text-[14px] text-ink">
                      <span className="font-medium">{testo(m.voce)}</span>
                      <span className="block text-[13px] text-ink-muted">{testo(m.domanda)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Passo>
          <Passo n={4} nome="Utenti dell’azienda" stato={testo(p4.stato)}>
            <p className="text-[14px] text-ink-soft">
              {lista(p4.utenti).length === 0 ? 'Nessun utente oltre il titolare.' : lista(p4.utenti).map((u) => `${testo(rec(u).nome) ?? testo(rec(u).email)} (${testo(rec(u).etichetta)})`).join(', ')}
            </p>
          </Passo>
        </ol>
      </Scheda>

      <Scheda titolo="Apri il fascicolo" sotto="L’azienda passa ad attiva e partono documenti, visite e formazione.">
        {validata ? (
          <p className="text-[14.5px] text-ink">Fatto il {dataIt(validata)}. Vai alla Scrivania del DVR per preparare il documento.</p>
        ) : (
          <div className="space-y-3">
            {essenziali.length > 0 ? (
              <p className="text-[14px] text-ink-soft">Per aprire il fascicolo mancano: {essenziali.map((m) => testo(m.voce)).join(', ')}.</p>
            ) : (
              <p className="text-[14px] text-ink-soft">Tutto pronto per aprire il fascicolo.</p>
            )}
            <button type="button" className="btn-acido" disabled={lavoro || essenziali.length > 0} onClick={() => void esegui(() => apriFascicolo(id), 'Fascicolo aperto.')}>
              <Spunta size={16} aria-hidden /> Apri il fascicolo
            </button>
          </div>
        )}
      </Scheda>
    </div>
  );
}

function Passo({ n, nome, stato, children }: { n: number; nome: string; stato: string | null; children: React.ReactNode }) {
  const fatto = stato === 'fatto';
  return (
    <li className="flex gap-3">
      <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-medium ${fatto ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink-soft shadow-[inset_0_0_0_1px_#e2e2e5]'}`}>
        {fatto ? <Spunta size={14} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink">
          {nome}
          <Chip stato={fatto ? 'ok' : stato === 'in_corso' ? 'run' : 'todo'}>{fatto ? 'Fatto' : stato === 'in_corso' ? 'In corso' : stato === 'in_attesa_letture' ? 'In attesa' : 'Da fare'}</Chip>
        </p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- nuova azienda

function dimensioneDa(n: number): CompanyDimensione {
  return n < 10 ? 'micro' : n < 50 ? 'piccola' : n < 250 ? 'media' : 'grande';
}

function NuovaAzienda() {
  const router = useRouter();
  const { scegliAzienda } = usePortale();
  const file = useRef<HTMLInputElement>(null);
  const [letti, setLetti] = useState<Partial<Company>>({});
  const [f, setF] = useState({ ragione_sociale: '', partita_iva: '', ateco: '', lavoratori: '', indirizzo: '', comune: '', provincia: '', cap: '' });
  const [stato, setStato] = useState<'libero' | 'lettura' | 'salvo'>('libero');
  const [avviso, setAvviso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const leggi = async (x: File) => {
    setStato('lettura');
    setErrore(null);
    try {
      const r = await getDataSource().companies.extractFromDocument(x);
      const d = r.data;
      const sede = d.sedi?.find((s) => s.tipo === 'legale') ?? d.sedi?.[0];
      setLetti(d);
      setF((v) => ({
        ragione_sociale: d.ragione_sociale ?? v.ragione_sociale,
        partita_iva: d.partita_iva ?? v.partita_iva,
        ateco: d.ateco ?? v.ateco,
        lavoratori: d.lavoratori != null ? String(d.lavoratori) : v.lavoratori,
        indirizzo: sede?.indirizzo ?? v.indirizzo,
        comune: sede?.comune ?? v.comune,
        provincia: sede?.provincia ?? v.provincia,
        cap: sede?.cap ?? v.cap,
      }));
      setAvviso(r.disclaimer);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setStato('libero');
    }
  };

  const salva = async () => {
    if (f.ragione_sociale.trim() === '' || !/^[A-Z]{0,2}\d{11}$/.test(f.partita_iva.trim().toUpperCase())) {
      setErrore('Servono la ragione sociale e una partita IVA di 11 cifre.');
      return;
    }
    setStato('salvo');
    setErrore(null);
    try {
      const n = Math.max(0, Number(f.lavoratori) || 0);
      const altreSedi = (letti.sedi ?? []).filter((s) => s.tipo !== 'legale');
      const c = await getDataSource().companies.create({
        ...letti,
        ragione_sociale: f.ragione_sociale.trim(),
        partita_iva: f.partita_iva.trim().toUpperCase(),
        ateco: f.ateco.trim(),
        ateco_label: letti.ateco_label ?? '',
        lavoratori: n,
        dimensione: letti.dimensione ?? dimensioneDa(n),
        sedi: [{ tipo: 'legale', indirizzo: f.indirizzo.trim(), comune: f.comune.trim(), provincia: f.provincia.trim().toUpperCase(), cap: f.cap.trim() }, ...altreSedi],
      } as Omit<Company, 'id' | 'created_at' | 'created_by'>);
      await iniziaAvvio(c.id);
      scegliAzienda(c.id);
      router.push(`/gestionale/avvio/?id=${c.id}`);
    } catch (e) {
      setErrore((e as Error).message);
      setStato('libero');
    }
  };

  const campo = (k: keyof typeof f, etichetta: string, extra: Record<string, unknown> = {}) => (
    <Campo etichetta={etichetta}>
      <input className="input-field" value={f[k]} onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value }))} {...extra} />
    </Campo>
  );

  return (
    <div className="space-y-5">
      <Link href="/gestionale/avvio/" className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] text-ink-muted hover:text-ink">
        <Indietro size={16} aria-hidden /> Avvio dei clienti
      </Link>
      <Testata categoria="persone" icona={Razzo} sopra="Avvio dei clienti" titolo="Nuova azienda" sotto="Carica la visura camerale: leggiamo i dati, tu li controlli e salvi." />
      <Scheda titolo="Dalla visura" sotto="PDF, foto o file firmato .p7m. I dati letti sono una proposta da verificare.">
        <input ref={file} type="file" accept=".pdf,.p7m,image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void leggi(e.target.files[0])} />
        <button type="button" className="btn-acido" disabled={stato !== 'libero'} onClick={() => file.current?.click()}>
          {stato === 'lettura' ? 'Leggo la visura' : 'Carica la visura'}
        </button>
        {avviso && <p className="mt-3 rounded-[1rem] bg-grafite-900 px-4 py-3 text-[13.5px] leading-relaxed text-white">{avviso}</p>}
      </Scheda>
      <Scheda titolo="Dati dell’azienda">
        <div className="grid gap-4 sm:grid-cols-2">
          {campo('ragione_sociale', 'Ragione sociale', { maxLength: 191 })}
          {campo('partita_iva', 'Partita IVA', { inputMode: 'numeric', maxLength: 13 })}
          {campo('ateco', 'Codice ATECO', { maxLength: 10, placeholder: '56.10.11' })}
          {campo('lavoratori', 'Lavoratori', { inputMode: 'numeric', maxLength: 5 })}
          {campo('indirizzo', 'Indirizzo della sede legale', { maxLength: 191 })}
          {campo('comune', 'Comune', { maxLength: 100 })}
          {campo('provincia', 'Provincia', { maxLength: 2 })}
          {campo('cap', 'CAP', { inputMode: 'numeric', maxLength: 5 })}
        </div>
        {letti.settings && Object.keys(letti.settings).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-[1rem] bg-perla-velo p-4">
            <Fatto etichetta="Letti anche">{Object.keys(letti.settings).length} altri dati della visura (PEC, REA, amministratori)</Fatto>
          </div>
        )}
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
          I dati dell’azienda servono a erogare il servizio di sicurezza sul lavoro (D.Lgs. 81/08) e sono trattati secondo il GDPR: partita IVA e codice fiscale sono cifrati.
        </p>
        {errore && (
          <div className="mt-3">
            <Errore testo={errore} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={stato !== 'libero'} onClick={() => void salva()}>
            {stato === 'salvo' ? 'Salvo' : 'Crea l’azienda e apri l’avvio'}
          </button>
          <Link href="/gestionale/avvio/" className="btn-ghost">
            Annulla
          </Link>
        </div>
      </Scheda>
    </div>
  );
}
