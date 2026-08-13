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
          'w-full h-10 px-4 rounded-md',
          'font-sans text-sm text-text placeholder:text-text-faint',
          'bg-chip border-0 transition-colors',
          'focus:outline-none focus:bg-sunken focus:ring-2 focus:ring-accent/25',
          error && 'ring-2 ring-danger/40',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
