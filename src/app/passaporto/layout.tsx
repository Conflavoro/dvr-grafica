import type { Metadata } from 'next';

// Pagina aperta dal QR: niente indicizzazione, niente anteprime con il token.
export const metadata: Metadata = {
  title: 'Safety Passport',
  description: 'Consultazione dei documenti di sicurezza di un’azienda con PIN.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PassaportoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
