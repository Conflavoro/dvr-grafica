'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDataSource, type Company, type Lavoratore, type OrganigrammaHSE, type RappresentanteTipo } from '@/lib/data-source';
import { useAuth } from '@/lib/use-auth';
import { can } from '@/lib/permissions';
import { CheckCircle2, Plus, X, Save, Users2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Organigramma HSE per-azienda (sez. 3 canone DVR). Ruolo-primo: ogni figura e'
 * assegnata a una sezione ESPLICITA (mai dedotta). RLS/RLST scelta obbligatoria.
 * Rileva cumulo incarichi (stesso nominativo in piu' ruoli). Persistito in
 * Company.settings.organigramma. Permission-gated (datore read-only).
 */
export function TabOrganigramma({ company, onSaved }: { company: Company; onSaved?: () => void }) {
  const { user } = useAuth();
  const editable = can(user?.role, 'companies', 'update');

  const [org, setOrg] = useState<OrganigrammaHSE>(
    () => (company.settings?.organigramma ?? {}) as OrganigrammaHSE
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);

  // Re-sincronizza lo state dai dati server:
  // - sempre al cambio di azienda (company.id diverso): resetta tutto
  // - quando i dati arrivano async (organigramma cambia sul server) MA solo se
  //   non ci sono modifiche locali non ancora salvate (dirty=false).
  // Serializzazione stabile per evitare loop da reference instability.
  const orgFromServer = useMemo(
    () => JSON.stringify(company.settings?.organigramma ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [company.id, company.settings?.organigramma]
  );

  useEffect(() => {
    setOrg((company.settings?.organigramma ?? {}) as OrganigrammaHSE);
    setDirty(false);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  useEffect(() => {
    if (dirty) return; // non sovrascrivere modifiche locali in corso
    setOrg((company.settings?.organigramma ?? {}) as OrganigrammaHSE);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFromServer]);

  // Candidati nominativi: lavoratori dell'azienda + amministratori dalla visura.
  useEffect(() => {
    let cancelled = false;
    getDataSource()
      .lavoratori.list()
      .then((list) => {
        if (cancelled) return;
        const fromWorkers = list
          .filter((l: Lavoratore) => l.company_id === company.id)
          .map((l) => `${l.cognome} ${l.nome}`.trim());
        const amm = Array.isArray(company.settings?.amministratori)
          ? (company.settings!.amministratori as Array<{ nome_cognome?: string }>)
              .map((a) => a.nome_cognome ?? '')
              .filter(Boolean)
          : [];
        setCandidates(Array.from(new Set([...fromWorkers, ...amm])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [company.id, company.settings]);

  const patch = useCallback((p: Partial<OrganigrammaHSE>) => {
    setOrg((o) => ({ ...o, ...p }));
    setDirty(true);
    setSaved(false);
  }, []);

  // Cumulo incarichi: nominativi presenti in piu' ruoli (legittimo ma da dichiarare).
  const cumuli = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    const add = (name: string | undefined, role: string) => {
      const n = (name ?? '').trim().toLowerCase();
      if (!n) return;
      if (!counts.has(n)) counts.set(n, new Set());
      counts.get(n)!.add(role);
    };
    add(org.datore_lavoro, 'Datore');
    if (!org.datore_svolge_rspp) add(org.rspp, 'RSPP');
    add(org.medico_competente, 'Medico');
    add(org.rappresentante_nominativo, org.rappresentante_tipo ?? 'RLS');
    (org.dirigenti ?? []).forEach((n) => add(n, 'Dirigente'));
    (org.preposti ?? []).forEach((n) => add(n, 'Preposto'));
    (org.addetti_antincendio ?? []).forEach((n) => add(n, 'Antincendio'));
    (org.addetti_primo_soccorso ?? []).forEach((n) => add(n, 'Primo soccorso'));
    (org.addetti_evacuazione ?? []).forEach((n) => add(n, 'Evacuazione'));
    const result: Array<{ nominativo: string; ruoli: string[] }> = [];
    counts.forEach((roles, nameLower) => {
      if (roles.size > 1) result.push({ nominativo: nameLower, ruoli: Array.from(roles) });
    });
    return result;
  }, [org]);

  const handleSave = async () => {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      // Merge con i settings esistenti (visura extra) per non perderli.
      const settings = { ...(company.settings ?? {}), organigramma: org };
      await getDataSource().companies.update(company.id, { settings });
      setDirty(false);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Nominativi candidati (datalist condivisa) */}
      <datalist id="org-candidates">
        {candidates.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Direzione e prevenzione */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Direzione e servizio di prevenzione</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Datore di lavoro" value={org.datore_lavoro} onChange={(v) => patch({ datore_lavoro: v })} disabled={!editable} />
          <div>
            <label className="label-upper">RSPP</label>
            <input
              className="input-luxury mt-1"
              list="org-candidates"
              value={org.datore_svolge_rspp ? org.datore_lavoro ?? '' : org.rspp ?? ''}
              onChange={(e) => patch({ rspp: e.target.value })}
              disabled={!editable || org.datore_svolge_rspp}
              placeholder="Nominativo RSPP"
            />
            <div className="mt-2 flex flex-wrap gap-4">
              <Check label="Il datore svolge RSPP (art. 34)" checked={!!org.datore_svolge_rspp} onChange={(c) => patch({ datore_svolge_rspp: c })} disabled={!editable} />
              {!org.datore_svolge_rspp && (
                <Check label="RSPP esterno" checked={!!org.rspp_esterno} onChange={(c) => patch({ rspp_esterno: c })} disabled={!editable} />
              )}
            </div>
          </div>
          <div>
            <Field label="Medico competente" value={org.medico_competente} onChange={(v) => patch({ medico_competente: v })} disabled={!editable || !!org.medico_non_necessario} />
            <div className="mt-2">
              <Check label="Sorveglianza sanitaria non prevista" checked={!!org.medico_non_necessario} onChange={(c) => patch({ medico_non_necessario: c })} disabled={!editable} />
            </div>
          </div>
        </div>

        {/* ASPP e consulenti esterni (art. 33) */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <ListEditor
            label="ASPP (art. 33)"
            items={org.aspp ?? []}
            onChange={(v) => patch({ aspp: v })}
            disabled={!editable}
          />
          <ConsulentiEditor
            label="Consulenti / professionisti esterni"
            items={org.consulenti_esterni ?? []}
            onChange={(v) => patch({ consulenti_esterni: v })}
            disabled={!editable}
          />
        </div>
      </div>

      {/* Rappresentante dei lavoratori: scelta ESPLICITA RLS/RLST */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-1 uppercase tracking-wider2">Rappresentante dei lavoratori</h3>
        <p className="mb-4 text-[12px] text-ink-muted">
          Scegli sempre quale: <strong>RLS</strong> eletto/designato in azienda · <strong>RLST</strong> territoriale (se in azienda non è eletto, art. 48).
        </p>
        <div className="flex flex-wrap gap-2">
          {(['RLS', 'RLST', 'assente'] as RappresentanteTipo[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={!editable}
              onClick={() => patch({ rappresentante_tipo: t })}
              className={`btn-ghost ${org.rappresentante_tipo === t ? 'border-brand-500 text-brand-700' : ''}`}
            >
              {t === 'assente' ? 'Non presente' : t}
            </button>
          ))}
        </div>
        {(org.rappresentante_tipo === 'RLS' || org.rappresentante_tipo === 'RLST') && (
          <div className="mt-4 max-w-md">
            <Field
              label={`Nominativo ${org.rappresentante_tipo}`}
              value={org.rappresentante_nominativo}
              onChange={(v) => patch({ rappresentante_nominativo: v })}
              disabled={!editable}
            />
          </div>
        )}
      </div>

      {/* Vigilanza e gerarchia */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Dirigenti e preposti</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <ListEditor label="Dirigenti" items={org.dirigenti ?? []} onChange={(v) => patch({ dirigenti: v })} disabled={!editable} />
          <ListEditor label="Preposti (art. 19)" items={org.preposti ?? []} onChange={(v) => patch({ preposti: v })} disabled={!editable} />
        </div>
      </div>

      {/* Gestione emergenze */}
      <div className="card-luxury p-6">
        <h3 className="studio-h2 mb-4 uppercase tracking-wider2">Addetti alle emergenze</h3>
        <div className="grid gap-6 sm:grid-cols-3">
          <ListEditor label="Antincendio" items={org.addetti_antincendio ?? []} onChange={(v) => patch({ addetti_antincendio: v })} disabled={!editable} />
          <ListEditor label="Primo soccorso" items={org.addetti_primo_soccorso ?? []} onChange={(v) => patch({ addetti_primo_soccorso: v })} disabled={!editable} />
          <ListEditor label="Evacuazione" items={org.addetti_evacuazione ?? []} onChange={(v) => patch({ addetti_evacuazione: v })} disabled={!editable} />
        </div>
      </div>

      {/* Cumulo incarichi */}
      {cumuli.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-warn bg-warn p-5">
          <div className="flex gap-3">
            <AlertTriangle size={20} className="shrink-0 text-warn-mark" />
            <div>
              <p className="text-[13px] font-bold text-warn-ink">Cumulo di incarichi rilevato</p>
              <p className="mt-1 text-[12px] text-warn-ink">
                Lo stesso nominativo ricopre più ruoli. È legittimo ma va dichiarato nel DVR e nelle nomine:
              </p>
              <ul className="mt-2 space-y-1 text-[12px] text-warn-ink">
                {cumuli.map((c) => (
                  <li key={c.nominativo}>
                    <span className="font-semibold capitalize">{c.nominativo}</span>: {c.ruoli.join(' + ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Barra azioni */}
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-ink-muted">
            <Users2 size={14} className="mr-1 inline" />
            L'organigramma alimenta la sezione 3 del DVR. Aggiornalo quando cambiano le nomine.
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok-ink">
                <CheckCircle2 size={14} /> Salvato
              </span>
            )}
            {error && <span className="text-[12px] text-danger-mark">{error}</span>}
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva organigramma
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label-upper">{label}</label>
      <input
        className="input-luxury mt-1"
        list="org-candidates"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Nominativo"
      />
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="accent-brand-600" />
      {label}
    </label>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  disabled,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <label className="label-upper">{label}</label>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 && <li className="text-[12px] text-ink-muted">Nessuno</li>}
        {items.map((it, i) => (
          <li key={`${it}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50/50 px-3 py-1.5 text-[13px] text-ink">
            <span>{it}</span>
            {!disabled && (
              <button type="button" className="text-ink-muted hover:text-danger-mark" aria-label={`Rimuovi ${it}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <input
            className="input-luxury"
            list="org-candidates"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Aggiungi nominativo"
          />
          <button type="button" className="btn-ghost shrink-0" onClick={addItem} aria-label={`Aggiungi a ${label}`}>
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Editor per la lista dei consulenti/professionisti esterni (art. 33).
 * Ogni voce ha un nominativo obbligatorio e un ruolo/specializzazione opzionale.
 * Usa la stessa struttura visiva di ListEditor per coerenza.
 */
function ConsulentiEditor({
  label,
  items,
  onChange,
  disabled,
}: {
  label: string;
  items: Array<{ nominativo: string; ruolo?: string }>;
  onChange: (v: Array<{ nominativo: string; ruolo?: string }>) => void;
  disabled?: boolean;
}) {
  const [draftNom, setDraftNom] = useState('');
  const [draftRuolo, setDraftRuolo] = useState('');
  const addItem = () => {
    const nom = draftNom.trim();
    if (!nom) return;
    onChange([...items, { nominativo: nom, ruolo: draftRuolo.trim() || undefined }]);
    setDraftNom('');
    setDraftRuolo('');
  };
  return (
    <div>
      <label className="label-upper">{label}</label>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 && <li className="text-[12px] text-ink-muted">Nessuno</li>}
        {items.map((it, i) => (
          <li key={`${it.nominativo}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50/50 px-3 py-1.5 text-[13px] text-ink">
            <span>
              {it.nominativo}
              {it.ruolo && <span className="ml-1.5 text-[11px] text-ink-muted">({it.ruolo})</span>}
            </span>
            {!disabled && (
              <button
                type="button"
                className="text-ink-muted hover:text-danger-mark"
                aria-label={`Rimuovi ${it.nominativo}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              className="input-luxury"
              list="org-candidates"
              value={draftNom}
              onChange={(e) => setDraftNom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="Nominativo"
            />
          </div>
          <div className="flex gap-2">
            <input
              className="input-luxury"
              value={draftRuolo}
              onChange={(e) => setDraftRuolo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="Ruolo / specializzazione (opzionale)"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={addItem} aria-label={`Aggiungi a ${label}`}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
