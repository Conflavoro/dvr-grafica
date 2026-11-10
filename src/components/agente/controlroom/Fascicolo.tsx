'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Search } from '@/components/icone';
import type { FascicoloAggiornaInput, FascicoloCategoria, FascicoloCategoriaStato, FascicoloStatoDocumento, FascicoloVoce, CrEsito } from '@/lib/data-source';
import { useDataSource } from '@/lib/use-data-source';
import { clsx } from '@/lib/clsx';
import { CAMPO, Caricamento, Errore, Etichetta, Vuota } from '../spazio/kit';
import { BadgeEsito, ESITO, LINK_CR, Titoletto, daConsulente, dataCr, testoErrore, useDato, type SchedaControlRoomProps } from './kit';

export const NOMI_CATEGORIE: Record<string, string> = {
  dvr: 'DVR e valutazioni',
  nomine: 'Nomine e designazioni',
  attestati: 'Attestati',
  verbali: 'Verbali',
  sorveglianza: 'Sorveglianza sanitaria',
  formazione: 'Formazione e informazione',
  pos_duvri: 'POS, PSC e DUVRI',
  impianti: 'Impianti e attrezzature',
  emergenza: 'Emergenza e antincendio',
  altro: 'Altro',
};

const STATO_CAT: Record<FascicoloCategoriaStato['stato'], { l: string; cls: string }> = {
  vuota: { l: 'Vuota', cls: 'bg-brand-200' },
  aggiornato: { l: 'Aggiornata', cls: 'bg-ok-mark' },
  in_revisione: { l: 'In revisione', cls: 'bg-oro-500' },
  da_aggiornare: { l: 'Da aggiornare', cls: 'bg-danger-mark' },
};

const STATI_DOC: Array<{ v: FascicoloStatoDocumento; l: string }> = [
  { v: 'aggiornato', l: 'Aggiornato' },
  { v: 'in_revisione', l: 'In revisione' },
  { v: 'da_aggiornare', l: 'Da aggiornare' },
];

/** Segno della checklist: spunta, attesa o vuoto, sempre con testo accanto. */
export function SegnoChecklist({ esito }: { esito: CrEsito }) {
  if (esito === 'conforme')
    return (
      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ok-mark text-white">
        <Check size={13} strokeWidth={2.2} />
      </span>
    );
  return <span aria-hidden className={clsx('mt-0.5 h-5 w-5 shrink-0 rounded-md border-[1.5px]', esito === 'in_scadenza' ? 'border-oro-500 bg-oro-50' : esito === 'non_conforme' ? 'border-danger-mark bg-danger' : 'border-brand-300 bg-perla-carta')} />;
}

export function ChecklistEssenziali({ voci }: { voci: Array<{ chiave: string; voce: string; esito: CrEsito; messaggio: string; riferimento?: string }> }) {
  if (voci.length === 0) return <Vuota>Nessun documento essenziale richiesto.</Vuota>;
  const pronti = voci.filter((v) => v.esito === 'conforme').length;
  return (
    <div>
      <p className="mb-1 text-[12px] text-ink-muted">
        <span className="cifre font-semibold text-brand-900">{pronti}</span> pronti su <span className="cifre">{voci.length}</span>
      </p>
      <ul className="divide-y divide-perla-linea">
        {voci.map((v) => (
          <li key={v.chiave} className="flex items-start gap-2.5 py-2">
            <SegnoChecklist esito={v.esito} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium leading-snug text-ink">{v.voce}</span>
              <span className="block text-[11.5px] text-ink-muted">
                <span className="sr-only">{ESITO[v.esito].l}. </span>
                {v.messaggio}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RigaDocumento({ v, onApri, onCorreggi }: { v: FascicoloVoce; onApri?: () => void; onCorreggi?: () => void }) {
  const meta = [v.versione && `versione ${v.versione}`, dataCr(v.data), NOMI_CATEGORIE[v.categoria] ?? v.categoria].filter(Boolean).join(', ');
  return (
    <li className="flex items-start gap-2 py-2">
      <span className="min-w-0 flex-1">
        {onApri ? (
          <button type="button" onClick={onApri} className="block min-h-[24px] text-left text-[13px] font-medium leading-snug text-brand-800 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
            {v.titolo}
          </button>
        ) : (
          <span className="block text-[13px] font-medium leading-snug text-ink">{v.titolo}</span>
        )}
        <span className="block text-[11.5px] text-ink-muted">
          {meta}
          {v.scadenza && `, scade il ${dataCr(v.scadenza)}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <BadgeEsito esito={v.esito} />
        {onCorreggi && (
          <button type="button" onClick={onCorreggi} className="min-h-[32px] rounded px-1.5 text-[12px] font-semibold text-brand-700 hover:bg-perla-velo focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
            Correggi
          </button>
        )}
      </span>
    </li>
  );
}

function Correzione({ v, onFatto, onAnnulla }: { v: FascicoloVoce; onFatto: (n: FascicoloVoce) => void; onAnnulla: () => void }) {
  const ds = useDataSource();
  const [b, setB] = useState<FascicoloAggiornaInput>({
    categoria: v.categoria as FascicoloCategoria,
    stato_documento: (v.stato_documento as FascicoloStatoDocumento) ?? 'aggiornato',
    versione: v.versione ?? '1.0',
    scadenza_documento: v.scadenza,
  });
  const [salvo, setSalvo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const salva = async (e: FormEvent) => {
    e.preventDefault();
    if (v.documento_id == null) return;
    setSalvo(true);
    setErr(null);
    try {
      onFatto(await ds.controlRoom.fascicoloAggiorna(v.documento_id, { ...b, scadenza_documento: b.scadenza_documento || null }));
    } catch (x) {
      setErr(testoErrore(x, 'Correzione non salvata.'));
    } finally {
      setSalvo(false);
    }
  };
  const id = `fz-${v.id}`;
  return (
    <form onSubmit={(e) => void salva(e)} className="my-1 space-y-2 rounded-[0.875rem] bg-perla-superficie p-3 shadow-[inset_0_0_0_1px_rgba(14,14,16,0.08)]" aria-label={`Correggi ${v.titolo}`}>
      <div>
        <Etichetta htmlFor={`${id}-cat`}>Categoria</Etichetta>
        <select id={`${id}-cat`} className={CAMPO} value={b.categoria} onChange={(e) => setB({ ...b, categoria: e.target.value as FascicoloCategoria })}>
          {Object.entries(NOMI_CATEGORIE).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Etichetta htmlFor={`${id}-stato`}>Stato</Etichetta>
          <select id={`${id}-stato`} className={CAMPO} value={b.stato_documento} onChange={(e) => setB({ ...b, stato_documento: e.target.value as FascicoloStatoDocumento })}>
            {STATI_DOC.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Etichetta htmlFor={`${id}-ver`}>Versione</Etichetta>
          <input id={`${id}-ver`} className={CAMPO} value={b.versione ?? ''} maxLength={20} onChange={(e) => setB({ ...b, versione: e.target.value })} />
        </div>
      </div>
      <div>
        <Etichetta htmlFor={`${id}-scad`}>Scadenza del documento</Etichetta>
        <input id={`${id}-scad`} type="date" className={CAMPO} value={b.scadenza_documento ?? ''} onChange={(e) => setB({ ...b, scadenza_documento: e.target.value || null })} />
      </div>
      {err && <Errore testo={err} />}
      <div className="flex gap-2">
        <button type="submit" disabled={salvo} className="btn-primary min-h-[44px] flex-1">
          {salvo ? 'Salvo' : 'Salva la correzione'}
        </button>
        <button type="button" onClick={onAnnulla} className="btn-ghost min-h-[44px]">
          Annulla
        </button>
      </div>
    </form>
  );
}

/** Fascicolo digitale: categorie, documenti essenziali, ricerca e documenti recenti. */
export function Fascicolo({ aziendaId, ruolo, versione, chiedi }: SchedaControlRoomProps) {
  const ds = useDataSource();
  const [cerca, setCerca] = useState('');
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [inCorrezione, setInCorrezione] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(cerca.trim()), 300);
    return () => clearTimeout(t);
  }, [cerca]);
  const f = useDato(() => ds.controlRoom.fascicolo(aziendaId, { cerca: q || undefined, categoria }), [ds, aziendaId, versione, q, categoria]);
  const correggibile = daConsulente(ruolo);

  const apri = async (v: FascicoloVoce) => {
    setAvviso(null);
    try {
      if (v.documento_id != null && v.ha_file) await ds.companyDocuments.download(v.documento_id, v.titolo);
      else if (v.pos_id != null) await ds.pos.download(v.pos_id, 'pdf');
      else if (v.dvr_id != null) chiedi(`Apri il DVR n. ${v.dvr_id} di questa azienda e mostrami lo stato e l'indice.`);
      else if (v.tipo === 'organigramma') chiedi("Mostrami l'organigramma della sicurezza di questa azienda.");
      else setAvviso('Questa voce non ha un file da aprire.');
    } catch (e) {
      setAvviso(testoErrore(e, 'Documento non disponibile.'));
    }
  };

  if (f.inCorso && !f.dato) return <Caricamento testo="Carico il fascicolo" />;
  if (f.errore) return <Errore testo={f.errore} onRiprova={f.ricarica} />;
  const d = f.dato;
  if (!d) return null;
  const filtrato = !!q || !!categoria;

  return (
    <div className="space-y-1 py-3">
      <label className="flex h-11 items-center gap-2 rounded-[0.875rem] border border-[#e2e2e5] bg-perla-carta px-3 focus-within:border-brand-500">
        <Search size={15} aria-hidden className="text-ink-subtle" />
        <span className="sr-only">Cerca nel fascicolo</span>
        <input type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per titolo o contenuto" className="h-full w-full bg-transparent text-base outline-none sm:text-[13.5px]" />
      </label>

      <Titoletto azione={<span className="cifre text-[12px] text-ink-muted">{d.totale} documenti</span>}>Categorie</Titoletto>
      <div className="grid grid-cols-2 gap-1.5">
        {d.categorie.map((c) => {
          const on = categoria === c.chiave;
          return (
            <button
              key={c.chiave}
              type="button"
              aria-pressed={on}
              onClick={() => setCategoria(on ? null : c.chiave)}
              className={clsx(
                'premi flex min-h-[44px] items-center gap-2 rounded-full px-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                on ? 'bg-brand-900 text-perla-carta' : 'bg-perla-superficie text-ink shadow-[inset_0_0_0_1px_rgba(14,14,16,0.07)] hover:shadow-[inset_0_0_0_1px_rgba(14,14,16,0.3)]'
              )}
            >
              <span aria-hidden className={clsx('h-2 w-2 shrink-0 rounded-full', STATO_CAT[c.stato].cls)} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{c.nome}</span>
              <span className={clsx('cifre text-[12px]', on ? 'text-perla-carta/80' : 'text-ink-muted')}>{c.documenti}</span>
              <span className="sr-only">, {STATO_CAT[c.stato].l}</span>
            </button>
          );
        })}
      </div>

      {!filtrato && (
        <>
          <Titoletto>Documenti essenziali</Titoletto>
          <ChecklistEssenziali voci={d.essenziali} />
        </>
      )}

      <Titoletto
        azione={
          filtrato ? (
            <button type="button" onClick={() => { setCerca(''); setCategoria(null); }} className={clsx(LINK_CR, '-mr-2 text-[12.5px]')}>
              Togli i filtri
            </button>
          ) : undefined
        }
      >
        {filtrato ? `Risultati${categoria ? `: ${NOMI_CATEGORIE[categoria] ?? categoria}` : ''}` : 'Recenti'}
      </Titoletto>
      {avviso && <Errore testo={avviso} />}
      {d.recenti.length === 0 ? (
        <Vuota>{filtrato ? 'Nessun documento trovato.' : 'Il fascicolo è vuoto: carica i documenti nell’archivio, si classificano da soli.'}</Vuota>
      ) : (
        <ul className="divide-y divide-perla-linea">
          {d.recenti.map((v) =>
            inCorrezione === v.id ? (
              <li key={v.id}>
                <Correzione
                  v={v}
                  onAnnulla={() => setInCorrezione(null)}
                  onFatto={() => {
                    setInCorrezione(null);
                    f.ricarica();
                  }}
                />
              </li>
            ) : (
              <RigaDocumento key={v.id} v={v} onApri={() => void apri(v)} onCorreggi={correggibile && !v.virtuale ? () => setInCorrezione(v.id) : undefined} />
            )
          )}
        </ul>
      )}
    </div>
  );
}
