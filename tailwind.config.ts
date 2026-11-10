import type { Config } from 'tailwindcss'

import defaultTheme from 'tailwindcss/defaultTheme'

/**
 * Densita' come in Tailwind 4: ogni spaziatura (p-4, gap-6, h-11...) deriva da --spacing
 * (0.25rem), e il gestionale con data-density="compact" la porta a 0.2rem senza cambiare classi.
 */
const spaziatura = Object.fromEntries(
  Object.entries(defaultTheme.spacing).map(([k, v]) =>
    k === '0' || k === 'px' ? [k, v] : [k, `calc(var(--spacing, 0.25rem) * ${k})`],
  ),
)

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    spacing: spaziatura,
    extend: {
      fontFamily: {
        // Identita' Portale HSE (ottobre 2026): Geist per tutto, Geist Mono per numeri e codici.
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      // Portale HSE: token della specifica con gli stessi nomi e valori (Tailwind 3,
      // decisione del 30/10/2026). I nomi storici restano come alias temporanei finche'
      // le viste non sono passate ai nomi nuovi: acido e oro = acid, perla e ink = superfici
      // e testo, cat-*-segno = cat-*-mark, stato-* = ok, warn, danger, info.
      colors: {
        // Marchio
        acid: {
          200: '#EBFFA8',
          300: '#E1FF73',
          400: '#D4FF3A',
          500: '#BEEB1E',
          700: '#677F02',
          950: '#232E00',
        },
        grafite: {
          50: '#F6F6F7',
          100: '#EFEFF1',
          200: '#E2E2E5',
          300: '#C4C4C9',
          400: '#9A9AA2',
          500: '#6B6B73',
          600: '#4A4A52',
          700: '#34343A',
          800: '#232326',
          900: '#18181B',
          950: '#0E0E10',
        },
        // Superfici e testo: cambiano col tema (data-theme="dark"), per ora solo chiaro.
        canvas: 'var(--hse-canvas)',
        surface: 'var(--hse-surface)',
        sunken: 'var(--hse-sunken)',
        line: 'var(--hse-line)',
        fg: {
          DEFAULT: 'var(--hse-fg)',
          muted: 'var(--hse-fg-muted)',
          faint: 'var(--hse-fg-faint)',
        },
        invert: 'var(--hse-invert)',
        'on-invert': 'var(--hse-on-invert)',
        // Categorie: pastello (testata, pastiglia), mark (icone, puntini, barre), ink (testo sul pastello).
        cat: {
          scadenze: '#F7ED6C', 'scadenze-mark': '#807801', 'scadenze-ink': '#332F00',
          persone: '#FECEE4', 'persone-mark': '#AD5B84', 'persone-ink': '#4D1634',
          formazione: '#DBD5FF', 'formazione-mark': '#7B6AB7', 'formazione-ink': '#302356',
          visite: '#BFE4FF', 'visite-mark': '#307CAB', 'visite-ink': '#00314D',
          antincendio: '#FFCFC7', 'antincendio-mark': '#C8452F', 'antincendio-ink': '#4F1609',
          primosoccorso: '#FFDCE5', 'primosoccorso-mark': '#C2335C', 'primosoccorso-ink': '#4D0E22',
          haccp: '#DAEEB6', 'haccp-mark': '#61801F', 'haccp-ink': '#263300',
          infortuni: '#EED9FF', 'infortuni-mark': '#8E4FC2', 'infortuni-ink': '#35134F',
          documenti: '#FFC6AC', 'documenti-mark': '#C25516', 'documenti-ink': '#501A00',
          servizi: '#99F5E9', 'servizi-mark': '#02847A', 'servizi-ink': '#003631',
          contratto: '#FEDAB2', 'contratto-mark': '#9E6B28', 'contratto-ink': '#432600',
          pagamenti: '#ACF6BB', 'pagamenti-mark': '#178741', 'pagamenti-ink': '#003915',
          assistenza: '#DEEEF6', 'assistenza-mark': '#307E9F', 'assistenza-ink': '#243036',
          utenti: '#E7E7EA', 'utenti-mark': '#6B6B73', 'utenti-ink': '#232326',
          ispezioni: '#18181B', 'ispezioni-mark': '#677F02', 'ispezioni-ink': '#D4FF3A',
          // Alias temporanei (nome storico -segno).
          'documenti-segno': '#C25516', 'formazione-segno': '#7B6AB7', 'visite-segno': '#307CAB',
          'scadenze-segno': '#807801', 'persone-segno': '#AD5B84', 'contratto-segno': '#9E6B28',
          'pagamenti-segno': '#178741', 'servizi-segno': '#02847A', 'assistenza-segno': '#307E9F',
          'antincendio-segno': '#C8452F', 'utenti-segno': '#6B6B73',
        },
        // Stati (sempre con icona e testo, mai solo colore).
        ok: { DEFAULT: '#CFF2DC', mark: '#16884A', ink: '#0B3D20' },
        warn: { DEFAULT: '#FFE6A8', mark: '#A86800', ink: '#432B00' },
        danger: { DEFAULT: '#FFD3CF', mark: '#D63D3E', ink: '#4F1110' },
        info: { DEFAULT: '#DCE7F7', mark: '#5678A3', ink: '#122947' },

        // ---- Alias temporanei dei nomi storici (da togliere quando le viste usano i nomi nuovi) ----
        brand: {
          50: '#F6F6F7',
          100: '#EFEFF1',
          200: '#E2E2E5',
          300: '#C4C4C9',
          400: '#9A9AA2',
          500: '#34343A',
          600: '#232326',
          700: '#18181B',
          800: '#18181B',
          900: '#18181B',
          950: '#0E0E10',
        },
        acido: {
          200: '#EBFFA8',
          300: '#E1FF73',
          400: '#D4FF3A',
          500: '#BEEB1E',
          700: '#677F02',
          950: '#232E00',
        },
        perla: {
          DEFAULT: '#FFFFFF',
          fondo: '#FFFFFF',
          velo: '#F4F4F5',
          superficie: '#FFFFFF',
          carta: '#FFFFFF',
          linea: '#E2E2E5',
        },
        oro: {
          50: '#F7FFE0',
          100: '#EBFFA8',
          200: '#E1FF73',
          300: '#D4FF3A',
          400: '#C8F52C',
          500: '#D4FF3A',
          600: '#677F02',
          700: '#4F6200',
        },
        stato: {
          ok: '#CFF2DC', 'ok-segno': '#16884A', 'ok-ink': '#0B3D20',
          warn: '#FFE6A8', 'warn-segno': '#A86800', 'warn-ink': '#432B00',
          danger: '#FFD3CF', 'danger-segno': '#D63D3E', 'danger-ink': '#4F1110',
          info: '#DCE7F7', 'info-segno': '#5678A3', 'info-ink': '#122947',
        },
        ink: {
          DEFAULT: '#111113',
          soft: '#232326',
          muted: '#5E5E66',
          subtle: '#6B6B73',
        },
        // Solo per le schermate DVR dello studio (matrice PxG e stato del DVR).
        risk: {
          low: '#22c55e',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444',
        },
        status: {
          draft: '#94a3b8',
          review: '#eab308',
          approved: '#10b981',
          superseded: '#64748b',
        },
      },
      // Scala tipografica della specifica: text-display ... text-caption.
      fontSize: {
        display: ['4rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '300' }],
        h1: ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '500' }],
        h2: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        h3: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '500' }],
        title: ['1.125rem', { lineHeight: '1.35', fontWeight: '500' }],
        body: ['1rem', { lineHeight: '1.5' }],
        small: ['0.875rem', { lineHeight: '1.45' }],
        caption: ['0.75rem', { lineHeight: '1.35', letterSpacing: '0.02em', fontWeight: '500' }],
      },
      // Forme e ombre della specifica (anche come variabili: rounded-[var(--radius-lg)]).
      borderRadius: {
        'hse-sm': 'var(--radius-sm)',
        'hse-md': 'var(--radius-md)',
        'hse-lg': 'var(--radius-lg)',
        'hse-xl': 'var(--radius-xl)',
        'hse-2xl': 'var(--radius-2xl)',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      backgroundImage: {
        // Sfondo chiaro e arioso: bianco con velo blu tenue (SaaS premium).
        'luxury-bg': 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)',
        'luxury-radial':
          'none',
        'glass-card':
          'linear-gradient(160deg, #FFFFFF 0%, #FFFFFF 100%)',
        'brand-gradient': 'linear-gradient(135deg, #18181B 0%, #0E0E10 100%)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        pop: 'var(--shadow-pop)',
        'luxury-sm': '0 2px 12px rgba(14, 14, 16, 0.06), 0 1px 3px rgba(14, 14, 16, 0.04)',
        'luxury-md':
          '0 8px 32px rgba(14, 14, 16, 0.10), 0 2px 8px rgba(14, 14, 16, 0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
        'luxury-lg':
          '0 16px 48px rgba(14, 14, 16, 0.16), 0 4px 16px rgba(14, 14, 16, 0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
        'glow-violet':
          '0 0 0 1px rgba(14,14,16,0.22), 0 8px 32px rgba(14,14,16,0.18), 0 0 60px rgba(14,14,16,0.12)',
      },
      animation: {
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'logo-pulse': 'logoPulse 4s ease-in-out infinite',
        'fade-up': 'fadeUp 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-in': 'fadeIn 250ms ease-out both',
        'logo-bounce': 'logoBounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        // Alone dorato del falco: pulsa solo mentre parla.
        alone: 'alone 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        // Entrata delle scritte: la riga sale da una maschera, senza rimbalzi.
        riga: 'riga 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'riga-lenta': 'riga 1200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        comparsa: 'comparsa 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        logoPulse: {
          '0%, 100%': {
            filter:
              'drop-shadow(0 0 12px rgba(14,14,16,0.18)) drop-shadow(0 0 24px rgba(14,14,16,0.06))',
          },
          '50%': {
            filter:
              'drop-shadow(0 0 24px rgba(14,14,16,0.32)) drop-shadow(0 0 48px rgba(14,14,16,0.12))',
          },
        },
        logoBounce: {
          '0%': { transform: 'scale(1) rotate(0deg)' },
          '30%': { transform: 'scale(1.12) rotate(-3deg)' },
          '60%': { transform: 'scale(0.96) rotate(2deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        alone: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.96)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
        riga: {
          '0%': { transform: 'translateY(105%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        comparsa: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      letterSpacing: {
        wider2: '0.08em',
        wider3: '0.12em',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
