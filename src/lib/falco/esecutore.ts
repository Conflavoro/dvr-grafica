/**
 * Esecutore dei passi d'interfaccia del Falco principale, nel browser.
 *
 * Vive fuori da React (modulo unico) perche' il cambio di schermata smonta e
 * rimonta il guscio: lo stato (riga "Falco sta lavorando", riepilogo finale,
 * conversazione da riprendere) resta qui e il guscio nuovo lo rilegge. Il guscio
 * registra l'ambiente: come navigare, come scegliere l'azienda, come aprire un oggetto.
 *
 * Cursore fantasma sobrio che va verso il punto, evidenza, tocco solo dei pulsanti
 * segnati data-falco-tocca, digitazione simulata nei campi data-falco-campo.
 * Con prefers-reduced-motion: niente spostamenti ne' digitazione animata, solo evidenza.
 */

import { battute, pianoEsecuzione, posizioneCursore, riassunto, type Operazione, type PassoInterfaccia } from './interfaccia';

export interface AmbienteFalco {
  naviga: (rotta: string) => void;
  percorso: () => string;
  basePath: string;
  aziendaId: () => number | null;
  scegliAzienda: (id: number) => void;
  apriOggetto: (o: { tipo: string; id: number }, aziendaId: number | null) => void;
}

export interface StatoFalco {
  fase: 'fermo' | 'lavoro' | 'fatto';
  riga: string;
  riepilogo: string;
  conversazioneId: number | null;
  /** Punti non trovati a schermo (si prosegue senza fermarsi). */
  saltati: number;
  /** Cresce a ogni esecuzione: serve al pannello per riaprire la conversazione giusta. */
  giro: number;
}

let ambiente: AmbienteFalco | null = null;
let stato: StatoFalco = { fase: 'fermo', riga: '', riepilogo: '', conversazioneId: null, saltati: 0, giro: 0 };
const ascoltatori = new Set<(s: StatoFalco) => void>();
let corsa = 0;

function imposta(p: Partial<StatoFalco>): void {
  stato = { ...stato, ...p };
  ascoltatori.forEach((f) => f(stato));
}

export function registraAmbiente(a: AmbienteFalco | null): void {
  ambiente = a;
}

export function statoFalco(): StatoFalco {
  return stato;
}

export function ascoltaFalco(f: (s: StatoFalco) => void): () => void {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
}

export function chiudiStriscia(): void {
  corsa++;
  rimuoviCursore();
  imposta({ fase: 'fermo', riga: '' });
}

function movimentoRidotto(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Aspetta che il punto compaia (la schermata nuova carica i suoi dati). */
async function attendi(selettore: string, ms: number, mia: number): Promise<HTMLElement | null> {
  const fine = Date.now() + ms;
  while (Date.now() < fine && mia === corsa) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(selettore)).find((e) => e.offsetParent !== null || e.getClientRects().length > 0);
    if (el) return el;
    await pausa(120);
  }
  return null;
}

// ---------------------------------------------------------------- cursore ed evidenza

const ID_CURSORE = 'falco-cursore';

function cursore(): HTMLElement {
  let c = document.getElementById(ID_CURSORE);
  if (!c) {
    c = document.createElement('div');
    c.id = ID_CURSORE;
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('data-falco-cursore', '');
    // Freccia scura con bordo bianco e il nome accanto: sobria, leggibile su ogni fondo.
    // La scritta sta sotto la freccia; con data-sopra sale sopra (column-reverse).
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22" style="display:block"><path d="M3 2l15 8.2-6.6 1.6L8.6 19z" fill="#18181B" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<span style="display:block;margin:2px 0 2px 14px;padding:1px 6px;border-radius:6px;background:#18181B;color:#fff;font-weight:500;font-size:11px;line-height:16px;font-family:inherit;white-space:nowrap">Falco</span>';
    Object.assign(c.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      zIndex: '90',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      pointerEvents: 'none',
      transform: `translate(${Math.round(window.innerWidth / 2)}px, ${Math.round(window.innerHeight - 120)}px)`,
      transition: 'transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms', // --ease-snap dei token
    });
    document.body.appendChild(c);
  }
  return c;
}

function rimuoviCursore(): void {
  document.getElementById(ID_CURSORE)?.remove();
  document.querySelectorAll('.falco-evidenza').forEach((e) => e.classList.remove('falco-evidenza'));
}

async function punta(el: HTMLElement, ridotto: boolean): Promise<void> {
  el.scrollIntoView({ block: 'center', behavior: ridotto ? 'auto' : 'smooth' });
  await pausa(ridotto ? 60 : 350);
  if (!ridotto) {
    const r = el.getBoundingClientRect();
    const { x, y, sopra } = posizioneCursore(r, { larghezza: window.innerWidth, altezza: window.innerHeight, riservaBasso: riservaStriscia() });
    const c = cursore();
    c.style.flexDirection = sopra ? 'column-reverse' : 'column';
    // Con la scritta sopra la punta della freccia resta sul punto: si sale dell'altezza della scritta.
    const su = sopra ? (c.querySelector('span')?.getBoundingClientRect().height ?? 18) + 4 : 0;
    c.style.transform = `translate(${x}px, ${y - su}px)`;
    await pausa(700);
  }
  document.querySelectorAll('.falco-evidenza').forEach((e) => e.classList.remove('falco-evidenza'));
  el.classList.add('falco-evidenza');
}

/** Spazio occupato in basso dalla striscia del Falco (pixel), letto dalla variabile CSS del guscio. */
function riservaStriscia(): number {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--falco-riserva'));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function scriviValore(el: HTMLElement, v: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (set) set.call(el, v);
  else (el as HTMLInputElement).value = v;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

async function esegui(o: Operazione, mia: number, ridotto: boolean): Promise<boolean> {
  const amb = ambiente;
  switch (o.op) {
    case 'riga':
      imposta({ riga: o.testo });
      return true;
    case 'azienda':
      amb?.scegliAzienda(o.id);
      await pausa(80);
      return true;
    case 'naviga':
      amb?.naviga(o.rotta);
      await pausa(ridotto ? 150 : 400);
      return true;
    case 'oggetto':
      ambiente?.apriOggetto({ tipo: o.tipo, id: o.id }, o.aziendaId);
      return true;
    case 'punta': {
      const el = await attendi(o.selettore, 8000, mia);
      if (!el) return false;
      await punta(el, ridotto);
      if (o.tocca) {
        // Difesa in profondita': si toccano solo i pulsanti segnati (aprono un foglio, non inviano).
        if (!el.hasAttribute('data-falco-tocca')) return false;
        await pausa(ridotto ? 80 : 300);
        el.click();
      }
      await pausa(ridotto ? 300 : 900);
      return true;
    }
    case 'scrivi': {
      const el = await attendi(o.selettore, 6000, mia);
      if (!el) return false;
      await punta(el, ridotto);
      el.focus({ preventScroll: true });
      if (ridotto) scriviValore(el, o.valore);
      else
        for (const t of battute(o.valore)) {
          if (mia !== corsa) return false;
          scriviValore(el, t);
          await pausa(45);
        }
      await pausa(ridotto ? 200 : 500);
      return true;
    }
  }
}

/**
 * Esegue i passi davanti all'utente. Una nuova esecuzione ferma quella in corso.
 * Alla fine la striscia mostra il riepilogo della risposta.
 */
export async function eseguiPassi(passi: PassoInterfaccia[], opz: { testo: string; conversazioneId: number | null }): Promise<void> {
  if (passi.length === 0 || typeof window === 'undefined') return;
  const mia = ++corsa;
  const ridotto = movimentoRidotto();
  imposta({ fase: 'lavoro', riga: passi[0].etichetta, riepilogo: riassunto(opz.testo), conversazioneId: opz.conversazioneId, saltati: 0, giro: stato.giro + 1 });
  const ops = pianoEsecuzione(passi, { percorso: ambiente?.percorso() ?? window.location.pathname, aziendaId: ambiente?.aziendaId() ?? null, basePath: ambiente?.basePath ?? '' });
  let saltati = 0;
  for (const o of ops) {
    if (mia !== corsa) return;
    const ok = await esegui(o, mia, ridotto);
    if (!ok) saltati++;
  }
  if (mia !== corsa) return;
  document.getElementById(ID_CURSORE)?.remove();
  imposta({ fase: 'fatto', riga: '', saltati });
  // L'evidenza resta qualche secondo, poi si spegne.
  setTimeout(() => {
    if (mia === corsa) document.querySelectorAll('.falco-evidenza').forEach((e) => e.classList.remove('falco-evidenza'));
  }, 4000);
}
