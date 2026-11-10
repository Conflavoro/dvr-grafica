"use client";

import { useState } from "react";
import { Chip, Foglio, Scheda } from "../../kit";
import {
  TESTO_STATO_INDICATORE,
  rispettoAlMesePrima,
  valoreIndicatore,
  type Indicatore,
  type StatoIndicatore,
} from "@/lib/portale/gestionale-api";
import { clsx } from "@/lib/clsx";

/**
 * Gli otto indicatori del cruscotto (04 gestionale 14): il primo in evidenza
 * su fondo nero, "Pilota: dove siamo", la griglia degli altri e il foglio di
 * dettaglio con come si calcola e mese per mese. Solo dati aggregati.
 */

const MESI_BREVI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];
const mese = (m: string) => MESI_BREVI[Number(m.slice(5, 7)) - 1] ?? m;
const COLORE: Record<StatoIndicatore, string> = {
  ok: "#16884A",
  warn: "#A86800",
  danger: "#D63D3E",
  neutral: "#6b6b73",
};

function Linea({
  serie,
  obiettivo,
  colore,
  alto = 64,
  griglia = false,
}: {
  serie: Indicatore["serie"];
  obiettivo: number;
  colore: string;
  alto?: number;
  griglia?: boolean;
}) {
  const valori = serie
    .map((s) => s.valore)
    .filter((v): v is number => v !== null);
  if (valori.length === 0)
    return (
      <div
        style={{ height: alto }}
        className="flex items-center text-[12px] opacity-60"
      >
        Dati insufficienti
      </div>
    );
  const max = Math.max(obiettivo, ...valori) * 1.1 || 1;
  const min = Math.min(0, ...valori);
  const w = 300;
  const x = (i: number) =>
    serie.length <= 1 ? w / 2 : (i * w) / (serie.length - 1);
  const y = (v: number) =>
    alto - 4 - ((v - min) / (max - min || 1)) * (alto - 8);
  const punti = serie
    .map((s, i) => (s.valore === null ? null : `${x(i)},${y(s.valore)}`))
    .filter(Boolean);
  return (
    <svg
      viewBox={`0 0 ${w} ${alto}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height: alto }}
      aria-hidden
    >
      {griglia && (
        <line
          x1={0}
          x2={w}
          y1={y(obiettivo)}
          y2={y(obiettivo)}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={punti.join(" ")}
        fill="none"
        stroke={colore}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Barre({ serie }: { serie: Indicatore["serie"] }) {
  const max = Math.max(1, ...serie.map((s) => s.valore ?? 0));
  return (
    <div className="flex h-16 items-end gap-1" aria-hidden>
      {serie.map((s) => (
        <span
          key={s.mese}
          className={clsx(
            "flex-1 rounded-sm",
            (s.valore ?? 0) > 0 ? "bg-stato-danger-segno" : "bg-perla-linea",
          )}
          style={{ height: `${Math.max(6, (100 * (s.valore ?? 0)) / max)}%` }}
        />
      ))}
    </div>
  );
}

function Mesi({
  serie,
  chiari = false,
}: {
  serie: Indicatore["serie"];
  chiari?: boolean;
}) {
  return (
    <div
      className={clsx(
        "mt-1 flex justify-between text-[11px]",
        chiari ? "text-white/50" : "text-ink-subtle",
      )}
    >
      {serie.map((s) => (
        <span key={s.mese}>{mese(s.mese)}</span>
      ))}
    </div>
  );
}

function Pilota({ ind, completo }: { ind: Indicatore[]; completo: boolean }) {
  const k = Object.fromEntries(ind.map((x) => [x.id, x]));
  const righe: Array<{
    t: string;
    v: string;
    pct: number;
    stato: StatoIndicatore;
  }> = [];
  const riga = (
    i: Indicatore | undefined,
    t: string,
    v: (i: Indicatore) => string,
    pct: (i: Indicatore) => number,
  ) => {
    if (i)
      righe.push({
        t,
        v: v(i),
        pct: Math.max(0, Math.min(100, pct(i))),
        stato: i.stato,
      });
  };
  riga(
    k.k1,
    "Aziende attive",
    (i) => `${i.valore ?? 0} su ${i.obiettivo}`,
    (i) => (100 * (i.valore ?? 0)) / (i.obiettivo || 1),
  );
  riga(
    k.k2,
    "Lavoratori seguiti",
    (i) => `${i.valore ?? 0} su ${i.obiettivo}`,
    (i) => (100 * (i.valore ?? 0)) / (i.obiettivo || 1),
  );
  if (completo) {
    riga(
      k.k3,
      "Ore per lavoratore all’anno",
      (i) =>
        `${valoreIndicatore(i.serie[0]?.valore ?? null, "h")} → ${valoreIndicatore(i.valore, "h")}, obiettivo ${i.obiettivo}`,
      (i) =>
        i.valore === null ? 0 : (100 * i.obiettivo) / Math.max(i.valore, 0.1),
    );
    riga(
      k.k5,
      "Nessuna scadenza saltata",
      (i) =>
        `${i.serie.reduce((a, s) => a + (s.valore ?? 0), 0)} nel periodo, ${i.valore ?? 0} questo mese`,
      (i) => ((i.valore ?? 0) === 0 ? 100 : 20),
    );
    riga(
      k.k4,
      "Fascicolo entro 48 ore",
      (i) =>
        i.valore === null ? "n.d." : `${i.valore}% delle aziende avviate`,
      (i) => i.valore ?? 0,
    );
  }
  return (
    <Scheda titolo="Pilota: dove siamo" sotto="Verifica a gennaio 2027">
      <ul className="space-y-3">
        {righe.map((r) => (
          <li key={r.t}>
            <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
              <span className="text-ink">{r.t}</span>
              <span className="cifre text-right text-ink-muted">{r.v}</span>
            </div>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-perla-velo">
              <span
                className="block h-full rounded-full"
                style={{ width: `${r.pct}%`, background: COLORE[r.stato] }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Scheda>
  );
}

export function IndicatoriPilota({
  indicatori,
  completo,
}: {
  indicatori: Indicatore[];
  completo: boolean;
}) {
  const [mesi, setMesi] = useState<3 | 6 | 10>(10);
  const [aperto, setAperto] = useState<Indicatore | null>(null);
  if (indicatori.length === 0) return null;
  const taglia = (i: Indicatore): Indicatore => ({
    ...i,
    serie: i.serie.slice(-mesi),
  });
  const [primo, ...altri] = indicatori.map(taglia);
  return (
    <section className="space-y-4" aria-label="Indicatori del pilota">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Periodo"
          className="inline-flex gap-1 rounded-full bg-perla-velo p-1"
        >
          {([3, 6, 10] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mesi === m}
              onClick={() => setMesi(m)}
              className={clsx(
                "min-h-[36px] rounded-full px-3 text-[13px]",
                mesi === m ? "bg-grafite-900 text-white" : "text-ink",
              )}
            >
              Ultimi {m} mesi
            </button>
          ))}
        </div>
        <span className="text-[13px] text-ink-muted">
          Clicca un indicatore per il dettaglio. Solo dati aggregati.
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <button
          type="button"
          onClick={() => setAperto(primo)}
          className="rounded-[1.5rem] bg-grafite-950 p-5 text-left text-white"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">{primo.nome}</span>
            <Chip stato={primo.stato}>
              {TESTO_STATO_INDICATORE[primo.stato]}
            </Chip>
          </span>
          <span className="cifre mt-2 block text-[44px] font-light leading-none">
            {primo.unita
              ? valoreIndicatore(primo.valore, primo.unita)
              : `${primo.valore ?? "n.d."} su ${primo.obiettivo}`}
          </span>
          <span className="mt-2 block text-[13px] text-white/65">
            {primo.regola}
            {primo.nota ? ` · ${primo.nota}` : ""}
          </span>
          <span className="mt-4 block text-white">
            <Linea
              serie={primo.serie}
              obiettivo={primo.obiettivo}
              colore="#D4FF3A"
              alto={120}
              griglia
            />
          </span>
          <Mesi serie={primo.serie} chiari />
        </button>
        <Pilota ind={indicatori} completo={completo} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {altri.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setAperto(i)}
            className="rounded-[1.25rem] bg-white p-4 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-medium text-ink">
                {i.nome}
              </span>
              <Chip stato={i.stato}>{TESTO_STATO_INDICATORE[i.stato]}</Chip>
            </span>
            <span className="cifre mt-2 block text-[28px] font-light leading-none text-ink">
              {valoreIndicatore(i.valore, i.unita)}
            </span>
            <span className="mt-3 block">
              {i.id === "k5" ? (
                <Barre serie={i.serie} />
              ) : (
                <Linea
                  serie={i.serie}
                  obiettivo={i.obiettivo}
                  colore={COLORE[i.stato]}
                />
              )}
            </span>
            <span className="mt-2 block text-[12px] text-ink-muted">
              {i.regola}
              {i.nota ? ` · ${i.nota}` : ""}
            </span>
          </button>
        ))}
      </div>
      <Foglio
        aperto={aperto !== null}
        titolo={aperto?.nome ?? "Indicatore"}
        onChiudi={() => setAperto(null)}
        largo
      >
        {aperto && <Dettaglio i={aperto} />}
      </Foglio>
    </section>
  );
}

function Dettaglio({ i }: { i: Indicatore }) {
  const righe = i.serie
    .map((s, k) => ({ ...s, diff: rispettoAlMesePrima(i.serie, k) }))
    .reverse();
  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-ink-muted">Indicatore</p>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="cifre text-[40px] font-light leading-none text-ink">
          {valoreIndicatore(i.valore, i.unita)}
        </span>
        <span className="text-[13.5px] text-ink-muted">{i.regola}</span>
        <Chip stato={i.stato}>{TESTO_STATO_INDICATORE[i.stato]}</Chip>
      </div>
      <div className="text-ink">
        {i.id === "k5" ? (
          <Barre serie={i.serie} />
        ) : (
          <Linea
            serie={i.serie}
            obiettivo={i.obiettivo}
            colore={COLORE[i.stato]}
            alto={160}
            griglia
          />
        )}
        <Mesi serie={i.serie} />
        <p className="mt-1 text-[12px] text-ink-muted">
          Linea tratteggiata: obiettivo {valoreIndicatore(i.obiettivo, i.unita)}
        </p>
      </div>
      <div>
        <h3 className="text-[15px] font-medium text-ink">Come si calcola</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            ["Numeratore", i.numeratore],
            ["Denominatore e periodo", i.denominatore],
            [
              "Stato",
              `${i.meglio === "alto" ? "Più alto è meglio." : "Più basso è meglio."} ${i.regola}`,
            ],
          ].map(([t, v]) => (
            <div key={t} className="rounded-[1rem] bg-perla-velo px-3 py-2.5">
              <p className="text-[12px] text-ink-muted">{t}</p>
              <p className="mt-0.5 text-[13.5px] text-ink">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-muted">
          {i.fonte}. Obiettivi e soglie sono proposte di lavoro, da correggere
          dopo la prima coorte.
        </p>
      </div>
      <div>
        <h3 className="text-[15px] font-medium text-ink">Mese per mese</h3>
        <table className="mt-2 w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-perla-linea text-[12px] text-ink-muted">
              <th scope="col" className="py-2 font-medium">
                Mese
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Valore
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Rispetto al mese prima
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Stato
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-perla-linea">
            {righe.map((r) => {
              const st: StatoIndicatore =
                r.valore === null
                  ? "neutral"
                  : i.meglio === "alto"
                    ? r.valore >= i.obiettivo
                      ? "ok"
                      : r.valore >= i.soglia
                        ? "warn"
                        : "danger"
                    : r.valore <= i.obiettivo
                      ? "ok"
                      : r.valore <= i.soglia
                        ? "warn"
                        : "danger";
              return (
                <tr key={r.mese}>
                  <td className="py-2 capitalize">
                    {new Date(`${r.mese}-15T12:00:00`).toLocaleDateString(
                      "it-IT",
                      { month: "long", year: "numeric" },
                    )}
                  </td>
                  <td className="cifre py-2 text-right">
                    {valoreIndicatore(r.valore, i.unita)}
                  </td>
                  <td className="cifre py-2 text-right text-ink-muted">
                    {r.diff ?? ""}
                  </td>
                  <td className="py-2 text-right">
                    <Chip stato={st}>{TESTO_STATO_INDICATORE[st]}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
