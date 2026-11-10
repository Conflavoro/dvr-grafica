'use client';

import { usePortale } from '../../PortaleShell';
import { Testata } from '../../kit';
import { NearMissElenco } from '../condivisi/NearMissElenco';
import { trovaSezione } from '@/lib/portale/sezioni';

/** Area azienda, sezione Near miss: registro dei mancati infortuni con flusso e statistiche. */
export default function NearMissAzienda() {
  const { azienda, puo, versione, apri, chiedi } = usePortale();
  const s = trovaSezione('azienda', 'nearmiss')!;
  if (!azienda) return null;
  return (
    <div className="space-y-5">
      <Testata
        categoria={s.categoria}
        icona={s.icona}
        sopra={azienda.ragione_sociale}
        titolo="Near miss"
        sotto="I quasi incidenti segnalati dai lavoratori e dall’azienda: ognuno si analizza e si chiude con un’azione."
        azioni={
          <button type="button" onClick={() => chiedi('Riassumi i near miss aperti e dimmi da quale cominciare.')} className="btn-ghost">
            Chiedi al Falco
          </button>
        }
      />
      <NearMissElenco
        aziendaId={azienda.id}
        puoGestire={puo('nearmiss_gestisci')}
        puoSegnalare={puo('nearmiss_segnala')}
        versione={versione}
        onApri={(id) => apri(id ? { tipo: 'near_miss', id } : null, azienda.id)}
      />
    </div>
  );
}
