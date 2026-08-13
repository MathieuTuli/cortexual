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

  /**
   * Locking the body removes the scrollbar, which widens the viewport and
   * nudges everything — including fixed chrome, which body padding can't reach.
   * The width it took is published as --scroll-lock so those elements can hold
   * their place.
   */
  useEffect(() => {
    if (!open) return

    const gutter = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.setProperty('--scroll-lock', `${gutter}px`)
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.removeProperty('--scroll-lock')
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="absolute inset-0 flex items-center justify-center p-6"
        onClick={() => onOpenChange(false)}
      >
        <div
          className={clsx(
            'relative w-full max-w-2xl max-h-[86vh] overflow-y-auto',
            'bg-bg rounded-2xl shadow-pop',
            'animate-slide-up',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-bg px-7 pt-6 pb-4">
              <h2 className="font-display text-subtitle font-medium text-text truncate">{title}</h2>
              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full text-text-faint hover:text-text hover:bg-chip transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          )}
          <div className={clsx(title ? 'px-7 pb-7' : 'p-7')}>{children}</div>
        </div>
      </div>
    </div>
  )
}
