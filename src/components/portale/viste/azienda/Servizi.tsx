'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, Spunta, Voce, useCarico } from '../amministrazione-kit';
import FoglioPagamento from '../condivisi/FoglioPagamento';
import { toast } from '../../telefono/stato';
import { clsx } from '@/lib/clsx';
import type { EsitoPagamento, MetodoFoglio } from '@/lib/portale/amministrazione-pagamenti';
import {
  ErroreCampi,
  approvaEPaga,
  avvisami,
  caricaPscOrdine,
  creaLinkPscOrdine,
  dettaglioOrdine,
  lavoratoriPer,
  ordina,
  rifiutaOrdine,
  sezioneServizi,
  sollecita,
  type LavoratoreOrdine,
  type OrdineServizio,
  type Servizio,
  type SezioneServizi,
} from '@/lib/portale/servizi-api';
import { DOMANDE_CANTIERE, PASSI_CANTIERE, bloccati, cantiereVuoto, conAvvisi, conPimus, erroriPasso, euroIt, prefissoCantiere, quante, statoOrdine, titoloBloccati, type DatiCantiere } from '@/lib/portale/servizi-logica';
import { Avanti, Borsa, Campanella, Casco, Copia, Corso, Documento, Fiamma, Indietro, Luogo, Orologio, Provetta, Scarica, Spunta as IconaSpunta, Visita } from '@/components/icone';

export { DettaglioPreventivo } from './DettaglioPreventivo';

type Tab = 'catalogo' | 'ordini';
type IconaC = typeof Borsa;

/** Icone proprie del set (niente icone generiche): per gruppo e per servizio. */
const ICONA: Record<string, IconaC> = {
  casco: Casco, ponteggio: Casco, strati: Casco, modifica: Documento, provetta: Provetta, posate: Visita,
  carrello: Corso, piattaforma: Corso, gru: Corso, trattore: Corso, escavatore: Corso,
  onde: Provetta, vento: Provetta, riciclo: Luogo, fabbrica: Fiamma, gocce: Luogo, altoparlante: Provetta, pratica: Documento, persona: Corso, mappa: Luogo,
};
const icona = (k: string): IconaC => ICONA[k] ?? Borsa;

const CAMPO = 'block h-12 w-full rounded-[12px] border border-line bg-surface px-3.5 text-base text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-acid-400';
const AREA = 'block min-h-[96px] w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-base text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-acid-400';

/** Servizi e ordini dell'area azienda (regole 11, schermate Servizi telefono e computer). */
export default function Servizi() {
  const { azienda, puo, versione, ricarica, apri } = usePortale();
  const [tab, setTab] = useState<Tab>('catalogo');
  const [foglio, setFoglio] = useState<Servizio | null>(null);
  const [ordineId, setOrdineId] = useState<number | null>(null);
  const [rifiuta, setRifiuta] = useState<OrdineServizio | null>(null);
  const [paga, setPaga] = useState<OrdineServizio | null>(null);
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica } = useCarico(() => sezioneServizi(aid), [aid, versione]);
  const [avvisi, setAvvisi] = useState<string[]>([]);
  useEffect(() => setAvvisi(dati?.avvisi ?? []), [dati]);

  if (!azienda) return null;
  if (!puo('ordini_richiedi')) return <Blocco>Il tuo ruolo non può ordinare servizi</Blocco>;
  const titolare = dati?.puoOrdinare ?? puo('ordini_ordina');
  const nomeTit = dati?.titolare ?? 'il titolare';
  const fatto = () => {
    carica();
    ricarica();
  };
  const daApprovare = (dati?.ordini ?? []).filter((o) => o.stato === 'da_approvare');

  return (
    <div className="space-y-5">
      <Testata
        categoria="servizi"
        icona={Borsa}
        sopra={azienda.ragione_sociale}
        titolo="Servizi e ordini"
        sotto={titolare ? 'Servizi a prezzo fisso, su preventivo e in arrivo. Ordini e paghi da qui.' : `Scegli un servizio e invia la richiesta: la approva e la paga ${nomeTit}.`}
        azioni={
          <button type="button" className="btn btn-secondary" onClick={() => setTab('ordini')}>
            <Documento size={16} aria-hidden /> I tuoi ordini
          </button>
        }
      />
      <Schede<Tab> etichetta="Servizi e ordini" attiva={tab} onCambia={setTab} voci={[{ k: 'catalogo', t: 'Catalogo' }, { k: 'ordini', t: 'Ordini', n: daApprovare.length }]} />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}

      {dati && tab === 'catalogo' && (
        <Catalogo
          dati={dati}
          titolare={titolare}
          nomeTit={nomeTit}
          avvisi={avvisi}
          onApri={(s) => setFoglio(s)}
          onAvvisami={async (s) => {
            try {
              toast(await avvisami(aid, s.id), 'info');
              setAvvisi((a) => [...a, s.id]);
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Non riuscito', 'avviso');
            }
          }}
        />
      )}

      {dati && tab === 'ordini' && (
        <Ordini
          dati={dati}
          titolare={dati.puoApprovare}
          onApri={(o) => {
            setOrdineId(o.id);
            apri({ tipo: 'ordine', id: o.id }, aid);
          }}
          onRifiuta={setRifiuta}
          onApprova={(o) => approva(o)}
          onCatalogo={() => setTab('catalogo')}
        />
      )}

      <FoglioServizio servizio={foglio} dati={dati} titolare={titolare} nomeTit={nomeTit} aziendaId={aid} onChiudi={() => setFoglio(null)} onFatto={fatto} />
      <DettaglioOrdine id={ordineId} titolare={dati?.puoApprovare ?? false} nomeTit={nomeTit} onChiudi={() => setOrdineId(null)} onRifiuta={setRifiuta} onApprova={(o) => approva(o)} onFatto={fatto} />
      <FoglioRifiuta ordine={rifiuta} onChiudi={() => setRifiuta(null)} onFatto={() => { setRifiuta(null); setOrdineId(null); fatto(); }} />
      <FoglioPagamento
        aperto={paga !== null}
        onChiudi={() => setPaga(null)}
        aziendaId={aid}
        titolo="Approva e paga"
        voce={paga?.titolo ?? ''}
        importo={paga?.importo ?? 0}
        paga={async (m: MetodoFoglio) => {
          const r = await approvaEPaga(paga!.id, m);
          return r.pagamento ?? ({ id: 0, stato: 'riuscito', messaggio: 'Pagamento riuscito', importo: paga!.importo ?? 0, daWallet: 0, iban: null, nota: null } as EsitoPagamento);
        }}
        onPagato={() => {
          setPaga(null);
          setOrdineId(null);
          fatto();
        }}
      />
    </div>
  );

  async function approva(o: OrdineServizio) {
    if (o.servizio === 'haccp') {
      try {
        await approvaEPaga(o.id, null);
        toast('Supplemento HACCP attivato');
        setOrdineId(null);
        fatto();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Non riuscito', 'avviso');
      }
      return;
    }
    setPaga(o);
  }
}

// ---------------------------------------------------------------- catalogo

function Catalogo({ dati, titolare, nomeTit, avvisi, onApri, onAvvisami }: { dati: SezioneServizi; titolare: boolean; nomeTit: string; avvisi: string[]; onApri: (s: Servizio) => void; onAvvisami: (s: Servizio) => void }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 lg:grid-cols-2">
        {dati.omaggi && (
          <div className="flex items-center gap-4 rounded-xl bg-acid-400 p-5 text-acid-950">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-black text-acid-400">
              <Borsa size={22} aria-hidden />
            </span>
            <div>
              <p className="text-title">Hai {euroIt(dati.omaggi.importo)} di crediti omaggio</p>
              <p className="text-small">Valgono sui servizi aggiuntivi e si usano per primi al pagamento{dati.omaggi.scadeIl ? ` · scadono il ${dataIt(dati.omaggi.scadeIl)}` : ''}.</p>
            </div>
          </div>
        )}
        {titolare ? (
          <Avviso>
            <strong className="block">Come si paga</strong>Wallet, carta o bonifico. Con il bonifico il servizio urgente parte all&apos;accredito e da lì decorrono le 24 ore lavorative.
          </Avviso>
        ) : (
          <Avviso>
            <strong className="block">Le tue richieste vanno al titolare</strong>
            {nomeTit} riceve una notifica, approva e paga. Ti avvisiamo appena il servizio parte.
          </Avviso>
        )}
      </div>
      {dati.gruppi.map((g) => {
        const voci = dati.catalogo.filter((s) => s.gruppo === g.nome);
        if (voci.length === 0) return null;
        return (
          <section key={g.nome}>
            <h2 className="text-h3 text-fg">
              {g.nome}
              {g.nota && <span className="text-small font-normal text-fg-muted"> · {g.nota}</span>}
            </h2>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {voci.map((s) => (
                <SchedaServizio key={s.id} s={s} titolare={titolare} haccpSedi={dati.haccpSedi} avvisato={avvisi.includes(s.id)} onApri={() => onApri(s)} onAvvisami={() => onAvvisami(s)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SchedaServizio({ s, titolare, haccpSedi, avvisato, onApri, onAvvisami }: { s: Servizio; titolare: boolean; haccpSedi: number; avvisato: boolean; onApri: () => void; onAvvisami: () => void }) {
  const Icona = icona(s.icona);
  const arrivo = s.tipo === 'in_arrivo';
  const haccpAttivo = s.flusso === 'haccp' && haccpSedi > 0;
  const azione = s.tipo === 'preventivo' ? 'Chiedi un preventivo' : s.flusso === 'haccp' ? (haccpAttivo && titolare ? 'Modifica le sedi' : titolare ? 'Attiva' : 'Richiedi') : titolare ? 'Ordina' : 'Richiedi';
  return (
    <li className={clsx('card flex flex-col gap-5 p-5', arrivo && 'opacity-80')}>
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('grid size-12 place-items-center rounded-full bg-sunken', arrivo ? 'text-fg-faint' : 'text-cat-servizi-mark')}>
          <Icona size={24} aria-hidden />
        </span>
        {arrivo && <Chip stato="neutral">In arrivo</Chip>}
        {haccpAttivo && <Chip stato="ok">Attivo su {quante(haccpSedi, 'sede', 'sedi')}</Chip>}
        {s.tipo === 'preventivo' && <Chip stato="neutral">Su preventivo</Chip>}
      </div>
      <div className="flex-1">
        <p className="text-title text-fg">{s.nome}</p>
        <p className="mt-1 text-small text-fg-muted">{s.descrizione}</p>
      </div>
      <div>
        {s.prezzo !== null ? (
          <p className="text-h1 font-light text-fg">
            {s.prezzo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            <span className="text-title text-fg-muted"> €{s.unita ? ` ${s.unita}` : ''}</span>
          </p>
        ) : (
          <p className="text-h3 font-light text-fg-muted">{arrivo ? 'Prezzo in definizione' : 'Prezzo dopo il sopralluogo'}</p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-caption text-fg-muted">
          <Orologio size={13} aria-hidden /> {arrivo ? 'Non ancora ordinabile' : s.tempi}
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-line pt-4">
        <span aria-hidden className="size-2 rounded-full bg-cat-servizi-mark" />
        {arrivo ? (
          avvisato ? (
            <span className="flex items-center gap-1.5 text-small text-fg-muted">
              <Campanella size={14} aria-hidden /> Ti avvisiamo
            </span>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onAvvisami}>
              <Campanella size={14} aria-hidden /> Avvisami
            </button>
          )
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={onApri} data-falco-campo={`servizio_${s.id}`}>
            {azione}
          </button>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- ordini

function Ordini({ dati, titolare, onApri, onRifiuta, onApprova, onCatalogo }: { dati: SezioneServizi; titolare: boolean; onApri: (o: OrdineServizio) => void; onRifiuta: (o: OrdineServizio) => void; onApprova: (o: OrdineServizio) => void; onCatalogo: () => void }) {
  const da = dati.ordini.filter((o) => o.stato === 'da_approvare');
  if (dati.ordini.length === 0) {
    return (
      <Vuoto titolo="Nessun ordine" azione={<button type="button" className="btn btn-primary" onClick={onCatalogo}>Apri il catalogo</button>}>
        Quando ordini o richiedi un servizio lo segui da qui, fino alla consegna.
      </Vuoto>
    );
  }
  return (
    <div className="space-y-5">
      {titolare && da.length > 0 && (
        <section className="rounded-xl bg-acid-400 p-5 text-acid-950">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Da approvare</h2>
            <span className="rounded-full bg-black px-2.5 py-0.5 text-small text-acid-400">{da.length}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {da.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-grafite-950">
                <Pastiglia categoria="servizi" icona={Borsa} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onApri(o)}>
                  <span className="block text-small font-medium hover:underline">{o.titolo}</span>
                  <span className="block text-caption text-grafite-500">
                    Richiesto da {o.richiestoDa ?? ''} il {dataIt(o.creato)} · {o.importo !== null ? euroIt(o.importo) : 'su preventivo'}
                  </span>
                </button>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onApri(o)}>Vedi</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRifiuta(o)}>Rifiuta</button>
                  <button type="button" className="btn btn-sm bg-grafite-900 text-white" onClick={() => onApprova(o)}>
                    {o.servizio === 'haccp' ? 'Approva e attiva' : 'Approva e paga'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="card divide-y divide-line">
        {dati.ordini.map((o) => {
          const st = statoOrdine(o.stato);
          return (
            <li key={o.id}>
              <button type="button" onClick={() => onApri(o)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-cat-servizi-mark">
                  <Borsa size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium text-fg">{o.titolo}</span>
                  <span className="block truncate text-caption text-fg-muted">
                    {dataIt(o.creato)}
                    {o.richiestoDa ? ` · ${o.richiestoDa}` : ''}
                    {typeof o.dati.dettagli === 'string' ? ` · ${o.dati.dettagli}` : ''}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Chip stato={st.chip}>{st.testo}</Chip>
                  <span className="text-caption text-fg-muted">
                    {o.importo !== null ? euroIt(o.importo) : ''}
                    {o.servizio === 'haccp' ? ' /mese' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DettaglioOrdine({ id, titolare, nomeTit, onChiudi, onRifiuta, onApprova, onFatto }: { id: number | null; titolare: boolean; nomeTit: string; onChiudi: () => void; onRifiuta: (o: OrdineServizio) => void; onApprova: (o: OrdineServizio) => void; onFatto: () => void }) {
  const [o, setO] = useState<OrdineServizio | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const carica = () => {
    if (id === null) return;
    dettaglioOrdine(id).then(setO).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Ordine non trovato'));
  };
  useEffect(() => {
    setO(null);
    setErr(null);
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const st = o ? statoOrdine(o.stato) : null;
  const cant = (o?.dati.cantiere ?? null) as Record<string, string> | null;
  const righe: Array<[string, ReactNode]> = o
    ? ([
        ['Dettagli', typeof o.dati.dettagli === 'string' ? o.dati.dettagli : null],
        ['Indirizzo del cantiere', cant?.indirizzo],
        ['Committente', cant?.committente],
        ['Durata', cant?.inizio ? `${dataIt(cant.inizio)} al ${dataIt(cant.fine)}` : null],
        ['Attività', cant?.attivita],
        ['PSC del committente', !o.psc && typeof o.dati.psc === 'string' ? o.dati.psc : null],
        ['Libretto del ponteggio', typeof o.dati.libretto === 'string' ? o.dati.libretto : null],
        ['Richiesta', typeof o.dati.richiesta === 'string' ? o.dati.richiesta : null],
        ['Richiesto da', o.richiestoDa],
        ['Approvato da', o.approvatoDa],
      ].filter(([, v]) => v) as Array<[string, ReactNode]>)
    : [];
  return (
    <Foglio aperto={id !== null} largo onChiudi={onChiudi} categoria="servizi" icona={Borsa} sopra="Servizi e ordini" titolo={o?.titolo ?? (err ? 'Ordine non trovato' : 'Ordine')}>
      {err && <Vuoto titolo="Ordine non trovato" azione={<button type="button" className="btn btn-primary" onClick={onChiudi}>Torna agli ordini</button>} />}
      {!o && !err && <Caricamento />}
      {o && st && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-small text-fg-muted">
            <Chip stato={st.chip}>{st.testo}</Chip>
            Ordine N. {o.numero.toUpperCase()} · {dataIt(o.creato)}
            {o.richiestoDa ? ` · richiesto da ${o.richiestoDa}` : ''}
          </div>
          {o.stato === 'rifiutato' && <Avviso tono="danger"><strong className="block">Richiesta rifiutata</strong>{o.motivo}</Avviso>}
          {o.stato === 'attesa_bonifico' && <Avviso tono="warn"><strong className="block">In attesa del bonifico</strong>Il servizio parte all&apos;accredito: da quel momento decorrono i tempi di consegna.</Avviso>}
          {o.stato === 'da_approvare' &&
            (titolare ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-accent" onClick={() => onApprova(o)}>
                  <IconaSpunta size={16} aria-hidden /> {o.servizio === 'haccp' ? 'Approva e attiva' : 'Approva e paga'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => onRifiuta(o)}>Rifiuta</button>
              </div>
            ) : (
              <div className="space-y-2">
                <Blocco>In attesa dell&apos;approvazione di {nomeTit}</Blocco>
                <button type="button" className="btn btn-secondary" onClick={async () => { try { toast(await sollecita(o.id), 'info'); } catch (e) { toast(e instanceof Error ? e.message : 'Non riuscito', 'avviso'); } }}>
                  <Campanella size={16} aria-hidden /> Sollecita
                </button>
              </div>
            ))}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0 space-y-5">
              <section className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-small text-fg-muted">Importo</p>
                    {o.importo !== null ? (
                      <p className="text-display font-light text-fg">
                        {o.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        <span className="text-h3 text-fg-muted"> €{o.servizio === 'haccp' ? ' al mese' : ''}</span>
                      </p>
                    ) : (
                      <p className="text-h1 font-light text-fg">Su preventivo</p>
                    )}
                  </div>
                  {o.tempi && (
                    <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                      <Orologio size={13} aria-hidden /> {o.tempi}
                    </p>
                  )}
                </div>
                {righe.length > 0 && (
                  <div className="mt-4">
                    {righe.map(([k, v]) => (
                      <Voce key={k} k={k} v={v} />
                    ))}
                  </div>
                )}
              </section>
              {o.psc && <RiquadroPsc o={o} onFatto={() => { carica(); onFatto(); }} />}
              {o.lavoratori.length > 0 && <LavoratoriOrdine o={o} />}
              <section className="card p-5">
                <h3 className="text-title text-fg">Documenti consegnati</h3>
                {o.consegnati.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {o.consegnati.map((d) => (
                      <li key={d.id} className="flex items-center gap-3">
                        <Documento size={18} aria-hidden className="text-cat-servizi-mark" />
                        <span className="min-w-0 flex-1 truncate text-small">{d.nome}</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => toast(`Download avviato: ${d.nome}`)}>
                          <Scarica size={14} aria-hidden /> Scarica
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-small text-fg-muted">
                    {o.stato === 'preventivo_richiesto' ? 'Prima ti mandiamo il preventivo da accettare.' : o.stato === 'rifiutato' ? 'Nessun documento: la richiesta è stata rifiutata.' : 'Appena pronti li trovi qui e nel fascicolo.'}
                  </p>
                )}
              </section>
            </div>
            <section className="card h-fit p-5">
              <h3 className="text-title text-fg">Cronologia</h3>
              <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
                {(o.cronologia.length ? o.cronologia : [{ testo: 'Ordine creato', data: o.creato, futuro: false }]).map((p, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden className={clsx('absolute -left-[27px] top-1 size-3 rounded-full ring-2', p.futuro ? 'bg-surface ring-line' : 'bg-cat-servizi-mark ring-surface')} />
                    <p className={clsx('text-small', p.futuro ? 'text-fg-muted' : 'font-medium text-fg')}>{p.testo}</p>
                    <p className="text-caption text-fg-muted">{p.futuro ? 'Prossimo passo' : dataIt(p.data)}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
    </Foglio>
  );
}

function LavoratoriOrdine({ o }: { o: OrdineServizio }) {
  const drug = o.servizio === 'drug_test';
  const corso = o.servizio.startsWith('corso_');
  const bloc = o.lavoratori.filter((l) => l.esito === 'blocco').length;
  return (
    <section className="card p-5">
      <h3 className="text-title text-fg">{drug ? 'Lavoratori da sottoporre al test' : corso ? 'Chi fa il corso' : 'Lavoratori del cantiere'}</h3>
      <ul className="mt-3 space-y-3">
        {o.lavoratori.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-small font-medium text-fg">{iniziali(l.nome)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-small font-medium text-fg">{l.nome}</span>
              <span className="block text-caption text-fg-muted">
                {drug || corso ? l.mansione : l.blocchi.length ? l.blocchi.join(', ') : l.avvisi.length ? l.avvisi.join(', ') : `${l.mansione ?? ''} · formazione e visita valide`}
              </span>
            </span>
            {!drug && !corso && l.esito && <Chip stato={l.esito === 'blocco' ? 'danger' : l.esito === 'avviso' ? 'warn' : 'ok'}>{l.esito === 'blocco' ? 'Non può entrare' : l.esito === 'avviso' ? 'Da tenere d\'occhio' : 'In regola'}</Chip>}
          </li>
        ))}
      </ul>
      {!drug && !corso && bloc > 0 && <p className="mt-3 text-small text-fg-muted">Il POS segnala i lavoratori non in regola: non possono entrare in cantiere finché non sistemano visita e formazione.</p>}
      {drug && <p className="mt-3 text-small text-fg-muted">Il referto va solo al medico competente. Qui vedi solo &quot;prelievo fatto&quot; e &quot;referto inviato al medico&quot;.</p>}
    </section>
  );
}

function RiquadroPsc({ o, onFatto }: { o: OrdineServizio; onFatto: () => void }) {
  const p = o.psc!;
  const file = useRef<HTMLInputElement>(null);
  const [occupato, setOccupato] = useState(false);
  const carica = async (f: File | null) => {
    if (!f) return;
    setOccupato(true);
    try {
      await caricaPscOrdine(o.id, f);
      toast('PSC caricato');
      onFatto();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Caricamento non riuscito', 'avviso');
    } finally {
      setOccupato(false);
    }
  };
  return (
    <section className="card space-y-4 p-5">
      <h3 className="text-title text-fg">PSC del committente</h3>
      {p.stato === 'attesa' ? (
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-acid-400 text-acid-950"><Orologio size={18} aria-hidden /></span>
          <div>
            <p className="text-[15px] font-medium text-fg">Aspettiamo il PSC</p>
            <p className="text-small text-fg-muted">Manda il link al coordinatore per la sicurezza: lo carica lui, senza registrarsi. Il POS parte quando arriva.</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-grafite-900 text-acid-400"><IconaSpunta size={18} aria-hidden /></span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-fg">{p.file}</p>
            <p className="text-small text-fg-muted">Caricato da {p.caricatoDa} il {dataIt(p.caricatoIl)}</p>
            {p.nota && <p className="mt-2 rounded-lg bg-sunken p-3 text-small text-fg">&quot;{p.nota}&quot;</p>}
            <p className="mt-2 text-small text-fg-muted">Se il PSC cambia, il coordinatore può caricare la nuova versione dallo stesso link.</p>
          </div>
        </div>
      )}
      {p.link && <RigaLink link={p.link} />}
      {p.stato === 'attesa' && (
        <div className="border-t border-line pt-3">
          <input ref={file} type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => void carica(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={occupato} onClick={() => file.current?.click()}>
            <Scarica size={14} aria-hidden className="rotate-180" /> Ce l&apos;ho io: caricalo
          </button>
        </div>
      )}
      {p.link && p.attivo && (
        <a href={p.link} target="_blank" rel="noreferrer" className="block text-small font-medium text-fg underline">
          Apri la pagina del coordinatore
        </a>
      )}
    </section>
  );
}

function RigaLink({ link }: { link: string }) {
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiato: ora mandalo al coordinatore');
    } catch {
      toast(link, 'info');
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg bg-sunken p-2 pl-3">
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{link.replace(/^https?:\/\//, '')}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void copia()}>
        <Copia size={14} aria-hidden /> Copia
      </button>
    </div>
  );
}

const iniziali = (n: string): string =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

// ---------------------------------------------------------------- rifiuta

function FoglioRifiuta({ ordine, onChiudi, onFatto }: { ordine: OrdineServizio | null; onChiudi: () => void; onFatto: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setMotivo('');
    setErr(null);
  }, [ordine]);
  const invia = async () => {
    if (!motivo.trim()) return setErr('Scrivi il motivo: aiuta chi ha fatto la richiesta.');
    try {
      await rifiutaOrdine(ordine!.id, motivo.trim());
      toast(`Richiesta rifiutata, avvisiamo ${ordine!.richiestoDa ?? ''}`.trim());
      onFatto();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Non riuscito');
    }
  };
  return (
    <Foglio
      aperto={ordine !== null}
      onChiudi={onChiudi}
      categoria="servizi"
      icona={Borsa}
      titolo="Rifiuta la richiesta"
      sopra={ordine ? `${ordine.titolo} · ${ordine.richiestoDa ?? ''}` : undefined}
      piede={
        <>
          <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>
          <button type="button" className="btn btn-danger" onClick={() => void invia()}>Rifiuta</button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {['Il cantiere è rinviato', 'Lo facciamo più avanti', 'Ne parliamo prima'].map((m) => (
          <button key={m} type="button" className="chip chip-neutral h-10 px-3 text-small" onClick={() => setMotivo(m)}>
            {m}
          </button>
        ))}
      </div>
      <Campo etichetta="Perché la rifiuti" aiuto={`${ordine?.richiestoDa ?? 'Chi l\'ha chiesta'} riceve il motivo con la notifica.`} errore={err}>
        <textarea className={AREA} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Es. il cantiere è rinviato a gennaio, ne riparliamo" />
      </Campo>
    </Foglio>
  );
}

// ---------------------------------------------------------------- fogli d'ordine

function FoglioServizio({ servizio, dati, titolare, nomeTit, aziendaId, onChiudi, onFatto }: { servizio: Servizio | null; dati: SezioneServizi | null; titolare: boolean; nomeTit: string; aziendaId: number; onChiudi: () => void; onFatto: () => void }) {
  if (!servizio || !dati) return <Foglio aperto={false} titolo="" onChiudi={onChiudi}>{null}</Foglio>;
  const props = { s: servizio, dati, titolare, nomeTit, aziendaId, onChiudi, onFatto };
  switch (servizio.flusso) {
    case 'cantiere':
      return <FoglioCantiere key={servizio.id} {...props} />;
    default:
      return <FoglioSemplice key={servizio.id} {...props} />;
  }
}

interface PropsFoglio {
  s: Servizio;
  dati: SezioneServizi;
  titolare: boolean;
  nomeTit: string;
  aziendaId: number;
  onChiudi: () => void;
  onFatto: () => void;
}

/** Dopo la compilazione: il titolare paga (l'ordine nasce a pagamento riuscito), il referente invia al titolare. */
function useConclusione({ s, titolare, nomeTit, aziendaId, onChiudi, onFatto }: PropsFoglio) {
  const [pagamento, setPagamento] = useState<{ voce: string; importo: number; invia: (m: MetodoFoglio) => Promise<EsitoPagamento> } | null>(null);
  const [fatto, setFatto] = useState<{ titolo: string; testo: string } | null>(null);
  const concludi = async (titoloOrdine: string, importo: number | null, invia: (m: MetodoFoglio | null) => ReturnType<typeof ordina>) => {
    if (titolare && importo !== null && s.flusso !== 'haccp') {
      setPagamento({
        voce: titoloOrdine,
        importo,
        invia: async (m) => {
          const r = await invia(m);
          return r.pagamento!;
        },
      });
      return;
    }
    const r = await invia(null);
    if (s.flusso === 'preventivo') setFatto({ titolo: 'Richiesta inviata', testo: `Un tecnico ISFOR ti contatta per il sopralluogo. ${s.tempi ?? ''}.` });
    else if (s.flusso === 'haccp' && titolare) setFatto({ titolo: r.messaggio === 'Sedi aggiornate' ? 'Sedi aggiornate' : 'Supplemento HACCP attivo', testo: `${quante(r.ordine.quantita, 'sede', 'sedi')} · ${euroIt(r.ordine.importo ?? 0)} al mese nel canone. La cartella HACCP è visibile nei Documenti.` });
    else if (s.flusso === 'haccp') setFatto({ titolo: `Richiesta inviata a ${nomeTit}`, testo: 'Il supplemento si attiva quando il titolare approva.' });
    else setFatto({ titolo: `Richiesta inviata a ${nomeTit}`, testo: `${r.ordine.titolo} · ${r.ordine.importo !== null ? euroIt(r.ordine.importo) : 'su preventivo'}. Ti avvisiamo appena la approva. La trovi negli ordini come "Da approvare".` });
    onFatto();
  };
  const viste = (
    <>
      <FoglioPagamento
        aperto={pagamento !== null}
        onChiudi={() => setPagamento(null)}
        aziendaId={aziendaId}
        titolo="Paga il servizio"
        voce={pagamento?.voce ?? ''}
        importo={pagamento?.importo ?? 0}
        paga={(m) => pagamento!.invia(m)}
        onPagato={() => {
          setPagamento(null);
          onChiudi();
          onFatto();
        }}
      />
      <Foglio aperto={fatto !== null} onChiudi={() => { setFatto(null); onChiudi(); }} titolo={fatto?.titolo ?? ''} categoria="servizi" icona={Borsa}
        piede={<button type="button" className="btn btn-primary" onClick={() => { setFatto(null); onChiudi(); }}>Fatto</button>}>
        <p className="text-body text-fg-muted">{fatto?.testo}</p>
      </Foglio>
    </>
  );
  return { concludi, viste, aperto: pagamento === null && fatto === null };
}

function ScegliLavoratori({ tutti, scelti, onCambia, nota }: { tutti: LavoratoreOrdine[]; scelti: number[]; onCambia: (ids: number[]) => void; nota?: (l: LavoratoreOrdine) => ReactNode }) {
  return (
    <ul className="max-h-[20rem] divide-y divide-line overflow-y-auto rounded-lg border border-line">
      {tutti.map((l) => {
        const on = scelti.includes(l.id);
        return (
          <li key={l.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
              <input type="checkbox" className="size-5 accent-black" checked={on} onChange={() => onCambia(on ? scelti.filter((x) => x !== l.id) : [...scelti, l.id])} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-fg">{l.nome}</span>
                <span className="block text-caption text-fg-muted">{l.mansione}</span>
              </span>
              {nota?.(l)}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function FoglioSemplice(props: PropsFoglio) {
  const { s, dati, titolare, nomeTit, aziendaId, onChiudi } = props;
  const [lav, setLav] = useState<LavoratoreOrdine[]>([]);
  const [scelti, setScelti] = useState<number[]>([]);
  const [sedi, setSedi] = useState(Math.max(1, dati.haccpSedi || dati.sediAlimentari || 1));
  const [pos, setPos] = useState(dati.posEsistenti[0] ?? '');
  const [cosa, setCosa] = useState('');
  const [dove, setDove] = useState(dati.sede ?? '');
  const [contatto, setContatto] = useState<'telefono' | 'email' | 'messaggi'>('messaggi');
  const [err, setErr] = useState<Record<string, string>>({});
  const [occupato, setOccupato] = useState(false);
  const fine = useConclusione(props);
  useEffect(() => {
    if (s.flusso === 'drug' || s.flusso === 'corso') lavoratoriPer(aziendaId, s.id).then(setLav).catch(() => setLav([]));
  }, [aziendaId, s]);
  const prezzo = s.prezzo ?? 0;
  const n = s.flusso === 'haccp' ? sedi : scelti.length;
  const nomiScelti = lav.filter((l) => scelti.includes(l.id)).map((l) => l.nome);

  const invia = async () => {
    const e: Record<string, string> = {};
    if ((s.flusso === 'drug' || s.flusso === 'corso') && scelti.length === 0) e.lavoratori = 'Scegli almeno un lavoratore.';
    if (s.flusso === 'haccp' && (sedi < 1 || sedi > 20)) e.sedi = 'Indica un numero di sedi da 1 a 20.';
    if (s.flusso === 'revisione' && !pos.trim()) e.pos_da_rivedere = 'Indica quale POS va rivisto.';
    if (s.flusso === 'revisione' && !cosa.trim()) e.cosa_cambia = 'Scrivi cosa cambia rispetto al POS attuale.';
    if (s.flusso === 'preventivo' && cosa.trim().length < 10) e.cosa_serve = 'Descrivi la richiesta in qualche parola in più.';
    setErr(e);
    if (Object.keys(e).length) return;
    const datiOrdine: Record<string, unknown> =
      s.flusso === 'haccp' ? { sedi } : s.flusso === 'revisione' ? { pos_da_rivedere: pos, cosa_cambia: cosa } : s.flusso === 'preventivo' ? { cosa_serve: cosa, dove, contatto } : { lavoratori: scelti };
    const titoloOrd = s.flusso === 'drug' ? `Drug test · ${quante(n, 'lavoratore', 'lavoratori')}` : s.flusso === 'corso' ? `${s.nome} · ${quante(n, 'persona', 'persone')}` : s.flusso === 'revisione' ? `Revisione ${pos}` : s.nome;
    setOccupato(true);
    try {
      await fine.concludi(titoloOrd, s.flusso === 'preventivo' ? null : s.flusso === 'revisione' ? prezzo : prezzo * n, (m) => ordina(aziendaId, s.id, datiOrdine, m));
    } catch (x) {
      if (x instanceof ErroreCampi) setErr(x.campi);
      else setErr({ generale: x instanceof Error ? x.message : 'Non riuscito' });
    } finally {
      setOccupato(false);
    }
  };

  const titolo = s.flusso === 'preventivo' ? 'Chiedi un preventivo' : s.flusso === 'haccp' && dati.haccpSedi > 0 ? 'Modifica il supplemento HACCP' : s.nome;
  const sopra = s.flusso === 'preventivo' ? s.nome : s.flusso === 'haccp' ? '29,90 € al mese per sede alimentare' : s.flusso === 'corso' ? `${euroIt(prezzo)} a persona · ${s.tempi}` : s.flusso === 'drug' ? `${euroIt(prezzo)} a test · ${s.tempi}` : `${euroIt(prezzo)} · ${s.tempi}`;
  const bottone =
    s.flusso === 'preventivo' ? 'Invia la richiesta' : !titolare ? 'Invia al titolare per l\'approvazione' : s.flusso === 'haccp' ? (dati.haccpSedi > 0 ? 'Salva le sedi' : 'Attiva il supplemento') : s.flusso === 'revisione' ? `Vai al pagamento · ${euroIt(prezzo)}` : 'Vai al pagamento';

  return (
    <>
      <Foglio
        aperto={fine.aperto}
        onChiudi={onChiudi}
        categoria="servizi"
        icona={icona(s.icona)}
        titolo={titolo}
        sopra={sopra}
        piede={
          <>
            <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>
            <button type="button" className={s.flusso === 'preventivo' ? 'btn btn-primary' : 'btn btn-accent'} disabled={occupato} onClick={() => void invia()}>
              {bottone}
            </button>
          </>
        }
      >
        {err.generale && <Avviso tono="danger">{err.generale}</Avviso>}
        {(s.flusso === 'drug' || s.flusso === 'corso') && (
          <>
            <div className="flex items-end justify-between rounded-lg bg-sunken p-4">
              <div>
                <p className="text-small text-fg-muted">Totale</p>
                <p className="text-h1 font-light text-fg">{euroIt(prezzo * n)}</p>
              </div>
              <div className="text-right">
                <p className="text-small text-fg-muted">{s.flusso === 'drug' ? 'Numero di test' : 'Partecipanti'}</p>
                <p className="text-h3 text-fg">{n}</p>
              </div>
            </div>
            <Campo etichetta={s.flusso === 'drug' ? 'Lavoratori da sottoporre al test' : 'Chi fa il corso'} aiuto={s.flusso === 'drug' ? 'Mostriamo le mansioni a rischio alto, quelle per cui il test è previsto.' : undefined} errore={err.lavoratori}>
              {lav.length === 0 && s.flusso === 'drug' ? (
                <p className="text-small text-fg-muted">Nessuna mansione a rischio alto.</p>
              ) : (
                <ScegliLavoratori tutti={lav} scelti={scelti} onCambia={setScelti} nota={(l) => (l.gliServe ? <span className="text-caption font-medium text-fg">Gli serve</span> : null)} />
              )}
            </Campo>
            {s.flusso === 'drug' ? (
              <p className="text-small text-fg-muted">Il referto va solo al medico competente. Tu vedi solo &quot;prelievo fatto&quot; e &quot;referto inviato al medico&quot;.</p>
            ) : (
              <Avviso><strong className="block">Fuori dal canone</strong>I corsi per le attrezzature (abilitazioni) si pagano a parte. Tutti gli altri corsi sono inclusi nel canone.</Avviso>
            )}
          </>
        )}
        {s.flusso === 'haccp' && (
          <>
            <p className="text-body text-fg-muted">Per mense, bar, cucine e produzioni alimentari. Comprende manuale di autocontrollo, formazione HACCP e analisi di laboratorio. Il laboratorio vede la sede solo durante l&apos;incarico e per 30 giorni dopo.</p>
            <Campo etichetta="Quante sedi alimentari hai" errore={err.sedi}>
              <div className="flex items-center justify-between rounded-[1.5rem] bg-sunken p-2">
                <button type="button" aria-label="Una sede in meno" className="grid size-12 place-items-center rounded-full bg-surface text-h3" onClick={() => setSedi((x) => Math.max(1, x - 1))}>−</button>
                <span className="text-h1 font-light text-fg">{sedi}</span>
                <button type="button" aria-label="Una sede in più" className="grid size-12 place-items-center rounded-full bg-surface text-h3" onClick={() => setSedi((x) => Math.min(20, x + 1))}>+</button>
              </div>
            </Campo>
            <div className="flex items-end justify-between rounded-lg bg-sunken p-4">
              <div>
                <p className="text-small text-fg-muted">Si aggiunge al canone</p>
                <p className="text-h1 font-light text-fg">{euroIt(prezzo * sedi)} <span className="text-title text-fg-muted">al mese</span></p>
              </div>
              <p className="text-small text-fg-muted">Dal mese successivo</p>
            </div>
            <Avviso><strong className="block">Si attiva la cartella HACCP</strong>Nei Documenti compare la cartella HACCP, dove trovi manuale, registri e analisi.</Avviso>
          </>
        )}
        {s.flusso === 'revisione' && (
          <>
            <Campo etichetta="POS da rivedere" errore={err.pos_da_rivedere}>
              {dati.posEsistenti.length > 0 ? (
                <select className={CAMPO} value={pos} onChange={(e) => setPos(e.target.value)}>
                  {dati.posEsistenti.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input className={CAMPO} value={pos} onChange={(e) => setPos(e.target.value)} placeholder="Es. POS Cantiere via Roma" />
              )}
            </Campo>
            <Campo etichetta="Cosa cambia" errore={err.cosa_cambia}>
              <textarea className={AREA} value={cosa} onChange={(e) => setCosa(e.target.value)} placeholder="Es. proroga al 31/01, entra Ion Popescu, nuova lavorazione in quota" />
            </Campo>
            <Avviso><strong className="block">Se cambiano i lavoratori li controlliamo</strong>Prima di consegnare verifichiamo formazione e visita dei nuovi.</Avviso>
          </>
        )}
        {s.flusso === 'preventivo' && (
          <>
            <Campo etichetta="Cosa ti serve" aiuto="Reparti, macchine, numero di postazioni: più dettagli ci dai, più il preventivo è preciso." errore={err.cosa_serve}>
              <textarea className={AREA} value={cosa} onChange={(e) => setCosa(e.target.value)} placeholder={s.gruppo === 'Ambiente' ? 'Es. registro rifiuti per trucioli metallici e oli esausti, due formulari al mese' : 'Es. misura del rumore nel reparto produzione: 3 torni, 1 saldatrice, turno unico'} />
            </Campo>
            <Campo etichetta="Dove">
              <input className={CAMPO} value={dove} onChange={(e) => setDove(e.target.value)} />
            </Campo>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-fg">Come preferisci essere ricontattato</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['telefono', 'email', 'messaggi'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={contatto === k} onClick={() => setContatto(k)} className={clsx('slot min-h-12 px-3 text-small', contatto === k && 'ring-2 ring-black')}>
                    {k === 'telefono' ? 'Telefono' : k === 'email' ? 'Email' : 'Messaggi del portale'}
                  </button>
                ))}
              </div>
            </fieldset>
            <Avviso><strong className="block">Cosa succede dopo</strong>{s.tempi}. Il preventivo arriva nei tuoi ordini: {titolare ? 'lo accetti e lo paghi da lì.' : 'lo accetta e lo paga il titolare.'}</Avviso>
          </>
        )}
        {!titolare && s.flusso !== 'preventivo' && <Avviso><strong className="block">La richiesta va al titolare</strong>La approva e la paga. Finché non decide resta &quot;Da approvare&quot;.</Avviso>}
        {s.flusso === 'corso' && nomiScelti.length > 0 && <p className="sr-only">{nomiScelti.join(', ')}</p>}
      </Foglio>
      {fine.viste}
    </>
  );
}

function FoglioCantiere(props: PropsFoglio) {
  const { s, dati, titolare, nomeTit, aziendaId, onChiudi } = props;
  const [passo, setPasso] = useState(0);
  const [d, setD] = useState<DatiCantiere>(cantiereVuoto);
  const [lav, setLav] = useState<LavoratoreOrdine[]>([]);
  const [err, setErr] = useState<Record<string, string>>({});
  const [link, setLink] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const fine = useConclusione(props);
  const pimus = conPimus(s.id);
  const cambia = <K extends keyof DatiCantiere>(k: K, v: DatiCantiere[K]) => setD((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (passo === 1) lavoratoriPer(aziendaId, s.id, d.fine || null).then(setLav).catch(() => setLav([]));
    if (passo === 2 && d.pscRichiestaId === null) {
      creaLinkPscOrdine(aziendaId)
        .then((r) => {
          setLink(r.link);
          setD((x) => ({ ...x, pscRichiestaId: r.id }));
        })
        .catch(() => setLink(null));
    }
  }, [passo, aziendaId, s.id, d.fine, d.pscRichiestaId]);
  const bloc = bloccati(lav, d.lavoratori);
  const avv = conAvvisi(lav, d.lavoratori);
  const prezzo = s.prezzo ?? 0;

  const avanti = async () => {
    const e = erroriPasso(passo, d, pimus, lav);
    setErr(e);
    if (Object.keys(e).length) return;
    if (passo < 3) return setPasso(passo + 1);
    setOccupato(true);
    try {
      const datiOrdine = {
        indirizzo: d.indirizzo, committente: d.committente, inizio: d.inizio, fine: d.fine, attivita: d.attivita, lavoratori: d.lavoratori, procedi: d.procedi,
        psc_modo: d.pscModo, psc_richiesta_id: d.pscModo === 'link' ? d.pscRichiestaId : null, ponteggio: pimus ? d.ponteggio : null,
      };
      await fine.concludi(`${prefissoCantiere(s.id)} · Cantiere ${d.indirizzo}`, prezzo, (m) => ordina(aziendaId, s.id, datiOrdine, m, { psc: d.pscModo === 'io' ? d.pscFile : null, libretto: pimus ? d.libretto : null }));
    } catch (x) {
      if (x instanceof ErroreCampi) {
        setErr(x.campi);
        const k = Object.keys(x.campi)[0];
        setPasso(['indirizzo', 'committente', 'inizio', 'fine', 'attivita'].includes(k) ? 0 : k === 'lavoratori' ? 1 : 2);
      } else setErr({ generale: x instanceof Error ? x.message : 'Non riuscito' });
    } finally {
      setOccupato(false);
    }
  };

  return (
    <>
      <Foglio
        aperto={fine.aperto}
        largo
        onChiudi={onChiudi}
        categoria="servizi"
        icona={Casco}
        titolo={`${titolare ? 'Ordina' : 'Richiedi'} ${s.nome}`}
        sopra={`Passo ${passo + 1} di 4 · ${DOMANDE_CANTIERE[passo]}`}
        piede={
          <>
            <button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button>
            {passo > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => { setErr({}); setPasso(passo - 1); }}>
                <Indietro size={16} aria-hidden /> Indietro
              </button>
            )}
            <button type="button" className={passo === 3 ? 'btn btn-accent' : 'btn btn-primary'} disabled={occupato} onClick={() => void avanti()}>
              {passo < 3 ? (
                <>Continua <Avanti size={16} aria-hidden /></>
              ) : titolare ? (
                `Vai al pagamento · ${euroIt(prezzo)}`
              ) : (
                'Invia al titolare per l\'approvazione'
              )}
            </button>
          </>
        }
      >
        <ol className="grid grid-cols-4 gap-2" aria-label="Passi">
          {PASSI_CANTIERE.map((p, i) => (
            <li key={p}>
              <span className={clsx('block h-1.5 rounded-full', i <= passo ? 'bg-grafite-900' : 'bg-sunken')} />
              <span className={clsx('mt-1 block text-caption', i === passo ? 'text-fg' : 'text-fg-muted')}>{i + 1}. {p}</span>
            </li>
          ))}
        </ol>
        {err.generale && <Avviso tono="danger">{err.generale}</Avviso>}

        {passo === 0 && (
          <div className="space-y-4">
            <Campo etichetta="Indirizzo del cantiere" errore={err.indirizzo}>
              <input className={CAMPO} value={d.indirizzo} onChange={(e) => cambia('indirizzo', e.target.value)} placeholder="Es. Via Roma 12, Lucca" />
            </Campo>
            <Campo etichetta="Committente" errore={err.committente}>
              <input className={CAMPO} value={d.committente} onChange={(e) => cambia('committente', e.target.value)} placeholder="Ragione sociale del committente" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etichetta="Inizio lavori" errore={err.inizio}>
                <input type="date" className={CAMPO} value={d.inizio} onChange={(e) => cambia('inizio', e.target.value)} />
              </Campo>
              <Campo etichetta="Fine lavori prevista" errore={err.fine}>
                <input type="date" className={CAMPO} value={d.fine} onChange={(e) => cambia('fine', e.target.value)} />
              </Campo>
            </div>
            <Campo etichetta="Attività che svolgete in cantiere" aiuto={`Ci serve per scegliere i rischi da inserire ${pimus ? 'nel POS e nel PiMUS' : 'nel POS'}.`} errore={err.attivita}>
              <textarea className={AREA} value={d.attivita} onChange={(e) => cambia('attivita', e.target.value)} placeholder="Es. montaggio di strutture metalliche, saldature in opera, uso del cestello" />
            </Campo>
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-4">
            <p className="text-small text-fg-muted">Scegli chi lavora nel cantiere. Controlliamo da soli formazione e visita di ognuno per tutta la durata dei lavori.</p>
            <Campo etichetta="Lavoratori del cantiere" errore={err.lavoratori}>
              <ScegliLavoratori
                tutti={lav}
                scelti={d.lavoratori}
                onCambia={(ids) => cambia('lavoratori', ids)}
                nota={(l) => <Chip stato={l.esito === 'blocco' ? 'danger' : l.esito === 'avviso' ? 'warn' : 'ok'}>{l.esito === 'blocco' ? 'Non in regola' : l.esito === 'avviso' ? 'Da verificare' : 'In regola'}</Chip>}
              />
            </Campo>
            {d.lavoratori.length === 0 ? (
              <p className="text-small text-fg-muted">Nessun lavoratore scelto.</p>
            ) : bloc.length > 0 ? (
              <div className="space-y-3 rounded-lg bg-stato-danger p-4 text-stato-danger-ink">
                <p className="font-medium">{titoloBloccati(bloc.length)}</p>
                {bloc.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded-lg bg-white p-2 pl-3 text-fg">
                    <span className="min-w-0 flex-1 text-small"><strong>{l.nome}</strong>: {l.blocchi.join(', ')}. Non può entrare in cantiere</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => cambia('lavoratori', d.lavoratori.filter((x) => x !== l.id))}>Togli</button>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <Spunta attiva={d.procedi} onCambia={(v) => cambia('procedi', v)} etichetta="Procedo lo stesso: il POS segnala questi lavoratori come non in regola" />
                  <span className="text-small" aria-hidden>Procedo lo stesso: il POS segnala questi lavoratori come non in regola</span>
                </div>
              </div>
            ) : (
              <Avviso tono="ok"><strong className="block">{quante(d.lavoratori.length, 'lavoratore in regola', 'lavoratori in regola')}</strong>Formazione e visita valide per entrare in cantiere.</Avviso>
            )}
            {avv.length > 0 && (
              <Avviso tono="warn"><strong className="block">Da tenere d&apos;occhio</strong>{avv.map((l) => `${l.nome}: ${l.avvisi.join(', ')}`).join('. ')}.</Avviso>
            )}
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-title text-fg">PSC del committente</h3>
              <p className="text-small text-fg-muted">Il Piano di sicurezza e coordinamento lo prepara il coordinatore per la sicurezza (CSE) del committente.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['link', 'io'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={d.pscModo === k} onClick={() => cambia('pscModo', k)} className={clsx('slot flex-col items-start p-4 text-left', d.pscModo === k && 'ring-2 ring-black')}>
                  <span className="flex flex-col items-start">
                    <span className="text-[15px] font-medium text-fg">{k === 'link' ? 'Lo carica il coordinatore' : 'Lo carico io'}</span>
                    <span className="text-caption text-fg-muted">{k === 'link' ? 'Gli mandi tu un link' : 'Ce l\'ho già'}</span>
                  </span>
                </button>
              ))}
            </div>
            {d.pscModo === 'link' ? (
              <div className="space-y-2">
                <p className="text-small text-fg-muted">Copia il link e mandalo al coordinatore come preferisci: WhatsApp, email, messaggio. Lo apre senza registrarsi, carica il PSC e lo ritrovi in questo ordine.</p>
                {link ? <RigaLink link={link} /> : <Caricamento testo="Preparo il link" />}
                <p className="text-caption text-fg-muted">Il link funziona appena confermi l&apos;ordine. Lo ritrovi anche nel dettaglio dell&apos;ordine, dove puoi sempre caricare il PSC tu. I tempi del POS partono quando arriva il PSC.</p>
              </div>
            ) : (
              <CampoFile etichetta="Il PSC" file={d.pscFile} onFile={(f) => cambia('pscFile', f)} errore={err.psc} />
            )}
            {err.psc && d.pscModo === 'link' && <p className="text-small text-[#d63d3e]">{err.psc}</p>}
            {pimus && (
              <div className="space-y-4 border-t border-line pt-4">
                <h3 className="text-title text-fg">Ponteggio</h3>
                <Campo etichetta="Marca e modello del ponteggio" errore={err.ponteggio}>
                  <input className={CAMPO} value={d.ponteggio} onChange={(e) => cambia('ponteggio', e.target.value)} placeholder="Es. Marcegaglia MP 105" />
                </Campo>
                <CampoFile etichetta="Libretto del ponteggio (autorizzazione ministeriale)" file={d.libretto} onFile={(f) => cambia('libretto', f)} errore={err.libretto} />
                <p className="text-small text-fg-muted">Il PiMUS standard copre gli schemi tipo del libretto. Per montaggi fuori schema serve il calcolo di un ingegnere: te lo diciamo prima di partire.</p>
              </div>
            )}
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-4">
            <section className="card p-5">
              <Voce k="Servizio" v={s.nome} />
              <Voce k="Cantiere" v={d.indirizzo} />
              <Voce k="Committente" v={d.committente} />
              <Voce k="Durata" v={`${dataIt(d.inizio)} al ${dataIt(d.fine)}`} />
              <Voce k="Lavoratori" v={<>{d.lavoratori.length}{bloc.length > 0 && <span className="text-[#d63d3e]"> · {bloc.length} non in regola</span>}</>} />
              <Voce k="PSC" v={d.pscModo === 'link' ? 'Lo carica il coordinatore dal link' : d.pscFile?.name} />
              {pimus && <Voce k="Ponteggio" v={`${d.ponteggio} · libretto caricato`} />}
              <Voce k="Consegna" v={`${s.tempi} dal ${d.pscModo === 'link' ? 'PSC' : 'pagamento'}`} />
            </section>
            {bloc.length > 0 && (
              <Avviso tono="warn"><strong className="block">Il POS segnalerà i lavoratori non in regola</strong>{bloc.map((l) => l.nome).join(', ')} non potranno entrare in cantiere finché non sistemano visita e formazione.</Avviso>
            )}
            <div className="flex items-end justify-between rounded-lg bg-sunken p-4">
              <div>
                <p className="text-small text-fg-muted">Totale</p>
                <p className="text-h1 font-light text-fg">{euroIt(prezzo)}</p>
              </div>
              {titolare && dati.omaggi && <p className="text-small text-fg-muted">Usiamo prima i tuoi {euroIt(dati.omaggi.importo)} di crediti omaggio</p>}
            </div>
            <p className="text-small text-fg-muted">Con il bonifico il servizio parte all&apos;accredito, e da lì decorrono le {s.tempi}.</p>
            {!titolare && <Avviso><strong className="block">La richiesta va a {nomeTit}</strong>Il titolare la approva e la paga. Finché non decide resta &quot;Da approvare&quot;.</Avviso>}
          </div>
        )}
      </Foglio>
      {fine.viste}
    </>
  );
}

function CampoFile({ etichetta, file, onFile, errore }: { etichetta: string; file: File | null; onFile: (f: File | null) => void; errore?: string }) {
  const rif = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-fg">{etichetta}</span>
      <input ref={rif} type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => rif.current?.click()} className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-line p-4 text-left hover:border-grafite-900">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken">{file ? <IconaSpunta size={18} aria-hidden /> : <Scarica size={18} aria-hidden className="rotate-180" />}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-fg">{file ? file.name : 'Scegli il file o trascinalo qui'}</span>
          <span className="block text-caption text-fg-muted">PDF o immagine · fino a 20 MB</span>
        </span>
      </button>
      {errore && <p className="mt-1 text-[12.5px] text-[#d63d3e]">{errore}</p>}
    </div>
  );
}
