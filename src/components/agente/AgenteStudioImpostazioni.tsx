'use client';

import { useEffect, useId, useState } from 'react';
import { Check, Loader2 } from '@/components/icone';
import type { AgenteProfilo, AgenteTono } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { FalcoMascot } from './FalcoMascot';

const MAX_ISTRUZIONI = 4000;
const MAX_NOME = 40;

/**
 * Sezione "Agente dello studio" in Impostazioni. Visibile a tutti; i campi sono
 * modificabili solo se il backend lo consente (titolare di studio e admin).
 */
export function AgenteStudioImpostazioni() {
  const ds = useDataSource();
  const id = useId();
  const [profilo, setProfilo] = useState<AgenteProfilo | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tono, setTono] = useState<AgenteTono>('autorevole');
  const [istruzioni, setIstruzioni] = useState('');
  const [disattivati, setDisattivati] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);

  const applica = (p: AgenteProfilo) => {
    setProfilo(p);
    setNome(p.nome);
    setTono(p.tono);
    setIstruzioni(p.istruzioni_studio);
    setDisattivati(p.strumenti_disattivati);
  };

  const carica = () => {
    setErrore(null);
    ds.agente
      .profilo()
      .then(applica)
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Profilo agente non disponibile.'));
  };

  useEffect(carica, [ds]); // eslint-disable-line react-hooks/exhaustive-deps

  const modificabile = profilo?.modificabile === true;
  const cambiato =
    !!profilo &&
    (nome.trim() !== profilo.nome ||
      tono !== profilo.tono ||
      istruzioni !== profilo.istruzioni_studio ||
      [...disattivati].sort().join('|') !== [...profilo.strumenti_disattivati].sort().join('|'));

  const salva = async () => {
    if (!modificabile || !cambiato) return;
    setSalvando(true);
    setErrore(null);
    setSalvato(false);
    try {
      applica(
        await ds.agente.aggiornaProfilo({
          nome: nome.trim() || 'Falco',
          tono,
          istruzioni_studio: istruzioni,
          strumenti_disattivati: disattivati,
        })
      );
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2500);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSalvando(false);
    }
  };

  const toggle = (n: string, attivo: boolean) =>
    setDisattivati((d) => (attivo ? d.filter((x) => x !== n) : Array.from(new Set([...d, n]))));

  return (
    <section className="card-luxury p-6 md:col-span-2" aria-labelledby={`${id}-titolo`}>
      <header className="mb-4 flex items-center gap-3">
        <FalcoMascot stato="riposo" size={40} />
        <div className="min-w-0">
          <h2 id={`${id}-titolo`} className="section-title text-[17px]">
            Agente dello studio
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            {modificabile
              ? "Nome, tono e regole dell'agente valgono per tutto lo studio."
              : "Impostazioni decise dal titolare dello studio: qui puoi consultarle."}
          </p>
        </div>
      </header>

      {!profilo && !errore && <p className="text-[13px] text-ink-muted">Caricamento…</p>}
      {errore && !profilo && (
        <div className="text-[13px] text-ink-muted">
          <p>{errore}</p>
          <button type="button" onClick={carica} className="btn-ghost mt-2 min-h-[44px]">
            Riprova
          </button>
        </div>
      )}

      {profilo && (
        <form
          className="grid gap-5 lg:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <fieldset disabled={!modificabile || salvando} className="space-y-4">
            <div>
              <label htmlFor={`${id}-nome`} className="label-upper">
                Nome dell&apos;agente
              </label>
              <input
                id={`${id}-nome`}
                value={nome}
                maxLength={MAX_NOME}
                onChange={(e) => setNome(e.target.value)}
                className="input-field mt-1 disabled:opacity-70"
              />
            </div>

            <div role="radiogroup" aria-labelledby={`${id}-tono`}>
              <p id={`${id}-tono`} className="label-upper">
                Tono
              </p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['autorevole', 'Autorevole', 'Tecnico e preciso, cita la norma.'],
                    ['semplice', 'Semplice', 'Frasi brevi, adatto anche ai clienti.'],
                  ] as const
                ).map(([v, t, d]) => (
                  <label
                    key={v}
                    className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-xl border border-brand-200 bg-white/70 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/70"
                  >
                    <input
                      type="radio"
                      name={`${id}-tono`}
                      value={v}
                      checked={tono === v}
                      onChange={() => setTono(v)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-ink">{t}</span>
                      <span className="block text-[12px] text-ink-muted">{d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-istr`} className="label-upper">
                Istruzioni dello studio
              </label>
              <textarea
                id={`${id}-istr`}
                value={istruzioni}
                maxLength={MAX_ISTRUZIONI}
                onChange={(e) => setIstruzioni(e.target.value)}
                rows={6}
                placeholder="Esempio: usa sempre il metodo MoVaRisCh per il rischio chimico; nelle risposte ai clienti evita sigle non spiegate."
                className="mt-1 block w-full resize-y rounded-xl border border-brand-200 bg-white/80 px-4 py-3 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none disabled:opacity-70 sm:text-[14px]"
              />
              <p className="mt-1 text-right text-[11px] tabular-nums text-ink-subtle">
                {istruzioni.length} / {MAX_ISTRUZIONI}
              </p>
            </div>
          </fieldset>

          <fieldset disabled={!modificabile || salvando}>
            <legend className="label-upper">Strumenti attivi</legend>
            <p className="mt-1 text-[12px] text-ink-muted">
              Quelli segnati &quot;modifica dati&quot; scrivono nella piattaforma (archivio, DVR).
            </p>
            <ul className="mt-2 space-y-1">
              {profilo.strumenti.map((s) => {
                const attivo = !disattivati.includes(s.nome);
                return (
                  <li key={s.nome}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-brand-50/60">
                      <input
                        type="checkbox"
                        checked={attivo}
                        onChange={(e) => toggle(s.nome, e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1 text-[13.5px] text-ink-soft">{s.titolo}</span>
                      {s.scrive && (
                        <span className="shrink-0 rounded-md bg-warn px-1.5 py-0.5 text-[11px] font-medium text-warn-ink">
                          modifica dati
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
              {profilo.strumenti.length === 0 && <li className="text-[13px] text-ink-muted">Nessuno strumento disponibile.</li>}
            </ul>
          </fieldset>

          {modificabile && (
            <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <button type="submit" disabled={!cambiato || salvando} className="btn-primary min-h-[44px]">
                {salvando ? <Loader2 size={15} aria-hidden className="animate-spin" /> : null}
                {salvando ? 'Salvataggio…' : 'Salva impostazioni agente'}
              </button>
              {salvato && (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ok-ink" role="status">
                  <Check size={14} aria-hidden /> Salvato
                </span>
              )}
              {errore && <span className="text-[13px] text-danger-mark" role="alert">{errore}</span>}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
