'use client';

import Link from 'next/link';
import { schedaAzienda } from '@/lib/portale/rotte-nuove';
import { useState } from 'react';
import {
  Building2,
  Camera,
  ChevronRight,
  FileAudio,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Search,
  StickyNote,
  Users,
  Video,
  Wand2,
  type LucideIcon,
} from '@/components/icone';
import type { Pannello, PannelloArchivioElemento } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { AudioRecorder } from '@/components/ui/AudioRecorder';
import { BTN, BadgeStato, CartaPannello, Vuoto, dataBreve, puoScrivere, useAzioniPannelli } from './contesto';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const DIMENSIONE: Record<string, string> = { micro: 'Micro', piccola: 'Piccola', media: 'Media', grande: 'Grande' };
const nf = new Intl.NumberFormat('it-IT');

// ------------------------------------------------------------------
// Elenco aziende
// ------------------------------------------------------------------
export function PannelloAziende({ p }: { p: P<'aziende'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={Building2} titolo="Aziende" sottotitolo={`${p.aziende.length} in elenco`}>
      {p.aziende.length === 0 ? (
        <Vuoto>Nessuna azienda trovata.</Vuoto>
      ) : (
        <ul className="-mx-2 max-h-[420px] space-y-0.5 overflow-y-auto">
          {p.aziende.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={az.occupato}
                onClick={() => az.apriAzienda({ id: a.id, ragione_sociale: a.ragione_sociale })}
                className="flex min-h-[52px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-brand-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{a.ragione_sociale}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">
                    {[a.ateco && `ATECO ${a.ateco}`, a.dimensione && DIMENSIONE[a.dimensione], a.lavoratori != null && `${nf.format(a.lavoratori)} lavoratori`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <BadgeStato stato={a.ultimo_dvr} />
                <ChevronRight size={15} aria-hidden className="shrink-0 text-ink-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Scheda azienda
// ------------------------------------------------------------------
const ICONA_TIPO: Record<string, LucideIcon> = {
  foto: ImageIcon,
  audio: FileAudio,
  video: Video,
  documento: FileText,
  nota: StickyNote,
};
const NOME_TIPO: Record<string, string> = { foto: 'Foto', audio: 'Audio', video: 'Video', documento: 'Documenti', nota: 'Note' };

export function PannelloAzienda({ p }: { p: P<'azienda'> }) {
  const az = useAzioniPannelli();
  const a = p.azienda;
  const breve = { id: a.id, ragione_sociale: a.ragione_sociale };
  const [sopralluogo, setSopralluogo] = useState(false);
  const scrive = puoScrivere(az.ruolo);
  const mansioni = Object.entries(a.mansioni).sort((x, y) => y[1] - x[1]);
  const archivio = Object.entries(a.archivio);

  return (
    <CartaPannello
      icona={Building2}
      titolo={a.ragione_sociale}
      sottotitolo={[a.ateco && `ATECO ${a.ateco}`, a.dimensione && DIMENSIONE[a.dimensione]].filter(Boolean).join(' · ') || null}
      azioni={p.nuova ? <span className="shrink-0 rounded-md bg-ok px-1.5 py-0.5 text-[11px] font-medium text-ok-ink">Appena creata</span> : undefined}
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <dt className="label-upper">Lavoratori</dt>
          <dd className="font-semibold text-ink">{a.lavoratori_totali != null ? nf.format(a.lavoratori_totali) : 'n.d.'}</dd>
        </div>
        <div>
          <dt className="label-upper">Archivio</dt>
          <dd className="font-semibold text-ink">{archivio.reduce((n, [, v]) => n + v, 0)} elementi</dd>
        </div>
      </dl>

      {a.sedi.length > 0 && (
        <div className="mt-3">
          <p className="label-upper">Sedi</p>
          <ul className="mt-1 space-y-0.5">
            {a.sedi.slice(0, 4).map((s, i) => (
              <li key={i} className="truncate">
                <span className="text-ink-muted">{s.tipo === 'legale' ? 'Legale' : s.tipo === 'operativa' ? 'Operativa' : s.tipo || 'Sede'}:</span>{' '}
                {[s.indirizzo, s.comune, s.provincia && `(${s.provincia})`].filter(Boolean).join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.figure.length > 0 && (
        <div className="mt-3">
          <p className="label-upper">Figure della sicurezza</p>
          <dl className="mt-1 space-y-0.5">
            {a.figure.map((f) => (
              <div key={f.ruolo} className="flex gap-2">
                <dt className="w-32 shrink-0 text-ink-muted">{f.ruolo}</dt>
                <dd className="min-w-0 break-words">{f.nome}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {mansioni.length > 0 && (
        <div className="mt-3">
          <p className="label-upper">Mansioni</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {mansioni.map(([m, n]) => (
              <li key={m} className="rounded-md bg-brand-50 px-2 py-0.5 text-[12px]">
                {m || 'Senza mansione'} <span className="text-ink-muted">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {archivio.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3 text-[12px] text-ink-muted">
          {archivio.map(([t, n]) => {
            const I = ICONA_TIPO[t] ?? FolderOpen;
            return (
              <li key={t} className="inline-flex items-center gap-1">
                <I size={13} aria-hidden /> {NOME_TIPO[t] ?? t} {n}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {scrive && (
          <>
            <button type="button" className={BTN} aria-expanded={sopralluogo} onClick={() => setSopralluogo((v) => !v)}>
              <Camera size={15} aria-hidden /> Sopralluogo
            </button>
            <button
              type="button"
              className="btn-primary min-h-[44px] px-3 text-[13px]"
              disabled={az.occupato}
              onClick={() => az.invia(`Genera il DVR di ${a.ragione_sociale}`)}
            >
              <Wand2 size={15} aria-hidden /> Genera DVR
            </button>
          </>
        )}
        <Link href={schedaAzienda(a.id)} className={BTN}>
          Scheda completa
        </Link>
      </div>

      {scrive && sopralluogo && (
        <div className="mt-3 flex flex-wrap items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <button type="button" className={BTN} disabled={az.occupato} onClick={() => az.scegliFoto(breve)}>
            <Camera size={15} aria-hidden /> Scatta foto
          </button>
          <AudioRecorder size="sm" disabled={az.occupato} onRecorded={(f) => az.caricaAudio(breve, f)} />
          <p className="basis-full text-[12px] text-ink-muted">Foto e registrazioni finiscono nell&apos;archivio dell&apos;azienda e l&apos;agente le usa per il DVR.</p>
        </div>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Archivio di sopralluogo
// ------------------------------------------------------------------
function ElementoArchivio({ e, estratto = false }: { e: PannelloArchivioElemento; estratto?: boolean }) {
  const [aperto, setAperto] = useState(false);
  const I = ICONA_TIPO[e.tipo] ?? FileText;
  const lungo = e.analisi.length > 140;
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-brand-100 bg-brand-50/30 p-3">
      <div className="flex items-start gap-2">
        <I size={16} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{e.titolo || NOME_TIPO[e.tipo] || e.tipo}</p>
          {e.creato && <p className="text-[11px] text-ink-muted">{dataBreve(e.creato)}</p>}
        </div>
      </div>
      {e.errore_analisi ? (
        <p className="mt-2 text-[12px] text-warn-ink">Analisi non riuscita: {e.errore_analisi}</p>
      ) : e.analisi ? (
        <>
          {estratto && <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">Estratto</p>}
          <p className={`${estratto ? 'mt-0.5' : 'mt-2'} whitespace-pre-line break-words text-[12.5px] leading-snug ${aperto ? '' : 'line-clamp-3'}`}>{e.analisi}</p>
          {lungo && (
            <button
              type="button"
              onClick={() => setAperto((v) => !v)}
              aria-expanded={aperto}
              className="mt-1 min-h-[32px] self-start text-[12px] font-medium text-brand-700 hover:underline"
            >
              {aperto ? 'Riduci' : estratto ? 'Leggi tutto l’estratto' : 'Leggi tutta l’analisi'}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-[12px] text-ink-muted">Analisi in corso.</p>
      )}
    </li>
  );
}

export function PannelloArchivio({ p }: { p: P<'archivio'> }) {
  const az = useAzioniPannelli();
  const ds = useDataSource();
  const nome = az.nomeAzienda(p.azienda_id);
  const breve = { id: p.azienda_id, ragione_sociale: nome ?? `Azienda ${p.azienda_id}` };
  const [aggiunti, setAggiunti] = useState<PannelloArchivioElemento[]>([]);
  const [nota, setNota] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const elementi = [...aggiunti, ...p.elementi];
  const scrive = puoScrivere(az.ruolo) && !p.ricerca;

  const salvaNota = async () => {
    const t = (nota ?? '').trim();
    if (!t) return;
    setSalvando(true);
    setErrore(null);
    try {
      const d = await ds.companyDocuments.addNote(p.azienda_id, t, undefined, 'manuale');
      setAggiunti((l) => [
        { id: d.id, tipo: 'nota', titolo: d.titolo ?? 'Nota', analisi: d.testo_analisi ?? t, errore_analisi: null, creato: d.created_at },
        ...l,
      ]);
      setNota(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Nota non salvata.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <CartaPannello
      icona={p.ricerca ? Search : FolderOpen}
      titolo={p.ricerca ? 'Trovato nell’archivio' : 'Archivio di sopralluogo'}
      sottotitolo={[nome, p.ricerca ? `${elementi.length} risultati` : `${elementi.length} elementi`].filter(Boolean).join(' · ')}
    >
      {elementi.length === 0 ? (
        <Vuoto>
          {p.ricerca
            ? 'Nessun elemento dell’archivio corrisponde alla ricerca.'
            : 'Archivio vuoto: aggiungi foto, registrazioni o note dal sopralluogo.'}
        </Vuoto>
      ) : (
        <ul className="grid max-h-[480px] gap-2 overflow-y-auto sm:grid-cols-2">
          {elementi.map((e) => (
            <ElementoArchivio key={e.id} e={e} estratto={p.ricerca} />
          ))}
        </ul>
      )}
      {scrive && (
        <div className="mt-3">
          {nota === null ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN} disabled={az.occupato} onClick={() => az.scegliFoto(breve)}>
                <Camera size={15} aria-hidden /> Aggiungi foto
              </button>
              <button type="button" className={BTN} onClick={() => setNota('')}>
                <StickyNote size={15} aria-hidden /> Aggiungi nota
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block">
                <span className="label-upper">Nota di sopralluogo</span>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value.slice(0, 8000))}
                  rows={3}
                  className="mt-1 block w-full resize-y rounded-xl border border-brand-200 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none sm:text-[13.5px]"
                  placeholder="Esempio: reparto stiro, pavimento bagnato vicino ai mangani"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary min-h-[44px] px-3 text-[13px]" disabled={salvando || !nota.trim()} onClick={() => void salvaNota()}>
                  {salvando && <Loader2 size={14} aria-hidden className="animate-spin" />} Salva nota
                </button>
                <button type="button" className={BTN} disabled={salvando} onClick={() => setNota(null)}>
                  Annulla
                </button>
              </div>
            </div>
          )}
          {errore && <p role="alert" className="mt-2 text-[12px] text-danger-mark">{errore}</p>}
        </div>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Lavoratori per mansione
// ------------------------------------------------------------------
export function PannelloLavoratori({ p }: { p: P<'lavoratori'> }) {
  const az = useAzioniPannelli();
  const gruppi = new Map<string, string[]>();
  for (const l of p.lavoratori) {
    const k = l.mansione || 'Senza mansione';
    gruppi.set(k, [...(gruppi.get(k) ?? []), l.nome || 'Senza nome']);
  }
  const ordinati = Array.from(gruppi.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'it'));
  return (
    <CartaPannello icona={Users} titolo="Lavoratori" sottotitolo={[az.nomeAzienda(p.azienda_id), `${p.lavoratori.length} in totale`].filter(Boolean).join(' · ')}>
      {ordinati.length === 0 ? (
        <Vuoto>Nessun lavoratore registrato.</Vuoto>
      ) : (
        <ul className="max-h-[440px] space-y-3 overflow-y-auto">
          {ordinati.map(([m, nomi]) => (
            <li key={m}>
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{m}</span>
                <span className="shrink-0 text-[12px] text-ink-muted">{nomi.length}</span>
              </p>
              <p className="mt-0.5 break-words text-[12.5px] text-ink-muted">{nomi.join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}
