'use client';

import { AppShell } from '@/components/layout/AppShell';
import { EntityListView } from '@/components/registro/EntityListView';
import { dpiConfig } from '@/components/registro/configs';

export default function DpiPage() {
  return (
    <AppShell pageTitle="Catalogo DPI">
      <EntityListView config={dpiConfig} />
    </AppShell>
  );
}
