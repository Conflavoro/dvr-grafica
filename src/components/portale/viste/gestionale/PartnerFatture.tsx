"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendario } from "@/components/icone";
import { Caricamento, Chip, Errore, Scheda, Vuoto, dataIt } from "../../kit";
import { Avviso, useAzione } from "../amministrazione-kit";
import { euro } from "@/lib/portale/amministrazione-logica";
import {
  TESTO_STATO_FATTURA,
  calendarioGiornate,
  fattureCentro,
  fattureLaboratorio,
  generaFatturaGiornata,
  generaFatturaLaboratorio,
  type FatturaInviata,
  type FattureCentro,
  type FattureLaboratorio,
  type GiornataCalendario,
  type RigaFattura,
} from "@/lib/portale/gestionale-api";
import { clsx } from "@/lib/clsx";

const dataLunga = (d: string) => {
  const t = new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const meseLungo = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return a && n
    ? new Date(a, n - 1, 15).toLocaleDateString("it-IT", {
        month: "long",
        year: "numeric",
      })
    : m;
};

function useDati<T>(fn: () => Promise<T>) {
  const [dati, setDati] = useState<T | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const carica = useCallback(() => {
    setErrore(null);
    fn()
      .then(setDati)
      .catch((e: unknown) =>
        setErrore(e instanceof Error ? e.message : "Non disponibile."),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(carica, [carica]);
  return { dati, errore, carica };
}

/** 16.2: giornate del calendario; le non visibili restano grigie e non si aprono. */
export function CalendarioGiornate({
  onApri,
}: {
  onApri: (id: number) => void;
}) {
  const { dati, errore, carica } = useDati(calendarioGiornate);
  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!dati) return <Caricamento />;
  return (
    <Scheda
      titolo="Giornate delle visite"
      sotto="Ogni elenco si apre alla chiusura delle prenotazioni e resta visibile fino a 30 giorni dopo la giornata."
    >
      {dati.length === 0 ? (
        <Vuoto titolo="Nessuna giornata in calendario" />
      ) : (
        <ul className="divide-y divide-perla-linea">
          {dati.map((g) => (
            <li key={g.id}>
              <RigaGiornata g={g} onApri={onApri} />
            </li>
          ))}
        </ul>
      )}
    </Scheda>
  );
}

function RigaGiornata({
  g,
  onApri,
}: {
  g: GiornataCalendario;
  onApri: (id: number) => void;
}) {
  const sotto = g.visibile
    ? `dalle ${g.oraInizio} · ${g.prenotati} lavoratori di ${g.aziende} ${g.aziende === 1 ? "azienda" : "aziende"}`
    : g.motivo === "privacy"
      ? "oltre 30 giorni dalla giornata: elenco chiuso per la privacy"
      : "elenco in preparazione";
  const chip = !g.visibile ? (
    <Chip stato="neutral">
      {g.motivo === "privacy"
        ? "Non più visibile"
        : `Elenco disponibile dal ${dataIt(g.disponibileDal, true)}`}
    </Chip>
  ) : g.fase === "oggi" ? (
    <Chip stato="run">Oggi</Chip>
  ) : g.fase === "futura" ? (
    <Chip stato="info">{g.prenotati} prenotati</Chip>
  ) : (
    <Chip stato="ok">{g.visitati} visitati</Chip>
  );
  const corpo = (
    <>
      <span
        aria-hidden
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          g.visibile
            ? "bg-perla-velo text-ink"
            : "border border-dashed border-perla-linea text-ink-subtle",
        )}
      >
        <Calendario size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block text-[14.5px] font-medium",
            g.visibile ? "text-ink" : "text-ink-subtle",
          )}
        >
          {dataLunga(g.data)}
        </span>
        <span className="block text-[12.5px] text-ink-muted">{sotto}</span>
      </span>
      {chip}
    </>
  );
  return g.visibile ? (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-3 text-left hover:bg-perla-velo/60"
      onClick={() => onApri(g.id)}
    >
      {corpo}
    </button>
  ) : (
    <div className="flex items-center gap-3 py-3 opacity-80" aria-disabled>
      {corpo}
    </div>
  );
}

function TabellaRighe({
  righe,
  totale,
}: {
  righe: RigaFattura[];
  totale: number;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[420px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-perla-linea text-[12px] text-ink-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              Prestazione
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Numero
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Tariffa
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Totale
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-perla-linea">
          {righe.map((r) => (
            <tr key={r.prestazione}>
              <td className="py-2.5 pr-3 text-ink">{r.nome}</td>
              <td className="cifre py-2.5 pr-3 text-right">{r.numero}</td>
              <td className="cifre py-2.5 pr-3 text-right">
                {euro(r.tariffa)}
              </td>
              <td className="cifre py-2.5 text-right">{euro(r.totale)}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2.5 pr-3 text-ink" colSpan={3}>
              Totale
            </td>
            <td className="cifre py-2.5 text-right text-ink">{euro(totale)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Inviate({
  voci,
  cosa,
}: {
  voci: FatturaInviata[];
  cosa: "giornata" | "mese";
}) {
  return (
    <Scheda titolo="Fatture inviate">
      {voci.length === 0 ? (
        <Vuoto titolo="Nessuna fattura inviata" />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-perla-linea text-[12px] text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Numero
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {cosa === "giornata" ? "Giornata" : "Mese"}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Inviata il
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Importo
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Controllo automatico
                </th>
                <th scope="col" className="py-2 font-medium">
                  Stato
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-perla-linea">
              {voci.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="py-2.5 pr-3 font-mono text-[12.5px] text-ink">
                    {f.numero}
                  </td>
                  <td className="py-2.5 pr-3">
                    {cosa === "giornata"
                      ? dataIt(f.giornata, true)
                      : f.mese
                        ? meseLungo(f.mese)
                        : ""}
                  </td>
                  <td className="py-2.5 pr-3">{dataIt(f.inviataIl, true)}</td>
                  <td className="cifre py-2.5 pr-3 text-right">
                    {euro(f.importo)}
                  </td>
                  <td className="py-2.5 pr-3 text-[12.5px] text-ink-muted">
                    {f.controllo}
                  </td>
                  <td className="py-2.5">
                    <Chip
                      stato={
                        f.stato === "pagata"
                          ? "ok"
                          : f.stato === "in_verifica"
                            ? "warn"
                            : "info"
                      }
                    >
                      {TESTO_STATO_FATTURA[f.stato]}
                      {f.stato === "pagata" && f.pagataIl
                        ? ` il ${dataIt(f.pagataIl, true)}`
                        : ""}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Scheda>
  );
}

/** 16.3: fatture del centro medico al gestionale. */
export function FattureDelCentro() {
  const { dati, errore, carica } = useDati<FattureCentro>(fattureCentro);
  const az = useAzione();
  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!dati) return <Caricamento />;
  return (
    <div className="space-y-4">
      {dati.daFatturare.length === 0 ? (
        <Vuoto titolo="Nessuna giornata da fatturare">
          Le giornate concluse compaiono qui con le prestazioni fatte.
        </Vuoto>
      ) : (
        dati.daFatturare.map((g) => (
          <Scheda
            key={g.giornataId}
            titolo={`Prestazioni da fatturare · ${dataLunga(g.data)}`}
            azioni={
              dati.partner ? (
                <button
                  type="button"
                  className="btn-primary min-h-[44px] lg:min-h-[40px]"
                  disabled={az.occupato || g.visitati === 0}
                  onClick={() =>
                    void az
                      .esegui(
                        () => generaFatturaGiornata(g.giornataId),
                        `Fattura di ${euro(g.totale)} inviata: controllo superato.`,
                      )
                      .then((ok) => ok && carica())
                  }
                >
                  Genera la fattura
                </button>
              ) : (
                <Chip stato="neutral">Solo il partner</Chip>
              )
            }
          >
            {g.ancoraAttesi > 0 && (
              <div className="mb-3">
                <Avviso tono="warn">
                  {g.ancoraAttesi} lavoratori ancora attesi o in visita: la
                  fattura comprende solo le visite fatte.
                </Avviso>
              </div>
            )}
            {g.righe.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">
                Nessuna visita fatta.
              </p>
            ) : (
              <TabellaRighe righe={g.righe} totale={g.totale} />
            )}
            <p className="mt-3 text-[12.5px] text-ink-subtle">{dati.nota}</p>
          </Scheda>
        ))
      )}
      <Inviate voci={dati.inviate} cosa="giornata" />
      <p className="text-[12.5px] text-ink-muted">
        Pagamento a 30 giorni. Una fattura con differenze passa al pagamento
        solo con l’approvazione dell’amministrazione.
      </p>
      {az.messaggio}
    </div>
  );
}

/** 18.3: fatture del laboratorio al gestionale. */
export function FattureDelLaboratorio() {
  const { dati, errore, carica } =
    useDati<FattureLaboratorio>(fattureLaboratorio);
  const az = useAzione();
  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!dati) return <Caricamento />;
  return (
    <div className="space-y-4">
      <Scheda
        titolo={`Da fatturare a ${dati.mese ? meseLungo(dati.mese) : "questo mese"}`}
        azioni={
          dati.fatturata ? (
            <Chip stato="ok">Fattura inviata</Chip>
          ) : dati.partner ? (
            <button
              type="button"
              className="btn-primary min-h-[44px] lg:min-h-[40px]"
              disabled={az.occupato || dati.righe.length === 0}
              onClick={() =>
                void az
                  .esegui(
                    () => generaFatturaLaboratorio(),
                    `Fattura di ${euro(dati.totale)} inviata.`,
                  )
                  .then((ok) => ok && carica())
              }
            >
              Genera la fattura
            </button>
          ) : (
            <Chip stato="neutral">Solo il partner</Chip>
          )
        }
      >
        {dati.righe.length === 0 ? (
          <p className="text-[13.5px] text-ink-muted">
            Nessun incarico chiuso da fatturare.
          </p>
        ) : (
          <TabellaRighe righe={dati.righe} totale={dati.totale} />
        )}
        <p className="mt-3 text-[12.5px] text-ink-subtle">{dati.nota}</p>
      </Scheda>
      <Inviate voci={dati.inviate} cosa="mese" />
      {az.messaggio}
    </div>
  );
}
