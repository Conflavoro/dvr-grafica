// Safety Control Room dell'agente HSE.
//
// Ogni scheda riceve { aziendaId, ruolo, versione, chiedi } (piu' occupato e
// nomeAgente facoltativi) e funziona sia nello spazio di lavoro laterale
// (380..520 px, foglio dal basso su mobile) sia in pagina. Per agganciarle:
//
//   import { SCHEDE_CONTROL_ROOM } from '@/components/agente/controlroom';
//   const s = SCHEDE_CONTROL_ROOM.find((x) => x.chiave === scheda);
//   {s && <s.Componente aziendaId={id} ruolo={ruolo} versione={v} chiedi={chiedi} />}

import type { ComponentType } from 'react';
import { Calendario, Cartella, Grafico, Punteggio, Qr, Sirena, type LucideIcon } from '@/components/icone';
import type { SchedaSpazio } from '@/lib/agente-temi';
import { ControlRoom } from './ControlRoom';
import { Fascicolo } from './Fascicolo';
import { Passaporto } from './Passaporto';
import { ProntoControllo } from './ProntoControllo';
import { Report } from './Report';
import { Scadenzario } from './Scadenzario';
import type { SchedaControlRoomProps } from './kit';

export type ChiaveControlRoom = Extract<SchedaSpazio, 'control_room' | 'scadenzario' | 'fascicolo' | 'report' | 'passaporto' | 'pronto_controllo'>;

export interface SchedaControlRoom {
  chiave: ChiaveControlRoom;
  titolo: string;
  /** Titolo breve per le linguette strette. */
  breve: string;
  icona: LucideIcon;
  Componente: ComponentType<SchedaControlRoomProps & { nomeAgente?: string }>;
}

export const SCHEDE_CONTROL_ROOM: SchedaControlRoom[] = [
  { chiave: 'control_room', titolo: 'Safety Score', breve: 'Score', icona: Punteggio, Componente: ControlRoom },
  { chiave: 'scadenzario', titolo: 'Scadenzario', breve: 'Scadenze', icona: Calendario, Componente: Scadenzario },
  { chiave: 'fascicolo', titolo: 'Fascicolo digitale', breve: 'Fascicolo', icona: Cartella, Componente: Fascicolo },
  { chiave: 'report', titolo: 'Report mensile', breve: 'Report', icona: Grafico, Componente: Report },
  { chiave: 'passaporto', titolo: 'Safety Passport', breve: 'Passport', icona: Qr, Componente: Passaporto },
  { chiave: 'pronto_controllo', titolo: 'Pronto Controllo', breve: 'Controllo', icona: Sirena, Componente: ProntoControllo },
];

export const eSchedaControlRoom = (s: string): s is ChiaveControlRoom => SCHEDE_CONTROL_ROOM.some((x) => x.chiave === s);

export { ControlRoom, Fascicolo, Passaporto, ProntoControllo, Report, Scadenzario };
export type { SchedaControlRoomProps };
