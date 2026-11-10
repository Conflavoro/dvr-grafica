'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avviso, Cestino, CerchioSpunta, Fotocamera, Microfono, Ferma } from '@/components/icone';
import { GRAVITA_NEAR_MISS } from '@/lib/portale/nearmiss-api';
import { segnalaNearMiss, type MioNearMiss } from '@/lib/portale/lavoratore-api';
import { useWavRecorder } from '@/lib/use-wav-recorder';
import { clsx } from '@/lib/clsx';
import { CAMPO } from './Appuntamento';

function oraLocale(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Segnalazione rapida di un near miss dal telefono: cosa, dove, quando, gravita',
 * foto (fino a 3) e nota vocale. Anonima davvero se scelta.
 */
export function SegnalaNearMiss({
  token,
  sedi,
  onInviata,
}: {
  token: string;
  sedi: string[];
  onInviata: (s: MioNearMiss | null, messaggio: string, ricevuta: string | null) => void;
}) {
  const rec = useWavRecorder();
  const [descrizione, setDescrizione] = useState('');
  const [dove, setDove] = useState('');
  const [sede, setSede] = useState(sedi.length === 1 ? sedi[0] : '');
  const [quando, setQuando] = useState(oraLocale());
  const [gravita, setGravita] = useState('media');
  const [anonima, setAnonima] = useState(false);
  const [consenso, setConsenso] = useState(false);
  const [foto, setFoto] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [invio, setInvio] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const anteprime = useMemo(() => foto.map((f) => URL.createObjectURL(f)), [foto]);
  useEffect(() => () => anteprime.forEach((u) => URL.revokeObjectURL(u)), [anteprime]);

  const aggiungiFoto = (l: FileList | null) => {
    if (!l) return;
    setFoto((p) => [...p, ...Array.from(l).filter((f) => f.type.startsWith('image/'))].slice(0, 3));
  };

  const voce = async () => {
    if (rec.registrando) {
      const f = rec.ferma();
      if (f) setAudio(f);
      return;
    }
    await rec.avvia();
  };

  const pronta = descrizione.trim().length >= 10 || audio !== null;

  const invia = async () => {
    setInvio(true);
    setErr(null);
    try {
      const r = await segnalaNearMiss(token, {
        descrizione,
        dove,
        sede,
        quando: quando ? new Date(quando).toISOString() : '',
        gravita,
        anonima,
        consensoStudio: consenso,
        foto,
        audio,
      });
      onInviata(r.segnalazione, r.messaggio, r.ricevuta);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invio non riuscito. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (pronta && !invio) void invia();
      }}
    >
      <div>
        <label htmlFor="nm-cosa" className="mb-1.5 block text-[15px] font-medium text-ink">
          Cosa è successo?
        </label>
        <textarea
          id="nm-cosa"
          className={CAMPO}
          rows={4}
          maxLength={2000}
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Ad esempio: olio sul pavimento vicino alla pressa, sono quasi scivolato"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void voce()} className={clsx(rec.registrando ? 'btn-primary' : 'btn-ghost', 'min-h-[44px]')}>
            {rec.registrando ? <Ferma size={16} aria-hidden /> : <Microfono size={16} aria-hidden />}
            {rec.registrando ? `Fermo la registrazione (${rec.secondi} s)` : audio ? 'Registra di nuovo' : 'Dillo a voce'}
          </button>
          {audio && !rec.registrando && (
            <span className="inline-flex items-center gap-2 text-[13.5px] text-ink-soft">
              <CerchioSpunta size={16} aria-hidden className="text-stato-ok-segno" /> Nota vocale pronta
              <button type="button" onClick={() => setAudio(null)} className="btn-icon" aria-label="Togli la nota vocale">
                <Cestino size={16} aria-hidden />
              </button>
            </span>
          )}
        </div>
        {rec.errore && <p className="mt-1.5 text-[13px] text-stato-danger-ink">{rec.errore}</p>}
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">La voce diventa testo e poi si cancella: non conserviamo l’audio.</p>
      </div>

      <div>
        <label htmlFor="nm-dove" className="mb-1.5 block text-[15px] font-medium text-ink">
          Dove?
        </label>
        {sedi.length > 1 && (
          <div className="mb-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Sede">
            {sedi.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sede === s}
                onClick={() => setSede(sede === s ? '' : s)}
                className={clsx('min-h-[40px] rounded-full px-4 text-[14px]', sede === s ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]')}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <input
          id="nm-dove"
          className={CAMPO}
          maxLength={200}
          value={dove}
          onChange={(e) => setDove(e.target.value)}
          placeholder="Reparto o punto preciso, ad esempio cucina, vicino al forno"
        />
      </div>

      <div>
        <label htmlFor="nm-quando" className="mb-1.5 block text-[15px] font-medium text-ink">
          Quando?
        </label>
        <input id="nm-quando" type="datetime-local" className={CAMPO} value={quando} max={oraLocale()} onChange={(e) => setQuando(e.target.value)} />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-[15px] font-medium text-ink">Se fosse andata male, quanto sarebbe stato grave?</legend>
        <div className="grid grid-cols-2 gap-2">
          {GRAVITA_NEAR_MISS.map((g) => (
            <label
              key={g.k}
              className={clsx(
                'flex min-h-[64px] cursor-pointer flex-col justify-center rounded-[1rem] px-3.5 py-2.5',
                gravita === g.k ? 'bg-ink text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]',
              )}
            >
              <input type="radio" name="gravita" value={g.k} checked={gravita === g.k} onChange={() => setGravita(g.k)} className="sr-only" />
              <span className="text-[15px] font-medium">{g.t}</span>
              <span className={clsx('text-[12.5px] leading-snug', gravita === g.k ? 'text-grafite-300' : 'text-ink-muted')}>{g.sotto}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-1.5 text-[15px] font-medium text-ink">Foto (facoltative, fino a 3)</p>
        <div className="flex flex-wrap gap-2">
          {anteprime.map((u, i) => (
            <div key={u} className="relative h-20 w-20 overflow-hidden rounded-[1rem] bg-perla-velo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setFoto((p) => p.filter((_, j) => j !== i))}
                aria-label={`Togli la foto ${i + 1}`}
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"
              >
                <Cestino size={14} aria-hidden />
              </button>
            </div>
          ))}
          {foto.length < 3 && (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-[1rem] bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]">
              <Fotocamera size={22} aria-hidden />
              <span className="sr-only">Aggiungi una foto</span>
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => aggiungiFoto(e.target.files)} />
            </label>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">Non inquadrare volti o targhe. Dalle foto togliamo la posizione e i dati del telefono.</p>
      </div>

      <div className="rounded-[1.25rem] bg-perla-velo p-4">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
          <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#18181b]" />
          <span>
            <span className="block text-[15px] font-medium text-ink">Invia in forma anonima</span>
            <span className="block text-[13px] leading-relaxed text-ink-muted">L’azienda non saprà chi l’ha mandata. Non teniamo nessun legame con te.</span>
          </span>
        </label>
        {anonima && (
          <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3">
            <input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#18181b]" />
            <span>
              <span className="block text-[14.5px] text-ink">Il tecnico dello studio può sapere che sono io</span>
              <span className="block text-[13px] leading-relaxed text-ink-muted">
                Facoltativo: serve solo se vuoi che ti richiami per capire meglio. Per l’azienda resti anonimo.
              </span>
            </span>
          </label>
        )}
      </div>

      {err && (
        <p role="alert" className="flex items-start gap-2 rounded-[1rem] bg-stato-danger px-3.5 py-3 text-[14px] text-stato-danger-ink">
          <Avviso size={18} aria-hidden className="mt-0.5 shrink-0" />
          {err}
        </p>
      )}

      <button type="submit" disabled={!pronta || invio || rec.registrando} className="btn-acido w-full text-[16px]" style={{ minHeight: 52 }}>
        {invio ? 'Invio la segnalazione' : 'Invia la segnalazione'}
      </button>
      {!pronta && <p className="-mt-3 text-center text-[12.5px] text-ink-muted">Scrivi almeno una frase o registra una nota vocale.</p>}
      <p className="text-[12.5px] leading-relaxed text-ink-muted">In caso di infortunio o pericolo immediato avvisa subito il tuo preposto. Per un’emergenza chiama il 112.</p>
    </form>
  );
}
