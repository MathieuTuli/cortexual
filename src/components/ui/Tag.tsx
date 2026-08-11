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
        'inline-flex items-center gap-1',
        'font-sans text-[11px] font-medium',
        'rounded-full px-2 py-0.5',
        'transition-colors',
        active
          ? 'bg-accent-primary text-white'
          : 'bg-[#f3f4f6] text-[#475569] hover:bg-[#e5e7eb]',
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
            'ml-0.5 leading-none',
            active ? 'text-white/80 hover:text-white' : 'text-text-muted hover:text-text'
          )}
        >
          ×
        </button>
      )}
    </span>
  )
}
