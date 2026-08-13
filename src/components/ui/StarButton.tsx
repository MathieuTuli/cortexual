import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface StarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tailwind size classes, e.g. "w-10 h-10". */
  size?: string
}

/**
 * A round icon button whose backing shape blooms into an eleven-pointed star
 * on hover, the points travelling around the rim. The shape is an SVG path
 * rather than a border-radius, because no amount of corner rounding makes
 * eleven of anything; the morph itself lives in the generated star-ripple.css.
 */
export const StarButton = forwardRef<HTMLButtonElement, StarButtonProps>(
  ({ size = 'w-10 h-10', className, children, ...props }, ref) => (
    <button ref={ref} className={clsx('star-btn', size, className)} {...props}>
      <svg className="star-btn__shape" viewBox="0 0 100 100" aria-hidden focusable="false">
        <path />
      </svg>
      <span className="star-btn__icon">{children}</span>
    </button>
  )
)

StarButton.displayName = 'StarButton'
