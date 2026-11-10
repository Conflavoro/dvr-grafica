'use client';

import { useState } from 'react';
import { clsx } from '@/lib/clsx';
import { COPERTURE, GRUPPI, STATI_FATTURA, VISTE, euroC, messaggioTessera, perGruppo, type Risultato, type Vista } from '@/lib/portale/simulatore-logica';
import { Giu } from '@/components/icone';

/**
 * Il conto del simulatore, uguale nelle tre porte: testata con il mensile per
 * lavoratore (CP-01), le tre colonne (a preventivo, dalle fatture, con noi),
 * il dettaglio per gruppo e gli obblighi con il bollino. Ogni prezzo del
 * vecchio metodo dice se è stima (CP-02); se l'abbonamento costa di più lo
 * dice (CP-03).
 */
export function TestataCosto({ r, vista, compatta = false }: { r: Risultato; vista: Vista; compatta?: boolean }) {
  const m = messaggioTessera(r, vista);
  const v = r.viste[vista];
  return (
    <section aria-label="Costo al mese per lavoratore" className={clsx('rounded-[1.75rem] bg-grafite-950 text-white', compatta ? 'px-4 py-3' : 'p-5 sm:p-6')}>
      {!compatta && <p className="text-[13px] text-grafite-400">Al mese per lavoratore</p>}
      {compatta ? (
        <div className="flex items-end gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-grafite-400">A preventivo</p>
            <p className="cifre text-[20px] font-light leading-none text-grafite-300 line-through decoration-1">{m.vecchio}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-grafite-400">Con l&apos;abbonamento</p>
            <p className="cifre truncate text-[22px] font-light leading-none tracking-[-0.02em] text-oro-500">{m.nuovo}</p>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[13px] text-grafite-400">
            Oggi a preventivo <span className="cifre ml-1 text-[18px] text-grafite-300 line-through decoration-1">{m.vecchio}</span>
          </p>
          <p className="mt-2 text-[12px] text-grafite-400">Con l&apos;abbonamento</p>
          <p className="cifre text-[36px] font-light leading-[1.05] tracking-[-0.02em] text-oro-500 sm:text-[44px]">{m.nuovo}</p>
        </div>
      )}
      {!compatta && r.tessera.tipo === 'listino' && r.profilo.senzaVisita > 0 && <p className="mt-1.5 text-[12.5px] text-grafite-400">con visita medica e senza, IVA esclusa</p>}
      {m.risparmio !== null && (
        <p className={clsx('text-[14px]', compatta ? 'mt-1.5' : 'mt-4', m.piu ? 'text-[#ffc6ac]' : 'text-white')}>
          {m.piu ? 'Costa ' : 'Risparmi '}
          <span className="cifre font-medium">{m.risparmio}</span> all&apos;anno {vista === 'regime' ? 'a regime' : vista === 'primo_anno' ? 'il primo anno' : 'in media'}
          {!m.piu && v.risparmioPct !== null ? ` (${v.risparmioPct}%)` : ''}
        </p>
      )}
    </section>
  );
}

export function SceltaVista({ vista, onCambia }: { vista: Vista; onCambia: (v: Vista) => void }) {
  return (
    <div role="tablist" aria-label="Vista del confronto" className="flex gap-1 rounded-full bg-perla-velo p-1">
      {VISTE.map((x) => (
        <button
          key={x.k}
          role="tab"
          type="button"
          aria-selected={vista === x.k}
          onClick={() => onCambia(x.k)}
          className={clsx('min-h-[40px] flex-1 rounded-full px-3 text-[13.5px] font-medium', vista === x.k ? 'bg-grafite-950 text-white' : 'text-ink-muted hover:text-ink')}
        >
          {x.t}
        </button>
      ))}
    </div>
  );
}

function Colonna({ titolo, valore, sotto, tono }: { titolo: string; valore: string; sotto: string; tono: 'grigio' | 'acido' | 'bianco' }) {
  return (
    <div className={clsx('min-w-0 rounded-[1.25rem] p-3.5', tono === 'acido' ? 'bg-oro-500 text-acido-950' : tono === 'grigio' ? 'bg-perla-velo' : 'bg-white shadow-[inset_0_0_0_1px_#e2e2e5]')}>
      <p className={clsx('text-[12px] leading-tight', tono === 'acido' ? 'text-acido-950/80' : 'text-ink-muted')}>{titolo}</p>
      <p className="cifre mt-1.5 text-[19px] font-medium leading-none tracking-[-0.02em] sm:text-[22px]">{valore}</p>
      <p className={clsx('mt-1.5 text-[11.5px] leading-snug', tono === 'acido' ? 'text-acido-950/80' : 'text-ink-muted')}>{sotto}</p>
    </div>
  );
}

function Bollino({ tono, children }: { tono: 'ok' | 'warn' | 'danger' | 'neutral' | 'presunto' | 'acido'; children: string }) {
  const cls = {
    ok: 'bg-stato-ok text-stato-ok-ink',
    warn: 'bg-stato-warn text-stato-warn-ink',
    danger: 'bg-stato-danger text-stato-danger-ink',
    neutral: 'bg-perla-velo text-ink-muted',
    presunto: 'bg-white text-ink-muted shadow-[inset_0_0_0_1px_#e2e2e5]',
    acido: 'bg-oro-500 text-acido-950',
  }[tono];
  return <span className={clsx('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-medium', cls)}>{children}</span>;
}

export function PannelloConfronto({ r, vista, onVista, nascondiTestata = false }: { r: Risultato; vista: Vista; onVista: (v: Vista) => void; nascondiTestata?: boolean }) {
  const [aperti, setAperti] = useState<Record<string, boolean>>({});
  const [obblighiAperti, setObblighiAperti] = useState(false);
  const v = r.viste[vista];
  const gruppi = perGruppo(r, vista);
  const fatture = r.fatture;
  const obblighi = obblighiAperti ? r.obblighi : r.obblighi.slice(0, 8);
  return (
    <div className="space-y-4">
      {!nascondiTestata && <TestataCosto r={r} vista={vista} />}
      <SceltaVista vista={vista} onCambia={onVista} />

      <div className={clsx('grid gap-2', fatture ? 'grid-cols-3' : 'grid-cols-2')}>
        <Colonna titolo="A preventivo" valore={euroC(v.vecchio, false)} sotto={`${VISTE.find((x) => x.k === vista)?.t.toLowerCase()}, voce per voce`} tono="grigio" />
        {fatture && <Colonna titolo="Dalle fatture" valore={euroC(fatture.pagato, false)} sotto="pagato davvero, voci in confronto" tono="bianco" />}
        <Colonna
          titolo="Con noi"
          valore={v.abbonamento !== null ? euroC(v.abbonamento, false) : 'su misura'}
          sotto={r.abbonamento.quota ? `canone più quota ${euroC(r.abbonamento.quota, false)} a Conflavoro` : 'tutto il canone, IVA esclusa'}
          tono="acido"
        />
      </div>

      {r.contoOnesto && (
        <div className="rounded-[1.25rem] bg-stato-warn px-4 py-3 text-[13.5px] leading-relaxed text-stato-warn-ink">{r.contoOnesto}</div>
      )}

      <section aria-label="Dettaglio del vecchio metodo" className="rounded-[1.5rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]">
        <p className="px-4 pb-1 pt-4 text-[15px] font-medium text-ink">Dove vanno i soldi a preventivo</p>
        <ul className="divide-y divide-perla-linea">
          {gruppi.map((g) => (
            <li key={g.gruppo}>
              <button
                type="button"
                aria-expanded={!!aperti[g.gruppo]}
                onClick={() => setAperti((a) => ({ ...a, [g.gruppo]: !a[g.gruppo] }))}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left"
              >
                <span className="min-w-0 flex-1 text-[14px] text-ink">{GRUPPI[g.gruppo] ?? g.gruppo}</span>
                <span className="cifre text-[14px] text-ink">{euroC(g.importo, false)}</span>
                <Bollino tono={g.righe.some((x) => x.copertura === 'supplemento') ? 'neutral' : 'acido'}>{g.righe.some((x) => x.copertura === 'supplemento') ? 'Con supplemento' : 'Nel canone'}</Bollino>
                <Giu size={16} aria-hidden className={clsx('shrink-0 text-ink-muted transition-transform', aperti[g.gruppo] && 'rotate-180')} />
              </button>
              {aperti[g.gruppo] && (
                <ul className="space-y-1.5 px-4 pb-3">
                  {g.righe.map((x) => (
                    <li key={x.code} className="flex items-start gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 text-ink-soft">
                        {x.titolo}
                        {x.quantita > 1 ? ` × ${x.quantita}` : ''}
                      </span>
                      <span className="cifre text-ink">{euroC(vista === 'primo_anno' ? x.primoAnno : vista === 'regime' ? x.regime : Math.floor((x.primoAnno + 4 * x.regime) / 5), false)}</span>
                      <span className={clsx('w-12 text-right text-[11.5px]', x.fonte === 'reale' ? 'text-ink' : 'text-ink-muted')}>{x.fonte === 'listino' ? 'listino' : x.fonte === 'reale' ? 'reale' : 'stima'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {r.notaStime && <p className="px-4 pb-4 pt-2 text-[12px] leading-relaxed text-ink-muted">{r.notaStime}</p>}
      </section>

      <section aria-label="Obblighi" className="rounded-[1.5rem] bg-white shadow-[inset_0_0_0_1px_#e2e2e5]">
        <div className="px-4 pb-1 pt-4">
          <p className="text-[15px] font-medium text-ink">A cosa sei obbligato</p>
          <p className="text-[12.5px] text-ink-muted">
            {r.sintesi.totale} adempimenti, {r.sintesi.nelCanone} nel canone{r.sintesi.presunti > 0 ? `, ${r.sintesi.presunti} presunti da verificare con il tecnico` : ''}
          </p>
        </div>
        <ul className="divide-y divide-perla-linea">
          {obblighi.map((o) => {
            const f = o.fatture ? STATI_FATTURA[o.fatture.stato] : null;
            return (
              <li key={o.code} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 basis-40 text-[13.5px] text-ink">
                    {o.titolo}
                    {o.quantita > 1 ? ` · ${o.quantita}` : ''}
                  </span>
                  {f && <Bollino tono={f.tono}>{f.t}</Bollino>}
                  {o.presunto && <Bollino tono="presunto">Presunto</Bollino>}
                  <Bollino tono={o.copertura === 'canone' ? 'acido' : 'neutral'}>{COPERTURE[o.copertura] ?? o.copertura}</Bollino>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {o.articolo}
                  {o.periodicita ? ` · ${o.periodicita}` : ''}
                  {o.fatture && o.fatture.stato !== 'coperto' && o.fatture.scoperto > 0 ? ` · scoperto a listino ${euroC(o.fatture.scoperto)}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
        {r.obblighi.length > 8 && (
          <button type="button" onClick={() => setObblighiAperti((x) => !x)} className="min-h-[44px] w-full text-[13.5px] font-medium text-ink">
            {obblighiAperti ? 'Mostra meno' : `Mostra tutti i ${r.obblighi.length}`}
          </button>
        )}
      </section>

      {r.fuori.length > 0 && (
        <section aria-label="Fuori dal confronto" className="rounded-[1.5rem] bg-perla-velo p-4">
          <p className="text-[14px] font-medium text-ink">Fuori dal confronto</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Si quotano a parte in entrambi i casi.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.fuori.map((x) => (
              <li key={x.code}>
                <Bollino tono="presunto">{x.titolo}</Bollino>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        Conto assistito da AI sui listini in tabella: il preventivo vero lo conferma lo studio. Una fattura prova una spesa, non la conformità: il giudizio lo dà il tecnico dopo il sopralluogo.
      </p>
    </div>
  );
}
