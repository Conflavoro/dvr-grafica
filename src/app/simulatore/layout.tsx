import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Simulatore di costo della sicurezza sul lavoro',
  description: 'Quanto spendi a preventivo e quanto con l’abbonamento: obblighi, costi e risparmio in un minuto, con Falco.',
};

export default function SimulatoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
