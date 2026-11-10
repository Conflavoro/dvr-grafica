'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { Cpu, KeyRound, Database, Mail, ShieldCheck, Server, AlertTriangle } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

interface ConfigItem {
  category: string;
  name: string;
  value: string;
  status: 'connected' | 'pending' | 'disabled';
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  note?: string;
}

const CONFIG: ConfigItem[] = [
  // AI / RAG
  { category: 'AI & RAG', name: 'Modello primario', value: 'Claude Sonnet 4.6 (claude-sonnet-4-6)', status: 'connected', icon: IconaAi, note: '$3/M input · $15/M output' },
  { category: 'AI & RAG', name: 'Embeddings', value: 'Voyage AI voyage-3-large (1024 dim)', status: 'connected', icon: Cpu, note: 'Batch 128, $0.06/1M tokens' },
  { category: 'AI & RAG', name: 'Vector store', value: 'Supabase pgvector (HNSW)', status: 'pending', icon: Database, note: 'Free tier, attivazione post-cPanel' },
  { category: 'AI & RAG', name: 'Vision (planimetrie)', value: 'Claude Vision + Gemini Flash', status: 'connected', icon: Cpu },
  // Storage
  { category: 'Storage', name: 'Object storage', value: 'Cloudflare R2 (zero egress)', status: 'pending', icon: Database, note: 'Configurazione bucket post-deploy cPanel' },
  { category: 'Storage', name: 'Database relazionale', value: 'MySQL 8.0 (cPanel managed)', status: 'pending', icon: Database },
  // Comunicazioni
  { category: 'Comunicazioni', name: 'Mail transactional', value: 'Resend + cPanel SMTP fallback', status: 'pending', icon: Mail },
  // Monitoring
  { category: 'Monitoring', name: 'Error tracking', value: 'Sentry Cloud free tier', status: 'pending', icon: AlertTriangle },
  { category: 'Monitoring', name: 'AI observability', value: 'Langfuse Cloud free tier', status: 'pending', icon: IconaAi },
  // Sicurezza
  { category: 'Sicurezza', name: 'Auth multi-tenant', value: 'tymon/jwt-auth Laravel', status: 'pending', icon: ShieldCheck, note: 'Global Scope BelongsToTenant' },
  { category: 'Sicurezza', name: 'Encryption at-rest', value: 'Laravel Crypt (AES-256-GCM)', status: 'pending', icon: KeyRound, note: 'P.IVA, CF, dati sensibili' },
  { category: 'Sicurezza', name: 'Audit log immutabile', value: 'MySQL trigger + observer model', status: 'pending', icon: ShieldCheck, note: 'Hash chain SHA-256' },
];

export default function PiattaformaPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) setAllowed(can(user.role, 'platform', 'read'));
  }, [user]);

  if (allowed === null) {
    return <AppShell pageTitle="Piattaforma"><div className="card-luxury p-8 text-center text-ink-muted">Caricamento…</div></AppShell>;
  }

  if (!allowed) {
    return (
      <AppShell pageTitle="Piattaforma">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <ShieldCheck size={32} className="mx-auto text-warn-mark mb-3" />
          <h3 className="section-title text-[17px] text-warn-ink">Accesso riservato</h3>
          <p className="mt-2 text-[13px] text-ink-soft">
            La configurazione della piattaforma è gestita dallo staff Conflavoro PMI.
            Se hai bisogno di modificare AI provider, RAG store o monitoring, contatta l&apos;Admin Conflavoro.
          </p>
        </div>
      </AppShell>
    );
  }

  const categories = Array.from(new Set(CONFIG.map((c) => c.category)));

  return (
    <AppShell pageTitle="Configurazione piattaforma">
      <div className="space-y-6 animate-fade-up">
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 text-[13px] text-ink-soft">
          <div className="flex items-center gap-2 mb-2">
            <Server size={16} className="text-brand-600" />
            <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Vista Admin Conflavoro · Configurazione piattaforma</strong>
          </div>
          <p>
            Configurazione tecnica della piattaforma DVR Conflavoro PMI. Stack ibrido cPanel + cloud free tier
            (target costo €40-110/mese). Le modifiche qui impattano tutti gli studi affiliati e i loro consulenti.
          </p>
        </div>

        {categories.map((cat) => (
          <section key={cat} className="card-luxury p-5">
            <h3 className="section-title text-[17px] mb-4">{cat}</h3>
            <ul className="divide-y divide-brand-100">
              {CONFIG.filter((c) => c.category === cat).map((c) => {
                const Icon = c.icon;
                return (
                  <li key={c.name} className="flex items-start gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-muted truncate">{c.value}</p>
                      {c.note && <p className="text-[11px] text-ink-muted mt-0.5">{c.note}</p>}
                    </div>
                    <Badge variant={c.status === 'connected' ? 'success' : c.status === 'pending' ? 'warning' : 'neutral'}>
                      {c.status === 'connected' ? 'attivo' : c.status === 'pending' ? 'in attivazione' : 'disabilitato'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="card-luxury p-5 border-l-4 border-warn-mark">
          <h3 className="section-title text-[17px] text-warn-ink mb-2">Note operative</h3>
          <ul className="space-y-1.5 text-[13px] text-ink-soft list-disc pl-4">
            <li>I servizi <em>in attivazione</em> diventano operativi dopo il deploy del backend Laravel su cPanel sandbox (Pivot-4).</li>
            <li>Le AI keys (Anthropic, Voyage, Gemini) sono persistite cifrate in <code className="text-[11px] bg-brand-50 px-1 rounded">.env</code>, mai in DB.</li>
            <li>Cost monitoring AI sarà visibile nella sezione <em>Analytics aggregate</em> dopo l&apos;abilitazione della tabella <code className="text-[11px] bg-brand-50 px-1 rounded">ai_usage_log</code>.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
