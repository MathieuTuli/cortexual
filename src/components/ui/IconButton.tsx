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
          'inline-flex items-center justify-center rounded',
          'font-sans transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-gradient-to-b from-white to-[#d0e8f8] border-2 border-[#88b0d0] shadow-y2k-button hover:from-white hover:to-[#e0f0ff]':
              variant === 'default',
            'bg-transparent hover:bg-[#c8dff0] text-accent-primary':
              variant === 'ghost',
          },
          {
            'w-5 h-5 text-[10px]': size === 'sm',
            'w-7 h-7 text-xs': size === 'md',
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
