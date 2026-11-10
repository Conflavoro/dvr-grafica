import type { Metadata } from 'next';

// Link dell'invito: niente indicizzazione, niente anteprime con il token.
export const metadata: Metadata = {
  title: 'Attiva il tuo accesso',
  description: 'Crea la password per entrare nell’area della tua azienda.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function InvitoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
