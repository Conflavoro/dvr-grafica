'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Punteggio } from '@/components/icone';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Riga, Riquadro, Scheda, Testata, Vuoto } from '../../kit';
import { isApiMode } from '@/lib/data-source';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { caricaAziende, caricaCruscotto, mappaIndicatori, type RigaAzienda } from '@/lib/portale/gestionale-api';
import { IndicatoriPilota } from './IndicatoriPilota';
import { Barra, Pallino } from './comune';
import { RiquadroLogo } from '../../RiquadroLogo';
import { usePermessiStaff } from '@/lib/portale/gestionale-permessi';

/**
 * Cruscotto della direzione dello studio (spec 18): indicatori del controllo
 * con obiettivo e soglia, carichi per tecnico, ritardi, documenti emessi,
 * costi AI e qualita' media. Solo dati aggregati.
 */

const STATO: Record<string, { chip: 'ok' | 'warn' | 'danger' | 'neutral'; testo: string }> = {
  verde: { chip: 'ok', testo: 'In obiettivo' },
  ambra: { chip: 'warn', testo: 'Da seguire' },
  rosso: { chip: 'danger', testo: 'Allarme' },
  n_d: { chip: 'neutral', testo: 'Dati insufficienti' },
};

const NOMI_DOC: Record<string, string> = {
  dvr: 'DVR approvati',
  pos: 'POS',
  valutazioni: 'Valutazioni',
  duvri: 'DUVRI',
  pimus: 'PiMUS',
  haccp: 'Manuali HACCP',
  emergenza: 'Piani di emergenza',
  sopralluogo: 'Verbali di sopralluogo',
  riunione: 'Riunioni periodiche',
  nomina: 'Nomine',
  procedura: 'Procedure',
  radon: 'Relazioni radon',
};

const euro = (v: number | null) => (v === null ? 'n.d.' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

export default function Cruscotto() {
  const { user, versione, chiedi, filtroCliente } = usePortale();
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [cliente, setCliente] = useState<RigaAzienda | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  // 14: lo vedono coordinatore, segreteria, amministrazione, vendite, direzione; le vendite solo gli indicatori commerciali.
  const { permessi, caricati } = usePermessiStaff();
  const titolare = permessi.sezioni.includes('cruscotto');
  void user;

  useEffect(() => {
    if (!titolare) return;
    caricaCruscotto()
      .then(setD)
      .catch((e: Error) => setErrore(e.message));
  }, [versione, titolare]);

  // Filtro "Solo <azienda>": la situazione del cliente in testa, gli indicatori dello studio sotto.
  useEffect(() => {
    if (!titolare || !filtroCliente) {
      setCliente(null);
      return;
    }
    let vivo = true;
    caricaAziende()
      .then((l) => vivo && setCliente(l.aziende.find((a) => a.id === filtroCliente) ?? null))
      .catch(() => vivo && setCliente(null));
    return () => {
      vivo = false;
    };
  }, [titolare, filtroCliente, versione]);

  if (!caricati) return <Caricamento testo="Carico il cruscotto" />;
  if (!titolare) {
    return (
      <div className="space-y-4">
        <Testata categoria="utenti" icona={Punteggio} sopra="Amministrazione" titolo="Cruscotto" />
        <Blocco>Il cruscotto lo vede la direzione dello studio</Blocco>
      </div>
    );
  }
  if (!isApiMode()) return <Vuoto titolo="Cruscotto">Con il backend collegato qui compaiono gli indicatori dello studio.</Vuoto>;

  if (d && d.completo === false) return <CruscottoCommerciale d={d} />;

  const esporta = () => {
    // Rapporto mensile (solo direzione): gli indicatori aggregati in un file per il foglio di calcolo.
    const righe = [['Indicatore', 'Valore', 'Obiettivo', 'Soglia', 'Stato'], ...ind.map((x) => [testo(x.nome) ?? '', String(numero(x.valore) ?? ''), String(numero(x.obiettivo) ?? ''), String(numero(x.soglia) ?? ''), STATO[testo(x.stato) ?? 'n_d']?.testo ?? ''])];
    const csv = righe.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rapporto-mensile-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const ctl = rec(d?.controllo);
  const ind = lista(ctl.indicatori).map(rec);
  const rie = rec(ctl.riepilogo);
  const ag = rec(ctl.agenti);
  const car = lista(d?.carichi).map(rec);
  const rit = rec(d?.ritardi);
  const doc = rec(d?.documenti);
  const cost = rec(d?.costi_ai);
  const q = rec(d?.qualita);
  const pilota = mappaIndicatori(d?.indicatori);
  const sintesi = rec(d?.sintesi);
  const oggiLungo = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      <Testata
        categoria="utenti"
        icona={Punteggio}
        sopra="Amministrazione"
        titolo="Cruscotto"
        sotto={
          d
            ? pilota.length > 0
              ? `Dati al ${oggiLungo} · ${numero(sintesi.ok) ?? 0} in obiettivo, ${numero(sintesi.warn) ?? 0} da seguire, ${numero(sintesi.danger) ?? 0} in allarme`
              : `Ultimi ${numero(ctl.periodo_giorni) ?? 90} giorni · ${numero(rie.verde) ?? 0} in obiettivo, ${numero(rie.ambra) ?? 0} da seguire, ${numero(rie.rosso) ?? 0} in allarme`
            : 'Carico gli indicatori'
        }
        azioni={
          <>
            {d?.puo_esportare === true && (
              <button type="button" className="btn-ghost" onClick={esporta}>
                Esporta il rapporto mensile
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => chiedi('Leggimi il cruscotto: cosa va bene, cosa è in allarme e perché, chi ha più carico.')}>
              Chiedi a Falco
            </button>
          </>
        }
      />
      {cliente && (
        <Scheda titolo={cliente.ragione_sociale} sotto={cliente.stato === 'ok' ? 'Tutto in regola' : cliente.motivo}>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Riquadro etichetta="Scadenze superate" valore={cliente.scadute} tono={cliente.scadute > 0 ? 'danger' : undefined} />
            <Riquadro etichetta="Entro 30 giorni" valore={cliente.entro30} tono={cliente.entro30 > 0 ? 'warn' : undefined} />
            <Riquadro etichetta="In coda" valore={cliente.codaAperte} sotto={cliente.tecnico ? `Tecnico ${cliente.tecnico.nome}` : 'Nessun tecnico assegnato'} />
            <Riquadro etichetta="Safety Score" valore={cliente.safetyScore} unita="/100" sotto={cliente.dvr ? `DVR versione ${cliente.dvr.versione}` : 'DVR da preparare'} />
          </div>
          <Link href={`/gestionale/aziende/?id=${cliente.id}`} className="btn-ghost mt-3 inline-flex">
            Apri la scheda dell’azienda
          </Link>
        </Scheda>
      )}
      {cliente && <h2 className="px-1 pt-1 text-[15px] font-medium text-ink">Tutto lo studio</h2>}
      <RiquadroLogo tipo="studio" />
      {errore && <Errore testo={errore} />}
      {!d && !errore && <Caricamento testo="Carico il cruscotto" />}
      {d && pilota.length > 0 && <IndicatoriPilota indicatori={pilota} completo />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Riquadro nero etichetta="In ritardo nello studio" valore={numero(rit.totale) ?? 0} sotto="Compiti e proposte oltre il termine" />
            <Riquadro etichetta="Documenti emessi" valore={numero(doc.totale) ?? 0} sotto={`Ultimi ${numero(doc.giorni) ?? 30} giorni · ${numero(doc.in_attesa_firma) ?? 0} DVR in revisione`} />
            <Riquadro etichetta="Costi AI del mese" valore={euro(numero(cost.mese_eur))} sotto={`Mese scorso ${euro(numero(cost.mese_precedente_eur))} · ${numero(cost.chiamate_mese) ?? 0} chiamate`} />
            <Riquadro etichetta="Qualità media" valore={numero(q.media)?.toLocaleString('it-IT') ?? null} unita="/100" sotto={`${numero(q.documenti) ?? 0} documenti emessi in 90 giorni`} />
          </div>

          <Scheda titolo="Carichi per persona" sotto="Aziende assegnate, cose aperte, in ritardo e chiuse negli ultimi 7 giorni.">
            {car.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Nessuna persona nello studio.</p>
            ) : (
              <ul>
                {car.map((c, i) => {
                  const p = rec(c.persona);
                  const nome = testo(p.nome) ?? 'Non assegnate';
                  return (
                    <li key={i}>
                      <Riga
                        inizio={<Pallino nome={nome} scuro={!!testo(p.nome)} />}
                        titolo={nome}
                        sotto={`${numero(c.aziende) ?? 0} aziende · ${numero(c.aperte) ?? 0} aperte di cui ${numero(c.proposte) ?? 0} proposte · ${numero(c.fatte_7_giorni) ?? 0} chiuse in 7 giorni`}
                        fine={(numero(c.in_ritardo) ?? 0) > 0 ? <Chip stato="danger">{`${numero(c.in_ritardo)} in ritardo`}</Chip> : <Chip stato="ok">Nei tempi</Chip>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>

          <div className="grid gap-4 xl:grid-cols-2">
            <Scheda titolo="Ritardi" sotto="I più vecchi per primi.">
              {lista(rit.primi).length === 0 ? (
                <p className="text-[14px] text-ink-muted">Niente in ritardo.</p>
              ) : (
                <ul>
                  {lista(rit.primi).map((x, i) => {
                    const r = rec(x);
                    return (
                      <li key={i}>
                        <Link href={`/gestionale/coda/?el=${testo(r.chiave)}`} className="block hover:bg-perla-velo/50">
                          <Riga titolo={testo(r.titolo) ?? ''} sotto={testo(r.azienda) ?? undefined} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Scheda>
            <Scheda titolo="Documenti emessi" sotto={`Ultimi ${numero(doc.giorni) ?? 30} giorni.`}>
              {Object.entries(rec(doc.per_tipo)).filter(([, n]) => Number(n) > 0).length === 0 ? (
                <p className="text-[14px] text-ink-muted">Nessun documento emesso.</p>
              ) : (
                <ul>
                  {Object.entries(rec(doc.per_tipo))
                    .filter(([, n]) => Number(n) > 0)
                    .map(([k, n]) => (
                      <li key={k} className="flex min-h-[44px] items-center justify-between border-b border-perla-linea last:border-b-0">
                        <span className="text-[14px] text-ink">{NOMI_DOC[k] ?? k}</span>
                        <span className="cifre text-[14px] text-ink-muted">{Number(n)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Scheda>
            <Scheda titolo="Costi AI del mese" sotto={testo(cost.nota) ?? undefined}>
              {lista(cost.per_operazione).length === 0 ? (
                <p className="text-[14px] text-ink-muted">Nessuna chiamata questo mese.</p>
              ) : (
                <ul>
                  {lista(cost.per_operazione).map((x, i) => {
                    const r = rec(x);
                    return (
                      <li key={i} className="flex min-h-[44px] items-center justify-between gap-3 border-b border-perla-linea last:border-b-0">
                        <span className="text-[14px] text-ink">{testo(r.operazione)}</span>
                        <span className="cifre text-[14px] text-ink-muted">
                          {euro(numero(r.eur))} · {numero(r.chiamate)} chiamate
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {lista(cost.per_persona).length > 0 && (
                <p className="mt-3 text-[13px] text-ink-muted">Per persona: {lista(cost.per_persona).map((x) => `${testo(rec(x).persona)} ${euro(numero(rec(x).eur))}`).join(', ')}</p>
              )}
            </Scheda>
            <Scheda titolo="Qualità dei documenti" sotto={testo(q.nota) ?? undefined}>
              {lista(q.per_tipo).length === 0 ? (
                <p className="text-[14px] text-ink-muted">Nessun documento emesso con la scheda di qualità.</p>
              ) : (
                <ul className="space-y-3">
                  {lista(q.per_tipo).map((x, i) => {
                    const r = rec(x);
                    const m = numero(r.media) ?? 0;
                    return (
                      <li key={i}>
                        <p className="flex justify-between text-[14px] text-ink">
                          <span>{NOMI_DOC[testo(r.tipo) ?? ''] ?? testo(r.tipo)}</span>
                          <span className="cifre text-ink-muted">
                            {m} su 100 · {numero(r.documenti)}
                          </span>
                        </p>
                        <div className="mt-1.5">
                          <Barra pct={m} tono={m >= 80 ? 'ok' : m >= 60 ? 'warn' : 'danger'} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Scheda>
          </div>

          <Scheda titolo="Indicatori del controllo" sotto={testo(ctl.nota) ?? 'Obiettivi e soglie sono proposte di lavoro, da confermare con la direzione.'}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ind.map((x) => {
                const st = STATO[testo(x.stato) ?? 'n_d'] ?? STATO.n_d;
                const v = numero(x.valore);
                return (
                  <li key={testo(x.codice) ?? ''} className="rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-medium leading-snug text-ink">{testo(x.nome)}</p>
                      <Chip stato={st.chip}>{st.testo}</Chip>
                    </div>
                    <p className="cifre mt-2 text-[32px] font-light tracking-[-0.03em] text-ink">
                      {v === null ? 'n.d.' : v.toLocaleString('it-IT')}
                      {v !== null && testo(x.unita) === '%' && <span className="text-[16px] text-ink-muted">%</span>}
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-muted">
                      obiettivo {String(x.obiettivo)}
                      {testo(x.unita) === '%' ? '%' : ''} · soglia {String(x.soglia)}
                      {testo(x.unita) === '%' ? '%' : ''}
                      {numero(x.base) ? ` · su ${numero(x.base)}` : ''}
                    </p>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{testo(x.come)}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[13px] text-ink-muted">
              Assistenti: {numero(ag.proposte_oggi) ?? 0} proposte oggi, {numero(ag.in_attesa) ?? 0} in attesa, {numero(ag.approvate_su_decise) ?? 'n.d.'}% approvate sulle decise.
            </p>
          </Scheda>
        </>
      )}
    </div>
  );
}

/** Vendite (14): solo gli indicatori commerciali, solo aggregati. */
function CruscottoCommerciale({ d }: { d: Record<string, unknown> }) {
  const ind = lista(rec(d.controllo).indicatori).map(rec);
  const pilota = mappaIndicatori(d.indicatori);
  return (
    <div className="space-y-5">
      <Testata categoria="utenti" icona={Punteggio} sopra="Amministrazione" titolo="Cruscotto" sotto="Indicatori commerciali" />
      {pilota.length > 0 && <IndicatoriPilota indicatori={pilota} completo={false} />}
      <div className={pilota.length > 0 ? 'hidden' : 'grid grid-cols-2 gap-3 xl:grid-cols-4'}>
        {ind.map((x) => (
          <Riquadro key={testo(x.codice) ?? ''} etichetta={testo(x.nome) ?? ''} valore={numero(x.valore)} />
        ))}
      </div>
      <p className="text-[13px] text-ink-muted">Solo dati aggregati.</p>
    </div>
  );
}
