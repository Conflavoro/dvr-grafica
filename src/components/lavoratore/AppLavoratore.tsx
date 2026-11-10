'use client';

import { percorso } from '@/lib/percorso';
import { useCallback, useEffect, useState } from 'react';
import { Allerta, Avviso, Casa, CerchioSpunta, Corso, Documento, Scarica, Scudo, Visita } from '@/components/icone';
import type { IconaComponente } from '@/components/icone';
import type { LinkLavoratore } from '@/lib/data-source';
import { Chip, Pastiglia, Scheda, Testata, Vuoto, dataIt, statoData, traGiorni } from '@/components/portale/kit';
import { etichettaStato } from '@/lib/portale/nearmiss-api';
import {
  dividiScadenze,
  mappaAppLavoratore,
  statoRicevute,
  urlDocumentoLavoratore,
  urlGiudizioLavoratore,
  type AppLavoratore as Dati,
  type MioNearMiss,
  type ScadenzaMia,
} from '@/lib/portale/lavoratore-api';
import type { Categoria } from '@/lib/portale/sezioni';
import { clsx } from '@/lib/clsx';
import { Appuntamento, giornoLungo } from './Appuntamento';
import { SegnalaNearMiss } from './SegnalaNearMiss';
import { AvatarFalco, FalcoLavoratore } from './FalcoLavoratore';

type Vista = 'home' | 'corsi' | 'visita' | 'documenti' | 'segnala';

const VISTE: Array<{
  k: Vista;
  t: string;
  icona: IconaComponente;
  categoria: Categoria;
}> = [
  { k: 'home', t: 'Home', icona: Casa, categoria: 'home' },
  { k: 'corsi', t: 'Corsi', icona: Corso, categoria: 'formazione' },
  { k: 'visita', t: 'Visita', icona: Visita, categoria: 'visite' },
  { k: 'documenti', t: 'Mansione', icona: Documento, categoria: 'documenti' },
  { k: 'segnala', t: 'Segnala', icona: Allerta, categoria: 'antincendio' },
];

const ICONA_SCADENZA: Record<ScadenzaMia['tipo'], { icona: IconaComponente; categoria: Categoria }> = {
  corso: { icona: Corso, categoria: 'formazione' },
  visita: { icona: Visita, categoria: 'visite' },
  dpi: { icona: Scudo, categoria: 'servizi' },
};

const LIVELLO: Record<string, 'danger' | 'warn' | 'ok' | 'neutral'> = {
  'molto alto': 'danger',
  alto: 'danger',
  medio: 'warn',
  basso: 'ok',
};

function RigaScadenza({ s }: { s: ScadenzaMia }) {
  const st = statoData(s.data) ?? 'ok';
  const ic = ICONA_SCADENZA[s.tipo];
  return (
    <li className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
      <Pastiglia categoria={ic.categoria} icona={ic.icona} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-ink">{s.cosa}</span>
        <span className="block text-[13px] text-ink-muted">
          {dataIt(s.data)}, {traGiorni(s.data)}
        </span>
      </span>
      <Chip stato={st} />
    </li>
  );
}

function StatoSegnalazione({ n }: { n: MioNearMiss }) {
  return (
    <li className="flex min-h-[60px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
      <Pastiglia categoria="antincendio" icona={Allerta} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{n.descrizione}</span>
        <span className="block text-[13px] text-ink-muted">
          {n.codice}
          {n.anonima ? ', anonima' : ''}
          {n.ricevutaIl ? `, inviata il ${dataIt(n.ricevutaIl)}` : ''}
        </span>
      </span>
      <Chip stato={n.stato === 'chiusa' ? 'ok' : n.stato === 'ricevuta' ? 'todo' : 'run'}>{etichettaStato(n.stato)}</Chip>
    </li>
  );
}

export function AppLavoratore({ token, v, onAggiornato, onRicarica }: { token: string; v: LinkLavoratore; onAggiornato: (v: LinkLavoratore) => void; onRicarica: () => void }) {
  const d: Dati = mappaAppLavoratore(v);
  const [vista, setVista] = useState<Vista>('home');
  const [falco, setFalco] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(v.messaggio ?? null);
  const [inviata, setInviata] = useState<{
    messaggio: string;
    ricevuta: string | null;
  } | null>(null);
  const [anonime, setAnonime] = useState<MioNearMiss[]>([]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('v');
      if (VISTE.some((x) => x.k === q)) setVista(q as Vista);
    } catch {
      /* comodita' */
    }
  }, []);

  const caricaAnonime = useCallback(() => {
    statoRicevute(token)
      .then((l) => setAnonime(l.map((x) => ({ ...x, anonima: true }))))
      .catch(() => setAnonime([]));
  }, [token]);
  useEffect(caricaAnonime, [caricaAnonime]);

  const vai = (k: Vista) => {
    setVista(k);
    setInviata(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('v', k);
      window.history.replaceState(null, '', u.toString());
      window.scrollTo({ top: 0 });
    } catch {
      /* comodita' */
    }
  };

  const aggiornato = (n: LinkLavoratore) => {
    onAggiornato(n);
    setAvviso(n.messaggio ?? null);
  };

  const sc = dividiScadenze(d.scadenze);
  const segnalazioni = [...d.nearMiss, ...anonime.filter((a) => !d.nearMiss.some((m) => m.id === a.id))].sort((a, b) => b.id - a.id);
  const corrente = VISTE.find((x) => x.k === vista)!;

  return (
    <div className="min-h-[100dvh] bg-white">
      <div
        className="mx-auto w-full max-w-[640px] px-4 pt-4"
        style={{
          paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <header className="flex items-center justify-between gap-3 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro" className="h-7 w-auto" />
          <span className="text-[12.5px] font-medium text-ink-muted">Sicurezza sul lavoro</span>
        </header>

        {vista === 'home' ? (
          <div>
            <p className="text-[14px] text-ink-muted first-letter:uppercase">
              {new Date().toLocaleDateString('it-IT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="mt-1 text-[32px] font-medium leading-tight tracking-[-0.03em] text-ink">Ciao {v.lavoratore.nome}</h1>
            <p className="mt-1 text-[15px] text-ink-soft">{[v.azienda, v.lavoratore.mansione].filter(Boolean).join(', ')}</p>
          </div>
        ) : (
          <Testata
            categoria={corrente.categoria}
            icona={corrente.icona}
            sopra={v.azienda ?? undefined}
            titolo={vista === 'documenti' ? 'La mia mansione' : vista === 'segnala' ? 'Segnala un pericolo' : vista === 'corsi' ? 'I miei corsi' : 'La mia visita'}
          />
        )}

        {avviso && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-[1rem] bg-stato-ok px-3.5 py-3 text-[14px] text-stato-ok-ink">
            <CerchioSpunta size={18} aria-hidden className="mt-0.5 shrink-0" />
            {avviso}
          </p>
        )}

        <div className="mt-5 space-y-4">
          {vista === 'home' && (
            <>
              {v.appuntamenti.length > 0 && (
                <section aria-labelledby="h-app">
                  <h2 id="h-app" className="mb-2 text-[18px] font-medium tracking-[-0.01em] text-ink">
                    I tuoi appuntamenti
                  </h2>
                  <ul className="space-y-3">
                    {v.appuntamenti.map((a) => (
                      <Appuntamento key={a.id} a={a} token={token} onAggiornato={aggiornato} />
                    ))}
                  </ul>
                </section>
              )}

              <button type="button" onClick={() => vai('segnala')} className="premi flex w-full items-center gap-4 rounded-[1.75rem] bg-oro-500 p-5 text-left text-acido-950">
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/70">
                  <Allerta size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-medium leading-tight">Hai visto un pericolo?</span>
                  <span className="block text-[13.5px] opacity-80">Segnala un quasi incidente, anche in forma anonima.</span>
                </span>
              </button>

              <Scheda
                titolo="Le mie scadenze"
                sotto={
                  sc.scadute.length + sc.vicine.length > 0 ? `${sc.scadute.length + sc.vicine.length} da guardare entro 30 giorni` : 'Niente in scadenza nei prossimi 30 giorni'
                }
              >
                {d.scadenze.length === 0 ? (
                  <p className="py-2 text-[14px] text-ink-muted">Nessuna scadenza registrata per te.</p>
                ) : (
                  <ul>
                    {[...sc.scadute, ...sc.vicine, ...sc.lontane].slice(0, 8).map((s, i) => (
                      <RigaScadenza key={`${s.tipo}-${s.cosa}-${i}`} s={s} />
                    ))}
                  </ul>
                )}
              </Scheda>

              {v.da_fissare.length > 0 && (
                <Scheda titolo="Da fissare" sotto="La segreteria ti contatta per la data.">
                  <ul>
                    {v.da_fissare.map((x) => (
                      <li key={x.id} className="border-b border-perla-linea py-3 text-[15px] text-ink last:border-b-0">
                        {x.cosa}
                        {x.entro && <span className="block text-[13px] text-ink-muted">entro il {dataIt(x.entro)}</span>}
                      </li>
                    ))}
                  </ul>
                </Scheda>
              )}

              {segnalazioni.length > 0 && (
                <Scheda titolo="Le mie segnalazioni" sotto="Vedi solo a che punto sono: l’analisi la fa il tecnico.">
                  <ul>
                    {segnalazioni.map((n) => (
                      <StatoSegnalazione key={n.id} n={n} />
                    ))}
                  </ul>
                </Scheda>
              )}
            </>
          )}

          {vista === 'corsi' &&
            (d.corsi.length === 0 ? (
              <Vuoto titolo="Ancora nessun attestato">Quando finisci un corso, l’attestato compare qui con la sua scadenza.</Vuoto>
            ) : (
              <Scheda titolo="Attestati">
                <ul>
                  {d.corsi.map((c, i) => (
                    <li key={`${c.corso}-${i}`} className="flex min-h-[64px] items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
                      <Pastiglia categoria="formazione" icona={Corso} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium leading-snug text-ink">{c.corso}</span>
                        <span className="block text-[13px] text-ink-muted">
                          {[c.conseguitoIl && `fatto il ${dataIt(c.conseguitoIl)}`, c.ore ? `${c.ore} ore` : null, c.ente].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      {c.scadeIl ? (
                        <Chip stato={statoData(c.scadeIl) ?? 'ok'}>{statoData(c.scadeIl) === 'danger' ? 'Da rifare' : `Fino al ${dataIt(c.scadeIl, true)}`}</Chip>
                      ) : (
                        <Chip stato="ok">Valido</Chip>
                      )}
                    </li>
                  ))}
                </ul>
              </Scheda>
            ))}

          {vista === 'visita' && (
            <>
              {d.visita.prossima ? (
                <Scheda titolo="Prossima visita">
                  <p className="cifre text-[30px] font-light leading-tight tracking-[-0.03em] text-ink">
                    <span className="inline-block first-letter:uppercase">{giornoLungo(d.visita.prossima.quando.slice(0, 10))}</span>
                    <span className="block">ore {d.visita.prossima.quando.slice(11, 16)}</span>
                  </p>
                  {d.visita.prossima.luogo && <p className="mt-2 text-[14.5px] text-ink-soft">{d.visita.prossima.luogo}</p>}
                  {d.visita.prossima.mapsUrl && (
                    <a href={d.visita.prossima.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 w-full">
                      Apri la posizione in Maps
                    </a>
                  )}
                  <p className="mt-3 text-[13px] text-ink-muted">Per confermare o spostare usa l’appuntamento nella Home.</p>
                </Scheda>
              ) : (
                <Vuoto titolo="Nessuna visita in calendario">Quando la segreteria prenota, ti arriva un messaggio con data e luogo.</Vuoto>
              )}
              <Scheda titolo="La mia idoneità" sotto="Qui trovi solo l’esito e la scadenza. Diagnosi ed esami restano al medico competente.">
                <dl className="divide-y divide-perla-linea">
                  <div className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                    <dt className="text-[14px] text-ink-muted">Esito</dt>
                    <dd className="text-right text-[15px] font-medium text-ink">{d.visita.esito ?? 'Non ancora registrato'}</dd>
                  </div>
                  <div className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                    <dt className="text-[14px] text-ink-muted">Ultima visita</dt>
                    <dd className="text-[15px] text-ink">{d.visita.ultima ? dataIt(d.visita.ultima) : 'Nessuna'}</dd>
                  </div>
                  <div className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                    <dt className="text-[14px] text-ink-muted">Valida fino al</dt>
                    <dd className="flex items-center gap-2 text-[15px] text-ink">
                      {d.visita.validaFinoAl ? (
                        <>
                          {dataIt(d.visita.validaFinoAl)} <Chip stato={statoData(d.visita.validaFinoAl) ?? 'ok'} />
                        </>
                      ) : (
                        'Non indicata'
                      )}
                    </dd>
                  </div>
                </dl>
                {d.visita.prescrizioni && (
                  <p className="mt-3 rounded-[1rem] bg-perla-velo px-4 py-3 text-[14.5px] leading-relaxed text-ink">
                    <span className="block text-[13px] text-ink-muted">Indicazioni del medico per il lavoro</span>
                    {d.visita.prescrizioni}
                  </p>
                )}
                {d.visita.giudizioId && (
                  <a href={urlGiudizioLavoratore(token, d.visita.giudizioId)} className="btn-ghost mt-3 w-full">
                    <Scarica size={16} aria-hidden /> Scarica il mio giudizio firmato
                  </a>
                )}
              </Scheda>
            </>
          )}

          {vista === 'documenti' && (
            <>
              {d.informativa ? (
                <Scheda
                  titolo={d.informativa.mansione}
                  sotto={`Dal DVR approvato, versione ${d.informativa.dvrVersione}${d.informativa.approvatoIl ? ` del ${dataIt(d.informativa.approvatoIl)}` : ''}`}
                >
                  {d.informativa.descrizione && <p className="mb-3 text-[14.5px] leading-relaxed text-ink-soft">{d.informativa.descrizione}</p>}
                  <h3 className="text-[15px] font-medium text-ink">I rischi del tuo lavoro</h3>
                  <ul className="mt-1">
                    {d.informativa.rischi.map((r, i) => (
                      <li key={`${r.categoria}-${i}`} className="border-b border-perla-linea py-3 last:border-b-0">
                        <p className="flex items-center justify-between gap-3">
                          <span className="text-[15px] font-medium text-ink">{r.categoria}</span>
                          {r.livello && <Chip stato={LIVELLO[r.livello.toLowerCase()] ?? 'neutral'}>{`Rischio ${r.livello}`}</Chip>}
                        </p>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{r.descrizione}</p>
                        {r.misure.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {r.misure.map((m) => (
                              <li key={m} className="flex items-start gap-2 text-[14px] leading-relaxed text-ink">
                                <CerchioSpunta size={16} aria-hidden className="mt-0.5 shrink-0 text-stato-ok-segno" />
                                {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                  {d.informativa.dpi.length > 0 && (
                    <>
                      <h3 className="mt-4 text-[15px] font-medium text-ink">I DPI previsti</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {d.informativa.dpi.map((x) => (
                          <li key={x} className="rounded-full bg-perla-velo px-3.5 py-2 text-[13.5px] text-ink">
                            {x}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Scheda>
              ) : (
                <Vuoto titolo="Informativa in preparazione">Quando il DVR della tua azienda è approvato, qui trovi i rischi della tua mansione e come proteggerti.</Vuoto>
              )}
              <Scheda titolo="DPI che ti sono stati consegnati">
                {d.dpi.length === 0 ? (
                  <p className="py-2 text-[14px] text-ink-muted">Nessuna consegna registrata.</p>
                ) : (
                  <ul>
                    {d.dpi.map((x, i) => (
                      <li key={`${x.descrizione}-${i}`} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                        <Pastiglia categoria="servizi" icona={Scudo} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] text-ink">{x.descrizione}</span>
                          <span className="block text-[13px] text-ink-muted">
                            {[x.consegnatoIl && `consegnato il ${dataIt(x.consegnatoIl)}`, x.norma].filter(Boolean).join(', ')}
                          </span>
                        </span>
                        {x.scadeIl && <Chip stato={statoData(x.scadeIl) ?? 'ok'}>{`Cambio ${dataIt(x.scadeIl, true)}`}</Chip>}
                      </li>
                    ))}
                  </ul>
                )}
              </Scheda>
              {d.documenti.length > 0 && (
                <Scheda titolo="Procedure e piano di emergenza">
                  <ul>
                    {d.documenti.map((x) => (
                      <li key={x.id}>
                        <a href={urlDocumentoLavoratore(token, x.id)} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
                          <Pastiglia categoria="documenti" icona={Documento} />
                          <span className="min-w-0 flex-1 text-[15px] text-ink">{x.titolo}</span>
                          <Scarica size={18} aria-hidden className="text-ink-muted" />
                          <span className="sr-only">Scarica il PDF</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Scheda>
              )}
            </>
          )}

          {vista === 'segnala' &&
            (inviata ? (
              <div className="space-y-4">
                <div className="rounded-[1.75rem] bg-black p-5 text-white">
                  <CerchioSpunta size={28} aria-hidden className="text-oro-500" />
                  <p className="mt-3 text-[22px] font-medium leading-tight">Segnalazione inviata</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-grafite-300">{inviata.messaggio}</p>
                </div>
                <button type="button" onClick={() => setInviata(null)} className="btn-ghost w-full">
                  Segnala un altro pericolo
                </button>
                <button type="button" onClick={() => vai('home')} className="btn-primary w-full">
                  Torna alla Home
                </button>
              </div>
            ) : (
              <>
                <p className="text-[14.5px] leading-relaxed text-ink-soft">
                  Un quasi incidente è un avvertimento: segnalarlo serve a evitare che la prossima volta qualcuno si faccia male.
                </p>
                <SegnalaNearMiss
                  token={token}
                  sedi={d.sedi}
                  onInviata={(_, messaggio, ricevuta) => {
                    setInviata({ messaggio, ricevuta });
                    caricaAnonime();
                    // La segnalazione con nome compare tra le mie.
                    onRicarica();
                  }}
                />
              </>
            ))}

          {(vista === 'home' || vista === 'visita') && (
            <>
              {v.numero_imprevisti && (
                <p className="text-[14.5px] leading-relaxed text-ink-soft">
                  Per un imprevisto chiama il{' '}
                  <a href={`tel:${v.numero_imprevisti.replace(/\s/g, '')}`} className="font-medium text-ink underline underline-offset-4">
                    {v.numero_imprevisti}
                  </a>
                  .
                </p>
              )}
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
                <Avviso size={16} aria-hidden className="mt-0.5 shrink-0" />
                {v.informativa}
              </p>
            </>
          )}
        </div>

        <footer className="mt-10 border-t border-perla-linea pt-4 text-[12px] leading-relaxed text-ink-subtle">
          Servizio sicurezza sul lavoro di Conflavoro, erogato da ISFOR Srl. Questo link è personale: non inoltrarlo.
        </footer>
      </div>

      <button
        type="button"
        onClick={() => setFalco(true)}
        aria-label="Chiedi al Falco"
        className="premi fixed right-4 z-40 rounded-full shadow-[0_10px_30px_-10px_rgba(14,14,16,0.6)]"
        style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <AvatarFalco size={56} acceso />
      </button>

      <nav
        aria-label="Menu"
        className="fixed inset-x-3 z-40 mx-auto flex max-w-[616px] items-center gap-1 rounded-full bg-black p-1.5"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {VISTE.map((x) => {
          const on = x.k === vista;
          const I = x.icona;
          return (
            <button
              key={x.k}
              type="button"
              onClick={() => vai(x.k)}
              aria-current={on ? 'page' : undefined}
              className={clsx('flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium', on ? 'bg-oro-500 text-acido-950' : 'text-white')}
            >
              <I size={19} aria-hidden />
              {on && <span className="truncate">{x.t}</span>}
              <span className="sr-only">{x.t}</span>
            </button>
          );
        })}
      </nav>

      <FalcoLavoratore token={token} aperto={falco} onChiudi={() => setFalco(false)} domande={d.domandeFalco} nome={v.lavoratore.nome} />
    </div>
  );
}
