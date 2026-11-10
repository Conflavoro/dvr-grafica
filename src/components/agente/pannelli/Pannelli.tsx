'use client';

import { useState } from 'react';
import { BookMarked, CalendarClock, ChevronDown } from '@/components/icone';
import type { Pannello } from '@/lib/data-source';
import { clsx } from '@/lib/clsx';
import { CartaPannello, Vuoto, dataBreve } from './contesto';
import { PannelloArchivio, PannelloAzienda, PannelloAziende, PannelloLavoratori } from './PannelliAzienda';
import { PannelloDvr, PannelloDvrElenco, PannelloIndice, PannelloRevisioni, PannelloSezione } from './PannelliDvr';
import { PannelloRischi } from './PannelloRischi';
import { PannelloCantiereVista, PannelloNovitaVista, PannelloPosVista, PannelloSegnalazioniVista } from './PannelliPos';
import {
  PannelloFascicolo,
  PannelloIspezioni,
  PannelloPassaporto,
  PannelloProntoControllo,
  PannelloReport,
  PannelloSafetyScore,
  PannelloScadenzario,
} from './PannelliControlRoom';
import {
  PannelloAggiornamenti,
  PannelloDocumentiHse,
  PannelloDocumentoHse,
  PannelloNomine,
  PannelloNube81,
  PannelloQualita,
  PannelloRadon,
  PannelloRiferimenti,
  PannelloValutazione,
  PannelloValutazioni,
} from './PannelliModuli';
import {
  PannelloCartelle,
  PannelloCodaLavoro,
  PannelloCondivisioni,
  PannelloCruscotto,
  PannelloDaFare,
  PannelloNuovoAssunto,
  PannelloPromemoria,
  PannelloSchedaAvvio,
} from './PannelliPortale';
import { nomeTipoDocumento } from '@/lib/data-source';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

const PRIORITA: Record<string, string> = { alta: 'Alta', media: 'Media', bassa: 'Bassa', urgente: 'Urgente' };

function PannelloScadenze({ p }: { p: P<'scadenze'> }) {
  const scadute = p.scadenze.filter((s) => s.scaduta).length;
  return (
    <CartaPannello icona={CalendarClock} titolo="Scadenze" sottotitolo={scadute > 0 ? `${scadute} scadute su ${p.scadenze.length}` : `${p.scadenze.length} in arrivo`}>
      {p.scadenze.length === 0 ? (
        <Vuoto>Nessuna scadenza nel periodo.</Vuoto>
      ) : (
        <ul className="max-h-[440px] space-y-1.5 overflow-y-auto">
          {p.scadenze.map((s) => (
            <li
              key={s.id}
              className={clsx('rounded-lg border px-3 py-2', s.scaduta ? 'border-danger bg-danger/70' : 'border-brand-100 bg-white')}
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className={clsx('font-semibold tabular-nums', s.scaduta ? 'text-danger-ink' : 'text-ink')}>{dataBreve(s.data) || 'Senza data'}</span>
                {s.scaduta ? (
                  <span className="shrink-0 text-[11px] font-semibold text-danger-ink">Scaduta</span>
                ) : (
                  s.priorita && <span className="shrink-0 text-[11px] text-ink-muted">Priorità {PRIORITA[s.priorita] ?? s.priorita}</span>
                )}
              </p>
              <p className="break-words">{s.descrizione || s.tipo}</p>
              {s.azienda && <p className="truncate text-[11.5px] text-ink-muted">{s.azienda}</p>}
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

function Passaggio({ fonte, testo }: { fonte: string; testo: string }) {
  const [aperto, setAperto] = useState(false);
  return (
    <li className="border-t border-brand-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className="flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <span className="min-w-0 flex-1">{fonte}</span>
        <ChevronDown size={15} aria-hidden className={clsx('shrink-0 transition-transform motion-reduce:transition-none', aperto && 'rotate-180')} />
      </button>
      {aperto && <p className="whitespace-pre-line break-words pb-2 text-[12.5px] leading-relaxed">{testo}</p>}
    </li>
  );
}

function PannelloFonti({ p }: { p: P<'fonti'> }) {
  return (
    <CartaPannello icona={BookMarked} titolo="Fonti normative" sottotitolo={`${p.passaggi.length} passaggi consultati`}>
      {p.passaggi.length === 0 ? (
        <Vuoto>Nessun passaggio trovato.</Vuoto>
      ) : (
        <ul>
          {p.passaggi.map((x, i) => (
            <Passaggio key={i} fonte={x.fonte} testo={x.testo} />
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

/** Un pannello qualsiasi. I tipi non previsti sono gia' scartati dal mapper. */
export function PannelloVista({ p }: { p: Pannello }) {
  switch (p.tipo) {
    case 'aziende':
      return <PannelloAziende p={p} />;
    case 'azienda':
      return <PannelloAzienda p={p} />;
    case 'archivio':
      return <PannelloArchivio p={p} />;
    case 'lavoratori':
      return <PannelloLavoratori p={p} />;
    case 'rischi':
      return <PannelloRischi p={p} />;
    case 'dvr':
      return <PannelloDvr p={p} />;
    case 'dvr_elenco':
      return <PannelloDvrElenco p={p} />;
    case 'indice':
      return <PannelloIndice p={p} />;
    case 'sezione':
      return <PannelloSezione p={p} />;
    case 'revisioni':
      return <PannelloRevisioni p={p} />;
    case 'scadenze':
      return <PannelloScadenze p={p} />;
    case 'fonti':
      return <PannelloFonti p={p} />;
    case 'novita':
      return <PannelloNovitaVista p={p} />;
    case 'cantiere':
      return <PannelloCantiereVista p={p} />;
    case 'pos':
      return <PannelloPosVista p={p} />;
    case 'segnalazioni':
      return <PannelloSegnalazioniVista p={p} />;
    case 'safety_score':
      return <PannelloSafetyScore p={p} />;
    case 'scadenzario':
      return <PannelloScadenzario p={p} />;
    case 'fascicolo':
      return <PannelloFascicolo p={p} />;
    case 'report':
      return <PannelloReport p={p} />;
    case 'passaporto':
      return <PannelloPassaporto p={p} />;
    case 'ispezioni':
      return <PannelloIspezioni p={p} />;
    case 'pronto_controllo':
      return <PannelloProntoControllo p={p} />;
    case 'valutazione':
      return <PannelloValutazione p={p} />;
    case 'valutazioni':
      return <PannelloValutazioni p={p} />;
    case 'documento_hse':
      return <PannelloDocumentoHse p={p} />;
    case 'documenti_hse':
      return <PannelloDocumentiHse p={p} />;
    case 'qualita':
      return <PannelloQualita p={p} />;
    case 'riferimenti':
      return <PannelloRiferimenti p={p} />;
    case 'aggiornamenti':
      return <PannelloAggiornamenti p={p} />;
    case 'nube81':
      return <PannelloNube81 p={p} />;
    case 'nomine':
      return <PannelloNomine p={p} />;
    case 'radon_calcolo':
      return <PannelloRadon p={p} />;
    case 'scheda_avvio':
      return <PannelloSchedaAvvio p={p} />;
    case 'coda_lavoro':
      return <PannelloCodaLavoro p={p} />;
    case 'cruscotto':
      return <PannelloCruscotto p={p} />;
    case 'nuovo_assunto':
      return <PannelloNuovoAssunto p={p} />;
    case 'promemoria':
      return <PannelloPromemoria p={p} />;
    case 'condivisioni':
      return <PannelloCondivisioni p={p} />;
    case 'da_fare':
      return <PannelloDaFare p={p} />;
    case 'cartelle':
      return <PannelloCartelle p={p} />;
    default:
      return null;
  }
}

/** Titolo breve per i richiami ai pannelli precedenti. */
export function titoloPannello(p: Pannello): string {
  switch (p.tipo) {
    case 'aziende':
      return 'Aziende';
    case 'azienda':
      return p.azienda.ragione_sociale;
    case 'archivio':
      return p.ricerca ? 'Trovato nell’archivio' : 'Archivio';
    case 'lavoratori':
      return 'Lavoratori';
    case 'rischi':
      return 'Rischi';
    case 'dvr':
      return `DVR n. ${p.dvr_id}`;
    case 'dvr_elenco':
      return 'Elenco DVR';
    case 'indice':
      return 'Indice DVR';
    case 'sezione':
      return `Sezione ${p.sezione.chiave}`;
    case 'revisioni':
      return 'Revisioni';
    case 'scadenze':
      return 'Scadenze';
    case 'fonti':
      return 'Fonti';
    case 'novita':
      return 'Novità normative';
    case 'cantiere':
      return p.cantiere.denominazione;
    case 'pos':
      return `POS n. ${p.pos_id}`;
    case 'segnalazioni':
      return 'Controlli del POS';
    case 'safety_score':
      return p.totale != null ? `Safety Score ${p.totale}` : 'Safety Score';
    case 'scadenzario':
      return 'Scadenzario';
    case 'fascicolo':
      return p.aggiornato ? 'Fascicolo aggiornato' : 'Fascicolo';
    case 'report':
      return 'Report mensile';
    case 'passaporto':
      return 'Safety Passport';
    case 'ispezioni':
      return 'Ispezioni';
    case 'pronto_controllo':
      return 'Pronto Controllo';
    case 'valutazione':
      return `Valutazione ${p.nome.toLowerCase()}`;
    case 'valutazioni':
      return 'Valutazioni specifiche';
    case 'documento_hse':
      return p.titolo || nomeTipoDocumento(p.tipo_documento);
    case 'documenti_hse':
      return 'Documenti';
    case 'qualita':
      return p.punteggio != null ? `Qualità ${Math.round(p.punteggio)}` : 'Qualità';
    case 'riferimenti':
      return 'Riferimenti superati';
    case 'aggiornamenti':
      return 'Da aggiornare';
    case 'nube81':
      return 'Modello Nube 81';
    case 'nomine':
      return 'Nomine';
    case 'radon_calcolo':
      return 'Radon';
    case 'scheda_avvio':
      return 'Scheda di avvio';
    case 'coda_lavoro':
      return 'Coda di lavoro';
    case 'cruscotto':
      return 'Cruscotto';
    case 'nuovo_assunto':
      return p.lavoratore ? `Nuovo assunto ${p.lavoratore.nome}` : 'Nuovo assunto';
    case 'promemoria':
      return 'Promemoria visita';
    case 'condivisioni':
      return 'Condivisioni';
    case 'da_fare':
      return 'Da fare';
    case 'cartelle':
      return 'Cartelle';
    default:
      return 'Pannello';
  }
}
