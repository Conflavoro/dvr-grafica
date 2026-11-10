'use client';

import { Giu, Luogo, Spunta } from '@/components/icone';
import { clsx } from '@/lib/clsx';

/**
 * Sedi dell'azienda nel guscio (03: selettore della sede sul computer, "Dove vuoi lavorare?"
 * sul telefono). CONTRATTO PER S2: il backend aggiunge a ogni azienda di /portale/aziende il
 * campo `sedi` con questa forma; il guscio legge `sediDi(azienda)` e passa la sede scelta alle
 * viste con usePortale().sede (null = Tutte le sedi). Un utente limitato a una sola sede riceve
 * solo quella e il selettore resta fermo su di essa.
 */
export interface SedePortale {
  id: number;
  /** Nome breve mostrato (es. "Sede di Lucca"). */
  nome: string;
  indirizzo?: string | null;
  /** Insegna, se diversa dalla ragione sociale. */
  insegna?: string | null;
  /** Sede alimentare: almeno una accende HACCP (06 §3). */
  alimentare?: boolean;
}

/** Legge le sedi dall'azienda del portale senza dipendere dalla sua forma attuale. */
export function sediDi(azienda: unknown): SedePortale[] {
  const v = (azienda as { sedi?: unknown } | null)?.sedi;
  if (!Array.isArray(v)) return [];
  return v
    .map((x): SedePortale | null => {
      const r = x as Record<string, unknown>;
      const id = Number(r?.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        nome: String(r.nome ?? r.insegna ?? `Sede ${id}`),
        indirizzo: typeof r.indirizzo === 'string' ? r.indirizzo : null,
        insegna: typeof r.insegna === 'string' ? r.insegna : null,
        alimentare: r.alimentare === true,
      };
    })
    .filter((s): s is SedePortale => s !== null);
}

/** Sedi alimentari dell'azienda: dal conteggio del backend (sedi_alimentari) o dalle sedi. */
export function sediAlimentariDi(azienda: unknown): number | null {
  const n = (azienda as { sedi_alimentari?: unknown } | null)?.sedi_alimentari;
  if (typeof n === 'number') return n;
  const sedi = sediDi(azienda);
  return sedi.length ? sedi.filter((s) => s.alimentare).length : null;
}

/** Fascicolo completo (dato di S5 o S2: campo fascicolo_completo dell'azienda). */
export function fascicoloCompletoDi(azienda: unknown): boolean | null {
  const v = (azienda as { fascicolo_completo?: unknown } | null)?.fascicolo_completo;
  return typeof v === 'boolean' ? v : null;
}

/** Selettore della sede nella barra in alto del computer: solo per aziende con più sedi. */
export function SelettoreSede({ sedi, scelta, onScegli }: { sedi: SedePortale[]; scelta: number | null; onScegli: (id: number | null) => void }) {
  if (sedi.length < 2) return null;
  return (
    <label className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-3.5 pr-9 text-small font-medium text-fg shadow-[inset_0_0_0_1.5px_var(--hse-line)] hover:shadow-[inset_0_0_0_1.5px_var(--hse-fg-faint)]">
      <Luogo size={17} aria-hidden className="text-fg-muted" />
      <span className="sr-only">Sede</span>
      <select
        value={scelta ?? ''}
        onChange={(e) => onScegli(e.target.value ? Number(e.target.value) : null)}
        className="max-w-[14rem] appearance-none truncate bg-transparent pr-1 focus:outline-none"
      >
        <option value="">Tutte le sedi</option>
        {sedi.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <Giu size={16} aria-hidden className="pointer-events-none absolute right-3.5 text-fg-muted" />
    </label>
  );
}

/** Corpo del foglio "Dove vuoi lavorare?" (telefono): aziende dell'utente e, sotto, le sedi. */
export function DoveLavorare({
  aziende,
  aziendaId,
  onAzienda,
  sedi,
  sede,
  onSede,
}: {
  aziende: Array<{ id: number; ragione_sociale: string }>;
  aziendaId: number | null;
  onAzienda: (id: number) => void;
  sedi: SedePortale[];
  sede: number | null;
  onSede: (id: number | null) => void;
}) {
  const voce = (attiva: boolean, titolo: string, sotto: string | null | undefined, onClick: () => void, chiave: string) => (
    <li key={chiave}>
      <button type="button" onClick={onClick} aria-pressed={attiva} className={clsx('tocco flex min-h-[56px] w-full items-center gap-3 rounded-hse-lg px-4 text-left', attiva ? 'bg-sunken' : 'hover:bg-sunken')}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-fg">{titolo}</span>
          {sotto && <span className="block truncate text-small text-fg-muted">{sotto}</span>}
        </span>
        {attiva && <Spunta size={18} aria-hidden />}
      </button>
    </li>
  );
  return (
    <div className="space-y-5">
      {aziende.length > 1 && (
        <section>
          <h3 className="mb-2 text-caption uppercase text-fg-muted">Aziende</h3>
          <ul className="space-y-1">{aziende.map((a) => voce(a.id === aziendaId, a.ragione_sociale, null, () => onAzienda(a.id), `a${a.id}`))}</ul>
        </section>
      )}
      {sedi.length > 1 && (
        <section>
          <h3 className="mb-2 text-caption uppercase text-fg-muted">Sedi</h3>
          <ul className="space-y-1">
            {voce(sede === null, 'Tutte le sedi', null, () => onSede(null), 'tutte')}
            {sedi.map((s) => voce(s.id === sede, s.nome, s.indirizzo, () => onSede(s.id), `s${s.id}`))}
          </ul>
        </section>
      )}
    </div>
  );
}
