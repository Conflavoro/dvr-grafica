import { percorso } from '@/lib/percorso';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StrisciaDemo } from '@/components/demo/StrisciaDemo';
import { AvvioApp } from '@/components/app/AvvioApp';

export const metadata: Metadata = {
  title: 'Conflavoro Agente HSE',
  description:
    "Falco, l'agente Conflavoro per la sicurezza sul lavoro: DVR, POS, PSC, DUVRI, formazione, scadenze, sopralluoghi e normativa (D.Lgs. 81/08).",
  applicationName: 'Conflavoro Agente HSE',
  keywords: ['agente HSE', 'sicurezza lavoro', 'DVR', 'POS', 'DUVRI', 'D.Lgs. 81/08', 'RSPP', 'Conflavoro'],
  authors: [{ name: 'Conflavoro PMI' }],
  icons: { icon: percorso('/brand/falco-mark.svg') },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <StrisciaDemo />
        <AvvioApp />
        {children}
      </body>
    </html>
  );
}
