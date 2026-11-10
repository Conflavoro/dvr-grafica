"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Avviso as IconaAvviso, Piu, Scudo } from "@/components/icone";
import {
  Caricamento,
  Chip,
  Errore,
  Foglio,
  Riquadro,
  Scheda,
  Vuoto,
  dataIt,
} from "../../kit";
import { Avviso, useAzione } from "../amministrazione-kit";
import {
  TONO_ESAME,
  accettaEsami,
  esamiLaboratorio,
  esamiMedico,
  inviaReferto,
  prelievoFatto,
  richiediEsami,
  scaricaReferto,
  type RichiestaEsami,
  type VistaEsamiLaboratorio,
  type VistaEsamiMedico,
} from "@/lib/portale/medico-api";
import { clsx } from "@/lib/clsx";

const tra = (giorni: number) => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

function StatoEsame({ r }: { r: RichiestaEsami }) {
  return (
    <Chip stato={TONO_ESAME[r.stato]}>
      {r.statoTesto}
      {r.stato === "prelievo_fissato" && r.prelievoIl
        ? ` il ${dataIt(r.prelievoIl, true)}`
        : ""}
    </Chip>
  );
}

function Tabella({
  righe,
  colonne,
}: {
  righe: RichiestaEsami[];
  colonne: Array<{
    t: string;
    v: (r: RichiestaEsami) => ReactNode;
    cls?: string;
  }>;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-perla-linea text-[12px] text-ink-muted">
            {colonne.map((c) => (
              <th
                key={c.t}
                scope="col"
                className={clsx("py-2 pr-3 font-medium", c.cls)}
              >
                {c.t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-perla-linea">
          {righe.map((r) => (
            <tr key={r.id} className="align-top">
              {colonne.map((c) => (
                <td key={c.t} className={clsx("py-3 pr-3", c.cls)}>
                  {c.v(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const colRichiesta = {
  t: "Richiesta",
  v: (r: RichiestaEsami) => (
    <>
      <span className="block font-mono text-[12.5px] text-ink">{r.codice}</span>
      <span className="block text-[12px] text-ink-muted">
        {dataIt(r.richiestaIl, true)}
      </span>
    </>
  ),
};
const colLavoratore = {
  t: "Lavoratore",
  v: (r: RichiestaEsami) => (
    <>
      <span className="block text-ink">{r.lavoratore}</span>
      {r.azienda && (
        <span className="block text-[12px] text-ink-muted">{r.azienda}</span>
      )}
    </>
  ),
};
const colEsame = { t: "Esame", v: (r: RichiestaEsami) => r.esami.join(", ") };

/** 17.4: richieste di esami del medico competente. */
export function EsamiMedico() {
  const [v, setV] = useState<VistaEsamiMedico | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nuova, setNuova] = useState(false);
  const [referto, setReferto] = useState<RichiestaEsami | null>(null);
  const carica = useCallback(() => {
    setErr(null);
    esamiMedico()
      .then(setV)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Richieste non disponibili."),
      );
  }, []);
  useEffect(carica, [carica]);
  const az = useAzione();

  return (
    <Scheda
      titolo="Richieste di esami ai laboratori convenzionati"
      sotto={v?.nota ?? "Il referto arriva solo a te."}
      azioni={
        <button
          type="button"
          className="btn-acido min-h-[44px] lg:min-h-[40px]"
          onClick={() => setNuova(true)}
          disabled={!v || v.lavoratori.length === 0}
        >
          <Piu size={16} aria-hidden /> Nuova richiesta
        </button>
      }
    >
      {err && <Errore testo={err} onRiprova={carica} />}
      {!v && !err && <Caricamento />}
      {v && v.richieste.length === 0 && <Vuoto titolo="Nessuna richiesta" />}
      {v && v.richieste.length > 0 && (
        <Tabella
          righe={v.richieste}
          colonne={[
            colRichiesta,
            colLavoratore,
            colEsame,
            { t: "Laboratorio", v: (r) => r.laboratorio },
            { t: "Stato", v: (r) => <StatoEsame r={r} /> },
            {
              t: "",
              cls: "text-right",
              v: (r) =>
                r.referto ? (
                  <button
                    type="button"
                    className={clsx(
                      r.letto ? "btn-ghost" : "btn-primary",
                      "min-h-[40px] px-3 text-[13px]",
                    )}
                    onClick={() => setReferto(r)}
                  >
                    {r.letto ? "Riapri" : "Leggi il referto"}
                  </button>
                ) : null,
            },
          ]}
        />
      )}
      {v && (
        <FoglioNuovaRichiesta
          aperto={nuova}
          v={v}
          onChiudi={() => setNuova(false)}
          onFatto={() => {
            setNuova(false);
            carica();
          }}
        />
      )}
      <Foglio
        aperto={referto !== null}
        titolo={referto ? `Referto ${referto.codice}` : "Referto"}
        onChiudi={() => setReferto(null)}
        piede={
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary min-h-[44px]"
              disabled={az.occupato}
              onClick={() =>
                referto &&
                void az
                  .esegui(
                    () => scaricaReferto(referto),
                    `Referto ${referto.codice} scaricato.`,
                  )
                  .then((ok) => ok && carica())
              }
            >
              Scarica nella cartella sanitaria
            </button>
            <button
              type="button"
              className="btn-ghost min-h-[44px]"
              onClick={() => setReferto(null)}
            >
              Chiudi
            </button>
          </span>
        }
      >
        {referto && (
          <div className="space-y-4">
            <p className="text-[14px] text-ink-muted">
              {referto.lavoratore} · {referto.esami.join(", ")}
            </p>
            <div className="rounded-[1rem] bg-perla-velo px-4 py-3 text-[13.5px]">
              <span className="block font-medium text-ink">
                Referto-{referto.codice}.pdf
              </span>
              <span className="block text-ink-muted">
                Firmato da {referto.laboratorio}
                {referto.refertoIl
                  ? ` il ${dataIt(referto.refertoIl, true)}`
                  : ""}
                {referto.prelievoIl
                  ? ` · prelievo del ${dataIt(referto.prelievoIl, true)}`
                  : ""}
              </span>
            </div>
            <Avviso tono="warn">
              <strong className="font-medium">Visibile solo a te.</strong> Il
              portale non mostra i valori e non li salva: scarica il referto
              nella tua cartella sanitaria. Azienda e gestionale vedono solo
              «referto inviato al medico».
            </Avviso>
          </div>
        )}
        {az.messaggio}
      </Foglio>
      {az.messaggio}
    </Scheda>
  );
}

function FoglioNuovaRichiesta({
  aperto,
  v,
  onChiudi,
  onFatto,
}: {
  aperto: boolean;
  v: VistaEsamiMedico;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [lav, setLav] = useState(0);
  const [esami, setEsami] = useState<string[]>(["Emocromo"]);
  const [lab, setLab] = useState("");
  const az = useAzione();
  useEffect(() => {
    if (!aperto) return;
    setLav(v.lavoratori[0]?.id ?? 0);
    setEsami(v.esami.includes("Emocromo") ? ["Emocromo"] : []);
    setLab(v.laboratori[0] ?? "");
  }, [aperto, v]);
  const invia = () => {
    if (esami.length === 0) {
      void az.esegui(
        () => Promise.reject(new Error("Scegli almeno un esame.")),
        "",
      );
      return;
    }
    void az
      .esegui(
        () => richiediEsami(lav, esami, lab),
        `Richiesta inviata a ${lab}.`,
      )
      .then((ok) => ok && onFatto());
  };
  return (
    <Foglio
      aperto={aperto}
      titolo="Nuova richiesta di esami"
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-acido min-h-[44px]"
          disabled={az.occupato || !lav || !lab}
          onClick={invia}
        >
          Invia la richiesta
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] text-ink-muted">
          A un laboratorio convenzionato.
        </p>
        <label className="block text-[14px] font-medium text-ink">
          Lavoratore
          <select
            className="input-field mt-1.5 h-11 w-full"
            value={lav}
            onChange={(e) => setLav(Number(e.target.value))}
          >
            {v.lavoratori.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-[14px] font-medium text-ink">Esami</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {v.esami.map((e) => (
              <label
                key={e}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[1rem] bg-white px-3 text-[14px] text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-grafite-900"
                  checked={esami.includes(e)}
                  onChange={() =>
                    setEsami((x) =>
                      x.includes(e) ? x.filter((y) => y !== e) : [...x, e],
                    )
                  }
                />
                {e}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-[14px] font-medium text-ink">
          Laboratorio
          {v.laboratori.length === 0 ? (
            <span className="mt-1.5 block text-[13.5px] font-normal text-ink-muted">
              Nessun laboratorio convenzionato: lo studio deve prima invitarne
              uno.
            </span>
          ) : (
            <select
              className="input-field mt-1.5 h-11 w-full"
              value={lab}
              onChange={(e) => setLab(e.target.value)}
            >
              {v.laboratori.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </label>
        <p className="flex items-start gap-2 text-[13px] text-ink-muted">
          <IconaAvviso size={15} aria-hidden className="mt-0.5 shrink-0" />
          Il laboratorio vede nome del lavoratore, esame e medico richiedente.
          Il referto arriva solo a te.
        </p>
      </div>
      {az.messaggio}
    </Foglio>
  );
}

/** 18.1: esami sui lavoratori, lato laboratorio (il coordinatore li guarda in anteprima). */
export function EsamiLaboratorio() {
  const [v, setV] = useState<VistaEsamiLaboratorio | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accetta, setAccetta] = useState<RichiestaEsami | null>(null);
  const [referto, setReferto] = useState<RichiestaEsami | null>(null);
  const [data, setData] = useState(tra(2));
  const [file, setFile] = useState<File | null>(null);
  const az = useAzione();
  const carica = useCallback(() => {
    setErr(null);
    esamiLaboratorio()
      .then(setV)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Esami non disponibili."),
      );
  }, []);
  useEffect(carica, [carica]);
  const fatto = (ok: boolean) => {
    if (ok) carica();
    return ok;
  };

  if (err) return <Errore testo={err} onRiprova={carica} />;
  if (!v) return <Caricamento />;
  const n = v.numeri;
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-[1.25rem] bg-stato-danger px-4 py-3 text-[13.5px] leading-relaxed text-stato-danger-ink">
        <IconaAvviso size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          <strong className="font-medium">Dati sanitari.</strong> {v.nota}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro
          etichetta="Richieste aperte"
          valore={n.aperte}
          sotto={
            n.medici > 0
              ? `Da ${n.medici} ${n.medici === 1 ? "medico competente" : "medici competenti"}`
              : undefined
          }
        />
        <Riquadro
          etichetta="Da accettare"
          valore={n.daAccettare}
          tono={n.daAccettare > 0 ? "warn" : undefined}
        />
        <Riquadro
          etichetta="Referti da inviare"
          valore={n.refertiDaInviare}
          sotto="Entro 5 giorni dal prelievo"
          tono={n.refertiDaInviare > 0 ? "warn" : undefined}
        />
        <Riquadro
          etichetta="Esami fatturabili nel mese"
          valore={n.fatturabiliMese}
        />
      </div>
      <Scheda
        titolo="Esami sui lavoratori"
        sotto={
          v.anteprima
            ? "Anteprima: tutte le richieste dello studio, come le vedono i laboratori."
            : undefined
        }
      >
        {v.richieste.length === 0 ? (
          <Vuoto titolo="Nessuna richiesta" />
        ) : (
          <Tabella
            righe={v.richieste}
            colonne={[
              colRichiesta,
              colLavoratore,
              colEsame,
              { t: "Medico richiedente", v: (r) => r.medico ?? "" },
              { t: "Stato", v: (r) => <StatoEsame r={r} /> },
              {
                t: "Lo vedono azienda e gestionale",
                v: (r) => (
                  <span className="text-ink-muted">«{r.vistaEsterna}»</span>
                ),
              },
              {
                t: "",
                cls: "text-right",
                v: (r) =>
                  v.anteprima ? null : r.stato === "richiesto" ? (
                    <button
                      type="button"
                      className="btn-primary min-h-[40px] px-3 text-[13px]"
                      onClick={() => {
                        setData(tra(2));
                        setAccetta(r);
                      }}
                    >
                      Accetta e fissa il prelievo
                    </button>
                  ) : r.stato === "prelievo_fissato" ? (
                    <button
                      type="button"
                      className="btn-primary min-h-[40px] px-3 text-[13px]"
                      disabled={az.occupato}
                      onClick={() =>
                        void az
                          .esegui(
                            () => prelievoFatto(r.id),
                            "Prelievo fatto: azienda e gestionale lo vedono.",
                          )
                          .then(fatto)
                      }
                    >
                      Prelievo fatto
                    </button>
                  ) : r.stato === "prelievo_fatto" ? (
                    <button
                      type="button"
                      className="btn-primary min-h-[40px] px-3 text-[13px]"
                      onClick={() => {
                        setFile(null);
                        setReferto(r);
                      }}
                    >
                      Carica il referto
                    </button>
                  ) : null,
              },
            ]}
          />
        )}
      </Scheda>
      <Foglio
        aperto={accetta !== null}
        titolo="Accetta la richiesta"
        onChiudi={() => setAccetta(null)}
        piede={
          <button
            type="button"
            className="btn-primary min-h-[44px]"
            disabled={az.occupato || !data}
            onClick={() =>
              accetta &&
              void az
                .esegui(
                  () => accettaEsami(accetta.id, data),
                  `Prelievo fissato il ${dataIt(data, true)}.`,
                )
                .then((ok) => fatto(ok) && setAccetta(null))
            }
          >
            Accetta
          </button>
        }
      >
        {accetta && (
          <div className="space-y-4">
            <p className="text-[14px] text-ink-muted">
              {accetta.codice} · {accetta.lavoratore} ·{" "}
              {accetta.esami.join(", ")}
            </p>
            <label className="block text-[14px] font-medium text-ink">
              Data del prelievo
              <input
                type="date"
                className="input-field mt-1.5 h-11 w-full"
                min={tra(0)}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </label>
            <p className="text-[13px] text-ink-muted">
              Il lavoratore riceve la convocazione con data e sede. Il medico
              richiedente vede «prelievo fissato».
            </p>
          </div>
        )}
        {az.messaggio}
      </Foglio>
      <Foglio
        aperto={referto !== null}
        titolo={referto ? `Referto · ${referto.codice}` : "Referto"}
        onChiudi={() => setReferto(null)}
        piede={
          <button
            type="button"
            className="btn-primary min-h-[44px]"
            disabled={az.occupato || !file}
            onClick={() =>
              referto &&
              file &&
              void az
                .esegui(
                  () => inviaReferto(referto.id, file),
                  `Referto inviato al medico. Solo ${referto.medico ?? "il medico"} può leggerlo.`,
                )
                .then((ok) => fatto(ok) && setReferto(null))
            }
          >
            Invia il referto al medico
          </button>
        }
      >
        {referto && (
          <div className="space-y-4">
            <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-perla-linea px-4 text-center text-[14px] text-ink-muted">
              {file ? (
                <span className="text-ink">{file.name}</span>
              ) : (
                "Trascina qui il PDF firmato oppure scegli il file"
              )}
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-[13.5px] text-ink">
              Destinatario{" "}
              <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-perla-velo px-2.5 py-1 text-[13px]">
                <Scudo size={13} aria-hidden /> {referto.medico ?? "Medico"},
                medico competente
              </span>
              <span className="block pt-1 text-[12.5px] text-ink-muted">
                Nessun altro lo vede.
              </span>
            </p>
          </div>
        )}
        {az.messaggio}
      </Foglio>
      {az.messaggio}
    </div>
  );
}
