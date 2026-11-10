'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Azienda, Cerca, Persona } from '@/components/icone';
import { useDataSource } from '@/lib/use-data-source';
import type { Company, Lavoratore } from '@/lib/data-source';
import { PASTIGLIA, percorso, type AppPortale, type Sezione } from '@/lib/portale/sezioni';
import { clsx } from '@/lib/clsx';

/** Ricerca (Ctrl o Cmd e K): sezioni, aziende (gestionale), lavoratori (area azienda). */

function norm(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Risultato {
  chiave: string;
  titolo: string;
  sotto: string;
  href: string;
  tipo: 'sezione' | 'azienda' | 'lavoratore';
  sezione?: Sezione;
}

export function Ricerca({
  aperto,
  onChiudi,
  app,
  sezioni,
  aziendaId,
  schermoIntero = false,
}: {
  aperto: boolean;
  onChiudi: () => void;
  app: AppPortale;
  sezioni: Sezione[];
  aziendaId: number | null;
  /** Telefono (03 §2): ricerca a schermo intero con "Annulla"; toccando un risultato si chiude. */
  schermoIntero?: boolean;
}) {
  const ds = useDataSource();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [aziende, setAziende] = useState<Company[]>([]);
  const [lavoratori, setLavoratori] = useState<Lavoratore[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!aperto) document.dispatchEvent(new CustomEvent('portale-cerca'));
      }
    };
    document.addEventListener('keydown', tasto);
    return () => document.removeEventListener('keydown', tasto);
  }, [aperto]);

  useEffect(() => {
    if (!aperto) return;
    setQ('');
    setTimeout(() => input.current?.focus(), 30);
    if (app === 'gestionale') ds.companies.list().then(setAziende).catch(() => undefined);
    else if (aziendaId) ds.lavoratori.list({ companyId: aziendaId }).then(setLavoratori).catch(() => undefined);
  }, [aperto, app, aziendaId, ds]);

  const risultati = useMemo<Risultato[]>(() => {
    const t = norm(q.trim());
    const sez: Risultato[] = sezioni.map((s) => ({ chiave: `s${s.chiave}`, titolo: s.titolo, sotto: s.gruppo ?? 'Sezione', href: percorso(app, s.chiave), tipo: 'sezione', sezione: s }));
    if (!t) return sez.slice(0, 9);
    const az: Risultato[] = aziende
      .filter((a) => norm(`${a.ragione_sociale} ${a.ateco ?? ''} ${a.sedi?.[0]?.comune ?? ''}`).includes(t))
      .map((a) => ({ chiave: `a${a.id}`, titolo: a.ragione_sociale, sotto: [a.ateco && `ATECO ${a.ateco}`, a.sedi?.[0]?.comune].filter(Boolean).join(' · '), href: `/gestionale/aziende/?id=${a.id}`, tipo: 'azienda' }));
    const lav: Risultato[] = lavoratori
      .filter((l) => norm(`${l.nome} ${l.cognome} ${l.mansione ?? ''}`).includes(t))
      .map((l) => ({ chiave: `l${l.id}`, titolo: `${l.nome} ${l.cognome}`, sotto: l.mansione ?? 'Lavoratore', href: `/azienda/persone/?id=${l.id}`, tipo: 'lavoratore' }));
    return [...sez.filter((r) => norm(r.titolo).includes(t)), ...az, ...lav].slice(0, 9);
  }, [q, sezioni, aziende, lavoratori, app]);

  const vai = (r: Risultato) => {
    onChiudi();
    router.push(r.href);
  };

  if (!aperto) return null;
  const segnaposto = app === 'gestionale' ? 'Cerca aziende, lavoratori, P.IVA, preventivi…' : schermoIntero ? 'Cerca persone, documenti, corsi…' : 'Cerca lavoratori, documenti, corsi, sezioni…';
  const campo = (
    <input
      ref={input}
      value={q}
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onChiudi();
        if (e.key === 'Enter' && risultati[0]) vai(risultati[0]);
      }}
      placeholder={segnaposto}
      aria-label="Cerca"
      className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-fg-faint focus:outline-none focus-visible:shadow-none"
    />
  );
  const elenco = (
    <ul className={clsx('overflow-y-auto p-2', schermoIntero ? 'min-h-0 flex-1' : 'max-h-[60dvh]')}>
      {risultati.length === 0 && <li className="px-3 py-6 text-center text-small text-fg-muted">Nessun risultato per “{q}”.</li>}
      {risultati.map((r) => {
        const I = r.sezione?.icona ?? (r.tipo === 'azienda' ? Azienda : Persona);
        return (
          <li key={r.chiave}>
            <button type="button" onClick={() => vai(r)} className="tocco flex min-h-[52px] w-full items-center gap-3 rounded-hse-md px-3 text-left hover:bg-sunken">
              <span aria-hidden className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', r.sezione ? PASTIGLIA[r.sezione.categoria] : 'bg-sunken text-fg')}>
                <I size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-fg">{r.titolo}</span>
                <span className="block truncate text-[12.5px] text-fg-muted">{r.sotto}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  if (schermoIntero) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Cerca" className="fixed inset-0 z-[70] flex flex-col bg-canvas" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-sunken px-4">
            <Cerca size={18} aria-hidden className="text-fg-muted" />
            {campo}
          </label>
          <button type="button" onClick={onChiudi} className="btn btn-ghost px-3">
            Annulla
          </button>
        </div>
        {elenco}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 px-3 pt-[10vh]" onClick={onChiudi}>
      <div role="dialog" aria-modal="true" aria-label="Cerca" className="w-full max-w-[36rem] overflow-hidden rounded-hse-xl bg-surface" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-3 border-b border-line px-5">
          <Cerca size={19} aria-hidden className="text-fg-muted" />
          {campo}
        </label>
        {elenco}
      </div>
    </div>
  );
}
