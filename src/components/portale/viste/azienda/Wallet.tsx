'use client';

import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Riga, Scheda, Testata, Vuoto, dataIt } from '../../kit';
import { useCarico } from '../amministrazione-kit';
import { walletAzienda, type Saldo } from '@/lib/portale/amministrazione-api';
import { TIPI_MOVIMENTO, euro, euroSegno, quoteWallet } from '@/lib/portale/amministrazione-logica';
import { Portafoglio } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import MetodoPagamento from '../condivisi/MetodoPagamento';

/** Wallet e pagamenti (SPEC_AREA_AZIENDA 11): registro interno, il titolare vede i movimenti, il referente il saldo. */
export default function Wallet() {
  const { azienda, versione, puo } = usePortale();
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica } = useCarico(() => walletAzienda(aid), [aid, versione]);
  if (!azienda) return null;

  return (
    <div className="space-y-5">
      <Testata
        categoria="pagamenti"
        icona={Portafoglio}
        sopra={azienda.ragione_sociale}
        titolo="Wallet e pagamenti"
        sotto={dati ? `Saldo ${euro(dati.saldo.totale)} · fondi ${euro(dati.saldo.fondi)} e crediti omaggio ${euro(dati.saldo.omaggio)}` : undefined}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}
      {dati && (
        <>
          <RiquadroSaldo saldo={dati.saldo} />
          {puo('contratto_fatture') && <MetodoPagamento aziendaId={aid} />}
          {!dati.dettaglio ? (
            <Scheda titolo="Come usarlo">
              <p className="text-[14px] leading-relaxed text-ink-muted">Quando richiedi un servizio, il titolare lo approva e lo paga con il wallet. Tu vedi solo il saldo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Blocco>Movimenti riservati al titolare</Blocco>
              </div>
            </Scheda>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Scheda titolo="Crediti omaggio" sotto="Non si convertono in denaro e non si trasferiscono.">
                {dati.saldo.lotti.filter((l) => l.stato === 'attivo').length === 0 ? (
                  <p className="text-[14px] text-ink-muted">Nessun credito omaggio attivo.</p>
                ) : (
                  dati.saldo.lotti
                    .filter((l) => l.stato === 'attivo')
                    .map((l) => (
                      <Riga key={l.id} titolo={l.causale} sotto={`Scade il ${dataIt(l.scade_il)} · vale per ${l.ambiti.map((a) => (a === 'quota_ingresso' ? 'quote d\'ingresso' : a)).join(', ')}`} fine={<span className="cifre text-[15px]">{euro(l.residuo)}</span>} />
                    ))
                )}
              </Scheda>
              <Scheda titolo="Ultimi movimenti">
                {dati.movimenti.length === 0 ? (
                  <Vuoto titolo="Nessun movimento">Le ricariche le registra lo studio quando riceve il bonifico.</Vuoto>
                ) : (
                  dati.movimenti.slice(0, 20).map((m) => (
                    <Riga
                      key={m.id}
                      titolo={m.causale}
                      sotto={`${dataIt(m.creato)} · ${TIPI_MOVIMENTO[m.tipo] ?? m.tipo}${m.saldo === 'omaggio' ? ' · crediti omaggio' : ''}`}
                      fine={<span className={clsx('cifre text-[15px]', m.importo > 0 ? 'text-stato-ok-segno' : 'text-ink')}>{euroSegno(m.importo)}</span>}
                    />
                  ))
                )}
              </Scheda>
            </div>
          )}
          <Scheda titolo="Regole d'uso">
            <ul className="space-y-2 text-[14px] leading-relaxed text-ink">
              {dati.regole.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-grafite-400" />
                  {r}
                </li>
              ))}
            </ul>
          </Scheda>
        </>
      )}
    </div>
  );
}

export function RiquadroSaldo({ saldo }: { saldo: Saldo }) {
  const q = quoteWallet(saldo.fondi, saldo.omaggio);
  return (
    <section className="rounded-[1.75rem] bg-black p-5 text-white sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] text-grafite-300">Saldo disponibile</p>
          <p className="cifre mt-1 text-[44px] font-light leading-none tracking-[-0.04em]">{euro(saldo.totale)}</p>
        </div>
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-acido-400 text-acido-950">
          <Portafoglio size={20} />
        </span>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-grafite-800" aria-hidden>
        <span className="bg-white" style={{ width: `${q.fondi}%` }} />
        <span className="bg-acido-400" style={{ width: `${q.omaggio}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] text-grafite-300">
            <span aria-hidden className="h-2 w-2 rounded-full bg-white" /> Fondi ricaricati
          </p>
          <p className="cifre text-[20px]">{euro(saldo.fondi)}</p>
          <p className="text-[12px] text-grafite-400">Non scadono</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[13px] text-grafite-300">
            <span aria-hidden className="h-2 w-2 rounded-full bg-acido-400" /> Crediti omaggio
          </p>
          <p className="cifre text-[20px]">{euro(saldo.omaggio)}</p>
          <p className="text-[12px] text-grafite-400">{saldo.in_scadenza_30 > 0 ? `${euro(saldo.in_scadenza_30)} scadono entro 30 giorni` : 'Hanno una scadenza'}</p>
        </div>
      </div>
    </section>
  );
}
