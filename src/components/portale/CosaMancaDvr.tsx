'use client';

import Link from 'next/link';

/** Voce di cosa manca per un DVR completo (dal server: CosaManca). */
export interface VoceMancante {
  campo: string;
  motivo: string;
  scheda: string;
  carica: string | null;
}

export function vociMancanti(raw: unknown): VoceMancante[] {
  const voci = raw && typeof raw === 'object' ? (raw as { voci?: unknown }).voci : null;
  if (!Array.isArray(voci)) return [];
  return voci
    .map((x) => {
      const m = (x ?? {}) as Record<string, unknown>;
      const campo = typeof m.campo === 'string' ? m.campo : '';
      return campo ? { campo, motivo: String(m.motivo ?? ''), scheda: String(m.scheda ?? 'panoramica'), carica: typeof m.carica === 'string' ? m.carica : null } : null;
    })
    .filter((x): x is VoceMancante => x !== null);
}

/**
 * Cosa manca per un DVR completo, con dove si completa e cosa caricare (Rocco 08/11:
 * ogni sezione mostra cosa serve e la piattaforma aiuta a completarlo).
 */
export function CosaMancaDvr({ voci, aziendaId, nome, puoScrivere, chiedi, compatto = false }: { voci: VoceMancante[]; aziendaId: number; nome: string; puoScrivere: boolean; chiedi: (t: string) => void; compatto?: boolean }) {
  if (voci.length === 0) return null;
  const mostrate = compatto ? voci.slice(0, 4) : voci;
  return (
    <div className="rounded-[1.25rem] bg-warn p-4 text-warn-ink">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-medium text-ink">Cosa manca per un DVR completo ({voci.length})</h3>
        {puoScrivere && (
          <button
            type="button"
            className="btn-acido min-h-[40px] px-4 text-[13px]"
            onClick={() => chiedi(`Per ${nome} mancano: ${voci.map((m) => m.campo).join('; ')}. Cerca prima nell'archivio e nei dati che hai, registra tu quello che trovi e chiedimi solo quello che manca davvero, una cosa alla volta.`)}
          >
            Completa con il Falco
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-muted">Il DVR si può generare anche ora: dove mancano i dati resta da completare prima della firma. Puoi allegare i documenti nella chat del Falco e li legge lui.</p>
      <ul className="mt-3 space-y-2">
        {mostrate.map((m) => (
          <li key={m.campo} className="flex flex-wrap items-center gap-3 rounded-[1rem] bg-white px-4 py-3">
            <span className="min-w-0 flex-1 basis-[14rem]">
              <span className="block text-[14.5px] font-medium text-ink">{m.campo}</span>
              <span className="block text-[12.5px] text-ink-muted">{m.motivo}</span>
              {m.carica && <span className="mt-0.5 block text-[12.5px] text-ink-muted">Da caricare: {m.carica}</span>}
            </span>
            <span className="flex flex-wrap gap-2">
              <Link href={`/gestionale/aziende/?id=${aziendaId}${m.scheda !== 'panoramica' ? `&tab=${m.scheda}` : ''}`} className="btn-ghost min-h-[40px] px-3.5 text-[13px]">
                Apri
              </Link>
              {puoScrivere && (
                <button type="button" className="btn-ghost min-h-[40px] px-3.5 text-[13px]" onClick={() => chiedi(`Per ${nome} manca: ${m.campo}. Cerca nell'archivio e nei dati, registralo se lo trovi, altrimenti chiedimelo.`)}>
                  Chiedi al Falco
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {compatto && voci.length > mostrate.length && (
        <Link href="/gestionale/dvr/" className="mt-2 inline-block text-[13px] text-ink underline underline-offset-4">
          Vedi tutte nella Scrivania del DVR
        </Link>
      )}
    </div>
  );
}
