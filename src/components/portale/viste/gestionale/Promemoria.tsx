'use client';

import { useState } from 'react';
import { usePortale } from '../../PortaleShell';
import { Caricamento, Chip, Errore, Foglio, Riga, Riquadro, Scheda, Schede, Testata, Vuoto, dataIt } from '../../kit';
import { Campo, ChipStato, useAzione, useCarico } from '../amministrazione-kit';
import { annullaAddebito, assenze, promemoriaPresenze } from '@/lib/portale/amministrazione-api';
import { usePermessiStaff } from '@/lib/portale/gestionale-permessi';
import { STATI_ASSENZA, chip, euro } from '@/lib/portale/amministrazione-logica';
import { lista, numero, rec, testo } from '@/lib/portale/api';
import { Fumetto } from '@/components/icone';

type Scheda = 'visite' | 'corsi' | 'assenze';

/** Promemoria e presenze (11): visite prenotate, convocazioni ai corsi, assenze. Niente conferma della visita (09). */
export default function Promemoria() {
  const { user, versione, ricarica, aziendaScelta } = usePortale();
  const azId = aziendaScelta?.id ?? null;
  const [scheda, setScheda] = useState<Scheda>('visite');
  const [annulla, setAnnulla] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const p = useCarico(() => promemoriaPresenze(14, azId), [versione, azId]);
  const a = useCarico(() => assenze(), [versione]);
  const az = useAzione();
  // "Annulla l'addebito": solo il coordinatore (11.3).
  const { permessi } = usePermessiStaff();
  const amm = permessi.ruolo === 'coordinatore';
  void user;
  void ricarica;
  const c = rec(p.dati?.conteggi);
  const visite = lista(p.dati?.visite).map(rec);
  const corsi = lista(p.dati?.corsi).map(rec);
  // Solo il cliente scelto in cima al menu.
  const assenzeL = (a.dati ?? []).filter((x) => !azId || numero(x.azienda_id) === azId);

  return (
    <div className="space-y-5">
      <Testata categoria="assistenza" icona={Fumetto} sopra={aziendaScelta?.ragione_sociale ?? 'Formazione e visite'} titolo="Promemoria e presenze" sotto="Promemoria automatici con orario e posizione, mai tra le 20 e le 8 né nei festivi." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro etichetta="Visite nei prossimi 14 giorni" valore={numero(c.visite) ?? 0} />
        <Riquadro etichetta="Prenotate" valore={numero(c.prenotate) ?? 0} />
        <Riquadro etichetta="Tenute, quota da pagare" valore={numero(c.tenute) ?? 0} tono={(numero(c.tenute) ?? 0) > 0 ? 'warn' : undefined} />
      </div>
      <Schede<Scheda>
        etichetta="Promemoria e presenze"
        attiva={scheda}
        onCambia={setScheda}
        voci={[
          { k: 'visite', t: 'Visite', n: numero(c.visite) ?? 0 },
          { k: 'corsi', t: 'Convocazioni ai corsi', n: corsi.length },
          { k: 'assenze', t: 'Assenze', n: assenzeL.filter((x) => x.esito === 'da_riprogrammare').length },
        ]}
      />
      {p.errore && <Errore testo={p.errore} onRiprova={p.carica} />}
      {!p.dati && !p.errore && <Caricamento />}
      {p.dati && scheda === 'visite' && (
        <Scheda titolo="Visite prenotate">
          {visite.length === 0 ? (
            <Vuoto titolo="Nessuna visita nei prossimi 14 giorni" />
          ) : (
            visite.map((v) => {
              const tenuta = testo(v.stato) === 'tenuta';
              return (
                <Riga
                  key={numero(v.scadenza_id) ?? 0}
                  titolo={`${testo(v.quando)?.slice(11) ?? ''} · ${testo(v.lavoratore)}`}
                  sotto={`${dataIt(testo(v.quando)?.slice(0, 10))} · ${testo(v.azienda)} · ${testo(v.luogo) ?? ''} · promemoria ${numero(v.passi_inviati) ?? 0} su ${numero(v.passi_previsti) ?? 0}`}
                  fine={<Chip stato={tenuta ? 'sign' : 'info'}>{tenuta ? 'Tenuta, quota da pagare' : 'Prenotata'}</Chip>}
                />
              );
            })
          )}
        </Scheda>
      )}
      {p.dati && scheda === 'corsi' && (
        <Scheda titolo="Corsi in partenza" sotto="Il posto resta tenuto finché la quota d'ingresso non è pagata.">
          {corsi.length === 0 ? (
            <Vuoto titolo="Nessun corso nei prossimi 14 giorni" />
          ) : (
            corsi.map((k) => (
              <Riga key={numero(k.classe_id) ?? 0} titolo={testo(k.titolo) ?? ''} sotto={`${dataIt(testo(k.data))}${testo(k.ora) ? ` alle ${testo(k.ora)}` : ''} · ${numero(k.iscritti)} iscritti · ${numero(k.confermati)} confermati · ${numero(k.tenuti)} posti tenuti`} />
            ))
          )}
        </Scheda>
      )}
      {scheda === 'assenze' && (
        <Scheda titolo="Assenze senza preavviso" sotto="La prima si riprogramma senza costi; dalla seconda nei 12 mesi l'azienda paga il costo della visita.">
          {a.errore && <Errore testo={a.errore} onRiprova={a.carica} />}
          {assenzeL.length === 0 ? (
            <Vuoto titolo="Nessuna assenza" />
          ) : (
            assenzeL.map((x) => (
              <Riga
                key={numero(x.id) ?? 0}
                titolo={`${testo(x.lavoratore)} · ${testo(x.azienda)}`}
                sotto={`${dataIt(testo(x.data))} · ${numero(x.numero) === 1 ? 'prima assenza' : `${numero(x.numero)}ª assenza`}${(numero(x.importo) ?? 0) > 0 ? ` · ${euro(numero(x.importo))}` : ''}${testo(x.motivo_annullo) ? ` · annullato: ${testo(x.motivo_annullo)}` : ''}`}
                fine={
                  <span className="flex flex-col items-end gap-1.5">
                    <ChipStato c={chip(STATI_ASSENZA, testo(x.esito))} />
                    {amm && x.esito === 'addebitata' && (
                      <button
                        type="button"
                        className="btn-ghost min-h-[44px] lg:min-h-[40px]"
                        onClick={() => setAnnulla(numero(x.id))}
                      >
                        Annulla l&apos;addebito
                      </button>
                    )}
                  </span>
                }
              />
            ))
          )}
        </Scheda>
      )}
      {p.dati && (
        <Scheda titolo="Regole">
          <ul className="space-y-1.5 text-[14px] text-ink">
            {lista(p.dati.regole).map((r) => (
              <li key={String(r)} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cat-assistenza-segno" />
                {String(r)}
              </li>
            ))}
          </ul>
        </Scheda>
      )}
      <Foglio
        aperto={annulla !== null}
        titolo="Annulla l'addebito"
        onChiudi={() => setAnnulla(null)}
        piede={
          <button
            type="button"
            className="btn-primary"
            disabled={az.occupato || motivo.trim().length < 5}
            onClick={() => annulla !== null && az.esegui(() => annullaAddebito(annulla, motivo), 'Addebito annullato.').then((ok) => { if (ok) { setAnnulla(null); setMotivo(''); a.carica(); } })}
          >
            Annulla l&apos;addebito
          </button>
        }
      >
        <Campo etichetta="Motivo" aiuto="Ricovero, errore di convocazione: resta nel registro.">
          <textarea className="input-field h-24 py-3" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </Foglio>
      {az.messaggio}
    </div>
  );
}
