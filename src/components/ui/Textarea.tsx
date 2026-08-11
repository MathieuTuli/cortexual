import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={clsx(
          'w-full px-3.5 py-2.5 rounded-lg resize-none',
          'font-sans text-sm text-text placeholder:text-text-muted',
          'bg-white border transition-colors',
          'focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20',
          error
            ? 'border-[#fca5a5] focus:border-[#dc2626] focus:ring-[#dc2626]/20'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-bold)]',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
