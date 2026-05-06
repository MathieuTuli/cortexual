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
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  // Prevent body scroll when modal is open
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
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#1a3a5c]/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal container - also closes on click */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={() => onOpenChange(false)}
      >
        {/* Modal window */}
        <div
          className={clsx(
            'relative w-full max-w-2xl max-h-[85vh] overflow-y-auto',
            // Y2K Window style
            'bg-gradient-to-b from-[#f0f8ff] to-[#d8ecf8]',
            'border-2 rounded-lg',
            'border-t-white border-l-white border-b-[#88b0d0] border-r-[#88b0d0]',
            'shadow-[4px_4px_12px_rgba(0,60,120,0.3)]',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title bar - Y2K style */}
          {title && (
            <div className="relative flex items-center px-4 py-2 bg-gradient-to-r from-[#0066cc] to-[#00aaff] text-white font-bold rounded-t-md">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gradient-to-br from-[#66ccff] to-[#0044aa] rounded-full border border-[#004488]" />
                {title}
              </span>
              <button
                onClick={() => onOpenChange(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-gradient-to-b from-[#ff8888] to-[#cc4444] text-white text-xs font-bold rounded border border-[#aa3333] hover:from-[#ff9999] hover:to-[#dd5555] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
