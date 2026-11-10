'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Pastiglia, Riga, Scheda, Schede, Testata, Vuoto, dataIt, traGiorni } from '../../kit';
import { Avviso, Campo, Fatto, Info, Riquadri, SceltaFile, oggiIso, useDati } from './comuniAccount';
import { Cartella as IconaCartella, Condividi, Copia, Documento, Scarica } from '@/components/icone';
import {
  caricaDocumento,
  cartelle as caricaCartelle,
  chiediRevisione,
  condivisioni as caricaCondivisioni,
  creaCondivisione,
  documentiEmessi,
  raggruppa,
  revocaCondivisione,
  scaricaFile,
  sembraSanitario,
  statoCondivisione,
  validaCaricamento,
  type Cartella,
  type Condivisione,
  type DocumentoEmesso,
} from '@/lib/portale/azienda-account-api';
import { RiquadroLogo } from '../../RiquadroLogo';
import { useLargo } from '../gestionale/comune';
import { PilaCartelle, SchedaCompletezza, SchedaDaFirmare } from './DocumentiStato';
import { docStato } from '@/lib/portale/luoghi-api';
import { sediAlimentariDi } from '@/components/portale/telefono/SceltaSede';

type Vista = 'documenti' | 'cartelle' | 'firmare' | 'condivisi' | 'completezza';

/**
 * Documenti e DVR dell'area azienda: i documenti emessi dallo studio (mai le
 * bozze) per tipo, con revisione, data e download; le nove cartelle del
 * fascicolo con i caricamenti dell'azienda; i link di condivisione a scadenza.
 * Il Falco spiega i documenti leggendone il testo vero; l'azienda non li modifica,
 * ma puo' chiedere allo studio una revisione.
 */
export default function Documenti() {
  const { azienda, puo, chiedi, apri, versione } = usePortale();
  const id = azienda?.id ?? 0;
  const [vista, setVista] = useState<Vista>('documenti');
  const [aperto, setAperto] = useState<DocumentoEmesso | null>(null);
  const [cartellaAperta, setCartellaAperta] = useState<Cartella | null>(null);
  const [carica, setCarica] = useState<string | null>(null);
  const [condividi, setCondividi] = useState(false);
  const [titoloCarica, setTitoloCarica] = useState('');
  const largo = useLargo();

  const docs = useDati(() => documentiEmessi(id), [id, versione]);
  const fasc = useDati(() => caricaCartelle(id), [id, versione]);
  const cond = useDati(() => (puo('documenti_condividi') ? caricaCondivisioni(id) : Promise.resolve(null)), [id, versione]);

  const gruppi = useMemo(() => raggruppa(docs.dati ?? []), [docs.dati]);
  const attive = (cond.dati?.voci ?? []).filter((c) => ['attivo', 'presto'].includes(statoCondivisione(c))).length;

  useEffect(() => {
    apri(aperto ? { tipo: aperto.tipo, id: aperto.id } : null, id);
  }, [aperto, apri, id]);

  if (!azienda) return null;
  const nDoc = docs.dati?.length ?? 0;
  const voci: Array<{ k: Vista; t: string; n?: number }> = [
    { k: 'documenti', t: 'Documenti', n: nDoc },
    { k: 'cartelle', t: 'Cartelle' },
    { k: 'firmare', t: 'Da firmare' },
    ...(puo('documenti_condividi') ? [{ k: 'condivisi' as Vista, t: 'Condivisi', n: attive }] : []),
    { k: 'completezza', t: 'Completezza' },
  ];

  return (
    <div className="space-y-5">
      <Testata
        categoria="documenti"
        icona={IconaCartella}
        sopra={azienda.ragione_sociale}
        titolo="Documenti e DVR"
        sotto={docs.carico ? 'Carico i documenti' : `${nDoc === 1 ? '1 documento emesso' : `${nDoc} documenti emessi`} dallo studio · fascicolo in 9 cartelle`}
        azioni={
          <>
            {puo('documenti_carica') && (
              <button type="button" className="btn-primary flex-1 whitespace-nowrap sm:flex-none" data-falco="carica_documento" data-falco-tocca="" onClick={() => setCarica('')}>
                <span className="sm:hidden">Carica</span>
                <span className="hidden sm:inline">Carica un documento</span>
              </button>
            )}
            {puo('documenti_condividi') && (
              <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => setCondividi(true)}>
                <Condividi size={16} aria-hidden /> Condividi
              </button>
            )}
          </>
        }
      />
      {!puo('documenti_carica') && !puo('documenti_condividi') && <Blocco>Puoi vedere e scaricare. Caricamenti e condivisioni spettano al titolare.</Blocco>}

      <Schede voci={voci} attiva={vista} onCambia={setVista} etichetta="Schede dei documenti" />

      {vista === 'documenti' && (
        <div className="space-y-4">
          {docs.carico && !docs.dati ? (
            <Caricamento testo="Carico i documenti" />
          ) : docs.errore ? (
            <Errore testo={docs.errore} onRiprova={docs.ricarica} />
          ) : gruppi.length === 0 ? (
            <Vuoto titolo="Nessun documento emesso">Quando lo studio approva o emette un documento per la tua azienda lo trovi qui, con la data e la revisione.</Vuoto>
          ) : (
            gruppi.map((g) => (
              <Scheda key={g.gruppo} titolo={g.titolo} sotto={g.voci.length === 1 ? '1 documento' : `${g.voci.length} documenti`}>
                {g.voci.map((d) => (
                  <Riga
                    key={`${d.tipo}-${d.id}`}
                    inizio={<Pastiglia categoria="documenti" icona={Documento} />}
                    titolo={d.titolo}
                    sotto={`Revisione ${d.revisione}${d.emessoIl ? ` · ${dataIt(d.emessoIl)}` : ''}`}
                    onClick={() => setAperto(d)}
                    fine={<Chip stato="ok">Emesso</Chip>}
                  />
                ))}
              </Scheda>
            ))
          )}
          <RiquadroLogo tipo="azienda" companyId={id} nome={azienda.ragione_sociale} />
          <p className="px-1 text-[12.5px] leading-relaxed text-ink-muted">
            I documenti li preparano e li emettono i tecnici dello studio. Quelli redatti con assistenza AI valgono dopo la verifica e la firma delle figure competenti.
          </p>
        </div>
      )}

      {vista === 'cartelle' && (
        <div className="space-y-4">
          {fasc.carico && !fasc.dati ? (
            <Caricamento testo="Carico il fascicolo" />
          ) : fasc.errore ? (
            <Errore testo={fasc.errore} onRiprova={fasc.ricarica} />
          ) : (
            !largo ? (
              <PilaCartelle onApri={(k) => setCartellaAperta((fasc.dati ?? []).find((c) => c.chiave === k) ?? null)}
                cartelle={(fasc.dati ?? []).map((c) => ({
                  chiave: c.chiave, nome: c.nome, documenti: c.documenti, attiva: c.chiave !== 'haccp' || (sediAlimentariDi(azienda) ?? 1) > 0,
                  segno: c.voci.some((v) => v.esito === 'non_conforme' || v.esito === 'in_scadenza') ? 'aggiorna' : null,
                }))} />
            ) : (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {(fasc.dati ?? []).map((c) => (
                <li key={c.chiave}>
                  <button
                    type="button"
                    onClick={() => setCartellaAperta(c)}
                    className="premi flex min-h-[8.5rem] w-full flex-col justify-between rounded-[1.25rem] bg-white p-4 text-left shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]"
                  >
                    <Pastiglia categoria="documenti" icona={IconaCartella} />
                    <span>
                      <span className="block text-[15px] font-medium leading-snug text-ink">{c.nome}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-muted">{c.documenti === 0 ? 'Ancora vuota' : c.documenti === 1 ? '1 documento' : `${c.documenti} documenti`}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            )
          )}
          <Avviso tono="info" titolo="Niente dati sanitari nel fascicolo">
            Giudizi, esiti ed esami restano al medico competente. Se li carichi per errore vengono bloccati e cancellati.
          </Avviso>
        </div>
      )}

      {vista === 'condivisi' && <Condivisi stato={cond} onNuova={() => setCondividi(true)} />}
      {vista === 'firmare' && <SchedaDaFirmare aid={id} largo={largo} />}
      {vista === 'completezza' && (
        <SchedaCompletezza aid={id} onCarica={(k, nome) => { setTitoloCarica(nome); setCarica(k); }}
          onApriCartella={(k) => setCartellaAperta((fasc.dati ?? []).find((c) => c.chiave === k) ?? null)} />
      )}

      <DettaglioDocumento d={aperto} aziendaId={id} onChiudi={() => setAperto(null)} chiedi={chiedi} />
      <FoglioCartella
        c={cartellaAperta}
        puoCaricare={puo('documenti_carica')}
        onChiudi={() => setCartellaAperta(null)}
        onCarica={(k) => {
          setCartellaAperta(null);
          setCarica(k);
        }}
        onVaiDocumenti={() => {
          setCartellaAperta(null);
          setVista('documenti');
        }}
      />
      <FoglioCarica
        aperto={carica !== null}
        cartellaIniziale={carica ?? ''}
        titoloIniziale={titoloCarica}
        cartelle={fasc.dati ?? []}
        aziendaId={id}
        onChiudi={() => { setCarica(null); setTitoloCarica(''); }}
        onFatto={() => fasc.ricarica()}
      />
      <FoglioCondividi
        aperto={condividi}
        aziendaId={id}
        ammesse={cond.dati?.ammesse ?? []}
        giorniMax={cond.dati?.giorniMax ?? 90}
        cartelle={fasc.dati ?? []}
        onChiudi={() => setCondividi(false)}
        onFatto={() => cond.ricarica()}
      />
    </div>
  );
}

// ---------------------------------------------------------------- dettaglio documento

function DettaglioDocumento({ d, aziendaId, onChiudi, chiedi }: { d: DocumentoEmesso | null; aziendaId: number; onChiudi: () => void; chiedi: (t: string) => void }) {
  const [errore, setErrore] = useState<string | null>(null);
  const [scarico, setScarico] = useState<string | null>(null);
  const [revisione, setRevisione] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState(false);
  useEffect(() => {
    setErrore(null);
    setRevisione(false);
    setMotivo('');
    setFatto(false);
  }, [d]);
  if (!d) return <Foglio aperto={false} titolo="" onChiudi={onChiudi}>{null}</Foglio>;

  const scarica = async (formato: 'pdf' | 'docx') => {
    const path = formato === 'pdf' ? d.pdf : d.docx;
    if (!path) return;
    setScarico(formato);
    setErrore(null);
    try {
      await scaricaFile(path, `${d.titolo}.${formato}`);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Download non riuscito.');
    } finally {
      setScarico(null);
    }
  };
  const invia = async () => {
    setInvio(true);
    setErrore(null);
    try {
      await chiediRevisione(aziendaId, d, motivo.trim());
      setFatto(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Richiesta non inviata.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto
      titolo={d.titolo}
      onChiudi={onChiudi}
      piede={
        fatto ? (
          <button type="button" className="btn-primary w-full" onClick={onChiudi}>
            Fatto
          </button>
        ) : revisione ? (
          <>
            <button type="button" className="btn-ghost" onClick={() => setRevisione(false)}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio || motivo.trim().length < 5} onClick={invia}>
              {invio ? 'Invio' : 'Manda la richiesta'}
            </button>
          </>
        ) : undefined
      }
    >
      {fatto ? (
        <Fatto titolo="Richiesta inviata">Il tecnico dello studio la riceve subito. La risposta arriva nei Messaggi, nella conversazione della revisione.</Fatto>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip stato="ok">Emesso</Chip>
            <span className="text-[13px] text-ink-muted">
              Revisione {d.revisione}
              {d.emessoIl ? ` · ${dataIt(d.emessoIl)}` : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-primary" disabled={!d.pdf || scarico !== null} onClick={() => scarica('pdf')}>
              <Scarica size={16} aria-hidden /> {scarico === 'pdf' ? 'Scarico' : 'PDF'}
            </button>
            <button type="button" className="btn-ghost" disabled={!d.docx || scarico !== null} onClick={() => scarica('docx')}>
              <Scarica size={16} aria-hidden /> {scarico === 'docx' ? 'Scarico' : 'Word'}
            </button>
          </div>
          {errore && <Avviso tono="danger">{errore}</Avviso>}

          <Scheda titolo="Chiedi al Falco" sotto="Legge il testo vero di questo documento e te lo spiega in parole semplici.">
            <div className="grid gap-2">
              {[
                ['Spiegamelo in breve', `Leggi "${d.titolo}" e spiegami in parole semplici cosa dice e cosa devo fare io.`],
                ['Cosa dice sul rumore', `Cosa dice "${d.titolo}" sul rumore? Cita la sezione.`],
                ['Quali DPI servono', `Quali DPI prevede "${d.titolo}" e per quali mansioni?`],
              ].map(([t, q]) => (
                <button key={t} type="button" onClick={() => chiedi(q)} className="flex min-h-[48px] items-center rounded-[1rem] px-4 text-left text-[14px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] hover:shadow-[inset_0_0_0_1.5px_#18181b]">
                  {t}
                </button>
              ))}
            </div>
          </Scheda>

          <Scheda titolo="Informazioni">
            <Info etichetta="Tipo">{d.tipo === 'dvr' ? 'Valutazione dei rischi' : d.tipo === 'pos' ? 'Piano operativo di sicurezza' : d.tipo === 'valutazione' ? 'Valutazione specifica' : 'Documento di sicurezza'}</Info>
            <Info etichetta="Revisione">{d.revisione}</Info>
            <Info etichetta="Emesso il">{d.emessoIl ? dataIt(d.emessoIl) : 'Non indicato'}</Info>
            <Info etichetta="Preparato da">Tecnici dello studio</Info>
          </Scheda>

          {revisione ? (
            <Campo etichetta="Cosa va rivisto e perché" aiuto="Per esempio: abbiamo una macchina nuova, un reparto nuovo, c'è stato un infortunio.">
              <textarea className="input-field h-28 py-3" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={4000} />
            </Campo>
          ) : (
            <div className="rounded-[1.25rem] bg-perla-velo p-4">
              <p className="text-[14px] text-ink">Qualcosa non torna o è cambiato in azienda?</p>
              <p className="mt-1 text-[13px] text-ink-muted">Il documento non si modifica da qui: chiedi allo studio una revisione.</p>
              <button type="button" className="btn-ghost mt-3 w-full sm:w-auto" onClick={() => setRevisione(true)}>
                Chiedi una revisione
              </button>
            </div>
          )}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- cartella

function FoglioCartella({ c, puoCaricare, onChiudi, onCarica, onVaiDocumenti }: { c: Cartella | null; puoCaricare: boolean; onChiudi: () => void; onCarica: (k: string) => void; onVaiDocumenti: () => void }) {
  const [errore, setErrore] = useState<string | null>(null);
  const [versione, setVersione] = useState<{ id: string; titolo: string; scadenza: string | null } | null>(null);
  const { azienda } = usePortale();
  useEffect(() => setErrore(null), [c]);
  if (versione) return <FoglioVersione aid={azienda?.id ?? 0} doc={versione} onChiudi={() => setVersione(null)} />;
  return (
    <Foglio
      aperto={c !== null}
      titolo={c?.nome ?? ''}
      onChiudi={onChiudi}
      piede={
        c && puoCaricare ? (
          <button type="button" className="btn-primary w-full" onClick={() => onCarica(c.chiave)}>
            Carica in questa cartella
          </button>
        ) : undefined
      }
    >
      {c && (
        <div className="space-y-4">
          {c.chiave === 'visite_mediche' && (
            <Avviso tono="info" titolo="Cosa contiene questa cartella">
              Protocollo sanitario, nomina del medico e visite per lavoratore con le sole date e scadenze. Mai esiti o giudizi.
            </Avviso>
          )}
          {!puoCaricare && <Blocco>Solo il titolare e il referente caricano documenti.</Blocco>}
          {errore && <Avviso tono="danger">{errore}</Avviso>}
          {c.voci.length === 0 ? (
            <Vuoto titolo="Cartella vuota">Quando lo studio prepara o tu carichi un documento lo trovi qui.</Vuoto>
          ) : (
            <div>
              {c.voci.map((v) => (
                <Riga
                  key={v.id}
                  inizio={<Pastiglia categoria="documenti" icona={Documento} />}
                  titolo={v.titolo}
                  sotto={[v.data ? dataIt(v.data) : null, v.scadenza ? `scade il ${dataIt(v.scadenza)}, ${traGiorni(v.scadenza)}` : null, v.caricato ? 'caricato' : 'preparato dallo studio'].filter(Boolean).join(' · ')}
                  fine={
                    v.caricato && v.haFile ? (
                      <span className="flex items-center gap-1">
                      {puoCaricare && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVersione(v)}>Nuova versione</button>}
                      <button
                        type="button"
                        aria-label={`Scarica ${v.titolo}`}
                        className="btn-icon"
                        onClick={() => scaricaFile(`/portale/fascicolo/${v.id}/download`, v.titolo).catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Download non riuscito.'))}
                      >
                        <Scarica size={18} aria-hidden />
                      </button>
                      </span>
                    ) : !v.caricato ? (
                      <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]" onClick={onVaiDocumenti}>
                        Apri
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
          {c.visite.length > 0 && (
            <Scheda titolo="Visite per lavoratore" sotto={c.nota ?? undefined}>
              {c.visite.map((v, i) => (
                <Riga key={i} titolo={v.lavoratore} sotto={`${v.mansione ?? ''}${v.ultima ? ` · ultima ${dataIt(v.ultima)}` : ''}`} fine={v.validaFino ? <span className="text-[13px] text-ink-muted">fino al {dataIt(v.validaFino)}</span> : <Chip stato="todo">Mai fatta</Chip>} />
              ))}
            </Scheda>
          )}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- caricamento

export function FoglioCarica({ aperto, cartellaIniziale, titoloIniziale = '', cartelle, aziendaId, onChiudi, onFatto }: { aperto: boolean; cartellaIniziale: string; titoloIniziale?: string; cartelle: Cartella[]; aziendaId: number; onChiudi: () => void; onFatto: () => void }) {
  const [cartella, setCartella] = useState('');
  const [titolo, setTitolo] = useState('');
  const [data, setData] = useState('');
  const [scadenza, setScadenza] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [avanz, setAvanz] = useState<number | null>(null);
  const [esito, setEsito] = useState<string | null | false>(false);
  useEffect(() => {
    if (!aperto) return;
    setCartella(cartellaIniziale || 'valutazione_rischi');
    setTitolo(titoloIniziale);
    setData('');
    setScadenza('');
    setFile(null);
    setErrore(null);
    setAvanz(null);
    setEsito(false);
  }, [aperto, cartellaIniziale, titoloIniziale]);
  const sanitario = sembraSanitario(titolo, file?.name);

  const invia = async () => {
    const e = validaCaricamento({ cartella, titolo, data: data || undefined, scadenza: scadenza || undefined, file: file ?? undefined }, oggiIso());
    if (e) return setErrore(e);
    setErrore(null);
    setAvanz(0);
    try {
      const r = await caricaDocumento(aziendaId, { cartella, titolo, data: data || undefined, scadenza: scadenza || undefined, file: file! }, setAvanz);
      setEsito(r.nota);
      onFatto();
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Caricamento non riuscito.');
    } finally {
      setAvanz(null);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Carica un documento"
      onChiudi={onChiudi}
      piede={
        esito !== false ? (
          <button type="button" className="btn-primary w-full" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={avanz !== null} onClick={invia}>
              {avanz !== null ? `Carico ${avanz}%` : 'Carica'}
            </button>
          </>
        )
      }
    >
      {esito !== false ? (
        <Fatto titolo="Documento caricato">{esito ?? 'Lo trovi nella sua cartella. Lo legge il sistema e lo vede il tecnico dello studio.'}</Fatto>
      ) : (
        <div className="space-y-4">
          <Avviso tono="danger" titolo="Non caricare documenti sanitari">
            Giudizi di idoneità, referti ed esami restano al medico competente: il portale li blocca e li cancella.
          </Avviso>
          <Campo etichetta="Cartella">
            <select className="input-field" value={cartella} onChange={(e) => setCartella(e.target.value)}>
              {(cartelle.length ? cartelle : [{ chiave: 'valutazione_rischi', nome: 'Valutazione dei rischi' } as Cartella]).map((c) => (
                <option key={c.chiave} value={c.chiave}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etichetta="Nome del documento" aiuto="Per esempio: Planimetria dei locali, Verbale di verifica impianto elettrico.">
            <input className="input-field" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={200} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Data del documento">
              <input type="date" className="input-field" value={data} max={oggiIso()} onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo etichetta="Scadenza, se c'è" aiuto="Se c'è, entra nello scadenziario.">
              <input type="date" className="input-field" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
            </Campo>
          </div>
          <Campo etichetta="File">
            <SceltaFile file={file} onFile={setFile} accetta=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,image/*" />
          </Campo>
          {sanitario && <Avviso tono="warn">Il nome sembra quello di un documento sanitario: se lo è, non caricarlo. Il portale lo bloccherebbe.</Avviso>}
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
    </Foglio>
  );
}

// ---------------------------------------------------------------- condivisioni

function Condivisi({ stato, onNuova }: { stato: { dati: { voci: Condivisione[] } | null; errore: string | null; carico: boolean; ricarica: () => void }; onNuova: () => void }) {
  const [revoca, setRevoca] = useState<Condivisione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const voci = stato.dati?.voci ?? [];
  const chip = { attivo: ['ok', 'Attivo'], presto: ['warn', 'Scade presto'], scaduto: ['neutral', 'Scaduto'], revocato: ['neutral', 'Revocato'] } as const;
  return (
    <div className="space-y-4">
      <Scheda titolo="Link in sola lettura" sotto="Con scadenza obbligatoria, al massimo 90 giorni. Ogni apertura viene registrata." azioni={<button type="button" className="btn-primary" onClick={onNuova}>Crea un link</button>}>
        {stato.carico && !stato.dati ? (
          <Caricamento />
        ) : stato.errore ? (
          <Errore testo={stato.errore} onRiprova={stato.ricarica} />
        ) : voci.length === 0 ? (
          <Vuoto titolo="Nessun documento condiviso">Crea un link per mandare documenti a un ispettore, un committente o un consulente. Scade da solo.</Vuoto>
        ) : (
          voci.map((c) => {
            const s = statoCondivisione(c);
            return (
              <Riga
                key={c.id}
                titolo={c.destinatario}
                sotto={`${c.cartelle.length === 1 ? '1 cartella' : `${c.cartelle.length} cartelle`} · ${c.scadeIl ? `scade il ${dataIt(c.scadeIl)}` : ''} · ${c.aperture === 1 ? '1 apertura' : `${c.aperture} aperture`}`}
                fine={
                  <span className="flex items-center gap-2">
                    <Chip stato={chip[s][0]}>{chip[s][1]}</Chip>
                    {(s === 'attivo' || s === 'presto') && (
                      <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]" onClick={() => setRevoca(c)}>
                        Revoca
                      </button>
                    )}
                  </span>
                }
              />
            );
          })
        )}
      </Scheda>
      <Foglio
        aperto={revoca !== null}
        titolo="Revoca il link"
        onChiudi={() => setRevoca(null)}
        piede={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRevoca(null)}>
              Tieni il link
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#d63d3e] px-5 text-[14px] font-medium text-white"
              onClick={async () => {
                if (!revoca) return;
                try {
                  await revocaCondivisione(revoca.id);
                  setRevoca(null);
                  stato.ricarica();
                } catch (e) {
                  setErrore(e instanceof Error ? e.message : 'Revoca non riuscita.');
                }
              }}
            >
              Revoca
            </button>
          </>
        }
      >
        <Avviso tono="warn" titolo="Il link smette subito di funzionare">
          {revoca?.destinatario} non potrà più aprire i documenti condivisi.
        </Avviso>
        {errore && <div className="mt-3"><Avviso tono="danger">{errore}</Avviso></div>}
      </Foglio>
    </div>
  );
}

export function FoglioCondividi({ aperto, aziendaId, ammesse, giorniMax, cartelle, onChiudi, onFatto, iniziale }: {
  aperto: boolean;
  aziendaId: number;
  ammesse: string[];
  giorniMax: number;
  cartelle: Cartella[];
  onChiudi: () => void;
  onFatto: () => void;
  iniziale?: { destinatario?: string; giorni?: number; motivo?: string };
}) {
  const [dest, setDest] = useState('');
  const [scelte, setScelte] = useState<string[]>([]);
  const [giorni, setGiorni] = useState<string[]>(['30']);
  const [errore, setErrore] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [copiato, setCopiato] = useState(false);
  // Si riparte da capo solo quando il foglio si apre: una ricarica dei dati dopo
  // la creazione non deve cancellare il link appena creato.
  useEffect(() => {
    if (!aperto) return;
    setDest(iniziale?.destinatario ?? '');
    setGiorni([String(iniziale?.giorni ?? 30)]);
    setErrore(null);
    setLink(null);
    setCopiato(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);
  const ammesseChiave = ammesse.join(',');
  useEffect(() => {
    if (aperto) setScelte(ammesseChiave ? ammesseChiave.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, ammesseChiave]);
  const nomi = Object.fromEntries(cartelle.map((c) => [c.chiave, c.nome]));
  const durate = [7, 30, 90].filter((g) => g <= giorniMax).map((g) => ({ k: String(g), t: `${g} giorni` }));

  const crea = async () => {
    if (dest.trim().length < 2) return setErrore('Scrivi a chi lo mandi: nome, ente o email.');
    if (scelte.length === 0) return setErrore('Scegli almeno una cartella.');
    setInvio(true);
    setErrore(null);
    try {
      const r = await creaCondivisione(aziendaId, { cartelle: scelte, destinatario: dest.trim(), giorni: Number(giorni[0] ?? 30), motivo: iniziale?.motivo });
      setLink(r.link);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Link non creato.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Condividi documenti"
      onChiudi={onChiudi}
      largo
      piede={
        link ? (
          <button type="button" className="btn-primary w-full" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={crea}>
              {invio ? 'Creo il link' : 'Crea il link'}
            </button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-4">
          <Fatto titolo="Link pronto">Mandalo come preferisci: email, WhatsApp, messaggio. Si apre in sola lettura, senza account.</Fatto>
          <div className="flex gap-2">
            <input readOnly className="input-field font-mono text-[12.5px]" value={link} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn-ghost shrink-0"
              onClick={() => {
                navigator.clipboard?.writeText(link).then(() => setCopiato(true)).catch(() => undefined);
              }}
            >
              <Copia size={16} aria-hidden /> {copiato ? 'Copiato' : 'Copia'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Campo etichetta="A chi" aiuto="Il destinatario non ha bisogno di un account.">
            <input className="input-field" value={dest} onChange={(e) => setDest(e.target.value)} maxLength={150} placeholder="Es. ASL Toscana, ispettore Rossi" />
          </Campo>
          <div>
            <p className="mb-1.5 text-[13.5px] font-medium text-ink">Quali cartelle</p>
            <Riquadri multipla etichetta="Cartelle da condividere" voci={ammesse.map((k) => ({ k, t: nomi[k] ?? k }))} scelti={scelte} onCambia={setScelte} />
            <p className="mt-1.5 text-[12.5px] text-ink-muted">Visite mediche e contratto non si condividono mai.</p>
          </div>
          <div>
            <p className="mb-1.5 text-[13.5px] font-medium text-ink">Il link scade dopo</p>
            <Riquadri etichetta="Durata del link" voci={durate} scelti={giorni} onCambia={setGiorni} />
          </div>
          <Avviso tono="info">Solo lettura: chi apre il link vede e scarica, non modifica nulla.</Avviso>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
    </Foglio>
  );
}


/** Foglio "Carica una nuova versione" (computer) o "Nuova versione" (telefono). */
function FoglioVersione({ aid, doc, onChiudi }: { aid: number; doc: { id: string; titolo: string; scadenza: string | null }; onChiudi: () => void }) {
  const largo = useLargo();
  const [file, setFile] = useState<File | null>(null);
  const [nota, setNota] = useState('');
  const [scad, setScad] = useState(doc.scadenza ?? '');
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ titolo?: string; testo: string } | null>(null);
  const carica = async () => {
    if (!file) return setErrore('Scegli il file della nuova versione.');
    try {
      setEsito(await docStato.nuovaVersione(aid, Number(doc.id), file, nota, doc.scadenza ? scad : null));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riuscito.');
    }
  };
  return (
    <Foglio aperto sopra={doc.titolo} titolo={largo ? 'Carica una nuova versione' : 'Nuova versione'} onChiudi={onChiudi}
      piede={esito ? <button type="button" className="btn btn-primary" onClick={onChiudi}>Fatto</button> : <><button type="button" className="btn btn-ghost" onClick={onChiudi}>Annulla</button><button type="button" className="btn btn-primary" onClick={carica}>Carica la nuova versione</button></>}>
      {esito ? <Fatto titolo={esito.titolo ?? ''}>{esito.testo}</Fatto> : (
        <>
          <p className="rounded-hse-lg bg-sunken px-4 py-3 text-small">La nuova diventa la versione in vigore. Le precedenti restano nello storico.</p>
          <Avviso tono="danger" titolo="Non caricare documenti sanitari">Giudizi, esiti ed esami vengono bloccati e cancellati.</Avviso>
          <Campo etichetta="Cosa cambia (facoltativo)"><input className="input" placeholder="Es. aggiornato il reparto saldatura" value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
          {doc.scadenza && <Campo etichetta="Nuova scadenza"><input type="date" className="input" value={scad} onChange={(e) => setScad(e.target.value)} /></Campo>}
          <Campo etichetta="File"><input type="file" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Campo>
          {errore && <p role="alert" className="text-small text-danger-mark">{errore}</p>}
        </>
      )}
    </Foglio>
  );
}
