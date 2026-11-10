'use client';

import { useState } from 'react';
import { Avviso, Calendario, Luogo } from '@/components/icone';
import { cambioDataLavoratore, type AppuntamentoLavoratore, type LinkLavoratore } from '@/lib/data-source';
import { Chip } from '@/components/portale/kit';
import { clsx } from '@/lib/clsx';

const fmtLungo = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
export const giornoLungo = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : fmtLungo.format(d);
};

export const CAMPO =
  'block w-full rounded-[1rem] bg-white px-4 py-3 text-[16px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5] placeholder:text-ink-subtle focus:outline-none focus:shadow-[inset_0_0_0_2px_#18181b]';

/** Visita o corso fissato e comunicato (il lavoratore non conferma, 09): cambio data, posizione, cosa portare, disdetta gratuita. */
export function Appuntamento({ a, token, onAggiornato }: { a: AppuntamentoLavoratore; token: string; onAggiornato: (v: LinkLavoratore) => void }) {
  const [invio, setInvio] = useState(false);
  const [cambio, setCambio] = useState(false);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const esegui = async (fn: () => Promise<LinkLavoratore>) => {
    setInvio(true);
    setErr(null);
    try {
      onAggiornato(await fn());
      setCambio(false);
      setNota('');
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : 'Operazione non riuscita. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <li className="rounded-[1.25rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-medium leading-snug text-ink">{a.cosa}</p>
        <Chip stato="info">Prenotata</Chip>
      </div>
      <p className="mt-3 flex items-start gap-2.5 text-[15px] text-ink">
        <Calendario size={18} aria-hidden className="mt-1 shrink-0 text-ink-muted" />
        <span>
          <span className="block first-letter:uppercase">{giornoLungo(a.data)}</span>
          <span className="cifre block text-[30px] font-light leading-tight tracking-[-0.03em]">ore {a.ora}</span>
        </span>
      </p>
      {a.luogo && (
        <p className="mt-2 flex items-start gap-2.5 text-[14.5px] text-ink-soft">
          <Luogo size={18} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          <span className="min-w-0">
            {a.luogo}
            {a.maps_url && (
              <a href={a.maps_url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium text-ink underline underline-offset-4">
                Apri la posizione in Maps
              </a>
            )}
          </span>
        </p>
      )}
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">Cosa portare: {a.cosa_portare}</p>
      <p className={clsx('mt-1.5 text-[13.5px] leading-relaxed', a.disdetta_gratuita_scaduta ? 'text-stato-danger-ink' : 'text-ink-muted')}>
        {a.disdetta_gratuita_scaduta
          ? 'Il termine per spostare senza costi è passato: se non puoi venire, chiama subito la segreteria.'
          : `Puoi spostare senza costi fino a ${giornoLungo(a.disdetta_gratuita_entro)}.`}
      </p>

      {err && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-[1rem] bg-stato-danger px-3.5 py-3 text-[14px] text-stato-danger-ink">
          <Avviso size={18} aria-hidden className="mt-0.5 shrink-0" />
          {err}
        </p>
      )}

      {cambio ? (
        <div className="mt-4 space-y-3">
          <label htmlFor={`nota-${a.id}`} className="block text-[13px] font-medium text-ink-soft">
            Quando preferisci? (facoltativo)
          </label>
          <textarea
            id={`nota-${a.id}`}
            className={CAMPO}
            rows={3}
            maxLength={300}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ad esempio: la settimana dopo, di mattina"
          />
          <button type="button" disabled={invio} onClick={() => void esegui(() => cambioDataLavoratore(token, a.id, nota.trim()))} className="btn-primary w-full">
            {invio ? 'Invio la richiesta' : 'Chiedi un’altra data'}
          </button>
          <button type="button" disabled={invio} onClick={() => setCambio(false)} className="btn-ghost w-full">
            Annulla
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <button type="button" disabled={invio} onClick={() => setCambio(true)} className="btn-ghost w-full">
            Cambia data
          </button>
        </div>
      )}
    </li>
  );
}
