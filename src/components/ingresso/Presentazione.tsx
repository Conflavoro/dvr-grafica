'use client';

import { DEMO_LIVE } from '@/lib/demo/attivo';
import { Calendario, CerchioSpunta, Documento, Persona, Persone, Scudo, Sirena, Libro } from '@/components/icone';

/**
 * Sotto il simulatore: cosa c'è nell'abbonamento, cosa succede dopo e le due strade
 * (cliente nuovo, chi ha già un accesso). Testi dal pacchetto del Portale HSE
 * (04 telefono, Contratto "Cosa comprende"; 04 comune, attivazione "Cosa succede dopo").
 * Telefono prima: una colonna, pulsanti a tutta larghezza; sul computer griglie.
 */

const COMPRESI = [
  { Icona: Documento, t: 'Valutazione dei rischi', s: 'Redazione e aggiornamenti del DVR' },
  { Icona: Scudo, t: 'Nomine e fascicolo digitale', s: 'Sempre pronto, anche per le ispezioni' },
  { Icona: Persona, t: 'Medico competente', s: 'Visite per i lavoratori con sorveglianza' },
  { Icona: Libro, t: 'Formazione generale', s: 'Per tutti i lavoratori in organico' },
  { Icona: Calendario, t: 'Scadenziario e promemoria', s: 'Anche su WhatsApp ai lavoratori' },
  { Icona: Sirena, t: 'Pronto Ispezioni', s: 'Ti richiamiamo entro 15 minuti' },
  { Icona: Persone, t: 'Referente dedicato', s: 'Una persona dello studio che ti segue' },
  { Icona: CerchioSpunta, t: 'RLST territoriale', s: 'Rappresentante dei lavoratori per la sicurezza' },
] as const;

const DOPO = [
  { t: 'Paghi il primo mese', s: 'Poi l’addebito si ripete da solo ogni mese.' },
  { t: 'Apriamo il fascicolo', s: 'Entro 48 ore un tecnico controlla i tuoi dati.' },
  { t: 'Ti diciamo cosa manca', s: 'Corsi, visite e documenti finiscono in “Da fare”.' },
] as const;

export function Presentazione({ onAttiva, onAccedi }: { onAttiva: () => void; onAccedi: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 px-4 pb-10 sm:px-6 lg:space-y-8 lg:pb-16">
      <section aria-labelledby="pres-compresi" className="rounded-[1.75rem] bg-perla-velo p-5 sm:p-7">
        <h2 id="pres-compresi" className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
          Cosa comprende l’abbonamento
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-muted">8 servizi inclusi. € 9,90 al mese per ogni lavoratore con visita medica, € 5,90 senza.</p>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {COMPRESI.map(({ Icona, t, s }) => (
            <li key={t} className="flex items-start gap-3 rounded-[1.25rem] bg-white p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grafite-950 text-white">
                <Icona size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">{t}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{s}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-ink-subtle">Non compresi: corsi specifici, quote d’ingresso dei nuovi assunti e i servizi aggiuntivi a prezzo fisso.</p>
      </section>

      <section aria-labelledby="pres-dopo" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <div className="rounded-[1.75rem] border border-perla-linea bg-white p-5 sm:p-7">
          <h2 id="pres-dopo" className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
            Cosa succede dopo
          </h2>
          <ol className="mt-5 space-y-4">
            {DOPO.map((d, i) => (
              <li key={d.t} className="flex items-start gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-grafite-950 text-[14px] font-medium text-white">{i + 1}</span>
                <span>
                  <span className="block text-[15.5px] font-medium text-ink">{d.t}</span>
                  <span className="mt-0.5 block text-[14px] text-ink-muted">{d.s}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[1.75rem] bg-grafite-950 p-5 text-white sm:p-7">
          <h2 className="text-[24px] font-medium leading-tight tracking-[-0.02em] sm:text-[28px]">{DEMO_LIVE ? 'Prova la piattaforma' : 'Attiva il servizio'}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-grafite-200">
            {DEMO_LIVE
              ? 'Entra con uno dei profili dello studio di esempio: titolare, tecnico, medico, azienda, lavoratore. Tutto funziona davvero, Falco compreso.'
              : 'Crei il tuo accesso, carichi i documenti che hai e l’assistente li legge per te. Ci vuole un minuto e non devi ricordare nessuna password.'}
          </p>
          <button type="button" className="btn-acido mt-5 min-h-[52px] w-full text-[15px]" onClick={DEMO_LIVE ? onAccedi : onAttiva}>
            {DEMO_LIVE ? 'Scegli un profilo' : 'Crea il tuo accesso'}
          </button>
          {!DEMO_LIVE && (
            <p className="mt-4 text-center text-[13.5px] text-grafite-300">
              Hai già un accesso?{' '}
              <button type="button" className="font-medium text-white underline underline-offset-4" onClick={onAccedi}>
                Accedi
              </button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
