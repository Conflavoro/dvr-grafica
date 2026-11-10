import type { CSSProperties, ReactNode, SVGProps } from 'react';

/**
 * Icone Conflavoro Agente HSE.
 *
 * Disegnate per questo prodotto: griglia 24, tratto sottile (1.5), estremi
 * arrotondati. Sugli oggetti compare il segno del marchio, due lame parallele
 * a 45 gradi come le ali del falco, in un tono piu' tenue (classe "lame",
 * colore da --icona-lame, di default il colore corrente al 55%).
 *
 * I nomi esportati ricalcano quelli usati prima (Building2, CalendarClock...)
 * cosi' i componenti cambiano solo la riga di import. Nessuna icona di "magia
 * AI": niente scintille, stelline o bacchette.
 */
export interface IconaProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export type IconaComponente = ((p: IconaProps) => JSX.Element) & { displayName?: string };
/** Compatibilita' con il vecchio tipo di lucide-react. */
export type LucideIcon = IconaComponente;

/** Due lame parallele che salgono a 45 gradi, a partire da (x, y). */
const lame = (x: number, y: number, l = 2.4, g = 2.3) => `M${x} ${y}l${l} -${l}M${x + g} ${y}l${l} -${l}`;

function crea(nome: string, corpo: ReactNode, segno?: string): IconaComponente {
  const C = ({ size = 24, strokeWidth = 1.5, className, style, ...resto }: IconaProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden={resto['aria-hidden'] ?? true}
      focusable="false"
      {...resto}
    >
      {corpo}
      {segno && <path d={segno} className="lame" style={{ stroke: 'var(--icona-lame, currentColor)', opacity: 'var(--icona-lame-opacita, 0.55)' }} />}
    </svg>
  );
  C.displayName = nome;
  return C;
}

const P = (d: string) => <path d={d} />;

// ---------- Oggetti del dominio (con le lame) ----------
export const Azienda = crea('Azienda', <>{P('M4.5 20V8.5h9.5V20M14 12h5.5v8M3 20h18')}{P('M7.5 11.5h1.5M7.5 14.5h1.5M10.5 11.5h1M10.5 14.5h1M8.5 20v-2.5h2V20M16.5 15h1M16.5 17.5h1')}</>, lame(5, 6.5, 2.2, 2.4));
export const Persone = crea('Persone', <>{P('M9 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z')}{P('M3.5 19.5c.7-3.3 2.9-5.25 5.5-5.25s4.8 1.95 5.5 5.25')}{P('M15.25 5.1a3.1 3.1 0 0 1 0 5.8M16.75 14.6c1.9.6 3.1 2.3 3.6 4.9')}</>);
export const Persona = crea('Persona', <>{P('M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z')}{P('M5.5 20c.9-3.6 3.4-5.7 6.5-5.7s5.6 2.1 6.5 5.7')}</>);
export const PersonaVerificata = crea('PersonaVerificata', <>{P('M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z')}{P('M3.5 20c.9-3.6 3.4-5.7 6.5-5.7 1.4 0 2.6.4 3.7 1.2')}{P('M15.5 18.25l1.75 1.75 3.5-3.75')}</>);
export const Calendario = crea('Calendario', <>{P('M5.5 5.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z')}{P('M3.5 10h17M8 3.5v4M16 3.5v4')}</>, lame(13, 17.5, 2.2, 2.4));
export const Documento = crea('Documento', <>{P('M6.5 3.5h7.5l4.5 4.5v12.5h-12Z')}{P('M14 3.5V8h4.5M9 12.5h6M9 15.5h4')}</>, lame(9.2, 19.2, 1.8, 2.2));
export const Casco = crea('Casco', <>{P('M3.5 17.5h17M5.5 17.5v-2.75a6.5 6.5 0 0 1 13 0v2.75')}{P('M10.25 8.4V12M13.75 8.4V12')}{P('M4.5 20h15')}</>, lame(7.4, 13.6, 1.8, 2.1));
export const Rete = crea('Rete', <>{P('M9.5 3.5h5v5h-5ZM3.5 15.5h5v5h-5ZM15.5 15.5h5v5h-5Z')}{P('M12 8.5V12M6 15.5V12h12v3.5')}</>);
export const Interferenze = crea('Interferenze', <>{P('M9 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z')}{P('M15 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z')}</>, lame(10.7, 13.4, 1.4, 1.3));
export const Sopralluogo = crea('Sopralluogo', <>{P('M7 4.5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z')}{P('M9 3.5h6v2.5H9Z')}{P('M9 13.25l2.1 2.1 4.15-4.35')}</>);
export const Bilancia = crea('Bilancia', <>{P('M12 4v16M7.5 20h9M5 7.5h14')}{P('M2.75 13.5 5 7.5l2.25 6a2.25 2.25 0 0 1-4.5 0ZM16.75 13.5 19 7.5l2.25 6a2.25 2.25 0 0 1-4.5 0Z')}</>, lame(10.3, 4.3, 1.2, 2.2));
export const Sirena = crea('Sirena', <>{P('M7 18v-5.5a5 5 0 0 1 10 0V18')}{P('M5 18h14v2.5H5ZM12 3v1.5M4.5 6.5l1 1')}</>, lame(17.3, 8.3, 1.4, 1.9));
export const Fotocamera = crea('Fotocamera', <>{P('M5.5 7.5h2.75l1.5-2.5h4.5l1.5 2.5h2.75a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z')}{P('M12 16.75a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z')}</>, lame(17, 11.6, 1.2, 1.6));
export const Microfono = crea('Microfono', <>{P('M12 3.5a2.75 2.75 0 0 1 2.75 2.75v5a2.75 2.75 0 0 1-5.5 0v-5A2.75 2.75 0 0 1 12 3.5Z')}{P('M5.75 11a6.25 6.25 0 0 0 12.5 0M12 17.25v3.25')}</>);
export const Invia = crea('Invia', <>{P('M4 11.25 20 4l-6.25 16-2.6-6.6Z')}{P('M11.15 13.4 20 4')}</>);
export const Altoparlante = crea('Altoparlante', <>{P('M4 9.5h3.25L12 5.5v13l-4.75-4H4Z')}{P('M15.5 9.25a3.9 3.9 0 0 1 0 5.5M18 6.75a7.4 7.4 0 0 1 0 10.5')}</>);
export const Muto = crea('Muto', <>{P('M4 9.5h3.25L12 5.5v13l-4.75-4H4Z')}{P('M15.75 9.5l5 5M20.75 9.5l-5 5')}</>);
export const Scarica = crea('Scarica', <>{P('M12 4v10.5M7.75 10.25 12 14.5l4.25-4.25M5 19.5h14')}</>);
export const Matita = crea('Matita', <>{P('M14.75 4.75l4.5 4.5L9 19.5H4.5V15Z')}{P('M12.75 6.75l4.5 4.5')}</>);
export const Cestino = crea('Cestino', <>{P('M4.5 7h15M9.5 7V4.75h5V7M6.5 7l1 12.5h9l1-12.5')}{P('M10.5 10.5v5.5M13.5 10.5v5.5')}</>);
/** Preferita: un segnalibro, non una stellina. */
export const Segnalibro = crea('Segnalibro', <>{P('M7 3.75h10v16.5l-5-3.5-5 3.5Z')}</>);
export const Luogo = crea('Luogo', <>{P('M12 20.75s-6.25-5.9-6.25-10.5a6.25 6.25 0 0 1 12.5 0c0 4.6-6.25 10.5-6.25 10.5Z')}{P('M12 12.25a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z')}</>);
export const Scudo = crea('Scudo', <>{P('M12 3.25 19.25 6v5.4c0 4.55-3.1 8.1-7.25 9.35-4.15-1.25-7.25-4.8-7.25-9.35V6Z')}{P('M8.75 12.25l2.25 2.25 4.25-4.5')}</>);
export const ScudoAllerta = crea('ScudoAllerta', <>{P('M12 3.25 19.25 6v5.4c0 4.55-3.1 8.1-7.25 9.35-4.15-1.25-7.25-4.8-7.25-9.35V6Z')}{P('M12 8.25v4.25M12 15.6v.15')}</>);
export const Libro = crea('Libro', <>{P('M3.5 5.75c3-1 6-.9 8.5 1 2.5-1.9 5.5-2 8.5-1v13c-3-1-6-.9-8.5 1-2.5-1.9-5.5-2-8.5-1Z')}{P('M12 6.75v13')}</>, lame(5.7, 11.2, 1.6, 2.1));
export const Storico = crea('Storico', <>{P('M4.75 12a7.25 7.25 0 1 0 2.1-5.1M4.75 4.25V8h3.75')}{P('M12 8.25v4.25l3 2')}</>);
export const Elenco = crea('Elenco', <>{P('M10.5 6.5h9.5M10.5 12h9.5M10.5 17.5h9.5')}</>, `${lame(3.8, 7.7, 1.7, 2)}${lame(3.8, 13.2, 1.7, 2)}${lame(3.8, 18.7, 1.7, 2)}`);
export const Cartella = crea('Cartella', <>{P('M3.5 7V5.25h6l2 2.25h9v11.25h-17Z')}{P('M3.5 10h17')}</>);
export const Regolazioni = crea('Regolazioni', <>{P('M4.5 7.5h8.5M18.5 7.5h1M4.5 16.5h2.5M12.5 16.5h7')}{P('M15.75 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.75 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z')}</>);
export const Esci = crea('Esci', <>{P('M13.5 4.5H6.5v15h7M10.5 12H20M16.5 8.5 20 12l-3.5 3.5')}</>);
export const Immagine = crea('Immagine', <>{P('M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z')}{P('M3.75 16.5l4.75-4.75 4 4 2.5-2.5 5.25 5')}</>, lame(14, 10, 1.4, 1.8));
export const Video = crea('Video', <>{P('M5 6.5h8.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z')}{P('M15.5 10.5l5-3v9l-5-3')}</>);
export const Audio = crea('Audio', <>{P('M6.5 3.5h7.5l4.5 4.5v12.5h-12Z')}{P('M14 3.5V8h4.5')}{P('M11.5 17.25a1.5 1.5 0 1 1-1.5-1.5h1.5V11l3 .9')}</>);
export const Nota = crea('Nota', <>{P('M5 4.5h14v9.25l-5.75 5.75H5Z')}{P('M13.25 19.5v-5.75H19')}</>, lame(7.6, 10.4, 1.8, 2.3));
/** Genera: tre lame parallele, il segno del falco. Sostituisce ogni bacchetta magica. */
export const Lame = crea('Lame', <>{P('M5 18 13 10M9 19.5l8-8M13 21l6.5-6.5')}</>);
export const Novita = crea('Novita', <>{P('M5 5.5h11.5a2 2 0 0 1 2 2V18a2.5 2.5 0 0 0 2.5-2.5V9h-2.5')}{P('M18.5 18H6a2.5 2.5 0 0 1-2.5-2.5V7')}{P('M7 9.5h7.5M7 12.75h7.5M7 16h4.5')}</>);
// Safety Control Room
/** Punteggio: arco di quadrante con lancetta. */
export const Punteggio = crea('Punteggio', <>{P('M4 16.5a8 8 0 1 1 16 0')}{P('M12 16.5l3.5-4.75')}{P('M4 19.5h16')}</>, lame(5.3, 12.2, 1.3, 1.9));
/** Codice QR stilizzato: tre riquadri di aggancio e un campo di moduli. */
export const Qr = crea('Qr', <>{P('M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4Z')}{P('M6.5 6.5h1M16.5 6.5h1M6.5 16.5h1')}{P('M14 14h2.5v2.5H14ZM17.5 17.5H20V20h-2.5ZM14 19.5h1M19.5 14v1')}</>);
/** Report: barre crescenti su una base. */
export const Grafico = crea('Grafico', <>{P('M4 20h16')}{P('M6.5 20v-5M11 20v-9M15.5 20v-6.5')}</>, lame(16.8, 9.6, 2, 2.2));
export const Condividi = crea('Condividi', <>{P('M12 14.5V4M8 7.75 12 4l4 3.75')}{P('M7 11H5.5v9h13v-9H17')}</>);
export const Copia = crea('Copia', <>{P('M9 9h10.5v10.5H9Z')}{P('M15 9V4.5H4.5V15H9')}</>);

// ---------- Interfaccia (tratto puro) ----------
export const Cerca =crea('Cerca', <>{P('M10.75 17a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5ZM15.25 15.25 20 20')}</>);
export const Piu = crea('Piu', <>{P('M12 5v14M5 12h14')}</>);
export const Chiudi = crea('Chiudi', <>{P('M6.5 6.5l11 11M17.5 6.5l-11 11')}</>);
export const Spunta = crea('Spunta', <>{P('M5 12.5 9.5 17 19 7')}</>);
export const Giu = crea('Giu', <>{P('M6.5 9.5 12 15l5.5-5.5')}</>);
export const Indietro = crea('Indietro', <>{P('M14.5 6.5 9 12l5.5 5.5')}</>);
export const Avanti = crea('Avanti', <>{P('M9.5 6.5 15 12l-5.5 5.5')}</>);
export const Menu = crea('Menu', <>{P('M4 7h16M4 12h16M4 17h10')}</>);
export const Cerchio = crea('Cerchio', <>{P('M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z')}</>);
export const CerchioSpunta = crea('CerchioSpunta', <>{P('M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z')}{P('M8.5 12.25l2.4 2.4 4.6-4.9')}</>);
export const Avviso = crea('Avviso', <>{P('M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z')}{P('M12 8v4.75M12 15.75v.15')}</>);
export const Rotore = crea('Rotore', <>{P('M12 3.75a8.25 8.25 0 1 0 8.25 8.25')}</>);
export const Ferma = crea('Ferma', <>{P('M8.5 7h7a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7A1.5 1.5 0 0 1 8.5 7Z')}</>);
export const Pannello = crea('Pannello', <>{P('M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z')}{P('M14.5 4.5v15')}</>);
const colonna = (x: number, freccia: string) =>
  crea(`Colonna${x}`, <>{P('M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z')}{P(`M${x} 4.5v15`)}{P(freccia)}</>);
export const ColonnaSinistraChiudi = colonna(9, 'M15.5 10 13.5 12l2 2');
export const ColonnaSinistraApri = colonna(9, 'M13.5 10l2 2-2 2');
export const ColonnaDestraChiudi = colonna(15, 'M8.5 10l2 2-2 2');
export const ColonnaDestraApri = colonna(15, 'M10.5 10 8.5 12l2 2');
export const Portafoglio = crea('Portafoglio', <>{P('M4.5 7.5h13.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5Z')}{P('M4.5 7.5 15 4.5v3')}{P('M15.5 13.25h1')}</>);
export const Firma = crea('Firma', <>{P('M6.5 3.5h7.5l4.5 4.5v5')}{P('M14 3.5V8h4.5')}{P('M6.5 3.5v17h5')}{P('M13.5 19.5c1.2-2.4 2.4-3.6 3.2-2.7.7.8-.6 2 .5 2.4 1 .4 1.6-1.1 2.8-1.2')}</>);
export const Visita = crea('Visita', <>{P('M6 4v4.5a4 4 0 0 0 8 0V4')}{P('M10 12.5V15a4.5 4.5 0 0 0 9 0v-1.5')}{P('M19 13.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z')}</>);
export const Corso = crea('Corso', <>{P('M2.75 9.5 12 5l9.25 4.5L12 14Z')}{P('M6.5 11.5V16c1.5 1.5 3.5 2.25 5.5 2.25s4-.75 5.5-2.25v-4.5')}{P('M21.25 9.5v5')}</>);
export const FrecciaUscita = crea('FrecciaUscita', <>{P('M7.5 16.5l9-9M9 7.5h7.5V15')}</>);
export const Casa = crea('Casa', <>{P('M4 11 12 4.5l8 6.5')}{P('M6 9.5V19.5h12V9.5')}{P('M10 19.5v-5h4v5')}</>);
export const Razzo = crea('Razzo', <>{P('M14.5 4.5c3 0 5 2 5 5-1.5 3.5-4.5 6-8 7.5L7 12.5c1.5-3.5 4-6.5 7.5-8Z')}{P('M7 12.5 4.5 13l2 2.5M11.5 17l-.5 2.5-2.5-2')}{P('M15 9.5h.01')}</>);
export const Fiamma = crea('Fiamma', <>{P('M12 20.5c-3.6 0-6-2.6-6-5.8 0-2.8 1.9-4.6 3.4-6.4.6 1.7 1.6 2.7 2.6 3.1-.2-2.8 1-5.4 3.2-7 .4 2.7 2.8 4.6 2.8 8.4 0 4.6-2.6 7.7-6 7.7Z')}</>);
export const Borsa = crea('Borsa', <>{P('M5.5 8h13l-1 11.5h-11Z')}{P('M9 10V7a3 3 0 0 1 6 0v3')}</>);
export const Orologio = crea('Orologio', <>{P('M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z')}{P('M12 7.5V12l3 2')}</>);
export const Fumetto = crea('Fumetto', <>{P('M5 6h14v10h-7.5L7 19.5V16H5Z')}</>);
export const Provetta = crea('Provetta', <>{P('M9.5 4h5M10.5 4v6.5L6 18.5a1 1 0 0 0 .9 1.5h10.2a1 1 0 0 0 .9-1.5l-4.5-8V4')}{P('M8 15h8')}</>);
export const Allerta = crea('Allerta', <>{P('M12 4.5 20.5 19h-17Z')}{P('M12 10v4M12 16.5v.1')}</>);
export const Campanella = crea('Campanella', <>{P('M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14Z')}{P('M10 20h4')}</>);
export const Conversazioni = crea('Conversazioni', <>{P('M4.5 5.5h11v8h-6.5l-3.5 3v-3H4.5Z')}{P('M15.5 9h4v8h-1v3l-3.5-3H11v-2.5')}</>);
export const NuovaConversazione = crea('NuovaConversazione', <>{P('M4.5 5.5h15v10.5H10l-4.5 3.5V16H4.5Z')}{P('M12 8.25v5M9.5 10.75h5')}</>);

// ---------- Alias con i nomi usati finora ----------
export {
  Azienda as Building2,
  Persone as Users,
  Persona as UserRound,
  PersonaVerificata as UserCheck,
  Calendario as CalendarClock,
  Documento as FileText,
  Casco as HardHat,
  Rete as Network,
  Interferenze as Handshake,
  Sopralluogo as ClipboardCheck,
  Bilancia as Scale,
  Sirena as Siren,
  Fotocamera as Camera,
  Microfono as Mic,
  Invia as SendHorizontal,
  Altoparlante as Volume2,
  Muto as VolumeX,
  Scarica as Download,
  Matita as Pencil,
  Cestino as Trash2,
  Segnalibro as Star,
  Luogo as MapPin,
  Scudo as ShieldCheck,
  ScudoAllerta as ShieldAlert,
  Libro as BookOpen,
  Libro as BookMarked,
  Storico as History,
  Elenco as ListOrdered,
  Cartella as FolderOpen,
  Regolazioni as Settings,
  Esci as LogOut,
  Immagine as ImageIcon,
  Audio as FileAudio,
  Nota as StickyNote,
  Lame as Wand2,
  Cerca as Search,
  Piu as Plus,
  Chiudi as X,
  Spunta as Check,
  Giu as ChevronDown,
  Indietro as ChevronLeft,
  Avanti as ChevronRight,
  Cerchio as Circle,
  CerchioSpunta as CheckCircle2,
  Avviso as AlertCircle,
  Rotore as Loader2,
  Ferma as Square,
  Pannello as LayoutPanelLeft,
  ColonnaSinistraChiudi as PanelLeftClose,
  ColonnaSinistraApri as PanelLeftOpen,
  ColonnaDestraChiudi as PanelRightClose,
  ColonnaDestraApri as PanelRightOpen,
  Conversazioni as MessagesSquare,
  NuovaConversazione as MessageSquarePlus,
  Portafoglio as Wallet,
  Firma as FileSignature,
  Visita as Stethoscope,
  Corso as GraduationCap,
  FrecciaUscita as ArrowUpRight,
};
