'use client';

import { useState } from 'react';
import { ChevronDown, Piu } from '@/components/icone';
import type { DocumentoAzienda } from '@/lib/data-source';
import { nomeTipoDocumento } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { conTempoMassimo, TEMPI } from '@/lib/attesa';
import { clsx } from '@/lib/clsx';
import { useDato } from '../controlroom/kit';
import { BadgeStatoDoc, COLORE, PuntoEsito, ScaricaDocumento } from '../pannelli/moduli-kit';
import { Caricamento, Errore, LINK, Lame, Sezione, Vuota, data } from './kit';
import type { SchedaProps } from './Schede';

/** Gruppi del tavolo, nell'ordine in cui un consulente li cerca. */
export const GRUPPI: Array<{ chiave: string; titolo: string; tipi: string[] }> = [
  { chiave: 'dvr', titolo: 'DVR', tipi: ['dvr'] },
  { chiave: 'valutazioni', titolo: 'Valutazioni specifiche', tipi: ['rumore', 'vibrazioni', 'mmc', 'chimico', 'stress', 'legionella', 'solitudine'] },
  { chiave: 'pos', titolo: 'POS', tipi: ['pos'] },
  { chiave: 'duvri', titolo: 'DUVRI', tipi: ['duvri'] },
  { chiave: 'pimus', titolo: 'PiMUS', tipi: ['pimus'] },
  { chiave: 'haccp', titolo: 'Manuale HACCP', tipi: ['haccp'] },
  { chiave: 'emergenza', titolo: 'Piano di emergenza', tipi: ['emergenza'] },
  { chiave: 'verbali', titolo: 'Verbali', tipi: ['sopralluogo', 'riunione'] },
  { chiave: 'nomine', titolo: 'Nomine', tipi: ['nomina'] },
  { chiave: 'procedure', titolo: 'Procedure di sicurezza', tipi: ['procedura'] },
  { chiave: 'radon', titolo: 'Radon', tipi: ['radon'] },
];

/** Raggruppa per tipo; i tipi non previsti finiscono in "Altri documenti". */
export function raggruppa(documenti: DocumentoAzienda[]): Array<{ chiave: string; titolo: string; documenti: DocumentoAzienda[] }> {
  const noti = new Set(GRUPPI.flatMap((g) => g.tipi));
  const out = GRUPPI.map((g) => ({ chiave: g.chiave, titolo: g.titolo, documenti: documenti.filter((d) => g.tipi.includes(d.tipo)) }));
  const altri = documenti.filter((d) => !noti.has(d.tipo));
  if (altri.length) out.push({ chiave: 'altri', titolo: 'Altri documenti', documenti: altri });
  return out.filter((g) => g.documenti.length > 0);
}

/** Richieste precise per creare un documento nuovo: partono nella chat cosi' come sono. */
export function richiesteNuovo(nome: string): Array<{ gruppo: string; voci: Array<{ etichetta: string; testo: string }> }> {
  const v = (etichetta: string, testo: string) => ({ etichetta, testo });
  return [
    {
      gruppo: 'Documenti principali',
      voci: [
        v('DVR', `Prepara il DVR di ${nome} con i dati già in piattaforma e dimmi cosa manca prima di generarlo.`),
        v('POS', `Prepara un POS per ${nome}: chiedimi per quale cantiere e quali lavorazioni.`),
        v('Piano di emergenza', `Prepara il piano di emergenza ed evacuazione di ${nome} secondo i DM 2 e 3 settembre 2021, con gli addetti dell’organigramma.`),
        v('DUVRI', `Prepara il DUVRI di ${nome}: chiedimi appaltatore, lavori affidati, periodo e costi della sicurezza.`),
        v('PiMUS', `Prepara il PiMUS per un cantiere di ${nome}: chiedimi il ponteggio, lo schema e il cantiere.`),
        v('Manuale HACCP', `Prepara il manuale HACCP di ${nome}: chiedimi l’attività alimentare e i prodotti trattati.`),
      ],
    },
    {
      gruppo: 'Valutazioni specifiche',
      voci: [
        v('Rumore', `Prepara la valutazione del rischio rumore di ${nome} (Titolo VIII Capo II D.Lgs. 81/08): chiedimi le misure fonometriche per mansione.`),
        v('Vibrazioni', `Prepara la valutazione del rischio vibrazioni mano braccio e corpo intero di ${nome}: chiedimi attrezzature, accelerazioni e tempi.`),
        v('Movimentazione manuale dei carichi', `Prepara la valutazione della movimentazione manuale dei carichi di ${nome} (NIOSH, Snook e Ciriello, OCRA): chiedimi i compiti.`),
        v('Agenti chimici', `Prepara la valutazione del rischio chimico di ${nome} con MoVaRisCh: chiedimi le sostanze dalle schede di sicurezza.`),
        v('Stress lavoro correlato', `Prepara la valutazione dello stress lavoro correlato di ${nome} con la checklist INAIL: chiedimi i gruppi omogenei.`),
        v('Legionella', `Prepara la valutazione del rischio legionella di ${nome}: chiedimi impianti idrici e campionamenti.`),
        v('Lavoro in solitudine', `Prepara la valutazione del lavoro in solitudine di ${nome}: chiedimi mansioni e sistemi di allerta.`),
      ],
    },
    {
      gruppo: 'Atti e verbali',
      voci: [
        v('Nomine', `Prepara le nomine di ${nome}: RSPP, medico competente, addetti alle emergenze, preposti e presa d’atto del RLS.`),
        v('Verbale di sopralluogo', `Prepara il verbale di sopralluogo di ${nome} con i rilievi dell’archivio.`),
        v('Verbale di riunione periodica', `Prepara il verbale della riunione periodica di ${nome} (art. 35 D.Lgs. 81/08).`),
        v('Procedura di sicurezza', `Proponi le procedure di sicurezza utili per ${nome} dalla libreria.`),
        v('Relazione radon', `Prepara la relazione sulla misura del radon di ${nome} (D.Lgs. 101/2020): chiedimi i dati del laboratorio.`),
      ],
    },
  ];
}

/** Richiesta all'agente per aprire un documento dell'elenco. */
export function richiestaApri(d: DocumentoAzienda): string {
  if (d.origine === 'dvr') return `Apri il DVR n. ${d.id} e dimmi a che punto è.`;
  if (d.origine === 'pos') return `Apri il POS n. ${d.id} e dimmi a che punto è.`;
  if (d.origine === 'valutazione') return `Apri la valutazione ${nomeTipoDocumento(d.tipo).toLowerCase()} n. ${d.id} e dimmi a che punto è.`;
  return `Apri il documento n. ${d.id} (${nomeTipoDocumento(d.tipo)}) e dimmi a che punto è.`;
}

function RigaDocumento({ d, chiedi, occupato }: { d: DocumentoAzienda; chiedi: (t: string) => void; occupato: boolean }) {
  const blocchi = d.conteggi?.blocca ?? 0;
  const meta = [
    d.origine === 'valutazione' ? nomeTipoDocumento(d.tipo) : null,
    d.revisione ? `rev. ${d.revisione}` : null,
    d.aggiornato ? data(d.aggiornato) : null,
    blocchi ? `${blocchi} ${blocchi === 1 ? 'controllo blocca' : 'controlli bloccano'}` : null,
  ].filter(Boolean);
  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          disabled={occupato}
          onClick={() => chiedi(richiestaApri(d))}
          className="min-h-[44px] min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-70"
          title="Chiedi all’agente di aprirlo"
        >
          <span className="flex items-center gap-2">
            {d.esito && <PuntoEsito colore={d.esito.colore} />}
            <span className="block truncate text-[13.5px] font-medium text-ink">{d.titolo}</span>
          </span>
          {meta.length > 0 && <span className={clsx('block truncate text-[11.5px]', blocchi ? 'text-danger-ink' : 'text-ink-muted')}>{meta.join(', ')}</span>}
          {d.esito && <span className={clsx('block truncate text-[11.5px] font-medium', COLORE[d.esito.colore].testo)}>{d.esito.testo}</span>}
        </button>
        <BadgeStatoDoc stato={d.stato} />
      </div>
      <div className="mt-1">
        <ScaricaDocumento origine={d.origine} id={d.id} stato={d.stato} compatto onAnteprima={() => chiedi(`Prepara il file della bozza: ${richiestaApri(d).replace(' e dimmi a che punto è.', '')}`)} />
      </div>
    </li>
  );
}

/**
 * Scheda "Documenti" del tavolo: tutti i documenti HSE dell'azienda aperta,
 * raggruppati per tipo, con stato e download; da qui si chiede all'agente di
 * crearne uno nuovo con un clic.
 */
export function SchedaDocumentiHse({ aziendaId, versione, scrivibile, chiedi, occupato, nomeAzienda }: SchedaProps) {
  const ds = useDataSource();
  const elenco = useDato(
    () => conTempoMassimo(ds.documentiHse.elenco(aziendaId), TEMPI.breve, 'L’elenco dei documenti non è arrivato in tempo.'),
    [ds, aziendaId, versione]
  );
  const [nuovo, setNuovo] = useState(false);
  const gruppi = elenco.dato ? raggruppa(elenco.dato.documenti) : [];

  return (
    <div>
      {scrivibile && (
        <Sezione
          titolo="Nuovo documento"
          nota={`Scegli cosa preparare: la richiesta parte all’agente per ${nomeAzienda}`}
          azione={
            <button type="button" onClick={() => setNuovo((v) => !v)} aria-expanded={nuovo} aria-controls="doc-nuovo" className={LINK}>
              <Piu size={15} aria-hidden /> {nuovo ? 'Chiudi' : 'Crea'}
              <ChevronDown size={14} aria-hidden className={clsx('transition-transform motion-reduce:transition-none', nuovo && 'rotate-180')} />
            </button>
          }
        >
          {nuovo && (
            <div id="doc-nuovo" className="space-y-3">
              {richiesteNuovo(nomeAzienda).map((g) => (
                <div key={g.gruppo}>
                  <p className="mb-1 text-[12px] font-semibold text-ink-muted">{g.gruppo}</p>
                  <ul className="grid grid-cols-1 gap-1 min-[400px]:grid-cols-2">
                    {g.voci.map((x) => (
                      <li key={x.etichetta}>
                        <button
                          type="button"
                          disabled={occupato}
                          onClick={() => {
                            setNuovo(false);
                            chiedi(x.testo);
                          }}
                          className="premi flex min-h-[44px] w-full items-center gap-2 rounded-full bg-perla-carta px-3 text-left text-[13px] font-medium text-brand-900 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)] hover:shadow-[inset_0_0_0_1px_rgba(103,127,2,0.6)] disabled:opacity-50"
                        >
                          <Lame />
                          <span className="min-w-0 flex-1">{x.etichetta}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Sezione>
      )}

      {elenco.inCorso && !elenco.dato ? (
        <Caricamento testo="Carico i documenti" />
      ) : elenco.errore ? (
        <Errore testo={elenco.errore} onRiprova={elenco.ricarica} />
      ) : (
        <>
          {elenco.dato && elenco.dato.avvisi.length > 0 && (
            <div className="mt-2">
              <Errore testo={`${elenco.dato.avvisi.join(' ')} Gli altri documenti sono qui sotto.`} onRiprova={elenco.ricarica} />
            </div>
          )}
          {gruppi.length === 0 ? (
            <Sezione titolo="Documenti">
              <Vuota>
                Nessun documento per {nomeAzienda}.{scrivibile ? ' Usa “Crea” qui sopra per chiedere all’agente il primo.' : ''}
              </Vuota>
            </Sezione>
          ) : (
            gruppi.map((g) => (
              <Sezione key={g.chiave} titolo={g.titolo} nota={`${g.documenti.length} ${g.documenti.length === 1 ? 'documento' : 'documenti'}`}>
                <ul className="superficie divide-y divide-perla-linea rounded-[0.875rem] px-3">
                  {g.documenti.map((d) => (
                    <RigaDocumento key={d.chiave} d={d} chiedi={chiedi} occupato={occupato} />
                  ))}
                </ul>
              </Sezione>
            ))
          )}
        </>
      )}
    </div>
  );
}
