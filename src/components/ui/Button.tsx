import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-1.5',
          'font-sans font-medium rounded-full',
          'transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-white border border-[var(--color-border)] text-text hover:bg-[#f9fafb] hover:border-[var(--color-border-bold)]':
              variant === 'default',
            'bg-accent-primary text-white hover:bg-[#3a5cf5] shadow-soft':
              variant === 'primary',
            'bg-transparent text-text-muted hover:text-text hover:bg-[#f3f4f6]':
              variant === 'ghost',
            'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] hover:bg-[#fee2e2]':
              variant === 'danger',
          },
          {
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-5 py-2.5 text-base': size === 'lg',
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

Button.displayName = 'Button'
