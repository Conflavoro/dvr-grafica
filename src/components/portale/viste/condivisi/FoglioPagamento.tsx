'use client';

import { useEffect, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Foglio } from '../../kit';
import { euro, metodiPagamento, type EsitoPagamento, type MetodiPagamento, type MetodoFoglio } from '@/lib/portale/amministrazione-pagamenti';

/**
 * Foglio di pagamento comune (regole di business 5.6): servizi, fatture, quote
 * d'ingresso, conguagli, rinnovo. Mai per il primo canone (quello sta nel passo 5
 * dell'attivazione).
 *
 *  - chi non è titolare vede "Solo il titolare può pagare" e "Chiedi al titolare";
 *  - il titolare sceglie Wallet (predefinito), Carta predefinita o Bonifico;
 *  - wallet: prima i crediti omaggio dell'ambito, poi i fondi, poi la differenza sulla carta;
 *  - bonifico: "Non serve la causale", poi "In attesa del bonifico".
 *
 * Chi lo apre passa "paga": la chiamata del proprio oggetto (es. pagaConguaglio,
 * pagaFattura, o quella dell'ordine) che sul server usa App\Services\Pagamenti\Pagamenti::paga.
 */
export interface FoglioPagamentoProps {
  aperto: boolean;
  onChiudi: () => void;
  aziendaId: number;
  /** Es. "Conguaglio". */
  titolo: string;
  /** Es. "Conguaglio EBIASP · 4 mesi". */
  voce: string;
  /** Importo in euro. */
  importo: number;
  paga: (metodo: MetodoFoglio) => Promise<EsitoPagamento>;
  onPagato?: (e: EsitoPagamento) => void;
}

const METODI: Array<[MetodoFoglio, string, string]> = [
  ['wallet', 'Wallet', 'Prima i crediti omaggio, poi i fondi; la differenza sulla carta'],
  ['carta', 'Carta predefinita', ''],
  ['bonifico', 'Bonifico', 'Sull\'IBAN dedicato'],
];

export default function FoglioPagamento({ aperto, onChiudi, aziendaId, titolo, voce, importo, paga, onPagato }: FoglioPagamentoProps) {
  const [m, setM] = useState<MetodiPagamento | null>(null);
  const [scelto, setScelto] = useState<MetodoFoglio>('wallet');
  const [esito, setEsito] = useState<EsitoPagamento | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    setEsito(null);
    setErrore(null);
    setScelto('wallet');
    metodiPagamento(aziendaId)
      .then(setM)
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Non riesco a leggere i metodi di pagamento.'));
  }, [aperto, aziendaId]);

  const vai = async (metodo: MetodoFoglio) => {
    setErrore(null);
    setOccupato(true);
    try {
      const e = await paga(metodo);
      setEsito(e);
      if (e.stato === 'riuscito' || e.stato === 'in_attesa') onPagato?.(e);
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Pagamento non riuscito.');
    } finally {
      setOccupato(false);
    }
  };

  const titolare = m?.puoPagare ?? false;
  const fatto = esito !== null;
  return (
    <Foglio
      aperto={aperto}
      titolo={titolo}
      onChiudi={onChiudi}
      piede={
        fatto ? (
          <button type="button" className="btn-primary" onClick={onChiudi}>
            Chiudi
          </button>
        ) : m === null ? undefined : titolare ? (
          <button type="button" className="btn-acido" disabled={occupato} onClick={() => void vai(scelto)}>
            {scelto === 'bonifico' ? 'Pago con bonifico' : `Paga ${euro(importo)}`}
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={occupato} onClick={() => void vai('wallet')}>
            Chiedi al titolare
          </button>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-[1.25rem] bg-perla-velo p-4">
          <p className="text-[13px] text-ink-muted">{voce}</p>
          <p className="cifre mt-0.5 text-[30px] font-light leading-none text-ink">{euro(importo)}</p>
        </div>
        {fatto ? (
          <div role="status" className="space-y-2">
            <p className="text-[16px] font-medium text-ink">{esito.messaggio ?? (esito.stato === 'riuscito' ? 'Pagamento riuscito' : 'Fatto')}</p>
            {esito.stato === 'in_attesa' && esito.iban && (
              <p className="text-[13.5px] text-ink-soft">
                IBAN <span className="cifre">{esito.iban}</span>
              </p>
            )}
            {esito.nota && <p className="text-[13px] text-ink-muted">{esito.nota}</p>}
            {esito.daWallet > 0 && esito.stato === 'riuscito' && <p className="text-[13px] text-ink-muted">Dal wallet {euro(esito.daWallet)}, il resto sulla carta.</p>}
          </div>
        ) : m && !titolare ? (
          <p className="text-[14px] text-ink-soft">Solo il titolare può pagare. Gli mandiamo una notifica e un&apos;email con la richiesta.</p>
        ) : (
          m && (
            <div className="grid gap-2" role="radiogroup" aria-label="Come vuoi pagare">
              {METODI.map(([k, t, s]) => {
                const disabilitato = k === 'carta' && m.predefinito?.tipo !== 'carta';
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={scelto === k}
                    disabled={disabilitato}
                    onClick={() => setScelto(k)}
                    className={clsx('premi rounded-[1.25rem] p-3.5 text-left disabled:opacity-50', scelto === k ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}
                  >
                    <span className="block text-[14.5px] font-medium">{t}</span>
                    <span className={clsx('block text-[12.5px]', scelto === k ? 'text-grafite-300' : 'text-ink-muted')}>
                      {k === 'carta' ? (m.predefinito?.tipo === 'carta' ? m.predefinito.etichetta : 'Nessuna carta salvata') : s}
                    </span>
                  </button>
                );
              })}
              {scelto === 'bonifico' && (
                <p className="text-[13px] text-ink-muted">Non serve la causale: riconosciamo il bonifico in automatico. Un servizio urgente parte all&apos;accredito.</p>
              )}
            </div>
          )
        )}
        {errore && (
          <p className="text-[13px] text-stato-danger-ink" role="alert">
            {errore}
          </p>
        )}
      </div>
    </Foglio>
  );
}
