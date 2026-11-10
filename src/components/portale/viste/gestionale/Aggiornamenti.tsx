'use client';

import { useEffect, useState } from 'react';
import { Storico } from '@/components/icone';
import { elencoAggiornamenti } from '@/lib/portale/aggiornamenti-api';
import { usePortale } from '../../PortaleShell';
import { Testata } from '../../kit';
import { Impatti } from '../condivisi/Impatti';

/** Gestionale: cosa è cambiato nelle aziende dello studio e cosa va aggiornato. */
export default function Aggiornamenti() {
  const { chiedi, versione, filtroCliente } = usePortale();
  const [aziende, setAziende] = useState<Array<{ id: number; nome: string }>>([]);
  const [sceltaLocale, setScelta] = useState<number | null>(null);
  // Il filtro "Solo <azienda>" del menu prevale sulla scelta della pagina.
  const scelta = filtroCliente ?? sceltaLocale;

  useEffect(() => {
    elencoAggiornamenti({ stato: 'tutti', giorni: 180 })
      .then((d) => {
        const m = new Map<number, string>();
        for (const i of d.impatti) m.set(i.aziendaId, i.ragioneSociale ?? `Azienda ${i.aziendaId}`);
        for (const c of d.cambiamenti) if (c.aziendaId) m.set(c.aziendaId, c.ragioneSociale ?? `Azienda ${c.aziendaId}`);
        setAziende(Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
      })
      .catch(() => setAziende([]));
  }, [versione]);

  return (
    <div className="space-y-5">
      <Testata
        categoria="documenti"
        icona={Storico}
        sopra="Clienti"
        titolo="Aggiornamenti"
        sotto="Ogni novità delle aziende aggiorna da sola cosa va fatto: documenti, formazione, visite, DPI, verifiche."
        azioni={
          <button type="button" className="btn-primary min-h-[44px] w-full sm:w-auto" onClick={() => chiedi('Cosa è cambiato nelle aziende dello studio e da dove comincio con gli aggiornamenti?')}>
            Chiedi a Falco da dove cominciare
          </button>
        }
      />
      {aziende.length > 1 && !filtroCliente && (
        <label className="block max-w-md">
          <span className="mb-1 block text-[13px] text-ink-muted">Azienda</span>
          <select
            value={scelta ?? ''}
            onChange={(e) => setScelta(e.target.value ? Number(e.target.value) : null)}
            className="h-11 w-full rounded-full border border-perla-linea bg-white px-4 text-[14.5px] text-ink"
          >
            <option value="">Tutte le aziende</option>
            {aziende.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <Impatti aziendaId={scelta} titolo={scelta ? 'Cosa va aggiornato' : 'Cosa va aggiornato nelle aziende'} />
    </div>
  );
}
