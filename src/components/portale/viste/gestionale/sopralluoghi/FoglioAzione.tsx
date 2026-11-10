'use client';

import { useEffect, useState } from 'react';
import { Foglio, Errore } from '../../../kit';
import { classeRischio, proponiAzione, salvaAzione, SCALA_D, SCALA_P, termineConsigliato, type Sopralluogo, type Voce } from '@/lib/portale/sopralluoghi-api';
import { Campo } from './Campo';
import { clsx } from '@/lib/clsx';

/**
 * Azione di miglioramento di una non conformita': cosa fare, responsabile, entro,
 * stima P x D. L'assistente puo' proporla; il termine consigliato lo calcola il
 * codice dalla classe di rischio. Salvare vuol dire confermare.
 */
export function FoglioAzione({
  voce,
  sopralluogoId,
  modificabile,
  onChiudi,
  onSalvato,
}: {
  voce: Voce | null;
  sopralluogoId: number;
  modificabile: boolean;
  onChiudi: () => void;
  onSalvato: (s: Sopralluogo) => void;
}) {
  const [cosa, setCosa] = useState('');
  const [chi, setChi] = useState('Datore di lavoro');
  const [entro, setEntro] = useState('');
  const [entroToccato, setEntroToccato] = useState(false);
  const [p, setP] = useState<number | null>(null);
  const [d, setD] = useState<number | null>(null);
  const [pericolo, setPericolo] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [lavoro, setLavoro] = useState<'proponi' | 'salva' | null>(null);
  const [daAssistente, setDaAssistente] = useState(false);

  useEffect(() => {
    if (!voce) return;
    const a = voce.azione;
    setCosa(a?.cosa || `Ripristinare la conformità: ${voce.testo.charAt(0).toLowerCase()}${voce.testo.slice(1)}.`);
    setChi(a?.responsabile || 'Datore di lavoro');
    setEntro(a?.entro ?? '');
    setEntroToccato(!!a?.entro && !a.proposta);
    setP(a?.p ?? null);
    setD(a?.d ?? null);
    setPericolo(a?.pericolo ?? '');
    setDaAssistente(!!a?.proposta);
    setErrore(null);
  }, [voce]);

  useEffect(() => {
    if (entroToccato) return;
    const t = termineConsigliato(p, d);
    if (t) setEntro(t);
  }, [p, d, entroToccato]);

  const cr = classeRischio(p, d);

  const proponi = async () => {
    if (!voce) return;
    setLavoro('proponi');
    setErrore(null);
    try {
      const r = await proponiAzione(sopralluogoId, voce.id);
      const a = r.proposta;
      if (a) {
        setCosa(a.cosa);
        setChi(a.responsabile || chi);
        setPericolo(a.pericolo);
        if (a.p) setP(a.p);
        if (a.d) setD(a.d);
        if (a.entro) {
          setEntro(a.entro);
          setEntroToccato(false);
        }
        setDaAssistente(true);
      }
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(null);
    }
  };

  const salva = async () => {
    if (!voce) return;
    if (!cosa.trim() || !chi.trim() || !entro || !p || !d) {
      setErrore('Servono cosa fare, il responsabile, la data e la stima P e D.');
      return;
    }
    setLavoro('salva');
    setErrore(null);
    try {
      onSalvato(await salvaAzione(sopralluogoId, voce.id, { cosa: cosa.trim(), responsabile: chi.trim(), entro, p, d, pericolo: pericolo.trim() || undefined }));
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setLavoro(null);
    }
  };

  return (
    <Foglio
      aperto={voce !== null}
      titolo="Azione di miglioramento"
      onChiudi={onChiudi}
      piede={
        modificabile ? (
          <>
            <button type="button" className="btn-ghost" onClick={proponi} disabled={lavoro !== null}>
              {lavoro === 'proponi' ? 'Ci penso' : 'Proponi con l’assistente'}
            </button>
            <button type="button" className="btn-primary" onClick={salva} disabled={lavoro !== null}>
              {lavoro === 'salva' ? 'Salvo' : 'Conferma l’azione'}
            </button>
          </>
        ) : undefined
      }
    >
      {voce && (
        <div className="space-y-4">
          <div className="rounded-[1rem] bg-perla-velo px-3.5 py-3">
            <p className="text-[12.5px] text-ink-muted">{voce.area}</p>
            <p className="text-[14.5px] font-medium leading-snug text-ink">{voce.testo}</p>
            {voce.riferimento && <p className="mt-0.5 text-[12.5px] text-ink-muted">{voce.riferimento}</p>}
          </div>
          {daAssistente && <p className="text-[13px] leading-snug text-ink-muted">Proposta dell&apos;assistente: controllala e correggila prima di confermare.</p>}
          <Campo etichetta="Cosa fare">
            <textarea className="input-field min-h-[96px]" value={cosa} maxLength={600} onChange={(e) => setCosa(e.target.value)} disabled={!modificabile} />
          </Campo>
          <Campo etichetta="Pericolo e possibile danno" aiuto="Facoltativo: entra nella scheda del rilievo del verbale.">
            <input className="input-field" value={pericolo} maxLength={300} onChange={(e) => setPericolo(e.target.value)} disabled={!modificabile} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Probabilità">
              <select className="input-field" value={p ?? ''} onChange={(e) => setP(e.target.value ? Number(e.target.value) : null)} disabled={!modificabile}>
                <option value="">Scegli</option>
                {SCALA_P.map((t, i) => (
                  <option key={t} value={i + 1}>
                    {i + 1}, {t.toLowerCase()}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etichetta="Danno">
              <select className="input-field" value={d ?? ''} onChange={(e) => setD(e.target.value ? Number(e.target.value) : null)} disabled={!modificabile}>
                <option value="">Scegli</option>
                {SCALA_D.map((t, i) => (
                  <option key={t} value={i + 1}>
                    {i + 1}, {t.toLowerCase()}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          {cr && (
            <p className={clsx('rounded-[0.9rem] px-3 py-2 text-[13.5px]', cr.tono === 'danger' ? 'bg-stato-danger text-stato-danger-ink' : cr.tono === 'warn' ? 'bg-stato-warn text-stato-warn-ink' : 'bg-stato-ok text-stato-ok-ink')}>
              R = {p} x {d} = {cr.r}, rischio {cr.classe}: lo studio indica un termine entro {cr.giorni} giorni.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Responsabile">
              <input className="input-field" value={chi} maxLength={150} onChange={(e) => setChi(e.target.value)} disabled={!modificabile} />
            </Campo>
            <Campo etichetta="Entro il">
              <input type="date" className="input-field" value={entro} onChange={(e) => { setEntro(e.target.value); setEntroToccato(true); }} disabled={!modificabile} />
            </Campo>
          </div>
          <p className="text-[13px] leading-snug text-ink-muted">L&apos;azione entra nel programma di miglioramento del DVR e diventa una scadenza per il cliente quando chiudi il sopralluogo.</p>
          {errore && <Errore testo={errore} />}
        </div>
      )}
    </Foglio>
  );
}
