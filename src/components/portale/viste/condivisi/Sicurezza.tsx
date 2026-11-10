'use client';

// Sicurezza del proprio account (Utenti e permessi > Sicurezza): verifica in due
// passaggi via SMS, password, dispositivi collegati; fogli "Cambia il numero" e
// "Cambia la password". I testi sono quelli della specifica.

import { useState } from 'react';
import { Blocco, Caricamento, Chip, Errore, Foglio, Riga, Scheda } from '../../kit';
import { Avviso, Campo, Fatto, useDati } from '../azienda/comuniAccount';
import {
  attivaDuePassaggi,
  cambiaPassword,
  confermaNumero,
  controllaPassword,
  esciAltri,
  esciDispositivo,
  inviaCodiciNumero,
  sicurezza,
  type ErroriPassword,
} from '@/lib/portale/accesso-api';

const campo = 'w-full min-h-[48px] rounded-xl bg-white px-4 text-[16px] text-ink shadow-[inset_0_0_0_1px_#e2e2e5] focus:outline-none focus:ring-2 focus:ring-acido-400';

export function Sicurezza({ titolare }: { titolare: boolean }) {
  const s = useDati(() => sicurezza(), []);
  const [numero, setNumero] = useState(false);
  const [password, setPassword] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  if (s.carico && !s.dati) return <Caricamento />;
  if (s.errore || !s.dati) return <Errore testo={s.errore ?? 'Dati non disponibili.'} onRiprova={s.ricarica} />;
  const d = s.dati;
  const attiva = d.duePassaggi.attiva;
  const finale = d.duePassaggi.numeroFinale;

  const azione = async (fn: () => Promise<unknown>, testo: string) => {
    setErrore(null);
    try {
      await fn();
      setNota(testo);
      s.ricarica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Operazione non riuscita.');
    }
  };

  return (
    <div className="space-y-4">
      {nota && <Avviso tono="ok">{nota}</Avviso>}
      {errore && <Avviso tono="danger">{errore}</Avviso>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Scheda titolo="Verifica in due passaggi" azioni={<Chip stato={attiva ? 'ok' : 'warn'}>{attiva ? 'Attiva' : 'Non attiva'}</Chip>}>
          <div className="space-y-3 pb-4">
            <button type="button" className="flex w-full min-h-[56px] items-center justify-between gap-3 rounded-xl bg-perla-velo px-4 text-left" onClick={() => setNumero(true)}>
              <span>
                <span className="block text-[14px] font-medium text-ink">Codice via SMS</span>
                <span className="block text-[13px] text-ink-muted">{finale ? `Al numero che finisce con ${finale}` : 'Nessun numero indicato'}</span>
              </span>
              <span className="text-[13px] text-ink-muted">Cambia numero</span>
            </button>
            <p className="text-[14px] text-ink-muted">
              {titolare
                ? 'Per il titolare è obbligatoria: serve per firmare, pagare e cambiare i permessi. Non si può disattivare.'
                : 'Ti chiediamo un codice quando accedi da un dispositivo nuovo.'}
            </p>
            {!attiva && (
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => azione(attivaDuePassaggi, 'Verifica in due passaggi attivata')}>
                Attiva la verifica in due passaggi
              </button>
            )}
            {titolare && attiva && <Blocco>Obbligatoria per il titolare</Blocco>}
          </div>
        </Scheda>
        <Scheda titolo="Password">
          <div className="space-y-3 pb-4">
            <p className="text-[14px] text-ink-muted">Almeno 12 caratteri. Non usare la stessa password di altri servizi.</p>
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setPassword(true)}>
              Cambia la password
            </button>
          </div>
        </Scheda>
        <Scheda
          titolo="Dispositivi collegati"
          className="xl:col-span-2"
          azioni={
            d.dispositivi.length > 1 ? (
              <button type="button" className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => azione(esciAltri, 'Sei uscito da tutti gli altri dispositivi')}>
                Esci da tutti gli altri dispositivi
              </button>
            ) : undefined
          }
        >
          <div className="pt-1">
            {d.dispositivi.map((x) => (
              <Riga
                key={x.id}
                titolo={x.dispositivo}
                sotto={x.quando ? new Date(x.quando.replace(' ', 'T')).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : undefined}
                fine={
                  x.questo ? (
                    <Chip stato="ok">Questo dispositivo</Chip>
                  ) : (
                    <button type="button" className="btn-ghost min-h-[44px] px-3 text-[13px]" onClick={() => azione(() => esciDispositivo(x.id), 'Dispositivo disconnesso')}>
                      Esci
                    </button>
                  )
                }
              />
            ))}
          </div>
        </Scheda>
      </div>
      <FoglioNumero aperto={numero} haNumero={finale !== null} onChiudi={() => setNumero(false)} onFatto={s.ricarica} />
      <FoglioPassword aperto={password} serveAttuale={d.passwordImpostata} onChiudi={() => setPassword(false)} />
    </div>
  );
}

function FoglioNumero({ aperto, haNumero, onChiudi, onFatto }: { aperto: boolean; haNumero: boolean; onChiudi: () => void; onFatto: () => void }) {
  const [cell, setCell] = useState('');
  const [inviati, setInviati] = useState(false);
  const [nuovo, setNuovo] = useState('');
  const [vecchio, setVecchio] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  const chiudi = () => {
    setCell('');
    setInviati(false);
    setNuovo('');
    setVecchio('');
    setErrore(null);
    setFatto(false);
    onChiudi();
  };
  const invia = async () => {
    if (cell.replace(/\D/g, '').length < 9) {
      setErrore('Scrivi un numero di cellulare italiano, almeno 9 cifre.');
      return;
    }
    setErrore(null);
    try {
      await inviaCodiciNumero(cell);
      setInviati(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Codici non inviati.');
    }
  };
  const conferma = async () => {
    setErrore(null);
    try {
      await confermaNumero(cell, nuovo, haNumero ? vecchio : null);
      setFatto(true);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Codici non giusti.');
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Cambia il numero"
      onChiudi={chiudi}
      piede={
        fatto ? (
          <button type="button" className="btn-primary" onClick={chiudi}>
            Chiudi
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={chiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={inviati ? conferma : invia}>
              {inviati ? 'Conferma' : 'Invia i codici'}
            </button>
          </>
        )
      }
    >
      {fatto ? (
        <Fatto titolo="Numero cambiato" />
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-muted">Verifica in due passaggi</p>
          <Campo etichetta="Nuovo numero di cellulare" errore={!inviati ? errore : null}>
            <input className={campo} inputMode="tel" autoComplete="tel" placeholder="Es. 333 123 4567" value={cell} disabled={inviati} onChange={(e) => setCell(e.target.value)} />
          </Campo>
          {!inviati ? (
            <p className="text-[14px] text-ink-muted">Ti mandiamo un codice al vecchio e al nuovo numero per confermare.</p>
          ) : (
            <>
              <Avviso tono="ok" titolo="Codici inviati">
                Inserisci i due codici che ti abbiamo mandato per completare il cambio.
              </Avviso>
              <Campo etichetta="Codice arrivato al nuovo numero" errore={errore}>
                <input className={campo} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={nuovo} onChange={(e) => setNuovo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </Campo>
              {haNumero && (
                <Campo etichetta="Codice arrivato al vecchio numero">
                  <input className={campo} inputMode="numeric" maxLength={6} value={vecchio} onChange={(e) => setVecchio(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                </Campo>
              )}
            </>
          )}
        </div>
      )}
    </Foglio>
  );
}

function FoglioPassword({ aperto, serveAttuale, onChiudi }: { aperto: boolean; serveAttuale: boolean; onChiudi: () => void }) {
  const [attuale, setAttuale] = useState('');
  const [nuova, setNuova] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [errori, setErrori] = useState<ErroriPassword>({});
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const chiudi = () => {
    setAttuale('');
    setNuova('');
    setRipeti('');
    setErrori({});
    setErrore(null);
    setFatto(false);
    onChiudi();
  };
  const invia = async () => {
    const e = controllaPassword(attuale, nuova, ripeti, serveAttuale);
    setErrori(e);
    if (Object.keys(e).length > 0) return;
    try {
      const dalServer = await cambiaPassword(attuale, nuova, ripeti);
      if (dalServer) {
        setErrori(dalServer);
        return;
      }
      setAttuale('');
      setNuova('');
      setRipeti('');
      setFatto(true);
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Password non cambiata.');
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo="Cambia la password"
      onChiudi={chiudi}
      piede={
        fatto ? (
          <button type="button" className="btn-primary" onClick={chiudi}>
            Chiudi
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={chiudi}>
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={invia}>
              Cambia la password
            </button>
          </>
        )
      }
    >
      {fatto ? (
        <Fatto titolo="Password cambiata">Sei uscito dagli altri dispositivi. Ti abbiamo mandato un&apos;email di conferma.</Fatto>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-muted">Sicurezza</p>
          {errore && <Avviso tono="danger">{errore}</Avviso>}
          {serveAttuale && (
            <Campo etichetta="Password attuale" errore={errori.attuale}>
              <input className={campo} type="password" autoComplete="current-password" value={attuale} onChange={(e) => setAttuale(e.target.value)} />
            </Campo>
          )}
          <Campo etichetta="Nuova password" aiuto="Almeno 12 caratteri." errore={errori.nuova}>
            <input className={campo} type="password" autoComplete="new-password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
          </Campo>
          <Campo etichetta="Ripeti la nuova password" errore={errori.ripeti}>
            <input className={campo} type="password" autoComplete="new-password" value={ripeti} onChange={(e) => setRipeti(e.target.value)} />
          </Campo>
          <p className="text-[14px] text-ink-muted">Dopo il cambio ti chiediamo il codice via SMS ed esci dagli altri dispositivi.</p>
        </div>
      )}
    </Foglio>
  );
}
