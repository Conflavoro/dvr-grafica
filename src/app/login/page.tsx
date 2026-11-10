'use client';

/**
 * /login → redirect alla root (pagina di login SPA).
 * Necessario per l'export statico cPanel: genera login/index.html cosi'
 * i link diretti a /login non danno 404. Il contenuto reale del login
 * e' in src/app/page.tsx (root).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?entra=1');
  }, [router]);
  return null;
}
