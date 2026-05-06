import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SF Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Trebuchet MS', 'Arial', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-bold': 'var(--color-border-bold)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        accent: {
          primary: 'var(--color-accent-primary)',
          secondary: 'var(--color-accent-secondary)',
          highlight: 'var(--color-accent-highlight)',
          glow: 'var(--color-accent-glow)',
        },
      },
      borderWidth: {
        '3': '3px',
      },
      boxShadow: {
        'y2k': '2px 2px 6px rgba(0, 60, 120, 0.15)',
        'y2k-inset': 'inset 2px 2px 4px rgba(0, 40, 80, 0.1)',
        'y2k-button': 'inset 1px 1px 0 #ffffff, inset -1px -1px 0 #a0c8e8, 2px 2px 4px rgba(0, 60, 120, 0.2)',
      },
      animation: {
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
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
