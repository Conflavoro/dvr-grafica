'use client';

import { AppShell } from '@/components/layout/AppShell';
import { EntityListView } from '@/components/registro/EntityListView';
import { attrezzatureConfig } from '@/components/registro/configs';

export default function AttrezzaturePage() {
  return (
    <AppShell pageTitle="Attrezzature">
      <EntityListView config={attrezzatureConfig} />
    </AppShell>
  );
}
