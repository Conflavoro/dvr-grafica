'use client';

import { Calendario, Cartella, Download, Grafico, Punteggio, Qr, Sirena, Sopralluogo } from '@/components/icone';
import type { Pannello } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { CaselleConformita, ElencoCriticita, GrigliaAree, RiquadroScore } from '../controlroom/ControlRoom';
import { ChecklistEssenziali, RigaDocumento } from '../controlroom/Fascicolo';
import { ElencoAccessi, StatoPassaporto } from '../controlroom/Passaporto';
import { Referente, RigaIspezione } from '../controlroom/ProntoControllo';
import { Andamento, ElencoAttivita } from '../controlroom/Report';
import { GrigliaContatori, RigaScadenza, StrisciaSettimana } from '../controlroom/Scadenzario';
import { Contatore, DISCLAIMER_AI_CR, nomeMese } from '../controlroom/kit';
import { CartaPannello, Vuoto, useAzioniPannelli } from './contesto';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const LINK_FILE = 'premi inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-brand-700 hover:bg-perla-velo hover:text-brand-900';

export function PannelloSafetyScore({ p }: { p: P<'safety_score'> }) {
  const { invia, occupato, nomeAzienda } = useAzioniPannelli();
  const azienda = p.ragione_sociale ?? nomeAzienda(p.azienda_id);
  return (
    <CartaPannello icona={Punteggio} titolo="Safety Score" sottotitolo={azienda}>
      <div className="space-y-3">
        <RiquadroScore totale={p.totale} livello={p.livello} tendenza={p.tendenza} dimensione={96} />
        <GrigliaAree aree={p.aree} />
        <CaselleConformita c={p.conformita} />
        <ElencoCriticita criticita={p.criticita} chiedi={invia} occupato={occupato} azienda={azienda} />
      </div>
    </CartaPannello>
  );
}

export function PannelloScadenzario({ p }: { p: P<'scadenzario'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  const prime = p.voci.slice(0, 6);
  return (
    <CartaPannello icona={Calendario} titolo="Scadenzario" sottotitolo={[nomeAzienda(p.azienda_id), p.periodo && (p.periodo === 'oggi' ? 'oggi' : `prossimi ${p.periodo} giorni`)].filter(Boolean).join(', ')}>
      <div className="space-y-3">
        <GrigliaContatori c={p.contatori} />
        <StrisciaSettimana voci={p.voci} />
        {prime.length === 0 ? (
          <Vuoto>Nessuna scadenza nel periodo.</Vuoto>
        ) : (
          <ul className="divide-y divide-perla-linea">
            {prime.map((v) => (
              <RigaScadenza key={v.chiave} v={v} />
            ))}
          </ul>
        )}
        {p.voci.length > prime.length && <p className="text-[12px] text-ink-muted">Altre {p.voci.length - prime.length} nello scadenzario completo.</p>}
      </div>
    </CartaPannello>
  );
}

export function PannelloFascicolo({ p }: { p: P<'fascicolo'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  return (
    <CartaPannello icona={Cartella} titolo={p.aggiornato ? 'Fascicolo aggiornato' : 'Fascicolo digitale'} sottotitolo={nomeAzienda(p.azienda_id)}>
      {p.aggiornato ? (
        <ul>{p.documenti.slice(0, 1).map((v) => <RigaDocumento key={v.id} v={v} />)}</ul>
      ) : (
        <div className="space-y-3">
          <ChecklistEssenziali voci={p.essenziali} />
          {p.documenti.length > 0 && (
            <div>
              <p className="text-[12.5px] font-semibold text-brand-900">Documenti recenti</p>
              <ul className="divide-y divide-perla-linea">
                {p.documenti.slice(0, 5).map((v) => (
                  <RigaDocumento key={v.id} v={v} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </CartaPannello>
  );
}

export function PannelloReport({ p }: { p: P<'report'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  return (
    <CartaPannello
      icona={Grafico}
      titolo={`Report di ${nomeMese(p.mese) || 'questo mese'}`}
      sottotitolo={nomeAzienda(p.azienda_id)}
      azioni={
        p.link_pdf ? (
          <a href={p.link_pdf} target="_blank" rel="noopener noreferrer" className={clsx(LINK_FILE, '-my-2 -mr-2')}>
            <Download size={15} aria-hidden /> PDF
          </a>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          <Contatore n={p.safety_score?.totale ?? 0} etichetta={p.safety_score?.totale == null ? 'Score non calcolato' : 'Safety Score'} />
          <Contatore n={p.criticita.length} etichetta="Criticità aperte" allerta />
        </div>
        {p.andamento.length > 0 && <Andamento dati={p.andamento} altezza={80} />}
        <ElencoAttivita attivita={p.attivita} />
        {p.osservazioni && (
          <div>
            <p className="text-[12.5px] font-semibold text-brand-900">Osservazioni</p>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed">{p.osservazioni}</p>
            {p.osservazioni_ai && <p className="mt-1 text-[11.5px] text-ink-subtle">{DISCLAIMER_AI_CR}</p>}
          </div>
        )}
      </div>
    </CartaPannello>
  );
}

export function PannelloPassaporto({ p }: { p: P<'passaporto'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  return (
    <CartaPannello
      icona={Qr}
      titolo="Safety Passport"
      sottotitolo={nomeAzienda(p.azienda_id)}
      azioni={
        p.link_foglio_qr ? (
          <a href={p.link_foglio_qr} target="_blank" rel="noopener noreferrer" className={clsx(LINK_FILE, '-my-2 -mr-2')}>
            <Download size={15} aria-hidden /> Foglio
          </a>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {p.creato && (
          <p className="rounded-[0.875rem] bg-oro-50 px-3 py-2 text-[12.5px] text-oro-700 shadow-[inset_0_0_0_1px_rgba(103,127,2,0.45)]">
            Passaporto creato. Il PIN non passa dalla conversazione: è arrivato per email{p.pin_inviato_a ? ` a ${p.pin_inviato_a}` : ' a chi lo ha creato'}.
          </p>
        )}
        {p.attivo ? <StatoPassaporto p={p.attivo} /> : <Vuoto>Nessun passaporto attivo.</Vuoto>}
        {p.accessi.length > 0 && (
          <div>
            <p className="text-[12.5px] font-semibold text-brand-900">Accessi recenti</p>
            <ElencoAccessi accessi={p.accessi} max={4} />
          </div>
        )}
      </div>
    </CartaPannello>
  );
}

export function PannelloIspezioni({ p }: { p: P<'ispezioni'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  return (
    <CartaPannello icona={Sopralluogo} titolo={p.nuova ? 'Ispezione registrata' : 'Ispezioni'} sottotitolo={nomeAzienda(p.azienda_id)}>
      {p.ispezioni.length === 0 ? (
        <Vuoto>Nessuna ispezione registrata.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.ispezioni.slice(0, 6).map((i) => (
            <RigaIspezione key={i.id} i={i} evidenzia={i.id === p.nuova} />
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

export function PannelloProntoControllo({ p }: { p: P<'pronto_controllo'> }) {
  const { nomeAzienda } = useAzioniPannelli();
  const r = p.richiesta;
  return (
    <CartaPannello icona={Sirena} titolo="Pronto Controllo" sottotitolo={nomeAzienda(p.azienda_id)}>
      <div className="space-y-3">
        {r && (
          <p role="status" className="rounded-[0.875rem] bg-ok px-3 py-2 text-[12.5px] text-ok-ink">
            {r.avvisati > 0 ? `Richiesta di aiuto inviata a ${r.avvisati} ${r.avvisati === 1 ? 'persona' : 'persone'}.` : 'Richiesta di aiuto registrata.'} {r.nota}
          </p>
        )}
        <Referente r={p.referente} />
        <ChecklistEssenziali voci={p.mostra_subito.map((v, i) => ({ chiave: `${i}`, voce: v.voce, esito: v.esito, messaggio: v.documenti ? `${v.documenti} ${v.documenti === 1 ? 'documento' : 'documenti'} da mostrare` : 'Nessun documento nel fascicolo' }))} />
        {p.consigli.length > 0 && (
          <ol className="space-y-1">
            {p.consigli.slice(0, 3).map((c, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
                <span className="cifre w-4 shrink-0 text-right font-semibold text-oro-600">{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </CartaPannello>
  );
}
