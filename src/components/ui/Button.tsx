import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { clsx } from 'clsx'
import { Marquee } from './Marquee'

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'invert'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
}

/** Variant colours ride on the properties `.pill` reads, so the shape CSS
 *  never has to know a variant exists. */
const TONE: Record<Variant, CSSProperties> = {
  default: {},
  primary: {
    '--pill-bg': 'var(--accent)',
    '--pill-bg-hover': 'var(--accent-hover)',
    '--pill-fg': 'var(--white)',
  },
  ghost: {
    '--pill-bg': 'transparent',
    '--pill-bg-hover': 'var(--chip)',
    '--pill-fg': 'var(--text-muted)',
  },
  danger: {
    '--pill-bg': 'var(--danger-soft)',
    '--pill-bg-hover': 'var(--sunken)',
    '--pill-fg': 'var(--danger)',
  },
  invert: { '--pill-bg': 'var(--text)', '--pill-bg-hover': 'var(--text)', '--pill-fg': 'var(--white)' },
} as Record<Variant, CSSProperties>

const SIZE = { sm: 'pill--sm', md: 'pill--md', lg: 'pill--lg' } as const

const MIN_WIDTH = { sm: 'min-w-[76px]', md: 'min-w-[96px]', lg: 'min-w-[120px]' } as const

/**
 * The label loops and the pill goes oval on hover, after Dinamo. That needs the
 * text as a plain string, so a button handed elements keeps the shape and drops
 * the animation.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, style, ...props }, ref) => (
    <button
      ref={ref}
      style={{ ...TONE[variant], ...style } as CSSProperties}
      className={clsx('pill', SIZE[size], MIN_WIDTH[size], className)}
      {...props}
    >
      {typeof children === 'string' ? (
        <Marquee text={children} />
      ) : (
        <span className="px-4">{children}</span>
      )}
    </button>
  )
)

Button.displayName = 'Button'
