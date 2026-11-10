'use client';

import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Errore, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { ChipStato, Voce, useAzione, useCarico } from '../amministrazione-kit';
import { contrattoAzienda, scaricaFattura } from '@/lib/portale/amministrazione-api';
import { pagaFattura } from '@/lib/portale/amministrazione-pagamenti';
import FoglioPagamento from '../condivisi/FoglioPagamento';
import VerificaAdesioni from '../condivisi/VerificaAdesioni';
import Rinnovo from './Rinnovo';
import { STATI_FATTURA, chip, euro } from '@/lib/portale/amministrazione-logica';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { Firma, Scarica } from '@/components/icone';

type Scheda = 'contratto' | 'rinnovo' | 'fatture';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "2027-10-16" diventa "16 ott": la data intera non entra nel riquadro su tre colonne. */
function giornoMese(d?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  return m ? `${Number(m[3])} ${MESI[Number(m[2]) - 1]}` : '';
}

function anno(d?: string | null): string {
  return /^(\d{4})/.exec(d ?? '')?.[1] ?? '';
}

/**
 * Contratto e fatture: righe del canone, pagamento mensile con addebito il 15,
 * verifica delle adesioni, fatture pagate dal foglio di pagamento comune.
 * La quota associativa resta a parte.
 */
export default function Contratto() {
  const { azienda, puo, versione, ricarica } = usePortale();
  const [scheda, setScheda] = useState<Scheda>('contratto');
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica } = useCarico(() => contrattoAzienda(aid), [aid, versione]);
  const az = useAzione();
  const [daPagareF, setDaPagareF] = useState<Record<string, unknown> | null>(null);
  if (!azienda) return null;
  const k = dati ? rec(dati.contratto) : {};
  const ha = dati !== null && dati.contratto != null;
  const rinnovo = rec(k.rinnovo);
  const fatture = dati ? lista(dati.fatture).map(rec) : [];
  const daPagare = fatture.filter((f) => f.stato !== 'pagata');
  const quota = dati ? rec(dati.quota_associativa) : {};

  return (
    <div className="space-y-5">
      <Testata
        categoria="contratto"
        icona={Firma}
        sopra={azienda.ragione_sociale}
        titolo="Contratto e fatture"
        sotto={ha ? `Contratto ${testo(k.numero)} · dal ${dataIt(testo(k.inizio))} al ${dataIt(testo(k.fine))}` : undefined}
      />
      <Schede<Scheda> etichetta="Sezioni del contratto" attiva={scheda} onCambia={setScheda} voci={[{ k: 'contratto', t: 'Contratto' }, ...(ha ? [{ k: 'rinnovo' as const, t: 'Rinnovo' }] : []), { k: 'fatture', t: 'Fatture', n: daPagare.length }]} />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}

      {dati && scheda === 'contratto' && (
        <>
          {!ha ? (
            <Vuoto titolo="Il contratto non è ancora caricato">Quando accetti il preventivo dello studio il contratto compare qui con il canone e i servizi compresi.</Vuoto>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Riquadro nero etichetta="Canone al mese" valore={euro(numero(k.canone_mensile)).replace(' €', '')} unita="€" sotto={`${euro(numero(k.canone_annuo))} l'anno · ${testo(k.pagamento_testo) ?? ''}`} />
                <Riquadro etichetta="Rinnovo" valore={giornoMese(testo(rinnovo.il))} sotto={`${anno(testo(rinnovo.il))} · ${rinnovo.tacito ? 'tacito' : 'da confermare'}, disdetta entro il ${dataIt(testo(rinnovo.disdetta_entro))}`} />
                <Riquadro etichetta="Stato" valore={testo(k.stato) === 'attivo' ? 'Attivo' : testo(k.stato) === 'in_attesa_pagamento' ? 'Da pagare' : testo(k.stato)?.replace(/_/g, ' ') ?? ''} />
              </div>
              <Scheda titolo="Righe del canone">
                {lista(k.righe).map((r, i) => {
                  const x = rec(r);
                  const dal = testo(x.dal);
                  const al = testo(x.al);
                  const quando = dal && x.attiva !== true ? ` · dal ${dataIt(dal)}` : al ? ` · fino al ${dataIt(al)}` : '';
                  return <Riga key={i} titolo={testo(x.voce) ?? ''} sotto={`${numero(x.quantita)} × ${euro(numero(x.mensile))} al mese${quando}`} fine={<span className="cifre text-[15px]">{euro(numero(x.totale_mese))}</span>} />;
                })}
              </Scheda>
              <VerificaAdesioni aziendaId={aid} onCambio={() => { carica(); ricarica(); }} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Scheda titolo="Cosa comprende l'abbonamento">
                  <ul className="space-y-1.5 text-[14px] text-ink">
                    {lista(k.servizi_inclusi).map((s) => (
                      <li key={String(s)} className="flex gap-2">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cat-contratto-segno" />
                        {String(s)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px] text-ink-muted">{testo(dati.non_inclusi)}</p>
                </Scheda>
                <Scheda titolo="Quota associativa Conflavoro">
                  <Voce k="Fascia" v={numero(quota.fascia) ?? 'non indicata'} />
                  {numero(quota.importo) !== null && <Voce k="Importo" v={`${euro(numero(quota.importo))} l'anno`} />}
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{testo(quota.nota)}</p>
                </Scheda>
              </div>
            </>
          )}
        </>
      )}

      {dati && ha && scheda === 'rinnovo' && <Rinnovo aziendaId={aid} onCambio={() => { carica(); ricarica(); }} />}

      {dati && scheda === 'fatture' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Riquadro etichetta="Da pagare" valore={euro(numero(rec(dati.totali).da_pagare)).replace(' €', '')} unita="€" tono={daPagare.length > 0 ? 'warn' : undefined} />
            <Riquadro etichetta="Pagato quest'anno" valore={euro(numero(rec(dati.totali).pagato_anno)).replace(' €', '')} unita="€" />
          </div>
          <Scheda titolo="Fatture" sotto="Qui trovi solo le fatture dello studio. La quota associativa la fattura Conflavoro.">
            {fatture.length === 0 ? (
              <Vuoto titolo="Nessuna fattura">Le fatture le carica lo studio: le trovi qui e nella cartella Contratto del fascicolo.</Vuoto>
            ) : (
              fatture.map((f) => {
                const id = numero(f.id) ?? 0;
                const num = testo(f.numero) ?? '';
                return (
                  <div key={id} className="flex flex-wrap items-center gap-2 border-b border-perla-linea py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{num}</span>
                      <span className="block text-[12.5px] text-ink-muted">
                        {dataIt(testo(f.data))} · {testo(f.voce)}
                      </span>
                    </span>
                    <span className="cifre text-[15px]">{euro(numero(f.importo))}</span>
                    <ChipStato c={chip(STATI_FATTURA, testo(f.stato))} />
                    {f.ha_pdf === true && (
                      <button type="button" className="btn-icon" aria-label={`Scarica la fattura ${num}`} onClick={() => az.esegui(() => scaricaFattura(id, num))}>
                        <Scarica size={18} aria-hidden />
                      </button>
                    )}
                    {f.stato === 'da_pagare' && (
                      <button type="button" className="btn-primary" onClick={() => setDaPagareF(f)}>
                        {puo('wallet_paga') ? 'Paga' : 'Lo paga il titolare'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </Scheda>
        </>
      )}
      {daPagareF && (
        <FoglioPagamento
          aperto
          onChiudi={() => setDaPagareF(null)}
          aziendaId={aid}
          titolo="Paga la fattura"
          voce={`${testo(daPagareF.numero) ?? ''} · ${testo(daPagareF.voce) ?? ''}`}
          importo={numero(daPagareF.importo) ?? 0}
          paga={(m) => pagaFattura(aid, numero(daPagareF.id) ?? 0, m)}
          onPagato={() => {
            carica();
            ricarica();
          }}
        />
      )}
      {az.messaggio}
    </div>
  );
}
