'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useDataSource } from '@/lib/use-data-source';
import { ROLES } from '@/lib/mock-auth';
import { GOOGLE_CLIENT_ID } from './GoogleAuthProvider';

/**
 * Bottone "Accedi con Google".
 *
 * - Con NEXT_PUBLIC_GOOGLE_CLIENT_ID configurato: usa il vero widget Google,
 *   ottiene l'ID token (credential) e lo passa al DataSource.googleLogin().
 * - Senza client id (demo/mock): mostra un bottone stilizzato che simula un
 *   utente Google al primo accesso (needs_onboarding -> /onboarding).
 *
 * In entrambi i casi instrada in base a needs_onboarding.
 */
export function GoogleLoginButton() {
  const router = useRouter();
  const ds = useDataSource();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleIdToken(idToken: string): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const { user, needs_onboarding } = await ds.auth.googleLogin(idToken);
      if (needs_onboarding) {
        router.push('/onboarding');
      } else {
        router.push(ROLES[user.role].homePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accesso con Google non riuscito.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {GOOGLE_CLIENT_ID ? (
        <div className="flex justify-center [color-scheme:light]">
          <GoogleLogin
            onSuccess={(resp: CredentialResponse) => {
              if (resp.credential) void handleIdToken(resp.credential);
              else setError('Token Google mancante. Riprova.');
            }}
            onError={() => setError('Accesso con Google non riuscito.')}
            theme="outline"
            shape="rectangular"
            text="continue_with"
            locale="it"
            width="320"
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleIdToken('mock-google-id-token')}
          className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-0 bg-white px-5 text-[14.5px] font-medium shadow-[inset_0_0_0_1.5px_#e2e2e5] text-ink transition-colors duration-200 hover:border-brand-300 disabled:opacity-60"
        >
          <GoogleGlyph />
          {busy ? 'Accesso in corso' : 'Continua con Google'}
        </button>
      )}

      {error && (
        <p role="alert" className="text-center text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
