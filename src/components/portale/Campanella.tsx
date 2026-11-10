'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avanti, Campanella as Icona, Spunta } from '@/components/icone';
import { RigaTrascinabile, SuggerimentoGesto } from './telefono/RigaTrascinabile';
import { ascoltaTempoReale } from '@/lib/tempo-reale';
import { novita as caricaNovita, segnaLetta, segnaTutteLette, type Novita } from '@/lib/portale/api';
import { PASTIGLIA, SEZIONI_AZIENDA, type AppPortale, type Categoria } from '@/lib/portale/sezioni';
import { clsx } from '@/lib/clsx';

/**
 * Novita' in app: tutto quello che il sistema registra (nuovo assunto, documento
 * da aggiornare, scadenza vicina, proposta da approvare, near miss, dati importati)
 * arriva qui, per chi deve saperlo. Si aggiorna da sola ogni minuto.
 */


function quando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const oggi = new Date();
  const ieri = new Date(oggi.getTime() - 86400000);
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === oggi.toDateString()) return `oggi, ${ora}`;
  if (d.toDateString() === ieri.toDateString()) return `ieri, ${ora}`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const CATEGORIE = new Set(Object.keys(PASTIGLIA));

export function linkNovita(n: Novita, app: AppPortale): string | null {
  const l = n.link;
  if (!l.sezione) return null;
  const dest = (l.app === 'azienda' || l.app === 'gestionale' ? l.app : app) as AppPortale;
  // Il backend registra la sezione con il nome dell'app davanti (gestionale.aziende):
  // la pagina vera e' /gestionale/aziende/.
  const sezione = l.sezione.includes('.') ? l.sezione.slice(l.sezione.indexOf('.') + 1) : l.sezione;
  const q = new URLSearchParams();
  if (l.oggetto_id) q.set('id', String(l.oggetto_id));
  if (l.azienda_id) q.set('azienda', String(l.azienda_id));
  return `/${dest}/${sezione}/${q.toString() ? `?${q}` : ''}`;
}

/** Novità dell'utente con il conteggio delle non lette; si aggiorna col tempo reale. */
export function useNovita() {
  const [voci, setVoci] = useState<Novita[]>([]);
  const [nonLette, setNonLette] = useState(0);

  const carica = useCallback(() => {
    caricaNovita()
      .then((r) => {
        setVoci(r.voci);
        setNonLette(r.nonLette);
      })
      .catch(() => undefined);
  }, []);

  // Tempo reale (ADR-013): si ricarica quando il feed porta novita' o cambia il conteggio.
  const ultime = useRef<number | null>(null);
  useEffect(() => {
    carica();
    return ascoltaTempoReale((l) => {
      const cambiato = ultime.current !== null && ultime.current !== l.nonLette;
      ultime.current = l.nonLette;
      if (cambiato || l.eventi.some((e) => e.tipo === 'novita')) carica();
      else setNonLette(l.nonLette);
    });
  }, [carica]);

  const leggi = useCallback((n: Novita) => {
    if (n.letta) return;
    setVoci((v) => v.map((x) => (x.id === n.id ? { ...x, letta: true } : x)));
    segnaLetta(n.id)
      .then(setNonLette)
      .catch(() => undefined);
  }, []);

  const leggiTutte = useCallback(() => {
    setVoci((v) => v.map((x) => ({ ...x, letta: true })));
    segnaTutteLette()
      .then(setNonLette)
      .catch(() => undefined);
  }, []);

  return { voci, nonLette, leggi, leggiTutte };
}

function categoriaDi(n: Novita): Categoria {
  return (CATEGORIE.has(n.categoria) ? n.categoria : 'assistenza') as Categoria;
}

/** Pastiglia della categoria della notifica con l'icona della sezione corrispondente. */
function PastigliaNovita({ n, piccola = false }: { n: Novita; piccola?: boolean }) {
  const cat = categoriaDi(n);
  const I = SEZIONI_AZIENDA.find((s) => s.categoria === cat)?.icona ?? Icona;
  return (
    <span aria-hidden className={clsx('grid shrink-0 place-items-center rounded-full', PASTIGLIA[cat], piccola ? 'mt-0.5 h-8 w-8' : 'h-10 w-10')}>
      <I size={piccola ? 15 : 18} />
    </span>
  );
}

function Testo({ n }: { n: Novita }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={clsx('block text-small leading-snug text-fg', !n.letta && 'font-medium')}>{n.titolo}</span>
      {n.testo && <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">{n.testo}</span>}
      <span className="mt-1 block text-caption font-normal tracking-normal text-fg-muted">
        {[n.azienda?.ragione_sociale, quando(n.creato)].filter(Boolean).join(' · ')}
      </span>
    </span>
  );
}

/**
 * Pagina delle notifiche sul telefono (03 §2, #notifiche): "Segna lette" in alto, righe da
 * trascinare a sinistra per segnarle lette, tocco per aprire.
 */
export function PaginaNotifiche({ app }: { app: AppPortale }) {
  const router = useRouter();
  const { voci, nonLette, leggi, leggiTutte } = useNovita();
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-[2.125rem] font-medium leading-[1.05] tracking-[-0.025em] text-fg">Notifiche</h1>
          <p className="mt-1 text-small text-fg-muted">{nonLette > 0 ? `${nonLette} da leggere` : 'Tutto letto'}</p>
        </div>
        {nonLette > 0 && (
          <button type="button" onClick={leggiTutte} className="btn btn-sm btn-ghost">
            Segna lette
          </button>
        )}
      </div>
      {voci.length === 0 ? (
        <p className="card text-center text-small text-fg-muted">Nessuna novità.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-hse-lg shadow-[inset_0_0_0_1px_var(--hse-line)]">
            {voci.map((n) => (
              <RigaTrascinabile
                key={n.id}
                inizio={<PastigliaNovita n={n} />}
                titolo={n.titolo}
                sotto={[n.testo, [n.azienda?.ragione_sociale, quando(n.creato)].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}
                fine={
                  <>
                    {!n.letta && <span aria-label="Da leggere" className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger-mark" />}
                    <Avanti size={16} aria-hidden className="shrink-0 text-fg-faint" />
                  </>
                }
                azioni={n.letta ? [] : [{ etichetta: 'Letta', icona: Spunta, tono: 'bg-grafite-900 text-white', onAzione: () => leggi(n) }]}
                onClick={() => {
                  leggi(n);
                  const dest = linkNovita(n, app);
                  if (dest) router.push(dest);
                }}
              />
            ))}
          </div>
          {nonLette > 0 && <SuggerimentoGesto chiave="notifiche">Trascina una notifica a sinistra per segnarla come letta</SuggerimentoGesto>}
        </>
      )}
    </div>
  );
}

/** Campanella del computer: pannello largo 24rem sotto il pulsante. */
export function Campanella({ app }: { app: AppPortale }) {
  const router = useRouter();
  const [aperta, setAperta] = useState(false);
  const { voci, nonLette, leggi, leggiTutte } = useNovita();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperta) return;
    const fuori = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setAperta(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAperta(false);
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperta]);

  const apri = (n: Novita) => {
    leggi(n);
    const dest = linkNovita(n, app);
    setAperta(false);
    if (dest) router.push(dest);
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        aria-expanded={aperta}
        aria-label={nonLette > 0 ? `Notifiche, ${nonLette} da leggere` : 'Notifiche'}
        className="relative grid h-11 w-11 place-items-center rounded-full text-fg shadow-[inset_0_0_0_1.5px_var(--hse-line)] hover:shadow-[inset_0_0_0_1.5px_var(--hse-fg-faint)]"
      >
        <Icona size={19} aria-hidden />
        {nonLette > 0 && <span aria-hidden className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger-mark ring-2 ring-white" />}
      </button>
      {aperta && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[75dvh] overflow-hidden rounded-hse-lg bg-surface shadow-[inset_0_0_0_1px_var(--hse-line),var(--shadow-pop)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-title text-fg">Notifiche</p>
            {nonLette > 0 && (
              <button type="button" onClick={leggiTutte} className="btn btn-sm btn-ghost">
                Segna lette
              </button>
            )}
          </div>
          <ul className="max-h-[calc(75dvh-3.5rem)] overflow-y-auto">
            {voci.length === 0 && <li className="px-4 py-6 text-center text-small text-fg-muted">Nessuna novità.</li>}
            {voci.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => apri(n)} className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-sunken">
                  <PastigliaNovita n={n} piccola />
                  <Testo n={n} />
                  {!n.letta && <span aria-label="Da leggere" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger-mark" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
