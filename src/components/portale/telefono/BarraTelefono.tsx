'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Cerca, Indietro, Campanella as IconaCampanella } from '@/components/icone';
import { percorso, type AppPortale, type Sezione } from '@/lib/portale/sezioni';
import { FalcoTondo } from './FalcoTondo';
import { Griglia } from './icone';
import type { ContatoriBarra } from './navigazione';

/**
 * Barre dell'app per telefono (03 §2): in alto la topbar da 52 px con il titolo che compare
 * oltre 46 px di scorrimento (o sempre nelle pagine interne); in basso la pillola nera a
 * cinque colonne con l'assistente tondo verde acido sempre al centro.
 */

export function TopbarTelefono({
  titolo,
  interna,
  iniziali,
  nomeAzienda,
  cambiaAzienda,
  onCambiaAzienda,
  onIndietro,
  onCerca,
  notifiche,
  nonLette,
  nascondiAzioni = false,
  destra,
}: {
  titolo: string;
  interna: boolean;
  iniziali: string;
  nomeAzienda: string;
  /** Attivo solo con più aziende o più sedi. */
  cambiaAzienda: boolean;
  onCambiaAzienda: () => void;
  onIndietro: () => void;
  onCerca: () => void;
  /** Rotta della pagina delle notifiche. */
  notifiche: string;
  nonLette: number;
  /** Durante l'attivazione: niente cambio azienda, ricerca e notifiche. */
  nascondiAzioni?: boolean;
  destra?: ReactNode;
}) {
  return (
    <header className="topbar">
      {interna ? (
        <button type="button" className="tb-btn" onClick={onIndietro} aria-label="Indietro">
          <Indietro size={22} aria-hidden />
        </button>
      ) : nascondiAzioni ? (
        <span className="tb-iniziali" aria-hidden>
          {iniziali}
        </span>
      ) : (
        <button
          type="button"
          className="tb-iniziali"
          onClick={onCambiaAzienda}
          disabled={!cambiaAzienda}
          aria-label={cambiaAzienda ? 'Cambia azienda o sede' : nomeAzienda}
        >
          {iniziali}
        </button>
      )}
      <p className="tb-title" aria-hidden={!interna}>
        {titolo}
      </p>
      {destra}
      {!nascondiAzioni && (
        <>
          <button type="button" className="tb-btn" onClick={onCerca} aria-label="Cerca">
            <Cerca size={21} aria-hidden />
          </button>
          <Link href={notifiche} className="tb-btn" aria-label={nonLette > 0 ? `Notifiche, ${nonLette} da leggere` : 'Notifiche'}>
            <IconaCampanella size={21} aria-hidden />
            {nonLette > 0 && <span className="tb-puntino" aria-hidden />}
          </Link>
        </>
      )}
    </header>
  );
}

function Voce({ href, icona: I, etichetta, attiva, n, falco }: { href: string; icona: Sezione['icona']; etichetta: string; attiva: boolean; n: number; falco?: string }) {
  return (
    <Link href={href} className="tab-it" aria-current={attiva ? 'page' : undefined} data-falco={falco}>
      <span className="tab-icona">
        <I size={20} aria-hidden />
        {n > 0 && (
          <span className="tab-badge" aria-hidden>
            {n > 99 ? '99+' : n}
          </span>
        )}
      </span>
      <span className="tab-etichetta">{etichetta}</span>
      {n > 0 && <span className="sr-only">, {n} da vedere</span>}
    </Link>
  );
}

export function TabbarTelefono({
  app,
  voci,
  attiva,
  contatori,
  onAssistente,
}: {
  app: AppPortale;
  /** Tre colonne fisse (vociBarra): [prima, seconda, quarta]; null = colonna vuota. */
  voci: Array<Sezione | null>;
  /** Voce attiva: chiave della sezione della barra, o 'tutto' per tutte le altre. */
  attiva: string;
  contatori: ContatoriBarra;
  onAssistente: () => void;
}) {
  const conta = (s: Sezione) => (s.chiave === 'dashboard' ? contatori.home : s.chiave === 'scadenze' ? contatori.scadenze : 0);
  const colonna = (s: Sezione | null, i: number) =>
    s ? (
      <Voce
        key={s.chiave}
        href={percorso(app, s.chiave)}
        icona={s.icona}
        etichetta={s.breve ?? s.titolo}
        attiva={attiva === s.chiave}
        n={conta(s)}
        falco={`menu.${s.falco ?? `${app}.${s.chiave}`}`}
      />
    ) : (
      <span key={`vuota-${i}`} aria-hidden />
    );
  return (
    <nav aria-label="Menu" className="tabbar">
      {colonna(voci[0] ?? null, 0)}
      {colonna(voci[1] ?? null, 1)}
      <button type="button" className="tab-ai" onClick={onAssistente} aria-label="Chiedi all'assistente" data-falco="falco.chiedi">
        <FalcoTondo size={56} />
      </button>
      {colonna(voci[2] ?? null, 2)}
      <Voce href={`/${app}/tutto/`} icona={Griglia} etichetta="Tutto" attiva={attiva === 'tutto'} n={contatori.tutto} />
    </nav>
  );
}
