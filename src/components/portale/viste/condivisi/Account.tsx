'use client';

// Il tuo account: profilo, documenti legali, uscita e cancellazione dell'account
// (richiesta di App Store e Google Play: si cancella dall'app, senza mail o telefonate).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Scheda } from '../../kit';
import { ApiError, apiRequest, setToken } from '@/lib/api';
import { roleLabel } from '@/lib/permissions';
import { useDataSource } from '@/lib/use-data-source';
import { pulisciAllUscita } from '@/lib/app/uscita';
import { QuestoTelefono } from '@/components/app/QuestoTelefono';
import { Sicurezza } from './Sicurezza';

export const PAROLA_CONFERMA = 'ELIMINA';

export function messaggioErrore(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as { message?: unknown } | null;
    if (b && typeof b.message === 'string' && b.message.trim() !== '') return b.message;
    if (e.status === 0) return 'Non riesco a raggiungere il server. Controlla la connessione e riprova.';
  }
  return 'Non sono riuscito a cancellare l\'account. Riprova tra poco.';
}

export function Account() {
  const { user } = usePortale();
  const ds = useDataSource();
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  const confermato = testo.trim() === PAROLA_CONFERMA;

  const esci = async () => {
    try {
      await ds.auth.logout();
    } finally {
      router.push('/');
    }
  };

  const elimina = async () => {
    if (!confermato || invio) return;
    setInvio(true);
    setErrore(null);
    try {
      await apiRequest('/account', { method: 'DELETE', body: { conferma: PAROLA_CONFERMA } });
      setToken(null);
      await pulisciAllUscita();
      window.dispatchEvent(new Event('auth-changed'));
      setFatto(true);
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInvio(false);
    }
  };

  if (fatto) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-6">
        <h1 className="text-[28px] font-medium tracking-[-0.03em] text-ink">Account eliminato</h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          I tuoi dati personali sono stati cancellati e gli accessi da tutti i dispositivi sono chiusi. I documenti
          delle aziende restano allo studio che li gestisce, come previsto dalla legge sulla sicurezza sul lavoro.
        </p>
        <button type="button" className="btn-primary h-12 w-full sm:w-auto" onClick={() => router.replace('/')}>
          Chiudi
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-[30px] font-medium tracking-[-0.03em] text-ink">Il tuo account</h1>

      <Scheda titolo="Profilo">
        <dl className="grid gap-3 text-[15px] sm:grid-cols-[9rem_1fr]">
          <dt className="text-ink-muted">Nome</dt>
          <dd className="min-w-0 break-words text-ink">{user.name}</dd>
          <dt className="text-ink-muted">Email</dt>
          <dd className="min-w-0 break-all text-ink">{user.email}</dd>
          <dt className="text-ink-muted">Ruolo</dt>
          <dd className="text-ink">{roleLabel(user.role)}</dd>
        </dl>
      </Scheda>

      <Scheda titolo="Documenti">
        <ul className="divide-y divide-perla-linea">
          <li>
            <Link href="/privacy/" className="flex min-h-[48px] items-center text-[15px] text-ink underline-offset-4 hover:underline">
              Informativa sulla privacy
            </Link>
          </li>
          <li>
            <Link href="/termini/" className="flex min-h-[48px] items-center text-[15px] text-ink underline-offset-4 hover:underline">
              Termini di servizio
            </Link>
          </li>
        </ul>
      </Scheda>

      <QuestoTelefono />

      <h2 className="pt-2 text-[20px] font-medium text-ink">Sicurezza</h2>
      <Sicurezza titolare={user.role === 'datore_lavoro'} />

      <Scheda titolo="Sessione">
        <button type="button" className="btn-ghost h-12 w-full sm:w-auto" onClick={() => void esci()}>
          Esci da questo dispositivo
        </button>
      </Scheda>

      <Scheda titolo="Elimina il mio account" sotto="L'operazione non si può annullare.">
        {!aperto ? (
          <button
            type="button"
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium text-danger-ink shadow-[inset_0_0_0_1px_#ffcfc7] hover:bg-danger sm:w-auto"
            onClick={() => setAperto(true)}
          >
            Elimina il mio account
          </button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void elimina();
            }}
          >
            <ul className="list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-ink-muted">
              <li>Nome, email e accessi con Google o Apple vengono cancellati.</li>
              <li>Esci da tutti i telefoni e i computer, e non ricevi più notifiche.</li>
              <li>Le tue conversazioni con l'assistente vengono cancellate.</li>
              <li>
                I documenti delle aziende (DVR, scadenze, registri) restano allo studio che li gestisce: servono per legge
                e non sono dati tuoi personali.
              </li>
            </ul>
            <div>
              <label htmlFor="conferma-elimina" className="block text-[14px] font-medium text-ink">
                Per confermare scrivi {PAROLA_CONFERMA}
              </label>
              <input
                id="conferma-elimina"
                className="input-luxury mt-1.5 h-12 w-full"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby={errore ? 'errore-elimina' : undefined}
              />
            </div>
            {errore && (
              <p id="errore-elimina" role="alert" className="rounded-xl bg-danger px-4 py-3 text-[14px] leading-relaxed text-danger-ink">
                {errore}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={!confermato || invio}
                className="h-12 rounded-xl bg-danger-mark px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {invio ? 'Elimino l\'account' : 'Elimina definitivamente'}
              </button>
              <button
                type="button"
                className="btn-ghost h-12"
                onClick={() => {
                  setAperto(false);
                  setTesto('');
                  setErrore(null);
                }}
              >
                Annulla
              </button>
            </div>
          </form>
        )}
      </Scheda>
    </div>
  );
}
