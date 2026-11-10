'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CosaMancaDvr, vociMancanti } from '../../CosaMancaDvr';
import { ArchivioAzienda } from '../../ArchivioAzienda';
import { puoRedigere } from '@/lib/portale/documenti';
import { Azienda, Cerca, Indietro, Piu, Segnalibro } from '@/components/icone';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt, statoData, traGiorni } from '../../kit';
import { isApiMode } from '@/lib/data-source';
import {
  conPreferita,
  conRecente,
  contaPerStato,
  filtraAziende,
  FILTRO_AZIENDE_INIZIALE,
  leggiPreferenze,
  salvaPreferenze,
  type FiltroAziende,
  type FiltroStatoAziende,
  type OrdineAziende,
  type PreferenzeAziende,
} from '@/lib/agente-aziende';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { caricaAziende, caricaCoda, caricaScheda, cambiaTecnico, safetyScore, type ElencoAziende, type ElementoCoda, type RigaAzienda } from '@/lib/portale/gestionale-api';
import { chipTermine, indiceDaRighe, tonoScore } from '@/lib/portale/gestionale-logica';
import { ChipTono, Campo, Fatto, Pallino } from './comune';
import { clsx } from '@/lib/clsx';
import { FoglioInvito, SchedaChiSegue } from '../azienda/Utenti';
import { chiSegue, matricePermessi, type ChiSegue, type Matrice } from '@/lib/portale/azienda-account-api';
import { RiquadroLogo } from '../../RiquadroLogo';
import { LinkScrivania } from '@/components/cowork/LinkScrivania';
import { caricaAvvii, type VistaAvvio } from '@/lib/portale/gestionale-api';
import { FILTRO_TABELLA, STATI_AZIENDA, filtraTabella, filtriAttivi, tonoFascicolo, ultimoContatto, type FiltroTabella } from '@/lib/portale/gestionale-permessi';
import { caricaRinnovi, chipRinnovo, confermaOrganico, differenzaRinnovo, linkVediComeCliente, statoVediComeCliente, usePermessiStaff, type RigaRinnovo, type VistaRinnovi } from '@/lib/portale/gestionale-permessi';
import { contoOre } from '@/lib/portale/gestionale-logica';
import type { ReactNode } from 'react';

/**
 * Aziende del gestionale (spec 6): elenco con ricerca e filtri (la stessa
 * logica dell'agente, lib/agente-aziende.ts) e scheda a 360 gradi con ?id=.
 * Dalla scheda si apre il lavoro: coda dell'azienda, avvio, DVR, sopralluoghi,
 * POS, Pronto Ispezioni. Fascicolo e documenti restano nelle loro sezioni.
 */
export default function Aziende() {
  return (
    <Suspense fallback={<Caricamento />}>
      <AziendeVista />
    </Suspense>
  );
}

function AziendeVista() {
  const params = useSearchParams();
  const { filtroCliente } = usePortale();
  const id = Number(params.get('id'));
  if (Number.isInteger(id) && id > 0) return <SchedaAzienda id={id} />;
  // Filtro "Solo <azienda>" attivo: la scheda del cliente scelto; tolto il filtro, l'elenco per sceglierne un altro.
  return filtroCliente ? <SchedaAzienda id={filtroCliente} /> : <ElencoConSchede statoIniziale={params.get('stato')} vista={params.get('vista')} />;
}

type VistaAziende = 'elenco' | 'avvii' | 'rinnovi';

/** Sotto-schede della sezione (2): Elenco, Avvii, Rinnovi a 90 giorni. */
function ElencoConSchede({ statoIniziale, vista }: { statoIniziale: string | null; vista: string | null }) {
  const [v, setV] = useState<VistaAziende>(vista === 'avvii' || vista === 'rinnovi' ? vista : 'elenco');
  const { versione } = usePortale();
  const [avvii, setAvvii] = useState<VistaAvvio | null>(null);
  const [rinnovi, setRinnovi] = useState<VistaRinnovi | null>(null);
  useEffect(() => {
    if (!isApiMode()) return;
    caricaAvvii().then(setAvvii).catch(() => undefined);
    caricaRinnovi().then(setRinnovi).catch(() => undefined);
  }, [versione]);
  const oltre = avvii?.aperte.filter((p) => (p.oreDalPagamento ?? 0) > 48).length ?? 0;
  const schede = (
    <Schede<VistaAziende>
      etichetta="Aziende"
      attiva={v}
      onCambia={setV}
      voci={[
        { k: 'elenco', t: 'Elenco' },
        { k: 'avvii', t: 'Avvii', n: oltre > 0 ? oltre : (avvii?.aperte.length ?? 0) },
        { k: 'rinnovi', t: 'Rinnovi a 90 giorni', n: rinnovi?.entro90.length ?? 0 },
      ]}
    />
  );
  if (v === 'elenco') return <ElencoTabella schede={schede} soloScadute={statoIniziale === 'scaduto'} />;
  return (
    <div className="space-y-5">
      <Testata categoria="utenti" icona={Azienda} sopra="Clienti" titolo="Aziende" />
      {schede}
      {v === 'avvii' && <Avvii dati={avvii} />}
      {v === 'rinnovi' && <Rinnovi dati={rinnovi} onCambio={() => caricaRinnovi().then(setRinnovi).catch(() => undefined)} />}
    </div>
  );
}

/** Avvii (2.2): dalla firma all'apertura del fascicolo, conto delle 48 ore. */
function Avvii({ dati }: { dati: VistaAvvio | null }) {
  if (!dati) return <Caricamento />;
  const righe = [...dati.aperte].sort((a, b) => (b.oreDalPagamento ?? -1) - (a.oreDalPagamento ?? -1));
  return (
    <Scheda titolo="Avvii" sotto="Obiettivo: fascicolo aperto entro 48 ore dal pagamento. Verde entro 24 ore · ambra da 24 a 48 ore · rosso oltre 48 ore.">
      {righe.length === 0 ? (
        <Vuoto titolo="Nessun avvio in corso">Le aziende compaiono qui dalla firma del modulo d&apos;ordine fino all&apos;apertura del fascicolo.</Vuoto>
      ) : (
        righe.map((p) => {
          const c = contoOre(p.oreDalPagamento);
          return (
            <Riga
              key={p.azienda.id}
              titolo={p.azienda.nome}
              sotto={`${p.pagatoIl ? `Pagato il ${dataIt(p.pagatoIl)}` : 'In attesa di pagamento'} · ${p.passiFatti} di ${p.passiTotali} passi${p.tecnico ? ` · ${p.tecnico.nome}` : ''}`}
              fine={
                <span className="flex items-center gap-2">
                  <ChipTono tono={p.pagatoIl ? c.tono : 'neutral'}>{p.pagatoIl ? c.testo : 'Parte all’incasso'}</ChipTono>
                  <Link href={`/gestionale/aziende/?id=${p.azienda.id}`} className="btn-ghost min-h-[40px]">
                    Apri pratica
                  </Link>
                </span>
              }
            />
          );
        })
      )}
    </Scheda>
  );
}

/** Rinnovi a 90 giorni (2.3). */
function Rinnovi({ dati, onCambio }: { dati: VistaRinnovi | null; onCambio: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!dati) return <Caricamento />;
  const conferma = (r: RigaRinnovo) =>
    confermaOrganico(r.azienda.id)
      .then((m) => {
        setMsg(m);
        onCambio();
      })
      .catch((e: Error) => setMsg(e.message));
  const tabella = (righe: RigaRinnovo[]): ReactNode => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-[13.5px]">
        <thead>
          <tr className="border-b border-perla-linea text-left text-[12.5px] text-ink-muted">
            <th className="px-3 py-2 font-medium">Azienda</th>
            <th className="px-3 py-2 font-medium">Rinnovo</th>
            <th className="px-3 py-2 font-medium">Disdetta</th>
            <th className="px-3 py-2 font-medium">Elenco · EBIASP · serviti</th>
            {dati.vedeCanone && <th className="px-3 py-2 text-right font-medium">Canone ora</th>}
            {dati.vedeCanone && <th className="px-3 py-2 text-right font-medium">Al rinnovo</th>}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => {
            const g = chipRinnovo(r.giorni);
            const diff = differenzaRinnovo(r.canoneOra, r.canoneRinnovo);
            const base = Math.max(r.elenco, r.ebiasp ?? 0, r.serviti ?? 0);
            return (
              <tr key={r.azienda.id} className="border-b border-perla-linea align-top last:border-b-0">
                <td className="px-3 py-2">
                  <Link href={`/gestionale/aziende/?id=${r.azienda.id}`} className="font-medium text-ink hover:underline">
                    {r.azienda.nome}
                  </Link>
                  <span className="block text-[12.5px] text-ink-muted">{[r.azienda.comune, r.ingressoIl && `ingresso ${dataIt(r.ingressoIl)}`].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="px-3 py-2">
                  {dataIt(r.rinnovoIl)}
                  <span className={clsx('block text-[12.5px]', g.tono === 'warn' ? 'text-stato-warn-segno' : 'text-ink-muted')}>{g.testo}</span>
                </td>
                <td className="px-3 py-2">
                  {dataIt(r.disdettaEntro)}
                  <span className="block text-[12.5px] text-ink-muted">{r.disdettaPassata ? 'Termine passato' : 'PEC entro questa data'}</span>
                </td>
                <td className="cifre px-3 py-2">
                  {r.elenco} · {r.ebiasp ?? 'n.d.'} · {r.serviti ?? 'n.d.'}
                  <span className="block text-[12.5px] text-ink-muted">{r.organicoConfermato ? 'Confermato' : `Base: ${base} · da confermare`}</span>
                </td>
                {dati.vedeCanone && <td className="cifre px-3 py-2 text-right">{r.canoneOra != null ? `${r.canoneOra.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €` : 'n.d.'}</td>}
                {dati.vedeCanone && (
                  <td className="cifre px-3 py-2 text-right">
                    {r.canoneRinnovo != null ? `${r.canoneRinnovo.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €` : 'n.d.'}
                    {diff && <span className={clsx('block text-[12.5px]', diff.aumenta ? 'text-stato-warn-segno' : 'text-ink-muted')}>{diff.testo}</span>}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  {r.organicoConfermato ? (
                    <Chip stato="ok">Organico confermato</Chip>
                  ) : (
                    <button type="button" className="btn-ghost min-h-[40px]" onClick={() => conferma(r)}>
                      Conferma organico
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-soft">{dati.testo}</p>
      {msg && <p className="text-[13.5px] text-ink">{msg}</p>}
      <Scheda titolo="Rinnovi entro 90 giorni">{dati.entro90.length === 0 ? <Vuoto titolo="Nessun rinnovo nei prossimi 90 giorni." /> : tabella(dati.entro90)}</Scheda>
      {dati.piuAvanti.length > 0 && <Scheda titolo="Più avanti">{tabella(dati.piuAvanti)}</Scheda>}
    </div>
  );
}

// ---------------------------------------------------------------- elenco

const STATI: Array<{ k: FiltroStatoAziende; t: string }> = [
  { k: 'tutte', t: 'Tutte' },
  { k: 'scaduto', t: 'Scadute' },
  { k: 'aggiornare', t: 'Da aggiornare' },
  { k: 'ok', t: 'In regola' },
  { k: 'preferite', t: 'Preferite' },
];


function RigaAziendaVista({ r }: { r: RigaAzienda }) {
  const router = useRouter();
  const { user, scegliAzienda } = usePortale();
  // Aprire un'azienda la rende il cliente scelto (anche nelle altre sezioni).
  const apri = () => {
    salvaPreferenze(user.id, conRecente(leggiPreferenze(user.id), r.id));
    scegliAzienda(r.id);
    router.push(`/gestionale/aziende/?id=${r.id}`);
  };
  return (
    <Riga
      onClick={apri}
      inizio={<Pastiglia categoria={r.stato === 'scaduto' ? 'antincendio' : r.stato === 'aggiornare' ? 'contratto' : 'servizi'} icona={Azienda} />}
      titolo={r.ragione_sociale}
      sotto={[r.comune, r.partita_iva && `P.IVA ${r.partita_iva}`, `${r.lavoratori} lavoratori`, r.tecnico?.nome].filter(Boolean).join(' · ')}
      fine={
        <span className="flex shrink-0 flex-col items-end gap-1">
          {r.fase === 'avvio' ? (
            <Chip stato="info">In avvio</Chip>
          ) : (
            <Chip stato={r.stato === 'scaduto' ? 'danger' : r.stato === 'aggiornare' ? 'warn' : 'ok'}>{r.stato === 'ok' ? 'In regola' : r.motivo}</Chip>
          )}
          {r.codaAperte > 0 && <span className="text-[12px] text-ink-subtle">{r.codaAperte === 1 ? '1 in coda' : `${r.codaAperte} in coda`}</span>}
        </span>
      }
    />
  );
}

// ---------------------------------------------------------------- scheda a 360 gradi

type SottoScheda = 'panoramica' | 'persone' | 'archivio' | 'documenti' | 'scadenze' | 'contratto' | 'portale' | 'attivita';

function SchedaAzienda({ id }: { id: number }) {
  const { versione, apri, chiedi, user, aziendaScelta, scegliAzienda } = usePortale();
  // La scheda aperta diventa il cliente scelto: le altre sezioni lavorano su di lei.
  useEffect(() => {
    if (aziendaScelta?.id !== id) scegliAzienda(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const router = useRouter();
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [coda, setCoda] = useState<ElementoCoda[]>([]);
  const [score, setScore] = useState<{ totale: number | null; livello: string | null } | null>(null);
  const [tab, setTab] = useState<SottoScheda>('panoramica');
  // Il Falco apre la sottoscheda giusta con ?tab= (persone, scadenze, documenti...).
  const tabChiesta = useSearchParams()?.get('tab');
  useEffect(() => {
    if (tabChiesta && (['panoramica', 'persone', 'archivio', 'documenti', 'scadenze', 'contratto', 'portale', 'attivita'] as string[]).includes(tabChiesta)) setTab(tabChiesta as SottoScheda);
  }, [tabChiesta, id]);
  const [tecnici, setTecnici] = useState<ElencoAziende | null>(null);
  const [foglioTecnico, setFoglioTecnico] = useState(false);
  const [invita, setInvita] = useState(false);
  const [chi, setChi] = useState<ChiSegue | null>(null);
  const [matrice, setMatrice] = useState<Matrice | null>(null);
  const { permessi, puo } = usePermessiStaff();

  useEffect(() => {
    let vivo = true;
    setErrore(null);
    caricaScheda(id)
      .then((d) => vivo && setS(d))
      .catch((e: Error) => vivo && setErrore(e.message));
    caricaCoda({ aziendaId: id })
      .then((v) => vivo && setCoda(v.elementi))
      .catch(() => undefined);
    safetyScore(id)
      .then((x) => vivo && setScore(x))
      .catch(() => undefined);
    chiSegue(id)
      .then((x) => vivo && setChi(x))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [id, versione]);

  useEffect(() => {
    apri(null, id);
    return () => apri(null, null);
  }, [id, apri]);

  if (errore) {
    // 2.4, stati d'errore: non assegnata al tecnico, fuori dai contatti delle vendite, oppure inesistente.
    const nonTrovata = errore === 'Non trovato o non più disponibile.' || errore.startsWith('Non trovato');
    const r = permessi.ruolo;
    const [titoloE, testoE, pulsante] = !nonTrovata
      ? [null, errore, 'Torna all’elenco']
      : r === 'tecnico'
        ? ['Questa azienda non è assegnata a te', 'Vedi solo le aziende di cui sei il tecnico. Se ti serve, chiedi al coordinatore di assegnartela.', 'Le tue aziende']
        : r === 'vendite'
          ? ['Questa azienda non è tra i tuoi contatti', 'Il tuo ruolo vede solo le aziende che segui.', 'Torna all’elenco']
          : ['Azienda non trovata', 'Forse il collegamento è vecchio.', 'Torna all’elenco'];
    return titoloE ? (
      <Vuoto titolo={titoloE} azione={<Link href="/gestionale/aziende/" className="btn-ghost">{pulsante}</Link>}>
        {testoE}
      </Vuoto>
    ) : (
      <div className="space-y-4">
        <Link href="/gestionale/aziende/" className="btn-ghost">
          <Indietro size={16} aria-hidden /> {pulsante}
        </Link>
        <Errore testo={testoE} />
      </div>
    );
  }
  if (!s) return <Caricamento testo="Carico la scheda" />;

  const a = rec(s.azienda);
  const fig = rec(s.figure);
  const per = rec(s.persone);
  const sc = rec(s.scadenze);
  const doc = rec(s.documenti);
  // DVR in lavorazione o in vigore: quello che si apre nella Scrivania per paragrafi.
  const dvrVivo = lista(doc.dvr).map(rec).filter((d) => d.stato !== 'superseded').map((d) => numero(d.id)).find((x): x is number => x !== null) ?? null;
  const avv = rec(s.avvio);
  const nome = testo(a.ragione_sociale) ?? 'Azienda';
  const tecnico = rec(a.tecnico);
  const sedi = lista(a.sedi).map(rec);
  const sede = sedi.find((x) => x.tipo === 'legale') ?? sedi[0];
  // "Cambia" il tecnico solo con assegnaTecnico (06 par. 6).
  const titolare = puo('assegnaTecnico');
  void user;
  // Vedi come il cliente (06 par. 7.3): con vediComeCliente e se l'azienda ha un'area cliente (un titolare attivo).
  const areaCliente = lista(s.utenti).map(rec).some((u) => u.ruolo === 'titolare' && u.attivo !== false && u.stato !== 'invitato' && u.stato !== 'revocato');
  const vcc = statoVediComeCliente(permessi, areaCliente);

  const apriTecnico = () => {
    setFoglioTecnico(true);
    if (!tecnici) caricaAziende().then(setTecnici).catch(() => undefined);
  };

  return (
    <div className="space-y-5">
      <Link href="/gestionale/aziende/" className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] text-ink-muted hover:text-ink">
        <Indietro size={16} aria-hidden /> Tutte le aziende
      </Link>
      <Testata
        categoria="utenti"
        icona={Azienda}
        titolo={nome}
        sotto={[testo(a.partita_iva) && `P.IVA ${testo(a.partita_iva)}`, testo(a.ateco) && `ATECO ${testo(a.ateco)}`, testo(sede?.comune)].filter(Boolean).join(' · ')}
        azioni={
          <>
            <button type="button" className="btn-primary" onClick={() => chiedi(`Come sta ${nome}? Dimmi da dove cominciare oggi.`)}>
              Chiedi a Falco
            </button>
            {avv.fase === 'avvio' && (
              <Link href={`/gestionale/avvio/?id=${id}`} className="btn-ghost">
                Avvio del cliente
              </Link>
            )}
            <span className="flex flex-col items-start gap-1">
              {vcc.attivo ? (
                <a href={linkVediComeCliente(id, `/gestionale/aziende/?id=${id}`)} target="_blank" rel="noopener" className="btn-ghost">
                  Vedi come il cliente
                </a>
              ) : (
                <button type="button" className="btn-ghost opacity-45" disabled aria-describedby={vcc.motivo ? 'vcc-motivo' : undefined}>
                  Vedi come il cliente
                </button>
              )}
              {vcc.motivo && (
                <span id="vcc-motivo" className="text-[12px] text-ink-muted">
                  {vcc.motivo}
                </span>
              )}
            </span>
          </>
        }
      />

      <Schede<SottoScheda>
        etichetta="Sezioni della scheda"
        attiva={tab}
        onCambia={setTab}
        voci={[
          { k: 'panoramica', t: 'Panoramica', n: coda.length },
          { k: 'persone', t: 'Persone', n: numero(per.totale) ?? 0 },
          { k: 'archivio', t: 'Archivio', n: numero(doc.archivio) ?? undefined },
          { k: 'documenti', t: 'Documenti' },
          { k: 'scadenze', t: 'Scadenze', n: numero(sc.superate) ?? 0 },
          ...(puo('vediContratti') ? [{ k: 'contratto' as SottoScheda, t: 'Contratto' }] : []),
          { k: 'portale', t: 'Portale' },
          { k: 'attivita', t: 'Attività' },
        ]}
      />

      {tab === 'panoramica' && (
        <div className="space-y-4">
          <CosaMancaDvr voci={vociMancanti(s.cosa_manca_dvr)} aziendaId={id} nome={nome} puoScrivere={puoRedigere(user.role)} chiedi={chiedi} compatto />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Riquadro nero etichetta="Safety Score" valore={score?.totale ?? null} unita="/100" sotto={score?.totale == null ? 'Dati insufficienti' : tonoScore(score.totale) === 'ok' ? 'Buono' : tonoScore(score.totale) === 'warn' ? 'Da migliorare' : 'Critico'} />
            <Riquadro etichetta="Lavoratori" valore={numero(per.totale) ?? 0} sotto={`${numero(per.in_sorveglianza) ?? 0} in sorveglianza sanitaria`} onClick={() => setTab('persone')} />
            <Riquadro etichetta="Scadenze superate" valore={numero(sc.superate) ?? 0} tono={(numero(sc.superate) ?? 0) > 0 ? 'danger' : undefined} sotto="Da prenotare subito" onClick={() => setTab('scadenze')} />
            <Riquadro etichetta="Entro 30 giorni" valore={numero(sc.entro_30) ?? 0} tono={(numero(sc.entro_30) ?? 0) > 0 ? 'warn' : undefined} sotto="Corsi, visite e documenti" onClick={() => setTab('scadenze')} />
          </div>

          <Scheda titolo="Nella coda di lavoro" sotto={coda.length === 0 ? 'Niente in coda per questa azienda.' : 'Proposte, allarmi e compiti aperti.'}>
            {coda.length > 0 && (
              <ul>
                {coda.slice(0, 8).map((x) => {
                  const t = chipTermine(x.termine);
                  return (
                    <li key={x.chiave}>
                      <Riga
                        onClick={() => router.push(`/gestionale/coda/?el=${x.chiave}`)}
                        titolo={x.titolo}
                        sotto={[x.tipo === 'proposta' ? 'Proposta' : x.tipo === 'allarme' ? 'Allarme' : 'Compito', x.assegnato?.nome].filter(Boolean).join(' · ')}
                        fine={t ? <ChipTono tono={t.tono}>{t.testo}</ChipTono> : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>

          <div className="grid gap-4 xl:grid-cols-2">
            <Scheda titolo="Figure della sicurezza">
              <div className="grid grid-cols-2 gap-4">
                <Fatto etichetta="Datore di lavoro">{testo(fig.datore_lavoro) ?? <Manca />}</Fatto>
                <Fatto etichetta="RSPP">
                  {testo(fig.rspp) ?? <Manca />}
                  {fig.rspp_esterno === 'si' && <span className="text-ink-muted"> (esterno)</span>}
                </Fatto>
                <Fatto etichetta="Medico competente">{testo(fig.medico_competente) ?? <Manca />}</Fatto>
                <Fatto etichetta={testo(fig.rls_tipo) === 'RLST' ? 'RLST' : 'RLS'}>{testo(fig.rls) ?? (testo(fig.rls_tipo) === 'RLST' ? 'Territoriale' : <Manca />)}</Fatto>
                <Fatto etichetta="Addetti antincendio">{lista(fig.addetti_antincendio).length || <Manca />}</Fatto>
                <Fatto etichetta="Addetti primo soccorso">{lista(fig.addetti_primo_soccorso).length || <Manca />}</Fatto>
              </div>
            </Scheda>
            <Scheda titolo="Anagrafica e contatti">
              <div className="grid grid-cols-2 gap-4">
                <Fatto etichetta="Tecnico assegnato">
                  <span className="flex flex-wrap items-center gap-2">
                    {testo(tecnico.nome) ?? 'Comune a tutto lo studio'}
                    {titolare && (
                      <button type="button" className="text-[13px] text-ink underline decoration-grafite-300 underline-offset-2" onClick={apriTecnico}>
                        Cambia
                      </button>
                    )}
                  </span>
                </Fatto>
                <Fatto etichetta="Natura giuridica">{testo(a.natura_giuridica) ?? <Manca />}</Fatto>
                <Fatto etichetta="Sedi">{sedi.length > 0 ? sedi.map((x) => [testo(x.indirizzo), testo(x.comune)].filter(Boolean).join(', ')).join('; ') : <Manca />}</Fatto>
                <Fatto etichetta="Telefono">{testo(a.telefono) ? <a href={`tel:${testo(a.telefono)}`} className="underline underline-offset-2">{testo(a.telefono)}</a> : <Manca />}</Fatto>
                <Fatto etichetta="Email">{testo(a.email) ?? <Manca />}</Fatto>
                <Fatto etichetta="PEC">{testo(a.pec) ?? <Manca />}</Fatto>
              </div>
            </Scheda>
          </div>

          <RiquadroLogo tipo="azienda" companyId={id} nome={nome} />

          <Scheda titolo="Da qui apri il lavoro">
            <div className="flex flex-wrap gap-2">
              <Link href={`/gestionale/dvr/?id=${id}`} className="btn-ghost">Scrivania del DVR</Link>
              {dvrVivo !== null && <LinkScrivania dvrId={dvrVivo} aziendaId={id} ruolo={user.role} testo="DVR per paragrafi" />}
              <Link href={`/gestionale/sopralluoghi/?azienda=${id}`} className="btn-ghost">Sopralluoghi</Link>
              <Link href={`/gestionale/pos/?id=${id}`} className="btn-ghost">POS e PiMUS</Link>
              <Link href={`/gestionale/prenotazioni/?id=${id}`} className="btn-ghost">Prenotazioni</Link>
              <Link href={`/gestionale/avvio/?id=${id}`} className="btn-ghost">Avvio e fascicolo</Link>
              <button type="button" onClick={() => setTab('archivio')} className="btn-ghost">Archivio: foto, video, audio, documenti</button>
            </div>
          </Scheda>
        </div>
      )}

      {tab === 'persone' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Scheda titolo="Mansioni" sotto={`${numero(per.totale) ?? 0} lavoratori in forza · ${numero(per.visite_scadute) ?? 0} visite scadute`}>
            {lista(per.mansioni).length === 0 ? (
              <Vuoto titolo="Nessun lavoratore">Carica l’elenco del personale dall’avvio del cliente o dall’archivio.</Vuoto>
            ) : (
              <ul>
                {lista(per.mansioni).map((m, i) => (
                  <li key={i} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-perla-linea last:border-b-0">
                    <span className="text-[14.5px] text-ink">{testo(rec(m).mansione)}</span>
                    <span className="cifre text-[14px] text-ink-muted">{numero(rec(m).lavoratori)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12.5px] text-ink-muted">Della visita il gestionale conserva solo la data di scadenza: esiti e giudizi restano al medico competente.</p>
          </Scheda>
          <Scheda titolo="Nuovi assunti comunicati" sotto="Ultimi 30 giorni, dall’area dell’azienda.">
            {lista(per.nuovi).length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessuno.</p>
            ) : (
              <ul>
                {lista(per.nuovi).map((n, i) => (
                  <li key={i}>
                    <Riga titolo={testo(rec(n).nome) ?? ''} sotto={[testo(rec(n).mansione), dataIt(testo(rec(n).dal))].filter(Boolean).join(' · ')} />
                  </li>
                ))}
              </ul>
            )}
          </Scheda>
        </div>
      )}

      {tab === 'archivio' && <ArchivioAzienda aziendaId={id} puoScrivere={puoRedigere(user.role)} />}

      {tab === 'documenti' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Scheda titolo="DVR" azioni={<Link href={`/gestionale/dvr/?id=${id}`} className="btn-ghost">Apri la scrivania</Link>}>
            {lista(doc.dvr).length === 0 ? (
              <Vuoto titolo="Nessun DVR">Il DVR si prepara dalla Scrivania del DVR.</Vuoto>
            ) : (
              <ul>
                {lista(doc.dvr).map((d, i) => {
                  const r = rec(d);
                  return (
                    <li key={i}>
                      <Riga
                        titolo={`Versione ${numero(r.versione)}`}
                        sotto={r.approvato_il ? `Approvato il ${dataIt(testo(r.approvato_il))}` : r.generato_il ? `Generato il ${dataIt(testo(r.generato_il))}` : undefined}
                        fine={
                          <span className="flex flex-wrap items-center justify-end gap-2">
                            {r.stato !== 'superseded' && numero(r.id) !== null && <LinkScrivania dvrId={numero(r.id)!} aziendaId={id} ruolo={user.role} testo="Paragrafi" className="min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" />}
                            <Chip stato={r.stato === 'approved' ? 'ok' : r.stato === 'review' ? 'sign' : 'neutral'}>{r.stato === 'approved' ? 'Approvato' : r.stato === 'review' ? 'In revisione' : r.stato === 'superseded' ? 'Superato' : 'Bozza'}</Chip>
                          </span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>
          <Scheda titolo="Altri documenti e valutazioni" sotto={`${numero(doc.archivio) ?? 0} file nell’archivio dell’azienda`}>
            {[...lista(doc.altri), ...lista(doc.valutazioni), ...lista(doc.pos).map((p) => ({ ...rec(p), titolo: `POS ${testo(rec(p).cantiere) ?? ''}`.trim(), tipo: 'pos' }))].length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessun documento emesso o in lavorazione.</p>
            ) : (
              <ul>
                {[...lista(doc.altri), ...lista(doc.valutazioni), ...lista(doc.pos).map((p) => ({ ...rec(p), titolo: `POS ${testo(rec(p).cantiere) ?? ''}`.trim(), tipo: 'pos' }))].slice(0, 20).map((d, i) => {
                  const r = rec(d);
                  const emesso = r.stato === 'emesso' || r.stato === 'emessa';
                  return (
                    <li key={i}>
                      <Riga
                        titolo={testo(r.titolo) ?? testo(r.tipo) ?? 'Documento'}
                        sotto={testo(r.tipo)?.replace(/_/g, ' ')}
                        fine={<Chip stato={emesso ? 'ok' : 'neutral'}>{emesso ? 'Emesso' : r.stato === 'pronto' || r.stato === 'pronta' ? 'Pronto' : 'Bozza'}</Chip>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>
          <Scheda titolo="Sopralluoghi" azioni={<Link href={`/gestionale/sopralluoghi/?azienda=${id}`} className="btn-ghost">Apri</Link>}>
            {lista(s.sopralluoghi).length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessun verbale di sopralluogo.</p>
            ) : (
              <ul>
                {lista(s.sopralluoghi).map((d, i) => (
                  <li key={i}>
                    <Riga titolo={testo(rec(d).titolo) ?? 'Verbale'} sotto={dataIt(testo(rec(d).aggiornato_il))} fine={<Chip stato={rec(d).stato === 'emesso' ? 'ok' : 'neutral'}>{rec(d).stato === 'emesso' ? 'Emesso' : 'In corso'}</Chip>} />
                  </li>
                ))}
              </ul>
            )}
          </Scheda>
          <Scheda titolo="Pronto Ispezioni" sotto="Ultime richieste dell’azienda.">
            {lista(s.pronto_ispezioni).length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessuna richiesta.</p>
            ) : (
              <ul>
                {lista(s.pronto_ispezioni).map((d, i) => {
                  const r = rec(d);
                  return (
                    <li key={i}>
                      <Riga titolo={testo(r.ente) ? `Controllo ${testo(r.ente)}` : 'Controllo in azienda'} sotto={dataIt(testo(r.il))} fine={<Chip stato={r.richiamata_il ? 'ok' : 'danger'}>{r.richiamata_il ? 'Richiamata' : 'Da richiamare'}</Chip>} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>
        </div>
      )}

      {tab === 'scadenze' && (
        <Scheda titolo="Prossime scadenze" sotto="Delle visite solo date e tipo." azioni={<Link href={`/gestionale/prenotazioni/?id=${id}`} className="btn-ghost">Prenotazioni</Link>}>
          {lista(sc.prossime).length === 0 ? (
            <Vuoto titolo="Nessuna scadenza aperta" />
          ) : (
            <ul>
              {lista(sc.prossime).map((d, i) => {
                const r = rec(d);
                const st = statoData(testo(r.data));
                return (
                  <li key={i}>
                    <Riga
                      titolo={testo(r.descrizione) ?? ''}
                      sotto={[dataIt(testo(r.data)), traGiorni(testo(r.data)), r.prenotazione === 'prenotata' || r.prenotazione === 'in_calendario' ? 'prenotata' : null].filter(Boolean).join(' · ')}
                      fine={st ? <Chip stato={st}>{st === 'danger' ? 'Scaduta' : st === 'warn' ? 'In scadenza' : 'In regola'}</Chip> : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Scheda>
      )}

      {tab === 'contratto' && puo('vediContratti') && (
        <div className="space-y-4">
          {/* Punto d'inserimento della scheda "Adesioni dichiarate" (2.5): il componente lo consegna S3 (API gestionale/aziende/{id}/adesioni). */}
          <section data-punto="adesioni-dichiarate" aria-label="Adesioni dichiarate" />
        </div>
      )}

      {tab === 'portale' && (
        <div className="space-y-4">
        {chi && <SchedaChiSegue chi={chi} />}
        <Scheda
          titolo="Utenti dell’area azienda"
          sotto="Chi entra nel portale dell’azienda e con quale ruolo."
          azioni={
            <span className="flex flex-wrap gap-2">
              {chi?.gestione !== 'interna' && (
                <Link href={`/gestionale/avvio/?id=${id}`} className="btn-ghost">
                  Invita il titolare
                </Link>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setInvita(true);
                  if (!matrice) matricePermessi().then(setMatrice).catch(() => undefined);
                }}
              >
                Invita una persona
              </button>
            </span>
          }
        >
          {lista(s.utenti).length === 0 ? (
            <Vuoto titolo="Nessun utente">Referente, consulente del lavoro e medico competente li inviti da qui o li invita il titolare dell’azienda.</Vuoto>
          ) : (
            <ul>
              {lista(s.utenti).map((u, i) => {
                const r = rec(u);
                return (
                  <li key={i}>
                    <Riga
                      inizio={<Pallino nome={testo(r.nome) ?? testo(r.email) ?? '?'} />}
                      titolo={testo(r.nome) ?? testo(r.email) ?? ''}
                      sotto={[testo(r.etichetta), testo(r.email)].filter(Boolean).join(' · ')}
                      fine={<Chip stato={r.stato === 'invitato' ? 'info' : r.stato === 'revocato' || r.attivo === false ? 'neutral' : 'ok'}>{r.stato === 'invitato' ? 'Invitato' : r.stato === 'revocato' || r.attivo === false ? 'Non attivo' : 'Attivo'}</Chip>}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Scheda>
        </div>
      )}

      {tab === 'attivita' && (
        <Scheda titolo="Attività recenti">
          {lista(s.attivita).length === 0 ? (
            <p className="text-[14px] text-ink-muted">Ancora niente.</p>
          ) : (
            <ul>
              {lista(s.attivita).map((d, i) => {
                const r = rec(d);
                return (
                  <li key={i}>
                    <Riga titolo={testo(r.testo) ?? ''} sotto={[dataIt(testo(r.quando)), testo(r.chi)].filter(Boolean).join(' · ')} />
                  </li>
                );
              })}
            </ul>
          )}
        </Scheda>
      )}

      <FoglioTecnico
        aperto={foglioTecnico}
        aziendaId={id}
        attuale={numero(tecnico.id)}
        tecnici={tecnici?.tecnici ?? null}
        onChiudi={() => setFoglioTecnico(false)}
        onFatto={() => {
          setFoglioTecnico(false);
          caricaScheda(id).then(setS).catch(() => undefined);
        }}
      />
      <FoglioInvito
        aperto={invita}
        aziendaId={id}
        gestisce
        hse={chi?.puoInvitareHse ?? false}
        matrice={matrice}
        onChiudi={() => setInvita(false)}
        onFatto={() => {
          caricaScheda(id).then(setS).catch(() => undefined);
          chiSegue(id).then(setChi).catch(() => undefined);
        }}
      />
    </div>
  );
}

function Manca() {
  return <span className="text-ink-subtle">Da indicare</span>;
}

function FoglioTecnico({ aperto, aziendaId, attuale, tecnici, onChiudi, onFatto }: { aperto: boolean; aziendaId: number; attuale: number | null; tecnici: Array<{ id: number; nome: string }> | null; onChiudi: () => void; onFatto: () => void }) {
  const [scelta, setScelta] = useState<number | null>(attuale);
  const [errore, setErrore] = useState<string | null>(null);
  useEffect(() => {
    if (aperto) {
      setScelta(attuale);
      setErrore(null);
    }
  }, [aperto, attuale]);
  return (
    <Foglio
      aperto={aperto}
      titolo="Cambia il tecnico"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              cambiaTecnico(aziendaId, scelta)
                .then(onFatto)
                .catch((e: Error) => setErrore(e.message))
            }
          >
            Conferma
          </button>
        </>
      }
    >
      {!tecnici ? (
        <Caricamento />
      ) : (
        <Campo etichetta="Tecnico" aiuto="Il nuovo tecnico vede l’azienda da subito. Proposte, allarmi e compiti aperti passano a lui.">
          <select className="input-field" value={scelta ?? ''} onChange={(e) => setScelta(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Nessuno: azienda comune a tutto lo studio</option>
            {tecnici.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}
      {errore && (
        <div className="mt-3">
          <Errore testo={errore} />
        </div>
      )}
      <p className="mt-3 text-[13px] text-ink-muted">Il nuovo tecnico vede l&apos;azienda da subito. Proposte, allarmi e compiti aperti su questa azienda passano a lui. Il precedente non la vede più (AC-02).</p>
    </Foglio>
  );
}

/** Elenco a tabella (2.1): pillole di stato, filtri, colonne ordinabili. */
function ElencoTabella({ schede, soloScadute }: { schede: ReactNode; soloScadute: boolean }) {
  const { versione } = usePortale();
  const router = useRouter();
  const { permessi, puo } = usePermessiStaff();
  const [dati, setDati] = useState<ElencoAziende | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [f, setF] = useState<FiltroTabella>({ ...FILTRO_TABELLA, soloScadute, ordine: soloScadute ? { col: 'scadute', inverso: false } : FILTRO_TABELLA.ordine });
  useEffect(() => {
    caricaAziende().then(setDati).catch((e: Error) => setErrore(e.message));
  }, [versione]);
  const righe = useMemo(() => dati?.aziende ?? [], [dati]);
  const trovate = useMemo(() => filtraTabella(righe, f), [righe, f]);
  const settori = useMemo(() => Array.from(new Set(righe.map((r) => r.ateco_label).filter(Boolean))).sort(), [righe]);
  if (!isApiMode()) return <Vuoto titolo="Aziende">Con il backend collegato qui compaiono le aziende clienti dello studio.</Vuoto>;
  const tecnico = permessi.ruolo === 'tecnico';
  const vendite = permessi.ruolo === 'vendite';
  const contratti = puo('vediContratti');
  const lav = righe.reduce((t, r) => t + r.lavoratori, 0);
  const ordina = (col: FiltroTabella['ordine']['col']) => setF((v) => ({ ...v, ordine: { col, inverso: v.ordine.col === col ? !v.ordine.inverso : false } }));
  const th = (t: string, col?: FiltroTabella['ordine']['col'], destra = false) => (
    <th className={clsx('whitespace-nowrap px-3 py-2 font-medium', destra ? 'text-right' : 'text-left')} aria-sort={col && f.ordine.col === col ? (f.ordine.inverso ? 'ascending' : 'descending') : undefined}>
      {col ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => ordina(col)}>
          {t} <span aria-hidden>↕</span>
        </button>
      ) : (
        t
      )}
    </th>
  );
  const conta = (k: string) => righe.filter((r) => (r.statoAzienda ?? 'attiva') === k).length;
  return (
    <div className="space-y-5">
      <Testata
        categoria="utenti"
        icona={Azienda}
        sopra="Clienti"
        titolo="Aziende"
        sotto={dati ? `${righe.length} ${tecnico ? 'aziende assegnate a te' : vendite ? 'aziende dai tuoi contatti' : 'aziende clienti'} · ${lav} lavoratori seguiti` : 'Carico le aziende'}
        azioni={
          <Link href="/gestionale/avvio/?nuova=1" className="btn-primary" data-falco="nuova_azienda" data-falco-tocca="">
            <Piu size={16} aria-hidden /> Nuova azienda
          </Link>
        }
      />
      {schede}
      {errore && <Errore testo={errore} />}
      <Schede<string>
        etichetta="Stato delle aziende"
        attiva={f.stato}
        onCambia={(k) => setF((v) => ({ ...v, stato: k }))}
        voci={[{ k: 'tutte', t: 'Tutte', n: righe.length }, ...STATI_AZIENDA.map((x) => ({ k: x.k, t: x.t, n: conta(x.k) }))]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <span className="sr-only">Cerca</span>
          <Cerca size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-grafite-400" />
          <input className="input-field pl-11" data-falco-campo="cerca_azienda" placeholder="Cerca per nome, P.IVA, comune o titolare" value={f.testo} onChange={(e) => setF((v) => ({ ...v, testo: e.target.value }))} />
        </label>
        {!tecnico && (
          <select className="input-field h-11 w-auto pr-8 lg:h-10" aria-label="Tecnico" value={f.tecnico ?? ''} onChange={(e) => setF((v) => ({ ...v, tecnico: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">Tutti i tecnici</option>
            {(dati?.tecnici ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        )}
        <select className="input-field h-11 w-auto pr-8 lg:h-10" aria-label="Settore" value={f.settore} onChange={(e) => setF((v) => ({ ...v, settore: e.target.value }))}>
          <option value="">Tutti i settori</option>
          {settori.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select className="input-field h-11 w-auto pr-8 lg:h-10" aria-label="Rischio" value={f.rischio} onChange={(e) => setF((v) => ({ ...v, rischio: e.target.value }))}>
          <option value="">Tutti i rischi</option>
          <option value="basso">Rischio basso</option>
          <option value="medio">Rischio medio</option>
          <option value="alto">Rischio alto</option>
        </select>
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input type="checkbox" checked={f.soloScadute} onChange={(e) => setF((v) => ({ ...v, soloScadute: e.target.checked }))} />
          Solo con scadenze superate
        </label>
      </div>
      <p className="text-[13.5px] text-ink-muted">
        {trovate.length} aziende
        {filtriAttivi(f) && (
          <>
            {' '}su {righe.length} ·{' '}
            <button type="button" className="text-ink underline decoration-grafite-300 underline-offset-2" onClick={() => setF((v) => ({ ...FILTRO_TABELLA, ordine: v.ordine }))}>
              Togli i filtri
            </button>
          </>
        )}
      </p>
      {!dati && !errore && <Caricamento testo="Carico le aziende" />}
      {dati && trovate.length === 0 && (
        <Vuoto titolo="Nessuna azienda corrisponde ai filtri." azione={<button type="button" className="btn-ghost" onClick={() => setF(FILTRO_TABELLA)}>Togli i filtri</button>} />
      )}
      {dati && trovate.length > 0 && (
        <div className="overflow-x-auto rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]">
          <table className="w-full min-w-[64rem] text-[13.5px]">
            <thead>
              <tr className="border-b border-perla-linea text-[12.5px] text-ink-muted">
                {th('Azienda', 'nome')}
                {th('Settore')}
                {th('Stato')}
                {th('Lav.', 'lavoratori', true)}
                {th('Sedi', undefined, true)}
                {th('Tecnico')}
                {contratti && th('Canone/mese', 'canone', true)}
                {th('Fascicolo', 'fascicolo')}
                {th('Scadute', 'scadute', true)}
                {th('Da fare', 'dafare', true)}
                {th('Ultimo contatto', 'contatto')}
                {th('Fonte')}
              </tr>
            </thead>
            <tbody>
              {trovate.map((r) => {
                const st = STATI_AZIENDA.find((x) => x.k === (r.statoAzienda ?? 'attiva')) ?? STATI_AZIENDA[0];
                const uc = ultimoContatto(r.aggiornata);
                const fas = tonoFascicolo(r.completezza ?? 0);
                return (
                  <tr key={r.id} className="cursor-pointer border-b border-perla-linea align-top last:border-b-0 hover:bg-perla-velo" onClick={() => router.push(`/gestionale/aziende/?id=${r.id}`)}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-ink">{r.ragione_sociale}</span>
                      <span className="block text-[12.5px] text-ink-muted">{[r.comune, r.partita_iva].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.ateco_label || 'n.d.'}
                      <span className="block text-[12.5px] text-ink-muted">{[r.ateco, r.rischio].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ChipTono tono={st.tono}>{st.t}</ChipTono>
                    </td>
                    <td className="cifre px-3 py-2.5 text-right">{r.lavoratori}</td>
                    <td className="cifre px-3 py-2.5 text-right">{r.sedi ?? 1}</td>
                    <td className="px-3 py-2.5">
                      {r.tecnico ? (
                        <span className="flex items-center gap-2">
                          <Pallino nome={r.tecnico.nome} /> {r.tecnico.nome}
                        </span>
                      ) : (
                        'n.d.'
                      )}
                    </td>
                    {contratti && <td className="cifre px-3 py-2.5 text-right">{r.canone != null ? `${r.canone.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €` : 'n.d.'}</td>}
                    <td className="px-3 py-2.5">
                      <span className="cifre">{r.completezza ?? 0}%</span>
                      <span aria-hidden className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-perla-velo">
                        <span className={clsx('block h-full rounded-full', fas === 'grafite' ? 'bg-grafite-900' : fas === 'utenti' ? 'bg-cat-utenti-segno' : 'bg-stato-warn-segno')} style={{ width: `${Math.min(100, r.completezza ?? 0)}%` }} />
                      </span>
                    </td>
                    <td className={clsx('cifre px-3 py-2.5 text-right', r.scadute > 0 ? 'font-medium text-stato-danger-segno' : 'text-ink-muted')}>{r.scadute}</td>
                    <td className="cifre px-3 py-2.5 text-right">{r.entro30}</td>
                    <td className="px-3 py-2.5">
                      {uc ? <span className={uc.ambra ? 'text-stato-warn-segno' : ''}>{uc.testo}</span> : 'n.d.'}
                      {r.aggiornata && <span className="block text-[12.5px] text-ink-muted">{dataIt(r.aggiornata)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px]">{r.fonte}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
