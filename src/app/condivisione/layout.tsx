import type { Metadata } from 'next';

// Pagina aperta dal link di condivisione: niente indicizzazione, niente anteprime con il token.
export const metadata: Metadata = {
  title: 'Documenti condivisi',
  description: 'Consultazione in sola lettura dei documenti di sicurezza condivisi da un’azienda.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function CondivisioneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
