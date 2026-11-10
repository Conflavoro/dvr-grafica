'use client';

// Impostazioni di questo telefono (solo app nativa): sblocco con il volto o
// l'impronta e file recenti consultabili senza rete.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Scheda } from '@/components/portale/kit';
import { isNativa } from '@/lib/app/nativa';
import { SCADENZA_GIORNI, svuotaFileRecenti } from '@/lib/app/file-recenti';
import { accendiSblocco, disponibilitaSblocco, sbloccoAcceso, spegniSblocco, type TipoSblocco } from '@/lib/app/sblocco';

export function QuestoTelefono() {
  const [nativa, setNativa] = useState(false);
  const [disp, setDisp] = useState<{ ok: boolean; nome: TipoSblocco } | null>(null);
  const [acceso, setAcceso] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativa()) return;
    setNativa(true);
    void disponibilitaSblocco().then(setDisp);
    void sbloccoAcceso().then(setAcceso);
  }, []);

  if (!nativa) return null;

  const cambia = async () => {
    setLavoro(true);
    setNota(null);
    try {
      if (acceso) {
        await spegniSblocco();
        setAcceso(false);
      } else {
        const ok = await accendiSblocco();
        setAcceso(ok);
        if (!ok) setNota('Sblocco non attivato: il telefono non ha confermato la tua identità.');
      }
    } finally {
      setLavoro(false);
    }
  };

  return (
    <Scheda titolo="Questo telefono">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-ink">Sblocco con {disp?.nome ?? 'Face ID o impronta'}</p>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {disp && !disp.ok
                ? 'Sul telefono non risultano volto o impronta configurati: attivali nelle impostazioni del telefono.'
                : 'L’app lo chiede all’apertura e quando ci torni dopo almeno un minuto.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={acceso}
            aria-label={`Sblocco con ${disp?.nome ?? 'Face ID o impronta'}`}
            disabled={lavoro || (!acceso && !disp?.ok)}
            onClick={() => void cambia()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${acceso ? 'bg-grafite-900' : 'bg-perla-linea'}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${acceso ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
        {nota && <p className="text-[13.5px] text-stato-danger-ink">{nota}</p>}
        <div className="border-t border-perla-linea pt-3">
          <p className="text-[15px] font-medium text-ink">File recenti senza rete</p>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Gli ultimi documenti che apri restano sul telefono, cifrati, per {SCADENZA_GIORNI} giorni. Uscendo dall’account si cancellano.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/file-recenti/" className="btn-ghost inline-flex h-11 items-center">
              Apri i file recenti
            </Link>
            <button
              type="button"
              className="btn-ghost h-11"
              onClick={() => void svuotaFileRecenti().then(() => setNota('File recenti cancellati da questo telefono.'))}
            >
              Cancella dal telefono
            </button>
          </div>
        </div>
      </div>
    </Scheda>
  );
}
