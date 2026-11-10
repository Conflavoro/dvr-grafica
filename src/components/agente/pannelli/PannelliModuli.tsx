'use client';

import { useState } from 'react';
import { Avviso, Documento, Elenco, Grafico, Libro, Punteggio, Rete, Scudo, ScudoAllerta, Storico, Download } from '@/components/icone';
import type { Pannello } from '@/lib/data-source';
import { nomeTipoDocumento } from '@/lib/data-source';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clsx } from '@/lib/clsx';
import { BTN, CartaPannello, Vuoto, dataBreve, puoApprovare, puoScrivere, useAzioniPannelli } from './contesto';
import { BadgeStatoDoc, COLORE, CaselleControlli, ElencoSegnalazioni, PuntoEsito, ScaricaDocumento, emesso } from './moduli-kit';

type P<T extends Pannello['tipo']> = Extract<Pannello, { tipo: T }>;

/** "il DUVRI", "la valutazione", "il piano di emergenza": per i testi verso l'agente. */
function articolato(tipo: string): string {
  const nome = nomeTipoDocumento(tipo);
  const femminili = ['nomina', 'procedura', 'radon'];
  if (femminili.includes(tipo)) return `la ${nome.toLowerCase()}`;
  if (['duvri', 'pimus'].includes(tipo)) return `il ${nome}`;
  if (tipo === 'haccp') return 'il manuale HACCP';
  return `il ${nome.charAt(0).toLowerCase()}${nome.slice(1)}`;
}

/** Pulsanti comuni dei documenti in lavorazione: controlla (chi scrive) ed emetti (titolare, con conferma). */
function AzioniDocumento({
  nome,
  riferimento,
  stato,
  puoEmettere,
  testoConferma,
}: {
  nome: string;
  /** "il DUVRI n. 12", "la valutazione n. 4" */
  riferimento: string;
  stato: string | null;
  puoEmettere: boolean | null;
  testoConferma: string;
}) {
  const az = useAzioniPannelli();
  const [chiedi, setChiedi] = useState(false);
  if (emesso(stato)) return null;
  const scrive = puoScrivere(az.ruolo);
  const emette = puoApprovare(az.ruolo) && puoEmettere === true;
  if (!scrive && !emette) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {scrive && (
          <button type="button" disabled={az.occupato} onClick={() => az.invia(`Controlla ${riferimento}`)} className={BTN}>
            <ScudoAllerta size={15} aria-hidden /> Controlla
          </button>
        )}
        {emette && (
          <button type="button" disabled={az.occupato} onClick={() => setChiedi(true)} className="btn-primary premi min-h-[44px] px-3.5 text-[13px]">
            Emetti
          </button>
        )}
      </div>
      <ConfirmDialog
        open={chiedi}
        title={`Emettere ${nome}?`}
        message={testoConferma}
        confirmLabel="Chiedi l’emissione"
        onConfirm={() => {
          setChiedi(false);
          az.invia(`Emetti ${riferimento}: confermo l'emissione.`);
        }}
        onCancel={() => setChiedi(false)}
      />
    </>
  );
}

// ------------------------------------------------------------------
// Valutazione specifica
// ------------------------------------------------------------------
export function PannelloValutazione({ p }: { p: P<'valutazione'> }) {
  const az = useAzioniPannelli();
  const rif = `la valutazione ${p.nome.toLowerCase()} n. ${p.valutazione_id}`;
  const c = p.esito ? COLORE[p.esito.colore] : null;
  return (
    <CartaPannello
      icona={Grafico}
      titolo={`Valutazione ${p.nome.toLowerCase()}`}
      sottotitolo={p.revisione ? `Revisione ${p.revisione}` : 'Non ancora emessa'}
      azioni={<BadgeStatoDoc stato={p.stato} />}
    >
      {p.esito && c && (
        <p className={clsx('mb-3 flex items-start gap-2 rounded-[0.875rem] px-3 py-2.5 text-[13.5px] font-semibold leading-snug', c.fondo, c.testo)}>
          <PuntoEsito colore={p.esito.colore} />
          <span className="-mt-0.5">{p.esito.testo}</span>
        </p>
      )}
      {p.righe.length === 0 ? (
        <Vuoto>Mancano ancora i dati per il calcolo.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea" aria-label="Risultati per mansione o gruppo">
          {p.righe.map((r, i) => (
            <li key={`${r.voce}-${i}`} className="py-2">
              <p className="flex items-start gap-2">
                <span className="mt-1.5">
                  <PuntoEsito colore={r.colore} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{r.voce || 'Gruppo'}</span>
                  {r.valore && <span className="cifre block text-[12.5px] text-ink-soft">{r.valore}</span>}
                  {r.esito && <span className={clsx('block text-[12px] font-semibold', COLORE[r.colore].testo)}>{r.esito}</span>}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {p.conteggi && p.conteggi.blocca + p.conteggi.corregge + p.conteggi.avvisa > 0 && (
        <div className="mt-3 space-y-2">
          <CaselleControlli c={p.conteggi} />
          <ElencoSegnalazioni segnalazioni={p.segnalazioni} />
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-ink-subtle">Calcoli e soglie di legge eseguiti dalla piattaforma, non dal modello AI.</p>
      <div className="mt-3 space-y-2">
        <ScaricaDocumento origine="valutazione" id={p.valutazione_id} stato={p.stato} onAnteprima={() => az.invia(`Prepara il file della bozza della ${rif.slice(3)}`)} />
        <AzioniDocumento
          nome="la valutazione"
          riferimento={rif}
          stato={p.stato}
          puoEmettere={p.puo_emettere}
          testoConferma="L’emissione crea una revisione immutabile con Word e PDF. La valutazione va poi firmata dal datore di lavoro e dal RSPP, con la collaborazione del medico competente e la presa visione del RLS."
        />
      </div>
    </CartaPannello>
  );
}

export function PannelloValutazioni({ p }: { p: P<'valutazioni'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={Grafico} titolo="Valutazioni specifiche" sottotitolo={`${p.valutazioni.length} in elenco`}>
      {p.valutazioni.length === 0 ? (
        <Vuoto>Nessuna valutazione specifica.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.valutazioni.map((v) => (
            <li key={v.valutazione_id}>
              <button
                type="button"
                disabled={az.occupato}
                onClick={() => az.invia(`Apri la valutazione ${v.nome.toLowerCase()} n. ${v.valutazione_id}`)}
                className="flex min-h-[52px] w-full items-center gap-2.5 py-1.5 text-left hover:bg-perla-velo/60 disabled:opacity-60"
              >
                {v.colore && <PuntoEsito colore={v.colore} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{v.nome}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{[v.azienda, v.esito].filter(Boolean).join(', ')}</span>
                </span>
                <BadgeStatoDoc stato={v.stato} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Documento HSE (DUVRI, PiMUS, HACCP, emergenza, verbali, nomine, procedure, radon)
// ------------------------------------------------------------------
export function PannelloDocumentoHse({ p }: { p: P<'documento_hse'> }) {
  const az = useAzioniPannelli();
  const nome = nomeTipoDocumento(p.tipo_documento);
  const rif = `${articolato(p.tipo_documento)} n. ${p.documento_id}`;
  const c = p.conteggi;
  return (
    <CartaPannello
      icona={Documento}
      titolo={p.titolo || nome}
      sottotitolo={[p.titolo ? nome : null, p.revisione ? `revisione ${p.revisione}` : 'non ancora emesso'].filter(Boolean).join(', ')}
      azioni={<BadgeStatoDoc stato={p.stato} />}
    >
      {c && c.blocca + c.corregge + c.avvisa > 0 ? (
        <div className="space-y-2">
          <CaselleControlli c={c} />
          <ElencoSegnalazioni segnalazioni={p.segnalazioni} />
        </div>
      ) : p.puo_emettere ? (
        <p className="rounded-[0.875rem] bg-ok px-3 py-2 text-[13px] font-medium text-ok-ink">Supera i controlli: può essere emesso.</p>
      ) : null}
      {p.puo_emettere === false && c && c.blocca > 0 && (
        <p className="mt-2 text-[12.5px] text-danger-ink">Non si può emettere finché ci sono segnalazioni che bloccano.</p>
      )}
      <div className="mt-3 space-y-2">
        <ScaricaDocumento origine="hse" id={p.documento_id} stato={p.stato} onAnteprima={() => az.invia(`Prepara il file della bozza del documento n. ${p.documento_id}`)} />
        <AzioniDocumento
          nome={articolato(p.tipo_documento)}
          riferimento={rif}
          stato={p.stato}
          puoEmettere={p.puo_emettere}
          testoConferma="L’emissione crea una revisione immutabile con Word e PDF. Il documento va poi firmato dalle figure indicate in copertina."
        />
      </div>
    </CartaPannello>
  );
}

export function PannelloDocumentiHse({ p }: { p: P<'documenti_hse'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={Elenco} titolo="Documenti" sottotitolo={`${p.documenti.length} in elenco`}>
      {p.documenti.length === 0 ? (
        <Vuoto>Nessun documento di questo tipo.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.documenti.map((d) => {
            const blocchi = d.conteggi?.blocca ?? 0;
            return (
              <li key={d.documento_id}>
                <button
                  type="button"
                  disabled={az.occupato}
                  onClick={() => az.invia(`Apri il documento n. ${d.documento_id} (${nomeTipoDocumento(d.tipo)})`)}
                  className="flex min-h-[52px] w-full items-center gap-2.5 py-1.5 text-left hover:bg-perla-velo/60 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{d.titolo || nomeTipoDocumento(d.tipo)}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">
                      {[nomeTipoDocumento(d.tipo), d.azienda, d.revisione ? `rev. ${d.revisione}` : null, blocchi ? `${blocchi} da sbloccare` : null].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <BadgeStatoDoc stato={d.stato} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Qualita' del documento
// ------------------------------------------------------------------
const COLORE_PUNTEGGIO = { verde: '#16884a', giallo: '#a86800', rosso: '#d63d3e' } as const;

export function PannelloQualita({ p }: { p: P<'qualita'> }) {
  const az = useAzioniPannelli();
  const v = p.punteggio ?? 0;
  return (
    <CartaPannello
      icona={Punteggio}
      titolo="Qualità del documento"
      sottotitolo={[p.titolo ?? (p.tipo_documento ? nomeTipoDocumento(p.tipo_documento) : null), p.livello].filter(Boolean).join(', ') || null}
    >
      <div className="flex items-end gap-3">
        <p className="cifre text-[34px] font-semibold leading-none tracking-[-0.03em]" style={{ color: COLORE_PUNTEGGIO[p.colore] }}>
          {p.punteggio == null ? 'nd' : p.punteggio.toLocaleString('it-IT')}
        </p>
        <p className="pb-1 text-[12px] text-ink-muted">su 100</p>
        {p.pronto_per_revisione != null && (
          <p className={clsx('ml-auto pb-1 text-[12px] font-semibold', p.pronto_per_revisione ? 'text-ok-ink' : 'text-warn-ink')}>
            {p.pronto_per_revisione ? 'Pronto per la revisione' : 'Da migliorare prima della revisione'}
          </p>
        )}
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e2e5]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
        aria-label={`Punteggio di qualità ${Math.round(v)} su 100`}
      >
        <span className="block h-full rounded-full" style={{ width: `${v}%`, background: COLORE_PUNTEGGIO[p.colore] }} />
      </div>
      {p.componenti.length > 0 && (
        <ul className="mt-3 space-y-2">
          {p.componenti.map((c) => {
            const pct = c.punti == null ? 0 : Math.max(0, Math.min(100, (c.punti / c.max) * 100));
            return (
              <li key={c.chiave || c.nome}>
                <p className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{c.nome}</span>
                  <span className="cifre shrink-0 text-ink-muted">{c.punti == null ? 'non misurabile' : `${c.punti.toLocaleString('it-IT')} / ${c.max}`}</span>
                </p>
                <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                  <span className={clsx('block h-full rounded-full', pct >= 80 ? 'bg-ok-mark' : pct >= 50 ? 'bg-oro-500' : 'bg-danger-mark')} style={{ width: `${pct}%` }} />
                </span>
                {c.dettaglio && <span className="mt-0.5 block text-[11.5px] text-ink-muted">{c.dettaglio}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {p.riferimenti_superati.length > 0 && (
        <div className="mt-3 rounded-[0.875rem] bg-danger/70 px-3 py-2">
          <p className="text-[12.5px] font-semibold text-danger-ink">Riferimenti normativi superati</p>
          <ul className="mt-1 space-y-1 text-[12.5px] text-ink">
            {p.riferimenti_superati.map((r, i) => (
              <li key={i}>
                {r.trovato || r.titolo}
                {r.sostituito_da && <span className="text-ink-muted"> sostituito da {r.sostituito_da}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.miglioramenti.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[12px] font-semibold text-ink-muted">Come migliorarlo</p>
          <ol className="space-y-1.5">
            {p.miglioramenti.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink">
                <span className="cifre w-5 shrink-0 text-ink-subtle">{i + 1}.</span>
                <span className="min-w-0 flex-1">{m.azione}</span>
                {m.guadagno != null && m.guadagno > 0 && <span className="cifre shrink-0 text-[12px] font-semibold text-ok-ink">+{m.guadagno.toLocaleString('it-IT')}</span>}
              </li>
            ))}
          </ol>
          {puoScrivere(az.ruolo) && p.documento_id != null && (
            <button type="button" disabled={az.occupato} onClick={() => az.invia(`Applica i miglioramenti suggeriti dalla scheda di qualità al documento n. ${p.documento_id}`)} className={clsx(BTN, 'mt-2')}>
              Applica con l’agente
            </button>
          )}
        </div>
      )}
    </CartaPannello>
  );
}

export function PannelloRiferimenti({ p }: { p: P<'riferimenti'> }) {
  return (
    <CartaPannello icona={Libro} titolo="Riferimenti superati" sottotitolo={p.riferimenti.length ? `${p.riferimenti.length} da aggiornare` : 'Nessuno trovato'}>
      {p.riferimenti.length === 0 ? (
        <Vuoto>Il testo non cita norme abrogate o sostituite.</Vuoto>
      ) : (
        <ul className="space-y-1.5">
          {p.riferimenti.map((r, i) => (
            <li key={i} className="rounded-[0.875rem] bg-danger/70 px-3 py-2 text-[13px]">
              <p className="font-semibold text-danger-ink">{r.trovato || r.titolo}</p>
              {r.sostituito_da && <p className="text-ink">Ora vale: {r.sostituito_da}</p>}
              {r.messaggio && <p className="text-[12px] text-ink-muted">{r.messaggio}</p>}
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

export function PannelloAggiornamenti({ p }: { p: P<'aggiornamenti'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={Storico} titolo="Documenti da aggiornare" sottotitolo={p.documenti.length ? `${p.documenti.length} emessi con riferimenti cambiati` : 'Tutto aggiornato'}>
      {p.documenti.length === 0 ? (
        <Vuoto>Nessun documento emesso da aggiornare.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.documenti.map((d) => (
            <li key={`${d.tipo}-${d.documento_id}`} className="py-2">
              <p className="flex items-baseline gap-2">
                <span className="text-[13.5px] font-medium text-ink">{nomeTipoDocumento(d.tipo)}</span>
                <span className="cifre text-[11.5px] text-ink-muted">n. {d.documento_id}{d.revisione ? `, rev. ${d.revisione}` : ''}</span>
                {d.emesso_il && <span className="ml-auto text-[11.5px] text-ink-muted">{dataBreve(d.emesso_il)}</span>}
              </p>
              {d.azienda && <p className="text-[12px] text-ink-muted">{d.azienda}</p>}
              <ul className="mt-1 list-disc pl-5 text-[12.5px] text-ink-soft">
                {d.motivi.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              {puoScrivere(az.ruolo) && (
                <button type="button" disabled={az.occupato} onClick={() => az.invia(`Prepara la nuova revisione di ${nomeTipoDocumento(d.tipo)} n. ${d.documento_id} con i riferimenti aggiornati`)} className={clsx(BTN, 'mt-1.5')}>
                  Prepara la revisione
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Modello DVR Nube 81
// ------------------------------------------------------------------
export function PannelloNube81({ p }: { p: P<'nube81'> }) {
  const [tutti, setTutti] = useState(false);
  const totale = p.compilati + p.mancanti.length;
  const pct = totale > 0 ? Math.round((p.compilati / totale) * 100) : 0;
  const mostrati = tutti ? p.mancanti : p.mancanti.slice(0, 12);
  return (
    <CartaPannello icona={Rete} titolo="Modello Nube 81" sottotitolo={p.modello ? `Modello ${p.modello.replace(/_/g, ' ')}` : null}>
      <p className="flex items-baseline gap-2">
        <span className="cifre text-[26px] font-semibold leading-none text-brand-900">{p.compilati}</span>
        <span className="text-[12.5px] text-ink-muted">segnaposto compilati su {totale}</span>
        <span className="cifre ml-auto text-[12.5px] font-semibold text-ink-soft">{pct}%</span>
      </p>
      <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </span>
      {p.mancanti.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[12px] font-semibold text-ink-muted">Restano in rosso nel Word ({p.mancanti.length})</p>
          <ul className="flex flex-wrap gap-1">
            {mostrati.map((m) => (
              <li key={m} className="cifre rounded-md bg-danger px-1.5 py-0.5 text-[11px] text-danger-ink">
                {m}
              </li>
            ))}
          </ul>
          {p.mancanti.length > 12 && (
            <button type="button" onClick={() => setTutti((v) => !v)} className="mt-1 min-h-[44px] text-[12.5px] font-semibold text-brand-700">
              {tutti ? 'Mostra meno' : `Mostra tutti (${p.mancanti.length - 12} in più)`}
            </button>
          )}
        </div>
      )}
      {p.da_aggiungere_a_nube.length > 0 && (
        <p className="mt-2 text-[12.5px] text-ink-soft">
          Dati da aggiungere anche su Nube 81: <span className="cifre">{p.da_aggiungere_a_nube.join(', ')}</span>
        </p>
      )}
      {p.riferimenti_superati > 0 && <p className="mt-2 text-[12.5px] font-medium text-danger-ink">Il modello contiene {p.riferimenti_superati} riferimenti normativi superati: aggiornali prima della firma.</p>}
      {p.avvisi.length > 0 && (
        <ul className="mt-2 space-y-1">
          {p.avvisi.map((a, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] text-warn-ink">
              <Avviso size={14} aria-hidden className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
      {p.link && (
        <a href={p.link} target="_blank" rel="noopener noreferrer" className={clsx(BTN, 'mt-3 inline-flex items-center gap-1.5')}>
          <Download size={15} aria-hidden /> Scarica il Word
        </a>
      )}
      <p className="mt-2 text-[11.5px] text-ink-subtle">Bozza nel formato Nube 81: va verificata e firmata dalle figure competenti. Il link scade dopo 30 minuti.</p>
    </CartaPannello>
  );
}

// ------------------------------------------------------------------
// Nomine e radon
// ------------------------------------------------------------------
export function PannelloNomine({ p }: { p: P<'nomine'> }) {
  const az = useAzioniPannelli();
  return (
    <CartaPannello icona={Scudo} titolo="Nomine e designazioni" sottotitolo={`${p.nomine.filter((n) => n.attiva).length} attive, ${p.mancanti.length} mancanti`}>
      {p.nomine.length === 0 ? (
        <Vuoto>Nessuna nomina registrata.</Vuoto>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {p.nomine.map((n, i) => (
            <li key={n.documento_id ?? i} className="flex min-h-[44px] items-center gap-2 py-1.5">
              <span className={clsx('h-2 w-2 shrink-0 rounded-full', n.attiva ? 'bg-ok-mark' : 'bg-grafite-300')} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{n.nome}</span>
              <BadgeStatoDoc stato={n.stato} />
            </li>
          ))}
        </ul>
      )}
      {p.mancanti.length > 0 && (
        <div className="mt-3 rounded-[0.875rem] bg-warn px-3 py-2">
          <p className="text-[12.5px] font-semibold text-warn-ink">Mancano</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-ink">
            {p.mancanti.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          {puoScrivere(az.ruolo) && (
            <button type="button" disabled={az.occupato} onClick={() => az.invia('Prepara le nomine che mancano con i nominativi dell’organigramma')} className={clsx(BTN, 'mt-2')}>
              Prepara le nomine mancanti
            </button>
          )}
        </div>
      )}
    </CartaPannello>
  );
}

export function PannelloRadon({ p }: { p: P<'radon_calcolo'> }) {
  const c = p.sopra == null ? null : p.sopra ? COLORE.rosso : COLORE.verde;
  return (
    <CartaPannello icona={Grafico} titolo="Radon, media annua" sottotitolo={p.giorni != null ? `${p.giorni} giorni di misura` : null}>
      <p className="flex items-baseline gap-2">
        <span className="cifre text-[30px] font-semibold leading-none text-brand-900">{p.media == null ? 'nd' : p.media.toLocaleString('it-IT')}</span>
        <span className="text-[12.5px] text-ink-muted">Bq/m³{p.incertezza != null ? `, incertezza ${p.incertezza.toLocaleString('it-IT')}%` : ''}</span>
      </p>
      {c && (
        <p className={clsx('mt-2 rounded-[0.875rem] px-3 py-2 text-[13px] font-semibold', c.fondo, c.testo)}>
          {p.sopra ? 'Sopra il livello di riferimento di 300 Bq/m³: servono misure correttive' : 'Sotto il livello di riferimento di 300 Bq/m³'}
        </p>
      )}
      {p.scadenze.length > 0 && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px]">
          {p.scadenze.map((s) => (
            <div key={s.voce} className="contents">
              <dt className="text-ink-muted">{s.voce}</dt>
              <dd className="cifre text-ink">{dataBreve(s.data) || s.data}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[11.5px] text-ink-subtle">Media pesata sui giorni e scadenze calcolate dalla piattaforma (D.Lgs. 101/2020 artt. 17 e 18).</p>
    </CartaPannello>
  );
}
