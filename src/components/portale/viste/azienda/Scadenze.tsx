'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Riquadro, Schede, Scheda, Testata, Vuoto } from '../../kit';
import { Campanella, Calendario, Elenco, Regolazioni, Scarica } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import { formazione as caricaFormazione, scadenziario, type CategoriaScadenza, type Fase, type Finestra, type Formazione, type VoceScadenza } from '@/lib/portale/area-api';
import { NOMI_CATEGORIA, NOMI_FASE, SEGNO_CATEGORIA, bloccoData, filtraVoci, giorniMese, giornoScelto, giorniTesto, perMese, testoChip } from '@/lib/portale/area-logica';
import { hrefArea, linkCalendario, mappaPromemoria, type Promemoria } from '@/lib/portale/area-operativita';
import { Avviso, Pillole, useCarica } from './comuni';
import { FoglioIscrivi, FoglioPrenotaVisita, FoglioPromemoria, giornoLungo } from './FogliOperativita';

const FINESTRE: Record<Finestra, number | null> = { '30': 30, '60': 60, '90': 90, tutte: null };
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const oggiIso = () => iso(new Date());
const plurale = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;

/** Scadenziario (04, 05 par. 8.4): finestre, categorie e fase, elenco per mese o calendario, promemoria. */
export default function Scadenze() {
  const { azienda, versione, sede } = usePortale();
  const [finestra, setFinestra] = useState<Finestra>('30');
  const [categorie, setCategorie] = useState<CategoriaScadenza[]>([]);
  const [fase, setFase] = useState<Fase | null>(null);
  const [vista, setVista] = useState<'elenco' | 'calendario'>('elenco');
  const [giorno, setGiorno] = useState<string | null>(null);
  const [prenota, setPrenota] = useState<VoceScadenza | null>(null);
  const [iscrivi, setIscrivi] = useState<{ v: VoceScadenza; f: Formazione } | null>(null);
  const [promemoria, setPromemoria] = useState<Promemoria | null>(null);
  const [foglioPromemoria, setFoglioPromemoria] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);
  const aid = azienda?.id ?? 0;
  const { dati, errore, carica, caricando } = useCaricaScadenze(aid, finestra, versione, sede);

  const voci = useMemo(() => (dati ? filtraVoci(dati.voci, categorie, fase) : []), [dati, categorie, fase]);
  const gruppi = useMemo(() => perMese(voci), [voci]);
  if (!azienda) return null;
  const c = dati?.contatori;
  const p = promemoria ?? (dati?.promemoria ? mappaPromemoria(dati.promemoria) : null);
  const filtri = categorie.length > 0 || fase !== null;
  const togli = () => (setCategorie([]), setFase(null));

  const esporta = async () => {
    try {
      const XLSX = await import('xlsx');
      const righe = voci.map((v) => ({ Categoria: NOMI_CATEGORIA[v.categoria], Scadenza: v.titolo, Dettaglio: v.sotto, Data: v.data ?? 'Mai fatta', Fase: testoChip(v) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righe), 'Scadenze');
      XLSX.writeFile(wb, `Scadenze · ${azienda.ragione_sociale}.xlsx`);
      setAvviso(`Esportate ${voci.length} scadenze in Excel`);
    } catch {
      setAvviso('Esportazione non riuscita. Riprova.');
    }
  };
  const calendario = async () => {
    try {
      const url = await linkCalendario();
      await navigator.clipboard?.writeText(url);
      setAvviso('Link del calendario copiato: incollalo in Google, Outlook o Apple');
    } catch (e) {
      setAvviso(e instanceof Error && e.message ? e.message : 'Link del calendario non disponibile.');
    }
  };
  const apriIscrivi = async (v: VoceScadenza) => {
    try {
      const f = await caricaFormazione(aid);
      if (f) setIscrivi({ v, f });
    } catch (e) {
      setAvviso(e instanceof Error ? e.message : 'Formazione non disponibile.');
    }
  };
  const azione = (v: VoceScadenza) => {
    if (v.azione === 'prenota' && dati?.permessi.prenota && v.lavoratoreId)
      return (
        <button type="button" className="btn-primary min-h-[40px] px-3" onClick={() => setPrenota(v)}>
          Prenota
        </button>
      );
    if (v.azione === 'iscrivi' && dati?.permessi.iscrivi && v.lavoratoreId)
      return (
        <button type="button" className="btn-primary min-h-[40px] px-3" onClick={() => void apriIscrivi(v)}>
          Iscrivi
        </button>
      );
    const testo = v.azione === 'apri_documento' ? 'Apri il documento' : v.azione === 'vedi_rinnovo' ? 'Vedi il rinnovo' : 'Vedi';
    return (
      <Link href={hrefArea(v.link)} className={clsx('min-h-[40px] px-3', v.azione === 'vedi' || v.azione === 'prenota' || v.azione === 'iscrivi' ? 'btn-ghost' : 'btn-primary')}>
        {testo}
      </Link>
    );
  };
  const n = FINESTRE[finestra];

  return (
    <div className="space-y-5">
      <Testata
        categoria="scadenze"
        icona={Calendario}
        sopra={azienda.ragione_sociale}
        titolo="Scadenziario"
        sotto={c ? `${c.scadute} scadute · ${c.allarme} in allarme · ${c.daPrenotare} da prenotare ${n === null ? 'in totale' : `entro ${n} giorni`}` : undefined}
        azioni={
          <>
            <button type="button" className="btn-ghost" onClick={() => void esporta()}>
              <Scarica size={16} aria-hidden /> Esporta in Excel
            </button>
            <button type="button" className="btn-primary" onClick={() => void calendario()}>
              <Calendario size={16} aria-hidden /> Aggiungi al calendario
            </button>
          </>
        }
      />

      <Schede<Finestra>
        etichetta="Finestra"
        attiva={finestra}
        onCambia={setFinestra}
        voci={[
          { k: '30', t: 'Entro 30 giorni', n: c?.badge30, falco: 'finestra_30' },
          { k: '60', t: 'Entro 60 giorni', falco: 'finestra_60' },
          { k: '90', t: 'Entro 90 giorni', falco: 'finestra_90' },
          { k: 'tutte', t: 'Tutte', falco: 'finestra_tutte' },
        ]}
      />

      {avviso && (
        <div role="status" className="flex items-center gap-3">
          <Avviso>{avviso}</Avviso>
          <button type="button" className="btn-ghost min-h-[40px]" onClick={() => setAvviso(null)}>
            Chiudi
          </button>
        </div>
      )}
      {errore && <Errore testo={errore} onRiprova={carica} />}
      {caricando && !dati && <Caricamento />}

      {dati && c && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Riquadro etichetta="Scadute o mai fatte" valore={c.scadute} tono={c.scadute > 0 ? 'danger' : undefined} sotto="Da sistemare subito" />
            <Riquadro
              etichetta="Entro 15 giorni senza prenotazione"
              valore={c.allarme}
              nero={c.allarme > 0}
              sotto={c.allarme > 0 ? 'Allarme inviato a titolare e referente' : 'Nessun allarme attivo'}
            />
            <Riquadro etichetta="Da prenotare" valore={c.daPrenotare} sotto="Nessun appuntamento fissato" />
            <Riquadro etichetta="Prenotate o in calendario" valore={c.prenotate} />
          </div>

          <div className="space-y-2">
            <Pillole<CategoriaScadenza | 'tutte'>
              etichetta="Categorie"
              voci={[
                { k: 'tutte' as const, t: 'Tutte le categorie' },
                ...dati.categorie.map((x) => ({ k: x.k, t: x.t, n: dati.voci.filter((v) => v.categoria === x.k).length, segno: SEGNO_CATEGORIA[x.k] })),
              ]}
              scelte={categorie.length === 0 ? ['tutte'] : categorie}
              onCambia={(k) => (k === 'tutte' ? setCategorie([]) : setCategorie((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])))}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Pillole<Fase>
                  etichetta="Fase"
                  voci={(Object.keys(NOMI_FASE) as Fase[]).map((k) => ({
                    k,
                    t: NOMI_FASE[k],
                    n: dati.voci.filter((v) => v.fase === k).length,
                    segno: k === 'scaduta' ? 'bg-stato-danger-segno' : k === 'prenotata' ? 'bg-stato-info-segno' : 'bg-stato-warn-segno',
                  }))}
                  scelte={fase ? [fase] : []}
                  onCambia={(k) => setFase((f) => (f === k ? null : k))}
                />
              </div>
              <div role="tablist" aria-label="Vista" className="flex shrink-0 gap-1 rounded-full bg-perla-velo p-1">
                {(['elenco', 'calendario'] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={clsx('inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium', vista === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>
                    {k === 'elenco' ? <Elenco size={15} aria-hidden /> : <Calendario size={15} aria-hidden />}
                    {k === 'elenco' ? 'Elenco' : 'Calendario'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-3">
              <p className="text-[13px] text-ink-muted">
                {plurale(voci.length, 'scadenza', 'scadenze')}
                {finestra !== 'tutte' ? ', comprese le scadute e le mai fatte' : ''}
                {filtri && (
                  <>
                    {' · '}
                    <button type="button" className="underline underline-offset-2" onClick={togli}>
                      Togli i filtri
                    </button>
                  </>
                )}
              </p>
              {voci.length === 0 ? (
                <Vuoto
                  titolo="Nessuna scadenza con questi filtri"
                  azione={
                    <button type="button" className="btn-ghost" onClick={togli}>
                      Togli i filtri
                    </button>
                  }
                >
                  Allarga la finestra o togli i filtri per vedere le altre.
                </Vuoto>
              ) : vista === 'elenco' ? (
                gruppi.map((g) => (
                  <Scheda
                    key={g.chiave}
                    titolo={g.titolo.charAt(0).toUpperCase() + g.titolo.slice(1)}
                    sotto={
                      <>
                        {plurale(g.voci.length, 'scadenza', 'scadenze')}
                        {g.scadute ? <span className="text-stato-danger-ink"> · {g.scadute} scadute</span> : null}
                      </>
                    }
                  >
                    <ul>
                      {g.voci.map((v) => (
                        <li key={v.chiave}>
                          <RigaVoce v={v} azione={azione(v)} />
                        </li>
                      ))}
                    </ul>
                  </Scheda>
                ))
              ) : (
                <VistaCalendario voci={voci} giorno={giorno} onGiorno={setGiorno} azione={azione} onElenco={() => setVista('elenco')} />
              )}
            </div>
            <aside className="space-y-4">
              {p && (
                <Scheda
                  titolo="Impostazioni dei promemoria"
                  azioni={
                    <button type="button" className="btn-ghost min-h-[40px] px-3" onClick={() => setFoglioPromemoria(true)}>
                      <Regolazioni size={15} aria-hidden /> Modifica
                    </button>
                  }
                >
                  <div className="space-y-3 text-[13.5px]">
                    <div>
                      <p className="text-ink-muted">Ti avvisiamo prima della scadenza</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {p.anticipi.length === 0 ? <span className="text-ink-muted">Nessun anticipo attivo</span> : p.anticipi.map((g) => <Chip key={g} stato="neutral">{`${g} giorni`}</Chip>)}
                      </div>
                    </div>
                    <p className="flex items-start gap-2">
                      <Campanella size={16} aria-hidden className={clsx('mt-0.5 shrink-0', p.allarme ? 'text-stato-danger-segno' : 'text-grafite-300')} />
                      <span>
                        <span className="block text-ink">Allarme a 15 giorni</span>
                        <span className="block text-ink-muted">{p.allarme ? 'Se la scadenza non è ancora prenotata' : 'Disattivato'}</span>
                      </span>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-ink-muted">Canali</span>
                      <span className="text-ink">{p.canali.map((x) => (x === 'email' ? 'Email' : 'WhatsApp')).join(', ')}</span>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-ink-muted">Destinatari</span>
                      <span className="text-ink">{p.destinatari.map((x) => (x === 'titolare' ? 'Titolare' : 'Referente')).join(', ')}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-muted">Su WhatsApp mai dalle 20 alle 8 e nei festivi. I lavoratori ricevono i loro promemoria a parte.</p>
                  </div>
                </Scheda>
              )}
              <Scheda titolo="Porta le scadenze fuori">
                <div className="space-y-2">
                  <button type="button" className="btn-ghost w-full" onClick={() => void esporta()}>
                    Esporta in Excel
                  </button>
                  <button type="button" className="btn-ghost w-full" onClick={() => void calendario()}>
                    Aggiungi al calendario
                  </button>
                  <p className="text-[12.5px] text-ink-muted">Il calendario si aggiorna da solo: funziona con Google, Outlook e Apple.</p>
                </div>
              </Scheda>
            </aside>
          </div>
        </>
      )}

      {prenota && prenota.lavoratoreId && (
        <FoglioPrenotaVisita
          aziendaId={aid}
          lavoratore={{ id: prenota.lavoratoreId, nome: prenota.titolo.replace(/^(Visita periodica di|Prima visita di|Visita [a-z ]+ di)\s+/i, ''), mansione: prenota.sotto }}
          persone={[]}
          onChiudi={() => setPrenota(null)}
          onFatto={carica}
        />
      )}
      {iscrivi && (
        <FoglioIscrivi
          aziendaId={aid}
          corsi={iscrivi.f.catalogo.filter((k) => !k.aPagamento)}
          classi={iscrivi.f.classi}
          persone={iscrivi.f.persone.map((x) => ({ id: x.id, nome: x.nome, mansione: x.mansione, stati: Object.fromEntries(x.corsi.map((k) => [k.codice, k.stato])) }))}
          corsoIniziale={iscrivi.v.corso}
          lavoratoriIniziali={iscrivi.v.lavoratoreId ? [iscrivi.v.lavoratoreId] : []}
          onChiudi={() => setIscrivi(null)}
          onFatto={carica}
        />
      )}
      {foglioPromemoria && p && (
        <FoglioPromemoria
          aziendaId={aid}
          iniziale={p}
          onChiudi={() => setFoglioPromemoria(false)}
          onFatto={(x) => (setPromemoria(x), setFoglioPromemoria(false), setAvviso('Promemoria aggiornati'))}
        />
      )}
    </div>
  );
}

function useCaricaScadenze(aid: number, finestra: Finestra, versione: number, sede: number | null) {
  return useCarica(() => scadenziario(aid, finestra, sede), [aid, finestra, versione, sede]);
}

function RigaVoce({ v, azione }: { v: VoceScadenza; azione: React.ReactNode }) {
  const d = bloccoData(v.data);
  return (
    <div className="flex min-h-[64px] w-full flex-wrap items-center gap-3 border-b border-perla-linea py-2.5 last:border-b-0">
      <span className="w-12 shrink-0 text-center">
        <span className="cifre block text-[20px] font-light leading-none text-ink">{d.giorno || 'n.d.'}</span>
        <span className="block text-[11.5px] text-ink-muted">{d.mese}</span>
      </span>
      <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', SEGNO_CATEGORIA[v.categoria])} />
      <span className="min-w-0 flex-1">
        <Link href={hrefArea(v.link)} className="block truncate text-[14.5px] font-medium text-ink hover:underline">
          {v.titolo}
        </Link>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
          {[NOMI_CATEGORIA[v.categoria], v.sotto, v.data ? giorniTesto(v.giorni) : 'mai fatta', v.appuntamento ? `visita il ${v.appuntamento.slice(8, 10)}/${v.appuntamento.slice(5, 7)}` : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      {v.allarme && (
        <span title="Scade entro 15 giorni e non è prenotata" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-stato-danger-ink">
          <Campanella size={14} aria-hidden /> Allarme
        </span>
      )}
      <Chip stato={v.stato}>{testoChip(v)}</Chip>
      <span className="flex w-36 shrink-0 justify-end">{azione}</span>
    </div>
  );
}

function VistaCalendario({ voci, giorno, onGiorno, azione, onElenco }: { voci: VoceScadenza[]; giorno: string | null; onGiorno: (g: string) => void; azione: (v: VoceScadenza) => React.ReactNode; onElenco: () => void }) {
  const oggi = new Date();
  const mesi = [0, 1, 2].map((i) => new Date(oggi.getFullYear(), oggi.getMonth() + i, 1));
  const primo = iso(mesi[0]).slice(0, 7);
  const ultimo = iso(new Date(oggi.getFullYear(), oggi.getMonth() + 3, 0));
  const perGiorno = new Map<string, VoceScadenza[]>();
  voci.forEach((v) => v.data && perGiorno.set(v.data, [...(perGiorno.get(v.data) ?? []), v]));
  const nelPeriodo = Array.from(perGiorno.keys()).filter((g) => g >= `${primo}-01` && g <= ultimo);
  const scelto = giornoScelto(nelPeriodo, giorno, oggiIso());
  const senzaData = voci.filter((v) => !v.data).length;
  const fuori = voci.filter((v) => v.data && (v.data < `${primo}-01` || v.data > ultimo)).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        {mesi.map((m) => (
          <Scheda key={m.getMonth()} titolo={`${MESI[m.getMonth()].charAt(0).toUpperCase()}${MESI[m.getMonth()].slice(1)} ${m.getFullYear()}`}>
            <div className="grid grid-cols-7 gap-1 text-center text-[12.5px]">
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((x, i) => (
                <span key={i} className="py-1 text-ink-muted">
                  {x}
                </span>
              ))}
              {giorniMese(m.getFullYear(), m.getMonth()).map((g, i) => {
                if (!g) return <span key={i} />;
                const vs = perGiorno.get(g) ?? [];
                const oggiG = g === oggiIso();
                if (vs.length === 0) return <span key={g} className={clsx('cifre grid aspect-square place-items-center rounded-[0.5rem] text-grafite-300', oggiG && 'ring-2 ring-inset ring-oro-500')}>{Number(g.slice(8))}</span>;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-label={`${Number(g.slice(8))} ${MESI[m.getMonth()]}: ${vs.length} scadenze`}
                    onClick={() => onGiorno(g)}
                    className={clsx('cifre flex aspect-square flex-col items-center justify-center rounded-[0.5rem]', g === scelto ? 'bg-grafite-900 text-white' : 'hover:bg-perla-velo', oggiG && g !== scelto && 'ring-2 ring-inset ring-oro-500')}
                  >
                    {Number(g.slice(8))}
                    <span className="mt-0.5 flex gap-0.5">
                      {vs.slice(0, 4).map((v) => (
                        <span key={v.chiave} className={clsx('h-1.5 w-1.5 rounded-full', SEGNO_CATEGORIA[v.categoria])} />
                      ))}
                      {vs.length > 4 && <span className="text-[9px] leading-none">+{vs.length - 4}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Scheda>
        ))}
      </div>
      {(senzaData > 0 || fuori > 0) && (
        <p className="text-[12.5px] text-ink-muted">
          {[senzaData > 0 ? `${senzaData} senza data` : null, fuori > 0 ? `${fuori} fuori da questi tre mesi` : null].filter(Boolean).join(' · ')}: le trovi nella{' '}
          <button type="button" className="underline underline-offset-2" onClick={onElenco}>
            vista elenco
          </button>
        </p>
      )}
      {scelto ? (
        <Scheda titolo={giornoLungo(scelto)} sotto={giorniTesto(Math.round((new Date(`${scelto}T12:00:00`).getTime() - new Date(`${oggiIso()}T12:00:00`).getTime()) / 86400000)).replace('scaduta da', 'passato da')}>
          <ul>
            {(perGiorno.get(scelto) ?? []).map((v) => (
              <li key={v.chiave}>
                <RigaVoce v={v} azione={azione(v)} />
              </li>
            ))}
          </ul>
        </Scheda>
      ) : (
        <Vuoto titolo="Nessun giorno con scadenze">Nessuna scadenza in questi tre mesi con questi filtri.</Vuoto>
      )}
    </div>
  );
}
