import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replaced rather than extended: the app had five unrelated radii and the
    // point of this scale is that everything lands on one of four.
    borderRadius: {
      none: '0',
      sm: '8px',
      DEFAULT: '10px',
      md: '12px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['SF Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // Overrides Tailwind's own #ffffff, so every text-white and bg-white in
        // the app follows the token rather than needing to be found and edited.
        white: 'rgb(var(--white-rgb) / <alpha-value>)',
        bg: 'var(--bg)',
        chip: 'var(--chip)',
        card: 'var(--card)',
        sunken: 'var(--sunken)',
        text: {
          DEFAULT: 'var(--text)',
          body: 'var(--text-body)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        tongue: 'var(--tongue)',
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },
      },
      fontSize: {
        // Titles and subtitles, sized up to carry the display face.
        hero: ['52px', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        title: ['40px', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        subtitle: ['24px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      },
      boxShadow: {
        float: '0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 28px rgba(0, 0, 0, 0.08)',
        pop: '0 4px 12px rgba(0, 0, 0, 0.06), 0 24px 64px rgba(0, 0, 0, 0.14)',
      },
      animation: {
        'slide-up': 'slideUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
