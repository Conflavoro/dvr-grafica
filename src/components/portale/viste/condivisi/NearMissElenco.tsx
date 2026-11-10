'use client';

import { useCallback, useEffect, useState } from 'react';
import { Allerta, CerchioSpunta, Fotocamera, Piu } from '@/components/icone';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Riquadro, Riga, Schede, Scheda, Vuoto, dataIt } from '../../kit';
import {
  GRAVITA_NEAR_MISS,
  STATI_NEAR_MISS,
  aggiungiAzione,
  chiudiNearMiss,
  etichettaStato,
  fotoNearMiss,
  nearMiss as caricaNearMiss,
  passoNearMiss,
  prendiInCarico,
  proponiAnalisi,
  registraAnalisi,
  registroNearMiss,
  segnalaNearMissAzienda,
  type GravitaNearMiss,
  type NearMiss,
  type PropostaAnalisi,
  type RegistroNearMiss,
} from '@/lib/portale/nearmiss-api';
import { clsx } from '@/lib/clsx';

const CAMPO =
  'block w-full rounded-[1rem] bg-white px-4 py-3 text-[15px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] placeholder:text-ink-subtle focus:outline-none focus:shadow-[inset_0_0_0_2px_#18181b]';

const CHIP_STATO: Record<string, 'todo' | 'run' | 'info' | 'warn' | 'ok'> = {
  ricevuta: 'todo',
  presa_in_carico: 'info',
  analisi: 'run',
  azioni: 'warn',
  chiusa: 'ok',
};
const CHIP_GRAVITA: Record<GravitaNearMiss, 'ok' | 'warn' | 'danger' | 'neutral'> = { bassa: 'neutral', media: 'warn', alta: 'danger', grave: 'danger' };

type Filtro = 'aperti' | 'tutti' | 'chiusa';

function oggiPiu(giorni: number): string {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/**
 * Registro dei near miss di un'azienda, riusabile nell'area azienda e nella
 * scheda azienda del gestionale: statistiche, elenco, dettaglio con il flusso
 * (presa in carico, analisi con la proposta del Falco, azioni nello
 * scadenziario, chiusura) e segnalazione nuova.
 */
export function NearMissElenco({
  aziendaId,
  puoGestire,
  puoSegnalare,
  versione = 0,
  onApri,
}: {
  aziendaId: number;
  puoGestire: boolean;
  puoSegnalare: boolean;
  versione?: number;
  /** Il Falco della sezione sa quale segnalazione e' aperta. */
  onApri?: (id: number | null) => void;
}) {
  const [reg, setReg] = useState<RegistroNearMiss | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('aperti');
  const [aperto, setAperto] = useState<number | null>(null);
  const [nuova, setNuova] = useState(false);

  const carica = useCallback(() => {
    setErr(null);
    registroNearMiss(aziendaId)
      .then(setReg)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Registro non disponibile.'));
  }, [aziendaId]);
  useEffect(carica, [carica, versione]);

  const apri = (id: number | null) => {
    setAperto(id);
    onApri?.(id);
  };

  if (err) return <Errore testo={err} onRiprova={carica} />;
  if (!reg) return <Caricamento testo="Carico il registro dei near miss" />;

  const st = reg.statistiche;
  const voci = reg.voci.filter((v) => (filtro === 'tutti' ? true : filtro === 'chiusa' ? v.stato === 'chiusa' : v.stato !== 'chiusa'));
  const max = Math.max(1, ...st.perMese.map((m) => m.numero));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro etichetta="Aperti" valore={st.aperti} tono={st.aperti > 0 ? 'warn' : undefined} punto="bg-cat-antincendio-ink" />
        <Riquadro etichetta="Da prendere in carico" valore={st.daPrendere} tono={st.daPrendere > 0 ? 'danger' : undefined} />
        <Riquadro etichetta="Segnalati in tutto" valore={st.totale} sotto={st.anonimi > 0 ? `${st.anonimi} anonimi` : undefined} />
        <Riquadro etichetta="Giorni per chiudere" valore={st.giorniMedi} sotto="in media" />
      </div>

      {st.totale > 0 && (
        <Scheda titolo="Andamento" sotto="Segnalazioni negli ultimi 12 mesi">
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Segnalazioni per mese: ${st.perMese.map((m) => `${m.mese} ${m.numero}`).join(', ')}`}>
            {st.perMese.map((m) => (
              <div key={m.mese} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className={clsx('w-full rounded-t-[6px]', m.numero > 0 ? 'bg-grafite-900' : 'bg-perla-velo')} style={{ height: `${Math.max(4, (m.numero / max) * 72)}px` }} />
                <span className="text-[10.5px] text-ink-subtle">{m.mese.slice(5)}</span>
              </div>
            ))}
          </div>
          {st.perClassificazione.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {st.perClassificazione.slice(0, 5).map((c) => (
                <li key={c.k} className="rounded-full bg-perla-velo px-3 py-1.5 text-[13px] text-ink">
                  {reg.classificazioni[c.k] ?? c.k} <span className="cifre text-ink-muted">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Scheda>
      )}

      <Scheda
        titolo="Segnalazioni"
        azioni={
          puoSegnalare ? (
            <button type="button" onClick={() => setNuova(true)} className="btn-primary">
              <Piu size={16} aria-hidden /> Segnala
            </button>
          ) : undefined
        }
      >
        <Schede
          etichetta="Filtro"
          attiva={filtro}
          onCambia={setFiltro}
          voci={[
            { k: 'aperti', t: 'Aperti', n: st.aperti },
            { k: 'chiusa', t: 'Chiusi', n: st.totale - st.aperti },
            { k: 'tutti', t: 'Tutti', n: st.totale },
          ]}
        />
        <div className="mt-2">
          {voci.length === 0 ? (
            <Vuoto titolo={filtro === 'aperti' ? 'Nessun near miss aperto' : 'Nessuna segnalazione'}>
              I lavoratori segnalano i quasi incidenti dal loro link personale, anche in forma anonima.
            </Vuoto>
          ) : (
            voci.map((v) => (
              <Riga
                key={v.id}
                onClick={() => apri(v.id)}
                inizio={<Pastiglia categoria="antincendio" icona={Allerta} />}
                titolo={<span className="line-clamp-2">{v.descrizione}</span>}
                sotto={[v.codice, v.dove, v.accadutoIl ? dataIt(v.accadutoIl) : null, v.segnalatoDa].filter(Boolean).join(' · ')}
                fine={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Chip stato={CHIP_STATO[v.stato] ?? 'todo'}>{etichettaStato(v.stato)}</Chip>
                    {(v.gravita === 'alta' || v.gravita === 'grave') && <span className="text-[12px] font-medium text-stato-danger-ink">Gravità {v.gravita}</span>}
                  </span>
                }
              />
            ))
          )}
        </div>
      </Scheda>

      <DettaglioNearMiss id={aperto} puoGestire={puoGestire} classificazioni={reg.classificazioni} onChiudi={() => apri(null)} onCambiato={carica} />
      <NuovoNearMiss aperto={nuova} aziendaId={aziendaId} onChiudi={() => setNuova(false)} onFatto={(id) => (setNuova(false), carica(), apri(id))} />
    </div>
  );
}

// ---------------------------------------------------------------- dettaglio

function Passi({ stato }: { stato: string }) {
  const n = passoNearMiss(stato);
  return (
    <ol className="flex gap-1" aria-label={`Stato: ${etichettaStato(stato)}`}>
      {STATI_NEAR_MISS.map((s, i) => (
        <li key={s.k} className="min-w-0 flex-1">
          <span className={clsx('block h-1.5 rounded-full', i <= n ? 'bg-grafite-900' : 'bg-perla-velo')} />
          <span className={clsx('mt-1 block truncate text-[11px]', i === n ? 'font-medium text-ink' : 'text-ink-subtle')}>{s.t}</span>
        </li>
      ))}
    </ol>
  );
}

function Foto({ id, n }: { id: number; n: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void fotoNearMiss(id, n).then((x) => {
      u = x;
      setUrl(x);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, n]);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 overflow-hidden rounded-[1rem] bg-perla-velo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Foto ${n + 1}`} className="h-full w-full object-cover" />
    </a>
  ) : (
    <span className="grid h-24 w-24 place-items-center rounded-[1rem] bg-perla-velo text-ink-subtle">
      <Fotocamera size={20} aria-hidden />
    </span>
  );
}

function DettaglioNearMiss({
  id,
  puoGestire,
  classificazioni,
  onChiudi,
  onCambiato,
}: {
  id: number | null;
  puoGestire: boolean;
  classificazioni: Record<string, string>;
  onChiudi: () => void;
  onCambiato: () => void;
}) {
  const [nm, setNm] = useState<NearMiss | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [proposta, setProposta] = useState<PropostaAnalisi | null>(null);
  const [cause, setCause] = useState('');
  const [misure, setMisure] = useState('');
  const [cls, setCls] = useState('altro');
  const [rischio, setRischio] = useState<string>('');
  const [az, setAz] = useState({
    descrizione: '',
    responsabile: '',
    entro: oggiPiu(30),
  });
  const [esito, setEsito] = useState('');

  useEffect(() => {
    setNm(null);
    setErr(null);
    setProposta(null);
    if (id === null) return;
    caricaNearMiss(id)
      .then((x) => {
        setNm(x);
        setCause(x?.analisi?.cause.join('\n') ?? '');
        setMisure(x?.analisi?.misure.join('\n') ?? '');
        setCls(x?.analisi?.classificazione ?? 'altro');
        setRischio(x?.rischio ? String(x.rischio.indice) : '');
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Segnalazione non disponibile.'));
  }, [id]);

  const esegui = async (fn: () => Promise<NearMiss | null>) => {
    setLavoro(true);
    setErr(null);
    try {
      const x = await fn();
      if (x) setNm(x);
      onCambiato();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setLavoro(false);
    }
  };

  const chiediProposta = async () => {
    if (!nm) return;
    setLavoro(true);
    setErr(null);
    try {
      const p = await proponiAnalisi(nm.id);
      setProposta(p);
      setCause(p.cause.join('\n'));
      setMisure(p.misure.join('\n'));
      setCls(p.classificazione);
      setRischio(p.rischioIndice !== null ? String(p.rischioIndice) : '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Proposta non disponibile.');
    } finally {
      setLavoro(false);
    }
  };

  const righe = (t: string) =>
    t
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  const inAnalisi = nm && (nm.stato === 'presa_in_carico' || nm.stato === 'ricevuta' || nm.stato === 'analisi');

  return (
    <Foglio aperto={id !== null} titolo={nm ? `Near miss ${nm.codice}` : 'Near miss'} onChiudi={onChiudi} largo>
      {!nm && !err && <Caricamento />}
      {err && <Errore testo={err} />}
      {nm && (
        <div className="space-y-5 pb-2">
          <Passi stato={nm.stato} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip stato={CHIP_STATO[nm.stato] ?? 'todo'}>{etichettaStato(nm.stato)}</Chip>
              <Chip stato={CHIP_GRAVITA[nm.gravita]}>{`Gravità potenziale ${nm.gravita}`}</Chip>
              {nm.anonima && <Chip stato="neutral">Anonima</Chip>}
            </div>
            <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink">{nm.descrizione}</p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-[14px] sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">Dove</dt>
                <dd className="text-ink">{[nm.sede, nm.dove].filter(Boolean).join(', ') || 'Non indicato'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Quando</dt>
                <dd className="text-ink">{nm.accadutoIl ? `${dataIt(nm.accadutoIl)} ${nm.accadutoIl.slice(11, 16)}` : 'Non indicato'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Segnalato da</dt>
                <dd className="text-ink">{nm.segnalatoDa}</dd>
              </div>
            </dl>
            {nm.notaVocale && nm.notaVocale !== nm.descrizione && (
              <p className="mt-3 rounded-[1rem] bg-perla-velo px-4 py-3 text-[14px] leading-relaxed text-ink">
                <span className="block text-[12.5px] text-ink-muted">Nota vocale trascritta</span>
                {nm.notaVocale}
              </p>
            )}
            {nm.foto > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: nm.foto }, (_, i) => (
                  <Foto key={i} id={nm.id} n={i} />
                ))}
              </div>
            )}
          </div>

          {!puoGestire && nm.stato !== 'chiusa' && <Blocco>La gestione della segnalazione spetta al titolare, al referente o allo studio.</Blocco>}

          {puoGestire && nm.stato === 'ricevuta' && (
            <button type="button" disabled={lavoro} onClick={() => void esegui(() => prendiInCarico(nm.id))} className="btn-acido w-full">
              Prendo in carico
            </button>
          )}

          {(nm.analisi || (puoGestire && inAnalisi)) && (
            <section className="space-y-3 rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[17px] font-medium text-ink">Analisi</h3>
                {puoGestire && inAnalisi && (
                  <button type="button" disabled={lavoro} onClick={() => void chiediProposta()} className="btn-ghost">
                    Fai proporre al Falco
                  </button>
                )}
              </div>
              {puoGestire && inAnalisi ? (
                <>
                  {proposta && <p className="text-[12.5px] text-ink-muted">{proposta.disclaimer}</p>}
                  <label className="block text-[14px] font-medium text-ink">
                    Cause, una per riga
                    <textarea className={clsx(CAMPO, 'mt-1.5')} rows={3} value={cause} onChange={(e) => setCause(e.target.value)} />
                  </label>
                  <label className="block text-[14px] font-medium text-ink">
                    Misure proposte, una per riga
                    <textarea className={clsx(CAMPO, 'mt-1.5')} rows={3} value={misure} onChange={(e) => setMisure(e.target.value)} />
                  </label>
                  <label className="block text-[14px] font-medium text-ink">
                    Classificazione
                    <select className={clsx(CAMPO, 'mt-1.5')} value={cls} onChange={(e) => setCls(e.target.value)}>
                      {Object.entries(classificazioni).map(([k, t]) => (
                        <option key={k} value={k}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[14px] font-medium text-ink">
                    Rischio del DVR collegato
                    <select
                      className={clsx(CAMPO, 'mt-1.5')}
                      value={rischio}
                      onChange={(e) => setRischio(e.target.value)}
                      disabled={proposta !== null && proposta.rischiDvr.length === 0}
                    >
                      <option value="">Nessun collegamento</option>
                      {(
                        proposta?.rischiDvr ??
                        (nm.rischio
                          ? [
                              {
                                indice: nm.rischio.indice,
                                etichetta: nm.rischio.etichetta,
                                livello: nm.rischio.livello,
                                pericolo: nm.rischio.pericolo,
                              },
                            ]
                          : [])
                      ).map((r) => (
                        <option key={r.indice} value={r.indice}>
                          {`${r.etichetta}${r.livello ? ` (${r.livello})` : ''}: ${r.pericolo.slice(0, 70)}`}
                        </option>
                      ))}
                    </select>
                    {proposta && !proposta.dvr && <span className="mt-1 block text-[12.5px] font-normal text-ink-muted">Serve un DVR approvato per collegare il rischio.</span>}
                    {!proposta && !nm.rischio && (
                      <span className="mt-1 block text-[12.5px] font-normal text-ink-muted">Chiedi la proposta al Falco per vedere i rischi del DVR.</span>
                    )}
                  </label>
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">Se colleghi un rischio valutato, lo studio riceve in coda la proposta di aggiornare il DVR.</p>
                  <button
                    type="button"
                    disabled={lavoro || righe(cause).length === 0}
                    onClick={() =>
                      void esegui(() =>
                        registraAnalisi(nm.id, {
                          cause: righe(cause),
                          misure: righe(misure),
                          classificazione: cls,
                          rischio_indice: rischio === '' ? null : Number(rischio),
                          proposta_ai: proposta?.fonte === 'ai',
                        }),
                      )
                    }
                    className="btn-primary w-full"
                  >
                    Registra l’analisi
                  </button>
                </>
              ) : (
                nm.analisi && (
                  <div className="space-y-2 text-[14.5px] text-ink">
                    <p>
                      <span className="text-ink-muted">Classificazione: </span>
                      {classificazioni[nm.analisi.classificazione ?? ''] ?? nm.analisi.classificazione}
                    </p>
                    {nm.rischio && (
                      <p>
                        <span className="text-ink-muted">Rischio del DVR: </span>
                        {nm.rischio.etichetta} (versione {nm.rischio.dvr_versione})
                      </p>
                    )}
                    <ul className="list-disc pl-5">
                      {nm.analisi.cause.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </section>
          )}

          {(nm.stato === 'analisi' || nm.stato === 'azioni' || nm.azioni.length > 0) && (
            <section className="space-y-3 rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <h3 className="text-[17px] font-medium text-ink">Azioni</h3>
              {nm.azioni.length === 0 && <p className="text-[14px] text-ink-muted">Ogni azione diventa una scadenza dello scadenziario con il suo responsabile.</p>}
              <ul>
                {nm.azioni.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 border-b border-perla-linea py-2.5 text-[14.5px] last:border-b-0">
                    <CerchioSpunta size={16} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
                    <span>
                      <span className="block text-ink">{a.descrizione}</span>
                      <span className="block text-[13px] text-ink-muted">
                        {a.responsabile}, entro il {dataIt(a.entro)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {puoGestire && (nm.stato === 'analisi' || nm.stato === 'azioni') && (
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem_10rem]">
                  <input
                    className={CAMPO}
                    placeholder="Cosa si fa"
                    maxLength={200}
                    value={az.descrizione}
                    onChange={(e) => setAz({ ...az, descrizione: e.target.value })}
                    aria-label="Azione"
                  />
                  <input
                    className={CAMPO}
                    placeholder="Responsabile"
                    maxLength={150}
                    value={az.responsabile}
                    onChange={(e) => setAz({ ...az, responsabile: e.target.value })}
                    aria-label="Responsabile"
                  />
                  <input className={CAMPO} type="date" value={az.entro} min={oggiPiu(0)} onChange={(e) => setAz({ ...az, entro: e.target.value })} aria-label="Entro il" />
                  <button
                    type="button"
                    disabled={lavoro || !az.descrizione.trim() || !az.responsabile.trim()}
                    onClick={() =>
                      void esegui(async () => {
                        const x = await aggiungiAzione(nm.id, az);
                        setAz({
                          descrizione: '',
                          responsabile: '',
                          entro: oggiPiu(30),
                        });
                        return x;
                      })
                    }
                    className="btn-ghost sm:col-span-3"
                  >
                    <Piu size={16} aria-hidden /> Aggiungi allo scadenziario
                  </button>
                </div>
              )}
            </section>
          )}

          {puoGestire && (nm.stato === 'analisi' || nm.stato === 'azioni') && (
            <section className="space-y-2">
              <label className="block text-[14px] font-medium text-ink">
                Esito
                <textarea
                  className={clsx(CAMPO, 'mt-1.5')}
                  rows={2}
                  value={esito}
                  onChange={(e) => setEsito(e.target.value)}
                  placeholder="Cosa è stato fatto, o perché non servono altre azioni"
                />
              </label>
              <button
                type="button"
                disabled={lavoro || esito.trim().length < 10}
                onClick={() => void esegui(() => chiudiNearMiss(nm.id, esito.trim()))}
                className="btn-primary w-full"
              >
                Chiudi la segnalazione
              </button>
            </section>
          )}

          {nm.stato === 'chiusa' && nm.esito && (
            <p className="rounded-[1rem] bg-stato-ok px-4 py-3 text-[14.5px] text-stato-ok-ink">
              <span className="block text-[12.5px] opacity-80">Chiusa il {dataIt(nm.chiusaIl)}</span>
              {nm.esito}
            </p>
          )}

          {nm.registro.length > 0 && (
            <details className="text-[13.5px] text-ink-muted">
              <summary className="cursor-pointer py-2">Registro della segnalazione</summary>
              <ul className="space-y-1">
                {nm.registro.map((r, i) => (
                  <li key={i}>
                    {dataIt(r.quando)} {r.quando.slice(11, 16)}: {r.cosa} ({r.chi})
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- nuova segnalazione

function NuovoNearMiss({ aperto, aziendaId, onChiudi, onFatto }: { aperto: boolean; aziendaId: number; onChiudi: () => void; onFatto: (id: number) => void }) {
  const [descrizione, setDescrizione] = useState('');
  const [dove, setDove] = useState('');
  const [gravita, setGravita] = useState<GravitaNearMiss>('media');
  const [foto, setFoto] = useState<File[]>([]);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const invia = async () => {
    setLavoro(true);
    setErr(null);
    try {
      const x = await segnalaNearMissAzienda(aziendaId, {
        descrizione: descrizione.trim(),
        dove: dove.trim(),
        gravita,
        foto,
      });
      setDescrizione('');
      setDove('');
      setFoto([]);
      if (x) onFatto(x.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invio non riuscito.');
    } finally {
      setLavoro(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Segnala un near miss"
      onChiudi={onChiudi}
      piede={
        <button type="button" disabled={lavoro || descrizione.trim().length < 10} onClick={() => void invia()} className="btn-acido w-full sm:w-auto">
          {lavoro ? 'Invio' : 'Invia la segnalazione'}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block text-[14px] font-medium text-ink">
          Cosa è successo
          <textarea className={clsx(CAMPO, 'mt-1.5')} rows={4} maxLength={2000} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </label>
        <label className="block text-[14px] font-medium text-ink">
          Dove
          <input className={clsx(CAMPO, 'mt-1.5')} maxLength={200} value={dove} onChange={(e) => setDove(e.target.value)} placeholder="Reparto o punto preciso" />
        </label>
        <fieldset>
          <legend className="text-[14px] font-medium text-ink">Gravità potenziale</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {GRAVITA_NEAR_MISS.map((g) => (
              <button
                key={g.k}
                type="button"
                aria-pressed={gravita === g.k}
                onClick={() => setGravita(g.k)}
                className={clsx('min-h-[44px] rounded-full px-4 text-[14px]', gravita === g.k ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]')}
              >
                {g.t}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-[14px] font-medium text-ink">
          Foto (fino a 3)
          <input type="file" accept="image/*" multiple className="mt-1.5 block text-[14px]" onChange={(e) => setFoto(Array.from(e.target.files ?? []).slice(0, 3))} />
        </label>
        {err && <Errore testo={err} />}
      </div>
    </Foglio>
  );
}
