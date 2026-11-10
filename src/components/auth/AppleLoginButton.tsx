'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, setToken } from '@/lib/api';
import { useDataSource } from '@/lib/use-data-source';
import { ROLES } from '@/lib/mock-auth';
import identita from '../../../app.config.json';

/** Nome completo dai campi che Apple manda solo al primo accesso. */
export function nomeDaApple(nome: string | null | undefined, cognome: string | null | undefined): string | null {
  const n = [nome, cognome].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
  return n === '' ? null : n;
}

interface RispostaApple {
  access_token: string;
  needs_onboarding: boolean;
}

/**
 * "Accedi con Apple" (solo nell'app iOS). Il token d'identita' di Apple va al
 * backend (POST /api/auth/apple), che lo verifica con le chiavi di Apple.
 * Aspetto secondo le linee guida Apple: nero, logo e testo, angoli moderati.
 */
export function AppleLoginButton() {
  const router = useRouter();
  const ds = useDataSource();
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accedi(): Promise<void> {
    setErrore(null);
    setBusy(true);
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
      const r = await SignInWithApple.authorize({
        clientId: identita.appId,
        redirectURI: 'https://dvr.conflavoro.it/',
        scopes: 'email name',
      });
      const risposta = await apiRequest<RispostaApple>('/auth/apple', {
        method: 'POST',
        anonymous: true,
        body: {
          identity_token: r.response.identityToken,
          nome: nomeDaApple(r.response.givenName, r.response.familyName),
        },
      });
      setToken(risposta.access_token);
      window.dispatchEvent(new Event('auth-changed'));
      if (risposta.needs_onboarding) {
        router.push('/onboarding');
        return;
      }
      const me = await ds.auth.me();
      router.push(me ? ROLES[me.role].homePath : '/');
    } catch (e) {
      const annullato = e instanceof Error && /cancel|1001/i.test(e.message);
      if (!annullato) {
        const msg = (e as { body?: { message?: unknown } })?.body?.message;
        setErrore(typeof msg === 'string' ? msg : 'Accesso con Apple non riuscito. Riprova.');
      }
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void accedi()}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-[16px] font-medium text-white disabled:opacity-60"
      >
        <svg width="16" height="19" viewBox="0 0 16 19" aria-hidden fill="currentColor">
          <path d="M13.2 10.1c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8C3.3 4.6 1.8 5.6.9 7c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM10.8 3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
        </svg>
        {busy ? 'Accesso in corso' : 'Accedi con Apple'}
      </button>
      {errore && (
        <p role="alert" className="text-center text-[13.5px] text-danger-ink">
          {errore}
        </p>
      )}
    </div>
  );
}
