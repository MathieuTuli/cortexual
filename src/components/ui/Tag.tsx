import { clsx } from 'clsx'

interface TagProps {
  children: string
  onClick?: () => void
  onRemove?: () => void
  active?: boolean
  className?: string
}

export function Tag({ children, onClick, onRemove, active, className }: TagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5',
        'font-sans text-xs',
        'rounded-full h-7 px-3',
        'transition-colors',
        active ? 'bg-accent text-white' : 'bg-chip text-text-body hover:bg-sunken',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className={clsx(
            'leading-none text-sm',
            active ? 'text-white/70 hover:text-white' : 'text-text-faint hover:text-text'
          )}
          aria-label={`Remove ${children}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
