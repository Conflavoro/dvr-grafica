'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Allerta, Calendario, Casco, Corso, Documento, Fiamma, Libro, Persone, Visita } from '@/components/icone';
import type { IconaComponente } from '@/components/icone';
import type { Categoria } from '@/lib/portale/sezioni';
import {
  VUOTO,
  decidiImpatto,
  elencoAggiornamenti,
  inRitardo,
  perAzienda,
  type ElencoAggiornamenti,
  type Impatto,
  type StatoImpatto,
} from '@/lib/portale/aggiornamenti-api';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Pastiglia, Riga, Riquadro, Scheda, Schede, Vuoto, dataIt, traGiorni } from '../../kit';

/**
 * Aggiornamenti aperti: per ogni cambiamento dell'azienda (dipendenti, attrezzature,
 * sedi, figure, eventi, normativa, dati importati) cosa va aggiornato, perché, con
 * quale riferimento e entro quando. Vista riusabile: nel gestionale per tutto lo
 * studio o per un'azienda, nell'area azienda per la propria.
 */

const DOC: Record<string, [Categoria, IconaComponente]> = {
  dvr: ['documenti', Documento],
  valutazione_chimica: ['documenti', Documento],
  valutazione_cancerogeni: ['documenti', Documento],
  valutazione_specifica: ['documenti', Documento],
  nomine: ['documenti', Documento],
  organigramma: ['utenti', Persone],
  riunione_periodica: ['documenti', Documento],
  normativa: ['documenti', Libro],
  formazione: ['formazione', Corso],
  addestramento: ['formazione', Corso],
  sorveglianza: ['visite', Visita],
  dpi: ['persone', Persone],
  inail: ['persone', Persone],
  anagrafica: ['persone', Persone],
  verifica_attrezzatura: ['scadenze', Calendario],
  piano_emergenza: ['antincendio', Fiamma],
  pos: ['servizi', Casco],
  analisi_evento: ['ispezioni', Allerta],
};

function statoChip(i: Impatto) {
  if (i.stato === 'chiuso') return <Chip stato="ok">Fatto</Chip>;
  if (i.stato === 'non_serve') return <Chip stato="neutral">Non serve</Chip>;
  if (inRitardo(i)) return <Chip stato="danger">Oltre il termine</Chip>;
  if (i.stato === 'in_corso') return <Chip stato="run">In corso</Chip>;
  if (i.priorita === 'alta') return <Chip stato="warn">Urgente</Chip>;
  return <Chip stato="todo">Da fare</Chip>;
}

export function Impatti({ aziendaId = null, titolo = 'Cosa va aggiornato' }: { aziendaId?: number | null; titolo?: string }) {
  const { app, versione, chiedi, apri } = usePortale();
  const [filtro, setFiltro] = useState<'attivi' | 'chiusi'>('attivi');
  const [dati, setDati] = useState<ElencoAggiornamenti>(VUOTO);
  const [stato, setStato] = useState<'carico' | 'ok' | 'errore'>('carico');
  const [errore, setErrore] = useState('');
  const [aperto, setAperto] = useState<Impatto | null>(null);

  const carica = useCallback(() => {
    setStato('carico');
    elencoAggiornamenti({ aziendaId, stato: filtro })
      .then((d) => {
        setDati(d);
        setStato('ok');
      })
      .catch((e: Error) => {
        setErrore(e.message);
        setStato('errore');
      });
  }, [aziendaId, filtro]);

  useEffect(() => {
    carica();
  }, [carica, versione]);

  const gruppi = useMemo(() => (aziendaId ? [{ aziendaId, ragioneSociale: '', voci: dati.impatti }] : perAzienda(dati.impatti)), [aziendaId, dati.impatti]);

  const apriVoce = (i: Impatto) => {
    setAperto(i);
    if (app === 'gestionale' && i.propostaId) apri({ tipo: 'proposta', id: i.propostaId }, i.aziendaId);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Riquadro etichetta="Da aggiornare" valore={dati.conteggi.aperti} nero />
        <Riquadro etichetta="Urgenti" valore={dati.conteggi.alta} tono={dati.conteggi.alta > 0 ? 'warn' : undefined} />
        <Riquadro etichetta="Oltre il termine" valore={dati.conteggi.inRitardo} tono={dati.conteggi.inRitardo > 0 ? 'danger' : undefined} />
      </div>

      <Scheda
        titolo={titolo}
        sotto="Calcolato dal sistema a ogni cambiamento, con il riferimento normativo. I documenti li rielabora e firma una persona."
      >
        <div className="mb-2">
          <Schede
            etichetta="Filtro aggiornamenti"
            attiva={filtro}
            onCambia={setFiltro}
            voci={[
              { k: 'attivi', t: 'Da fare', n: filtro === 'attivi' ? dati.conteggi.aperti : undefined },
              { k: 'chiusi', t: 'Chiusi' },
            ]}
          />
        </div>
        {stato === 'carico' && <Caricamento />}
        {stato === 'errore' && <Errore testo={errore} onRiprova={carica} />}
        {stato === 'ok' && dati.impatti.length === 0 && (
          <Vuoto titolo={filtro === 'attivi' ? 'Niente da aggiornare' : 'Nessun aggiornamento chiuso'}>
            {filtro === 'attivi' ? 'Quando cambia qualcosa (un dipendente, un’attrezzatura, una sede, un dato importato) qui compare cosa va aggiornato.' : 'Gli aggiornamenti fatti o non necessari restano qui come storia.'}
          </Vuoto>
        )}
        {stato === 'ok' &&
          gruppi.map((g) => (
            <div key={g.aziendaId} className="mt-1">
              {!aziendaId && <h3 className="mb-1 mt-3 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted first:mt-0">{g.ragioneSociale}</h3>}
              {g.voci.map((i) => {
                const [cat, Icona] = DOC[i.documento] ?? (['documenti', Documento] as [Categoria, IconaComponente]);
                return (
                  <Riga
                    key={i.id}
                    onClick={() => apriVoce(i)}
                    inizio={<Pastiglia categoria={cat} icona={Icona} />}
                    titolo={i.titolo}
                    sotto={
                      <>
                        {i.documentoNome}
                        {i.entro && (i.stato === 'aperto' || i.stato === 'in_corso') ? `, entro il ${dataIt(i.entro)} (${traGiorni(i.entro).replace('scade oggi', 'oggi').replace('scaduta', 'scaduto')})` : ''}
                        {i.occorrenze > 1 ? `, ${i.occorrenze} motivi` : ''}
                      </>
                    }
                    fine={statoChip(i)}
                  />
                );
              })}
            </div>
          ))}
      </Scheda>

      {dati.cambiamenti.length > 0 && (
        <Scheda titolo="Cosa è cambiato" sotto="Ultimi 30 giorni: dall’app, dall’agente, dalle importazioni e dal controllo orario.">
          {dati.cambiamenti.slice(0, 12).map((c) => (
            <Riga
              key={c.id}
              titolo={`${c.etichetta}${c.sintesi ? `: ${c.sintesi}` : ''}`}
              sotto={`${!aziendaId && c.ragioneSociale ? `${c.ragioneSociale}, ` : ''}${dataIt(c.il)}${c.fonte !== 'app' ? `, da ${c.fonte}` : ''}`}
              fine={<span className="cifre shrink-0 text-[13px] text-ink-muted">{c.impatti === 1 ? '1 aggiornamento' : `${c.impatti} aggiornamenti`}</span>}
            />
          ))}
        </Scheda>
      )}

      <Dettaglio
        impatto={aperto}
        puoDecidere={dati.puoDecidere}
        onChiudi={() => setAperto(null)}
        onChiedi={(t) => {
          setAperto(null);
          chiedi(t);
        }}
        onFatto={(n) => {
          setAperto(n);
          carica();
        }}
      />
    </div>
  );
}

function Dettaglio({
  impatto,
  puoDecidere,
  onChiudi,
  onChiedi,
  onFatto,
}: {
  impatto: Impatto | null;
  puoDecidere: boolean;
  onChiudi: () => void;
  onChiedi: (t: string) => void;
  onFatto: (i: Impatto | null) => void;
}) {
  const [nota, setNota] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  useEffect(() => {
    setNota('');
    setErrore('');
  }, [impatto?.id]);
  const i = impatto;
  const attivo = i !== null && (i.stato === 'aperto' || i.stato === 'in_corso');

  const decidi = async (s: StatoImpatto) => {
    if (!i) return;
    if (s === 'non_serve' && nota.trim() === '') {
      setErrore('Scrivi perché non serve: resta nella storia dell’azienda.');
      return;
    }
    setInvio(true);
    setErrore('');
    try {
      onFatto(await decidiImpatto(i.id, s, nota.trim() || undefined));
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={i !== null}
      titolo={i?.titolo ?? ''}
      onChiudi={onChiudi}
      piede={
        i && (
          <>
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => onChiedi(`Spiegami l'aggiornamento "${i.titolo}"${i.ragioneSociale ? ` di ${i.ragioneSociale}` : ''} e preparami cosa serve per farlo.`)}>
              Chiedi a Falco
            </button>
            {puoDecidere && attivo && (
              <>
                {i.stato === 'aperto' && (
                  <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={() => decidi('in_corso')}>
                    Prendo in carico
                  </button>
                )}
                <button type="button" className="btn-ghost min-h-[44px]" disabled={invio} onClick={() => decidi('non_serve')}>
                  Non serve
                </button>
                <button type="button" className="btn-acido min-h-[44px]" disabled={invio} onClick={() => decidi('chiuso')}>
                  Fatto
                </button>
              </>
            )}
          </>
        )
      }
    >
      {i && (
        <div className="space-y-4 text-[14.5px] leading-relaxed text-ink">
          <div className="flex flex-wrap items-center gap-2">
            {statoChip(i)}
            <span className="text-[13px] text-ink-muted">{i.documentoNome}</span>
            {i.ragioneSociale && <span className="text-[13px] text-ink-muted">{i.ragioneSociale}</span>}
          </div>
          <p className="whitespace-pre-line">{i.motivo}</p>
          <dl className="grid gap-2 rounded-[1.25rem] bg-perla-velo p-4 text-[13.5px]">
            {i.riferimento && (
              <div>
                <dt className="text-ink-muted">Riferimento</dt>
                <dd>{i.riferimento}</dd>
              </div>
            )}
            {i.entro && (
              <div>
                <dt className="text-ink-muted">Entro</dt>
                <dd>
                  {dataIt(i.entro)} ({traGiorni(i.entro)})
                </dd>
              </div>
            )}
            {i.notaChiusura && (
              <div>
                <dt className="text-ink-muted">Chiusura</dt>
                <dd>{i.notaChiusura}</dd>
              </div>
            )}
          </dl>
          {i.motivi.length > 1 && (
            <div>
              <h3 className="mb-1 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">Da dove viene</h3>
              <ul className="space-y-2">
                {i.motivi.map((m, k) => (
                  <li key={k} className="rounded-[1rem] px-3 py-2 shadow-[inset_0_0_0_1px_#e2e2e5]">
                    <span className="block text-[12.5px] text-ink-muted">
                      {m.etichetta ?? 'Cambiamento'}
                      {m.il ? `, ${dataIt(m.il)}` : ''}
                    </span>
                    <span className="block text-[13.5px]">{m.testo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {puoDecidere && attivo && (
            <label className="block">
              <span className="mb-1 block text-[13px] text-ink-muted">Nota (obbligatoria per &quot;Non serve&quot;)</span>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={500} className="w-full rounded-[1rem] border border-perla-linea px-3 py-2 text-[14.5px]" />
            </label>
          )}
          {errore && <Errore testo={errore} />}
        </div>
      )}
    </Foglio>
  );
}
