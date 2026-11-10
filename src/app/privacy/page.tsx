import type { Metadata } from 'next';
import { NOME_APP, PaginaLegale, Paragrafo, TITOLARE } from '@/components/legale/PaginaLegale';

export const metadata: Metadata = { title: `Informativa sulla privacy · ${NOME_APP}` };

export default function Privacy() {
  return (
    <PaginaLegale titolo="Informativa sulla privacy" aggiornata="30 ottobre 2026">
      <p>
        Questa informativa spiega come {NOME_APP} tratta i dati personali di chi usa l&apos;app e il sito, ai sensi
        degli articoli 13 e 14 del Regolamento (UE) 2016/679 (GDPR).
      </p>

      <Paragrafo titolo="Titolare del trattamento">
        <p>
          {TITOLARE.ragioneSociale}, {TITOLARE.sede}, partita IVA {TITOLARE.partitaIva}. Per qualsiasi richiesta sui
          tuoi dati scrivi a {TITOLARE.email}.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Quali dati trattiamo">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Dati dell&apos;account: nome, email, ruolo, studio o azienda di appartenenza.</li>
          <li>Accesso con Google o Apple: l&apos;identificativo dell&apos;account e l&apos;email che il servizio ci comunica.</li>
          <li>
            Dati di lavoro inseriti nella piattaforma: anagrafiche delle aziende, lavoratori, mansioni, corsi, scadenze,
            documenti, foto e note dei sopralluoghi.
          </li>
          <li>Telefono: un codice per inviarti le notifiche, se le autorizzi.</li>
          <li>Dati tecnici: registri di accesso e di sicurezza, conservati per il tempo strettamente necessario.</li>
        </ul>
        <p>
          I dati sanitari dei lavoratori restano nello spazio riservato al medico competente e non sono visibili ad
          altri utenti.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Perché li trattiamo">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Fornirti il servizio che hai richiesto (contratto, art. 6.1.b GDPR).</li>
          <li>Aiutare studi e aziende ad adempiere agli obblighi del D.Lgs. 81/2008 (obbligo di legge, art. 6.1.c).</li>
          <li>Tenere sicura la piattaforma e prevenire abusi (interesse legittimo, art. 6.1.f).</li>
        </ul>
      </Paragrafo>

      <Paragrafo titolo="Assistente e intelligenza artificiale">
        <p>
          Alcune funzioni usano modelli di intelligenza artificiale tramite fornitori che non conservano i dati inviati
          e non li usano per addestrare i modelli. Ogni documento prodotto con l&apos;assistenza dell&apos;AI lo dichiara
          e va verificato e firmato da una persona competente.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Chi può vedere i dati">
        <p>
          Solo gli utenti autorizzati del tuo studio o della tua azienda, secondo il ruolo. I dati di uno studio non
          sono mai visibili a un altro studio. I fornitori tecnici (hosting, invio email, notifiche, AI) agiscono come
          responsabili del trattamento.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Per quanto tempo">
        <p>
          I dati dell&apos;account restano finché l&apos;account è attivo. I documenti sulla sicurezza delle aziende sono
          conservati dallo studio che li gestisce per il tempo previsto dalla legge.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Cancellare l'account">
        <p>
          Puoi cancellare il tuo account in ogni momento dall&apos;app: Tutto, poi Account, poi Elimina il mio account.
          Nome, email e accessi vengono cancellati subito e si chiudono le sessioni su tutti i dispositivi. I documenti
          delle aziende restano allo studio, perché non sono dati personali tuoi e servono per legge.
        </p>
      </Paragrafo>

      <Paragrafo titolo="I tuoi diritti">
        <p>
          Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti al trattamento scrivendo a{' '}
          {TITOLARE.email}. Puoi anche presentare reclamo al Garante per la protezione dei dati personali
          (www.garanteprivacy.it).
        </p>
      </Paragrafo>
    </PaginaLegale>
  );
}
