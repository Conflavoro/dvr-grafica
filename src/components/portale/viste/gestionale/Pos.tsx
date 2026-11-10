'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Casco, Indietro, Rotore } from '@/components/icone';
import { Caricamento, Chip, Errore, Schede, Scheda, Testata, Vuoto, dataIt } from '@/components/portale/kit';
import { usePortale } from '@/components/portale/PortaleShell';
import { clsx } from '@/lib/clsx';
import { puoEmettere, puoRedigere, type Segnalazione, type VoceDocumento } from '@/lib/portale/documenti';
import {
  controllaPos,
  controlliDocumento,
  elencoCantieri,
  elencoPimus,
  elencoPos,
  emetti,
  posAnteprima,
  posEmetti,
  posPronto,
  type CantiereBreve,
  type PimusVoce,
  type PosVoce,
} from '@/lib/portale/documenti-api';
import { FoglioConferma, Notizia, PannelloQualita, Scaricamenti, Segnalazioni, useAvviso } from './documenti/parti';
import { ChiediPsc } from './ChiediPsc';

/**
 * POS e PiMUS (gestionale, ADR-009 V3, SPEC_GESTIONALE §11): il POS nasce dai dati
 * dell'impresa, del cantiere e dalla libreria delle schede; PosChecker blocca,
 * chiede correzioni di libreria o avvisa; l'emissione è del titolare con conferma.
 */

type Vista = 'pos' | 'pimus';
const STATO_POS: Record<PosVoce['stato'], { chip: 'neutral' | 'run' | 'ok'; testo: string }> = {
  bozza: { chip: 'neutral', testo: 'In lavorazione' },
  pronto: { chip: 'run', testo: 'Pronto da emettere' },
  emesso: { chip: 'ok', testo: 'Emesso' },
};

function leggiId(chiave: string): number | null {
  try {
    const n = Number(new URLSearchParams(window.location.search).get(chiave));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export default function Pos() {
  const { user, apri, versione, aziendaScelta } = usePortale();
  // Solo il cliente scelto in cima al menu (la schermata e' per azienda).
  const azId = aziendaScelta?.id ?? null;
  const [vista, setVista] = useState<Vista>('pos');
  const [pos, setPos] = useState<PosVoce[] | null>(null);
  const [pimus, setPimus] = useState<PimusVoce[] | null>(null);
  const [cantieri, setCantieri] = useState<Record<number, CantiereBreve>>({});
  const [err, setErr] = useState<string | null>(null);
  const [aperto, setAperto] = useState<{ tipo: Vista; id: number } | null>(null);
  const [giro, setGiro] = useState(0);
  const [avviso, setAvviso] = useAvviso();

  useEffect(() => {
    const p = leggiId('id');
    const m = leggiId('pimus');
    if (p) setAperto({ tipo: 'pos', id: p });
    else if (m) {
      setVista('pimus');
      setAperto({ tipo: 'pimus', id: m });
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    setErr(null);
    // Il filtro del server e quello qui restano entrambi: solo l'azienda scelta.
    const suo = <T extends { aziendaId: number }>(l: T[]) => (azId ? l.filter((x) => x.aziendaId === azId) : l);
    Promise.all([elencoPos(azId), elencoPimus(azId), elencoCantieri(azId)])
      .then(([a, b, c]) => {
        if (!vivo) return;
        setPos(suo(a));
        setPimus(suo(b));
        setCantieri(Object.fromEntries(c.map((x) => [x.id, x])));
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'Elenco non disponibile.'));
    return () => {
      vivo = false;
    };
  }, [versione, giro, azId]);

  const nomeAz = useCallback((id: number) => (aziendaScelta && aziendaScelta.id === id ? aziendaScelta.ragione_sociale : `Azienda ${id}`), [aziendaScelta]);
  const ricarica = useCallback(() => setGiro((g) => g + 1), []);

  const voceAperta = aperto?.tipo === 'pos' ? pos?.find((p) => p.id === aperto.id) ?? null : null;
  const pimusAperto = aperto?.tipo === 'pimus' ? pimus?.find((p) => p.id === aperto.id) ?? null : null;

  useEffect(() => {
    if (voceAperta) apri({ tipo: 'pos', id: voceAperta.id }, voceAperta.aziendaId);
    else if (pimusAperto) apri({ tipo: 'documento', id: pimusAperto.id }, pimusAperto.aziendaId);
    else apri(null, null);
  }, [voceAperta?.id, pimusAperto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scegli = (a: { tipo: Vista; id: number } | null) => {
    setAperto(a);
    try {
      const q = a ? `?${a.tipo === 'pos' ? 'id' : 'pimus'}=${a.id}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${q}`);
    } catch {
      /* comodita' */
    }
  };

  const ordinati = useMemo(() => [...(pos ?? [])].sort((a, b) => ({ pronto: 0, bozza: 1, emesso: 2 })[a.stato] - ({ pronto: 0, bozza: 1, emesso: 2 })[b.stato] || b.id - a.id), [pos]);

  const elenco = (
    <Scheda>
      <div className="pt-4">
        <Schede
          voci={[
            { k: 'pos', t: 'POS', n: pos?.filter((p) => p.stato !== 'emesso').length },
            { k: 'pimus', t: 'PiMUS', n: pimus?.filter((p) => p.stato !== 'emesso').length },
          ]}
          attiva={vista}
          onCambia={setVista}
          etichetta="Tipo di documento"
        />
        <div className="mt-2">
          {err ? (
            <Errore testo={err} onRiprova={ricarica} />
          ) : !pos || !pimus ? (
            <Caricamento />
          ) : vista === 'pos' ? (
            ordinati.length === 0 ? (
              <p className="py-4 text-[14px] text-ink-muted">Nessun POS. Chiedi al Falco di aprire un cantiere e comporre il POS.</p>
            ) : (
              ordinati.map((p) => {
                const c = p.cantiereId ? cantieri[p.cantiereId] : undefined;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => scegli({ tipo: 'pos', id: p.id })}
                    aria-current={aperto?.tipo === 'pos' && aperto.id === p.id ? 'true' : undefined}
                    className={clsx('flex min-h-[64px] w-full items-center gap-3 rounded-[0.875rem] px-2.5 py-2 text-left', aperto?.tipo === 'pos' && aperto.id === p.id ? 'bg-perla-velo' : 'hover:bg-perla-velo/70')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-snug text-ink">{c?.denominazione ?? `Cantiere ${p.cantiereId ?? ''}`}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
                        {nomeAz(p.aziendaId)}
                        {c?.inizio ? ` · dal ${dataIt(c.inizio)}` : ''}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Chip stato={STATO_POS[p.stato].chip}>{STATO_POS[p.stato].testo}</Chip>
                      {p.stato !== 'emesso' && p.bloccanti > 0 && <span className="text-[12px] text-[#d63d3e]">{p.bloccanti} blocchi</span>}
                    </span>
                  </button>
                );
              })
            )
          ) : pimus.length === 0 ? (
            <p className="py-4 text-[14px] text-ink-muted">Nessun PiMUS. Chiedi al Falco di prepararlo per il ponteggio del cantiere.</p>
          ) : (
            pimus.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => scegli({ tipo: 'pimus', id: p.id })}
                className={clsx('flex min-h-[64px] w-full items-center gap-3 rounded-[0.875rem] px-2.5 py-2 text-left', aperto?.tipo === 'pimus' && aperto.id === p.id ? 'bg-perla-velo' : 'hover:bg-perla-velo/70')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium leading-snug text-ink">{p.titolo ?? 'PiMUS'}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">{nomeAz(p.aziendaId)}</span>
                </span>
                <Chip stato={p.stato === 'emesso' ? 'ok' : 'neutral'}>{p.stato === 'emesso' ? 'Emesso' : 'Bozza'}</Chip>
              </button>
            ))
          )}
        </div>
      </div>
    </Scheda>
  );

  const centro = voceAperta ? (
    <DettaglioPos key={voceAperta.id} voce={voceAperta} cantiere={voceAperta.cantiereId ? cantieri[voceAperta.cantiereId] : undefined} azienda={nomeAz(voceAperta.aziendaId)} onCambiato={ricarica} onAvviso={setAvviso} />
  ) : pimusAperto ? (
    <DettaglioPimus key={pimusAperto.id} voce={pimusAperto} azienda={nomeAz(pimusAperto.aziendaId)} onCambiato={ricarica} onAvviso={setAvviso} />
  ) : (
    <Vuoto titolo="Scegli un POS o un PiMUS">
      Vedi i controlli dei dati dell&apos;impresa, del cantiere e della libreria, risolvi i blocchi con il Falco e, quando è tutto in ordine, il titolare lo emette.
    </Vuoto>
  );

  return (
    <div className="space-y-5">
      <Testata categoria="servizi" icona={Casco} sopra={aziendaScelta?.ragione_sociale ?? "Sicurezza"} titolo="POS e PiMUS" sotto="Composti dai dati dell'impresa, del cantiere e dalla libreria delle schede. Il tecnico controlla, il titolare emette." />
      <Notizia testo={avviso} />
      <div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className={clsx('min-w-0', aperto ? 'hidden xl:block' : '')}>{elenco}</div>
        <div className={clsx('min-w-0', !aperto ? 'hidden xl:block' : 'space-y-3')}>
          {aperto && (
            <button type="button" onClick={() => scegli(null)} className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px] xl:hidden">
              <Indietro size={15} aria-hidden /> Tutti i {aperto.tipo === 'pos' ? 'POS' : 'PiMUS'}
            </button>
          )}
          {centro}
        </div>
      </div>
      {!puoRedigere(user.role) && <p className="text-[13px] text-ink-muted">Con il tuo ruolo vedi i POS in sola lettura.</p>}
      <p className="text-center text-[12.5px] text-ink-muted">Documenti preparati con assistenza AI: la validità è subordinata alla verifica e alla sottoscrizione delle figure competenti.</p>
    </div>
  );
}

function DettaglioPos({ voce, cantiere, azienda, onCambiato, onAvviso }: { voce: PosVoce; cantiere?: CantiereBreve; azienda: string; onCambiato: () => void; onAvviso: (t: string) => void }) {
  const { user, chiedi } = usePortale();
  const [seg, setSeg] = useState<Segnalazione[] | null>(null);
  const [puo, setPuo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);
  const [scheda, setScheda] = useState<'controlli' | 'qualita'>('controlli');
  const redige = puoRedigere(user.role);

  const controlla = useCallback(async (accetta: Array<{ chiave: string; motivo: string }> = []) => {
    try {
      const r = await controllaPos(voce.id, accetta);
      setSeg(r.segnalazioni);
      setPuo(r.puoEmettere);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Controlli non riusciti.');
      setSeg([]);
    }
  }, [voce.id]);

  useEffect(() => {
    if (redige) void controlla();
    else setSeg([]);
  }, [controlla, redige]);

  const esegui = async (k: string, fn: () => Promise<void>, ok: string) => {
    setLavoro(k);
    setErr(null);
    try {
      await fn();
      onAvviso(ok);
      onCambiato();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setLavoro(null);
    }
  };

  const nome = (f: 'pdf' | 'docx') => `POS_${azienda.replace(/[^A-Za-z0-9]+/g, '-')}_${voce.revisione > 0 ? `rev${voce.revisione}` : 'bozza'}.${f}`;
  const vocePerQualita: VoceDocumento = { chiave: `pos:${voce.id}`, gruppo: 'pos', id: voce.id, tipo: 'pos', etichetta: 'POS', titolo: null, stato: 'bozza', statoOriginale: voce.stato, revisione: voce.revisione, versione: null, emessoIl: voce.emessoIl, aggiornatoIl: voce.aggiornatoIl, perche: [], bloccanti: voce.bloccanti, generazione: null, cantiereId: voce.cantiereId };

  return (
    <div className="space-y-4">
      <Scheda>
        <div className="pt-4">
          <p className="text-[13px] text-ink-muted">{azienda}</p>
          <h2 className="mt-0.5 text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink">POS · {cantiere?.denominazione ?? 'cantiere'}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip stato={STATO_POS[voce.stato].chip}>{STATO_POS[voce.stato].testo}</Chip>
            {voce.revisione > 0 && <Chip stato="neutral">Revisione {voce.revisione}</Chip>}
            <Chip stato="neutral">{voce.fasi === 1 ? '1 fase' : `${voce.fasi} fasi`}</Chip>
          </div>
          {cantiere && (
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
              {cantiere.indirizzo && (
                <div>
                  <dt className="text-[12.5px] text-ink-muted">Indirizzo</dt>
                  <dd className="text-ink">{cantiere.indirizzo}</dd>
                </div>
              )}
              {cantiere.committente && (
                <div>
                  <dt className="text-[12.5px] text-ink-muted">Committente</dt>
                  <dd className="text-ink">{cantiere.committente}</dd>
                </div>
              )}
              {(cantiere.inizio || cantiere.fine) && (
                <div>
                  <dt className="text-[12.5px] text-ink-muted">Lavori</dt>
                  <dd className="text-ink">
                    {cantiere.inizio ? `dal ${dataIt(cantiere.inizio)}` : ''} {cantiere.fine ? `al ${dataIt(cantiere.fine)}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {cantiere && redige && <ChiediPsc cantiereId={cantiere.id} haPsc={!!cantiere.haPsc} />}
          <div className="mt-4 flex flex-wrap gap-2">
            {redige && voce.stato === 'bozza' && (
              <button type="button" className="btn-primary" disabled={!puo || lavoro !== null} onClick={() => void esegui('pronto', () => posPronto(voce.id), 'POS pronto: lo emette il titolare.')}>
                {lavoro === 'pronto' && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
                Segna pronto
              </button>
            )}
            {puoEmettere(user.role) && voce.stato === 'pronto' && (
              <button type="button" className="btn-acido" disabled={lavoro !== null} onClick={() => setConferma(true)}>
                Emetti il POS
              </button>
            )}
            {redige && voce.stato !== 'emesso' && (
              <button type="button" className="btn-ghost" disabled={lavoro !== null} onClick={() => void esegui('bozza', () => posAnteprima(voce.id), 'Bozza Word e PDF preparata: puoi scaricarla.')}>
                {lavoro === 'bozza' && <Rotore size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />}
                Prepara la bozza
              </button>
            )}
            <Scaricamenti gruppo="pos" id={voce.id} nome={nome} onErrore={setErr} />
          </div>
          {redige && voce.stato === 'bozza' && !puo && seg !== null && <p className="mt-3 text-[13px] text-ink-muted">Si segna pronto quando non restano blocchi e ogni avviso è risolto o accettato con un motivo.</p>}
        </div>
      </Scheda>
      {err && <Errore testo={err} onRiprova={() => setErr(null)} />}
      <Schede voci={[{ k: 'controlli', t: 'Controlli', n: seg?.filter((s) => !s.accettata).length }, { k: 'qualita', t: 'Qualità' }]} attiva={scheda} onCambia={setScheda} etichetta="Parti del POS" />
      <Scheda>
        <div className="pt-4">
          {scheda === 'controlli' ? (
            seg === null ? (
              <Caricamento testo="Lancio i controlli" />
            ) : !redige ? (
              <p className="text-[14px] text-ink-muted">I controlli li vede il tecnico.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" onClick={() => void controlla()}>
                    Rilancia i controlli
                  </button>
                  <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3.5 text-[13px]" onClick={() => chiedi(`Prendi i blocchi del POS ${voce.id} uno alla volta: dimmi cosa serve (attestato, consegna DPI, dato del cantiere) e registralo con me.`)}>
                    Risolvi i blocchi con il Falco
                  </button>
                </div>
                <Segnalazioni voci={seg} puoAccettare={voce.stato !== 'emesso'} onAccetta={(chiave, motivo) => controlla([{ chiave, motivo }]).then(() => onAvviso('Avviso accettato e registrato.'))} onChiedi={chiedi} />
              </>
            )
          ) : (
            <PannelloQualita voce={vocePerQualita} versione={0} onChiedi={chiedi} />
          )}
        </div>
      </Scheda>
      <FoglioConferma
        aperto={conferma}
        titolo="Emetti il POS"
        spiega={<p>Nasce la revisione {voce.revisione + 1} del POS, immutabile, in Word e PDF con il verbale di consegna dei dispositivi e la pagina delle firme. Va nella cartella del cantiere dell&apos;impresa.</p>}
        spunta={`Ho controllato il POS e lo emetto come titolare dello studio (${user.name}).`}
        azione="Emetti"
        onChiudi={() => setConferma(false)}
        onConferma={async () => {
          await posEmetti(voce.id);
          onAvviso('POS emesso.');
          onCambiato();
        }}
      />
    </div>
  );
}

function DettaglioPimus({ voce, azienda, onCambiato, onAvviso }: { voce: PimusVoce; azienda: string; onCambiato: () => void; onAvviso: (t: string) => void }) {
  const { user, chiedi } = usePortale();
  const [seg, setSeg] = useState<Segnalazione[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);
  const [scheda, setScheda] = useState<'controlli' | 'qualita'>('controlli');
  useEffect(() => {
    controlliDocumento(voce.id)
      .then(setSeg)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Controlli non disponibili.'));
  }, [voce.id]);
  const docVoce: VoceDocumento = { chiave: `documento:${voce.id}`, gruppo: 'documento', id: voce.id, tipo: 'pimus', etichetta: 'PiMUS', titolo: voce.titolo, stato: voce.stato === 'emesso' ? 'emesso' : 'bozza', statoOriginale: voce.stato, revisione: voce.revisione, versione: null, emessoIl: null, aggiornatoIl: null, perche: [], bloccanti: voce.bloccanti, generazione: null, cantiereId: voce.cantiereId };
  const aperte = seg?.filter((s) => !s.accettata).length ?? 0;
  return (
    <div className="space-y-4">
      <Scheda>
        <div className="pt-4">
          <p className="text-[13px] text-ink-muted">{azienda}</p>
          <h2 className="mt-0.5 text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink">{voce.titolo ?? 'PiMUS'}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip stato={voce.stato === 'emesso' ? 'ok' : 'neutral'}>{voce.stato === 'emesso' ? 'Emesso' : 'Bozza'}</Chip>
            {voce.revisione > 0 && <Chip stato="neutral">Revisione {voce.revisione}</Chip>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {puoEmettere(user.role) && voce.stato !== 'emesso' && (
              <button type="button" className="btn-acido" disabled={aperte > 0} onClick={() => setConferma(true)}>
                Emetti il PiMUS
              </button>
            )}
            <Scaricamenti gruppo="documento" id={voce.id} nome={(f) => `PiMUS_${azienda.replace(/[^A-Za-z0-9]+/g, '-')}_${voce.revisione > 0 ? `rev${voce.revisione}` : 'bozza'}.${f}`} onErrore={setErr} />
          </div>
          {puoEmettere(user.role) && voce.stato !== 'emesso' && aperte > 0 && <p className="mt-3 text-[13px] text-ink-muted">Si emette quando non restano segnalazioni aperte.</p>}
        </div>
      </Scheda>
      {err && <Errore testo={err} />}
      <Schede voci={[{ k: 'controlli', t: 'Controlli', n: aperte }, { k: 'qualita', t: 'Qualità' }]} attiva={scheda} onCambia={setScheda} etichetta="Parti del PiMUS" />
      <Scheda>
        <div className="pt-4">{scheda === 'controlli' ? seg === null ? <Caricamento testo="Lancio i controlli" /> : <Segnalazioni voci={seg} puoAccettare={false} onChiedi={chiedi} /> : <PannelloQualita voce={docVoce} versione={0} onChiedi={chiedi} />}</div>
      </Scheda>
      <FoglioConferma
        aperto={conferma}
        titolo="Emetti il PiMUS"
        spiega={<p>Nasce la revisione {voce.revisione + 1} del PiMUS, immutabile, in Word e PDF con lo schema del ponteggio. Ogni modifica successiva sarà una nuova revisione.</p>}
        spunta={`Ho controllato il PiMUS e lo emetto come titolare dello studio (${user.name}).`}
        azione="Emetti"
        onChiudi={() => setConferma(false)}
        onConferma={async () => {
          await emetti('documento', voce.id);
          onAvviso('PiMUS emesso.');
          onCambiato();
        }}
      />
    </div>
  );
}
