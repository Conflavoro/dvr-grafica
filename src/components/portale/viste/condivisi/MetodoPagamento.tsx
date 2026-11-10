'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Foglio, Scheda } from '../../kit';
import { controllaCarta, controllaSepa, erroriServer, metodiPagamento, salvaCarta, salvaSepa, type Errori, type MetodiPagamento } from '@/lib/portale/amministrazione-pagamenti';

/**
 * Metodo di pagamento predefinito (carta o addebito SEPA) per il canone del 15
 * e per la differenza del wallet. Solo il titolare lo cambia.
 */
export default function MetodoPagamento({ aziendaId }: { aziendaId: number }) {
  const [m, setM] = useState<MetodiPagamento | null>(null);
  const [aperto, setAperto] = useState(false);
  const carica = useCallback(() => {
    metodiPagamento(aziendaId)
      .then(setM)
      .catch(() => setM(null));
  }, [aziendaId]);
  useEffect(carica, [carica]);
  if (!m) return null;
  return (
    <Scheda titolo="Metodo di pagamento" sotto="Il canone si addebita il 15 di ogni mese su questo metodo.">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-ink">{m.predefinito ? m.predefinito.etichetta + (m.predefinito.scadenza ? ` · scade ${m.predefinito.scadenza}` : '') : 'Nessun metodo salvato'}</p>
        {m.puoPagare && (
          <button type="button" className="btn-ghost" onClick={() => setAperto(true)}>
            {m.predefinito ? 'Cambia' : 'Aggiungi'}
          </button>
        )}
      </div>
      <FoglioMetodo aperto={aperto} aziendaId={aziendaId} onChiudi={() => setAperto(false)} onSalvato={carica} />
    </Scheda>
  );
}

function FoglioMetodo({ aperto, aziendaId, onChiudi, onSalvato }: { aperto: boolean; aziendaId: number; onChiudi: () => void; onSalvato: () => void }) {
  const [tipo, setTipo] = useState<'carta' | 'sepa'>('carta');
  const [carta, setCarta] = useState({ numero: '', scadenza: '', cvc: '' });
  const [sepa, setSepa] = useState({ intestatario: '', iban: '', mandato: false });
  const [err, setErr] = useState<Errori>({});
  const [msg, setMsg] = useState<string | null>(null);
  const salva = async () => {
    const e = tipo === 'carta' ? controllaCarta(carta) : controllaSepa(sepa);
    setErr(e);
    if (Object.keys(e).length) return;
    try {
      if (tipo === 'carta') await salvaCarta(aziendaId, carta);
      else await salvaSepa(aziendaId, { ...sepa, iban: sepa.iban.replace(/\s+/g, '').toUpperCase() });
      onSalvato();
      onChiudi();
    } catch (x) {
      setErr(erroriServer(x) ?? {});
      setMsg(x instanceof Error ? x.message : 'Salvataggio non riuscito.');
    }
  };
  const campo = (id: string, et: string, v: string, set: (v: string) => void, e?: string, extra: Record<string, string> = {}) => (
    <div>
      <label htmlFor={id} className="block text-[12.5px] text-ink-muted">
        {et}
      </label>
      <input id={id} className="input-field mt-1" value={v} aria-invalid={!!e} onChange={(x) => set(x.target.value)} {...extra} />
      {e && <p className="mt-1 text-[12.5px] text-stato-danger-ink">{e}</p>}
    </div>
  );
  return (
    <Foglio aperto={aperto} titolo="Metodo di pagamento" onChiudi={onChiudi} piede={<button type="button" className="btn-primary" onClick={() => void salva()}>Salva</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
          {(['carta', 'sepa'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={tipo === k} onClick={() => setTipo(k)} className={clsx('premi rounded-[1rem] px-3 py-2.5 text-[14px]', tipo === k ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}>
              {k === 'carta' ? 'Carta' : 'Addebito SEPA'}
            </button>
          ))}
        </div>
        {tipo === 'carta' ? (
          <>
            {campo('mp-numero', 'Numero della carta', carta.numero, (v) => setCarta({ ...carta, numero: v }), err.numero, { inputMode: 'numeric', autoComplete: 'cc-number' })}
            {campo('mp-scad', 'Scadenza (MM/AA)', carta.scadenza, (v) => setCarta({ ...carta, scadenza: v }), err.scadenza, { autoComplete: 'cc-exp' })}
            {campo('mp-cvc', 'CVC', carta.cvc, (v) => setCarta({ ...carta, cvc: v }), err.cvc, { inputMode: 'numeric', autoComplete: 'cc-csc' })}
            <p className="text-[12px] text-ink-muted">Nel servizio vero il pagamento passa da Stripe: noi teniamo solo marca, ultime 4 cifre e scadenza.</p>
          </>
        ) : (
          <>
            {campo('mp-int', 'Intestatario del conto', sepa.intestatario, (v) => setSepa({ ...sepa, intestatario: v }), err.intestatario)}
            {campo('mp-iban', 'IBAN', sepa.iban, (v) => setSepa({ ...sepa, iban: v.toUpperCase() }), err.iban, { autoComplete: 'off' })}
            <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#18181B]" checked={sepa.mandato} onChange={(e) => setSepa({ ...sepa, mandato: e.target.checked })} />
              Autorizzo ISFOR ad addebitare il canone sul conto ogni mese (mandato SEPA)
            </label>
            {err.mandato && <p className="text-[12.5px] text-stato-danger-ink">{err.mandato}</p>}
          </>
        )}
        {msg && Object.keys(err).length === 0 && <p className="text-[12.5px] text-stato-danger-ink">{msg}</p>}
      </div>
    </Foglio>
  );
}
