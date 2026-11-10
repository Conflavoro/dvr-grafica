'use client';

import { AppShell } from '@/components/layout/AppShell';
import type { ReactNode } from 'react';

interface PageStubProps {
  title: string;
  intro?: string;
  children?: ReactNode;
}

/**
 * Pagina demo placeholder. Usata per sezioni che hanno UI minima nella demo
 * pubblica e verranno completate quando il backend Laravel reale sara' connesso.
 */
export function PageStub({ title, intro, children }: PageStubProps) {
  return (
    <AppShell pageTitle={title}>
      <div className="space-y-6 animate-fade-up">
        {intro && (
          <p className="max-w-3xl text-[14px] text-ink-soft">{intro}</p>
        )}
        {children ?? (
          <div className="card-luxury p-10 text-center">
            <p className="label-upper">Modulo in attivazione</p>
            <p className="mt-3 text-[15px] text-ink-soft">
              Questa sezione verra' popolata con dati reali appena la piattaforma
              sara' collegata al backend.
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              Demo · Documento generato con assistenza AI · D.Lgs. 81/08
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
