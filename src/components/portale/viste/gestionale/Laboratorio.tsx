'use client';

import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { EsamiLaboratorio } from './EsamiLavoratori';
import { FattureDelLaboratorio } from './PartnerFatture';
import { Avviso, Campo, ChipStato, Voce, useAziendeStudio, useAzione, useCarico } from '../amministrazione-kit';
import { azioneCampionamento, campionamenti, caricaReferto, creaCampionamento, statoCampionamento } from '@/lib/portale/amministrazione-api';
import { STATI_CAMPIONAMENTO, chip, importoDaTesto } from '@/lib/portale/amministrazione-logica';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { Piu, Provetta } from '@/components/icone';
import { usePermessiStaff } from '@/lib/portale/gestionale-permessi';

type R = Record<string, unknown>;

/** Portale del laboratorio (SPEC_GESTIONALE 21): campionamenti ambientali, rapporti nel fascicolo, proposte per le valutazioni. */
export default function Laboratorio() {
  const { versione, ricarica, apri, aziendaScelta } = usePortale();
  // 15 e 18: carica il laboratorio (caricaReferto); il coordinatore guarda in anteprima.
  const { permessi, puo } = usePermessiStaff();
  const partner = puo('caricaReferto');
  const anteprima = !partner && !permessi.esterno;
  const azId = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<'esami' | 'ambiente' | 'fatture'>('esami');
  const [nuovo, setNuovo] = useState(false);
  const [aperto, setAperto] = useState<R | null>(null);
  const { dati, errore, carica } = useCarico(() => campionamenti(azId), [versione, azId]);
  const c = dati?.conteggi ?? {};
  const aggiorna = () => {
    carica();
    ricarica();
  };

  return (
    <div className="space-y-5">
      <Testata
        categoria="servizi"
        icona={Provetta}
        sopra={aziendaScelta?.ragione_sociale ?? 'Portali dei partner'}
        titolo="Portale del laboratorio"
        sotto="Esami sui lavoratori per i medici competenti e campionamenti ambientali: vedi solo gli incarichi ricevuti."
        azioni={
          anteprima && scheda === 'ambiente' ? (
            <button type="button" className="btn-primary" onClick={() => setNuovo(true)}>
              <Piu size={16} aria-hidden /> Nuovo campionamento
            </button>
          ) : undefined
        }
      />
      {anteprima && (
        <Avviso>
          <strong className="font-medium">Anteprima del coordinatore: vedi il portale come lo vede il laboratorio</strong>
          <br />
          Mostra solo ciò che il partner può vedere.
        </Avviso>
      )}
      <Schede<'esami' | 'ambiente' | 'fatture'>
        etichetta="Portale del laboratorio"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'esami', t: 'Esami sui lavoratori', falco: 'laboratorio_esami' },
          { k: 'ambiente', t: 'Campionamenti e HACCP', n: numero(c.aperti) ?? undefined, falco: 'laboratorio_ambiente' },
          { k: 'fatture', t: 'Fatture al gestionale', falco: 'laboratorio_fatture' },
        ]}
      />
      {scheda === 'esami' && <EsamiLaboratorio />}
      {scheda === 'fatture' && <FattureDelLaboratorio />}
      {scheda === 'ambiente' && (
      <>
      <div className="grid grid-cols-2 gap-3">
        <Riquadro etichetta="Campionamenti aperti" valore={numero(c.aperti) ?? 0} />
        <Riquadro etichetta="Rapporti da applicare" valore={numero(c.da_applicare) ?? 0} tono={(numero(c.da_applicare) ?? 0) > 0 ? 'warn' : undefined} />
      </div>
      <Avviso tono="warn">Qui passano solo misure ambientali. I referti degli esami sui lavoratori vanno solo al medico competente.</Avviso>
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {!dati && !errore && <Caricamento />}
      {dati && (
        <Scheda titolo="Campionamenti">
          {dati.voci.length === 0 ? (
            <Vuoto titolo="Nessun campionamento">Richiedi un campionamento quando una valutazione ha bisogno di misure.</Vuoto>
          ) : (
            dati.voci.map((v) => (
              <Riga
                key={numero(v.id) ?? 0}
                onClick={() => {
                  setAperto(v);
                  apri({ tipo: 'campionamento', id: numero(v.id) ?? 0 }, numero(v.azienda_id));
                }}
                titolo={`${testo(v.tipo_nome)} · ${testo(v.azienda)}`}
                sotto={`${testo(v.descrizione)}${testo(v.previsto_il) ? ` · prelievo ${dataIt(testo(v.previsto_il))}` : ''}${testo(v.laboratorio) ? ` · ${testo(v.laboratorio)}` : ''}`}
                fine={<ChipStato c={chip(STATI_CAMPIONAMENTO, testo(v.stato))} />}
              />
            ))
          )}
        </Scheda>
      )}
      </>
      )}
      <FoglioNuovo aperto={nuovo} tipi={dati?.tipi ?? {}} onChiudi={() => setNuovo(false)} onFatto={() => { setNuovo(false); aggiorna(); }} />
      <FoglioCampionamento partner={partner} v={aperto} onChiudi={() => setAperto(null)} onFatto={() => { setAperto(null); aggiorna(); }} />
    </div>
  );
}

function FoglioNuovo({ aperto, tipi, onChiudi, onFatto }: { aperto: boolean; tipi: Record<string, string>; onChiudi: () => void; onFatto: () => void }) {
  const aziende = useAziendeStudio();
  const { aziendaScelta } = usePortale();
  const [f, setF] = useState({ azienda: aziendaScelta?.id ?? 0, tipo: 'rumore', punti: '', laboratorio: '', previsto_il: '' });
  const az = useAzione();
  return (
    <Foglio
      aperto={aperto}
      titolo="Nuovo campionamento"
      onChiudi={onChiudi}
      piede={
        <button
          type="button"
          className="btn-primary"
          disabled={az.occupato || !f.azienda}
          onClick={() =>
            az
              .esegui(() => creaCampionamento(f.azienda, { tipo: f.tipo, punti: f.punti.split('\n').map((x) => x.trim()).filter(Boolean), laboratorio: f.laboratorio || undefined, previsto_il: f.previsto_il || undefined }), 'Campionamento richiesto.')
              .then((ok) => ok && onFatto())
          }
        >
          Richiedi
        </button>
      }
    >
      <div className="space-y-4">
        {aziendaScelta ? (
          <p className="text-[14px] text-ink-soft">
            Per <span className="font-medium text-ink">{aziendaScelta.ragione_sociale}</span>
          </p>
        ) : (
        <Campo etichetta="Azienda">
          <select className="input-field" value={f.azienda} onChange={(e) => setF({ ...f, azienda: Number(e.target.value) })}>
            <option value={0}>Scegli l&apos;azienda</option>
            {aziende.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ragione_sociale}
              </option>
            ))}
          </select>
        </Campo>
        )}
        <Campo etichetta="Tipo">
          <select className="input-field" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(tipi).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etichetta="Punti di prelievo o postazioni" aiuto="Uno per riga.">
          <textarea className="input-field h-24 py-3" value={f.punti} onChange={(e) => setF({ ...f, punti: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Laboratorio">
            <input className="input-field" value={f.laboratorio} onChange={(e) => setF({ ...f, laboratorio: e.target.value })} />
          </Campo>
          <Campo etichetta="Prelievo previsto">
            <input className="input-field" type="date" value={f.previsto_il} onChange={(e) => setF({ ...f, previsto_il: e.target.value })} />
          </Campo>
        </div>
      </div>
      {az.messaggio}
    </Foglio>
  );
}

function FoglioCampionamento({ partner, v, onChiudi, onFatto }: { partner: boolean; v: R | null; onChiudi: () => void; onFatto: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [il, setIl] = useState('');
  const [righe, setRighe] = useState<Array<{ codice: string; descrizione: string; valore: string; picco: string }>>([{ codice: 'P1', descrizione: '', valore: '', picco: '' }]);
  const az = useAzione();
  if (!v) return <Foglio aperto={false} titolo="" onChiudi={onChiudi}>{null}</Foglio>;
  const id = numero(v.id) ?? 0;
  const tipo = testo(v.tipo) ?? '';
  const stato = testo(v.stato) ?? '';
  const proposta = v.proposta ? rec(v.proposta) : null;
  const strutturato = tipo === 'rumore' || tipo === 'legionella';
  const valori = (): R | null => {
    const piene = righe.filter((r) => importoDaTesto(r.valore) !== null);
    if (!strutturato || piene.length === 0) return null;
    return tipo === 'rumore'
      ? { postazioni: piene.map((r) => ({ codice: r.codice, descrizione: r.descrizione, leq: importoDaTesto(r.valore), lpicco: importoDaTesto(r.picco) ?? undefined })) }
      : { campionamenti: piene.map((r) => ({ impianto: r.codice, punto: r.descrizione, ufc_l: importoDaTesto(r.valore) })) };
  };
  return (
    <Foglio largo aperto titolo={`${testo(v.tipo_nome)} · ${testo(v.azienda)}`} onChiudi={onChiudi}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ChipStato c={chip(STATI_CAMPIONAMENTO, stato)} />
        </div>
        <div>
          <Voce k="Descrizione" v={testo(v.descrizione)} />
          <Voce k="Punti" v={lista(v.punti).map(String).join(', ') || 'da indicare'} />
          <Voce k="Laboratorio" v={testo(v.laboratorio) ?? 'da indicare'} />
          {testo(v.previsto_il) && <Voce k="Prelievo previsto" v={dataIt(testo(v.previsto_il))} />}
          {testo(v.referto_il) && <Voce k="Rapporto del" v={dataIt(testo(v.referto_il))} />}
        </div>
        {!partner && ['richiesto', 'programmato', 'prelievo_fatto'].includes(stato) && <Blocco>Solo il partner</Blocco>}
        {partner && ['richiesto', 'programmato'].includes(stato) && (
          <button type="button" className="btn-ghost" disabled={az.occupato} onClick={() => az.esegui(() => statoCampionamento(id, { stato: 'prelievo_fatto', prelievo_il: new Date().toISOString().slice(0, 10) }), 'Prelievo segnato.').then((ok) => ok && onFatto())}>
            Segna il prelievo fatto
          </button>
        )}
        {partner && ['richiesto', 'programmato', 'prelievo_fatto'].includes(stato) && (
          <Scheda titolo="Carica il rapporto del laboratorio" sotto="PDF firmato dal laboratorio. Entra nel fascicolo dell'azienda.">
            <div className="space-y-3">
              <input type="file" accept="application/pdf" className="block w-full text-[14px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Campo etichetta="Data del rapporto">
                <input className="input-field" type="date" value={il} onChange={(e) => setIl(e.target.value)} />
              </Campo>
              {strutturato && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink">{tipo === 'rumore' ? 'Valori misurati (LAeq in dB(A), picco in dB(C))' : 'Campioni (UFC per litro)'}</p>
                  {righe.map((r, i) => (
                    <div key={i} className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2 sm:grid-cols-[5rem_1fr_6rem_6rem]">
                      <input className="input-field" aria-label="Codice" value={r.codice} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, codice: e.target.value } : y)))} />
                      <input className="input-field" aria-label="Descrizione" placeholder={tipo === 'rumore' ? 'Postazione' : 'Punto di prelievo'} value={r.descrizione} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, descrizione: e.target.value } : y)))} />
                      <input className="input-field" aria-label={tipo === 'rumore' ? 'LAeq' : 'UFC per litro'} inputMode="decimal" placeholder={tipo === 'rumore' ? 'LAeq' : 'UFC/l'} value={r.valore} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, valore: e.target.value } : y)))} />
                      {tipo === 'rumore' && (
                        <input className="input-field hidden sm:block" aria-label="Picco" inputMode="decimal" placeholder="Picco" value={r.picco} onChange={(e) => setRighe((x) => x.map((y, j) => (j === i ? { ...y, picco: e.target.value } : y)))} />
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-ghost" onClick={() => setRighe((x) => [...x, { codice: `P${x.length + 1}`, descrizione: '', valore: '', picco: '' }])}>
                    <Piu size={16} aria-hidden /> Aggiungi una riga
                  </button>
                </div>
              )}
              <button type="button" className="btn-primary" disabled={az.occupato || !file || !il} onClick={() => file && az.esegui(() => caricaReferto(id, file, il, valori()), 'Rapporto caricato nel fascicolo.').then((ok) => ok && onFatto())}>
                Carica il rapporto
              </button>
            </div>
          </Scheda>
        )}
        {!partner && stato === 'referto_caricato' && proposta && (
          <section className="rounded-[1.25rem] bg-acido-400 p-4 text-acido-950">
            <p className="text-[13px]">Proposta per la valutazione {testo(proposta.tipo)}</p>
            <p className="mt-1 text-[16px] font-medium">{testo(proposta.sintesi)}</p>
            <p className="mt-1 text-[13px]">Applicandola i valori entrano nella valutazione in bozza: la controlli e la emetti tu.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={az.occupato} onClick={() => az.esegui(() => azioneCampionamento(id, 'applica'), 'Valori inseriti nella valutazione in bozza.').then((ok) => ok && onFatto())}>
                Applica alla valutazione
              </button>
              <button type="button" className="btn-ghost" disabled={az.occupato} onClick={() => az.esegui(() => azioneCampionamento(id, 'scarta'), 'Proposta scartata.').then((ok) => ok && onFatto())}>
                Scarta
              </button>
            </div>
          </section>
        )}
        {stato === 'applicato' && <Avviso tono="ok">Valori applicati alla valutazione {numero(v.valutazione_id) ? `n. ${numero(v.valutazione_id)}` : ''}, in bozza.</Avviso>}
      </div>
      {az.messaggio}
    </Foglio>
  );
}
