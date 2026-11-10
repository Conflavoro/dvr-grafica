'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PortaleShell, etichettaRuolo, usePortale } from '../PortaleShell';
import { Pastiglia, Scheda, Testata } from '../kit';
import { PaginaNotifiche } from '../Campanella';
import { useContatori, useRiassunti } from '../telefono/stato';
import { clsx } from '@/lib/clsx';
import { VISTE } from './registro';
import { ISPEZIONI_AZIENDA, SEZIONI_AZIENDA, TESTATA, gruppi, opzioniAzienda, percorso, sezioniVisibili, trovaSezione, type AppPortale, type Sezione } from '@/lib/portale/sezioni';
import { suggerimenti as caricaSuggerimenti, type Suggerimento } from '@/lib/portale/api';
import { CruscottoAzienda } from '@/components/agente/CruscottoAzienda';
import { Avanti, Campanella as IconaCampanella, ScudoAllerta } from '@/components/icone';
import { Account } from './condivisi/Account';

/** Pagina di una sezione: guscio comune e vista della sezione (registro), o lavoro guidato dal Falco. */
export function PaginaPortale({ app, sezione }: { app: AppPortale; sezione: string }) {
  return (
    <PortaleShell app={app} sezione={sezione}>
      <Contenuto app={app} sezione={sezione} />
    </PortaleShell>
  );
}

/**
 * Area azienda: una sezione che il ruolo non vede (per esempio la Dashboard per il consulente
 * del lavoro o il medico) non si apre, si passa alla prima sezione del ruolo. Senza questo la
 * pagina chiamava rotte vietate e restava a metà.
 */
function Contenuto({ app, sezione }: { app: AppPortale; sezione: string }) {
  const { azienda, user } = usePortale();
  const router = useRouter();
  const vietata =
    app === 'azienda' &&
    !!azienda &&
    SEZIONI_AZIENDA.some((s) => s.chiave === sezione) &&
    !sezioniVisibili(app, { ruolo: user.role, permessi: azienda.permessi ?? [], ...opzioniAzienda(azienda) }).some((s) => s.chiave === sezione);
  const prima =
    vietata && azienda ? sezioniVisibili(app, { ruolo: user.role, permessi: azienda.permessi ?? [], ...opzioniAzienda(azienda) })[0] : undefined;
  useEffect(() => {
    if (vietata) router.replace(prima ? percorso(app, prima.chiave) : '/azienda/tutto/');
  }, [vietata, prima, app, router]);
  if (vietata) return null;
  return <ContenutoSezione app={app} sezione={sezione} />;
}

function ContenutoSezione({ app, sezione }: { app: AppPortale; sezione: string }) {
  if (sezione === 'tutto') return <Tutto app={app} />;
  if (sezione === 'account') return <Account />;
  if (sezione === 'notifiche') return <PaginaNotifiche app={app} />;
  const Vista = VISTE[`${app}.${sezione}`];
  if (Vista) return <Vista />;
  if (app === 'azienda' && sezione === 'dashboard') return <DashboardAzienda />;
  const s = trovaSezione(app, sezione);
  return s ? <SezioneFalco s={s} /> : <Tutto app={app} />;
}

function DashboardAzienda() {
  const { azienda, chiedi, user } = usePortale();
  if (!azienda) return null;
  const ora = new Date().getHours();
  const saluto = ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] text-ink-muted first-letter:uppercase">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-[30px] font-medium leading-tight tracking-[-0.03em] text-ink sm:text-[40px]">
          {saluto}, {user.name.split(' ')[0]}
        </h1>
      </div>
      <CruscottoAzienda aziendaId={azienda.id} nome={azienda.ragione_sociale} disabled={false} onChiedi={chiedi} />
    </div>
  );
}

/** Sezione ancora senza schermata dedicata: il Falco della sezione propone cosa fare. */
export function SezioneFalco({ s }: { s: Sezione }) {
  const { app, azienda, aziendaScelta, chiedi, versione } = usePortale();
  const [voci, setVoci] = useState<Suggerimento[]>([]);
  const aziendaId = azienda?.id ?? aziendaScelta?.id ?? null;
  useEffect(() => {
    if (!s.falco) return;
    caricaSuggerimenti(s.falco, aziendaId, null)
      .then(setVoci)
      .catch(() => setVoci([]));
  }, [s.falco, aziendaId, versione]);
  return (
    <div className="space-y-5">
      <Testata categoria={s.categoria} icona={s.icona} sopra={app === 'azienda' ? azienda?.ragione_sociale : aziendaScelta?.ragione_sociale ?? s.gruppo ?? undefined} titolo={s.titolo} />
      <Scheda titolo="Cosa possiamo fare" sotto="Chiedilo al Falco di questa sezione: lavora sui dati veri e ti mostra il risultato.">
        {voci.length === 0 ? (
          <p className="text-[14px] text-ink-muted">Scrivi o detta al Falco cosa ti serve.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {voci.map((v) => (
              <li key={v.etichetta}>
                <button type="button" onClick={() => chiedi(v.richiesta)} className="flex min-h-[52px] w-full items-center gap-3 rounded-[1rem] px-4 text-left text-[14.5px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
                  <span className="min-w-0 flex-1">{v.etichetta}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Scheda>
    </div>
  );
}

/** Gruppi delle tessere di Tutto sul telefono (04-schermate/telefono, Tutto). */
const GRUPPI_TUTTO: Array<{ titolo: string; chiavi: string[] }> = [
  { titolo: 'Sicurezza', chiavi: ['scadenze', 'formazione', 'visite', 'antincendio', 'primosoccorso', 'infortuni', 'documenti'] },
  { titolo: 'Servizi e conti', chiavi: ['servizi', 'contratto', 'wallet'] },
  { titolo: 'Azienda', chiavi: ['persone', 'utenti', 'avvio', 'messaggi'] },
];

function Tutto({ app }: { app: AppPortale }) {
  const { user, azienda, puo, sedi, sede } = usePortale();
  const telefono = useTelefono();
  const contatori = useContatori();
  const riassunti = useRiassunti();
  const visibili = sezioniVisibili(app, { ruolo: user.role, permessi: app === 'azienda' ? azienda?.permessi ?? [] : null, telefono, ...(app === 'azienda' ? opzioniAzienda(azienda) : {}) });
  if (app !== 'azienda' || !telefono) return <TuttoElenco app={app} />;
  const perChiave = new Map(visibili.map((s) => [s.chiave, s]));
  const sedeScelta = sedi.find((x) => x.id === sede);
  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-[2.125rem] font-medium leading-[1.05] tracking-[-0.025em] text-fg">Tutto</h1>
        {azienda && <p className="mt-1 text-small text-fg-muted">{azienda.ragione_sociale}</p>}
      </div>
      {puo(ISPEZIONI_AZIENDA.permesso!) && (
        <Link href="/azienda/ispezioni/" className="tocco flex items-center gap-3 rounded-[24px] bg-black p-3 pr-4 text-white">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acid-400 text-acid-950">
            <ScudoAllerta size={20} />
          </span>
          <span className="min-w-0 flex-1 text-title">Pronto Ispezioni</span>
          <Avanti size={18} aria-hidden className="text-grafite-400" />
        </Link>
      )}
      {GRUPPI_TUTTO.map((g) => {
        const voci = g.chiavi.map((k) => perChiave.get(k)).filter((s): s is Sezione => !!s);
        if (!voci.length) return null;
        return (
          <section key={g.titolo}>
            <h2 className="mb-2 text-caption uppercase text-fg-muted">{g.titolo}</h2>
            <ul className="grid grid-cols-2 gap-3">
              {voci.map((s) => {
                const r = riassunti[s.chiave];
                const n = contatori[s.chiave] ?? 0;
                const numero = r ? String(r.numero) : null;
                return (
                  <li key={s.chiave}>
                    <Link href={percorso(app, s.chiave)} className={clsx('tocco flex h-full flex-col overflow-hidden rounded-[24px] bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]', r && 'min-h-[8.5rem]')}
                    >
                      <span className={clsx('flex items-center gap-2 px-3 py-2.5', TESTATA[s.categoria])}>
                        <s.icona size={16} aria-hidden />
                        <span className="min-w-0 flex-1 text-small font-medium leading-tight">{s.titolo}</span>
                        {n > 0 && (
                          <span className="cifre grid h-5 min-w-5 place-items-center rounded-full bg-black px-1.5 text-[10px] font-semibold text-acid-400">
                            {n}
                            <span className="sr-only"> da vedere</span>
                          </span>
                        )}
                      </span>
                      {r && (
                      <span className="flex flex-1 flex-col justify-end px-3 pb-3 pt-2">
                        {numero !== null && (
                          <span className={clsx('cifre font-light text-fg', numero.length > 4 ? 'text-h2' : 'text-h1')}>
                            {numero}
                            {r?.unita && <span className="ml-0.5 text-small text-fg-muted">{r.unita}</span>}
                          </span>
                        )}
                        <span className="text-caption text-fg-muted">{r.etichetta}</span>
                      </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <section>
        <h2 className="mb-2 text-caption uppercase text-fg-muted">Account</h2>
        <div className="overflow-hidden rounded-hse-lg shadow-[inset_0_0_0_1px_var(--hse-line)]">
          {azienda && (
            <button type="button" onClick={() => document.dispatchEvent(new CustomEvent('portale-dove'))} className="tocco flex min-h-[64px] w-full items-center gap-3 border-b border-line px-4 py-3 text-left">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-grafite-900 text-caption font-semibold text-white">
                {iniziali(azienda.ragione_sociale)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-fg">{azienda.ragione_sociale}</span>
                <span className="block truncate text-small text-fg-muted">
                  {sedi.length > 1 ? (sedeScelta ? `Sede di ${sedeScelta.nome}` : `${sedi.length} sedi`) : etichettaRuoli(azienda.ruoli)}
                </span>
              </span>
              <Avanti size={16} aria-hidden className="text-fg-faint" />
            </button>
          )}
          <Link href={`/${app}/account/`} className="tocco flex min-h-[64px] items-center gap-3 border-b border-line px-4 py-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-caption font-semibold text-fg">
              {iniziali(user.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-fg">{user.name}</span>
              <span className="block truncate text-small text-fg-muted">{[etichettaRuoli(azienda?.ruoli ?? []), user.email].filter(Boolean).join(' · ')}</span>
            </span>
            <Avanti size={16} aria-hidden className="text-fg-faint" />
          </Link>
          <Link href={`/${app}/notifiche/`} className="tocco flex min-h-[64px] items-center gap-3 px-4 py-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-fg">
              <IconaCampanella size={18} />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-medium text-fg">Notifiche</span>
            <Avanti size={16} aria-hidden className="text-fg-faint" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function iniziali(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'U';
}

function etichettaRuoli(ruoli: string[]): string {
  return ruoli.map(etichettaRuolo).join(', ');
}

/** Telefono o computer (soglia 1024 px, come il guscio). */
function useTelefono(): boolean {
  const [v, setV] = useState(true);
  useEffect(() => {
    try {
      const mq = window.matchMedia('(min-width: 1024px)');
      setV(!mq.matches);
      const f = (e: MediaQueryListEvent) => setV(!e.matches);
      mq.addEventListener?.('change', f);
      return () => mq.removeEventListener?.('change', f);
    } catch {
      return undefined;
    }
  }, []);
  return v;
}

function TuttoElenco({ app }: { app: AppPortale }) {
  const { user, azienda } = usePortale();
  const visibili = sezioniVisibili(app, { ruolo: user.role, permessi: app === 'azienda' ? azienda?.permessi ?? [] : null, ...(app === 'azienda' ? opzioniAzienda(azienda) : {}) });
  return (
    <div className="space-y-6">
      <h1 className="text-[30px] font-medium tracking-[-0.03em] text-ink">Tutte le sezioni</h1>
      {gruppi(visibili).map((g, i) => (
        <section key={`${g.titolo}-${i}`}>
          {g.titolo && <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">{g.titolo}</h2>}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {g.voci.map((s) => (
              <li key={s.chiave}>
                <Link href={percorso(app, s.chiave)} className="flex min-h-[60px] items-center gap-3 rounded-[1.25rem] px-3 shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
                  <Pastiglia categoria={s.categoria} icona={s.icona} />
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{s.titolo}</span>
                  <Avanti size={16} aria-hidden className="text-grafite-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.08em] text-ink-muted">Account</h2>
        <Link href={`/${app}/account/`} className="flex min-h-[60px] items-center gap-3 rounded-[1.25rem] px-4 shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">{user.name}</span>
            <span className="block truncate text-[13px] text-ink-muted">Profilo, privacy, uscita e cancellazione dell'account</span>
          </span>
          <Avanti size={16} aria-hidden className="text-grafite-400" />
        </Link>
      </section>
    </div>
  );
}
