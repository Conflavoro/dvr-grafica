// Factory + singleton per il DataSource attivo.
//
// Modalità:
//   - default (no env) → LocalStorageDataSource: CRUD reale persistito nel
//     browser, scoped per utente loggato. Ogni utente parte da 0.
//   - NEXT_PUBLIC_USE_API=true + NEXT_PUBLIC_API_BASE_URL=https://... → ApiDataSource
//     (Laravel reale via JWT — attivo post-cPanel)
//
// `output: 'export'` inlinea le env a build-time: per switchare backend serve
// un nuovo deploy. È intenzionale.

import { ApiDataSource } from './api';
import { LocalStorageDataSource } from './localstorage';
import type { DataSource } from './types';

function shouldUseApi(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === 'true' && !!process.env.NEXT_PUBLIC_API_BASE_URL;
}

/**
 * True quando il frontend usa il backend Laravel reale (ApiDataSource).
 * Usato dalla UI per nascondere le feature solo-demo (es. quick-login mock).
 */
export function isApiMode(): boolean {
  return shouldUseApi();
}

let cachedInstance: DataSource | null = null;

export function getDataSource(): DataSource {
  if (cachedInstance === null) {
    cachedInstance = shouldUseApi() ? new ApiDataSource() : new LocalStorageDataSource();
  }
  return cachedInstance;
}

export function resetDataSourceForTests(): void {
  cachedInstance = null;
}
