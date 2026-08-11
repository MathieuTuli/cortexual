import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-white border border-[var(--color-border)] hover:bg-[#f9fafb] text-text':
              variant === 'default',
            'bg-transparent hover:bg-[#f3f4f6] text-text-muted hover:text-text':
              variant === 'ghost',
          },
          {
            'w-6 h-6': size === 'sm',
            'w-8 h-8': size === 'md',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
