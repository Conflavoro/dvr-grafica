'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/use-auth';
import { useDataSource } from '@/lib/use-data-source';
import { roleLabel } from '@/lib/permissions';
import { AgenteStudioImpostazioni } from '@/components/agente/AgenteStudioImpostazioni';
import { RiquadroLogo } from '@/components/portale/RiquadroLogo';
import { User as UserIcon, KeyRound, ShieldCheck, LogOut, Copy, Check, Building2 } from 'lucide-react';

export default function ImpostazioniPage() {
  const { user, loading } = useAuth();
  const ds = useDataSource();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await ds.auth.logout();
    } finally {
      router.push('/');
    }
  };

  const copyStudioCode = async (): Promise<void> => {
    if (!user?.studio_code) return;
    try {
      await navigator.clipboard.writeText(user.studio_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard non disponibile: l'utente puo' selezionare il codice manualmente */
    }
  };

  if (loading) {
    return (
      <AppShell pageTitle="Impostazioni">
        <div className="card-luxury p-8 text-center text-ink-muted">Caricamento…</div>
      </AppShell>
    );
  }

  // Accesso diretto all'URL senza sessione: senza questo la pagina restituiva
  // null e l'utente vedeva una schermata BIANCA invece del rientro al login
  // (le altre pagine sono protette dalla guardia dentro AppShell).
  if (!user) {
    return (
      <AppShell pageTitle="Impostazioni">
        <div className="card-luxury p-8 text-center text-ink-muted">Sessione non attiva. Torna alla pagina di accesso.</div>
      </AppShell>
    );
  }

  const isTitolare = user.role === 'titolare_studio';
  const isDatore = user.role === 'datore_lavoro';

  return (
    <AppShell pageTitle="Impostazioni">
      <div className="space-y-5 animate-fade-up">
        <p className="max-w-3xl text-[14px] text-ink-soft">
          Il tuo profilo, i dati dello studio o dell&apos;azienda, l&apos;agente dello studio e la gestione della sessione.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {/* ---- PROFILO ---- */}
          <section className="card-luxury p-6">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <UserIcon size={18} />
              </span>
              <h2 className="section-title text-[17px]">Profilo</h2>
            </header>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="label-upper">Nome</dt>
                <dd className="mt-0.5 font-semibold text-ink">{user.name}</dd>
              </div>
              <div>
                <dt className="label-upper">Email</dt>
                <dd className="mt-0.5 font-semibold text-ink">{user.email}</dd>
              </div>
              <div>
                <dt className="label-upper">Ruolo</dt>
                <dd className="mt-0.5 font-semibold text-ink">{roleLabel(user.role)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] text-ink-muted">
              Per modificare nome o email contatta l&apos;amministratore dello studio.
            </p>
          </section>

          {/* ---- STUDIO / AZIENDA ---- */}
          {(isTitolare || isDatore) && (
            <section className="card-luxury p-6">
              <header className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Building2 size={18} />
                </span>
                <h2 className="section-title text-[17px]">{isTitolare ? 'Studio' : 'Azienda'}</h2>
              </header>

              <dl className="space-y-3 text-[13px]">
                {user.tenant_name && (
                  <div>
                    <dt className="label-upper">{isTitolare ? 'Ragione sociale studio' : 'Ragione sociale'}</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{user.tenant_name}</dd>
                  </div>
                )}
                {user.tenant_vat && (
                  <div>
                    <dt className="label-upper">P.IVA</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink">{user.tenant_vat}</dd>
                  </div>
                )}
                {isDatore && user.tenant_ateco && (
                  <div>
                    <dt className="label-upper">Codice ATECO</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink">{user.tenant_ateco}</dd>
                  </div>
                )}
              </dl>

              {/* Codice studio condivisibile (solo titolare) */}
              {isTitolare && user.studio_code && (
                <div className="mt-5 rounded-xl border-2 border-brand-200 bg-brand-50/60 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound size={15} className="text-brand-600" />
                    <span className="label-upper text-brand-700">Codice studio</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    Condividilo con i tuoi consulenti: lo inseriscono in registrazione per unirsi allo studio.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="select-all rounded-lg bg-ink/5 px-3 py-2 font-mono text-[15px] font-semibold tracking-wide text-ink">
                      {user.studio_code}
                    </code>
                    <button
                      type="button"
                      onClick={copyStudioCode}
                      className="btn-ghost"
                      aria-label="Copia codice studio"
                    >
                      {copied ? <Check size={14} className="text-ok-mark" /> : <Copy size={14} />}
                      {copied ? 'Copiato' : 'Copia'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ---- SICUREZZA ---- */}
          <section className="card-luxury p-6">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ShieldCheck size={18} />
              </span>
              <h2 className="section-title text-[17px]">Sicurezza</h2>
            </header>
            <ul className="space-y-3 text-[13px]">
              <li className="flex items-center justify-between">
                <span>Autenticazione a due fattori</span>
                <span className={user.mfa_enabled ? 'font-semibold text-ok-mark' : 'font-semibold text-warn-mark'}>
                  {user.mfa_enabled ? 'Attiva' : 'Non attiva'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Crittografia at-rest dati sensibili</span>
                <span className="font-semibold text-ok-mark">Attiva</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Audit log immutabile</span>
                <span className="font-semibold text-ok-mark">Attivo</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Multi-tenant isolation (RLS)</span>
                <span className="font-semibold text-ok-mark">Attivo</span>
              </li>
            </ul>
          </section>

          {/* ---- SESSIONE ---- */}
          <section className="card-luxury p-6">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <LogOut size={18} />
              </span>
              <h2 className="section-title text-[17px]">Sessione</h2>
            </header>
            <p className="text-[13px] text-ink-soft">
              Esci dalla piattaforma su questo dispositivo. Dovrai effettuare nuovamente l&apos;accesso.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-primary mt-4 disabled:opacity-60"
            >
              <LogOut size={15} /> {loggingOut ? 'Uscita…' : 'Esci'}
            </button>
          </section>

          {/* ---- LOGO DELLO STUDIO NEI DOCUMENTI (titolare e staff Conflavoro) ---- */}
          {(isTitolare || user.role === 'admin_conflavoro') && (
            <div className="md:col-span-2">
              <RiquadroLogo tipo="studio" />
            </div>
          )}

          {/* ---- AGENTE DELLO STUDIO ---- */}
          <AgenteStudioImpostazioni />
        </div>
      </div>
    </AppShell>
  );
}
