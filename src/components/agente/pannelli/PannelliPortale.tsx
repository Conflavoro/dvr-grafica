'use client';

import { useState } from 'react';
import { Avviso, Calendario, Cartella, Cerchio, CerchioSpunta, Condividi, Elenco, PersonaVerificata, Punteggio, Sopralluogo, Spunta, Storico } from '@/components/icone';
import type { Pannello, PropostaAgenteVoce, Role } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { conTempoMassimo, TEMPI } from '@/lib/attesa';
import { clsx } from '@/lib/clsx';
import { BTN, CartaPannello, Vuoto, dataBreve, puoScrivere, useAzioniPannelli } from './contesto';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** "2026-10-20 09:30" (ora italiana dal backend) o ISO. */
export function quandoBreve(s: string | null): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const g = new Date(`${s}T12:00:00`);
    return Number.isNaN(g.getTime()) ? s : fmtGiorno.format(g);
  }
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? s.replace(' ', 'T') : s);
  return Number.isNaN(d.getTime()) ? s : fmtOra.format(d);
}

// ------------------------------------------------------------------
// Scheda di avvio
// ------------------------------------------------------------------
const STATO_PASSO = {
  fatto: { l: 'Fatto', cls: 'text-ok-ink', Icona: CerchioSpunta },
  in_corso: { l: 'In corso', cls: 'text-brand-700', Icona: Storico },
  da_fare: { l: 'Da fare', cls: 'text-oro-700', Icona: Cerchio },
  in_attesa: { l: 'In attesa', cls: 'text-ink-muted', Icona: Cerchio },
} as const;

export function PannelloSchedaAvvio({ p }: { p: P<'scheda_avvio'> }) {
  const az = useAzioniPannelli();
  const fatti = p.passi.filter((x) => x.stato === 'fatto').length;
  const nome = (p.azienda_id && az.nomeAzienda(p.azienda_id)) || 'l’azienda';
  const richiesta: Record<number, string> = {
    2: `Rivediamo insieme i dati letti dai documenti di ${nome} da confermare`,
    3: `Aiutami a completare i dati che mancano per ${nome}`,
    4: `Invita gli utenti di ${nome}: referente, consulente del lavoro e medico competente`,
  };
  return (
    <CartaPannello icona={Sopralluogo} titolo="Scheda di avvio" sottotitolo={`${fatti} passi su ${p.passi.length} completati`}>
      {p.in_ritardo && (
        <p role="alert" className="mb-3 flex gap-2 rounded-[0.875rem] bg-danger px-3 py-2 text-[12.5px] font-medium text-danger-ink">
          <Avviso size={15} aria-hidden className="mt-0.5 shrink-0" />
          Il fascicolo doveva essere aperto entro 48 ore dal pagamento.
        </p>
      )}
      <ol className="space-y-2">
        {p.passi.map((x) => {
          const s = STATO_PASSO[x.stato];
          return (
            <li key={x.numero} className="rounded-[0.875rem] bg-perla-superficie px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]">
              <p className="flex items-center gap-2">
                <s.Icona size={17} aria-hidden className={s.cls} />
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
                  {x.numero}. {x.nome}
                </span>
                <span className={clsx('shrink-0 text-[11.5px] font-semibold', s.cls)}>{s.l}</span>
              </p>
              {x.dettagli.length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-6 text-[12.5px] text-ink-soft">
                  {x.dettagli.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              {x.da_confermare.length > 0 && (
                <ul className="mt-1 space-y-0.5 pl-6 text-[12.5px] text-ink">
                  {x.da_confermare.map((d) => (
                    <li key={d.proposta_id}>{d.titolo}</li>
                  ))}
                </ul>
              )}
              {x.nota && x.stato !== 'fatto' && <p className="mt-1 pl-6 text-[11.5px] text-ink-muted">{x.nota}</p>}
              {x.stato === 'da_fare' && richiesta[x.numero] && (puoScrivere(az.ruolo) || az.ruolo === 'datore_lavoro') && (
                <button type="button" disabled={az.occupato} onClick={() => az.invia(richiesta[x.numero])} className={clsx(BTN, 'mt-1.5 ml-4')}>
                  Fallo con l’agente
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {p.note.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px] text-ink-soft">
          {p.note.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Coda di lavoro: proposte dell'agente da approvare
// ------------------------------------------------------------------
const NOME_PROPOSTA: Record<string, string> = {
  dati_azienda: 'Dati dell’azienda',
  scadenza: 'Scadenza',
  lavoratore: 'Lavoratore',
  servizio: 'Ordine',
  attivita: 'Attività',
};

const STATO_PROPOSTA: Record<PropostaAgenteVoce['stato'], { l: string; cls: string }> = {
  in_attesa: { l: 'In attesa', cls: 'bg-oro-100 text-oro-700' },
  approvata: { l: 'Approvata', cls: 'bg-ok text-ok-ink' },
  respinta: { l: 'Respinta', cls: 'bg-grafite-100 text-grafite-600' },
  errore: { l: 'Non applicata', cls: 'bg-danger text-danger-ink' },
};

/**
 * Chi puo' decidere (il backend ricontrolla sempre): gli ordini li approva il
 * titolare dell'azienda; dati dell'azienda e lavoratori anche il referente;
 * scadenze e attivita' lo studio.
 */
export function puoDecidere(ruolo: Role | null, tipo: string): boolean {
  if (tipo === 'servizio') return ruolo === 'datore_lavoro';
  if (tipo === 'dati_azienda' || tipo === 'lavoratore') return ruolo !== null;
  return puoScrivere(ruolo);
}

function RigaProposta({ iniziale }: { iniziale: PropostaAgenteVoce }) {
  const az = useAzioniPannelli();
  const ds = useDataSource();
  const [p, setP] = useState(iniziale);
  const [lavoro, setLavoro] = useState<'approva' | 'respingi' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);
  const decide = puoDecidere(az.ruolo, p.tipo) && p.stato === 'in_attesa';

  const decidi = async (d: 'approva' | 'respingi') => {
    setLavoro(d);
    setErr(null);
    try {
      setP(await conTempoMassimo(ds.coda.decidi(p.id, d), TEMPI.breve, 'Il server non ha confermato la decisione in tempo. Riprova: se era già registrata, la proposta risulterà decisa.'));
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : 'Decisione non registrata.');
    } finally {
      setLavoro(null);
    }
  };

  const st = STATO_PROPOSTA[p.stato];
  return (
    <li className="py-2.5">
      <p className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-md bg-perla-velo px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-800">{NOME_PROPOSTA[p.tipo] ?? p.tipo}</span>
        <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-ink">{p.titolo}</span>
        <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', st.cls)}>{st.l}</span>
      </p>
      {p.dettaglio.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-1 text-[12.5px] text-ink-soft">
          {p.dettaglio.map((d, i) => (
            <li key={i} className="break-words">
              {d}
            </li>
          ))}
        </ul>
      )}
      {p.motivo && <p className="mt-1 text-[12px] text-ink-muted">Perché: {p.motivo}</p>}
      {p.errore && <p className="mt-1 text-[12px] text-danger-ink">{p.errore}</p>}
      {err && (
        <p role="alert" className="mt-1.5 rounded-[8px] bg-warn px-2.5 py-1.5 text-[12.5px] text-warn-ink">
          {err}
        </p>
      )}
      {decide && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={lavoro !== null}
            onClick={() => (p.tipo === 'servizio' ? setConferma(true) : void decidi('approva'))}
            className="btn-primary premi inline-flex min-h-[44px] items-center gap-1.5 px-3.5 text-[13px]"
          >
            <Spunta size={15} aria-hidden /> {lavoro === 'approva' ? 'Approvo' : 'Approva'}
          </button>
          <button type="button" disabled={lavoro !== null} onClick={() => void decidi('respingi')} className={BTN}>
            {lavoro === 'respingi' ? 'Respingo' : 'Respingi'}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={conferma}
        title="Approvare l’ordine?"
        message="Il servizio viene ordinato e l’importo si paga dal portale (prima il wallet, poi il metodo predefinito)."
        confirmLabel="Approva l’ordine"
        onConfirm={() => {
          setConferma(false);
          void decidi('approva');
        }}
        onCancel={() => setConferma(false)}
      />
    </li>
  );
}

export function PannelloCodaLavoro({ p }: { p: P<'coda_lavoro'> }) {
  const inAttesa = p.proposte.filter((x) => x.stato === 'in_attesa').length;
  return (
    <CartaPannello icona={Elenco} titolo="Coda di lavoro" sottotitolo={inAttesa ? `${inAttesa} proposte da decidere` : 'Niente da decidere'}>
      {p.allarmi.length > 0 && (
        <ul className="mb-3 space-y-1">
          {p.allarmi.map((a) => (
            <li key={a.chiave} className={clsx('flex items-start gap-2 rounded-[0.875rem] px-3 py-2 text-[12.5px]', a.livello === 'rosso' ? 'bg-danger text-danger-ink' : 'bg-warn text-warn-ink')}>
              <span className="cifre shrink-0 font-semibold">{a.numero}</span>
              <span className="min-w-0 flex-1">{a.testo}</span>
            </li>
          ))}
        </ul>
      )}
      {p.proposte.length === 0 ? (
        <Vuoto>Nessuna proposta in coda.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.proposte.map((x) => (
            <RigaProposta key={x.id} iniziale={x} />
          ))}
        </ul>
      )}
      {p.fatto_oggi && (
        <p className="mt-2 text-[12px] text-ink-muted">
          Oggi: {p.fatto_oggi.approvate} approvate, {p.fatto_oggi.respinte} respinte.
        </p>
      )}
      <p className="mt-1 text-[11.5px] text-ink-subtle">Proposte preparate dall’agente: nulla cambia nei dati finché una persona non approva.</p>
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Cruscotto del controllo (11 indicatori)
// ------------------------------------------------------------------
const STATO_IND = {
  verde: { l: 'In obiettivo', punto: 'bg-ok-mark', testo: 'text-ok-ink' },
  ambra: { l: 'Dentro la soglia', punto: 'bg-oro-500', testo: 'text-oro-700' },
  rosso: { l: 'Oltre la soglia', punto: 'bg-danger-mark', testo: 'text-danger-ink' },
  n_d: { l: 'Senza dati', punto: 'bg-grafite-300', testo: 'text-ink-muted' },
} as const;

const valoreInd = (v: number | null, unita: string) => (v == null ? 'nd' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}${unita === '%' ? '%' : ''}`);

export function PannelloCruscotto({ p }: { p: P<'cruscotto'> }) {
  const conta = (s: keyof typeof STATO_IND) => p.indicatori.filter((i) => i.stato === s).length;
  return (
    <CartaPannello icona={Punteggio} titolo="Cruscotto del controllo" sottotitolo={`${conta('verde')} in obiettivo, ${conta('ambra')} nella soglia, ${conta('rosso')} oltre`}>
      <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
        {p.indicatori.map((i) => {
          const s = STATO_IND[i.stato];
          return (
            <li key={i.codice} className="rounded-[0.875rem] bg-perla-superficie px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]" title={i.come || undefined}>
              <p className="flex items-center gap-1.5">
                <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', s.punto)} />
                <span className={clsx('text-[11px] font-semibold', s.testo)}>{s.l}</span>
              </p>
              <p className="cifre mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-brand-900">{valoreInd(i.valore, i.unita)}</p>
              <p className="mt-1 text-[12px] leading-snug text-ink">{i.nome}</p>
              {i.obiettivo != null && (
                <p className="cifre mt-0.5 text-[11px] text-ink-muted">
                  obiettivo {valoreInd(i.obiettivo, i.unita)}, soglia {valoreInd(i.soglia, i.unita)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {p.agenti && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
          {(
            [
              ['Proposte degli agenti oggi', p.agenti.proposte_oggi, ''],
              ['In attesa di decisione', p.agenti.in_attesa, ''],
              ['Approvate sul totale deciso', p.agenti.approvate_su_decise, '%'],
              ['Costo AI del mese', p.agenti.costo_ai_mese_eur, ' euro'],
            ] as const
          ).map(([l, v, u]) => (
            <div key={l} className="contents">
              <dt className="text-ink-muted">{l}</dt>
              <dd className="cifre text-right text-ink">{v == null ? 'nd' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 2 })}${u}`}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[11.5px] text-ink-subtle">Indicatori calcolati dai dati dello studio sugli ultimi 90 giorni. Obiettivi e soglie da confermare con la direzione.</p>
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Nuovo assunto, promemoria visite, condivisioni, da fare, cartelle
// ------------------------------------------------------------------
const PRENOTAZIONE: Record<string, string> = {
  da_prenotare: 'Da prenotare',
  prenotata: 'Prenotata',
  in_calendario: 'In calendario',
  // Il lavoratore non conferma la visita (09): un vecchio stato "confermata" vale come prenotata.
  confermata: 'Prenotata',
};

export function PannelloNuovoAssunto({ p }: { p: P<'nuovo_assunto'> }) {
  const l = p.lavoratore;
  const daPagare = p.quota?.stato === 'da_pagare';
  return (
    <CartaPannello icona={PersonaVerificata} titolo={l ? l.nome : 'Nuovo assunto'} sottotitolo={l ? [l.mansione, l.data_assunzione && `dal ${dataBreve(l.data_assunzione)}`].filter(Boolean).join(', ') : null}>
      {l && (
        <p className="text-[12.5px] text-ink-soft">
          {[l.rischio && `Rischio ${l.rischio}`, l.sorveglianza ? 'con sorveglianza sanitaria' : 'senza sorveglianza sanitaria'].filter(Boolean).join(', ')}
        </p>
      )}
      {p.quota && (
        <div className={clsx('mt-2 rounded-[0.875rem] px-3 py-2', daPagare ? 'bg-warn' : 'bg-ok')}>
          <p className="flex items-baseline gap-2">
            <span className={clsx('text-[13px] font-semibold', daPagare ? 'text-warn-ink' : 'text-ok-ink')}>{daPagare ? 'Quota da pagare' : 'Quota pagata'}</span>
            {p.quota.importo && <span className="cifre ml-auto text-[13px] font-semibold text-ink">{p.quota.importo}</span>}
          </p>
          {p.quota.descrizione && <p className="text-[12px] text-ink-soft">{p.quota.descrizione}</p>}
          {daPagare && <p className="mt-0.5 text-[12px] text-warn-ink">Corso e visita restano fermi finché la quota non è pagata.</p>}
        </div>
      )}
      {p.scadenze.length > 0 && (
        <ul className="mt-3 divide-y divide-perla-linea">
          {p.scadenze.map((s) => (
            <li key={s.id || s.descrizione} className="flex min-h-[44px] items-center gap-2 py-1.5">
              <Calendario size={15} aria-hidden className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 text-[13px] text-ink">{s.descrizione}</span>
              {s.stato_prenotazione && <span className="shrink-0 text-[11.5px] font-semibold text-ink-muted">{PRENOTAZIONE[s.stato_prenotazione] ?? s.stato_prenotazione}</span>}
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

const ESITO_PASSO: Record<string, { l: string; cls: string }> = {
  inviato: { l: 'Inviato', cls: 'text-ok-ink' },
  da_inviare: { l: 'Programmato', cls: 'text-ink-muted' },
  errore: { l: 'Non inviato', cls: 'text-danger-ink' },
  saltato: { l: 'Saltato', cls: 'text-ink-subtle' },
  rinviato: { l: 'Rinviato al mattino', cls: 'text-oro-700' },
};

export function PannelloPromemoria({ p }: { p: P<'promemoria'> }) {
  const v = p.visita;
  return (
    <CartaPannello icona={Calendario} titolo="Promemoria della visita" sottotitolo={v ? v.descrizione : null}>
      {v && (
        <p className="text-[13px] text-ink">
          {v.appuntamento_il ? quandoBreve(v.appuntamento_il) : 'Appuntamento da fissare'}
          {v.luogo && <span className="text-ink-muted">, {v.luogo}</span>}
          {v.appuntamento_il && <span className="ml-2 text-[12px] font-semibold text-ok-ink">prenotata</span>}
        </p>
      )}
      {p.passi.length === 0 ? (
        <Vuoto>Nessun messaggio programmato.</Vuoto>
      ) : (
        <ol className="mt-2 space-y-1.5 border-l border-perla-linea pl-3">
          {p.passi.map((x, i) => {
            const e = ESITO_PASSO[x.esito] ?? { l: x.esito, cls: 'text-ink-muted' };
            return (
              <li key={`${x.passo}-${i}`}>
                <p className="flex items-baseline gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 font-medium text-ink">{x.nome}</span>
                  <span className={clsx('shrink-0 text-[11.5px] font-semibold', e.cls)}>{e.l}</span>
                </p>
                <p className="cifre text-[11.5px] text-ink-muted">
                  {quandoBreve(x.previsto_il)}
                  {x.canale && `, ${x.canale}`}
                </p>
                {x.errore && <p className="text-[12px] text-danger-ink">{x.errore}</p>}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-2 text-[11.5px] text-ink-subtle">Nessun messaggio parte tra le 20 e le 8 e nei giorni festivi.</p>
    </CartaPannello>
  );
}

export function PannelloCondivisioni({ p }: { p: P<'condivisioni'> }) {
  return (
    <CartaPannello icona={Condividi} titolo="Condivisioni del fascicolo" sottotitolo={`${p.condivisioni.filter((c) => c.valida).length} attive`}>
      {p.condivisioni.length === 0 ? (
        <Vuoto>Nessuna condivisione.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.condivisioni.map((c) => (
            <li key={c.id} className="py-2">
              <p className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{c.destinatario}</span>
                <span className={clsx('shrink-0 text-[11.5px] font-semibold', c.revocata ? 'text-ink-subtle' : c.valida ? 'text-ok-ink' : 'text-ink-muted')}>
                  {c.revocata ? 'Revocata' : c.valida ? 'Attiva' : 'Scaduta'}
                </span>
              </p>
              <p className="text-[12px] text-ink-muted">
                {[c.cartelle.length ? `Cartelle: ${c.cartelle.join(', ').replace(/_/g, ' ')}` : null, c.scade_il && `scade il ${dataBreve(c.scade_il)}`, `${c.accessi} ${c.accessi === 1 ? 'apertura' : 'aperture'}`]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {c.motivo && <p className="text-[12px] text-ink-soft">{c.motivo}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11.5px] text-ink-subtle">Sola lettura, mai i documenti sanitari. Ogni apertura resta registrata.</p>
    </CartaPannello>
  );
}

export function PannelloDaFare({ p }: { p: P<'da_fare'> }) {
  return (
    <CartaPannello icona={Elenco} titolo="Da fare" sottotitolo={p.voci.length ? `${p.voci.length} cose in sospeso` : 'Tutto in ordine'}>
      {p.totale_da_pagare && (p.conteggi.quote_da_pagare ?? 0) > 0 && (
        <p className="mb-2 rounded-[0.875rem] bg-warn px-3 py-2 text-[12.5px] text-warn-ink">
          Quote da pagare: <span className="cifre font-semibold">{p.totale_da_pagare}</span>
        </p>
      )}
      {p.voci.length === 0 ? (
        <Vuoto>Niente in sospeso.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.voci.map((v, i) => (
            <li key={`${v.tipo}-${v.id}-${i}`} className="py-2">
              <p className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-[13px] text-ink">{v.testo}</span>
                {v.importo && <span className="cifre shrink-0 text-[12.5px] font-semibold text-ink">{v.importo}</span>}
              </p>
              <p className="text-[12px] text-ink-muted">{[v.quando && quandoBreve(v.quando), v.azione].filter(Boolean).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

export function PannelloCartelle({ p }: { p: P<'cartelle'> }) {
  return (
    <CartaPannello icona={Cartella} titolo="Cartelle del fascicolo" sottotitolo={p.da_classificare ? `${p.da_classificare} documenti da classificare` : null}>
      {p.cartelle.length === 0 ? (
        <Vuoto>Nessuna cartella.</Vuoto>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
          {p.cartelle.map((k) => (
            <li key={k.chiave || k.nome} className="flex min-h-[44px] items-center gap-2 rounded-[0.875rem] bg-perla-superficie px-2.5 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.06)]">
              <Cartella size={15} aria-hidden className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{k.nome}</span>
              <span className="cifre shrink-0 text-[12px] text-ink-muted">{k.documenti}</span>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}
