'use client';

import { clearApiCache } from '@/lib/api';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePortale } from '../../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Schede, Blocco } from '../../../kit';
import { Avviso, Fotocamera, Indietro, Microfono, Ferma, Scarica, Spunta, Avanti, Video } from '@/components/icone';
import { useDataSource } from '@/lib/use-data-source';
import Link from 'next/link';
import { useWavRecorder } from '@/lib/use-wav-recorder';
import { scaricaFile } from '@/lib/data-source/moduli-api';
import {
  analizzaFoto,
  azioneConfermata,
  caricaFoto,
  caricaNota,
  caricaSopralluogo,
  chiudiSopralluogo,
  classeRischio,
  decidiNote,
  emettiVerbale,
  generaVerbale,
  inviaAlDvr,
  percentuale,
  percorsoVerbale,
  prossimaArea,
  prossimoEsito,
  quando,
  registraEsito,
  type EsitoVerbale,
  type Esito,
  type Sopralluogo,
  type Voce,
} from '@/lib/portale/sopralluoghi-api';
import { FoglioAzione } from './FoglioAzione';
import { FotoMini } from './FotoMini';
import { clsx } from '@/lib/clsx';
import { fotoOppureInput } from '@/lib/app/fotocamera';

const OGNI_MS = 6000;

export function Dettaglio({ id, onIndietro }: { id: number; onIndietro: () => void }) {
  const { apri, versione } = usePortale();
  const [s, setS] = useState<Sopralluogo | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [vista, setVista] = useState<'campo' | 'ufficio'>('campo');
  const [area, setArea] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [foglioAzione, setFoglioAzione] = useState<Voce | null>(null);
  const occupato = useRef(0);

  const dici = useCallback((t: string) => {
    setAvviso(t);
    window.setTimeout(() => setAvviso((x) => (x === t ? null : x)), 4200);
  }, []);

  const carica = useCallback(() => {
    caricaSopralluogo(id)
      .then((x) => {
        setS(x);
        setErrore(null);
      })
      .catch((e: Error) => setErrore(e.message));
  }, [id]);

  useEffect(() => {
    carica();
  }, [carica, versione]);

  useEffect(() => {
    if (s) apri({ tipo: 'sopralluogo', id: s.id }, s.azienda.id);
    return () => apri(null);
  }, [s?.id, s?.azienda.id, apri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vista dal vivo: si riallinea da sola quando il tecnico (o un collega) cambia qualcosa.
  useEffect(() => {
    if (!s || s.stato === 'chiuso') return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible' && occupato.current === 0) {
        clearApiCache();
        carica();
      }
    }, OGNI_MS);
    return () => window.clearInterval(t);
  }, [s?.stato, carica]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Esegue un'azione sul server tenendo ferma la vista dal vivo. */
  const esegui = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      occupato.current++;
      try {
        return await fn();
      } catch (e) {
        dici((e as Error).message);
        return null;
      } finally {
        occupato.current--;
      }
    },
    [dici]
  );

  if (errore && !s) return <Errore testo={errore} onRiprova={carica} />;
  if (!s) return <Caricamento testo="Apro il sopralluogo" />;

  const pct = percentuale(s.conteggi.risposte, s.conteggi.voci);
  const chip = s.stato === 'chiuso' ? <Chip stato="ok">Fatto</Chip> : s.stato === 'in_corso' ? <Chip stato="run">In corso</Chip> : <Chip stato="info">Programmato</Chip>;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onIndietro} className="btn-ghost -ml-1 h-11 px-3">
        <Indietro size={18} aria-hidden /> Sopralluoghi
      </button>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-medium leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">{s.azienda.ragioneSociale}</h1>
          <p className="mt-1 text-[14px] leading-snug text-ink-muted first-letter:uppercase">{[quando(s.iniziatoIl ?? s.programmatoIl), s.sede, s.tecnico, s.motivo].filter(Boolean).join(' · ')}</p>
        </div>
        {chip}
        <Link href={`/gestionale/aziende/?id=${s.azienda.id}&tab=archivio`} className="btn-ghost h-11 px-3.5 text-[14px]">
          Archivio dell’azienda
        </Link>
      </header>

      <div className="xl:hidden">
        <Schede
          etichetta="Viste del sopralluogo"
          attiva={vista}
          onCambia={setVista}
          voci={[
            { k: 'campo', t: 'Sul campo' },
            { k: 'ufficio', t: 'Riepilogo', n: s.conteggi.noteDaApprovare + s.conteggi.ncSenzaAzione },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
        <section aria-label="Sul telefono del tecnico" className={clsx('min-w-0', vista !== 'campo' && 'hidden xl:block')}>
          <p className="mb-2 hidden text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted xl:block">Sul telefono del tecnico</p>
          <div className="xl:rounded-[2rem] xl:p-3 xl:shadow-[inset_0_0_0_1px_#e2e2e5]">
            <Telefono s={s} pct={pct} area={area} setArea={setArea} sel={sel} setSel={setSel} setS={setS} esegui={esegui} dici={dici} onAzione={setFoglioAzione} />
          </div>
        </section>
        <section aria-label="In ufficio" className={clsx('min-w-0', vista !== 'ufficio' && 'hidden xl:block')}>
          <p className="mb-2 hidden text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted xl:block">In ufficio · stessi dati, aggiornati dal vivo</p>
          <Ufficio s={s} pct={pct} setS={setS} esegui={esegui} dici={dici} onAzione={setFoglioAzione} />
        </section>
      </div>

      <FoglioAzione
        voce={foglioAzione}
        sopralluogoId={s.id}
        modificabile={s.modificabile}
        onChiudi={() => setFoglioAzione(null)}
        onSalvato={(x) => {
          setS(x);
          setFoglioAzione(null);
          dici('Azione salvata: entra nel verbale e nello scadenziario alla chiusura.');
        }}
      />

      <p aria-live="polite" className={clsx('pointer-events-none fixed inset-x-4 z-[70] mx-auto max-w-md rounded-[1.25rem] bg-black px-4 py-3 text-center text-[14px] text-white shadow-lg transition-opacity duration-200 bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6', avviso ? 'opacity-100' : 'opacity-0')}>
        {avviso}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- vista del tecnico

type Esegui = <T>(fn: () => Promise<T>) => Promise<T | null>;

function Telefono({
  s,
  pct,
  area,
  setArea,
  sel,
  setSel,
  setS,
  esegui,
  dici,
  onAzione,
}: {
  s: Sopralluogo;
  pct: number;
  area: number;
  setArea: (n: number) => void;
  sel: number | null;
  setSel: (n: number | null) => void;
  setS: (s: Sopralluogo) => void;
  esegui: Esegui;
  dici: (t: string) => void;
  onAzione: (v: Voce) => void;
}) {
  const a = s.aree[Math.min(area, Math.max(0, s.aree.length - 1))];
  const voceSel = useMemo(() => s.aree.flatMap((x) => x.voci).find((v) => v.id === sel) ?? null, [s, sel]);
  const fileFoto = useRef<HTMLInputElement>(null);
  const fileVideo = useRef<HTMLInputElement>(null);
  const ds = useDataSource();
  const rec = useWavRecorder();
  const [invio, setInvio] = useState<'foto' | 'nota' | 'video' | null>(null);
  const [locale, setLocale] = useState<Record<number, Esito | null>>({});

  useEffect(() => setLocale({}), [s]);
  useEffect(() => {
    if (rec.errore) dici(rec.errore);
  }, [rec.errore, dici]);

  if (!a) return <p className="text-[14px] text-ink-muted">La lista di controllo è vuota.</p>;

  const tocca = async (v: Voce, e: Esito) => {
    if (!s.modificabile) return;
    setSel(v.id);
    const nuovo = prossimoEsito(v.esito, e);
    setLocale((m) => ({ ...m, [v.id]: nuovo }));
    const r = await esegui(() => registraEsito(s.id, v.id, nuovo));
    if (r) {
      setS(r);
      if (nuovo === 'non_conforme' && !v.azione) dici('Non conforme: apri l’azione di miglioramento quando puoi.');
    } else setLocale((m) => ({ ...m, [v.id]: v.esito }));
  };

  const foto = async (f: File | undefined) => {
    if (!f) return;
    setInvio('foto');
    const r = await esegui(() => caricaFoto(s.id, sel, f));
    setInvio(null);
    if (!r) return;
    setS(r.s);
    if (sel && r.allegato) {
      dici('Foto aggiunta. L’assistente la sta guardando.');
      const an = await esegui(() => analizzaFoto(s.id, r.allegato!));
      if (an) {
        setS(an.s);
        if (an.esito === 'non_conforme') dici('Dalla foto la voce sembra non conforme: decidi tu.');
        else if (an.esito === 'conforme') dici('Dalla foto la voce sembra conforme: decidi tu.');
      }
    } else dici('Foto aggiunta al sopralluogo.');
  };

  // Il video va nell'archivio dell'azienda: lo legge l'AI sul server e il testo entra nel DVR.
  const video = async (f: File | undefined) => {
    if (!f) return;
    setInvio('video');
    const titolo = `Video del sopralluogo${a ? `, ${a.nome}` : ''}${voceSel ? `: ${voceSel.testo}` : ''}`.slice(0, 250);
    const ok = await esegui(() => ds.companyDocuments.addFile(s.azienda.id, 'video', f, { titolo, origine: 'sopralluogo' }));
    setInvio(null);
    if (ok) dici('Video salvato nell’archivio dell’azienda: l’AI lo sta guardando e il testo entrerà nel DVR.');
  };

  const nota = async () => {
    if (rec.registrando) {
      const f = rec.ferma();
      if (!f) return;
      setInvio('nota');
      const r = await esegui(() => caricaNota(s.id, sel, f));
      setInvio(null);
      if (!r) return;
      setS(r.s);
      dici(r.trascrizione ? 'Nota trascritta: da approvare per il verbale.' : r.errore ?? 'Nella registrazione non ho sentito parole.');
      return;
    }
    await rec.avvia();
  };

  const prossima = prossimaArea(s.aree, area);

  return (
    <div className="pb-28 lg:pb-0">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-perla-velo" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avanzamento del sopralluogo">
          <div className="h-full rounded-full bg-acido-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="cifre text-[13px] text-ink-muted">
          {s.conteggi.risposte} di {s.conteggi.voci}
        </span>
      </div>

      <div role="tablist" aria-label="Aree" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {s.aree.map((x, i) => (
          <button
            key={x.nome}
            role="tab"
            type="button"
            aria-selected={i === area}
            onClick={() => setArea(i)}
            className={clsx('inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium', i === area ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink-soft')}
          >
            {x.nome}
            <span className={clsx('cifre text-[12px]', i === area ? 'text-acido-400' : 'text-ink-subtle')}>
              {x.fatte}/{x.totale}
            </span>
          </button>
        ))}
      </div>

      <ul className="space-y-2.5">
        {a.voci.map((v) => (
          <VoceCard key={v.id} v={v} esito={v.id in locale ? locale[v.id] : v.esito} scelta={v.id === sel} modificabile={s.modificabile} onScegli={() => setSel(v.id)} onTocca={(e) => tocca(v, e)} onAzione={() => onAzione(v)} />
        ))}
      </ul>

      {prossima !== null && prossima !== area && (
        <button type="button" onClick={() => setArea(prossima)} className="btn-ghost mt-3 w-full">
          Prossima area: {s.aree[prossima].nome} <Avanti size={16} aria-hidden />
        </button>
      )}

      {s.modificabile && (
        <div
          className="fixed left-3 right-[5.25rem] z-40 flex items-center gap-2 rounded-[1.5rem] bg-white p-2 shadow-[0_12px_32px_-12px_rgba(14,14,16,0.45),inset_0_0_0_1px_#e2e2e5] bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:sticky lg:bottom-3 lg:left-auto lg:right-auto lg:mt-4"
        >
          <p className="min-w-0 flex-1 truncate px-2 text-[12.5px] text-ink-muted">
            {rec.registrando ? `Sto ascoltando, ${Math.floor(rec.secondi / 60)}:${String(rec.secondi % 60).padStart(2, '0')}` : voceSel ? `Su: ${voceSel.testo}` : 'Tocca una voce per collegare foto e note'}
          </p>
          <input ref={fileFoto} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void foto(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-ghost h-11 px-3" onClick={() => void fotoOppureInput(fileFoto.current, (f) => foto(f))} disabled={invio !== null} aria-label="Scatta foto">
            <Fotocamera size={18} aria-hidden /> <span className="hidden min-[380px]:inline">{invio === 'foto' ? 'Carico' : 'Foto'}</span>
          </button>
          <input ref={fileVideo} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { void video(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" className="btn-ghost h-11 px-3" onClick={() => fileVideo.current?.click()} disabled={invio !== null} aria-label="Gira un video">
            <Video size={18} aria-hidden /> <span className="hidden min-[420px]:inline">{invio === 'video' ? 'Carico' : 'Video'}</span>
          </button>
          <button type="button" className={clsx('h-11 px-3', rec.registrando ? 'btn-primary' : 'btn-acido')} onClick={nota} disabled={invio === 'nota'} aria-label={rec.registrando ? 'Ferma e trascrivi' : 'Detta una nota'}>
            {rec.registrando ? <Ferma size={18} aria-hidden /> : <Microfono size={18} aria-hidden />}
            <span className="hidden min-[380px]:inline">{invio === 'nota' ? 'Trascrivo' : rec.registrando ? 'Ferma' : 'Nota'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function VoceCard({
  v,
  esito,
  scelta,
  modificabile,
  onScegli,
  onTocca,
  onAzione,
}: {
  v: Voce;
  esito: Esito | null;
  scelta: boolean;
  modificabile: boolean;
  onScegli: () => void;
  onTocca: (e: Esito) => void;
  onAzione: () => void;
}) {
  const ok = azioneConfermata(v.azione);
  const cr = classeRischio(v.azione?.p ?? null, v.azione?.d ?? null);
  return (
    <li
      className={clsx('rounded-[1.25rem] bg-white p-3.5 transition-shadow', scelta ? 'shadow-[inset_0_0_0_2px_#18181b]' : 'shadow-[inset_0_0_0_1px_#e2e2e5]')}
      onClick={onScegli}
    >
      <p className={clsx('text-[15px] font-medium leading-snug text-ink', !scelta && 'line-clamp-3')}>{v.testo}</p>
      {v.riferimento && <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{v.riferimento}</p>}
      <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label={`Esito: ${v.testo}`}>
        {(
          [
            ['conforme', 'Conforme', 'bg-grafite-900 text-white'],
            ['non_conforme', 'Non conforme', 'bg-[#d63d3e] text-white'],
            ['non_serve', 'Non serve', 'bg-grafite-400 text-white'],
          ] as const
        ).map(([k, t, attivo]) => (
          <button
            key={k}
            type="button"
            aria-pressed={esito === k}
            disabled={!modificabile}
            onClick={(e) => {
              e.stopPropagation();
              onTocca(k);
            }}
            className={clsx('min-h-[48px] rounded-[0.9rem] px-1 text-[13.5px] font-medium leading-tight transition-colors disabled:cursor-not-allowed', esito === k ? attivo : 'bg-perla-velo text-ink-soft hover:bg-grafite-100')}
          >
            {t}
          </button>
        ))}
      </div>
      {v.proposta && v.proposta.fonte === 'foto' && esito === null && (
        <p className="mt-2.5 rounded-[0.9rem] bg-perla-velo px-3 py-2 text-[13px] leading-snug text-ink-soft">
          <span className="font-medium">Dalla foto:</span> {v.proposta.esito === 'non_conforme' ? 'sembra non conforme.' : v.proposta.esito === 'conforme' ? 'sembra conforme.' : 'non si capisce con certezza.'} {v.proposta.motivo}
        </p>
      )}
      {esito === 'non_conforme' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAzione();
          }}
          className={clsx('mt-2.5 flex min-h-[44px] w-full items-center gap-2 rounded-[0.9rem] px-3 text-left text-[13.5px]', ok ? 'bg-stato-danger text-stato-danger-ink' : 'shadow-[inset_0_0_0_1.5px_#d63d3e] text-[#d63d3e]')}
        >
          <Avviso size={16} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            {ok && v.azione
              ? `Azione: ${v.azione.responsabile}, entro il ${new Date(`${v.azione.entro}T12:00:00`).toLocaleDateString('it-IT')}${cr ? ` · R ${cr.r} ${cr.classe}` : ''}`
              : v.azione?.proposta
                ? 'Azione proposta dall’assistente: controllala e confermala'
                : 'Apri un’azione di miglioramento'}
          </span>
          <Avanti size={14} aria-hidden />
        </button>
      )}
      {v.nota && <p className="mt-2 text-[13px] leading-snug text-ink-soft">{v.nota}</p>}
      {v.note.map((n) => (
        <p key={n.id} className="mt-2 flex gap-2 text-[13px] leading-snug text-ink-soft">
          <Microfono size={14} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          <span>
            {n.trascrizione}
            {n.stato === 'da_approvare' && <span className="ml-1 text-ink-muted">(da approvare)</span>}
          </span>
        </p>
      ))}
      {v.foto.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {v.foto.map((f) => f.documentoId && <FotoMini key={f.id} documentoId={f.documentoId} />)}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- vista dell'ufficio

function Ufficio({ s, pct, setS, esegui, dici, onAzione }: { s: Sopralluogo; pct: number; setS: (s: Sopralluogo) => void; esegui: Esegui; dici: (t: string) => void; onAzione: (v: Voce) => void }) {
  const voci = s.aree.flatMap((a) => a.voci);
  const nc = voci.filter((v) => v.esito === 'non_conforme');
  const oss = voci.filter((v) => v.esito && v.esito !== 'non_conforme' && (v.nota || v.note.some((n) => n.stato === 'approvata')));
  const senzaRisposta = s.conteggi.voci - s.conteggi.risposte;
  const [verbale, setVerbale] = useState<EsitoVerbale | null>(null);
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [conferma, setConferma] = useState<'emetti' | 'dvr' | 'chiudi' | null>(null);
  const [spostamenti, setSpostamenti] = useState<Record<number, number>>({});
  const bozza = !s.verbale || s.verbale.stato !== 'emesso';

  const genera = async () => {
    setLavoro('verbale');
    const r = await esegui(() => generaVerbale(s.id));
    setLavoro(null);
    if (r) {
      setS(r.s);
      setVerbale(r.verbale);
      dici('Verbale pronto in Word e PDF.');
    }
  };
  const scarica = (f: 'pdf' | 'docx') =>
    s.verbale &&
    esegui(() => scaricaFile(percorsoVerbale(s.verbale!.documentoId, f, bozza), `Verbale_sopralluogo_${s.azienda.ragioneSociale.replace(/\W+/g, '_')}.${f}`, 'Il verbale non ha ancora un file: generalo.'));
  const decidi = async (approva: boolean) => {
    setLavoro('note');
    const r = await esegui(() => decidiNote(s.id, approva, approva ? spostamenti : {}));
    setLavoro(null);
    if (r) {
      setS(r);
      setSpostamenti({});
      dici(approva ? 'Note approvate: entrano nel verbale sotto la loro voce.' : 'Trascrizioni scartate.');
    }
  };
  const fai = async () => {
    const c = conferma;
    setConferma(null);
    setLavoro(c);
    if (c === 'emetti') {
      const r = await esegui(() => emettiVerbale(s.id));
      if (r) {
        setS(r);
        dici('Verbale emesso: è tra i documenti dell’azienda.');
      }
    } else if (c === 'dvr') {
      const r = await esegui(() => inviaAlDvr(s.id));
      if (r) {
        setS(r.s);
        dici(`${r.misure} non conformità e ${r.osservazioni} osservazioni in coda per il DVR: le approva una persona dello studio.`);
      }
    } else if (c === 'chiudi') {
      const r = await esegui(() => chiudiSopralluogo(s.id));
      if (r) {
        setS(r.s);
        dici(`Sopralluogo chiuso: ${r.scadenze} azioni nello scadenziario dell’azienda.`);
      }
    }
    setLavoro(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] bg-black p-4 text-white">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[13.5px] text-grafite-300">Avanzamento</p>
          <p className="cifre leading-none">
            <span className="text-[40px] font-light tracking-[-0.04em]">{pct}</span>
            <span className="ml-0.5 text-[16px] text-grafite-300">%</span>
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-grafite-800">
          <div className="h-full rounded-full bg-acido-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] text-grafite-400">
          {s.conteggi.risposte} di {s.conteggi.voci} voci con una risposta
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Conto etichetta="Conformi" n={s.conteggi.conformi} />
        <Conto etichetta="Non conformità" n={s.conteggi.nonConformi} rosso={s.conteggi.nonConformi > 0} sotto={s.conteggi.ncSenzaAzione > 0 ? `${s.conteggi.ncSenzaAzione} senza azione confermata` : undefined} />
        <Conto etichetta="Foto" n={s.conteggi.foto} />
        <Conto etichetta="Note" n={s.conteggi.note} sotto={s.conteggi.noteDaApprovare > 0 ? `${s.conteggi.noteDaApprovare} da approvare` : undefined} />
      </div>

      {s.noteDaApprovare.length > 0 && (
        <section className="rounded-[1.25rem] bg-oro-50 p-4 shadow-[inset_0_0_0_1px_#e1ff73]">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-acido-700">Lettura documenti · livello 2</p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">
            Ho trascritto {s.noteDaApprovare.length === 1 ? 'una nota vocale' : `${s.noteDaApprovare.length} note vocali`}. Propongo di inserirle nel verbale, ciascuna sotto la sua voce. Serve la tua approvazione.
          </p>
          <ul className="mt-3 space-y-2">
            {s.noteDaApprovare.map((n) => {
              const proposta = n.vocePropostaId ? voci.find((v) => v.id === n.vocePropostaId) : null;
              return (
                <li key={n.id} className="rounded-[1rem] bg-white p-3 text-[13.5px] leading-snug shadow-[inset_0_0_0_1px_#e2e2e5]">
                  <p className="text-ink-muted">{n.voce ? `${n.voce.area} · ${n.voce.testo}` : 'Senza voce'}</p>
                  <p className="mt-1 text-ink">«{n.trascrizione}»</p>
                  {proposta && (
                    <label className="mt-2 flex min-h-[44px] items-center gap-2 text-ink-soft">
                      <input type="checkbox" className="h-5 w-5 accent-black" checked={spostamenti[n.id] === proposta.id} onChange={(e) => setSpostamenti((m) => { const x = { ...m }; if (e.target.checked) x[n.id] = proposta.id; else delete x[n.id]; return x; })} />
                      Sembra riguardare un&apos;altra voce: sposta su «{proposta.testo}»
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          {s.modificabile && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={lavoro !== null} onClick={() => decidi(true)}>
                <Spunta size={16} aria-hidden /> Approva e inserisci nel verbale
              </button>
              <button type="button" className="btn-ghost" disabled={lavoro !== null} onClick={() => decidi(false)}>
                Scarta le trascrizioni
              </button>
            </div>
          )}
        </section>
      )}

      <section className="rounded-[1.25rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
        <h2 className="text-[17px] font-medium text-ink">Non conformità</h2>
        <p className="text-[13px] text-ink-muted">{nc.length === 0 ? 'Nessuna non conformità raccolta.' : `${nc.length} raccolte · ${s.conteggi.ncSenzaAzione} senza azione di miglioramento confermata`}</p>
        <ul className="mt-2">
          {nc.map((v) => {
            const cr = classeRischio(v.azione?.p ?? null, v.azione?.d ?? null);
            const ok = azioneConfermata(v.azione);
            return (
              <li key={v.id} className="border-b border-perla-linea py-3 last:border-b-0">
                <p className="text-[12.5px] text-ink-muted">{v.area}</p>
                <p className="text-[14.5px] font-medium leading-snug text-ink">{v.testo}</p>
                {v.nota && <p className="mt-0.5 text-[13px] text-ink-soft">{v.nota}</p>}
                {v.note.map((n) => (
                  <p key={n.id} className="mt-0.5 flex gap-1.5 text-[13px] text-ink-soft">
                    <Microfono size={13} aria-hidden className="mt-0.5 shrink-0" /> {n.trascrizione}
                  </p>
                ))}
                {v.foto.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {v.foto.map((f) => f.documentoId && <FotoMini key={f.id} documentoId={f.documentoId} piccola />)}
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  {ok && v.azione ? (
                    <p className="text-[13px] leading-snug text-ink-soft">
                      <span className="font-medium text-ink">Azione:</span> {v.azione.cosa} · {v.azione.responsabile} · entro il {new Date(`${v.azione.entro}T12:00:00`).toLocaleDateString('it-IT')}
                      {cr && ` · R ${cr.r} ${cr.classe}`}
                    </p>
                  ) : (
                    <p className="text-[13px] text-[#d63d3e]">{v.azione?.proposta ? 'Azione proposta, da confermare' : 'Manca l’azione di miglioramento'}</p>
                  )}
                  {s.modificabile && (
                    <button type="button" className="btn-ghost h-10" onClick={() => onAzione(v)}>
                      {ok ? 'Modifica' : 'Imposta l’azione'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {oss.length > 0 && (
        <section className="rounded-[1.25rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
          <h2 className="text-[17px] font-medium text-ink">Osservazioni</h2>
          <ul className="mt-1">
            {oss.map((v) => (
              <li key={v.id} className="border-b border-perla-linea py-2.5 text-[13.5px] leading-snug last:border-b-0">
                <span className="text-ink-muted">{v.area} · </span>
                <span className="text-ink">{v.testo}</span>
                <p className="text-ink-soft">{[v.nota, ...v.note.filter((n) => n.stato === 'approvata').map((n) => n.trascrizione)].filter(Boolean).join(' ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[1.25rem] bg-white p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
        <h2 className="text-[17px] font-medium text-ink">Verbale e DVR</h2>
        <p className="text-[13px] text-ink-muted">
          {senzaRisposta > 0 ? `${senzaRisposta} voci senza risposta: nel verbale risultano non verificate.` : 'Tutte le voci hanno una risposta.'} Il verbale si genera dalle risposte, dalle foto e dalle note approvate.
        </p>
        {s.verbale && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip stato={s.verbale.stato === 'emesso' ? 'ok' : 'approve'}>{s.verbale.stato === 'emesso' ? `Emesso, revisione ${s.verbale.revisione}` : 'Bozza da emettere'}</Chip>
            <button type="button" className="btn-ghost h-10" onClick={() => scarica('pdf')}>
              <Scarica size={16} aria-hidden /> PDF
            </button>
            <button type="button" className="btn-ghost h-10" onClick={() => scarica('docx')}>
              <Scarica size={16} aria-hidden /> Word
            </button>
          </div>
        )}
        {verbale && verbale.segnalazioni.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {verbale.segnalazioni.map((x, i) => (
              <li key={`${x.chiave}-${i}`} className={clsx('rounded-[0.9rem] px-3 py-2 text-[13px] leading-snug', x.esito === 'blocca' ? 'bg-stato-danger text-stato-danger-ink' : 'bg-stato-warn text-stato-warn-ink')}>
                <span className="font-medium">{x.esito === 'blocca' ? 'Da sistemare' : 'Da verificare'}:</span> {x.messaggio}
              </li>
            ))}
          </ul>
        )}
        {verbale && verbale.segnalazioni.length === 0 && <p className="mt-3 text-[13px] text-stato-ok-ink">Nessuna segnalazione: il verbale si può emettere.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {(s.modificabile || bozza) && (
            <button type="button" className="btn-acido" disabled={lavoro !== null || s.conteggi.risposte === 0} onClick={genera}>
              {lavoro === 'verbale' ? 'Genero il verbale' : s.verbale ? 'Aggiorna il verbale' : 'Genera il verbale'}
            </button>
          )}
          <button type="button" className="btn-ghost" disabled={lavoro !== null || s.conteggi.risposte === 0} onClick={() => setConferma('dvr')}>
            {s.dvr.inviatoIl ? 'Invia di nuovo al DVR' : 'Invia al DVR'}
          </button>
          {s.modificabile && (
            <button type="button" className="btn-primary" disabled={lavoro !== null || s.conteggi.risposte === 0} onClick={() => setConferma('chiudi')}>
              Chiudi il sopralluogo
            </button>
          )}
          {s.verbale && bozza && (s.puoEmettere ? (
            <button type="button" className="btn-primary" disabled={lavoro !== null} onClick={() => setConferma('emetti')}>
              Emetti il verbale
            </button>
          ) : (
            <Blocco>Lo emette il titolare dello studio</Blocco>
          ))}
        </div>
        {s.dvr.inviatoIl && <p className="mt-3 text-[13px] text-ink-muted">Inviato alla Scrivania del DVR il {new Date(s.dvr.inviatoIl).toLocaleDateString('it-IT')}{s.dvr.propostaStato === 'approvata' ? ': approvato e nel programma di miglioramento.' : ': in coda per l’approvazione.'}</p>}
        <p className="mt-3 text-[12px] leading-snug text-ink-subtle">Documento redatto con assistenza AI: esiti, note e azioni li conferma il tecnico, il verbale lo firmano le figure competenti.</p>
      </section>

      <Foglio
        aperto={conferma !== null}
        titolo={conferma === 'emetti' ? 'Emetti il verbale' : conferma === 'dvr' ? 'Invia al DVR' : 'Chiudi il sopralluogo'}
        onChiudi={() => setConferma(null)}
        piede={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConferma(null)}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={fai}>
              {conferma === 'emetti' ? 'Emetto il verbale' : conferma === 'dvr' ? 'Invia la proposta' : 'Chiudi'}
            </button>
          </>
        }
      >
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          {conferma === 'emetti' && 'Il verbale esce in Word e PDF con la revisione e l’impronta del file, e compare tra i documenti dell’azienda per la firma del datore di lavoro. Emetti come titolare dello studio.'}
          {conferma === 'dvr' && `Le ${nc.length} non conformità con la loro azione e le ${oss.length} osservazioni diventano una proposta di aggiornamento del DVR nella coda di lavoro. Applicata da una persona, entrano nel programma di miglioramento e nella valutazione dei rischi.`}
          {conferma === 'chiudi' && 'Il sopralluogo si blocca e non si modifica più. Il verbale si aggiorna e ogni azione di miglioramento diventa una scadenza per il cliente.'}
        </p>
        {conferma === 'chiudi' && (s.conteggi.ncSenzaAzione > 0 || s.conteggi.noteDaApprovare > 0) && (
          <p className="mt-3 rounded-[0.9rem] bg-stato-warn px-3 py-2 text-[13.5px] text-stato-warn-ink">
            Prima completa {s.conteggi.ncSenzaAzione > 0 ? `${s.conteggi.ncSenzaAzione} azioni di miglioramento` : ''}
            {s.conteggi.ncSenzaAzione > 0 && s.conteggi.noteDaApprovare > 0 ? ' e ' : ''}
            {s.conteggi.noteDaApprovare > 0 ? `${s.conteggi.noteDaApprovare} note da approvare` : ''}.
          </p>
        )}
      </Foglio>
    </div>
  );
}

function Conto({ etichetta, n, rosso = false, sotto }: { etichetta: string; n: number; rosso?: boolean; sotto?: string }) {
  return (
    <div className="flex min-h-[5.75rem] flex-col justify-between rounded-[1.25rem] bg-white p-3.5 shadow-[inset_0_0_0_1px_#e2e2e5]">
      <p className="text-[13px] text-ink-soft">{etichetta}</p>
      <div>
        <p className={clsx('cifre text-[32px] font-light leading-none tracking-[-0.04em]', rosso ? 'text-[#d63d3e]' : 'text-ink')}>{n}</p>
        {sotto && <p className="mt-1 text-[12px] leading-snug text-ink-muted">{sotto}</p>}
      </div>
    </div>
  );
}
