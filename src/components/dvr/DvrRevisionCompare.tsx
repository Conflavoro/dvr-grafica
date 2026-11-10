'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { DvrRevisionDetail } from '@/lib/data-source';
import { compareRevisions, type ParagraphOp } from '@/lib/dvr-revisions';

interface Props {
  older: DvrRevisionDetail;
  current: DvrRevisionDetail;
}

/** Paragrafi invariati consecutivi oltre questa soglia vengono raccolti. */
const CONTEXT_KEEP = 1;

type Block =
  | { kind: 'op'; op: ParagraphOp }
  | { kind: 'gap'; id: number; items: string[] };

/** Raggruppa i paragrafi invariati lontani dalle differenze. */
function toBlocks(ops: ParagraphOp[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let gapId = 0;
  while (i < ops.length) {
    if (ops[i].type !== 'same') {
      blocks.push({ kind: 'op', op: ops[i] });
      i++;
      continue;
    }
    let j = i;
    while (j < ops.length && ops[j].type === 'same') j++;
    const run = ops.slice(i, j);
    const head = i === 0 ? 0 : CONTEXT_KEEP;
    const tail = j === ops.length ? 0 : CONTEXT_KEEP;
    if (run.length > head + tail + 1) {
      run.slice(0, head).forEach((op) => blocks.push({ kind: 'op', op }));
      blocks.push({ kind: 'gap', id: gapId++, items: run.slice(head, run.length - tail).map((o) => o.text) });
      run.slice(run.length - tail).forEach((op) => blocks.push({ kind: 'op', op }));
    } else {
      run.forEach((op) => blocks.push({ kind: 'op', op }));
    }
    i = j;
  }
  return blocks;
}

function OpLine({ op }: { op: ParagraphOp }) {
  if (op.type === 'removed') {
    return (
      <p className="whitespace-pre-wrap break-words rounded-lg border-l-4 border-danger bg-danger px-3 py-1.5 text-[13px] text-danger-ink">
        <span className="sr-only">Testo tolto: </span>
        <del className="decoration-danger-mark">{op.text}</del>
      </p>
    );
  }
  if (op.type === 'added') {
    return (
      <p className="whitespace-pre-wrap break-words rounded-lg border-l-4 border-ok-mark bg-ok px-3 py-1.5 text-[13px] text-ok-ink">
        <span className="sr-only">Testo aggiunto: </span>
        <ins className="no-underline">{op.text}</ins>
      </p>
    );
  }
  return <p className="whitespace-pre-wrap break-words px-3 py-1 text-[13px] text-ink-muted">{op.text}</p>;
}

function SectionDiff({ ops }: { ops: ParagraphOp[] }) {
  const blocks = useMemo(() => toBlocks(ops), [ops]);
  const [openGaps, setOpenGaps] = useState<Set<number>>(new Set());
  return (
    <div className="space-y-1.5">
      {blocks.map((b, idx) =>
        b.kind === 'op' ? (
          <OpLine key={idx} op={b.op} />
        ) : openGaps.has(b.id) ? (
          b.items.map((t, n) => <OpLine key={`${idx}-${n}`} op={{ type: 'same', text: t }} />)
        ) : (
          <button
            key={idx}
            type="button"
            onClick={() => setOpenGaps((prev) => new Set(prev).add(b.id))}
            className="w-full rounded-lg border border-dashed border-brand-200 px-3 py-2 text-left text-[12px] text-ink-muted hover:bg-brand-50/50"
          >
            {b.items.length === 1 ? 'Mostra 1 paragrafo invariato' : `Mostra ${b.items.length} paragrafi invariati`}
          </button>
        )
      )}
    </div>
  );
}

/** Confronto tra una revisione precedente e la corrente, sezione per sezione. */
export function DvrRevisionCompare({ older, current }: Props) {
  const diffs = useMemo(() => compareRevisions(older, current), [older, current]);

  if (diffs.length === 0) {
    return (
      <p className="rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-2.5 text-[13px] text-ink-soft">
        Il testo della revisione {older.numero} è identico a quello della revisione corrente.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
        <span>
          {diffs.length === 1 ? '1 sezione diversa' : `${diffs.length} sezioni diverse`} tra la revisione {older.numero} e la
          corrente ({current.numero}).
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-danger bg-danger" aria-hidden="true" /> testo della rev. {older.numero}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-ok-mark bg-ok" aria-hidden="true" /> testo attuale
        </span>
      </div>
      {diffs.map((d) => (
        <article key={d.key} className="rounded-xl border border-brand-100 bg-white/70 p-3">
          <header className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-brand-50 px-1.5 text-[11px] font-bold text-brand-700">
              {d.key}
            </span>
            <h5 className="text-[14px] font-semibold text-ink">{d.title || `Sezione ${d.key}`}</h5>
            {d.stato === 'aggiunta' && <Badge variant="success">Sezione nuova</Badge>}
            {d.stato === 'rimossa' && <Badge variant="danger">Non più presente</Badge>}
          </header>
          {d.titoloCambiato && d.before && d.after && (
            <p className="mb-2 text-[12px] text-ink-muted">
              Titolo cambiato: prima era «{d.before.title}».
            </p>
          )}
          <SectionDiff ops={d.ops} />
        </article>
      ))}
    </div>
  );
}
