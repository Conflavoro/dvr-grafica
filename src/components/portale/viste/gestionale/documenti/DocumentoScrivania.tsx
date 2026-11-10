'use client';

import { clearApiCache } from '@/lib/api';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avanti, Avviso, Indietro, Rotore, Storico } from '@/components/icone';
import { Caricamento, Chip, Errore, Foglio, Schede, Scheda, dataIt } from '@/components/portale/kit';
import { usePortale } from '@/components/portale/PortaleShell';
import { clsx } from '@/lib/clsx';
import { compareRevisions } from '@/lib/dvr-revisions';
import type { DvrRevisionDetail } from '@/lib/data-source';
import { azioniDocumento, inCorso, nomeFile, puoEmettere, puoRedigere, STATO_DOC, testoStato, type PassoGenerazione, type Segnalazione, type VoceDocumento } from '@/lib/portale/documenti';
import {
  approvaDvr,
  controlliDocumento,
  emetti,
  generaDvr,
  inviaInRevisione,
  revisioniDvr,
  ripristinaRevisione,
  salvaSezione,
  segnaPronta,
  sezioniDvr,
  statoGenerazione,
  type RevisioneDvr,
  type SezioneDvr,
} from '@/lib/portale/documenti-api';
import { LinkScrivania } from '@/components/cowork/LinkScrivania';
import { Avanzamento, FoglioConferma, PannelloQualita, Scaricamenti, Segnalazioni } from './parti';

type SchedaDoc = 'testo' | 'qualita' | 'revisioni' | 'controlli';

export function DocumentoScrivania({ voce, azienda, aziendaId, onCambiato, onAvviso }: { voce: VoceDocumento; azienda: string; aziendaId: number; onCambiato: () => void; onAvviso: (t: string) => void }) {
  const { user, chiedi } = usePortale();
  const dvr = voce.gruppo === 'dvr';
  const [scheda, setScheda] = useState<SchedaDoc>(dvr ? 'testo' : 'qualita');
  const [giro, setGiro] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [conferma, setConferma] = useState<'approva' | 'emetti' | null>(null);
  const [gen, setGen] = useState<{ attiva: boolean; passi: PassoGenerazione[]; errore: string | null }>({ attiva: dvr && inCorso(voce.generazione), passi: [], errore: null });

  // Generazione dal vivo: si interroga lo stato finché la squadra non ha finito.
  useEffect(() => {
    if (!dvr || !gen.attiva) return;
    let vivo = true;
    const giroStato = async () => {
      try {
        const s = await statoGenerazione(voce.id);
        if (!vivo) return;
        if (inCorso(s.stato)) {
          setGen({ attiva: true, passi: s.passi, errore: null });
        } else {
          setGen({ attiva: false, passi: s.passi, errore: s.stato === 'failed' ? s.errore ?? 'La generazione non è riuscita.' : null });
          if (s.stato === 'completed') onAvviso('Il DVR è pronto in bozza: controlla qualità e testo.');
          if (s.stato === 'failed') setErr(`La generazione non è riuscita${s.errore ? `: ${s.errore}` : '.'}`);
          setGiro((g) => g + 1);
          onCambiato();
        }
      } catch {
        /* riprova al giro dopo */
      }
    };
    void giroStato();
    const h = setInterval(() => {
      clearApiCache();
      void giroStato();
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(h);
    };
  }, [dvr, gen.attiva, voce.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const esegui = useCallback(
    async (nome: string, fn: () => Promise<void>, ok: string) => {
      setLavoro(nome);
      setErr(null);
      try {
        await fn();
        onAvviso(ok);
        setGiro((g) => g + 1);
        onCambiato();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
      } finally {
        setLavoro(null);
      }
    },
    [onAvviso, onCambiato]
  );

  const azioni = azioniDocumento({ ...voce, generazione: gen.attiva ? 'running' : voce.generazione }, user.role);
  const nome = (f: 'pdf' | 'docx') => nomeFile(voce, azienda, f);
  const chiaveDoc = dvr ? `DVR ${voce.id}` : `${voce.etichetta.toLowerCase()} (documento ${voce.id})`;

  const pulsante = (k: string, testo: string, fn: () => void, primario = false) => (
    <button key={k} type="button" className={primario ? 'btn-acido' : 'btn-primary'} disabled={lavoro !== null} onClick={fn}>
      {lavoro === k && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {testo}
    </button>
  );

  const schede: Array<{ k: SchedaDoc; t: string }> = dvr
    ? [
        { k: 'testo', t: 'Testo' },
        { k: 'qualita', t: 'Qualità' },
        { k: 'revisioni', t: 'Revisioni' },
      ]
    : voce.gruppo === 'documento'
      ? [
          { k: 'qualita', t: 'Qualità' },
          { k: 'controlli', t: 'Controlli' },
        ]
      : [{ k: 'qualita', t: 'Qualità' }];

  return (
    <div className="space-y-4">
      <Scheda>
        <div className="pt-4">
          <p className="text-[13px] text-ink-muted">{azienda}</p>
          <h2 className="mt-0.5 text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink">{voce.etichetta}</h2>
          {voce.titolo && !dvr && <p className="mt-0.5 text-[14px] text-ink-soft">{voce.titolo}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip stato={STATO_DOC[voce.stato].chip}>{testoStato(voce)}</Chip>
            {voce.revisione > 0 && <Chip stato="neutral">{dvr ? `Versione ${voce.versione ?? 1} · revisione ${voce.revisione}` : `Revisione ${voce.revisione}`}</Chip>}
            {voce.bloccanti > 0 && <Chip stato="danger">{voce.bloccanti === 1 ? '1 blocco' : `${voce.bloccanti} blocchi`}</Chip>}
            {voce.aggiornatoIl && <span className="text-[12.5px] text-ink-muted">Aggiornato il {dataIt(voce.aggiornatoIl)}</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {azioni.map((a) => {
              switch (a) {
                case 'genera':
                case 'rigenera':
                  return pulsante(
                    a,
                    a === 'genera' ? 'Genera il DVR' : 'Rigenera con i dati aggiornati',
                    () =>
                      void esegui(
                        a,
                        async () => {
                          await generaDvr(voce.id);
                          setGen({ attiva: true, passi: [], errore: null });
                        },
                        'Generazione avviata. Le sezioni corrette a mano restano come le hai scritte.'
                      ),
                    a === 'genera'
                  );
                case 'invia_revisione':
                  return pulsante(a, 'Invia in revisione al titolare', () => void esegui(a, () => inviaInRevisione(voce.id), 'DVR inviato in revisione: lo approva il titolare.'));
                case 'approva':
                  return pulsante(a, 'Approva il DVR', () => setConferma('approva'), true);
                case 'segna_pronta':
                  return pulsante(a, 'Segna pronta da emettere', () => void esegui(a, () => segnaPronta(voce.id), 'Valutazione pronta: la emette il titolare.'));
                case 'emetti':
                  return (
                    <button key={a} type="button" className="btn-acido" disabled={lavoro !== null || voce.bloccanti > 0} onClick={() => setConferma('emetti')}>
                      Emetti il documento
                    </button>
                  );
                case 'apri_pos':
                  return (
                    <Link key={a} href={`/gestionale/pos/?id=${voce.id}`} className="btn-primary">
                      Apri in POS e PiMUS
                    </Link>
                  );
                default:
                  return null;
              }
            })}
            {(!dvr || (voce.revisione > 0 && !gen.attiva)) && <Scaricamenti gruppo={voce.gruppo} id={voce.id} nome={nome} onErrore={setErr} />}
            {dvr && <LinkScrivania dvrId={voce.id} aziendaId={aziendaId} ruolo={user.role} testo="Lavora per paragrafi" />}
          </div>
          {puoEmettere(user.role) && azioni.includes('emetti') && voce.bloccanti > 0 && <p className="mt-3 text-[13px] text-ink-muted">Si emette quando non restano blocchi: vedi la scheda Controlli.</p>}
          {!puoEmettere(user.role) && puoRedigere(user.role) && (voce.statoOriginale === 'review' || voce.statoOriginale === 'pronta' || (voce.gruppo === 'documento' && voce.stato === 'bozza')) && (
            <p className="mt-3 text-[13px] text-ink-muted">L&apos;approvazione e l&apos;emissione sono del titolare dello studio.</p>
          )}
        </div>
      </Scheda>

      {err && <Errore testo={err} onRiprova={() => setErr(null)} />}

      {voce.perche.length > 0 && (
        <div className="rounded-[1.25rem] bg-stato-warn px-4 py-3.5 text-stato-warn-ink">
          <p className="flex items-center gap-2 text-[14.5px] font-medium">
            <Avviso size={17} aria-hidden /> Perché va aggiornato
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-[14px]">
            {voce.perche.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-3 min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" onClick={() => chiedi(`Il ${chiaveDoc} di ${azienda} va aggiornato: ${voce.perche.join(' ')} Dimmi cosa cambia e quali sezioni vanno riviste.`)}>
            Chiedi al Falco cosa cambia
          </button>
        </div>
      )}

      {gen.attiva && <Avanzamento passi={gen.passi} errore={gen.errore} />}

      <Schede voci={schede} attiva={scheda} onCambia={setScheda} etichetta="Parti del documento" />

      <Scheda>
        <div className="pt-4">
          {scheda === 'testo' && dvr && <TestoDvr dvrId={voce.id} giro={giro} modificabile={puoRedigere(user.role) && !gen.attiva} onSalvato={() => { setGiro((g) => g + 1); onCambiato(); onAvviso('Sezione salvata come nuova revisione.'); }} onChiedi={chiedi} />}
          {scheda === 'qualita' && <PannelloQualita voce={voce} versione={giro} onChiedi={chiedi} />}
          {scheda === 'revisioni' && dvr && (
            <Revisioni
              dvrId={voce.id}
              giro={giro}
              modificabile={puoRedigere(user.role) && !gen.attiva}
              nome={nome}
              onRipristinata={() => {
                setGiro((g) => g + 1);
                onCambiato();
                onAvviso('Revisione ripristinata: è diventata la corrente.');
              }}
              onErrore={setErr}
            />
          )}
          {scheda === 'controlli' && voce.gruppo === 'documento' && <ControlliDocumento id={voce.id} giro={giro} onChiedi={chiedi} />}
        </div>
      </Scheda>

      <FoglioConferma
        aperto={conferma === 'approva'}
        titolo="Approva il DVR"
        spiega={
          <>
            <p>
              Approvi il DVR di <strong className="font-medium text-ink">{azienda}</strong>, revisione {voce.revisione}. Il documento esce in Word e PDF con la fotografia dei dati usati e l&apos;avvertenza sull&apos;assistenza AI.
            </p>
            <p>Una correzione a mano sul file non è ammessa: si corregge il dato o la sezione qui e si approva di nuovo. Dopo l&apos;approvazione servono le firme del datore di lavoro, dell&apos;RSPP e del medico competente e la consultazione dell&apos;RLS.</p>
          </>
        }
        spunta={`Ho letto il documento e lo approvo come titolare dello studio (${user.name}).`}
        azione="Approva"
        onChiudi={() => setConferma(null)}
        onConferma={async () => {
          await approvaDvr(voce.id);
          onAvviso('DVR approvato. Ora va firmato dalle figure competenti.');
          setGiro((g) => g + 1);
          onCambiato();
        }}
      />
      <FoglioConferma
        aperto={conferma === 'emetti'}
        titolo={`Emetti ${voce.etichetta.toLowerCase()}`}
        spiega={
          <p>
            Nasce la revisione {voce.revisione + 1}, immutabile, con Word e PDF. Il sistema la blocca se restano segnalazioni aperte. Dopo l&apos;emissione ogni modifica diventa la revisione successiva.
          </p>
        }
        spunta={`Ho verificato il documento e lo emetto come titolare dello studio (${user.name}).`}
        azione="Emetti"
        onChiudi={() => setConferma(null)}
        onConferma={async () => {
          if (voce.gruppo !== 'valutazione' && voce.gruppo !== 'documento') return;
          const n = await emetti(voce.gruppo, voce.id);
          onAvviso(`Emesso: revisione ${n ?? voce.revisione + 1}.`);
          setGiro((g) => g + 1);
          onCambiato();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- testo del DVR

function TestoDvr({ dvrId, giro, modificabile, onSalvato, onChiedi }: { dvrId: number; giro: number; modificabile: boolean; onSalvato: () => void; onChiedi: (t: string) => void }) {
  const [sezioni, setSezioni] = useState<SezioneDvr[] | null>(null);
  const [corrente, setCorrente] = useState<number | null>(null);
  const [i, setI] = useState(0);
  const [bozza, setBozza] = useState<{ title: string; body: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErr(null);
    revisioniDvr(dvrId)
      .then(async (r) => {
        const n = r[0]?.numero ?? null;
        if (!vivo) return;
        setCorrente(n);
        setSezioni(n ? await sezioniDvr(dvrId, n) : []);
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'Testo non disponibile.'));
    return () => {
      vivo = false;
    };
  }, [dvrId, giro]);

  const s = sezioni?.[i] ?? null;
  useEffect(() => {
    setBozza(s ? { title: s.title, body: s.body } : null);
    setMotivo('');
  }, [s?.key, s?.body]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <Errore testo={err} />;
  if (!sezioni) return <Caricamento testo="Carico il testo" />;
  if (sezioni.length === 0) return <p className="text-[14px] text-ink-muted">Il DVR non ha ancora un testo: avvia la generazione.</p>;
  const cambiato = bozza !== null && s !== null && (bozza.body !== s.body || bozza.title !== s.title);

  const salva = async () => {
    if (!s || !bozza) return;
    setSalvo(true);
    setErr(null);
    try {
      await salvaSezione(dvrId, { key: s.key, title: bozza.title, body: bozza.body }, motivo || `Correzione della sezione ${s.key}`);
      onSalvato();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" className="btn-icon" aria-label="Sezione precedente" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
          <Indietro size={18} aria-hidden />
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Sezione</span>
          <select value={i} onChange={(e) => setI(Number(e.target.value))} className="h-11 w-full truncate rounded-full bg-perla-velo px-4 text-[14px] text-ink outline-none">
            {sezioni.map((x, n) => (
              <option key={x.key} value={n}>
                {x.key}. {x.title}
                {x.origine === 'umano' ? ' (corretta a mano)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-icon" aria-label="Sezione successiva" disabled={i >= sezioni.length - 1} onClick={() => setI((x) => Math.min(sezioni.length - 1, x + 1))}>
          <Avanti size={18} aria-hidden />
        </button>
      </div>
      <p className="text-[12.5px] text-ink-muted">
        Sezione {i + 1} di {sezioni.length} · revisione {corrente} · {s?.origine === 'umano' ? 'testo del tecnico' : "proposta dell'assistente"}
      </p>
      {bozza && (
        <>
          <input
            aria-label="Titolo della sezione"
            value={bozza.title}
            readOnly={!modificabile}
            onChange={(e) => setBozza({ ...bozza, title: e.target.value })}
            className="h-11 w-full rounded-[0.875rem] bg-white px-3.5 text-[16px] font-medium text-ink shadow-[inset_0_0_0_1px_#e2e2e5] outline-none"
          />
          <textarea
            aria-label="Testo della sezione"
            value={bozza.body}
            readOnly={!modificabile}
            onChange={(e) => setBozza({ ...bozza, body: e.target.value })}
            rows={18}
            className="w-full rounded-[1rem] bg-white px-4 py-3 font-sans text-[14.5px] leading-relaxed text-ink shadow-[inset_0_0_0_1px_#e2e2e5] outline-none"
          />
        </>
      )}
      {modificabile ? (
        <div className="space-y-2">
          {cambiato && (
            <input
              aria-label="Motivo della correzione"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Perché la correggi (resta nello storico)"
              className="h-11 w-full rounded-full bg-perla-velo px-4 text-[14px] text-ink outline-none placeholder:text-ink-muted"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!cambiato || salvo} onClick={() => void salva()}>
              {salvo && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
              Salva come nuova revisione
            </button>
            {cambiato && (
              <button type="button" className="btn-ghost" onClick={() => s && setBozza({ title: s.title, body: s.body })}>
                Annulla le modifiche
              </button>
            )}
            {s && (
              <button type="button" className="btn-ghost" onClick={() => onChiedi(`Rivedi la sezione ${s.key} «${s.title}» del DVR ${dvrId}: dimmi cosa non va (dati mancanti, frasi generiche, riferimenti) e preparami la nuova versione. Non salvarla finché non te lo confermo.`)}>
                Chiedi al Falco di rivederla
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-muted">Lo modifica il tecnico.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- revisioni del DVR

function Revisioni({ dvrId, giro, modificabile, nome, onRipristinata, onErrore }: { dvrId: number; giro: number; modificabile: boolean; nome: (f: 'pdf' | 'docx') => string; onRipristinata: () => void; onErrore: (t: string) => void }) {
  const [rev, setRev] = useState<RevisioneDvr[] | null>(null);
  const [confronto, setConfronto] = useState<{ numero: number; diff: ReturnType<typeof compareRevisions> } | null>(null);
  const [caricoConfronto, setCaricoConfronto] = useState<number | null>(null);
  const [ripristina, setRipristina] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    revisioniDvr(dvrId)
      .then((r) => vivo && setRev(r))
      .catch((e) => vivo && onErrore(e instanceof Error ? e.message : 'Revisioni non disponibili.'));
    return () => {
      vivo = false;
    };
  }, [dvrId, giro]); // eslint-disable-line react-hooks/exhaustive-deps

  const corrente = rev?.[0]?.numero ?? null;
  const confronta = async (n: number) => {
    if (!corrente) return;
    setCaricoConfronto(n);
    try {
      const [a, b] = await Promise.all([sezioniDvr(dvrId, n), sezioniDvr(dvrId, corrente)]);
      const det = (s: SezioneDvr[]) => ({ sezioni: s.map((x) => ({ key: x.key, title: x.title, body: x.body, origine: x.origine === 'umano' ? 'umano' : 'ai' })) }) as unknown as DvrRevisionDetail;
      setConfronto({ numero: n, diff: compareRevisions(det(a), det(b)) });
    } catch (e) {
      onErrore(e instanceof Error ? e.message : 'Confronto non riuscito.');
    } finally {
      setCaricoConfronto(null);
    }
  };

  const etichette = useMemo(() => ({ ai: "Scritta dall'assistente", umano: 'Corretta dal tecnico' }) as Record<string, string>, []);
  if (!rev) return <Caricamento testo="Carico lo storico" />;
  if (rev.length === 0) return <p className="text-[14px] text-ink-muted">Nessuna revisione: il DVR non è ancora stato generato.</p>;
  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-muted">Ogni testo dell&apos;assistente e ogni correzione del tecnico diventano una revisione numerata che non si cancella.</p>
      <ul>
        {rev.map((r) => (
          <li key={r.numero} className="border-b border-perla-linea py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-ink">
                <Storico size={16} aria-hidden className="text-ink-muted" /> Revisione {r.numero}
              </span>
              {r.numero === corrente && <Chip stato="ok">Corrente</Chip>}
              <Chip stato={r.origine === 'umano' ? 'info' : 'neutral'}>{etichette[r.origine] ?? r.origine}</Chip>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              {[r.quando ? dataIt(r.quando) : null, r.autore, r.motivo, r.sezioniModificate.length ? `sezioni ${r.sezioniModificate.slice(0, 8).join(', ')}${r.sezioniModificate.length > 8 ? '…' : ''}` : null].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.numero !== corrente && (
                <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" disabled={caricoConfronto !== null} onClick={() => void confronta(r.numero)}>
                  {caricoConfronto === r.numero && <Rotore size={14} aria-hidden className="animate-spin motion-reduce:animate-none" />}
                  Confronta con la corrente
                </button>
              )}
              {r.numero !== corrente && modificabile && (
                <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" onClick={() => setRipristina(r.numero)}>
                  Ripristina
                </button>
              )}
              {r.haFile && <Scaricamenti gruppo="dvr" id={dvrId} revisione={r.numero} nome={(f) => nome(f).replace(/_(rev\d+|bozza)\./, `_rev${r.numero}.`)} onErrore={onErrore} />}
            </div>
          </li>
        ))}
      </ul>
      <Foglio aperto={confronto !== null} titolo={confronto ? `Revisione ${confronto.numero} e corrente` : ''} onChiudi={() => setConfronto(null)} largo>
        {confronto && confronto.diff.length === 0 && <p className="text-[14px] text-ink-muted">Le due revisioni hanno lo stesso testo.</p>}
        <div className="space-y-5">
          {confronto?.diff.map((c) => (
            <section key={c.key}>
              <h3 className="text-[15px] font-medium text-ink">
                {c.key}. {c.title} <span className="text-[12.5px] font-normal text-ink-muted">· {c.stato}</span>
              </h3>
              <div className="mt-1.5 space-y-1">
                {c.ops
                  .filter((o) => o.type !== 'same')
                  .slice(0, 60)
                  .map((o, n) => (
                    <p key={n} className={clsx('rounded-[0.625rem] px-3 py-1.5 text-[13.5px] leading-relaxed', o.type === 'added' ? 'bg-acido-200 text-acido-950' : 'bg-stato-danger text-stato-danger-ink line-through decoration-1')}>
                      {o.text}
                    </p>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </Foglio>
      <FoglioConferma
        aperto={ripristina !== null}
        titolo={`Ripristina la revisione ${ripristina ?? ''}`}
        spiega={<p>Il testo della revisione {ripristina} diventa una nuova revisione corrente. Lo storico resta intero: nulla si cancella.</p>}
        spunta="Voglio ripristinare questo testo."
        azione="Ripristina"
        onChiudi={() => setRipristina(null)}
        onConferma={async () => {
          if (ripristina) await ripristinaRevisione(dvrId, ripristina);
          onRipristinata();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- controlli dei documenti HSE

function ControlliDocumento({ id, giro, onChiedi }: { id: number; giro: number; onChiedi: (t: string) => void }) {
  const [voci, setVoci] = useState<Segnalazione[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    controlliDocumento(id)
      .then((v) => vivo && setVoci(v))
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'Controlli non disponibili.'));
    return () => {
      vivo = false;
    };
  }, [id, giro]);
  if (err) return <Errore testo={err} />;
  if (!voci) return <Caricamento testo="Lancio i controlli" />;
  return <Segnalazioni voci={voci} puoAccettare={false} onChiedi={onChiedi} />;
}
