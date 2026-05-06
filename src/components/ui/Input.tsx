import { forwardRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full px-3 py-2 rounded',
          'font-sans text-text placeholder:text-text-muted',
          // Y2K inset field style
          'bg-gradient-to-b from-[#e0ecf4] to-white',
          'border-2',
          'shadow-y2k-inset',
          'focus:outline-none focus:ring-2 focus:ring-accent-secondary focus:ring-opacity-50',
          'transition-all',
          error
            ? 'border-red-400'
            : 'border-[#88b0d0] focus:border-accent-primary',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
