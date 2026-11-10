'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/use-auth';
import { ragSearch, ragCorpusSize, RAG_SUGGESTIONS, type RagResult } from '@/lib/rag-local';
import { Search, BookOpen, ShieldCheck, GraduationCap, AlertTriangle, FileText } from 'lucide-react';
import { Lame as IconaAi } from '@/components/icone';

const TYPE_LABELS: Record<RagResult['type'], string> = {
  scheda_rischio: 'Scheda rischio',
  normativa: 'Normativa',
  formazione: 'Formazione',
  pericolo: 'Pericolo TUSL',
  rischio_tipico: 'Rischio tipico',
};

const TYPE_ICONS: Record<RagResult['type'], typeof BookOpen> = {
  scheda_rischio: ShieldCheck,
  normativa: BookOpen,
  formazione: GraduationCap,
  pericolo: AlertTriangle,
  rischio_tipico: FileText,
};

export default function KbPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RagResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (query.trim().length >= 2) setResults(ragSearch(query, 20));
    else setResults([]);
  }, [query]);

  // Senza sessione la pagina restituiva null = schermata BIANCA.
  // Passiamo dalla shell, che ha la guardia e riporta al login.
  if (!user) {
    return <AppShell pageTitle="Knowledge base"><div className="card-luxury p-8 text-center text-ink-muted">Sessione non attiva.</div></AppShell>;
  }

  const corpus = ragCorpusSize();

  return (
    <AppShell pageTitle="Catalogo normativo">
      <div className="space-y-5 animate-fade-up">
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-5 text-[13px] text-ink-soft">
          <div className="flex items-center gap-2 mb-2">
            <IconaAi size={16} className="text-brand-600" />
            <strong className="text-brand-700 uppercase tracking-wider2 text-[11px]">Knowledge base normativa</strong>
          </div>
          <p>
            Cerca nel corpus normativo locale: <strong>{corpus.schede}</strong> schede rischio dettaglio,{' '}
            <strong>{corpus.normative}</strong> norme citate, <strong>{corpus.formazione}</strong> corsi formazione,{' '}
            <strong>{corpus.pericoli}</strong> pericoli del D.Lgs. 81/08, <strong>{corpus.rischi}</strong> rischi tipici
            con P×G di partenza. La ricerca funziona sempre, anche offline. Il RAG vettoriale completo su Supabase
            pgvector con Voyage embeddings sarà attivo a deploy backend completato.
          </p>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            autoFocus
            placeholder="Cerca art. 28, rumore, caduta dall'alto, DPI imbragatura, formazione antincendio."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-luxury pl-12 text-base sm:text-[15px] py-4"
          />
        </div>

        {query.trim().length < 2 && (
          <section className="card-luxury p-5">
            <p className="label-upper mb-3">Suggerimenti di ricerca</p>
            <div className="flex flex-wrap gap-2">
              {RAG_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {query.trim().length >= 2 && results.length === 0 && (
          <div className="card-luxury p-10 text-center text-ink-muted">
            Nessun risultato per <strong className="text-ink">{query}</strong>. Prova con un termine più generale o sinonimo.
          </div>
        )}

        {results.length > 0 && (
          <p className="text-[13px] text-ink-muted"><strong className="text-ink">{results.length}</strong> risultati per <em>{query}</em>.</p>
        )}

        <div className="space-y-3">
          {results.map((r) => {
            const Icon = TYPE_ICONS[r.type];
            const isExpanded = expanded.has(r.id);
            return (
              <article key={r.id} className="card-luxury p-5">
                <header className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand">{TYPE_LABELS[r.type]}</Badge>
                      <span className="text-[10px] uppercase tracking-wider2 text-ink-muted">{r.source}</span>
                    </div>
                    <h3 className="mt-1.5 text-[15px] font-bold text-ink">{r.title}</h3>
                    <p className="mt-2 text-[13px] text-ink-soft">{r.snippet}</p>
                    {isExpanded && r.full !== r.snippet && (
                      <p className="mt-3 text-[12px] text-ink-muted whitespace-pre-line border-t border-brand-100 pt-3">{r.full}</p>
                    )}
                    {r.full !== r.snippet && r.full.length > 200 && (
                      <button
                        onClick={() => setExpanded((s) => {
                          const next = new Set(s);
                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                          return next;
                        })}
                        className="mt-2 text-[11px] font-semibold uppercase tracking-wider2 text-brand-600 hover:text-brand-700"
                      >
                        {isExpanded ? 'Mostra meno' : 'Leggi tutto'}
                      </button>
                    )}
                  </div>
                </header>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
