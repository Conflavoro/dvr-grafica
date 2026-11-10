'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cerca, Chiudi, Documento, Matita, Scarica } from '@/components/icone';
import { cartelle as caricaCartelle, documentiEmessi, raggruppa, scaricaFile, type Cartella, type DocumentoEmesso } from '@/lib/portale/azienda-account-api';
import { clsx } from '@/lib/clsx';
import { dataIt } from './kit';
import { LinkFileRecenti } from '@/components/app/LinkFileRecenti';

/**
 * Pannello dei documenti dell'area azienda, "come Cowork": sempre a portata, accanto
 * al Falco. Documenti emessi dallo studio per tipo (DVR, valutazioni, DUVRI, HACCP,
 * piano di emergenza, nomine, verbali...) e documenti caricati nel fascicolo, con
 * data, apertura e download. "Chiedi una modifica" porta il documento nella chat
 * del Falco come contesto: la revisione la fa lo studio, mai il cliente da solo.
 */

export interface RichiestaModifica {
  titolo: string;
  /** Documento della piattaforma (oggetto per il Falco) o caricato nel fascicolo (solo nome). */
  oggetto: { tipo: DocumentoEmesso['tipo']; id: number } | null;
  cartella?: string;
}

interface VoceCaricata {
  id: string;
  titolo: string;
  data: string | null;
  scadenza: string | null;
  cartella: string;
  haFile: boolean;
}

function caricate(c: Cartella[]): Array<{ cartella: string; voci: VoceCaricata[] }> {
  return c
    .map((x) => ({
      cartella: x.nome,
      voci: x.voci.filter((v) => v.caricato).map((v) => ({ id: v.id, titolo: v.titolo, data: v.data, scadenza: v.scadenza, cartella: x.nome, haFile: v.haFile })),
    }))
    .filter((g) => g.voci.length > 0);
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function PannelloDocumenti({
  aziendaId,
  nomeAzienda,
  puoVedere,
  versione,
  onChiediModifica,
  onChiudi,
}: {
  aziendaId: number;
  nomeAzienda: string;
  /** Permesso "documenti_vedi" dell'utente sull'azienda (matrice RuoliAzienda). */
  puoVedere: boolean;
  versione: number;
  onChiediModifica: (r: RichiestaModifica) => void;
  onChiudi?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoEmesso[] | null>(null);
  const [fasc, setFasc] = useState<Cartella[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [scarico, setScarico] = useState<string | null>(null);

  useEffect(() => {
    if (!puoVedere) return;
    let vivo = true;
    setErrore(null);
    Promise.all([documentiEmessi(aziendaId), caricaCartelle(aziendaId).catch(() => [] as Cartella[])])
      .then(([d, c]) => {
        if (!vivo) return;
        setDocs(d);
        setFasc(c);
      })
      .catch((e: unknown) => vivo && setErrore(e instanceof Error ? e.message : 'Documenti non disponibili.'));
    return () => {
      vivo = false;
    };
  }, [aziendaId, puoVedere, versione]);

  const filtro = norm(cerca.trim());
  const gruppi = useMemo(() => raggruppa((docs ?? []).filter((d) => !filtro || norm(`${d.titolo} ${d.genere}`).includes(filtro))), [docs, filtro]);
  const fascicolo = useMemo(
    () => caricate(fasc ?? []).map((g) => ({ ...g, voci: g.voci.filter((v) => !filtro || norm(`${v.titolo} ${v.cartella}`).includes(filtro)) })).filter((g) => g.voci.length > 0),
    [fasc, filtro]
  );

  const scarica = async (chiave: string, path: string, nome: string) => {
    setScarico(chiave);
    setErrore(null);
    try {
      await scaricaFile(path, nome);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Download non riuscito.');
    } finally {
      setScarico(null);
    }
  };

  const vuoto = docs !== null && gruppi.length === 0 && fascicolo.length === 0;

  return (
    <section aria-label="Documenti dell'azienda" className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-perla-linea px-4 py-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cat-documenti text-cat-documenti-ink">
          <Documento size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-ink">Documenti</p>
          <p className="truncate text-[12.5px] text-ink-muted">{nomeAzienda}</p>
        </div>
        {onChiudi && (
          <button type="button" onClick={onChiudi} aria-label="Chiudi i documenti" className="btn-icon">
            <Chiudi size={18} aria-hidden />
          </button>
        )}
      </header>

      {!puoVedere ? (
        <p className="m-4 rounded-[1rem] bg-perla-velo px-4 py-3 text-[13.5px] text-ink-muted">Con il tuo ruolo i documenti dell’azienda non sono visibili. Chiedi al titolare se ti servono.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3">
          <label className="relative block px-1">
            <span className="sr-only">Cerca un documento</span>
            <Cerca size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-grafite-400" />
            <input
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca un documento"
              className="h-11 w-full rounded-full bg-perla-velo pl-10 pr-4 text-base text-ink outline-none placeholder:text-ink-muted focus:bg-white focus:shadow-[inset_0_0_0_2px_#111113] sm:text-[14px]"
            />
          </label>
          <LinkFileRecenti />
          {errore && (
            <p role="alert" className="mx-1 mt-3 rounded-[0.875rem] bg-stato-warn px-3 py-2 text-[13px] text-stato-warn-ink">
              {errore}
            </p>
          )}
          {docs === null && !errore && (
            <p className="px-2 py-5 text-[13.5px] text-ink-muted" role="status">
              Carico i documenti
            </p>
          )}
          {vuoto && <p className="px-2 py-5 text-[13.5px] text-ink-muted">{filtro ? 'Nessun documento con questo nome.' : 'Ancora nessun documento emesso o caricato.'}</p>}

          {gruppi.map((g) => (
            <section key={g.gruppo} className="mt-4">
              <h3 className="px-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">{g.titolo}</h3>
              <ul className="mt-1">
                {g.voci.map((d) => {
                  const k = `${d.tipo}-${d.id}`;
                  return (
                    <li key={k} className="rounded-[1rem] px-2 py-2.5 hover:bg-perla-velo/60">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium leading-snug text-ink">{d.titolo}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-muted">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-stato-ok-segno" /> Emesso
                            </span>
                            <span>Revisione {d.revisione}</span>
                            {d.emessoIl && <span>{dataIt(d.emessoIl)}</span>}
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.pdf && (
                          <BottoneDoc onClick={() => void scarica(`${k}-pdf`, d.pdf!, `${d.titolo}.pdf`)} occupato={scarico === `${k}-pdf`} etichetta={`Apri ${d.titolo} in PDF`}>
                            <Scarica size={14} aria-hidden /> PDF
                          </BottoneDoc>
                        )}
                        {d.docx && (
                          <BottoneDoc onClick={() => void scarica(`${k}-docx`, d.docx!, `${d.titolo}.docx`)} occupato={scarico === `${k}-docx`} etichetta={`Scarica ${d.titolo} in Word`}>
                            <Scarica size={14} aria-hidden /> Word
                          </BottoneDoc>
                        )}
                        <BottoneDoc onClick={() => onChiediModifica({ titolo: d.titolo, oggetto: { tipo: d.tipo, id: d.id } })} etichetta={`Chiedi una modifica a ${d.titolo}`}>
                          <Matita size={14} aria-hidden /> Chiedi una modifica
                        </BottoneDoc>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {fascicolo.length > 0 && (
            <section className="mt-5">
              <h3 className="px-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">Caricati nel fascicolo</h3>
              {fascicolo.map((g) => (
                <div key={g.cartella} className="mt-1">
                  <p className="px-2 pt-1 text-[12.5px] font-medium text-ink-soft">{g.cartella}</p>
                  <ul>
                    {g.voci.map((v) => (
                      <li key={v.id} className="rounded-[1rem] px-2 py-2 hover:bg-perla-velo/60">
                        <span className="block text-[14px] leading-snug text-ink">{v.titolo}</span>
                        <span className="block text-[12.5px] text-ink-muted">{[v.data && dataIt(v.data), v.scadenza && `scade il ${dataIt(v.scadenza)}`].filter(Boolean).join(' · ') || 'Caricato'}</span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {v.haFile && (
                            <BottoneDoc onClick={() => void scarica(`f-${v.id}`, `/portale/fascicolo/${v.id}/download`, v.titolo)} occupato={scarico === `f-${v.id}`} etichetta={`Scarica ${v.titolo}`}>
                              <Scarica size={14} aria-hidden /> Scarica
                            </BottoneDoc>
                          )}
                          <BottoneDoc onClick={() => onChiediModifica({ titolo: v.titolo, oggetto: null, cartella: v.cartella })} etichetta={`Chiedi al Falco di ${v.titolo}`}>
                            <Matita size={14} aria-hidden /> Chiedi una modifica
                          </BottoneDoc>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          <p className="mt-5 px-2 text-[12px] leading-relaxed text-ink-subtle">Le modifiche le fa lo studio: Falco prepara la richiesta con te. I documenti redatti con assistenza AI valgono dopo la verifica e la firma delle figure competenti.</p>
        </div>
      )}
    </section>
  );
}

function BottoneDoc({ children, onClick, occupato = false, etichetta }: { children: React.ReactNode; onClick: () => void; occupato?: boolean; etichetta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={occupato}
      aria-label={etichetta}
      className={clsx('inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.75rem] bg-white px-3 text-[13px] font-medium text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b] disabled:opacity-50')}
    >
      {children}
    </button>
  );
}
