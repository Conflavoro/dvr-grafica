'use client';

import Link from 'next/link';

import { useState, type CSSProperties } from 'react';
import { Blocco, Caricamento, Chip, Errore, Vuoto, dataIt } from '../../kit';
import { Avanti, Cartella as IconaCartella, CerchioSpunta, Firma } from '@/components/icone';
import FoglioFirma from '../condivisi/FoglioFirma';
import { toast } from '@/components/portale/telefono/stato';
import { clsx } from '@/lib/clsx';
import { docStato, type Completezza, type DaFirmare } from '@/lib/portale/luoghi-api';
import { useCarica } from './comuni';

/**
 * Documenti (squadra S5): schede Da firmare e Completezza, pila delle cartelle sul telefono.
 * La firma usa il foglio comune di S3 (FoglioFirma, codice SMS).
 */

/** Colori delle cartelle d'archivio sul telefono (unica eccezione al colore di fondo, NOVITA 19). */
const COLORI: Record<string, string> = {
  valutazione_rischi: 'bg-cat-documenti', nomine: 'bg-cat-contratto', formazione: 'bg-cat-formazione', visite_mediche: 'bg-cat-visite',
  haccp: 'bg-cat-servizi', ambiente: 'bg-cat-pagamenti', rlst: 'bg-cat-persone', cantieri: 'bg-cat-scadenze', contratto: 'bg-cat-assistenza',
};

export interface CartellaPila {
  chiave: string;
  nome: string;
  documenti: number;
  attiva: boolean;
  segno: 'firma' | 'aggiorna' | 'arrivo' | null;
}

/** Cartelle d'archivio sovrapposte che si impilano scorrendo (telefono, CSS .cartella di S1). */
export function PilaCartelle({ cartelle, onApri }: { cartelle: CartellaPila[]; onApri: (k: string) => void }) {
  return (
    <div className="cartelle">
      {cartelle.map((c, i) => (
        <button key={c.chiave} type="button" className="cartella w-full text-left" style={{ '--i': i, top: `${64 + i * 16}px` } as CSSProperties} onClick={() => onApri(c.chiave)}>
          <span className={clsx('cartella-linguetta', c.attiva ? COLORI[c.chiave] ?? 'bg-cat-documenti' : 'bg-grafite-100 text-fg-muted')} style={{ left: `${(i % 3) * 26}%` }}>
            <IconaCartella size={16} aria-hidden /><span className="truncate">{c.nome}</span>
          </span>
          <span className={clsx('cartella-corpo', c.attiva ? COLORI[c.chiave] ?? 'bg-cat-documenti' : 'bg-grafite-100 text-fg-muted', i % 3 === 0 && 'rounded-tl-none')}>
            <span className="flex items-start justify-between gap-3">
              <span className="flex items-baseline gap-2.5">
                <span className="cifre text-[2.75rem] font-light leading-none">{c.documenti}</span>
                <span className="text-small opacity-75">{c.documenti === 1 ? 'documento' : 'documenti'}</span>
              </span>
              <span className="mt-1">
                {!c.attiva ? <Chip stato="neutral">Non attiva</Chip>
                  : c.segno === 'firma' ? <Chip stato="sign">Da firmare</Chip>
                    : c.segno === 'aggiorna' ? <Chip stato="warn">Da aggiornare</Chip>
                      : c.segno === 'arrivo' ? <Chip stato="info">In arrivo</Chip>
                        : <span className="text-caption opacity-70">{c.documenti > 0 ? 'In regola' : 'Ancora vuota'}</span>}
              </span>
            </span>
            <span className="flex justify-end"><span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-black/10"><Avanti size={16} /></span></span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Foglio di firma di un documento, con il foglio comune di S3. */
export function FirmaDocumento({ aid, doc, onChiudi, onFirmato }: { aid: number; doc: { tipo: 'dvr' | 'documento'; id: number; titolo: string; versione: string; preparato_il: string | null } | null; onChiudi: () => void; onFirmato: () => void }) {
  if (!doc) return null;
  return (
    <FoglioFirma aperto titolo={doc.titolo} sotto={`Versione ${doc.versione}${doc.preparato_il ? ` · ${dataIt(doc.preparato_il)}` : ''}`} onChiudi={onChiudi}
      avvia={async () => {
        const r = await docStato.avviaFirma(aid, doc.tipo, doc.id);
        return { token: r.token, cellulare: r.cellulare, codiceProva: r.codice_prova ?? null };
      }}
      firma={async (token, codice, letto) => { await docStato.firma(aid, doc.tipo, doc.id, token, codice, letto); }}
      onFirmato={() => { toast('Documento firmato'); onFirmato(); }} />
  );
}

/** Scheda "Da firmare" (computer: righe; telefono: la prima scheda acida). */
export function SchedaDaFirmare({ aid, largo, onApri }: { aid: number; largo: boolean; onApri?: (tipo: string, id: number) => void }) {
  const { dati: d, errore, carica } = useCarica(() => docStato.daFirmare(aid), [aid]);
  const [firma, setFirma] = useState<DaFirmare['da_firmare'][number] | null>(null);
  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!d) return <Caricamento />;
  const elenco = d.da_firmare.length === 0 ? (
    <Vuoto titolo="Niente da firmare">Quando ISFOR prepara un documento che richiede la tua firma lo trovi qui e nella dashboard.</Vuoto>
  ) : (
    <div className="rounded-hse-xl bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]">
      {d.da_firmare.map((x, i) => (
        <div key={`${x.tipo}-${x.id}`} className={clsx('flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-b-0', !largo && i === 0 && 'rounded-t-hse-xl bg-acid-400 text-acid-950')}>
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-cat-documenti-mark"><Firma size={18} /></span>
          <div className="min-w-0 flex-1">
            <button type="button" className="text-left text-title hover:underline" onClick={() => onApri?.(x.tipo, x.id)}>{x.titolo}</button>
            <p className="text-small text-fg-muted">{x.cartella_nome} · versione {x.versione}{x.preparato_il ? ` · preparato il ${dataIt(x.preparato_il)}` : ''}</p>
          </div>
          <Chip stato="sign">Da firmare</Chip>
          {d.puo_firmare ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setFirma(x)}>Firma</button> : <Blocco>Lo firma il titolare</Blocco>}
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div>{elenco}</div>
      <div className="space-y-4">
        <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
          <p className="text-title">Come funziona la firma</p>
          {[['Leggi il documento', 'Scorri l’anteprima completa'], ['Conferma con il codice', 'Ti arriva per SMS: è la verifica in due passaggi'], ['Copia nel fascicolo', 'La versione firmata sostituisce quella precedente e ti arriva per email']].map(([t, s], i) => (
            <div key={t} className="mt-3 flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-small">{i + 1}</span>
              <span><span className="block text-small font-medium">{t}</span><span className="block text-small text-fg-muted">{s}</span></span>
            </div>
          ))}
        </section>
        <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
          <p className="text-title">Firmati di recente</p>
          {d.firmati.length === 0 ? <p className="mt-2 text-small text-fg-muted">Nessuna firma recente.</p> : d.firmati.slice(0, largo ? 4 : 5).map((f, i) => (
            <p key={i} className="mt-2 flex items-center gap-2 text-small"><CerchioSpunta size={16} aria-hidden className="text-ok-mark" /><span className="min-w-0 flex-1">{f.titolo}</span><span className="text-fg-muted">{dataIt(f.firmato_il)}</span></p>
          ))}
        </section>
      </div>
      <FirmaDocumento aid={aid} doc={firma} onChiudi={() => setFirma(null)} onFirmato={() => { setFirma(null); carica(); }} />
    </div>
  );
}

/** Scheda "Completezza". */
export function SchedaCompletezza({ aid, onCarica, onApriCartella }: { aid: number; onCarica: (cartella: string, nome: string) => void; onApriCartella: (k: string) => void }) {
  const { dati: d, errore, carica } = useCarica(() => docStato.completezza(aid), [aid]);
  const firme = useCarica(() => docStato.daFirmare(aid), [aid]);
  const [firma, setFirma] = useState<DaFirmare['da_firmare'][number] | null>(null);
  if (errore) return <Errore testo={errore} onRiprova={carica} />;
  if (!d) return <Caricamento />;
  const azione = (k: string, x: Completezza['cartelle'][number]['cose'][number]) => {
    if (x.azione === 'firma') {
      if (!d.permessi.firma) return <Blocco>Firma il titolare</Blocco>;
      const f = firme.dati?.da_firmare.find((y) => y.tipo === x.tipo && y.id === x.documento);
      return <button type="button" className="btn btn-primary btn-sm" onClick={() => f && setFirma(f)}>Firma</button>;
    }
    if (x.azione === 'carica') return d.permessi.carica ? <button type="button" className="btn btn-primary btn-sm" onClick={() => onCarica(k, x.nome ?? '')}>Carica</button> : <Blocco>Carica il titolare</Blocco>;
    return <button type="button" className="btn btn-secondary btn-sm" onClick={() => onApriCartella(k)}>Apri</button>;
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
      <div className="space-y-4">
        <section className="rounded-hse-xl bg-acid-400 p-6 text-acid-950">
          <p className="text-small">Il fascicolo è completo al</p>
          <p><span className="text-[4.5rem] font-light leading-none lg:text-[5.5rem]">{d.percento}</span><span className="text-h2">%</span></p>
          <div className="mt-3 h-2 rounded-full bg-white/60"><div className="h-2 rounded-full bg-acid-950" style={{ width: `${d.percento}%` }} /></div>
          <p className="mt-3 text-small">{d.frase}</p>
        </section>
        <section className="rounded-hse-xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
          <p className="text-title">Come si calcola</p>
          <p className="mt-1 text-small text-fg-muted">Contiamo i documenti obbligatori per la tua attività{d.ateco ? ` (codice ATECO ${d.ateco})` : ''} e quanti sono presenti, firmati e non scaduti. Un fascicolo al 100% è pronto per un’ispezione.</p>
        </section>
      </div>
      <section className="rounded-hse-xl bg-surface shadow-[inset_0_0_0_1px_var(--hse-line)]">
        {d.cartelle.map((c) => (
          <div key={c.chiave} className="border-b border-line px-5 py-4 last:border-b-0">
            <div className="flex items-center gap-3">
              <span aria-hidden className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken', c.attiva ? 'text-cat-documenti-mark' : 'text-fg-faint')}><IconaCartella size={16} /></span>
              <button type="button" className="min-w-0 flex-1 text-left text-title hover:underline" onClick={() => onApriCartella(c.chiave)}>{c.nome}</button>
              <Chip stato={!c.attiva ? 'neutral' : c.cose.length === 0 ? 'ok' : 'warn'}>{c.chip}</Chip>
            </div>
            {!c.attiva && <p className="mt-2 pl-12 text-small text-fg-muted">Serve solo con una sede alimentare. <Link className="underline" href="/azienda/servizi/">Attiva il supplemento HACCP</Link></p>}
            {c.cose.map((x, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2 pl-12 text-small">
                <span className="min-w-0 flex-1">{x.testo}</span>
                {x.chi === 'isfor' ? <Chip stato="neutral">Lo fa ISFOR</Chip> : <span className="rounded-full px-2.5 py-0.5 text-caption shadow-[inset_0_0_0_1px_var(--hse-line)]">Tocca a te</span>}
                {azione(c.chiave, x)}
              </div>
            ))}
          </div>
        ))}
      </section>
      <FirmaDocumento aid={aid} doc={firma} onChiudi={() => setFirma(null)} onFirmato={() => { setFirma(null); carica(); firme.carica(); }} />
    </div>
  );
}
