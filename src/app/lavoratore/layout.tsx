import type { Metadata } from 'next';

// Link personale del lavoratore: niente indicizzazione, niente anteprime con il token.
export const metadata: Metadata = {
  title: 'I miei appuntamenti',
  description: 'Visite e corsi di sicurezza sul lavoro: date, luoghi e cosa portare.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function LavoratoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
