'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Avviso, Condividi, Copia, Download, Qr } from '@/components/icone';
import type { PassaportoAccesso, PassaportoCreato, PassaportoSezione, PassaportoVista } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clsx } from '@/lib/clsx';
import { CAMPO, Caricamento, Errore, Etichetta, Vuota } from '../spazio/kit';
import { LINK_CR, Titoletto, dataCr, gestiscePassaporto, testoErrore, useDato, type SchedaControlRoomProps } from './kit';

export const SEZIONI_PASSAPORTO: Array<{ v: PassaportoSezione; l: string }> = [
  { v: 'anagrafica', l: 'Anagrafica' },
  { v: 'organigramma', l: 'Organigramma' },
  { v: 'dvr', l: 'DVR' },
  { v: 'nomine', l: 'Nomine' },
  { v: 'formazione', l: 'Formazione' },
  { v: 'sorveglianza', l: 'Sorveglianza (solo conteggi)' },
  { v: 'emergenza', l: 'Emergenza' },
  { v: 'verbali', l: 'Verbali' },
  { v: 'impianti', l: 'Impianti' },
  { v: 'pos_duvri', l: 'POS e DUVRI' },
];

export function ElencoAccessi({ accessi, max = 6 }: { accessi: PassaportoAccesso[]; max?: number }) {
  if (accessi.length === 0) return <Vuota>Nessun accesso registrato.</Vuota>;
  return (
    <ul className="divide-y divide-perla-linea">
      {accessi.slice(0, max).map((a, i) => (
        <li key={`${a.quando}-${i}`} className="flex items-start justify-between gap-2 py-2">
          <span className="min-w-0">
            <span className="block text-[13px] text-ink">{a.esito === 'ok' ? [a.ente, a.nome].filter(Boolean).join(', ') || 'Accesso' : 'Tentativo con PIN errato'}</span>
            {a.aperto && a.esito === 'ok' && <span className="block truncate text-[11.5px] text-ink-muted">Ha aperto: {a.aperto}</span>}
          </span>
          <span className={clsx('cifre shrink-0 text-[11.5px]', a.esito === 'ok' ? 'text-ink-muted' : 'text-danger-ink')}>{dataCr(a.quando, true)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Stato sintetico del passaporto attivo (usato anche nel pannello della chat). */
export function StatoPassaporto({ p }: { p: PassaportoVista }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
      <dt className="text-ink-muted">Stato</dt>
      <dd className={clsx('font-semibold', p.valido ? 'text-ok-ink' : 'text-danger-ink')}>{p.valido ? 'Attivo' : 'Non valido'}</dd>
      <dt className="text-ink-muted">Scadenza</dt>
      <dd className="text-ink">{p.scade_il ? dataCr(p.scade_il) : 'Nessuna'}</dd>
      <dt className="text-ink-muted">Sezioni visibili</dt>
      <dd className="cifre text-ink">{p.sezioni.length} su 10</dd>
      <dt className="text-ink-muted">Accessi</dt>
      <dd className="text-ink">
        <span className="cifre">{p.accessi_totali}</span>
        {p.ultimo_accesso && <span className="text-ink-muted">, ultimo {dataCr(p.ultimo_accesso, true)}</span>}
      </dd>
    </dl>
  );
}

function CodiceQr({ id, disponibile }: { id: number; disponibile: boolean }) {
  const ds = useDataSource();
  const [url, setUrl] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    let creato: string | null = null;
    setPronto(false);
    ds.controlRoom
      .qrSvgUrl(id)
      .then((u) => {
        creato = u;
        if (vivo) setUrl(u);
      })
      .catch(() => vivo && setUrl(null))
      .finally(() => vivo && setPronto(true));
    return () => {
      vivo = false;
      if (creato) URL.revokeObjectURL(creato);
    };
  }, [ds, id, disponibile]);
  return (
    <div className="flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-[0.875rem] bg-white p-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.1)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Codice QR del Safety Passport" className="h-full w-full object-contain" />
      ) : (
        <span className="flex flex-col items-center gap-1.5 px-2 text-center text-[11px] leading-snug text-ink-muted">
          <Qr size={30} aria-hidden className="text-brand-300" />
          {pronto ? 'Il QR lo prepara il server collegato' : 'Carico il QR'}
        </span>
      )}
    </div>
  );
}

function AppenaCreato({ c, onChiudi }: { c: PassaportoCreato; onChiudi: () => void }) {
  const [copiato, setCopiato] = useState<string | null>(null);
  const copia = async (cosa: string, testo: string) => {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(cosa);
    } catch {
      setCopiato(null);
    }
  };
  return (
    <section role="alert" aria-labelledby="pass-nuovo" className="rounded-[0.875rem] bg-oro-50 p-3.5 shadow-[inset_0_0_0_1px_rgba(103,127,2,0.55)]">
      <p id="pass-nuovo" className="flex items-start gap-2 text-[13.5px] font-semibold text-oro-700">
        <Avviso size={17} aria-hidden className="mt-0.5 shrink-0" />
        Annota ora PIN e link: non verranno più mostrati.
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
        Dai il PIN solo a chi controlla. Se lo perdi, crea un nuovo passaporto: quello attuale viene revocato.
      </p>
      <dl className="mt-3 space-y-2">
        <div>
          <dt className="text-[11.5px] text-ink-muted">PIN</dt>
          <dd className="flex items-center gap-2">
            <span className="cifre text-[26px] font-semibold tracking-[0.18em] text-brand-900">{c.pin}</span>
            <button type="button" onClick={() => void copia('pin', c.pin)} className={LINK_CR}>
              <Copia size={15} aria-hidden /> {copiato === 'pin' ? 'Copiato' : 'Copia'}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-muted">Link del passaporto</dt>
          <dd className="flex items-center gap-2">
            <span className="cifre min-w-0 flex-1 break-all text-[11.5px] text-ink-soft">{c.link || c.token}</span>
            <button type="button" onClick={() => void copia('link', c.link || c.token)} className={clsx(LINK_CR, 'shrink-0')}>
              <Copia size={15} aria-hidden /> {copiato === 'link' ? 'Copiato' : 'Copia'}
            </button>
          </dd>
        </div>
      </dl>
      <button type="button" onClick={onChiudi} className="btn-primary mt-3 min-h-[44px] w-full">
        Ho annotato PIN e link
      </button>
    </section>
  );
}

function NuovoPassaporto({ aziendaId, sostituisce, onCreato, onAnnulla }: { aziendaId: number; sostituisce: boolean; onCreato: (c: PassaportoCreato) => void; onAnnulla: () => void }) {
  const ds = useDataSource();
  const [pin, setPin] = useState('');
  const [scade, setScade] = useState('');
  const [sezioni, setSezioni] = useState<PassaportoSezione[]>(SEZIONI_PASSAPORTO.map((s) => s.v));
  const [salvo, setSalvo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const crea = async (e: FormEvent) => {
    e.preventDefault();
    setSalvo(true);
    setErr(null);
    try {
      onCreato(await ds.controlRoom.creaPassaporto(aziendaId, { pin: pin.trim() || undefined, scade_il: scade || undefined, sezioni: sezioni.length === 10 ? undefined : sezioni }));
    } catch (x) {
      setErr(testoErrore(x, 'Passaporto non creato.'));
    } finally {
      setSalvo(false);
    }
  };
  return (
    <form onSubmit={(e) => void crea(e)} className="space-y-3 rounded-[0.875rem] bg-perla-superficie p-3.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]">
      {sostituisce && <p className="text-[12.5px] text-warn-ink">Il nuovo passaporto revoca quello attuale: il vecchio QR smette di funzionare.</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Etichetta htmlFor="pass-pin">PIN (facoltativo)</Etichetta>
          <input id="pass-pin" className={CAMPO} inputMode="numeric" pattern="\d{4,8}" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="6 cifre a caso" />
        </div>
        <div>
          <Etichetta htmlFor="pass-scad">Scade il (facoltativo)</Etichetta>
          <input id="pass-scad" type="date" className={CAMPO} value={scade} onChange={(e) => setScade(e.target.value)} />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-[12px] font-medium text-ink-muted">Cosa può vedere chi controlla</legend>
        <div className="grid grid-cols-2 gap-x-2">
          {SEZIONI_PASSAPORTO.map((s) => (
            <label key={s.v} className="flex min-h-[40px] items-center gap-2 text-[12.5px] text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-800"
                checked={sezioni.includes(s.v)}
                onChange={(e) => setSezioni(e.target.checked ? [...sezioni, s.v] : sezioni.filter((x) => x !== s.v))}
              />
              {s.l}
            </label>
          ))}
        </div>
      </fieldset>
      {err && <Errore testo={err} />}
      <div className="flex gap-2">
        <button type="submit" disabled={salvo || sezioni.length === 0} className="btn-primary min-h-[44px] flex-1">
          {salvo ? 'Creo il passaporto' : 'Crea il passaporto'}
        </button>
        <button type="button" onClick={onAnnulla} className="btn-ghost min-h-[44px]">
          Annulla
        </button>
      </div>
    </form>
  );
}

/** QR Safety Passport: QR, stato, accessi, creazione e revoca. */
export function Passaporto({ aziendaId, ruolo, versione }: SchedaControlRoomProps) {
  const ds = useDataSource();
  const st = useDato(() => ds.controlRoom.passaporto(aziendaId), [ds, aziendaId, versione]);
  const [creando, setCreando] = useState(false);
  const [creato, setCreato] = useState<PassaportoCreato | null>(null);
  const [revoca, setRevoca] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gestisce = gestiscePassaporto(ruolo);

  const scarica = async (id: number) => {
    setErr(null);
    try {
      await ds.controlRoom.scaricaQrPdf(id);
    } catch (e) {
      setErr(testoErrore(e, 'Foglio non disponibile.'));
    }
  };
  // Condivide il link appena creato o, in seguito, l'immagine del QR (il token non e' piu' leggibile).
  const condividi = async (id: number) => {
    setErr(null);
    try {
      if (creato?.link && navigator.share) {
        await navigator.share({ title: 'Safety Passport', text: 'Documenti di sicurezza dell’azienda (serve il PIN).', url: creato.link });
        return;
      }
      const u = await ds.controlRoom.qrSvgUrl(id);
      if (!u) throw new Error('Il QR non è disponibile: scarica il foglio stampabile.');
      const file = new File([await (await fetch(u)).blob()], 'Safety_Passport.svg', { type: 'image/svg+xml' });
      URL.revokeObjectURL(u);
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Safety Passport' });
      else await scarica(id);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setErr(testoErrore(e, 'Condivisione non riuscita.'));
    }
  };

  if (st.inCorso && !st.dato) return <Caricamento testo="Carico il passaporto" />;
  if (st.errore) return <Errore testo={st.errore} onRiprova={st.ricarica} />;
  const d = st.dato;
  if (!d) return null;
  const p = d.attivo;

  return (
    <div className="space-y-3 py-3">
      {creato && <AppenaCreato c={creato} onChiudi={() => setCreato(null)} />}
      {p ? (
        <>
          <div className="flex items-start gap-3.5">
            <CodiceQr id={p.id} disponibile={p.qr_disponibile} />
            <div className="min-w-0 flex-1">
              <StatoPassaporto p={p} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void scarica(p.id)} className="btn-ghost min-h-[44px] flex-1">
              <Download size={15} aria-hidden /> Foglio da stampare
            </button>
            <button type="button" onClick={() => void condividi(p.id)} className="btn-ghost min-h-[44px] flex-1">
              <Condividi size={15} aria-hidden /> Condividi
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-subtle">Il PIN non è mai sul foglio. I dati sanitari dei lavoratori non sono consultabili.</p>
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-[0.875rem] bg-perla-superficie p-3.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.07)]">
          <Qr size={28} aria-hidden className="shrink-0 text-brand-300" />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {gestisce
              ? 'Nessun passaporto attivo. Crealo per far consultare a un ispettore i documenti essenziali con un QR e un PIN, con ogni accesso registrato.'
              : d.nota ?? 'Nessun passaporto attivo: lo crea il consulente.'}
          </p>
        </div>
      )}

      {err && <Errore testo={err} />}

      {gestisce &&
        (creando ? (
          <NuovoPassaporto
            aziendaId={aziendaId}
            sostituisce={!!p}
            onAnnulla={() => setCreando(false)}
            onCreato={(c) => {
              setCreando(false);
              setCreato(c);
              st.ricarica();
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCreando(true)} className={p ? 'btn-ghost min-h-[44px] flex-1' : 'btn-primary min-h-[44px] flex-1'}>
              {p ? 'Crea un nuovo passaporto' : 'Crea il passaporto'}
            </button>
            {p && (
              <button type="button" onClick={() => setRevoca(true)} className="btn-ghost min-h-[44px] flex-1 text-danger-ink">
                Revoca
              </button>
            )}
          </div>
        ))}

      {p && (
        <section>
          <Titoletto>Accessi recenti</Titoletto>
          <ElencoAccessi accessi={d.accessi} />
        </section>
      )}

      {p && (
        <ConfirmDialog
          open={revoca}
          title="Revocare il passaporto?"
          message="Il QR e il PIN smettono subito di funzionare. Potrai crearne uno nuovo in qualsiasi momento."
          confirmLabel="Revoca"
          destructive
          busy={lavoro}
          error={err}
          onCancel={() => setRevoca(false)}
          onConfirm={async () => {
            setLavoro(true);
            setErr(null);
            try {
              await ds.controlRoom.revocaPassaporto(p.id);
              setRevoca(false);
              setCreato(null);
              st.ricarica();
            } catch (e) {
              setErr(testoErrore(e, 'Revoca non riuscita.'));
            } finally {
              setLavoro(false);
            }
          }}
        />
      )}
    </div>
  );
}
