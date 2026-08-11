import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onOpenChange, title, children, className }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div
        className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={() => onOpenChange(false)}
      >
        <div
          className={clsx(
            'relative w-full max-w-2xl max-h-[85vh] overflow-y-auto',
            'bg-white rounded-2xl border border-[var(--color-border)]',
            'shadow-[0_24px_72px_rgba(15,23,42,0.18)]',
            'animate-slide-up',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-base font-semibold text-text">{title}</h2>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-[#f3f4f6] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          )}
          <div className={clsx(title ? 'px-6 pb-6' : 'p-6')}>{children}</div>
        </div>
      </div>
    </div>
  )
}
