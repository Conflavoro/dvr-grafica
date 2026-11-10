'use client';

import { useCallback, useEffect, useState } from 'react';
import { Blocco, Chip, Scheda, dataIt, type StatoChip } from '../../kit';
import { adesioneSuccessiva, adesioniGestionale, emettiConguaglio, esitoAdesione, euro, type AdesioniGestionale } from '@/lib/portale/amministrazione-pagamenti';

const CHIP: Record<string, StatoChip> = { da_verificare: 'warn', in_verifica: 'info', verificata: 'ok', non_risulta: 'danger', non_serve: 'neutral', ridotta: 'ok' };

/**
 * Scheda "Adesioni" dell'azienda nel gestionale (regole di business 6.3).
 * Componente autonomo: S7 lo inserisce nella scheda Aziende con
 * <AdesioniAzienda aziendaId={id} onCambio={ricarica} />.
 *
 *  - "Verificata" e "Non risulta": segreteria soci (confermaAdesione), altrimenti "Le verifica la segreteria soci";
 *  - "Emetti il conguaglio": amministrazione (registraIncasso), altrimenti "Lo emette l'amministrazione";
 *  - "Adesione successiva": toglie la maggiorazione dal 15 del mese dopo.
 */
export default function AdesioniAzienda({ aziendaId, onCambio }: { aziendaId: number; onCambio?: () => void }) {
  const [a, setA] = useState<AdesioniGestionale | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const carica = useCallback(() => {
    adesioniGestionale(aziendaId)
      .then((x) => {
        setA(x);
        setErrore(null);
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Non riesco a leggere le adesioni.'));
  }, [aziendaId]);
  useEffect(carica, [carica]);
  const fai = async (f: () => Promise<string | null>) => {
    setOccupato(true);
    try {
      setMsg(await f());
      carica();
      onCambio?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setOccupato(false);
    }
  };
  if (errore) return <p className="text-[13px] text-stato-danger-ink">{errore}</p>;
  if (!a) return null;
  if (a.voci.length === 0) return <Scheda titolo="Adesioni">Le adesioni nascono all&apos;attivazione del cliente.</Scheda>;
  return (
    <Scheda titolo="Adesioni" sotto={a.entro ? `Da verificare entro il ${dataIt(a.entro)}` : undefined}>
      <ul className="divide-y divide-perla-linea">
        {a.voci.map((v) => (
          <li key={v.ente} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{v.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">Dichiarato: {v.dichiarato.toLowerCase()}</span>
              </span>
              <Chip stato={CHIP[v.stato] ?? 'neutral'}>{v.etichetta}</Chip>
              {(v.stato === 'da_verificare' || v.stato === 'in_verifica') &&
                (a.puoConfermare ? (
                  <>
                    <button type="button" className="btn-ghost" disabled={occupato} onClick={() => void fai(() => esitoAdesione(aziendaId, v.ente, 'verificata'))}>
                      Verificata
                    </button>
                    <button type="button" className="btn-ghost" disabled={occupato} onClick={() => void fai(() => esitoAdesione(aziendaId, v.ente, 'non_risulta'))}>
                      Non risulta
                    </button>
                  </>
                ) : (
                  <Blocco>Le verifica la segreteria soci</Blocco>
                ))}
              {(v.stato === 'non_serve' || v.stato === 'non_risulta') && a.puoConfermare && (
                <button type="button" className="btn-ghost" disabled={occupato} onClick={() => void fai(() => adesioneSuccessiva(aziendaId, v.ente, new Date().toISOString().slice(0, 10)))}>
                  Adesione successiva
                </button>
              )}
            </div>
            {v.nonRisulta && (
              <div className="mt-2 rounded-[1rem] bg-perla-velo px-3 py-2 text-[13px]">
                <p className="text-ink">{v.nonRisulta.dettaglio || `Conguaglio ${euro(v.nonRisulta.conguaglio)}`}</p>
                {v.nonRisulta.pagato ? (
                  <Chip stato="ok">Conguaglio pagato</Chip>
                ) : v.emesso ? (
                  <Chip stato="info">Conguaglio emesso</Chip>
                ) : a.puoEmettere ? (
                  <button type="button" className="btn-primary mt-2" disabled={occupato} onClick={() => void fai(() => emettiConguaglio(aziendaId, v.ente))}>
                    Emetti il conguaglio
                  </button>
                ) : (
                  <Blocco>Lo emette l&apos;amministrazione</Blocco>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {msg && (
        <p className="mt-2 text-[13px] text-ink-soft" role="status">
          {msg}
        </p>
      )}
    </Scheda>
  );
}
