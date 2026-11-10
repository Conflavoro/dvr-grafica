'use client';

import Link from 'next/link';

/**
 * Dipendenti (04): sotto schede "Nuovi assunti e regolarizzazioni" e "Organico
 * su tre fonti", fogli "Carica un elenco" (piu' file, 09) e "Regolarizza il
 * lavoratore", e il calcolo di rischio e visita del modulo del nuovo assunto
 * (il cliente non sceglie mai rischio ne' visita: risponde a domande si' o no).
 */

import { useEffect, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Chip, Foglio, Scheda, Vuoto, dataIt } from '../../kit';
import type { Persone as DatiPersone } from '@/lib/portale/area-api';
import { aggiungiDaElenco, leggiElenchi, regolarizza, valutaAssunto, type PropostaElenco, type Valutazione } from '@/lib/portale/area-operativita';
import { Avviso, Fatto } from './comuni';

const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

// ---------------------------------------------------------------- rischio e visita calcolati

export function CalcoloAssunto({
  aziendaId,
  mansione,
  reparto,
  risposte,
  onRisposte,
  onValutazione,
}: {
  aziendaId: number;
  mansione: string;
  reparto: string;
  risposte: Record<string, boolean>;
  onRisposte: (r: Record<string, boolean>) => void;
  onValutazione: (v: Valutazione | null) => void;
}) {
  const [v, setV] = useState<Valutazione | null>(null);
  const chiave = `${mansione}|${reparto}|${JSON.stringify(risposte)}`;
  useEffect(() => {
    if (mansione.trim().length < 3) {
      setV(null);
      onValutazione(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      valutaAssunto(aziendaId, { mansione: mansione.trim(), reparto: reparto.trim() || null, risposte })
        .then((x) => {
          if (!vivo) return;
          setV(x);
          onValutazione(x);
        })
        .catch(() => vivo && setV(null));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aziendaId, chiave]);
  if (!v) return <p className="text-[13px] text-ink-muted sm:col-span-2">Scegli mansione e reparto: rischio e visita si calcolano da soli.</p>;
  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1rem] bg-perla-velo p-4">
          <p className="text-[13px] text-ink-muted">Livello di rischio</p>
          <p className="text-[18px] font-medium capitalize text-ink">{v.rischio}</p>
          {v.motivoRischio && <p className="text-[12.5px] text-ink-muted">{v.motivoRischio}</p>}
        </div>
        <div className="rounded-[1rem] bg-perla-velo p-4">
          <p className="text-[13px] text-ink-muted">Visita medica</p>
          <p className="text-[18px] font-medium text-ink">{v.daCalcolare ? 'Da calcolare' : v.visita ? 'Serve' : 'Non serve'}</p>
          <p className="text-[12.5px] text-ink-muted">{v.motivo}</p>
        </div>
      </div>
      {v.domande.length > 0 && (
        <fieldset className="space-y-2">
          {v.domande.map((d) => (
            <div key={d.chiave} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] text-ink">{d.testo}</span>
              <span role="radiogroup" aria-label={d.testo} className="flex gap-1">
                {[
                  [false, 'No'],
                  [true, 'Sì'],
                ].map(([val, t]) => (
                  <button
                    key={String(t)}
                    type="button"
                    role="radio"
                    aria-checked={(risposte[d.chiave] ?? false) === val}
                    onClick={() => onRisposte({ ...risposte, [d.chiave]: val as boolean })}
                    className={clsx('h-10 rounded-full px-4 text-[13.5px] font-medium', (risposte[d.chiave] ?? false) === val ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink')}
                  >
                    {t as string}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </fieldset>
      )}
      {v.quota !== null && (
        <div className="rounded-[1.25rem] bg-grafite-900 p-5 text-white">
          <p className="text-[13px] text-grafite-400">Quota d’ingresso, una volta sola</p>
          <p className="cifre text-[44px] font-light leading-tight text-acido-400">
            {euro(v.quota)}
            <span className="text-[20px]"> €</span>
          </p>
          <p className="text-[13px] text-grafite-400">
            Rischio {v.rischio}, {v.visita ? 'con' : 'senza'} visita · comprende formazione obbligatoria{v.visita ? ' e visita preventiva' : ''}
          </p>
          <p className="mt-2 text-[13px] text-white">Nessun canone fino al rinnovo</p>
          <table className="mt-3 w-full text-center text-[12.5px]">
            <thead>
              <tr className="text-grafite-400">
                <th />
                <th>Basso</th>
                <th>Medio</th>
                <th>Alto</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Senza visita', v.quote.senzaVisita, false],
                  ['Con visita', v.quote.conVisita, true],
                ] as const
              ).map(([t, q, cv]) => (
                <tr key={t}>
                  <td className="py-1 text-left text-grafite-400">{t}</td>
                  {['basso', 'medio', 'alto'].map((r) => (
                    <td key={r} className="py-1">
                      <span className={clsx('cifre inline-block rounded-full px-2', v.rischio === r && v.visita === cv && 'bg-acido-400 text-acido-950')}>{q[r] ?? 'n.d.'}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- nuovi assunti e regolarizzazioni

const TESTI_PASSO: Record<string, [string, string, string?]> = {
  unilav: ['Comunicazione di assunzione ricevuta', 'UniLav caricato, dati del lavoratore registrati'],
  quota: ['Quota d’ingresso pagata', 'Corso e visita confermati', 'Paga la quota d’ingresso'],
  formazione: ['Formazione generale e specifica', ''],
  visita: ['Visita preventiva', ''],
  link: ['Link personale e promemoria WhatsApp', ''],
};

function testoPasso(p: DatiPersone['nuovi'][number]['passi'][number]): string {
  if (p.k === 'unilav') return TESTI_PASSO.unilav[1];
  if (p.k === 'quota') return p.fatto ? 'Corso e visita confermati' : 'La trovi anche in "Da fare adesso" nella dashboard';
  if (p.k === 'link') return p.cellulare ? `Inviati al ${p.cellulare}, in ${p.lingua === 'it' || !p.lingua ? 'italiano' : p.lingua}` : 'Da inviare: manca il cellulare del lavoratore';
  if (p.stato === 'prenotato' && p.quando) return `${dataIt(p.quando.slice(0, 10))}, ore ${new Date(p.quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  if (p.stato === 'tenuto') return 'Prenotata dalla segreteria, tenuta finché la quota non è pagata';
  if (p.stato === 'fatto') return 'Fatto';
  return p.k === 'visita' ? 'La segreteria sta prenotando la visita' : 'La segreteria sta prenotando la classe';
}

export function SchedaNuovi({ dati, aziendaId, onApri, onAssumi, onFatto }: { dati: DatiPersone; aziendaId: number; onApri: (id: number) => void; onAssumi: () => void; onFatto: () => void }) {
  const [regola, setRegola] = useState<DatiPersone['regolarizzazioni'][number] | null>(null);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[20px] font-medium text-ink">Nuovi assunti</h2>
          <p className="text-[13px] text-ink-muted">La quota d’ingresso si paga una volta; il canone parte dal rinnovo</p>
        </div>
        {dati.nuovi.length === 0 ? (
          <Vuoto
            titolo="Nessun nuovo assunto in avvio"
            azione={
              dati.permessi.assumi ? (
                <button type="button" className="btn-primary" onClick={onAssumi}>
                  Comunica un nuovo assunto
                </button>
              ) : undefined
            }
          >
            Quando comunichi un’assunzione la segui da qui, passo per passo.
          </Vuoto>
        ) : (
          dati.nuovi.map((n) => (
            <div key={n.id} className="rounded-[1.5rem] p-5 ring-1 ring-inset ring-perla-linea">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <button type="button" className="text-[20px] font-medium text-ink hover:underline" onClick={() => onApri(n.id)}>
                    {n.nome}
                  </button>
                  <p className="text-[13px] text-ink-muted">
                    {[n.mansione, n.reparto, n.assuntoIl ? `assunto il ${dataIt(n.assuntoIl)}` : null, n.contratto].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[14rem_1fr]">
                <div>
                  <p className="text-[13px] text-ink-muted">Quota d’ingresso</p>
                  <p className="cifre text-[34px] font-light text-ink">{euro(n.quota.importo)} €</p>
                  <p className="text-[12.5px] text-ink-muted">
                    Rischio {n.quota.rischio}, {n.quota.conVisita ? 'con' : 'senza'} visita · nessun canone fino al rinnovo
                  </p>
                  {!n.quota.pagata && dati.permessi.richiedi && (
                    <Link href="/azienda/dashboard/" className="btn-primary mt-2 min-h-[40px] px-3">
                      Paga la quota
                    </Link>
                  )}
                </div>
                <ol className="space-y-2.5">
                  {n.passi.map((p, i) => {
                    const fatto = p.fatto || p.stato === 'prenotato' || p.stato === 'fatto';
                    return (
                      <li key={p.k} className="flex gap-3">
                        <span className={clsx('cifre grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px]', fatto ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink')}>{i + 1}</span>
                        <span className="text-[14px] text-ink">
                          {p.k === 'quota' && !p.fatto ? TESTI_PASSO.quota[2] : TESTI_PASSO[p.k]?.[0]}
                          <span className="block text-[12.5px] text-ink-muted">{testoPasso(p)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ))
        )}
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-[20px] font-medium text-ink">Regolarizzazioni</h2>
          <p className="text-[13px] text-ink-muted">Lavoratori che risultano nelle denunce EBIASP ma non nell’elenco dichiarato</p>
        </div>
        {dati.regolarizzazioni.length === 0 ? (
          <Vuoto titolo="Nessuna differenza tra le fonti">L’elenco dichiarato coincide con le denunce EBIASP.</Vuoto>
        ) : (
          dati.regolarizzazioni.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-[1.25rem] p-4 ring-1 ring-inset ring-perla-linea">
              <span className="min-w-0 flex-1">
                <button type="button" className="text-[16px] font-medium text-ink hover:underline" onClick={() => onApri(r.id)}>
                  {r.nome}
                </button>
                <span className="block text-[13px] text-ink-muted">
                  {r.mansione}
                  {r.dal ? ` · nelle denunce EBIASP dal ${dataIt(r.dal)}` : ''}
                  {r.regolarizzatoIl ? ` · dichiarato il ${dataIt(r.regolarizzatoIl)}` : ''}
                </span>
              </span>
              <span className="text-right">
                <span className="cifre block text-[24px] font-light text-ink">{euro(r.conguaglio)} €</span>
                <span className="block text-[12px] text-ink-muted">conguaglio = tariffa annua</span>
              </span>
              {r.regolarizzatoIl ? (
                <Chip stato="ok">Regolarizzato</Chip>
              ) : dati.permessi.modifica ? (
                <button type="button" className="btn-primary min-h-[40px] px-3" onClick={() => setRegola(r)}>
                  Regolarizza
                </button>
              ) : (
                <span className="text-[13px] text-ink-muted">Lo regolarizza il titolare</span>
              )}
            </div>
          ))
        )}
      </section>
      {regola && <FoglioRegolarizza aziendaId={aziendaId} r={regola} onChiudi={() => setRegola(null)} onFatto={onFatto} />}
    </div>
  );
}

export function FoglioRegolarizza({ aziendaId, r, onChiudi, onFatto }: { aziendaId: number; r: { id: number; nome: string; dal: string | null; conguaglio: number }; onChiudi: () => void; onFatto: () => void }) {
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const vai = async () => {
    setInvio(true);
    setErrore(null);
    try {
      setEsito((await regolarizza(aziendaId, r.id)).messaggio);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Regolarizzazione non riuscita.');
    } finally {
      setInvio(false);
    }
  };
  return (
    <Foglio
      aperto
      titolo="Regolarizza il lavoratore"
      onChiudi={onChiudi}
      piede={
        esito ? (
          <Link href="/azienda/dashboard/" className="btn-primary">
            Vai a Da fare adesso
          </Link>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-acido" disabled={invio} onClick={vai}>
              Dichiara e paga il conguaglio
            </button>
          </>
        )
      }
    >
      {esito ? (
        <Fatto titolo={esito}>Il conguaglio compare in "Da fare adesso": si paga dal foglio di pagamento.</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[14.5px] text-ink">
            {r.nome} compare nelle denunce EBIASP{r.dal ? ` dal ${dataIt(r.dal)}` : ''} ma non è nell’elenco che hai dichiarato. Dichiarandolo ora:
          </p>
          <div className="rounded-[1rem] bg-perla-velo p-4">
            <p className="text-[13px] text-ink-muted">Conguaglio</p>
            <p className="cifre text-[34px] font-light text-ink">{euro(r.conguaglio)} €</p>
          </div>
          <Avviso titolo="Perché conviene farlo subito">Per il canone vale il numero più alto tra le tre fonti. Regolarizza ora per evitare la maggiorazione al rinnovo.</Avviso>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- organico su tre fonti

export function SchedaOrganico({ o, nonDichiarati, onApri }: { o: NonNullable<DatiPersone['organico']>; nonDichiarati: DatiPersone['regolarizzazioni']; onApri: (id: number) => void }) {
  const fonti: Array<[typeof o.vale, number, string, string]> = [
    ['elenco', o.elenco, 'Elenco dichiarato', 'I lavoratori che hai comunicato nel portale'],
    ['ebiasp', o.ebiasp, 'Denunce EBIASP', 'Lavoratori per cui versi a EBIASP, elenco mensile'],
    ['visitati_formati', o.visitatiFormati, 'Visitati e formati', 'Lavoratori che hanno fatto visite o corsi con noi'],
  ];
  const aperti = nonDichiarati.filter((x) => !x.regolarizzatoIl);
  const diff = o.massimo - o.elenco;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {fonti.map(([k, n, t, d]) => (
          <div key={k} className={clsx('rounded-[1.5rem] p-5', o.vale === k ? 'bg-acido-400 text-acido-950' : 'ring-1 ring-inset ring-perla-linea')}>
            {o.vale === k && <span className="mb-2 inline-block rounded-full bg-grafite-900 px-2.5 py-0.5 text-[12px] font-medium text-acido-400">Vale questo</span>}
            <p className="cifre text-[44px] font-light leading-none">{n}</p>
            <p className="mt-2 text-[16px] font-medium">{t}</p>
            <p className="text-[13px] opacity-75">{d}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Scheda
          titolo={aperti.length > 0 ? `Da regolarizzare: ${aperti.length} ${aperti.length === 1 ? 'lavoratore' : 'lavoratori'}` : o.coincidono ? 'Le tre fonti coincidono' : `Differenza: ${diff} ${diff === 1 ? 'lavoratore' : 'lavoratori'}`}
        >
          {o.coincidono ? (
            <p className="text-[14px] text-ink-muted">Elenco, denunce EBIASP e lavoratori visitati e formati danno lo stesso numero. Non serve fare nulla.</p>
          ) : (
            <>
              <p className="text-[14px] text-ink-muted">
                Con numeri diversi vale il più alto: al rinnovo il canone si calcola su {o.massimo} lavoratori. Se un lavoratore manca dall’elenco, regolarizzalo: paghi il conguaglio e il conteggio torna allineato.
              </p>
              {aperti.length === 0 ? (
                <p className="mt-2 text-[14px] text-ink-muted">La differenza riguarda lavoratori cessati di recente: la segreteria la verifica con le prossime denunce.</p>
              ) : (
                <ul className="mt-2">
                  {aperti.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => onApri(x.id)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-perla-linea py-2 text-left last:border-b-0">
                        <span aria-hidden className="h-2 w-2 rounded-full bg-cat-persone-segno" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-ink">{x.nome}</span>
                          <span className="block text-[12.5px] text-ink-muted">
                            {x.mansione}
                            {x.dal ? ` · in EBIASP dal ${dataIt(x.dal)}` : ''} · conguaglio {euro(x.conguaglio)} €
                          </span>
                        </span>
                        <Chip stato="danger">Non dichiarato</Chip>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Scheda>
        <Scheda titolo="Come funziona la verifica">
          <ol className="space-y-3 text-[14px] text-ink">
            <li>
              <span className="font-medium">Ogni mese</span>
              <span className="block text-[13px] text-ink-muted">Confrontiamo l’elenco dichiarato con le denunce EBIASP e con i lavoratori visitati e formati.</span>
            </li>
            <li>
              <span className="font-medium">Con numeri diversi</span>
              <span className="block text-[13px] text-ink-muted">Vale il più alto: chi manca dall’elenco va regolarizzato con il conguaglio.</span>
            </li>
            <li>
              <span className="font-medium">Al rinnovo</span>
              <span className="block text-[13px] text-ink-muted">Il canone si calcola sul numero più alto tra le tre fonti.</span>
            </li>
          </ol>
        </Scheda>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- carica un elenco (piu' file)

export function FoglioElenco({ aziendaId, onChiudi, onFatto, onNuovi }: { aziendaId: number; onChiudi: () => void; onFatto: () => void; onNuovi: () => void }) {
  const [fase, setFase] = useState<'scelta' | 'lettura' | 'revisione' | 'fatto'>('scelta');
  const [proposte, setProposte] = useState<Array<PropostaElenco & { scelto: boolean }>>([]);
  const [nomi, setNomi] = useState<string>('');
  const [esito, setEsito] = useState<{ titolo: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const leggi = async (files: File[]) => {
    if (files.length === 0) return;
    setNomi(files.map((f) => f.name).join(', '));
    setFase('lettura');
    setErrore(null);
    try {
      const r = await leggiElenchi(aziendaId, files);
      setProposte(r.proposte.map((p) => ({ ...p, scelto: true })));
      const avvisi = [r.bloccati.length ? 'Documento sanitario bloccato e cancellato' : null, r.nonLetti.length ? `Non letti: ${r.nonLetti.join(', ')}. Carica un Excel o un CSV.` : null].filter(Boolean);
      if (avvisi.length) setErrore(avvisi.join(' · '));
      setFase('revisione');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Lettura non riuscita.');
      setFase('scelta');
    }
  };
  const scelti = proposte.filter((p) => p.scelto);
  const aggiungi = async () => {
    try {
      const r = await aggiungiDaElenco(aziendaId, scelti.map(({ scelto: _s, ...p }) => p));
      setEsito({ titolo: r.titolo, testo: r.testo + (r.errori.length ? ` Non aggiunti: ${r.errori.map((x) => `${x.nome} (${x.errore})`).join('; ')}` : '') });
      setFase('fatto');
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Aggiunta non riuscita.');
    }
  };
  return (
    <Foglio
      aperto
      largo={fase === 'revisione'}
      titolo={fase === 'revisione' ? (proposte.length ? `Trovati ${proposte.length} lavoratori nuovi` : 'Nessun lavoratore nuovo') : 'Carica un elenco'}
      onChiudi={onChiudi}
      piede={
        fase === 'revisione' && proposte.length > 0 ? (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-acido" disabled={scelti.length === 0} onClick={aggiungi}>
              {scelti.length === 0 ? 'Scegli almeno un lavoratore' : scelti.length === 1 ? 'Aggiungi 1 lavoratore' : `Aggiungi ${scelti.length} lavoratori`}
            </button>
          </>
        ) : fase === 'fatto' || (fase === 'revisione' && proposte.length === 0) ? (
          <>
            {fase === 'fatto' && (
              <button type="button" className="btn-ghost" onClick={() => (onChiudi(), onNuovi())}>
                Vedi i nuovi assunti
              </button>
            )}
            <button type="button" className="btn-primary" onClick={onChiudi}>
              Chiudi
            </button>
          </>
        ) : undefined
      }
    >
      {fase === 'scelta' && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-muted">Va bene qualsiasi file: Excel, PDF, Word o una foto. L’assistente lo legge e ti propone i lavoratori che non sono ancora nell’elenco. Prima di aggiungerli li controlli tu.</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[1.5rem] border-2 border-dashed border-perla-linea p-8 text-center hover:border-grafite-900">
            <span className="text-[16px] font-medium text-ink">Scegli il file</span>
            <span className="text-[13px] text-ink-muted">Excel, PDF, Word o foto</span>
            <input type="file" multiple className="sr-only" onChange={(e) => void leggi(Array.from(e.target.files ?? []))} />
          </label>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
      {fase === 'lettura' && (
        <div className="py-8 text-center">
          <p className="text-[16px] font-medium text-ink">{nomi}</p>
          <p className="mt-1 text-[13.5px] text-ink-muted">L’assistente sta leggendo i lavoratori…</p>
        </div>
      )}
      {fase === 'revisione' && (
        <div className="space-y-4">
          {errore && <Avviso tono="warn">{errore}</Avviso>}
          {proposte.length === 0 ? (
            <p className="text-[14px] text-ink-muted">Tutti i lavoratori di questo file sono già nell’elenco.</p>
          ) : (
            <>
              <p className="text-[13.5px] text-ink-muted">Togli la spunta a chi non va aggiunto e correggi la mansione se serve. Rischio e visita si calcolano dall’attività, dal reparto e dalla mansione.</p>
              <ul className="rounded-[1rem] ring-1 ring-inset ring-perla-linea">
                {proposte.map((p, i) => (
                  <li key={`${p.nome}-${p.cognome}`} className="flex flex-wrap items-center gap-3 border-b border-perla-linea px-4 py-3 last:border-b-0">
                    <input type="checkbox" aria-label={`Aggiungi ${p.nome} ${p.cognome}`} checked={p.scelto} onChange={() => setProposte((x) => x.map((y, j) => (j === i ? { ...y, scelto: !y.scelto } : y)))} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">
                        {p.nome} {p.cognome}
                      </span>
                      <span className="block text-[12.5px] text-ink-muted">{[p.reparto, p.cellulare].filter(Boolean).join(' · ')}</span>
                    </span>
                    <input className="input-field sm:w-56" aria-label="Mansione" value={p.mansione} onChange={(e) => setProposte((x) => x.map((y, j) => (j === i ? { ...y, mansione: e.target.value } : y)))} />
                  </li>
                ))}
              </ul>
              <p className="text-[12.5px] text-ink-muted">
                Come per ogni nuovo assunto: quota d’ingresso una volta sola, nessun canone fino al rinnovo. Per avviare corso e visita serve anche l’UniLav di ciascuno: te lo chiede la segreteria.
              </p>
            </>
          )}
        </div>
      )}
      {fase === 'fatto' && esito && <Fatto titolo={esito.titolo}>{esito.testo}</Fatto>}
    </Foglio>
  );
}
