'use client';

import Link from 'next/link';
import { schedaDvr } from '@/lib/portale/rotte-nuove';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Download, HardHat, Pencil, Plus, Trash2 } from '@/components/icone';
import type {
  Company,
  CompanyDimensione,
  CompanyDocument,
  Corso,
  Dvr,
  Lavoratore,
  PosDocumento,
  Scadenza,
  ScadenzaPriorita,
  ScadenzaTipo,
} from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clearApiCache } from '@/lib/api';
import { clsx } from '@/lib/clsx';
import { BadgeStato } from '../pannelli/contesto';
import { BadgePos } from '../pannelli/PannelliPos';
import { AREA, CAMPO, Caricamento, Elenco, Errore, Etichetta, LINK, Lame, Sezione, Vuota, data, errTesto, senzaPunto } from './kit';

export interface SchedaProps {
  aziendaId: number;
  /** Cresce quando l'agente ha scritto qualcosa: la scheda rilegge i dati. */
  versione: number;
  scrivibile: boolean;
  /** Manda una richiesta all'agente (stesso canale della conversazione). */
  chiedi: (testo: string) => void;
  occupato: boolean;
  nomeAzienda: string;
}

/** Carica un dato e lo rilegge quando cambiano azienda o versione. */
function useDato<T>(carica: () => Promise<T>, chiavi: unknown[]) {
  const [dato, setDato] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(true);
  const [giro, setGiro] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useCallback(carica, chiavi);
  useEffect(() => {
    let vivo = true;
    setInCorso(true);
    setErrore(null);
    f()
      .then((d) => vivo && setDato(d))
      .catch((e: unknown) => vivo && setErrore(errTesto(e, 'Dati non disponibili.')))
      .finally(() => vivo && setInCorso(false));
    return () => {
      vivo = false;
    };
  }, [f, giro]);
  const ricarica = useCallback(() => {
    clearApiCache();
    setGiro((g) => g + 1);
  }, []);
  return { dato, setDato, errore, inCorso, ricarica };
}

const DIMENSIONI: Array<{ v: CompanyDimensione; l: string }> = [
  { v: 'micro', l: 'Micro, meno di 10' },
  { v: 'piccola', l: 'Piccola, da 10 a 49' },
  { v: 'media', l: 'Media, da 50 a 249' },
  { v: 'grande', l: 'Grande, 250 e oltre' },
];

// ------------------------------------------------------------------
// Azienda
// ------------------------------------------------------------------
export function SchedaAzienda({ aziendaId, versione, scrivibile, chiedi, occupato }: SchedaProps) {
  const ds = useDataSource();
  const az = useDato(() => ds.companies.get(aziendaId), [ds, aziendaId, versione]);
  const dvr = useDato(async () => (await ds.dvr.list()).filter((d) => d.company_id === aziendaId), [ds, aziendaId, versione]);
  const [modifica, setModifica] = useState(false);
  const [bozza, setBozza] = useState<Partial<Company>>({});
  const [salvo, setSalvo] = useState(false);
  const [errSalva, setErrSalva] = useState<string | null>(null);

  const c = az.dato;
  const apri = () => {
    if (!c) return;
    setBozza({ ragione_sociale: c.ragione_sociale, ateco: c.ateco, ateco_label: c.ateco_label, lavoratori: c.lavoratori, dimensione: c.dimensione, note: c.note ?? '' });
    setErrSalva(null);
    setModifica(true);
  };
  const salva = async (e: FormEvent) => {
    e.preventDefault();
    if (!c) return;
    setSalvo(true);
    setErrSalva(null);
    try {
      const agg = await ds.companies.update(c.id, { ...bozza, lavoratori: Number(bozza.lavoratori) || 0 });
      az.setDato(agg);
      setModifica(false);
    } catch (err) {
      setErrSalva(errTesto(err, 'Salvataggio non riuscito.'));
    } finally {
      setSalvo(false);
    }
  };

  if (az.inCorso && !c) return <Caricamento />;
  if (az.errore) return <Errore testo={az.errore} onRiprova={az.ricarica} />;
  if (!c) return <Vuota>Azienda non trovata.</Vuota>;

  const ultimo = [...(dvr.dato ?? [])].sort((a, b) => b.versione - a.versione)[0] ?? null;
  const legale = c.sedi.find((s) => s.tipo === 'legale') ?? c.sedi[0];

  return (
    <div>
      <Sezione
        titolo="Anagrafica"
        nota={c.partita_iva ? `Partita IVA ${c.partita_iva}` : null}
        azione={
          scrivibile && !modifica ? (
            <button type="button" onClick={apri} className={LINK}>
              <Pencil size={14} aria-hidden /> Modifica
            </button>
          ) : null
        }
      >
        {modifica ? (
          <form onSubmit={(e) => void salva(e)} className="space-y-3">
            <div>
              <Etichetta htmlFor="az-rs">Ragione sociale</Etichetta>
              <input id="az-rs" className={CAMPO} value={bozza.ragione_sociale ?? ''} onChange={(e) => setBozza({ ...bozza, ragione_sociale: e.target.value })} required />
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <div>
                <Etichetta htmlFor="az-ateco">ATECO</Etichetta>
                <input id="az-ateco" className={CAMPO} value={bozza.ateco ?? ''} onChange={(e) => setBozza({ ...bozza, ateco: e.target.value })} />
              </div>
              <div>
                <Etichetta htmlFor="az-atecol">Attività</Etichetta>
                <input id="az-atecol" className={CAMPO} value={bozza.ateco_label ?? ''} onChange={(e) => setBozza({ ...bozza, ateco_label: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Etichetta htmlFor="az-lav">Lavoratori</Etichetta>
                <input id="az-lav" type="number" min={0} inputMode="numeric" className={CAMPO} value={bozza.lavoratori ?? 0} onChange={(e) => setBozza({ ...bozza, lavoratori: Number(e.target.value) })} />
              </div>
              <div>
                <Etichetta htmlFor="az-dim">Dimensione</Etichetta>
                <select id="az-dim" className={CAMPO} value={bozza.dimensione} onChange={(e) => setBozza({ ...bozza, dimensione: e.target.value as CompanyDimensione })}>
                  {DIMENSIONI.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Etichetta htmlFor="az-note">Note sull’attività</Etichetta>
              <textarea id="az-note" className={AREA} value={bozza.note ?? ''} onChange={(e) => setBozza({ ...bozza, note: e.target.value })} />
            </div>
            {errSalva && <Errore testo={errSalva} />}
            <div className="flex gap-2">
              <button type="submit" disabled={salvo} className="btn-primary min-h-[44px]">
                {salvo ? 'Salvo' : 'Salva'}
              </button>
              <button type="button" onClick={() => setModifica(false)} className="btn-ghost min-h-[44px]">
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-2 text-[13.5px]">
            <dt className="text-ink-muted">Attività</dt>
            <dd className="text-ink">{[c.ateco && `ATECO ${c.ateco}`, c.ateco_label].filter(Boolean).join(', ') || 'Da indicare'}</dd>
            <dt className="text-ink-muted">Organico</dt>
            <dd className="text-ink">
              {c.lavoratori} lavoratori, impresa {c.dimensione}
            </dd>
            <dt className="text-ink-muted">Sede</dt>
            <dd className="text-ink">{legale ? [legale.indirizzo, legale.comune, legale.provincia && `(${legale.provincia})`].filter(Boolean).join(' ') : 'Da indicare'}</dd>
            {c.settings?.pec && (
              <>
                <dt className="text-ink-muted">PEC</dt>
                <dd className="break-all text-ink">{String(c.settings.pec)}</dd>
              </>
            )}
            {c.note && (
              <>
                <dt className="text-ink-muted">Note</dt>
                <dd className="whitespace-pre-line text-ink-soft">{c.note}</dd>
              </>
            )}
          </dl>
        )}
      </Sezione>

      <Sezione titolo="Documento di valutazione">
        {dvr.inCorso && !dvr.dato ? (
          <Caricamento />
        ) : ultimo ? (
          <div className="flex items-center gap-3 border-y border-perla-linea py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">DVR versione {ultimo.versione}</p>
              <p className="text-[12px] text-ink-muted">Creato il {data(ultimo.data_creazione)}</p>
            </div>
            <BadgeStato stato={ultimo.status} />
            <Link href={schedaDvr(ultimo.id)} className={LINK}>
              Apri
            </Link>
          </div>
        ) : (
          <Vuota>Ancora nessun DVR per questa azienda.</Vuota>
        )}
        {scrivibile && (
          <button type="button" disabled={occupato} onClick={() => chiedi(ultimo ? `Com'è messo il DVR di ${c.ragione_sociale}? Cosa va aggiornato?` : `Prepara il DVR di ${c.ragione_sociale}`)} className={clsx(LINK, 'mt-1')}>
            <Lame /> {ultimo ? 'Chiedi a Falco cosa aggiornare' : 'Chiedi a Falco di preparare il DVR'}
          </button>
        )}
      </Sezione>
    </div>
  );
}

// ------------------------------------------------------------------
// Persone
// ------------------------------------------------------------------
export function SchedaPersone({ aziendaId, versione, scrivibile, chiedi, occupato, nomeAzienda }: SchedaProps) {
  const ds = useDataSource();
  const lav = useDato(() => ds.lavoratori.list({ companyId: aziendaId }), [ds, aziendaId, versione]);
  const [nuovo, setNuovo] = useState(false);
  const [form, setForm] = useState({ nome: '', cognome: '', mansione: '' });
  const [inModifica, setInModifica] = useState<{ id: number; mansione: string } | null>(null);
  const [daTogliere, setDaTogliere] = useState<number | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const elenco = (lav.dato ?? []).filter((l) => l.company_id === aziendaId);

  const aggiungi = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.cognome.trim()) return;
    setLavoro(true);
    setErr(null);
    try {
      const l = await ds.lavoratori.create({ company_id: aziendaId, nome: form.nome.trim(), cognome: form.cognome.trim(), mansione: form.mansione.trim() });
      lav.setDato([...(lav.dato ?? []), l]);
      setForm({ nome: '', cognome: '', mansione: '' });
      setNuovo(false);
    } catch (x) {
      setErr(errTesto(x, 'Non sono riuscito ad aggiungere la persona.'));
    } finally {
      setLavoro(false);
    }
  };

  const salvaMansione = async () => {
    if (!inModifica) return;
    setLavoro(true);
    setErr(null);
    try {
      const l = await ds.lavoratori.update(inModifica.id, { mansione: inModifica.mansione.trim() });
      lav.setDato((lav.dato ?? []).map((x) => (x.id === l.id ? { ...x, ...l } : x)));
      setInModifica(null);
    } catch (x) {
      setErr(errTesto(x, 'Modifica non riuscita.'));
    } finally {
      setLavoro(false);
    }
  };

  const togli = async (id: number) => {
    setLavoro(true);
    setErr(null);
    try {
      await ds.lavoratori.delete(id);
      lav.setDato((lav.dato ?? []).filter((x) => x.id !== id));
      setDaTogliere(null);
    } catch (x) {
      setErr(errTesto(x, 'Eliminazione non riuscita.'));
    } finally {
      setLavoro(false);
    }
  };

  const mansioni = new Set(elenco.map((l) => l.mansione).filter(Boolean)).size;

  return (
    <div>
      <Sezione
        titolo="Lavoratori"
        nota={elenco.length ? `${elenco.length} persone, ${mansioni} mansioni` : null}
        azione={
          scrivibile && !nuovo ? (
            <button type="button" onClick={() => setNuovo(true)} className={LINK}>
              <Plus size={15} aria-hidden /> Aggiungi
            </button>
          ) : null
        }
      >
        {nuovo && (
          <form onSubmit={(e) => void aggiungi(e)} className="mb-3 space-y-2 rounded-md bg-perla-velo p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Etichetta htmlFor="lv-nome">Nome</Etichetta>
                <input id="lv-nome" className={CAMPO} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
              </div>
              <div>
                <Etichetta htmlFor="lv-cogn">Cognome</Etichetta>
                <input id="lv-cogn" className={CAMPO} value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} required />
              </div>
            </div>
            <div>
              <Etichetta htmlFor="lv-mans">Mansione</Etichetta>
              <input id="lv-mans" className={CAMPO} value={form.mansione} onChange={(e) => setForm({ ...form, mansione: e.target.value })} placeholder="Per esempio carrellista" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={lavoro} className="btn-primary min-h-[44px]">
                Aggiungi
              </button>
              <button type="button" onClick={() => setNuovo(false)} className="btn-ghost min-h-[44px]">
                Annulla
              </button>
            </div>
          </form>
        )}
        {err && (
          <div className="mb-2">
            <Errore testo={err} />
          </div>
        )}
        {lav.inCorso && !lav.dato ? (
          <Caricamento />
        ) : lav.errore ? (
          <Errore testo={lav.errore} onRiprova={lav.ricarica} />
        ) : elenco.length === 0 ? (
          <Vuota>Nessun lavoratore registrato. Aggiungili qui o chiedi a Falco di importarli da un elenco.</Vuota>
        ) : (
          <Elenco>
            {elenco.map((l: Lavoratore) => (
              <li key={l.id} className="flex min-h-[52px] items-center gap-2 py-1.5">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-perla-velo text-[11.5px] font-semibold text-brand-800">
                  {(l.nome[0] ?? '') + (l.cognome[0] ?? '')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {l.nome} {l.cognome}
                  </p>
                  {inModifica?.id === l.id ? (
                    <div className="mt-1 flex gap-1.5">
                      <label className="sr-only" htmlFor={`mans-${l.id}`}>
                        Mansione di {l.nome} {l.cognome}
                      </label>
                      <input
                        id={`mans-${l.id}`}
                        className={clsx(CAMPO, 'h-10')}
                        value={inModifica.mansione}
                        onChange={(e) => setInModifica({ id: l.id, mansione: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void salvaMansione();
                          if (e.key === 'Escape') setInModifica(null);
                        }}
                      />
                      <button type="button" onClick={() => void salvaMansione()} disabled={lavoro} aria-label="Salva la mansione" className="btn-primary h-10 w-10 shrink-0 px-0">
                        <Check size={15} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <p className="truncate text-[12px] text-ink-muted">{l.mansione || 'Mansione da indicare'}</p>
                  )}
                </div>
                {scrivibile && inModifica?.id !== l.id && (
                  daTogliere === l.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => void togli(l.id)} disabled={lavoro} className="min-h-[40px] rounded-md px-2 text-[12.5px] font-semibold text-danger-ink hover:bg-danger">
                        Elimina
                      </button>
                      <button type="button" onClick={() => setDaTogliere(null)} className="min-h-[40px] rounded-md px-2 text-[12.5px] text-ink-muted hover:bg-perla-velo">
                        Annulla
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0">
                      <button type="button" onClick={() => setInModifica({ id: l.id, mansione: l.mansione })} aria-label={`Modifica la mansione di ${l.nome} ${l.cognome}`} className="btn-icon h-10 w-10">
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button type="button" onClick={() => setDaTogliere(l.id)} aria-label={`Elimina ${l.nome} ${l.cognome}`} className="btn-icon h-10 w-10 hover:bg-danger hover:text-danger-ink">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </span>
                  )
                )}
              </li>
            ))}
          </Elenco>
        )}
      </Sezione>
      <Sezione titolo="Figure della sicurezza">
        <Vuota>RSPP, medico competente, RLS, preposti e addetti alle emergenze di {senzaPunto(nomeAzienda)}.</Vuota>
        <button type="button" disabled={occupato} onClick={() => chiedi(`Chi manca nell'organigramma della sicurezza di ${nomeAzienda}?`)} className={LINK}>
          <Lame /> Chiedi a Falco chi manca nell’organigramma
        </button>
      </Sezione>
    </div>
  );
}

// ------------------------------------------------------------------
// Formazione e scadenze
// ------------------------------------------------------------------
const TIPI: Array<{ v: ScadenzaTipo; l: string }> = [
  { v: 'formazione', l: 'Formazione' },
  { v: 'visita_medica', l: 'Visita medica' },
  { v: 'verifica_impianti', l: 'Verifica impianti' },
  { v: 'manutenzione_attrezzature', l: 'Manutenzione attrezzature' },
  { v: 'aggiornamento_dvr', l: 'Aggiornamento DVR' },
  { v: 'sopralluogo', l: 'Sopralluogo' },
  { v: 'altro', l: 'Altro' },
];
const ETICHETTA_TIPO = Object.fromEntries(TIPI.map((t) => [t.v, t.l])) as Record<string, string>;

function scaduta(s: Scadenza, oggi: string): boolean {
  return s.stato !== 'completata' && (s.stato === 'scaduta' || (!!s.data_prevista && s.data_prevista.slice(0, 10) < oggi));
}

export function SchedaFormazione({ aziendaId, versione, scrivibile, chiedi, occupato, nomeAzienda }: SchedaProps) {
  const ds = useDataSource();
  const sc = useDato(() => ds.scadenze.list({ companyId: aziendaId }), [ds, aziendaId, versione]);
  const corsi = useDato(() => ds.corsi.list({ companyId: aziendaId }), [ds, aziendaId, versione]);
  const [nuova, setNuova] = useState(false);
  const [form, setForm] = useState<{ tipo: ScadenzaTipo; descrizione: string; data_prevista: string; priorita: ScadenzaPriorita }>({
    tipo: 'formazione',
    descrizione: '',
    data_prevista: '',
    priorita: 'media',
  });
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const oggi = new Date().toISOString().slice(0, 10);

  const elenco = [...(sc.dato ?? [])]
    .filter((s) => s.company_id === aziendaId || s.company_id == null)
    .sort((a, b) => Number(a.stato === 'completata') - Number(b.stato === 'completata') || String(a.data_prevista).localeCompare(String(b.data_prevista)));
  const quanteScadute = elenco.filter((s) => scaduta(s, oggi)).length;

  const aggiungi = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.descrizione.trim() || !form.data_prevista) return;
    setLavoro(true);
    setErr(null);
    try {
      const s = await ds.scadenze.create({ company_id: aziendaId, ...form, descrizione: form.descrizione.trim(), stato: 'aperta' });
      sc.setDato([...(sc.dato ?? []), s]);
      setForm({ tipo: 'formazione', descrizione: '', data_prevista: '', priorita: 'media' });
      setNuova(false);
    } catch (x) {
      setErr(errTesto(x, 'Non sono riuscito a salvare la scadenza.'));
    } finally {
      setLavoro(false);
    }
  };

  const completa = async (s: Scadenza) => {
    setLavoro(true);
    setErr(null);
    try {
      const agg = await ds.scadenze.update(s.id, { stato: 'completata' });
      sc.setDato((sc.dato ?? []).map((x) => (x.id === s.id ? { ...x, ...agg } : x)));
    } catch (x) {
      setErr(errTesto(x, 'Aggiornamento non riuscito.'));
    } finally {
      setLavoro(false);
    }
  };

  return (
    <div>
      <Sezione
        titolo="Scadenze"
        nota={elenco.length ? (quanteScadute ? `${quanteScadute} scadute, da recuperare` : 'Tutto in regola per ora') : null}
        azione={
          scrivibile && !nuova ? (
            <button type="button" onClick={() => setNuova(true)} className={LINK}>
              <Plus size={15} aria-hidden /> Aggiungi
            </button>
          ) : null
        }
      >
        {nuova && (
          <form onSubmit={(e) => void aggiungi(e)} className="mb-3 space-y-2 rounded-md bg-perla-velo p-3">
            <div>
              <Etichetta htmlFor="sc-desc">Cosa scade</Etichetta>
              <input id="sc-desc" className={CAMPO} value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="Aggiornamento preposti" required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Etichetta htmlFor="sc-tipo">Tipo</Etichetta>
                <select id="sc-tipo" className={CAMPO} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as ScadenzaTipo })}>
                  {TIPI.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etichetta htmlFor="sc-data">Entro il</Etichetta>
                <input id="sc-data" type="date" className={CAMPO} value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} required />
              </div>
            </div>
            <div>
              <Etichetta htmlFor="sc-prio">Priorità</Etichetta>
              <select id="sc-prio" className={CAMPO} value={form.priorita} onChange={(e) => setForm({ ...form, priorita: e.target.value as ScadenzaPriorita })}>
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={lavoro} className="btn-primary min-h-[44px]">
                Salva scadenza
              </button>
              <button type="button" onClick={() => setNuova(false)} className="btn-ghost min-h-[44px]">
                Annulla
              </button>
            </div>
          </form>
        )}
        {err && (
          <div className="mb-2">
            <Errore testo={err} />
          </div>
        )}
        {sc.inCorso && !sc.dato ? (
          <Caricamento />
        ) : sc.errore ? (
          <Errore testo={sc.errore} onRiprova={sc.ricarica} />
        ) : elenco.length === 0 ? (
          <Vuota>Nessuna scadenza registrata per {senzaPunto(nomeAzienda)}.</Vuota>
        ) : (
          <Elenco>
            {elenco.map((s) => {
              const tardi = scaduta(s, oggi);
              const fatta = s.stato === 'completata';
              return (
                <li key={s.id} className="flex min-h-[56px] items-center gap-3 py-2">
                  <span
                    className={clsx(
                      'w-[4.6rem] shrink-0 text-[12px] font-semibold tabular-nums leading-tight',
                      fatta ? 'text-ink-subtle line-through' : tardi ? 'text-danger-ink' : 'text-brand-800'
                    )}
                  >
                    {data(s.data_prevista) || 'Senza data'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-[13.5px] leading-snug', fatta ? 'text-ink-muted' : 'text-ink')}>{s.descrizione}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      {ETICHETTA_TIPO[s.tipo] ?? s.tipo}
                      {tardi && <span className="font-semibold text-danger-ink">, scaduta</span>}
                      {fatta && ', fatta'}
                    </p>
                  </div>
                  {scrivibile && !fatta && (
                    <button type="button" onClick={() => void completa(s)} disabled={lavoro} className="min-h-[40px] shrink-0 rounded-md border border-perla-linea px-2.5 text-[12.5px] font-semibold text-ink-soft hover:border-oro-300 hover:text-brand-900">
                      Fatto
                    </button>
                  )}
                </li>
              );
            })}
          </Elenco>
        )}
        <button type="button" disabled={occupato} onClick={() => chiedi(`Quali corsi e scadenze di ${nomeAzienda} cadono nei prossimi 60 giorni?`)} className={clsx(LINK, 'mt-1')}>
          <Lame /> Chiedi a Falco cosa scade nei prossimi 60 giorni
        </button>
      </Sezione>

      <Sezione titolo="Corsi svolti">
        {corsi.inCorso && !corsi.dato ? (
          <Caricamento />
        ) : corsi.errore ? (
          <Errore testo={corsi.errore} onRiprova={corsi.ricarica} />
        ) : (corsi.dato ?? []).length === 0 ? (
          <Vuota>Nessun corso registrato.</Vuota>
        ) : (
          <Elenco>
            {(corsi.dato ?? []).map((k: Corso) => (
              <li key={k.id} className="py-2">
                <p className="text-[13.5px] font-medium text-ink">{k.titolo}</p>
                <p className="text-[11.5px] text-ink-muted">
                  {[k.durata_ore ? `${k.durata_ore} ore` : null, k.data_svolgimento && `svolto il ${data(k.data_svolgimento)}`, k.data_scadenza && `valido fino al ${data(k.data_scadenza)}`, `${k.partecipanti.length} partecipanti`]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </li>
            ))}
          </Elenco>
        )}
      </Sezione>
    </div>
  );
}

// ------------------------------------------------------------------
// Documenti
// ------------------------------------------------------------------
const TIPO_DOC: Record<string, string> = { foto: 'Foto', audio: 'Audio', video: 'Video', documento: 'Documento', nota: 'Nota' };

export function SchedaDocumenti({ aziendaId, versione, scrivibile, chiedi, occupato, nomeAzienda }: SchedaProps) {
  const ds = useDataSource();
  const dvr = useDato(async () => (await ds.dvr.list()).filter((d) => d.company_id === aziendaId), [ds, aziendaId, versione]);
  const arch = useDato(() => ds.companyDocuments.list(aziendaId), [ds, aziendaId, versione]);
  const [nota, setNota] = useState('');
  const [aperta, setAperta] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const salvaNota = async (e: FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) return;
    setLavoro(true);
    setErr(null);
    try {
      const d = await ds.companyDocuments.addNote(aziendaId, nota.trim(), undefined, 'manuale');
      arch.setDato([d, ...(arch.dato ?? [])]);
      setNota('');
      setAperta(false);
    } catch (x) {
      setErr(errTesto(x, 'Nota non salvata.'));
    } finally {
      setLavoro(false);
    }
  };

  const versioni = [...(dvr.dato ?? [])].sort((a: Dvr, b: Dvr) => b.versione - a.versione);

  return (
    <div>
      <Sezione titolo="DVR">
        {dvr.inCorso && !dvr.dato ? (
          <Caricamento />
        ) : dvr.errore ? (
          <Errore testo={dvr.errore} onRiprova={dvr.ricarica} />
        ) : versioni.length === 0 ? (
          <Vuota>Nessun DVR per {senzaPunto(nomeAzienda)}.</Vuota>
        ) : (
          <Elenco>
            {versioni.map((d) => (
              <li key={d.id}>
                <Link href={schedaDvr(d.id)} className="flex min-h-[52px] items-center gap-3 py-1.5 hover:bg-perla-velo/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">Versione {d.versione}</span>
                    <span className="block text-[11.5px] text-ink-muted">{data(d.data_creazione)}</span>
                  </span>
                  <BadgeStato stato={d.status} />
                </Link>
              </li>
            ))}
          </Elenco>
        )}
      </Sezione>

      <Sezione
        titolo="Archivio"
        nota="Foto, registrazioni e note che alimentano i documenti"
        azione={
          scrivibile && !aperta ? (
            <button type="button" onClick={() => setAperta(true)} className={LINK}>
              <Plus size={15} aria-hidden /> Nota
            </button>
          ) : null
        }
      >
        {aperta && (
          <form onSubmit={(e) => void salvaNota(e)} className="mb-3 space-y-2 rounded-md bg-perla-velo p-3">
            <Etichetta htmlFor="doc-nota">Nota di sopralluogo</Etichetta>
            <textarea id="doc-nota" className={AREA} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus placeholder="Cosa hai visto, dove, chi era presente" />
            <div className="flex gap-2">
              <button type="submit" disabled={lavoro || !nota.trim()} className="btn-primary min-h-[44px]">
                Salva nota
              </button>
              <button type="button" onClick={() => setAperta(false)} className="btn-ghost min-h-[44px]">
                Annulla
              </button>
            </div>
          </form>
        )}
        {err && (
          <div className="mb-2">
            <Errore testo={err} />
          </div>
        )}
        {arch.inCorso && !arch.dato ? (
          <Caricamento />
        ) : arch.errore ? (
          <Errore testo={arch.errore} onRiprova={arch.ricarica} />
        ) : (arch.dato ?? []).length === 0 ? (
          <Vuota>L’archivio è vuoto. Carica una foto dalla barra di scrittura o aggiungi una nota.</Vuota>
        ) : (
          <Elenco>
            {(arch.dato ?? []).slice(0, 30).map((d: CompanyDocument) => (
              <li key={d.id} className="py-2">
                <p className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11.5px] font-semibold text-oro-700">{TIPO_DOC[d.tipo] ?? d.tipo}</span>
                  <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">{d.titolo || d.filename || 'Senza titolo'}</span>
                </p>
                {d.analisi_errore ? (
                  <p className="text-[12px] text-warn-ink">Analisi non riuscita: {d.analisi_errore}</p>
                ) : d.testo_analisi ? (
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{d.testo_analisi}</p>
                ) : (
                  <p className="text-[12px] text-ink-subtle">Analisi in corso</p>
                )}
              </li>
            ))}
          </Elenco>
        )}
        <button type="button" disabled={occupato} onClick={() => chiedi(`Cerca nell'archivio di ${nomeAzienda} i rilievi utili al DVR`)} className={clsx(LINK, 'mt-1')}>
          <Lame /> Chiedi a Falco cosa c’è di utile nell’archivio
        </button>
      </Sezione>
    </div>
  );
}

// ------------------------------------------------------------------
// Cantieri (API vera del modulo POS) con i loro POS
// ------------------------------------------------------------------
export function SchedaCantieri({ aziendaId, versione, scrivibile, chiedi, occupato, nomeAzienda }: SchedaProps) {
  const ds = useDataSource();
  const cant = useDato(() => ds.cantieri.list({ companyId: aziendaId }), [ds, aziendaId, versione]);
  const pos = useDato(() => ds.pos.list({ companyId: aziendaId }), [ds, aziendaId, versione]);
  const [nuovo, setNuovo] = useState(false);
  const [form, setForm] = useState({ denominazione: '', indirizzo: '', comune: '', provincia: '', data_inizio: '' });
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scarico, setScarico] = useState<string | null>(null);

  const aggiungi = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.denominazione.trim() || !form.indirizzo.trim() || !form.comune.trim()) return;
    setLavoro(true);
    setErr(null);
    try {
      const c = await ds.cantieri.create({
        company_id: aziendaId,
        denominazione: form.denominazione.trim(),
        indirizzo: form.indirizzo.trim(),
        comune: form.comune.trim(),
        provincia: form.provincia.trim() ? form.provincia.trim().toUpperCase() : null,
        data_inizio: form.data_inizio || null,
      });
      cant.setDato([c, ...(cant.dato ?? [])]);
      setForm({ denominazione: '', indirizzo: '', comune: '', provincia: '', data_inizio: '' });
      setNuovo(false);
    } catch (x) {
      setErr(errTesto(x, 'Non sono riuscito a salvare il cantiere.'));
    } finally {
      setLavoro(false);
    }
  };

  const scarica = async (id: number, f: 'pdf' | 'docx') => {
    setScarico(`${id}${f}`);
    setErr(null);
    try {
      await ds.pos.download(id, f);
    } catch (x) {
      setErr(errTesto(x, 'Download non riuscito.'));
    } finally {
      setScarico(null);
    }
  };

  const perCantiere = new Map<number, PosDocumento[]>();
  for (const p of pos.dato ?? []) perCantiere.set(p.cantiere_id, [...(perCantiere.get(p.cantiere_id) ?? []), p]);
  const elenco = cant.dato ?? [];

  return (
    <div>
      <Sezione
        titolo="Cantieri"
        nota="Ogni cantiere ha il suo POS: stato, revisione e documenti emessi"
        azione={
          scrivibile && !nuovo ? (
            <button type="button" onClick={() => setNuovo(true)} className={LINK}>
              <Plus size={15} aria-hidden /> Nuovo
            </button>
          ) : null
        }
      >
        {nuovo && (
          <form onSubmit={(e) => void aggiungi(e)} className="mb-3 space-y-2 rounded-[0.875rem] bg-perla-velo p-3">
            <div>
              <Etichetta htmlFor="ct-den">Nome del cantiere</Etichetta>
              <input id="ct-den" className={CAMPO} value={form.denominazione} onChange={(e) => setForm({ ...form, denominazione: e.target.value })} placeholder="Ristrutturazione scuola Rodari" required autoFocus />
            </div>
            <div>
              <Etichetta htmlFor="ct-ind">Indirizzo</Etichetta>
              <input id="ct-ind" className={CAMPO} value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} required />
            </div>
            <div className="grid grid-cols-[1fr_4.5rem] gap-2">
              <div>
                <Etichetta htmlFor="ct-com">Comune</Etichetta>
                <input id="ct-com" className={CAMPO} value={form.comune} onChange={(e) => setForm({ ...form, comune: e.target.value })} required />
              </div>
              <div>
                <Etichetta htmlFor="ct-pr">Prov.</Etichetta>
                <input id="ct-pr" maxLength={2} className={CAMPO} value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
              </div>
            </div>
            <div>
              <Etichetta htmlFor="ct-ini">Inizio lavori</Etichetta>
              <input id="ct-ini" type="date" className={CAMPO} value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={lavoro} className="btn-primary min-h-[44px]">
                Salva cantiere
              </button>
              <button type="button" onClick={() => setNuovo(false)} className="btn-ghost min-h-[44px]">
                Annulla
              </button>
            </div>
          </form>
        )}
        {err && (
          <div className="mb-2">
            <Errore testo={err} />
          </div>
        )}
        {cant.inCorso && !cant.dato ? (
          <Caricamento testo="Carico i cantieri" />
        ) : cant.errore ? (
          <Errore testo={cant.errore} onRiprova={cant.ricarica} />
        ) : elenco.length === 0 ? (
          <Vuota>
            Nessun cantiere per {senzaPunto(nomeAzienda)}.{scrivibile ? ' Aggiungilo qui o chiedi all’agente di leggerlo dal PSC.' : ''}
          </Vuota>
        ) : (
          <ul className="space-y-2.5">
            {elenco.map((c) => {
              const suoi = perCantiere.get(c.id) ?? [];
              return (
                <li key={c.id} className="superficie rounded-[0.875rem] p-3">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="comando flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.875rem] [--icona-lame:#d4ff3a] [--icona-lame-opacita:1]">
                      <HardHat size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{c.denominazione}</p>
                      <p className="truncate text-[12px] text-ink-muted">
                        {[c.indirizzo, c.comune, c.provincia && `(${c.provincia})`].filter(Boolean).join(' ')}
                        {c.data_inizio && <span className="cifre">, dal {data(c.data_inizio)}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    {pos.inCorso && !pos.dato ? (
                      <Caricamento testo="Carico i POS" />
                    ) : suoi.length === 0 ? (
                      <p className="text-[12.5px] text-ink-muted">Nessun POS per questo cantiere.</p>
                    ) : (
                      suoi.map((p) => (
                        <div key={p.id} className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-[0.875rem] bg-perla-superficie px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]">
                          <span className="cifre text-[12.5px] font-medium text-ink">POS {p.id}</span>
                          {p.revisione_corrente != null && <span className="cifre text-[11.5px] text-ink-muted">rev. {p.revisione_corrente}</span>}
                          <BadgePos stato={p.stato} />
                          {p.stato === 'emesso' && (
                            <span className="ml-auto flex gap-1">
                              <button type="button" onClick={() => void scarica(p.id, 'pdf')} disabled={scarico !== null} className="premi inline-flex min-h-[36px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-brand-700 hover:bg-perla-velo">
                                <Download size={14} aria-hidden /> PDF
                              </button>
                              <button type="button" onClick={() => void scarica(p.id, 'docx')} disabled={scarico !== null} className="premi inline-flex min-h-[36px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-brand-700 hover:bg-perla-velo">
                                <Download size={14} aria-hidden /> Word
                              </button>
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {scrivibile && (
                    <button
                      type="button"
                      disabled={occupato}
                      onClick={() => chiedi(suoi.length ? `Controlla il POS del cantiere ${c.denominazione} (cantiere n. ${c.id})` : `Prepara il POS per il cantiere ${c.denominazione} (cantiere n. ${c.id}) di ${nomeAzienda}`)}
                      className={clsx(LINK, 'mt-1')}
                    >
                      <Lame /> {suoi.length ? 'Chiedi a Falco di controllare il POS' : 'Chiedi a Falco di preparare il POS'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sezione>
    </div>
  );
}
