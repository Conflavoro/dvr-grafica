'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avviso, Azienda, Documento, Persona, Scarica } from '@/components/icone';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Riquadro, Riga, Scheda, Schede, Testata, Vuoto, dataIt, statoData, traGiorni } from '../../kit';
import {
  ETICHETTE_TIPO_VISITA,
  apriGiudizio,
  dettaglioMedico,
  panoramicaMedico,
  registraGiudizio,
  validaFinoAl,
  type DettaglioMedico,
  type LavoratoreMedico,
  type PanoramicaMedico,
} from '@/lib/portale/medico-api';
import { trovaSezione } from '@/lib/portale/sezioni';
import { EsamiMedico } from './EsamiLavoratori';
import { clsx } from '@/lib/clsx';

const CAMPO =
  'block w-full rounded-[1rem] bg-white px-4 py-3 text-[15px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] placeholder:text-ink-subtle focus:outline-none focus:shadow-[inset_0_0_0_2px_#18181b]';
const PERIODO: Record<number, string> = {
  6: '6 mesi',
  12: '1 anno',
  24: '2 anni',
  60: '5 anni',
};
const oggi = () => new Date().toISOString().slice(0, 10);

/** Gestionale, Portali dei partner: portale del medico competente. */
export default function PortaleMedico() {
  const { user, versione, apri, aziendaScelta } = usePortale();
  // Staff dello studio con un cliente scelto: solo quell'azienda (il medico esterno vede le sue nomine).
  const azId = aziendaScelta?.id ?? null;
  const s = trovaSezione('gestionale', 'medico')!;
  const [dati, setDati] = useState<PanoramicaMedico | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aziendaId, setAziendaId] = useState<number | null>(null);

  const carica = useCallback(() => {
    setErr(null);
    panoramicaMedico()
      .then(setDati)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Portale non disponibile.'));
  }, []);
  useEffect(carica, [carica, versione]);

  const scegli = (id: number | null) => {
    setAziendaId(id);
    apri(null, id);
  };

  const aziendeVisibili = (dati?.aziende ?? []).filter((a) => !azId || a.id === azId);
  return (
    <div className="space-y-5">
      <Testata
        categoria={s.categoria}
        icona={s.icona}
        sopra={dati?.studio ? (aziendaScelta?.ragione_sociale ?? 'Portali dei partner') : user.name}
        titolo="Portale del medico"
        sotto={
          dati?.studio
            ? 'Le aziende con un medico competente nominato, in sola lettura.'
            : 'Portale riservato al medico competente: nell’app entrano solo date, tipo ed esito delle visite.'
        }
      />
      {err && <Errore testo={err} onRiprova={carica} />}
      {!dati && !err && <Caricamento />}
      {dati && (
        <>
          {!azId && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Riquadro etichetta="Aziende seguite" valore={dati.totali.aziende} />
            <Riquadro etichetta="Lavoratori in sorveglianza" valore={dati.totali.inSorveglianza} />
            <Riquadro etichetta="Visite entro 60 giorni" valore={dati.totali.entro60} tono={dati.totali.entro60 > 0 ? 'warn' : undefined} />
          </div>
          )}
          <p className="flex items-start gap-2 rounded-[1.25rem] bg-perla-velo px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft">
            <Avviso size={16} aria-hidden className="mt-0.5 shrink-0" />
            {dati.nota}
          </p>
          <Scheda titolo={dati.studio ? 'Aziende con medico nominato' : 'Le mie aziende'}>
            {aziendeVisibili.length === 0 ? (
              azId ? (
                <Vuoto titolo="Nessun medico nominato">Per questa azienda non c’è ancora un medico competente con nomina attiva.</Vuoto>
              ) : (
              <Vuoto titolo="Nessuna nomina attiva">Quando un’azienda ti nomina medico competente, la trovi qui fino alla scadenza della nomina.</Vuoto>
              )
            ) : (
              aziendeVisibili.map((a) => (
                <Riga
                  key={a.id}
                  onClick={() => scegli(a.id)}
                  inizio={<Pastiglia categoria="utenti" icona={Azienda} />}
                  titolo={a.ragioneSociale}
                  sotto={[
                    `${a.inSorveglianza} in sorveglianza su ${a.lavoratori}`,
                    a.entro60 > 0 ? `${a.entro60} visite entro 60 giorni` : null,
                    a.prossimaGiornata ? `prossima giornata ${dataIt(a.prossimaGiornata)}` : null,
                    a.medico,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  fine={
                    a.nominaFinoAl ? (
                      <Chip stato={a.perdiAccesso ? 'warn' : 'ok'}>{a.perdiAccesso ? `Nomina fino al ${dataIt(a.nominaFinoAl, true)}` : 'Nomina attiva'}</Chip>
                    ) : (
                      <Chip stato="ok">Nomina attiva</Chip>
                    )
                  }
                />
              ))
            )}
            {dati.aziende.some((a) => a.perdiAccesso) && <p className="mt-2 text-[13px] text-ink-muted">Alla scadenza della nomina perdi l’accesso: i dati restano all’azienda.</p>}
            {dati.nomineChiuse.length > 0 && <p className="mt-2 text-[13px] text-ink-muted">{dati.nomineChiuse.length} nomine chiuse: non vedi più quelle aziende.</p>}
          </Scheda>
          {!dati.studio && <EsamiMedico />}
        </>
      )}
      <AziendaMedico id={aziendaId} onChiudi={() => scegli(null)} onCambiato={carica} />
    </div>
  );
}

function AziendaMedico({ id, onChiudi, onCambiato }: { id: number | null; onChiudi: () => void; onCambiato: () => void }) {
  const [d, setD] = useState<DettaglioMedico | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'lavoratori' | 'protocollo' | 'registrate'>('lavoratori');
  const [visita, setVisita] = useState<LavoratoreMedico | null>(null);

  const carica = useCallback(() => {
    if (id === null) return;
    setErr(null);
    dettaglioMedico(id)
      .then(setD)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Azienda non disponibile.'));
  }, [id]);
  useEffect(() => {
    setD(null);
    setTab('lavoratori');
    carica();
  }, [carica]);

  return (
    <>
      <Foglio aperto={id !== null} titolo={d?.azienda.ragioneSociale ?? 'Azienda'} onChiudi={onChiudi} largo>
        {err && <Errore testo={err} onRiprova={carica} />}
        {!d && !err && <Caricamento />}
        {d && (
          <div className="space-y-4 pb-2">
            <Schede
              etichetta="Schede"
              attiva={tab}
              onCambia={setTab}
              voci={[
                {
                  k: 'lavoratori',
                  t: 'Lavoratori',
                  n: d.lavoratori.filter((l) => l.daFare).length,
                },
                { k: 'protocollo', t: 'Protocollo' },
                { k: 'registrate', t: 'Registrate', n: d.registrate.length },
              ]}
            />
            {tab === 'lavoratori' && (
              <div>
                {!d.puoRegistrare && <Blocco>Le visite e i giudizi li registra il medico competente nominato.</Blocco>}
                {d.lavoratori.length === 0 && <Vuoto titolo="Nessun lavoratore in forza" />}
                {d.lavoratori.map((l) => (
                  <Riga
                    key={l.id}
                    inizio={<Pastiglia categoria="persone" icona={Persona} />}
                    titolo={`${l.nome} ${l.cognome}`}
                    sotto={[
                      l.mansione,
                      l.rischi.length > 0 ? l.rischi.join(', ') : null,
                      l.ultimaVisita ? `ultima visita ${dataIt(l.ultimaVisita)}` : 'mai visitato',
                      l.esito,
                      l.inCalendario ? `in calendario il ${dataIt(l.inCalendario)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    fine={
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        {l.validaFinoAl ? (
                          <Chip stato={statoData(l.validaFinoAl) ?? 'ok'}>{`Fino al ${dataIt(l.validaFinoAl, true)}`}</Chip>
                        ) : (
                          <Chip stato="todo">{l.inSorveglianza ? 'Da visitare' : 'Non in sorveglianza'}</Chip>
                        )}
                        {d.puoRegistrare && (
                          <button type="button" onClick={() => setVisita(l)} className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]">
                            Registra visita
                          </button>
                        )}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
            {tab === 'protocollo' &&
              (d.protocollo.length === 0 ? (
                <Vuoto titolo="Protocollo non disponibile">
                  Il protocollo per mansione arriva dal DVR approvato dell’azienda. {d.dvr ? '' : 'L’azienda non ha ancora un DVR approvato.'}
                </Vuoto>
              ) : (
                <ul className="space-y-3">
                  <li className="text-[13px] text-ink-muted">
                    Dal DVR approvato versione {d.dvr?.versione}
                    {d.dvr?.approvatoIl ? ` del ${dataIt(d.dvr.approvatoIl)}` : ''}. Il protocollo definitivo resta tuo.
                  </li>
                  {d.protocollo.map((p) => (
                    <li key={p.mansione} className="rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
                      <p className="text-[16px] font-medium text-ink">{p.mansione}</p>
                      {p.rischi.length > 0 && <p className="mt-0.5 text-[13px] text-ink-muted">Rischi: {p.rischi.join(', ')}</p>}
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] text-ink">
                        {(p.sorveglianza.length > 0 ? p.sorveglianza : ['Nessuna sorveglianza indicata nel DVR']).map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ))}
            {tab === 'registrate' &&
              (d.registrate.length === 0 ? (
                <Vuoto titolo="Nessuna visita registrata qui" />
              ) : (
                d.registrate.map((g) => (
                  <Riga
                    key={g.id}
                    inizio={<Pastiglia categoria="visite" icona={Documento} />}
                    titolo={`${g.lavoratore ?? 'Lavoratore'}: ${g.esitoEtichetta}`}
                    sotto={[
                      dataIt(g.dataVisita),
                      ETICHETTE_TIPO_VISITA[g.tipoVisita] ?? g.tipoVisita,
                      g.validoFinoAl ? `valida fino al ${dataIt(g.validoFinoAl)}` : 'senza scadenza',
                      g.prescrizioni,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    fine={
                      g.haFile && d.puoRegistrare ? (
                        <button type="button" onClick={() => void apriGiudizio(g.id).catch(() => undefined)} className="btn-icon" aria-label="Apri il giudizio firmato">
                          <Scarica size={18} aria-hidden />
                        </button>
                      ) : undefined
                    }
                  />
                ))
              ))}
          </div>
        )}
      </Foglio>
      {d && (
        <RegistraVisita
          l={visita}
          d={d}
          onChiudi={() => setVisita(null)}
          onFatto={() => {
            setVisita(null);
            carica();
            onCambiato();
          }}
        />
      )}
    </>
  );
}

function RegistraVisita({ l, d, onChiudi, onFatto }: { l: LavoratoreMedico | null; d: DettaglioMedico; onChiudi: () => void; onFatto: () => void }) {
  const [data, setData] = useState(oggi());
  const [tipo, setTipo] = useState('periodica');
  const [esito, setEsito] = useState('idoneo');
  const [prescrizioni, setPrescrizioni] = useState('');
  const [mesi, setMesi] = useState(12);
  const [file, setFile] = useState<File | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!l) return;
    setData(oggi());
    setTipo(l.ultimaVisita ? 'periodica' : 'preventiva');
    setEsito('idoneo');
    setPrescrizioni('');
    setMesi(d.periodi.includes(l.prossimaDefaultMesi) ? l.prossimaDefaultMesi : 12);
    setFile(null);
    setErr(null);
  }, [l, d.periodi]);

  const senzaScadenza = esito === 'non_idoneo_permanente';
  const servePrescrizione = esito === 'idoneo_prescrizioni' || esito === 'idoneo_limitazioni';
  const fino = senzaScadenza ? null : validaFinoAl(data, mesi);

  const invia = async () => {
    if (!l) return;
    setLavoro(true);
    setErr(null);
    try {
      await registraGiudizio(d.azienda.id, {
        lavoratore_id: l.id,
        data,
        tipo_visita: tipo,
        esito,
        prescrizioni: prescrizioni.trim() || undefined,
        prossima_tra_mesi: senzaScadenza ? null : mesi,
        file,
      });
      onFatto();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Registrazione non riuscita.');
    } finally {
      setLavoro(false);
    }
  };

  return (
    <Foglio
      aperto={l !== null}
      titolo={l ? `Visita di ${l.nome} ${l.cognome}` : 'Visita'}
      onChiudi={onChiudi}
      piede={
        <button type="button" disabled={lavoro || (servePrescrizione && !prescrizioni.trim())} onClick={() => void invia()} className="btn-acido w-full sm:w-auto">
          {lavoro ? 'Registro' : 'Registra la visita'}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-[1rem] bg-stato-warn px-4 py-3 text-[13.5px] leading-relaxed text-stato-warn-ink">
          <Avviso size={16} aria-hidden className="mt-0.5 shrink-0" />
          Qui solo data, tipo, esito e scadenza. Diagnosi, esami e referti restano nella tua cartella sanitaria.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[14px] font-medium text-ink">
            Data della visita
            <input type="date" className={clsx(CAMPO, 'mt-1.5')} value={data} max={oggi()} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block text-[14px] font-medium text-ink">
            Tipo
            <select className={clsx(CAMPO, 'mt-1.5')} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {d.tipiVisita.map((t) => (
                <option key={t} value={t}>
                  {ETICHETTE_TIPO_VISITA[t] ?? t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="text-[14px] font-medium text-ink">Esito del giudizio di idoneità</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {Object.entries(d.esiti).map(([k, t]) => (
              <label
                key={k}
                className={clsx(
                  'flex min-h-[48px] cursor-pointer items-center rounded-[1rem] px-4 text-[14.5px]',
                  esito === k ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]',
                )}
              >
                <input type="radio" name="esito" value={k} checked={esito === k} onChange={() => setEsito(k)} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        {(servePrescrizione || prescrizioni) && (
          <label className="block text-[14px] font-medium text-ink">
            Cosa deve fare l’azienda
            <textarea
              className={clsx(CAMPO, 'mt-1.5')}
              rows={2}
              maxLength={300}
              value={prescrizioni}
              onChange={(e) => setPrescrizioni(e.target.value)}
              placeholder="Solo indicazioni operative, ad esempio: niente sollevamenti oltre 10 kg"
            />
          </label>
        )}
        {!senzaScadenza && (
          <fieldset>
            <legend className="text-[14px] font-medium text-ink">Prossima visita tra</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {d.periodi.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mesi === m}
                  onClick={() => setMesi(m)}
                  className={clsx('min-h-[44px] rounded-full px-4 text-[14px]', mesi === m ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]')}
                >
                  {PERIODO[m] ?? `${m} mesi`}
                </button>
              ))}
            </div>
            {fino && (
              <p className="mt-2 text-[14px] text-ink">
                Visita valida fino al <span className="font-medium">{dataIt(fino)}</span> <span className="text-ink-muted">({traGiorni(fino)})</span>
              </p>
            )}
          </fieldset>
        )}
        <label className="block text-[14px] font-medium text-ink">
          Giudizio firmato in PDF (facoltativo)
          <input type="file" accept="application/pdf" className="mt-1.5 block text-[14px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="mt-1 block text-[12.5px] font-normal text-ink-muted">Lo vedete solo tu e il lavoratore. L’azienda vede esito e scadenza.</span>
        </label>
        {err && <Errore testo={err} />}
      </div>
    </Foglio>
  );
}
