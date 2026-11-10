'use client';

import { useCallback, useEffect, useState } from 'react';
import { Elenco, Allerta } from '@/components/icone';
import { Caricamento, Foglio, Vuoto } from '@/components/portale/kit';
import { usePortale } from '@/components/portale/PortaleShell';
import { clsx } from '@/lib/clsx';
import { avanzamento, bloccantiAperti, puoApprovare, testoAvanzamento, vedeBozze } from '@/lib/cowork/logica';
import { useScrivania, type Messaggio } from '@/lib/cowork/use-scrivania';
import { BannerAssistente, TestataDocumento } from './TestataDocumento';
import { IndiceDocumento } from './IndiceDocumento';
import { SezioneParagrafi } from './SezioneParagrafi';
import { TabelleSezione } from './TabelleSezione';
import { ControlliDocumento } from './ControlliDocumento';
import { Pulsante } from './parti';

/**
 * Scrivania del DVR per paragrafi (ADR-011): l'assistente prepara, la persona
 * accetta, riscrive o segna non applicabile; il titolare approva. Indice a sinistra,
 * paragrafo al centro, dati e controlli a destra; su telefono indice e controlli
 * stanno in pannelli che si aprono dal basso. Il Falco resta nel guscio, di lato.
 */

function Avviso({ m, onChiudi, onApri }: { m: Messaggio; onChiudi: () => void; onApri: (k: string) => void }) {
  const cls = m.tono === 'ok' ? 'bg-acido-200 text-acido-950' : m.tono === 'warn' ? 'bg-stato-warn text-stato-warn-ink' : 'bg-stato-danger text-stato-danger-ink';
  const sezioni = Array.from(new Set((m.aperti ?? []).map((a) => a.sezione).filter((x): x is string => !!x)));
  return (
    <div role={m.tono === 'ok' ? 'status' : 'alert'} className={clsx('flex flex-wrap items-start gap-3 rounded-[1rem] px-4 py-3 text-[14px]', cls)}>
      <div className="min-w-0 flex-1 basis-[16rem]">
        <p>{m.testo}</p>
        {sezioni.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
            Da chiudere:
            {sezioni.map((s) => (
              <button key={s} type="button" className="min-h-[32px] rounded-full bg-white/70 px-2.5 font-medium hover:bg-white" onClick={() => onApri(s)}>
                {/^\d+$/.test(s) ? `sezione ${s}` : s.replace(/_/g, ' ')}
              </button>
            ))}
          </p>
        )}
      </div>
      <button type="button" onClick={onChiudi} className="min-h-[36px] text-[13px] underline underline-offset-2">
        Chiudi
      </button>
    </div>
  );
}

export function ScrivaniaDvr({
  dvrId,
  sezioneIniziale,
  azienda,
  aziendaId,
  onIndietro,
  onSezione,
}: {
  dvrId: number;
  sezioneIniziale?: string | null;
  azienda: string;
  aziendaId: number | null;
  onIndietro?: () => void;
  onSezione?: (k: string) => void;
}) {
  const { user, apri } = usePortale();
  const s = useScrivania('dvr', dvrId, { sezione: sezioneIniziale ?? null, suSezione: onSezione });
  const [foglio, setFoglio] = useState<'indice' | 'controlli' | null>(null);
  const [conferma, setConferma] = useState(false);
  const titolare = puoApprovare(user.role);

  // Il Falco sa quale documento e' aperto.
  useEffect(() => {
    apri({ tipo: 'dvr', id: dvrId }, aziendaId);
    return () => apri(null, aziendaId);
  }, [dvrId, aziendaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Documento di un'altra azienda rispetto al cliente scelto: si torna all'elenco.
  const altraAzienda = !!s.documento && aziendaId !== null && s.documento.testata.aziendaId !== null && s.documento.testata.aziendaId !== aziendaId;
  useEffect(() => {
    if (altraAzienda) onIndietro?.();
  }, [altraAzienda]); // eslint-disable-line react-hooks/exhaustive-deps

  const apriSezione = useCallback(
    (k: string) => {
      setFoglio(null);
      s.apriSezione(k);
      try {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
      } catch {
        /* comodita' */
      }
    },
    [s],
  );

  if (!vedeBozze(user.role)) {
    return <Vuoto titolo="Le bozze sono lavoro dello studio">Il documento si vede nell&apos;area dell&apos;azienda quando il titolare lo ha approvato.</Vuoto>;
  }

  if (s.caricamento && !s.documento) return <Caricamento testo="Apro la Scrivania del DVR" />;

  if (s.errore && !s.documento) {
    const e = s.errore;
    const titolo = e.status === -1 ? 'Serve il backend collegato' : e.status === 404 ? 'La Scrivania per paragrafi non è attiva per questo documento' : e.status === 403 ? 'Non disponibile per il tuo ruolo' : 'Non riesco ad aprire il documento';
    const testo =
      e.status === 404
        ? 'Il motore che prepara i paragrafi non è acceso per questo studio, oppure il documento non è più disponibile. Puoi continuare a lavorare dalla scrivania dei documenti.'
        : e.message;
    return (
      <Vuoto
        titolo={titolo}
        azione={
          onIndietro ? (
            <button type="button" className="btn-ghost" onClick={onIndietro}>
              Torna ai documenti
            </button>
          ) : undefined
        }
      >
        {testo}
      </Vuoto>
    );
  }

  const d = s.documento!;
  const a = avanzamento(d.indice);
  const conti = s.controlli ? s.controlli.bloccanti.length + s.controlli.avvisi.filter((x) => x.stato === 'aperto').length : d.controlli.bloccanti + d.controlli.avvisi;
  const bloccanti = s.controlli ? bloccantiAperti(s.controlli).length : d.controlli.bloccanti;

  const azioniControlli = { onApriSezione: apriSezione, onEsegui: s.eseguiControllo, onAccetta: s.accettaControllo };
  const azioniParagrafo = { accetta: s.accetta, modifica: s.modifica, nonApplicabile: s.nonApplicabile, riscrivi: s.riscrivi, rigenera: s.rigenera };

  return (
    <div className="space-y-4">
      <TestataDocumento
        documento={d}
        azienda={azienda}
        puoApprovare={titolare}
        lavoroApprova={s.lavoro === 'approva'}
        onApprova={() => setConferma(true)}
        onIndietro={onIndietro}
        onErrore={(t) => s.avvisa(t)}
      />
      <BannerAssistente documento={d} />
      {s.messaggio && <Avviso m={s.messaggio} onChiudi={s.chiudiMessaggio} onApri={apriSezione} />}

      <div className="cowork-contenitore">
        {/* Telefono e spazi stretti: indice e controlli in pannelli. */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="cowork-solo-stretto-indice btn-ghost min-h-[44px]" onClick={() => setFoglio('indice')}>
            <Elenco size={16} aria-hidden /> Indice, {testoAvanzamento(a)}
          </button>
          <button type="button" className="cowork-solo-stretto-controlli btn-ghost min-h-[44px]" onClick={() => setFoglio('controlli')}>
            <Allerta size={16} aria-hidden className={bloccanti > 0 ? 'text-stato-danger-segno' : undefined} /> Controlli{conti > 0 ? `, ${conti} aperti` : ''}
          </button>
        </div>

        <div className="cowork-griglia">
          <div className="cowork-indice">
            <IndiceDocumento indice={d.indice} attiva={s.chiave} onApri={apriSezione} />
          </div>
          <div className="min-w-0">
            <SezioneParagrafi sezione={s.sezione} controlli={s.controlli} carica={s.caricaSezione} lavoro={s.lavoro} azioni={azioniParagrafo} onAccettaSezione={() => void s.accettaSezione()} />
          </div>
          <div className="cowork-destra min-w-0 space-y-3">
            <TabelleSezione tabelle={s.sezione?.tabelle ?? []} />
            <div className="cowork-solo-largo">
              <ControlliDocumento controlli={s.controlli} sezione={s.chiave} lavoro={s.lavoro} {...azioniControlli} />
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[12.5px] text-ink-muted">
        Documento preparato con assistenza AI: la validità è subordinata alla verifica e alla sottoscrizione delle figure competenti.
        {s.modo === 'riserva' ? ' Lo stato si aggiorna da solo ogni 10 secondi.' : ''}
      </p>

      <Foglio aperto={foglio === 'indice'} titolo="Indice del documento" onChiudi={() => setFoglio(null)}>
        <IndiceDocumento indice={d.indice} attiva={s.chiave} onApri={apriSezione} />
      </Foglio>
      <Foglio aperto={foglio === 'controlli'} titolo="Controlli automatici" onChiudi={() => setFoglio(null)}>
        <ControlliDocumento controlli={s.controlli} sezione={s.chiave} lavoro={s.lavoro} {...azioniControlli} />
      </Foglio>

      <Foglio
        aperto={conferma}
        titolo="Approva il DVR"
        onChiudi={() => setConferma(false)}
        piede={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConferma(false)}>
              Annulla
            </button>
            <Pulsante
              classe="btn-acido"
              lavora={s.lavoro === 'approva'}
              onClick={() =>
                void s.approva().then(() => {
                  setConferma(false);
                })
              }
            >
              Approvo e firmo
            </Pulsante>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Approvi esattamente i testi accettati in questa Scrivania: diventano la revisione ufficiale del DVR con i suoi Word e PDF. Le proposte non accettate non entrano.
        </p>
        <p className="mt-3 text-[14px] text-ink-muted">
          {a.chiusi === a.totale ? 'Tutte le sezioni sono chiuse.' : `Sezioni chiuse: ${testoAvanzamento(a)}. Se manca qualcosa il sistema ti dice cosa.`}
          {bloccanti > 0 ? ` Ci sono ${bloccanti} controlli bloccanti aperti.` : ''}
        </p>
      </Foglio>
    </div>
  );
}
