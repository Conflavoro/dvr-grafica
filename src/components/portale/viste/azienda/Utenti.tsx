'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riga, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Avviso, Campo, Fatto, Riquadri, useDati } from './comuniAccount';
import { Regolazioni, Spunta } from '@/components/icone';
import { clsx } from '@/lib/clsx';
import {
  chiSegue,
  invitaHse,
  invitaUtente,
  matricePermessi,
  reinviaInvito,
  revocaAccesso,
  utentiAzienda,
  type ChiSegue,
  type Matrice,
  type UtenteAzienda,
} from '@/lib/portale/azienda-account-api';
import { perGiorno, registroAttivita, type RigaRegistro } from '@/lib/portale/registro-attivita-api';
import { serviziAzienda } from '@/lib/portale/amministrazione-api';
import { Sicurezza } from '../condivisi/Sicurezza';
import Link from 'next/link';

type Vista = 'utenti' | 'permessi' | 'ordini' | 'registro' | 'sicurezza';

const ESTERNI = ['consulente_lavoro', 'medico_competente'];

function iniziali(n: string): string {
  return (
    n
      .replace(/^(dott\.?ssa|dott\.|ing\.|geom\.|avv\.)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'U'
  );
}

/**
 * Utenti e permessi dell'area azienda: chi entra e con quale ruolo, inviti con
 * il link per la password (7 giorni), reinvio e revoca; la matrice dei permessi
 * presa dal sistema (RuoliAzienda::MATRICE), leggibile per ruolo.
 */
export default function Utenti() {
  const { azienda, puo, user, versione } = usePortale();
  const id = azienda?.id ?? 0;
  const [vista, setVista] = useState<Vista>('utenti');
  const [invita, setInvita] = useState(false);
  const [revoca, setRevoca] = useState<UtenteAzienda | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const utenti = useDati(() => utentiAzienda(id), [id, versione]);
  const matrice = useDati(() => matricePermessi(), []);
  const chi = useDati(() => chiSegue(id), [id, versione]);
  const gestisce = puo('utenti_gestisci');

  if (!azienda) return null;
  const voci = utenti.dati ?? [];
  const attivi = voci.filter((u) => u.stato === 'attivo').length;
  const invitati = voci.filter((u) => u.stato === 'invitato').length;
  const puoSu = (u: UtenteAzienda) => u.ruolo !== 'titolare' && u.ruoloId !== null && (gestisce || u.ruolo === 'referente');

  const reinvia = async (u: UtenteAzienda) => {
    setErrore(null);
    setNota(null);
    try {
      await reinviaInvito(u.ruoloId!);
      setNota(`Nuovo invito mandato a ${u.email}. Il link precedente non vale più.`);
      utenti.ricarica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Invito non inviato.');
    }
  };

  return (
    <div className="space-y-5">
      <Testata
        categoria="utenti"
        icona={Regolazioni}
        sopra={azienda.ragione_sociale}
        titolo="Utenti e permessi"
        sotto={`${attivi === 1 ? '1 utente attivo' : `${attivi} utenti attivi`} · ${invitati === 1 ? '1 invito in attesa' : `${invitati} inviti in attesa`}`}
        azioni={
          puo('utenti_invita_dipendenti') ? (
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setInvita(true)}>
              {gestisce ? 'Invita un utente' : 'Invita un collega'}
            </button>
          ) : undefined
        }
      />
      <Schede
        voci={[
          { k: 'utenti' as Vista, t: 'Utenti', n: invitati },
          { k: 'permessi' as Vista, t: 'Permessi' },
          { k: 'ordini' as Vista, t: 'Approvazione degli ordini' },
          ...(gestisce ? [{ k: 'registro' as Vista, t: 'Registro attività', falco: 'registro_attivita' }] : []),
          { k: 'sicurezza' as Vista, t: 'Sicurezza' },
        ]}
        attiva={vista}
        onCambia={setVista}
        etichetta="Schede degli utenti"
      />

      {vista === 'utenti' && (
        <div className="space-y-4">
          {nota && <Avviso tono="ok">{nota}</Avviso>}
          {errore && <Avviso tono="danger">{errore}</Avviso>}
          {chi.dati && <SchedaChiSegue chi={chi.dati} />}
          <Scheda>
            {utenti.carico && !utenti.dati ? (
              <Caricamento testo="Carico gli utenti" />
            ) : utenti.errore ? (
              <Errore testo={utenti.errore} onRiprova={utenti.ricarica} />
            ) : voci.length === 0 ? (
              <Vuoto titolo="Nessun utente">Invita il referente interno, il consulente del lavoro e il medico competente, se lo scegli tu.</Vuoto>
            ) : (
              <div className="pt-2">
                {voci.map((u) => (
                  <Riga
                    key={`${u.ruolo}-${u.ruoloId ?? u.utenteId}`}
                    inizio={
                      <span
                        aria-hidden
                        className={clsx(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-medium',
                          ESTERNI.includes(u.ruolo) ? 'bg-white text-ink shadow-[inset_0_0_0_1.5px_#e2e2e5]' : 'bg-cat-utenti text-cat-utenti-ink'
                        )}
                      >
                        {iniziali(u.nome || u.email)}
                      </span>
                    }
                    titolo={
                      <>
                        {u.nome || u.email}
                        {u.utenteId === user.id && <span className="text-ink-muted"> (tu)</span>}
                      </>
                    }
                    sotto={
                      <>
                        {u.etichetta}
                        {ESTERNI.includes(u.ruolo) ? ' · esterno' : ''}
                        {u.email && u.nome ? ` · ${u.email}` : ''}
                        {u.ruolo === 'medico_competente' && u.scadeIl ? ` · nomina fino al ${dataIt(u.scadeIl)}` : ''}
                      </>
                    }
                    fine={
                      <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                        {u.stato === 'invitato' ? (
                          <Chip stato="warn">{u.invitoScadeIl ? `Invito fino al ${dataIt(u.invitoScadeIl, true)}` : 'Invito scaduto'}</Chip>
                        ) : u.stato === 'revocato' ? (
                          <Chip stato="neutral">Accesso revocato</Chip>
                        ) : (
                          <Chip stato="ok">Attivo</Chip>
                        )}
                        {puoSu(u) && u.stato !== 'revocato' && (
                          <span className="flex gap-1">
                            {u.stato === 'invitato' && (
                              <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]" onClick={() => reinvia(u)}>
                                Reinvia
                              </button>
                            )}
                            {gestisce && (
                              <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px] px-3 text-[13px]" onClick={() => setRevoca(u)}>
                                Revoca
                              </button>
                            )}
                          </span>
                        )}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </Scheda>
          <Avviso tono="info" titolo="Consulente del lavoro e medico competente sono esterni">
            Vedono solo quello che serve al loro lavoro. Il medico registra solo date, tipo e scadenza delle visite, mai esiti o giudizi.
          </Avviso>
          {!gestisce && <Blocco>Solo il titolare cambia i ruoli e revoca gli accessi. Tu puoi invitare colleghi come referente.</Blocco>}
        </div>
      )}

      {vista === 'registro' && gestisce && <RegistroAttivita aziendaId={id} versione={versione} />}
      {vista === 'registro' && !gestisce && (
        <Vuoto titolo="Registro riservato al titolare">Il registro delle attività lo vede solo il titolare dell&apos;account.</Vuoto>
      )}

      {vista === 'ordini' && <ApprovazioneOrdini aziendaId={id} titolare={voci.find((u) => u.ruolo === 'titolare')?.nome ?? null} vedeServizi={puo('ordini_richiedi')} />}

      {vista === 'sicurezza' && <Sicurezza titolare={gestisce && user.role === 'datore_lavoro'} />}

      {vista === 'permessi' && (matrice.carico && !matrice.dati ? <Caricamento /> : matrice.errore ? <Errore testo={matrice.errore} onRiprova={matrice.ricarica} /> : <Permessi m={matrice.dati} />)}

      <FoglioInvito
        aperto={invita}
        aziendaId={id}
        gestisce={gestisce}
        hse={chi.dati?.puoInvitareHse ?? false}
        matrice={matrice.dati}
        onChiudi={() => setInvita(false)}
        onFatto={() => {
          utenti.ricarica();
          chi.ricarica();
        }}
      />
      <Foglio
        aperto={revoca !== null}
        titolo="Revoca l'accesso"
        onChiudi={() => setRevoca(null)}
        piede={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRevoca(null)}>
              Annulla
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#d63d3e] px-5 text-[14px] font-medium text-white"
              onClick={async () => {
                if (!revoca?.ruoloId) return;
                try {
                  await revocaAccesso(revoca.ruoloId);
                  setNota(`Accesso revocato a ${revoca.nome || revoca.email}.`);
                  setRevoca(null);
                  utenti.ricarica();
                } catch (e) {
                  setErrore(e instanceof Error ? e.message : 'Revoca non riuscita.');
                  setRevoca(null);
                }
              }}
            >
              Revoca l&apos;accesso
            </button>
          </>
        }
      >
        {revoca && (
          <Avviso tono="danger" titolo={`${revoca.nome || revoca.email} perde subito l'accesso`}>
            {revoca.ruolo === 'medico_competente'
              ? 'Ricorda di nominare un nuovo medico competente: senza nomina le visite si fermano.'
              : 'Esce dall\'area dell\'azienda e gli inviti ancora aperti non valgono più.'}
          </Avviso>
        )}
      </Foglio>
    </div>
  );
}

function Permessi({ m }: { m: Matrice | null }) {
  const [ruolo, setRuolo] = useState('titolare');
  if (!m || m.righe.length === 0) return <Vuoto titolo="Matrice non disponibile">Riprova tra poco.</Vuoto>;
  const gruppi = Array.from(new Set(m.righe.map((r) => r.gruppo)));
  return (
    <div className="space-y-4">
      {/* Telefono: un ruolo alla volta. */}
      <div className="space-y-3 lg:hidden">
        <Schede voci={m.ruoli.map((r) => ({ k: r.chiave, t: r.etichetta }))} attiva={ruolo} onCambia={setRuolo} etichetta="Ruolo" />
        {gruppi.map((g) => (
          <Scheda key={g} titolo={g}>
            {m.righe
              .filter((r) => r.gruppo === g)
              .map((r) => (
                <div key={r.azione} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-perla-linea py-2 text-[14px] last:border-b-0">
                  <span className={r.ruoli[ruolo] ? 'text-ink' : 'text-ink-subtle'}>{r.frase}</span>
                  {r.ruoli[ruolo] ? <Spunta size={18} className="shrink-0 text-[#16884a]" aria-label="Sì" /> : <span className="shrink-0 text-ink-subtle" aria-label="No">no</span>}
                </div>
              ))}
          </Scheda>
        ))}
      </div>
      {/* Computer: la matrice intera. */}
      <Scheda className="hidden lg:block">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12.5px] text-ink-muted">
              <th className="py-3 font-medium">Cosa</th>
              {m.ruoli.map((r) => (
                <th key={r.chiave} className="w-[8.5rem] py-3 text-center font-medium">
                  {r.etichetta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gruppi.map((g) => [
              <tr key={`g-${g}`}>
                <td colSpan={m.ruoli.length + 1} className="pb-1 pt-4 text-[12.5px] font-medium uppercase tracking-wide text-ink-muted">
                  {g}
                </td>
              </tr>,
              ...m.righe
                .filter((r) => r.gruppo === g)
                .map((r) => (
                  <tr key={r.azione} className="border-t border-perla-linea">
                    <td className="py-2.5 text-ink">{r.frase}</td>
                    {m.ruoli.map((x) => (
                      <td key={x.chiave} className="py-2.5 text-center">
                        {r.ruoli[x.chiave] ? <Spunta size={18} className="inline text-[#16884a]" aria-label="Sì" /> : <span className="text-ink-subtle">no</span>}
                      </td>
                    ))}
                  </tr>
                )),
            ])}
          </tbody>
        </table>
      </Scheda>
      <Scheda titolo="Da sapere">
        <ul className="space-y-2 text-[14px] leading-relaxed text-ink-soft">
          {m.note.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>Il lavoratore non ha un account: entra dal suo link personale e riceve i promemoria.</li>
        </ul>
      </Scheda>
    </div>
  );
}

/**
 * Chi segue la sicurezza: lo studio e il tecnico assegnato (aziende clienti di
 * uno studio) oppure l'HSE o RSPP proprio (aziende che si seguono da sole).
 */
export function SchedaChiSegue({ chi }: { chi: ChiSegue }) {
  return (
    <Scheda titolo="Chi segue la sicurezza">
      {chi.gestione === 'studio' ? (
        <div className="space-y-1 pb-1 text-[14px] leading-relaxed text-ink-soft">
          <p>
            La segue <span className="font-medium text-ink">{chi.studio ?? 'lo studio'}</span>: il vostro HSE e RSPP sono i tecnici dello studio.
          </p>
          <p>{chi.tecnico ? `Tecnico assegnato: ${chi.tecnico}.` : 'Il tecnico vi viene assegnato a breve.'}</p>
        </div>
      ) : chi.hse.length === 0 ? (
        <p className="pb-1 text-[14px] leading-relaxed text-ink-soft">
          La seguite voi. {chi.puoInvitareHse ? 'Invita il vostro HSE o RSPP, interno o esterno: lavora con il gestionale completo sulla vostra azienda.' : 'L’HSE lo invita il titolare.'}
        </p>
      ) : (
        <div className="pt-1">
          {chi.hse.map((h) => (
            <Riga
              key={h.id}
              titolo={h.nome || h.email}
              sotto={`HSE e RSPP${h.nome ? ` · ${h.email}` : ''}`}
              fine={h.stato === 'invitato' ? <Chip stato="warn">{h.invitoScadeIl ? `Invito fino al ${dataIt(h.invitoScadeIl, true)}` : 'Invito scaduto'}</Chip> : <Chip stato="ok">Attivo</Chip>}
            />
          ))}
        </div>
      )}
    </Scheda>
  );
}

export function FoglioInvito({
  aperto,
  aziendaId,
  gestisce,
  hse = false,
  matrice,
  onChiudi,
  onFatto,
}: {
  aperto: boolean;
  aziendaId: number;
  gestisce: boolean;
  hse?: boolean;
  matrice: Matrice | null;
  onChiudi: () => void;
  onFatto: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [ruolo, setRuolo] = useState<string[]>(['referente']);
  const [scade, setScade] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState(false);
  useEffect(() => {
    if (!aperto) return;
    setNome('');
    setEmail('');
    setRuolo(['referente']);
    setScade('');
    setErrore(null);
    setFatto(false);
  }, [aperto]);
  const r = ruolo[0] ?? 'referente';
  const cosa = useMemo(() => (matrice?.righe ?? []).filter((x) => x.ruoli[r]).map((x) => x.frase), [matrice, r]);
  const ruoli = gestisce
    ? [
        ...(hse ? [{ k: 'hse', t: 'HSE o RSPP', sotto: 'Interno o esterno' }] : []),
        { k: 'referente', t: 'Referente interno', sotto: 'Un tuo collaboratore' },
        { k: 'consulente_lavoro', t: 'Consulente del lavoro', sotto: 'Assunzioni e cessazioni' },
        { k: 'medico_competente', t: 'Medico competente', sotto: 'Solo date delle visite' },
      ]
    : [{ k: 'referente', t: 'Referente interno', sotto: 'Un tuo collega' }];

  const invia = async () => {
    if (nome.trim().length < 2) return setErrore('Scrivi nome e cognome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErrore("Controlla l'email: sembra incompleta.");
    setInvio(true);
    setErrore(null);
    try {
      if (r === 'hse') await invitaHse(aziendaId, { nome: nome.trim(), email: email.trim() });
      else await invitaUtente(aziendaId, { nome: nome.trim(), email: email.trim(), ruolo: r, ...(r === 'medico_competente' && scade ? { scade_il: scade } : {}) });
      setFatto(true);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Invito non inviato.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo={gestisce ? 'Invita un utente' : 'Invita un collega'}
      onChiudi={onChiudi}
      largo
      piede={
        fatto ? (
          <button type="button" className="btn-primary w-full" onClick={onChiudi}>
            Fatto
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onChiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" disabled={invio} onClick={invia}>
              {invio ? 'Invio' : "Manda l'invito"}
            </button>
          </>
        )
      }
    >
      {fatto ? (
        <Fatto titolo="Invito inviato">
          {email} riceve un&apos;email con il link per creare la password. L&apos;invito vale 7 giorni{!gestisce ? ' e il titolare riceve una notifica' : ''}.
        </Fatto>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Nome e cognome">
              <input className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} autoComplete="off" />
            </Campo>
            <Campo etichetta="Email">
              <input type="email" inputMode="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={191} autoComplete="off" />
            </Campo>
          </div>
          <div>
            <p className="mb-1.5 text-[13.5px] font-medium text-ink">Che ruolo avrà</p>
            <Riquadri etichetta="Ruolo" voci={ruoli} scelti={ruolo} onCambia={setRuolo} />
          </div>
          {r === 'medico_competente' && (
            <Campo etichetta="Nomina valida fino al (facoltativo)" aiuto="Alla scadenza della nomina il medico perde l'accesso da solo.">
              <input type="date" className="input-field" value={scade} onChange={(e) => setScade(e.target.value)} />
            </Campo>
          )}
          {r === 'hse' && (
            <Avviso tono="info">Entra nel gestionale con tutto il lavoro di sicurezza della vostra azienda: DVR, sopralluoghi, formazione, visite e scadenze. L’approvazione dei documenti resta tua.</Avviso>
          )}
          {cosa.length > 0 && (
            <Scheda titolo="Cosa potrà fare">
              <ul className="space-y-1.5 text-[14px] text-ink-soft">
                {cosa.map((c) => (
                  <li key={c} className="flex gap-2">
                    <Spunta size={16} className="mt-0.5 shrink-0 text-[#16884a]" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
          <p className="text-[12.5px] text-ink-muted">Riceve un&apos;email con il link per creare la password. L&apos;invito vale 7 giorni.</p>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
        </div>
      )}
    </Foglio>
  );
}

const fmtOraReg = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const fmtGiornoReg = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const TONO_AZIONE: Record<RigaRegistro['azione'], 'ok' | 'neutral' | 'danger'> = { creato: 'ok', modificato: 'neutral', eliminato: 'danger' };

/** Registro attività: chi ha fatto cosa e quando sui dati dell'azienda (solo titolare e studio). */
function RegistroAttivita({ aziendaId, versione }: { aziendaId: number; versione: number }) {
  const [righe, setRighe] = useState<RigaRegistro[]>([]);
  const [altre, setAltre] = useState(false);
  const [carico, setCarico] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const carica = (prima?: number) => {
    setCarico(true);
    setErrore(null);
    registroAttivita(aziendaId, prima)
      .then((p) => {
        setRighe((v) => (prima ? [...v, ...p.righe] : p.righe));
        setAltre(p.altre);
      })
      .catch((e: unknown) => setErrore(e instanceof Error ? e.message : 'Registro non disponibile.'))
      .finally(() => setCarico(false));
  };
  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aziendaId, versione]);

  if (errore) return <Errore testo={errore} onRiprova={() => carica()} />;
  if (carico && righe.length === 0) return <Caricamento />;
  return (
    <Scheda titolo="Registro attività" sotto="Chi ha aggiunto, modificato o eliminato dati dell’azienda. Non contiene i valori dei campi né i dati sanitari.">
      <div data-falco="registro_attivita_elenco">
        {righe.length === 0 ? (
          <Vuoto titolo="Nessuna attività registrata">Le azioni fatte da adesso in poi da te, dai tuoi colleghi e dallo studio compaiono qui.</Vuoto>
        ) : (
          perGiorno(righe).map((g) => (
            <div key={g.giorno} className="pt-2">
              <h3 className="py-2 text-[13px] font-medium text-ink-muted first-letter:uppercase">{g.giorno ? fmtGiornoReg.format(new Date(`${g.giorno}T12:00:00`)) : ''}</h3>
              {g.righe.map((r) => (
                <Riga
                  key={r.id}
                  inizio={<span className="cifre w-11 shrink-0 text-[13px] text-ink-muted">{fmtOraReg.format(new Date(r.quando))}</span>}
                  titolo={r.cosa}
                  sotto={r.ruolo ? `${r.chi}, ${r.ruolo}` : r.chi}
                  fine={<Chip stato={TONO_AZIONE[r.azione]}>{r.azioneTesto}</Chip>}
                />
              ))}
            </div>
          ))
        )}
        {altre && (
          <div className="pt-3">
            <button type="button" className="btn-ghost min-h-[44px] lg:min-h-[40px]" disabled={carico} onClick={() => carica(righe[righe.length - 1]?.id)}>
              Mostra le precedenti
            </button>
          </div>
        )}
      </div>
    </Scheda>
  );
}

/**
 * Approvazione degli ordini (Utenti e permessi): la regola fissa "gli ordini del
 * referente li approva il titolare", la soglia automatica in valutazione e gli
 * ordini in attesa.
 */
function ApprovazioneOrdini({ aziendaId, titolare, vedeServizi }: { aziendaId: number; titolare: string | null; vedeServizi: boolean }) {
  const s = useDati(() => serviziAzienda(aziendaId), [aziendaId]);
  const attesa = (s.dati?.ordini ?? []).filter((o) => o.stato === 'da_approvare');
  const totale = attesa.reduce((t, o) => t + (o.importo ?? 0), 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Scheda titolo="Gli ordini del referente richiedono l'approvazione del titolare" azioni={<Chip stato="ok">Regola attiva, sempre</Chip>}>
          <p className="pb-4 text-[14px] text-ink-muted">
            Ogni servizio a pagamento richiesto da un referente interno parte solo dopo l&apos;approvazione di {titolare ?? 'il titolare'}. Il titolare riceve una notifica e
            un&apos;email. Non si può disattivare.
          </p>
        </Scheda>
        <Scheda titolo="Approvazione automatica sotto una soglia" azioni={<Chip stato="neutral">In valutazione</Chip>}>
          <p className="pb-4 text-[14px] text-ink-muted">Gli ordini sotto l&apos;importo scelto partirebbero senza approvazione. Per ora non è attiva.</p>
        </Scheda>
      </div>
      <Scheda
        titolo="In attesa di approvazione"
        sotto={attesa.length > 0 ? `${attesa.length} · € ${totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })} in tutto` : undefined}
        azioni={
          vedeServizi ? (
            <Link href="/azienda/servizi/" className="btn-ghost min-h-[40px] px-3 text-[13px]">
              Tutti gli ordini
            </Link>
          ) : undefined
        }
      >
        {s.carico && !s.dati ? (
          <Caricamento />
        ) : s.errore ? (
          <Errore testo={s.errore} onRiprova={s.ricarica} />
        ) : attesa.length === 0 ? (
          <p className="pb-4 text-[14px] text-ink-muted">Nessun ordine da approvare.</p>
        ) : (
          <div className="pt-1">
            {attesa.map((o) => (
              <Riga
                key={o.id}
                titolo={o.titolo}
                sotto={`${o.richiesto_da ?? ''}${o.creato ? ` · ${dataIt(o.creato)}` : ''}`}
                fine={o.importo !== null ? `€ ${o.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : undefined}
              />
            ))}
          </div>
        )}
      </Scheda>
    </div>
  );
}
