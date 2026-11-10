'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Allerta, CerchioSpunta, Conversazioni, Elenco, Firma, Piu, Spunta } from '@/components/icone';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Scheda, Schede, Vuoto } from '../../kit';
import { FalcoSaluto, NumeroPiccolo } from '../../FalcoSaluto';
import { isApiMode } from '@/lib/data-source';
import { aziendePortale, type AziendaPortale } from '@/lib/portale/api';
import {
  accettaIscrizione,
  approvaAccesso,
  rifiutaAccesso,
  scelteAccesso,
  type ScelteAccesso,
  assegnaElemento,
  caricaCampione,
  caricaCoda,
  decidiProposta,
  FILTRI_CODA,
  MOTIVI_RIFIUTO,
  nuovoCompito,
  rifiutaIscrizione,
  salvaCampione,
  statoVoce,
  type AzioneCampione,
  type ElementoCoda,
  type FiltroCoda,
  type MotivoRifiuto,
  type PersonaStudio,
  type VistaCoda,
} from '@/lib/portale/gestionale-api';
import { cambiato, campiProposti, chipTermine, cosaAspetta, ETICHETTE_FILTRI, livello, payloadCorretto, quando, saluto } from '@/lib/portale/gestionale-logica';
import { ChipTono, Campo, linkSezione, NOMI_SEZIONI, useLargo } from './comune';
import { clsx } from '@/lib/clsx';

/**
 * Coda di lavoro del gestionale (spec 5): in un elenco le proposte degli
 * assistenti da decidere, gli allarmi e i compiti, con termine e assegnatario.
 * Telefono: elenco e dettaglio nel foglio dal basso. Computer: elenco e
 * dettaglio a destra (senza selezione, la giornata: compiti, assistenti, decise).
 */
/** La frase con cui Falco apre la coda: il numero che conta e da dove partire. */
function fraseCoda(t: { proposte: { numero: number }; allarmi: { numero: number; gravi: number }; scadenze: { numero: number } }, aspetta: number): string {
  if (aspetta === 0 && t.allarmi.numero === 0) return 'Non c’è niente che aspetta te. Se vuoi, controllo le aziende con più scadenze.';
  const parti = [t.proposte.numero > 0 && `${t.proposte.numero} proposte da decidere`, t.allarmi.numero > 0 && `${t.allarmi.numero} allarmi aperti`, t.scadenze.numero > 0 && `${t.scadenze.numero} scadenze senza prenotazione`].filter(Boolean);
  return `${aspetta === 1 ? 'Una cosa aspetta te' : `${aspetta} cose aspettano te`}${parti.length ? ': ' + parti.join(', ') : ''}. Parto dalla più urgente?`;
}

export default function Coda() {
  return (
    <Suspense fallback={<Caricamento />}>
      <CodaVista />
    </Suspense>
  );
}

function CodaVista() {
  const { user, versione, apri, ricarica, filtroCliente } = usePortale();
  const largo = useLargo();
  const router = useRouter();
  const params = useSearchParams();
  const [filtro, setFiltro] = useState<FiltroCoda>('tutto');
  const [assistente, setAssistente] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaCoda | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [scelto, setScelto] = useState<string | null>(null);
  const [foglioCompito, setFoglioCompito] = useState(false);
  const [foglioCampione, setFoglioCampione] = useState(false);
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    const el = params.get('el');
    if (el && /^[pv]\d+$/.test(el)) setScelto(el);
  }, [params]);

  useEffect(() => {
    let vivo = true;
    setErrore(null);
    // Con il filtro "Solo <azienda>" attivo: la coda di quel cliente.
    caricaCoda({ filtro, assistente, aziendaId: filtroCliente })
      .then((v) => vivo && setVista(v))
      .catch((e: Error) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, [filtro, assistente, versione, giro, filtroCliente]);

  const tutti = useMemo(() => {
    const m = new Map<string, ElementoCoda>();
    for (const x of [...(vista?.elementi ?? []), ...(vista?.deciseOggi ?? [])]) m.set(x.chiave, x);
    return m;
  }, [vista]);
  const elemento = scelto ? tutti.get(scelto) ?? null : null;

  useEffect(() => {
    if (!elemento) {
      apri(null, null);
      return;
    }
    apri(elemento.tipo === 'proposta' ? { tipo: 'proposta', id: elemento.id } : null, elemento.azienda?.id ?? null);
  }, [elemento, apri]);

  const scegli = (k: string | null) => {
    setScelto(k);
    router.replace(k ? `/gestionale/coda/?el=${k}` : '/gestionale/coda/', { scroll: false });
  };
  const dopo = useCallback(
    (e: ElementoCoda | null) => {
      setGiro((g) => g + 1);
      ricarica();
      if (e) setScelto(e.chiave);
    },
    [ricarica]
  );

  if (!isApiMode()) return <Vuoto titolo="Coda di lavoro">Con il backend collegato qui compaiono proposte, allarmi e compiti dello studio.</Vuoto>;

  const nome = user.name.replace(/^(dott\.?ssa|dott\.|ing\.|geom\.|avv\.|arch\.)\s+/i, '').split(' ')[0];
  const aspetta = vista ? cosaAspetta(vista.conteggi, vista.compitiOggi) : 0;
  const data = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      <FalcoSaluto
        titolo={`${saluto()}, ${nome}`}
        frase={vista ? fraseCoda(vista.tessere, aspetta) : 'Sto mettendo in ordine la coda dello studio.'}
        altro={
          <button type="button" onClick={() => setFoglioCompito(true)} className="inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13.5px] text-white hover:bg-white/20">
            <Piu size={15} aria-hidden /> Nuovo compito
          </button>
        }
      />

      {errore && <Errore testo={errore} onRiprova={() => setGiro((g) => g + 1)} />}

      {vista && (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <NumeroPiccolo
            etichetta="Proposte da decidere"
            valore={vista.tessere.proposte.numero}
            onClick={() => setFiltro('proposte')}
          />
          <NumeroPiccolo
            etichetta="Allarmi aperti"
            valore={vista.tessere.allarmi.numero}
            tono={vista.tessere.allarmi.gravi > 0 ? 'danger' : undefined}
            onClick={() => setFiltro('allarmi')}
          />
          <NumeroPiccolo
            etichetta="Scadenze senza prenotazione"
            valore={vista.tessere.scadenze.numero}
            tono={vista.tessere.scadenze.numero > 0 ? 'warn' : undefined}
            onClick={() => router.push('/gestionale/aziende/?stato=scaduto')}
          />
          <NumeroPiccolo
            etichetta="Avvii fermi oltre 48 ore"
            valore={vista.tessere.avvii.fermi.length}
            tono={vista.tessere.avvii.fermi.length > 0 ? 'danger' : undefined}
            onClick={() => router.push('/gestionale/avvio/')}
          />
        </div>
      )}

      <div className="space-y-2">
        <Schede
          etichetta="Filtri della coda"
          attiva={filtro}
          onCambia={(k) => {
            setFiltro(k);
            if (k === 'allarmi' || k === 'compiti') setAssistente(null);
          }}
          voci={FILTRI_CODA.map((k) => ({ k, t: ETICHETTE_FILTRI[k], n: vista?.conteggi[k] }))}
        />
        {vista && vista.assistenti.length > 0 && filtro !== 'allarmi' && filtro !== 'compiti' && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Assistente">
            <span className="flex shrink-0 items-center pr-1 text-[12.5px] text-ink-muted">Assistente</span>
            {[{ nome: null as string | null, proposte: 0 }, ...vista.assistenti].map((a) => (
              <button
                key={a.nome ?? 'tutti'}
                type="button"
                aria-pressed={assistente === a.nome}
                onClick={() => setAssistente(a.nome)}
                className={clsx(
                  'inline-flex h-11 lg:h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px]',
                  assistente === a.nome ? 'bg-grafite-900 text-white' : 'bg-white text-ink-soft shadow-[inset_0_0_0_1px_#e2e2e5] hover:text-ink'
                )}
              >
                {a.nome ?? 'Tutti'}
                {a.nome && <span className="cifre text-[12px] opacity-70">{a.proposte}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!vista && !errore && <Caricamento testo="Carico la coda" />}

      {vista && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.95fr)] lg:items-start lg:gap-5">
          <Scheda
            titolo={filtro === 'fatto_oggi' ? 'Fatto oggi' : 'Da fare'}
            sotto={
              filtro === 'fatto_oggi'
                ? 'Decise e chiuse oggi nello studio.'
                : 'Le proposte si decidono qui o nella schermata dell’azienda. Gli allarmi si chiudono da soli quando la causa sparisce.'
            }
          >
            {vista.elementi.length === 0 ? (
              <Vuoto titolo={filtro === 'proposte' ? 'Nessuna proposta da decidere' : filtro === 'fatto_oggi' ? 'Ancora niente di chiuso oggi' : 'Niente da fare qui'}>
                {filtro === 'tutto' ? 'La coda è pulita. Bel lavoro.' : 'Prova un altro filtro.'}
              </Vuoto>
            ) : (
              <ul>
                {vista.elementi.map((x) => (
                  <li key={x.chiave}>
                    <RigaElemento x={x} attivo={x.chiave === scelto} onClick={() => scegli(x.chiave)} />
                  </li>
                ))}
              </ul>
            )}
          </Scheda>

          {largo ? (
            <div className="sticky top-0 space-y-4">
              {elemento ? (
                <Scheda>
                  <div className="pt-4">
                    <Dettaglio x={elemento} persone={vista.persone} onFatto={dopo} onChiudi={() => scegli(null)} />
                  </div>
                </Scheda>
              ) : (
                <Giornata vista={vista} onCampione={() => setFoglioCampione(true)} onApri={scegli} />
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <Giornata vista={vista} onCampione={() => setFoglioCampione(true)} onApri={scegli} />
            </div>
          )}
        </div>
      )}

      {!largo && (
        <Foglio aperto={!!elemento} titolo={elemento?.tipo === 'proposta' ? 'Proposta' : elemento?.tipo === 'allarme' ? 'Allarme' : 'Compito'} onChiudi={() => scegli(null)}>
          {elemento && vista && <Dettaglio x={elemento} persone={vista.persone} onFatto={dopo} />}
        </Foglio>
      )}

      <FoglioCompito
        aperto={foglioCompito}
        persone={vista?.persone ?? []}
        io={user.id}
        onChiudi={() => setFoglioCompito(false)}
        onFatto={(e) => {
          setFoglioCompito(false);
          dopo(e);
        }}
      />
      {vista?.puoCampione && (
        <FoglioCampione
          aperto={foglioCampione}
          onChiudi={() => setFoglioCampione(false)}
          onFatto={() => {
            setFoglioCampione(false);
            dopo(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- riga

function iconaTipo(t: ElementoCoda['tipo']) {
  return t === 'proposta' ? Firma : t === 'allarme' ? Allerta : CerchioSpunta;
}

function RigaElemento({ x, attivo, onClick }: { x: ElementoCoda; attivo: boolean; onClick: () => void }) {
  const t = x.stato === 'fatto' ? null : chipTermine(x.termine);
  const sotto = [x.azienda?.nome ?? (x.tipo === 'compito' ? 'Interno' : 'Più aziende'), x.tipo === 'proposta' ? x.agente : null].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={attivo ? 'true' : undefined}
      className={clsx('flex min-h-[64px] w-full items-center gap-3 border-b border-perla-linea py-2.5 text-left last:border-b-0', attivo ? 'bg-perla-velo/70' : 'hover:bg-perla-velo/50')}
    >
      <Pastiglia categoria={x.tipo === 'proposta' ? 'avvio' : x.tipo === 'allarme' ? 'antincendio' : 'utenti'} icona={iconaTipo(x.tipo)} />
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-[14.5px] font-medium leading-snug', x.stato === 'fatto' ? 'text-ink-muted line-through decoration-grafite-300' : 'text-ink')}>{x.titolo}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">{sotto}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {x.stato === 'fatto' ? <EsitoChip x={x} /> : t && <ChipTono tono={x.gravita === 'danger' && t.tono === 'neutral' ? 'danger' : t.tono}>{t.testo}</ChipTono>}
        {x.assegnato && <span className="text-[12px] text-ink-subtle">{x.assegnato.nome.split(' ').slice(-1)[0]}</span>}
      </span>
    </button>
  );
}

function EsitoChip({ x }: { x: ElementoCoda }) {
  switch (x.esito) {
    case 'approvata':
      return <Chip stato="ok">Approvata</Chip>;
    case 'corretta':
      return <Chip stato="info">Corretta e approvata</Chip>;
    case 'respinta':
      return <Chip stato="danger">Rifiutata</Chip>;
    case 'errore':
      return <Chip stato="danger">Non applicata</Chip>;
    case 'risolto_da_solo':
      return <Chip stato="ok">Risolto</Chip>;
    default:
      return <Chip stato="ok">Fatto</Chip>;
  }
}

// ---------------------------------------------------------------- dettaglio

function Dettaglio({ x, persone, onFatto, onChiudi }: { x: ElementoCoda; persone: PersonaStudio[]; onFatto: (e: ElementoCoda | null) => void; onChiudi?: () => void }) {
  const { chiedi, user } = usePortale();
  const [valori, setValori] = useState<Record<string, string>>({});
  const [tolti, setTolti] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [rifiuta, setRifiuta] = useState(false);

  useEffect(() => {
    setValori({});
    setTolti([]);
    setNota('');
    setErrore(null);
  }, [x.chiave]);

  const campi = x.tipo === 'proposta' ? campiProposti(x.sottotipo, x.payload) : [];
  const modificato = cambiato(x.sottotipo, x.payload, valori, tolti);
  const lv = livello(x.livello);
  const t = x.stato === 'fatto' ? null : chipTermine(x.termine);
  const vai = linkSezione(x.sezione, x.azienda?.id);
  const aperta = x.stato !== 'fatto';

  const esegui = async (fn: () => Promise<ElementoCoda | null>) => {
    setLavoro(true);
    setErrore(null);
    try {
      onFatto(await fn());
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(false);
    }
  };

  const approva = () =>
    esegui(() =>
      decidiProposta(x.id, modificato && x.correggibile
        ? { decisione: 'correggi', payload: payloadCorretto(x.sottotipo, x.payload, valori, tolti), nota: nota || undefined }
        : { decisione: 'approva', nota: nota || undefined })
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {x.tipo === 'proposta' ? (
          aperta ? <Chip stato="approve">Da decidere</Chip> : <EsitoChip x={x} />
        ) : x.tipo === 'allarme' ? (
          <Chip stato={x.gravita === 'danger' ? 'danger' : 'warn'}>{x.gravita === 'danger' ? 'Grave' : 'Attenzione'}</Chip>
        ) : (
          <Chip stato="neutral">Compito</Chip>
        )}
        {lv && <ChipTono tono={lv.tono}>{lv.testo}</ChipTono>}
        {t && <ChipTono tono={t.tono}>{t.testo}</ChipTono>}
        {x.stato === 'in_carico' && <Chip stato="run">In carico</Chip>}
        {!aperta && x.tipo !== 'proposta' && <EsitoChip x={x} />}
      </div>

      <div>
        <h2 className="text-[20px] font-medium leading-snug tracking-[-0.015em] text-ink">{x.titolo}</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          {x.azienda ? (
            <Link href={`/gestionale/aziende/?id=${x.azienda.id}`} className="text-ink underline decoration-grafite-300 underline-offset-2 hover:decoration-ink">
              {x.azienda.nome}
            </Link>
          ) : (
            'Interno allo studio'
          )}
          {x.termine && ` · termine ${quando(x.termine)}`}
          {x.agente && ` · ${x.tipo === 'proposta' ? 'preparata da' : 'da'} ${x.agente}`}
        </p>
        {lv && <p className="mt-1 text-[12.5px] text-ink-muted">{lv.spiega}</p>}
      </div>

      {x.dettaglio && (
        <div className={clsx('whitespace-pre-line rounded-[1.25rem] px-4 py-3 text-[14px] leading-relaxed', x.tipo === 'proposta' ? 'bg-grafite-900 text-white' : 'bg-perla-velo text-ink-soft')}>
          {x.dettaglio}
        </div>
      )}
      {(x.fonte || x.certezza !== null) && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          {x.fonte && <span>Fonte: {x.fonte}</span>}
          {x.certezza !== null && <Chip stato={x.certezza >= 90 ? 'ok' : 'warn'}>Certezza {x.certezza}%</Chip>}
        </p>
      )}

      {x.tipo === 'proposta' && campi.length > 0 && (
        <div className="rounded-[1.25rem] shadow-[inset_0_0_0_1px_#e2e2e5]">
          <p className="px-4 pt-3 text-[13px] text-ink-muted">
            {aperta && x.puoDecidere && x.correggibile
              ? 'Togli la spunta ai dati sbagliati o correggili: entra solo quello che confermi.'
              : 'Dati della proposta.'}
          </p>
          <ul className="divide-y divide-perla-linea px-4 pb-2">
            {campi.map((c) => {
              const via = tolti.includes(c.campo);
              const modifica = aperta && x.puoDecidere && x.correggibile;
              return (
                <li key={c.campo} className="py-2.5">
                  <span className="flex min-h-[32px] items-center gap-3">
                    {modifica && (
                      <input
                        type="checkbox"
                        aria-label={`Includi ${c.etichetta}`}
                        checked={!via}
                        onChange={() => setTolti((v) => (via ? v.filter((k) => k !== c.campo) : [...v, c.campo]))}
                        className="h-5 w-5 shrink-0 accent-[#18181b]"
                      />
                    )}
                    <span className="text-[13px] text-ink-muted">{c.etichetta}</span>
                    {!modifica && <span className="ml-auto min-w-0 break-words text-right text-[14px] text-ink">{c.valore}</span>}
                  </span>
                  {modifica && (
                    <input
                      className={clsx('input-field mt-1.5 h-11', via && 'opacity-40')}
                      value={valori[c.campo] ?? c.valore}
                      disabled={via}
                      onChange={(e) => setValori((v) => ({ ...v, [c.campo]: e.target.value }))}
                      aria-label={c.etichetta}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {errore && <Errore testo={errore} />}

      {x.tipo === 'proposta' && aperta && (
        x.puoDecidere ? (
          <div className="space-y-3">
            <Campo etichetta="Nota (facoltativa)">
              <input className="input-field" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Perché approvi o cosa hai corretto" maxLength={500} />
            </Campo>
            {modificato && x.correggibile && (
              <p className="text-[12.5px] text-ink-muted">L’assistente usa la tua versione. La correzione conta nella misura dell’errore dell’assistente.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-acido" disabled={lavoro || (x.sottotipo === 'dati_azienda' && tolti.length === campi.length)} onClick={() => void approva()}>
                <Spunta size={16} aria-hidden /> {modificato && x.correggibile ? 'Approva la versione corretta' : 'Approva'}
              </button>
              <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => setRifiuta(true)}>
                Rifiuta
              </button>
            </div>
          </div>
        ) : (
          <Blocco>{x.blocco ?? 'Decide un altro ruolo'}</Blocco>
        )
      )}

      {x.sottotipo === 'iscrizione' && aperta && x.azienda && (
        <DecisioneIscrizione aziendaId={x.azienda.id} titolare={user.role === 'titolare_studio' || user.role === 'admin_conflavoro'} onFatto={() => onFatto(null)} />
      )}

      {x.sottotipo === 'richiesta_accesso' && aperta && x.fonteId != null && (
        <DecisioneAccesso richiestaId={x.fonteId} titolare={user.role === 'titolare_studio' || user.role === 'admin_conflavoro'} onFatto={() => onFatto(null)} />
      )}

      {x.tipo !== 'proposta' && !((x.sottotipo === 'iscrizione' || x.sottotipo === 'richiesta_accesso') && aperta) && (
        <div className="flex flex-wrap gap-2">
          {aperta ? (
            <>
              <button type="button" className="btn-acido" disabled={lavoro} onClick={() => void esegui(() => statoVoce(x.id, 'fatto'))}>
                <Spunta size={16} aria-hidden /> {x.tipo === 'allarme' ? 'Risolto' : 'Fatto'}
              </button>
              {(x.stato !== 'in_carico' || x.assegnato?.id !== user.id) && (
                <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => void esegui(() => statoVoce(x.id, 'prendi'))}>
                  Prendi in carico
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => void esegui(() => statoVoce(x.id, 'riapri'))}>
              Riapri
            </button>
          )}
        </div>
      )}

      {!aperta && (x.decisoDa || x.chiuso) && (
        <p className="text-[13px] text-ink-muted">
          {x.esito === 'risolto_da_solo' ? 'Chiuso da solo: la causa non c’è più' : `${x.tipo === 'proposta' ? 'Decisa' : 'Chiuso'}${x.decisoDa ? ` da ${x.decisoDa.nome}` : ''}`}
          {x.chiuso && ` il ${quando(x.chiuso)}`}
          {x.motivoRifiuto && ` · ${x.motivoRifiuto}`}
          {x.nota && ` · “${x.nota}”`}
        </p>
      )}

      {aperta && (
        <Campo etichetta="Assegnata a">
          <select
            className="input-field"
            value={x.assegnato?.id ?? ''}
            disabled={lavoro}
            onChange={(e) => void esegui(() => assegnaElemento(x.chiave, e.target.value ? Number(e.target.value) : null))}
          >
            <option value="">Nessuno, chi la prende</option>
            {persone.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === user.id ? ' (tu)' : ''}
              </option>
            ))}
          </select>
        </Campo>
      )}

      <div className="flex flex-wrap gap-2 border-t border-perla-linea pt-4">
        <button type="button" className="btn-ghost" onClick={() => chiedi(`Spiegami "${x.titolo}"${x.azienda ? ` di ${x.azienda.nome}` : ''}: da dove viene, cosa cambia e cosa mi consigli.`)}>
          Chiedi a Falco
        </button>
        {vai && (
          <Link href={vai} className="btn-ghost">
            {NOMI_SEZIONI[x.sezione ?? ''] ?? 'Apri la sezione'}
          </Link>
        )}
        {onChiudi && (
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Torna alla giornata
          </button>
        )}
      </div>

      <FoglioRifiuta
        aperto={rifiuta}
        onChiudi={() => setRifiuta(false)}
        onConferma={(motivo, n) => {
          setRifiuta(false);
          void esegui(() => decidiProposta(x.id, { decisione: 'respingi', motivo, nota: n || undefined }));
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- colonna della giornata

function Giornata({ vista, onCampione, onApri }: { vista: VistaCoda; onCampione: () => void; onApri: (k: string) => void }) {
  const fatto1 = vista.livello1.reduce((s, a) => s + a.numero, 0);
  return (
    <>
      <Scheda titolo="I tuoi compiti di oggi" sotto={vista.compitiOggi.totale === 0 ? 'Nessun compito con termine oggi.' : `${vista.compitiOggi.fatti} di ${vista.compitiOggi.totale} fatti`}>
        <p className="text-[13px] text-ink-muted">Il filtro Oggi mostra tutto quello che scade entro stasera, anche le proposte.</p>
      </Scheda>
      <Scheda titolo="Fatto dagli assistenti oggi" sotto={`${fatto1} azioni di livello 1. Una persona rivede un campione.`}>
        <ul>
          {vista.livello1.map((a) => (
            <li key={a.chiave} className="flex min-h-[56px] items-center gap-3 border-b border-perla-linea py-2 last:border-b-0">
              <span className="cifre w-10 shrink-0 text-[26px] font-light tracking-[-0.03em] text-ink">{a.numero}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-ink">{a.cosa}</span>
                <span className="block text-[12.5px] text-ink-muted">{a.assistente}</span>
              </span>
              {a.daCorreggere > 0 ? (
                <Chip stato="warn">{a.daCorreggere} da correggere</Chip>
              ) : a.rivisti > 0 ? (
                <Chip stato="ok">Campione ok</Chip>
              ) : null}
            </li>
          ))}
        </ul>
        {vista.puoCampione && fatto1 > 0 && (
          <button type="button" className="btn-ghost mt-3 w-full" onClick={onCampione}>
            Rivedi il campione
          </button>
        )}
      </Scheda>
      <Scheda titolo="Decise oggi da te" sotto={vista.deciseOggi.length === 0 ? 'Ancora nessuna.' : undefined}>
        {vista.deciseOggi.length > 0 && (
          <ul>
            {vista.deciseOggi.slice(0, 8).map((x) => (
              <li key={x.chiave}>
                <button type="button" onClick={() => onApri(x.chiave)} className="flex min-h-[52px] w-full items-center gap-3 border-b border-perla-linea py-2 text-left last:border-b-0 hover:bg-perla-velo/50">
                  <span className="cifre w-12 shrink-0 text-[12.5px] text-ink-muted">{x.chiuso ? new Date(x.chiuso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{x.titolo}</span>
                  <EsitoChip x={x} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Scheda>
    </>
  );
}

// ---------------------------------------------------------------- fogli

/** Iscrizione di un'azienda che ha scelto lo studio: il titolare accetta o rifiuta. */
function DecisioneIscrizione({ aziendaId, titolare, onFatto }: { aziendaId: number; titolare: boolean; onFatto: () => void }) {
  const [rifiuto, setRifiuto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  if (!titolare) return <Blocco>Accetta o rifiuta il titolare dello studio.</Blocco>;
  const fai = async (fn: () => Promise<void>) => {
    setLavoro(true);
    setErrore(null);
    try {
      await fn();
      onFatto();
    } catch (e) {
      setErrore((e as Error).message);
      setLavoro(false);
    }
  };
  return (
    <div className="space-y-3">
      {errore && <Errore testo={errore} />}
      {rifiuto ? (
        <>
          <Campo etichetta="Perché non la seguite (facoltativo, lo legge l’azienda)">
            <input className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </Campo>
          <p className="text-[12.5px] text-ink-muted">L’azienda viene tolta dallo studio e chi si è iscritto torna a scegliere chi la segue.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={lavoro} onClick={() => void fai(() => rifiutaIscrizione(aziendaId, motivo.trim()))}>
              Rifiuta l’iscrizione
            </button>
            <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => setRifiuto(false)}>
              Annulla
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-acido" disabled={lavoro} onClick={() => void fai(() => accettaIscrizione(aziendaId))}>
            <Spunta size={16} aria-hidden /> Accetta
          </button>
          <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => setRifiuto(true)}>
            Rifiuta
          </button>
        </div>
      )}
    </div>
  );
}

/** Richiesta di accesso: il titolare sceglie il ruolo (e l'azienda, se serve) e approva, oppure rifiuta. */
function DecisioneAccesso({ richiestaId, titolare, onFatto }: { richiestaId: number; titolare: boolean; onFatto: () => void }) {
  const [scelte, setScelte] = useState<ScelteAccesso | null>(null);
  const [ruolo, setRuolo] = useState('');
  const [azienda, setAzienda] = useState('');
  const [rifiuto, setRifiuto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  useEffect(() => {
    if (!titolare) return;
    scelteAccesso()
      .then(setScelte)
      .catch((e: Error) => setErrore(e.message));
  }, [titolare]);
  if (!titolare) return <Blocco>Decide il titolare dello studio o lo staff Conflavoro.</Blocco>;
  const voce = scelte?.ruoli.find((r) => r.k === ruolo) ?? null;
  const fai = async (fn: () => Promise<void>) => {
    setLavoro(true);
    setErrore(null);
    try {
      await fn();
      onFatto();
    } catch (e) {
      setErrore((e as Error).message);
      setLavoro(false);
    }
  };
  return (
    <div className="space-y-3">
      {errore && <Errore testo={errore} />}
      {rifiuto ? (
        <>
          <Campo etichetta="Perché (facoltativo, lo legge chi ha chiesto)">
            <input className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={lavoro} onClick={() => void fai(() => rifiutaAccesso(richiestaId, motivo.trim()))}>
              Rifiuta la richiesta
            </button>
            <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => setRifiuto(false)}>
              Annulla
            </button>
          </div>
        </>
      ) : (
        <>
          <Campo etichetta="Che ruolo avrà">
            <select className="input-field h-11" value={ruolo} onChange={(e) => setRuolo(e.target.value)} disabled={!scelte}>
              <option value="">Scegli il ruolo</option>
              {(scelte?.ruoli ?? []).map((r) => (
                <option key={r.k} value={r.k}>
                  {r.t}
                </option>
              ))}
            </select>
          </Campo>
          {voce?.azienda && (
            <Campo etichetta="Su quale azienda">
              <select className="input-field h-11" value={azienda} onChange={(e) => setAzienda(e.target.value)}>
                <option value="">Scegli l’azienda</option>
                {(scelte?.aziende ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-acido"
              disabled={lavoro || !ruolo || (voce?.azienda === true && !azienda)}
              onClick={() => void fai(() => approvaAccesso(richiestaId, ruolo, voce?.azienda ? Number(azienda) : null))}
            >
              <Spunta size={16} aria-hidden /> Approva
            </button>
            <button type="button" className="btn-ghost" disabled={lavoro} onClick={() => setRifiuto(true)}>
              Rifiuta
            </button>
          </div>
          <p className="text-[12.5px] text-ink-muted">Chi ha chiesto riceve un’email e al prossimo accesso entra con questo ruolo.</p>
        </>
      )}
    </div>
  );
}

function FoglioRifiuta({ aperto, onChiudi, onConferma }: { aperto: boolean; onChiudi: () => void; onConferma: (m: MotivoRifiuto, nota: string) => void }) {
  const [motivo, setMotivo] = useState<MotivoRifiuto>('dati_sbagliati');
  const [nota, setNota] = useState('');
  return (
    <Foglio
      aperto={aperto}
      titolo="Rifiuta la proposta"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" onClick={() => onConferma(motivo, nota)}>
            Rifiuta la proposta
          </button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-ink-soft">Motivo</legend>
        {MOTIVI_RIFIUTO.map((m) => (
          <label key={m.k} className={clsx('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[1rem] px-4 text-[14.5px]', motivo === m.k ? 'bg-grafite-900 text-white' : 'shadow-[inset_0_0_0_1px_#e2e2e5]')}>
            <input type="radio" name="motivo" className="sr-only" checked={motivo === m.k} onChange={() => setMotivo(m.k)} />
            {m.t}
          </label>
        ))}
      </fieldset>
      <div className="mt-4">
        <Campo etichetta="Nota per l’assistente (facoltativa)">
          <textarea className="input-field h-24 py-3" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
        </Campo>
      </div>
      <p className="mt-3 text-[12.5px] text-ink-muted">La proposta torna alla persona assegnata. Il rifiuto conta nella misura dell’errore dell’assistente.</p>
    </Foglio>
  );
}

function FoglioCompito({ aperto, persone, io, onChiudi, onFatto }: { aperto: boolean; persone: PersonaStudio[]; io: number; onChiudi: () => void; onFatto: (e: ElementoCoda | null) => void }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [titolo, setTitolo] = useState('');
  const [dettaglio, setDettaglio] = useState('');
  const { aziendaScelta } = usePortale();
  const [aziendaId, setAziendaId] = useState<number | null>(aziendaScelta?.id ?? null);
  const [data, setData] = useState(oggi);
  const [a, setA] = useState<number | null>(io);
  const [aziende, setAziende] = useState<AziendaPortale[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    setTitolo('');
    setDettaglio('');
    setData(oggi);
    setA(io);
    setErrore(null);
    aziendePortale()
      .then(setAziende)
      .catch(() => setAziende([]));
  }, [aperto, io, oggi]);

  const salva = async () => {
    if (titolo.trim() === '') {
      setErrore('Scrivi cosa c’è da fare.');
      return;
    }
    setLavoro(true);
    try {
      onFatto(await nuovoCompito({ titolo: titolo.trim(), dettaglio: dettaglio.trim() || undefined, azienda_id: aziendaId, scade_il: data || null, assegnato_a: a }));
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Nuovo compito"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" disabled={lavoro} onClick={() => void salva()}>
            Aggiungi alla coda
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo etichetta="Cosa c’è da fare">
          <input className="input-field" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={200} placeholder="Chiamare il titolare per fissare il sopralluogo" />
        </Campo>
        <Campo etichetta="Azienda">
          <select className="input-field" value={aziendaId ?? ''} onChange={(e) => setAziendaId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Interno allo studio</option>
            {aziende.map((x) => (
              <option key={x.id} value={x.id}>
                {x.ragione_sociale}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etichetta="Entro il">
            <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="A chi">
            <select className="input-field" value={a ?? ''} onChange={(e) => setA(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Nessuno, chi lo prende</option>
              {persone.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.id === io ? ' (tu)' : ''}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo etichetta="Dettaglio (facoltativo)">
          <textarea className="input-field h-24 py-3" value={dettaglio} onChange={(e) => setDettaglio(e.target.value)} maxLength={2000} />
        </Campo>
        {errore && <Errore testo={errore} />}
      </div>
    </Foglio>
  );
}

function FoglioCampione({ aperto, onChiudi, onFatto }: { aperto: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [azioni, setAzioni] = useState<AzioneCampione[] | null>(null);
  const [esiti, setEsiti] = useState<Record<string, 'corretta' | 'da_correggere'>>({});
  const [errore, setErrore] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    setAzioni(null);
    setEsiti({});
    setErrore(null);
    caricaCampione()
      .then(setAzioni)
      .catch((e: Error) => setErrore(e.message));
  }, [aperto]);

  const k = (a: AzioneCampione) => `${a.oggettoTipo}:${a.oggettoId}`;
  const salva = async () => {
    if (!azioni) return;
    setLavoro(true);
    try {
      await salvaCampione(azioni.filter((a) => esiti[k(a)]).map((a) => ({ oggetto_tipo: a.oggettoTipo, oggetto_id: a.oggettoId, esito: esiti[k(a)] })));
      onFatto();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      largo
      titolo="Rivedi il campione"
      onChiudi={onChiudi}
      piede={
        <>
          <button type="button" className="btn-ghost" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn-primary" disabled={lavoro || Object.keys(esiti).length === 0} onClick={() => void salva()}>
            Salva il controllo
          </button>
        </>
      }
    >
      <p className="text-[14px] text-ink-muted">Azioni scelte a caso tra quelle fatte oggi dagli assistenti. Segna se sono corrette: quelle da correggere tornano a una persona come compito.</p>
      {errore && (
        <div className="mt-3">
          <Errore testo={errore} />
        </div>
      )}
      {!azioni && !errore && <Caricamento />}
      {azioni && azioni.length === 0 && (
        <div className="mt-4">
          <Vuoto titolo="Niente da rivedere">Le azioni di oggi sono già state controllate.</Vuoto>
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {(azioni ?? []).map((a) => (
          <li key={k(a)} className="rounded-[1.25rem] p-4 shadow-[inset_0_0_0_1px_#e2e2e5]">
            <p className="text-[12.5px] text-ink-muted">
              {a.assistente}
              {a.azienda && ` · ${a.azienda.nome}`}
            </p>
            <p className="mt-0.5 text-[14.5px] font-medium text-ink">{a.testo}</p>
            {a.estratto && <p className="mt-2 line-clamp-4 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{a.estratto}</p>}
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Esito">
              {(['corretta', 'da_correggere'] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={esiti[k(a)] === e}
                  onClick={() => setEsiti((v) => ({ ...v, [k(a)]: e }))}
                  className={clsx(
                    'inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium',
                    esiti[k(a)] === e ? (e === 'corretta' ? 'bg-grafite-900 text-white' : 'bg-stato-danger text-stato-danger-ink') : 'shadow-[inset_0_0_0_1.5px_#e2e2e5]'
                  )}
                >
                  {e === 'corretta' ? 'Corretta' : 'Da correggere'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Foglio>
  );
}

