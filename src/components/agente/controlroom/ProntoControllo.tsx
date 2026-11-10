'use client';

import { useState, type FormEvent } from 'react';
import { Cestino, Piu, Sirena } from '@/components/icone';
import type { AssistenzaEsito, CrReferente, Ispezione, IspezioneEnte, IspezioneEsito } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clsx } from '@/lib/clsx';
import { AREA, CAMPO, Caricamento, Errore, Etichetta, Vuota } from '../spazio/kit';
import { SegnoChecklist } from './Fascicolo';
import { ESITO, LINK_CR, Titoletto, daConsulente, dataCr, puoEliminareIspezioni, testoErrore, useDato, type SchedaControlRoomProps } from './kit';

export const ENTI: Array<{ v: IspezioneEnte; l: string }> = [
  { v: 'ASL', l: 'ASL' },
  { v: 'INL', l: 'Ispettorato del lavoro' },
  { v: 'VVF', l: 'Vigili del fuoco' },
  { v: 'NAS', l: 'Carabinieri NAS' },
  { v: 'ARPA', l: 'ARPA' },
  { v: 'altro', l: 'Altro ente' },
];
export const ESITI_ISPEZIONE: Record<IspezioneEsito, { l: string; cls: string }> = {
  nessuna_criticita: { l: 'Nessuna criticità', cls: 'bg-ok text-ok-ink' },
  note_informative: { l: 'Note informative', cls: 'bg-brand-50 text-brand-700' },
  prescrizioni: { l: 'Prescrizioni', cls: 'bg-warn text-warn-ink' },
  sanzione: { l: 'Sanzione', cls: 'bg-danger text-danger-ink' },
};
const oggi = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Referente({ r }: { r: CrReferente | null }) {
  if (!r) return <Vuota>Nessun referente indicato per questa azienda: chiedi allo studio di assegnare un consulente.</Vuota>;
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-900 text-[13px] font-semibold text-perla-carta">
        {r.nome
          .split(/\s+/)
          .filter((x) => /^[A-Za-zÀ-ÿ]/.test(x))
          .slice(-2)
          .map((x) => x[0])
          .join('')
          .toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{r.nome}</span>
        <span className="block truncate text-[12px] text-ink-muted">
          {r.ruolo === 'titolare_studio' ? 'Titolare dello studio' : 'Consulente'}
          {r.email && (
            <>
              {', '}
              <a href={`mailto:${r.email}`} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                {r.email}
              </a>
            </>
          )}
        </span>
      </span>
    </div>
  );
}

export function RigaIspezione({ i, onElimina, evidenzia }: { i: Ispezione; onElimina?: () => void; evidenzia?: boolean }) {
  const e = i.esito ? ESITI_ISPEZIONE[i.esito] : null;
  return (
    <li className={clsx('py-2', evidenzia && '-mx-2 rounded-[0.875rem] bg-oro-50/70 px-2')} aria-current={evidenzia || undefined}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">
            {ENTI.find((x) => x.v === i.ente)?.l ?? i.ente}
            {i.tipo && <span className="font-normal text-ink-muted">, {i.tipo}</span>}
          </span>
          <span className="cifre block text-[11.5px] text-ink-muted">{dataCr(i.data)}</span>
        </span>
        {e ? <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', e.cls)}>{e.l}</span> : <span className="shrink-0 text-[11px] text-ink-subtle">Esito da definire</span>}
        {onElimina && (
          <button type="button" onClick={onElimina} aria-label="Elimina l'ispezione" className="btn-icon -my-1 h-9 w-9 shrink-0">
            <Cestino size={15} aria-hidden />
          </button>
        )}
      </div>
      {i.prescrizioni.length > 0 && (
        <ul className="ml-1 mt-1 space-y-0.5 border-l-2 border-warn pl-2.5">
          {i.prescrizioni.map((p, k) => (
            <li key={k} className="text-[12px] text-ink-soft">
              {p.descrizione}
              {p.termine && <span className="text-ink-muted">, entro il {dataCr(p.termine)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RichiestaAiuto({ aziendaId, onInviata }: { aziendaId: number; onInviata: (e: AssistenzaEsito) => void }) {
  const ds = useDataSource();
  const [aperta, setAperta] = useState(false);
  const [ente, setEnte] = useState<string>('ASL');
  const [msg, setMsg] = useState('');
  const [invio, setInvio] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setInvio(true);
    setErr(null);
    try {
      onInviata(await ds.controlRoom.richiediAssistenza(aziendaId, { ente, messaggio: msg }));
      setAperta(false);
      setMsg('');
    } catch (x) {
      setErr(testoErrore(x, 'Richiesta non inviata: chiama direttamente il consulente.'));
    } finally {
      setInvio(false);
    }
  };
  if (!aperta)
    return (
      <button
        type="button"
        onClick={() => setAperta(true)}
        className="comando premi flex min-h-[68px] w-full items-center gap-3 rounded-[16px] px-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [--icona-lame:#d4ff3a] [--icona-lame-opacita:1]"
      >
        <Sirena size={26} aria-hidden className="shrink-0 text-perla-carta" />
        <span className="min-w-0">
          <span className="block text-[17px] font-medium tracking-[-0.01em] text-perla-carta">Chiedi aiuto ora</span>
          <span className="block text-[12.5px] text-[#c4c4c9]">Avvisa subito il consulente e lo studio</span>
        </span>
      </button>
    );
  return (
    <form onSubmit={(e) => void invia(e)} className="comando space-y-3 rounded-[1.25rem] p-4" aria-label="Richiesta di assistenza urgente">
      <p className="text-[15px] font-medium text-perla-carta">Chi è arrivato?</p>
      <div role="radiogroup" aria-label="Ente" className="grid grid-cols-3 gap-1.5">
        {ENTI.map((x) => (
          <button
            key={x.v}
            type="button"
            role="radio"
            aria-checked={ente === x.v}
            onClick={() => setEnte(x.v)}
            className={clsx(
              'premi min-h-[44px] rounded-full px-1 text-[12.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro-300',
              ente === x.v ? 'bg-perla-carta text-brand-900' : 'bg-white/[0.07] text-perla-carta shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
            )}
          >
            {x.v === 'altro' ? 'Altro' : x.v}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="pc-msg" className="mb-1 block text-[12px] font-medium text-[#c4c4c9]">
          Messaggio (facoltativo)
        </label>
        <textarea id="pc-msg" className={clsx(AREA, 'min-h-[64px]')} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} placeholder="Es. sono arrivati due ispettori e chiedono il DVR" />
      </div>
      {err && <Errore testo={err} />}
      <div className="flex gap-2">
        <button type="submit" disabled={invio} className="premi min-h-[48px] flex-1 rounded-full bg-perla-carta text-[14px] font-medium text-brand-900 disabled:opacity-60">
          {invio ? 'Invio' : 'Invia la richiesta'}
        </button>
        <button type="button" onClick={() => setAperta(false)} className="min-h-[48px] rounded-[0.875rem] px-3 text-[13px] font-semibold text-[#c4c4c9] hover:text-perla-carta">
          Annulla
        </button>
      </div>
    </form>
  );
}

function NuovaIspezione({ aziendaId, completa, onFatta, onAnnulla }: { aziendaId: number; completa: boolean; onFatta: () => void; onAnnulla: () => void }) {
  const ds = useDataSource();
  const [ente, setEnte] = useState<IspezioneEnte>('ASL');
  const [data, setData] = useState(oggi());
  const [tipo, setTipo] = useState('');
  const [note, setNote] = useState('');
  const [esito, setEsito] = useState<IspezioneEsito | ''>('');
  const [prescrizioni, setPrescrizioni] = useState<Array<{ descrizione: string; termine: string }>>([]);
  const [salvo, setSalvo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const salva = async (e: FormEvent) => {
    e.preventDefault();
    setSalvo(true);
    setErr(null);
    try {
      await ds.controlRoom.creaIspezione({
        company_id: aziendaId,
        ente,
        data,
        tipo: tipo.trim() || undefined,
        note: note.trim() || undefined,
        ...(completa
          ? {
              esito: esito || null,
              prescrizioni: prescrizioni.filter((p) => p.descrizione.trim()).map((p) => ({ descrizione: p.descrizione.trim(), termine: p.termine || null })),
            }
          : {}),
      });
      onFatta();
    } catch (x) {
      setErr(testoErrore(x, 'Ispezione non registrata.'));
    } finally {
      setSalvo(false);
    }
  };
  return (
    <form onSubmit={(e) => void salva(e)} className="space-y-2.5 rounded-[0.875rem] bg-perla-superficie p-3.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Etichetta htmlFor="isp-ente">Ente</Etichetta>
          <select id="isp-ente" className={CAMPO} value={ente} onChange={(e) => setEnte(e.target.value as IspezioneEnte)}>
            {ENTI.map((x) => (
              <option key={x.v} value={x.v}>
                {x.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Etichetta htmlFor="isp-data">Data</Etichetta>
          <input id="isp-data" type="date" max={oggi()} required className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div>
        <Etichetta htmlFor="isp-tipo">Tipo di controllo</Etichetta>
        <input id="isp-tipo" className={CAMPO} value={tipo} maxLength={100} onChange={(e) => setTipo(e.target.value)} placeholder="Sopralluogo, controllo documentale" />
      </div>
      <div>
        <Etichetta htmlFor="isp-note">Note</Etichetta>
        <textarea id="isp-note" className={AREA} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </div>
      {completa ? (
        <>
          <div>
            <Etichetta htmlFor="isp-esito">Esito</Etichetta>
            <select id="isp-esito" className={CAMPO} value={esito} onChange={(e) => setEsito(e.target.value as IspezioneEsito | '')}>
              <option value="">Da definire</option>
              {Object.entries(ESITI_ISPEZIONE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.l}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[12px] font-medium text-ink-muted">Prescrizioni con termine (diventano scadenze critiche)</legend>
            {prescrizioni.map((p, k) => (
              <div key={k} className="grid grid-cols-[1fr_9.5rem_auto] items-end gap-1.5">
                <div>
                  <label htmlFor={`isp-pr-${k}`} className="sr-only">Prescrizione {k + 1}</label>
                  <input id={`isp-pr-${k}`} className={CAMPO} value={p.descrizione} onChange={(e) => setPrescrizioni(prescrizioni.map((x, j) => (j === k ? { ...x, descrizione: e.target.value } : x)))} placeholder="Cosa va fatto" />
                </div>
                <div>
                  <label htmlFor={`isp-pt-${k}`} className="sr-only">Termine della prescrizione {k + 1}</label>
                  <input id={`isp-pt-${k}`} type="date" className={CAMPO} value={p.termine} onChange={(e) => setPrescrizioni(prescrizioni.map((x, j) => (j === k ? { ...x, termine: e.target.value } : x)))} />
                </div>
                <button type="button" onClick={() => setPrescrizioni(prescrizioni.filter((_, j) => j !== k))} aria-label={`Togli la prescrizione ${k + 1}`} className="btn-icon h-11 w-11">
                  <Cestino size={15} aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setPrescrizioni([...prescrizioni, { descrizione: '', termine: '' }])} className={clsx(LINK_CR, '-ml-2')}>
              <Piu size={15} aria-hidden /> Aggiungi una prescrizione
            </button>
          </fieldset>
        </>
      ) : (
        <p className="text-[12px] text-ink-muted">Esito e prescrizioni li registra il tuo consulente dopo aver letto il verbale.</p>
      )}
      {err && <Errore testo={err} />}
      <div className="flex gap-2">
        <button type="submit" disabled={salvo} className="btn-primary min-h-[44px] flex-1">
          {salvo ? 'Registro' : 'Registra l’ispezione'}
        </button>
        <button type="button" onClick={onAnnulla} className="btn-ghost min-h-[44px]">
          Annulla
        </button>
      </div>
    </form>
  );
}

/** Pronto Controllo: aiuto immediato, referente, cosa mostrare, ispezioni e consigli. */
export function ProntoControllo({ aziendaId, ruolo, versione }: SchedaControlRoomProps) {
  const ds = useDataSource();
  const pc = useDato(() => ds.controlRoom.prontoControllo(aziendaId), [ds, aziendaId, versione]);
  const isp = useDato(() => ds.controlRoom.ispezioni(aziendaId), [ds, aziendaId, versione]);
  const [esito, setEsito] = useState<AssistenzaEsito | null>(null);
  const [nuova, setNuova] = useState(false);
  const [elimina, setElimina] = useState<Ispezione | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  const apri = async (doc: { id: string; tipo: string; virtuale: boolean; titolo: string }) => {
    setAvviso(null);
    try {
      if (!doc.virtuale && /^\d+$/.test(doc.id)) await ds.companyDocuments.download(Number(doc.id), doc.titolo);
      else if (doc.id.startsWith('pos:')) await ds.pos.download(Number(doc.id.slice(4)), 'pdf');
      else setAvviso('Questo documento si consulta nella piattaforma o con il Safety Passport.');
    } catch (e) {
      setAvviso(testoErrore(e, 'Documento non disponibile.'));
    }
  };

  if (pc.inCorso && !pc.dato) return <Caricamento testo="Preparo il Pronto Controllo" />;
  if (pc.errore) return <Errore testo={pc.errore} onRiprova={pc.ricarica} />;
  const d = pc.dato;
  if (!d) return null;
  const ispezioni = isp.dato ?? d.ultime_ispezioni;

  return (
    <div className="space-y-1 py-3">
      <RichiestaAiuto aziendaId={aziendaId} onInviata={setEsito} />
      {esito && (
        <div role="status" className="mt-2 rounded-[0.875rem] bg-ok px-3 py-2.5 text-[13px] text-ok-ink shadow-[inset_0_0_0_1px_rgba(16,122,85,0.25)]">
          <p className="font-semibold">
            {esito.avvisati > 0
              ? `Richiesta inviata: ${esito.avvisati} ${esito.avvisati === 1 ? 'persona avvisata' : 'persone avvisate'}${esito.email ? `, ${esito.email} per email` : ''}${esito.canali ? `, ${esito.canali} ${esito.canali === 1 ? 'canale' : 'canali'} di chat` : ''}.`
              : 'Richiesta registrata.'}
          </p>
          {esito.referente && <p className="mt-0.5">Referente: {esito.referente.nome}{esito.referente.email ? `, ${esito.referente.email}` : ''}.</p>}
          {esito.nota && <p className="mt-0.5 text-[12.5px]">{esito.nota}</p>}
        </div>
      )}

      <Titoletto>Il tuo referente</Titoletto>
      <Referente r={d.referente} />

      <Titoletto azione={<span className="cifre text-[12px] text-ink-muted">{d.pronti} pronti su {d.totale}</span>}>Cosa mostrare subito</Titoletto>
      {d.mostra_subito.length === 0 ? (
        <Vuota>Nessun documento richiesto.</Vuota>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {d.mostra_subito.map((v) => (
            <li key={v.chiave} className="flex items-start gap-2.5 py-2">
              <SegnoChecklist esito={v.esito} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-snug text-ink">
                  {v.voce}
                  <span className="sr-only">: {ESITO[v.esito].l}</span>
                </span>
                {v.documenti.length > 0 ? (
                  <span className="mt-0.5 flex flex-wrap gap-x-3">
                    {v.documenti.slice(0, 3).map((doc) => (
                      <button key={doc.id} type="button" onClick={() => void apri(doc)} className="min-h-[28px] text-left text-[12px] font-medium text-brand-700 underline-offset-2 hover:underline">
                        {doc.titolo}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="block text-[11.5px] text-ink-muted">{v.messaggio}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {avviso && <Errore testo={avviso} />}
      <p className="text-[12px] text-ink-muted">{d.passaporto_attivo ? 'Il Safety Passport è attivo: puoi mostrare il QR e dare il PIN.' : 'Nessun Safety Passport attivo per questa azienda.'}</p>

      <Titoletto
        azione={
          !nuova ? (
            <button type="button" onClick={() => setNuova(true)} className={clsx(LINK_CR, '-mr-2 text-[12.5px]')}>
              <Piu size={15} aria-hidden /> Registra
            </button>
          ) : undefined
        }
      >
        Ispezioni
      </Titoletto>
      {nuova && (
        <NuovaIspezione
          aziendaId={aziendaId}
          completa={daConsulente(ruolo)}
          onAnnulla={() => setNuova(false)}
          onFatta={() => {
            setNuova(false);
            isp.ricarica();
            pc.ricarica();
          }}
        />
      )}
      {ispezioni.length === 0 ? (
        <Vuota>Nessuna ispezione registrata.</Vuota>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {ispezioni.slice(0, 5).map((i) => (
            <RigaIspezione key={i.id} i={i} onElimina={puoEliminareIspezioni(ruolo) ? () => setElimina(i) : undefined} />
          ))}
        </ul>
      )}

      <Titoletto>Se arriva un controllo</Titoletto>
      <ol className="space-y-1.5">
        {d.consigli.map((c, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            <span className="cifre mt-px w-4 shrink-0 text-right font-semibold text-oro-600">{i + 1}</span>
            <span>{c}</span>
          </li>
        ))}
      </ol>

      <ConfirmDialog
        open={elimina !== null}
        title="Eliminare l'ispezione?"
        message="Si cancellano anche le scadenze delle sue prescrizioni. L'operazione non si annulla."
        confirmLabel="Elimina"
        destructive
        busy={lavoro}
        error={err}
        onCancel={() => setElimina(null)}
        onConfirm={async () => {
          if (!elimina) return;
          setLavoro(true);
          setErr(null);
          try {
            await ds.controlRoom.eliminaIspezione(elimina.id);
            setElimina(null);
            isp.ricarica();
          } catch (e) {
            setErr(testoErrore(e, 'Eliminazione non riuscita.'));
          } finally {
            setLavoro(false);
          }
        }}
      />
    </div>
  );
}
