'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RicercaDocumenti } from '@/lib/falco/interfaccia';
import { percorso } from '@/lib/percorso';
import {
  ETICHETTE_TIPO,
  capacitaBrowser,
  cartellaDaFile,
  cercaInCartella,
  creaLettori,
  testoLavoro,
  valutaFileScelti,
  cercaLoghi,
  valutaLoghiScelti,
  type LogoTrovato,
  type RichiestaRicerca,
  type RisultatoRicerca,
  type TipoCercato,
  type Trovato,
  type VoceCartella,
} from '@/lib/cerca';

/**
 * Ricerca dei documenti sul dispositivo dell'utente (09/11, stesse regole del Falco di
 * FondoFormazione). Sul computer si sceglie una cartella, sul telefono i file; il contenuto si
 * legge qui nel browser e non parte nulla finche' la persona non conferma. Sono gia' spuntati
 * solo i documenti che il contenuto conferma (intestatario, tipo, validita'); gli altri restano
 * da controllare con il motivo; i dati sanitari non si caricano mai.
 */
export function CercaDocumenti({ ricerca, onChiudi, onConferma }: { ricerca: RicercaDocumenti; onChiudi: () => void; onConferma: (files: File[], nota: string, logo: File | null) => void }) {
  const [fase, setFase] = useState<'scelta' | 'lavoro' | 'risultati'>('scelta');
  const [righe, setRighe] = useState<string[]>([]);
  const [ris, setRis] = useState<RisultatoRicerca | null>(null);
  const [scelti, setScelti] = useState<Set<number>>(new Set());
  const [nota, setNota] = useState<string | null>(null);
  // Logo (09/11): si sceglie guardando l'anteprima, uno solo.
  const [loghi, setLoghi] = useState<{ t: LogoTrovato; url: string }[]>([]);
  const [logoScelto, setLogoScelto] = useState<number | null>(null);
  useEffect(() => () => loghi.forEach((l) => URL.revokeObjectURL(l.url)), [loghi]);
  const fermo = useRef(false);
  const inputFile = useRef<HTMLInputElement>(null);
  const inputCartella = useRef<HTMLInputElement | null>(null);
  const lettori = useMemo(() => creaLettori(percorso('/vendor/ocr')), []);
  useEffect(() => () => void lettori.chiudi?.(), [lettori]);

  const cap = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return capacitaBrowser({
      ua: navigator.userAgent,
      picker: window.isSecureContext && 'showDirectoryPicker' in window,
      cartella: 'webkitdirectory' in document.createElement('input'),
      puntatoreFine: window.matchMedia?.('(pointer: fine)').matches ?? true,
    });
  }, []);

  const cercaLogo = ricerca.tipi.includes('logo');
  const tipi = ricerca.tipi.filter((t) => t !== 'logo') as TipoCercato[];
  const richiesta: RichiestaRicerca = {
    tipi,
    parole_chiave: [],
    impresa: {
      ...ricerca.impresa,
      lavoratori: (ricerca.impresa.lavoratori ?? []).filter((l) => l.nome && l.cognome).map((l) => ({ nome: l.nome!, cognome: l.cognome!, codice_fiscale: l.codice_fiscale })),
    },
  };
  const cosa = [...(cercaLogo ? ['logo'] : []), ...tipi.map((t) => ETICHETTE_TIPO[t]?.toLowerCase() ?? t)].join(', ');

  const opzioni = {
    lettori,
    fermo: () => fermo.current,
    suEvento: (e: Parameters<typeof testoLavoro>[0]) => setRighe((r) => [...r.slice(-5), testoLavoro(e)]),
  };

  const vuoto: RisultatoRicerca = { trovati: [], voci: [], proposte: [], esito: { visitati: 0, interrotta: false, trovati: 0, scartati: 0, letti: 0 } as unknown as RisultatoRicerca['esito'] };
  const mostraLoghi = async (l: LogoTrovato[]) => {
    const conAnteprima = await Promise.all(l.map(async (t) => {
      const f = await t.voce.getFile();
      return { t, url: f instanceof Blob ? URL.createObjectURL(f) : '' };
    }));
    setLoghi(conAnteprima.filter((x) => x.url));
    const i = conAnteprima.findIndex((x) => x.url && x.t.verdetto === 'giusto');
    setLogoScelto(i >= 0 ? i : null);
  };

  const mostra = (r: RisultatoRicerca) => {
    setRis(r);
    const pre = new Set<number>();
    for (const p of r.proposte) {
      const i = r.trovati.indexOf(p.trovato);
      if (i >= 0) pre.add(i);
    }
    setScelti(pre);
    setNota(r.trovati.length === 0 && !cercaLogo ? 'Non ho trovato documenti che sembrino quelli giusti. Puoi scegliere un’altra cartella o i file a mano.' : r.esito.interrotta ? 'La cartella è molto grande: ti mostro i primi risultati.' : null);
    setFase('risultati');
  };

  const cercaCartella = async (radice: VoceCartella) => {
    fermo.current = false;
    setRighe([]);
    setFase('lavoro');
    try {
      const [r] = await Promise.all([
        tipi.length ? cercaInCartella(radice, richiesta, opzioni) : Promise.resolve(vuoto),
        cercaLogo ? cercaLoghi(radice, ricerca.impresa.denominazione, () => fermo.current).then(mostraLoghi) : Promise.resolve(),
      ]);
      mostra(r);
    } catch {
      setNota('Non sono riuscito a leggere la cartella. Prova con un’altra o scegli i file a mano.');
      setFase('scelta');
    }
  };

  const scegliCartella = async () => {
    if (cap?.modo === 'picker') {
      try {
        const scegli = (window as unknown as { showDirectoryPicker: (o: Record<string, unknown>) => Promise<VoceCartella> }).showDirectoryPicker;
        await cercaCartella(await scegli({ id: 'dvr-conflavoro', mode: 'read', startIn: 'documents' }));
      } catch {
        setNota('La cartella non è stata scelta: nessun file è stato guardato.');
      }
      return;
    }
    inputCartella.current?.click();
  };

  const daCartella = (lista: FileList | null) => {
    const files = Array.from(lista ?? []);
    if (inputCartella.current) inputCartella.current.value = '';
    if (files.length) void cercaCartella(cartellaDaFile(files) as VoceCartella);
  };

  const daFile = async (lista: FileList | null) => {
    const files = Array.from(lista ?? []).slice(0, 40);
    if (inputFile.current) inputFile.current.value = '';
    if (!files.length) return;
    fermo.current = false;
    setRighe([]);
    setFase('lavoro');
    try {
      const [r] = await Promise.all([
        tipi.length ? valutaFileScelti(files, richiesta, opzioni) : Promise.resolve(vuoto),
        cercaLogo ? valutaLoghiScelti(files, ricerca.impresa.denominazione).then(mostraLoghi) : Promise.resolve(),
      ]);
      mostra(r);
    } catch {
      setNota('Non sono riuscito a leggere i file scelti.');
      setFase('scelta');
    }
  };

  const conferma = async () => {
    if (!ris) return;
    const files: File[] = [];
    const frasi: string[] = [];
    for (const i of Array.from(scelti).sort((a, b) => a - b)) {
      const t = ris.trovati[i];
      if (!t || t.verdetto === 'escluso') continue;
      try {
        const f = await ris.voci[i].getFile();
        if (f instanceof File) files.push(f);
      } catch {
        continue;
      }
      frasi.push(`${t.nome}: ${t.descrizione ?? ETICHETTE_TIPO[t.tipo as TipoCercato] ?? 'documento'}${t.verificato?.length ? ` (${t.verificato.join('; ')})` : ''}${t.verdetto === 'da_controllare' && t.problema ? `; da controllare: ${t.problema}` : ''}`);
    }
    let logo: File | null = null;
    if (logoScelto !== null && loghi[logoScelto]) {
      const f = await loghi[logoScelto].t.voce.getFile().catch(() => null);
      if (f instanceof File) logo = f;
    }
    if (files.length || logo) onConferma(files, frasi.join('\n'), logo);
  };

  const caricabili = (ris ? Array.from(scelti).filter((i) => ris.trovati[i]?.verdetto !== 'escluso').length : 0) + (logoScelto !== null ? 1 : 0);

  return (
    <section aria-label="Ricerca dei documenti" className="rounded-[1rem] bg-surface px-4 py-3 text-fg shadow-[inset_0_0_0_1px_theme(colors.grafite.200)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">{ricerca.etichetta}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Cerco: {cosa}. Leggo il contenuto qui sul tuo dispositivo e carico solo quello che confermi.</p>
        </div>
        <button type="button" className="btn-ghost min-h-[36px] px-3 text-[12.5px]" onClick={() => { fermo.current = true; onChiudi(); }}>
          Chiudi
        </button>
      </div>

      {fase === 'scelta' && (
        <div className="mt-3">
          {cap?.frase && <p className="mb-2 text-[12.5px] text-ink-muted">{cap.frase}</p>}
          <div className="flex flex-wrap gap-2">
            {cap?.modo !== 'file' && (
              <button type="button" className="btn-acido min-h-[44px] px-4 text-[13px]" onClick={() => void scegliCartella()}>
                Scegli la cartella
              </button>
            )}
            <button type="button" className={`${cap?.modo === 'file' ? 'btn-acido' : 'btn-ghost'} min-h-[44px] px-4 text-[13px]`} onClick={() => inputFile.current?.click()}>
              {cap?.modo === 'file' ? 'Scegli i documenti' : 'Scelgo i file a mano'}
            </button>
          </div>
        </div>
      )}

      {fase === 'lavoro' && (
        <div className="mt-3" aria-live="polite">
          <ul className="space-y-0.5 text-[12.5px] text-ink-muted">
            {righe.map((r, i) => (
              <li key={i} className="truncate">{r}</li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-2 min-h-[40px] px-3.5 text-[13px]" onClick={() => { fermo.current = true; }}>
            Fermati qui
          </button>
        </div>
      )}

      {fase === 'risultati' && ris && (
        <div className="mt-3">
          {ris.trovati.length > 0 && (
            <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
              {ris.trovati.map((t: Trovato, i) => {
                const escluso = t.verdetto === 'escluso';
                return (
                  <li key={`${t.percorso}-${i}`}>
                    <label className={`flex gap-2.5 rounded-[0.75rem] px-2.5 py-2 ${escluso ? 'opacity-60' : 'cursor-pointer hover:bg-grafite-50'}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0"
                        disabled={escluso}
                        checked={scelti.has(i)}
                        onChange={(e) => setScelti((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{t.nome}</span>
                        <span className="block text-[12px] text-ink-muted">{t.descrizione ?? (t.tipo ? ETICHETTE_TIPO[t.tipo] : 'Documento')}</span>
                        <span className={`mt-0.5 block text-[12px] ${t.verdetto === 'giusto' ? 'text-ok-mark' : escluso ? 'text-ink-muted' : 'text-warn-mark'}`}>
                          {t.verdetto === 'giusto' ? `Confermato dal contenuto${t.verificato?.length ? `: ${t.verificato.join(', ')}` : ''}` : escluso ? `Non si carica: ${t.problema ?? 'dato sanitario'}` : `Da controllare: ${t.problema ?? 'il contenuto non lo conferma del tutto'}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {cercaLogo && (
            <div className="mt-3">
              <p className="text-[13px] font-medium">Logo</p>
              {loghi.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">Non ho trovato immagini che sembrino il logo dell&apos;azienda.</p>
              ) : (
                <ul className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {loghi.map((l, i) => (
                    <li key={l.t.percorso}>
                      <button
                        type="button"
                        aria-pressed={logoScelto === i}
                        onClick={() => setLogoScelto(logoScelto === i ? null : i)}
                        className={`flex w-full flex-col items-center gap-1 rounded-[0.75rem] p-2 text-left ${logoScelto === i ? 'shadow-[inset_0_0_0_2px_theme(colors.grafite.900)]' : 'shadow-[inset_0_0_0_1px_theme(colors.grafite.200)]'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.url} alt={`Anteprima di ${l.t.nome}`} className="h-16 w-full object-contain" />
                        <span className="w-full truncate text-[12px]">{l.t.nome}</span>
                        <span className={`w-full text-[11.5px] ${l.t.verdetto === 'giusto' ? 'text-ok-mark' : 'text-warn-mark'}`}>{l.t.motivo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {nota && <p className="mt-2 text-[12.5px] text-ink-muted">{nota}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {caricabili > 0 && (
              <button type="button" className="btn-acido min-h-[44px] px-4 text-[13px]" onClick={() => void conferma()}>
                Carica {caricabili === 1 ? (logoScelto !== null ? 'il logo' : '1 documento') : `${caricabili} file`}
              </button>
            )}
            {cap?.modo !== 'file' && (
              <button type="button" className="btn-ghost min-h-[44px] px-4 text-[13px]" onClick={() => void scegliCartella()}>
                Un&apos;altra cartella
              </button>
            )}
            <button type="button" className="btn-ghost min-h-[44px] px-4 text-[13px]" onClick={() => inputFile.current?.click()}>
              Scegli altri file
            </button>
          </div>
        </div>
      )}

      <input ref={inputFile} type="file" multiple className="hidden" accept=".pdf,.p7m,.docx,.txt,.csv,.xlsx,.zip,.svg,image/*" onChange={(e) => void daFile(e.target.files)} />
      <input
        ref={(el) => {
          inputCartella.current = el;
          if (el) el.setAttribute('webkitdirectory', '');
        }}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => daCartella(e.target.files)}
      />
    </section>
  );
}
