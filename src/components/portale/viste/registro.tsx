'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { Caricamento } from '../kit';

/**
 * Vista di ogni sezione, per app e chiave. Ogni squadra aggiunge qui la sua riga
 * e il suo file in components/portale/viste/<app>/; le sezioni senza vista
 * mostrano SezioneFalco (lavoro guidato dal Falco della sezione).
 */

const c = () => <Caricamento />;

export const VISTE: Record<string, ComponentType> = {
  'azienda.dashboard': dynamic(() => import('./azienda/Home'), { loading: c }),
  'gestionale.sopralluoghi': dynamic(() => import('./gestionale/Sopralluoghi'), { loading: c }),
  'azienda.scadenze': dynamic(() => import('./azienda/Scadenze'), { loading: c }),
  'azienda.persone': dynamic(() => import('./azienda/Persone'), { loading: c }),
  'azienda.formazione': dynamic(() => import('./azienda/Formazione'), { loading: c }),
  'azienda.visite': dynamic(() => import('./azienda/Visite'), { loading: c }),
  'azienda.antincendio': dynamic(() => import('./azienda/Antincendio'), { loading: c }),
  'azienda.documenti': dynamic(() => import('./azienda/Documenti'), { loading: c }),
  'azienda.utenti': dynamic(() => import('./azienda/Utenti'), { loading: c }),
  'azienda.avvio': dynamic(() => import('./azienda/Avvio'), { loading: c }),
  'azienda.ispezioni': dynamic(() => import('./azienda/Ispezioni'), { loading: c }),
  'azienda.messaggi': dynamic(() => import('./azienda/Messaggi'), { loading: c }),
  'gestionale.coda': dynamic(() => import('./gestionale/Coda'), { loading: c }),
  'gestionale.aziende': dynamic(() => import('./gestionale/Aziende'), { loading: c }),
  'gestionale.avvio': dynamic(() => import('./gestionale/Avvio'), { loading: c }),
  'gestionale.cruscotto': dynamic(() => import('./gestionale/Cruscotto'), { loading: c }),
  'gestionale.dvr': dynamic(() => import('./gestionale/Scrivania'), { loading: c }),
  'gestionale.pos': dynamic(() => import('./gestionale/Pos'), { loading: c }),
  'gestionale.ispezioni': dynamic(() => import('./gestionale/Ispezioni'), { loading: c }),
  'azienda.nearmiss': dynamic(() => import('./azienda/NearMiss'), { loading: c }),
  'gestionale.medico': dynamic(() => import('./gestionale/Medico'), { loading: c }),
  // Formazione, visite e amministrazione (V6, V7).
  'gestionale.prenotazioni': dynamic(() => import('./gestionale/Prenotazioni'), { loading: c }),
  'gestionale.classi': dynamic(() => import('./gestionale/Classi'), { loading: c }),
  'gestionale.promemoria': dynamic(() => import('./gestionale/Promemoria'), { loading: c }),
  'gestionale.giornata': dynamic(() => import('./gestionale/Giornata'), { loading: c }),
  'gestionale.laboratorio': dynamic(() => import('./gestionale/Laboratorio'), { loading: c }),
  'gestionale.preventivi': dynamic(() => import('./gestionale/Preventivi'), { loading: c }),
  'gestionale.crediti': dynamic(() => import('./gestionale/Crediti'), { loading: c }),
  'gestionale.ore': dynamic(() => import('./gestionale/Ore'), { loading: c }),
  'azienda.servizi': dynamic(() => import('./azienda/Servizi'), { loading: c }),
  'azienda.contratto': dynamic(() => import('./azienda/Contratto'), { loading: c }),
  'azienda.wallet': dynamic(() => import('./azienda/Wallet'), { loading: c }),
  'gestionale.aggiornamenti': dynamic(() => import('./gestionale/Aggiornamenti'), { loading: c }),
  'azienda.importa': dynamic(() => import('./azienda/Importa'), { loading: c }),
  'azienda.attivazione': dynamic(() => import('./azienda/Attivazione'), { loading: c }),
  // Sezioni nuove della specifica (S5): primo soccorso, HACCP (solo computer), infortuni.
  'azienda.primosoccorso': dynamic(() => import('./azienda/PrimoSoccorso'), { loading: c }),
  'azienda.haccp': dynamic(() => import('./azienda/Haccp'), { loading: c }),
  'azienda.infortuni': dynamic(() => import('./azienda/Infortuni'), { loading: c }),
  // Fuori dall'app del cliente, restano nel gestionale sull'azienda scelta (decisione del 30/10/2026).
  'gestionale.nearmiss': dynamic(() => import('./azienda/NearMiss'), { loading: c }),
  'gestionale.importa': dynamic(() => import('./azienda/Importa'), { loading: c }),
};

void c;
void dynamic;
