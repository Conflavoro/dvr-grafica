import type { Metadata } from 'next';

// Pagina aperta dal link "Carica il PSC": niente indicizzazione, niente anteprime con il token.
export const metadata: Metadata = {
  title: 'Carica il PSC',
  description: 'Caricamento del Piano di sicurezza e coordinamento per il tecnico che segue il cantiere.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PscLayout({ children }: { children: React.ReactNode }) {
  return children;
}
