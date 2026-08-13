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
          'w-full px-4 py-3 rounded-lg resize-none',
          'font-sans text-[15px] leading-relaxed text-text placeholder:text-text-faint',
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

Textarea.displayName = 'Textarea'
