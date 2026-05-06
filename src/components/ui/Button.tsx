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
          'font-sans font-medium transition-all rounded',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Y2K Skeuomorphic styles
          {
            // Default - raised button
            'bg-gradient-to-b from-white to-[#d0e8f8] border-2 border-[#5ba3d0] shadow-y2k-button hover:from-white hover:to-[#e0f0ff] active:from-[#d0e8f8] active:to-white':
              variant === 'default',
            // Primary - blue gradient
            'bg-gradient-to-b from-[#66ccff] to-[#0066cc] text-white border-2 border-[#004499] shadow-y2k hover:from-[#88ddff] hover:to-[#0077dd] active:from-[#0066cc] active:to-[#66ccff]':
              variant === 'primary',
            // Ghost - minimal
            'bg-transparent border-2 border-transparent hover:bg-[#e8f4fc] hover:border-[#a8d4f0]':
              variant === 'ghost',
            // Danger - red
            'bg-gradient-to-b from-[#ff8888] to-[#cc3333] text-white border-2 border-[#aa2222] shadow-y2k hover:from-[#ff9999] hover:to-[#dd4444]':
              variant === 'danger',
          },
          {
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
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
