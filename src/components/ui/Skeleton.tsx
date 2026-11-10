/**
 * Skeleton di caricamento: dà subito la FORMA del contenuto (niente "salto" quando
 * arrivano i dati). Usa animate-pulse + toni brand tenui.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-brand-100/70 ${className}`} />;
}

/** Skeleton tabella: header + N righe, coerente con le liste del registro. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card-luxury overflow-hidden">
      <div className="border-b border-brand-100 bg-brand-50/40 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-brand-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton griglia di card (es. aziende, sopralluogo). */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card-luxury flex items-center gap-3 p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
