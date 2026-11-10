'use client';

// "Crea il tuo accesso" e "Inserisci il codice" (04 comune, stati 0 e 0b; 05 par. 1):
// email e cellulare, codice di 6 cifre via SMS, nessuna password. Google e Apple
// restano i pulsanti di Accesso; qui il ramo email e cellulare.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';
import { ROLES } from '@/lib/mock-auth';
import { useDataSource } from '@/lib/use-data-source';
import { chiediCodice, controllaRegistrazione, mascheraNumero, verificaCodice } from '@/lib/portale/accesso-api';

/**
 * `sopraModulo`: i pulsanti Google e Apple con il separatore, tra il testo e il modulo
 * (04 comune, stato 0, punti 4 e 5).
 */
export function Registrazione({ onIndietro, sopraModulo }: { onIndietro?: () => void; sopraModulo?: ReactNode }) {
  const router = useRouter();
  const ds = useDataSource();
  const [fase, setFase] = useState<'scelta' | 'otp'>('scelta');
  const [email, setEmail] = useState('');
  const [cell, setCell] = useState('');
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [canale, setCanale] = useState<{ tipo: 'sms' | 'email'; email: string | null; minuti: number }>({ tipo: 'sms', email: null, minuti: 10 });
  const campoCodice = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fase === 'otp') campoCodice.current?.focus();
  }, [fase]);

  const manda = async (nuovo: boolean) => {
    const e = controllaRegistrazione(email, cell);
    setErrore(e);
    if (e) return;
    setInvio(true);
    try {
      const esito = await chiediCodice(email.trim(), cell);
      setCanale({ tipo: esito.canale, email: esito.emailMascherata, minuti: esito.minuti });
      setCodice('');
      setFase('otp');
      setToast(nuovo ? 'Nuovo codice inviato' : esito.canale === 'email' ? 'Codice inviato per email' : 'Codice inviato via SMS');
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Codice non inviato. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  const entra = async (c: string) => {
    if (c.length !== 6 || invio) return;
    setInvio(true);
    setErrore(null);
    try {
      const esito = await verificaCodice(email.trim(), cell, c);
      setToken(esito.token);
      const user = await ds.auth.me();
      window.dispatchEvent(new Event('auth-changed'));
      router.push(!user || user.needs_onboarding ? '/onboarding' : ROLES[user.role].homePath);
    } catch (x) {
      setErrore(x instanceof Error ? x.message : "Il codice non è giusto. Controlla l'SMS e riprova.");
      setCodice('');
      setInvio(false);
    }
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    void manda(false);
  };

  return (
    <div className="mx-auto w-full max-w-[440px]">
      {toast && (
        <p role="status" className="mb-4 rounded-full bg-perla-velo px-4 py-2 text-center text-[13px] text-ink">
          {toast}
        </p>
      )}
      {fase === 'scelta' ? (
        <form onSubmit={invia} noValidate className="space-y-4">
          <p className="text-[13px] text-ink-subtle">Portale HSE · ISFOR</p>
          <h2 className="text-[32px] font-medium leading-tight tracking-[-0.03em] text-ink">Crea il tuo accesso</h2>
          <p className="text-[14px] text-ink-muted">Ti serve per attivare il servizio e, dopo, per entrare nell&apos;app. Ci vuole un minuto e non devi ricordare nessuna password.</p>
          {sopraModulo}
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-[13px] font-medium text-ink-soft">
              Email
            </label>
            <input id="reg-email" type="email" autoComplete="email" className="input-luxury" placeholder="nome@azienda.it" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-cell" className="block text-[13px] font-medium text-ink-soft">
              Cellulare
            </label>
            <div className="flex gap-2">
              <span className="grid min-h-[48px] place-items-center rounded-xl bg-perla-velo px-3 text-[15px] text-ink">+39</span>
              <input id="reg-cell" inputMode="tel" autoComplete="tel-national" className="input-luxury flex-1" placeholder="333 123 4567" value={cell} onChange={(e) => setCell(e.target.value)} />
            </div>
            <p className="text-[12.5px] text-ink-muted">Ti mandiamo un codice via SMS. Serve anche per gli avvisi delle scadenze.</p>
          </div>
          {errore && (
            <p role="alert" className="rounded-[0.875rem] bg-stato-danger px-4 py-2.5 text-[13px] text-stato-danger-ink">
              {errore}
            </p>
          )}
          <button type="submit" disabled={invio} className="btn-acido min-h-[52px] w-full text-[15px]">
            Ricevi il codice
          </button>
          <p className="text-[11.5px] text-ink-subtle">Continuando accetti le condizioni del servizio e l&apos;informativa privacy di ISFOR.</p>
          {onIndietro && (
            <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={onIndietro}>
              Ho già un accesso
            </button>
          )}
        </form>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void entra(codice);
          }}
        >
          <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => { setFase('scelta'); setErrore(null); setToast(null); }}>
            Cambia email o numero
          </button>
          <h2 className="text-[32px] font-medium leading-tight tracking-[-0.03em] text-ink">Inserisci il codice</h2>
          <p className="text-[14px] text-ink-muted">
            {canale.tipo === 'email' && canale.email
              ? `Te l'abbiamo mandato per email a ${canale.email}. Vale ${canale.minuti} minuti.`
              : `Te l'abbiamo mandato via SMS al ${mascheraNumero(cell)}. Vale ${canale.minuti} minuti.`}
          </p>
          <label htmlFor="reg-codice" className="sr-only">
            Codice di 6 cifre
          </label>
          <input
            id="reg-codice"
            ref={campoCodice}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="input-luxury h-16 text-center text-[28px] tracking-[0.5em]"
            value={codice}
            onChange={(e) => {
              const c = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCodice(c);
              // La verifica parte da sola alla sesta cifra.
              if (c.length === 6) void entra(c);
            }}
          />
          {errore && (
            <p role="alert" className="rounded-[0.875rem] bg-stato-danger px-4 py-2.5 text-[13px] text-stato-danger-ink">
              {errore}
            </p>
          )}
          <button type="submit" disabled={codice.length !== 6 || invio} className="btn-acido min-h-[52px] w-full text-[15px]">
            Entra
          </button>
          <p className="text-[13px] text-ink-muted">
            Non è arrivato?{' '}
            <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => void manda(true)}>
              Mandalo di nuovo
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
