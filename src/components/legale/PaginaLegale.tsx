import Link from 'next/link';
import type { ReactNode } from 'react';
import identita from '../../../app.config.json';

/**
 * Titolare: Conflavoro Servizi S.r.l. (scelta del 30/10/2026). Partita IVA ed
 * email per la privacy restano da confermare. Si cambiano qui, in un solo punto.
 */
export const TITOLARE = {
  ragioneSociale: 'Conflavoro Servizi S.r.l.',
  sede: 'Largo Arenula 26, 00186 Roma',
  partitaIva: '[Partita IVA da definire]',
  email: '[Email per la privacy da definire]',
};

export const NOME_APP: string = identita.nome;

export function PaginaLegale({ titolo, aggiornata, children }: { titolo: string; aggiornata: string; children: ReactNode }) {
  return (
    <main
      className="min-h-screen bg-white px-4 text-ink sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-[14px] text-ink-muted hover:text-ink">
          {NOME_APP}
        </Link>
        <h1 className="mt-4 text-[30px] font-medium leading-tight tracking-[-0.03em] sm:text-[36px]">{titolo}</h1>
        <p className="mt-2 text-[14px] text-ink-muted">Ultimo aggiornamento: {aggiornata}</p>
        <div className="legale mt-8 space-y-6 text-[15.5px] leading-relaxed text-ink">{children}</div>
      </article>
    </main>
  );
}

export function Paragrafo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[19px] font-medium tracking-[-0.01em]">{titolo}</h2>
      {children}
    </section>
  );
}
