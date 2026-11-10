'use client';

import { clearApiCache } from '@/lib/api';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompanyDocument, CompanyDocumentTipo } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { Audio, Cestino, Documento, Immagine, Nota, Piu, Scarica, Video } from '@/components/icone';
import type { IconaComponente } from '@/components/icone';
import { Caricamento, Chip, Errore, Scheda, Vuoto, dataIt } from './kit';
import { clsx } from '@/lib/clsx';
import { statoAnalisi, tipoDaFile, ETICHETTE_ORIGINE } from '@/lib/portale/archivio';

/**
 * Archivio dell'azienda nel portale (Rocco 10/11: "le foto, gli audio, i video del sopralluogo:
 * come si salvano, come sono reperibili, finiscono davvero all'agente per creare i documenti?").
 * Qui si vede tutto il materiale: quello del sopralluogo, quello caricato a mano e quello
 * portato dal Falco. Ogni file viene letto dall'AI e il testo letto entra nel DVR, nel POS e
 * negli altri documenti, e il Falco lo ritrova quando lavora sull'azienda.
 */

const ICONE: Record<CompanyDocumentTipo, IconaComponente> = { foto: Immagine, video: Video, audio: Audio, documento: Documento, nota: Nota };
const FILTRI: Array<{ k: 'tutti' | CompanyDocumentTipo; t: string }> = [
  { k: 'tutti', t: 'Tutto' },
  { k: 'foto', t: 'Foto' },
  { k: 'video', t: 'Video' },
  { k: 'audio', t: 'Audio' },
  { k: 'documento', t: 'Documenti' },
  { k: 'nota', t: 'Note' },
];

export function ArchivioAzienda({ aziendaId, puoScrivere }: { aziendaId: number; puoScrivere: boolean }) {
  const ds = useDataSource();
  const [elementi, setElementi] = useState<CompanyDocument[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'tutti' | CompanyDocumentTipo>('tutti');
  const [aperto, setAperto] = useState<number | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [invio, setInvio] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const carica = useCallback(async () => {
    try {
      setElementi(await ds.companyDocuments.list(aziendaId));
      setErrore(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Archivio non disponibile');
    }
  }, [ds, aziendaId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  // Finché c'è qualcosa in lettura l'elenco si aggiorna da solo.
  const inLettura = (elementi ?? []).some((d) => statoAnalisi(d) === 'in_lettura');
  useEffect(() => {
    if (!inLettura) return;
    const t = window.setInterval(() => {
      clearApiCache();
      void carica();
    }, 8000);
    return () => window.clearInterval(t);
  }, [inLettura, carica]);

  const conti = useMemo(() => {
    const c: Record<string, number> = { tutti: (elementi ?? []).length };
    for (const d of elementi ?? []) c[d.tipo] = (c[d.tipo] ?? 0) + 1;
    return c;
  }, [elementi]);
  const visibili = (elementi ?? []).filter((d) => filtro === 'tutti' || d.tipo === filtro);

  async function carica_file(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      setInvio(`Carico ${f.name}`);
      try {
        await ds.companyDocuments.addFile(aziendaId, tipoDaFile(f), f, { origine: 'caricato' });
      } catch (e) {
        setErrore(`${f.name}: ${e instanceof Error ? e.message : 'caricamento non riuscito'}`);
      }
    }
    setInvio(null);
    if (file.current) file.current.value = '';
    await carica();
  }

  async function salvaNota() {
    const t = (nota ?? '').trim();
    if (!t) return;
    setInvio('Salvo la nota');
    try {
      await ds.companyDocuments.addNote(aziendaId, t, undefined, 'caricato');
      setNota(null);
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Nota non salvata');
    } finally {
      setInvio(null);
    }
  }

  async function rileggi(id: number) {
    setInvio('Rileggo il file');
    try {
      await ds.companyDocuments.reanalyze(id);
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Rilettura non riuscita');
    } finally {
      setInvio(null);
    }
  }

  async function togli(d: CompanyDocument) {
    if (!window.confirm(`Tolgo "${d.titolo ?? d.filename ?? 'questo elemento'}" dall'archivio? Non entrerà più nei documenti.`)) return;
    try {
      await ds.companyDocuments.delete(d.id);
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non tolto');
    }
  }

  return (
    <Scheda
      titolo="Archivio dell’azienda"
      sotto="Foto, video, audio, documenti e note. L’AI li legge e quello che legge entra nel DVR, nel POS e negli altri documenti; il Falco li ritrova quando lavora su questa azienda."
      azioni={
        puoScrivere ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-[44px] px-4 text-[14px]" onClick={() => file.current?.click()} disabled={invio !== null}>
              <Piu size={16} aria-hidden /> Carica
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-4 text-[14px]" onClick={() => setNota(nota === null ? '' : null)}>
              <Nota size={16} aria-hidden /> Nota
            </button>
            <input
              ref={file}
              type="file"
              multiple
              hidden
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.p7m"
              onChange={(e) => void carica_file(e.target.files)}
            />
          </div>
        ) : undefined
      }
    >
      {nota !== null && (
        <div className="mb-4">
          <textarea
            className="w-full rounded-[0.9rem] bg-sunken p-3 text-[14.5px] text-fg outline-none focus:ring-2 focus:ring-grafite-300"
            rows={3}
            placeholder="Cosa hai visto, cosa ti hanno detto, cosa manca"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary min-h-[44px] px-4 text-[14px]" onClick={() => void salvaNota()} disabled={!nota.trim() || invio !== null}>
              Salva la nota
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-4 text-[14px]" onClick={() => setNota(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {invio && <p className="mb-3 text-[13.5px] text-fg-muted" role="status">{invio}…</p>}
      {errore && elementi !== null && <p className="mb-3 text-[13.5px] text-danger-mark" role="alert">{errore}</p>}

      {elementi === null ? (
        errore ? <Errore testo={errore} onRiprova={() => void carica()} /> : <Caricamento testo="Apro l’archivio" />
      ) : elementi.length === 0 ? (
        <Vuoto titolo="L’archivio è vuoto">Carica le foto e i documenti dell’azienda o fai un sopralluogo: tutto finisce qui.</Vuoto>
      ) : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipo di materiale">
            {FILTRI.filter((f) => f.k === 'tutti' || (conti[f.k] ?? 0) > 0).map((f) => (
              <button
                key={f.k}
                type="button"
                role="tab"
                aria-selected={filtro === f.k}
                onClick={() => setFiltro(f.k)}
                className={clsx('min-h-[40px] shrink-0 rounded-full px-3.5 text-[13.5px]', filtro === f.k ? 'bg-grafite-900 text-white' : 'bg-sunken text-fg-muted')}
              >
                {f.t} {conti[f.k] ?? 0}
              </button>
            ))}
          </div>
          <ul>
            {visibili.map((d) => (
              <Voce
                key={d.id}
                d={d}
                aperto={aperto === d.id}
                onApri={() => setAperto(aperto === d.id ? null : d.id)}
                puoScrivere={puoScrivere}
                onRileggi={() => void rileggi(d.id)}
                onTogli={() => void togli(d)}
              />
            ))}
          </ul>
        </>
      )}
    </Scheda>
  );
}

function Voce({ d, aperto, onApri, puoScrivere, onRileggi, onTogli }: { d: CompanyDocument; aperto: boolean; onApri: () => void; puoScrivere: boolean; onRileggi: () => void; onTogli: () => void }) {
  const ds = useDataSource();
  const Icona = ICONE[d.tipo] ?? Documento;
  const stato = statoAnalisi(d);
  const [anteprima, setAnteprima] = useState<string | null>(null);

  useEffect(() => {
    if (!aperto || d.tipo !== 'foto' || !d.filename || anteprima) return;
    let vivo = true;
    ds.companyDocuments.previewUrl(d.id).then((u) => vivo && setAnteprima(u)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [aperto, d, ds, anteprima]);

  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onApri} aria-expanded={aperto} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] bg-sunken text-fg-muted">
          <Icona size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-fg">{d.titolo || d.filename || 'Nota'}</span>
          <span className="block text-[12.5px] text-fg-muted">
            {ETICHETTE_ORIGINE[d.origine] ?? 'Caricato'} · {dataIt(d.created_at)}
          </span>
        </span>
        {stato === 'letto' && <Chip stato="ok">Letto</Chip>}
        {stato === 'in_lettura' && <Chip stato="run">In lettura</Chip>}
        {stato === 'non_letto' && <Chip stato="danger">Non letto</Chip>}
      </button>
      {aperto && (
        <div className="pb-4 pl-12">
          {anteprima && <img src={anteprima} alt="" className="mb-3 max-h-64 rounded-[0.8rem] object-contain" />}
          {stato === 'non_letto' && <p className="mb-2 text-[13.5px] text-danger-mark">{d.analisi_errore}</p>}
          {d.testo_analisi ? (
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg">{d.testo_analisi}</p>
          ) : (
            stato === 'in_lettura' && <p className="text-[13.5px] text-fg-muted">L’AI lo sta leggendo, il testo compare qui da solo.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {d.filename && (
              <button type="button" className="btn-ghost min-h-[40px] px-3.5 text-[13px]" onClick={() => void ds.companyDocuments.download(d.id, d.filename ?? undefined)}>
                <Scarica size={15} aria-hidden /> Scarica
              </button>
            )}
            {puoScrivere && d.filename && stato !== 'in_lettura' && (
              <button type="button" className="btn-ghost min-h-[40px] px-3.5 text-[13px]" onClick={onRileggi}>
                Rileggi con l’AI
              </button>
            )}
            {puoScrivere && (
              <button type="button" className="btn-ghost min-h-[40px] px-3.5 text-[13px]" onClick={onTogli}>
                <Cestino size={15} aria-hidden /> Togli
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
