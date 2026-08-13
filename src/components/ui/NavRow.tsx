import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { clsx } from 'clsx'
import { Marquee } from './Marquee'

interface NavRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  active?: boolean
  /** Usually a count. Stays put while the label loops. */
  trailing?: React.ReactNode
}

/** Filled at rest, so a row reads as a button rather than floating text. */
const IDLE: CSSProperties = {
  '--pill-bg': 'var(--chip)',
  '--pill-bg-hover': 'var(--sunken)',
  '--pill-fg': 'var(--text-body)',
} as CSSProperties

const ACTIVE: CSSProperties = {
  '--pill-bg': 'var(--accent)',
  '--pill-bg-hover': 'var(--accent-hover)',
  '--pill-fg': 'var(--white)',
} as CSSProperties

/** Every row in the navigation column, so they all round off the same way. */
export function NavRow({ label, active = false, trailing, className, style, ...props }: NavRowProps) {
  return (
    <button
      style={{ ...(active ? ACTIVE : IDLE), ...style }}
      className={clsx('pill pill--row', className)}
      {...props}
    >
      <Marquee text={label} />
      {trailing !== undefined && (
        <span className="flex-shrink-0 pr-3 text-xs tabular-nums opacity-60">{trailing}</span>
      )}
    </button>
  )
}
