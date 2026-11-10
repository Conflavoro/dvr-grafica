'use client';

import { AppShell } from '@/components/layout/AppShell';
import { EntityListView } from '@/components/registro/EntityListView';
import { lavoratoriConfig } from '@/components/registro/configs';

export default function LavoratoriPage() {
  return (
    <AppShell pageTitle="Lavoratori">
      <EntityListView config={lavoratoriConfig} />
    </AppShell>
  );
}
