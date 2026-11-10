'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Scheda, dataIt, traGiorni, type StatoChip } from '../../kit';
import { Avanti, Calendario, Corso, Borsa, Fumetto, Persona, Sirena } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { manda } from '@/lib/portale/api';
import { formazione as caricaFormazione, visite as caricaVisite, type Formazione } from '@/lib/portale/area-api';
import { home as caricaHome, hrefArea, type HomeAzienda, type ScadenzaBreve, type VoceDaFare } from '@/lib/portale/area-operativita';
import { mappaEsito, type EsitoPagamento, type MetodoFoglio } from '@/lib/portale/amministrazione-pagamenti';
import FoglioPagamento from '../condivisi/FoglioPagamento';
import { useCarica } from './comuni';
import { Carosello } from '../../telefono/Carosello';
import { FoglioIscrivi, FoglioPrenotaVisita, type LavoratoreVisita } from './FogliOperativita';
import { SEGNO_CATEGORIA } from '@/lib/portale/area-logica';
import type { CategoriaScadenza } from '@/lib/portale/area-api';

/**
 * Home del telefono e Dashboard del computer (04 Dashboard, NOVITA 20): saluto,
 * "Da fare adesso" in slide, quattro indicatori, Pronto Ispezioni, denuncia di
 * un infortunio, le sedi, prossime scadenze, azioni rapide e il referente.
 * L'assistente si apre dal pulsante fisso del guscio, non da questa pagina.
 */

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const TESTO_STATO: Record<string, string> = { danger: 'Scaduto', warn: 'In scadenza', todo: 'Da prenotare', info: 'Prenotata', ok: 'In regola' };

function dataLunga(d: Date): string {
  const t = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function saluto(d: Date): string {
  const h = d.getHours();
  return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

export default function Home() {
  const { azienda, user, versione, sede } = usePortale();
  const router = useRouter();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCarica(() => caricaHome(aid, sede), [aid, versione, sede]);
  const [prenota, setPrenota] = useState<{ lavoratore: LavoratoreVisita | null; persone: LavoratoreVisita[] } | null>(null);
  const [iscrivi, setIscrivi] = useState<{ f: Formazione; corso: string | null; lavoratori: number[] } | null>(null);
  const [paga, setPaga] = useState<{ id: number; testo: string; importo: number } | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  if (!azienda) return null;
  const oggi = new Date();
  const nome = user.name.split(' ')[0];

  const apriPrenota = async (lavoratoreId: number | null) => {
    try {
      const v = await caricaVisite(aid, sede);
      const persone = (v?.lavoratori ?? []).map((l) => ({ id: l.id, nome: l.nome, mansione: l.mansione, tipo: l.tipoVisita, centro: l.luogo }));
      setPrenota({ lavoratore: persone.find((p) => p.id === lavoratoreId) ?? null, persone: persone.filter((p) => !(v?.lavoratori.find((l) => l.id === p.id)?.appuntamento)) });
    } catch (e) {
      setAvviso(e instanceof Error ? e.message : 'Visite non disponibili.');
    }
  };
  const apriIscrivi = async (corso: string | null, lavoratori: number[]) => {
    try {
      const f = await caricaFormazione(aid, sede);
      if (f) setIscrivi({ f, corso, lavoratori });
    } catch (e) {
      setAvviso(e instanceof Error ? e.message : 'Formazione non disponibile.');
    }
  };
  const esegui = (v: VoceDaFare) => {
    const a = v.azione;
    if (a?.tipo === 'prenota') return void apriPrenota(Number(a.lavoratore_id) || null);
    if (a?.tipo === 'iscrivi') return void apriIscrivi(String(a.corso ?? ''), a.lavoratore_id ? [Number(a.lavoratore_id)] : []);
    if (a?.tipo === 'paga_quota') return setPaga({ id: Number(a.id), testo: v.testo, importo: Number(String(v.nota ?? '').replace(/[^\d,]/g, '').replace(',', '.')) || 0 });
    if (a?.tipo === 'firma') return void router.push('/azienda/documenti/');
    if (a?.tipo === 'paga_conguaglio') return void router.push('/azienda/contratto/');
    router.push(hrefArea(v.link));
  };

  return (
    <div className="mx-auto max-w-[85rem] space-y-6 pb-2">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[20px] font-light text-ink-muted">{dataLunga(oggi)}</p>
          <h1 className="text-[34px] font-medium leading-tight tracking-[-0.03em] text-ink lg:text-[44px]">
            <span className="lg:hidden">Ciao {nome}</span>
            <span className="hidden lg:inline">
              {saluto(oggi)}, {nome}
            </span>
          </h1>
        </div>
        {dati && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            {dati.sede && <Chip stato="neutral">Stai guardando: {dati.sede}</Chip>}
            {dati.servizio.attivo && <Chip stato="ok">Servizio attivo</Chip>}
            {dati.servizio.rinnovoIl && <span>Rinnovo il {dataIt(dati.servizio.rinnovoIl)}</span>}
          </div>
        )}
      </header>

      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !dati && <Caricamento />}
      {avviso && <Errore testo={avviso} onRiprova={() => setAvviso(null)} />}

      {dati && (
        <>
          {dati.avvio && (
            <Link href="/azienda/avvio/" className="flex items-center gap-4 rounded-[1.5rem] p-4 ring-1 ring-inset ring-perla-linea hover:ring-grafite-900">
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acido-400 text-acido-950">
                <Avanti size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium text-ink">Completa il fascicolo</span>
                <span className="block text-[13.5px] text-ink-muted">
                  {dati.avvio.pronti} di {dati.avvio.totale} pronti · {dati.avvio.daCaricare} da caricare da te
                </span>
              </span>
              <span className="hidden h-2 w-48 overflow-hidden rounded-full bg-perla-velo md:block">
                <span className="block h-full bg-acido-400" style={{ width: `${dati.avvio.totale ? Math.round((100 * dati.avvio.pronti) / dati.avvio.totale) : 0}%` }} />
              </span>
              <Avanti size={20} aria-hidden className="text-ink" />
            </Link>
          )}

          <section aria-labelledby="da-fare">
            <div className="flex items-center gap-2">
              <h2 id="da-fare" className="text-[24px] font-medium tracking-[-0.02em] text-ink">
                Da fare adesso
              </h2>
              <span className="cifre rounded-full bg-grafite-900 px-2.5 py-0.5 text-[13px] font-medium text-acido-400">{dati.daFare.length}</span>
            </div>
            <SlideDaFare voci={dati.daFare} onEsegui={esegui} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Indicatori d={dati} />
            <div className="flex flex-col gap-4">
              {dati.prontoIspezioni && (
                <Link href="/azienda/ispezioni/" className="flex flex-1 flex-col justify-between gap-6 rounded-[1.5rem] bg-grafite-900 p-5 text-white">
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-[20px] font-medium">Pronto Ispezioni</span>
                      <span className="block text-[13.5px] text-grafite-400">Hai un controllo in azienda?</span>
                    </span>
                    <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink">
                      <Avanti size={16} />
                    </span>
                  </span>
                  <span>
                    <span className="cifre text-[44px] font-light leading-none text-acido-400">15</span>
                    <span className="text-[20px] text-grafite-400"> min</span>
                    <span className="mt-1 block text-[13.5px] text-grafite-400">Ti richiamiamo entro 15 minuti e hai tutti i documenti pronti, anche senza rete.</span>
                  </span>
                </Link>
              )}
              {dati.denunciaInfortunio && (
                <Link href="/azienda/infortuni/?denuncia=1" className="flex min-h-[8.5rem] items-center gap-4 rounded-[1.5rem] bg-stato-danger p-6 text-stato-danger-ink hover:brightness-95">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-stato-danger-segno">
                    <Sirena size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium">Denuncia un infortunio</span>
                    <span className="block text-[13.5px] opacity-80">Carica la copia: l’assistente la legge e propone l’aggiornamento del DVR</span>
                  </span>
                  <Avanti size={16} aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {dati.sedi.length > 0 && (
            <section aria-labelledby="sedi" className="pt-4">
              <h2 id="sedi" className="text-[20px] font-medium text-ink">
                Le tue sedi
              </h2>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {dati.sedi.map((s) => (
                  <div key={s.id} className="rounded-[1.5rem] p-5 ring-1 ring-inset ring-perla-linea">
                    <p className="text-[16px] font-medium text-ink">{s.nome}</p>
                    <p className="text-[13px] text-ink-muted">{[s.insegna, s.indirizzo].filter(Boolean).join(' · ')}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        [s.lavoratori, 'lavoratori'],
                        [s.daFare, 'da fare'],
                        [s.formazione === null ? 'n.d.' : `${s.formazione}%`, 'formazione'],
                      ].map(([n, t]) => (
                        <span key={String(t)}>
                          <span className="cifre block text-[24px] font-light text-ink">{n}</span>
                          <span className="block text-[12.5px] text-ink-muted">{t}</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3">
                      {s.scadenzeSuperate > 0 ? (
                        <Chip stato="danger">{s.scadenzeSuperate === 1 ? '1 scadenza superata' : `${s.scadenzeSuperate} scadenze superate`}</Chip>
                      ) : (
                        <Chip stato="ok">Nessuna scadenza superata</Chip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ProssimeScadenze voci={dati.prossimeScadenze} />
            <div className="flex flex-col gap-4">
              {dati.azioniRapide.length > 0 && (
                <Scheda titolo="Azioni rapide" className="flex-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dati.azioniRapide.map((a) => {
                      const I = a.k === 'assumi' ? Persona : a.k === 'prenota' ? Calendario : a.k === 'iscrivi' ? Corso : Borsa;
                      const onClick = () =>
                        a.k === 'prenota' ? void apriPrenota(null) : a.k === 'iscrivi' ? void apriIscrivi(null, []) : router.push(a.k === 'assumi' ? '/azienda/persone/?nuovo=1' : '/azienda/servizi/?vista=catalogo');
                      return (
                        <button key={a.k} type="button" onClick={onClick} className="flex items-center gap-3 rounded-[1rem] p-3 text-left ring-1 ring-inset ring-perla-linea hover:ring-grafite-900">
                          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-perla-velo text-ink">
                            <I size={18} />
                          </span>
                          <span className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{a.testo}</span>
                          <Avanti size={16} aria-hidden className="text-ink-muted" />
                        </button>
                      );
                    })}
                  </div>
                </Scheda>
              )}
              {dati.referente && (
                <Scheda titolo="Il tuo referente">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cat-assistenza text-[15px] font-medium text-cat-assistenza-ink">
                      {dati.referente.iniziali}
                    </span>
                    <span>
                      <span className="block text-[16px] font-medium text-ink">{dati.referente.nome}</span>
                      <span className="block text-[13px] text-ink-muted">{dati.referente.ruolo}</span>
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href="/azienda/messaggi/" className="btn-primary flex-1">
                      <Fumetto size={16} aria-hidden /> Scrivi
                    </Link>
                    {dati.referente.telefono && (
                      <a href={`tel:${dati.referente.telefono.replace(/\s+/g, '')}`} className="btn-ghost flex-1">
                        {dati.referente.telefono}
                      </a>
                    )}
                  </div>
                </Scheda>
              )}
            </div>
          </div>
        </>
      )}

      {prenota && <FoglioPrenotaVisita aziendaId={aid} lavoratore={prenota.lavoratore} persone={prenota.persone} onChiudi={() => setPrenota(null)} onFatto={carica} />}
      {iscrivi && (
        <FoglioIscrivi
          aziendaId={aid}
          corsi={iscrivi.f.catalogo.filter((k) => !k.aPagamento)}
          classi={iscrivi.f.classi}
          persone={iscrivi.f.persone.map((x) => ({ id: x.id, nome: x.nome, mansione: x.mansione, stati: Object.fromEntries(x.corsi.map((k) => [k.codice, k.stato])) }))}
          corsoIniziale={iscrivi.corso}
          lavoratoriIniziali={iscrivi.lavoratori}
          onChiudi={() => setIscrivi(null)}
          onFatto={carica}
        />
      )}
      {paga && (
        <FoglioPagamento
          aperto
          onChiudi={() => setPaga(null)}
          aziendaId={aid}
          titolo="Quota d’ingresso"
          voce={paga.testo}
          importo={paga.importo}
          paga={async (metodo: MetodoFoglio): Promise<EsitoPagamento> => {
            if (metodo !== 'wallet') throw new Error('Per ora la quota d’ingresso si paga dal wallet.');
            const r = (await manda(`/portale/quote/${paga.id}/paga-wallet`)) as { data?: unknown };
            return mappaEsito({ ...(r.data as object), stato: 'riuscito', importo: paga.importo });
          }}
          onPagato={() => carica()}
        />
      )}
    </div>
  );
}

/**
 * "Da fare adesso" a slide orizzontale (NOVITA 20). Sul telefono il Carosello del guscio
 * (scatto e puntini, schede all'86 %); sul computer tre schede per riga con le frecce ai lati.
 */
function SlideDaFare({ voci, onEsegui }: { voci: VoceDaFare[]; onEsegui: (v: VoceDaFare) => void }) {
  const area = useRef<HTMLDivElement>(null);
  const [inizio, setInizio] = useState(true);
  const [fine, setFine] = useState(voci.length <= 1);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const aggiorna = () => {
      setInizio(el.scrollLeft <= 4);
      setFine(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    aggiorna();
    el.addEventListener('scroll', aggiorna, { passive: true });
    window.addEventListener('resize', aggiorna);
    return () => {
      el.removeEventListener('scroll', aggiorna);
      window.removeEventListener('resize', aggiorna);
    };
  }, [voci.length]);
  if (voci.length === 0)
    return <p className="mt-4 rounded-[1.5rem] bg-acido-400 p-6 text-[16px] font-medium text-acido-950">Niente da fare, è tutto in regola.</p>;
  const scorri = (dir: 1 | -1) => {
    const el = area.current;
    const prima = el?.firstElementChild as HTMLElement | null;
    if (el && prima) el.scrollBy({ left: dir * (prima.offsetWidth + 16), behavior: 'smooth' });
  };
  const scheda = (v: VoceDaFare, i: number, classe: string) => (
    <article
      key={v.chiave}
      className={clsx('flex min-h-[16rem] flex-col justify-between gap-6 rounded-[1.5rem] p-6', i === 0 ? 'bg-acido-400 text-acido-950' : 'bg-grafite-900 text-white', classe)}
    >
      <span className="flex items-start justify-between gap-3">
        <span aria-hidden className={clsx('grid h-11 w-11 place-items-center rounded-full', i === 0 ? 'bg-white' : 'bg-white/10')}>
          <span className={clsx('h-2.5 w-2.5 rounded-full', SEGNO_CATEGORIA[v.categoria as CategoriaScadenza] ?? 'bg-grafite-400')} />
        </span>
        <span className="cifre text-[12.5px] opacity-60">
          {i + 1} di {voci.length}
        </span>
      </span>
      <span>
        <span className="block text-[20px] font-medium leading-tight">{v.testo}</span>
        {v.nota && <span className="mt-1.5 block text-[13.5px] opacity-75">{v.nota}</span>}
      </span>
      <button
        type="button"
        onClick={() => onEsegui(v)}
        className={clsx('flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium', i === 0 ? 'bg-grafite-900 text-white' : 'bg-acido-400 text-acido-950 hover:bg-acido-500')}
      >
        {v.pulsante} <Avanti size={16} aria-hidden />
      </button>
    </article>
  );
  return (
    <>
      <div className="mt-4 lg:hidden">
        <Carosello etichetta="Da fare adesso">{voci.map((v, i) => scheda(v, i, 'h-full'))}</Carosello>
      </div>
      <div className="mt-4 hidden items-stretch lg:flex">
        {voci.length > 1 && !inizio && (
          <button type="button" aria-label="Precedenti" onClick={() => scorri(-1)} className="mb-1 mr-4 grid w-[72px] shrink-0 place-items-center rounded-[1.5rem] bg-acido-400 text-acido-950 hover:bg-acido-500">
            <Avanti size={28} aria-hidden className="rotate-180" />
          </button>
        )}
        <div ref={area} className="flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
          {voci.map((v, i) => scheda(v, i, 'w-[calc((100%-32px)/3)] shrink-0 snap-start'))}
        </div>
        {voci.length > 1 && !fine && (
          <button type="button" aria-label="Successive" onClick={() => scorri(1)} className="mb-1 ml-4 grid w-[72px] shrink-0 place-items-center rounded-[1.5rem] bg-acido-400 text-acido-950 hover:bg-acido-500">
            <Avanti size={28} aria-hidden />
          </button>
        )}
      </div>
    </>
  );
}

function Indicatori({ d }: { d: HomeAzienda }) {
  const i = d.indicatori;
  const card = (href: string, segno: string, etichetta: string, numero: React.ReactNode, dettaglio: React.ReactNode) => (
    <Link href={href} className="flex flex-col justify-between gap-3 rounded-[1.5rem] p-5 ring-1 ring-inset ring-perla-linea hover:ring-grafite-900">
      <span className="flex items-center gap-2 text-[13.5px] text-ink-muted">
        <span aria-hidden className={clsx('h-2 w-2 rounded-full', segno)} />
        <span className="flex-1">{etichetta}</span>
        <Avanti size={16} aria-hidden className="-rotate-45" />
      </span>
      <span className="cifre text-[44px] font-light leading-none text-ink">{numero}</span>
      <span className="text-[13px] text-ink-muted">{dettaglio}</span>
    </Link>
  );
  const barra = (perc: number | null, cls: string) => (
    <span className="mb-1.5 block h-1.5 overflow-hidden rounded-full bg-perla-velo">
      <span className={clsx('block h-full', cls)} style={{ width: `${perc ?? 0}%` }} />
    </span>
  );
  const perVisite = i.visite.totale ? Math.round((100 * i.visite.ok) / i.visite.totale) : null;
  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
      {card(
        '/azienda/scadenze/',
        'bg-cat-scadenze-segno',
        'Scadenze entro 30 giorni',
        i.scadenze30.totale,
        <>
          <span className="font-medium text-stato-danger-segno">{i.scadenze30.scadute} scadute</span> · {i.scadenze30.maiFatte} mai fatte · {i.scadenze30.prenotate} già prenotate
        </>
      )}
      {card(
        '/azienda/formazione/',
        'bg-cat-formazione-segno',
        'Copertura formativa',
        <>
          {i.copertura.percentuale ?? 'n.d.'}
          <span className="text-[20px] text-ink-muted">%</span>
        </>,
        <>
          {barra(i.copertura.percentuale, 'bg-cat-formazione-segno')}
          {i.copertura.ok} lavoratori su {i.copertura.totale} con tutti i corsi validi
        </>
      )}
      {card(
        '/azienda/visite/',
        'bg-cat-visite-segno',
        'Visite valide',
        <>
          {i.visite.ok}
          <span className="text-[20px] text-ink-muted">/{i.visite.totale}</span>
        </>,
        <>
          {barra(perVisite, 'bg-cat-visite-segno')}
          {i.visite.inCalendario} visite in calendario
        </>
      )}
      {card(
        '/azienda/documenti/',
        'bg-cat-documenti-segno',
        'Completezza del fascicolo',
        <>
          {i.fascicolo.percentuale ?? 'n.d.'}
          <span className="text-[20px] text-ink-muted">%</span>
        </>,
        <>
          {barra(i.fascicolo.percentuale, 'bg-cat-documenti-segno')}
          {i.fascicolo.manca.length === 0
            ? 'Niente da completare'
            : `Manca: ${i.fascicolo.manca.slice(0, 2).join(', ')}${i.fascicolo.manca.length > 2 ? ` e altri ${i.fascicolo.manca.length - 2}` : ''}`}
        </>
      )}
    </div>
  );
}

function ProssimeScadenze({ voci }: { voci: ScadenzaBreve[] }) {
  return (
    <Scheda
      titolo="Prossime scadenze"
      azioni={
        <Link href="/azienda/scadenze/" className="text-[13.5px] font-medium text-ink hover:underline">
          Apri lo scadenziario
        </Link>
      }
    >
      {voci.length === 0 ? (
        <p className="py-2 text-[14px] text-ink-muted">Niente in scadenza nei prossimi 30 giorni.</p>
      ) : (
        <ul>
          {voci.map((v) => (
            <li key={v.chiave}>
              <Link href={hrefArea(v.link)} className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0 hover:bg-perla-velo/60">
                <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', SEGNO_CATEGORIA[v.categoria as CategoriaScadenza] ?? 'bg-grafite-400')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">{v.titolo}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">{v.data ? `${dataIt(v.data)} · ${traGiorni(v.data)}` : 'Mai fatta'}</span>
                </span>
                <Chip stato={v.stato as StatoChip}>{TESTO_STATO[v.stato] ?? ''}</Chip>
                <Avanti size={16} aria-hidden className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Scheda>
  );
}
