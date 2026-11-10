'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Caricamento, Foglio } from '../../kit';
import { Avanti, Orologio, ScudoAllerta } from '@/components/icone';
import { referente, type Referente as R } from '@/lib/portale/referente-api';

const iniziali = (n: string | null): string =>
  (n ?? '')
    .replace(/^(dott\.?ssa|dott\.|ing\.|geom\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'R';

/** Contatti del referente, Pronto Ispezioni (solo a chi la vede) e domande frequenti. */
export function SchedaReferente({ aziendaId }: { aziendaId: number }) {
  const [r, setR] = useState<R | null>(null);
  useEffect(() => {
    referente(aziendaId).then(setR).catch(() => setR(null));
  }, [aziendaId]);
  if (!r) return <Caricamento testo="Carico i contatti" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-20 place-items-center rounded-full bg-cat-assistenza text-h3 text-cat-assistenza-ink">{iniziali(r.nome)}</span>
        <p className="mt-2 text-h3 text-fg">{r.nome ?? 'Lo studio'}</p>
        <p className="text-small text-fg-muted">{r.ruolo}</p>
        <p className="mt-1 flex items-center gap-1 text-caption text-fg-muted"><Orologio size={13} aria-hidden /> {r.orari}</p>
      </div>
      {(r.telefono || r.email) && (
        <ul className="card divide-y divide-line">
          {r.telefono && (
            <li><a href={`tel:${r.telefono.replace(/\s+/g, '')}`} className="flex items-center justify-between p-4"><span><span className="block text-[15px] text-fg">Chiama</span><span className="text-small text-fg-muted">{r.telefono}</span></span><Avanti size={16} aria-hidden /></a></li>
          )}
          {r.email && (
            <li><a href={`mailto:${r.email}`} className="flex items-center justify-between p-4"><span><span className="block text-[15px] text-fg">Scrivi un&apos;email</span><span className="text-small text-fg-muted">{r.email}</span></span><Avanti size={16} aria-hidden /></a></li>
          )}
        </ul>
      )}
      {r.prontoIspezioni && (
        <Link href="/azienda/ispezioni/" className="flex items-center gap-3 rounded-[1.5rem] bg-black p-4 text-white">
          <span className="grid size-10 place-items-center rounded-full bg-acid-400 text-acid-950"><ScudoAllerta size={18} aria-hidden /></span>
          <span className="flex-1"><span className="block text-[15px]">Hai un controllo in corso?</span><span className="block text-small text-grafite-400">Pronto Ispezioni: richiamata in 15 minuti</span></span>
          <Avanti size={16} aria-hidden />
        </Link>
      )}
      <div>
        <p className="text-caption uppercase text-fg-muted">Domande frequenti</p>
        <div className="card mt-2 divide-y divide-line">
          {r.domande.map((d) => (
            <details key={d.domanda} className="p-4">
              <summary className="cursor-pointer text-[15px] font-medium text-fg">{d.domanda}</summary>
              <p className="mt-2 text-[15px] text-fg-muted">{d.risposta}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FoglioReferente({ aperto, aziendaId, onChiudi }: { aperto: boolean; aziendaId: number; onChiudi: () => void }) {
  return (
    <Foglio aperto={aperto} onChiudi={onChiudi} titolo="Il tuo referente" sopra="Contatti e domande frequenti">
      {aperto && <SchedaReferente aziendaId={aziendaId} />}
    </Foglio>
  );
}
