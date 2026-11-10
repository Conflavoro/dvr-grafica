'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';

/** Client id Google (build-time inlined da `output: 'export'`). */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/**
 * Wrapper del provider Google OAuth. Quando il client id NON e' configurato
 * (es. demo pubblica) NON monta il provider: i componenti figli mostreranno
 * il fallback "Continua con Google" simulato. Evita crash a build/runtime.
 */
export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID) {
    return <>{children}</>;
  }
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}
