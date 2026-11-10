import { percorso } from '@/lib/percorso';

const AVATAR = percorso('/brand/falco-acido/avatar.webp');

/**
 * Il Falco dentro il pulsante dell'assistente (decisione del 30/10/2026: al posto dell'icona
 * della specifica). Sul fondo acido il bianco della foto si fonde col verde (moltiplica);
 * sul fondo nero la foto resta com'è dentro il suo cerchio.
 */
export function FalcoTondo({ size, suNero = false }: { size: number; suNero?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={AVATAR}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={suNero ? 'rounded-full bg-white object-cover' : 'object-cover mix-blend-multiply'}
      style={{ width: size, height: size, transform: 'scale(2.4)', transformOrigin: '50% 22%' }}
    />
  );
}
