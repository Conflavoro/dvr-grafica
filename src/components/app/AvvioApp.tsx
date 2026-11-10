'use client';

// Comportamenti dell'app nativa (Capacitor). Sul web non fa nulla.
// Tasto indietro di Android, link che aprono l'app, barra di stato, splash,
// classe nativa sul documento e registrazione per le notifiche dopo l'accesso.

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isNativa, piattaforma } from '@/lib/app/nativa';
import { registraNotifiche } from '@/lib/app/notifiche';
import { attendiToken, getToken } from '@/lib/api';
import { BloccoApp } from './BloccoApp';
import { BannerSenzaRete } from './BannerSenzaRete';

/** Percorso interno da un link che apre l'app (https://dvr.conflavoro.it/... o schema proprio). */
export function percorsoDaLink(url: string): string | null {
  try {
    const u = new URL(url);
    const percorso = `${u.pathname}${u.search}${u.hash}`;
    return percorso.startsWith('/') ? percorso : null;
  } catch {
    return null;
  }
}

/**
 * C'e' un foglio o una finestra aperta? Alcuni fogli restano nel DOM anche chiusi
 * (aria-hidden, spostati fuori schermo): contano solo quelli davvero visibili.
 */
export function foglioAperto(doc: Document): boolean {
  return Array.from(doc.querySelectorAll<HTMLElement>('[role="dialog"]')).some(
    (el) =>
      el.getAttribute('aria-hidden') !== 'true' &&
      !el.closest('[aria-hidden="true"]') &&
      !el.hidden &&
      el.getClientRects().length > 0 &&
      (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() !== false,
  );
}

export function AvvioApp() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativa()) return;
    const html = document.documentElement;
    html.classList.add('app-nativa', `app-${piattaforma()}`);

    const rimuovi: Array<() => void> = [];
    let chiuso = false;
    const vai = (p: string) => router.push(p);

    void (async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ]);
      if (chiuso) return;

      StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      if (piattaforma() === 'android') {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
      }

      const indietro = await App.addListener('backButton', ({ canGoBack }) => {
        // Prima si chiudono fogli e finestre aperte (Esc), poi si torna indietro.
        if (foglioAperto(document)) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        if (canGoBack && window.history.length > 1) window.history.back();
        else void App.minimizeApp();
      });
      const link = await App.addListener('appUrlOpen', ({ url }) => {
        const p = percorsoDaLink(url);
        if (p) vai(p);
      });
      rimuovi.push(() => void indietro.remove(), () => void link.remove());

      await attendiToken();
      SplashScreen.hide().catch(() => undefined);
      if (getToken()) void registraNotifiche(vai);
    })();

    const dopoAccesso = () => {
      if (getToken()) void registraNotifiche(vai);
    };
    window.addEventListener('auth-changed', dopoAccesso);

    return () => {
      chiuso = true;
      window.removeEventListener('auth-changed', dopoAccesso);
      rimuovi.forEach((f) => f());
    };
  }, [router]);

  // Dopo l'accesso si cambia pagina: e' il momento giusto per chiedere le notifiche.
  const pathname = usePathname();
  useEffect(() => {
    if (isNativa() && getToken()) void registraNotifiche((p) => router.push(p));
  }, [pathname, router]);

  return (
    <>
      <BannerSenzaRete />
      <BloccoApp />
    </>
  );
}
