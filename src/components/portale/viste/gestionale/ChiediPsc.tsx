'use client';

import { useState } from 'react';
import { Chip, Foglio, dataIt } from '../../kit';
import { Campo, useAzione, useCarico } from '../amministrazione-kit';
import { creaLinkPsc, revocaLinkPsc, richiestePsc, type StatoRichiestaPsc } from '@/lib/portale/psc-api';

const STATO: Record<StatoRichiestaPsc, { chip: 'warn' | 'ok' | 'neutral'; t: string }> = {
  in_attesa: { chip: 'warn', t: 'In attesa' },
  caricato: { chip: 'ok', t: 'Caricato' },
  revocato: { chip: 'neutral', t: 'Revocato' },
  scaduto: { chip: 'neutral', t: 'Scaduto' },
};

/**
 * "Carica il PSC" dal lato studio: link a scadenza da mandare al committente o
 * al coordinatore, con lo stato di ogni link. Il file arriva nell'archivio
 * dell'impresa e si collega al cantiere.
 */
export function ChiediPsc({ cantiereId, haPsc }: { cantiereId: number; haPsc: boolean }) {
  const l = useCarico(() => richiestePsc(cantiereId), [cantiereId]);
  const az = useAzione();
  const [aperto, setAperto] = useState(false);
  const [dest, setDest] = useState('');
  const [giorni, setGiorni] = useState(14);
  const [link, setLink] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const voci = l.dati ?? [];

  const crea = () =>
    void az
      .esegui(async () => {
        const r = await creaLinkPsc(cantiereId, dest.trim(), giorni);
        setLink(r.link);
      })
      .then((ok) => ok && l.carica());
  const copia = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
    } catch {
      setCopiato(false);
    }
  };

  return (
    <section className="mt-5 border-t border-perla-linea pt-4" data-falco="chiedi_psc">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-medium text-ink">PSC del cantiere</h3>
        <Chip stato={haPsc ? 'ok' : 'todo'}>{haPsc ? 'Ricevuto' : 'Non ancora'}</Chip>
        <button
          type="button"
          className="btn-ghost min-h-[44px] lg:min-h-[40px]"
          data-falco="chiedi_psc_link"
          data-falco-tocca=""
          onClick={() => {
            setLink(null);
            setCopiato(false);
            setDest('');
            setAperto(true);
          }}
        >
          Chiedi il PSC con un link
        </button>
      </div>
      {voci.length > 0 && (
        <ul className="mt-2 divide-y divide-perla-linea">
          {voci.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13.5px]">
              <span className="min-w-0 flex-1 text-ink">
                {v.destinatario}
                <span className="block text-[12.5px] text-ink-muted">
                  {v.stato === 'caricato' ? `Caricato il ${dataIt(v.caricatoIl)}${v.caricatoDa ? ` da ${v.caricatoDa}` : ''}` : `Valido fino al ${dataIt(v.scadeIl)}`}
                </span>
              </span>
              <Chip stato={STATO[v.stato].chip}>{STATO[v.stato].t}</Chip>
              {v.stato === 'in_attesa' && (
                <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[36px]" disabled={az.occupato} onClick={() => void az.esegui(() => revocaLinkPsc(v.id), 'Link revocato.').then((ok) => ok && l.carica())}>
                  Revoca
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Foglio
        aperto={aperto}
        titolo="Chiedi il PSC"
        onChiudi={() => setAperto(false)}
        piede={
          link ? (
            <button type="button" className="btn-primary min-h-[44px]" onClick={() => void copia()}>
              {copiato ? 'Link copiato' : 'Copia il link'}
            </button>
          ) : (
            <button type="button" className="btn-primary min-h-[44px]" disabled={az.occupato || dest.trim().length < 2} onClick={crea}>
              Crea il link
            </button>
          )
        }
      >
        {link ? (
          <div className="space-y-3 text-[14px] text-ink">
            <p>Manda questo link al committente o al coordinatore: vede solo il cantiere e l’impresa e può caricare il PSC una volta sola.</p>
            <p className="break-all rounded-[12px] bg-perla-velo px-3.5 py-3 font-mono text-[12.5px]">{link}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Campo etichetta="A chi lo mandi" aiuto="Nome del coordinatore per la progettazione o del committente.">
              <input className="input-field h-11" value={dest} maxLength={150} onChange={(e) => setDest(e.target.value)} data-falco-campo="psc_destinatario" />
            </Campo>
            <Campo etichetta="Valido per giorni" aiuto="Da 1 a 30.">
              <input type="number" min={1} max={30} className="input-field h-11" value={giorni} onChange={(e) => setGiorni(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
            </Campo>
          </div>
        )}
      </Foglio>
      {az.messaggio}
    </section>
  );
}
