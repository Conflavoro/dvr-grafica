'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Riga, Scheda, Testata, dataIt } from '../../kit';
import { Avviso, Campo, Riquadri, useDati } from './comuniAccount';
import { FoglioCarica } from './Documenti';
import { Razzo } from '@/components/icone';
import { cartelle as caricaCartelle, percentualeAvvio, rispondiAvvio, schedaAvvio, type PassoAvvio } from '@/lib/portale/azienda-account-api';
import { BloccoAttrezzature, CiPensaIsfor } from './AvvioAttrezzature';

/** Documenti da caricare suggeriti al primo passo, con la cartella giusta. */
const GUIDATI: Array<{ titolo: string; cartella: string; perche: string }> = [
  { titolo: 'Visura camerale', cartella: 'contratto', perche: 'Ragione sociale, sede, attività e legale rappresentante.' },
  { titolo: 'Elenco del personale', cartella: 'contratto', perche: 'Nome, mansione e data di assunzione di ogni lavoratore (anche il Libro Unico).' },
  { titolo: 'Valutazione dei rischi precedente', cartella: 'valutazione_rischi', perche: 'Il vecchio DVR, se c\'è: il tecnico parte da lì.' },
  { titolo: 'Nomine della sicurezza', cartella: 'nomine', perche: 'RSPP, medico competente, addetti antincendio e primo soccorso.' },
  { titolo: 'Attestati di formazione', cartella: 'formazione', perche: 'Corsi già fatti dai lavoratori, con le date.' },
  { titolo: 'Planimetria dei locali', cartella: 'valutazione_rischi', perche: 'Serve per le vie di fuga e il piano di emergenza.' },
];

const STATI: Record<string, { chip: 'ok' | 'info' | 'todo' | 'warn'; t: string }> = {
  fatto: { chip: 'ok', t: 'Fatto' },
  in_corso: { chip: 'info', t: 'In lettura' },
  in_attesa_letture: { chip: 'todo', t: 'Aspetta i documenti' },
  da_fare: { chip: 'warn', t: 'Da fare' },
};

/**
 * Completa il fascicolo (scheda di avvio dal lato azienda): passi con la
 * percentuale, cosa manca, caricamenti guidati e domande su RSPP e medico.
 * Il Falco guida passo passo; la validazione la fa il tecnico dello studio.
 */
export default function Avvio() {
  const { azienda, puo, chiedi, versione } = usePortale();
  const id = azienda?.id ?? 0;
  const scheda = useDati(() => schedaAvvio(id), [id, versione]);
  const fasc = useDati(() => caricaCartelle(id), [id, versione]);
  const [carica, setCarica] = useState<{ cartella: string; titolo: string } | null>(null);

  if (!azienda) return null;
  const s = scheda.dati;
  const perc = s ? percentualeAvvio(s) : 0;
  const daFare = s ? s.passi.filter((p) => p.stato !== 'fatto').length : 0;

  return (
    <div className="space-y-5">
      <Testata
        categoria="avvio"
        icona={Razzo}
        sopra={azienda.ragione_sociale}
        titolo="Completa il fascicolo"
        sotto={s?.validataIl ? `Fascicolo aperto il ${dataIt(s.validataIl)}` : 'Mancano poche cose per avere il fascicolo completo. Il Falco ti guida passo passo.'}
        azioni={
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => chiedi('Guidami passo passo: qual è il prossimo documento da caricare per completare il fascicolo e dove lo trovo?')}>
            Guidami passo passo
          </button>
        }
      />

      {scheda.carico && !s ? (
        <Caricamento testo="Carico la scheda di avvio" />
      ) : scheda.errore ? (
        <Errore testo={scheda.errore} onRiprova={scheda.ricarica} />
      ) : !s ? null : (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <section className="rounded-[1.75rem] bg-grafite-900 p-5 text-white">
              <p className="text-[14px] text-grafite-300">{daFare === 0 ? 'La tua parte è fatta' : 'Tocca a te'}</p>
              <p className="cifre mt-1 text-[56px] font-light leading-none tracking-[-0.04em] text-oro-500">
                {perc}
                <span className="text-[22px] text-grafite-300">%</span>
              </p>
              <div className="mt-3 h-2 rounded-full bg-white/15" aria-hidden>
                <div className="h-2 rounded-full bg-oro-500" style={{ width: `${perc}%` }} />
              </div>
              <p className="mt-3 text-[14px] text-grafite-200">
                {s.passi.filter((p) => p.stato === 'fatto').length} di {s.passi.length} passi pronti{daFare > 0 ? ` · ${daFare === 1 ? 'ne resta 1' : `ne restano ${daFare}`}` : ''}
              </p>
            </section>

            {s.passi.map((p) => (
              <Passo
                key={p.numero}
                p={p}
                puoCaricare={puo('documenti_carica')}
                onCarica={(c, t) => setCarica({ cartella: c, titolo: t })}
                chiedi={chiedi}
              />
            ))}

            <BloccoAttrezzature aid={id} onCambia={scheda.ricarica} />
            <CiPensaIsfor aid={id} />
            <Domande aziendaId={id} rspp={s.rspp} medico={s.medico} puo={puo('avvio_nomine')} onFatto={scheda.ricarica} />
          </div>

          <div className="space-y-4">
            <Scheda titolo="Apertura del fascicolo">
              {s.validataIl ? (
                <p className="text-[14px] text-ink-soft">Aperto il {dataIt(s.validataIl)} dal tecnico dello studio.</p>
              ) : s.fascicoloEntro ? (
                <>
                  <p className="text-[14px] text-ink">Entro il {new Date(s.fascicoloEntro).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="mt-1 text-[13px] text-ink-muted">Non devi aspettare: puoi già usare l&apos;app.</p>
                  {s.inRitardo && <div className="mt-3"><Chip stato="warn">Il tecnico è in ritardo, l&apos;abbiamo avvisato</Chip></div>}
                </>
              ) : (
                <p className="text-[14px] text-ink-muted">Il tecnico apre il fascicolo entro 48 ore dall&apos;attivazione del servizio.</p>
              )}
            </Scheda>
            <Scheda titolo="Cosa succede dopo">
              <ol className="space-y-2 text-[14px] leading-relaxed text-ink-soft">
                <li>1. Il tecnico controlla i dati, fa il sopralluogo e aggiorna il DVR.</li>
                <li>2. Corsi e visite entrano nello scadenziario.</li>
                <li>3. Le novità le trovi in Da fare adesso e nella campanella.</li>
              </ol>
            </Scheda>
          </div>
        </div>
      )}

      <FoglioCarica
        aperto={carica !== null}
        cartellaIniziale={carica?.cartella ?? ''}
        titoloIniziale={carica?.titolo ?? ''}
        cartelle={fasc.dati ?? []}
        aziendaId={id}
        onChiudi={() => setCarica(null)}
        onFatto={() => scheda.ricarica()}
      />
    </div>
  );
}

function Passo({ p, puoCaricare, onCarica, chiedi }: { p: PassoAvvio; puoCaricare: boolean; onCarica: (cartella: string, titolo: string) => void; chiedi: (t: string) => void }) {
  const st = STATI[p.stato] ?? STATI.da_fare;
  return (
    <Scheda titolo={`${p.numero}. ${p.nome}`} sotto={p.nota ?? undefined} azioni={<Chip stato={st.chip}>{st.t}</Chip>}>
      {p.numero === 1 && (
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink-muted">
            {p.documenti === 0 ? 'Nessun documento caricato.' : `${p.documenti} caricati · ${p.letti} letti${p.inLettura > 0 ? ` · ${p.inLettura} in lettura` : ''}`}
            {p.bloccati > 0 ? ` · ${p.bloccati} sanitari bloccati e cancellati` : ''}
          </p>
          {GUIDATI.map((g) => {
            const gia = p.ultimi.some((u) => (u.titolo ?? '').toLowerCase().includes(g.titolo.toLowerCase()));
            return (
              <Riga
                key={g.titolo}
                titolo={g.titolo}
                sotto={g.perche}
                fine={
                  gia ? (
                    <Chip stato="ok">Caricato</Chip>
                  ) : puoCaricare ? (
                    <button type="button" className="btn-primary min-h-[44px] lg:min-h-[40px] px-4 text-[13px]" onClick={() => onCarica(g.cartella, g.titolo)}>
                      Carica
                    </button>
                  ) : (
                    <Blocco>Lo carica il titolare</Blocco>
                  )
                }
              />
            );
          })}
          <Avviso tono="danger">Non caricare documenti sanitari (giudizi, esiti, esami): vengono bloccati e cancellati senza essere letti.</Avviso>
        </div>
      )}
      {p.numero === 2 &&
        (p.daConfermare.length === 0 ? (
          <p className="text-[14px] text-ink-muted">{p.stato === 'fatto' ? 'Dati confermati dal tecnico.' : 'Appena i documenti sono letti, il tecnico conferma i dati.'}</p>
        ) : (
          <div>
            {p.daConfermare.map((d) => (
              <Riga key={d.id} titolo={d.titolo} sotto="Letto dai documenti, lo conferma il tecnico" fine={<Chip stato="info">In verifica</Chip>} />
            ))}
          </div>
        ))}
      {p.numero === 3 &&
        (p.mancanti.length === 0 ? (
          <p className="text-[14px] text-ink-muted">Niente da completare.</p>
        ) : (
          <div>
            {p.mancanti.map((m) => (
              <Riga
                key={m.campo}
                titolo={m.voce}
                sotto={m.domanda}
                fine={
                  <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]" onClick={() => chiedi(`Per completare il fascicolo: ${m.domanda} Aiutami a rispondere e dimmi quale documento serve.`)}>
                    Rispondi
                  </button>
                }
              />
            ))}
          </div>
        ))}
      {p.numero === 4 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-muted">
            {p.utenti === 0 ? 'Puoi invitare il referente interno, il consulente del lavoro e il medico competente, se lo scegli tu.' : `${p.utenti === 1 ? '1 persona invitata' : `${p.utenti} persone invitate`} oltre a te.`}
          </p>
          <Link href="/azienda/utenti/" className="btn-ghost">
            Invita una persona
          </Link>
        </div>
      )}
    </Scheda>
  );
}

function Domande({ aziendaId, rspp, medico, puo, onFatto }: { aziendaId: number; rspp: string | null; medico: string | null; puo: boolean; onFatto: () => void }) {
  const [r, setR] = useState<string[]>(rspp ? [rspp] : []);
  const [nomeRspp, setNomeRspp] = useState('');
  const [m, setM] = useState<string[]>(medico ? [medico] : []);
  const [nomeMedico, setNomeMedico] = useState('');
  const [emailMedico, setEmailMedico] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [invio, setInvio] = useState(false);
  if (!puo) return <Blocco>RSPP e medico competente li indica il titolare.</Blocco>;

  const salva = async () => {
    setErrore(null);
    setOk(false);
    setInvio(true);
    try {
      await rispondiAvvio(aziendaId, {
        ...(r[0] && r[0] !== rspp ? { rspp: { modalita: r[0], ...(nomeRspp.trim() ? { nominativo: nomeRspp.trim() } : {}) } } : {}),
        ...(m[0] && m[0] !== medico ? { medico: { modalita: m[0], ...(m[0] === 'aziendale' ? { nome: nomeMedico.trim(), email: emailMedico.trim() } : {}) } } : {}),
      });
      setOk(true);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Risposte non salvate.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Scheda titolo="Due domande per il fascicolo" sotto="Servono al tecnico per le nomine: le puoi cambiare finché il fascicolo non è aperto.">
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[13.5px] font-medium text-ink">Chi fa il RSPP</p>
          <Riquadri
            etichetta="RSPP"
            voci={[
              { k: 'datore', t: 'Il datore di lavoro', sotto: 'Con il corso dell\'art. 34' },
              { k: 'interno', t: 'Una persona interna', sotto: 'Un dipendente formato' },
              { k: 'esterno', t: 'Un RSPP esterno', sotto: 'Lo indica lo studio' },
            ]}
            scelti={r}
            onCambia={setR}
          />
          {(r[0] === 'interno' || r[0] === 'datore') && r[0] !== rspp && (
            <div className="mt-3">
              <Campo etichetta={r[0] === 'datore' ? 'Nome del datore di lavoro' : 'Nome del RSPP interno'}>
                <input className="input-field" value={nomeRspp} onChange={(e) => setNomeRspp(e.target.value)} maxLength={150} />
              </Campo>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[13.5px] font-medium text-ink">Medico competente</p>
          <Riquadri
            etichetta="Medico competente"
            voci={[
              { k: 'convenzionato', t: 'Convenzionato', sotto: 'Lo assegniamo noi' },
              { k: 'aziendale', t: 'Scelto da noi', sotto: 'Nome ed email' },
            ]}
            scelti={m}
            onCambia={setM}
          />
          {m[0] === 'aziendale' && m[0] !== medico && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Nome del medico">
                <input className="input-field" value={nomeMedico} onChange={(e) => setNomeMedico(e.target.value)} maxLength={150} />
              </Campo>
              <Campo etichetta="Email del medico" aiuto="Riceve l'invito per registrare solo le date delle visite.">
                <input type="email" className="input-field" value={emailMedico} onChange={(e) => setEmailMedico(e.target.value)} maxLength={191} />
              </Campo>
            </div>
          )}
        </div>
        {ok && <Avviso tono="ok">Risposte salvate: il tecnico le trova nella scheda.</Avviso>}
        {errore && <Avviso tono="danger">{errore}</Avviso>}
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={invio || ((!r[0] || r[0] === rspp) && (!m[0] || m[0] === medico))} onClick={salva}>
          {invio ? 'Salvo' : 'Salva le risposte'}
        </button>
      </div>
    </Scheda>
  );
}
