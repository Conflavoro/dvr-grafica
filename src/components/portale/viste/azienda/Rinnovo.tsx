'use client';

import { useCallback, useEffect, useState } from 'react';
import { Chip, Riquadro, Scheda, dataIt } from '../../kit';
import FoglioFirma from '../condivisi/FoglioFirma';
import FoglioPagamento from '../condivisi/FoglioPagamento';
import { codiceRinnovo, euro, firmaRinnovo, pagaRinnovo, rinnovo as leggiRinnovo, type StatoRinnovo } from '@/lib/portale/amministrazione-pagamenti';

/**
 * Rinnovo (scheda del Contratto): organico su tre fonti, canone del nuovo anno,
 * conferma, firma con il codice e pagamento dal foglio comune.
 * Stati: da_confermare, firmato, attesa_bonifico, confermato.
 */
export default function Rinnovo({ aziendaId, onCambio }: { aziendaId: number; onCambio?: () => void }) {
  const [r, setR] = useState<StatoRinnovo | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [passo, setPasso] = useState<0 | 1 | 2 | 3>(0);
  const [confermo, setConfermo] = useState(false);
  const carica = useCallback(() => {
    leggiRinnovo(aziendaId)
      .then((x) => {
        setR(x);
        setErrore(null);
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Non riesco a leggere il rinnovo.'));
  }, [aziendaId]);
  useEffect(carica, [carica]);
  if (errore) return <p className="text-[13px] text-ink-muted">{errore}</p>;
  if (!r) return null;
  const fonti: Array<[string, number, string]> = [
    ['Elenco dei dipendenti', r.fonti.elenco, 'Quelli che hai inserito nel portale'],
    ['Denunce EBIASP', r.fonti.ebiasp, 'Lavoratori per cui versi all\'ente bilaterale'],
    ['Visitati e formati', r.fonti.visitatiFormati, 'Lavoratori con visite o corsi registrati'],
  ];
  return (
    <div className="space-y-4">
      {r.stato === 'confermato' && (
        <Scheda titolo="Rinnovo confermato">Abbonamento {r.anno} per {r.organico} lavoratori. Pagato il {dataIt(r.pagatoIl)}. La fattura è tra le tue fatture.</Scheda>
      )}
      {r.stato === 'attesa_bonifico' && <Scheda titolo="Rinnovo firmato, in attesa del bonifico">Appena arriva l&apos;accredito il rinnovo è confermato.</Scheda>}
      {r.stato === 'firmato' && (
        <Scheda titolo="Rinnovo firmato, manca il pagamento" azioni={r.puo ? <button type="button" className="btn-primary" onClick={() => setPasso(3)}>Paga {euro(r.annuo)}</button> : undefined}>
          Completa il pagamento per confermare.
        </Scheda>
      )}
      <Scheda titolo="Verifica dell'organico su tre fonti" sotto="Con numeri diversi vale il più alto. Lo controlliamo ogni mese.">
        <div className="grid gap-2 md:grid-cols-3">
          {fonti.map(([t, n, d]) => (
            <div key={t} className={n === r.organico ? 'rounded-[1.25rem] p-3 shadow-[inset_0_0_0_2px_#18181b]' : 'rounded-[1.25rem] p-3 shadow-[inset_0_0_0_1px_#e2e2e5]'}>
              <p className="text-[12.5px] text-ink-muted">{t}</p>
              <p className="cifre text-[32px] font-light leading-none text-ink">{n}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{d}</p>
              {n === r.organico && <Chip stato="ok">Vale questo</Chip>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-ink">
          Organico per il {r.anno}: <b className="font-medium">{r.organico} lavoratori</b>.
          {r.nonDichiarati.length > 0 && ` La differenza con l'elenco è ${r.nonDichiarati.map((x) => x.nome).join(', ')}, presente nelle denunce EBIASP ma non dichiarato: regolarizzalo prima di rinnovare.`}
        </p>
      </Scheda>
      <div className="grid gap-3 sm:grid-cols-2">
        <Riquadro nero etichetta={`Canone ${r.anno}`} valore={euro(r.mensile).replace('€ ', '')} unita="€ al mese" sotto={`${euro(r.annuo)} l'anno · dal ${dataIt(r.dal)} al ${dataIt(r.al)}`} />
        <Riquadro etichetta="Rispetto a oggi" valore={`${r.differenza >= 0 ? '+' : ''}${euro(r.differenza).replace('€ ', '')}`} unita="€ al mese" sotto={`oggi ${euro(r.oggi)} al mese`} />
      </div>
      <Scheda titolo="Righe del canone">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="py-1 font-normal">Voce</th>
              <th className="py-1 font-normal">Oggi</th>
              <th className="py-1 font-normal">{r.anno}</th>
              <th className="py-1 text-right font-normal">Al mese</th>
            </tr>
          </thead>
          <tbody>
            {r.righe.map((x) => (
              <tr key={x.chiave} className="border-t border-perla-linea">
                <td className="py-2">{x.voce}</td>
                <td className="py-2 text-ink-muted">{x.prima}</td>
                <td className="py-2 font-medium">
                  {x.quantita}
                  {x.quantita !== x.prima ? ` (${x.quantita - x.prima > 0 ? '+' : ''}${x.quantita - x.prima})` : ''}
                </td>
                <td className="cifre py-2 text-right">{euro(x.mensile)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[12.5px] text-ink-muted">{r.nota}</p>
      </Scheda>
      {r.stato === 'da_confermare' && r.puo && (
        <Scheda titolo="Rinnova">
          <p className="text-[13.5px] text-ink-muted">Controlla l&apos;organico, firma il rinnovo e paga. Ci vogliono un paio di minuti.</p>
          <ol className="mt-2 space-y-1 text-[13.5px] text-ink">
            <li>1. Conferma l&apos;organico</li>
            <li>2. Firma il rinnovo con il codice via SMS</li>
            <li>3. Paga: prima il wallet, poi la carta</li>
          </ol>
          <label className="mt-3 flex items-start gap-2.5 text-[14px] text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#18181B]" checked={confermo} onChange={(e) => setConfermo(e.target.checked)} />
            Confermo l&apos;organico di {r.organico} lavoratori
          </label>
          <button type="button" className="btn-acido mt-3 w-full" disabled={!confermo || r.nonDichiarati.length > 0} onClick={() => setPasso(2)}>
            Conferma l&apos;organico e rinnova
          </button>
        </Scheda>
      )}
      <FoglioFirma
        aperto={passo === 2}
        onChiudi={() => setPasso(0)}
        titolo={`Rinnovo ${r.anno}`}
        sotto={`${r.organico} lavoratori · ${euro(r.mensile)} al mese`}
        avvia={() => codiceRinnovo(aziendaId, confermo)}
        firma={async (t, c, l) => {
          setR(await firmaRinnovo(aziendaId, t, c, l));
        }}
        onFirmato={() => window.setTimeout(() => setPasso(3), 100)}
      />
      {passo === 3 && (
        <FoglioPagamento
          aperto
          onChiudi={() => {
            setPasso(0);
            carica();
          }}
          aziendaId={aziendaId}
          titolo="Paga il rinnovo"
          voce={`Rinnovo ${r.anno} · ${r.organico} lavoratori`}
          importo={r.annuo}
          paga={(m) => pagaRinnovo(aziendaId, m)}
          onPagato={() => {
            carica();
            onCambio?.();
          }}
        />
      )}
    </div>
  );
}
