import type { IconaComponente, IconaProps } from '@/components/icone';

/**
 * Icone delle voci nuove del Portale HSE, disegnate come quelle di components/icone:
 * griglia 24, tratto 1.5, estremi arrotondati. Nessuna icona "da AI".
 */
function crea(nome: string, d: string[]): IconaComponente {
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
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
  C.displayName = nome;
  return C;
}

/** Primo soccorso: valigetta con la croce. */
export const Valigetta = crea('Valigetta', [
  'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7',
  'M4.5 7h15a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
  'M12 10.5v5.5M9.25 13.25h5.5',
]);

/** HACCP: forchetta e coltello. */
export const Posate = crea('Posate', [
  'M7 3.5v5.25a2 2 0 0 0 4 0V3.5M9 3.5v17',
  'M17 20.5V3.5c-2 1.2-3 3.4-3 6.2V13h3',
]);

/** Infortuni: cerotto. */
export const Cerotto = crea('Cerotto', [
  'M4.4 14.2 14.2 4.4a2.9 2.9 0 0 1 4.1 0l1.3 1.3a2.9 2.9 0 0 1 0 4.1L9.8 19.6a2.9 2.9 0 0 1-4.1 0l-1.3-1.3a2.9 2.9 0 0 1 0-4.1Z',
  'M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01',
]);

/** Tutto: griglia di quattro riquadri. */
export const Griglia = crea('Griglia', [
  'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
]);

/** Gesto della riga da trascinare. */
export const Mano = crea('Mano', [
  'M9 11.5V5.75a1.25 1.25 0 0 1 2.5 0V11',
  'M11.5 10.5V4.75a1.25 1.25 0 0 1 2.5 0v5.75',
  'M14 10.5V6.25a1.25 1.25 0 0 1 2.5 0V14a6.5 6.5 0 0 1-6.5 6.5h-.4a5 5 0 0 1-4.1-2.1l-2.4-3.5a1.3 1.3 0 0 1 2-1.6L9 15',
]);
