'use client';

import { useEffect, useState } from 'react';
import { Foglio } from '../../kit';
import { controllaFirma } from '@/lib/portale/amministrazione-pagamenti';

/**
 * Foglio di firma comune (regole di business 2.8): codice di 6 cifre via SMS.
 * Lo usano attivazione, ordini e documenti da firmare. Chi lo apre passa le due
 * chiamate del proprio oggetto: avvia (manda l'SMS) e firma (verifica il codice).
 *
 * Controlli in ordine: prima la casella "Ho letto il documento e lo approvo",
 * poi il codice di 6 cifre. Dopo la firma: "Documento firmato".
 */
export interface DatiCodiceFirma {
  token: string;
  cellulare: string | null;
  /** Solo in modalità prova e fuori produzione: il codice da usare. */
  codiceProva?: string | null;
}

export interface FoglioFirmaProps {
  aperto: boolean;
  onChiudi: () => void;
  /** Es. "Contratto ISF-2026-0611". */
  titolo: string;
  /** Riga sotto il titolo, es. "Pizzeria Da Gino · € 101,30 al mese". */
  sotto?: string;
  /** Riepilogo del documento da leggere prima di firmare. */
  children?: React.ReactNode;
  avvia: () => Promise<DatiCodiceFirma>;
  firma: (token: string, codice: string, letto: boolean) => Promise<void>;
  onFirmato?: () => void;
}

export default function FoglioFirma({ aperto, onChiudi, titolo, sotto, children, avvia, firma, onFirmato }: FoglioFirmaProps) {
  const [letto, setLetto] = useState(false);
  const [codice, setCodice] = useState('');
  const [dati, setDati] = useState<DatiCodiceFirma | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [firmato, setFirmato] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    setLetto(false);
    setCodice('');
    setErrore(null);
    setFirmato(false);
    setDati(null);
  }, [aperto]);

  const chiediCodice = async () => {
    setErrore(null);
    setOccupato(true);
    try {
      setDati(await avvia());
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco a mandare il codice. Riprova.');
    } finally {
      setOccupato(false);
    }
  };

  const conferma = async () => {
    const e = controllaFirma(letto, codice);
    if (e) return setErrore(e);
    if (!dati) return setErrore('Chiedi prima il codice.');
    setErrore(null);
    setOccupato(true);
    try {
      await firma(dati.token, codice, letto);
      setFirmato(true);
      // Il foglio si chiude da solo poco dopo (0,9 secondi).
      window.setTimeout(() => {
        onFirmato?.();
        onChiudi();
      }, 900);
    } catch (x) {
      setErrore(x instanceof Error ? x.message : 'Firma non riuscita.');
    } finally {
      setOccupato(false);
    }
  };

  return (
    <Foglio
      aperto={aperto}
      titolo={firmato ? 'Documento firmato' : `Firma: ${titolo}`}
      onChiudi={onChiudi}
      piede={
        firmato ? undefined : dati ? (
          <button type="button" className="btn-primary" disabled={occupato} onClick={() => void conferma()}>
            Firma
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={occupato} onClick={() => void chiediCodice()}>
            Mandami il codice
          </button>
        )
      }
    >
      {firmato ? (
        <p className="text-[14px] leading-relaxed text-ink-soft" role="status">
          La copia firmata è nel fascicolo e ti arriva per email.
        </p>
      ) : (
        <div className="space-y-4">
          {sotto && <p className="text-[13.5px] text-ink-muted">{sotto}</p>}
          {children}
          <label className="flex items-start gap-2.5 text-[14px] leading-snug text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#18181B]" checked={letto} onChange={(e) => setLetto(e.target.checked)} />
            Ho letto il documento e lo approvo
          </label>
          {dati && (
            <div>
              <label className="block text-[13px] text-ink-muted" htmlFor="codice-firma">
                {dati.cellulare ? `Codice di 6 cifre mandato al numero che finisce con ${dati.cellulare.replace(/\D/g, '').slice(-2)}` : 'Codice di 6 cifre'}
              </label>
              <input
                id="codice-firma"
                className="input-field cifre mt-1 tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codice}
                onChange={(e) => setCodice(e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-invalid={errore !== null}
              />
              {dati.codiceProva && <p className="mt-1 text-[12px] text-ink-muted">Modalità prova: il codice è {dati.codiceProva}.</p>}
              <button type="button" className="mt-1 min-h-[44px] text-[13px] font-medium text-ink underline underline-offset-4" disabled={occupato} onClick={() => void chiediCodice()}>
                Mandami un altro codice
              </button>
            </div>
          )}
          {errore && (
            <p className="text-[13px] text-stato-danger-ink" role="alert">
              {errore}
            </p>
          )}
        </div>
      )}
    </Foglio>
  );
}
