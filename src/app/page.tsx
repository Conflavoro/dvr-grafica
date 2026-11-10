'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider } from '@/components/auth/GoogleAuthProvider';
import { Accesso, type ModoAccesso } from '@/components/auth/Accesso';
import { PaginaSimulatore } from '@/components/simulatore/PaginaSimulatore';
import { useAuth } from '@/lib/use-auth';
import { ROLES } from '@/lib/mock-auth';

/**
 * Ingresso dell'app. Chi non ha ancora scelto trova il Falco con il simulatore
 * di costo: capisce di cosa si tratta e quanto spenderebbe. Chi ha già un
 * account entra da "Entra"; se da questo browser è già entrato, l'accesso si
 * apre subito (come anche con /?entra=1, usato dalla pagina del simulatore).
 */

const GIA_ENTRATO = 'crm_dvr_ha_accesso';

export default function IngressoPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [apri, setApri] = useState(false);
  const [modo, setModo] = useState<ModoAccesso>('accedi');

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      // ?crea=1 apre "Crea il tuo accesso" (dal simulatore pubblico e dai link dei venditori).
      if (q.get('crea') === '1') setModo('crea');
      setApri(q.get('crea') === '1' || q.get('entra') === '1' || window.localStorage.getItem(GIA_ENTRATO) === '1');
    } catch {
      /* comodità del browser */
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      try {
        window.localStorage.setItem(GIA_ENTRATO, '1');
      } catch {
        /* comodità del browser */
      }
      // role puo' essere null (utente Google appena creato): in tal caso onboarding.
      const dest = user.needs_onboarding || !user.role ? '/onboarding' : ROLES[user.role].homePath;
      router.replace(dest);
    }
  }, [user, loading, router]);

  return (
    <GoogleAuthProvider>
      <PaginaSimulatore accesso={(m) => <Accesso modoIniziale={m} />} accessoAperto={apri} modoAperto={modo} />
    </GoogleAuthProvider>
  );
}
