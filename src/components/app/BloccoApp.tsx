'use client';

// Blocco con Face ID, Touch ID o impronta (facoltativo, solo app nativa): copre
// l'app all'apertura e al ritorno dopo un minuto in background, finche' il
// telefono non riconosce la persona. Si puo' sempre uscire dall'account.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isNativa } from '@/lib/app/nativa';
import { ascoltaSblocco, deveBloccare, disponibilitaSblocco, sbloccoAcceso, verificaIdentita, type TipoSblocco } from '@/lib/app/sblocco';
import { useDataSource } from '@/lib/use-data-source';

export function BloccoApp() {
  const ds = useDataSource();
  const router = useRouter();
  const [bloccato, setBloccato] = useState(false);
  const [nome, setNome] = useState<TipoSblocco>('Face ID');
  const [prova, setProva] = useState(false);
  const acceso = useRef(false);
  const fuoriDa = useRef<number | null>(null);

  const sblocca = useCallback(async () => {
    setProva(true);
    try {
      if (await verificaIdentita()) setBloccato(false);
    } finally {
      setProva(false);
    }
  }, []);

  useEffect(() => {
    if (!isNativa()) return;
    let vivo = true;
    const leggi = () =>
      sbloccoAcceso().then((a) => {
        acceso.current = a;
        if (!a) setBloccato(false);
        return a;
      });
    void leggi().then((a) => {
      if (!vivo) return;
      if (deveBloccare({ acceso: a, avvio: true, inBackgroundDa: null, ora: Date.now() })) {
        setBloccato(true);
        void disponibilitaSblocco().then((d) => setNome(d.nome));
        void sblocca();
      }
    });
    const togli = ascoltaSblocco(() => void leggi());
    let rimuovi: (() => void) | null = null;
    void import('@capacitor/app').then(async ({ App }) => {
      const h = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          fuoriDa.current = Date.now();
          return;
        }
        if (deveBloccare({ acceso: acceso.current, avvio: false, inBackgroundDa: fuoriDa.current, ora: Date.now() })) {
          setBloccato(true);
          void sblocca();
        }
        fuoriDa.current = null;
      });
      if (vivo) rimuovi = () => void h.remove();
      else void h.remove();
    });
    return () => {
      vivo = false;
      togli();
      rimuovi?.();
    };
  }, [sblocca]);

  if (!bloccato) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="App bloccata" className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-grafite-950 px-6 text-center text-white">
      <p className="text-[24px] font-medium tracking-[-0.02em]">App bloccata</p>
      <p className="max-w-[32ch] text-[15px] leading-relaxed text-grafite-300">Per continuare conferma che sei tu con {nome}.</p>
      <button type="button" className="h-12 min-w-[14rem] rounded-xl bg-white px-5 text-[15px] font-medium text-ink disabled:opacity-60" disabled={prova} onClick={() => void sblocca()}>
        Sblocca con {nome}
      </button>
      <button
        type="button"
        className="h-12 px-4 text-[14px] text-grafite-300 underline-offset-4 hover:underline"
        onClick={() => {
          void ds.auth.logout().finally(() => {
            setBloccato(false);
            router.replace('/');
          });
        }}
      >
        Esci dall’account
      </button>
    </div>
  );
}
