import type { Metadata } from 'next';
import { NOME_APP, PaginaLegale, Paragrafo, TITOLARE } from '@/components/legale/PaginaLegale';

export const metadata: Metadata = { title: `Termini di servizio · ${NOME_APP}` };

export default function Termini() {
  return (
    <PaginaLegale titolo="Termini di servizio" aggiornata="30 ottobre 2026">
      <p>
        Questi termini regolano l&apos;uso di {NOME_APP}, servizio di {TITOLARE.ragioneSociale} per la gestione della
        sicurezza sul lavoro di studi professionali e aziende.
      </p>

      <Paragrafo titolo="Il servizio">
        <p>
          {NOME_APP} aiuta a raccogliere i dati, tenere le scadenze e preparare i documenti previsti dal D.Lgs. 81/2008.
          Il software assiste chi lavora: non sostituisce il datore di lavoro, il responsabile del servizio di
          prevenzione e protezione o il medico competente.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Documenti preparati con l'AI">
        <p>
          I documenti preparati con l&apos;assistenza dell&apos;intelligenza artificiale lo dichiarano. Sono validi solo
          dopo la verifica e la firma delle figure competenti. Nessun documento viene approvato o firmato dal software.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Il tuo account">
        <p>
          Sei responsabile delle credenziali e di quello che fai con il tuo account. Usa dati veri e aggiornati e
          inserisci dati di altre persone solo se hai titolo per farlo. Puoi cancellare l&apos;account in ogni momento
          dall&apos;app.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Uso corretto">
        <p>
          Non è consentito accedere ai dati di altri studi o aziende, aggirare i controlli di sicurezza o usare il
          servizio per scopi illeciti. In questi casi l&apos;accesso può essere sospeso.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Disponibilità e responsabilità">
        <p>
          Facciamo il possibile perché il servizio sia sempre disponibile e corretto, ma possono esserci interruzioni
          per manutenzione o cause esterne. Le condizioni economiche e di responsabilità sono quelle del contratto
          sottoscritto con lo studio o con l&apos;azienda.
        </p>
      </Paragrafo>

      <Paragrafo titolo="Legge applicabile e contatti">
        <p>
          Si applica la legge italiana. Per domande scrivi a {TITOLARE.email}. Il trattamento dei dati personali è
          descritto nell&apos;informativa sulla privacy.
        </p>
      </Paragrafo>
    </PaginaLegale>
  );
}
