'use client';

import { percorso } from '@/lib/percorso';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Invia, Microfono } from '@/components/icone';
import { Foglio } from '@/components/portale/kit';
import { chiediFalcoLavoratore, dettaturaLavoratore, voceLavoratore, type MessaggioFalco } from '@/lib/portale/lavoratore-api';
import { useWavRecorder } from '@/lib/use-wav-recorder';
import { ascoltaLettura, interrompiVoce, leggiConVoceAgente, letturaInCorso } from '@/lib/agente-voce';
import { sbloccaAudio } from '@/lib/falco-bocca';
import { markdownInTestoSemplice } from '@/components/agente/AgenteMarkdown';
import { TestoAVoce } from '@/components/agente/TestoAVoce';
import { clsx } from '@/lib/clsx';

export const AVATAR_FALCO = percorso('/brand/falco-acido/avatar.webp');

export function AvatarFalco({ size = 40, acceso = false }: { size?: number; acceso?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx('relative block shrink-0 overflow-hidden rounded-full bg-white', acceso ? 'shadow-[0_0_0_3px_#d4ff3a]' : 'shadow-[inset_0_0_0_1px_#e2e2e5]')}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AVATAR_FALCO} alt="" width={size} height={size} className="h-full w-full object-cover" style={{ transform: 'scale(2.6)', transformOrigin: '50% 20%' }} />
    </span>
  );
}

/** Falco del lavoratore: domande sulla sicurezza della sua mansione e sui suoi dati. La conversazione resta sul telefono. */
export function FalcoLavoratore({ token, aperto, onChiudi, domande, nome }: { token: string; aperto: boolean; onChiudi: () => void; domande: string[]; nome: string }) {
  const [msg, setMsg] = useState<MessaggioFalco[]>([]);
  const [testo, setTesto] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const fine = useRef<HTMLDivElement | null>(null);
  const rec = useWavRecorder();
  const microfonoRef = useRef<(() => Promise<void>) | null>(null);
  const [trascrivo, setTrascrivo] = useState(false);
  // A voce: risposta scritta e parlata insieme, le parole si scuriscono a tempo. Scritto: solo testo.
  const lettura = useSyncExternalStore(ascoltaLettura, letturaInCorso, () => null);
  const ID_BASE = 900000;

  useEffect(() => {
    if (!aperto) interrompiVoce();
  }, [aperto]);

  useEffect(() => {
    fine.current?.scrollIntoView({ block: 'end' });
  }, [msg, attesa]);

  const chiedi = async (d: string, vocale = false) => {
    const q = d.trim();
    if (!q || attesa) return;
    interrompiVoce();
    const storico = msg;
    setMsg([...storico, { ruolo: 'lavoratore', testo: q }]);
    setTesto('');
    setAttesa(true);
    setErr(null);
    try {
      const r = await chiediFalcoLavoratore(token, q, storico);
      const indice = storico.length + 1;
      setMsg((m) => [...m, { ruolo: 'falco', testo: r.testo }]);
      setNota(r.disclaimer);
      if (vocale) leggiConVoceAgente(markdownInTestoSemplice(r.testo), (x) => voceLavoratore(token, x), {}, ID_BASE + indice);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Non riesco a rispondere adesso.');
    } finally {
      setAttesa(false);
    }
  };

  const microfono = async () => {
    if (rec.registrando) {
      const file = rec.ferma();
      if (!file) return;
      setTrascrivo(true);
      setErr(null);
      try {
        const t = (await dettaturaLavoratore(token, file)).trim();
        if (!t) {
          setErr('Non ho capito. Riprova parlando vicino al telefono.');
          return;
        }
        setTrascrivo(false);
        await chiedi(t, true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Non riesco ad ascoltarti adesso.');
      } finally {
        setTrascrivo(false);
      }
      return;
    }
    if (attesa) return;
    interrompiVoce();
    sbloccaAudio();
    await rec.avvia({ onSilenzio: () => void microfonoRef.current?.() });
  };
  microfonoRef.current = microfono;

  return (
    <Foglio
      aperto={aperto}
      titolo="Il tuo Falco"
      onChiudi={onChiudi}
      piede={
        <form
          className="flex w-full items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void chiedi(testo);
          }}
        >
          <label htmlFor="falco-lav" className="sr-only">
            Scrivi una domanda
          </label>
          <input
            id="falco-lav"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            maxLength={800}
            placeholder="Chiedi sulla tua sicurezza"
            className="h-12 min-w-0 flex-1 rounded-full bg-perla-velo px-5 text-[16px] text-ink placeholder:text-ink-subtle focus:outline-none focus:shadow-[inset_0_0_0_2px_#18181b]"
          />
          <button
            type="button"
            onClick={() => void microfono()}
            disabled={attesa || trascrivo}
            aria-pressed={rec.registrando}
            aria-label={rec.registrando ? 'Interrompi' : 'Parla con il Falco'}
            className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-40', rec.registrando ? 'bg-stato-danger-ink text-white' : 'bg-perla-velo text-ink')}
          >
            <Microfono size={18} aria-hidden />
          </button>
          <button
            type="submit"
            disabled={!testo.trim() || attesa}
            aria-label="Invia"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-oro-500 text-acido-950 disabled:opacity-40"
          >
            <Invia size={18} aria-hidden />
          </button>
        </form>
      }
    >
      <div className="space-y-3 pb-2">
        <div className="flex items-start gap-3">
          <AvatarFalco size={44} acceso />
          <p className="pt-1 text-[15px] leading-relaxed text-ink">
            Ciao {nome}, sono il Falco. Ti rispondo sulla sicurezza della tua mansione e sulle tue scadenze. Non vedo i dati dei tuoi colleghi.
          </p>
        </div>
        {msg.length === 0 && (
          <ul className="grid gap-2 pt-1">
            {domande.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => void chiedi(d)}
                  className="flex min-h-[48px] w-full items-center rounded-[1rem] px-4 text-left text-[14.5px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]"
                >
                  {d}
                </button>
              </li>
            ))}
          </ul>
        )}
        {msg.map((m, i) => (
          <div key={i} className={clsx('flex', m.ruolo === 'lavoratore' ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[85%] whitespace-pre-line rounded-[1.25rem] px-4 py-2.5 text-[15px] leading-relaxed',
                m.ruolo === 'lavoratore' ? 'bg-ink text-white' : 'bg-perla-velo text-ink',
              )}
            >
              {lettura && lettura.id === ID_BASE + i ? <TestoAVoce pezzi={lettura.pezzi} pezzo={lettura.pezzo} parola={lettura.parola} /> : m.testo}
            </div>
          </div>
        ))}
        {(attesa || trascrivo || rec.registrando) && (
          <p role="status" className="text-[14px] text-ink-muted">
            {rec.registrando ? 'Ti ascolto: quando smetti di parlare invio io' : trascrivo ? 'Ho capito, un momento' : 'Il Falco sta pensando'}
          </p>
        )}
        {err && (
          <p role="alert" className="rounded-[1rem] bg-stato-danger px-3.5 py-3 text-[14px] text-stato-danger-ink">
            {err}
          </p>
        )}
        {nota && msg.length > 0 && <p className="text-[12px] text-ink-subtle">{nota}</p>}
        <div ref={fine} />
      </div>
    </Foglio>
  );
}
