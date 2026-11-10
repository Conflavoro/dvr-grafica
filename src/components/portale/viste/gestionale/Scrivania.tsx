'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Documento, Indietro, Piu, Rotore } from '@/components/icone';
import { Caricamento, Chip, Errore, Foglio, Scheda, Testata } from '@/components/portale/kit';
import { usePortale } from '@/components/portale/PortaleShell';
import { clsx } from '@/lib/clsx';
import { GRUPPI, ordinaDocumenti, puoRedigere, STATO_DOC, testoStato, type VoceDocumento } from '@/lib/portale/documenti';
import { materialeAzienda, nuovoDvr, scrivaniaAzienda, type DatiScrivania, type Mancante, type Materiale } from '@/lib/portale/documenti-api';
import { apriSceltaCliente } from '../../SceltaCliente';
import { DocumentoScrivania } from './documenti/DocumentoScrivania';
import { ScrivaniaDvr } from '@/components/cowork/ScrivaniaDvr';
import { EVENTO_APRI } from '@/components/cowork/LinkScrivania';
import { Notizia, useAvviso } from './documenti/parti';
import { CosaMancaDvr } from '../../CosaMancaDvr';

/**
 * Scrivania del DVR (gestionale, ADR-009 V3, SPEC_GESTIONALE §9): i documenti dello
 * studio per il cliente scelto in cima al menu, con stato e perché del "da
 * aggiornare". Sul computer elenco a sinistra e documento al centro (il Falco sta
 * a destra nel guscio); sul telefono si passa da un livello all'altro.
 */

function leggiUrl(): { az: number | null; doc: string | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    const az = Number(q.get('az'));
    return { az: Number.isFinite(az) && az > 0 ? az : null, doc: q.get('doc') };
  } catch {
    return { az: null, doc: null };
  }
}

function scriviUrl(doc: string | null) {
  try {
    const q = new URLSearchParams();
    if (doc) q.set('doc', doc);
    const s = q.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${s ? `?${s}` : ''}`);
  } catch {
    /* solo comodita' */
  }
}

/** Documento aperto nella Scrivania per paragrafi (?cowork=<id DVR>&sezione=<chiave>). */
function leggiCowork(): { id: number; sezione: string | null } | null {
  try {
    const q = new URLSearchParams(window.location.search);
    const id = Number(q.get('cowork'));
    return Number.isInteger(id) && id > 0 ? { id, sezione: q.get('sezione') } : null;
  } catch {
    return null;
  }
}

function scriviCowork(id: number, sezione: string | null) {
  try {
    const q = new URLSearchParams({ cowork: String(id) });
    if (sezione) q.set('sezione', sezione);
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  } catch {
    /* solo comodita' */
  }
}

export default function Scrivania() {
  const { aziendaScelta } = usePortale();
  const [cowork, setCowork] = useState<{ id: number; sezione: string | null } | null | undefined>(undefined);
  useEffect(() => {
    setCowork(leggiCowork());
    const su = (e: Event) => {
      const id = Number((e as CustomEvent<{ id?: number }>).detail?.id);
      if (Number.isInteger(id) && id > 0) setCowork({ id, sezione: null });
    };
    window.addEventListener(EVENTO_APRI, su);
    return () => window.removeEventListener(EVENTO_APRI, su);
  }, []);
  if (cowork === undefined) return null;
  if (cowork) {
    return (
      <ScrivaniaDvr
        key={cowork.id}
        dvrId={cowork.id}
        sezioneIniziale={cowork.sezione}
        azienda={aziendaScelta?.ragione_sociale ?? ''}
        aziendaId={aziendaScelta?.id ?? null}
        onSezione={(k) => scriviCowork(cowork.id, k)}
        onIndietro={() => {
          scriviUrl(`dvr:${cowork.id}`);
          setCowork(null);
        }}
      />
    );
  }
  return <ScrivaniaDocumenti />;
}

function ScrivaniaDocumenti() {
  const { user, chiedi, apri, versione, aziendaScelta, scegliAzienda } = usePortale();
  // La schermata e' per azienda: il guscio la mostra solo con un cliente scelto.
  const azId = aziendaScelta?.id ?? null;
  const [docChiave, setDocChiave] = useState<string | null>(null);
  const [dati, setDati] = useState<DatiScrivania | null>(null);
  const [errDoc, setErrDoc] = useState<string | null>(null);
  const [giro, setGiro] = useState(0);
  const [nuovo, setNuovo] = useState(false);
  const [avviso, setAvviso] = useAvviso();

  useEffect(() => {
    const u = leggiUrl();
    // Vecchi link con ?az=: diventano la scelta del cliente.
    if (u.az && u.az !== azId) scegliAzienda(u.az);
    setDocChiave(u.doc);
    scriviUrl(u.doc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!azId) {
      setDati(null);
      return;
    }
    let vivo = true;
    setErrDoc(null);
    scrivaniaAzienda(azId)
      .then((d) => vivo && setDati(d))
      .catch((e) => vivo && setErrDoc(e instanceof Error ? e.message : 'Documenti non disponibili.'));
    return () => {
      vivo = false;
    };
  }, [azId, versione, giro]);

  const documenti = useMemo(() => ordinaDocumenti(dati?.documenti ?? []), [dati]);
  const doc = documenti.find((d) => d.chiave === docChiave) ?? null;
  const nomeAzienda = dati?.nome || aziendaScelta?.ragione_sociale || '';

  // Il Falco sa sempre cosa c'e' aperto.
  useEffect(() => {
    if (doc && azId) {
      const tipo = doc.gruppo === 'documento' ? 'documento' : doc.gruppo;
      apri({ tipo, id: doc.id }, azId);
    } else {
      apri(null, azId);
    }
  }, [doc?.chiave, azId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scegliDoc = (k: string | null) => {
    setDocChiave(k);
    scriviUrl(k);
    if (k) window.scrollTo?.({ top: 0 });
  };
  const ricarica = useCallback(() => setGiro((g) => g + 1), []);

  const gruppi = (['dvr', 'valutazione', 'documento', 'pos'] as const).map((g) => ({ g, voci: documenti.filter((d) => d.gruppo === g) })).filter((x) => x.voci.length > 0);

  const colonnaDocumenti = (
    <Scheda
      titolo={nomeAzienda || 'Documenti'}
      sotto={dati?.ateco ? `ATECO ${dati.ateco}` : undefined}
      azioni={
        <button type="button" onClick={apriSceltaCliente} className="btn-ghost min-h-[44px] px-3.5 text-[13px]">
          Cambia cliente
        </button>
      }
    >
      {errDoc ? (
        <Errore testo={errDoc} onRiprova={ricarica} />
      ) : !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          {gruppi.length === 0 && <p className="text-[14px] text-ink-muted">Nessun documento ancora. Parti dal DVR.</p>}
          {gruppi.map(({ g, voci }) => (
            <section key={g}>
              <h3 className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">{GRUPPI[g]}</h3>
              <ul className="mt-1">
                {voci.map((d) => (
                  <li key={d.chiave}>
                    <button
                      type="button"
                      onClick={() => scegliDoc(d.chiave)}
                      aria-current={d.chiave === docChiave ? 'true' : undefined}
                      className={clsx('flex min-h-[56px] w-full items-center gap-3 rounded-[0.875rem] px-2.5 py-2 text-left', d.chiave === docChiave ? 'bg-perla-velo' : 'hover:bg-perla-velo/70')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium leading-snug text-ink">{d.etichetta}</span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">{d.titolo && d.gruppo !== 'dvr' ? d.titolo : d.generazione === 'pending' || d.generazione === 'running' ? 'In generazione' : d.revisione > 0 ? `Versione ${d.versione ?? 1} · revisione ${d.revisione}` : 'Mai generato'}</span>
                      </span>
                      <Chip stato={STATO_DOC[d.stato].chip}>{testoStato(d)}</Chip>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {puoRedigere(user.role) && (
            <button type="button" className="btn-ghost w-full" onClick={() => setNuovo(true)}>
              <Piu size={16} aria-hidden /> {documenti.some((d) => d.gruppo === 'dvr') ? 'Nuova versione del DVR' : 'Nuovo DVR'}
            </button>
          )}
        </div>
      )}
    </Scheda>
  );

  // ---------------------------------------------------------------- centro

  const riepilogo = dati && (
    <Scheda titolo={nomeAzienda} sotto="Scegli un documento a sinistra per aprirlo.">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
        {(['da_aggiornare', 'revisione', 'bozza', 'emesso'] as const).map((s) => (
          <div key={s} className="rounded-[1rem] bg-perla-velo px-3.5 py-3">
            <p className="text-[12.5px] text-ink-muted">{s === 'emesso' ? 'Emessi o approvati' : STATO_DOC[s].testo}</p>
            <p className="cifre mt-1 text-[28px] font-light leading-none text-ink">{documenti.filter((d) => d.stato === s).length}</p>
          </div>
        ))}
      </div>
      {dati.datiMancanti.length > 0 && azId && (
        <div className="mt-5">
          <CosaMancaDvr voci={dati.datiMancanti} aziendaId={azId} nome={nomeAzienda} puoScrivere={puoRedigere(user.role)} chiedi={chiedi} />
        </div>
      )}
      {dati.mancaDocumenti.some((m) => m.stato === 'bozza') && (
        <div className="mt-5">
          <h3 className="text-[15px] font-medium text-ink">Cosa manca per emettere le bozze</h3>
          <ul className="mt-2 space-y-2">
            {dati.mancaDocumenti
              .filter((m) => m.stato === 'bozza')
              .map((m) => (
                <li key={`${m.gruppo}:${m.id}`} className="rounded-[1rem] px-4 py-3 shadow-[inset_0_0_0_1px_#e2e2e5]">
                  <span className="block text-[14.5px] font-medium text-ink">{m.nome}</span>
                  <ElencoManca voci={m.voci} altre={m.altre} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-4 text-[13px]" onClick={() => scegliDoc(`${m.gruppo}:${m.id}`)}>
                      Apri
                    </button>
                    {puoRedigere(user.role) && (
                      <button type="button" className="btn-acido min-h-[44px] lg:min-h-[40px] px-4 text-[13px]" onClick={() => chiedi(`Completa ${m.nome.toLowerCase()} di ${nomeAzienda}: prendi dal sistema e dai documenti caricati tutto quello che c'è, e chiedimi solo quello che non trovi.`)}>
                        Completa con il Falco
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
      {dati.mancanti.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[15px] font-medium text-ink">Di solito servono anche</h3>
          <ul className="mt-2 space-y-2">
            {dati.mancanti.map((m) => (
              <li key={m.tipo} className="flex flex-wrap items-center gap-3 rounded-[1rem] px-4 py-3 shadow-[inset_0_0_0_1px_#e2e2e5]">
                <span className="min-w-0 flex-1 basis-[14rem]">
                  <span className="block text-[14.5px] font-medium text-ink">{m.etichetta}</span>
                  <span className="block text-[12.5px] text-ink-muted">{m.perche}</span>
                  {(() => {
                    const serve = dati.mancaDocumenti.find((x) => x.stato === 'da_creare' && x.tipo === m.tipo);
                    return serve ? <ElencoManca voci={serve.voci} altre={serve.altre} titolo="Per prepararlo servono ancora" /> : null;
                  })()}
                </span>
                {puoRedigere(user.role) &&
                  (m.tipo === 'dvr' ? (
                    <button type="button" className="btn-acido min-h-[44px] lg:min-h-[40px] px-4 text-[13px]" data-falco="genera_dvr" data-falco-tocca="" onClick={() => setNuovo(true)}>
                      Genera il DVR
                    </button>
                  ) : (
                    <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-4 text-[13px]" onClick={() => chiedi(`Prepara il ${m.etichetta.toLowerCase()} di ${nomeAzienda}: dimmi quali dati ti servono e quali hai già trovato nel sistema.`)}>
                      Prepara con il Falco
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Scheda>
  );

  const centro = doc ? (
    <div className="space-y-3">
      <button type="button" onClick={() => scegliDoc(null)} className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px] xl:hidden">
        <Indietro size={15} aria-hidden /> Documenti di {nomeAzienda}
      </button>
      <DocumentoScrivania key={doc.chiave} voce={doc} azienda={nomeAzienda} aziendaId={azId!} onCambiato={ricarica} onAvviso={setAvviso} />
    </div>
  ) : (
    riepilogo ?? (errDoc ? null : <Caricamento />)
  );

  return (
    <div className="space-y-5">
      <Testata
        categoria="documenti"
        icona={Documento}
        sopra="Sicurezza"
        titolo="Scrivania del DVR"
        sotto="L'assistente scrive la bozza dai dati e dalla libreria dei rischi. Il tecnico accetta, corregge; il titolare approva e firma."
      />
      <Notizia testo={avviso} />
      <div className="scrivania-contenitore"><div className="scrivania-due grid items-start gap-4">
        <div className={clsx('min-w-0', doc && 'scrivania-lista-col')}>{colonnaDocumenti}</div>
        <div className="min-w-0">{centro}</div>
      </div></div>
      {azId && dati && (
        <NuovoDvr
          aperto={nuovo}
          onChiudi={() => setNuovo(false)}
          aziendaId={azId}
          nome={nomeAzienda}
          ateco={dati.ateco}
          onCreato={(id) => {
            setNuovo(false);
            setAvviso('Generazione avviata: puoi seguirla qui sotto.');
            scegliDoc(`dvr:${id}`);
            ricarica();
          }}
        />
      )}
      <p className="text-center text-[12.5px] text-ink-muted">
        Documenti preparati con assistenza AI: la validità è subordinata alla verifica e alla sottoscrizione delle figure competenti. I POS e i PiMUS sono in{' '}
        <Link href="/gestionale/pos/" className="underline underline-offset-2">
          POS e PiMUS
        </Link>
        .
      </p>
    </div>
  );
}

/** Nuovo DVR o nuova versione: si sceglie il materiale dell'archivio, poi parte la squadra di agenti. */
function NuovoDvr({ aperto, onChiudi, aziendaId, nome, ateco, onCreato }: { aperto: boolean; onChiudi: () => void; aziendaId: number; nome: string; ateco: string | null; onCreato: (id: number) => void }) {
  const [mat, setMat] = useState<Materiale[] | null>(null);
  const [scelti, setScelti] = useState<Set<number>>(new Set());
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!aperto) return;
    setErr(null);
    setMat(null);
    materialeAzienda(aziendaId)
      .then((m) => {
        setMat(m);
        setScelti(new Set(m.filter((x) => x.analizzato).map((x) => x.id)));
      })
      .catch(() => setMat([]));
  }, [aperto, aziendaId]);
  const vai = async () => {
    setLavoro(true);
    setErr(null);
    try {
      onCreato(await nuovoDvr(aziendaId, nome, ateco, Array.from(scelti)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generazione non avviata.');
    } finally {
      setLavoro(false);
    }
  };
  return (
    <Foglio
      aperto={aperto}
      titolo={`DVR di ${nome}`}
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-acido" disabled={lavoro || mat === null} onClick={() => void vai()}>
            {lavoro && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Genera il DVR
          </button>
        </>
      }
    >
      <p className="text-[14.5px] leading-relaxed text-ink-soft">
        La squadra di agenti scrive le 27 sezioni dai dati dell&apos;azienda, dalla libreria dei rischi e dal materiale che scegli qui. Esce in bozza con l&apos;avvertenza AI: poi lo correggi tu e lo approva il titolare.
      </p>
      <h3 className="mt-5 text-[15px] font-medium text-ink">Materiale dell&apos;archivio</h3>
      {mat === null ? (
        <Caricamento />
      ) : mat.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink-muted">L&apos;archivio è vuoto: il DVR userà i dati dell&apos;azienda, dei lavoratori e delle valutazioni già fatte.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {mat.map((m) => (
            <li key={m.id}>
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 py-2 hover:bg-perla-velo">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#18181b]"
                  checked={scelti.has(m.id)}
                  onChange={(e) =>
                    setScelti((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(m.id);
                      else n.delete(m.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{m.titolo}</span>
                  <span className="block text-[12.5px] text-ink-muted">
                    {m.tipo}
                    {m.analizzato ? '' : ' · senza analisi, non entra nel testo'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {err && (
        <div className="mt-4">
          <Errore testo={err} />
        </div>
      )}
    </Foglio>
  );
}

/** Elenco breve di cosa manca, con lo stesso testo dei controlli di emissione. */
function ElencoManca({ voci, altre, titolo }: { voci: string[]; altre: number; titolo?: string }) {
  return (
    <div className="mt-1.5">
      {titolo && <span className="block text-[12.5px] font-medium text-ink">{titolo}</span>}
      <ul className="mt-1 space-y-1">
        {voci.map((v, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-[1.45] text-ink-muted">
            <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-warn-mark" />
            <span>{v}</span>
          </li>
        ))}
        {altre > 0 && <li className="text-[12.5px] text-ink-muted">e altre {altre} cose</li>}
      </ul>
    </div>
  );
}
