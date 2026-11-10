'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';
import { azzeraDemo, caricaIndice, scegliProfilo, type ProfiloDemo } from '@/lib/demo/intercetta';

const GRUPPI: Array<{ app: ProfiloDemo['app']; titolo: string; sotto: string }> = [
  { app: 'gestionale', titolo: 'Studio', sotto: 'Il gestionale dei tecnici HSE' },
  { app: 'azienda', titolo: 'Azienda cliente', sotto: 'L’area dell’azienda, per ruolo' },
  { app: 'lavoratore', titolo: 'Lavoratore', sotto: 'Il link personale, senza account' },
];

/** Accesso della versione dimostrativa: si entra scegliendo un profilo, senza password. */
export function DemoAccesso() {
  const router = useRouter();
  const [profili, setProfili] = useState<ProfiloDemo[] | null>(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    caricaIndice()
      .then((i) => setProfili(i.profili))
      .catch(() => setErrore(true));
  }, []);

  const entra = (p: ProfiloDemo) => {
    scegliProfilo(p.chiave);
    if (p.app !== 'lavoratore') setToken(`demo-${p.chiave}`);
    window.dispatchEvent(new Event('auth-changed'));
    router.replace(p.destinazione);
  };

  return (
    <div>
      <h2 className="text-[40px] font-medium leading-tight tracking-[-0.03em] text-ink">Entra come</h2>
      <p className="mb-6 mt-1.5 text-[14px] text-ink-muted">Scegli un profilo: vedi la piattaforma con i suoi dati e i suoi permessi. Nessuna password.</p>
      {errore && <p className="text-[14px] text-danger-ink">Non riesco a caricare i profili della dimostrazione. Ricarica la pagina.</p>}
      {!profili && !errore && <p className="text-[14px] text-ink-muted">Carico i profili…</p>}
      {profili &&
        GRUPPI.map((g) => {
          const del = profili.filter((p) => p.app === g.app);
          if (del.length === 0) return null;
          return (
            <section key={g.app} className="mb-6">
              <p className="text-[12px] font-medium tracking-[0.06em] text-ink-subtle">{g.titolo.toUpperCase()}</p>
              <p className="mb-2 text-[13px] text-ink-muted">{g.sotto}</p>
              <ul className="overflow-hidden rounded-[1.25rem] border border-perla-linea">
                {del.map((p) => (
                  <li key={p.chiave} className="border-b border-perla-linea last:border-b-0">
                    <button type="button" onClick={() => entra(p)} className="flex min-h-[60px] w-full flex-col items-start justify-center px-4 py-3 text-left hover:bg-perla-velo/60 focus-visible:bg-perla-velo/60">
                      <span className="text-[15px] font-medium text-ink">{p.nome}</span>
                      <span className="text-[13px] text-ink-muted">{p.ruolo} · {p.descrizione}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      <button
        type="button"
        onClick={() => {
          azzeraDemo();
          window.location.reload();
        }}
        className="text-[13px] text-ink-muted underline decoration-grafite-300 underline-offset-2"
      >
        Riporta la dimostrazione all’inizio
      </button>
    </div>
  );
}
