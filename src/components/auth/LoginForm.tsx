'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ROLES } from '@/lib/mock-auth';
import { useDataSource } from '@/lib/use-data-source';
import { isApiMode } from '@/lib/data-source';
import { setToken } from '@/lib/api';
import { entraConPassword, secondoPassaggio, type EsitoAccesso } from '@/lib/portale/accesso-api';
import type { User } from '@/lib/data-source/types';

/**
 * Email e password. Nel gestionale (06 par. 2.3) il server puo' chiedere il
 * secondo passaggio: codice di 6 cifre dall'app di autenticazione, da
 * configurare al primo accesso se non e' ancora attivo.
 */
export function LoginForm() {
  const router = useRouter();
  const ds = useDataSource();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sfida, setSfida] = useState<EsitoAccesso | null>(null);
  const [codice, setCodice] = useState('');

  const vai = (user: User | null) => {
    if (!user) throw new Error('Accesso non riuscito. Riprova.');
    window.dispatchEvent(new Event('auth-changed'));
    // Primo accesso senza profilo -> onboarding. Altrimenti home del ruolo.
    router.push(user.needs_onboarding ? '/onboarding' : ROLES[user.role].homePath);
  };

  const esegui = (fn: () => Promise<void>) => {
    setError(null);
    setSubmitting(true);
    void fn().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Errore inatteso durante il login. Riprova.');
      setSubmitting(false);
    });
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    esegui(async () => {
      if (!isApiMode()) {
        vai(await ds.auth.login(email, password));
        return;
      }
      const esito = await entraConPassword(email, password);
      if (esito.sfida) {
        setSfida(esito);
        setSubmitting(false);
        return;
      }
      setToken(esito.token);
      vai(await ds.auth.me());
    });
  };

  const inviaCodice = (e: FormEvent): void => {
    e.preventDefault();
    if (!sfida?.sfida || codice.length !== 6) return;
    esegui(async () => {
      const esito = await secondoPassaggio(sfida.sfida!, codice);
      setToken(esito.token);
      vai(await ds.auth.me());
    });
  };

  if (sfida) {
    return (
      <form onSubmit={inviaCodice} className="space-y-4" noValidate>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => { setSfida(null); setCodice(''); setError(null); }}>
          Indietro
        </button>
        {sfida.configura ? (
          <div className="space-y-2 rounded-[0.875rem] bg-perla-velo px-4 py-3 text-[13.5px] text-ink-soft">
            <p className="font-medium text-ink">Attiva l&apos;app di autenticazione</p>
            <p>Aggiungi questo account nell&apos;app di autenticazione con la chiave qui sotto, poi scrivi il codice di 6 cifre.</p>
            <p className="break-all font-mono text-[13px] text-ink">{sfida.segreto}</p>
          </div>
        ) : (
          <p className="text-[14px] text-ink-muted">Scrivi il codice di 6 cifre dell&apos;app di autenticazione.</p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="codice" className="block text-[13px] font-medium text-ink-soft">
            Codice di 6 cifre
          </label>
          <input
            id="codice"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={codice}
            onChange={(e) => setCodice(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-luxury text-center tracking-[0.5em]"
            placeholder="••••••"
          />
        </div>
        {error && (
          <div role="alert" className="rounded-[0.875rem] bg-stato-danger px-4 py-2.5 text-[13px] text-stato-danger-ink">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting || codice.length !== 6} className="btn-primary min-h-[52px] w-full text-[15px]">
          {submitting ? 'Accesso in corso' : 'Entra'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[13px] font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-luxury"
          placeholder="nome@studio.it"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[13px] font-medium text-ink-soft">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-luxury"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[0.875rem] bg-stato-danger px-4 py-2.5 text-[13px] text-stato-danger-ink"
        >
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary min-h-[52px] w-full text-[15px]">
        {submitting ? 'Accesso in corso' : 'Accedi'}
      </button>
    </form>
  );
}
