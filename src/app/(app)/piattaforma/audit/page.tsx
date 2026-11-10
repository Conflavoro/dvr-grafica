'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { ShieldCheck, FileText } from 'lucide-react';

interface AuditEntry {
  id: number;
  ts: string;
  actor: string;
  tenant: string;
  action: string;
  entity: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}

// Mock audit (in produzione: query a `audit_log` MySQL trigger-protected,
// hash chain SHA-256, append-only)
const AUDIT_DEMO: AuditEntry[] = [];

export default function AuditPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) setAllowed(can(user.role, 'platform', 'read'));
  }, [user]);

  if (allowed === null) {
    return <AppShell pageTitle="Audit"><div className="card-luxury p-8 text-center text-ink-muted">Caricamento…</div></AppShell>;
  }

  if (!allowed) {
    return (
      <AppShell pageTitle="Audit">
        <div className="card-luxury p-8 text-center max-w-xl mx-auto animate-fade-up">
          <ShieldCheck size={32} className="mx-auto text-warn-mark mb-3" />
          <h3 className="section-title text-[17px] text-warn-ink">Accesso riservato</h3>
          <p className="mt-2 text-[13px] text-ink-soft">
            L&apos;audit di sistema cross-tenant è visibile solo al Super Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Audit di sistema">
      <div className="space-y-5 animate-fade-up">
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 text-[13px] text-ink-soft">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-brand-600" />
            <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Audit log immutabile</strong>
          </div>
          <p>
            Ogni operazione critica (creazione/modifica DVR, cambio ruolo utente, accesso admin, export PII)
            è registrata in audit log append-only con hash chain SHA-256. Trigger MySQL impedisce modifiche
            anche al DBA (defense-in-depth). Visibile solo al Super Admin per compliance GDPR.
          </p>
        </div>

        {AUDIT_DEMO.length === 0 ? (
          <div className="card-luxury p-12 text-center">
            <FileText size={36} className="mx-auto text-brand-500 mb-3" />
            <h3 className="section-title text-[17px]">Audit log vuoto</h3>
            <p className="mt-2 text-[13px] text-ink-muted">
              Le entry audit verranno popolate automaticamente al primo deploy del backend Laravel (post-cPanel).
              Lo schema è già pronto: trigger MySQL <code className="text-[11px] bg-brand-50 px-1 rounded">audit_log_immutable</code>,
              hash chain, observer model defense-in-depth.
            </p>
          </div>
        ) : (
          <div className="card-luxury overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] min-w-[760px]">
              <thead className="bg-brand-50/40">
                <tr className="border-b border-brand-100 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Attore</th>
                  <th className="px-4 py-3 font-semibold">Azione</th>
                  <th className="px-4 py-3 font-semibold">Entità</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {AUDIT_DEMO.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-muted">{e.ts}</td>
                    <td className="px-4 py-3 text-ink">{e.tenant}</td>
                    <td className="px-4 py-3 text-ink">{e.actor}</td>
                    <td className="px-4 py-3 text-ink">{e.action}</td>
                    <td className="px-4 py-3 text-ink">{e.entity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.severity === 'critical' ? 'danger' : e.severity === 'warning' ? 'warning' : 'neutral'}>
                        {e.severity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
