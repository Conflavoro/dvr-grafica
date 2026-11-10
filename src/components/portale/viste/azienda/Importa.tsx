'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cartella, Spunta } from '@/components/icone';
import { parseFile } from '@/lib/import/parsers';
import {
  applicaImportazione,
  etichettaDifferenza,
  importazioniRecenti,
  inviaImportazione,
  respingiImportazione,
  sintesiConteggi,
  type EntitaImport,
  type Importazione,
} from '@/lib/portale/aggiornamenti-api';
import { clsx } from '@/lib/clsx';
import { usePortale } from '../../PortaleShell';
import { Blocco, Chip, Errore, Riga, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Impatti } from '../condivisi/Impatti';

/**
 * Area azienda: importa l'export dei sistemi dell'azienda (paghe, inventario delle
 * attrezzature, presenze). Il sistema confronta con i dati attuali e propone le
 * differenze; applicate, aggiornano da sole formazione, visite, DPI e documenti.
 */

const ENTITA: Array<{ k: EntitaImport; t: string; aiuto: string }> = [
  { k: 'lavoratori', t: 'Dipendenti', aiuto: 'Export del programma paghe con Cognome, Nome, Codice fiscale, Mansione o Qualifica, Data assunzione e Data cessazione.' },
  { k: 'attrezzature', t: 'Attrezzature', aiuto: 'Inventario con Codice, Descrizione, Marca, Modello, Prossima verifica e Stato (in uso o dismessa).' },
  { k: 'presenze', t: 'Presenze', aiuto: 'Registro presenze a corsi e visite con Nominativo, Data, Corso o Visita e Presente (sì o no).' },
];

export default function Importa() {
  const { azienda, puo, ricarica } = usePortale();
  const [entita, setEntita] = useState<EntitaImport>('lavoratori');
  const [corrente, setCorrente] = useState<Importazione | null>(null);
  const [scelte, setScelte] = useState<Set<number>>(new Set());
  const [recenti, setRecenti] = useState<Importazione[]>([]);
  const [lavoro, setLavoro] = useState<'' | 'leggo' | 'applico'>('');
  const [errore, setErrore] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const id = azienda?.id ?? null;

  const caricaRecenti = useCallback(() => {
    if (!id) return;
    importazioniRecenti(id)
      .then(setRecenti)
      .catch(() => setRecenti([]));
  }, [id]);
  useEffect(caricaRecenti, [caricaRecenti]);

  const mostra = (i: Importazione | null) => {
    setCorrente(i);
    setScelte(new Set((i?.differenze ?? []).filter((d) => d.applica).map((d) => d.indice)));
  };

  const scegliFile = async (f: File | undefined) => {
    if (!f || !id) return;
    setErrore('');
    setLavoro('leggo');
    try {
      const p = await parseFile(f);
      if (p.kind !== 'tabular' || p.sheets.length === 0 || p.sheets[0].rows.length === 0) throw new Error('Il file non contiene una tabella: carica un CSV o un Excel con le intestazioni nella prima riga.');
      mostra(await inviaImportazione(id, entita, p.sheets[0].rows.slice(0, 2000), f.name));
      caricaRecenti();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro('');
      if (file.current) file.current.value = '';
    }
  };

  const applica = async () => {
    if (!corrente) return;
    setLavoro('applico');
    setErrore('');
    try {
      mostra(await applicaImportazione(corrente.id, Array.from(scelte)));
      caricaRecenti();
      ricarica();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro('');
    }
  };

  const respingi = async () => {
    if (!corrente) return;
    setLavoro('applico');
    try {
      mostra(await respingiImportazione(corrente.id));
      caricaRecenti();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro('');
    }
  };

  if (!azienda) return null;
  const def = ENTITA.find((e) => e.k === entita) ?? ENTITA[0];
  const aperta = corrente?.stato === 'proposta';

  return (
    <div className="space-y-5">
      <Testata categoria="persone" icona={Cartella} sopra={azienda.ragione_sociale} titolo="Importa dati" sotto="Carica l’export dei tuoi programmi: il sistema trova le differenze e aggiorna da solo quello che ne dipende." />

      <Scheda titolo="Carica l’export" sotto={def.aiuto}>
        <div className="space-y-3">
          <Schede etichetta="Tipo di dati" attiva={entita} onCambia={(k) => { setEntita(k); mostra(null); }} voci={ENTITA.map((e) => ({ k: e.k, t: e.t }))} />
          <input ref={file} type="file" accept=".csv,.tsv,.xlsx,.xls,.ods" className="sr-only" id="file-import" onChange={(e) => scegliFile(e.target.files?.[0])} />
          <label
            htmlFor="file-import"
            className={clsx(
              'flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.25rem] border border-dashed border-grafite-400 px-4 text-center hover:bg-perla-velo',
              lavoro === 'leggo' && 'pointer-events-none opacity-60'
            )}
          >
            <span className="text-[15px] font-medium text-ink">{lavoro === 'leggo' ? 'Leggo il file e confronto i dati' : 'Scegli il file CSV o Excel'}</span>
            <span className="text-[13px] text-ink-muted">Al massimo 2.000 righe. Nulla cambia finché non approvi le differenze.</span>
          </label>
          {errore && <Errore testo={errore} />}
        </div>
      </Scheda>

      {corrente && (
        <Scheda
          titolo={`Differenze trovate${corrente.nomeFile ? ` in ${corrente.nomeFile}` : ''}`}
          sotto={`${corrente.righeTotali} righe lette: ${sintesiConteggi(corrente.conteggi)}.`}
          azioni={<StatoImport i={corrente} />}
        >
          {corrente.differenze.length === 0 ? (
            <Vuoto titolo="Nessuna differenza">I dati dell’export coincidono con quelli già presenti.</Vuoto>
          ) : (
            <ul>
              {corrente.differenze.map((d) => {
                const sel = scelte.has(d.indice);
                const scegli = aperta && d.applica;
                return (
                  <li key={d.indice}>
                    <Riga
                      onClick={scegli ? () => setScelte((s) => { const n = new Set(s); if (n.has(d.indice)) n.delete(d.indice); else n.add(d.indice); return n; }) : undefined}
                      inizio={
                        d.applica && aperta ? (
                          <span aria-hidden className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full', sel ? 'bg-acido-400 text-acido-950' : 'shadow-[inset_0_0_0_1.5px_#c4c4c9]')}>
                            {sel && <Spunta size={14} />}
                          </span>
                        ) : (
                          <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-grafite-400" />
                          </span>
                        )
                      }
                      titolo={`${etichettaDifferenza(d.tipo)}: ${d.nome}`}
                      sotto={d.esito ? `${d.nota} ${d.esito === 'applicata' ? 'Applicata.' : d.esito}` : d.nota}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {corrente.scartate.length > 0 && (
            <div className="mt-3 rounded-[1rem] bg-perla-velo px-4 py-3 text-[13.5px] text-ink-muted">
              <p className="font-medium text-ink">Righe non lette</p>
              {corrente.scartate.slice(0, 10).map((s, k) => (
                <p key={k}>
                  {s.riga ? `Riga ${s.riga}: ` : ''}
                  {s.motivo}
                </p>
              ))}
            </div>
          )}
          {aperta && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {puo('dipendenti_modifica') ? (
                <>
                  <button type="button" className="btn-ghost min-h-[44px]" disabled={lavoro !== ''} onClick={respingi}>
                    Scarta
                  </button>
                  <button type="button" className="btn-acido min-h-[44px]" disabled={lavoro !== '' || scelte.size === 0} onClick={applica}>
                    {lavoro === 'applico' ? 'Applico' : `Applica ${scelte.size} ${scelte.size === 1 ? 'differenza' : 'differenze'}`}
                  </button>
                </>
              ) : (
                <Blocco>Le differenze le approvano il titolare, il referente o lo studio.</Blocco>
              )}
            </div>
          )}
        </Scheda>
      )}

      {recenti.length > 0 && (
        <Scheda titolo="Importazioni recenti">
          {recenti.slice(0, 8).map((i) => (
            <Riga
              key={i.id}
              onClick={() => mostra(i)}
              titolo={`${ENTITA.find((e) => e.k === i.entita)?.t ?? i.entita}${i.nomeFile ? `: ${i.nomeFile}` : ''}`}
              sotto={`${dataIt(i.creataIl)}, ${sintesiConteggi(i.conteggi)}`}
              fine={<StatoImport i={i} />}
            />
          ))}
        </Scheda>
      )}

      {puo('documenti_vedi') && <Impatti aziendaId={azienda.id} />}
    </div>
  );
}

function StatoImport({ i }: { i: Importazione }) {
  if (i.stato === 'proposta') return <Chip stato="approve">Da approvare</Chip>;
  if (i.stato === 'applicata') return <Chip stato="ok">{i.applicate !== null ? `Applicata (${i.applicate})` : 'Applicata'}</Chip>;
  if (i.stato === 'respinta') return <Chip stato="neutral">Scartata</Chip>;
  return <Chip stato="danger">Errore</Chip>;
}
