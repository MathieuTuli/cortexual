import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-full flex-shrink-0',
          'transition-colors duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          {
            'bg-chip text-text hover:bg-sunken': variant === 'default',
            'bg-transparent text-text-faint hover:text-text hover:bg-chip': variant === 'ghost',
          },
          {
            'w-7 h-7': size === 'sm',
            'w-9 h-9': size === 'md',
            'w-11 h-11': size === 'lg',
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
