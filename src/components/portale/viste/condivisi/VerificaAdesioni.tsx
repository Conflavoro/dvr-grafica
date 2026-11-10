'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from '@/lib/clsx';
import { Chip, Scheda, dataIt, type StatoChip } from '../../kit';
import FoglioPagamento from './FoglioPagamento';
import { Foglio } from '../../kit';
import {
  adesioni as leggiAdesioni,
  caricaProvaAdesione,
  comunicaAdesione,
  euro,
  pagaConguaglio,
  type Adesioni,
  type StatoAdesione,
  type VoceAdesione,
} from '@/lib/portale/amministrazione-pagamenti';

const CHIP: Record<StatoAdesione, StatoChip> = { da_verificare: 'warn', in_verifica: 'info', verificata: 'ok', non_risulta: 'danger', non_serve: 'neutral', ridotta: 'ok' };

/**
 * Riquadro "Verifica delle adesioni" (regole di business 6.2), nella pagina Contratto.
 * Carica una prova (titolare), Comunica un'adesione (titolare), conguaglio con
 * "Paga il conguaglio" dal foglio di pagamento comune.
 */
export default function VerificaAdesioni({ aziendaId, onCambio }: { aziendaId: number; onCambio?: () => void }) {
  const [a, setA] = useState<Adesioni | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [paga, setPaga] = useState<VoceAdesione | null>(null);
  const [comunica, setComunica] = useState(false);
  const carica = useCallback(() => {
    leggiAdesioni(aziendaId)
      .then(setA)
      .catch(() => setA(null));
  }, [aziendaId]);
  useEffect(carica, [carica]);
  if (!a || a.voci.length === 0) return null;
  const testa =
    a.aperte > 0 ? (
      <Chip stato="warn">Entro il {dataIt(a.entro)}</Chip>
    ) : a.stato === 'conguaglio_da_pagare' ? (
      <Chip stato="danger">Conguaglio da pagare</Chip>
    ) : (
      <Chip stato="ok">Completata</Chip>
    );
  return (
    <Scheda
      titolo="Verifica delle adesioni"
      sotto={a.aperte > 0 ? `Le hai dichiarate all'attivazione. Le verifichiamo entro il ${dataIt(a.entro)}: non devi fare nulla.` : 'Verifica completata.'}
      azioni={testa}
    >
      <ul className="divide-y divide-perla-linea">
        {a.voci.map((v) => (
          <li key={v.ente} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{v.nome}</span>
                <span className="block text-[12.5px] text-ink-muted">Hai dichiarato: {v.dichiarato.toLowerCase()}</span>
              </span>
              <Chip stato={CHIP[v.stato]}>{v.etichetta}</Chip>
              {v.puoCaricare && <Prova aziendaId={aziendaId} v={v} onFatto={(m) => { setMsg(m); carica(); }} />}
            </div>
            {v.nonRisulta && (
              <div className="mt-3 rounded-[1.25rem] bg-perla-velo p-4">
                <p className="text-[13.5px] text-ink">{v.nonRisulta.testo}</p>
                <p className="cifre mt-2 text-[26px] font-light text-ink">
                  {euro(v.nonRisulta.conguaglio)}
                  <span className="text-[13px] text-ink-muted"> di conguaglio</span>
                </p>
                <p className="text-[12.5px] text-ink-muted">{v.nonRisulta.dettaglio}</p>
                {v.nonRisulta.pagato ? (
                  <p className="mt-2">
                    <Chip stato="ok">Conguaglio pagato</Chip>
                  </p>
                ) : (
                  <button type="button" className="btn-acido mt-3" onClick={() => setPaga(v)}>
                    {v.nonRisulta.puoPagare ? 'Paga il conguaglio' : 'Lo paga il titolare'}
                  </button>
                )}
                <p className="mt-2 text-[12px] text-ink-muted">{v.nonRisulta.nota}</p>
              </div>
            )}
            {v.riduzione && (
              <p className="mt-2 text-[12.5px] text-ink-muted">
                Adesione comunicata dal {dataIt(v.riduzione.comunicataDal)}: la rata scende dal {dataIt(v.riduzione.dal)}.
              </p>
            )}
          </li>
        ))}
      </ul>
      {a.aperte > 0 && (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          Se vuoi chiudere prima, carica una prova: l&apos;ultima denuncia EBIASP, la ricevuta della quota o l&apos;adesione al fondo. Non è obbligatorio. Se qualcosa non risulta, c&apos;è un conguaglio per i mesi passati.
        </p>
      )}
      {a.puoComunicare && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
          <p className="min-w-0 flex-1 text-[13.5px]">
            <b className="font-medium">Hai aderito a un ente dopo l&apos;attivazione?</b> <span className="text-ink-muted">Comunicalo: la rata scende dal mese successivo.</span>
          </p>
          <button type="button" className="btn-ghost" onClick={() => setComunica(true)}>
            Comunica un&apos;adesione
          </button>
        </div>
      )}
      {msg && (
        <p className="mt-3 rounded-[1rem] bg-perla-velo px-3 py-2 text-[13px] text-ink-soft" role="status">
          {msg}
        </p>
      )}
      {paga?.nonRisulta && (
        <FoglioPagamento
          aperto
          onChiudi={() => setPaga(null)}
          aziendaId={aziendaId}
          titolo="Conguaglio"
          voce={`Conguaglio ${paga.nome}`}
          importo={paga.nonRisulta.conguaglio}
          paga={(m) => pagaConguaglio(aziendaId, paga.ente, m)}
          onPagato={() => {
            carica();
            onCambio?.();
          }}
        />
      )}
      <Comunica
        aperto={comunica}
        voci={a.voci.filter((v) => v.stato === 'non_serve' || v.stato === 'non_risulta')}
        onChiudi={() => setComunica(false)}
        invia={async (ente, dal, file) => {
          const r = await comunicaAdesione(aziendaId, ente, dal, file);
          setA(r.adesioni);
          setMsg(r.messaggio);
          onCambio?.();
        }}
      />
    </Scheda>
  );
}

function Prova({ aziendaId, v, onFatto }: { aziendaId: number; v: VoceAdesione; onFatto: (m: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn-ghost" title={`Serve ${v.prova}`} onClick={() => input.current?.click()}>
        Carica una prova
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return setErr('Scegli il file da inviare.');
          caricaProvaAdesione(aziendaId, v.ente, f)
            .then((r) => onFatto(r.messaggio))
            .catch((x: unknown) => setErr(x instanceof Error ? x.message : 'Invio non riuscito.'));
        }}
      />
      {err && <p className="w-full text-[12.5px] text-stato-danger-ink">{err}</p>}
    </>
  );
}

function Comunica({ aperto, voci, onChiudi, invia }: { aperto: boolean; voci: VoceAdesione[]; onChiudi: () => void; invia: (ente: string, dal: string, file: File) => Promise<void> }) {
  const [ente, setEnte] = useState('');
  const [dal, setDal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (aperto) {
      setEnte(voci[0]?.ente ?? '');
      setDal('');
      setFile(null);
      setErr(null);
    }
  }, [aperto, voci]);
  return (
    <Foglio
      aperto={aperto}
      titolo="Comunica un'adesione"
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            if (!file) return setErr('Serve una prova dell\'adesione.');
            if (!ente || !dal) return setErr('Scegli l\'ente e da quando.');
            try {
              await invia(ente, dal, file);
              onChiudi();
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Invio non riuscito.');
            }
          }}
        >
          Invia
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-ink-muted">La rata scende dal mese successivo.</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Ente">
          {voci.map((v) => (
            <button key={v.ente} type="button" role="radio" aria-checked={ente === v.ente} onClick={() => setEnte(v.ente)}
              className={clsx('premi rounded-[1rem] px-3 py-2.5 text-left text-[14px]', ente === v.ente ? 'bg-grafite-950 text-white' : 'bg-white text-ink shadow-[inset_0_0_0_1px_#e2e2e5]')}>
              {v.nome}
            </button>
          ))}
        </div>
        <label className="block text-[12.5px] text-ink-muted" htmlFor="ades-dal">
          Da quando
        </label>
        <input id="ades-dal" type="date" className="input-field" value={dal} onChange={(e) => setDal(e.target.value)} />
        <input type="file" aria-label="Prova dell'adesione" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {err && <p className="text-[12.5px] text-stato-danger-ink">{err}</p>}
      </div>
    </Foglio>
  );
}
