'use client';

import { useEffect, useRef, useState } from 'react';
import { Blocco, Chip, Foglio } from '../../kit';
import { Fotocamera, Matita, Piu, Spunta } from '@/components/icone';
import { toast } from '@/components/portale/telefono/stato';
import { clsx } from '@/lib/clsx';
import { fascicolo, type StatoAttrezzature, type StatoFascicolo, type VoceAttrezzatura } from '@/lib/portale/luoghi-api';
import { Campo } from './comuni';

const SEGNAPOSTO: Record<VoceAttrezzatura['gruppo'], string> = { macchinari: 'Es. Forno a gas', attrezzature: 'Es. Scala portatile', chimici: 'Es. Sgrassatore' };

/** Blocco "Macchinari, attrezzature e prodotti" di Completa il fascicolo (NOVITA 4). */
export function BloccoAttrezzature({ aid, onCambia }: { aid: number; onCambia?: () => void }) {
  const [s, setS] = useState<StatoAttrezzature | null>(null);
  const [scelte, setScelte] = useState<VoceAttrezzatura[]>([]);
  const [modifica, setModifica] = useState(false);
  const [aggiungi, setAggiungi] = useState<VoceAttrezzatura['gruppo'] | null>(null);
  const [leggo, setLeggo] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const carica = () => fascicolo.attrezzature(aid).then((r) => { setS(r); setScelte(r.gruppi.flatMap((g) => g.scelte)); }).catch(() => setS(null));
  useEffect(() => { void carica(); }, [aid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const aperto = !s.confermato || modifica;
  const scelta = (g: string, n: string) => scelte.some((v) => v.gruppo === g && v.nome.toLowerCase() === n.toLowerCase());
  const tocca = async (g: VoceAttrezzatura['gruppo'], n: string, fonte: VoceAttrezzatura['fonte'] = 'suggerita') => {
    if (!s.puo) return toast('Lo compila il titolare', 'info');
    const nuove = scelta(g, n) ? scelte.filter((v) => !(v.gruppo === g && v.nome.toLowerCase() === n.toLowerCase())) : [...scelte, { gruppo: g, nome: n, fonte }];
    setScelte(nuove);
    await fascicolo.salva(aid, nuove, false).catch(() => undefined);
  };
  const conferma = async (prima: boolean) => {
    const r = await fascicolo.salva(aid, scelte, true);
    toast(prima ? r.titolo : 'Modifiche salvate');
    setModifica(false);
    await carica();
    onCambia?.();
  };
  const etichetta = async (f: File | undefined) => {
    if (!f) return;
    setLeggo(true);
    try {
      const r = await fascicolo.etichetta(aid, f);
      const nuove = [...scelte, { gruppo: 'chimici' as const, nome: r.nome, fonte: 'etichetta' as const, pittogrammi: r.pittogrammi }];
      setScelte(nuove);
      await fascicolo.salva(aid, nuove, false);
      toast(`Letto: ${r.nome}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Non riuscito.', 'info');
    } finally {
      setLeggo(false);
    }
  };
  return (
    <section id="fas-attr" className="rounded-[1.75rem] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--hse-line)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-title">Macchinari, attrezzature e prodotti</p>
          <p className="mt-1 text-small text-fg-muted">Servono per scrivere la valutazione dei rischi (DVR): per ogni macchina e prodotto il tecnico valuta i rischi e le protezioni. Spunta quello che usate. Ti suggeriamo le voci tipiche della tua attività.</p>
        </div>
        {s.confermato ? <Chip stato="ok">Confermato</Chip> : <Chip stato="sign">Da fare</Chip>}
      </div>
      {!aperto ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-small">{s.riepilogo}</p>
          {s.puo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModifica(true)}><Matita size={15} aria-hidden /> Modifica l’elenco</button>}
        </div>
      ) : !s.puo ? (
        <div className="mt-3"><Blocco>Lo compila il titolare</Blocco></div>
      ) : (
        <>
          {s.gruppi.map((g) => {
            const voci = [...g.scelte.map((v) => v.nome), ...g.suggerite].filter((n, i, a) => a.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
            const n = scelte.filter((v) => v.gruppo === g.chiave).length;
            return (
              <div key={g.chiave} className="mt-4 border-t border-line pt-4">
                <p className="text-[15px] font-medium">{g.nome}{n > 0 ? ` · ${n} ${n === 1 ? 'scelto' : 'scelti'}` : ''}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {voci.map((nome) => {
                    const on = scelta(g.chiave, nome);
                    const p = scelte.find((v) => v.gruppo === g.chiave && v.nome === nome)?.pittogrammi;
                    return (
                      <button key={nome} type="button" aria-pressed={on} onClick={() => tocca(g.chiave, nome)}
                        className={clsx('flex min-h-[48px] items-center gap-2.5 rounded-hse-lg px-3 py-2 text-left text-small', on ? 'shadow-[inset_0_0_0_2px_#18181b]' : 'shadow-[inset_0_0_0_1px_var(--hse-line)]')}>
                        <span aria-hidden className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-md', on ? 'bg-acid-400 text-acid-950' : 'shadow-[inset_0_0_0_1.5px_var(--hse-line)]')}>{on && <Spunta size={13} />}</span>
                        <span className="min-w-0 flex-1"><span className="block">{nome}</span>{p && p.length > 0 && <span className="block text-caption opacity-70">{p.join(' · ')}</span>}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAggiungi(g.chiave)}><Piu size={15} aria-hidden /> Aggiungi</button>
                  {g.chiave === 'chimici' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}><Fotocamera size={15} aria-hidden /> Fotografa l’etichetta</button>}
                </div>
                {g.chiave === 'chimici' && (
                  <p className="mt-1 text-caption text-fg-muted">{leggo ? 'L’assistente legge nome e pittogrammi di pericolo…' : 'Va bene anche la scheda di sicurezza: l’assistente legge nome e pittogrammi di pericolo.'}</p>
                )}
              </div>
            );
          })}
          <input ref={file} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => etichetta(e.target.files?.[0])} />
          <div className="mt-4 border-t border-line pt-4">
            {!s.confermato ? (
              <>
                <button type="button" className="btn btn-lg btn-primary w-full sm:w-auto" onClick={() => conferma(true)}>Conferma l’elenco</button>
                <p className="mt-2 text-small text-fg-muted">Se manca qualcosa lo aggiunge il tecnico al sopralluogo. Potrai sempre modificarlo.</p>
              </>
            ) : <button type="button" className="btn btn-lg btn-secondary" onClick={() => conferma(false)}>Fatto</button>}
          </div>
        </>
      )}
      {aggiungi && <FoglioAggiungiVoce gruppo={aggiungi} gruppoNome={s.gruppi.find((g) => g.chiave === aggiungi)?.nome ?? ''} onChiudi={() => setAggiungi(null)}
        onAggiungi={async (nome) => {
          if (!scelta(aggiungi, nome)) {
            const nuove = [...scelte, { gruppo: aggiungi, nome, fonte: 'aggiunta' as const }];
            setScelte(nuove);
            await fascicolo.salva(aid, nuove, false).catch(() => undefined);
          }
          toast(`${nome}: aggiunto`);
          setAggiungi(null);
        }} />}
    </section>
  );
}

function FoglioAggiungiVoce({ gruppo, gruppoNome, onChiudi, onAggiungi }: { gruppo: VoceAttrezzatura['gruppo']; gruppoNome: string; onChiudi: () => void; onAggiungi: (n: string) => void }) {
  const [nome, setNome] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const ok = () => {
    const n = nome.trim().replace(/\s+/g, ' ');
    if (n.length < 2) return setErrore('Scrivi il nome.');
    onAggiungi(n.charAt(0).toUpperCase() + n.slice(1));
  };
  return (
    <Foglio aperto sopra="Completa il fascicolo" titolo={`Aggiungi: ${gruppoNome.toLowerCase()}`} onChiudi={onChiudi}
      piede={<button type="button" className="btn btn-primary" onClick={ok}>Aggiungi</button>}>
      <Campo etichetta="Nome" errore={errore ?? undefined} aiuto={gruppo === 'chimici' ? 'Scrivi il nome che leggi sull’etichetta.' : 'Basta il nome comune, anche senza marca e modello.'}>
        <input className="input" placeholder={SEGNAPOSTO[gruppo]} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
    </Foglio>
  );
}

/** Card "Ci pensa ISFOR" con le voci di ISFOR e lo stato del fascicolo (09). */
export function CiPensaIsfor({ aid }: { aid: number }) {
  const [f, setF] = useState<StatoFascicolo | null>(null);
  useEffect(() => { fascicolo.stato(aid).then(setF).catch(() => setF(null)); }, [aid]);
  if (!f) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-title">Ci pensa ISFOR</h2>
        <Chip stato={f.stato === 'completo' ? 'ok' : f.stato === 'isfor' ? 'info' : 'sign'}>{f.etichetta}</Chip>
      </div>
      <div className="rounded-[1.75rem] bg-surface px-4 shadow-[inset_0_0_0_1px_var(--hse-line)]">
        {f.isfor.map((v) => (
          <div key={v.voce} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            <span aria-hidden className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', v.fatto ? 'bg-grafite-900 text-white' : 'bg-sunken text-fg-muted')}>{v.fatto ? <Spunta size={16} /> : '…'}</span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{v.voce}</span><span className="block text-small text-fg-muted">{v.fatto ? 'Pronto, lo trovi nei documenti' : 'Lo prepara ISFOR'}</span></span>
            {v.fatto ? <Chip stato="ok">Pronto</Chip> : <Chip stato="info">In lavorazione</Chip>}
          </div>
        ))}
      </div>
    </section>
  );
}
