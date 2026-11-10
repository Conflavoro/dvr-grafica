'use client';

import { useState } from 'react';
import { Caricamento, Chip, dataIt } from '@/components/portale/kit';
import { clsx } from '@/lib/clsx';
import { accettaSezione, affiancati, etichettaOrigine, istruzioneValida, motivoValido, puo, statoParagrafo, statoSezione, testoPrincipale } from '@/lib/cowork/logica';
import type { Controlli, Paragrafo, RigaConfronto, Sezione, Versione } from '@/lib/cowork/tipi';
import { Fonti, Modulo, Pulsante, Stato, TestoParagrafo } from './parti';

export interface AzioniParagrafo {
  accetta: (p: Paragrafo) => Promise<boolean>;
  modifica: (p: Paragrafo, testo: string) => Promise<boolean>;
  nonApplicabile: (p: Paragrafo, motivo: string) => Promise<boolean>;
  riscrivi: (p: Paragrafo, istruzione: string) => Promise<boolean>;
  rigenera: (p: Paragrafo) => Promise<boolean>;
}

type Aperto = null | 'riscrivi' | 'non_applicabile' | 'modifica';

function Dicitura({ v, titolo }: { v: Versione; titolo?: string }) {
  return (
    <p className="text-[12.5px] text-ink-muted">
      {titolo && <span className="font-medium text-ink-soft">{titolo}. </span>}
      Versione {v.versione}, {etichettaOrigine(v.origine).toLowerCase()}
      {v.revisione !== null ? `, dalla revisione ${v.revisione}` : ''}
      {v.creataIl ? `, ${dataIt(v.creataIl)}` : ''}
    </p>
  );
}

function Confronto({ righe }: { righe: RigaConfronto[] }) {
  return (
    <div className="mt-3 space-y-1 rounded-[1rem] bg-perla-velo p-3 text-[14px] leading-relaxed" aria-label="Differenze tra il testo in vigore e la proposta">
      {righe.map((r, i) => (
        <p
          key={i}
          className={clsx(
            'whitespace-pre-line rounded-[0.5rem] px-2 py-1',
            r.op === '-' && 'bg-stato-danger text-stato-danger-ink line-through decoration-1',
            r.op === '+' && 'bg-stato-ok text-stato-ok-ink',
            r.op === '=' && 'text-ink-soft',
          )}
        >
          <span className="sr-only">{r.op === '-' ? 'Tolto: ' : r.op === '+' ? 'Aggiunto: ' : ''}</span>
          {r.testo}
        </p>
      ))}
    </div>
  );
}

function BloccoParagrafo({ p, lavoro, azioni }: { p: Paragrafo; lavoro: string | null; azioni: AzioniParagrafo }) {
  const [aperto, setAperto] = useState<Aperto>(null);
  const [valore, setValore] = useState('');
  const [differenze, setDifferenze] = useState(false);
  const occupato = lavoro !== null && lavoro.startsWith(`${p.id}:`);
  const lavora = (a: string) => lavoro === `${p.id}:${a}`;
  const due = affiancati(p);
  const principale = testoPrincipale(p);

  const apri = (a: Aperto) => {
    setAperto(a);
    setValore(a === 'modifica' ? (principale?.testo ?? '') : '');
  };
  const chiudiSe = (ok: boolean) => ok && setAperto(null);

  return (
    <article className="cowork-paragrafo border-t border-perla-linea pt-4 first:border-t-0 first:pt-0" aria-label={`Paragrafo ${p.chiave}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="cifre text-[12.5px] text-ink-muted">{p.chiave}</span>
        <Stato e={statoParagrafo(p.stato)} />
        {p.tipo === 'tabella_dati' && <Chip stato="neutral">Dati in tabella</Chip>}
      </div>

      {p.stato === 'non_applicabile' ? (
        <p className="mt-3 rounded-[1rem] bg-perla-velo px-4 py-3 text-[14.5px] text-ink-soft">Non applicabile{p.motivo ? `: ${p.motivo}` : '.'}</p>
      ) : due && p.accettata && p.proposta ? (
        <>
          {p.motivo && <p className="mt-2 text-[13px] text-ink-muted">{p.motivo}</p>}
          <div className="cowork-affiancati mt-3">
            <div className="rounded-[1rem] p-3.5 shadow-[inset_0_0_0_1px_#e2e2e5]">
              <Dicitura v={p.accettata} titolo="In vigore" />
              <TestoParagrafo testo={p.accettata.testo} className="mt-2" />
            </div>
            <div className="rounded-[1rem] bg-acido-200/40 p-3.5 shadow-[inset_0_0_0_1.5px_#beeb1e]">
              <Dicitura v={p.proposta} titolo="Proposta nuova" />
              <TestoParagrafo testo={p.proposta.testo} className="mt-2" />
              {p.proposta.istruzione && <p className="mt-2 text-[12.5px] text-ink-muted">Richiesta: {p.proposta.istruzione}</p>}
            </div>
          </div>
          {p.confronto && p.confronto.length > 0 && (
            <button type="button" className="mt-2 min-h-[40px] text-[13px] text-ink-muted underline underline-offset-2 hover:text-ink" aria-expanded={differenze} onClick={() => setDifferenze((d) => !d)}>
              {differenze ? 'Nascondi le differenze' : 'Mostra le differenze'}
            </button>
          )}
          {differenze && p.confronto && <Confronto righe={p.confronto} />}
        </>
      ) : principale ? (
        <div className="mt-3">
          <Dicitura v={principale} />
          <TestoParagrafo testo={principale.testo} className="mt-2" />
          {principale.istruzione && <p className="mt-2 text-[12.5px] text-ink-muted">Richiesta: {principale.istruzione}</p>}
        </div>
      ) : (
        <p className="mt-3 text-[14.5px] text-ink-muted">L&apos;assistente non ha ancora scritto questo paragrafo.</p>
      )}

      {(principale?.fonti.length ?? 0) > 0 && (
        <div className="mt-3">
          <Fonti fonti={principale!.fonti} />
        </div>
      )}

      {p.azioni.length > 0 && aperto === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          {puo(p, 'accetta') && (
            <Pulsante classe="btn-acido" lavora={lavora('accetta')} disabilitato={occupato} onClick={() => void azioni.accetta(p)}>
              {due ? 'Accetta la proposta nuova' : 'Accetta il paragrafo'}
            </Pulsante>
          )}
          {due && puo(p, 'modifica') && p.accettata && (
            <Pulsante lavora={lavora('modifica')} disabilitato={occupato} onClick={() => void azioni.modifica(p, p.accettata!.testo)}>
              Tieni il testo in vigore
            </Pulsante>
          )}
          {puo(p, 'riscrivi') && (
            <Pulsante lavora={lavora('riscrivi')} disabilitato={occupato} onClick={() => apri('riscrivi')}>
              Riscrivi
            </Pulsante>
          )}
          {puo(p, 'rigenera') && (
            <Pulsante lavora={lavora('rigenera')} disabilitato={occupato} onClick={() => void azioni.rigenera(p)} titolo="Riscrive dai dati attuali; non costa nulla se i dati non sono cambiati">
              Rigenera
            </Pulsante>
          )}
          {puo(p, 'modifica') && (
            <Pulsante disabilitato={occupato} onClick={() => apri('modifica')}>
              Modifica a mano
            </Pulsante>
          )}
          {puo(p, 'non_applicabile') && p.stato !== 'non_applicabile' && (
            <Pulsante disabilitato={occupato} onClick={() => apri('non_applicabile')}>
              Non applicabile
            </Pulsante>
          )}
        </div>
      )}

      {aperto === 'riscrivi' && (
        <Modulo
          etichetta="Come la vuoi riscritta?"
          aiuto="Per esempio: più breve, cita il detergente nuovo, togli il riferimento al magazzino. L'assistente prepara una proposta, il testo in vigore non cambia."
          valore={valore}
          onCambia={setValore}
          onAnnulla={() => setAperto(null)}
          onConferma={() => void azioni.riscrivi(p, valore).then(chiudiSe)}
          conferma="Riscrivi"
          valido={istruzioneValida(valore)}
          lavora={lavora('riscrivi')}
        />
      )}
      {aperto === 'non_applicabile' && (
        <Modulo
          etichetta="Perché non si applica?"
          aiuto="Il motivo resta nel documento e nel registro. Almeno 5 caratteri."
          valore={valore}
          onCambia={setValore}
          onAnnulla={() => setAperto(null)}
          onConferma={() => void azioni.nonApplicabile(p, valore).then(chiudiSe)}
          conferma="Segna non applicabile"
          valido={motivoValido(valore)}
          lavora={lavora('non_applicabile')}
          righe={2}
        />
      )}
      {aperto === 'modifica' && (
        <Modulo
          etichetta="Testo del paragrafo"
          aiuto="Il testo che salvi vale come accettato da te."
          valore={valore}
          onCambia={setValore}
          onAnnulla={() => setAperto(null)}
          onConferma={() => void azioni.modifica(p, valore).then(chiudiSe)}
          conferma="Salva e accetta"
          valido={valore.trim().length > 0}
          lavora={lavora('modifica')}
          righe={10}
        />
      )}
    </article>
  );
}

/** Centro della Scrivania: i paragrafi della sezione aperta con le loro azioni. */
export function SezioneParagrafi({
  sezione,
  controlli,
  carica,
  lavoro,
  azioni,
  onAccettaSezione,
}: {
  sezione: Sezione | null;
  controlli: Controlli | null;
  carica: boolean;
  lavoro: string | null;
  azioni: AzioniParagrafo;
  onAccettaSezione: () => void;
}) {
  if (!sezione) return <section className="rounded-[1.25rem] bg-white px-4 py-2 shadow-[inset_0_0_0_1px_#e2e2e5]">{carica ? <Caricamento testo="Apro la sezione" /> : <p className="py-6 text-[14px] text-ink-muted">Scegli una sezione dall&apos;indice.</p>}</section>;
  const tutta = accettaSezione(sezione, controlli);
  return (
    <section aria-label={`Sezione ${sezione.chiave}`} className={clsx('rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]', carica && 'opacity-70')}>
      <header className="flex flex-wrap items-start gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="cifre text-[13px] text-ink-muted">{/^\d+$/.test(sezione.chiave) ? `Sezione ${sezione.chiave}` : 'Allegato'}</p>
          <h2 className="text-[19px] font-medium leading-snug tracking-[-0.01em] text-ink">{sezione.titolo}</h2>
        </div>
        <Stato e={statoSezione(sezione.stato)} />
      </header>
      <div className="space-y-4 px-4 pb-4 sm:px-5">
        {sezione.elenco.length === 0 ? (
          <p className="text-[14.5px] text-ink-muted">Questa sezione non ha ancora paragrafi.</p>
        ) : (
          sezione.elenco.map((p) => <BloccoParagrafo key={p.id} p={p} lavoro={lavoro} azioni={azioni} />)
        )}
      </div>
      {tutta.visibile && (
        <footer className="flex flex-wrap items-center gap-3 border-t border-perla-linea px-4 py-3.5 sm:px-5">
          <Pulsante classe="btn-primary" lavora={lavoro === 'sezione'} disabilitato={!tutta.attivo || lavoro !== null} onClick={onAccettaSezione}>
            Accetta la sezione
          </Pulsante>
          <p className="min-w-0 flex-1 basis-[14rem] text-[13px] text-ink-muted">{tutta.motivo ?? 'Accetta in un colpo solo tutte le proposte di questa sezione.'}</p>
        </footer>
      )}
    </section>
  );
}
