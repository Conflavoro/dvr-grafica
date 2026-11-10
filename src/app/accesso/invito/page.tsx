'use client';

/**
 * Accettazione dell'invito (pagina pubblica): il link dell'email apre
 * /accesso/invito/?t=<token>. Mostra a chi e per quale azienda e' l'invito,
 * fa scegliere la password (almeno 12 caratteri, lettere e numeri) e fa
 * entrare subito nell'area dell'azienda. Solo query string (export statico).
 */

import { percorso } from '@/lib/percorso';
import { useEffect, useState } from 'react';
import { setToken } from '@/lib/api';
import { isApiMode } from '@/lib/data-source';
import { TOKEN_INVITO, accettaInvito, controllaPassword, mostraInvito, type Invito } from '@/lib/portale/azienda-account-api';
import { Avviso, CerchioSpunta } from '@/components/icone';

type Stato = { fase: 'carico' } | { fase: 'errore'; testo: string } | { fase: 'pronto'; v: Invito } | { fase: 'entro' };

export default function PaginaInvito() {
  const [token, setTok] = useState('');
  const [stato, setStato] = useState<Stato>({ fase: 'carico' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [mostra, setMostra] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
    setTok(t);
    if (!TOKEN_INVITO.test(t)) {
      setStato({ fase: 'errore', testo: 'Il link non è completo. Aprilo di nuovo dall’email o chiedi un nuovo invito.' });
      return;
    }
    if (!isApiMode()) {
      setStato({ fase: 'errore', testo: 'Il servizio non è raggiungibile in questo momento. Riprova tra poco.' });
      return;
    }
    mostraInvito(t)
      .then((v) => setStato({ fase: 'pronto', v }))
      .catch((e: unknown) => setStato({ fase: 'errore', testo: e instanceof Error ? e.message : 'Invito non trovato.' }));
  }, []);

  const entra = async () => {
    const e = controllaPassword(pw, pw2);
    if (e) return setErrore(e);
    setErrore(null);
    setInvio(true);
    try {
      const jwt = await accettaInvito(token, pw);
      setToken(jwt);
      setStato({ fase: 'entro' });
      window.dispatchEvent(new Event('auth-changed'));
      window.location.replace(percorso('/azienda/dashboard/'));
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Accesso non riuscito.');
      setInvio(false);
    }
  };

  return (
    <main className="min-h-dvh bg-perla-velo px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[440px]">
        <p className="text-[13px] text-ink-muted">Portale HSE · Conflavoro</p>
        {stato.fase === 'carico' && <p className="mt-6 text-[15px] text-ink-muted" role="status">Controllo l’invito</p>}

        {stato.fase === 'errore' && (
          <section className="mt-4 rounded-[1.75rem] bg-white p-6 shadow-[inset_0_0_0_1px_#e2e2e5]">
            <Avviso size={26} aria-hidden className="text-[#a86800]" />
            <h1 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink">L’invito non si può usare</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{stato.testo}</p>
            <a href={percorso('/')} className="btn-primary mt-6 w-full">
              Vai all’accesso
            </a>
          </section>
        )}

        {stato.fase === 'entro' && (
          <section className="mt-4 rounded-[1.75rem] bg-white p-6 text-center shadow-[inset_0_0_0_1px_#e2e2e5]">
            <span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-oro-500 text-acido-950">
              <CerchioSpunta size={30} />
            </span>
            <p className="mt-4 text-[20px] font-medium text-ink">Accesso attivato</p>
            <p className="mt-1 text-[14px] text-ink-muted">Entro nell’area della tua azienda.</p>
          </section>
        )}

        {stato.fase === 'pronto' && (
          <section className="mt-4 rounded-[1.75rem] bg-white p-6 shadow-[inset_0_0_0_1px_#e2e2e5]">
            <h1 className="text-[28px] font-medium leading-tight tracking-[-0.025em] text-ink">Ciao {stato.v.nome.split(' ')[0] || ''}, attiva il tuo accesso</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {stato.v.studio ? `${stato.v.studio} ti ha invitato` : 'Sei stato invitato'} nell’area di <strong className="font-medium text-ink">{stato.v.azienda}</strong> come {stato.v.etichetta.toLowerCase()}.
            </p>
            <dl className="mt-5 space-y-1 rounded-[1rem] bg-perla-velo px-4 py-3 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Email</dt>
                <dd className="min-w-0 truncate text-ink">{stato.v.email}</dd>
              </div>
              {stato.v.scadeIl && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Invito valido fino al</dt>
                  <dd className="text-ink">{new Date(stato.v.scadeIl).toLocaleDateString('it-IT')}</dd>
                </div>
              )}
            </dl>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void entra();
              }}
            >
              <input type="email" autoComplete="username" value={stato.v.email} readOnly hidden />
              <label className="block">
                <span className="mb-1.5 block text-[13.5px] font-medium text-ink">Scegli la password</span>
                <input type={mostra ? 'text' : 'password'} autoComplete="new-password" className="input-field" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={200} />
                <span className="mt-1 block text-[12.5px] text-ink-muted">Almeno 12 caratteri, con lettere e numeri.</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13.5px] font-medium text-ink">Ripeti la password</span>
                <input type={mostra ? 'text' : 'password'} autoComplete="new-password" className="input-field" value={pw2} onChange={(e) => setPw2(e.target.value)} maxLength={200} />
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-[14px] text-ink-soft">
                <input type="checkbox" checked={mostra} onChange={(e) => setMostra(e.target.checked)} className="h-5 w-5" /> Mostra la password
              </label>
              {errore && (
                <p role="alert" className="rounded-[1rem] bg-stato-danger px-4 py-3 text-[14px] text-stato-danger-ink">
                  {errore}
                </p>
              )}
              <button type="submit" className="btn-acido w-full" disabled={invio}>
                {invio ? 'Attivo l’accesso' : 'Attiva ed entra'}
              </button>
            </form>
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
              Il link vale una volta sola. Dopo entri con la tua email e questa password dalla pagina di accesso.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
