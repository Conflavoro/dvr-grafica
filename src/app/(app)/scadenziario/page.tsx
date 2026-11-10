'use client';

import { AppShell } from '@/components/layout/AppShell';
import { EntityListView } from '@/components/registro/EntityListView';
import { scadenzeConfig } from '@/components/registro/configs';

export default function ScadenziarioPage() {
  return (
    <AppShell pageTitle="Scadenziario">
      <EntityListView config={scadenzeConfig} />
    </AppShell>
  );
}
