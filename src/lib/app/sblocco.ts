/**
 * Sblocco con Face ID, Touch ID o impronta (facoltativo, solo app nativa).
 *
 * Si accende dal proprio account; da quel momento l'app chiede il volto o
 * l'impronta all'apertura e al ritorno dopo GRAZIA_MS in background. Il token
 * resta dov'e' (Preferences): il blocco protegge lo schermo, non sostituisce
 * l'accesso. Se lo sblocco non riesce si puo' sempre uscire dall'account.
 * Plugin: @capgo/capacitor-native-biometric (Capacitor 8).
 */

import { isNativa } from './nativa';

export const CHIAVE_PREFERENZA = 'crm_sblocco_biometrico';
export const GRAZIA_MS = 60_000;

export type TipoSblocco = 'Face ID' | 'Touch ID' | 'impronta' | 'riconoscimento del volto' | 'codice del telefono';

/** Nome da mostrare per il tipo di biometria del plugin (BiometryType). */
export function nomeSblocco(tipo: number): TipoSblocco {
  switch (tipo) {
    case 1:
      return 'Touch ID';
    case 2:
      return 'Face ID';
    case 4:
      return 'riconoscimento del volto';
    case 7:
      return 'codice del telefono';
    default:
      return 'impronta';
  }
}

/** Serve lo sblocco? All'avvio sempre (se acceso), al ritorno solo dopo la grazia. */
export function deveBloccare(o: { acceso: boolean; avvio: boolean; inBackgroundDa: number | null; ora: number }): boolean {
  if (!o.acceso) return false;
  if (o.avvio) return true;
  return o.inBackgroundDa !== null && o.ora - o.inBackgroundDa >= GRAZIA_MS;
}

async function preferenze() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function plugin() {
  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
  return NativeBiometric;
}

/** Il telefono ha Face ID, Touch ID o impronta configurati? */
export async function disponibilitaSblocco(): Promise<{ ok: boolean; nome: TipoSblocco }> {
  if (!isNativa()) return { ok: false, nome: 'impronta' };
  try {
    const r = await (await plugin()).isAvailable({ useFallback: false });
    return { ok: r.isAvailable, nome: nomeSblocco(Number(r.biometryType)) };
  } catch {
    return { ok: false, nome: 'impronta' };
  }
}

export async function sbloccoAcceso(): Promise<boolean> {
  if (!isNativa()) return false;
  try {
    return (await (await preferenze()).get({ key: CHIAVE_PREFERENZA })).value === '1';
  } catch {
    return false;
  }
}

/** Chiede il volto o l'impronta. true se riconosciuto. */
export async function verificaIdentita(motivo = 'Sblocca l’app Conflavoro'): Promise<boolean> {
  try {
    await (await plugin()).verifyIdentity({
      reason: motivo,
      title: 'Sblocca l’app',
      subtitle: motivo,
      negativeButtonText: 'Annulla',
      // Se il volto non va, il telefono propone il suo codice di sblocco.
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Accende lo sblocco solo dopo una verifica riuscita (cosi' si sa che funziona). */
export async function accendiSblocco(): Promise<boolean> {
  const d = await disponibilitaSblocco();
  if (!d.ok) return false;
  if (!(await verificaIdentita('Conferma per usare lo sblocco'))) return false;
  await (await preferenze()).set({ key: CHIAVE_PREFERENZA, value: '1' });
  avvisa();
  return true;
}

export async function spegniSblocco(): Promise<void> {
  if (!isNativa()) return;
  await (await preferenze()).remove({ key: CHIAVE_PREFERENZA }).catch(() => undefined);
  avvisa();
}

const ascoltatori = new Set<() => void>();
function avvisa(): void {
  ascoltatori.forEach((f) => f());
}
/** Cambio della preferenza (per il blocco gia' montato). */
export function ascoltaSblocco(f: () => void): () => void {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
