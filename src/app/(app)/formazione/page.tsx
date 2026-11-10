'use client';

import { AppShell } from '@/components/layout/AppShell';
import { EntityListView } from '@/components/registro/EntityListView';
import { formazioneConfig } from '@/components/registro/configs';

export default function FormazionePage() {
  return (
    <AppShell pageTitle="Formazione">
      <EntityListView config={formazioneConfig} />
    </AppShell>
  );
}
