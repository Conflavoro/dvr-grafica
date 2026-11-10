// Notifiche push: predisposizione lato app. Il token del dispositivo va al
// backend (POST /api/dispositivi); l'invio vero (APNs, FCM) si accende quando
// ci sono gli account sviluppatore e il servizio gestito.

import { apiRequest, getToken } from '@/lib/api';
import { isNativa, piattaforma } from './nativa';

let registrato = false;

/** Dove portare l'utente quando tocca una notifica: solo percorsi interni. */
export function percorsoDaNotifica(dati: unknown): string | null {
  if (!dati || typeof dati !== 'object') return null;
  const link = (dati as Record<string, unknown>).link;
  if (typeof link !== 'string') return null;
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  return link;
}

/**
 * Chiede il permesso (una volta per avvio) e registra il dispositivo.
 * Da chiamare solo con un utente entrato. Non fa nulla sul web.
 */
export async function registraNotifiche(vai: (percorso: string) => void): Promise<void> {
  if (registrato || !isNativa() || !getToken()) return;
  registrato = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let permesso = await PushNotifications.checkPermissions();
    if (permesso.receive === 'prompt' || permesso.receive === 'prompt-with-rationale') {
      permesso = await PushNotifications.requestPermissions();
    }
    if (permesso.receive !== 'granted') return;

    await PushNotifications.addListener('registration', (t) => {
      void apiRequest('/dispositivi', {
        method: 'POST',
        body: { token: t.value, piattaforma: piattaforma() },
      }).catch(() => undefined);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', (azione) => {
      const p = percorsoDaNotifica(azione.notification.data);
      if (p) vai(p);
    });
    await PushNotifications.register();
  } catch {
    registrato = false;
  }
}
