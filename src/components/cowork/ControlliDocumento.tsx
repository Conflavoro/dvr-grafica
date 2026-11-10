'use client';

import { useState } from 'react';
import { Allerta, Avviso, CerchioSpunta } from '@/components/icone';
import { Caricamento } from '@/components/portale/kit';
import { clsx } from '@/lib/clsx';
import { motivoValido } from '@/lib/cowork/logica';
import type { Controlli, Controllo } from '@/lib/cowork/tipi';
import { Modulo, Pulsante } from './parti';

const GRUPPI = [
  { k: 'bloccanti', titolo: 'Bloccanti', icona: Allerta, cls: 'text-stato-danger-segno' },
  { k: 'avvisi', titolo: 'Avvisi', icona: Avviso, cls: 'text-stato-warn-segno' },
  { k: 'info', titolo: 'Informazioni', icona: Avviso, cls: 'text-stato-info-segno' },
] as const;

function VoceControllo({
  c,
  lavoro,
  onApriSezione,
  onEsegui,
  onAccetta,
}: {
  c: Controllo;
  lavoro: string | null;
  onApriSezione: (k: string) => void;
  onEsegui: (c: Controllo) => Promise<boolean>;
  onAccetta: (c: Controllo, motivo: string) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState('');
  const [aperto, setAperto] = useState(false);
  const occupato = lavoro === `controllo:${c.id}`;
  const accettato = c.stato === 'accettato';
  return (
    <li className={clsx('border-b border-perla-linea py-3 last:border-b-0', accettato && 'opacity-75')}>
      <p className="text-[13.5px] leading-snug text-ink">{c.messaggio}</p>
      <p className="mt-1 flex flex-wrap gap-x-2 text-[12.5px] text-ink-muted">
        {c.riferimento && <span>{c.riferimento}</span>}
        {c.sezione && (
          <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => onApriSezione(c.sezione!)}>
            {/^\d+$/.test(c.sezione) ? `Vai alla sezione ${c.sezione}` : 'Vai all’allegato'}
          </button>
        )}
      </p>
      {accettato ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-ink-soft">
          <CerchioSpunta size={14} aria-hidden className="mt-0.5 shrink-0 text-stato-ok-segno" /> Accettato{c.motivo ? `: ${c.motivo}` : ''}
        </p>
      ) : (
        <>
          {!aperto && (c.azioni.includes('esegui') || c.azioni.includes('accetta')) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.azioni.includes('esegui') && c.azione && (
                <Pulsante classe="btn-primary" lavora={occupato} disabilitato={lavoro !== null && !occupato} onClick={() => void onEsegui(c)} titolo={`Esegue: ${c.azione.etichetta}. Vale come tua conferma.`}>
                  {c.azione.etichetta}
                </Pulsante>
              )}
              {c.azioni.includes('accetta') && (
                <Pulsante disabilitato={lavoro !== null} onClick={() => setAperto(true)}>
                  Accetta con un motivo
                </Pulsante>
              )}
            </div>
          )}
          {c.livello === 'bloccante' && !c.azioni.includes('accetta') && <p className="mt-1.5 text-[12.5px] text-ink-muted">Non si accetta: si risolve correggendo il testo o i dati.</p>}
          {aperto && (
            <Modulo
              etichetta="Perché accetti questo avviso?"
              aiuto="Il motivo, chi e quando restano nel registro del documento."
              valore={motivo}
              onCambia={setMotivo}
              onAnnulla={() => setAperto(false)}
              onConferma={() => void onAccetta(c, motivo).then((ok) => ok && setAperto(false))}
              conferma="Accetta l’avviso"
              valido={motivoValido(motivo)}
              lavora={occupato}
              righe={2}
            />
          )}
        </>
      )}
    </li>
  );
}

/** Controlli automatici del documento: bloccanti, avvisi e informazioni con le loro azioni. */
export function ControlliDocumento({
  controlli,
  sezione,
  lavoro,
  onApriSezione,
  onEsegui,
  onAccetta,
}: {
  controlli: Controlli | null;
  sezione: string | null;
  lavoro: string | null;
  onApriSezione: (k: string) => void;
  onEsegui: (c: Controllo) => Promise<boolean>;
  onAccetta: (c: Controllo, motivo: string) => Promise<boolean>;
}) {
  if (!controlli) return <section className="rounded-[1.25rem] bg-white px-4 shadow-[inset_0_0_0_1px_#e2e2e5]"><Caricamento testo="Carico i controlli" /></section>;
  const totale = controlli.bloccanti.length + controlli.avvisi.length + controlli.info.length;
  // Prima i controlli della sezione aperta, poi gli altri.
  const ordina = (l: Controllo[]) => [...l].sort((a, b) => Number(b.sezione === sezione) - Number(a.sezione === sezione) || Number(a.stato === 'accettato') - Number(b.stato === 'accettato'));
  return (
    <section aria-label="Controlli automatici" className="rounded-[1.25rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]">
      <header className="px-4 pb-1 pt-4">
        <h3 className="text-[15px] font-medium text-ink">Controlli automatici</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Si rifanno a ogni modifica, senza costi.</p>
      </header>
      {totale === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-4 pt-2 text-[13.5px] text-ink-soft">
          <CerchioSpunta size={16} aria-hidden className="text-stato-ok-segno" /> Nessun controllo aperto.
        </p>
      ) : (
        <div className="px-4 pb-2">
          {GRUPPI.map((g) => {
            const voci = ordina(controlli[g.k]);
            if (voci.length === 0) return null;
            const I = g.icona;
            return (
              <div key={g.k} className="pt-2">
                <h4 className="flex items-center gap-1.5 text-[12.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                  <I size={14} aria-hidden className={g.cls} /> {g.titolo} <span className="cifre">{voci.length}</span>
                </h4>
                <ul>
                  {voci.map((c) => (
                    <VoceControllo key={c.id} c={c} lavoro={lavoro} onApriSezione={onApriSezione} onEsegui={onEsegui} onAccetta={onAccetta} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
