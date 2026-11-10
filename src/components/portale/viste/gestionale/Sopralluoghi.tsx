'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Chip, Errore, Foglio, Schede, Testata, Vuoto, Caricamento } from '../../kit';
import { Piu, Sopralluogo as IconaSopralluogo } from '@/components/icone';
import { aziendeStudio, elencoSopralluoghi, nuovoSopralluogo, percentuale, quando, TIPI_SOPRALLUOGO, type RigaSopralluogo } from '@/lib/portale/sopralluoghi-api';
import { Dettaglio } from './sopralluoghi/Dettaglio';
import { Campo } from './sopralluoghi/Campo';

/**
 * Sezione Sopralluoghi del gestionale: elenco (programmati e fatti) e dettaglio
 * con ?id=. Il dettaglio ha la vista del telefono del tecnico e quella
 * dell'ufficio sugli stessi dati.
 */
export default function Sopralluoghi() {
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    const leggi = () => {
      const v = Number(new URLSearchParams(window.location.search).get('id'));
      setId(Number.isFinite(v) && v > 0 ? v : null);
    };
    leggi();
    window.addEventListener('popstate', leggi);
    return () => window.removeEventListener('popstate', leggi);
  }, []);

  const vai = useCallback((nuovo: number | null) => {
    const u = new URL(window.location.href);
    if (nuovo) u.searchParams.set('id', String(nuovo));
    else u.searchParams.delete('id');
    window.history.pushState({}, '', u.toString());
    setId(nuovo);
    window.scrollTo({ top: 0 });
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  return id ? <Dettaglio id={id} onIndietro={() => vai(null)} /> : <Elenco onApri={vai} />;
}

function Elenco({ onApri }: { onApri: (id: number) => void }) {
  const { versione, apri, aziendaScelta } = usePortale();
  // Solo il cliente scelto in cima al menu (la schermata e' per azienda).
  const soloAzienda = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<'programmati' | 'fatti'>('programmati');
  const [righe, setRighe] = useState<Record<'programmati' | 'fatti', RigaSopralluogo[] | null>>({ programmati: null, fatti: null });
  const [errore, setErrore] = useState<string | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const carica = useCallback(() => {
    setErrore(null);
    Promise.all([elencoSopralluoghi('programmati', soloAzienda), elencoSopralluoghi('fatti', soloAzienda)])
      .then(([p, f]) => setRighe({ programmati: p, fatti: f }))
      .catch((e: Error) => setErrore(e.message));
  }, [soloAzienda]);

  useEffect(() => {
    apri(null);
    carica();
  }, [carica, versione, apri]);

  const filtra = (l: RigaSopralluogo[] | null) => (l && soloAzienda ? l.filter((x) => x.aziendaId === soloAzienda) : l);
  const voci = filtra(righe[scheda]);

  return (
    <div className="space-y-5">
      <Testata
        categoria="scadenze"
        icona={IconaSopralluogo}
        sopra={aziendaScelta?.ragione_sociale ?? 'Sicurezza'}
        titolo="Sopralluoghi"
        sotto="Sul telefono del tecnico, voce per voce. Le note dettate entrano nel verbale dopo la tua approvazione."
        azioni={
          <button type="button" className="btn-primary w-full sm:w-auto" data-falco="nuovo_sopralluogo" data-falco-tocca="" onClick={() => setNuovo(true)}>
            <Piu size={18} aria-hidden /> Nuovo sopralluogo
          </button>
        }
      />
      <Schede
        etichetta="Sopralluoghi"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'programmati', t: 'Programmati', n: filtra(righe.programmati)?.length },
          { k: 'fatti', t: 'Fatti', n: filtra(righe.fatti)?.length },
        ]}
      />
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!errore && voci === null && <Caricamento />}
      {voci && voci.length === 0 && (
        <Vuoto titolo={scheda === 'programmati' ? 'Nessun sopralluogo da fare' : 'Nessun sopralluogo concluso'}>
          {scheda === 'programmati' ? 'Avvia un sopralluogo: la lista di controllo arriva dal settore dell’azienda e dalle misure del suo DVR.' : 'Qui trovi i sopralluoghi chiusi con il verbale e l’invio al DVR.'}
        </Vuoto>
      )}
      {voci && voci.length > 0 && (
        <ul className="space-y-2">
          {voci.map((r) => (
            <li key={r.id}>
              <RigaElenco r={r} onApri={() => onApri(r.id)} />
            </li>
          ))}
        </ul>
      )}
      <FoglioNuovo aperto={nuovo} aziendaId={soloAzienda} onChiudi={() => setNuovo(false)} onCreato={(id) => onApri(id)} />
    </div>
  );
}

function RigaElenco({ r, onApri }: { r: RigaSopralluogo; onApri: () => void }) {
  const pct = percentuale(r.risposte, r.voci);
  return (
    <button type="button" onClick={onApri} className="premi block w-full rounded-[1.25rem] bg-white p-4 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-muted first-letter:uppercase">{quando(r.stato === 'chiuso' ? r.chiusoIl : r.programmatoIl)}</p>
          <p className="mt-0.5 text-[16px] font-medium leading-snug text-ink">{r.azienda}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{[r.motivo, r.tecnico, r.sede].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.nonConformita > 0 && <Chip stato="danger">{r.nonConformita === 1 ? '1 non conformità' : `${r.nonConformita} non conformità`}</Chip>}
          {r.stato === 'chiuso' && r.verbale && <Chip stato={r.verbale.revisione > 0 && r.verbale.stato === 'emesso' ? 'ok' : 'approve'}>{r.verbale.revisione > 0 && r.verbale.stato === 'emesso' ? 'Verbale' : 'Verbale da emettere'}</Chip>}
          {r.inviatoDvr && <Chip stato="info">Nel DVR</Chip>}
          {r.stato === 'in_corso' && <Chip stato="run">In corso</Chip>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-perla-velo" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avanzamento">
          <div className="h-full rounded-full bg-grafite-900" style={{ width: `${pct}%` }} />
        </div>
        <span className="cifre text-[12.5px] text-ink-muted">
          {r.risposte} di {r.voci}
        </span>
      </div>
    </button>
  );
}

function FoglioNuovo({ aperto, aziendaId, onChiudi, onCreato }: { aperto: boolean; aziendaId: number | null; onChiudi: () => void; onCreato: (id: number) => void }) {
  const [aziende, setAziende] = useState<Array<{ id: number; nome: string }> | null>(null);
  const [azienda, setAzienda] = useState(aziendaId ? String(aziendaId) : '');
  const [giorno, setGiorno] = useState('');
  const [ora, setOra] = useState('09:00');
  const [motivo, setMotivo] = useState('Verifica dei punti da controllare del DVR');
  const [tipo, setTipo] = useState('periodico');
  const [sede, setSede] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    const d = new Date();
    setGiorno(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    if (aziendaId) setAzienda(String(aziendaId));
    else if (aziende === null)
      aziendeStudio()
        .then(setAziende)
        .catch((e: Error) => setErrore(e.message));
  }, [aperto, aziende, aziendaId]);

  const crea = async () => {
    if (!azienda) {
      setErrore('Scegli l’azienda.');
      return;
    }
    setInvio(true);
    setErrore(null);
    try {
      const s = await nuovoSopralluogo({ azienda_id: Number(azienda), motivo, tipo, sede: sede || undefined, programmato_il: giorno ? `${giorno} ${ora || '09:00'}` : undefined });
      onChiudi();
      onCreato(s.id);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Nuovo sopralluogo"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" onClick={crea} disabled={invio}>
            {invio ? 'Preparo la lista' : 'Avvia il sopralluogo'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-ink-muted">L&apos;assistente prepara la lista di controllo per area dal settore dell&apos;azienda e dalle misure del DVR in vigore. Puoi aggiungere voci sul posto.</p>
        {!aziendaId && (
        <Campo etichetta="Azienda">
          <select className="input-field" value={azienda} onChange={(e) => setAzienda(e.target.value)} aria-label="Azienda">
            <option value="">{aziende === null ? 'Carico le aziende' : 'Scegli l’azienda'}</option>
            {(aziende ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Giorno">
            <input type="date" className="input-field" value={giorno} onChange={(e) => setGiorno(e.target.value)} />
          </Campo>
          <Campo etichetta="Ora">
            <input type="time" className="input-field" value={ora} onChange={(e) => setOra(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Tipo">
          <select className="input-field" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPI_SOPRALLUOGO.map((t) => (
              <option key={t.v} value={t.v}>
                {t.t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Motivo">
          <input className="input-field" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <Campo etichetta="Indirizzo" aiuto="Se lo lasci vuoto uso la sede operativa dell'azienda.">
          <input className="input-field" value={sede} maxLength={300} onChange={(e) => setSede(e.target.value)} placeholder="Sede operativa" />
        </Campo>
        {errore && <Errore testo={errore} />}
      </div>
    </Foglio>
  );
}
