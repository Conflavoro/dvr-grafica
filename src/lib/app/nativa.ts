// Riconoscimento dell'app nativa (Capacitor) e archivio del token.
//
// Sul web il token resta in localStorage come prima. Nell'app il token vive in
// Preferences (UserDefaults su iOS, SharedPreferences su Android), fuori dal
// localStorage della WebView, che il sistema puo' svuotare: al primo avvio si
// carica in memoria una volta sola e da li' getToken() resta sincrono.

import { Capacitor } from '@capacitor/core';

export type Piattaforma = 'ios' | 'android' | 'web';

export function isNativa(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function piattaforma(): Piattaforma {
  try {
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
}

/** Interfaccia minima dell'archivio: Preferences in nativo, finto nei test. */
export interface ArchivioChiavi {
  get(chiave: string): Promise<string | null>;
  set(chiave: string, valore: string): Promise<void>;
  remove(chiave: string): Promise<void>;
}

async function archivioPreferences(): Promise<ArchivioChiavi> {
  const { Preferences } = await import('@capacitor/preferences');
  return {
    get: async (key) => (await Preferences.get({ key })).value,
    set: (key, value) => Preferences.set({ key, value }),
    remove: (key) => Preferences.remove({ key }),
  };
}

/**
 * Token in memoria con copia nell'archivio nativo. Su web non si usa.
 */
export class TokenNativo {
  private valore: string | null = null;
  private modificato = false;
  private pronto: Promise<void> | null = null;

  constructor(
    private readonly chiave: string,
    private readonly archivio: () => Promise<ArchivioChiavi> = archivioPreferences
  ) {}

  /** Carica il token salvato (una volta); le chiamate successive restituiscono la stessa attesa. */
  carica(): Promise<void> {
    if (!this.pronto) {
      this.pronto = (async () => {
        try {
          const a = await this.archivio();
          const salvato = await a.get(this.chiave);
          // Un setToken arrivato durante il caricamento vince sul valore salvato.
          if (!this.modificato) this.valore = salvato;
        } catch {
          // Archivio non disponibile: si resta senza sessione, mai bloccati.
        }
      })();
    }
    return this.pronto;
  }

  leggi(): string | null {
    return this.valore;
  }

  scrivi(token: string | null): void {
    this.valore = token;
    this.modificato = true;
    void this.archivio()
      .then((a) => (token === null ? a.remove(this.chiave) : a.set(this.chiave, token)))
      .catch(() => undefined);
  }
}
