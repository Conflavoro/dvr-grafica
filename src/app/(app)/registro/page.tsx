'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { EntityListView, type EntityListConfig } from '@/components/registro/EntityListView';
import {
  lavoratoriConfig,
  dpiConfig,
  attrezzatureConfig,
  formazioneConfig,
} from '@/components/registro/configs';
import { useAuth } from '@/lib/use-auth';
import { canImport } from '@/lib/permissions';
import { Upload, Users, HardHat, Wrench, GraduationCap } from 'lucide-react';

type TabKey = 'lavoratori' | 'dpi' | 'attrezzature' | 'formazione';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: EntityListConfig<any>;
}

const TABS: TabDef[] = [
  { key: 'lavoratori', label: 'Lavoratori', icon: <Users size={15} />, config: lavoratoriConfig },
  { key: 'dpi', label: 'DPI', icon: <HardHat size={15} />, config: dpiConfig },
  { key: 'attrezzature', label: 'Attrezzature', icon: <Wrench size={15} />, config: attrezzatureConfig },
  { key: 'formazione', label: 'Formazione', icon: <GraduationCap size={15} />, config: formazioneConfig },
];

function RegistroContent() {
  const params = useSearchParams();
  const { user } = useAuth();
  const initial = (params.get('tab') as TabKey) || 'lavoratori';
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initial) ? initial : 'lavoratori'
  );

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const showImport = canImport(user?.role, active.config.entity);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-soft">
        Anagrafiche operative dell&apos;azienda in un unico posto: lavoratori, DPI, attrezzature e
        formazione. Seleziona una scheda per consultare o importare.
      </p>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Sezioni del registro aziendale"
          className="flex flex-wrap gap-1 rounded-full border border-brand-200 bg-white/60 p-1"
        >
          {TABS.map((t) => {
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-wider2 transition-all duration-150',
                  isActive
                    ? 'bg-brand-gradient text-white shadow-luxury-sm'
                    : 'text-ink-muted hover:text-ink hover:bg-white',
                ].join(' ')}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {showImport && (
          <Link href={active.config.importPath} className="btn-primary">
            <Upload size={16} /> Import massivo
          </Link>
        )}
      </div>

      {/* La toolbar di import del singolo view e' nascosta: c'e' gia' qui sopra. */}
      <div role="tabpanel" key={active.key}>
        <EntityListView config={active.config} hideImportButton />
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <AppShell pageTitle="Registro aziendale">
      <Suspense fallback={<div className="card-luxury p-10 text-center text-ink-muted">Caricamento…</div>}>
        <RegistroContent />
      </Suspense>
    </AppShell>
  );
}
