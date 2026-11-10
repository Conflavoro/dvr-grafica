'use client';

import { useEffect, useState } from 'react';
import { percorso } from '@/lib/percorso';
import { LoginForm } from '@/components/auth/LoginForm';
import { QuickLoginGrid } from '@/components/auth/QuickLoginGrid';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { AppleLoginButton } from '@/components/auth/AppleLoginButton';
import { piattaforma, type Piattaforma } from '@/lib/app/nativa';
import { isApiMode } from '@/lib/data-source';
import { DEMO, DEMO_LIVE } from '@/lib/demo/attivo';
import { DemoAccesso } from '@/components/demo/DemoAccesso';
import { DemoLiveAccesso } from '@/components/demo/DemoLiveAccesso';
import { Registrazione } from '@/components/auth/Registrazione';

export type ModoAccesso = 'crea' | 'accedi';

/**
 * Riquadro d'ingresso (04 comune, stato 0 e accesso). Due strade, una sola alla volta:
 * "crea" per il cliente nuovo (Google, Apple, oppure email e cellulare con codice) e
 * "accedi" per chi ha già un account (Google oppure email e password). Va dentro un
 * GoogleAuthProvider.
 */
export function Accesso({ logo = true, modoIniziale = 'accedi' }: { logo?: boolean; modoIniziale?: ModoAccesso }) {
  const apiMode = isApiMode();
  // Piattaforma letta dopo il montaggio: la pagina statica nasce identica ovunque.
  const [dove, setDove] = useState<Piattaforma | null>(null);
  useEffect(() => setDove(piattaforma()), []);
  const [modo, setModo] = useState<ModoAccesso>(modoIniziale);
  useEffect(() => setModo(modoIniziale), [modoIniziale]);

  // Nell'app iOS: Apple. Google blocca il suo accesso dentro le WebView, quindi
  // nell'app nativa resta solo sul web finche' non c'e' il plugin nativo.
  const social = (
    <div className="space-y-3 pt-1">
      {dove === 'ios' && <AppleLoginButton />}
      {dove === 'web' && <GoogleLoginButton />}
    </div>
  );
  const separatore = (testo: string) => (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-perla-linea" />
      <span className="text-[12.5px] text-ink-subtle">{testo}</span>
      <span className="h-px flex-1 bg-perla-linea" />
    </div>
  );

  return (
    <div className="w-full">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={percorso('/brand/conflavoro-logo.svg')} alt="Conflavoro, Piccole Medie Imprese" width={176} height={45} className="mb-8 h-9 w-auto" />
      )}
      {DEMO_LIVE ? (
        <DemoLiveAccesso />
      ) : DEMO ? (
        <DemoAccesso />
      ) : modo === 'crea' && apiMode ? (
        <Registrazione
          onIndietro={() => setModo('accedi')}
          sopraModulo={
            <>
              {social}
              {separatore('oppure con email e cellulare')}
            </>
          }
        />
      ) : (
        <>
          <h2 className="text-[34px] font-medium leading-tight tracking-[-0.03em] text-ink">Accedi</h2>
          <p className="mb-7 mt-1.5 text-[14px] text-ink-muted">Entra con il tuo account.</p>
          {social}
          {separatore('oppure con email')}
          <LoginForm />

          {apiMode && (
            <div className="mt-7 rounded-[1.25rem] bg-perla-velo p-4">
              <p className="text-[14px] font-medium text-ink">Non hai ancora un accesso?</p>
              <p className="mt-0.5 text-[13px] text-ink-muted">Lo crei in un minuto, senza password.</p>
              <button type="button" className="btn-ghost mt-3 min-h-[48px] w-full text-[14px]" onClick={() => setModo('crea')}>
                Crea il tuo accesso
              </button>
            </div>
          )}
        </>
      )}

      {!apiMode && !DEMO && !DEMO_LIVE && (
        <div className="mt-9">
          <QuickLoginGrid />
        </div>
      )}

      <p className="mt-9 text-[11.5px] leading-relaxed text-ink-subtle">
        Conflavoro PMI. Le risposte e i documenti sono preparati con assistenza AI e vanno sempre verificati e firmati dalle figure competenti (D.Lgs. 81/08).
      </p>
    </div>
  );
}
